/**
 * Anahtar CRM v3.23 · 10 Ekim 2026
 * Portföy fotoğrafları için dosya deposu — Supabase Storage (veritabanıyla aynı proje; ek hesap / ek anahtar gerekmez).
 * Kova ÖZELDİR (herkese açık değil): fotoğraflar yalnızca süreli, imzalı bağlantıyla görüntülenir / indirilir.
 * Ortam değişkenleri: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (yalnızca sunucuda), FOTO_KOVA (varsayılan "portfoy").
 * Kova bir kez oluşturulur: Supabase panosu › Storage › New bucket › "portfoy" (Public kapalı) — ya da kovayiHazirla().
 * Başka bir depoya (Cloudflare R2, Cloudinary) geçmek için yalnızca bu dosya değişir; veritabanında yalnızca dosya yolu tutulur.
 */
type Getir = typeof fetch;
export class DepoHatasi extends Error { constructor(public kod: "AYAR_YOK" | "DEPO", mesaj: string, public durum?: number) { super(mesaj); } }

interface Ayar { url: string; anahtar: string; kova: string }
export function depoAyari(env: Record<string, string | undefined> = process.env): Ayar {
  const url = env.SUPABASE_URL?.replace(/\/+$/, ""), anahtar = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anahtar) throw new DepoHatasi("AYAR_YOK", "SUPABASE_URL ve SUPABASE_SERVICE_ROLE_KEY tanımlı değil — fotoğraf deposu kapalı");
  return { url, anahtar, kova: env.FOTO_KOVA || "portfoy" };
}
const yolKodla = (yol: string) => yol.split("/").map(encodeURIComponent).join("/");
async function istek(a: Ayar, getir: Getir, yontem: string, yol: string, govde?: BodyInit, baslik: Record<string, string> = {}): Promise<Response> {
  const r = await getir(`${a.url}/storage/v1/${yol}`, { method: yontem, headers: { authorization: `Bearer ${a.anahtar}`, apikey: a.anahtar, ...baslik }, body: govde });
  if (!r.ok) throw new DepoHatasi("DEPO", `Depo ${r.status}: ${(await r.text()).slice(0, 200)}`, r.status);
  return r;
}
/** Özel kovayı yoksa oluşturur (dosya başına 2 MB, yalnızca görsel). Varsa dokunmaz. */
export async function kovayiHazirla(getir: Getir = fetch, a = depoAyari()): Promise<void> {
  try { await istek(a, getir, "POST", "bucket", JSON.stringify({ id: a.kova, name: a.kova, public: false, file_size_limit: 2_000_000, allowed_mime_types: ["image/jpeg", "image/png", "image/webp"] }), { "content-type": "application/json" }); }
  catch (e) { if (!(e instanceof DepoHatasi && (e.durum === 409 || /exist/i.test(e.message)))) throw e; }
}
export async function dosyaYukle(yol: string, veri: ArrayBuffer | Uint8Array, tur: string, getir: Getir = fetch, a = depoAyari()): Promise<void> {
  await istek(a, getir, "POST", `object/${a.kova}/${yolKodla(yol)}`, veri as BodyInit, { "content-type": tur, "cache-control": "max-age=31536000", "x-upsert": "true" });
}
export async function dosyalariSil(yollar: string[], getir: Getir = fetch, a = depoAyari()): Promise<void> {
  if (!yollar.length) return;
  await istek(a, getir, "DELETE", `object/${a.kova}`, JSON.stringify({ prefixes: yollar }), { "content-type": "application/json" });
}
/** Süreli görüntüleme / indirme bağlantıları (varsayılan 1 saat). `indir` verilirse tarayıcı o adla indirir. */
export async function imzaliBaglantilar(yollar: string[], saniye = 3600, getir: Getir = fetch, a = depoAyari()): Promise<Record<string, string>> {
  if (!yollar.length) return {};
  const r = await istek(a, getir, "POST", `object/sign/${a.kova}`, JSON.stringify({ expiresIn: saniye, paths: yollar }), { "content-type": "application/json" });
  const liste = (await r.json()) as { path: string; signedURL?: string; error?: string | null }[];
  return Object.fromEntries(liste.filter((x) => x.signedURL).map((x) => [x.path, `${a.url}/storage/v1${x.signedURL}`]));
}

// ───────── v3.23 — Gelen kutusu kovası (ham dosyalar: WhatsApp .zip / .txt, Revy .xlsx, .eml) ─────────
/** Portföy fotoğraflarından AYRI özel kova: tür kısıtı yok, dosya başına 16 MB. Ortam değişkeni: GELEN_KOVA (varsayılan "gelen"). */
export function gelenDepoAyari(env: Record<string, string | undefined> = process.env): Ayar {
  return { ...depoAyari(env), kova: env.GELEN_KOVA || "gelen" };
}
async function gelenKovayiHazirla(getir: Getir, a: Ayar): Promise<void> {
  try { await istek(a, getir, "POST", "bucket", JSON.stringify({ id: a.kova, name: a.kova, public: false, file_size_limit: 16_000_000 }), { "content-type": "application/json" }); }
  catch (e) { if (!(e instanceof DepoHatasi && (e.durum === 409 || /exist/i.test(e.message)))) throw e; }
}
/** Ham dosyayı yükler; kova henüz yoksa (ilk kullanım) oluşturup bir kez daha dener — kullanıcının Supabase panelinde yapacağı iş yoktur. */
export async function gelenYukle(yol: string, veri: ArrayBuffer | Uint8Array, getir: Getir = fetch, a = gelenDepoAyari()): Promise<void> {
  const yukle = () => istek(a, getir, "POST", `object/${a.kova}/${yolKodla(yol)}`, veri as BodyInit, { "content-type": "application/octet-stream", "x-upsert": "true" });
  try { await yukle(); }
  catch (e) {
    if (!(e instanceof DepoHatasi && e.kod === "DEPO" && (e.durum === 404 || e.durum === 400) && /bucket/i.test(e.message))) throw e;
    await gelenKovayiHazirla(getir, a); await yukle();
  }
}
export const gelenSil = (yollar: string[], getir: Getir = fetch, a = gelenDepoAyari()) => dosyalariSil(yollar, getir, a);
export const gelenBaglantilar = (yollar: string[], saniye = 3600, getir: Getir = fetch, a = gelenDepoAyari()) => imzaliBaglantilar(yollar, saniye, getir, a);
/** Dosyanın gövdesini akış olarak verir (tarayıcı imzalı bağlantıya ulaşamazsa sunucu üzerinden aktarmak için) */
export async function gelenIndir(yol: string, getir: Getir = fetch, a = gelenDepoAyari()): Promise<Response> {
  return istek(a, getir, "GET", `object/${a.kova}/${yolKodla(yol)}`);
}
