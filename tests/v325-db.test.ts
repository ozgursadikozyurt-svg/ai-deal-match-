/**
 * Anahtar CRM v3.41 · 23 Ekim 2026
 * v3.25 — veritabanlı: Bugün panosu görevleri ve İlgilenenler, ofis ayarı (Ayar) içinde saklanır; göç yok.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { SADECE_TEST_baglamiSabitle, VARSAYILAN_OFIS_ID, VARSAYILAN_KULLANICI_ID, istemciyiSarmala } from "../src/lib/kiracilik";
import { degisiklikUygula, durumGetir, DegisiklikSchema } from "../src/lib/services/durum";
SADECE_TEST_baglamiSabitle({ ofisId: VARSAYILAN_OFIS_ID, kullaniciId: VARSAYILAN_KULLANICI_ID, rol: "OFIS_YONETICISI", eposta: "test@anahtar.local" });

const prisma = istemciyiSarmala(new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL!, max: 1 }) }));
(globalThis as any).prisma = prisma;

test("görevler ve ilgilenenler yazılır, geri okunur; bozuk satır atılır, istek reddedilmez", async () => {
  const gorev = { id: "g1", kural: "ELLE", tur: "ARA", baslik: "Ahmet'i ara", kisiId: null, kayitId: null, eslesme: null, vade: "2026-10-12", durum: "ACIK", otoAnahtar: null, olusturma: new Date().toISOString() };
  const ilgi = { id: "i1", kayitId: "K1", kisiId: "P1", durum: "GOSTERILDI", tarih: new Date().toISOString(), not: null, eslesme: null, olusturma: new Date().toISOString() };
  const g = DegisiklikSchema.parse({ ayarlar: { gorevler: [gorev, { bozuk: true }], ilgilenenler: [ilgi, 7] } });
  await degisiklikUygula(prisma as any, g);
  const s: any = await durumGetir(prisma as any);
  assert.equal(s.ayarlar.gorevler.length, 1); assert.equal(s.ayarlar.gorevler[0].baslik, "Ahmet'i ara");
  assert.equal(s.ayarlar.ilgilenenler.length, 1); assert.equal(s.ayarlar.ilgilenenler[0].durum, "GOSTERILDI");
  await degisiklikUygula(prisma as any, DegisiklikSchema.parse({ ayarlar: { gorevler: [], ilgilenenler: [] } }));
  const t: any = await durumGetir(prisma as any);
  assert.deepEqual(t.ayarlar.gorevler, []); assert.deepEqual(t.ayarlar.ilgilenenler, []);
});

test.after(() => prisma.$disconnect());
