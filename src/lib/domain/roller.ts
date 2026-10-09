/**
 * Anahtar CRM v3.22 · 9 Ekim 2026
 * Kişi rolleri: 11 sistem rolü + Ayarlar › "Kişi rolleri"nden eklenen özel roller (koda dokunmadan).
 * Veritabanında Kisi.roller artık serbest metin dizisidir; rol tanımları (özel roller ve yeniden adlandırmalar) Ayar tablosunda "roller" anahtarıyla JSON olarak durur.
 */
import { z } from "zod";

export const SISTEM_ROLLERI: readonly (readonly [string, string])[] = [
  ["ALICI", "Alıcı"], ["SATICI", "Satıcı"], ["KIRACI", "Kiracı"], ["KIRAYA_VEREN", "Kiraya veren"],
  ["YATIRIMCI", "Yatırımcı"], ["YATIRIMCI_VIP", "Yatırımcı ++"], ["AL_SAT", "Al-sat"], ["EMLAKCI", "Emlakçı"],
  ["MUTEAHHIT", "Müteahhit"], ["FIRMA", "Firma"], ["IS_ORTAGI", "İş ortağı"],
];

export const ROL_KODU = /^[A-Z0-9_]{2,40}$/;
export const RolTanimSchema = z.object({ kod: z.string().regex(ROL_KODU), etiket: z.string().trim().min(2).max(40) });
export type RolTanim = z.infer<typeof RolTanimSchema>;
export const ROL_SINIRI = 60;

/** Saklanan değeri güvenli listeye çevirir (bozuk kayıtlar atılır, tekrarlar teke iner). */
export function rolNormalize(deger: unknown): RolTanim[] {
  if (!Array.isArray(deger)) return [];
  const gorulen = new Set<string>();
  const sonuc: RolTanim[] = [];
  for (const x of deger) {
    const p = RolTanimSchema.safeParse(x);
    if (p.success && !gorulen.has(p.data.kod)) { gorulen.add(p.data.kod); sonuc.push(p.data); }
  }
  return sonuc.slice(0, ROL_SINIRI);
}

/** Ekranlarda kullanılan tam liste: sistem rolleri (varsa yeniden adlandırılmış etiketle) + özel roller. */
export function rolListesi(ozel?: readonly RolTanim[] | null): [string, string][] {
  const ad = new Map((ozel ?? []).map((r) => [r.kod, r.etiket] as const));
  const liste: [string, string][] = SISTEM_ROLLERI.map(([k, l]) => [k, ad.get(k) ?? l]);
  for (const r of ozel ?? []) if (!SISTEM_ROLLERI.some(([k]) => k === r.kod)) liste.push([r.kod, r.etiket]);
  return liste;
}
export const sistemRoluMu = (kod: string) => SISTEM_ROLLERI.some(([k]) => k === kod);

/** "Banka personeli" → BANKA_PERSONELI (Türkçe harfler sadeleşir); çakışırsa _2, _3… eklenir. */
export function rolKoduUret(ad: string, mevcut: readonly string[]): string {
  const taban = ad.trim().toLocaleUpperCase("tr").replace(/İ/g, "I").replace(/Ç/g, "C").replace(/Ş/g, "S").replace(/Ğ/g, "G").replace(/Ü/g, "U").replace(/Ö/g, "O")
    .replace(/[^A-Z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 34) || "ROL";
  const kod0 = taban.length < 2 ? taban + "_" : taban;
  let kod = kod0;
  for (let i = 2; mevcut.includes(kod); i++) kod = `${kod0}_${i}`;
  return kod;
}
