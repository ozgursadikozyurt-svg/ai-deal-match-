/**
 * Anahtar CRM v3.22.2 · 10 Ekim 2026
 * Talepten portallarda arama bağlantısı üretir (Sahibinden, Emlakjet, Hepsiemlak).
 * Kullanıcı bağlantıyı açıp portalda KENDİSİ bakar: otomatik veri çekme (scraping) yapılmaz — üç portalın
 * kullanım koşulları otomatik veri çekmeyi yasaklıyor (bkz. PORTAL_ENTEGRASYON_ARASTIRMASI).
 * Adres kalıpları 30.09.2026'da portal sayfalarında görüldüğü kadarıyla; fiyat parametresi yalnızca
 * Sahibinden'de doğrulandı (price_min / price_max). Diğer filtreler portalda elle eklenir.
 */
import { slug } from "../lokasyon/normalize";
import { kiralikMi } from "../domain/gecerlilik";

export interface PortalLinki { portal: "Sahibinden" | "Emlakjet" | "Hepsiemlak"; etiket: string; url: string; not?: string }
type Kat = { sahibinden: string; emlakjet: string; hepsiemlak: string };
const KATEGORI: Record<string, Kat> = {
  DAIRE: { sahibinden: "daire", emlakjet: "daire", hepsiemlak: "daire" },
  MUSTAKIL: { sahibinden: "villa", emlakjet: "villa", hepsiemlak: "villa" },
  DUKKAN: { sahibinden: "is-yeri-dukkan-magaza", emlakjet: "isyeri", hepsiemlak: "dukkan-magaza" },
  YEME_ICME: { sahibinden: "is-yeri", emlakjet: "isyeri", hepsiemlak: "isyeri" },
  DEPO: { sahibinden: "is-yeri", emlakjet: "isyeri", hepsiemlak: "isyeri" },
  URETIM: { sahibinden: "is-yeri", emlakjet: "isyeri", hepsiemlak: "isyeri" },
  OFIS: { sahibinden: "is-yeri", emlakjet: "isyeri", hepsiemlak: "isyeri" },
  HIZMET: { sahibinden: "is-yeri", emlakjet: "isyeri", hepsiemlak: "isyeri" },
  OTO: { sahibinden: "is-yeri", emlakjet: "isyeri", hepsiemlak: "isyeri" },
  ARSA: { sahibinden: "arsa", emlakjet: "arsa", hepsiemlak: "arsa" },
  BINA: { sahibinden: "bina", emlakjet: "bina", hepsiemlak: "bina" },
  TURIZM: { sahibinden: "turistik-tesis", emlakjet: "turistik-tesis", hepsiemlak: "turistik-tesis" },
  DEVRE_MULK: { sahibinden: "devre-mulk", emlakjet: "devremulk", hepsiemlak: "devremulk" },
  DIGER: { sahibinden: "emlak", emlakjet: "isyeri", hepsiemlak: "isyeri" },
};

/** aileKodu: MULK_AILELERI kodu; ilceler: ilçe adları (en fazla 3 bağlantı) */
export function portalLinkleri(p: { aileKodu: string; islemTipi: string; il?: string; ilceler: string[]; maxFiyat?: number | null; minFiyat?: number | null }): PortalLinki[] {
  const k = KATEGORI[p.aileKodu] ?? KATEGORI.DIGER;
  const islem = kiralikMi(p.islemTipi) ? "kiralik" : "satilik";
  const il = slug(p.il ?? "Antalya");
  const ilceler = p.ilceler.length ? p.ilceler.slice(0, 3) : [""];
  const out: PortalLinki[] = [];
  for (const ad of ilceler) {
    const ilce = ad ? slug(ad) : "";
    const yer = ilce ? `${il}-${ilce}` : il;
    const q = new URLSearchParams();
    if (p.minFiyat) q.set("price_min", String(Math.round(p.minFiyat)));
    if (p.maxFiyat) q.set("price_max", String(Math.round(p.maxFiyat)));
    const e = ad || "Antalya";
    out.push({ portal: "Sahibinden", etiket: e, url: `https://www.sahibinden.com/${islem}-${k.sahibinden}/${yer}${q.toString() ? "?" + q : ""}`, not: "fiyat aralığı uygulandı" });
    out.push({ portal: "Emlakjet", etiket: e, url: `https://www.emlakjet.com/${islem}-${k.emlakjet}/${yer}`, not: "fiyatı portalda seçin" });
    out.push({ portal: "Hepsiemlak", etiket: e, url: `https://www.hepsiemlak.com/${ilce || il}-${islem}/${k.hepsiemlak}`, not: "fiyatı portalda seçin" });
  }
  return out;
}