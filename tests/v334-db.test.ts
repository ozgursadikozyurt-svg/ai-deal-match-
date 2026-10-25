/**
 * Anahtar CRM v3.43 · 25 Ekim 2026
 * v3.34 — veritabanlı: kampanya ekleme, aylık harcama, kayıt sayısı ve maliyet, asistanın yalnızca adları görmesi, başka ofisten yalıtım.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { degisiklikUygula, DegisiklikSchema } from "../src/lib/services/durum";
import { kampanyaListesi, kampanyaOlustur, kampanyaGuncelle, harcamaYaz } from "../src/lib/services/kampanya";
import { SADECE_TEST_baglamiSabitle, VARSAYILAN_OFIS_ID, VARSAYILAN_KULLANICI_ID, istemciyiSarmala, type Baglam } from "../src/lib/kiracilik";

const YONETICI: Baglam = { ofisId: VARSAYILAN_OFIS_ID, kullaniciId: VARSAYILAN_KULLANICI_ID, rol: "OFIS_YONETICISI", eposta: "test@anahtar.local" };
const ASISTAN: Baglam = { ...YONETICI, kullaniciId: "kull_asistan_334", rol: "ASISTAN", eposta: "asistan334@anahtar.local", yardimEdilenId: VARSAYILAN_KULLANICI_ID };
SADECE_TEST_baglamiSabitle(YONETICI);

const prisma = istemciyiSarmala(new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL!, max: 1 }) }));
const AD = "Meta – Test Kampanya v334";

test("migration: kampanya ve kampanya_harcama tabloları var, RLS açık", async () => {
  const r: any[] = await prisma.$queryRawUnsafe(`select c.relname, c.relrowsecurity from pg_class c where c.relname in ('kampanya','kampanya_harcama') order by 1`);
  assert.equal(r.length, 2); assert.ok(r.every((x) => x.relrowsecurity === true));
});

test("yönetici kampanya açar; aynı ad ikinci kez açılamaz; kayıt sayısı ve kayıt başı maliyet hesaplanır", async () => {
  const { id } = await kampanyaOlustur(prisma as any, { kanal: "META_REKLAM", ad: AD, butce: 30000 });
  await assert.rejects(() => kampanyaOlustur(prisma as any, { kanal: "META_REKLAM", ad: AD }), /zaten var/);
  const s = await degisiklikUygula(prisma as any, DegisiklikSchema.parse({ kayitlar: ["T334a", "T334b"].map((k) => ({ id: k, veri: { tip: "TALEP", mulkTipi: "DEPO_ANTREPO", islemTipi: "KIRALIK", maxFiyat: 100_000, fiyatPeriyodu: "AYLIK", ilkKaynak: "META_REKLAM", ilkKaynakDetay: AD } })) }));
  assert.deepEqual(s.hatalar, []);
  await harcamaYaz(prisma as any, id, { ay: "2026-10", tutar: 3000 });
  await harcamaYaz(prisma as any, id, { ay: "2026-10", tutar: 4000 }); // aynı ay: üzerine yazar
  await harcamaYaz(prisma as any, id, { ay: "2026-09", tutar: 2000 });
  const k: any = (await kampanyaListesi(prisma as any) as any[]).find((x) => x.ad === AD);
  assert.equal(k.kayitSayisi, 2); assert.equal(k.toplamHarcama, 6000); assert.equal(k.kayitBasinaMaliyet, 3000); assert.equal(k.butce, 30000);
  assert.deepEqual(k.harcamalar.map((h: any) => h.ay), ["2026-10", "2026-09"]);
  await harcamaYaz(prisma as any, id, { ay: "2026-09", tutar: null }); // sil
  assert.equal(((await kampanyaListesi(prisma as any) as any[]).find((x) => x.ad === AD)).harcamalar.length, 1);
});

test("kapatılan kampanya yöneticiye görünür, asistana görünmez; asistan bütçe / harcama görmez ve yazamaz", async () => {
  const id = ((await kampanyaListesi(prisma as any)) as any[]).find((x) => x.ad === AD).id;
  SADECE_TEST_baglamiSabitle(ASISTAN);
  try {
    const l: any[] = (await kampanyaListesi(prisma as any)) as any[];
    const k = l.find((x) => x.ad === AD);
    assert.ok(k, "açık kampanya adı asistana görünür");
    assert.deepEqual(Object.keys(k).sort(), ["ad", "id", "kanal"], "bütçe ve harcama yok");
    await assert.rejects(() => kampanyaOlustur(prisma as any, { kanal: "REKLAM", ad: "Asistan kampanyası" }), /yetki/i);
    await assert.rejects(() => harcamaYaz(prisma as any, id, { ay: "2026-10", tutar: 1 }), /yetki/i);
    await assert.rejects(() => kampanyaGuncelle(prisma as any, id, { aktif: false }), /yetki/i);
  } finally { SADECE_TEST_baglamiSabitle(YONETICI); }
  await kampanyaGuncelle(prisma as any, id, { aktif: false });
  assert.ok((((await kampanyaListesi(prisma as any)) as any[]).find((x) => x.ad === AD)).aktif === false, "yönetici kapalıyı da görür");
  SADECE_TEST_baglamiSabitle(ASISTAN);
  try { assert.ok(!((await kampanyaListesi(prisma as any)) as any[]).some((x) => x.ad === AD), "kapalı kampanya asistana görünmez"); }
  finally { SADECE_TEST_baglamiSabitle(YONETICI); }
});

test("başka ofis kampanyayı göremez", async () => {
  await prisma.$executeRawUnsafe(`insert into ofis (id, ad, slug, "updatedAt") values ('ofis_334','Başka Ofis 334','baska-334', now()) on conflict do nothing`);
  SADECE_TEST_baglamiSabitle({ ...YONETICI, ofisId: "ofis_334" });
  try { assert.equal(((await kampanyaListesi(prisma as any)) as any[]).filter((x) => x.ad === AD).length, 0); }
  finally { SADECE_TEST_baglamiSabitle(YONETICI); }
});

test("temizlik", async () => {
  await prisma.kayit.deleteMany({ where: { id: { in: ["T334a", "T334b"] } } });
  await prisma.kampanya.deleteMany({ where: { ad: AD } });
  await prisma.$executeRawUnsafe(`delete from ofis where id='ofis_334'`);
});
