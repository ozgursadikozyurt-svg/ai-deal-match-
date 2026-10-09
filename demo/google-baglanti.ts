/**
 * Anahtar CRM v3.22 · 9 Ekim 2026
 * Canlı — Google Kişiler bağlantısının arayüz tarafı (ağ çağrıları). Ekran: demo/baglantilar.tsx.
 *
 *  googleDurumYenile  → GET /api/entegrasyon (+ açık çakışmalar): bağlı mı, hangi hesap, son eşitleme, sayılar
 *  googleBaglan       → POST /api/entegrasyon/google/baglan → dönen adrese gider (Google izin ekranı; tek "İzin ver")
 *  googleEsitle       → POST /api/senkron/calistir; sunucu "devam edecek" dedikçe yineler (büyük rehber birkaç turda biter),
 *                       arada ve sonda kişileri sunucudan yeniler (GET /api/durum?yalniz=kisiler)
 *  googleOtomatik     → uygulama açıkken: açılışta ve 5 dakikada bir sessiz eşitleme (telefonda Google'a kaydedilen kişi beklemeden gelsin)
 */
import { CANLI, type DepoDurumu, type GoogleCanliDurum, type DemoCalisma, type DemoCakisma, type Kisi } from "./depo";
import { nullAt } from "./canli-esle";

type Guncelle = (f: (d: DepoDurumu) => DepoDurumu) => void;
export type GoogleOzet = Record<string, number>;
const bekle = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function googleApi(yol: string, init?: { method?: string; json?: unknown }): Promise<any> {
  if (!CANLI.api) throw new Error("Oturum yok");
  const r = await CANLI.api(yol, init);
  const j: any = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j?.mesaj ?? `Sunucu ${r.status}`);
  return j;
}

const calismaCevir = (c: any): DemoCalisma => ({ id: c.id, saglayici: "GOOGLE_KISILER", tarih: c.baslangic, tetik: c.tetik, ozet: { ...(c.ozet ?? {}), ...(c.durum === "HATA" ? { hata: 1 } : {}) }, kontrol: [], yeniEslesme: 0, geriYazim: [], atlanan: [] });

/** Sunucudaki bağlantı durumunu okur ve arayüz durumuna yazar (menüdeki gösterge, ana sayfa daveti ve Bağlantılar ekranı buradan beslenir) */
export async function googleDurumYenile(guncelle: Guncelle): Promise<GoogleCanliDurum | null> {
  const liste: any[] = await googleApi("/api/entegrasyon");
  const g = liste.find((x) => x.saglayici === "GOOGLE_KISILER");
  if (!g) return null;
  const cak: any[] = g.acikCakisma ? await googleApi("/api/senkron/cakismalar").catch(() => []) : [];
  const canli: GoogleCanliDurum = { hazir: !!g.hazir, yetkili: !!g.yetkili, durum: g.durum, hesap: g.hesap ?? null, sonSenkron: g.sonSenkron ?? null, sonHata: g.sonHata ?? null, bagliKisi: g.bagliKisi ?? 0, bekleyen: g.bekleyen ?? 0, haric: g.haric ?? 0, devamEdiyor: !!g.devamEdiyor, acikCakisma: g.acikCakisma ?? 0, ayarlar: g.ayarlar };
  guncelle((x) => ({
    ...x, googleCanli: canli,
    baglantilar: { ...x.baglantilar, google: { ...x.baglantilar.google, durum: g.durum === "BAGLI" ? "BAGLI" : "BAGLI_DEGIL", hesap: g.hesap ?? null, sonSenkron: g.sonSenkron ?? null, ayar: { ...x.baglantilar.google.ayar, otomatik: !!g.ayarlar?.otomatik, aralikDk: g.ayarlar?.aralikDk ?? 5, googleYaz: !!g.ayarlar?.googleYaz && g.ayarlar?.yazmaIzni !== false, sadeceEtiketler: g.ayarlar?.sadeceEtiketler ?? [] } } },
    senkronGecmisi: (g.calismalar ?? []).map(calismaCevir),
    cakismalar: cak.filter((c) => c.saglayici === "GOOGLE_KISILER").map((c): DemoCakisma => ({ id: c.id, saglayici: c.saglayici, hedefTip: c.hedefTip, hedefId: c.hedefId, baslik: c.baslik ?? c.hedefId, alan: c.alan, onceki: c.onceki, yerel: c.yerel, uzak: c.uzak })),
  }));
  return canli;
}

/** Kişileri sunucudan yeniler; kaydedilmemiş yerel değişiklikler korunur (demo/canli-kaydet.ts › kisileriBirlestir) */
export async function kisileriYenile(guncelle: Guncelle): Promise<void> {
  const j = await googleApi("/api/durum?yalniz=kisiler");
  const sunucu = (j.kisiler as Record<string, unknown>[]).map((k) => nullAt(k)) as unknown as Kisi[];
  guncelle((x) => (CANLI.kisileriBirlestir ? CANLI.kisileriBirlestir(x, sunucu) : x));
}

