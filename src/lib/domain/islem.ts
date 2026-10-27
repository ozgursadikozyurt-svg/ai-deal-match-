/**
 * Anahtar CRM v3.44 · 27 Ekim 2026
 * İŞLEM ve RANDEVU — tarayıcı ile sunucunun ortak, bağımlılıksız kuralları.
 *
 * P&L kuralı (docs/ANAHTAR_POLARIS_KARAR): "bana kalan" tahsilat tarihinin ayına yazılır; tahsilat tarihi boşsa "bekleyen".
 * Polaris'ten taşınan geçmişte tahsilat tarihi = işlem tarihi alınır, böylece geçmiş P&L rakamları değişmez.
 *
 * v3.44 — Polaris "İşlemler 2026" ekranının kuralları buraya taşındı: özet kutuları (yilOzeti),
 * açıklamadan renkli etiket çıkarma (notEtiketleri) ve "Kimden iş geldi?" tablosu (kimdenIsGeldi).
 * İki uygulamanın aynı rakamı göstermesi için tek kaynak burasıdır.
 */
export const ISLEM_TURLERI = ["SATIS", "KIRALAMA", "DIGER"] as const;
export type IslemTuru = (typeof ISLEM_TURLERI)[number];
export const ISLEM_TURU_ETIKET: Record<IslemTuru, string> = { SATIS: "Satış", KIRALAMA: "Kiralama", DIGER: "Diğer" };
/** Tür rengi — ekranda rozet ve kart şeridi (Polaris: satış yeşil, kiralama mavi, diğer gri) */
export const ISLEM_TURU_TON: Record<IslemTuru, string> = { SATIS: "yesil", KIRALAMA: "mavi", DIGER: "notr" };

/** v3.44 — işlemin tarafları (Polaris'teki rol listesiyle birebir) */
export const TARAF_ROLLERI = ["ALICI_KIRACI", "SATICI_KIRAYA_VEREN", "REFERANS", "PAYLASILAN_DANISMAN", "DIGER"] as const;
export type TarafRolu = (typeof TARAF_ROLLERI)[number];
export const TARAF_ROLU_ETIKET: Record<TarafRolu, string> = {
  ALICI_KIRACI: "Alıcı / kiracı",
  SATICI_KIRAYA_VEREN: "Satıcı / kiraya veren",
  REFERANS: "Referans",
  PAYLASILAN_DANISMAN: "Paylaşılan danışman",
  DIGER: "Diğer",
};

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

// ───────── v3.44 · Polaris "İşlemler" ekranının kuralları ─────────

/** Açıklama notundan çıkarılan renkli etiket. ton: pill sınıfı (iyi / uyari / notr) */
export interface NotEtiketi { etiket: string; ton: "iyi" | "uyari" | "notr" }
/**
 * Serbest açıklama notundan renkli etiketleri çıkarır (Polaris'teki noteTags ile aynı kurallar).
 * Not metni hiç değiştirilmez; etiketler yalnızca okumayı kolaylaştırmak için üretilir.
 */
export function notEtiketleri(aciklama: string | null | undefined): NotEtiketi[] {
  const s = kucuk(aciklama ?? "");
  if (!s) return [];
  const t: NotEtiketi[] = [];
  // v3.44 — olumsuz ekler önce bakılır: "fatura kesilmedi" Polaris'te yanlışlıkla "Faturalı" çıkıyordu.
  if (/faturasiz|fatura yok|fatutrasiz|fatura kesilme|fatura kesmedi|faturalandirilmadi/.test(s)) t.push({ etiket: "Faturasız", ton: "uyari" });
  else if (/kdv|fatura kesil|faturalandir/.test(s)) t.push({ etiket: "Faturalı", ton: "iyi" });
  if (/nakit|elden/.test(s)) t.push({ etiket: "Nakit / elden", ton: "uyari" });
  if (/paylasilmadi|yapilmadi|yapilmamis|paylasimsiz|verilmedi|paylasilmamis/.test(s)) t.push({ etiket: "Ofisle paylaşılmadı", ton: "notr" });
  else if (/paylasim yapildi|ofise paylas|komisyon verildi|ofisle paylasim|paylastik/.test(s)) t.push({ etiket: "Ofisle paylaşıldı", ton: "iyi" });
  return t;
}

