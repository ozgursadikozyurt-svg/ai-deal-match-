/**
 * Anahtar CRM v3.22.2 · 10 Ekim 2026
 * Demo — portföy fotoğrafları: tarayıcıda küçültme + bu cihazda saklama (IndexedDB) + indirme / paylaşma.
 * Canlı kurulumda aynı küçültülmüş dosya /api/kayitlar/:id/fotolar ile Supabase Storage'a gider (src/lib/depolama/supabase.ts).
 * Kayıtta yalnızca künye durur (FotoMeta: id, ad, ölçü); görüntünün kendisi burada tutulur.
 */
import { FOTO_UZUN_KENAR, FOTO_KALITE, FOTO_KUCUK_KENAR, FOTO_EN_BUYUK_BAYT, fotoBoyutu, type FotoMeta } from "../src/lib/domain/foto";
const FOTO_HEDEF_BAYT = Math.floor(FOTO_EN_BUYUK_BAYT * 0.95);
import { CANLI } from "./depo";

interface FotoKaydi { id: string; kayitId: string; blob: Blob; kucuk: Blob }
const bellek = new Map<string, FotoKaydi>(); // IndexedDB kullanılamazsa (gizli pencere vb.) oturum boyunca burada durur
let vt: Promise<IDBDatabase | null> | null = null;
function ac(): Promise<IDBDatabase | null> {
  if (vt) return vt;
  return (vt = new Promise((coz) => {
    try {
      const r = indexedDB.open("anahtar-crm-foto", 1);
      r.onupgradeneeded = () => { r.result.createObjectStore("foto", { keyPath: "id" }); };
      r.onsuccess = () => coz(r.result);
      r.onerror = () => coz(null);
      r.onblocked = () => coz(null);
    } catch { coz(null); }
  }));
}
async function islem<T>(mod: IDBTransactionMode, is: (s: IDBObjectStore) => IDBRequest<T>): Promise<T | undefined> {
  const d = await ac();
  if (!d) return undefined;
  return new Promise((coz) => {
    try { const r = is(d.transaction("foto", mod).objectStore("foto")); r.onsuccess = () => coz(r.result); r.onerror = () => coz(undefined); } catch { coz(undefined); }
  });
}
/** Fotoğraflar bu cihazda kalıcı mı saklanıyor (false = yalnızca bu oturum) */
export const fotoKaliciMi = async () => CANLI.acik || !!(await ac());

const tuvaldenBlob = (c: HTMLCanvasElement, kalite: number) => new Promise<Blob>((coz, ret) => c.toBlob((b) => (b ? coz(b) : ret(new Error("Görüntü oluşturulamadı"))), "image/jpeg", kalite));
async function coz(dosya: Blob): Promise<{ kaynak: CanvasImageSource; en: number; boy: number; kapat: () => void }> {
  if (typeof createImageBitmap === "function") {
    try { const b = await createImageBitmap(dosya, { imageOrientation: "from-image" } as ImageBitmapOptions); return { kaynak: b, en: b.width, boy: b.height, kapat: () => b.close() }; } catch { /* Image ile dene */ }
  }
  const url = URL.createObjectURL(dosya);
  const img = new Image();
  await new Promise<void>((tamam, ret) => { img.onload = () => tamam(); img.onerror = () => ret(new Error("Bu dosya fotoğraf olarak açılamadı (HEIC ise telefonda JPG'ye çevirin)")); img.src = url; });
  return { kaynak: img, en: img.naturalWidth, boy: img.naturalHeight, kapat: () => URL.revokeObjectURL(url) };
}
function ciz(kaynak: CanvasImageSource, en: number, boy: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = en; c.height = boy;
  const x = c.getContext("2d")!;
  x.fillStyle = "#fff"; x.fillRect(0, 0, en, boy); // saydam PNG beyaz zemine oturur
  x.imageSmoothingQuality = "high";
  x.drawImage(kaynak, 0, 0, en, boy);
  return c;
}
/** Dosyayı küçültür (uzun kenar 1600 px JPEG + 360 px küçük görsel) ve saklar; künyeyi döndürür. */
export async function fotoEkle(kayitId: string, dosya: File): Promise<FotoMeta> {
  const g = await coz(dosya);
  try {
    const b = fotoBoyutu(g.en, g.boy, FOTO_UZUN_KENAR), k = fotoBoyutu(g.en, g.boy, FOTO_KUCUK_KENAR);
    // v3.22.1 — sunucu 1,5 MB üstünü reddeder; ayrıntılı fotoğraflarda kalite kademeli düşürülür
    const tuval = ciz(g.kaynak, b.en, b.boy);
    let blob = await tuvaldenBlob(tuval, FOTO_KALITE);
    for (const q of [0.72, 0.6, 0.5]) { if (blob.size <= FOTO_HEDEF_BAYT) break; blob = await tuvaldenBlob(tuval, q); }
    const kucuk = await tuvaldenBlob(ciz(g.kaynak, k.en, k.boy), 0.72);
    if (CANLI.acik) return canliYukle(kayitId, dosya, blob, b.en, b.boy);
    const id = "f" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    const kayit: FotoKaydi = { id, kayitId, blob, kucuk };
    bellek.set(id, kayit);
    await islem("readwrite", (s) => s.put(kayit));
    return { id, ad: dosya.name.replace(/\.[^.]+$/, "").slice(0, 60) || "fotograf", en: b.en, boy: b.boy, boyut: blob.size };
  } finally { g.kapat(); }
}
export async function fotoOku(id: string): Promise<FotoKaydi | null> {
  if (CANLI.acik) return canliOku(id);
  return bellek.get(id) ?? (await islem<FotoKaydi>("readonly", (s) => s.get(id))) ?? null;
}
export async function fotoSil(id: string): Promise<void> {
  if (CANLI.acik) return canliSil(id);
  bellek.delete(id); await islem("readwrite", (s) => s.delete(id));
}

