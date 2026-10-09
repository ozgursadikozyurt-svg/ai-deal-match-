/**
 * Anahtar CRM v3.22.1 · 9 Ekim 2026
 * Demo — üretilen dosyayı kullanıcıya verme: indirme (yayın sayfasında `downloads` yeteneği, yoksa tarayıcı indirmesi)
 * ve telefonun paylaşım menüsü (WhatsApp, e-posta…).
 */
let indirici: Promise<any> | null = null;
const indiriciAl = () => (indirici ??= (async () => { try { return (await (window as any).claude?.use?.("downloads")) ?? null; } catch { return null; } })());

export type DosyaSonucu = "tamam" | "vazgecildi" | "olmadi";
export async function dosyaIndir(ad: string, veri: Blob): Promise<DosyaSonucu> {
  const dl = await indiriciAl();
  if (dl) {
    try { await dl.save({ filename: ad, data: veri }); return "tamam"; }
    catch (e: any) { if (e?.code === "declined") return "vazgecildi"; if (e?.code === "rate_limited") return "olmadi"; /* diğerleri: tarayıcı indirmesini dene */ }
  }
  try {
    const url = URL.createObjectURL(veri);
    const a = document.createElement("a");
    a.href = url; a.download = ad; a.rel = "noopener"; a.style.display = "none";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
    return "tamam";
  } catch { return "olmadi"; }
}
/** Telefonun paylaşım menüsü bu dosyaları kabul ediyor mu */
export function paylasilabilirMi(dosyalar: File[]): boolean {
  try { return typeof navigator.share === "function" && !!navigator.canShare?.({ files: dosyalar }); } catch { return false; }
}
export async function dosyaPaylas(dosyalar: File[], baslik: string, metin?: string): Promise<DosyaSonucu> {
  if (!paylasilabilirMi(dosyalar)) return "olmadi";
  try { await navigator.share({ files: dosyalar, title: baslik, ...(metin ? { text: metin } : {}) }); return "tamam"; }
  catch (e: any) { return e?.name === "AbortError" ? "vazgecildi" : "olmadi"; }
}
export const sonucMesaji = (s: DosyaSonucu, tamam: string) => (s === "tamam" ? tamam : s === "vazgecildi" ? null : "Bu görünümde dosya verilemedi");