/**
 * Anahtar CRM v3.41 · 23 Ekim 2026
 * Rehber parça parça yüklenir (Cloudflare ücretsiz plan işlemci sınırı). Açılışta yalnızca bir talebe / portföye bağlı kişiler gelir;
 * geri kalanı Rehber ekranındaki "Devam et" düğmesiyle (ya da kişi eşleştirmesi gereken ekranlarda kendiliğinden) çekilir.
 * Gelen kişiler `kisileriDegisenleriBirlestir` ile eklenir: kaydedilmemiş yerel iş korunur, gelmeyen kişi "silinmiş" sayılmaz.
 */
import { CANLI, type DepoDurumu, type Kisi } from "./depo";
import { nullAt } from "./canli-esle";

type Guncelle = (f: (d: DepoDurumu) => DepoDurumu) => void;
export const KISI_PARCA_ADEDI = 250;

/** Rehberin durumu: `sonraki` = bir sonraki sayfanın başlangıcı (null = hepsi yüklü); `toplam` = sunucudaki kişi sayısı */
export const REHBER: { sonraki: number | null; toplam: number | null; yukluyor: Promise<void> | null; hata: string | null } = { sonraki: null, toplam: null, yukluyor: null, hata: null };
const dinleyen = new Set<() => void>();
export const rehberiIzle = (f: () => void) => { dinleyen.add(f); return () => { dinleyen.delete(f); }; };
const duyur = () => dinleyen.forEach((f) => f());
export const rehberTamMi = () => REHBER.sonraki == null;

/** Bir sonraki `sayfa` parçayı (varsayılan 1) indirir; `hepsi` ise rehber bitene kadar sürdürür. Aynı anda ikinci çağrı süren işi bekler. */
export function rehberiYukle(guncelle: Guncelle, o: { hepsi?: boolean; sayfa?: number } = {}): Promise<void> {
  if (REHBER.yukluyor) return REHBER.yukluyor;
  if (rehberTamMi() || !CANLI.api || !CANLI.kisileriDegisenleriBirlestir) return Promise.resolve();
  const api = CANLI.api;
  REHBER.hata = null;
  const is = (async () => {
    try {
      for (let n = 0; REHBER.sonraki != null && (o.hepsi || n < (o.sayfa ?? 1)); n++) {
        let j: any = null;
        for (let deneme = 0; deneme < 3 && !j; deneme++) {
          if (deneme) await new Promise((x) => setTimeout(x, 400 * deneme));
          const r = await api(`/api/durum?parca=kisi&atla=${REHBER.sonraki}&al=${KISI_PARCA_ADEDI}`);
          if (r.ok) j = await r.json(); else REHBER.hata = (await r.json().catch(() => ({})))?.mesaj ?? `Sunucu ${r.status}`;
        }
        if (!j) throw new Error(REHBER.hata ?? "Kişiler alınamadı");
        const gelen = (j.kisiler as Record<string, unknown>[]).map((k) => nullAt(k)) as unknown as Kisi[];
        guncelle((x) => (CANLI.kisileriDegisenleriBirlestir ? CANLI.kisileriDegisenleriBirlestir(x, gelen) : x));
        REHBER.sonraki = typeof j.sonraki === "number" ? j.sonraki : null;
        REHBER.hata = null; duyur();
      }
    } catch (e: any) { REHBER.hata = e?.message ?? String(e); }
    finally { REHBER.yukluyor = null; duyur(); }
  })();
  REHBER.yukluyor = is; duyur();
  return is;
}

/** Kişi eşleştirmesi gereken ekranlar (Gelen kutusu, İçe aktarma, kayıt formu): ekran açılınca rehberin kalanını arka planda tamamlar — yoksa var olan kişi yeni kişi sanılırdı. */
import { useEffect, useState } from "react";
import { useDepo } from "./ortak";
export function useRehberTamamla(): void {
  const { guncelle } = useDepo() as any;
  useEffect(() => { if (!rehberTamMi()) void rehberiYukle(guncelle, { hepsi: true }); }, []); // eslint-disable-line react-hooks/exhaustive-deps
}
/** Rehberin durumunu izler (yükleniyor / kaç kişi yüklü) */
export function useRehber() {
  const [, say] = useState(0);
  useEffect(() => rehberiIzle(() => say((n) => n + 1)), []);
  return REHBER;
}
