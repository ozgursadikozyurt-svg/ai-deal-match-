/**
 * Anahtar CRM v3.20 · 7 Ekim 2026
 * v3.20 — VERİTABANLI KANIT: iki ofis aynı veritabanında yan yana durur ve birbirinin verisini
 * HİÇBİR yoldan göremez. Bu dosya ürünün satılabilirliğinin temel güvencesidir:
 * emlak ofisleri birbirinin rakibidir, bir ofisin portföyü ötekine sızarsa ürün biter.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { kiracilikIcinde, platformOlarak, VARSAYILAN_OFIS_ID, VARSAYILAN_KULLANICI_ID, KiracilikHatasi, SADECE_TEST_baglamiSabitle, istemciyiSarmala, type Baglam } from "../src/lib/kiracilik";
import { degisiklikUygula, durumGetir, DegisiklikSchema } from "../src/lib/services/durum";
import { davetUret, davetiKabulEt, ofisAc, kullaniciListesi, kullaniciGuncelle } from "../src/lib/services/ofis";
import { ayarYaz, ayarOku } from "../src/lib/services/ayar";

// Çıplak istemci: kiracılık süzgecinden GEÇMEZ. Yalnızca hazırlık ve doğrulama için.
// Tek bağlantı, iki görünüm: `ciplak` süzgeçten GEÇMEZ (hazırlık ve doğrulama için),
// `prisma` uygulamanın gerçek yolu — her sorguya ofis süzgeci eklenir.
const ciplak = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL!, max: 1 }) });
const prisma = istemciyiSarmala(ciplak);

const lok = [{ ilId: 7, ilceId: null, mahalleId: null, altBolgeId: null, birincil: false }];

const A: Baglam = { ofisId: VARSAYILAN_OFIS_ID, kullaniciId: VARSAYILAN_KULLANICI_ID, rol: "PLATFORM_YONETICISI", eposta: "ozgursadikozyurt@gmail.com" };
let B: Baglam;

test("hazırlık: göç varsayılan ofisi ve sahibini açmış; ikinci bir ofis eklenir", async () => {
  const o = await ciplak.ofis.findUnique({ where: { id: VARSAYILAN_OFIS_ID } });
  assert.ok(o, "Özyurtlar Gayrimenkul göçte açılmış olmalı");
  assert.equal(o.ad, "Özyurtlar Gayrimenkul");
  assert.equal(o.sinirsiz, true, "kendi ofisiniz plan sınırlarına takılmaz");

  const sahip = await ciplak.kullanici.findUnique({ where: { eposta: "ozgursadikozyurt@gmail.com" } });
  assert.ok(sahip);
  assert.equal(sahip.rol, "PLATFORM_YONETICISI");
  assert.equal(sahip.ofisId, VARSAYILAN_OFIS_ID);

  // İkinci ofis: platform yöneticisi açar
  const yeni = await kiracilikIcinde(A, () => ofisAc(prisma, { ad: "Deneme Emlak", sehir: "Antalya" }));
  const b1 = await ciplak.kullanici.create({ data: { ofisId: yeni.id, eposta: "b@deneme.com", rol: "OFIS_YONETICISI" } });
  B = { ofisId: yeni.id, kullaniciId: b1.id, rol: "OFIS_YONETICISI", eposta: "b@deneme.com" };
  assert.equal(yeni.slug, "deneme-emlak");
  assert.equal(yeni.plan, "UCRETSIZ");
});

test("iki ofis AYNI telefonu, AYNI ilanı ve aynı parmak izini ayrı ayrı tutabilir", async () => {
  const telefon = "+905551112233";
  const kayit = (id: string) => ({
    id,
    veri: { tip: "PORTFOY" as const, mulkTipi: "DEPO_ANTREPO" as const, islemTipi: "SATILIK" as const, fiyat: 5_000_000, lokasyonlar: lok },
  });

  for (const [b, k, kisiId] of [[A, "P-A-320", "K-A-320"], [B, "P-B-320", "K-B-320"]] as const) {
    const g = DegisiklikSchema.parse({
      kisiler: [{ id: kisiId, adSoyad: "Aynı Müşteri", telefon, roller: ["ALICI"] }],
      kayitlar: [kayit(k)],
    });
    const s = await kiracilikIcinde(b as Baglam, () => degisiklikUygula(prisma, g));
    assert.deepEqual(s.hatalar, [], `${k} yazılamadı`);
  }

  const kisiler = await ciplak.kisi.findMany({ where: { telefon } });
  assert.equal(kisiler.length, 2, "aynı telefon iki ofiste ayrı kişi olarak durur");
  assert.notEqual(kisiler[0].ofisId, kisiler[1].ofisId);
});

test("SIZINTI YOK: her ofis yalnızca kendi talep, portföy, kişi ve eşleşmelerini görür", async () => {
  const aListe = await kiracilikIcinde(A, () => prisma.kayit.findMany({ select: { id: true, ofisId: true } }));
  const bListe = await kiracilikIcinde(B, () => prisma.kayit.findMany({ select: { id: true, ofisId: true } }));

  assert.ok(aListe.every((k) => k.ofisId === A.ofisId), "A listesinde başka ofisin kaydı var");
  assert.ok(bListe.every((k) => k.ofisId === B.ofisId), "B listesinde başka ofisin kaydı var");
  assert.ok(aListe.some((k) => k.id === "P-A-320"));
  assert.equal(aListe.some((k) => k.id === "P-B-320"), false, "A, B'nin portföyünü görüyor");
  assert.deepEqual(bListe.map((k) => k.id), ["P-B-320"], "yeni ofis yalnızca kendi kaydını görür");

  for (const model of ["kisi", "match", "portalIlan", "kayitNot", "ayar"] as const) {
    const satirlar = (await kiracilikIcinde(B, () => (prisma[model] as { findMany: (a?: unknown) => Promise<{ ofisId: string }[]> }).findMany())) ?? [];
    assert.ok(satirlar.every((s) => s.ofisId === B.ofisId), `${model}: başka ofisin satırı görünüyor`);
  }
});

test("SIZINTI YOK: kimliği bilinen bir kayıt bile başka ofisten okunamaz", async () => {
  assert.equal(await kiracilikIcinde(B, () => prisma.kayit.findUnique({ where: { id: "P-A-320" } })), null);
  assert.equal(await kiracilikIcinde(B, () => prisma.kayit.findFirst({ where: { id: "P-A-320" } })), null);
  assert.equal(await kiracilikIcinde(B, () => prisma.kayit.count({ where: { id: "P-A-320" } })), 0);
  await assert.rejects(() => kiracilikIcinde(B, () => prisma.kayit.findUniqueOrThrow({ where: { id: "P-A-320" } })));
});

test("SIZINTI YOK: başka ofisin kaydı değiştirilemez ve silinemez", async () => {
  const r = await kiracilikIcinde(B, () => prisma.kayit.updateMany({ where: { id: "P-A-320" }, data: { durum: "ARSIV" } }));
  assert.equal(r.count, 0, "başka ofisin kaydı güncellendi");
  const s = await kiracilikIcinde(B, () => prisma.kayit.deleteMany({ where: { id: "P-A-320" } }));
  assert.equal(s.count, 0, "başka ofisin kaydı silindi");
  assert.equal((await ciplak.kayit.findUnique({ where: { id: "P-A-320" } }))?.durum, "ACTIVE", "A'nın kaydı bozulmuş");
});

test("SIZINTI YOK: durumGetir (uygulamanın tüm veriyi okuduğu yer) ofisle sınırlıdır", async () => {
  const a = await kiracilikIcinde(A, () => durumGetir(prisma));
  const b = await kiracilikIcinde(B, () => durumGetir(prisma));
  const idA = a.kayitlar.map((k: { id: string }) => k.id);
  const idB = b.kayitlar.map((k: { id: string }) => k.id);
  assert.ok(idA.includes("P-A-320"));
  assert.equal(idA.includes("P-B-320"), false);
  assert.deepEqual(idB, ["P-B-320"]);
  assert.equal(b.kisiler.length, 1, "yeni ofis yalnızca kendi kişisini görür");
});

test("ayarlar ofis başına ayrıdır: bir ofisin TTL'i diğerini etkilemez", async () => {
  await kiracilikIcinde(A, () => ayarYaz(prisma, "ttl", { PORTFOY_SATILIK: 90, PORTFOY_KIRALIK: 45, TALEP_SATILIK: 60, TALEP_KIRALIK: 30, TALEP_ACIL: 30, DIS_ILAN: 90 }));
  await kiracilikIcinde(B, () => ayarYaz(prisma, "ttl", { PORTFOY_SATILIK: 15, PORTFOY_KIRALIK: 15, TALEP_SATILIK: 15, TALEP_KIRALIK: 15, TALEP_ACIL: 7, DIS_ILAN: 15 }));
  assert.equal((await kiracilikIcinde(A, () => ayarOku(prisma, "ttl")) as { PORTFOY_SATILIK: number }).PORTFOY_SATILIK, 90);
  assert.equal((await kiracilikIcinde(B, () => ayarOku(prisma, "ttl")) as { PORTFOY_SATILIK: number }).PORTFOY_SATILIK, 15);
});

test("GÜVENLİ VARSAYILAN: bağlam kurulmadan ofise ait tabloya erişilemez", async () => {
  SADECE_TEST_baglamiSabitle(undefined);
  try {
    await assert.rejects(async () => { await prisma.kayit.findMany(); }, KiracilikHatasi);
    await assert.rejects(async () => { await prisma.kisi.count(); }, KiracilikHatasi);
    // genel başvuru verisi bağlam gerektirmez
    assert.ok((await prisma.il.count()) > 0);
  } finally {
    SADECE_TEST_baglamiSabitle({ ofisId: VARSAYILAN_OFIS_ID, kullaniciId: VARSAYILAN_KULLANICI_ID, rol: "OFIS_YONETICISI", eposta: "test@anahtar.local" });
  }
});

test("işlem (transaction) içinde de süzgeç uygulanır", async () => {
  const bulunan = await kiracilikIcinde(B, () =>
    prisma.$transaction(async (tx) => tx.kayit.findMany({ where: { id: "P-A-320" } })),
  );
  assert.deepEqual(bulunan, [], "işlem içindeki sorgu süzgeci atladı");
});

test("danışman meslektaşının özel kaydını görmez, ofis ortak portföyü görür", async () => {
  const d = await ciplak.kullanici.create({ data: { ofisId: B.ofisId, eposta: "danisman@deneme.com", rol: "DANISMAN" } });
  const D: Baglam = { ofisId: B.ofisId, kullaniciId: d.id, rol: "DANISMAN", eposta: d.eposta };

  // B yöneticisinin özel talebi + ofis ortak portföyü
  await ciplak.kayit.createMany({
    data: [
      { id: "T-B-OZEL", ofisId: B.ofisId, sahipKullaniciId: B.kullaniciId, gorunurluk: "OZEL", tip: "TALEP", anaKategori: "ISYERI", mulkTipi: "DEPO_ANTREPO", islemTipi: "SATILIK", validUntil: new Date(Date.now() + 864e5), fingerprint: "fp-b-ozel" },
      { id: "P-B-ORTAK", ofisId: B.ofisId, sahipKullaniciId: B.kullaniciId, gorunurluk: "OFIS", tip: "PORTFOY", anaKategori: "ISYERI", mulkTipi: "DEPO_ANTREPO", islemTipi: "SATILIK", validUntil: new Date(Date.now() + 864e5), fingerprint: "fp-b-ortak" },
    ],
  });

  const gorunen = (await kiracilikIcinde(D, () => prisma.kayit.findMany({ select: { id: true } }))).map((k) => k.id);
  assert.ok(gorunen.includes("P-B-ORTAK"), "danışman ofis portföyünü görmeli");
  assert.equal(gorunen.includes("T-B-OZEL"), false, "danışman meslektaşının özel talebini görüyor");

  // yönetici ikisini de görür
  const yonetici = (await kiracilikIcinde(B, () => prisma.kayit.findMany({ select: { id: true } }))).map((k) => k.id);
  assert.ok(yonetici.includes("T-B-OZEL") && yonetici.includes("P-B-ORTAK"));
});

test("danışman kendi girdiği özel kaydı görür", async () => {
  const d = await ciplak.kullanici.findFirstOrThrow({ where: { eposta: "danisman@deneme.com" } });
  const D: Baglam = { ofisId: B.ofisId, kullaniciId: d.id, rol: "DANISMAN", eposta: d.eposta };
  await ciplak.kayit.create({
    data: { id: "T-D-KENDI", ofisId: B.ofisId, sahipKullaniciId: d.id, gorunurluk: "OZEL", tip: "TALEP", anaKategori: "ISYERI", mulkTipi: "DEPO_ANTREPO", islemTipi: "KIRALIK", validUntil: new Date(Date.now() + 864e5), fingerprint: "fp-d-kendi" },
  });
  const gorunen = (await kiracilikIcinde(D, () => prisma.kayit.findMany({ select: { id: true } }))).map((k) => k.id);
  assert.ok(gorunen.includes("T-D-KENDI"));
});

// ───────────────────────── Davet akışı ─────────────────────────

test("davet üretilir, kabul edilir ve kullanıcı o ofiste açılır", async () => {
  const d = await kiracilikIcinde(A, () => davetUret(prisma, { eposta: "yeni@ofis.com", rol: "DANISMAN" }));
  assert.match(d.kod, /^[a-z2-9]{24}$/);
  // veritabanında düz kod yok
  const satir = await ciplak.davet.findUniqueOrThrow({ where: { id: d.id } });
  assert.notEqual(satir.kodOzeti, d.kod);
  assert.equal(satir.durum, "BEKLIYOR");

  const s = await davetiKabulEt(prisma, d.kod, "yeni@ofis.com");
  if (!("kullanici" in s)) return assert.fail(`davet kabul edilemedi: ${s.hata}`);
  assert.equal(s.kullanici.ofisId, VARSAYILAN_OFIS_ID);
  assert.equal(s.kullanici.rol, "DANISMAN");
  assert.equal((await ciplak.davet.findUniqueOrThrow({ where: { id: d.id } })).durum, "KULLANILDI");
});

test("aynı davet ikinci kez kullanılamaz, başka e-postaya geçmez, süresi dolmuş davet geçmez", async () => {
  const d = await kiracilikIcinde(A, () => davetUret(prisma, { eposta: "tek@ofis.com" }));
  assert.ok("hata" in (await davetiKabulEt(prisma, d.kod, "baskasi@ofis.com")), "davet başka e-postayla kabul edildi");
  assert.ok("kullanici" in (await davetiKabulEt(prisma, d.kod, "tek@ofis.com")));
  const ikinci = await davetiKabulEt(prisma, d.kod, "tek@ofis.com");
  assert.ok("hata" in ikinci && ikinci.durum === 409);

  const eski = await kiracilikIcinde(A, () => davetUret(prisma, { eposta: "gec@ofis.com" }));
  await ciplak.davet.update({ where: { id: eski.id }, data: { sonKullanma: new Date(Date.now() - 864e5) } });
  const gec = await davetiKabulEt(prisma, eski.kod, "gec@ofis.com");
  assert.ok("hata" in gec && gec.durum === 410);

  assert.ok("hata" in (await davetiKabulEt(prisma, "uydurma-kod-12345678", "x@y.com")));
});

test("ücretsiz planda ikinci kullanıcı davetle de eklenemez (plan sınırı)", async () => {
  // B ofisi ücretsiz planda ve zaten 2 kullanıcısı var (yönetici + danışman)
  const d = await kiracilikIcinde(B, () => davetUret(prisma, { eposta: "ucuncu@deneme.com" }));
  const s = await davetiKabulEt(prisma, d.kod, "ucuncu@deneme.com");
  assert.ok("hata" in s && s.durum === 402, "plan sınırı uygulanmadı");
  assert.match((s as { hata: string }).hata, /Pro/);
});

test("danışman davet üretemez, kullanıcı listesini göremez", async () => {
  const d = await ciplak.kullanici.findFirstOrThrow({ where: { eposta: "danisman@deneme.com" } });
  const D: Baglam = { ofisId: B.ofisId, kullaniciId: d.id, rol: "DANISMAN", eposta: d.eposta };
  await assert.rejects(() => kiracilikIcinde(D, () => davetUret(prisma, {})), /yetkiniz yok/);
  await assert.rejects(() => kiracilikIcinde(D, () => kullaniciListesi(prisma)), /yetkiniz yok/);
});

test("ofis yöneticisi başka ofisin kullanıcısını göremez ve güncelleyemez", async () => {
  const liste = await kiracilikIcinde(B, () => kullaniciListesi(prisma));
  assert.ok(liste.every((k) => k.eposta.endsWith("@deneme.com")), "başka ofisin kullanıcısı listelendi");

  await assert.rejects(
    () => kiracilikIcinde(B, () => kullaniciGuncelle(prisma, VARSAYILAN_KULLANICI_ID, { aktif: false })),
    "başka ofisin kullanıcısı kapatıldı",
  );
  assert.equal((await ciplak.kullanici.findUniqueOrThrow({ where: { id: VARSAYILAN_KULLANICI_ID } })).aktif, true);
});

test("ofis yöneticisi kendi hesabını kapatamaz, platform rolü dağıtamaz", async () => {
  await assert.rejects(() => kiracilikIcinde(B, () => kullaniciGuncelle(prisma, B.kullaniciId, { aktif: false })));
  const d = await ciplak.kullanici.findFirstOrThrow({ where: { eposta: "danisman@deneme.com" } });
  await assert.rejects(() => kiracilikIcinde(B, () => kullaniciGuncelle(prisma, d.id, { rol: "PLATFORM_YONETICISI" })), /yetkiniz yok/);
});

test("ofis silinince ofisin tüm verisi gider, diğer ofis etkilenmez", async () => {
  const gecici = await kiracilikIcinde(A, () => ofisAc(prisma, { ad: "Silinecek Emlak" }));
  await ciplak.kayit.create({
    data: { id: "P-SIL", ofisId: gecici.id, tip: "PORTFOY", anaKategori: "ISYERI", mulkTipi: "DEPO_ANTREPO", islemTipi: "SATILIK", validUntil: new Date(Date.now() + 864e5), fingerprint: "fp-sil" },
  });
  const oncekiA = await ciplak.kayit.count({ where: { ofisId: VARSAYILAN_OFIS_ID } });

  await platformOlarak(() => prisma.ofis.delete({ where: { id: gecici.id } }));

  assert.equal(await ciplak.kayit.count({ where: { id: "P-SIL" } }), 0, "ofisin kaydı silinmedi");
  assert.equal(await ciplak.kayit.count({ where: { ofisId: VARSAYILAN_OFIS_ID } }), oncekiA, "diğer ofis etkilendi");
});

test("süzgeci atlayan bir yazma veritabanında durur (ofisId boş kalamaz)", async () => {
  await assert.rejects(
    () => ciplak.kayit.create({
      data: { id: "P-OFISSIZ", tip: "PORTFOY", anaKategori: "ISYERI", mulkTipi: "DEPO_ANTREPO", islemTipi: "SATILIK", validUntil: new Date(Date.now() + 864e5), fingerprint: "fp-ofissiz" },
    }),
    "ofisId'si olmayan kayıt yazıldı — yabancı anahtar koruması çalışmıyor",
  );
});
