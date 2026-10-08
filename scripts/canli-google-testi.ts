/**
 * Anahtar CRM v3.21.1 · 8 Ekim 2026
 * Canlı hattın Google sınaması — GERÇEK Worker (wrangler dev, workerd) + yerel Postgres (PGlite) + SAHTE Google (bu betik :9002'de açar).
 * "Google ile bağlan" akışının tamamı Worker'ın içinden geçer: bağlan → izin ekranından dönüş (oturumsuz kapı, imzalı state) →
 * ilk içe aktarma (turlar hâlinde) → çift yönlü eşitleme → silinen kişinin Google'da kalması → zamanlayıcı → bağlantıyı kaldırma.
 *
 * Hazırlık:
 *   SADECE_HAZIRLA=1 LOKASYON_KAPSAM=07 ./scripts/test-db.sh
 *   .dev.vars (örnek: .dev.vars.ornek) + şu satırlar:
 *     GOOGLE_CLIENT_ID=test   GOOGLE_CLIENT_SECRET=test
 *     GOOGLE_OAUTH_TABANI=http://127.0.0.1:9002   GOOGLE_PEOPLE_TABANI=http://127.0.0.1:9002
 *   npm run canli:build && npx wrangler dev --port 8799 --local --test-scheduled
 * Çalıştır:  npx tsx scripts/canli-google-testi.ts
 */
import http from "node:http";
import { SignJWT } from "jose";
import { Client } from "pg";
import { MIGRASYONLAR } from "../src/canli/gomulu.generated";
import { sahteGoogle, gk } from "../tests/sahte-google";

const TABAN = process.env.CANLI_URL ?? "http://localhost:8799";
const PG = process.env.DATABASE_URL ?? "postgresql://postgres@127.0.0.1:55432/postgres";
const SIR = new TextEncoder().encode("test-gizli-anahtar-en-az-32-karakter-olmali-123");
let gecen = 0, kalan = 0;
const tamam = (ad: string, ok: boolean, ayrinti = "") => { ok ? gecen++ : kalan++; console.log(`${ok ? "✔" : "✘"} ${ad}${ayrinti ? " — " + ayrinti : ""}`); };
const jwt = (eposta: string) => new SignJWT({ email: eposta }).setProtectedHeader({ alg: "HS256" }).setAudience("authenticated").setExpirationTime("1h").sign(SIR);
/** PGlite tek bağlantı kabul eder: sorgu at, hemen kapat */
const sql = async (q: string, p: unknown[] = []) => { const c = new Client({ connectionString: PG }); await c.connect(); try { return (await c.query(q, p)).rows; } finally { await c.end(); await new Promise((x) => setTimeout(x, 250)); } };

