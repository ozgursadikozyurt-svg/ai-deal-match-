/**
 * Anahtar CRM v3.22.2 · 10 Ekim 2026
 * Canlı — Google Kişiler bağlantısının arayüz tarafı (ağ çağrıları). Ekran: demo/baglantilar.tsx.
 *
 *  googleDurumYenile  → GET /api/entegrasyon (+ açık çakışmalar): bağlı mı, hangi hesap, son eşitleme, sayılar
 *  googleBaglan       → POST /api/entegrasyon/google/baglan → dönen adrese gider (Google izin ekranı; tek "İzin ver")
 *  googleEsitle       → POST /api/senkron/calistir; sunucu "devam edecek" dedikçe yineler (büyük rehber birkaç turda biter).
 *                       Kişiler yalnızca BİR ŞEY DEĞİŞTİYSE ve yalnızca değişenler yenilenir (GET /api/durum?yalniz=kisiler&sonra=…)
 *  googleOtomatik     → v3.22.2: uygulama açılınca YALNIZCA bağlantı durumunu okur; eşitleme başlatmaz. Otomatik eşitleme günde bir kez
 *                       sunucuda (Cloudflare zamanlayıcısı, 08:00), anlık ihtiyaç için Kişiler › "Google ile eşitle" düğmesi.
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

/**
 * Kişileri sunucudan yeniler; kaydedilmemiş yerel değişiklikler korunur (demo/canli-kaydet.ts › kisileriBirlestir).
 * v3.22.2 — artımlı: önceki yenilemenin zamanı biliniyorsa yalnızca o andan sonra eklenen / değişen kişiler indirilir
 * (Google People API'nin "son eşitlemeden beri değişenler" mantığının arayüz tarafı). `tam: true` ya da zaman bilinmiyorsa hepsi.
 */
export async function kisileriYenile(guncelle: Guncelle, o: { tam?: boolean } = {}): Promise<number> {
  const sonra = !o.tam && CANLI.kisiZamani && CANLI.kisileriDegisenleriBirlestir ? CANLI.kisiZamani : null;
  const j = await googleApi("/api/durum?yalniz=kisiler" + (sonra ? `&sonra=${encodeURIComponent(sonra)}` : ""));
  const gelen = (j.kisiler as Record<string, unknown>[]).map((k) => nullAt(k)) as unknown as Kisi[];
  if (typeof j.zaman === "string") CANLI.kisiZamani = j.zaman;
  if (sonra && j.artimli) guncelle((x) => (CANLI.kisileriDegisenleriBirlestir ? CANLI.kisileriDegisenleriBirlestir(x, gelen) : x));
  else guncelle((x) => (CANLI.kisileriBirlestir ? CANLI.kisileriBirlestir(x, gelen) : x));
  return gelen.length;
}

/** "Google ile bağlan": sunucudan izin adresini alır ve tarayıcıyı oraya götürür. Dönüş: /?google=ok (demo/canli.tsx yakalar). */
export async function googleBaglan(): Promise<void> {
  await CANLI.hemen?.(); // sayfadan çıkmadan önce bekleyen kayıtlar yazılsın
  const j = await googleApi("/api/entegrasyon/google/baglan", { method: "POST", json: {} });
  location.href = j.url;
}

/** Eşitleme sunucudaki kişi listesini değiştirdi mi? (değişmediyse arayüz hiçbir şey indirmez) */
export const degistiMi = (o: GoogleOzet) => ["yeni", "guncellenen", "baglanan", "silinen", "birlesen", "cakisma", "gonderilenYeni", "gonderilenGuncel"].some((a) => (o[a] ?? 0) > 0);

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
      let ozet: GoogleOzet | null = null, hataSayisi = 0, degisti = false;
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
        // v3.22.2 — kişiler yalnızca sunucuda bir şey değiştiyse ve yalnızca değişenler yenilenir (eskiden her turda / sonda hepsi)
        if (ozet && degistiMi(ozet) && (!g?.devamEdecek || tur % 4 === 0)) { await kisileriYenile(guncelle); degisti = true; }
        if (!g?.devamEdecek) break;
      }
      if (ozet && degistiMi(ozet) && !degisti) await kisileriYenile(guncelle);
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
 * v3.22.2 — Uygulama açılınca yalnızca Google bağlantı durumu okunur (menüdeki gösterge, "N yeni" sayacı, Bağlantılar ekranı için).
 * Eşitleme BAŞLATILMAZ: açılışta ve 5 dakikada bir eşitleme, 7.800 kişilik rehberde Cloudflare ücretsiz planın CPU sınırını aşıp
 * 503 veriyordu. Otomatik eşitleme sunucuda günde bir kez (08:00) çalışır; hemen istenirse Kişiler › "Google ile eşitle".
 * Dönen işlev temizleme içindir.
 */
export function googleOtomatik(guncelle: Guncelle): () => void {
  if (!CANLI.acik) return () => {}; // izin ekranından dönüldüyse ilk içe aktarmayı Bağlantılar ekranı başlatır (burası yalnızca durum okur)
  let durdu = false;
  void googleDurumYenile((f) => { if (!durdu) guncelle(f); }).catch(() => { /* sessiz */ });
  return () => { durdu = true; };
}
