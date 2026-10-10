/**
 * Anahtar CRM v3.24 · 10 Ekim 2026
 * "Portföy paylaş" — müşteriye / meslektaşa gönderilen föyün içeriği, WhatsApp metni ve PDF yazıcısı.
 * Föy, portföyü paylaşan danışmanın kendi ilanı gibi görünür: imza Ayarlar › Paylaşım imzası'ndan gelir;
 * mülk sahibinin / mesajı gönderenin adı, telefonu, firması ve grup adı föye HİÇ girmez.
 * PDF: föy bir tuvale (canvas) çizilir, JPEG olarak PDF sayfasına gömülür — yazı tipi/Türkçe karakter sorunu olmaz,
 * her telefonda ve bilgisayarda açılır. Kütüphane kullanılmaz.
 */
import type { PaylasimAyar } from "../domain/ayarlar";

export interface FoyIcerik {
  baslik: string;
  /** "Satılık", "Kiralık"… */
  islem: string;
  /** "Daire", "Depo / Antrepo"… */
  tip: string;
  konum: string;
  /** "8.500.000 TL" — boşsa föyde fiyat satırı çıkmaz */
  fiyat: string;
  ozellikler: [etiket: string, deger: string][];
  aciklama: string;
  imza: PaylasimAyar;
}

/** Metindeki telefon numaralarını, e-postaları ve bağlantıları siler (mülk sahibinin iletişimi föye sızmasın) */
export function iletisimiGizle(metin: string): string {
  return metin
    .replace(/https?:\/\/\S+|www\.\S+/gi, "")
    .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, "")
    .replace(/(?:\+?9?0?[\s.(-]*)?5\d{2}[\s.)-]*\d{3}[\s.-]*\d{2}[\s.-]*\d{2}\b/g, "")
    .replace(/\(?\b0?[2-4]\d{2}\)?[\s.-]*\d{3}[\s.-]*\d{2}[\s.-]*\d{2}\b/g, "")
    .replace(/[ \t]{2,}/g, " ").replace(/\n{3,}/g, "\n\n").replace(/[ \t]+\n/g, "\n").trim();
}

const imzaSatirlari = (i: PaylasimAyar): string[] => [i.adSoyad.toLocaleUpperCase("tr"), [i.unvan, i.firma].filter(Boolean).join(" · "), i.telefon].filter(Boolean);

/** WhatsApp'a yapıştırılacak düz metin (yıldızlar WhatsApp'ta kalın yazı olur) */
export function foyMetni(f: FoyIcerik): string {
  return [
    `*${[f.islem, f.tip].filter(Boolean).join(" ").toLocaleUpperCase("tr")}*`,
    f.baslik,
    f.konum ? `📍 ${f.konum}` : null,
    f.fiyat ? `💰 ${f.fiyat}` : null,
    f.ozellikler.length ? "" : null,
    ...f.ozellikler.map(([e, d]) => `▫️ ${e}: ${d}`),
    f.aciklama ? "" : null,
    f.aciklama || null,
    "",
    ...imzaSatirlari(f.imza).map((s, n) => (n === 0 ? `*${s}*` : n === 2 ? `📞 ${s}` : s)),
  ].filter((x) => x != null).join("\n");
}

export const foyDosyaAdi = (f: FoyIcerik, uzanti: string): string =>
  (f.baslik || f.tip || "portfoy").toLocaleLowerCase("tr").replace(/[çğıöşü]/g, (c) => ({ ç: "c", ğ: "g", ı: "i", ö: "o", ş: "s", ü: "u" } as Record<string, string>)[c]).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) + "." + uzanti;

// ───────── PDF (görüntü tabanlı) ─────────
export interface PdfSayfasi { jpeg: Uint8Array; en: number; boy: number }
/**
 * Her sayfası tek bir JPEG olan A4 PDF üretir (PDF 1.4, DCTDecode). Görüntü sayfaya oranı korunarak sığdırılır.
 * Çıktı her PDF okuyucuda (WhatsApp önizlemesi, telefon, tarayıcı, Acrobat) açılır.
 */
export function pdfOlustur(sayfalar: PdfSayfasi[], baslik = "Portfoy"): Uint8Array {
  if (!sayfalar.length) throw new Error("PDF için en az bir sayfa gerekir");
  const A4: [number, number] = [595.28, 841.89];
  const enc = new TextEncoder();
  const parcalar: Uint8Array[] = [];
  const ofset: number[] = [];
  let konum = 0;
  const yaz = (b: Uint8Array | string) => { const u = typeof b === "string" ? enc.encode(b) : b; parcalar.push(u); konum += u.length; };
  const nesne = (no: number, govde: string | (() => void)) => { ofset[no] = konum; yaz(`${no} 0 obj\n`); if (typeof govde === "string") yaz(govde); else govde(); yaz("\nendobj\n"); };
  const ascii = (s: string) => s.replace(/[^\x20-\x7e]/g, "?").replace(/[()\\]/g, "\\$&");
  yaz("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n");
  const n = sayfalar.length;
  // 1 katalog, 2 sayfa ağacı, 3 bilgi; sonra sayfa başına 3 nesne: sayfa, içerik, görüntü
  nesne(1, "<< /Type /Catalog /Pages 2 0 R >>");
  nesne(2, `<< /Type /Pages /Count ${n} /Kids [${sayfalar.map((_, i) => `${4 + i * 3} 0 R`).join(" ")}] >>`);
  nesne(3, `<< /Title (${ascii(baslik)}) /Producer (Anahtar CRM) >>`);
  sayfalar.forEach((s, i) => {
    const sayfaNo = 4 + i * 3, icerikNo = sayfaNo + 1, gorNo = sayfaNo + 2;
    const o = Math.min(A4[0] / s.en, A4[1] / s.boy);
    const w = s.en * o, h = s.boy * o, x = (A4[0] - w) / 2, y = (A4[1] - h) / 2;
    const icerik = `q ${w.toFixed(2)} 0 0 ${h.toFixed(2)} ${x.toFixed(2)} ${y.toFixed(2)} cm /G${i} Do Q`;
    nesne(sayfaNo, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${A4[0]} ${A4[1]}] /Resources << /XObject << /G${i} ${gorNo} 0 R >> >> /Contents ${icerikNo} 0 R >>`);
    nesne(icerikNo, `<< /Length ${icerik.length} >>\nstream\n${icerik}\nendstream`);
    nesne(gorNo, () => { yaz(`<< /Type /XObject /Subtype /Image /Width ${s.en} /Height ${s.boy} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${s.jpeg.length} >>\nstream\n`); yaz(s.jpeg); yaz("\nendstream"); });
  });
  const toplam = 3 + n * 3;
  const xref = konum;
  yaz(`xref\n0 ${toplam + 1}\n0000000000 65535 f \n`);
  for (let i = 1; i <= toplam; i++) yaz(`${String(ofset[i]).padStart(10, "0")} 00000 n \n`);
  yaz(`trailer\n<< /Size ${toplam + 1} /Root 1 0 R /Info 3 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  const out = new Uint8Array(konum);
  let p = 0;
  for (const u of parcalar) { out.set(u, p); p += u.length; }
  return out;
}