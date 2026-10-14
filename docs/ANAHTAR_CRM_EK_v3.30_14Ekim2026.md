# Anahtar CRM — Ek (v3.30 · 14 Ekim 2026)

Veritabanı değişikliği yok.

## Dikkat şeridi (Ana Sayfa en üstü)
- `DikkatSeridi` (`demo/sure.tsx`): `sureListesi(kayitlar, 14)` üzerinden üç sayı — süresi dolan (≤0 gün, EXPIRED dahil), 1–5 gün, 6–14 gün. Ton: kırmızı / sarı / gri. ★ Benim kayıtlar süresiz olduğu için girmez. Uyarı yoksa çizilmez.
- "Dolanlara +30 gün": yalnızca süresi dolanlara `sureUzat(…, 30)`; eski `veri` bileşen durumunda saklanır, "Geri al" aynen geri yazar (aynı oturum).
- `ek` yuvası: eşitleme çakışması çipi (eski sarı `uyari-kutu` Ana Sayfa'dan kalktı).
- Eski en alttaki `SureOzeti` Ana Sayfa'dan kaldırıldı (bileşen duruyor).

## Yoğunluk
- `.benim-kisayol .bk-izgara` telefonda 4 sütun, küçük yazı.
- Acil talepler: ilk 3 + "Tümü" (bileşen durumu).

## Fikir raporu
`docs/ANAHTAR_CRM_FIKIR_RAPORU_v3.30_14Ekim2026.md` — araştırma ve öncelik sırası (yer gösterme belgesi, EİDS / yetki, sesle not, kira bitişi, piyasa nabzı, harita…).

## Testler
`tests/v330.test.ts`; `tests/v326.test.ts` Ana Sayfa testi şeride göre güncellendi; `tests/v329.test.ts` sürüm testi en üstte olmayı aramıyor.
