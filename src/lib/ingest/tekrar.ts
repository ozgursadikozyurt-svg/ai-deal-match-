/**
 * Anahtar CRM v3.22 · 9 Ekim 2026
 * Toplu girişte "Zaten var" kontrolü — talepler dahil.
 *  - Portal ilanı: ilan no / bağlantı (en güçlü kanıt).
 *  - Talep (ve bağlantısız portföy): aynı kişi + tip + mülk tipi + işlem + oda + bütçe/fiyat + m² + konum anahtarı.
 *    Kişi adı yoksa gönderen telefonu; ikisi de yoksa ham metin kullanılır (yanlış "zaten var" demektense kaçırmak tercih).
 */
const n = (s?: string | null) => (s ?? "").toLocaleLowerCase("tr").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
/** v3.19 — oransal kovalar: fiyat ~%3, m² ~%5 bandında aynı sayılır (eski: bin TL'ye yuvarlama, 5.000.000 ≠ 5.050.000). */
const kova = (x: number | null | undefined, oran: number, kay = 0) => (x == null || !(Number(x) > 0) ? "" : String(Math.round(Math.log(Number(x)) / Math.log(oran)) + kay));
const oda = (o?: string | null) => (o ?? "").toLowerCase().replace(/\s+/g, "");
export interface TekrarVeri {
  tip: string; mulkTipi: string; islemTipi: string; odaSayisi?: string | null;
  fiyat?: number | null; minFiyat?: number | null; maxFiyat?: number | null; m2?: number | null; minM2?: number | null; maxM2?: number | null;
  lokasyonlar: { ilceId?: number | null; mahalleId?: number | null; altBolgeId?: number | null; haric?: boolean }[];
  portalIlanNo?: string | null; portalUrl?: string | null; gondeTelefon?: string | null; hamMetin?: string | null;
}
/**
 * @param komsu true ise (mevcut kayıt kümesi için) fiyat/m² kovasının bir alt ve üst komşusu da üretilir; böylece
 *   bant sınırına denk gelen yakın değerler de yakalanır. Aday kayıtta false kalır.
 */
export function tekrarAnahtarlari(v: TekrarVeri, kisiAdi?: string | null, komsu = false): string[] {
  const a: string[] = [];
  if (v.portalIlanNo) a.push("ilan:" + v.portalIlanNo);
  if (v.portalUrl) a.push("url:" + v.portalUrl.replace(/^https?:\/\/(www\.)?/, "").replace(/[?#].*$/, "").replace(/\/$/, ""));
  const ad = n(kisiAdi);
  const tel = (v.gondeTelefon ?? "").replace(/\D/g, "").slice(-10);
  const lok = [...new Set(v.lokasyonlar.map((l) => (l.haric ? "x" : "") + (l.altBolgeId ? "a" + l.altBolgeId : l.mahalleId ? "m" + l.mahalleId : l.ilceId ? "i" + l.ilceId : "il")))].sort().join(",");
  const fiyatlar = komsu ? [-1, 0, 1] : [0];
  const govdeler = fiyatlar.map((k) => [v.tip, v.mulkTipi, v.islemTipi, oda(v.odaSayisi), kova(v.fiyat ?? v.maxFiyat, 1.03, k), kova(v.minFiyat, 1.03), kova(v.m2 ?? v.minM2, 1.05), kova(v.maxM2, 1.05), lok].join("|"));
  // Kişi kimliği: ad VE telefon ayrı ayrı anahtar olur (aynı kişi farklı yazılmış adla / aynı ad farklı telefonla da bulunur)
  for (const g of govdeler) {
    if (ad) a.push("yapi:" + ad + "|" + g);
    if (tel.length >= 7) a.push("tel:" + tel + "|" + g);
  }
  if (!ad && tel.length < 7 && v.hamMetin) a.push("metin:" + n(v.hamMetin));
  return a;
}
/** v3.19 — "Zaten var" kararının nedeni (kullanıcıya gösterilir) */
export function tekrarNedeni(anahtar: string): string {
  if (anahtar.startsWith("ilan:") || anahtar.startsWith("url:")) return "Aynı portal ilanı (ilan no / bağlantı)";
  if (anahtar.startsWith("tel:")) return "Aynı telefon + aynı özellikler (tip, oda, fiyat ±%3, m² ±%5, konum)";
  if (anahtar.startsWith("yapi:")) return "Aynı kişi adı + aynı özellikler (tip, oda, fiyat ±%3, m² ±%5, konum)";
  return "Aynı ham metin";
}
/** Mevcut kayıtların anahtar kümesi */
export function anahtarKumesi(kayitlar: { veri: TekrarVeri; kisiAdi?: string | null }[]): Set<string> {
  const s = new Set<string>();
  for (const k of kayitlar) for (const a of tekrarAnahtarlari(k.veri, k.kisiAdi, true)) s.add(a);
  return s;
}
export const zatenVar = (kume: Set<string>, v: TekrarVeri, kisiAdi?: string | null) => tekrarAnahtarlari(v, kisiAdi).some((a) => kume.has(a));