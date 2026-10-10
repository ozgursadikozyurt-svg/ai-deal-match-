/**
 * Anahtar CRM v3.23 · 10 Ekim 2026
 * Gelen kutusu — veri katmanı. Ekran (demo/gelen-kutusu.tsx) yalnızca bu arayüzü bilir:
 *   canlıda dosyalar sunucudadır (/api/gelen; ham dosya Supabase Storage'da), demoda bu tarayıcıdadır (örnek dosyalarla başlar).
 * Atlananlar (aynı ilan yeniden sorulmasın diye hatırlanan anahtarlar) da buradan okunur / yazılır.
 */
import { CANLI, BUGUN } from "./depo";
import { gelenTurOf, GELEN_SINIR, type GelenDosyaKunye } from "../src/lib/ingest/gelen";
import { ornekGelenDosyalar } from "./ornek-gelen";

export interface GelenAdres { kod: string; eposta: string | null; kopru: string }
export interface GelenDepo {
  listele(): Promise<{ dosyalar: (GelenDosyaKunye & { url?: string | null })[]; depo: boolean }>;
  icerik(d: GelenDosyaKunye & { url?: string | null }): Promise<Uint8Array>;
  yukle(f: File): Promise<{ dosya: GelenDosyaKunye; yeni: boolean }>;
  /** null = hepsi */
  sil(ids: string[] | null): Promise<void>;
  atlananlar(): Promise<string[]>;
  atla(anahtarlar: string[]): Promise<void>;
  /** anahtarlar verilmezse tüm atlananlar unutulur */
  atlananUnut(anahtarlar?: string[]): Promise<void>;
  adres(yenile?: boolean): Promise<GelenAdres>;
}

const hataMesaji = async (r: Response) => { const j: any = await r.json().catch(() => ({})); return j?.mesaj ?? (r.status === 413 ? "Dosya çok büyük" : `Sunucu ${r.status}`); };

// ───────── Canlı ─────────
function canliDepo(): GelenDepo {
  const api = CANLI.api!;
  const tamam = async (r: Response) => { if (!r.ok) throw new Error(await hataMesaji(r)); return r; };
  return {
    listele: async () => (await tamam(await api("/api/gelen"))).json(),
    async icerik(d) {
      // Olağan yol: depodaki dosyaya süreli bağlantı (sunucuyu hiç yormaz). Tarayıcı ulaşamazsa sunucu üzerinden.
      if (d.url) { try { const r = await fetch(d.url); if (r.ok) return new Uint8Array(await r.arrayBuffer()); } catch { /* sunucu üzerinden dene */ } }
      return new Uint8Array(await (await tamam(await api(`/api/gelen/${encodeURIComponent(d.id)}/dosya`))).arrayBuffer());
    },
    async yukle(f) { const form = new FormData(); form.append("dosya", f); return (await tamam(await api("/api/gelen", { method: "POST", form }))).json(); },
    async sil(ids) {
      if (!ids) { await tamam(await api("/api/gelen?hepsi=1", { method: "DELETE" })); return; }
      for (let i = 0; i < ids.length; i += 80) await tamam(await api(`/api/gelen?id=${ids.slice(i, i + 80).map(encodeURIComponent).join(",")}`, { method: "DELETE" }));
    },
    atlananlar: async () => ((await (await tamam(await api("/api/gelen/atlanan"))).json()) as { anahtarlar: string[] }).anahtarlar,
    async atla(a) { for (let i = 0; i < a.length; i += 1000) await tamam(await api("/api/gelen/atlanan", { method: "POST", json: { anahtarlar: a.slice(i, i + 1000) } })); },
    async atlananUnut(a) {
      if (!a) { await tamam(await api("/api/gelen/atlanan", { method: "DELETE" })); return; }
      for (let i = 0; i < a.length; i += 1000) await tamam(await api("/api/gelen/atlanan", { method: "DELETE", json: { anahtarlar: a.slice(i, i + 1000) } }));
    },
    adres: async (yenile) => (await tamam(await api("/api/gelen/adres", yenile ? { method: "POST", json: { yenile: true } } : {}))).json(),
  };
}

