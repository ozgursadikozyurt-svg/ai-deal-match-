/**
 * Anahtar CRM v3.23 · 10 Ekim 2026
 * v3.15 — veritabanlı: takasa açık, çoklu kat, özel roller sunucuya yazılır / geri okunur; eski enum rolleri korunur.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { degisiklikUygula, durumGetir, DegisiklikSchema } from "../src/lib/services/durum";
import { SADECE_TEST_baglamiSabitle, VARSAYILAN_OFIS_ID, VARSAYILAN_KULLANICI_ID, istemciyiSarmala } from "../src/lib/kiracilik";
// v3.20 — çok ofisli: testler varsayılan ofisin bağlamında çalışır (göçte açılan Özyurtlar Gayrimenkul)
SADECE_TEST_baglamiSabitle({ ofisId: VARSAYILAN_OFIS_ID, kullaniciId: VARSAYILAN_KULLANICI_ID, rol: "OFIS_YONETICISI", eposta: "test@anahtar.local" });


const prisma = istemciyiSarmala(new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL!, max: 1 }) }));
const lok = [{ ilId: 7, ilceId: null, mahalleId: null, altBolgeId: null, birincil: false }];

test("v3.15 migration: kisi.roller metin dizisi, mulk_ozellik.istenenKatlar ve kayit.takasaAcik kolonları var", async () => {
  const r: any[] = await prisma.$queryRawUnsafe(`select table_name, column_name, data_type, udt_name from information_schema.columns where (table_name='kisi' and column_name='roller') or (table_name='mulk_ozellik' and column_name='istenenKatlar') or (table_name='kayit' and column_name='takasaAcik')`);
  const o = Object.fromEntries(r.map((x) => [`${x.table_name}.${x.column_name}`, x.udt_name]));
  assert.equal(o["kisi.roller"], "_text"); assert.equal(o["mulk_ozellik.istenenKatlar"], "_text"); assert.equal(o["kayit.takasaAcik"], "bool");
});

test("durum köprüsü: takasaAcik + istenenKatlar + özel rol + rol tanımı yazılır ve geri okunur", async () => {
  const g = DegisiklikSchema.parse({
    ayarlar: { roller: [{ kod: "BANKA_PERSONELI", etiket: "Banka personeli" }] },
    kisiler: [{ id: "K315", adSoyad: "Test Kişi", roller: ["ALICI", "BANKA_PERSONELI"] }],
    kayitlar: [{ id: "T315", veri: { tip: "TALEP", mulkTipi: "DAIRE", islemTipi: "SATILIK", maxFiyat: 5_000_000, takasaAcik: true, lokasyonlar: lok, kisiler: [{ kisiId: "K315", rol: "MUSTERI" }], ozellik: { istenenKatlar: ["0", "3", "ARA"] } } }],
  });
  const s = await degisiklikUygula(prisma as any, g);
  assert.deepEqual(s.hatalar, []);
  const d: any = await durumGetir(prisma as any);
  const k = d.kayitlar.find((x: any) => x.id === "T315");
  assert.equal(k.veri.takasaAcik, true); assert.deepEqual(k.veri.ozellik.istenenKatlar, ["0", "3", "ARA"]);
  assert.deepEqual(d.kisiler.find((x: any) => x.id === "K315").roller, ["ALICI", "BANKA_PERSONELI"]);
  assert.deepEqual(d.ayarlar.roller, [{ kod: "BANKA_PERSONELI", etiket: "Banka personeli" }]);
});

test("toplu kişi silme: kişi silinir, kayıttaki bağ kalkar, kayıt durur", async () => {
  const s = await degisiklikUygula(prisma as any, DegisiklikSchema.parse({ kisiSil: ["K315"] }));
  assert.deepEqual(s.hatalar, []);
  assert.equal(await prisma.kisi.count({ where: { id: "K315" } }), 0);
  assert.equal(await prisma.kayitKisi.count({ where: { kayitId: "T315" } }), 0);
  assert.equal(await prisma.kayit.count({ where: { id: "T315" } }), 1);
  await prisma.kayit.deleteMany({ where: { id: "T315" } });
});

test("geçersiz rol kodu sunucuda reddedilir", () => {
  assert.throws(() => DegisiklikSchema.parse({ ayarlar: { roller: [{ kod: "küçük harf", etiket: "x" }] } }));
});
