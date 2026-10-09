/**
 * Anahtar CRM v3.22.1 · 9 Ekim 2026
 * Yapay zekânın yorum yanıtını doğrular — sunucu (/api/ai/yorumla) ve demo aynı işlevi kullanır.
 * Her kayıt enum-kilitli şemadan (AiParseCiktiSchema) tek tek geçer; geçmeyen atılır, diğerleri kalır.
 */
import { AiParseCiktiSchema } from "./gemini-cikti-semasi";

export interface AiYorum { tur: string | null; aciklama: string; kayitlar: any[]; kisiler: { adSoyad: string; telefon: string | null; sirket: string | null }[]; atilan: number }

export function aiYanitiniDogrula(c: any): AiYorum {
  const kayitlar: any[] = [];
  const ham: any[] = Array.isArray(c?.kayitlar) ? c.kayitlar : [];
  for (const k of ham) {
    const r = AiParseCiktiSchema.safeParse({ sinif: "HER_IKISI", kayitlar: [k] });
    if (r.success && r.data.kayitlar[0]) kayitlar.push({ ...r.data.kayitlar[0], notlar: Array.isArray(k.notlar) ? k.notlar.map(String).slice(0, 8) : [], haricKonumlar: Array.isArray(k.haricKonumlar) ? k.haricKonumlar.map(String) : [], kaynakMetin: typeof k.kaynakMetin === "string" ? k.kaynakMetin : "" });
  }
  const kisiler = (Array.isArray(c?.kisiler) ? c.kisiler : []).filter((k: any) => k?.adSoyad || k?.telefon).map((k: any) => ({ adSoyad: String(k.adSoyad || "Yeni kişi"), telefon: k.telefon ? String(k.telefon) : null, sirket: k.sirket ? String(k.sirket) : null }));
  return { tur: typeof c?.tur === "string" ? c.tur : null, aciklama: typeof c?.aciklama === "string" ? c.aciklama : "", kayitlar, kisiler, atilan: ham.length - kayitlar.length };
}