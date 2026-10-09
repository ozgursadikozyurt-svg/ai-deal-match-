/**
 * Anahtar CRM v3.22 · 9 Ekim 2026 (v3.20'den)
 * AŞAMA 7 — Cloudflare Worker girişi. Tek proje: arayüz (statik dosyalar, ASSETS) + /api (sunucu kodu) + zamanlanmış işler.
 *  - /api/yapilandirma, /api/saglik → açık (giriş ekranının ihtiyacı / sağlık kontrolü)
 *  - /api/davet/kabul → giriş şart, ofis şart değil (kişi henüz bir ofiste değil)
 *  - diğer /api/* → üç kapı: (1) oturum anahtarı doğrulanır (2) e-posta bir ofis kullanıcısına
 *    çözülür (3) istek o ofisin bağlamında çalışır; ofise ait her sorgu ofisId ile süzülür.
 *  - /api/entegrasyon/google/geri-donus → v3.21: Google izin ekranından dönüş. Oturum başlığı OLMAZ
 *    (tarayıcıyı Google yönlendirir); kimliği imzalı `state` taşır ve rota kendisi doğrular.
 *  - Zamanlayıcı: platform bağlamında çalışır (tüm ofisler) — her gün 03:00 (TR 06:00) uyanık
 *    tutma + süresi dolanları pasife alma; pazar 04:00 haftalık yedek; v3.21: 15 dakikada bir
 *    Google Kişiler eşitlemesi (Google'ı bağlı ofisler, her biri kendi bağlamında)
 */
import { ROTALAR } from "./rotalar.generated";
import { kimlikDogrula, izinliMi } from "./kimlik";
import { oturumCoz } from "./oturum";
import { davetBaglamiIcinde } from "./davet-baglam";
import { istekIcinde, prisma } from "../lib/db";
import { kiracilikIcinde, platformOlarak, KiracilikHatasi } from "../lib/kiracilik";
import { YetkiHatasi } from "../lib/guvenlik/yetki";
import { tamYedek, yedegiDepola } from "../lib/services/yedek";
import { tumOfislerdeGoogleSenkron } from "../lib/services/senkron";

export interface Env {
  ASSETS: { fetch: (r: Request) => Promise<Response> };
  DATABASE_URL: string; DIRECT_URL?: string; SUPABASE_URL: string; SUPABASE_ANON_KEY: string;
  SUPABASE_JWT_SECRET?: string; SUPABASE_SERVICE_ROLE_KEY?: string; IZINLI_EPOSTALAR: string;
  CRON_SECRET?: string; [k: string]: unknown;
}
const ortamiYukle = (env: Env) => { for (const [k, v] of Object.entries(env)) if (typeof v === "string") (globalThis as any).process.env[k] = v; };
const json = (v: unknown, status = 200) => Response.json(v, { status, headers: { "cache-control": "no-store" } });

/** Hata → yanıt: ofis bağlamı / yetki hataları kullanıcıya anlaşılır biçimde döner */
const hataYaniti = (e: unknown) => {
  if (e instanceof YetkiHatasi) return json({ hata: "YETKI", mesaj: e.message }, 403);
  if (e instanceof KiracilikHatasi) { console.error("Kiracılık hatası:", e.message); return json({ hata: "KIRACILIK", mesaj: "Bu istek bir ofis bağlamı gerektiriyor" }, 500); }
  return json({ hata: "SUNUCU", mesaj: String((e as Error)?.message ?? e).slice(0, 400) }, 500);
};

