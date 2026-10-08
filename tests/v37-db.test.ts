/**
 * Anahtar CRM v3.13 · 3 Ekim 2026
 * v3.7 — veritabanlı: dosyadan toplu ekleme (kişi adla/telefonla tekilleşir, aynı ilan ikinci kez eklenmez),
 * dosya önizlemesinde "zaten var" işareti, görüşme notu + kişinin son iletişim tarihi.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { dosyaOnizle, topluEkle, TopluEkleSchema, notEkle, notlar, NotSchema } from "../src/lib/services/toplu";
import { SADECE_TEST_baglamiSabitle, VARSAYILAN_OFIS_ID, VARSAYILAN_KULLANICI_ID, istemciyiSarmala } from "../src/lib/kiracilik";
// v3.20 — çok ofisli: testler varsayılan ofisin bağlamında çalışır (göçte açılan Özyurtlar Gayrimenkul)
SADECE_TEST_baglamiSabitle({ ofisId: VARSAYILAN_OFIS_ID, kullaniciId: VARSAYILAN_KULLANICI_ID, rol: "OFIS_YONETICISI", eposta: "test@anahtar.local" });


const prisma = istemciyiSarmala(new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL!, max: 1 }) }));
const dosya = new Uint8Array(fs.readFileSync("tests/fixtures/v37_ornek.xlsx"));

test("dosya: önizle → ekle → tekrar önizlemede 'zaten var', ikinci eklemede kopya yok", async () => {
  const o = await dosyaOnizle(prisma, "v37_ornek.xlsx", dosya, { sayfalar: ["Portal"] });
  assert.equal(o.dosyaTuru, "PORTAL");
  const eklenecek = o.satirlar.filter((s) => s.veri && s.durum !== "TEKRAR");
  assert.equal(eklenecek.length, 3);
  const r = await topluEkle(prisma, TopluEkleSchema.parse({ satirlar: eklenecek.map((s) => ({ veri: s.veri, kisi: s.kisi })) }));
  assert.equal(r.eklenen, 3, JSON.stringify(r.hata));
  assert.equal(r.yeniKisi, 2, "iki ofis danışmanı; bireysel sahip kişi olmaz");
  const o2 = await dosyaOnizle(prisma, "v37_ornek.xlsx", dosya, { sayfalar: ["Portal"] });
  assert.equal(o2.satirlar.filter((s) => s.durum === "TEKRAR").length, 3);
  const r2 = await topluEkle(prisma, TopluEkleSchema.parse({ satirlar: eklenecek.map((s) => ({ veri: s.veri, kisi: s.kisi })) }));
  assert.equal(r2.eklenen, 0); assert.equal(r2.tekrar, 3);
  const dukkan = await prisma.kayit.findFirst({ where: { portalIlanNo: "1342746857" } });
  assert.equal(dukkan?.havuz, "DIS_ILAN"); assert.equal(dukkan?.ilanSahibiTipi, "MALIK");
});

test("talep tablosu: aynı müşterinin satırları tek kişiye bağlanır", async () => {
  const o = await dosyaOnizle(prisma, "v37_ornek.xlsx", dosya, { sayfalar: ["1.HAFTA", "3. HAFTA"] });
  assert.equal(o.dosyaTuru, "TALEP_LISTESI");
  const r = await topluEkle(prisma, TopluEkleSchema.parse({ satirlar: o.satirlar.filter((s) => s.veri).map((s) => ({ veri: s.veri, kisi: s.kisi })) }));
  assert.equal(r.eklenen, 4, JSON.stringify(r.hata));
  const ali = await prisma.kisi.findMany({ where: { adSoyad: "Ali Vural" }, include: { kayitBaglari: true } });
  assert.equal(ali.length, 1); assert.equal(ali[0].kayitBaglari.length, 2);
});

test("görüşme notu: eklenir, sıralı gelir, kişinin son iletişimi güncellenir", async () => {
  const k = await prisma.kayit.findFirstOrThrow({ where: { tip: "TALEP", kisiBaglari: { some: {} } }, include: { kisiBaglari: true } });
  const kisiId = k.kisiBaglari[0].kisiId;
  await notEkle(prisma, k.id, NotSchema.parse({ tur: "NOT", metin: "İlk not" }));
  await notEkle(prisma, k.id, NotSchema.parse({ tur: "GORUSME", metin: "Bütçeyi 9 milyona çıkarabilir", kisiId }));
  const l = await notlar(prisma, k.id);
  assert.equal(l.length, 2); assert.equal(l[0].tur, "GORUSME"); assert.equal(l[0].kisi?.id, kisiId);
  assert.ok((await prisma.kisi.findUniqueOrThrow({ where: { id: kisiId } })).sonIletisim);
});

test.after(() => prisma.$disconnect());