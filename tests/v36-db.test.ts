/**
 * Anahtar CRM v3.21.1 · 8 Ekim 2026
 * v3.6 — veritabanlı uçtan uca senkron testleri (PGlite + sahte Google/Notion API'si):
 * ilk içe aktarma, tekrar çalıştırmada kopya oluşmaması, artımlı değişiklik, çakışma kaydı ve çözümü,
 * Notion'a geri yazım (yalnız uygulama alanları), Google'da silinen kişinin korunması, kilit.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { googleSenkronCalistir, notionSenkronCalistir, cakismaCoz, entegrasyon } from "../src/lib/services/senkron";
import { sifrele } from "../src/lib/guvenlik/sifre";
import { NOTION_TABLOLARI, GERI_YAZIM_ALANLARI } from "../src/lib/notion/yapilandirma";
import { NOTION_TUR1, NOTION_TUR2, GOOGLE_TUR1, GOOGLE_TUR2, GOOGLE_GRUPLAR, NP, NT, NK } from "../demo/ornek-entegrasyon";
import { SADECE_TEST_baglamiSabitle, VARSAYILAN_OFIS_ID, VARSAYILAN_KULLANICI_ID, istemciyiSarmala } from "../src/lib/kiracilik";
// v3.20 — çok ofisli: testler varsayılan ofisin bağlamında çalışır (göçte açılan Özyurtlar Gayrimenkul)
SADECE_TEST_baglamiSabitle({ ofisId: VARSAYILAN_OFIS_ID, kullaniciId: VARSAYILAN_KULLANICI_ID, rol: "OFIS_YONETICISI", eposta: "test@anahtar.local" });


const prisma = istemciyiSarmala(new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL!, max: 1 }) }));
process.env.ENTEGRASYON_SIFRE_ANAHTARI = Buffer.alloc(32, 3).toString("base64");
process.env.GOOGLE_CLIENT_ID = "test"; process.env.GOOGLE_CLIENT_SECRET = "test";
const J = (v: unknown, status = 200) => new Response(JSON.stringify(v), { status });

// ───────── Sahte Notion ─────────
function sahteNotion(tur: { current: 1 | 2 }) {
  const yazilan: { sayfa: string; props: Record<string, unknown> }[] = [];
  const eklenenAlan: string[] = [];
  const ds = Object.fromEntries(Object.entries(NOTION_TABLOLARI).map(([t, v]) => [v.dataSourceId, t])) as Record<string, "KISI" | "PORTFOY" | "TALEP">;
  const f = (async (url: string, init: any = {}) => {
    const u = new URL(url); const yol = u.pathname.replace("/v1", "");
    let m;
    if ((m = yol.match(/^\/data_sources\/([^/]+)\/query$/))) return J({ results: (tur.current === 1 ? NOTION_TUR1 : NOTION_TUR2)[ds[m[1]]], has_more: false, next_cursor: null });
    if ((m = yol.match(/^\/data_sources\/([^/]+)$/))) {
      if (init.method === "PATCH") { eklenenAlan.push(...Object.keys(JSON.parse(init.body).properties)); return J({}); }
      const ornek = NOTION_TUR1[ds[m[1]]][0];
      return J({ id: m[1], properties: Object.fromEntries(Object.entries(ornek.properties).map(([k, v]) => [k, { id: k, name: k, type: v.type }])) });
    }
    if ((m = yol.match(/^\/pages\/([^/]+)$/))) { yazilan.push({ sayfa: m[1], props: JSON.parse(init.body).properties }); return J({ id: m[1], last_edited_time: "2026-09-30T10:00:00.000Z" }); }
    return J({ message: "bilinmeyen " + yol }, 404);
  }) as unknown as typeof fetch;
  return { f, yazilan, eklenenAlan };
}

test("Notion: ilk içe aktarma kişi + portföy + talep oluşturur, ilişkileri bağlar, geri yazım yalnız uygulama alanlarına", async () => {
  await entegrasyon(prisma, "NOTION");
  await prisma.entegrasyon.update({ where: { ofisId_saglayici: { ofisId: VARSAYILAN_OFIS_ID, saglayici: "NOTION" } }, data: { durum: "BAGLI" } });
  const tur = { current: 1 as 1 | 2 };
  const n = sahteNotion(tur);
  const r: any = await notionSenkronCalistir(prisma, { token: "secret", f: n.f, tetik: "ilk", uygulamaUrl: "https://ornek.app" });
  assert.equal(r.ozet.kisiYeni, 4);
  assert.equal(r.ozet.yeni, 6, "3 portföy + 2 talep + Hakan'ın kişi kartından türetilen 1 talep");
  assert.ok(r.kontrolListesi.some((k: any) => k.notionId === NT.GEBZE), "başlıksız, tipsiz talep 'kontrol gerekli'");
  const kepez = await prisma.kayit.findFirstOrThrow({ where: { notionId: NP.KEPEZ }, include: { kisiBaglari: { include: { kisi: true } }, ozellik: true } });
  assert.equal(kepez.kisiBaglari[0].kisi.notionId, NK.MURAT);
  assert.equal(kepez.kisiBaglari[0].rol, "SAHIP");
  assert.equal(kepez.ozellik?.ruhsatDurumu, "RUHSATLI");
  assert.equal((await prisma.kayit.findFirstOrThrow({ where: { notionId: NP.TOPALLI } })).durum, "ARSIV");
  const turetilen = await prisma.kayit.findFirstOrThrow({ where: { notionId: NK.HAKAN + "#talep" } });
  assert.equal(turetilen.mulkTipi, "DEPO_ANTREPO");
  // Geri yazım: eksik beş alan eklendi; sayfalara yalnızca bu alanlar yazıldı; türetilmiş talep (#) Notion'a yazılmaz
  assert.deepEqual(new Set(n.eklenenAlan), new Set(Object.values(GERI_YAZIM_ALANLARI).map((a) => a.ad)));
  assert.ok(n.yazilan.length >= 2);
  for (const y of n.yazilan) assert.deepEqual(Object.keys(y.props).sort(), Object.values(GERI_YAZIM_ALANLARI).map((a) => a.ad).sort());
  assert.ok(!n.yazilan.some((y) => y.sayfa.includes("#")));
  const kepezYazim = n.yazilan.find((y) => y.sayfa === NP.KEPEZ)!;
  assert.ok((kepezYazim.props["Eşleşme Sayısı"] as any).number >= 1, "Kepez deposu Hakan'ın depo talebiyle eşleşir");

  // Aynı veriyle tekrar: kopya yok, değişen yok, geri yazım isteği yok
  const once = await prisma.kayit.count();
  const r2: any = await notionSenkronCalistir(prisma, { token: "secret", f: n.f, tam: true, uygulamaUrl: "https://ornek.app" });
  assert.equal(await prisma.kayit.count(), once);
  assert.equal(r2.ozet.yeni, 0, JSON.stringify(r2.ozet));
  assert.equal(r2.ozet.geriYazilan, 0, JSON.stringify(r2.ozet));
});

test("Notion: 2. tur — yalnız Notion'da değişen alınır, iki tarafta değişen çakışma olur, çöpe atılan arşivlenir; çakışma çözülür", async () => {
  // Yerelde Kepez deposunun başlığını düzelt (Notion'da değişmedi → korunmalı) ve Lara bütçesine dokunma
  const kepez = await prisma.kayit.findFirstOrThrow({ where: { notionId: NP.KEPEZ } });
  await prisma.kayit.update({ where: { id: kepez.id }, data: { baslik: "Kepez Sanayi depo (düzeltildi)", fiyat: 205000 } });
  const tur = { current: 2 as 1 | 2 };
  const n = sahteNotion(tur);
  const r: any = await notionSenkronCalistir(prisma, { token: "secret", f: n.f, uygulamaUrl: "https://ornek.app" });
  const lara = await prisma.kayit.findFirstOrThrow({ where: { notionId: NT.LARA } });
  assert.equal(Number(lara.maxFiyat), 150000, "yalnız Notion'da değişen bütçe alındı");
  const k2 = await prisma.kayit.findFirstOrThrow({ where: { notionId: NP.KEPEZ } });
  assert.equal(k2.baslik, "Kepez Sanayi depo (düzeltildi)", "yerel düzeltme ezilmedi");
  assert.equal(Number(k2.fiyat), 205000, "çakışmada yerel değer korunur");
  const c = await prisma.senkronCakisma.findFirstOrThrow({ where: { hedefId: kepez.id, alan: "fiyat", durum: "ACIK" } });
  assert.equal(c.uzak, 200000);
  assert.ok(r.ozet.cakisma >= 1);
  await cakismaCoz(prisma, c.id, "UZAK");
  assert.equal(Number((await prisma.kayit.findUniqueOrThrow({ where: { id: kepez.id } })).fiyat), 200000);
  const calisma = await prisma.senkronCalisma.findUniqueOrThrow({ where: { id: r.calismaId } });
  assert.equal(calisma.durum, "CAKISMA");
});

test("Google: ilk tam senkron + artımlı senkron; telefonla birleştirme, silinen kişi korunur, kilit çakışan işi engeller", async () => {
  await prisma.kisi.upsert({ where: { ofisId_telefon: { ofisId: VARSAYILAN_OFIS_ID, telefon: "+905550000102" } }, update: {}, create: { adSoyad: "Selin A. (yerel)", telefon: "+905550000102", roller: [] } });
  await entegrasyon(prisma, "GOOGLE_KISILER");
  await prisma.entegrasyon.update({ where: { ofisId_saglayici: { ofisId: VARSAYILAN_OFIS_ID, saglayici: "GOOGLE_KISILER" } }, data: { durum: "BAGLI", tokenSifreli: sifrele("1//yenile") } });
  let tur = 1;
  const f = (async (url: string) => {
    if (url.startsWith("https://oauth2.googleapis.com/token")) return J({ access_token: "ya29.test", expires_in: 3600 });
    if (url.includes("/contactGroups")) return J({ contactGroups: GOOGLE_GRUPLAR });
    const u = new URL(url);
    if (tur === 2) assert.equal(u.searchParams.get("syncToken"), "sync-1", "2. tur artımlı istenmeli");
    return J({ connections: tur === 1 ? GOOGLE_TUR1 : GOOGLE_TUR2, nextSyncToken: "sync-" + tur });
  }) as unknown as typeof fetch;
  const r1: any = await googleSenkronCalistir(prisma, { f, tetik: "ilk", tam: true });
  assert.equal(r1.ozet.atlanan, 1);
  assert.equal(r1.ozet.birlesen, 1);
  const selin = await prisma.kisi.findFirstOrThrow({ where: { telefon: "+905550000102" } });
  assert.equal(selin.googleResourceName, "people/c101");
  assert.ok(selin.roller.includes("EMLAKCI"));
  assert.ok((await prisma.kisi.findFirstOrThrow({ where: { telefon: "+902420000011" } })).roller.includes("MUTEAHHIT"));
  tur = 2;
  await googleSenkronCalistir(prisma, { f });
  assert.equal((await prisma.kisi.findFirstOrThrow({ where: { googleResourceName: "people/c102" } })).sirket, "Usta Yatırım (örnek)");
  const anne = await prisma.kisi.findFirstOrThrow({ where: { telefon: "+905550000302" } });
  assert.equal(anne.googleResourceName, null);
  assert.ok(anne.kaynaktaSilindi, "Google'da silinen kişi Anahtar'da kalır, bağı kopar");
  assert.equal((await prisma.entegrasyon.findFirstOrThrow({ where: { saglayici: "GOOGLE_KISILER" } })).syncToken, "sync-2");
  // Kilit
  await prisma.entegrasyon.update({ where: { ofisId_saglayici: { ofisId: VARSAYILAN_OFIS_ID, saglayici: "GOOGLE_KISILER" } }, data: { kilitBitis: new Date(Date.now() + 60_000) } });
  assert.deepEqual(await googleSenkronCalistir(prisma, { f }), { atlandi: "Başka bir senkron sürüyor" });
  await prisma.entegrasyon.update({ where: { ofisId_saglayici: { ofisId: VARSAYILAN_OFIS_ID, saglayici: "GOOGLE_KISILER" } }, data: { kilitBitis: null } });
});