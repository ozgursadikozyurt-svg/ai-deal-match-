/**
 * Anahtar CRM v3.43 · 25 Ekim 2026
 * (1) Mülk grubuna göre kritik bilgi: kiralık dairede depo soruları çıkmaz; depoda çıkmaya devam eder.
 * (2) Otomatik görevler: eski sistem görevleri açılışta temizlenir, yinelenenler tekleşir; elle / "göreve alalım" görevleri kalır.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { talepDnasi } from "../src/lib/eslestirme/talep-dna";
import fs from "node:fs";
import { SURUM, SURUM_GECMISI } from "../src/lib/surum";
import { gorevUret, otomatikGorevleriTemizle, ASAMA_GOREVLERI, gunYaz } from "../src/lib/domain/gorev";

const kodlar = (d: ReturnType<typeof talepDnasi>) => d.eksik.map((e) => e.kriter);

test("kiralık daire talebi: depo / üretim soruları (yükseklik, TIR, elektrik, m²) çıkmaz; konuta özgü sorular çıkar", () => {
  // forma önceden girilmiş depo amacı ve yapay zekânın eklediği depo eksikleri dairede karışmamalı
  const d = talepDnasi({ tip: "TALEP", mulkTipi: "DAIRE", islemTipi: "KIRALIK", lokasyonlar: [], ozellik: { kullanimAmaclari: ["LOJISTIK_DAGITIM"], eksikBilgiler: ["YUKSEKLIK", "ARAC_ERISIMI", "ELEKTRIK"] } } as any);
  for (const k of ["YUKSEKLIK", "ARAC_ERISIMI", "RAMPA", "ELEKTRIK", "ALAN"]) assert.ok(!kodlar(d).includes(k), `${k} dairede sorulmamalı`);
  for (const k of ["LOKASYON", "FIYAT", "ODA_SAYISI", "ESYA", "KAT"]) assert.ok(kodlar(d).includes(k), `${k} sorulmalı`);
  assert.ok(!kodlar(d).includes("KREDI"), "kredi kiralıkta sorulmaz");
  assert.ok(!(d.soruMesaji ?? "").includes("TIR"), d.soruMesaji ?? "");
  assert.ok(!d.kritik.some((k) => k.kriter === "ARAC_ERISIMI"), "depo amacı daire talebini öldürmemeli");
});

test("satılık daire: krediye uygunluk sorulur, eşya sorulmaz", () => {
  const d = talepDnasi({ tip: "TALEP", mulkTipi: "DAIRE", islemTipi: "SATILIK", lokasyonlar: [] } as any);
  assert.ok(kodlar(d).includes("KREDI")); assert.ok(!kodlar(d).includes("ESYA"));
});

test("depo talebi: TIR / yükseklik sorulmaya devam eder", () => {
  const d = talepDnasi({ tip: "TALEP", mulkTipi: "DEPO_ANTREPO", islemTipi: "KIRALIK", lokasyonlar: [], ozellik: { kullanimAmaclari: ["LOJISTIK_DAGITIM"] } } as any);
  assert.ok(kodlar(d).includes("ARAC_ERISIMI")); assert.ok(kodlar(d).includes("ALAN")); assert.ok(kodlar(d).includes("YUKSEKLIK"));
});

test("dükkan talebi: cephe / yaya trafiği sorulur, depo soruları çıkmaz; arsa: imar", () => {
  const d = talepDnasi({ tip: "TALEP", mulkTipi: "DUKKAN_MAGAZA", islemTipi: "KIRALIK", lokasyonlar: [] } as any);
  assert.ok(kodlar(d).includes("CEPHE_VITRIN")); assert.ok(!kodlar(d).includes("RAMPA"));
  const a = talepDnasi({ tip: "TALEP", mulkTipi: "ARSA", islemTipi: "SATILIK", lokasyonlar: [] } as any);
  assert.ok(kodlar(a).includes("IMAR")); assert.ok(!kodlar(a).includes("ARAC_ERISIMI"));
});

test("açıkça 'şart' denen kriter mülk tipinden bağımsız korunur", () => {
  const d = talepDnasi({ tip: "TALEP", mulkTipi: "DAIRE", islemTipi: "KIRALIK", lokasyonlar: [], ozellik: { kritikKriterler: ["OTOPARK"], otoparkVar: true } } as any);
  assert.ok(d.kritik.some((k) => k.kriter === "OTOPARK" && k.kaynak === "TALEP"));
});

test("otomatik görevler açılışta temizlenir; elle ve 'göreve alalım' görevleri ile fiyat düşüşü kalır; yinelenenler tekleşir", () => {
  const simdi = new Date(2026, 9, 23, 12), g = (kural: any, baslik: string, vade = gunYaz(simdi)) => gorevUret({ kural, tur: "ARA", baslik, vade, kisiId: "k1", kayitId: "r1", eslesme: "t~p" }, simdi);
  const liste = [g("SICAK", "Sıcak eşleşme (%95) — sunumu gönder"), g("TEMAS", "30 gündür temas yok"), g("GERI_DONUS", "Geri dönüş al"), g("IZLENIM", "Gösterim izlenimini sor"),
    g("ELLE", "Ahmet'i ara"), g("ELLE", "Ahmet'i ara"), g("SONRAKI", "Sunuma yanıt al"), g("FIYAT", "Fiyat düştü")];
  const r = otomatikGorevleriTemizle(liste);
  assert.deepEqual(r.map((x) => x.kural).sort(), ["ELLE", "FIYAT", "SONRAKI"]);
  assert.equal(otomatikGorevleriTemizle(r), r, "temiz listede değişiklik yok");
});

test("aşama tablosu boş: durum değişince görev kendiliğinden doğmaz", () => {
  assert.ok(Object.values(ASAMA_GOREVLERI).every((l) => l.length === 0));
});

test("sürüm 3.40 ve ek belge", () => {
  assert.ok(SURUM_GECMISI.some((x) => x.surum === "3.40")); assert.equal(SURUM_GECMISI[SURUM_GECMISI.findIndex((x) => x.surum === "3.40") + 1].surum, "3.39");
  assert.ok(fs.existsSync("docs/ANAHTAR_CRM_EK_v3.40_23Ekim2026.md"));
});
