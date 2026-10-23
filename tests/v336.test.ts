/**
 * Anahtar CRM v3.41 · 23 Ekim 2026
 * v3.36 — eşleştirme uyum seviyesi (1–5) ve gerekçe; 19 Ekim canlı verisinde yanlış okunan talepler (parser); döviz; talepteki
 * anlamsız istekler; fazla oda / üst üste ödün; Geri tuşu (tarayıcı geçmişi); dosyanın tamamını yorumlama; WhatsApp portföyü Partner;
 * kaydetme günlüğü; veri düzeltmesi migration'ı.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import React from "react";
import { hizliAyristir } from "../src/lib/ai/hizli-ayristirici";
import { yorumla } from "../src/lib/ai/yorumlayici";
import { binaYasiOku, katJargonu, katOku } from "../src/lib/ai/jargon";
import { katUyumu } from "../src/lib/domain/teknik-alanlar";
import { eslesmeOnizle, seviyeOf, seviyeAltSkor, SEVIYE_ETIKET, DOVIZ_TL, FIYATSIZ_SKOR_TAVANI, type OnizlemeKayit } from "../src/lib/eslestirme/onizleme";
import { DegisiklikSchema, KAYIT_GUNLUGU } from "../src/lib/services/durum";
import { BAGLAM, INDEKS, coz } from "../demo/lokasyon";
import { taslakYap } from "../demo/ai-kutusu";
import { kaynakOf } from "../src/lib/domain/kaynak";
import { SURUM, SURUM_GECMISI } from "../src/lib/surum";
import { Uygulama } from "../demo/app";
import { kaliciHepsiniSil } from "../demo/kalici";
import { SADECE_TEST_baglamiSabitle, VARSAYILAN_OFIS_ID, VARSAYILAN_KULLANICI_ID } from "../src/lib/kiracilik";
import { ac } from "./yardimci-arayuz";
SADECE_TEST_baglamiSabitle({ ofisId: VARSAYILAN_OFIS_ID, kullaniciId: VARSAYILAN_KULLANICI_ID, rol: "OFIS_YONETICISI", eposta: "test@anahtar.local" });

const lok = (ham: string, portfoy: boolean) => coz(ham).lokasyonlar.map((l, i) => ({ ilId: l.ilId, ilceId: l.ilceId, mahalleId: l.mahalleId, altBolgeId: l.altBolgeId, birincil: portfoy && i === 0 }));
const T = (ham: string, v: Partial<OnizlemeKayit>): OnizlemeKayit => ({ tip: "TALEP", mulkTipi: "DAIRE", islemTipi: "SATILIK", lokasyonlar: lok(ham, false), ...v });
const P = (ham: string, v: Partial<OnizlemeKayit>): OnizlemeKayit => ({ tip: "PORTFOY", mulkTipi: "DAIRE", islemTipi: "SATILIK", lokasyonlar: lok(ham, true), ...v });
const es = (t: OnizlemeKayit, p: OnizlemeKayit) => eslesmeOnizle(t, p, BAGLAM);

test("sürüm 3.36 ve ek belge", () => {
  const i = SURUM_GECMISI.findIndex((x) => x.surum === "3.36"); // v3.37: artık en üstte değil
  assert.ok(i >= 0 && SURUM_GECMISI[i + 1].surum === "3.35" && SURUM >= "3.36");
  assert.ok((SURUM_GECMISI[i].testEt ?? []).length >= 4);
  assert.ok(fs.existsSync("docs/ANAHTAR_CRM_EK_v3.36_19Ekim2026.md"));
});

// ───── Talep okuma (19 Ekim canlı örnekleri) ─────
test("kat: olumsuz cümledeki giriş / son kat istenmeyen kattır; '2+1 katta' 1. kat değildir", () => {
  const m = "ara kat olacak.\ngiriş kat ve en üst kat kesinlikle düşünülmüyor.dublex tercihleri";
  assert.deepEqual(katJargonu(m), ["ARA"]);
  assert.deepEqual(katJargonu("bahçe katı olsun"), ["0"]);
  assert.deepEqual(katJargonu("en üst kat da olur"), ["SON"]);
  assert.equal(katOku("sıfır 2+1 katta 80 mt² ve üstü").bulunduguKat, undefined);
  assert.equal(katOku("3. kat").bulunduguKat, 3);
  const h = hizliAyristir("🏡 SATILIK DAİRE TALEBİ\nGüzeloba 3+1\nAra kat olacak.\nGiriş kat ve en üst kat kesinlikle düşünülmüyor.");
  assert.deepEqual(h.ozellik.istenenKatlar, ["ARA"]);
});

test("bina yaşı: 'N yaşa kadar', 'yaşı en fazla 16-17', 'yeni bina' ≤ 5, 'sıfır' 0", () => {
  assert.equal(binaYasiOku("5 yaşa kadar"), 5);
  assert.equal(binaYasiOku("4 yaşa kadar 2+1"), 4);
  assert.equal(binaYasiOku("yaşı en fazla 16-17, bütçe"), 17);
  assert.equal(binaYasiOku("yeni binada arakat"), 5);
  assert.equal(binaYasiOku("sıfır 2+1"), 0);
  assert.equal(binaYasiOku("sıfırdan 7-8 yaşına kadar"), 8);
});

test("m², eşya, mahalle adı ve cephe: '80 mt² ve üstü', kiralıkta 'boş' eşyasız, 'Fabrikalar mah' tip değil, 'Güney cephe' konum değil", () => {
  const a = hizliAyristir("Antalya muratpaşa,da Sıfır 2+1 katta 80 mt² ve üstü satılık daire talebim vardır bütçe 6-7.000.000 TL");
  assert.equal(a.minM2, 80); assert.equal(a.ozellik.bulunduguKat, undefined);
  assert.equal(hizliAyristir("Talep konyaaltı kiralık bahçe kat 2 + 1 boş kiralık daire arıyorum bütçe 40 bin 50 bin").ozellik.esyaDurumu, "ESYASIZ");
  assert.equal(hizliAyristir("TALEP 45.000 ₺ Bütçe 2+1 BOŞ / Eşyalı KİRALIK Daire Arıyorum Güzeloba").ozellik.esyaDurumu, undefined, "ikisi de olur");
  assert.equal(hizliAyristir("SATILIK TALEP DAİRE\nSoğuksu, Güvenlik, Yıldız, Varlık, Bayındır Fabrikalar mah\n3+1\nBütçe nakit 6.000.000 TL").mulkTipi, "DAIRE");
  const y = yorumla("Satılık Talep\nYıldız, Güvenlik, Soğuksu ve Bayındır mah.\n2+1\nGüney cephe\nBütçe 7.500.000 Max.", INDEKS);
  const konumlar = y.parcalar.flatMap((p) => p.konumlar).map((x) => x.toLocaleLowerCase("tr"));
  assert.ok(!konumlar.some((x) => x === "güney"), konumlar.join("|"));
  assert.ok(konumlar.some((x) => x.includes("yıldız")));
  const p = yorumla("SATILIK\n FEVZİ ÇAKMAKTA\n2+1 GENİŞ DAİRE 105 m2\n GÜNEY-DOĞU CEPHELİ\n 5.000.000 TL", INDEKS);
  assert.ok(!p.parcalar.flatMap((x) => x.konumlar).some((x) => /g[üu]ney/i.test(x)));
  const merkez = yorumla("📍 Bölge: Güzeloba(merkez) Fener’e kadar olan bölgeler\n3+1", INDEKS);
  assert.ok(!merkez.parcalar.flatMap((x) => x.konumlar).some((x) => /kemer/i.test(x)), "tek başına 'merkez' Kemer merkez değildir");
});

// ───── Puanlama ─────
test("seviye: 85+ yalnızca Sunulabilir 5/5 · 70+ 4 · 55+ 3 · Koşullu en az 2 · Uygun değil 1; süzgeç alt sınırları", () => {
  assert.equal(seviyeOf(100, "SUNULABILIR"), 5); assert.equal(seviyeOf(84, "KOSULLU"), 4); assert.equal(seviyeOf(69, "KOSULLU"), 3);
  assert.equal(seviyeOf(54, "KOSULLU"), 2); assert.equal(seviyeOf(20, "KOSULLU"), 2); assert.equal(seviyeOf(40, "UYGUN_DEGIL"), 1);
  assert.deepEqual([2, 3, 4, 5].map(seviyeAltSkor), [41, 55, 70, 85]);
  assert.equal(SEVIYE_ETIKET[4], "Güçlü aday");
});

test("tam eşleşme 5/5 ve gerekçesiz; v3.38: 'Bütçe m²'ye göre' işaretli bütçesiz talep de 5/5 (bütçe notu bilgi amaçlı)", () => {
  const t = T("Muratpaşa / Fener", { odaSayisi: "2+1", maxFiyat: 10_000_000 });
  const tam = es(t, P("Muratpaşa / Fener", { odaSayisi: "2+1", fiyat: 9_000_000, m2: 110 }));
  assert.equal(tam.seviye, 5); assert.deepEqual(tam.gerekceler, []);
  const butcesiz = es({ ...t, maxFiyat: null, butceSerbest: true }, P("Muratpaşa / Fener", { odaSayisi: "2+1", fiyat: 9_000_000, m2: 110 }));
  assert.equal(butcesiz.seviye, 5, `${butcesiz.skor} ${butcesiz.gerekceler.join(" | ")}`); assert.ok(butcesiz.skor > FIYATSIZ_SKOR_TAVANI, String(butcesiz.skor));
  assert.match(butcesiz.gerekceler.join(" "), /bütçe yok — puanı düşürmez/i);
  // portföyde fiyat yoksa hâlâ en fazla 4/5
  const fiyatsiz = es(t, P("Muratpaşa / Fener", { odaSayisi: "2+1", m2: 110 }));
  assert.ok(fiyatsiz.seviye <= 4 && fiyatsiz.skor <= FIYATSIZ_SKOR_TAVANI, String(fiyatsiz.skor));
});

test("fazla oda + bütçe üstü (iki ödün) 4/5'in altına iner; tek fazla oda 4/5 ve 'sorun' gerekçesi", () => {
  const t = T("Muratpaşa / Çağlayan", { islemTipi: "KIRALIK", odaSayisi: "2+1", maxFiyat: 80_000, fiyatPeriyodu: "AYLIK" });
  const bir = es(t, P("Muratpaşa / Çağlayan", { islemTipi: "KIRALIK", odaSayisi: "3+1", fiyat: 75_000, fiyatPeriyodu: "AYLIK", m2: 140 }));
  assert.equal(bir.uygunluk, "KOSULLU"); assert.equal(bir.seviye, 4); assert.match(bir.gerekceler.join(" "), /1 oda fazla/);
  const iki = es(t, P("Muratpaşa / Çağlayan", { islemTipi: "KIRALIK", odaSayisi: "3+1", fiyat: 85_000, fiyatPeriyodu: "AYLIK", m2: 195 }));
  assert.ok(iki.skor <= 79 && iki.skor < bir.skor, `${iki.skor} < ${bir.skor}`); assert.match(iki.gerekceler.join(" "), /Birden çok ödün/);
});

test("ara kat isteyene son kat tutmaz (yanına kat numarası yazılmış olsa da); açıkça seçilen giriş geçerli", () => {
  assert.equal(katUyumu(["1", "2", "3", "ARA", "4", "5", "6"], 5, 5), "SAGLANMADI");
  assert.equal(katUyumu(["ARA", "SON"], 5, 5), "SAGLANDI");
  assert.equal(katUyumu(["ARA"], 2, 5), "SAGLANDI");
  assert.equal(katUyumu(["0", "ARA"], 0, 5), "SAGLANDI");
  const t = T("Konyaaltı / Hurma", { odaSayisi: "3+1", maxFiyat: 11_000_000, ozellik: { istenenKatlar: ["1", "2", "3", "ARA", "4", "5", "6"] } });
  const s = es(t, P("Konyaaltı / Hurma", { odaSayisi: "3+1", fiyat: 9_000_000, m2: 135, ozellik: { bulunduguKat: 5, katSayisi: 5 } }));
  assert.equal(s.seviye, 2); assert.match(s.gerekceler.join(" "), /Kat uymuyor/);
});

test("döviz: 3.000 USD kira bütçesi TL ilanla kurdan karşılaştırılır; 'sorulacak' yapmaz, gerekçeye bilgi düşer", () => {
  const t = T("Konyaaltı", { islemTipi: "KIRALIK", odaSayisi: "3+1", maxFiyat: 3_000, paraBirimi: "USD", fiyatPeriyodu: "AYLIK" });
  const p = P("Konyaaltı / Liman", { islemTipi: "KIRALIK", odaSayisi: "3+1", fiyat: 120_000, paraBirimi: "TRY", fiyatPeriyodu: "AYLIK", m2: 160 });
  const s = es(t, p);
  assert.equal(s.kriterler.find((k) => k.anahtar === "fiyat")!.sonuc, "SAGLANDI", `3.000 × ${DOVIZ_TL.USD} ≥ 120.000`);
  assert.equal(s.uygunluk, "SUNULABILIR");
  assert.ok(s.uyarilar.some((u) => /Para birimi farklı/.test(u)));
  const pahali = es(t, { ...p, fiyat: 250_000 });
  assert.equal(pahali.kriterler.find((k) => k.anahtar === "fiyat")!.sonuc, "SAGLANMADI");
});

test("talepteki anlamsız istekler (0 kW, 5 kW) ve şart denmemiş çatı tipi skoru tavana bağlamaz", () => {
  const t = T("Muratpaşa / Yenigöl", { mulkTipi: "DEPO_ANTREPO", islemTipi: "KIRALIK", minM2: 1000, maxM2: 1500, maxFiyat: 150_000, fiyatPeriyodu: "AYLIK", ozellik: { elektrikGucuKw: 5, catiTipi: "SANDVIC_PANEL" } });
  const p = P("Muratpaşa / Yenigöl", { mulkTipi: "DEPO_ANTREPO", islemTipi: "KIRALIK", m2: 1200, fiyat: 140_000, fiyatPeriyodu: "AYLIK", ozellik: { catiTipi: "TRAPEZ_SAC" } });
  const s = es(t, p);
  assert.ok(!s.kriterler.some((k) => k.anahtar === "elektrikGucuKw"), "5 kW istek yok sayıldı");
  const cati = s.kriterler.find((k) => k.anahtar === "catiTipi")!;
  assert.equal(cati.tercih, true); assert.equal(cati.sonuc, "SAGLANMADI");
  assert.ok(s.skor >= 85 && s.uygunluk === "SUNULABILIR", `${s.skor} ${s.uygunluk}`);
  assert.match(s.gerekceler.join(" "), /Tercih farklı/);
  // şart denirse çatı tipi yine engel / tavandır
  const sart = es({ ...t, ozellik: { ...t.ozellik, kritikKriterler: ["CATI_DUVAR"] } }, p);
  assert.equal(sart.uygunluk, "UYGUN_DEGIL");
  // 0 kW (yapay zekâ boş yerine 0 yazıyordu) da istek sayılmaz
  assert.ok(!es({ ...t, ozellik: { elektrikGucuKw: 0 } }, p).kriterler.some((k) => k.anahtar === "elektrikGucuKw"));
});

// ───── Kaynak ─────
test("WhatsApp'ta 'SAHİBİNDEN SATILIK' yazan meslektaş ilanı Partner (Emlak grubu); elle girilen malik ilanı Kendi portföyüm", () => {
  const wa = "SAHİBİNDEN SATILIK Lara'da 2+1 daire 5.500.000 TL 0555 111 22 33";
  const t = taslakYap(wa, hizliAyristir(wa), null).taslak;
  assert.equal(t.havuz, "PARTNER"); assert.equal(kaynakOf(t), "EMLAK_GRUBU");
  const elle = "Lara'da 2+1 satılık daire 5.500.000 TL";
  assert.equal(taslakYap(elle, { ...hizliAyristir(elle), ilanSahibiTipi: "MALIK" } as any, null).taslak.havuz, "KENDI_PORTFOY");
  const ia = fs.readFileSync("demo/ice-aktarma.tsx", "utf8");
  assert.match(ia, /taslak\.havuz = ben \? "KENDI_PORTFOY" : "PARTNER"/, "sohbet dosyası: yalnızca kendi mesajınız Kendi portföyüm");
  assert.match(ia, /<TopluKaynakSecici/); assert.match(fs.readFileSync("demo/gelen-kutusu.tsx", "utf8"), /<TopluKaynakSecici/);
  assert.match(fs.readFileSync("demo/app.tsx", "utf8"), /Toplu düzelt/);
});

// ───── Dosya yükleme ─────
test("dosya yükleme: satır başına yapay zekâ düğmesi yok; üst düğme tüm satırları 8'erli paketle yorumlar", () => {
  const s = fs.readFileSync("demo/toplu-giris.tsx", "utf8");
  assert.ok(!s.includes("✦ Yapay zekâya yorumlat"), "satır düğmesi kalktı");
  assert.match(s, /const PAKET_SATIR = 8/);
  assert.match(s, /### SATIR \$\{i \+ 1\}/);
  assert.ok(!/eksikMi\(x\)\)/.test(s), "yalnızca eksik satırlar değil, hepsi");
});

// ───── Kaydetme ─────
test("kaydetme günlüğü: arayüz hataları şemadan geçer; 503 geçici sayılır", () => {
  const g = DegisiklikSchema.parse({ kayitHatalari: [{ zaman: "2026-10-19T18:00:00Z", mesaj: "Sunucu 503", durum: 503, kayit: 4 }] });
  assert.equal(g.kayitHatalari?.[0].durum, 503); assert.equal(KAYIT_GUNLUGU, "kayitGunlugu");
  const k = fs.readFileSync("demo/canli-kaydet.ts", "utf8");
  assert.match(k, /sunucu 50\[234\]\|exceeded/); assert.match(k, /Sunucu yoğun/);
});

test("veri düzeltmesi migration'ı: yalnızca değer hâlâ yanlışsa değiştirir ve audit_log'a yazar", () => {
  const sql = fs.readFileSync("prisma/migrations/20261019210000_v336_veri_duzeltmesi/migration.sql", "utf8");
  assert.match(sql, /IS DISTINCT FROM ARRAY\['ARA'\]/); assert.match(sql, /INSERT INTO "audit_log"/);
  assert.ok(!/DROP TABLE "|ALTER TABLE/.test(sql), "şema değişmez");
});

// ───── Geri tuşu ─────
test("Geri: telefonun / tarayıcının geri tuşu (popstate) uygulamada bir önceki ekrana döner; formun Geri'si açıldığı yere döner", async () => {
  kaliciHepsiniSil();
  const a = await ac(React.createElement(Uygulama));
  await a.tikla(a.qa(".sol-menu .menu-oge").find((b) => (b.textContent ?? "").startsWith("Portföyler")));
  assert.match(a.q("main h2")?.textContent ?? "", /Portföyler/);
  await a.tikla(a.dugme(/\+ Yeni portföy/));
  assert.match(a.q("main")!.textContent ?? "", /Yeni portföy/);
  await a.tikla(a.dugme("← Geri"));                                                    // formun Geri'si
  assert.match(a.q("main h2")?.textContent ?? "", /Portföyler/, "form açıldığı listeye döndü");
  await a.tikla(a.dugme("← Geri"));                                                    // genel Geri: form değil, Ana Sayfa
  assert.ok(a.q(".karsilama"), "Ana Sayfa'ya döndü (form geçmişte kalmadı)");
  await a.tikla(a.qa(".sol-menu .menu-oge").find((b) => (b.textContent ?? "").startsWith("Eşleşmeler")));
  assert.ok(!a.q(".karsilama"));
  window.dispatchEvent(new (window as any).PopStateEvent("popstate"));
  await new Promise((r) => setTimeout(r, 30));
  assert.ok(a.q(".karsilama"), "tarayıcı geri tuşu Ana Sayfa'ya döndürdü");
  await a.kapat();
});

test("Ana Sayfa: Benim ve ofisim bölümü Anahtar AI kutusunun altında", () => {
  const s = fs.readFileSync("demo/app.tsx", "utf8");
  const ana = s.slice(s.indexOf("function AnaSayfa"), s.indexOf("// ───────────────────────────── Liste"));
  assert.ok(ana.indexOf("<AkilliKutu") < ana.indexOf('aria-label="Benim ve ofisim"'));
});

test("bina yaşı: sınırı 1–2 yıl aşan küçük ödündür (fiyattaki pazarlık payı gibi, gerekçeye yazılır), çok aşan istenen yok; ısınma (doğalgaz) tercih değil istek", () => {
  const t = T("Muratpaşa / Yenigün", { odaSayisi: "3+1", maxFiyat: 7_000_000, ozellik: { binaYasi: 17 } });
  const p = (yas: number) => es(t, P("Muratpaşa / Yenigün", { odaSayisi: "3+1", fiyat: 6_200_000, m2: 130, ozellik: { binaYasi: yas } }));
  assert.equal(p(15).seviye, 5);
  const az = p(18); assert.ok(az.skor < p(15).skor); assert.match(az.gerekceler.join(" "), /Bina yaşı sınırın biraz üstünde: 18 \(1 yıl fazla\)/);
  const cok = p(30); assert.ok(cok.seviye <= 3); assert.match(cok.gerekceler.join(" "), /İstenen yok: Bina yaşı/);
  const isinma = es({ ...t, ozellik: { isinmaTipi: "DOGALGAZ_KOMBI" } }, P("Muratpaşa / Yenigün", { odaSayisi: "3+1", fiyat: 6_200_000, m2: 130 }));
  assert.equal(isinma.seviye, 4, "doğalgaz bilinmiyorsa sorulur");
});
