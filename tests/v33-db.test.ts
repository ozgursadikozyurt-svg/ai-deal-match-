/**
 * Anahtar CRM v3.21.1 · 8 Ekim 2026
 * v3.3 — veritabanlı testler: yeni migration (ayar, konut kolonları, kaynak bilgisi, referans alias), süre uzatma.
 * scripts/test-db.sh içinden çalışır (PGlite).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { KayitCreateSchema } from "../src/lib/validation/kayit";
import { kayitOlustur, sureUzat, ttlAyarlari } from "../src/lib/services/kayit";
import { lokasyonCozumle, lokasyonIndeksiYukle } from "../src/lib/lokasyon/cozumle";
import { SADECE_TEST_baglamiSabitle, VARSAYILAN_OFIS_ID, VARSAYILAN_KULLANICI_ID, istemciyiSarmala } from "../src/lib/kiracilik";
// v3.20 — çok ofisli: testler varsayılan ofisin bağlamında çalışır (göçte açılan Özyurtlar Gayrimenkul)
SADECE_TEST_baglamiSabitle({ ofisId: VARSAYILAN_OFIS_ID, kullaniciId: VARSAYILAN_KULLANICI_ID, rol: "OFIS_YONETICISI", eposta: "test@anahtar.local" });


const prisma = istemciyiSarmala(new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL!, max: 1 }) }));

test("migration: varsayılan TTL ayarı yüklü (v3.4 biçimi)", async () => {
  assert.deepEqual(await ttlAyarlari(prisma), { PORTFOY_SATILIK: 90, PORTFOY_KIRALIK: 45, TALEP_SATILIK: 60, TALEP_KIRALIK: 30, TALEP_ACIL: 30, DIS_ILAN: 90 }); // v3.4 migration eski biçimi çevirdi; v3.7: DIS_ILAN yoksa 90 gün eklenir
});

test("konut kaydı + kaynak bilgisi kaydedilir; süre uzatma çalışır", async () => {
  const ix = await lokasyonIndeksiYukle(prisma, 7);
  const lok = lokasyonCozumle("Konyaaltı Hurma", ix).lokasyonlar.map((l, i) => ({ ilId: 7, ilceId: l.ilceId, mahalleId: l.mahalleId, altBolgeId: l.altBolgeId, birincil: i === 0 }));
  const k = KayitCreateSchema.parse({
    tip: "PORTFOY", mulkTipi: "DAIRE", islemTipi: "SATILIK", fiyat: 7900000, m2: 145, netM2: 125, odaSayisi: "3+1", krediyeUygun: true, lokasyonlar: lok,
    veriKanali: "WHATSAPP", kayitGrubu: "EMLAK BORSASI", mesajTarihi: "2026-09-28T09:14:00+03:00", kaynakDosya: "WhatsApp Sohbeti - EMLAK BORSASI.txt",
    hamMetin: "Hurma 3+1 havuzlu site, kombili, güney cephe, krediye uygun (v33 test)",
    ozellik: { banyoSayisi: 2, isinmaTipi: "DOGALGAZ_KOMBI", siteIcinde: true, havuz: true, cepheYonleri: ["GUNEY"], esyaDurumu: "ESYASIZ" },
  });
  const r = await kayitOlustur(prisma, k);
  assert.equal(r.ozellik?.isinmaTipi, "DOGALGAZ_KOMBI");
  assert.deepEqual(r.ozellik?.cepheYonleri, ["GUNEY"]);
  assert.equal(r.kayitGrubu, "EMLAK BORSASI");
  assert.equal(r.mesajTarihi?.toISOString(), "2026-09-28T06:14:00.000Z");
  const once = r.validUntil.getTime();
  const u = await sureUzat(prisma, r.id, 30);
  assert.equal(Math.round((u.validUntil.getTime() - once) / 86_400_000), 30);
});

test("referans nokta alias'ı veritabanından çözülür (Cender Otel → Gençlik)", async () => {
  const ix = await lokasyonIndeksiYukle(prisma, 7, 0);
  assert.match(lokasyonCozumle("Cender otel arkası", ix).lokasyonlar[0].etiket, /Gençlik/);
});

test("v3.4: kişi telefonla tekil; kayıt birden fazla kişiye bağlanır; işlenmiş mesaj tekrar gönderilmez", async () => {
  const { kisiOlusturVeyaBul, kayitKisiBagla, kisiKarti } = await import("../src/lib/services/kisi");
  const { islenmisKaydet, oncedenIslenmisler } = await import("../src/lib/services/ingest");
  const a = await kisiOlusturVeyaBul(prisma, { adSoyad: "Test Malik", telefon: "0532 111 22 33", roller: ["SATICI"] });
  const b = await kisiOlusturVeyaBul(prisma, { adSoyad: "Test Malik (tekrar)", telefon: "+90 532 111 2233", roller: ["YATIRIMCI"] });
  assert.equal(a.id, b.id);
  assert.deepEqual([...b.roller].sort(), ["SATICI", "YATIRIMCI"]);
  const e = await kisiOlusturVeyaBul(prisma, { adSoyad: "Test Emlakçı", telefon: "05441112233", roller: ["EMLAKCI"] });
  const k = await kayitOlustur(prisma, KayitCreateSchema.parse({ tip: "PORTFOY", mulkTipi: "DEPO_ANTREPO", islemTipi: "KIRALIK", hamMetin: "v34 kişi testi", kisiler: [{ kisiId: a.id, rol: "SAHIP" }] }));
  await kayitKisiBagla(prisma, k.id, { kisiId: e.id, rol: "EMLAKCI" });
  const kart = await kisiKarti(prisma, e.id);
  assert.equal(kart.kayitBaglari[0].kayit.id, k.id);
  assert.equal((await prisma.kayit.findUnique({ where: { id: k.id } }))!.kisiId, a.id);
  await islenmisKaydet(prisma, [{ metin: "Kepez 500 m2 depo kiralık", grup: "G", tarih: null }], "ing-1");
  assert.equal((await oncedenIslenmisler(prisma, ["Kepez 500 m2 depo kiralık", "başka"])).size, 1);
});

test("v3.5: yetkili portföy ve yetki bitiş tarihi kaydedilir", async () => {
  const k = await kayitOlustur(prisma, KayitCreateSchema.parse({ tip: "PORTFOY", mulkTipi: "DEPO_ANTREPO", islemTipi: "KIRALIK", hamMetin: "v35 yetkili", yetkili: true, yetkiBitis: "2026-12-31" }));
  const r = await prisma.kayit.findUnique({ where: { id: k.id } });
  assert.equal(r!.yetkili, true);
  assert.equal(r!.yetkiBitis!.toISOString().slice(0, 10), "2026-12-31");
});