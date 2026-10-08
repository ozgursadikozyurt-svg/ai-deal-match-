/**
 * Anahtar CRM v3.21.2 · 8 Ekim 2026
 * v3.8 — talepte "zaten var" (tekrar anahtarları), kartlarda "kim" etiketi, eşleşmeyi kopar (demo ekranları), dışa aktarma CSV.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { tekrarAnahtarlari, anahtarKumesi, zatenVar } from "../src/lib/ingest/tekrar";
import { kimOf } from "../src/lib/domain/kim";
import { csvYaz, kisiSutunlari } from "../src/lib/disa-aktar";
import { KOPMA_NEDENLERI, kopmaEtiket } from "../src/lib/eslestirme/kopar";
import { C, type Ctx } from "../demo/ortak";
import { ornekVeriyiKur, bosBaglanti, bosGoogleBaglanti, type DepoDurumu } from "../demo/depo";
import { TTL_VARSAYILAN } from "../src/lib/domain/gecerlilik";
import { Eslesmeler, AnaSayfa, Liste } from "../demo/app";
import { eslesmeOnizle, temelUyum } from "../src/lib/eslestirme/onizleme";
import { BAGLAM } from "../demo/lokasyon";
import { TopluMesaj } from "../demo/toplu-giris";
import { SADECE_TEST_baglamiSabitle, VARSAYILAN_OFIS_ID, VARSAYILAN_KULLANICI_ID } from "../src/lib/kiracilik";
// v3.20 — çok ofisli: testler varsayılan ofisin bağlamında çalışır (göçte açılan Özyurtlar Gayrimenkul)
SADECE_TEST_baglamiSabitle({ ofisId: VARSAYILAN_OFIS_ID, kullaniciId: VARSAYILAN_KULLANICI_ID, rol: "OFIS_YONETICISI", eposta: "test@anahtar.local" });


const talep = { tip: "TALEP", mulkTipi: "DAIRE", islemTipi: "SATILIK", odaSayisi: "2+1", maxFiyat: 3_500_000, lokasyonlar: [{ ilceId: 12, mahalleId: 345 }] };

test("tekrar: aynı kişinin aynı talebi 'zaten var'; farklı bütçe ya da kişi değil", () => {
  const kume = anahtarKumesi([{ veri: talep as any, kisiAdi: "Seda Korkmaz" }]);
  assert.equal(zatenVar(kume, talep as any, "SEDA KORKMAZ"), true, "ad büyük/küçük harf farkı önemsiz");
  assert.equal(zatenVar(kume, { ...talep, maxFiyat: 3_000_000 } as any, "Seda Korkmaz"), false);
  assert.equal(zatenVar(kume, { ...talep, odaSayisi: "1+1" } as any, "Seda Korkmaz"), false);
  assert.equal(zatenVar(kume, talep as any, "Ali Vural"), false);
  assert.ok(tekrarAnahtarlari({ ...talep, portalIlanNo: "19915896" } as any).includes("ilan:19915896"));
  assert.deepEqual(tekrarAnahtarlari(talep as any), [], "kişi, telefon ve metin yoksa 'zaten var' denmez");
});

test("kim etiketi: emlakçı, doğrudan müşteri, mülk sahibi, web ilanı, yetkili, belirsiz", () => {
  const kisiler = [{ id: "e", adSoyad: "Ayşe Yılmaz", sirket: "Deniz Emlak", roller: ["EMLAKCI"] }, { id: "m", adSoyad: "Ali Vural", roller: ["ALICI"] }, { id: "s", adSoyad: "Hasan K.", roller: ["SATICI"] }];
  assert.deepEqual([kimOf({ tip: "TALEP", kisiler: [{ kisiId: "e", rol: "EMLAKCI" }] }, kisiler).etiket, kimOf({ tip: "TALEP", kisiler: [{ kisiId: "e", rol: "EMLAKCI" }] }, kisiler).ad], ["Emlakçı", "Ayşe Yılmaz (Deniz Emlak)"]);
  assert.equal(kimOf({ tip: "TALEP", kisiler: [{ kisiId: "m", rol: "MUSTERI" }] }, kisiler).etiket, "Doğrudan müşteri");
  assert.equal(kimOf({ tip: "PORTFOY", kisiler: [{ kisiId: "s", rol: "SAHIP" }] }, kisiler).etiket, "Mülk sahibi");
  assert.equal(kimOf({ tip: "PORTFOY", havuz: "DIS_ILAN", ilanSahibiTipi: "MALIK" }, kisiler).etiket, "Web ilanı · sahibinden");
  assert.equal(kimOf({ tip: "PORTFOY", havuz: "DIS_ILAN", ilanSahibiTipi: "EMLAKCI", portalIlanSahibi: "Örnek Gayrimenkul" }, kisiler).ad, "Örnek Gayrimenkul");
  assert.equal(kimOf({ tip: "PORTFOY", yetkili: true, kisiler: [{ kisiId: "s", rol: "SAHIP" }] }, kisiler).etiket, "Yetkili portföy");
  assert.equal(kimOf({ tip: "PORTFOY", ilanSahibiTipi: "PARTNER" }, kisiler).etiket, "Emlakçı");
  assert.equal(kimOf({ tip: "TALEP" }, kisiler).tur, "BELIRSIZ");
});

test("dışa aktarma CSV: BOM, noktalı virgül, tırnak kaçışı, Excel'de açılır", () => {
  const c = csvYaz([{ id: "K1", adSoyad: 'Ali "Bey"; Vural', roller: ["ALICI", "YATIRIMCI"] }], kisiSutunlari);
  assert.ok(c.startsWith("\uFEFFKişi no;Ad soyad;Telefon"));
  assert.match(c, /"Ali ""Bey""; Vural"/); assert.match(c, /ALICI, YATIRIMCI/);
  assert.equal(KOPMA_NEDENLERI.length, 6); assert.equal(kopmaEtiket("BEGENMEDI"), "Sunuldu, müşteri beğenmedi");
});

// ───────── Demo ekranları ─────────
const { kayitlar, kisiler } = ornekVeriyiKur();
const aktif = kayitlar.filter((k) => k.veri.durum === "ACTIVE");
const ilk = (() => { for (const t of aktif.filter((k) => k.veri.tip === "TALEP")) for (const p of aktif.filter((k) => k.veri.tip === "PORTFOY")) if (temelUyum(t.veri as any, p.veri as any) && eslesmeOnizle(t.veri as any, p.veri as any, BAGLAM).uygunluk === "SUNULABILIR") return { t, p }; throw new Error("örnek eşleşme yok"); })();
const durum = (notlar: DepoDurumu["eslesmeNotlari"]): DepoDurumu => ({ veriSurumu: "t", kayitlar, eslesmeNotlari: notlar, testler: {}, geriBildirim: "", ayarlar: { ttl: TTL_VARSAYILAN }, ogrenilen: [], adaylar: [], aktifIceAktarma: null, iceAktarmaGecmisi: [], kisiler, islenmisMesajlar: [], dosyaIzleri: {}, baglantilar: { google: bosGoogleBaglanti(), notion: bosBaglanti() }, senkronGecmisi: [], cakismalar: [] });
const ciz = (d: DepoDurumu, el: React.ReactElement) => renderToStaticMarkup(React.createElement(C.Provider, { value: { d, guncelle: () => {}, kayitKaydet: () => {}, bildir: () => {}, ornekHatalari: [], git: () => {}, geri: () => {}, geriVar: false, sample: null } as Ctx }, el));
const say = (h: string, metin: string) => h.split(metin).length - 1;

test("kopar: koparılan eşleşme listeden düşer, 'Koparılanlar' sekmesi çıkar", () => {
  const anahtar = `${ilk.t.id}~${ilk.p.id}`;
  const once = ciz(durum({}), React.createElement(Eslesmeler));
  const sonra = ciz(durum({ [anahtar]: { durum: "REDDEDILDI", not: "", neden: "BEGENMEDI", tarih: "2026-10-01T09:00:00Z" } }), React.createElement(Eslesmeler));
  assert.equal(say(sonra, 'class="es2 '), say(once, 'class="es2 ') - 1); // v3.9: yeni eşleşme kartı
  assert.match(sonra, /Koparılan \(1\)/);
  assert.match(once, /Eşleşmeyi kopar/);
});

test("kartlarda kim etiketi ve toplu mesajda talep 'zaten var'", () => {
  assert.match(ciz(durum({}), React.createElement(Liste, { tip: "TALEP" })), /class="pill kim/);
  const t = kayitlar.find((k) => k.veri.tip === "TALEP" && k.veri.kisiler?.length && k.veri.hamMetin)!;
  const kisi = kisiler.find((x) => x.id === t.veri.kisiler![0].kisiId)!;
  const h = ciz(durum({}), React.createElement(TopluMesaj, { baslangic: `${kisi.adSoyad} – ${t.veri.hamMetin!.split("\n")[0]}` }));
  assert.match(h, /Zaten var|Hazır|Kontrol gerekli/);
});