/**
 * Anahtar CRM v3.43 · 25 Ekim 2026
 * Ücretsiz plan mimarisi: Cloudflare yalnızca aracı, asıl iş Supabase Edge Function'da.
 * (1) aracı başlıkları / ortam paketi  (2) Supabase geçit hatası ayrımı  (3) aracı: iletme + fonksiyon yoksa yerelde işleme
 * (4) fonksiyon: kapı doğrulaması, iç yollar kapı ister, ortam birleştirme
 */
import test from "node:test";
import assert from "node:assert/strict";
import { uzakAdres, ortamPaketle, ortamCoz, araciBasliklari, gecitHatasiMi, BASLIK_KAPI, BASLIK_ASIL, BASLIK_ORTAM } from "../src/canli/uzak";
(globalThis as any).__ANAHTAR_TEST__ = true;
import worker from "../src/canli/worker";
import { kapiGecerliMi, ortamKur, fonksiyonIsle } from "../src/canli/fonksiyon";
import { SURUM, SURUM_GECMISI } from "../src/lib/surum";

const ENV: any = { SUPABASE_URL: "https://ref.supabase.co/", SUPABASE_ANON_KEY: "anon", SUPABASE_SERVICE_ROLE_KEY: "servis-0123456789abcdefghij", AI_API_KEY: "ğüşİ-anahtar", ASSETS: { fetch: async () => new Response("statik") } };

test("sürüm 3.42", () => { assert.ok(SURUM_GECMISI.some((x) => x.surum === "3.42")); void SURUM; });

test("fonksiyon adresi: SUPABASE_URL'den türetilir; API_UZAK=0 kapatır, https adresi değiştirir", () => {
  assert.equal(uzakAdres(ENV), "https://ref.supabase.co/functions/v1/api");
  assert.equal(uzakAdres({ ...ENV, API_UZAK: "0" }), null);
  assert.equal(uzakAdres({ ...ENV, API_UZAK: "https://baska.example/api/" }), "https://baska.example/api");
  assert.equal(uzakAdres({}), null);
});

test("ortam paketi: Türkçe karakterli gizli değerler bozulmadan taşınır; nesne değerler (ASSETS) taşınmaz", () => {
  const o = ortamCoz(ortamPaketle(ENV));
  assert.equal(o.AI_API_KEY, "ğüşİ-anahtar"); assert.equal(o.SUPABASE_SERVICE_ROLE_KEY, ENV.SUPABASE_SERVICE_ROLE_KEY);
  assert.ok(!("ASSETS" in o)); assert.deepEqual(ortamCoz("bozuk!!"), {}); assert.deepEqual(ortamCoz(null), {});
  const h = araciBasliklari(ENV, "https://anahtarcrm.com/api/durum", { authorization: "Bearer x", host: "anahtarcrm.com" });
  assert.equal(h.get(BASLIK_KAPI), ENV.SUPABASE_SERVICE_ROLE_KEY); assert.equal(h.get(BASLIK_ASIL), "https://anahtarcrm.com/api/durum");
  assert.equal(h.get("authorization"), "Bearer x"); assert.equal(h.get("host"), null);
});

test("geçit hatası: Supabase'in NOT_FOUND / BOOT_ERROR / 546'sı evet; uygulamanın kendi hataları hayır", async () => {
  const j = (s: number, b: unknown) => new Response(JSON.stringify(b), { status: s, headers: { "content-type": "application/json" } });
  assert.equal(await gecitHatasiMi(j(404, { code: "NOT_FOUND", message: "Requested function was not found" })), true);
  assert.equal(await gecitHatasiMi(j(503, { code: "BOOT_ERROR", message: "Function failed to start" })), true);
  assert.equal(await gecitHatasiMi(new Response("x", { status: 546 })), true);
  assert.equal(await gecitHatasiMi(j(404, { hata: "BULUNAMADI" })), false);
  assert.equal(await gecitHatasiMi(j(500, { hata: "SUNUCU", mesaj: "x" })), false);
  assert.equal(await gecitHatasiMi(j(401, { hata: "KIMLIK" })), false);
  assert.equal(await gecitHatasiMi(j(200, { code: "x" })), false);
});

