/**
 * Anahtar CRM v3.21.1 · 8 Ekim 2026
 * v3.11 — mahalle komşuluğu ve eşleştirme motoru v3 (konum kademeleri, oda, bütçe altı, belirsiz mahalle adı).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { eslesmeOnizle, MODEL, type OnizlemeKayit } from "../src/lib/eslestirme/onizleme";
import { KOMSULUK_OZETI } from "../src/lib/lokasyon/komsuluk";
import { BAGLAM, KOMSULUK, coz, belirsizKonumOnar, lokEtiket } from "../demo/lokasyon";
import { DENEY_SONUCU } from "../scripts/deney/model-karsilastir";
import { SURUM, SURUM_GECMISI } from "../src/lib/surum";
import { SADECE_TEST_baglamiSabitle, VARSAYILAN_OFIS_ID, VARSAYILAN_KULLANICI_ID } from "../src/lib/kiracilik";
// v3.20 — çok ofisli: testler varsayılan ofisin bağlamında çalışır (göçte açılan Özyurtlar Gayrimenkul)
SADECE_TEST_baglamiSabitle({ ofisId: VARSAYILAN_OFIS_ID, kullaniciId: VARSAYILAN_KULLANICI_ID, rol: "OFIS_YONETICISI", eposta: "test@anahtar.local" });


const lok = (ham: string, portfoy: boolean) => coz(ham).lokasyonlar.map((l, i) => ({ ilId: l.ilId, ilceId: l.ilceId, mahalleId: l.mahalleId, altBolgeId: l.altBolgeId, birincil: portfoy && i === 0 }));
const T = (ham: string, v: Partial<OnizlemeKayit> = {}): OnizlemeKayit => ({ tip: "TALEP", mulkTipi: "DAIRE", islemTipi: "SATILIK", lokasyonlar: lok(ham, false), ...v });
const P = (ham: string, v: Partial<OnizlemeKayit> = {}): OnizlemeKayit => ({ tip: "PORTFOY", mulkTipi: "DAIRE", islemTipi: "SATILIK", lokasyonlar: lok(ham, true), ...v });
/** v3.19 — alan ve oda bilgisi tam kayıtlar: konum/fiyat davranışı eksik veri cezasından bağımsız sınanır */
const TAM_T: Partial<OnizlemeKayit> = { odaSayisi: "2+1", minM2: 80, maxM2: 120, maxFiyat: 6_000_000 };
const TAM_P: Partial<OnizlemeKayit> = { odaSayisi: "2+1", m2: 100, fiyat: 5_000_000 };
const mah = (ham: string) => coz(ham).lokasyonlar[0].mahalleId!;
const es = (t: OnizlemeKayit, p: OnizlemeKayit) => eslesmeOnizle(t, p, BAGLAM);

test("komşuluk tablosu: Antalya'nın mahalleleri yüklü, merkez ilçeler eksiksiz", () => {
  assert.ok(KOMSULUK_OZETI.mahalle >= 910 && KOMSULUK_OZETI.komsuCift > 2000);
  for (const ilce of ["Muratpaşa", "Konyaaltı", "Aksu", "Kepez", "Döşemealtı"]) {
    const l = coz(ilce).lokasyonlar[0];
    assert.equal(l.seviye, "ILCE");
  }
  assert.ok(KOMSULUK.veriVar(mah("Muratpaşa / Fener")));
});

test("komşuluk: Fener ↔ Çağlayan sınır komşusu, Fener ↔ Doğuyaka ~3,9 km, Fener ↔ Meltem tabloda yok (uzak)", () => {
  const fener = mah("Muratpaşa / Fener");
  assert.deepEqual(KOMSULUK.mahalle(fener, mah("Muratpaşa / Çağlayan")), { komsu: true, mesafeM: 0 });
  const d = KOMSULUK.mahalle(fener, mah("Muratpaşa / Doğuyaka"))!;
  assert.ok(!d.komsu && d.mesafeM > 3500 && d.mesafeM < 4300);
  assert.equal(KOMSULUK.mahalle(fener, mah("Muratpaşa / Meltem")), null);
  assert.deepEqual(KOMSULUK.mahalle(fener, fener), { komsu: false, mesafeM: 0 });
  assert.ok(KOMSULUK.komsular(fener).includes(mah("Muratpaşa / Şirinyalı")));
});