// ───────── v3.14 canlı: fotoğraflar Supabase Storage'a /api/kayit/:id/fotolar ile gider (özel kova, 1 saat geçerli imzalı bağlantı) ─────────
const fotoKayit = new Map<string, string>();        // fotoğraf kimliği → kayıt kimliği
const fotoUrl = new Map<string, string>();          // fotoğraf kimliği → imzalı bağlantı
const fotoBlob = new Map<string, Blob>();           // oturum önbelleği
/** Sunucudan gelen durumdaki künyelerden fotoğraf → kayıt eşlemesini kurar (açılışta çağrılır) */
export function fotoEsle(kayitlar: { id: string; fotolar?: { id: string }[] }[]) { for (const k of kayitlar) for (const f of k.fotolar ?? []) fotoKayit.set(f.id, k.id); }
async function canliYukle(kayitId: string, dosya: File, blob: Blob, en: number, boy: number): Promise<FotoMeta> {
  // Kayıt sunucuda yoksa fotoğraf yüklenemez: bekleyen kaydı önce gönder (v3.22.1: reddedilmiş kayıt da yeniden denenir)
  await CANLI.hemen?.();
  const gonder = async () => {
    const form = new FormData();
    form.append("dosya", new File([blob], dosya.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" }));
    form.append("en", String(en)); form.append("boy", String(boy));
    return CANLI.api!(`/api/kayit/${encodeURIComponent(kayitId)}/fotolar`, { method: "POST", form });
  };
  let r = await gonder();
  if (r.status === 404) { await new Promise((t) => setTimeout(t, 1200)); await CANLI.hemen?.(); r = await gonder(); } // kayıt o anda yazılıyor olabilir
  const j: any = await r.json().catch(() => ({}));
  if (!r.ok) {
    // v3.22.1 — "bazen fotoğraf eklenmiyor": nedeni artık söylenir (önceden yalnızca "dosya açılamadı" yazıyordu)
    if (r.status === 404) { const neden = CANLI.kayitHatasi?.(kayitId); throw new Error(`Portföy henüz sunucuya kaydedilmedi${neden ? `: ${neden}` : ""}. Üstteki kayıt uyarısına bakın, düzelince fotoğrafı yeniden ekleyin.`); }
    throw new Error(j?.mesaj ?? (j?.hata === "DEPO_KAPALI" ? "Fotoğraf deposu kapalı (Supabase anahtarı tanımlı değil)" : `Fotoğraf yüklenemedi (${r.status})`));
  }
  fotoKayit.set(j.id, kayitId); if (j.url) fotoUrl.set(j.id, j.url); fotoBlob.set(j.id, blob);
  return { id: j.id, ad: j.ad, en: j.en, boy: j.boy, boyut: j.boyut };
}
async function canliOku(id: string): Promise<FotoKaydi | null> {
  const kayitId = fotoKayit.get(id); if (!kayitId) return null;
  let blob = fotoBlob.get(id);
  if (!blob) {
    if (!fotoUrl.has(id)) {
      const r = await CANLI.api!(`/api/kayit/${encodeURIComponent(kayitId)}/fotolar`);
      if (!r.ok) return null;
      for (const f of (await r.json()) as { id: string; url: string | null }[]) if (f.url) fotoUrl.set(f.id, f.url);
    }
    const u = fotoUrl.get(id); if (!u) return null;
    const r = await fetch(u); if (!r.ok) { fotoUrl.delete(id); return null; }
    blob = await r.blob(); fotoBlob.set(id, blob);
  }
  return { id, kayitId, blob, kucuk: blob };
}
async function canliSil(id: string): Promise<void> {
  const kayitId = fotoKayit.get(id); if (!kayitId) return;
  await CANLI.api!(`/api/kayit/${encodeURIComponent(kayitId)}/fotolar?fotoId=${encodeURIComponent(id)}`, { method: "DELETE" });
  fotoKayit.delete(id); fotoUrl.delete(id); fotoBlob.delete(id);
}

/** Blob → çizilebilir görüntü (föy için) */
export async function goruntuAc(b: Blob): Promise<{ kaynak: CanvasImageSource; en: number; boy: number; kapat: () => void }> { return coz(b); }