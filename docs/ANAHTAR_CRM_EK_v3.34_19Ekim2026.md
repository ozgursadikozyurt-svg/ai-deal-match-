# Anahtar CRM — Ek v3.34 · 19 Ekim 2026

**Konu:** Reklam kampanyaları — kampanya listesi, elle aylık harcama, kayıt sayısı ve kayıt başına maliyet
**Bağlam:** `docs/ANAHTAR_POLARIS_KARAR_v1.2_19Ekim2026.md` › uygulama sırası › 2. adım. Bilerek basit tutuldu (Özgür: "çok detaya girmeyelim"). WhatsApp hazır mesajı kapsam dışı.

## 1. Ne eklendi
- **Tablolar** (`prisma/migrations/20261019120000_v334_kampanya`, yalnızca ekleme, RLS açık):
  - `kampanya`: kanal (`META_REKLAM` · `GOOGLE_REKLAM` · `REKLAM`), ad, bütçe (isteğe bağlı), başlangıç / bitiş (isteğe bağlı), aktif, açıklama. `(ofisId, ad)` benzersiz.
  - `kampanya_harcama`: kampanya + ay (`2026-10`) + tutar. `(kampanyaId, ay)` benzersiz; aynı aya yeniden girmek üzerine yazar, boş / 0 satırı siler.
- **Bağ (bilerek basit):** kayıt kampanyaya `kayit.ilkKaynakDetay` = kampanya adı ile bağlanır. Yeni sütun yok, ilk kaynak kilidi aynen geçerli. Bu yüzden **ad değişmez**; kampanya bitince "Kapat" (aktif = false). İleride `kampanyaId`'ye çevrilebilir.
- **Eski veri:** migration, reklam ilk kaynaklı kayıtlardaki `ilkKaynakDetay` adlarını kampanya olarak açar (bütçe / harcama sonra girilir).
- **Yetki:** yeni `kampanya.yonet` (yalnızca ofis yöneticisi ve platform yöneticisi). Diğer roller `GET /api/kampanyalar`'da yalnızca açık kampanyaların `{id, kanal, ad}` bilgisini görür; bütçe, harcama, kayıt sayısı ve maliyet dönmez. Yazma uçları 403.
- **Servis / uç:** `src/lib/services/kampanya.ts`, `src/app/api/kampanyalar/route.ts` (GET · POST · PATCH?id · PUT?id). Tarayıcıyla ortak parça: `src/lib/services/kampanya-ortak.ts`.
- **Arayüz:** Yönetim › Reklam kampanyaları (`demo/kampanyalar.tsx`): ekle, kapat / aç, "Aylık harcama" ile ay ve tutar girişi. Satırda kayıt sayısı · toplam harcama · kayıt başı maliyet · bütçe. Kayıt formundaki "Kampanya / liste" alanı açık kampanyaları önerir (reklam kaynağı seçiliyse kanala göre süzülür); serbest metin hâlâ yazılabilir.

## 2. Hesap
Kayıt başına maliyet = toplam harcama ÷ ilk kaynak detayı o kampanya olan kayıt sayısı (yuvarlanır). Harcama ya da kayıt yoksa gösterilmez. Bu "kayıt" maliyetidir; **işlem / komisyon bazlı kâr** 4. adımdan sonra, 6. adımdaki raporlarda hesaplanacak (kohort olgunlaşma kuralıyla).

## 3. Bilinen sınırlar
- Kampanya adı serbest metinle de yazılabildiği için yazım farkı ayrı kampanya sayılmaz, kampanya ekranında sayıma girmez; forma listeden seçmek önerilir.
- Aynı kampanya adı farklı kanalda yok sayılır (ad ofiste benzersiz).
- Bütçe aşım uyarısı, kampanya bazında dönüşüm ve 90 günlük rapor yok (6. adım).

## 4. Testler
`tests/v334.test.ts` (6, veritabanısız) · `tests/v334-db.test.ts` (5, veritabanlı: ekleme, tekrar ad, harcama üzerine yazma / silme, kayıt sayısı ve maliyet, asistan görünürlüğü ve yazma kapısı, ofis yalıtımı).

## 5. Yayın
1. `main`e girince Cloudflare derler ve yayınlar.
2. **Yayından sonra uygulamada "Kurulumu tamamla"** (migration var).
3. Denemek için: Yönetim › Reklam kampanyaları.

## 6. Sonraki adım (3)
Yetkiyi mülkten ayır (mülk başına yetki belgesi: süre, münhasırlık, yenileme) + ayrı randevu kaydı (tarih, katılan, sonuç).
