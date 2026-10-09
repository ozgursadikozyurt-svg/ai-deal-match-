/**
 * Anahtar CRM v3.22 · 9 Ekim 2026
 * v3.22 — veritabanlı: talepteki hariç bölge, kayda elle konan Benim / Ofisim işareti ve "Benim ve ofisim" ayarı
 * sunucuya yazılır, geri okunur; "Otomatik"e dönülünce işaret veritabanından da kalkar; API konum araması hariçleri saymaz.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { degisiklikUygula, durumGetir, DegisiklikSchema } from "../src/lib/services/durum";
import { listeWhere } from "../src/lib/services/kayit";
import { SADECE_TEST_baglamiSabitle, VARSAYILAN_OFIS_ID, VARSAYILAN_KULLANICI_ID, istemciyiSarmala } from "../src/lib/kiracilik";
SADECE_TEST_baglamiSabitle({ ofisId: VARSAYILAN_OFIS_ID, kullaniciId: VARSAYILAN_KULLANICI_ID, rol: "OFIS_YONETICISI", eposta: "test@anahtar.local" });

const prisma = istemciyiSarmala(new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL!, max: 1 }) }));

test("v3.22 migration: kayit.isaret ve kayit_lokasyon.haric sütunları var (varsayılan: boş / false)", async () => {
  const r: any[] = await prisma.$queryRawUnsafe(`select table_name, column_name, udt_name, column_default from information_schema.columns where (table_name='kayit' and column_name='isaret') or (table_name='kayit_lokasyon' and column_name='haric')`);
  const o = Object.fromEntries(r.map((x) => [`${x.table_name}.${x.column_name}`, x]));
  assert.equal(o["kayit.isaret"]?.udt_name, "text"); assert.equal(o["kayit_lokasyon.haric"]?.udt_name, "bool"); assert.match(String(o["kayit_lokasyon.haric"]?.column_default), /false/);
});

test("durum köprüsü: hariç satırı + işaret + Benim ve ofisim ayarı yazılır ve geri okunur; Otomatik işareti siler", async () => {
  const konyaalti = await prisma.ilce.findFirst({ where: { ad: "Konyaaltı" }, select: { id: true, ilId: true } });
  const hurma = await prisma.mahalle.findFirst({ where: { ad: "Hurma", ilceId: konyaalti!.id }, select: { id: true } });
  assert.ok(konyaalti && hurma, "tohum verisinde Konyaaltı / Hurma var");
  const veri = { tip: "TALEP", mulkTipi: "DAIRE", islemTipi: "SATILIK", maxFiyat: 8_000_000, isaret: "BENIM", lokasyonlar: [{ ilId: konyaalti!.ilId, ilceId: konyaalti!.id }, { ilId: konyaalti!.ilId, ilceId: konyaalti!.id, mahalleId: hurma!.id, haric: true }] };
  const s = await degisiklikUygula(prisma as any, DegisiklikSchema.parse({ ayarlar: { sahiplik: { benimTelefonlar: ["+905309365427"], ofisAdlar: ["Özyurtlar Gayrimenkul"] } }, kayitlar: [{ id: "T322", veri }] }));
  assert.deepEqual(s.hatalar, []);
  let d: any = await durumGetir(prisma as any);
  let k = d.kayitlar.find((x: any) => x.id === "T322");
  assert.equal(k.veri.isaret, "BENIM");
  assert.deepEqual(k.veri.lokasyonlar.map((l: any) => !!l.haric), [false, true]); assert.ok(!("haric" in k.veri.lokasyonlar[0]), "hariç olmayan satırda alan yok");
  assert.deepEqual(d.ayarlar.sahiplik.benimTelefonlar, ["+905309365427"]); assert.deepEqual(d.ayarlar.sahiplik.ofisAdlar, ["Özyurtlar Gayrimenkul"]);
  // API araması: "Hurma" diye arayınca bu talep (Hurma'yı hariç tutan) gelmemeli; "Konyaaltı" diye arayınca gelmeli
  const ara = async (f: object) => (await prisma.kayit.findMany({ where: listeWhere({ tip: "TALEP", ...f } as any), select: { id: true } })).map((x) => x.id);
  assert.ok(!(await ara({ mahalleId: [hurma!.id] })).includes("T322"), "hariç bölge aranan bölge sayılmaz");
  assert.ok((await ara({ ilceId: [konyaalti!.id] })).includes("T322"));
  // Otomatik'e dön: veri'de işaret yok → veritabanında da null
  const { isaret: _i, ...otomatik } = veri;
  assert.deepEqual((await degisiklikUygula(prisma as any, DegisiklikSchema.parse({ kayitlar: [{ id: "T322", veri: otomatik }] }))).hatalar, []);
  assert.equal((await prisma.kayit.findUnique({ where: { id: "T322" }, select: { isaret: true } }))!.isaret, null);
  await prisma.kayit.deleteMany({ where: { id: "T322" } });
});