test("komşuluk ilçe sınırını aşar: Meltem (Muratpaşa) ↔ Arapsuyu (Konyaaltı)", () => {
  const y = KOMSULUK.mahalle(mah("Muratpaşa / Meltem"), mah("Konyaaltı / Arapsuyu"));
  assert.equal(y?.komsu, true);
  const s = es(T("Muratpaşa / Meltem", TAM_T), P("Konyaaltı / Arapsuyu", TAM_P));
  assert.equal(s.lokasyonKademe, "KOMSU_MAHALLE");
  assert.equal(s.lokasyonOrani, MODEL.lok.komsu);
  assert.equal(s.uygunluk, "SUNULABILIR");
});

test("v3.10'da bildirilen hata: Fener/Çağlayan 2+1 talebi ↔ Doğuyaka 3+1 artık 'Sunulabilir 92' değil", () => {
  const t = T("Fener, Çağlayan", { odaSayisi: "2+1", maxFiyat: 10_000_000 });
  const s = es(t, P("Muratpaşa / Doğuyaka", { odaSayisi: "3+1", fiyat: 5_650_000, m2: 115 }));
  assert.equal(s.uygunluk, "UYGUN_DEGIL");
  assert.ok(s.skor <= 40);
  assert.deepEqual(s.kritikEngeller, ["Lokasyon"]);
  assert.match(s.lokasyonAciklama, /Bölge dışı · Fener sınırına 3,9 km/);
});

test("konum kademeleri: aynı mahalle > komşu > yakın > biraz uzak (koşullu) > bölge dışı", () => {
  const t = T("Muratpaşa / Fener", { odaSayisi: "2+1", maxFiyat: 10_000_000 });
  const p = (ham: string) => es(t, P(ham, { odaSayisi: "2+1", fiyat: 9_000_000 }));
  const ayni = p("Muratpaşa / Fener"), komsu = p("Muratpaşa / Çağlayan"), yakin = p("Muratpaşa / Yeşilbahçe"), orta = p("Muratpaşa / Zerdalilik"), uzak = p("Muratpaşa / Doğuyaka");
  assert.deepEqual([ayni, komsu, yakin, orta, uzak].map((s) => s.lokasyonKademe), ["AYNI_MAHALLE", "KOMSU_MAHALLE", "YAKIN", "ORTA", "DISINDA"]);
  assert.deepEqual([ayni, komsu, yakin, orta, uzak].map((s) => s.uygunluk), ["SUNULABILIR", "SUNULABILIR", "SUNULABILIR", "KOSULLU", "UYGUN_DEGIL"]);
  assert.ok(ayni.skor > komsu.skor && komsu.skor > yakin.skor && yakin.skor > orta.skor && orta.skor > uzak.skor);
  assert.equal(ayni.lokasyonPuani, 20); // eski gösterge korunur
});

test("yalnızca ilçe isteyen talep: ilçenin içi tam puan (v3.10'da 0,75 idi); ilçeye bitişik mahalle komşu sayılır", () => {
  const t = T("Muratpaşa", { mulkTipi: "BURO_OFIS", islemTipi: "KIRALIK", maxFiyat: 50_000 });
  const ofis = (ham: string) => es(t, P(ham, { mulkTipi: "BURO_OFIS", islemTipi: "KIRALIK", fiyat: 40_000 }));
  assert.equal(ofis("Muratpaşa / Kızıltoprak").lokasyonOrani, 1);
  assert.equal(ofis("Konyaaltı / Arapsuyu").lokasyonKademe, "KOMSU_MAHALLE");
  assert.equal(ofis("Kepez / Varsak Karşıyaka").uygunluk, "UYGUN_DEGIL");
});

