/**
 * Anahtar CRM v3.22.1 · 9 Ekim 2026
 * MAHALLE KOMŞULUĞU ve MESAFESİ — "Fener'de arayan müşteriye Çağlayan da olur, Doğuyaka olmaz."
 * Veri: antalya-komsuluk.json (scripts/build_komsuluk.py üretir; Antalya'nın 19 ilçesi, 914 mahalle).
 *   mesafe = iki mahallenin SINIRLARI arasındaki en kısa mesafe (m); komşu = en az 100 m ortak sınır.
 *   5 km'den uzak çiftler tabloda yoktur → "uzak".
 * Kimlikten bağımsızdır: mahalleler ilçe adı + slug ile tutulur, `komsulukKur` çağıranın kimliklerine çevirir
 * (demo: sıra numarası, canlı: veritabanı id'si). Veritabanı ve PostGIS gerekmez; bellekte tek tablo.
 */
import veri from "./antalya-komsuluk.json";

export interface MahalleYakinligi { komsu: boolean; mesafeM: number }
export interface KomsulukIndeksi {
  /** Bu mahallenin sınır verisi var mı? (yoksa motor eski ilçe kuralına döner) */
  veriVar(mahalleId: number): boolean;
  /** İki mahalle arası. Aynı mahalle → 0 m. Tabloda yoksa (5 km'den uzak) null. */
  mahalle(a: number, b: number): MahalleYakinligi | null;
  /** Bir mahallenin bir ilçeye (o ilçenin en yakın mahallesine) uzaklığı; "Muratpaşa'da arıyorum" ↔ Arapsuyu (Konyaaltı) */
  ilceye(mahalleId: number, ilceId: number): MahalleYakinligi | null;
  /** Sınır komşuları (mahalle kimlikleri) — filtre ve "komşuları da ekle" için */
  komsular(mahalleId: number): number[];
  /** Mahallenin harita noktası (ileride harita görünümü için) */
  nokta(mahalleId: number): { enlem: number; boylam: number; km2: number } | null;
}

type Satir = [ilce: string, slug: string, enlem: number, boylam: number, km2: number];
const M = veri.m as Satir[];
const C = veri.c as [number, number, number, number][];
export const KOMSULUK_OZETI = { mahalle: M.length, cift: C.length, komsuCift: C.filter((c) => c[3]).length, kaynak: veri.kaynak as string };
/** Tablodaki en uzak mesafe (m) — bundan uzağı "uzak" */
export const KOMSULUK_MENZIL_M = 5000;

/**
 * @param kimlik (ilçe adı, mahalle slug) → çağıranın mahalle ve ilçe kimliği; tanımıyorsa null
 */
export function komsulukKur(kimlik: (ilceAdi: string, slug: string) => { id: number; ilceId: number } | null): KomsulukIndeksi {
  const es = M.map(([ilce, slug]) => kimlik(ilce, slug));
  const cift = new Map<number, Map<number, MahalleYakinligi>>();
  const ilceEnYakin = new Map<number, Map<number, MahalleYakinligi>>(); // mahalleId → ilceId → en yakın
  const bilgi = new Map<number, { enlem: number; boylam: number; km2: number }>();
  es.forEach((e, i) => { if (e) bilgi.set(e.id, { enlem: M[i][2], boylam: M[i][3], km2: M[i][4] }); });
  const yaz = (a: { id: number; ilceId: number }, b: { id: number; ilceId: number }, y: MahalleYakinligi) => {
    if (!cift.has(a.id)) cift.set(a.id, new Map());
    cift.get(a.id)!.set(b.id, y);
    if (a.ilceId !== b.ilceId) {
      if (!ilceEnYakin.has(a.id)) ilceEnYakin.set(a.id, new Map());
      const m = ilceEnYakin.get(a.id)!, eski = m.get(b.ilceId);
      if (!eski || y.mesafeM < eski.mesafeM || (y.komsu && !eski.komsu)) m.set(b.ilceId, y);
    }
  };
  for (const [i, j, d, k] of C) {
    const a = es[i], b = es[j];
    if (!a || !b) continue;
    const y = { komsu: k === 1, mesafeM: d };
    yaz(a, b, y); yaz(b, a, y);
  }
  const ilceOf = new Map<number, number>();
  es.forEach((e) => { if (e) ilceOf.set(e.id, e.ilceId); });
  return {
    veriVar: (id) => bilgi.has(id),
    mahalle: (a, b) => (a === b ? { komsu: false, mesafeM: 0 } : cift.get(a)?.get(b) ?? null),
    ilceye: (id, ilceId) => (ilceOf.get(id) === ilceId ? { komsu: false, mesafeM: 0 } : ilceEnYakin.get(id)?.get(ilceId) ?? null),
    komsular: (id) => [...(cift.get(id) ?? [])].filter(([, y]) => y.komsu).map(([b]) => b),
    nokta: (id) => bilgi.get(id) ?? null,
  };
}