(async () => {
  // Sahte Google'ı gerçek bir HTTP sunucusu olarak aç (Worker dışarıdaki Google'a gider gibi buna gider)
  const G = sahteGoogle(Array.from({ length: 450 }, (_, i) => gk(1000 + i, `Rehber Kişi ${i}`, `+90533${String(1000000 + i)}`)));
  const sunucu = http.createServer(async (req, res) => {
    const govde = await new Promise<string>((r) => { let s = ""; req.on("data", (d) => (s += d)); req.on("end", () => r(s)); });
    const y = await G.f("https://people.googleapis.com" + req.url!, { method: req.method, body: govde || undefined } as RequestInit).catch((e) => new Response(String(e), { status: 500 }));
    // token / revoke uçları başka alan adında: yola göre yeniden dene
    const yanit = y.status === 500 && /^\/(token|revoke)/.test(req.url!) ? await G.f("https://oauth2.googleapis.com" + req.url!, { method: req.method, body: govde || undefined } as RequestInit) : y;
    res.writeHead(yanit.status, { "content-type": "application/json" }); res.end(await yanit.text());
  });
  await new Promise<void>((r) => sunucu.listen(9002, "127.0.0.1", r));

  const t = await jwt("ozgur@test.com");
  const api = async (yol: string, init: { method?: string; json?: unknown; token?: string | null } = {}) => {
    const r = await fetch(TABAN + yol, { method: init.method ?? (init.json !== undefined ? "POST" : "GET"), redirect: "manual", headers: { ...(init.token === null ? {} : { authorization: `Bearer ${init.token ?? t}` }), ...(init.json !== undefined ? { "content-type": "application/json" } : {}) }, body: init.json !== undefined ? JSON.stringify(init.json) : undefined });
    const sonuc = { durum: r.status, konum: r.headers.get("location"), j: (await r.json().catch(() => ({}))) as any };
    await new Promise((x) => setTimeout(x, 200)); // PGlite tek bağlantı kabul eder: Worker önceki isteğin bağlantısını kapatsın (gerçek Supabase'de bu sınır yok)
    return sonuc;
  };
  try {
    await sql(`CREATE TABLE IF NOT EXISTS "_anahtarcrm_migrasyon" ("ad" text PRIMARY KEY, "tarih" timestamptz NOT NULL DEFAULT now())`);
    for (const m of MIGRASYONLAR) await sql(`INSERT INTO "_anahtarcrm_migrasyon"(ad) VALUES ($1) ON CONFLICT DO NOTHING`, [m.ad]);
    await sql(`DELETE FROM "entegrasyon" WHERE "saglayici" = 'GOOGLE_KISILER'`); await sql(`DELETE FROM "senkron_haric"`); await sql(`DELETE FROM "kisi" WHERE "kaynak" = 'GOOGLE' OR "googleResourceName" IS NOT NULL OR "id" LIKE 'KCANLI%'`); // önceki çalıştırmanın izleri

    // 1) durum + bağlan
    let e = (await api("/api/entegrasyon")).j;
    tamam("GET /api/entegrasyon: yalnızca Google, hazır, bağlı değil, Notion yok", Array.isArray(e) && e.length === 1 && e[0].saglayici === "GOOGLE_KISILER" && e[0].hazir === true && e[0].durum === "BAGLI_DEGIL" && e[0].yetkili === true, JSON.stringify(e).slice(0, 160));
    tamam("oturumsuz bağlan → 401", (await api("/api/entegrasyon/google/baglan", { method: "POST", json: {}, token: null })).durum === 401);
    const b = await api("/api/entegrasyon/google/baglan", { method: "POST", json: {} });
    const adres = new URL(b.j.url ?? "http://x");
    tamam("POST baglan → Google izin adresi; yönlendirme adresi Worker'ın kendi alan adı", b.durum === 200 && adres.hostname === "accounts.google.com" && adres.searchParams.get("redirect_uri") === TABAN + "/api/entegrasyon/google/geri-donus", b.j.url?.slice(0, 120));
    const state = adres.searchParams.get("state")!;

    // 2) izin ekranından dönüş: OTURUMSUZ kapı (Worker 401 dememeli), imza denetimi rotada
    const d1 = await api("/api/entegrasyon/google/geri-donus?code=abc&state=" + encodeURIComponent(state.slice(0, -2) + "zz"), { token: null });
    tamam("dönüş (kurcalanmış state): 302 → /?google=hata, bağlanmadı", d1.durum === 302 && d1.konum === TABAN + "/?google=hata", `${d1.durum} ${d1.konum}`);
    const d2 = await api("/api/entegrasyon/google/geri-donus?code=abc&state=" + encodeURIComponent(state), { token: null });
    tamam("dönüş (geçerli state, oturum başlığı yok): 302 → /?google=ok", d2.durum === 302 && d2.konum === TABAN + "/?google=ok", `${d2.durum} ${d2.konum}`);
    e = (await api("/api/entegrasyon")).j;
    tamam("bağlandı: hesap görünür, çift yönlü açık, gizli anahtar dönmez", e[0].durum === "BAGLI" && e[0].hesap === "rehber@ornek.com" && e[0].ayarlar.googleYaz === true && !JSON.stringify(e).includes("sahte-yenileme"));
    const saklanan = (await sql(`SELECT "tokenSifreli" FROM "entegrasyon" WHERE "saglayici" = 'GOOGLE_KISILER'`))[0]?.tokenSifreli as string;
    tamam("yenileme anahtarı veritabanında şifreli (v1:…), açık metin değil", /^v1:/.test(saklanan ?? "") && !saklanan.includes("sahte-yenileme"));

    // 3) ilk içe aktarma: arayüzün yaptığı gibi "devam edecek" dedikçe yinele
    const esitle = async (tam = false) => { let tur = 0, son: any; do { son = (await api("/api/senkron/calistir", { json: { kaynak: "google", tam: tam && tur === 0 } })).j.google; tur++; if (son?.hata || son?.atlandi) break; } while (son?.devamEdecek && tur < 40); return { tur, son }; };
    const ilk = await esitle();
    const kisiler = async () => (await api("/api/durum?yalniz=kisiler")).j.kisiler as any[];
    let ks = await kisiler();
    tamam("ilk içe aktarma Worker içinde tamamlandı: 450 kişi", !ilk.son?.hata && ks.filter((k) => k.googleResourceName).length === 450, `tur=${ilk.tur} ${JSON.stringify(ilk.son).slice(0, 200)}`);

    // 4) Google → Anahtar
    G.ekle(gk(3001, "Canlı Yeni Müşteri", "+905441112233"));
    await esitle(); ks = await kisiler();
    tamam("Google'a eklenen kişi Anahtar'a düştü", ks.some((k) => k.telefon === "+905441112233"));

    // 5) Anahtar → Google: elle eklenen gider, işaretsiz gitmez
    const once = G.kisiler.size;
    await api("/api/durum", { json: { kisiler: [{ id: "KCANLI1", adSoyad: "Canlı Elle Eklenen", telefon: "+905321110001", googleaGonder: true }, { id: "KCANLI2", adSoyad: "Canlı Toplu", telefon: "+905321110002" }] } });
    const g1 = await esitle(); ks = await kisiler();
    const elle = ks.find((k) => k.id === "KCANLI1");
    tamam("elle eklenen kişi Google'a eklendi, toplu eklenen gitmedi", G.kisiler.size === once + 1 && !!elle?.googleResourceName && !ks.find((k) => k.id === "KCANLI2")?.googleResourceName, JSON.stringify(g1.son?.ozet ?? g1.son).slice(0, 200));
    // düzeltme
    await api("/api/durum", { json: { kisiler: [{ id: "KCANLI1", adSoyad: "Canlı Elle Eklenen (düzeltildi)", telefon: "+905321110001" }] } });
    await esitle();
    tamam("Anahtar'daki ad düzeltmesi Google'a yazıldı", G.kisiler.get(elle?.googleResourceName)?.names?.[0]?.displayName === "Canlı Elle Eklenen (düzeltildi)");

    // 6) Anahtar'dan sil → Google'da kalır, tam eşitlemede geri gelmez
    const hedef = ks.find((k) => k.googleResourceName === "people/c1005");
    await api("/api/durum", { json: { kisiSil: [hedef.id] } });
    await esitle(true); ks = await kisiler();
    e = (await api("/api/entegrasyon")).j;
    tamam("Anahtar'dan silinen kişi Google'da duruyor, geri gelmedi, sayaçta 1 görünüyor", !ks.some((k) => k.googleResourceName === "people/c1005") && !G.kisiler.get("people/c1005")?.metadata?.deleted && e[0].haric === 1 && G.silmeCagrilari().length === 0);
    const h = await api("/api/entegrasyon/google/haric", { method: "DELETE" });
    await esitle(); ks = await kisiler();
    tamam("'Silinenleri yeniden getir' çalıştı", h.j.temizlenen === 1 && ks.some((k) => k.googleResourceName === "people/c1005"));

    // 7) zamanlayıcı (15 dk): Worker'ın scheduled kapısı tüm ofisleri kendi bağlamında eşitler
    G.ekle(gk(3002, "Zamanlayıcıyla Gelen", "+905441112244"));
    await sql(`UPDATE "entegrasyon" SET "sonSenkron" = NULL WHERE "saglayici" = 'GOOGLE_KISILER'`);
    const z = await fetch(TABAN + "/cdn-cgi/handler/scheduled?cron=" + encodeURIComponent("*/15 * * * *"));
    let geldi = false; for (let i = 0; i < 20 && !geldi; i++) { await new Promise((r) => setTimeout(r, 1000)); geldi = (await kisiler()).some((k) => k.telefon === "+905441112244"); }
    tamam("zamanlayıcı Google'ı eşitledi (oturumsuz, platform bağlamı → ofis bağlamı)", z.ok && geldi, `scheduled=${z.status}`);

    // 8) bağlantıyı kaldır
    const k = await api("/api/entegrasyon/google/kopar", { json: {} });
    e = (await api("/api/entegrasyon")).j;
    tamam("bağlantı kaldırıldı: Google'daki izin geri alındı, kişiler yerinde", k.j.kopti === true && k.j.izinKalkti === true && e[0].durum === "BAGLI_DEGIL" && (await kisiler()).length >= 450);
    tamam("tüm akış boyunca Google'a hiçbir silme isteği gitmedi", G.silmeCagrilari().length === 0);
  } catch (x) { tamam("beklenmeyen hata", false, String((x as Error)?.stack ?? x).slice(0, 400)); }
  finally { sunucu.close(); }
  console.log(`\n${gecen} geçti, ${kalan} kaldı`); process.exit(kalan ? 1 : 0);
})();
