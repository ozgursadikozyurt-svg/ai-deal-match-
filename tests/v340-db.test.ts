/**
 * Anahtar CRM v3.41 · 23 Ekim 2026
 * v3.40 — veritabanlı: parçalı açılış (durumParcasiGetir) tek seferlik durumGetir ile aynı veriyi sayfa sayfa verir.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { degisiklikUygula, durumGetir, durumParcasiGetir, DegisiklikSchema } from "../src/lib/services/durum";
import { SADECE_TEST_baglamiSabitle, VARSAYILAN_OFIS_ID, VARSAYILAN_KULLANICI_ID, istemciyiSarmala } from "../src/lib/kiracilik";

SADECE_TEST_baglamiSabitle({ ofisId: VARSAYILAN_OFIS_ID, kullaniciId: VARSAYILAN_KULLANICI_ID, rol: "OFIS_YONETICISI", eposta: "test@anahtar.local" });
const prisma = istemciyiSarmala(new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL!, max: 1 }) })) as any;
const P = { tip: "PORTFOY", mulkTipi: "DEPO_ANTREPO", islemTipi: "KIRALIK", fiyat: 120000, fiyatPeriyodu: "AYLIK" };

test("parçalı açılış: kayıt ve kişi sayfaları birleşince tek seferlik durumGetir ile aynı; sayfa sınırı ve 'sonraki' doğru", async () => {
  const kayitlar = Array.from({ length: 7 }, (_, i) => ({ id: `PG${i}`, veri: { ...P, baslik: `Parça ${i}` } }));
  const kisiler = Array.from({ length: 5 }, (_, i) => ({ id: `KG${i}`, adSoyad: `Kişi ${String(i).padStart(2, "0")}`, telefon: `0532000000${i}` }));
  assert.deepEqual((await degisiklikUygula(prisma, DegisiklikSchema.parse({ kayitlar, kisiler }))).hatalar, []);
  const tam = await durumGetir(prisma) as any;

  const topla = async (parca: "kayit" | "kisi", anahtar: "kayitlar" | "kisiler", al: number) => {
    const hepsi: any[] = []; let atla: number | null = 0, sayfa = 0;
    while (atla != null) { const j: any = await durumParcasiGetir(prisma, parca, atla, al); assert.ok(j[anahtar].length <= al); hepsi.push(...j[anahtar]); atla = j.sonraki; sayfa++; }
    return { hepsi, sayfa };
  };
  const k = await topla("kayit", "kayitlar", 3), ki = await topla("kisi", "kisiler", 2);
  assert.equal(k.hepsi.length, tam.kayitlar.length);
  assert.deepEqual(k.hepsi.map((x) => x.id).sort(), tam.kayitlar.map((x: any) => x.id).sort());
  assert.equal(new Set(k.hepsi.map((x) => x.id)).size, k.hepsi.length, "sayfalar arasında tekrar yok");
  assert.equal(ki.hepsi.length, tam.kisiler.length);
  assert.equal(new Set(ki.hepsi.map((x) => x.id)).size, ki.hepsi.length);
  assert.ok(k.sayfa >= Math.ceil(tam.kayitlar.length / 3));
  const diger: any = await durumParcasiGetir(prisma, "diger");
  assert.ok(diger.ayarlar && diger.eslesmeNotlari && typeof diger.kisiZamani === "string");
  assert.equal(diger.kayitlar, undefined, "diğer parçada kayıt yok");
});

test("v3.41 ilgili=1: yalnızca talebe / portföye bağlı kişiler; diger yanıtında kisiToplam", async () => {
  await degisiklikUygula(prisma, DegisiklikSchema.parse({
    kisiler: [{ id: "IL1", adSoyad: "Bağlı Kişi", telefon: "05329990001" }, { id: "IL2", adSoyad: "Bağsız Kişi", telefon: "05329990002" }],
    kayitlar: [{ id: "ILK1", veri: { ...P, baslik: "Bağlı", kisiler: [{ kisiId: "IL1", rol: "SAHIP" }] } }],
  }));
  const j: any = await durumParcasiGetir(prisma, "kisi", 0, 1000, true);
  const idler = j.kisiler.map((k: any) => k.id);
  assert.ok(idler.includes("IL1")); assert.ok(!idler.includes("IL2"));
  const tum: any = await durumParcasiGetir(prisma, "kisi", 0, 1000, false);
  assert.ok(tum.kisiler.map((k: any) => k.id).includes("IL2"));
  const diger: any = await durumParcasiGetir(prisma, "diger");
  assert.ok(diger.kisiToplam >= 2);
});
