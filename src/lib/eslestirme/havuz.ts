/**
 * Anahtar CRM v3.24 · 10 Ekim 2026
 * HAVUZ AKIŞI — bir talep için portföyler hangi sırayla aranır / sunulur:
 *   1. Yetkili portföy   — yetki belgeli kendi portföyünüz (komisyon garantili, hemen sunulur)
 *   2. CRM portföyü      — sizin kaydınız, malike doğrudan ulaşırsınız ama yetki yok (önce yetki alın)
 *   3. Partner portföyü  — başka emlakçının / iş ortağının (WhatsApp grupları; ortak satış, komisyon paylaşımı)
 *   4. Web ilanı         — portal ilanı (malike ulaşılırsa portföy edinme fırsatı)
 *   5. Hiçbiri yoksa     — portallarda ara + gruplara talep mesajı (yeni portföy fırsatı)
 * Aynı uygunlukta önce üst katman gösterilir; katman skoru değiştirmez.
 */
export type HavuzKatmani = "YETKILI" | "CRM" | "PARTNER" | "WEB";
export const HAVUZ_KATMANLARI: { kod: HavuzKatmani; sira: number; etiket: string; aciklama: string }[] = [
  { kod: "YETKILI", sira: 1, etiket: "Yetkili portföy", aciklama: "Yetki belgeli — hemen sunulabilir" },
  { kod: "CRM", sira: 2, etiket: "CRM portföyü", aciklama: "Sizin kaydınız — sunmadan önce yetki alın" },
  { kod: "PARTNER", sira: 3, etiket: "Partner portföyü", aciklama: "Emlakçı / iş ortağı — ortak satış" },
  { kod: "WEB", sira: 4, etiket: "Web ilanı", aciklama: "Portal ilanı — malike ulaşın, portföy edinin" },
];
export interface HavuzGirdi { havuz?: string | null; yetkili?: boolean | null; ilanSahibiTipi?: string | null; veriKanali?: string | null }
export function havuzKatmani(v: HavuzGirdi): HavuzKatmani {
  if (v.havuz === "DIS_ILAN" || v.ilanSahibiTipi === "PORTAL" || ["SAHIBINDEN", "HEPSIEMLAK", "EMLAKJET"].includes(v.veriKanali ?? "")) return "WEB";
  if (v.havuz === "PARTNER" || v.ilanSahibiTipi === "EMLAKCI" || v.ilanSahibiTipi === "PARTNER") return "PARTNER";
  if (v.yetkili) return "YETKILI";
  return "CRM";
}
export const katmanOf = (k: HavuzKatmani) => HAVUZ_KATMANLARI.find((x) => x.kod === k)!;

/** Portföy edinme fırsatı: dış (web) ilan, en az `enAz` aktif talebe `esik` ve üzeri skorla uyuyorsa */
export function portfoyEdinmeFirsati(skorlar: number[], esik = 80, enAz = 2): { var: boolean; sayi: number } {
  const sayi = skorlar.filter((s) => s >= esik).length;
  return { var: sayi >= enAz, sayi };
}