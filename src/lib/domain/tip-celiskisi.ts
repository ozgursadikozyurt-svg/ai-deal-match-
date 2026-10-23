/**
 * Anahtar CRM v3.40 · 23 Ekim 2026
 * TİP ÇELİŞKİSİ — kaydın metni (başlık / açıklama / ham mesaj) başka bir mülk ailesini söylüyor ama kendi ailesinin
 * hiçbir anahtar kelimesini içermiyorsa uyarır. Ölçüm (13 Eki 2026, canlı veri): "—SATILIK ARSA— Altıntaş 30–35 milyon"
 * talebi Büro/Ofis olarak kaydedilmişti ve 157 daireyle eşleşiyordu; asıl uygun aday (Aksu D400, 18.401 m² arsa) hiç çıkmıyordu.
 * Kasıtlı olarak tutucu: kendi ailesinden tek bir kelime geçiyorsa ("ofis olarak kullanılacak 3+1 daire") uyarı vermez.
 */
import { aileOf } from "./kategori";

/** aile kodu → metinde o aileyi açıkça söyleyen kelimeler (küçük harf, Türkçe) */
/** Kelime sınırı: Türkçe harfler (ş, ü, ı…) \b ile çalışmadığı için Unicode harf sınırı kullanılır */
const kelime = (govde: string) => new RegExp(`(?<![\\p{L}\\d])(?:${govde})(?![\\p{L}])`, "u");
const AILE_KELIMELERI: Record<string, RegExp> = {
  ARSA: kelime("arsa(?:s[ıi])?|tarla(?:s[ıi])?|arazi(?:si)?"),
  DEPO: kelime("depo(?:su)?|antrepo(?:su)?|lojistik"),
  OFIS: kelime("ofis(?:i)?|b[üu]ro(?:su)?|plaza"),
  DUKKAN: kelime("d[üu]kk[aâ]n(?:[ıi])?|ma[ğg]aza(?:s[ıi])?|showroom"),
  MUSTAKIL: kelime("villa(?:s[ıi])?|m[üu]stakil"),
  DAIRE: /(?<![\p{L}\d])(?:daire(?:si)?|rezidans)(?![\p{L}])|(?<!\d)\d\s*\+\s*\d(?!\d)/u,
  URETIM: kelime("fabrika(?:s[ıi])?|imalathane(?:si)?|at[öo]lye(?:si)?"),
  HIZMET: kelime("kre[şs]|okul|klinik|kurs"),
  YEME_ICME: kelime("restoran|kafe|cafe|lokanta"),
  TURIZM: kelime("otel|pansiyon"),
};
/** Birbirinin kelimesini doğal olarak kullanan aileler (metin birini söylerken diğeri kayıtlıysa çelişki sayılmaz) */
const UYUMLU: [string, string][] = [["DEPO", "URETIM"], ["DUKKAN", "YEME_ICME"], ["OFIS", "HIZMET"], ["MUSTAKIL", "DAIRE"], ["BINA", "OFIS"], ["BINA", "DAIRE"], ["BINA", "DUKKAN"]];
const uyumlu = (a: string, b: string) => a === b || UYUMLU.some(([x, y]) => (x === a && y === b) || (x === b && y === a));

export interface TipCeliskisi { kelime: string; aile: string }

export function tipCeliskisi(k: { mulkTipi: string; baslik?: string | null; aciklama?: string | null; hamMetin?: string | null; ozet?: string | null }): TipCeliskisi | null {
  const metin = [k.baslik, k.aciklama, k.hamMetin, k.ozet].filter(Boolean).join("\n").toLocaleLowerCase("tr");
  if (!metin.trim()) return null;
  const kendi = aileOf(k.mulkTipi as any)?.kod;
  if (!kendi || kendi === "DIGER") return null;
  // kendi ailesinin (ya da uyumlu bir ailenin) kelimesi geçiyorsa çelişki yok
  for (const [aile, re] of Object.entries(AILE_KELIMELERI)) if (uyumlu(aile, kendi) && re.test(metin)) return null;
  let enIyi: (TipCeliskisi & { yer: number }) | null = null;
  for (const [aile, re] of Object.entries(AILE_KELIMELERI)) {
    const m = metin.match(re);
    if (m && m.index != null && (!enIyi || m.index < enIyi.yer)) enIyi = { kelime: m[0].trim(), aile, yer: m.index };
  }
  return enIyi ? { kelime: enIyi.kelime, aile: enIyi.aile } : null;
}
