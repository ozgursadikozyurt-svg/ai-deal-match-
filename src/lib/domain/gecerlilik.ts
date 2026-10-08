/**
 * Anahtar CRM v3.21.1 · 8 Ekim 2026
 * Geçerlilik süresi (TTL) kuralları — sunucu ve demo aynı kodu kullanır.
 * v3.4: satılık ve kiralık ayrı (kiralık ilan/talep çabuk eskir: varsayılan portföy 45, talep 30 gün).
 * Acil talep: işlem süresinden kısa olan uygulanır.
 */
import { z } from "zod";

export const KIRALIK_ISLEMLER = ["KIRALIK", "DEVREN_KIRALIK", "GUNLUK_KIRALIK", "SEZONLUK_KIRALIK"] as const;
export const kiralikMi = (islem?: string | null) => !!islem && (KIRALIK_ISLEMLER as readonly string[]).includes(islem);

const gun = z.number().int().min(1).max(730);
export const TtlAyarSchema = z.object({ PORTFOY_SATILIK: gun, PORTFOY_KIRALIK: gun, TALEP_SATILIK: gun, TALEP_KIRALIK: gun, TALEP_ACIL: gun, DIS_ILAN: gun.default(90) });
export type TtlAyar = z.output<typeof TtlAyarSchema>;
/** v3.7 — dosyadan (portal listesi, meslektaş portföyü) gelen ilanlar: ilan tarihinden itibaren DIS_ILAN gün (varsayılan 90) */
export const TTL_VARSAYILAN: TtlAyar = { PORTFOY_SATILIK: 90, PORTFOY_KIRALIK: 45, TALEP_SATILIK: 60, TALEP_KIRALIK: 30, TALEP_ACIL: 30, DIS_ILAN: 90 };
export const TTL_ETIKET: Record<keyof TtlAyar, string> = { PORTFOY_SATILIK: "Portföy · satılık", PORTFOY_KIRALIK: "Portföy · kiralık", TALEP_SATILIK: "Talep · satılık", TALEP_KIRALIK: "Talep · kiralık", TALEP_ACIL: "Acil talep (üst sınır)", DIS_ILAN: "Dosyadan gelen ilan (portal / meslektaş)" };

/** v3.3 biçimi ({PORTFOY, TALEP, TALEP_ACIL}) gelirse yeni biçime çevirir */
export function ttlNormalize(x: unknown): TtlAyar {
  const p = TtlAyarSchema.safeParse(x);
  if (p.success) return p.data;
  const e = x as { PORTFOY?: number; TALEP?: number; TALEP_ACIL?: number } | null;
  return { ...TTL_VARSAYILAN, ...(e?.PORTFOY ? { PORTFOY_SATILIK: e.PORTFOY } : {}), ...(e?.TALEP ? { TALEP_SATILIK: e.TALEP } : {}), ...(e?.TALEP_ACIL ? { TALEP_ACIL: e.TALEP_ACIL } : {}) };
}

export function ttlGun(tip: "PORTFOY" | "TALEP", islem: string | undefined | null, aciliyet: string | undefined | null, ttl: TtlAyar = TTL_VARSAYILAN): number {
  const k = kiralikMi(islem);
  const temel = tip === "PORTFOY" ? (k ? ttl.PORTFOY_KIRALIK : ttl.PORTFOY_SATILIK) : k ? ttl.TALEP_KIRALIK : ttl.TALEP_SATILIK;
  return tip === "TALEP" && aciliyet === "ACIL" ? Math.min(temel, ttl.TALEP_ACIL) : temel;
}
export function varsayilanValidUntil(tip: "PORTFOY" | "TALEP", islem: string | undefined | null, aciliyet: string | undefined | null, simdi = new Date(), ttl: TtlAyar = TTL_VARSAYILAN): Date {
  return new Date(simdi.getTime() + ttlGun(tip, islem, aciliyet, ttl) * 86_400_000);
}