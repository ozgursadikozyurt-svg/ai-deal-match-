/**
 * Anahtar CRM v3.32 · 18 Ekim 2026
 * v3.26 — veritabanlı: açıklama sütunu yazılır/okunur; açık kayıt (yeni ofis + yönetici + 14 gün deneme); aynı e-posta ikinci kez açamaz;
 * yeni ofis diğer ofisin verisini görmez.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { SADECE_TEST_baglamiSabitle, VARSAYILAN_OFIS_ID, VARSAYILAN_KULLANICI_ID, istemciyiSarmala, kiracilikIcinde } from "../src/lib/kiracilik";
import { kendiOfisiniAc, DENEME_GUN } from "../src/lib/services/ofis";
import { oturumCoz } from "../src/canli/oturum";
SADECE_TEST_baglamiSabitle({ ofisId: VARSAYILAN_OFIS_ID, kullaniciId: VARSAYILAN_KULLANICI_ID, rol: "OFIS_YONETICISI", eposta: "test@anahtar.local" });

const prisma = istemciyiSarmala(new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL!, max: 1 }) }));
(globalThis as any).prisma = prisma;

test("açıklama sütunu", async () => {
  const k = await prisma.kayit.findFirstOrThrow({});
  await prisma.kayit.update({ where: { id: k.id }, data: { aciklama: "Köşe parsel, iki cephe" } });
  assert.equal((await prisma.kayit.findUniqueOrThrow({ where: { id: k.id } })).aciklama, "Köşe parsel, iki cephe");
});

test("açık kayıt: yeni ofis + yönetici + deneme; ikinci kez 409; oturum yeni ofise açılır ve başka ofisin kaydını görmez", async () => {
  const eposta = `yeni${Date.now()}@ornek.com`;
  const s = await kendiOfisiniAc(prisma as any, eposta, { ofisAd: "Lara Emlak", adSoyad: "Ayşe Yılmaz", telefon: "05321112233", onay: true });
  assert.ok(!("hata" in s));
  if ("hata" in s) return;
  assert.notEqual(s.kullanici.ofisId, VARSAYILAN_OFIS_ID); assert.equal(s.kullanici.rol, "OFIS_YONETICISI");
  const gun = Math.round((s.denemeBitis.getTime() - Date.now()) / 864e5); assert.equal(gun, DENEME_GUN);
  const tekrar = await kendiOfisiniAc(prisma as any, eposta.toUpperCase(), { ofisAd: "Başka", adSoyad: "Ayşe", onay: true });
  assert.ok("hata" in tekrar && tekrar.durum === 409);
  const o = await oturumCoz(prisma as any, eposta, {});
  assert.ok("baglam" in o);
  if (!("baglam" in o)) return;
  const sayi = await kiracilikIcinde(o.baglam, () => prisma.kayit.count());
  assert.equal(sayi, 0, "yeni ofis boş başlar; başka ofisin kayıtları görünmez");
});

test.after(() => prisma.$disconnect());
