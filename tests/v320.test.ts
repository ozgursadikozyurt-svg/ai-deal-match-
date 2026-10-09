/**
 * Anahtar CRM v3.22.1 · 9 Ekim 2026
 * v3.20 — veritabanı gerektirmeyen denetimler: sorgu dönüştürme, roller/yetkiler, plan sınırları,
 * davet kodu ve güvenlik kuralları (ham SQL, test arka kapısı, ebeveyn modeller).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  cagriyiDonustur,
  gorunurlukSuzgeci,
  KiracilikHatasi,
  OFIS_MODELLERI,
  EBEVEYN_MODELLERI,
  GENEL_MODELLER,
  type Baglam,
} from "../src/lib/kiracilik";
import { YETKILER, yetkiVar, yetkiGerek, YetkiHatasi, PLANLAR, planSinirlari } from "../src/lib/guvenlik/yetki";
import { slugla, davetKoduUret, kodOzeti, DavetSchema, OfisSchema } from "../src/lib/services/ofis";

const A: Baglam = { ofisId: "ofis-A", kullaniciId: "kull-A1", rol: "OFIS_YONETICISI", eposta: "a@x.com" };
const DANISMAN: Baglam = { ofisId: "ofis-A", kullaniciId: "kull-A2", rol: "DANISMAN", eposta: "d@x.com" };

// ───────────────────────── Sorgu dönüştürme ─────────────────────────

test("okuma sorgusuna ofis süzgeci eklenir", () => {
  const d = cagriyiDonustur("kayit", "findMany", { where: { tip: "TALEP" } }, A);
  assert.equal(d.islem, "findMany");
  assert.deepEqual(d.args.where, { AND: [{ ofisId: "ofis-A" }, { tip: "TALEP" }] });
});

test("where'i olmayan findMany de süzülür (tüm kayıtları getirme girişimi)", () => {
  const d = cagriyiDonustur("kisi", "findMany", {}, A);
  assert.deepEqual(d.args.where, { ofisId: "ofis-A" });
});

test("findUnique → findFirst'e çevrilir (ofisId benzersiz alan listesinde olmadığı için)", () => {
  const d = cagriyiDonustur("kayit", "findUnique", { where: { id: "k1" } }, A);
  assert.equal(d.islem, "findFirst");
  assert.deepEqual(d.args.where, { AND: [{ ofisId: "ofis-A" }, { id: "k1" }] });
  assert.equal(cagriyiDonustur("kayit", "findUniqueOrThrow", { where: { id: "k1" } }, A).islem, "findFirstOrThrow");
});

test("oluşturmaya ofisId yazılır — tek kayıt ve createMany dizisi", () => {
  assert.equal(cagriyiDonustur("kayit", "create", { data: { tip: "TALEP" } }, A).args.data.ofisId, "ofis-A");
  const c = cagriyiDonustur("kisi", "createMany", { data: [{ adSoyad: "A" }, { adSoyad: "B" }] }, A);
  assert.deepEqual(c.args.data.map((x: { ofisId: string }) => x.ofisId), ["ofis-A", "ofis-A"]);
});

test("upsert: create tarafına ofisId yazılır, where'e dokunulmaz (bileşik anahtar zaten ofise özgü)", () => {
  const d = cagriyiDonustur("ayar", "upsert", { where: { ofisId_anahtar: { ofisId: "ofis-A", anahtar: "ttl" } }, create: { anahtar: "ttl", deger: {} }, update: {} }, A);
  assert.equal(d.args.create.ofisId, "ofis-A");
  assert.deepEqual(d.args.where, { ofisId_anahtar: { ofisId: "ofis-A", anahtar: "ttl" } });
});

test("silme ve güncellemede de süzgeç var → başka ofisin kaydı değiştirilemez", () => {
  // where düz birleştirilir: Prisma update/delete where'inde AND/OR kabul etmez
  for (const op of ["update", "delete", "updateMany", "deleteMany"]) {
    const d = cagriyiDonustur("kayit", op, { where: { id: "baska-ofisin-kaydi" } }, A);
    assert.deepEqual(d.args.where, { id: "baska-ofisin-kaydi", ofisId: "ofis-A" }, op);
  }
});

test("çağıran kendi ofisId'sini yazsa bile bağlamdaki ofis kazanır", () => {
  const d = cagriyiDonustur("kayit", "update", { where: { id: "k1", ofisId: "ofis-B" }, data: {} }, A);
  assert.equal(d.args.where.ofisId, "ofis-A");
});

test("GÜVENLİ VARSAYILAN: ofis bağlamı yoksa ofise ait tabloya erişim hata verir", () => {
  for (const m of OFIS_MODELLERI) {
    assert.throws(() => cagriyiDonustur(m, "findMany", {}, undefined), KiracilikHatasi, m);
  }
});

test("platform bağlamı süzgeç uygulamaz (zamanlayıcı, yedek, platform yönetimi)", () => {
  const d = cagriyiDonustur("kayit", "updateMany", { where: { durum: "ACTIVE" } }, "platform");
  assert.deepEqual(d.args.where, { durum: "ACTIVE" });
});

test("genel başvuru tabloları (il / ilçe / mahalle) süzülmez ve bağlam gerektirmez", () => {
  for (const m of GENEL_MODELLER) {
    const d = cagriyiDonustur(m, "findMany", { where: { ilId: 7 } }, undefined);
    assert.deepEqual(d.args.where, { ilId: 7 }, m);
  }
});

test("ofis tablosu: yalnızca kendi ofisi sorgulanabilir, başkası hata verir", () => {
  assert.deepEqual(cagriyiDonustur("ofis", "findFirst", { where: { id: "ofis-A" } }, A).args.where, { id: "ofis-A" });
  assert.throws(() => cagriyiDonustur("ofis", "findFirst", { where: { id: "ofis-B" } }, A), KiracilikHatasi);
  assert.throws(() => cagriyiDonustur("ofis", "findMany", {}, A), KiracilikHatasi);
  // platform yöneticisi tüm ofisleri platformOlarak(...) ile listeler
  assert.deepEqual(cagriyiDonustur("ofis", "findMany", {}, "platform").args, {});
});

// ───────────────────────── Görünürlük ─────────────────────────

test("danışman ofis ortak kayıtlarını ve kendi kayıtlarını görür; meslektaşının özelini görmez", () => {
  const s = gorunurlukSuzgeci(DANISMAN, "kayit");
  assert.deepEqual(s, { OR: [{ gorunurluk: "OFIS" }, { sahipKullaniciId: "kull-A2" }] });
  const d = cagriyiDonustur("kayit", "findMany", {}, DANISMAN);
  assert.deepEqual(d.args.where, { AND: [{ ofisId: "ofis-A" }, s] });
});

test("ofis yöneticisi ve platform yöneticisi ofisin tamamını görür", () => {
  assert.equal(gorunurlukSuzgeci(A, "kayit"), undefined);
  assert.equal(gorunurlukSuzgeci({ ...A, rol: "PLATFORM_YONETICISI" }, "kisi"), undefined);
});

test("görünürlük yalnızca kayıt ve kişi için geçerli (eşleşme kayda bağlı)", () => {
  assert.equal(gorunurlukSuzgeci(DANISMAN, "match"), undefined);
});

// ───────────────────────── Roller ve yetkiler ─────────────────────────

test("rol kademeleri: danışman < ofis yöneticisi < platform yöneticisi", () => {
  assert.ok(YETKILER.DANISMAN.length < YETKILER.OFIS_YONETICISI.length);
  assert.ok(YETKILER.OFIS_YONETICISI.length < YETKILER.PLATFORM_YONETICISI.length);
  for (const y of YETKILER.DANISMAN) assert.ok(yetkiVar("OFIS_YONETICISI", y), y);
  for (const y of YETKILER.OFIS_YONETICISI) assert.ok(yetkiVar("PLATFORM_YONETICISI", y), y);
});

test("danışman ofis yönetemez, platform yönetemez", () => {
  for (const y of ["ofis.kullanicilar", "ofis.davet", "ofis.ayarlar", "ofis.tumKayitlar", "platform.ofisler"] as const)
    assert.equal(yetkiVar("DANISMAN", y), false, y);
  assert.ok(yetkiVar("DANISMAN", "kayit.yaz"));
});

test("ofis yöneticisi platform işlerini yapamaz", () => {
  for (const y of ["platform.ofisler", "platform.plan", "platform.kullanim"] as const)
    assert.equal(yetkiVar("OFIS_YONETICISI", y), false, y);
});

test("yetkiGerek yetkisiz rolde YetkiHatasi fırlatır (403)", () => {
  assert.throws(() => yetkiGerek("DANISMAN", "ofis.davet"), (e: unknown) => e instanceof YetkiHatasi && e.durum === 403);
  assert.doesNotThrow(() => yetkiGerek("OFIS_YONETICISI", "ofis.davet"));
});

// ───────────────────────── Planlar ─────────────────────────

test("ücretsiz planda fotoğraf kapalı, tek kullanıcı, senkron ve föy yok", () => {
  const u = PLANLAR.UCRETSIZ;
  assert.equal(u.fotoBasinaKayit, 0);
  assert.equal(u.kullanici, 1);
  assert.equal(u.entegrasyon, false);
  assert.equal(u.paylasimFoyu, false);
});

test("Pro planda fotoğraf 8, senkron ve föy açık", () => {
  assert.equal(PLANLAR.PRO.fotoBasinaKayit, 8);
  assert.ok(PLANLAR.PRO.entegrasyon && PLANLAR.PRO.paylasimFoyu);
  assert.ok(PLANLAR.PRO.gunlukAi > PLANLAR.UCRETSIZ.gunlukAi);
});

test("sınırsız ofis (Özyurtlar) plan sınırlarına takılmaz", () => {
  const s = planSinirlari("UCRETSIZ", true);
  assert.equal(s.etiket, "Sınırsız");
  assert.equal(s.fotoBasinaKayit, 8);
  assert.ok(s.kullanici > PLANLAR.PRO.kullanici);
});

// ───────────────────────── Davet ─────────────────────────

test("davet kodu tahmin edilemez ve her çağrıda farklı", () => {
  const kodlar = new Set(Array.from({ length: 200 }, () => davetKoduUret()));
  assert.equal(kodlar.size, 200);
  assert.match(davetKoduUret(), /^[a-z2-9]{24}$/);
});

test("veritabanında kodun yalnızca özeti durur (bağlantı sızsa bile geri üretilemez)", async () => {
  const kod = davetKoduUret();
  const o = await kodOzeti(kod);
  assert.match(o, /^[0-9a-f]{64}$/);
  assert.notEqual(o, kod);
  assert.equal(o, await kodOzeti(kod), "aynı kod aynı özeti verir");
  assert.notEqual(o, await kodOzeti(kod + "x"));
});

test("davet varsayılanı danışman rolü ve 14 gün", () => {
  const d = DavetSchema.parse({});
  assert.equal(d.rol, "DANISMAN");
  assert.equal(d.gun, 14);
});

test("yeni ofis varsayılan olarak ücretsiz plandadır", () => {
  assert.equal(OfisSchema.parse({ ad: "Deneme Emlak" }).plan, "UCRETSIZ");
});

test("ofis adı adrese çevrilir (Türkçe harfler dahil)", () => {
  assert.equal(slugla("Özyurtlar Gayrimenkul"), "ozyurtlar-gayrimenkul");
  assert.equal(slugla("Şişli İnşaat & Emlak"), "sisli-insaat-emlak");
  assert.equal(slugla("!!!"), "ofis");
});

// ───────────────────────── Kod denetimleri (sızıntı yolları) ─────────────────────────

const kaynaklar = (() => {
  const out: { yol: string; metin: string }[] = [];
  const yurur = (d: string) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const y = path.join(d, e.name);
      if (e.isDirectory()) { if (e.name !== "generated") yurur(y); }
      else if (/\.tsx?$/.test(e.name)) out.push({ yol: y, metin: fs.readFileSync(y, "utf8") });
    }
  };
  yurur("src");
  return out;
})();

test("test arka kapısı uygulama kodunda kullanılmıyor (yalnızca kiracilik.ts tanımlar)", () => {
  const kullanan = kaynaklar.filter((f) => f.metin.includes("SADECE_TEST_baglamiSabitle") && !f.yol.endsWith("kiracilik.ts"));
  assert.deepEqual(kullanan.map((f) => f.yol), [], "uygulama kodu test bağlamını sabitlemez");
});

test("ofise ait tablolarda ham SQL kullanılmıyor (ham SQL ofis süzgecinden geçmez)", () => {
  const tablolar = ["kayit", "kisi", "match", "ayar", "portal_ilan", "kayit_not", "kayit_foto", "entegrasyon", "islenmis_mesaj", "lokasyon_aday"];
  const suclu: string[] = [];
  for (const f of kaynaklar) {
    for (const m of f.metin.matchAll(/\$(?:query|execute)Raw(?:Unsafe)?[(`]([^`)]*)/g)) {
      const sql = (m[1] ?? "").toLowerCase();
      if (tablolar.some((t) => sql.includes(t))) suclu.push(`${f.yol}: ${m[1].slice(0, 60)}`);
    }
  }
  assert.deepEqual(suclu, []);
});

test("ebeveyn üzerinden erişilen tablolar doğrudan sorgulanmıyor (süzgeç uygulanamaz)", () => {
  const suclu: string[] = [];
  for (const f of kaynaklar) {
    if (f.yol.endsWith("kiracilik.ts")) continue;
    for (const m of EBEVEYN_MODELLERI) {
      // izinli: nested yazma (kayit.create içinde ozellik: { create: … }) — doğrudan delege çağrısı değil
      const re = new RegExp(`\\b(?:prisma|tx)\\.${m}\\.(findMany|findFirst|findUnique|count|aggregate|groupBy)`, "g");
      for (const h of f.metin.matchAll(re)) suclu.push(`${f.yol}: ${h[0]}`);
    }
  }
  assert.deepEqual(suclu, [], "bu modeller yalnızca ebeveyn kaydın içinden okunmalı");
});

test("göçte açılan ofis ve sahibi şema ile aynı kimlikleri kullanıyor", () => {
  const sql = fs.readFileSync("prisma/migrations/20261007100000_v320_cok_ofis/migration.sql", "utf8");
  assert.ok(sql.includes("ofis_ozyurtlar_0001"), "varsayılan ofis kimliği");
  assert.ok(sql.includes("Özyurtlar Gayrimenkul"));
  assert.ok(sql.includes("ozgursadikozyurt@gmail.com"), "platform yöneticisi");
  // Eski satırların dolması için geçici varsayılan şart; sonrasında '' olur
  assert.ok(sql.includes("ADD COLUMN \"ofisId\" TEXT NOT NULL DEFAULT 'ofis_ozyurtlar_0001'") || sql.includes("%L', t, 'ofis_ozyurtlar_0001'"));
});
