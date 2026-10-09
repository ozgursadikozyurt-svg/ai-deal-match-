/**
 * Anahtar CRM v3.22.1 · 9 Ekim 2026
 * v3.8 — veritabanlı: talep listesi ikinci kez eklenince kopya oluşmaz (önizlemede 'Zaten var', eklemede 'tekrar').
 * Not: v37-db aynı fikstürün talep sekmelerini zaten ekledi; bu test o kayıtların tekrar tanındığını doğrular.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { dosyaOnizle, topluEkle, TopluEkleSchema } from "../src/lib/services/toplu";
import { SADECE_TEST_baglamiSabitle, VARSAYILAN_OFIS_ID, VARSAYILAN_KULLANICI_ID, istemciyiSarmala } from "../src/lib/kiracilik";
// v3.20 — çok ofisli: testler varsayılan ofisin bağlamında çalışır (göçte açılan Özyurtlar Gayrimenkul)
SADECE_TEST_baglamiSabitle({ ofisId: VARSAYILAN_OFIS_ID, kullaniciId: VARSAYILAN_KULLANICI_ID, rol: "OFIS_YONETICISI", eposta: "test@anahtar.local" });


const prisma = istemciyiSarmala(new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL!, max: 1 }) }));
const dosya = new Uint8Array(fs.readFileSync("tests/fixtures/v37_ornek.xlsx"));

test("talep listesi: ikinci yüklemede 'Zaten var', eklemede kopya yok", async () => {
  const once = await prisma.kayit.count({ where: { tip: "TALEP" } });
  const o = await dosyaOnizle(prisma, "v37_ornek.xlsx", dosya, { sayfalar: ["1.HAFTA", "3. HAFTA"] });
  const veri = o.satirlar.filter((s) => s.veri);
  assert.ok(veri.length >= 4);
  assert.equal(veri.filter((s) => s.durum === "TEKRAR").length, veri.length, JSON.stringify(veri.map((s) => s.durum)));
  const r = await topluEkle(prisma, TopluEkleSchema.parse({ satirlar: veri.map((s) => ({ veri: s.veri, kisi: s.kisi })) }));
  assert.equal(r.eklenen, 0); assert.equal(r.tekrar, veri.length);
  assert.equal(await prisma.kayit.count({ where: { tip: "TALEP" } }), once);
});

test("eşleşmeyi kopar alanları yazılır", async () => {
  const t = await prisma.kayit.findFirstOrThrow({ where: { tip: "TALEP" } }), p = await prisma.kayit.findFirstOrThrow({ where: { tip: "PORTFOY" } });
  const m = await prisma.match.upsert({ where: { talepId_portfoyId: { talepId: t.id, portfoyId: p.id } }, update: { durum: "REDDEDILDI", kopmaNedeni: "BEGENMEDI", koparilma: new Date() }, create: { talepId: t.id, portfoyId: p.id, matematikSkor: 0, finalSkor: 0, durum: "REDDEDILDI", kopmaNedeni: "BEGENMEDI", koparilma: new Date() } });
  assert.equal(m.kopmaNedeni, "BEGENMEDI");
});

test.after(() => prisma.$disconnect());