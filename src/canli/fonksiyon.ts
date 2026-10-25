/**
 * Anahtar CRM v3.43 · 25 Ekim 2026
 * SUPABASE EDGE FUNCTION GİRİŞİ ("api") — asıl sunucu kodu burada çalışır (istek başına 2 sn işlemci; Cloudflare ücretsizde 10 ms).
 * Paket: scripts/fonksiyon-paketle.ts → supabase/functions/api/index.js (Prisma'nın Deno istemcisi, tek dosya).
 * Yayın: .github/workflows/supabase-fonksiyon.yml (main'e her gönderimde). Ayrıntı: src/canli/uzak.ts.
 *
 * Güven: Cloudflare aracısının ilettiği gizli değerler (x-anahtar-ortam) yalnızca kapı anahtarı (x-anahtar-kapi) bu projenin
 * service_role anahtarıysa kullanılır. Kapısız istek de çalışır (oturum anahtarı her zamanki gibi doğrulanır), ama yalnızca
 * Supabase'in kendi ortam değerleriyle (veritabanı SUPABASE_DB_URL). İç yollar (/_ic/…) kapı ister.
 */
import nodeProcess from "node:process";
import { apiIsle, zamanlanmisIs, epostaIsle, type Env } from "./worker";
import { BASLIK_ORTAM, BASLIK_KAPI, BASLIK_ASIL, IC_ZAMANLAYICI, IC_EPOSTA, ortamCoz } from "./uzak";

declare const Deno: { env: { toObject(): Record<string, string> }; serve(h: (req: Request) => Response | Promise<Response>): unknown };
const g = globalThis as any;
g.process ??= nodeProcess;
g.process.env ??= {};

const json = (v: unknown, status = 200) => new Response(JSON.stringify(v), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

/** Doğrulanmış kapı anahtarları (yalnızca bu Deno örneğinin belleğinde) */
const gecerliKapilar = new Set<string>();
export async function kapiGecerliMi(kapi: string, kendi: Record<string, string>, getir: typeof fetch = fetch): Promise<boolean> {
  if (!kapi || kapi.length < 20) return false;
  if (gecerliKapilar.has(kapi)) return true;
  const adaylar = [kendi.SUPABASE_SERVICE_ROLE_KEY];
  try { const yeni = JSON.parse(kendi.SUPABASE_SECRET_KEYS ?? "{}"); if (yeni && typeof yeni === "object") adaylar.push(...Object.values(yeni).map(String)); } catch { /* yok */ }
  let ok = adaylar.some((a) => !!a && a === kapi);
  if (!ok && kendi.SUPABASE_URL) {
    // Biçim farklıysa (eski JWT ↔ yeni sb_secret_…) Supabase'e sor: yönetici uç noktası yalnızca service_role ile 200 döner
    try { const r = await getir(`${kendi.SUPABASE_URL.replace(/\/$/, "")}/auth/v1/admin/users?per_page=1`, { headers: { apikey: kapi, authorization: `Bearer ${kapi}` } }); ok = r.status === 200; } catch { ok = false; }
  }
  if (ok) gecerliKapilar.add(kapi);
  return ok;
}

/** Ortam: Supabase'in kendi değerleri + (kapı geçerliyse) Cloudflare'in ilettikleri. Veritabanı adresi yoksa SUPABASE_DB_URL. */
export function ortamKur(kendi: Record<string, string>, iletilen: Record<string, string>, guven: boolean): Env {
  const o: Record<string, string> = { ...kendi, ...(guven ? iletilen : {}) };
  if (!o.DATABASE_URL && o.SUPABASE_DB_URL) o.DATABASE_URL = o.SUPABASE_DB_URL;
  return o as unknown as Env;
}

/** Yanıta tanı işareti: istek Supabase'de işlendi mi, aracının kapısı geçerli miydi (gizli değer içermez) */
const isaretle = (r: Response, guven: boolean) => {
  try { r.headers.set("x-anahtar-sunucu", "supabase"); r.headers.set("x-anahtar-kapi-durum", guven ? "gecerli" : "yok"); return r; }
  catch { const h = new Headers(r.headers); h.set("x-anahtar-sunucu", "supabase"); h.set("x-anahtar-kapi-durum", guven ? "gecerli" : "yok"); return new Response(r.body, { status: r.status, statusText: r.statusText, headers: h }); }
};

export async function fonksiyonIsle(req: Request, kendi: Record<string, string>): Promise<Response> {
  const kapi = req.headers.get(BASLIK_KAPI) ?? "";
  const guven = await kapiGecerliMi(kapi, kendi);
  return isaretle(await fonksiyonIsleIc(req, kendi, guven), guven);
}

async function fonksiyonIsleIc(req: Request, kendi: Record<string, string>, guven: boolean): Promise<Response> {
  const env = ortamKur(kendi, ortamCoz(req.headers.get(BASLIK_ORTAM)), guven);
  for (const [k, v] of Object.entries(env)) if (typeof v === "string") g.process.env[k] = v;

  const u = new URL(req.url);
  const yol = u.pathname.replace(/^.*?\/api(?=\/|$)/, "") || "/"; // /functions/v1/api/durum · /api/durum → /durum
  if (yol.startsWith("/_ic/")) {
    if (!guven) return json({ hata: "YETKI", mesaj: "İç yol yalnızca aracı içindir" }, 403);
    if (yol === IC_ZAMANLAYICI) { const { cron } = await req.json(); await zamanlanmisIs(String(cron ?? ""), env); return json({ ok: true }); }
    if (yol === IC_EPOSTA) {
      let red: string | null = null;
      const h = req.headers;
      await epostaIsle({ from: h.get("x-eposta-from") ?? "", to: h.get("x-eposta-to") ?? "", raw: new Uint8Array(await req.arrayBuffer()), rawSize: Number(h.get("content-length") ?? 0) || 0,
        headers: { get: (ad: string) => (ad.toLowerCase() === "subject" ? h.get("x-eposta-subject") : null) }, setReject: (n: string) => { red = n; } }, env);
      return json({ ok: !red, red });
    }
    return json({ hata: "BULUNAMADI" }, 404);
  }
  // Uygulama asıl adresi görür (Google dönüş adresi, gelen kutusu köprü adresi aynı kalır)
  const asil = guven && req.headers.get(BASLIK_ASIL) ? new URL(req.headers.get(BASLIK_ASIL)!) : new URL("https://anahtarcrm.local/api" + yol + u.search);
  const h = new Headers(req.headers); h.delete(BASLIK_ORTAM); h.delete(BASLIK_KAPI); h.delete(BASLIK_ASIL);
  const ic = new Request(asil.toString(), { method: req.method, headers: h, body: req.method === "GET" || req.method === "HEAD" ? undefined : await req.arrayBuffer(), redirect: "manual" });
  try { return await apiIsle(ic, env); }
  catch (e) { console.error("api:", e); return json({ hata: "SUNUCU", mesaj: String((e as Error)?.message ?? e).slice(0, 400) }, 500); }
}

if (typeof Deno !== "undefined" && typeof Deno.serve === "function" && !g.__ANAHTAR_TEST__) {
  Deno.serve((req) => fonksiyonIsle(req, Deno.env.toObject()));
}