export async function apiIsle(req: Request, env: Env): Promise<Response> {
  const url = new URL(req.url);
  if (url.pathname === "/api/yapilandirma") return json({ supabaseUrl: env.SUPABASE_URL, supabaseAnonKey: env.SUPABASE_ANON_KEY });

  const rota = (() => {
    for (const r of ROTALAR) {
      const m = url.pathname.match(r.desen);
      if (m) return { r, m };
    }
    return null;
  })();
  if (!rota) return json({ hata: "BULUNAMADI" }, 404);
  const isle = rota.r.mod[req.method] as ((r: Request, c: { params: Promise<Record<string, string>> }) => Promise<Response>) | undefined;
  if (typeof isle !== "function") return json({ hata: "YONTEM" }, 405);
  const params = Promise.resolve(Object.fromEntries((rota.r.params as string[]).map((p, i) => [p, decodeURIComponent(rota.m[i + 1])])));

  // 1) Açık kapılar: sağlık kontrolü ve zamanlayıcı (CRON_SECRET) → platform bağlamı
  const cron = !!env.CRON_SECRET && req.headers.get("authorization") === `Bearer ${env.CRON_SECRET}`;
  if (url.pathname === "/api/saglik" || cron) {
    return istekIcinde(env.DATABASE_URL, () => platformOlarak(() => isle(req, { params })).catch(hataYaniti));
  }

  // 1b) v3.21 — Google'dan dönüş: oturum başlığı yoktur. Rota imzalı state'i doğrular, kullanıcıyı veritabanından
  //     yeniden denetler ve işi yalnızca o ofisin bağlamında yapar (src/app/api/entegrasyon/google/geri-donus/route.ts).
  if (url.pathname === "/api/entegrasyon/google/geri-donus") {
    return istekIcinde(env.DATABASE_URL, () => isle(req, { params }).catch(hataYaniti));
  }

  // 2) Oturum anahtarı (JWT) → e-posta
  const k = await kimlikDogrula(req, env);
  if ("hata" in k) return json({ hata: "KIMLIK", mesaj: k.hata }, k.durum);

  // 3a) v3.20 — Kurulum (migration uygulama): kullanıcı tablosu henüz yokken de çalışmalı (tavuk-yumurta).
  //     Yalnızca acil durum listesindeki (IZINLI_EPOSTALAR) e-postalar, platform bağlamında.
  if (url.pathname === "/api/kurulum") {
    if (!izinliMi(k.eposta, env.IZINLI_EPOSTALAR)) return json({ hata: "YETKI", mesaj: "Kurulum yalnızca platform yöneticisi içindir" }, 403);
    return istekIcinde(env.DATABASE_URL, () => platformOlarak(() => isle(req, { params })).catch(hataYaniti));
  }

  // 3) Davet kabul: giriş yeter, ofis gerekmez (kişi henüz bir ofiste değil)
  if (url.pathname === "/api/davet/kabul") {
    return istekIcinde(env.DATABASE_URL, () => davetBaglamiIcinde(k.eposta, () => isle(req, { params })).catch(hataYaniti));
  }

  // 4) E-posta → ofis + rol; istek o ofisin bağlamında çalışır
  return istekIcinde(env.DATABASE_URL, async () => {
    const o = await oturumCoz(prisma, k.eposta, env);
    if ("hata" in o) return json({ hata: o.kod, mesaj: o.hata }, o.durum);
    return kiracilikIcinde(o.baglam, () => isle(req, { params })).catch(hataYaniti);
  });
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    ortamiYukle(env);
    if (new URL(req.url).pathname.startsWith("/api/")) {
      try { return await apiIsle(req, env); } catch (e) { return json({ hata: "SUNUCU", mesaj: String((e as Error)?.message ?? e).slice(0, 400) }, 500); }
    }
    return env.ASSETS.fetch(req);
  },
  async scheduled(ev: { cron: string }, env: Env, ctx: { waitUntil: (p: Promise<unknown>) => void }) {
    ortamiYukle(env);
    // Zamanlayıcı tüm ofisler için çalışır → platform bağlamı (ofis süzgeci uygulanmaz)
    ctx.waitUntil(istekIcinde(env.DATABASE_URL, () => platformOlarak(async () => {
      if (ev.cron.startsWith("0 3")) {
        // Supabase Free 7 gün işlem görmeyen projeyi durdurur → günlük küçük sorgu + REST isteği
        await prisma.$queryRawUnsafe("SELECT 1");
        await fetch(`${env.SUPABASE_URL.replace(/\/$/, "")}/rest/v1/`, { headers: { apikey: env.SUPABASE_ANON_KEY } }).catch(() => {});
        await prisma.kayit.updateMany({ where: { durum: "ACTIVE", validUntil: { lt: new Date() } }, data: { durum: "EXPIRED" } });
      } else if (ev.cron.startsWith("0 4")) {
        await yedegiDepola(JSON.stringify(await tamYedek(prisma)), env);
      } else {
        // v3.21 — Google Kişiler: en uzun süredir eşitlenmeyen ofisler önce; her ofis kendi bağlamında
        if (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) await tumOfislerdeGoogleSenkron(prisma, { enFazla: 5, butceMs: 12_000 });
      }
    })));
  },
};