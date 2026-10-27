/**
 * Anahtar CRM v3.44 · 27 Ekim 2026
 * v3.44 — veritabanlı: işlem detayında paylaşılan kişi (+ telefon), referans ve taraflar kaydedilir,
 * geri okunur, güncellemede tam kayıt olarak değişir; işlem silinince taraf bağları da gider.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { islemListesi, islemOlustur, islemGuncelle, islemSil } from "../src/lib/services/islem";
import { kimdenIsGeldi } from "../src/lib/domain/islem";
import { SADECE_TEST_baglamiSabitle, VARSAYILAN_OFIS_ID, VARSAYILAN_KULLANICI_ID, istemciyiSarmala, type Baglam } from "../src/lib/kiracilik";

const YONETICI: Baglam = { ofisId: VARSAYILAN_OFIS_ID, kullaniciId: VARSAYILAN_KULLANICI_ID, rol: "OFIS_YONETICISI", eposta: "test344@anahtar.local" };
SADECE_TEST_baglamiSabitle(YONETICI);
const prisma = istemciyiSarmala(new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL!, max: 1 }) }));

const kisiYap = (ad: string, tel: string) => prisma.kisi.create({ data: { adSoyad: ad, telefon: tel, roller: [], uzmanlikAileleri: [], whatsappGruplari: [] }, select: { id: true } });

test("migration: islem_kisi tablosu ve islem'in yeni alanları var", async () => {
  const t: any[] = await prisma.$queryRawUnsafe(`select relname from pg_class where relname='islem_kisi' and relrowsecurity`);
  assert.equal(t.length, 1, "islem_kisi tablosu RLS açık olmalı");
  const c: any[] = await prisma.$queryRawUnsafe(`select column_name from information_schema.columns where table_name='islem' and column_name in ('paylasilanKisiId','paylasilanAd','paylasilanTelefon','referansKisiId','referansAd')`);
  assert.equal(c.length, 5);
});

test("işlem: paylaşılan kişi, referans ve taraflar kaydedilir ve adlarıyla geri okunur", async () => {
  const danisman = await kisiYap("Erkan Ateş 344", "+905440000344");
  const alici = await kisiYap("Samet Aksu 344", "+905440000345");
  const { id } = await islemOlustur(prisma, {
    tarih: "2026-10-26", tahsilatTarihi: "2026-10-26", tur: "KIRALAMA", baslik: "Kiralama Depo 1350 M2 Yenigöl (test344)",
    bedel: 125000, paylasilan: 57500, ofisPayi: 0, banaKalan: 57500,
    aciklama: "Elden nakit alındı fatura kesilmedi. Ofisle paylaşılmadı", reklam: false,
    paylasilanKisiId: danisman.id, paylasilanTelefon: "+905440000344",
    referansAd: "Mustafa Bey ANTEPİA",
    taraflar: [{ kisiId: alici.id, rol: "ALICI_KIRACI" }, { kisiId: danisman.id, rol: "PAYLASILAN_DANISMAN" }],
  });
  const x = (await islemListesi(prisma)).find((i: any) => i.id === id)!;
  assert.equal(x.paylasilanAd, "Erkan Ateş 344", "rehberden seçilen kişinin adı çözülmeli");
  assert.equal(x.paylasilanTelefon, "+905440000344");
  assert.equal(x.referansAd, "Mustafa Bey ANTEPİA", "serbest yazılan referans adı durmalı");
  assert.equal(x.banaKalan, 57500);
  assert.equal(x.taraflar.length, 2);
  assert.ok(x.taraflar.some((t: any) => t.kisiId === alici.id && t.rol === "ALICI_KIRACI" && t.ad === "Samet Aksu 344"));

  // "Kimden iş geldi?": üç kişi çıkar (alıcı, danışman, serbest yazılan referans);
  // danışman hem paylaşılan hem taraf olduğu hâlde iş sayısı 1 kalır.
  const w = kimdenIsGeldi([x as any]);
  assert.equal(w.length, 3);
  const d = w.find((o) => o.kisiId === danisman.id)!;
  assert.equal(d.adet, 1);
  assert.equal(d.banaKalan, 57500);
  assert.deepEqual(d.roller, ["Paylaşılan danışman"], "aynı rol iki kez yazılmamalı");
  assert.ok(w.some((o) => o.kisiId === null && o.ad === "Mustafa Bey ANTEPİA"), "rehberde olmayan referans da listelenmeli");
});

test("işlem güncelleme: taraflar tam kayıt olarak değişir, kopya taraf yazılmaz", async () => {
  const k1 = await kisiYap("Taraf A 344", "+905440000346");
  const k2 = await kisiYap("Taraf B 344", "+905440000347");
  const temel = { tarih: "2026-09-01", tur: "SATIS" as const, baslik: "Güncelleme denemesi (test344)", banaKalan: 1000 };
  const { id } = await islemOlustur(prisma, { ...temel, taraflar: [{ kisiId: k1.id, rol: "ALICI_KIRACI" }] });

  await islemGuncelle(prisma, id, { ...temel, taraflar: [{ kisiId: k2.id, rol: "SATICI_KIRAYA_VEREN" }, { kisiId: k2.id, rol: "SATICI_KIRAYA_VEREN" }] });
  const x = (await islemListesi(prisma)).find((i: any) => i.id === id)!;
  assert.equal(x.taraflar.length, 1, "aynı kişi + rol iki kez yazılmamalı");
  assert.equal(x.taraflar[0].kisiId, k2.id);

  // taraflar boş gönderilince temizlenir
  await islemGuncelle(prisma, id, { ...temel, taraflar: [] });
  assert.equal((await islemListesi(prisma)).find((i: any) => i.id === id)!.taraflar.length, 0);

  await islemSil(prisma, id);
  const kalan: any[] = await prisma.$queryRawUnsafe(`select 1 from islem_kisi where "islemId"='${id}'`);
  assert.equal(kalan.length, 0, "işlem silinince taraf bağları da silinmeli");
});

test("rehberden seçilen kişi silinirse işlem durur, bağ boşalır", async () => {
  const k = await kisiYap("Silinecek Kişi 344", "+905440000348");
  const { id } = await islemOlustur(prisma, { tarih: "2026-08-01", tur: "DIGER", baslik: "Kişi silme denemesi (test344)", banaKalan: 500, referansKisiId: k.id });
  await prisma.kisi.delete({ where: { id: k.id } });
  const x = (await islemListesi(prisma)).find((i: any) => i.id === id)!;
  assert.ok(x, "kişi silinince işlem silinmemeli");
  assert.equal(x.referansKisiId, null);
  assert.equal(x.banaKalan, 500);
  await islemSil(prisma, id);
});
