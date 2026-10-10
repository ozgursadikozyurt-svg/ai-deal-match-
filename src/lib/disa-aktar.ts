/**
 * Anahtar CRM v3.23 · 10 Ekim 2026
 * Verileri dışa aktarma — arşiv, yedek ya da başka bir CRM'e taşıma için. Demo ve sunucu aynı kodu kullanır.
 * CSV: Excel'in Türkçe ayarıyla doğrudan açılır (UTF-8 BOM + noktalı virgül). JSON: tam yedek (her alan).
 */
export interface Sutun<T> { baslik: string; deger: (x: T) => unknown }
const hucre = (v: unknown) => {
  if (v == null) return "";
  const s = v instanceof Date ? v.toISOString().slice(0, 10) : Array.isArray(v) ? v.join(", ") : typeof v === "object" ? JSON.stringify(v) : String(v);
  return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
export function csvYaz<T>(satirlar: T[], sutunlar: Sutun<T>[]): string {
  return "\uFEFF" + [sutunlar.map((s) => hucre(s.baslik)).join(";"), ...satirlar.map((r) => sutunlar.map((s) => hucre(s.deger(r))).join(";"))].join("\r\n") + "\r\n";
}

type V = Record<string, any>;
const lok = (v: V, etiket?: (l: any) => string) => (v.lokasyonlar ?? []).map((l: any) => (etiket ? etiket(l) : [l.ilceId, l.mahalleId].filter(Boolean).join("/"))).join(" | ");
/** Kayıt (talep / portföy) sütunları — `etiket` verilirse konum adları yazılır */
export function kayitSutunlari(kisiAdi: (id: string) => string, konumEtiket?: (l: any) => string): Sutun<{ id: string; olusturma?: string | Date; veri: V }>[] {
  const v = (f: (x: V) => unknown) => (k: { veri: V }) => f(k.veri);
  return [
    { baslik: "Kayıt no", deger: (k) => k.id }, { baslik: "Tip", deger: v((x) => x.tip) }, { baslik: "Durum", deger: v((x) => x.durum) },
    { baslik: "Başlık", deger: v((x) => x.baslik) }, { baslik: "Mülk tipi", deger: v((x) => x.mulkTipi) }, { baslik: "İşlem", deger: v((x) => x.islemTipi) },
    { baslik: "Fiyat", deger: v((x) => x.fiyat) }, { baslik: "Bütçe min", deger: v((x) => x.minFiyat) }, { baslik: "Bütçe max", deger: v((x) => x.maxFiyat) }, { baslik: "Fiyat periyodu", deger: v((x) => x.fiyatPeriyodu) },
    { baslik: "m²", deger: v((x) => x.m2) }, { baslik: "m² min", deger: v((x) => x.minM2) }, { baslik: "m² max", deger: v((x) => x.maxM2) }, { baslik: "Oda", deger: v((x) => x.odaSayisi) },
    { baslik: "Konum", deger: v((x) => lok(x, konumEtiket)) }, { baslik: "Konum (yazılan)", deger: v((x) => x.lokasyonHam) },
    { baslik: "Aciliyet", deger: v((x) => x.aciliyet) }, { baslik: "Kişiler", deger: v((x) => (x.kisiler ?? []).map((b: any) => `${kisiAdi(b.kisiId)} (${b.rol})`).join(", ")) },
    { baslik: "Gönderen", deger: v((x) => x.gondeAdi) }, { baslik: "Gönderen tel", deger: v((x) => x.gondeTelefon) }, { baslik: "İlan sahibi tipi", deger: v((x) => x.ilanSahibiTipi) },
    { baslik: "Havuz", deger: v((x) => x.havuz) }, { baslik: "Kanal", deger: v((x) => x.veriKanali) }, { baslik: "Portal bağlantısı", deger: v((x) => x.portalUrl) }, { baslik: "İlan no", deger: v((x) => x.portalIlanNo) },
    { baslik: "Geçerlilik", deger: v((x) => x.validUntil) }, { baslik: "Kayda giriş", deger: (k) => k.olusturma }, { baslik: "Özel şartlar", deger: v((x) => x.ozelSartlar) },
    { baslik: "Teknik özellikler", deger: v((x) => x.ozellik) }, { baslik: "Ham metin", deger: v((x) => x.hamMetin) }, { baslik: "Operasyon notu", deger: v((x) => x.operasyonNotu) },
  ];
}
export const kisiSutunlari: Sutun<V>[] = [
  { baslik: "Kişi no", deger: (k) => k.id }, { baslik: "Ad soyad", deger: (k) => k.adSoyad }, { baslik: "Telefon", deger: (k) => k.telefon }, { baslik: "İkinci telefon", deger: (k) => k.ikincilTelefon },
  { baslik: "E-posta", deger: (k) => k.email }, { baslik: "Şirket", deger: (k) => k.sirket }, { baslik: "Roller", deger: (k) => k.roller }, { baslik: "Uzmanlık", deger: (k) => k.uzmanlikAileleri },
  { baslik: "Referans", deger: (k) => k.referans }, { baslik: "Notlar", deger: (k) => k.notlar }, { baslik: "Son iletişim", deger: (k) => k.sonIletisim }, { baslik: "Eklenme", deger: (k) => k.olusturma ?? k.createdAt },
];
export const eslesmeSutunlari: Sutun<V>[] = [
  { baslik: "Talep no", deger: (e) => e.talepId }, { baslik: "Talep", deger: (e) => e.talep }, { baslik: "Portföy no", deger: (e) => e.portfoyId }, { baslik: "Portföy", deger: (e) => e.portfoy },
  { baslik: "Skor", deger: (e) => e.skor }, { baslik: "Takip durumu", deger: (e) => e.durum }, { baslik: "Koparma nedeni", deger: (e) => e.neden }, { baslik: "Not", deger: (e) => e.not }, { baslik: "Tarih", deger: (e) => e.tarih },
];
export const notSutunlari: Sutun<V>[] = [
  { baslik: "Kayıt no", deger: (n) => n.kayitId }, { baslik: "Kayıt", deger: (n) => n.kayit }, { baslik: "Tarih", deger: (n) => n.tarih }, { baslik: "Tür", deger: (n) => n.tur },
  { baslik: "Kişi", deger: (n) => n.kisi }, { baslik: "Not", deger: (n) => n.metin },
];