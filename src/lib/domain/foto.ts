/**
 * Anahtar CRM v3.13 · 3 Ekim 2026
 * Portföy fotoğrafı kuralları — demo ve sunucu aynı sınırları kullanır.
 * Fotoğraf telefonda / tarayıcıda küçültülür (uzun kenar 1600 px, JPEG) ve öyle yüklenir: 4–8 MB'lık çekim ≈ 250–400 KB olur.
 * 8 fotoğraflı 1.000 portföy ≈ 2,5–3 GB eder; Supabase ücretsiz katmanı 1 GB'tır (≈ 350 portföy). Bkz. ALTYAPI §41.
 */
export const FOTO_SINIR = 8;
export const FOTO_UZUN_KENAR = 1600;
export const FOTO_KALITE = 0.82;
export const FOTO_KUCUK_KENAR = 360;
export const FOTO_EN_BUYUK_BAYT = 1_500_000;
export const FOTO_TURLERI = ["image/jpeg", "image/png", "image/webp"] as const;
export interface FotoMeta { id: string; ad: string; en: number; boy: number; boyut: number }

/** Küçültülmüş boyut (oran korunur, büyütme yapılmaz) */
export function fotoBoyutu(en: number, boy: number, uzunKenar = FOTO_UZUN_KENAR): { en: number; boy: number } {
  const o = Math.min(1, uzunKenar / Math.max(en, boy, 1));
  return { en: Math.max(1, Math.round(en * o)), boy: Math.max(1, Math.round(boy * o)) };
}
/** Yükleme denetimi: tür, boyut, adet. Hata metni döner; sorun yoksa null. */
export function fotoDenetle(d: { tur: string; boyut: number }, mevcutSayi: number): string | null {
  if (mevcutSayi >= FOTO_SINIR) return `Bir portföye en fazla ${FOTO_SINIR} fotoğraf eklenebilir`;
  if (!(FOTO_TURLERI as readonly string[]).includes(d.tur)) return "Yalnızca JPG, PNG ya da WebP fotoğraf yüklenebilir";
  if (d.boyut > FOTO_EN_BUYUK_BAYT) return "Fotoğraf küçültülmeden gönderilmiş (1,5 MB üstü)";
  if (d.boyut < 200) return "Dosya boş görünüyor";
  return null;
}
/** Depodaki yol: portfoy/<kayitId>/<fotoId>.jpg */
/// v3.20 — yol ofis klasörüyle başlar: <ofisId>/<kayitId>/<fotoId>.jpg
/// v3.19 ve öncesinde yüklenmiş fotoğrafların yolu (<kayitId>/…) olduğu gibi kalır ve okunmaya devam eder.
export const fotoYolu = (ofisId: string, kayitId: string, fotoId: string, tur = "image/jpeg") => `${ofisId}/${kayitId}/${fotoId}.${tur === "image/png" ? "png" : tur === "image/webp" ? "webp" : "jpg"}`;