test("alt bölge: Lara isteyen talebe Lara'ya sınır mahalle (Güzeloluk) sunulur (v3.10'da bölge dışıydı)", () => {
  const t = T("Lara", { islemTipi: "KIRALIK", odaSayisi: "3+1", maxFiyat: 60_000 });
  const p = (ham: string) => es(t, P(ham, { islemTipi: "KIRALIK", odaSayisi: "3+1", fiyat: 55_000 }));
  assert.equal(p("Muratpaşa / Güzeloba").lokasyonPuani, 10);
  assert.equal(p("Muratpaşa / Güzeloba").lokasyonOrani, 1);
  assert.equal(p("Muratpaşa / Güzeloluk").lokasyonKademe, "KOMSU_MAHALLE");
  assert.equal(p("Muratpaşa / Meltem").uygunluk, "UYGUN_DEGIL");
});

test("'bölge esnek' talep: uzak mahalle elenmez, koşullu olur ve en altta kalır", () => {
  const t = T("Muratpaşa / Fener", { odaSayisi: "2+1", maxFiyat: 10_000_000, ozellik: { esnekKriterler: ["LOKASYON"] } });
  const uzak = es(t, P("Muratpaşa / Doğuyaka", { odaSayisi: "2+1", fiyat: 9_000_000 }));
  assert.equal(uzak.uygunluk, "KOSULLU");
  assert.equal(uzak.lokasyonKademe, "UZAK");
  assert.ok(uzak.skor < es(t, P("Muratpaşa / Çağlayan", { odaSayisi: "2+1", fiyat: 9_000_000 })).skor);
});

test("portföyün mahallesi girilmemişse (yalnızca ilçe) mahalle isteyen talepte koşullu", () => {
  const s = es(T("Muratpaşa / Fener", { maxFiyat: 10_000_000 }), P("Muratpaşa", { fiyat: 9_000_000 }));
  assert.equal(s.lokasyonKademe, "ILCE_VERISIZ");
  assert.equal(s.uygunluk, "KOSULLU");
});

test("sınır verisi olmayan il (İzmir): eski ilçe kuralı — aynı ilçe farklı mahalle 0,75, sunulabilir", () => {
  const s = es(T("İzmir Bornova Kazımdirik", { ...TAM_T, maxFiyat: 6_000_000 }), P("İzmir Bornova Erzene", { ...TAM_P, fiyat: 5_500_000 }));
  assert.equal(s.lokasyonOrani, MODEL.lok.ilceVerisiz);
  assert.equal(s.uygunluk, "SUNULABILIR");
});

test("oda: istenen oda tam puan, bir oda fazla kısmi (sunulabilir), iki oda fazla ya da eksik koşullu", () => {
  const t = T("Muratpaşa / Fener", { odaSayisi: "2+1", maxFiyat: 10_000_000 });
  const oda = (o: string) => { const s = es(t, P("Muratpaşa / Fener", { odaSayisi: o, fiyat: 9_000_000 })); return { u: s.uygunluk, skor: s.skor, puan: s.kriterler.find((k) => k.anahtar === "odaSayisi")!.puan }; };
  assert.deepEqual([oda("2+1").puan, oda("3+1").puan, oda("4+1").puan, oda("1+1").puan], [1, MODEL.oda.fazla1, MODEL.oda.fazla2, 0]);
  assert.deepEqual([oda("2+1").u, oda("3+1").u, oda("4+1").u, oda("1+1").u], ["SUNULABILIR", "SUNULABILIR", "KOSULLU", "KOSULLU"]);
  assert.ok(oda("2+1").skor > oda("3+1").skor && oda("3+1").skor > oda("4+1").skor);
  // Müşteri oda sayısına "şart" dediyse fazlası da eksiği de engeldir
  const sart = { ...t, ozellik: { kritikKriterler: ["ODA_SAYISI"] } };
  assert.equal(es(sart, P("Muratpaşa / Fener", { odaSayisi: "4+1", fiyat: 9_000_000 })).uygunluk, "UYGUN_DEGIL");
});