/** "Google ile bağlan": sunucudan izin adresini alır ve tarayıcıyı oraya götürür. Dönüş: /?google=ok (demo/canli.tsx yakalar). */
export async function googleBaglan(): Promise<void> {
  await CANLI.hemen?.(); // sayfadan çıkmadan önce bekleyen kayıtlar yazılsın
  const j = await googleApi("/api/entegrasyon/google/baglan", { method: "POST", json: {} });
  location.href = j.url;
}

let suruyor: Promise<GoogleOzet | null> | null = null;
export const googleEsitlemeSuruyor = () => !!suruyor;
/**
 * Eşitlemeyi bitene kadar sürdürür. Aynı anda ikinci kez başlatılırsa süren iş döner.
 * Önce bekleyen yerel kayıtlar yazılır (yeni eklenen kişi sunucuya ulaşsın ki Google'a gönderilebilsin).
 */
export function googleEsitle(guncelle: Guncelle, o: { tam?: boolean; ilerleme?: (ozet: GoogleOzet, tur: number) => void } = {}): Promise<GoogleOzet | null> {
  if (suruyor) return suruyor;
  suruyor = (async () => {
    try {
      await CANLI.hemen?.();
      let ozet: GoogleOzet | null = null, hataSayisi = 0;
      for (let tur = 1; tur <= 200; tur++) {
        // v3.21.1 — büyük rehberlerde tek bir turun geçici hatası (503, kopan bağlantı) tüm içe aktarmayı durdurmasın:
        // ilerleme her sayfadan sonra saklandığı için aynı tur birkaç saniye sonra kaldığı yerden yinelenir.
        let j: any, g: any;
        try {
          j = await googleApi("/api/senkron/calistir", { method: "POST", json: { kaynak: "google", tetik: "kullanici", tam: !!o.tam && tur === 1 } });
          g = j.google;
          if (g?.hata) throw new Error(g.hata);
          hataSayisi = 0;
        } catch (x) {
          if (++hataSayisi > 3) throw x;
          await bekle(3000 * hataSayisi);
          continue;
        }
        if (g?.atlandi) { if (/sürüyor/.test(g.atlandi) && tur < 10) { await bekle(4000); continue; } break; }
        ozet = g?.ozet ?? ozet;
        if (ozet) o.ilerleme?.(ozet, tur);
        if (!g?.devamEdecek || tur % 4 === 0) await kisileriYenile(guncelle);
        if (!g?.devamEdecek) break;
      }
      await googleDurumYenile(guncelle);
      return ozet;
    } finally { suruyor = null; }
  })();
  return suruyor;
}

/** Eşitleme özeti → tek cümle (bildirim için) */
export function ozetCumlesi(o: GoogleOzet | null): string {
  if (!o) return "Google eşitlendi";
  const p = [o.yeni && `${o.yeni} yeni kişi geldi`, (o.guncellenen || o.baglanan) && `${(o.guncellenen ?? 0) + (o.baglanan ?? 0)} kişi güncellendi`, o.gonderilenYeni && `${o.gonderilenYeni} kişi Google'a eklendi`, o.gonderilenGuncel && `${o.gonderilenGuncel} düzeltme Google'a yazıldı`, o.cakisma && `${o.cakisma} çakışma`].filter(Boolean);
  return p.length ? "Google: " + p.join(", ") : "Google eşit — değişiklik yok";
}

/**
 * Uygulama açıkken sessiz eşitleme: açılışta (son eşitleme 2 dakikadan eskiyse) ve sonra 5 dakikada bir, yalnızca sekme
 * görünürken. Yalnızca bağlantı kurma yetkisi olan kullanıcıda çalışır; diğerleri için zamanlayıcı (15 dk) yeterlidir.
 * Dönen işlev zamanlayıcıyı durdurur.
 */
export function googleOtomatik(guncelle: Guncelle): () => void {
  if (!CANLI.acik) return () => {};
  let durdu = false;
  const dene = async (esikMs: number) => {
    if (durdu || suruyor || (typeof document !== "undefined" && document.visibilityState === "hidden")) return;
    try {
      const g = await googleDurumYenile(guncelle);
      if (!g || g.durum !== "BAGLI" || !g.yetkili) return;
      if (g.devamEdiyor || !g.sonSenkron || Date.now() - new Date(g.sonSenkron).getTime() > esikMs) await googleEsitle(guncelle);
    } catch { /* sessiz: bir sonraki denemede yeniden */ }
  };
  if (!CANLI.googleDonus) void dene(120_000); // izin ekranından dönüldüyse ilk içe aktarmayı Bağlantılar ekranı başlatır
  const t = setInterval(() => void dene(240_000), 300_000);
  return () => { durdu = true; clearInterval(t); };
}
