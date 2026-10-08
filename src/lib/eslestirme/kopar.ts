/**
 * Anahtar CRM v3.21.2 · 8 Ekim 2026
 * Eşleşmeyi koparma: yanlış eşleşme ya da sunuldu/beğenilmedi → ana ekranda, eşleşme listesinde ve çekmecede bir daha
 * gösterilmez (Eşleşmeler → "Koparılanlar"dan geri alınabilir). Veritabanında Match.durum = REDDEDILDI + neden.
 */
export const KOPMA_NEDENLERI = [
  ["YANLIS", "Yanlış eşleşme (uygun değil)"],
  ["BEGENMEDI", "Sunuldu, müşteri beğenmedi"],
  ["SAHIP_ISTEMEDI", "Mülk sahibi / emlakçı istemedi"],
  ["BASKA_ANLASTI", "Başka bir mülk / talep ile anlaşıldı"],
  ["FIYAT", "Fiyat / bütçe tutmadı"],
  ["DIGER", "Diğer"],
] as const;
export type KopmaNedeni = (typeof KOPMA_NEDENLERI)[number][0];
export const kopmaEtiket = (k?: string | null) => KOPMA_NEDENLERI.find((x) => x[0] === k)?.[1] ?? "Koparıldı";