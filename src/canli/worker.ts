/**
 * Anahtar CRM v3.14 · 3 Ekim 2026
 * AŞAMA 7 — Cloudflare Worker girişi. Tek proje: arayüz (statik dosyalar, ASSETS) + /api (sunucu kodu) + zamanlanmış işler.
 *  - /api/yapilandirma, /api/saglik → açık (giriş ekranının ihtiyacı / sağlık kontrolü)
 *  - diğer /api/* → Supabase oturumu + e-posta izin listesi (src/canli/kimlik.ts)
 *  - Zamanlayıcı: her gün 03:00 (TR 06:00) uyanık tutma + süresi dolanları pasife alma; pazar 04:00 haftalık yedek
 */
import { ROTALAR } from "./rotalar.generated";
import { kimlikDogrula } from "./kimlik";
import { istekIcinde, prisma } from "../lib/db";
import { tamYedek, yedegiDepola } from "../lib/services/yedek";

export interface Env {
  ASSETS: { fetch: (r: Request) => Promise<Response> };
  DATABASE_URL: string; DIRECT_URL?: string; SUPABASE_URL: string; SUPABASE_ANON_KEY: string;
  SUPABASE_JWT_SECRET?: string; SUPABASE_SERVICE_ROLE_KEY?: string; IZINLI_EPOSTALAR: string;
  CRON_SECRET?: string; [k: string]: unknown;
}
const ortamiYukle = (env: Env) => { for (const [k, v] of Object.entries(env)) if (typeof v === "string") (globalThis as any).process.env[k] = v; };
const json = (v: unknown, status = 200) => Response.json(v, { status, headers: { "cache-control": "no-store" } });

export async function apiIsle(req: Request, env: Env): Promise<Response> {
  const url = new URL(req.url);
  if (url.pathname === "/api/yapilandirma") return json({ supabaseUrl: env.SUPABASE_URL, supabaseAnonKey: env.SUPABASE_ANON_KEY });
  const cron = !!env.CRON_SECRET && req.headers.get("authorization") === `Bearer ${env.CRON_SECRET}`;
  if (url.pathname !== "/api/saglik" && !cron) {
    const k = await kimlikDogrula(req, env);
    if ("hata" in k) return json({ hata: "KIMLIK", mesaj: k.hata }, k.durum);
  }
  for (const r of ROTALAR) {
    const m = url.pathname.match(r.desen);
    if (!m) continue;
    const isle = r.mod[req.method];
    if (typeof isle !== "function") return json({ hata: "YONTEM" }, 405);
    const params = Object.fromEntries(r.params.map((p, i) => [p, decodeURIComponent(m[i + 1])]));
    return istekIcinde(env.DATABASE_URL, () => isle(req, { params: Promise.resolve(params) }));
  }
  return json({ hata: "BULUNAMADI" }, 404);
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
    ctx.waitUntil(istekIcinde(env.DATABASE_URL, async () => {
      if (ev.cron.startsWith("0 3")) {
        // Supabase Free 7 gün işlem görmeyen projeyi durdurur → günlük küçük sorgu + REST isteği
        await prisma.$queryRawUnsafe("SELECT 1");
        await fetch(`${env.SUPABASE_URL.replace(/\/$/, "")}/rest/v1/`, { headers: { apikey: env.SUPABASE_ANON_KEY } }).catch(() => {});
        await prisma.kayit.updateMany({ where: { durum: "ACTIVE", validUntil: { lt: new Date() } }, data: { durum: "EXPIRED" } });
      } else {
        await yedegiDepola(JSON.stringify(await tamYedek(prisma)), env);
      }
    }));
  },
};