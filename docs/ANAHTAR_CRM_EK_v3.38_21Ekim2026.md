# Anahtar CRM — Ek v3.38 · 21 Ekim 2026

**Konu:** Bütçesiz talebin puanı (v3.37 düzeltmesi) · Eşleşmeler listesinin boyu ve sırası · pasife alınma tarihi
**Bağlam:** Özgür, v3.37'yi canlıda denedikten sonra (21 Ekim 15:41): "İçeri aktarılan tüm ilanlarda bütçe olmayanlar 5/5 oldu. Benim işaretli taleplerde ya da bir seçenek işaretlersem bütçe yazmamışsa puanı düşürme; içeri aktarılan bütçe yoklarda eşleştirme puanını düşür — dairelerde çok fazla eşleşmeye giriyor. İyi değerleri oluşanları önce yukarıdan sırala. 2.393 eşleşme biraz fazla değil mi? Daha sağlıklı ve stabil yapalım." Ayrıca v3.37'de açık kalan "pasife alınma tarihi".

## A. Ölçüm (canlı veri, 21 Ekim 2026)
- Aktif 109 talep × 589 portföy → 18.578 çift temel uyumdan (tip + işlem) geçiyor; **2.481** eşleşme "uygun değil" değil (ekrandaki ~2.393 = koparılanlar hariç).
- v3.37 ile seviye dağılımı: 5/5: 124 · 4/5: 520 · 3/5: 1.169 · 2/5: 668.
- 25 bütçesiz aktif talep; 7'si ★ Benim (elle işaret), 18'i WhatsApp / dosyadan. Bu 18 talep 597 eşleşme üretiyordu; tek bir bütçesiz daire talebi 134, bir diğeri 133.
- Talep başına eşleşme: 100 talepten 15'i 50'den fazla eşleşmeye sahip; en çok eşleşen 15 talebin 12'si daire.

## B. Bütçesiz talep kuralı
| Talep | v3.37 | v3.38 |
|---|---|---|
| ★ Benim (elle işaret ya da Ayarlar › Benim ve ofisim'deki ad / telefon) | nötr | **nötr** (değişmedi) |
| Formda "Bütçe m²'ye göre — puanı düşürme" işaretli | — | **nötr** |
| İçeri aktarılmış / işaretsiz | nötr | fiyat ölçülemez (0,4) + −8, **en fazla 64 → 3/5 "Sorulacak"**; kartta "Eksik: talepte bütçe yok"; gerekçe: "Bütçesiz talep (içeri aktarılmış) — en fazla 3/5; kendi talebinizse 'Bütçe m²'ye göre' işaretleyin" |
| Portföyde fiyat yok | −8, en fazla 79 | aynı |

- Sonuç (canlı): içeri aktarılmış bütçesiz taleplerde 5/5 ve 4/5 = 0 (önceden 56 + 125); Benim talepleri aynen (30 × 5/5, 130 × 4/5).
- Neden 3/5 ve tavan 64: 4/5 "Güçlü aday" bütçesi bilinmeyen içe aktarımda yanıltıcı; 2/5'e indirmek ise doğru bölge / m² tutan adayı listeden düşürürdü. 3/5 = "sunmadan önce bütçeyi sor".
- Alan: `kayit.butceSerbest` (talep formunda Bütçe alanının altında, yalnızca bütçe boşken görünür). Motor girdisi: `butceSerbestle(veri, benimMi)` (`onizleme.ts`) — arayüzde sahiplik çözücüsüyle, sunucuda (Notion özeti) elle işaretle.

## C. Eşleşmeler listesi: sıra ve boy
- **Sıra:** uygunluk → seviye → puan → (eşitlikte) fırsat kademesi. Varsayılan sıralama "Uyum (en iyi önce)"; "Fırsat önceliği" menüde kalır. Kriterleri dolu ve iyi tutan eşleşme, az bilgili ya da ödünlü olanın önüne geçer.
- **Varsayılan süzgeçler** (çip olarak görünür, × ile kalkar; Temizle ikisini de kaldırır):
  - "Uyum ≥ 3/5" — 2/5 Zayıf (istenen yok, kat tutmuyor, konum uzak, bütçesiz içe aktarım) gizli.
  - "Talep başına en iyi 10" — her talebin eşleşmeleri uyuma göre dizilir, ilk 10'u listede; gerisi talebin detayındaki "Eşleşmeler"de ve başlıktaki "+N (talep başına 10'dan fazlası)" düğmesiyle.
- Canlı veride liste 2.481 → ~700 (≥ 3/5: 1.549; + talep başına 10: ~700). Hiçbir eşleşme silinmez; yalnızca varsayılan görünüm.
- Sabitler: `ESLESME_VARSAYILAN_SEVIYE = 3`, `TALEP_BASI_ESLESME = 10` (`demo/app.tsx`).

## D. Pasife alınma tarihi
- `kayit.durumTarihi`: durum değişince (pasif, arşiv, süre dolumu, yeniden aktif) **sunucu** yazar (`degisiklikUygula`, süre dolumu zamanlayıcısı, süre uzatma, Notion arşivi). Durum değişmeden kaydedilirse korunur; istemcinin gönderdiği eski tarih yok sayılır.
- Geçmiş kayıtlar: migration, aktif olmayan kayıtlara son güncelleme zamanını (süresi dolmuşta geçerlilik bitişini) yaklaşık tarih olarak yazar.
- Ekran: detayda ve kişi kartındaki kayıtlarda "Pasif · 3 aydır"; Talepler / Portföyler › Sırala › "Pasife alınma (en eski önce)"; Kişiler › Sırala › "Portföyü en uzun süredir pasif"; "Tekrar aranacak sahipler" bu sıralamayla açılır; sahip özeti "(1 pasif/arşiv, 4 aydır)".

## E. Veritabanı
Migration `20261021120000_v338_durum_tarihi_butce_serbest`: `kayit.durumTarihi TIMESTAMP(3)`, `kayit.butceSerbest BOOLEAN`, dizin `(durum, durumTarihi)`, geçmiş kayıtlar için doldurma. Yalnızca ekleme; **yayından sonra "Kurulumu tamamla"**.

## F. Değişen dosyalar
`src/lib/eslestirme/onizleme.ts` · `src/lib/eslestirme/ozet.ts` · `src/lib/services/durum.ts` · `src/lib/services/senkron.ts` · `src/lib/services/kayit.ts` · `src/canli/worker.ts` · `src/lib/validation/kayit.ts` · `src/lib/domain/sahipler.ts` · `prisma/schema.prisma` + migration + `src/generated/` · `demo/app.tsx` · `demo/ortak.tsx` · `demo/form.tsx` · `demo/kisiler.tsx` · `demo/filtre.tsx` · `demo/cekmece.tsx` · `demo/ai-kutusu.tsx` · `demo/bugun-eylem.ts` · `demo/sayfa.html` · testler: `v322`, `v336`, `v337`, `v3212`, `v37-ui` (eski kurallar kasıtlı değişti), `v338`, `v338-db` (yeni).