// ───────── Demo (bu tarayıcı) ─────────
const ANAHTAR = "anahtar-ai-demo-gelen";
interface DemoDurum { dosyalar: { kunye: GelenDosyaKunye; b64: string }[]; atlanan: string[] }
const b64 = (v: Uint8Array) => { let s = ""; for (let i = 0; i < v.length; i += 0x8000) s += String.fromCharCode(...v.subarray(i, i + 0x8000)); return btoa(s); };
const b64Coz = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
export function demoOrnekleri(): DemoDurum["dosyalar"] {
  return ornekGelenDosyalar().map((o) => {
    const veri = new TextEncoder().encode(o.icerik);
    return { kunye: { id: o.id, ad: o.ad, tur: gelenTurOf(o.ad)!, boyut: veri.length, kanal: o.kanal, gonderen: o.gonderen, konu: o.konu, gelis: new Date(BUGUN.getTime() - o.gunOnce * 86_400_000 - 3 * 3_600_000).toISOString() }, b64: b64(veri) };
  });
}
let BELLEK: DemoDurum | null = null;
function demoOku(): DemoDurum {
  if (BELLEK) return BELLEK;
  try { const ham = localStorage.getItem(ANAHTAR); if (ham) return (BELLEK = JSON.parse(ham) as DemoDurum); } catch { /* gizli pencere / sunucu tarafı çizim */ }
  return (BELLEK = { dosyalar: demoOrnekleri(), atlanan: [] });
}
function demoYaz(d: DemoDurum) {
  BELLEK = d;
  try { localStorage.setItem(ANAHTAR, JSON.stringify(d)); } catch { /* kota: büyük dosya yalnızca bu oturumda kalır */ }
}
/** Testler ve "örnek dosyaları yeniden yükle" için */
export function demoGelenSifirla(ornekli = true) { BELLEK = null; try { localStorage.removeItem(ANAHTAR); } catch { /* yok */ } if (!ornekli) BELLEK = { dosyalar: [], atlanan: [] }; }
function demoDepo(): GelenDepo {
  return {
    listele: async () => ({ dosyalar: demoOku().dosyalar.map((x) => x.kunye).sort((a, b) => b.gelis.localeCompare(a.gelis)), depo: true }),
    async icerik(d) { const x = demoOku().dosyalar.find((y) => y.kunye.id === d.id); if (!x) throw new Error("Dosya bulunamadı"); return b64Coz(x.b64); },
    async yukle(f) {
      const veri = new Uint8Array(await f.arrayBuffer());
      if (veri.length > GELEN_SINIR) throw new Error("Dosya 15 MB'tan büyük. WhatsApp'ta “Medya olmadan” dışa aktarın.");
      const tur = gelenTurOf(f.name, veri.subarray(0, 512), f.type);
      if (!tur) throw new Error("Bu dosya türü okunmuyor. Desteklenenler: .zip, .txt, .xlsx, .csv, .eml");
      const s = demoOku(), kod = b64(veri);
      const var_ = s.dosyalar.find((x) => x.b64 === kod);
      if (var_) return { dosya: var_.kunye, yeni: false };
      const kunye: GelenDosyaKunye = { id: "D" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), ad: f.name, tur, boyut: veri.length, kanal: "YUKLEME", gonderen: null, konu: null, gelis: new Date().toISOString() };
      demoYaz({ ...s, dosyalar: [{ kunye, b64: kod }, ...s.dosyalar] });
      return { dosya: kunye, yeni: true };
    },
    async sil(ids) { const s = demoOku(); demoYaz({ ...s, dosyalar: ids ? s.dosyalar.filter((x) => !ids.includes(x.kunye.id)) : [] }); },
    atlananlar: async () => demoOku().atlanan,
    async atla(a) { const s = demoOku(); demoYaz({ ...s, atlanan: [...new Set([...a, ...s.atlanan])].slice(0, 20_000) }); },
    async atlananUnut(a) { const s = demoOku(); demoYaz({ ...s, atlanan: a ? s.atlanan.filter((x) => !a.includes(x)) : [] }); },
    adres: async () => ({ kod: "ornekkod23456789abcd", eposta: null, kopru: "https://anahtarcrm.ornek.workers.dev/api/gelen/al" }),
  };
}

let DEPO: GelenDepo | null = null;
export const gelenDepo = (): GelenDepo => (DEPO ??= CANLI.acik ? canliDepo() : demoDepo());
/** Testler için: depoyu değiştir (sahte sunucu) */
export function gelenDepoKur(d: GelenDepo | null) { DEPO = d; }
