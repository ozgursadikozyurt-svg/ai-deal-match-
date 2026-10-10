/**
 * Anahtar CRM v3.23 · 10 Ekim 2026
 * Anahtar CRM v3.19 — Fırsat önceliği.
 * Eşleşmenin KİMİN arasında olduğu kazancı belirler: komisyon iki taraftan da alınabiliyorsa fırsat değerlidir.
 *  · mülk sahibi (sahibinden) portföyü ↔ doğrudan müşteri talebi  → ÖNCELİKLİ (iki taraf da komisyon)
 *  · bir taraf emlakçı                                           → NORMAL     (emlakçı payı paylaşılır)
 *  · emlakçı talebi ↔ emlakçı portföyü                           → DUSUK      (komisyon paylaşılır; küçük kirada anlamsız)
 * Saf fonksiyondur; kimlik tespiti `kimOf` ile yapılır.
 * v3.22.1 — sahiplik: ★ Benim olan taraf (kendi portföyüm / kendi müşterim) emlakçı görünse de komisyonu bana kalır;
 *   eşleşmenin bir tarafı Benim ise fırsat ÖNCELİKLİ'dir. ◆ Ofisim olan taraf doğrudan (aracısız) sayılır.
 *   (Önceden kendi ilanım WhatsApp grubundan "emlakçı" olarak geldiği için eşleşme "Normal" görünüyordu.)
 */
import type { KimTur } from "../domain/kim";

export type FirsatKademe = "ONCELIKLI" | "NORMAL" | "DUSUK";
export interface FirsatSonuc {
  kademe: FirsatKademe;
  /** kısa rozet metni */ etiket: string;
  /** tek satırlık neden */ aciklama: string;
  /** sıralama için: büyük = önce */ sira: number;
  /** tahmini toplam komisyon (TL); fiyat bilinmiyorsa null */ tahminiKomisyon: number | null;
  /** her iki uçta doğrudan (aracısız) taraf sayısı: 0–2 */ dogrudanTaraf: number;
}

/** Aracısız (komisyonu tam alınabilen) sayılan taraflar. */
const DOGRUDAN: ReadonlySet<KimTur> = new Set<KimTur>(["YETKILI", "SAHIP", "WEB_SAHIBI", "MUSTERI", "MUTEAHHIT", "FIRMA"]);
export const dogrudanMi = (k: KimTur) => DOGRUDAN.has(k);

/** Komisyon varsayımları (ayarlanabilir): satılıkta her taraftan %2, kiralıkta her taraftan 1 aylık kira. */
export const KOMISYON = { satilikOran: 0.02, kiraAy: 1, emlakciPayi: 0.5 };
export const FIRSAT_KADEME_ETIKET: Record<FirsatKademe, string> = { ONCELIKLI: "Öncelikli", NORMAL: "Normal", DUSUK: "Düşük" };

export type FirsatSahiplik = "BENIM" | "OFIS" | null | undefined;
export function firsatDegerlendir(
  talepKim: KimTur, portfoyKim: KimTur,
  o: { islemTipi: string; fiyat?: number | null; butce?: number | null; talepSahip?: FirsatSahiplik; portfoySahip?: FirsatSahiplik },
): FirsatSonuc {
  const t = dogrudanMi(talepKim) || !!o.talepSahip, p = dogrudanMi(portfoyKim) || !!o.portfoySahip;
  const dogrudanTaraf = Number(t) + Number(p);
  const baz = o.fiyat ?? o.butce ?? null;
  const taraf = (d: boolean) => (d ? 1 : KOMISYON.emlakciPayi);
  const tek = baz == null ? null : o.islemTipi === "KIRALIK" ? baz * KOMISYON.kiraAy : baz * KOMISYON.satilikOran;
  const tahminiKomisyon = tek == null ? null : Math.round(tek * (taraf(t) + taraf(p)));
  if (o.portfoySahip === "BENIM" || o.talepSahip === "BENIM") {
    const ne = o.portfoySahip === "BENIM" && o.talepSahip === "BENIM" ? "Talep de portföy de benim" : o.portfoySahip === "BENIM" ? "Benim portföyüm" : "Benim müşterim";
    return { kademe: "ONCELIKLI", etiket: "Öncelikli", aciklama: `${ne} — ${dogrudanTaraf === 2 ? "iki taraftan komisyon" : "komisyon bende, karşı taraf paylaşılır"}`, sira: 3, tahminiKomisyon, dogrudanTaraf };
  }
  if (dogrudanTaraf === 2) return { kademe: "ONCELIKLI", etiket: "Öncelikli", aciklama: "Mülk sahibi ↔ doğrudan müşteri — iki taraftan komisyon", sira: 3, tahminiKomisyon, dogrudanTaraf };
  if (dogrudanTaraf === 1) return { kademe: "NORMAL", etiket: "Normal", aciklama: t ? "Doğrudan müşteri, portföy emlakçıdan — komisyon paylaşılır" : "Mülk sahibi, talep emlakçıdan — komisyon paylaşılır", sira: 2, tahminiKomisyon, dogrudanTaraf };
  return { kademe: "DUSUK", etiket: "Düşük", aciklama: "Emlakçı ↔ emlakçı — komisyon paylaşılır, ikinci planda", sira: 1, tahminiKomisyon, dogrudanTaraf };
}
