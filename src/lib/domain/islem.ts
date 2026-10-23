/**
 * Anahtar CRM v3.42 · 23 Ekim 2026
 * İŞLEM ve RANDEVU — tarayıcı ile sunucunun ortak, bağımlılıksız kuralları.
 *
 * P&L kuralı (docs/ANAHTAR_POLARIS_KARAR): "bana kalan" tahsilat tarihinin ayına yazılır; tahsilat tarihi boşsa "bekleyen".
 * Polaris'ten taşınan geçmişte tahsilat tarihi = işlem tarihi alınır, böylece geçmiş P&L rakamları değişmez.
 */
export const ISLEM_TURLERI = ["SATIS", "KIRALAMA", "DIGER"] as const;
export type IslemTuru = (typeof ISLEM_TURLERI)[number];
export const ISLEM_TURU_ETIKET: Record<IslemTuru, string> = { SATIS: "Satış", KIRALAMA: "Kiralama", DIGER: "Diğer" };

export const RANDEVU_TURLERI = ["GOSTERIM", "GORUSME"] as const;
export const RANDEVU_TURU_ETIKET: Record<(typeof RANDEVU_TURLERI)[number], string> = { GOSTERIM: "Gösterim", GORUSME: "Görüşme" };
export const RANDEVU_SONUCLARI = ["PLANLANDI", "GERCEKLESTI", "IPTAL", "GELMEDI"] as const;
export const RANDEVU_SONUC_ETIKET: Record<(typeof RANDEVU_SONUCLARI)[number], string> = { PLANLANDI: "Planlandı", GERCEKLESTI: "Gerçekleşti", IPTAL: "İptal", GELMEDI: "Gelmedi" };

const kucuk = (s: string) => s.toLocaleLowerCase("tr-TR").replace(/ş/g, "s").replace(/ı/g, "i");
/** Başlıktan tür tahmini (Polaris'teki kuralla aynı: "satış" → satış, "kira" → kiralama). */
export function turTahmini(baslik: string | null | undefined): IslemTuru {
  const b = kucuk(baslik ?? "");
  return /satis/.test(b) ? "SATIS" : /kira/.test(b) ? "KIRALAMA" : "DIGER";
}

export interface IslemOzetSatiri { tahsilatTarihi?: string | Date | null; banaKalan?: number | string | null }
/** Yılın 12 ayı için "bana kalan" toplamı (tahsilat ayına göre) + yılın toplamı. Tahsilatı olmayanlar "bekleyen"de (yıldan bağımsız). */
export function aylikBanaKalan(islemler: IslemOzetSatiri[], yil: number): { aylar: number[]; toplam: number; bekleyen: number } {
  const aylar = Array(12).fill(0) as number[];
  let bekleyen = 0;
  for (const x of islemler) {
    const t = Number(x.banaKalan) || 0;
    if (!x.tahsilatTarihi) { bekleyen += t; continue; }
    const s = typeof x.tahsilatTarihi === "string" ? x.tahsilatTarihi : x.tahsilatTarihi.toISOString();
    if (Number(s.slice(0, 4)) === yil) aylar[Number(s.slice(5, 7)) - 1] += t;
  }
  return { aylar, toplam: aylar.reduce((a, b) => a + b, 0), bekleyen };
}

/** Tarihi gün ortasına (12:00 UTC) sabitler: saat dilimi farkı ayı / günü kaydırmasın. "2026-05-22" → 2026-05-22T12:00:00Z */
export const gunOrtasi = (g: string): string => `${g.slice(0, 10)}T12:00:00.000Z`;

/** Polaris işlem satırı (İşlemler 2026 ya da Arşiv) */
export interface PolarisIslem { tarih?: string | null; ay?: number | null; liste?: unknown; banaKalan?: number | null; fiyat?: number | null; paylasimli?: number | null; ofise?: number | null; aciklama?: unknown; reklam?: unknown; silindi?: boolean }
/** Polaris hücreleri Excel'den geldi: metin alanında sayı da olabilir */
const metin = (v: unknown): string | null => (v == null ? null : String(v).trim() || null);
/** Polaris satırı → Anahtar işlemi (docs/ANAHTAR_POLARIS_KARAR › Alan eşlemesi). Silinmiş ya da tarihsiz satır null. */
export function polarisDonustur(x: PolarisIslem, disKimlik: string) {
  if (x.silindi || !x.tarih) return null;
  const tarih = gunOrtasi(x.tarih);
  return {
    disKaynak: "POLARIS", disKimlik,
    tarih, tahsilatTarihi: tarih,
    tur: turTahmini(metin(x.liste)), baslik: metin(x.liste) ?? "(başlıksız işlem)",
    bedel: x.fiyat ?? null, paylasilan: x.paylasimli ?? null, ofisPayi: x.ofise ?? null, banaKalan: x.banaKalan ?? null,
    aciklama: metin(x.aciklama),
    reklam: !!metin(x.reklam),
    talepKaynagi: metin(x.reklam) ? "REKLAM" : null,
  };
}
