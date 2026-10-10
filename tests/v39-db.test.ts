/**
 * Anahtar CRM v3.22.2 · 10 Ekim 2026
 * v3.9 — veritabanlı: POST /api/ai/yorumla veritabanındaki lokasyon indeksiyle metni yorumlar, kayıt açmaz.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { ORNEK_PORTAL_SAYFASI, ORNEK_SOHBET } from "../demo/ornek-metinler";
import { SADECE_TEST_baglamiSabitle, VARSAYILAN_OFIS_ID, VARSAYILAN_KULLANICI_ID, istemciyiSarmala } from "../src/lib/kiracilik";
// v3.20 — çok ofisli: testler varsayılan ofisin bağlamında çalışır (göçte açılan Özyurtlar Gayrimenkul)
SADECE_TEST_baglamiSabitle({ ofisId: VARSAYILAN_OFIS_ID, kullaniciId: VARSAYILAN_KULLANICI_ID, rol: "OFIS_YONETICISI", eposta: "test@anahtar.local" });


// Test veritabanı (PGlite) tek bağlantı kabul eder: rota src/lib/db'deki istemciyi kullandığı için önce tek bağlantılı istemci yerleştirilir.
const prisma = istemciyiSarmala(new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL!, max: 1 }) }));
(globalThis as any).prisma = prisma;
const cagir = async (govde: unknown) => { const { POST } = await import("../src/app/api/ai/yorumla/route"); const r = await POST(new Request("http://x/api/ai/yorumla", { method: "POST", body: JSON.stringify(govde) })); return { durum: r.status, veri: (await r.json()) as any }; };

test("yorumla: portal sayfası tek portföy, konumu veritabanı indeksiyle çözülür, kayıt açılmaz", async () => {
  const once = await prisma.kayit.count();
  const { durum, veri } = await cagir({ metin: ORNEK_PORTAL_SAYFASI, istem: true });
  assert.equal(durum, 200); assert.equal(veri.tur, "PORTAL_ILANI"); assert.equal(veri.parcalar.length, 1);
  assert.equal(veri.parcalar[0].lokasyonlar[0].etiket, "Muratpaşa / Yeşilova");
  assert.equal(veri.aiOnerilir, false); assert.ok(String(veri.aiIstemi).includes("PORTAL_ILANI"));
  assert.equal(await prisma.kayit.count(), once);
});

test("yorumla: sohbet dökümü 8 kayıt; kısa metin doğrulama hatası", async () => {
  const { veri } = await cagir({ metin: ORNEK_SOHBET });
  assert.equal(veri.tur, "WHATSAPP_SOHBETI"); assert.equal(veri.parcalar.length, 8); assert.equal(veri.aiIstemi, undefined);
  assert.equal((await cagir({ metin: "a" })).durum, 422);
});

test.after(() => prisma.$disconnect());