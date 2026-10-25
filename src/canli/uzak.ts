/**
 * Anahtar CRM v3.43 · 25 Ekim 2026
 * ÜCRETSİZ PLAN MİMARİSİ — Cloudflare Worker yalnızca ARACI, asıl sunucu kodu Supabase Edge Function'da ("api").
 *
 * Neden: Cloudflare Workers ücretsiz planı istek başına 10 ms işlemci süresi verir. Ölçüm (23 Ekim 2026, scripts/islemci-olc.ts):
 * Prisma ile en boş istek bile 12–28 ms, sıradan istekler 20–100 ms işlemci harcıyor → sayfalama ne yapılırsa yapılsın 503 (Hata 1102).
 * Supabase Edge Function'larda sınır istek başına 2 saniye (ücretsiz planda da) — aynı kod değişmeden orada çalışır.
 *
 * Akış:  tarayıcı → anahtarcrm.com/api/… (Cloudflare, ~1 ms aracı) → <SUPABASE_URL>/functions/v1/api/… (Supabase, asıl iş)
 *  - Adres, oturum, Google dönüş adresi değişmez: tarayıcı yine aynı alan adını görür; asıl adres başlıkta (x-anahtar-asil-url) taşınır.
 *  - Gizli değerler (AI anahtarı, Google, CRON…) Cloudflare'de durur; aracı onları her istekte başlıkta (x-anahtar-ortam) iletir.
 *    Fonksiyon bu başlığa YALNIZCA kapı anahtarı (x-anahtar-kapi = Supabase service_role anahtarı) doğrulanırsa güvenir.
 *  - Zamanlayıcı ve e-posta işleyicisi de aynı yoldan iletilir (/_ic/zamanlayici, /_ic/eposta).
 *  - Fonksiyon henüz yayında değilse (404 NOT_FOUND / açılış hatası) aracı isteği eskisi gibi kendisi işler: uygulama hiç durmaz.
 */
export const BASLIK_ORTAM = "x-anahtar-ortam", BASLIK_KAPI = "x-anahtar-kapi", BASLIK_ASIL = "x-anahtar-asil-url";
export const IC_ZAMANLAYICI = "/_ic/zamanlayici", IC_EPOSTA = "/_ic/eposta";

/** Fonksiyonun adresi. API_UZAK=0 → aracı kapalı (eski yol). API_UZAK=https://… → başka bir adres. */
export function uzakAdres(env: Record<string, unknown>): string | null {
  const ayar = typeof env.API_UZAK === "string" ? env.API_UZAK.trim() : "";
  if (ayar === "0" || ayar.toLowerCase() === "kapali") return null;
  if (/^https?:\/\//.test(ayar)) return ayar.replace(/\/$/, "");
  const su = typeof env.SUPABASE_URL === "string" ? env.SUPABASE_URL.replace(/\/$/, "") : "";
  return su ? `${su}/functions/v1/api` : null;
}

const b64 = (s: string) => { const b = new TextEncoder().encode(s); let x = ""; for (let i = 0; i < b.length; i += 0x8000) x += String.fromCharCode(...b.subarray(i, i + 0x8000)); return btoa(x); };
const b64Coz = (s: string) => new TextDecoder().decode(Uint8Array.from(atob(s), (c) => c.charCodeAt(0)));

/** Cloudflare ortamındaki metin değerleri (gizliler dahil) → başlık */
export function ortamPaketle(env: Record<string, unknown>): string {
  const o: Record<string, string> = {};
  for (const [k, v] of Object.entries(env)) if (typeof v === "string" && k !== "API_UZAK") o[k] = v;
  return b64(JSON.stringify(o));
}
export function ortamCoz(baslik: string | null): Record<string, string> {
  if (!baslik) return {};
  try { const o = JSON.parse(b64Coz(baslik)); return o && typeof o === "object" ? Object.fromEntries(Object.entries(o).filter(([, v]) => typeof v === "string")) as Record<string, string> : {}; } catch { return {}; }
}

/** Aracı başlıkları: kapı + ortam + asıl adres */
export function araciBasliklari(env: Record<string, unknown>, asilUrl: string, temel?: HeadersInit): Headers {
  const h = new Headers(temel);
  h.set(BASLIK_ORTAM, ortamPaketle(env));
  h.set(BASLIK_KAPI, typeof env.SUPABASE_SERVICE_ROLE_KEY === "string" ? env.SUPABASE_SERVICE_ROLE_KEY : "");
  h.set(BASLIK_ASIL, asilUrl);
  h.delete("host");
  return h;
}

/**
 * Supabase ağ geçidinin kendi hatası mı (fonksiyon yok / açılamadı / sınır)? Uygulamanın hataları `hata` alanı taşır,
 * Supabase'inkiler `code` (NOT_FOUND, BOOT_ERROR, WORKER_LIMIT…). Bu durumda aracı isteği kendisi işler.
 */
export async function gecitHatasiMi(r: Response): Promise<boolean> {
  if (![404, 500, 502, 503, 504, 546].includes(r.status)) return false;
  if (r.status === 502 || r.status === 504 || r.status === 546) return true;
  if (!(r.headers.get("content-type") ?? "").includes("json")) return r.status !== 404;
  try { const j: any = await r.clone().json(); return !!j && typeof j === "object" && !("hata" in j) && ("code" in j || "message" in j || "msg" in j); } catch { return false; }
}
