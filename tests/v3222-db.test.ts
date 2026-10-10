/**
 * Anahtar CRM v3.22.2 · 10 Ekim 2026
 * v3.22.2 — VERİTABANLI KANIT (PGlite + sahte Google): "değişiklik yok" turu hafif; artımlı kişi okuması; günde bir zamanlayıcı.
 *   · Google'da değişiklik yokken tur yalnızca 2 dış istek yapar (anahtar + artımlı çekim): etiket listesi bile istenmez
 *   · Google'da bir kişi değişince yalnızca o kişi gelir (artımlı anahtar) ve doğru işlenir
 *   · GET /api/durum?yalniz=kisiler&sonra=… yalnızca değişen / eklenen kişileri döner; `select` ile Google anlık görüntüsü taşınmaz
 *   · Google varsayılanı günde bir; Cloudflare zamanlayıcısı günde bir ("0 5 * * *"), 15 dakikalık yok
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { kiracilikIcinde, baglamOku, VARSAYILAN_OFIS_ID, VARSAYILAN_KULLANICI_ID, istemciyiSarmala, type Baglam } from "../src/lib/kiracilik";
import { googleSenkronCalistir, entegrasyon, ayarlarOf, varsayilanAyar } from "../src/lib/services/senkron";
import { degisiklikUygula, DegisiklikSchema, kisileriGetir, durumGetir } from "../src/lib/services/durum";
import { sifrele } from "../src/lib/guvenlik/sifre";
import { sahteGoogle, gk } from "./sahte-google";

process.env.ENTEGRASYON_SIFRE_ANAHTARI = Buffer.alloc(32, 5).toString("base64");
process.env.GOOGLE_CLIENT_ID = "test-istemci"; process.env.GOOGLE_CLIENT_SECRET = "test-gizli";

const ciplak = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL!, max: 1 }) });
const prisma = istemciyiSarmala(ciplak);
(globalThis as any).prisma = ciplak;
const A: Baglam = { ofisId: VARSAYILAN_OFIS_ID, kullaniciId: VARSAYILAN_KULLANICI_ID, rol: "PLATFORM_YONETICISI", eposta: "ozgursadikozyurt@gmail.com" };
const icinde = <T,>(is: () => Promise<T>) => kiracilikIcinde(A, is);
const dis = (G: ReturnType<typeof sahteGoogle>, bas: number) => G.cagrilar.slice(bas).map((c) => new URL(c.url).pathname);

async function sifirlaVeBagla() {
  await ciplak.senkronHaric.deleteMany({});
  await ciplak.senkronCakisma.deleteMany({ where: { saglayici: "GOOGLE_KISILER" } });
  await ciplak.kisi.updateMany({ where: { googleResourceName: { not: null } }, data: { googleResourceName: null, googleSnapshot: null as any, googleBekliyor: null } });
  await icinde(async () => {
    const e = await entegrasyon(prisma, "GOOGLE_KISILER");
    await prisma.entegrasyon.updateMany({ where: { saglayici: "GOOGLE_KISILER" }, data: { durum: "BAGLI", hesap: "rehber@ornek.com", tokenSifreli: sifrele("1//yenile"), syncToken: null, imlec: null as any, kilitBitis: null, ayarlar: { ...ayarlarOf(e), otomatik: true, aralikDk: 1440, geriYaz: true, googleYaz: true, sadeceEtiketler: [], baglayanKullaniciId: A.kullaniciId, yazmaIzni: true } as any } }); // önceki test dosyalarından kalan ayarlar sonucu etkilemesin
  });
}
async function turlar(f: typeof fetch) {
  let son: any, n = 0;
  do { son = await icinde(() => googleSenkronCalistir(prisma, { f, tetik: "kullanici", butceMs: 20_000 })); n++; assert.ok(!son.atlandi, String(son.atlandi)); assert.ok(n < 30); } while (son.devamEdecek);
  return son;
}

const G = sahteGoogle(Array.from({ length: 120 }, (_, i) => gk(7000 + i, `Günlük Rehber ${i}`, `+90534${String(2000000 + i)}`)));

test("ilk içe aktarma tamam; sonraki 'değişiklik yok' turu yalnızca 2 dış istek yapar (anahtar yenile + artımlı çekim) ve rehberi okumaz", async () => {
  await sifirlaVeBagla();
  await turlar(G.f);
  assert.equal(await icinde(() => prisma.kisi.count({ where: { googleResourceName: { startsWith: "people/c70" } } })), 100, "ilk 100 (7000-7099) ... ve devamı geldi");
  assert.equal(await icinde(() => prisma.kisi.count({ where: { googleResourceName: { not: null } } })), 120);
  const once = G.cagrilar.length;
  const son = await turlar(G.f);
  assert.deepEqual(dis(G, once), ["/token", "/v1/people/me/connections"], "etiket listesi (contactGroups) bile istenmedi");
  assert.equal(son.ozet.yeni, 0); assert.equal(son.devamEdecek, false); assert.equal(son.ozet.gonderimKalan, 0);
  const e = await icinde(() => entegrasyon(prisma, "GOOGLE_KISILER"));
  assert.ok(e.syncToken?.startsWith("sync-"), "artımlı anahtar korunur"); assert.equal(e.sonHata, null);
});

test("Google'da tek kişi değişince yalnızca o kişi gelir: bağlam o zaman yüklenir, ad güncellenir, yeni kişi eklenir", async () => {
  G.degistir("people/c7005", (p) => { p.names![0].displayName = "Telefonda Düzeltilmiş Ad"; });
  G.ekle(gk(7500, "Telefondan Yeni Kişi", "+905349990000"));
  const once = G.cagrilar.length;
  const son = await turlar(G.f);
  const yollar = dis(G, once);
  assert.deepEqual(yollar.filter((y) => y !== "/token"), ["/v1/people/me/connections", "/v1/contactGroups"], "değişiklik varken etiketler bir kez istenir");
  assert.equal(son.ozet.yeni, 1); assert.equal(son.ozet.guncellenen, 1);
  assert.equal((await icinde(() => prisma.kisi.findFirst({ where: { googleResourceName: "people/c7005" } })))!.adSoyad, "Telefonda Düzeltilmiş Ad");
  assert.ok(await icinde(() => prisma.kisi.findFirst({ where: { googleResourceName: "people/c7500" } })));
  assert.equal(G.silmeCagrilari().length, 0, "Google'dan hiçbir şey silinmedi");
});

test("Anahtar'da elle eklenen kişi 'Şimdi eşitle'de Google'a gider; gönderilecek yokken ek sorgu / istek yok", async () => {
  const r = await icinde(() => degisiklikUygula(prisma, DegisiklikSchema.parse({ kisiler: [{ id: "K3222ELLE", adSoyad: "Elle Eklenen", telefon: "+905348880001", googleaGonder: true }] })));
  assert.deepEqual(r.hatalar, []);
  const once = G.cagrilar.length;
  const son = await turlar(G.f);
  assert.equal(son.ozet.gonderilenYeni, 1);
  assert.ok(G.yazmaCagrilari().some((c) => c.url.includes("createContact")));
  await turlar(G.f); // Google, az önce oluşturulan kişiyi artımlı listede bir kez geri bildirir (kendi yazdığımızın yankısı)
  const once2 = G.cagrilar.length; await turlar(G.f);
  assert.deepEqual(dis(G, once2), ["/token", "/v1/people/me/connections"], "yankı da işlendi, gönderilecek kişi kalmadı: yine yalnızca 2 istek"); void once;
});

test("kisileriGetir: ?sonra ile yalnızca eklenen / değişen kişiler gelir; tam okuma hepsini getirir; Google anlık görüntüsü / etag taşınmaz", async () => {
  await ciplak.kisi.updateMany({ data: { updatedAt: new Date("2020-01-01T00:00:00Z") } }); // hepsi 'eski'
  const toplam = await icinde(() => prisma.kisi.count());
  const tam = await icinde(() => kisileriGetir(prisma));
  assert.equal(tam.kisiler.length, toplam); assert.equal(tam.artimli, false); assert.ok(!Number.isNaN(Date.parse(tam.zaman)));
  for (const k of tam.kisiler.slice(0, 5)) for (const yasak of ["googleSnapshot", "googleEtag", "notionSnapshot", "fingerprint"]) assert.ok(!(yasak in k), yasak);
  const sinir = new Date();
  const r = await icinde(() => degisiklikUygula(prisma, DegisiklikSchema.parse({ kisiler: [{ id: "K3222ELLE", adSoyad: "Elle Eklenen (düzeltildi)", telefon: "+905348880001" }, { id: "K3222YENI", adSoyad: "Bugün Eklenen", telefon: "+905348880002" }] })));
  assert.deepEqual(r.hatalar, []);
  const art = await icinde(() => kisileriGetir(prisma, sinir));
  assert.equal(art.artimli, true);
  assert.deepEqual(art.kisiler.map((k) => k.id).sort(), ["K3222ELLE", "K3222YENI"], "yalnızca değişen ve yeni kişi");
  assert.equal(art.kisiler.find((k) => k.id === "K3222ELLE")!.googleResourceName != null, true, "Google bağı bilgisi (rozet için) yine de gelir");
  assert.equal((await icinde(() => kisileriGetir(prisma, new Date("invalid")))).artimli, false, "geçersiz tarih → tam liste");
  const d = await icinde(() => durumGetir(prisma));
  assert.equal(d.kisiler.length, toplam + 1); assert.ok(typeof d.kisiZamani === "string", "açılış yanıtı artımlı yenilemenin başlangıç zamanını taşır");
});

test("GET /api/durum?yalniz=kisiler&sonra=…: rota artımlı okur", async () => {
  const { GET } = await import("../src/app/api/durum/route");
  const j = (await (await icinde(() => GET(new Request("http://x/api/durum?yalniz=kisiler&sonra=" + encodeURIComponent(new Date(Date.now() + 3_600_000).toISOString()))))).json()) as any;
  assert.equal(j.artimli, true); assert.equal(j.kisiler.length, 0, "gelecekteki bir andan sonra değişen yok");
  const tum = (await (await icinde(() => GET(new Request("http://x/api/durum?yalniz=kisiler")))).json()) as any;
  assert.ok(tum.kisiler.length > 100); assert.equal(tum.artimli, false);
});

test("varsayılan Google ayarı günde bir; Cloudflare zamanlayıcısı günde bir (15 dakikalık yok)", () => {
  assert.equal(varsayilanAyar("GOOGLE_KISILER").aralikDk, 1440);
  const w = fs.readFileSync("wrangler.jsonc", "utf8");
  const satir = w.split("\n").find((l) => /"crons"/.test(l))!;
  assert.match(satir, /"0 5 \* \* \*"/, "05:00 UTC = 08:00 TR günlük eşitleme"); assert.ok(!/\*\/15|\*\/5 /.test(satir), "dakikalık zamanlayıcı kalmadı");
  const worker = fs.readFileSync("src/canli/worker.ts", "utf8");
  assert.match(worker, /tumOfislerdeGoogleSenkron/, "zamanlayıcı yine Google eşitlemesini çağırır");
});