test("aracı: /api isteği fonksiyona aynen iletilir (yol, sorgu, yöntem, gövde, oturum); yanıt aynen döner", async () => {
  const eski = globalThis.fetch; let giden: Request | null = null; let govde = "";
  globalThis.fetch = (async (u: any, i: any) => { giden = new Request(u, i); govde = i?.body ? new TextDecoder().decode(i.body) : ""; return new Response(JSON.stringify({ tamam: true }), { status: 201, headers: { "content-type": "application/json", "x-ozel": "1" } }); }) as any;
  try {
    const r = await worker.fetch(new Request("https://anahtarcrm.com/api/durum?parca=kisi&atla=250", { method: "POST", headers: { authorization: "Bearer jwt" }, body: '{"a":1}' }), ENV);
    assert.equal(r.status, 201); assert.equal(r.headers.get("x-ozel"), "1"); assert.deepEqual(await r.json(), { tamam: true });
    assert.equal(giden!.url, "https://ref.supabase.co/functions/v1/api/durum?parca=kisi&atla=250");
    assert.equal(giden!.method, "POST"); assert.equal(govde, '{"a":1}');
    assert.equal(giden!.headers.get("authorization"), "Bearer jwt");
    assert.equal(giden!.headers.get(BASLIK_ASIL), "https://anahtarcrm.com/api/durum?parca=kisi&atla=250");
    assert.ok(giden!.headers.get(BASLIK_ORTAM));
    // statik dosyalar aracıya hiç girmez
    assert.equal(await (await worker.fetch(new Request("https://anahtarcrm.com/"), ENV)).text(), "statik");
  } finally { globalThis.fetch = eski; }
});

test("aracı: fonksiyon yayında değilse (NOT_FOUND) istek yerelde işlenir; /api/yapilandirma hep yerelde", async () => {
  const eski = globalThis.fetch; let sayi = 0;
  globalThis.fetch = (async () => { sayi++; return new Response(JSON.stringify({ code: "NOT_FOUND", message: "Requested function was not found" }), { status: 404, headers: { "content-type": "application/json" } }); }) as any;
  try {
    const r = await worker.fetch(new Request("https://anahtarcrm.com/api/durum"), ENV); // yerel: oturum yok → 401
    assert.equal(r.status, 401); assert.equal(sayi, 1);
    const y = await worker.fetch(new Request("https://anahtarcrm.com/api/yapilandirma"), ENV);
    assert.equal((await y.json()).supabaseAnonKey, "anon"); assert.equal(sayi, 1, "yapılandırma fonksiyona gitmez");
  } finally { globalThis.fetch = eski; }
});

test("fonksiyon kapısı: service_role anahtarı ya da yeni gizli anahtar geçer; yanlış / boş geçmez; biçim farkında Supabase'e sorulur", async () => {
  const kendi = { SUPABASE_SERVICE_ROLE_KEY: "eski-jwt-0123456789abcdefghij", SUPABASE_SECRET_KEYS: JSON.stringify({ default: "sb_secret_0123456789abcdef" }), SUPABASE_URL: "https://ref.supabase.co" };
  const hayir = (async () => new Response("", { status: 401 })) as any, evet = (async () => new Response("[]", { status: 200 })) as any;
  assert.equal(await kapiGecerliMi("eski-jwt-0123456789abcdefghij", kendi, hayir), true);
  assert.equal(await kapiGecerliMi("sb_secret_0123456789abcdef", kendi, hayir), true);
  assert.equal(await kapiGecerliMi("yanlis-anahtar-0123456789abc", kendi, hayir), false);
  assert.equal(await kapiGecerliMi("", kendi, evet), false);
  assert.equal(await kapiGecerliMi("baska-bicim-0123456789abcdef", kendi, evet), true);
});

test("fonksiyon ortamı: iletilen değerler yalnızca kapı geçerliyse; veritabanı yoksa SUPABASE_DB_URL", () => {
  const kendi = { SUPABASE_DB_URL: "postgres://ic", SUPABASE_URL: "u" };
  assert.equal((ortamKur(kendi, { DATABASE_URL: "postgres://havuz", AI_API_KEY: "k" }, true) as any).DATABASE_URL, "postgres://havuz");
  const g = ortamKur(kendi, { DATABASE_URL: "postgres://sahte", AI_API_KEY: "k" }, false) as any;
  assert.equal(g.DATABASE_URL, "postgres://ic"); assert.equal(g.AI_API_KEY, undefined);
});

test("fonksiyon: iç yollar (zamanlayıcı, e-posta) kapısız 403; oturumsuz API isteği 401", async () => {
  const kendi = { SUPABASE_URL: "http://127.0.0.1:9", SUPABASE_SERVICE_ROLE_KEY: "servis-0123456789abcdefghij" };
  const z = await fonksiyonIsle(new Request("http://x/api/_ic/zamanlayici", { method: "POST", body: "{}" }), kendi);
  assert.equal(z.status, 403);
  const e = await fonksiyonIsle(new Request("http://x/functions/v1/api/_ic/eposta", { method: "POST", headers: { [BASLIK_KAPI]: "yanlis-0123456789abcdefghijk" }, body: "x" }), kendi);
  assert.equal(e.status, 403);
  const d = await fonksiyonIsle(new Request("http://x/api/durum"), kendi);
  assert.equal(d.status, 401);
});
