/**
 * Anahtar CRM v3.21.2 · 8 Ekim 2026
 * Antalya'ya özel piyasa katmanı: alt bölgeler, komşu ilçeler, alias sözlüğü.
 * Kaynak: Özgür'ün Notion CRM "Bölge" seçenekleri + WhatsApp grup kullanımları.
 * `dogrulandi: false` olanlar ilk kullanımda Ayarlar > Lokasyon ekranından onaylanmalı.
 */
export const ANTALYA_IL_ID = 7;

type AltBolgeSeed = {
  ad: string;
  slug: string;
  ilce: string | null; // null = ilçe sınırını aşıyor
  tip: "SEMT" | "TICARI_AKS" | "OSB" | "SANAYI_SITESI" | "TURIZM_BOLGESI" | "DIGER";
  mahalleler: [ilce: string, mahalleSlug: string][];
  dogrulandi: boolean;
  aciklama?: string;
};

export const ANTALYA_ALT_BOLGELER: AltBolgeSeed[] = [
  {
    ad: "Lara", slug: "lara", ilce: "Muratpaşa", tip: "SEMT", dogrulandi: false,
    mahalleler: [["Muratpaşa", "guzeloba"], ["Muratpaşa", "sirinyali"], ["Muratpaşa", "fener"], ["Muratpaşa", "caglayan"], ["Muratpaşa", "yesilbahce"]],
    aciklama: "Notion kayıtlarında Lara ile birlikte etiketlenen mahalleler",
  },
  {
    ad: "Altınova", slug: "altinova", ilce: "Kepez", tip: "SEMT", dogrulandi: true,
    mahalleler: [["Kepez", "altinova-duden"], ["Kepez", "altinova-orta"], ["Kepez", "altinova-sinan"]],
  },
  {
    ad: "Varsak", slug: "varsak", ilce: "Kepez", tip: "SEMT", dogrulandi: true,
    mahalleler: [["Kepez", "varsak-esentepe"], ["Kepez", "varsak-karsiyaka"], ["Kepez", "varsak-menderes"]],
  },
  {
    ad: "Kundu", slug: "kundu", ilce: "Aksu", tip: "TURIZM_BOLGESI", dogrulandi: true,
    mahalleler: [["Aksu", "kundu"]],
  },
  {
    ad: "Havalimanı Çevresi", slug: "havalimani-cevresi", ilce: null, tip: "SEMT", dogrulandi: false,
    mahalleler: [["Muratpaşa", "yenigol"], ["Kepez", "altinova-duden"], ["Kepez", "altinova-orta"], ["Kepez", "altinova-sinan"], ["Aksu", "cihadiye"]],
    aciklama: "Depo/lojistik taleplerinde 'havalimanı yakını' ifadesinin karşılığı — ilçe sınırı aşar",
  },
  {
    ad: "Işıklar Caddesi", slug: "isiklar-caddesi", ilce: "Muratpaşa", tip: "TICARI_AKS", dogrulandi: false,
    mahalleler: [["Muratpaşa", "genclik"]],
  },
  {
    ad: "Barınaklar Bulvarı", slug: "barinaklar-bulvari", ilce: "Muratpaşa", tip: "TICARI_AKS", dogrulandi: false,
    mahalleler: [],
    aciklama: "Mahalle eşlemesi kullanıcı tarafından tamamlanacak",
  },
  {
    ad: "Antalya OSB", slug: "antalya-osb", ilce: "Döşemealtı", tip: "OSB", dogrulandi: false,
    mahalleler: [],
  },
];

/** Çift yönlü kaydedilir. Lokasyon puanlamasında komşu ilçe = -15 (elenmez). */
export const ANTALYA_KOMSU_ILCELER: [string, string][] = [
  ["Muratpaşa", "Konyaaltı"],
  ["Muratpaşa", "Kepez"],
  ["Muratpaşa", "Aksu"],
  ["Kepez", "Konyaaltı"],
  ["Kepez", "Döşemealtı"],
  ["Kepez", "Aksu"],
  ["Aksu", "Döşemealtı"],
  ["Konyaaltı", "Döşemealtı"],
  ["Aksu", "Serik"],
  ["Konyaaltı", "Kemer"],
];

type AliasSeed =
  | { alias: string; seviye: "ILCE"; ilce: string }
  | { alias: string; seviye: "MAHALLE"; ilce: string; mahalle: string; tip?: "REFERANS_NOKTA"; aciklama?: string }
  | { alias: string; seviye: "ALTBOLGE"; altBolge: string };

/** Notion "Bölge" seçeneklerindeki yazımlar + WhatsApp'ta sık geçen ifadeler */
export const ANTALYA_ALIASLAR: AliasSeed[] = [
  { alias: "Murtpaşa", seviye: "ILCE", ilce: "Muratpaşa" },
  { alias: "Merkez Muratpaşa", seviye: "ILCE", ilce: "Muratpaşa" },
  { alias: "Düden Mh.", seviye: "MAHALLE", ilce: "Kepez", mahalle: "altinova-duden" },
  { alias: "Düden", seviye: "MAHALLE", ilce: "Kepez", mahalle: "altinova-duden" },
  { alias: "Atatürk Mh.", seviye: "MAHALLE", ilce: "Kepez", mahalle: "ataturk" },
  { alias: "Menderes Mh.", seviye: "MAHALLE", ilce: "Kepez", mahalle: "menderes" },
  { alias: "Sinan", seviye: "MAHALLE", ilce: "Kepez", mahalle: "altinova-sinan" },
  { alias: "Havalimanı", seviye: "ALTBOLGE", altBolge: "havalimani-cevresi" },
  { alias: "Hava Limanı", seviye: "ALTBOLGE", altBolge: "havalimani-cevresi" },
  { alias: "Havaalanı", seviye: "ALTBOLGE", altBolge: "havalimani-cevresi" },
  { alias: "Havalimanı Yolu", seviye: "ALTBOLGE", altBolge: "havalimani-cevresi" },
  { alias: "OSB", seviye: "ALTBOLGE", altBolge: "antalya-osb" },
  { alias: "Organize Sanayi", seviye: "ALTBOLGE", altBolge: "antalya-osb" },
  { alias: "Barınaklar", seviye: "ALTBOLGE", altBolge: "barinaklar-bulvari" },
  { alias: "Işıklar", seviye: "ALTBOLGE", altBolge: "isiklar-caddesi" },
  // v3.3 — referans noktalar (bir yerin yakınını tarif eden ifadeler). Özgür'ün örneği:
  { alias: "Cender Otel", seviye: "MAHALLE", ilce: "Muratpaşa", mahalle: "genclik", tip: "REFERANS_NOKTA", aciklama: "Cender Otel çevresi, Işıklar'a yakın" },
];