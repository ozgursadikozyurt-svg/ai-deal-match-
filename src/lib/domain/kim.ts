/**
 * Anahtar CRM v3.21.1 · 8 Ekim 2026
 * Kartlarda "kim" etiketi: talep/portföy kimden geldi — emlakçı mı, doğrudan müşteri / mülk sahibi mi, web ilanı mı.
 * Kaynak sırası: yetkili portföy → havuz (web ilanı) → bağlı kişinin kayıttaki rolü → kişinin rolleri → ilan sahibi tipi.
 */
export type KimTur = "YETKILI" | "WEB_SAHIBI" | "WEB_OFIS" | "EMLAKCI" | "SAHIP" | "MUSTERI" | "MUTEAHHIT" | "FIRMA" | "BELIRSIZ";
export interface KimSonuc { tur: KimTur; etiket: string; ad: string | null; ton: "iyi" | "mavi" | "uyari" | "notr" | "mor" }
const ETIKET: Record<KimTur, [string, KimSonuc["ton"]]> = {
  YETKILI: ["Yetkili portföy", "iyi"], WEB_SAHIBI: ["Web ilanı · sahibinden", "notr"], WEB_OFIS: ["Web ilanı · emlak ofisi", "notr"],
  EMLAKCI: ["Emlakçı", "mor"], SAHIP: ["Mülk sahibi", "iyi"], MUSTERI: ["Doğrudan müşteri", "iyi"], MUTEAHHIT: ["Müteahhit", "mavi"], FIRMA: ["Firma", "mavi"], BELIRSIZ: ["Kimden? belirsiz", "uyari"],
};
export interface KimVeri { tip: string; yetkili?: boolean | null; havuz?: string | null; ilanSahibiTipi?: string | null; gondeAdi?: string | null; portalIlanSahibi?: string | null; gondeSirket?: string | null; kisiler?: { kisiId: string; rol: string }[] }
export interface KimKisi { id: string; adSoyad: string; sirket?: string | null; roller: string[] }

export function kimOf(v: KimVeri, kisiler: KimKisi[]): KimSonuc {
  const bag = (v.kisiler ?? []).map((b) => ({ b, k: kisiler.find((x) => x.id === b.kisiId) })).filter((x) => x.k);
  const ilk = bag[0];
  const emlakciBag = bag.find((x) => x.b.rol === "EMLAKCI" || x.b.rol === "ARACI" || x.k!.roller.includes("EMLAKCI"));
  const ad = (k?: KimKisi) => (k ? (k.sirket && k.roller.includes("EMLAKCI") ? `${k.adSoyad} (${k.sirket})` : k.adSoyad) : null);
  const ist = v.ilanSahibiTipi ?? "BILINMIYOR";
  let tur: KimTur;
  let kim: string | null = null;
  if (v.tip === "PORTFOY" && v.yetkili) { tur = "YETKILI"; kim = ad(bag.find((x) => x.b.rol === "SAHIP")?.k ?? ilk?.k); }
  else if (v.tip === "PORTFOY" && v.havuz === "DIS_ILAN") { tur = ist === "MALIK" ? "WEB_SAHIBI" : "WEB_OFIS"; kim = v.portalIlanSahibi ?? v.gondeAdi ?? ad(ilk?.k); }
  else if (emlakciBag || ist === "EMLAKCI" || ist === "PARTNER") { tur = "EMLAKCI"; kim = ad(emlakciBag?.k) ?? v.gondeSirket ?? v.gondeAdi ?? null; }
  else if (ist === "MUTEAHHIT" || bag.some((x) => x.k!.roller.includes("MUTEAHHIT"))) { tur = "MUTEAHHIT"; kim = ad(ilk?.k) ?? v.gondeAdi ?? null; }
  else if (ist === "FIRMA") { tur = "FIRMA"; kim = ad(ilk?.k) ?? v.gondeSirket ?? v.gondeAdi ?? null; }
  else if (v.tip === "TALEP" ? !!ilk || ist === "MALIK" || !!v.gondeAdi : !!ilk || ist === "MALIK") { tur = v.tip === "TALEP" ? "MUSTERI" : "SAHIP"; kim = ad(ilk?.k) ?? v.gondeAdi ?? null; }
  else { tur = "BELIRSIZ"; kim = v.gondeAdi ?? null; }
  return { tur, etiket: ETIKET[tur][0], ad: kim, ton: ETIKET[tur][1] };
}