/** Yıl özeti kutularının kaynağı (Polaris: yearNumbers). `ay` 1–12, yıl bitmişse 12 alınır. */
export interface YilOzeti { toplam: number; aylikOrtalama: number; hedef: number; kalan: number; kalanAy: number; gerekenAylik: number; buAy: number; ayNo: number; bekleyen: number }
export function yilOzeti(islemler: IslemOzetSatiri[], yil: number, hedef: number, bugun = new Date()): YilOzeti {
  const { aylar, toplam, bekleyen } = aylikBanaKalan(islemler, yil);
  const ayNo = bugun.getFullYear() === yil ? bugun.getMonth() + 1 : bugun.getFullYear() > yil ? 12 : 1;
  const kalan = Math.max(0, hedef - toplam);
  const kalanAy = Math.max(1, 12 - ayNo + 1);
  return { toplam, aylikOrtalama: toplam / ayNo, hedef, kalan, kalanAy, gerekenAylik: kalan / kalanAy, buAy: aylar[ayNo - 1] ?? 0, ayNo, bekleyen };
}

/** "Kimden iş geldi?" satırı */
export interface IsKaynagiSatiri { kisiId: string | null; ad: string; roller: string[]; adet: number; banaKalan: number }
export interface KimdenIsGeldiSatiri {
  banaKalan?: number | string | null;
  referansKisiId?: string | null; referansAd?: string | null;
  paylasilanKisiId?: string | null; paylasilanAd?: string | null;
  taraflar?: { kisiId?: string | null; ad?: string | null; rol?: string | null }[] | null;
}
/**
 * İşlemlerin referans, paylaşılan danışman ve taraf bağlarından kişi bazlı iş özeti çıkarır.
 * Aynı kişi bir işlemde birkaç rolde geçse bile iş sayısı 1 artar (Polaris'teki whoStats davranışı).
 */
export function kimdenIsGeldi(islemler: KimdenIsGeldiSatiri[]): IsKaynagiSatiri[] {
  const harita = new Map<string, IsKaynagiSatiri>();
  for (const x of islemler) {
    const tutar = Number(x.banaKalan) || 0;
    const bagli: { id: string | null; ad: string; rol: string }[] = [];
    const ekle = (id: string | null | undefined, ad: string | null | undefined, rol: string) => { const a = (ad ?? "").trim(); if (id || a) bagli.push({ id: id ?? null, ad: a, rol }); };
    ekle(x.referansKisiId, x.referansAd, TARAF_ROLU_ETIKET.REFERANS);
    ekle(x.paylasilanKisiId, x.paylasilanAd, TARAF_ROLU_ETIKET.PAYLASILAN_DANISMAN);
    for (const t of x.taraflar ?? []) ekle(t.kisiId, t.ad, TARAF_ROLU_ETIKET[(t.rol ?? "DIGER") as TarafRolu] ?? "Diğer");
    const sayildi = new Set<string>();
    for (const b of bagli) {
      const k = b.id ?? "ad:" + kucuk(b.ad);
      const o = harita.get(k) ?? { kisiId: b.id, ad: b.ad, roller: [], adet: 0, banaKalan: 0 };
      if (!o.ad && b.ad) o.ad = b.ad;
      if (!o.roller.includes(b.rol)) o.roller.push(b.rol);
      if (!sayildi.has(k)) { sayildi.add(k); o.adet += 1; o.banaKalan += tutar; }
      harita.set(k, o);
    }
  }
  return [...harita.values()].sort((a, b) => b.banaKalan - a.banaKalan || b.adet - a.adet);
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
