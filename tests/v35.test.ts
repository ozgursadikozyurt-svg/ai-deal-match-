/**
 * Anahtar CRM v3.22.1 · 9 Ekim 2026
 * v3.5 — veritabanısız testler: Talep DNA'sı, eksik bilgi, Anahtar Uyum Matrisi, havuz akışı,
 * kural tabanlı hızlı ayrıştırıcı (AI kredisi harcamadan), soru → filtre, portföy edinme fırsatı.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { talepDnasi } from "../src/lib/eslestirme/talep-dna";
import { eslesmeOnizle, temelUyum } from "../src/lib/eslestirme/onizleme";
import { havuzKatmani, portfoyEdinmeFirsati } from "../src/lib/eslestirme/havuz";
import { hizliAyristir, soruFiltresi, metinTuru, metindenKonumlar } from "../src/lib/ai/hizli-ayristirici";
import { KayitCreateSchema } from "../src/lib/validation/kayit";
import { ornekVeriyiKur } from "../demo/depo";
import { BAGLAM, INDEKS, coz, cozulenToKayitLok } from "../demo/lokasyon";
import { SADECE_TEST_baglamiSabitle, VARSAYILAN_OFIS_ID, VARSAYILAN_KULLANICI_ID } from "../src/lib/kiracilik";
// v3.20 — çok ofisli: testler varsayılan ofisin bağlamında çalışır (göçte açılan Özyurtlar Gayrimenkul)
SADECE_TEST_baglamiSabitle({ ofisId: VARSAYILAN_OFIS_ID, kullaniciId: VARSAYILAN_KULLANICI_ID, rol: "OFIS_YONETICISI", eposta: "test@anahtar.local" });


const talep = (x: any) => ({ tip: "TALEP", lokasyonlar: [{ ilId: 7, ilceId: 1 }], ...x });

test("Talep DNA: üretim talebinde kW ve ruhsat yoksa 'kritik bilgi eksik' uyarısı ve soru mesajı", () => {
  const d = talepDnasi(talep({ mulkTipi: "IMALATHANE", islemTipi: "KIRALIK", minM2: 800, maxFiyat: 90000 }) as any);
  assert.deepEqual(d.profiller.map((p) => p.kod), ["URETIM"]);
  assert.equal(d.uyari, "Doğru eşleştirme için 2 kritik bilgi eksik: Minimum elektrik (kW), Ruhsat");
  assert.match(d.soruMesaji!, /kaç kW/);
  // kW verilince öldürücü kritere dönüşür
  const d2 = talepDnasi(talep({ mulkTipi: "IMALATHANE", islemTipi: "KIRALIK", minM2: 800, maxFiyat: 90000, ozellik: { elektrikGucuKw: 100, ruhsatDurumu: "RUHSATLI" } }) as any);
  assert.ok(d2.kritik.some((k) => k.kriter === "ELEKTRIK" && k.kaynak === "AMAC"));
  assert.equal(d2.uyari, null);
});

test("Esnek alan ±%20: 1.000 m² isteyen talep 830 m²'yi esnekse kabul eder, değilse eler", () => {
  const p = { tip: "PORTFOY", mulkTipi: "DEPO_ANTREPO", islemTipi: "KIRALIK", m2: 830, fiyat: 100000, fiyatPeriyodu: "AYLIK", lokasyonlar: [{ ilId: 7, ilceId: 1 }] } as any;
  const kati = talep({ mulkTipi: "DEPO_ANTREPO", islemTipi: "KIRALIK", minM2: 1000, maxFiyat: 120000, fiyatPeriyodu: "AYLIK" });
  assert.equal(eslesmeOnizle(kati as any, p, BAGLAM).uygunluk, "UYGUN_DEGIL");
  const esnek = { ...kati, ozellik: { esnekKriterler: ["ALAN"] } };
  const s = eslesmeOnizle(esnek as any, p, BAGLAM);
  assert.notEqual(s.uygunluk, "UYGUN_DEGIL");
  assert.ok(s.kriterler.some((k) => k.etiket === "Alan (±%20)" && k.puan === 0.75));
});

test("Anahtar Uyum Matrisi: sanayi ağırlıkları, istenmeyen bileşen dağıtılır, öldürücü engelde skor ≤ 40", () => {
  const { kayitlar } = ornekVeriyiKur();
  const T2 = kayitlar.find((k) => k.id === "T2")!, P2 = kayitlar.find((k) => k.id === "P2")!, P4 = kayitlar.find((k) => k.id === "P4")!;
  const iyi = eslesmeOnizle(T2.veri as any, P2.veri as any, BAGLAM);
  assert.equal(iyi.matris.ad, "Sanayi / depo");
  assert.equal(iyi.matris.bilesenler.reduce((a, b) => a + b.agirlik, 0), 100);
  assert.ok(iyi.matris.bilesenler.some((b) => b.puan == null)); // ör. ruhsat istenmedi
  assert.ok(iyi.skor >= 80);
  const kotu = eslesmeOnizle(T2.veri as any, P4.veri as any, BAGLAM);
  assert.equal(kotu.uygunluk, "UYGUN_DEGIL");
  assert.ok(kotu.skor <= 40);
});

test("Havuz akışı: yetkili → CRM → partner → web ilanı", () => {
  assert.equal(havuzKatmani({ havuz: "KENDI_PORTFOY", yetkili: true, ilanSahibiTipi: "MALIK" }), "YETKILI");
  assert.equal(havuzKatmani({ havuz: "KENDI_PORTFOY", ilanSahibiTipi: "MALIK", veriKanali: "WHATSAPP" }), "CRM");
  assert.equal(havuzKatmani({ havuz: "KENDI_PORTFOY", ilanSahibiTipi: "EMLAKCI" }), "PARTNER");
  assert.equal(havuzKatmani({ havuz: "DIS_ILAN", ilanSahibiTipi: "MALIK", veriKanali: "SAHIBINDEN" }), "WEB");
  assert.deepEqual(portfoyEdinmeFirsati([92, 85, 60]), { var: true, sayi: 2 });
  assert.equal(portfoyEdinmeFirsati([92, 70]).var, false);
});

test("Hızlı ayrıştırıcı: WhatsApp ve portal metinleri yapay zekâsız çözülür (3. kat / m2'deki rakam fiyat sanılmaz)", () => {
  const a = hizliAyristir("Konyaaltı Liman'da 2+1 satılık daire, 90 m2, 3. kat, 8 yaşında, site içinde havuzlu. 5.450.000 TL");
  assert.deepEqual([a.tip, a.mulkTipi, a.islemTipi, a.fiyat, a.m2, a.odaSayisi, a.yeterli], ["PORTFOY", "DAIRE", "SATILIK", 5450000, 90, "2+1", true]);
  assert.deepEqual(coz(metindenKonumlar("Konyaaltı Liman'da 2+1", INDEKS)).lokasyonlar.map((l) => l.etiket), ["Konyaaltı / Liman"]);
  const b = hizliAyristir("Lojistik firması için Kepez'de min 2000 m2 depo arıyoruz, TIR girişi ve rampa şart, 400 bine kadar");
  assert.deepEqual([b.tip, b.islemTipi, b.islemTahmini, b.maxFiyat, b.minM2, b.ozellik.aracErisimi, b.ozellik.rampa], ["TALEP", "KIRALIK", true, 400000, 2000, "TIR", true]);
  const c = hizliAyristir("sahibinden.com İlan No: 1187654321 Kiralık Depo 2.500 m² Kepez 250 kW. Fiyat 380.000 TL Kimden: Akdeniz Gayrimenkul 0532 111 22 33");
  assert.deepEqual([c.portal, c.ilanNo, c.fiyat, c.m2, c.telefon, c.sirket, c.ilanSahibiTipi, c.ozellik.elektrikGucuKw], ["SAHIBINDEN", "1187654321", 380000, 2500, "+905321112233", "Akdeniz Gayrimenkul", "EMLAKCI", 250]);
  assert.equal(hizliAyristir("deniz manzaralı 4+1 Muratpaşa Şirinyalı satılık 14.750.000").fiyat, 14750000);
  assert.deepEqual(metindenKonumlar("Muratpaşa Şirinyalı'da 4+1, deniz manzaralı", INDEKS), ["Muratpaşa Şirinyalı"]);
});

test("Soru → filtre: veritabanı yapay zekâya gönderilmeden", () => {
  assert.equal(metinTuru("Kepez'de 1000 m² üstü kiralık depo var mı?"), "SORU");
  assert.equal(metinTuru("Kepez'de 1000 m2 kiralık depo, TIR girer, 250 bin. 0532 111 22 33"), "ILAN");
  const f = soruFiltresi("Kepez'de 1000 m² üstü kiralık depo var mı?");
  assert.deepEqual([f.hedef, f.aileler, f.islemler, f.m2Min], ["PORTFOY", ["DEPO"], ["KIRALIK"], 1000]);
  assert.equal(soruFiltresi("hangi taleplerde soğuk hava isteniyor?").hedef, "TALEP");
});

test("Örnek Sahibinden ilanı (AI kutusu) 2 aktif talebe %80+ uyar → portföy edinme fırsatı", () => {
  const { kayitlar } = ornekVeriyiKur();
  const metin = "sahibinden.com · İlan No: 1187654321\nAksu Pınarlı'da Kiralık Depo – 3.500 m² kapalı, 1.500 m² açık alan\nNet yükseklik 9 m, TIR girişi, 2 adet yükleme rampası, 250 kW elektrik, yangın sistemi mevcut.\nAylık 480.000 TL\nKimden: Sahibinden · Mehmet K. 0533 444 55 66";
  const h = hizliAyristir(metin);
  const lok = cozulenToKayitLok(coz(metindenKonumlar(metin, INDEKS)).lokasyonlar, true).map(({ etiket, seviye, ...l }) => l);
  const v = KayitCreateSchema.parse({ tip: "PORTFOY", mulkTipi: h.mulkTipi, islemTipi: h.islemTipi, fiyat: h.fiyat, fiyatPeriyodu: h.fiyatPeriyodu, m2: h.m2, ozellik: h.ozellik, lokasyonlar: lok, havuz: "DIS_ILAN", veriKanali: h.portal, ilanSahibiTipi: h.ilanSahibiTipi });
  assert.equal(h.ilanSahibiTipi, "MALIK");
  assert.equal(havuzKatmani(v as any), "WEB");
  const skorlar = kayitlar.filter((k) => k.veri.tip === "TALEP" && temelUyum(k.veri as any, v as any)).map((k) => eslesmeOnizle(k.veri as any, v as any, BAGLAM).skor);
  assert.equal(portfoyEdinmeFirsati(skorlar).var, true);
});