/**
 * Anahtar CRM v3.22.1 · 9 Ekim 2026
 * Açılışta kayıt onarımı — eski sürümlerin yanlış yazdığı alanlar, kayıt bir kez açılınca düzeltilir.
 * Canlıda düzeltilen kayıtlar normal kayıt kuyruğuyla sunucuya da yazılır (demo/canli.tsx).
 *
 *  1. Satış işleminde (satılık, devren satılık, kat karşılığı, takas) fiyat periyodu "Toplam" olmalı. Formda yeni kayıt
 *     "Aylık" ile açılıyordu: satılığa çevrilen talepte "Aylık 12.000.000" kalıyor, eşleşmede fiyat "bilinmiyor" çıkıyordu.
 *  2. "… hariç / … dışında" yazan eski talepler (v3.22 öncesi): hariç yerler ARANAN bölgeye yazılmıştı
 *     ("Konyaaltı bölgesi ( Hurma-Sarısu-Liman hariç)" → Hurma, Sarısu). Mesaj yeniden okunur, hariç satırları kurulur.
 *  3. "Site içi olmayan" / "havuz istemiyor" eskiden "site içinde istiyor" diye okunuyordu → "istemiyor".
 *  4. Bütçesi boş talep: mesajdaki "Bütçe : max 7 m", "Bütçe - 7.5 M" artık okunuyor → bütçe yazılır.
 * Kayıt bir kez onarılınca yeniden onarılmaz (sonuç aynı çıkar); elle düzeltilmiş kayıtlara dokunmamak için yalnızca
 * mesajdan kanıt varsa değişir.
 */
import { yorumla } from "../src/lib/ai/yorumlayici";
import { hizliAyristir } from "../src/lib/ai/hizli-ayristirici";
import { haricBirlestir } from "../src/lib/lokasyon/haric";
import { SATIS_ISLEMLERI } from "../src/lib/eslestirme/onizleme";
import { INDEKS, coz, cozulenToKayitLok, konumOzeti, lokEtiket } from "./lokasyon";

type V = Record<string, any>;
const HARIC_RE = /hari[cç]|d[ıi][şs][ıi]nda|olmas[ıi]n/i;

export function kayitOnar(v: V): { veri: V; degisti: string[] } {
  const d: string[] = [];
  let y = v;
  if (SATIS_ISLEMLERI.has(y.islemTipi) && y.fiyatPeriyodu && y.fiyatPeriyodu !== "TOPLAM") { y = { ...y, fiyatPeriyodu: "TOPLAM" }; d.push("periyot"); }
  if (y.tip === "TALEP" && typeof y.hamMetin === "string" && y.hamMetin) {
    const lok: V[] = y.lokasyonlar ?? [];
    if (HARIC_RE.test(y.hamMetin) && !lok.some((l) => l.haric)) {
      const p = yorumla(y.hamMetin, INDEKS).parcalar[0];
      const haric = p?.haricKonumlar?.length ? cozulenToKayitLok(coz(p.haricKonumlar).lokasyonlar, false).map(({ etiket, seviye, ...l }) => l) : [];
      if (haric.length) {
        const yeni = haricBirlestir(lok.map(({ birincil, ...l }) => ({ ...l, birincil: false })) as any[], haric as any[]);
        // Kendiliğinden kurulmuş başlığın başındaki eski yer adları ("Hurma, Sarısu 2+1 …") yeni özetle değişir
        const adlar = [...new Set([...lok, ...haric].map((l) => String(lokEtiket(l)).split(" / ").pop()!))].map((x) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
        const on = adlar.length ? new RegExp(`^(?:(?:${adlar.join("|")})(?:\\s*[,/]\\s*|\\s+))+`, "u") : null;
        const m = typeof y.baslik === "string" && /talebi$/.test(y.baslik) && on ? y.baslik.match(on) : null;
        const baslik = m ? `${konumOzeti(yeni)} ${y.baslik.slice(m[0].length)}` : y.baslik;
        y = { ...y, lokasyonlar: yeni, ...(baslik !== y.baslik ? { baslik } : {}) };
        d.push("haric");
      }
    }
    // 4. Bütçesi boş kalmış talep: mesajda "Bütçe : max 7 m" / "Bütçe - 7.5 M" gibi yazılmışsa (v3.22.1 öncesi okunamıyordu)
    if (y.maxFiyat == null && y.minFiyat == null) {
      const h = hizliAyristir(y.hamMetin);
      const b = h.maxFiyat ?? h.fiyat;
      const satis = SATIS_ISLEMLERI.has(y.islemTipi);
      if (b != null && (satis ? b >= 100_000 : b >= 5_000 && b < 2_000_000)) { y = { ...y, maxFiyat: b, ...(h.minFiyat != null && h.minFiyat < b ? { minFiyat: h.minFiyat } : {}) }; d.push("butce"); }
    }
    const oz = y.ozellik ?? {};
    if (oz.siteIcinde === true || oz.havuz === true) {
      const h = hizliAyristir(y.hamMetin).ozellik as V;
      const yeniOz = { ...oz };
      for (const a of ["siteIcinde", "havuz"]) if (oz[a] === true && h[a] === false) { yeniOz[a] = false; d.push(a); }
      if (d.includes("siteIcinde") || d.includes("havuz")) y = { ...y, ozellik: yeniOz };
    }
  }
  return { veri: y, degisti: d };
}

/** Tüm kayıtlar: değişen yoksa aynı dizi döner */
export function kayitlariOnar<K extends { veri: any }>(kayitlar: K[]): { kayitlar: K[]; sayi: number } {
  let sayi = 0;
  const yeni = kayitlar.map((k) => { const r = kayitOnar(k.veri); if (!r.degisti.length) return k; sayi++; return { ...k, veri: r.veri }; });
  return { kayitlar: sayi ? yeni : kayitlar, sayi };
}
