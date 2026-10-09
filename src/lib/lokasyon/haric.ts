/**
 * Anahtar CRM v3.22 · 9 Ekim 2026
 * "Hurma, Sarısu HARİÇ" — talepte hariç tutulan bölgeler.
 *
 * Eskiden hariç denilen yerler yalnızca konumlardan çıkarılıyordu; geriye konum kalmayınca talep "il geneli"ne düşüyor,
 * hatta form taslağı metindeki tüm yer adlarını yeniden okuyup Hurma'yı ARANAN bölge yapıyordu (Hurma portföyleri 92 puanla geliyordu).
 * Kural (v3.22):
 *  1. Hariç denilen mahalle / alt bölge / ilçe kayda `haric: true` satırı olarak yazılır (eşleştirmede kesin engel).
 *  2. Hariç bir mahallenin (ya da alt bölgenin) ilçesi talepte başka hiçbir konumla geçmiyorsa o ilçe aranan bölge olarak eklenir:
 *     "Hurma, Sarısu hariç" → Konyaaltı (Hurma ve Sarısu hariç). "Lara hariç Muratpaşa" → Muratpaşa zaten var, eklenmez.
 *  3. Aranan konumlardan hariçle aynı olanlar çıkarılır ("Kepez hariç" yazılan mesajda Kepez aranan bölge olmaz).
 */
export interface LokSatiri {
  ilId: number;
  ilceId?: number | null;
  mahalleId?: number | null;
  altBolgeId?: number | null;
  birincil?: boolean;
  haric?: boolean;
}

const ayni = (a: LokSatiri, b: LokSatiri) => a.ilId === b.ilId && (a.ilceId ?? null) === (b.ilceId ?? null) && (a.mahalleId ?? null) === (b.mahalleId ?? null) && (a.altBolgeId ?? null) === (b.altBolgeId ?? null);
const ilceDuzeyi = (l: LokSatiri) => !!l.ilceId && !l.mahalleId && !l.altBolgeId;

/** Aranan ve hariç konumları tek listede birleştirir (hariçler `haric: true`, sonda). */
export function haricBirlestir<T extends LokSatiri>(aranan: T[], haric: T[]): (T & { haric?: boolean })[] {
  const h = haric.filter((x, i) => haric.findIndex((y) => ayni(x, y)) === i).map((x) => ({ ...x, birincil: false, haric: true as const }));
  if (!h.length) return aranan;
  const pozitif: (T & { haric?: boolean })[] = aranan.filter((a) => !h.some((x) => ayni(a, x)) && !h.some((x) => ilceDuzeyi(x) && a.ilceId === x.ilceId && ilceDuzeyi(a)));
  for (const x of h) {
    if (ilceDuzeyi(x) || !x.ilceId) continue;
    if (pozitif.some((p) => p.ilceId === x.ilceId)) continue;
    const { haric: _h, ...taban } = x;
    pozitif.push({ ...(taban as unknown as T), ilceId: x.ilceId, mahalleId: null, altBolgeId: null, birincil: false });
  }
  return [...pozitif, ...h];
}

/** Kaydın aranan (hariç olmayan) konumları */
export const arananLok = <T extends LokSatiri>(ls: T[]): T[] => ls.filter((l) => !l.haric);
/** Kaydın hariç tuttuğu konumlar */
export const haricLok = <T extends LokSatiri>(ls: T[]): T[] => ls.filter((l) => l.haric);

/** Portföyün konumu talebin hariç tuttuğu bir yere düşüyor mu? (alt bölge için mahalle kümesi verilir) */
export function haricteMi(pl: LokSatiri, haricler: LokSatiri[], altBolgeMahalleleri?: Map<number, Set<number>>): LokSatiri | null {
  for (const h of haricler) {
    if (h.mahalleId) { if (pl.mahalleId === h.mahalleId) return h; continue; }
    if (h.altBolgeId) { if (pl.altBolgeId === h.altBolgeId || (pl.mahalleId && altBolgeMahalleleri?.get(h.altBolgeId)?.has(pl.mahalleId))) return h; continue; }
    if (h.ilceId && pl.ilceId === h.ilceId) return h;
  }
  return null;
}
