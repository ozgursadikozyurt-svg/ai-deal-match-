/**
 * Anahtar CRM v3.22 · 9 Ekim 2026
 * Notion API istemcisi (bağımlılıksız, fetch). Notion-Version 2025-09-03: sorgular data source üzerinden.
 * Hız sınırı: Notion ortalama 3 istek/sn verir → istekler arasında en az 350 ms; 429'da Retry-After kadar beklenir.
 * Kimlik: NOTION_TOKEN (Notion → Ayarlar → Bağlantılar → "Dahili entegrasyon" gizli anahtarı). Üç tablo bu bağlantıyla paylaşılmalı.
 */
import { NOTION_VERSION } from "./yapilandirma";
import type { NotionSayfa } from "./donustur";

type Fetch = typeof fetch;
export class NotionHatasi extends Error { constructor(m: string, public durum: number, public kod?: string) { super(m); } }

export function notionIstemcisi(token: string, f: Fetch = fetch, araMs = 350) {
  let son = 0;
  const bekle = (ms: number) => new Promise((r) => setTimeout(r, ms));
  async function istek(yol: string, init: RequestInit = {}, deneme = 0): Promise<any> {
    const gecen = Date.now() - son; if (gecen < araMs) await bekle(araMs - gecen);
    son = Date.now();
    const r = await f(`https://api.notion.com/v1${yol}`, { ...init, headers: { authorization: `Bearer ${token}`, "notion-version": NOTION_VERSION, "content-type": "application/json", ...(init.headers ?? {}) } });
    if (r.ok) return r.json();
    const govde: any = await r.json().catch(() => ({}));
    if ((r.status === 429 || r.status === 409 || r.status >= 500) && deneme < 4) {
      const sn = Number(r.headers.get("retry-after")) || 2 ** deneme;
      await bekle(Math.min(sn, 30) * 1000); return istek(yol, init, deneme + 1);
    }
    const mesaj = r.status === 401 ? "Notion anahtarı geçersiz" : r.status === 404 ? "Tablo bulunamadı ya da bağlantıyla paylaşılmamış (Notion'da tablo → ••• → Bağlantılar → bu entegrasyonu ekleyin)" : govde.message ?? `Notion ${r.status}`;
    throw new NotionHatasi(mesaj, r.status, govde.code);
  }
  return {
    /** Tablo şeması (alan adları ve tipleri) */
    semaGetir: (dsId: string) => istek(`/data_sources/${dsId}`) as Promise<{ id: string; title?: { plain_text: string }[]; properties: Record<string, { id: string; name: string; type: string }> }>,
    /** Eksik geri yazım alanlarını ekler (mevcut alanlara dokunmaz) */
    alanEkle: (dsId: string, alanlar: Record<string, unknown>) => istek(`/data_sources/${dsId}`, { method: "PATCH", body: JSON.stringify({ properties: alanlar }) }),
    /** Sayfaları getirir; `sonra` verilirse yalnızca o andan sonra düzenlenenler (artımlı senkron) */
    sorgula: (dsId: string, p: { imlec?: string | null; sonra?: string | null; boyut?: number }) => istek(`/data_sources/${dsId}/query`, {
      method: "POST",
      body: JSON.stringify({
        page_size: p.boyut ?? 100, ...(p.imlec ? { start_cursor: p.imlec } : {}),
        ...(p.sonra ? { filter: { timestamp: "last_edited_time", last_edited_time: { on_or_after: p.sonra } } } : {}),
        sorts: [{ timestamp: "last_edited_time", direction: "ascending" }],
      }),
    }) as Promise<{ results: NotionSayfa[]; has_more: boolean; next_cursor: string | null }>,
    sayfaGuncelle: (sayfaId: string, properties: Record<string, unknown>) => istek(`/pages/${sayfaId}`, { method: "PATCH", body: JSON.stringify({ properties }) }) as Promise<NotionSayfa>,
  };
}
export type NotionIstemcisi = ReturnType<typeof notionIstemcisi>;