test("bütçe altı: fiyat bütçenin çok altındaysa puan düşer ama elenmez; alt sınır verilmişse o kullanılır", () => {
  const t = T("Muratpaşa / Fener", { ...TAM_T, maxFiyat: 10_000_000 });
  const f = (fiyat: number, tt = t) => { const s = es(tt, P("Muratpaşa / Fener", { ...TAM_P, fiyat })); return { u: s.uygunluk, puan: s.kriterler.find((k) => k.anahtar === "fiyat")!.puan }; };
  assert.deepEqual([f(8_000_000).puan, f(5_500_000).puan, f(3_500_000).puan], [1, 0.8, 0.6]);
  assert.equal(f(3_500_000).u, "SUNULABILIR");
  const aralik = { ...t, minFiyat: 7_000_000 };
  assert.deepEqual([f(8_000_000, aralik).puan, f(6_500_000, aralik).puan, f(4_000_000, aralik).puan], [1, 0.8, 0.5]);
  assert.equal(f(4_000_000, aralik).u, "KOSULLU");
  assert.equal(f(11_500_000).u, "UYGUN_DEGIL"); // bütçe üstü kuralı değişmedi (+%10)
});

test("belirsiz mahalle adı: 'Fener, Çağlayan' → Muratpaşa / Çağlayan (v3.10'da Manavgat / Çağlayan seçiliyordu)", () => {
  const l = coz("Fener, Çağlayan").lokasyonlar;
  assert.deepEqual(l.map((x) => x.etiket), ["Muratpaşa / Fener", "Muratpaşa / Çağlayan"]);
  assert.equal(l[1].belirsiz, undefined);
  // İpucu yokken merkez ilçe varsayılır, belirsizlik işareti kalır
  const tek = coz("Çağlayan").lokasyonlar[0];
  assert.equal(tek.etiket, "Muratpaşa / Çağlayan");
  assert.ok(tek.belirsiz && tek.belirsiz.length >= 2);
  // İlçe yazılmışsa o ilçe geçerli
  assert.equal(coz("Manavgat / Çağlayan").lokasyonlar[0].etiket, "Manavgat / Çağlayan");
});

test("model deneyi: seçilen model (A) v3.10 tabanını ve diğer varyasyonları geçer", () => {
  const v0 = DENEY_SONUCU.find((s) => s.kod === "V0")!, a = DENEY_SONUCU.find((s) => s.kod === "A")!;
  const oran = (s: typeof a) => (s.sinifDogru + s.siraDogru) / (s.sinifToplam + s.siraToplam);
  assert.equal(a.sinifDogru, a.sinifToplam);
  assert.equal(a.siraDogru, a.siraToplam);
  assert.ok(oran(v0) < 0.6);
  for (const s of DENEY_SONUCU) if (s.kod !== "A") assert.ok(oran(s) < oran(a), s.kod);
});

test("sürüm 3.11: günlükte ve test listesinde", () => {
  const i = SURUM_GECMISI.findIndex((k) => k.surum === "3.11"); // v3.12 öne eklenir
  assert.ok(i >= 0 && (SURUM_GECMISI[i].testEt ?? []).length >= 6);
  assert.equal(SURUM_GECMISI[i + 1].surum, "3.10");
});

test("eski kayıt onarımı: v3.10'da Manavgat / Çağlayan diye saklanmış konum, yanındaki Fener'e bakılarak Muratpaşa / Çağlayan olur", () => {
  const fener = coz("Muratpaşa / Fener").lokasyonlar[0], yanlis = coz("Manavgat / Çağlayan").lokasyonlar[0];
  const r = belirsizKonumOnar([{ ilId: 7, ilceId: fener.ilceId, mahalleId: fener.mahalleId }, { ilId: 7, ilceId: yanlis.ilceId, mahalleId: yanlis.mahalleId }]);
  assert.equal(r.degisti, true);
  assert.deepEqual(r.lokasyonlar.map(lokEtiket), ["Muratpaşa / Fener", "Muratpaşa / Çağlayan"]);
  // Tek konumlu ya da zaten tutarlı kayıtlara dokunulmaz
  assert.equal(belirsizKonumOnar([{ ilId: 7, ilceId: yanlis.ilceId, mahalleId: yanlis.mahalleId }]).degisti, false);
  assert.equal(belirsizKonumOnar(r.lokasyonlar).degisti, false);
  const manavgat = coz("Manavgat / Çağlayan, Manavgat / Side").lokasyonlar;
  assert.equal(belirsizKonumOnar(manavgat.map((l) => ({ ilceId: l.ilceId, mahalleId: l.mahalleId }))).degisti, false);
});