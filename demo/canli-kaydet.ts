/**
 * Anahtar CRM v3.14 · 3 Ekim 2026
 * Canlı — kaydetme kuyruğu. Arayüzdeki her değişiklikte `kuyrugaAl(durum)` çağrılır; kısa bir bekleyişten sonra (arka arkaya değişiklikler birleşir)
 * yalnızca değişenler POST /api/durum ile sunucuya yazılır. Sunucunun reddettiği kayıtlar (doğrulama hatası) "değişmemiş" sayılmaz, hata listesinde görünür.
 * Ağ koparsa değişiklikler bellekte durur, aralıklarla yeniden denenir; sekme kapatılırken bekleyen iş varsa tarayıcı uyarır.
 */
import { imzaAl, planla, type Imza } from "./canli-esle";
import type { DepoDurumu } from "./depo";

export type KaydetAdi = "kayitli" | "bekliyor" | "kaydediliyor" | "hata";
export interface KaydetDurumu { ad: KaydetAdi; hatalar: { id: string; mesaj: string }[]; mesaj?: string }
type Api = (yol: string, init?: { method?: string; json?: unknown }) => Promise<Response>;

export function kaydediciKur(a: { api: Api; baslangic: DepoDurumu; durum: (s: KaydetDurumu) => void; bekleMs?: number; yenidenMs?: number }) {
  let imza: Imza = imzaAl(a.baslangic);
  let son: DepoDurumu = a.baslangic;
  let zaman: ReturnType<typeof setTimeout> | undefined;
  let calisiyor: Promise<void> | null = null;
  let hatalar: KaydetDurumu["hatalar"] = [];
  let deneme = 0;
  const reddedilen = new Map<string, string>(); // kimlik → reddedildiği andaki imza: içeriği değişmedikçe yeniden gönderilmez
  const bildir = (ad: KaydetAdi, mesaj?: string) => a.durum({ ad, hatalar, mesaj });

  async function bir() {
    for (let tur = 0; tur < 5; tur++) { // kaydederken yeni değişiklik gelirse birkaç tur daha
      const guncel = imzaAl(son);
      for (const [id, s] of reddedilen) { // reddedilen kayıt/kişi düzeltilmediyse "değişmemiş" görünsün; düzeltildiyse yeniden denensin
        const g = guncel.kayit.get(id) ?? guncel.kisi.get(id);
        if (g === s) { if (imza.kayit.has(id) || guncel.kayit.has(id)) imza.kayit.set(id, s); else imza.kisi.set(id, s); } else reddedilen.delete(id);
      }
      hatalar = hatalar.filter((h) => reddedilen.has(h.id));
      const p = planla(imza, son);
      if (p.bos) { bildir(hatalar.length ? "hata" : "kayitli", hatalar.length ? `${hatalar.length} kayıt kaydedilemedi` : undefined); return; }
      bildir("kaydediliyor");
      const yeniHatalar: KaydetDurumu["hatalar"] = [];
      for (const parca of p.parcalar) {
        const r = await a.api("/api/durum", { method: "POST", json: parca });
        const j: any = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j?.mesaj ?? (j?.alanlar ? "Doğrulama hatası" : `Sunucu ${r.status}`));
        for (const h of (j?.hatalar ?? []) as { id: string; mesaj: string }[]) yeniHatalar.push(h);
      }
      // başarıyla yazılanlar kaydedilmiş sayılır; reddedilenler eski imzada kalır (bir sonraki değişiklikte yeniden denenir)
      const kabul = new Map(p.imza.kayit), kisiK = new Map(p.imza.kisi);
      for (const h of yeniHatalar) {
        if (imza.kayit.has(h.id)) kabul.set(h.id, imza.kayit.get(h.id)!); else kabul.delete(h.id);
        if (imza.kisi.has(h.id)) kisiK.set(h.id, imza.kisi.get(h.id)!); else kisiK.delete(h.id);
      }
      imza = { ...p.imza, kayit: kabul, kisi: kisiK };
      for (const h of yeniHatalar) reddedilen.set(h.id, p.imza.kayit.get(h.id) ?? p.imza.kisi.get(h.id) ?? "");
      hatalar = [...hatalar.filter((h) => reddedilen.has(h.id) && !yeniHatalar.some((y) => y.id === h.id)), ...yeniHatalar]; deneme = 0;
    }
    bildir(hatalar.length ? "hata" : "kayitli", hatalar.length ? `${hatalar.length} kayıt kaydedilemedi` : undefined);
  }
  function calistir(): Promise<void> {
    if (calisiyor) return calisiyor;
    calisiyor = (async () => {
      try { await bir(); }
      catch (e: any) {
        deneme++; bildir("hata", `Kaydedilemedi: ${e?.message ?? e}${deneme <= 4 ? " — yeniden denenecek" : ""}`);
        if (deneme <= 4) zaman = setTimeout(() => { zaman = undefined; void calistir(); }, a.yenidenMs ?? 8000);
      } finally { calisiyor = null; }
    })();
    return calisiyor;
  }
  return {
    kuyrugaAl(d: DepoDurumu) {
      son = d;
      if (planla(imza, d).bos) return;
      bildir("bekliyor");
      if (zaman) clearTimeout(zaman);
      zaman = setTimeout(() => { zaman = undefined; void calistir(); }, a.bekleMs ?? 900);
    },
    async hemen() { if (zaman) { clearTimeout(zaman); zaman = undefined; } await (calisiyor ?? Promise.resolve()); await calistir(); },
    bekliyorMu: () => !!zaman || !!calisiyor || hatalar.length > 0 || !planla(imza, son).bos,
  };
}
