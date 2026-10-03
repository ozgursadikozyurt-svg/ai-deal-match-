/**
 * Anahtar CRM v3.13 · 3 Ekim 2026
 * Kişiyi arama ve WhatsApp bağlantıları. wa.me bağlantısı telefonda kurulu WhatsApp'ı açar;
 * WhatsApp Business kuruluysa (ya da ikisi birden kuruluysa telefon sorar) Business ile açılır.
 */
export const aramaLinki = (tel?: string | null) => (tel ? `tel:${tel.replace(/[^\d+]/g, "")}` : null);
export function whatsappLinki(tel?: string | null, mesaj?: string): string | null {
  const d = (tel ?? "").replace(/\D/g, "");
  const no = d.length === 10 && d[0] === "5" ? "90" + d : d.length === 11 && d.startsWith("05") ? "9" + d : d;
  if (no.length < 10) return null;
  return `https://wa.me/${no}${mesaj ? `?text=${encodeURIComponent(mesaj)}` : ""}`;
}
/** "Önder Sağlam" → "Merhaba Önder Bey/Hanım" yerine cinsiyet varsaymadan: "Merhaba Önder," */
export const selamMetni = (adSoyad: string, ek = "") => `Merhaba ${adSoyad.trim().split(/\s+/)[0]},${ek ? " " + ek : ""}`;

// ───────── v3.10 — telefon standardı ─────────
/** Girilen numaradan ülke kodu ve baştaki 0 atılmış Türkiye numarası (en fazla 10 hane) */
function trHaneler(ham: string): string {
  let d = ham.replace(/\D/g, "");
  if (d.startsWith("0090")) d = d.slice(4);
  else if (d.startsWith("90")) d = d.slice(2); // Türkiye'de ulusal numara 9 ile başlamaz: baştaki 90 her zaman ülke kodudur (yarım yazılmış "+90 532 1" dahil)
  if (d.startsWith("0")) d = d.slice(1);
  return d.slice(0, 10);
}
const yabanciMi = (ham: string) => /^\s*(\+|00)/.test(ham) && !/^\s*(\+|00)\s*90/.test(ham);
/** Kayıt biçimi: Türkiye "+905XXXXXXXXX" (10 hane), yabancı "+<8–15 hane>". Eksik ya da hatalıysa null. */
export function telStandart(ham?: string | null): string | null {
  if (!ham || !ham.trim()) return null;
  if (yabanciMi(ham)) { const d = ham.replace(/\D/g, "").replace(/^00/, ""); return d.length >= 8 && d.length <= 15 ? "+" + d : null; }
  const d = trHaneler(ham);
  return d.length === 10 ? "+90" + d : null;
}
/** Yazarken gösterilen biçim: "+90 5XX XXX XX XX" (yabancı numara olduğu gibi, yalnızca + ve rakam) */
export function telBicimle(ham?: string | null): string {
  if (!ham || !ham.trim()) return "";
  if (yabanciMi(ham)) return "+" + ham.replace(/\D/g, "").replace(/^00/, "").slice(0, 15);
  const d = trHaneler(ham);
  if (!d) return /^\s*\+/.test(ham) ? "+90 " : "";
  return "+90 " + [d.slice(0, 3), d.slice(3, 6), d.slice(6, 8), d.slice(8, 10)].filter(Boolean).join(" ");
}
/** Boş → null (sorun yok); tam → null; eksik/hatalı → kullanıcıya gösterilecek kısa uyarı */
export function telUyarisi(ham?: string | null): string | null {
  if (!ham || !ham.trim() || telStandart(ham)) return null;
  if (yabanciMi(ham)) return "Yabancı numara ülke koduyla 8–15 hane olmalı";
  const n = trHaneler(ham).length;
  return `Telefon eksik: ${10 - n} hane daha (örn. +90 532 111 22 33)`;
}