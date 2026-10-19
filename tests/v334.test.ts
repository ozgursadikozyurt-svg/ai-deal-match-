/**
 * Anahtar CRM v3.34 · 19 Ekim 2026
 * v3.34 — veritabanısız: kampanya yetkisi, maliyet hesabı, girdi doğrulaması, ofis kiracılığı, şema ve migration.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { SURUM, SURUM_GECMISI } from "../src/lib/surum";
import { YETKILER, yetkiVar } from "../src/lib/guvenlik/yetki";
import { OFIS_MODELLERI } from "../src/lib/kiracilik";
import { kayitBasinaMaliyet, KAMPANYA_KANALLARI } from "../src/lib/services/kampanya-ortak";
import { KampanyaOlusturSchema, KampanyaGuncelleSchema, HarcamaSchema } from "../src/lib/services/kampanya";

test("kampanya.yonet yalnızca ofis yöneticisinde (asistan ve danışman bütçe / harcama göremez)", () => {
  assert.ok(yetkiVar("OFIS_YONETICISI", "kampanya.yonet"));
  assert.ok(yetkiVar("PLATFORM_YONETICISI", "kampanya.yonet"));
  assert.ok(!yetkiVar("DANISMAN", "kampanya.yonet"));
  assert.ok(!yetkiVar("ASISTAN", "kampanya.yonet"));
  assert.ok(YETKILER.ASISTAN.length > 0);
});

test("kayıt başına maliyet: harcama / kayıt sayısı, yuvarlanır; veri yoksa null", () => {
  assert.equal(kayitBasinaMaliyet(12600, 7), 1800);
  assert.equal(kayitBasinaMaliyet(10000, 3), 3333);
  assert.equal(kayitBasinaMaliyet(0, 5), null, "harcama girilmemişse maliyet söylenmez");
  assert.equal(kayitBasinaMaliyet(5000, 0), null, "kayıt yokken sıfıra bölme yok");
});

test("girdi doğrulaması: kanal, ad, bütçe, ay biçimi", () => {
  assert.deepEqual([...KAMPANYA_KANALLARI], ["META_REKLAM", "GOOGLE_REKLAM", "REKLAM"]);
  assert.equal(KampanyaOlusturSchema.parse({ kanal: "META_REKLAM", ad: "  Meta – Depo Ekim  ", butce: 30000 }).ad, "Meta – Depo Ekim");
  assert.throws(() => KampanyaOlusturSchema.parse({ kanal: "ORGANIK", ad: "x yy" }), "ilk kaynak kodlarının hepsi kampanya kanalı değil");
  assert.throws(() => KampanyaOlusturSchema.parse({ kanal: "REKLAM", ad: "a" }));
  assert.throws(() => KampanyaOlusturSchema.parse({ kanal: "REKLAM", ad: "Geçerli ad", butce: -1 }));
  assert.ok(!("ad" in KampanyaGuncelleSchema.parse({ ad: "yeni ad", aktif: false })), "güncellemede ad yok sayılır (değişmez)");
  assert.equal(HarcamaSchema.parse({ ay: "2026-10", tutar: 12600 }).tutar, 12600);
  assert.equal(HarcamaSchema.parse({ ay: "2026-10", tutar: null }).tutar, null);
  assert.throws(() => HarcamaSchema.parse({ ay: "2026-13", tutar: 1 }));
  assert.throws(() => HarcamaSchema.parse({ ay: "Ekim", tutar: 1 }));
});

test("kiracılık: kampanya tabloları ofise bağlı; şemada ve migration'da var, RLS açık", () => {
  assert.ok(OFIS_MODELLERI.has("kampanya") && OFIS_MODELLERI.has("kampanyaHarcama"));
  const sema = readFileSync("prisma/schema.prisma", "utf8");
  assert.match(sema, /model Kampanya \{[\s\S]*@@unique\(\[ofisId, ad\]\)[\s\S]*@@map\("kampanya"\)/);
  assert.match(sema, /model KampanyaHarcama \{[\s\S]*@@unique\(\[kampanyaId, ay\]\)[\s\S]*@@map\("kampanya_harcama"\)/);
  const m = readFileSync("prisma/migrations/20261019120000_v334_kampanya/migration.sql", "utf8");
  assert.match(m, /ALTER TABLE "kampanya" ENABLE ROW LEVEL SECURITY/);
  assert.match(m, /ALTER TABLE "kampanya_harcama" ENABLE ROW LEVEL SECURITY/);
  assert.ok(!/DROP |DELETE FROM|TRUNCATE/i.test(m), "migration yalnızca ekler");
});

test("arayüz: Yönetim'de kampanya bölümü yetkiye bağlı, formda kampanya listesi var", () => {
  assert.match(readFileSync("demo/yonetim.tsx", "utf8"), /yetkiler\.includes\("kampanya\.yonet"\) && <KampanyaYonetimi \/>/);
  assert.match(readFileSync("demo/ilk-kaynak.tsx", "utf8"), /useKampanyaAdlari/);
});

test("sürüm 3.34: günlük kaydı, test adımları ve ek belge var", () => {
  assert.equal(SURUM, "3.34"); assert.equal(SURUM_GECMISI[0].surum, "3.34");
  assert.ok((SURUM_GECMISI[0].testEt ?? []).length >= 2);
  assert.ok(existsSync("docs/ANAHTAR_CRM_EK_v3.34_19Ekim2026.md"));
});
