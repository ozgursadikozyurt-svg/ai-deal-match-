/**
 * Anahtar CRM v3.13 · 3 Ekim 2026
 * Toplu girişte "Zaten var" kontrolü — talepler dahil.
 *  - Portal ilanı: ilan no / bağlantı (en güçlü kanıt).
 *  - Talep (ve bağlantısız portföy): aynı kişi + tip + mülk tipi + işlem + oda + bütçe/fiyat + m² + konum anahtarı.
 *    Kişi adı yoksa gönderen telefonu; ikisi de yoksa ham metin kullanılır (yanlış "zaten var" demektense kaçırmak tercih).
 */
const n = (s?: string | null) => (s ?? "").toLocaleLowerCase("tr").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
const yuvarla = (x?: number | null) => (x == null ? "" : String(Math.round(Number(x) / 1000)));
export interface TekrarVeri {
  tip: string; mulkTipi: string; islemTipi: string; odaSayisi?: string | null;
  fiyat?: number | null; minFiyat?: number | null; maxFiyat?: number | null; m2?: number | null; minM2?: number | null; maxM2?: number | null;
  lokasyonlar: { ilceId?: number | null; mahalleId?: number | null; altBolgeId?: number | null }[];
  portalIlanNo?: string | null; portalUrl?: string | null; gondeTelefon?: string | null; hamMetin?: string | null;
}
export function tekrarAnahtarlari(v: TekrarVeri, kisiAdi?: string | null): string[] {
  const a: string[] = [];
  if (v.portalIlanNo) a.push("ilan:" + v.portalIlanNo);
  if (v.portalUrl) a.push("url:" + v.portalUrl.replace(/^https?:\/\/(www\.)?/, "").replace(/[?#].*$/, "").replace(/\/$/, ""));
  const kim = n(kisiAdi) || (v.gondeTelefon ?? "").replace(/\D/g, "").slice(-10);
  const lok = [...new Set(v.lokasyonlar.map((l) => (l.altBolgeId ? "a" + l.altBolgeId : l.mahalleId ? "m" + l.mahalleId : l.ilceId ? "i" + l.ilceId : "il")))].sort().join(",");
  const govde = [v.tip, v.mulkTipi, v.islemTipi, v.odaSayisi ?? "", yuvarla(v.fiyat ?? v.maxFiyat), yuvarla(v.minFiyat), v.m2 ?? v.minM2 ?? "", v.maxM2 ?? "", lok].join("|");
  if (kim) a.push("yapi:" + kim + "|" + govde);
  else if (v.hamMetin) a.push("metin:" + n(v.hamMetin));
  return a;
}
/** Mevcut kayıtların anahtar kümesi */
export function anahtarKumesi(kayitlar: { veri: TekrarVeri; kisiAdi?: string | null }[]): Set<string> {
  const s = new Set<string>();
  for (const k of kayitlar) for (const a of tekrarAnahtarlari(k.veri, k.kisiAdi)) s.add(a);
  return s;
}
export const zatenVar = (kume: Set<string>, v: TekrarVeri, kisiAdi?: string | null) => tekrarAnahtarlari(v, kisiAdi).some((a) => kume.has(a));