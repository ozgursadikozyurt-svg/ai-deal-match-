/**
 * Anahtar CRM v3.23 · 10 Ekim 2026
 * vCard (.vcf) → kişi. WhatsApp'ta paylaşılan kişi kartları ve telefon rehberi dışa aktarımı için.
 */
import { telE164 } from "../senkron/birlestir";
export interface VcfKisi { adSoyad: string; telefonlar: string[]; email: string | null; sirket: string | null; not: string | null }
const coz = (s: string) => s.replace(/\\n/gi, "\n").replace(/\\([,;\\])/g, "$1").trim();
export function vcfOku(metin: string): VcfKisi[] {
  const acik = metin.replace(/\r\n[ \t]/g, "").replace(/\n[ \t]/g, ""); // katlanmış satırlar
  return [...acik.matchAll(/BEGIN:VCARD([\s\S]*?)END:VCARD/gi)].map((m) => {
    const sat = m[1].split(/\r?\n/);
    const al = (ad: string) => sat.filter((l) => new RegExp(`^(item\\d+\\.)?${ad}[;:]`, "i").test(l)).map((l) => coz(l.slice(l.indexOf(":") + 1)));
    const fn = al("FN")[0] || al("N")[0]?.split(";").filter(Boolean).reverse().join(" ") || "";
    return { adSoyad: fn, telefonlar: [...new Set(al("TEL").map((t) => telE164(t) ?? t.replace(/[^\d+]/g, "")).filter(Boolean))], email: al("EMAIL")[0]?.toLowerCase() || null, sirket: al("ORG")[0]?.split(";")[0] || null, not: al("NOTE")[0] || null };
  }).filter((k) => k.adSoyad || k.telefonlar.length);
}