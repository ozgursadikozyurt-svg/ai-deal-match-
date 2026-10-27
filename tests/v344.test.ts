/**
 * Anahtar CRM v3.44 · 27 Ekim 2026
 * İşlemler ekranı Polaris düzeninde: özet kutuları, tür / ay süzgeçleri, renkli tablo + TOTAL,
 * grafikler, "Kimden iş geldi?"; işlem detayında paylaşılan kişi, referans ve taraflar.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import fs from "node:fs";
import { SURUM, SURUM_GECMISI } from "../src/lib/surum";
import { C, type Ctx } from "../demo/ortak";
import { ornekVeriyiKur, bosBaglanti, bosGoogleBaglanti, type DepoDurumu } from "../demo/depo";
import { TTL_VARSAYILAN } from "../src/lib/domain/gecerlilik";
import { IslemlerEkrani } from "../demo/islemler";
import { notEtiketleri, yilOzeti, kimdenIsGeldi, TARAF_ROLLERI, TARAF_ROLU_ETIKET, ISLEM_TURU_TON } from "../src/lib/domain/islem";
import { yilHedefiNormalize, YIL_HEDEFI_VARSAYILAN } from "../src/lib/domain/ayarlar";

const ornek = ornekVeriyiKur();
const durum = (): DepoDurumu => ({ veriSurumu: "t", kayitlar: ornek.kayitlar, eslesmeNotlari: {}, testler: {}, geriBildirim: "", ayarlar: { ttl: TTL_VARSAYILAN }, ogrenilen: [], adaylar: [], aktifIceAktarma: null, iceAktarmaGecmisi: [], kisiler: ornek.kisiler, islenmisMesajlar: [], dosyaIzleri: {}, baglantilar: { google: bosGoogleBaglanti(), notion: bosBaglanti() }, senkronGecmisi: [], cakismalar: [], googleBekleyen: [], favoriler: [] } as DepoDurumu);
const ctx = (d: DepoDurumu): Ctx => ({ d, guncelle: () => {}, kayitKaydet: () => {}, bildir: () => {}, ornekHatalari: [], git: () => {}, geri: () => {}, geriVar: false, sample: null } as Ctx);
const ciz = () => renderToStaticMarkup(React.createElement(C.Provider, { value: ctx(durum()) }, React.createElement(IslemlerEkrani)));

test("sürüm 3.44 ve 3.44.1 günlükte kayıtlı", () => {
  assert.ok(SURUM_GECMISI.some((x) => x.surum === "3.44"));
  assert.ok(SURUM_GECMISI.some((x) => x.surum === "3.44.1"));
});

test("açıklamadan renkli etiketler çıkar; not metnine dokunulmaz", () => {
  assert.deepEqual(notEtiketleri("Elden nakit alındı fatura kesilmedi. Ofisle paylaşılmadı").map((e) => e.etiket),
    ["Faturasız", "Nakit / elden", "Ofisle paylaşılmadı"]);
  assert.deepEqual(notEtiketleri("faturasız ofisle paylaşım yapıldı").map((e) => e.etiket), ["Faturasız", "Ofisle paylaşıldı"]);
  assert.deepEqual(notEtiketleri("KDV'li fatura kesildi").map((e) => e.etiket), ["Faturalı"]);
  // v3.44 düzeltmesi: olumsuz ek "Faturalı" sayılmaz
  assert.deepEqual(notEtiketleri("fatura kesilmedi").map((e) => e.etiket), ["Faturasız"]);
  assert.deepEqual(notEtiketleri(null), []);
  assert.deepEqual(notEtiketleri("sade bir not"), []);
});

test("yıl özeti: toplam, aylık ortalama, hedefe kalan ve bekleyen", () => {
  const l = [
    { tahsilatTarihi: "2026-01-20", banaKalan: 100_000 },
    { tahsilatTarihi: "2026-10-26", banaKalan: 57_500 },
    { tahsilatTarihi: null, banaKalan: 42_000 }, // tahsil edilmedi → bekleyen
    { tahsilatTarihi: "2025-05-05", banaKalan: 999 }, // başka yıl
  ];
  const o = yilOzeti(l, 2026, 2_500_000, new Date("2026-10-27T09:00:00Z"));
  assert.equal(o.toplam, 157_500);
  assert.equal(o.bekleyen, 42_000);
  assert.equal(o.ayNo, 10);
  assert.equal(Math.round(o.aylikOrtalama), 15_750);
  assert.equal(o.kalan, 2_342_500);
  assert.equal(o.kalanAy, 3);
  assert.equal(o.buAy, 57_500);
  // hedefe ulaşılmışsa kalan eksiye düşmez
  assert.equal(yilOzeti(l, 2026, 100_000, new Date("2026-10-27T09:00:00Z")).kalan, 0);
});

test("yıl hedefi ayarı normalize edilir", () => {
  assert.equal(yilHedefiNormalize(3_000_000), 3_000_000);
  assert.equal(yilHedefiNormalize(0), YIL_HEDEFI_VARSAYILAN);
  assert.equal(yilHedefiNormalize("çok"), YIL_HEDEFI_VARSAYILAN);
  assert.equal(yilHedefiNormalize(undefined), YIL_HEDEFI_VARSAYILAN);
});

test("kimden iş geldi: referans, paylaşılan ve taraflar birleşir; aynı kişi bir işlemde bir kez sayılır", () => {
  const w = kimdenIsGeldi([
    { banaKalan: 40_000, referansKisiId: "k1", referansAd: null, taraflar: [{ kisiId: "k1", ad: "Mustafa Bey", rol: "SATICI_KIRAYA_VEREN" }] },
    { banaKalan: 57_500, paylasilanKisiId: null, paylasilanAd: "Erkan Ateş Emlak", taraflar: [] },
  ]);
  const mustafa = w.find((x) => x.kisiId === "k1")!;
  assert.equal(mustafa.adet, 1, "iki rolde geçse de iş sayısı 1");
  assert.equal(mustafa.banaKalan, 40_000);
  assert.deepEqual(mustafa.roller, [TARAF_ROLU_ETIKET.REFERANS, TARAF_ROLU_ETIKET.SATICI_KIRAYA_VEREN]);
  assert.equal(mustafa.ad, "Mustafa Bey");
  // en çok kazandıran başta
  assert.equal(w[0].ad, "Erkan Ateş Emlak");
  assert.deepEqual(kimdenIsGeldi([{ banaKalan: 1000, taraflar: [] }]), []);
});

test("taraf rolleri Polaris'teki listeyle aynı", () => {
  assert.deepEqual([...TARAF_ROLLERI], ["ALICI_KIRACI", "SATICI_KIRAYA_VEREN", "REFERANS", "PAYLASILAN_DANISMAN", "DIGER"]);
  assert.equal(TARAF_ROLU_ETIKET.ALICI_KIRACI, "Alıcı / kiracı");
  assert.equal(TARAF_ROLU_ETIKET.SATICI_KIRAYA_VEREN, "Satıcı / kiraya veren");
  assert.notEqual(ISLEM_TURU_TON.SATIS, ISLEM_TURU_TON.KIRALAMA);
});

test("ekran: altı rakam, tür cipleri, ay seçimi ve CSV düğmesi", () => {
  const h = ciz();
  // v3.45 — altı renkli kutu tek bir rakam şeridine dönüştü; rakamların kendisi aynı
  for (const s of ["bana kalan (tahsil edilen)", "Aylık ortalama", "Yıl hedefine kalan", "Satış", "Kiralama", "Reklamdan gelen"]) assert.ok(h.includes(s), s + " rakamı yok");
  assert.equal((h.match(/class="rakam[ "]/g) ?? []).length, 6);
  for (const s of ["Hepsi", "Bütün aylar", "CSV indir", "+ Yeni işlem"]) assert.ok(h.includes(s), s + " yok");
});

test("ekran: tablo sütunları, TOTAL satırı ve kart listesi birlikte var", () => {
  const h = ciz();
  for (const s of ["Bana Kalan", "Paylaşımlı", "Paylaşılan kişi", "Ofise", "Referans", "Taraflar", "Açıklama"]) assert.ok(h.includes(s), s + " sütunu yok");
  assert.ok(h.includes("TOTAL · "), "TOTAL satırı yok");
  assert.ok(h.includes('class="islem-tablo"') && h.includes('class="islem-kartlar"'), "tablo ve kart listesi birlikte olmalı");
});

test("ekran: iki grafik ve 'Kimden iş geldi?' bölümü", () => {
  const h = ciz();
  assert.ok(h.includes("Aylara göre gelir"), "çubuk grafik yok");
  assert.ok(h.includes("Gelirin paylaşımı") && h.includes('class="halka"'), "halka grafik yok");
  assert.ok(h.includes("Kimden iş geldi?"), "kimden iş geldi yok");
  assert.ok(h.includes("Bana kalan") && h.includes("Paylaşım (diğer danışman)"), "halka grafiğin kalemleri yok");
});

test("ekran: örnek işlemin etiketleri tablodan okunuyor", () => {
  const h = ciz();
  assert.ok(h.includes("Faturasız") && h.includes("Nakit / elden"), "örnek işlemin not etiketleri görünmeli");
  assert.ok(h.includes("Erkan Ateş Emlak"), "paylaşılan kişi görünmeli");
  assert.ok(h.includes("Mustafa Bey"), "referans görünmeli");
});

test("stil: İşlemler ekranının sınıfları sayfa.html'de tanımlı", () => {
  const css = fs.readFileSync("demo/sayfa.html", "utf8");
  for (const s of [".rakam-serit", ".islem-tablo", ".islem-kartlar", ".gc-izgara", ".halka-liste", ".suzgec-cubugu", ".ic-bag"]) assert.ok(css.includes(s), s + " stili yok");
  // telefonda tablo gizlenir, kartlar görünür
  // telefonda tablo gizlenir, kartlar görünür (899px bloklarından birinde)
  const mobilBloklar = css.split("@media (max-width:899px)").slice(1);
  assert.ok(mobilBloklar.some((b) => b.includes(".islem-tablo-sar{display:none}") && b.includes(".islem-kartlar{display:flex}")), "mobil kuralı yok");
});

// ───────── v3.44.1 ─────────

test("v3.44.1: grafik sınıfları uygulamadaki başka bileşenlerle çakışmıyor", () => {
  const css = fs.readFileSync("demo/sayfa.html", "utf8");
  const ekran = fs.readFileSync("demo/islemler.tsx", "utf8");
  // ".cubuk" uygulamada ilerleme çubuğu; ".deger" ve ".ad" başka kartlarda kullanılıyor.
  for (const c of ['className="cubuk', 'className={"cubuk', 'className="deger"', 'className="dolgu"', 'className="ad"'])
    assert.ok(!ekran.includes(c), `çakışan sınıf kullanılmış: ${c}`);
  for (const c of [".gc-izgara", ".gc-sutun", ".gc-dolgu", ".gc-deger", ".gc-ay"]) assert.ok(css.includes(c), c + " stili yok");
  // eski ilerleme çubuğu kuralı yerinde durmalı
  assert.ok(css.includes(".cubuk{flex:1 1 200px"), "mevcut .cubuk kuralı bozulmuş");
});
