/**
 * Anahtar CRM v3.42 · 23 Ekim 2026
 * v3.35 — veritabanlı: yetki belgesi alanları kaydedilir ve geri okunur; randevu (asistan açar, sonuç girer); işlem (yalnızca yönetici), tekrar aktarımda aynı Polaris satırı tekilleşir.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { degisiklikUygula, durumGetir, DegisiklikSchema } from "../src/lib/services/durum";
import { islemListesi, islemOlustur, islemGuncelle, islemSil } from "../src/lib/services/islem";
import { randevuListesi, randevuOlustur, randevuGuncelle } from "../src/lib/services/randevu";
import { polarisDonustur, aylikBanaKalan } from "../src/lib/domain/islem";
import { SADECE_TEST_baglamiSabitle, VARSAYILAN_OFIS_ID, VARSAYILAN_KULLANICI_ID, istemciyiSarmala, type Baglam } from "../src/lib/kiracilik";

const YONETICI: Baglam = { ofisId: VARSAYILAN_OFIS_ID, kullaniciId: VARSAYILAN_KULLANICI_ID, rol: "OFIS_YONETICISI", eposta: "test@anahtar.local" };
const ASISTAN: Baglam = { ...YONETICI, kullaniciId: "kull_asistan_335", rol: "ASISTAN", eposta: "asistan335@anahtar.local", yardimEdilenId: VARSAYILAN_KULLANICI_ID };
SADECE_TEST_baglamiSabitle(YONETICI);
const prisma = istemciyiSarmala(new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL!, max: 1 }) }));

test("migration: randevu ve islem tabloları, kayit.yetkiBelgeNo / tasinmazNo", async () => {
  const r: any[] = await prisma.$queryRawUnsafe(`select relname from pg_class where relname in ('randevu','islem') and relrowsecurity`);
  assert.equal(r.length, 2);
  const c: any[] = await prisma.$queryRawUnsafe(`select column_name from information_schema.columns where table_name='kayit' and column_name in ('yetkiBelgeNo','tasinmazNo')`);
  assert.equal(c.length, 2);
});

test("portföy: yetki belge no ve taşınmaz ID kaydedilir, arayüze geri gelir", async () => {
  const s = await degisiklikUygula(prisma as any, DegisiklikSchema.parse({ kayitlar: [{ id: "P335", veri: { tip: "PORTFOY", mulkTipi: "DEPO_ANTREPO", islemTipi: "KIRALIK", fiyat: 120000, fiyatPeriyodu: "AYLIK", yetkili: true, yetkiBitis: "2027-01-31", yetkiBelgeNo: "2026/145", tasinmazNo: "987654" } }, { id: "T335", veri: { tip: "TALEP", mulkTipi: "DEPO_ANTREPO", islemTipi: "KIRALIK", maxFiyat: 150000, fiyatPeriyodu: "AYLIK" } }] }));
  assert.deepEqual(s.hatalar, []);
  const v = ((await durumGetir(prisma as any)) as any).kayitlar.find((x: any) => x.id === "P335").veri;
  assert.equal(v.yetkiBelgeNo, "2026/145"); assert.equal(v.tasinmazNo, "987654"); assert.equal(v.yetkili, true);
});

test("randevu: asistan açar (yapan = asistan), sonucunu girer; talep / portföysüz randevu reddedilir", async () => {
  SADECE_TEST_baglamiSabitle(ASISTAN);
  try {
    const r = await randevuOlustur(prisma as any, { tarih: "2026-10-21T08:00:00Z", tur: "GOSTERIM", talepId: "T335", portfoyId: "P335" });
    assert.equal(r.sahipKullaniciId, ASISTAN.kullaniciId); assert.equal(r.sonuc, "PLANLANDI");
    await randevuGuncelle(prisma as any, r.id, { sonuc: "GERCEKLESTI" });
    await assert.rejects(() => randevuOlustur(prisma as any, { tarih: "2026-10-21T08:00:00Z" }), /talebe ya da portföye/);
    const l = await randevuListesi(prisma as any, "P335");
    assert.equal(l.length, 1); assert.equal(l[0].sonuc, "GERCEKLESTI");
    assert.equal((await randevuListesi(prisma as any, "T335")).length, 1, "talep tarafından da görünür");
  } finally { SADECE_TEST_baglamiSabitle(YONETICI); }
});

test("işlem: yalnızca yönetici; ekle, düzelt, sil; asistan göremez", async () => {
  const { id } = await islemOlustur(prisma as any, { tarih: "2026-10-03", tahsilatTarihi: "2026-11-02", tur: "KIRALAMA", baslik: "Test depo kiralama 335", bedel: 120000, ofisPayi: 24000, banaKalan: 96000, talepId: "T335", portfoyId: "P335" });
  let x: any = (await islemListesi(prisma as any)).find((i: any) => i.id === id);
  assert.equal(x.tarih, "2026-10-03"); assert.equal(x.tahsilatTarihi, "2026-11-02"); assert.equal(x.banaKalan, 96000);
  assert.equal(aylikBanaKalan([x], 2026).aylar[10], 96000, "tahsilat ayı Kasım");
  await islemGuncelle(prisma as any, id, { tarih: "2026-10-03", tahsilatTarihi: null, baslik: "Test depo kiralama 335", banaKalan: 96000 });
  x = (await islemListesi(prisma as any)).find((i: any) => i.id === id);
  assert.equal(x.tahsilatTarihi, null, "bekleyen");
  SADECE_TEST_baglamiSabitle(ASISTAN);
  try {
    await assert.rejects(() => islemListesi(prisma as any), /yetki/i);
    await assert.rejects(() => islemOlustur(prisma as any, { tarih: "2026-10-03", baslik: "Asistan işlemi" }), /yetki/i);
  } finally { SADECE_TEST_baglamiSabitle(YONETICI); }
  await islemSil(prisma as any, id);
  assert.ok(!(await islemListesi(prisma as any)).some((i: any) => i.id === id));
});

test("Polaris aktarımı tekildir: aynı (disKaynak, disKimlik) ikinci kez eklenemez", async () => {
  const p = polarisDonustur({ tarih: "2026-01-15", liste: "Altıntaş 1+1 daire satış", banaKalan: 75000, fiyat: 4250000 }, "e02-test335")!;
  await prisma.islem.create({ data: { ...p, tarih: new Date(p.tarih), tahsilatTarihi: new Date(p.tahsilatTarihi) } as any });
  await assert.rejects(() => prisma.islem.create({ data: { ...p, tarih: new Date(p.tarih), tahsilatTarihi: new Date(p.tahsilatTarihi) } as any }));
  await prisma.islem.deleteMany({ where: { disKimlik: "e02-test335" } });
});

test("temizlik", async () => {
  await prisma.randevu.deleteMany({ where: { OR: [{ talepId: "T335" }, { portfoyId: "P335" }] } });
  await prisma.kayit.deleteMany({ where: { id: { in: ["P335", "T335"] } } });
});
