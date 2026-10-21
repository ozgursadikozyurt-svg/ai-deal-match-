/**
 * Anahtar CRM v3.38 · 21 Ekim 2026
 * v3.38 — veritabanlı: kayit.durumTarihi ve kayit.butceSerbest; durum değişince sunucu tarihi yazar, değişmeyince korur.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { degisiklikUygula, durumGetir, DegisiklikSchema } from "../src/lib/services/durum";
import { SADECE_TEST_baglamiSabitle, VARSAYILAN_OFIS_ID, VARSAYILAN_KULLANICI_ID, istemciyiSarmala } from "../src/lib/kiracilik";

SADECE_TEST_baglamiSabitle({ ofisId: VARSAYILAN_OFIS_ID, kullaniciId: VARSAYILAN_KULLANICI_ID, rol: "OFIS_YONETICISI", eposta: "test@anahtar.local" });
const prisma = istemciyiSarmala(new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL!, max: 1 }) }));
const yaz = (id: string, veri: Record<string, unknown>) => degisiklikUygula(prisma as any, DegisiklikSchema.parse({ kayitlar: [{ id, veri }] }));
const oku = async (id: string) => ((await durumGetir(prisma as any)) as any).kayitlar.find((x: any) => x.id === id).veri;
const P = { tip: "PORTFOY", mulkTipi: "DEPO_ANTREPO", islemTipi: "KIRALIK", fiyat: 120000, fiyatPeriyodu: "AYLIK" };

test("migration: kayit.durumTarihi ve kayit.butceSerbest", async () => {
  const c: any[] = await prisma.$queryRawUnsafe(`select column_name from information_schema.columns where table_name='kayit' and column_name in ('durumTarihi','butceSerbest')`);
  assert.equal(c.length, 2);
});

test("durum tarihi: aktif kayıtta boş; pasife alınınca sunucu yazar; durum değişmeden kaydedilince korunur; yeniden aktif olunca güncellenir", async () => {
  assert.deepEqual((await yaz("P338", P)).hatalar, []);
  assert.equal((await oku("P338")).durumTarihi ?? null, null);
  const once = Date.now();
  await yaz("P338", { ...P, durum: "PASSIVE", durumTarihi: "2020-01-01" }); // istemcinin eski tarihi yok sayılır
  const t1 = new Date((await oku("P338")).durumTarihi).getTime();
  assert.ok(t1 >= once - 1000, "şimdi yazıldı");
  await yaz("P338", { ...P, durum: "PASSIVE", baslik: "başlık değişti" });
  assert.equal(new Date((await oku("P338")).durumTarihi).getTime(), t1, "durum değişmedi → tarih korundu");
  await yaz("P338", { ...P, durum: "ACTIVE" });
  assert.ok(new Date((await oku("P338")).durumTarihi).getTime() >= t1);
});

test("butceSerbest: talepte saklanır ve geri okunur", async () => {
  assert.deepEqual((await yaz("T338", { tip: "TALEP", mulkTipi: "DEPO_ANTREPO", islemTipi: "KIRALIK", minM2: 2000, maxM2: 4000, fiyatPeriyodu: "AYLIK", butceSerbest: true })).hatalar, []);
  assert.equal((await oku("T338")).butceSerbest, true);
});
