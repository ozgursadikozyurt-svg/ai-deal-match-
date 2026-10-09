/**
 * Anahtar CRM v3.22 · 9 Ekim 2026
 * Anahtar → Notion geri yazım: yalnızca uygulamanın kendi beş alanı (yapilandirma.ts → GERI_YAZIM_ALANLARI).
 * Değer değişmediyse istek atılmaz (Notion'un 3 istek/sn sınırı için).
 */
import { GERI_YAZIM_ALANLARI as G } from "./yapilandirma";
import type { EslesmeOzeti } from "../eslestirme/ozet";
import { norm } from "../senkron/birlestir";

const U = { SUNULABILIR: "Sunulabilir", KOSULLU: "Koşullu", UYGUN_DEGIL: "Uygun değil" } as const;

export function geriYazimDegerleri(o: EslesmeOzeti | undefined, link: string | null) {
  return {
    skor: o?.enIyiSkor ?? null,
    sayi: o?.sayi ?? 0,
    enIyi: o?.enIyiBaslik ? `${o.enIyiBaslik} — ${o.enIyiSkor} (${U[o.enIyiUygunluk!]})` : null,
    link,
  };
}
export type GeriYazim = ReturnType<typeof geriYazimDegerleri>;

/** Notion sayfa özellikleri (PATCH /pages/:id gövdesi) */
export function geriYazimOzellikleri(d: GeriYazim, simdi: Date) {
  return {
    [G.skor.ad]: { number: d.skor },
    [G.sayi.ad]: { number: d.sayi },
    [G.enIyi.ad]: { rich_text: d.enIyi ? [{ type: "text", text: { content: d.enIyi.slice(0, 1900) } }] : [] },
    [G.link.ad]: { url: d.link },
    [G.senkron.ad]: { date: { start: simdi.toISOString() } },
  };
}
export const geriYazimGerekli = (onceki: unknown, yeni: GeriYazim) => norm(onceki) !== norm(yeni);

/** Tablo şemasında eksik olan geri yazım alanları (PATCH /data_sources/:id gövdesi) */
export function eksikGeriYazimAlanlari(mevcutAlanAdlari: string[]): Record<string, unknown> {
  const v = new Set(mevcutAlanAdlari);
  return Object.fromEntries(Object.values(G).filter((a) => !v.has(a.ad)).map((a) => [a.ad, a.sema]));
}

/** Bağlantı raporu: beklenen alanlar tabloda var mı, tipi uygun mu */
export function alanRaporu(beklenen: Record<string, string>, sema: Record<string, { type: string }>, okunmayan: Record<string, string>) {
  const baslik = Object.entries(sema).find(([, p]) => p.type === "title")?.[0];
  return {
    eslesen: Object.entries(beklenen).map(([anahtar, ad]) => ({ anahtar, ad: ad === "" ? baslik || "(başlık)" : ad, var: ad === "" ? baslik !== undefined : ad in sema, tip: ad === "" ? "title" : sema[ad]?.type ?? null })),
    okunmayan: Object.entries(okunmayan).filter(([ad]) => ad in sema).map(([ad, neden]) => ({ ad, neden })),
    bilinmeyen: Object.keys(sema).filter((ad) => !Object.values(beklenen).includes(ad) && !(ad in okunmayan) && sema[ad].type !== "title" && !Object.values(G).some((g) => g.ad === ad) && !["created_time", "last_edited_time", "auto_increment_id", "unique_id"].includes(sema[ad].type)),
  };
}