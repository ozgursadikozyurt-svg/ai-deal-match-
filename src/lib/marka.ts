/**
 * Anahtar CRM v3.13 · 3 Ekim 2026
 * Marka — ürün adı tek yerden değişir (ekran başlığı, logo yazısı, sayfa başlığı).
 * v3.9 kararı: "Anahtar CRM". Önceki adlar: Anakey (v3.7), Keylot (v3.6 önerisi), Anahtar.ai.
 * Kod, veritabanı ve dosya adları "anahtar" olarak kalır.
 */
export const MARKA = {
  ad: "Anahtar CRM",
  eskiAd: "Anahtar.ai",
  slogan: "Her talebe doğru mülk",
  renk: { murekkep: "#14213D", pirinc: "#C08A2E", deniz: "#0F6E6C", tas: "#F3F4F0" },
} as const;