/**
 * Anahtar CRM v3.32 · 18 Ekim 2026
 * v3.32 — veritabanlı: asistan rolü (görünürlük, silme / ayar / dışa aktarma kapısı, açtığı kaydın sahibi) ve
 * değiştirilemez ilk kaynak (sunucu zamanı, kilit, yönetici düzeltmesi audit_log'a), ilk yanıt damgası.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { degisiklikUygula, durumGetir, DegisiklikSchema } from "../src/lib/services/durum";
import { SADECE_TEST_baglamiSabitle, VARSAYILAN_OFIS_ID, VARSAYILAN_KULLANICI_ID, istemciyiSarmala, type Baglam } from "../src/lib/kiracilik";

const YONETICI: Baglam = { ofisId: VARSAYILAN_OFIS_ID, kullaniciId: VARSAYILAN_KULLANICI_ID, rol: "OFIS_YONETICISI", eposta: "test@anahtar.local" };
const ASISTAN: Baglam = { ofisId: VARSAYILAN_OFIS_ID, kullaniciId: "kull_asistan_332", rol: "ASISTAN", eposta: "asistan332@anahtar.local", yardimEdilenId: VARSAYILAN_KULLANICI_ID };
SADECE_TEST_baglamiSabitle(YONETICI);

const prisma = istemciyiSarmala(new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL!, max: 1 }) }));
const uygula = (g: unknown) => degisiklikUygula(prisma as any, DegisiklikSchema.parse(g));
const talep = (ek: object = {}) => ({ tip: "TALEP", mulkTipi: "DEPO_ANTREPO", islemTipi: "KIRALIK", maxFiyat: 150_000, fiyatPeriyodu: "AYLIK", minM2: 1000, ...ek });

test("v3.32 migration: ASISTAN rolü, yardimEdilenId ve ilk kaynak sütunları var", async () => {
  const r: any[] = await prisma.$queryRawUnsafe(`select table_name, column_name from information_schema.columns where (table_name='kayit' and column_name in ('ilkKaynak','ilkKaynakDetay','ilkKaynakTarihi','ilkYanit')) or (table_name='kullanici' and column_name='yardimEdilenId')`);
  assert.equal(r.length, 5);
  const e: any[] = await prisma.$queryRawUnsafe(`select unnest(enum_range(NULL::"Rol"))::text as v`);
  assert.ok(e.some((x) => x.v === "ASISTAN"));
});

test("ilk kaynak: sunucu zamanı yazar, istemci zamanı yok sayılır; yönetici düzeltmesi audit_log'a düşer", async () => {
  const s = await uygula({ kayitlar: [{ id: "T332a", veri: talep({ ilkKaynak: "META_REKLAM", ilkKaynakDetay: "Meta – Depo Ekim", ilkKaynakTarihi: "2001-01-01T00:00:00Z", ilkYanit: "2001-01-01T00:00:00Z" }) }] });
  assert.deepEqual(s.hatalar, []);
  let k = (await prisma.kayit.findUnique({ where: { id: "T332a" }, select: { ilkKaynak: true, ilkKaynakDetay: true, ilkKaynakTarihi: true, ilkYanit: true, sahipKullaniciId: true } }))!;
  assert.equal(k.ilkKaynak, "META_REKLAM"); assert.equal(k.ilkKaynakDetay, "Meta – Depo Ekim");
  assert.ok(k.ilkKaynakTarihi!.getFullYear() >= 2026, "istemcinin 2001 tarihi yazılmadı"); assert.equal(k.ilkYanit, null, "temas notu yokken ilk yanıt boş");
  assert.equal(k.sahipKullaniciId, VARSAYILAN_KULLANICI_ID, "yeni kayıt açanın");
  const yeniden = await uygula({ kayitlar: [{ id: "T332a", veri: talep({ ilkKaynak: "GOOGLE_REKLAM", ilkKaynakDetay: "Meta – Depo Ekim" }) }] });
  assert.deepEqual(yeniden.hatalar, []); assert.deepEqual(yeniden.uyarilar, []);
  k = (await prisma.kayit.findUnique({ where: { id: "T332a" }, select: { ilkKaynak: true, ilkKaynakDetay: true, ilkKaynakTarihi: true, ilkYanit: true, sahipKullaniciId: true } }))!;
  assert.equal(k.ilkKaynak, "GOOGLE_REKLAM");
  const log = await prisma.auditLog.findMany({ where: { kayitId: "T332a", alan: "ilkKaynak" } });
  assert.equal(log.length, 1); assert.equal(log[0].eskiDeger, "META_REKLAM"); assert.equal(log[0].yeniDeger, "GOOGLE_REKLAM");
  // Okuma köprüsü: arayüz alanları görür
  const d: any = await durumGetir(prisma as any);
  const v = d.kayitlar.find((x: any) => x.id === "T332a").veri;
  assert.equal(v.ilkKaynak, "GOOGLE_REKLAM"); assert.ok(v.ilkKaynakTarihi);
});

test("asistan: yardım ettiği kişinin özel kişilerini görür, başkasınınkini görmez; açtığı kişi ve kayıt yardım ettiğine ait", async () => {
  await prisma.kullanici.upsert({ where: { id: ASISTAN.kullaniciId }, update: {}, create: { id: ASISTAN.kullaniciId, eposta: ASISTAN.eposta, rol: "ASISTAN", yardimEdilenId: VARSAYILAN_KULLANICI_ID } });
  await prisma.kullanici.upsert({ where: { id: "kull_baska_332" }, update: {}, create: { id: "kull_baska_332", eposta: "baska332@anahtar.local", rol: "DANISMAN" } });
  await prisma.kisi.createMany({ data: [
    { id: "K332oz", adSoyad: "Özgür'ün müşterisi", telefon: "+905550332001", gorunurluk: "OZEL", sahipKullaniciId: VARSAYILAN_KULLANICI_ID },
    { id: "K332bs", adSoyad: "Başka danışmanın müşterisi", telefon: "+905550332002", gorunurluk: "OZEL", sahipKullaniciId: "kull_baska_332" },
  ] });
  SADECE_TEST_baglamiSabitle(ASISTAN);
  try {
    const gorulen = (await prisma.kisi.findMany({ where: { id: { in: ["K332oz", "K332bs"] } }, select: { id: true } })).map((x) => x.id);
    assert.deepEqual(gorulen, ["K332oz"]);
    const s = await uygula({ kisiler: [{ id: "K332yeni", adSoyad: "Asistanın eklediği", telefon: "+905550332003" }], kayitlar: [{ id: "T332b", veri: talep({ ilkKaynak: "FSBO_ARAMA" }) }] });
    assert.deepEqual(s.hatalar, []);
  } finally { SADECE_TEST_baglamiSabitle(YONETICI); }
  assert.equal((await prisma.kisi.findUnique({ where: { id: "K332yeni" }, select: { sahipKullaniciId: true } }))!.sahipKullaniciId, VARSAYILAN_KULLANICI_ID);
  assert.equal((await prisma.kayit.findUnique({ where: { id: "T332b" }, select: { sahipKullaniciId: true } }))!.sahipKullaniciId, VARSAYILAN_KULLANICI_ID);
});

test("asistan: ilk kaynağı değiştiremez (uyarı, kayıt yine kaydedilir), silemez, ofis ayarını değiştiremez; temas notu ilk yanıtı yazar", async () => {
  SADECE_TEST_baglamiSabitle(ASISTAN);
  try {
    const s = await uygula({
      kayitlar: [{ id: "T332a", veri: talep({ ilkKaynak: "REFERANS", maxFiyat: 160_000 }), notlar: [{ id: "n332", tarih: "2001-01-01T10:00:00Z", tur: "ARAMA", metin: "Arandı, depo 1.000 m² istiyor" }] }],
      kayitSil: ["T332b"],
      ayarlar: { ttl: { ...{ PORTFOY_SATILIK: 90, PORTFOY_KIRALIK: 45, TALEP_SATILIK: 60, TALEP_ACIL: 30, DIS_ILAN: 90 }, TALEP_KIRALIK: 5 } },
    });
    assert.ok(s.uyarilar.some((u: any) => u.id === "T332a" && /kilitli/i.test(u.mesaj)));
    assert.ok(s.uyarilar.some((u: any) => u.id === "ayarlar"));
    assert.ok(s.hatalar.some((h: any) => h.id === "T332b" && /yetki/i.test(h.mesaj)));
  } finally { SADECE_TEST_baglamiSabitle(YONETICI); }
  const k = (await prisma.kayit.findUnique({ where: { id: "T332a" }, select: { ilkKaynak: true, maxFiyat: true, ilkYanit: true } }))!;
  assert.equal(k.ilkKaynak, "GOOGLE_REKLAM", "kilit korundu"); assert.equal(Number(k.maxFiyat), 160_000, "kaydın geri kalanı kaydedildi");
  assert.ok(k.ilkYanit && k.ilkYanit.getFullYear() >= 2026, "ilk yanıt notun (geriye tarihli) değil sunucunun zamanı");
  assert.ok(await prisma.kayit.findUnique({ where: { id: "T332b" }, select: { id: true } }), "asistan silemedi");
  const ttl = await prisma.ayar.findFirst({ where: { anahtar: "ttl" } });
  assert.notEqual((ttl?.deger as any)?.TALEP_KIRALIK, 5, "ayar yazılmadı");
});

test("asistan: dışa aktarma 403", async () => {
  const { GET } = await import("../src/app/api/disa-aktar/route");
  SADECE_TEST_baglamiSabitle(ASISTAN);
  try { assert.equal((await GET(new Request("http://x/api/disa-aktar?tablo=kisiler"))).status, 403); }
  finally { SADECE_TEST_baglamiSabitle(YONETICI); }
  assert.equal((await GET(new Request("http://x/api/disa-aktar?tablo=kisiler"))).status, 200, "yönetici indirebilir");
});

test("temizlik", async () => {
  await prisma.kayit.deleteMany({ where: { id: { in: ["T332a", "T332b"] } } });
  await prisma.kisi.deleteMany({ where: { id: { in: ["K332oz", "K332bs", "K332yeni"] } } });
  await prisma.kullanici.deleteMany({ where: { id: { in: [ASISTAN.kullaniciId, "kull_baska_332"] } } });
});
