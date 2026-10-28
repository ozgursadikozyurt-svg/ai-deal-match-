/**
 * Anahtar CRM v3.46 · 28 Ekim 2026
 * v3.46 — GÜVENLİK: "upsert" yolu da ofis süzgecinden geçer.
 * Eskiden kiracılık katmanı upsert'in yalnızca `create` kısmına ofisId yazıyor, `where` kısmına dokunmuyordu.
 * Kimliği bilinen BAŞKA ofisin kişisi (kisi.upsert) ya da eşleşme notu (match.upsert) bu yoldan değiştirilebiliyordu.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { kiracilikIcinde, platformOlarak, VARSAYILAN_OFIS_ID, VARSAYILAN_KULLANICI_ID, istemciyiSarmala, type Baglam } from "../src/lib/kiracilik";
import { degisiklikUygula, DegisiklikSchema } from "../src/lib/services/durum";
import { ofisAc } from "../src/lib/services/ofis";
import { ayarYaz, ayarOku } from "../src/lib/services/ayar";
import { aiHakkiDus, fotoPlanDenetle, entegrasyonPlanDenetle, PlanHatasi, trGunu, AI_SAYAC } from "../src/lib/services/plan";
import { aiAdresiIzinli, aiJsonIste, AiHatasi } from "../src/lib/ai/saglayici";
import { AI_VARSAYILAN } from "../src/lib/domain/ayarlar";
import { PUT as ayarlarPUT } from "../src/app/api/ayarlar/route";
import { POST as aiDenePOST } from "../src/app/api/ai/dene/route";
import { POST as ogrenmePOST } from "../src/app/api/lokasyon/ogrenme/route";

const ciplak = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL!, max: 1 }) });
const prisma = istemciyiSarmala(ciplak);
const lok = [{ ilId: 7, ilceId: null, mahalleId: null, altBolgeId: null, birincil: false }];

const A: Baglam = { ofisId: VARSAYILAN_OFIS_ID, kullaniciId: VARSAYILAN_KULLANICI_ID, rol: "PLATFORM_YONETICISI", eposta: "ozgursadikozyurt@gmail.com" };
let B: Baglam;

test("hazırlık: A ofisinde bir kişi, talep, portföy ve eşleşme notu; ayrı bir B ofisi", async () => {
  const yeni = await kiracilikIcinde(A, () => ofisAc(prisma, { ad: "Upsert Deneme Emlak", sehir: "Antalya" }));
  const u = await ciplak.kullanici.create({ data: { ofisId: yeni.id, eposta: "upsert@deneme.com", rol: "OFIS_YONETICISI" } });
  B = { ofisId: yeni.id, kullaniciId: u.id, rol: "OFIS_YONETICISI", eposta: "upsert@deneme.com" };
  const g = DegisiklikSchema.parse({
    kisiler: [{ id: "K-A-346", adSoyad: "Gizli Müşteri", telefon: "+905559998877", roller: ["ALICI"] }],
    kayitlar: [
      { id: "T-A-346", veri: { tip: "TALEP", mulkTipi: "DEPO_ANTREPO", islemTipi: "SATILIK", butceMax: 9_000_000, lokasyonlar: lok } },
      { id: "P-A-346", veri: { tip: "PORTFOY", mulkTipi: "DEPO_ANTREPO", islemTipi: "SATILIK", fiyat: 8_000_000, lokasyonlar: lok } },
    ],
    eslesmeNotlari: { "T-A-346~P-A-346": { durum: "GORUSULDU", not: "A'nın gizli notu" } },
  });
  const s = await kiracilikIcinde(A, () => degisiklikUygula(prisma, g));
  assert.deepEqual(s.hatalar, []);
});

test("SIZINTI YOK: başka ofisin kişisi, kimliği bilinse bile kişi kaydetme yoluyla değiştirilemez", async () => {
  const g = DegisiklikSchema.parse({ kisiler: [{ id: "K-A-346", adSoyad: "Ele geçirildi", telefon: "+905550000000", roller: ["ALICI"] }] });
  await kiracilikIcinde(B, () => degisiklikUygula(prisma, g)); // reddedilir ya da sessizce boşa düşer — ölçüt: A'nın verisi değişmez
  const k = await ciplak.kisi.findUnique({ where: { id: "K-A-346" } });
  assert.equal(k?.adSoyad, "Gizli Müşteri", "A'nın kişisi değişmemeli");
  assert.equal(k?.ofisId, A.ofisId);
});

test("SIZINTI YOK: başka ofisin eşleşme notu değiştirilemez (Eşleşmeler kaydetme yolu)", async () => {
  const g = DegisiklikSchema.parse({ eslesmeNotlari: { "T-A-346~P-A-346": { durum: "REDDEDILDI", not: "B yazdı" } } });
  await kiracilikIcinde(B, () => degisiklikUygula(prisma, g));
  const m = await ciplak.match.findUnique({ where: { talepId_portfoyId: { talepId: "T-A-346", portfoyId: "P-A-346" } } });
  assert.equal(m?.operasyonNotu, "A'nın gizli notu");
  assert.equal(m?.ofisId, A.ofisId);
  assert.equal(m?.durum, "GORUSULDU");
  assert.equal(await ciplak.match.count({ where: { talepId: "T-A-346", portfoyId: "P-A-346" } }), 1, "B adına kopya eşleşme açılmamalı");
});

test("kendi ofisinde upsert eskisi gibi çalışır (kişi güncelleme, eşleşme notu, ayar)", async () => {
  const g = DegisiklikSchema.parse({
    kisiler: [{ id: "K-A-346", adSoyad: "Gizli Müşteri (düzeltildi)", telefon: "+905559998877", roller: ["ALICI"] }],
    eslesmeNotlari: { "T-A-346~P-A-346": { durum: "GORUSULDU", not: "güncel not" } },
  });
  const s = await kiracilikIcinde(A, () => degisiklikUygula(prisma, g));
  assert.deepEqual(s.hatalar, []);
  assert.equal((await ciplak.kisi.findUnique({ where: { id: "K-A-346" } }))?.adSoyad, "Gizli Müşteri (düzeltildi)");
  assert.equal((await ciplak.match.findUnique({ where: { talepId_portfoyId: { talepId: "T-A-346", portfoyId: "P-A-346" } } }))?.operasyonNotu, "güncel not");
  await kiracilikIcinde(B, () => ayarYaz(prisma, "deneme346", { x: 1 }));
  await kiracilikIcinde(B, () => ayarYaz(prisma, "deneme346", { x: 2 }));
  assert.deepEqual(await kiracilikIcinde(B, () => ayarOku(prisma, "deneme346")), { x: 2 });
});

test("GÜVENLİK: yapay zekâ anahtarı yalnızca bilinen sağlayıcı adreslerine gider", async () => {
  for (const u of ["https://generativelanguage.googleapis.com/v1beta/openai", "https://api.groq.com/openai/v1", "https://api.openai.com/v1", "https://openrouter.ai/api/v1"]) assert.ok(aiAdresiIzinli(u, ""), u);
  for (const u of ["https://kotu.example.com/v1", "http://api.openai.com/v1", "https://api.openai.com.kotu.com/v1", "https://x:y@api.openai.com/v1", "javascript:alert(1)", ""]) assert.equal(aiAdresiIzinli(u, ""), false, u);
  assert.ok(aiAdresiIzinli("https://api.together.xyz/v1", "api.together.xyz"), "AI_IZINLI_ALANLAR ile ek alan açılır");
  let giden = "";
  await assert.rejects(aiJsonIste({ ...AI_VARSAYILAN, saglayici: "OZEL", tabanUrl: "https://kotu.example.com/v1" }, "GIZLI-ANAHTAR", "x", { getir: async (u) => { giden = u; return { ok: true, status: 200, text: async () => "{}" }; } }), (e: unknown) => e instanceof AiHatasi && e.kod === "AYAR_EKSIK");
  assert.equal(giden, "", "izinsiz adrese hiçbir istek gitmemeli (anahtar sızmaz)");
});

test("GÜVENLİK: danışman /api/ayarlar ile ofis ayarını değiştiremez; /api/ai/dene ile adres denemesi yapamaz", async () => {
  const D: Baglam = { ...B, rol: "DANISMAN", kullaniciId: "kull-danisman-346" };
  const r = await kiracilikIcinde(D, () => ayarlarPUT(new Request("http://x/api/ayarlar", { method: "PUT", body: JSON.stringify({ yilHedefi: 1 }) })));
  assert.equal(r.status, 403);
  const r2 = await kiracilikIcinde(D, () => aiDenePOST(new Request("http://x/api/ai/dene", { method: "POST", body: JSON.stringify({ ai: { saglayici: "OZEL", tabanUrl: "https://kotu.example.com/v1", model: "m" } }) })));
  assert.equal(r2.status, 403);
});

test("GÜVENLİK: ortak konum sözlüğüne (tüm ofisler) yalnızca platform yöneticisi yazar", async () => {
  const r = await kiracilikIcinde(B, () => ogrenmePOST(new Request("http://x/api/lokasyon/ogrenme", { method: "POST", body: JSON.stringify({ ifade: "kotu-takma-ad", ilId: 7, hedef: { ilceId: 1 } }) })));
  assert.equal(r.status, 403);
  assert.equal(await ciplak.lokasyonAlias.count({ where: { alias: "kotu-takma-ad" } }), 0);
});

test("PLAN: ücretsiz ofiste günlük yapay zekâ hakkı sayılır ve dolunca durur; ertesi gün yenilenir", async () => {
  await ciplak.ofis.update({ where: { id: B.ofisId }, data: { plan: "UCRETSIZ", denemeBitis: null, sinirsiz: false } });
  const bugun = new Date("2026-10-28T10:00:00Z");
  for (let i = 1; i <= 25; i++) assert.equal((await kiracilikIcinde(B, () => aiHakkiDus(prisma, bugun))).kullanilan, i);
  await assert.rejects(kiracilikIcinde(B, () => aiHakkiDus(prisma, bugun)), (e: unknown) => e instanceof PlanHatasi && e.durum === 402);
  assert.deepEqual(await kiracilikIcinde(B, () => ayarOku(prisma, AI_SAYAC)), { gun: trGunu(bugun), sayi: 25 });
  const yarin = new Date("2026-10-28T21:30:00Z"); // TR saatiyle 29 Ekim 00:30
  assert.equal((await kiracilikIcinde(B, () => aiHakkiDus(prisma, yarin))).kullanilan, 1);
});

test("PLAN: ücretsiz ofiste fotoğraf ve Google eşitlemesi kapalı; deneme süresinde (Pro) açık; sınırsız ofis takılmaz", async () => {
  await assert.rejects(kiracilikIcinde(B, () => fotoPlanDenetle(prisma, 0)), PlanHatasi);
  await assert.rejects(kiracilikIcinde(B, () => entegrasyonPlanDenetle(prisma)), PlanHatasi);
  await ciplak.ofis.update({ where: { id: B.ofisId }, data: { denemeBitis: new Date(Date.now() + 86_400_000) } });
  await kiracilikIcinde(B, () => fotoPlanDenetle(prisma, 7)); // Pro: 8 (adet sınırını fotoDenetle 422 ile söyler)
  await kiracilikIcinde(B, () => entegrasyonPlanDenetle(prisma));
  await kiracilikIcinde(A, () => fotoPlanDenetle(prisma, 3));
  await kiracilikIcinde(A, () => entegrasyonPlanDenetle(prisma));
  assert.ok((await kiracilikIcinde(A, () => aiHakkiDus(prisma))).sinir >= 100_000);
});

test("temizlik", async () => {
  await platformOlarak(async () => {
    await ciplak.match.deleteMany({ where: { talepId: "T-A-346" } });
    await ciplak.kayit.deleteMany({ where: { id: { in: ["T-A-346", "P-A-346"] } } });
    await ciplak.kisi.deleteMany({ where: { id: "K-A-346" } });
    await ciplak.ayar.deleteMany({ where: { ofisId: A.ofisId, anahtar: AI_SAYAC } });
    await ciplak.ofis.delete({ where: { id: B.ofisId } });
  });
  await ciplak.$disconnect();
});
