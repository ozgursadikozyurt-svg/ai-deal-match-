/**
 * Anahtar CRM v3.13 · 3 Ekim 2026
 * Kayıt başına eşleşme özeti (en iyi skor, uygun eşleşme sayısı, en iyi karşı kayıt).
 * Notion'a geri yazımda ve senkron raporunda ("bu içe aktarma N yeni eşleşme getirdi") kullanılır.
 */
import { eslesmeOnizle, temelUyum, type LokasyonBaglami, type Uygunluk } from "./onizleme";

export interface OzetKayit { id: string; veri: Record<string, any> }
export interface EslesmeOzeti { sayi: number; sunulabilir: number; enIyiSkor: number | null; enIyiId: string | null; enIyiBaslik: string | null; enIyiUygunluk: Uygunluk | null }

export const kisaBaslik = (v: Record<string, any>) =>
  v.baslik || [String(v.mulkTipi ?? "").toLowerCase().replace(/_/g, " "), v.m2 ?? v.minM2 ? `${v.m2 ?? v.minM2} m²` : null].filter(Boolean).join(" · ");

export function eslesmeOzetleri(kayitlar: OzetKayit[], b: LokasyonBaglami): Map<string, EslesmeOzeti> {
  const aktif = kayitlar.filter((k) => k.veri.durum === "ACTIVE");
  const T = aktif.filter((k) => k.veri.tip === "TALEP"), P = aktif.filter((k) => k.veri.tip === "PORTFOY");
  const m = new Map<string, EslesmeOzeti>();
  const bos = (): EslesmeOzeti => ({ sayi: 0, sunulabilir: 0, enIyiSkor: null, enIyiId: null, enIyiBaslik: null, enIyiUygunluk: null });
  const sira: Record<Uygunluk, number> = { SUNULABILIR: 2, KOSULLU: 1, UYGUN_DEGIL: 0 };
  const yaz = (id: string, karsi: OzetKayit, skor: number, u: Uygunluk) => {
    const o = m.get(id) ?? bos();
    if (u !== "UYGUN_DEGIL") { o.sayi++; if (u === "SUNULABILIR") o.sunulabilir++; }
    if (u !== "UYGUN_DEGIL" && (o.enIyiUygunluk == null || sira[u] > sira[o.enIyiUygunluk] || (sira[u] === sira[o.enIyiUygunluk] && skor > (o.enIyiSkor ?? -1)))) {
      Object.assign(o, { enIyiSkor: skor, enIyiId: karsi.id, enIyiBaslik: kisaBaslik(karsi.veri), enIyiUygunluk: u });
    }
    m.set(id, o);
  };
  for (const t of T) for (const p of P) {
    if (!temelUyum(t.veri as any, p.veri as any)) continue;
    const s = eslesmeOnizle(t.veri as any, p.veri as any, b);
    yaz(t.id, p, s.skor, s.uygunluk); yaz(p.id, t, s.skor, s.uygunluk);
  }
  for (const k of aktif) if (!m.has(k.id)) m.set(k.id, bos());
  return m;
}