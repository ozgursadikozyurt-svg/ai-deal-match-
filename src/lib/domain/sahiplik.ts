/**
 * Anahtar CRM v3.23 · 10 Ekim 2026
 * "Benim / Ofisim" — kaydın kime ait olduğu (danışmanın kendi talebi / portföyü, ofis ekibinin, ya da başkasının).
 *
 * WhatsApp gruplarından gelen mesajların içinde danışmanın KENDİ ilanları ve ofis arkadaşlarının ilanları da vardır;
 * bunlar hızla ayırt edilebilmeli. Sıra:
 *  1. Kayda elle konan işaret (Kayit.isaret: BENIM · OFIS · DIS) her zaman geçerlidir.
 *  2. Yoksa telefon: gönderen telefonu ya da kayda bağlı kişilerin telefonu "benim" / "ofis" listesindeyse.
 *  3. Yoksa ad: gönderen adı / bağlı kişinin adı "benim" adlarından biriyse; firma adı (gönderen şirketi, kişinin şirketi
 *     ya da gönderen adının içinde) ofis adlarından biriyse.
 * Portföy paylaşım imzasındaki ad, telefon ve firma kendiliğinden listeye katılır (Ayarlar'da ayrıca yazmak gerekmez).
 * Saf fonksiyondur (veritabanı / arayüz yok); demo ve canlı aynı kodu kullanır.
 */
import { z } from "zod";

export type Sahiplik = "BENIM" | "OFIS";
export type SahiplikIsareti = "BENIM" | "OFIS" | "DIS";
export const SAHIPLIK_ETIKET: Record<Sahiplik, string> = { BENIM: "Benim", OFIS: "Ofisim" };

const liste = (n: number) => z.array(z.string().trim().min(1).max(120)).max(n).default([]);
export const SahiplikAyarSchema = z.object({
  /** danışmanın kendi telefonları (imzadaki telefon kendiliğinden eklenir) */
  benimTelefonlar: liste(10),
  /** danışmanın adları / takma adları ("Özgür Özyurt", "Özgür Bey") */
  benimAdlar: liste(10),
  /** ofis ekibinin telefonları */
  ofisTelefonlar: liste(60),
  /** ofis / firma adları ("Özyurtlar Gayrimenkul", "Redstone") ve ofis arkadaşlarının adları */
  ofisAdlar: liste(60),
});
export type SahiplikAyar = z.output<typeof SahiplikAyarSchema>;
export const SAHIPLIK_VARSAYILAN: SahiplikAyar = SahiplikAyarSchema.parse({});
export const sahiplikNormalize = (x: unknown): SahiplikAyar => { const p = SahiplikAyarSchema.safeParse(x ?? {}); return p.success ? p.data : SAHIPLIK_VARSAYILAN; };

/** Telefonu karşılaştırma anahtarına çevirir: son 10 hane ("0530 936 54 27" = "+905309365427") */
export const telAnahtar = (t?: string | null): string | null => { const d = String(t ?? "").replace(/\D/g, ""); return d.length >= 10 ? d.slice(-10) : null; };
/** Adı karşılaştırma anahtarına çevirir: küçük harf, Türkçe harfler sadeleşir, noktalama atılır, "(örnek)" gibi ekler düşer */
export const adAnahtar = (s?: string | null): string =>
  String(s ?? "").toLocaleLowerCase("tr").replace(/\([^)]*\)/g, " ").replace(/[çğıöşü]/g, (c) => ({ ç: "c", ğ: "g", ı: "i", ö: "o", ş: "s", ü: "u" })[c]!).replace(/[^a-z0-9]+/g, " ").trim();

export interface SahiplikKimligi { benimTel: Set<string>; benimAd: string[]; ofisTel: Set<string>; ofisAd: string[] }
/** Ayar + imza → karşılaştırma kümesi (bir kez kurulur, her kayıtta kullanılır) */
export function sahiplikKimligi(a: SahiplikAyar, imza?: { adSoyad?: string | null; telefon?: string | null; firma?: string | null } | null, ekOfisAdlari: string[] = []): SahiplikKimligi {
  const tel = (xs: (string | null | undefined)[]) => new Set(xs.map(telAnahtar).filter((x): x is string => !!x));
  const ad = (xs: (string | null | undefined)[]) => [...new Set(xs.map(adAnahtar).filter((x) => x.length >= 4))];
  const benimTel = tel([...a.benimTelefonlar, imza?.telefon]);
  return { benimTel, benimAd: ad([...a.benimAdlar, imza?.adSoyad]), ofisTel: new Set([...tel(a.ofisTelefonlar)].filter((x) => !benimTel.has(x))), ofisAd: ad([...a.ofisAdlar, imza?.firma, ...ekOfisAdlari]) };
}
export const kimlikBosMu = (k: SahiplikKimligi) => !k.benimTel.size && !k.benimAd.length && !k.ofisTel.size && !k.ofisAd.length;

export interface SahiplikGirdisi {
  isaret?: SahiplikIsareti | null;
  gondeAdi?: string | null; gondeTelefon?: string | null; gondeSirket?: string | null;
}
export interface SahiplikKisi { telefon?: string | null; ikincilTelefon?: string | null; adSoyad?: string | null; sirket?: string | null }
export interface SahiplikSonucu { tur: Sahiplik | null; neden: "ISARET" | "TELEFON" | "AD" | "FIRMA" | null }

/** Ad bir bütün olarak geçiyor mu ("ozgur ozyurt" ⊂ "ozgur ozyurt emlak") — kelime sınırında */
const adGeciyor = (metin: string, aday: string) => !!metin && (` ${metin} `).includes(` ${aday} `);

export function sahiplikOf(v: SahiplikGirdisi, kisiler: SahiplikKisi[], k: SahiplikKimligi): SahiplikSonucu {
  if (v.isaret === "BENIM" || v.isaret === "OFIS") return { tur: v.isaret, neden: "ISARET" };
  if (v.isaret === "DIS") return { tur: null, neden: "ISARET" };
  const teller = [v.gondeTelefon, ...kisiler.flatMap((x) => [x.telefon, x.ikincilTelefon])].map(telAnahtar).filter((x): x is string => !!x);
  if (teller.some((t) => k.benimTel.has(t))) return { tur: "BENIM", neden: "TELEFON" };
  if (teller.some((t) => k.ofisTel.has(t))) return { tur: "OFIS", neden: "TELEFON" };
  const adlar = [v.gondeAdi, ...kisiler.map((x) => x.adSoyad)].map(adAnahtar).filter(Boolean);
  if (adlar.some((a) => k.benimAd.some((b) => adGeciyor(a, b)))) return { tur: "BENIM", neden: "AD" };
  const firmalar = [v.gondeSirket, ...kisiler.map((x) => x.sirket), ...adlar].map(adAnahtar).filter(Boolean);
  if (firmalar.some((a) => k.ofisAd.some((b) => adGeciyor(a, b)))) return { tur: "OFIS", neden: "FIRMA" };
  return { tur: null, neden: null };
}

/** Süzgeç değeri: BENIM yalnızca benimkiler · OFISIM benim + ofisin · DIS ikisi de değil */
export type SahiplikSuzgeci = "BENIM" | "OFISIM" | "DIS";
export const sahiplikUyar = (s: Sahiplik | null, f: SahiplikSuzgeci) => (f === "BENIM" ? s === "BENIM" : f === "OFISIM" ? s != null : s == null);
