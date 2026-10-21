-- Anahtar CRM v3.38 · 21 Ekim 2026 — kayıt durum tarihi ve "Bütçe m²'ye göre" işareti
-- Yalnızca EKLEME yapar; mevcut veriye dokunmaz (aşağıdaki doldurma yalnızca boş durumTarihi'ni yazar).

ALTER TABLE "kayit" ADD COLUMN IF NOT EXISTS "durumTarihi" TIMESTAMP(3);
ALTER TABLE "kayit" ADD COLUMN IF NOT EXISTS "butceSerbest" BOOLEAN;

-- Geçmiş pasif / arşiv kayıtlar: durum değişim anı tutulmuyordu; en yakın tahmin son güncelleme zamanı.
-- Süresi dolmuşlarda geçerlilik bitişi (ondan sonra dokunulmuşsa o tarih değil).
UPDATE "kayit" SET "durumTarihi" = CASE WHEN "durum" = 'EXPIRED' AND "validUntil" IS NOT NULL THEN LEAST("validUntil", "updatedAt") ELSE "updatedAt" END
WHERE "durum" <> 'ACTIVE' AND "durumTarihi" IS NULL;

CREATE INDEX IF NOT EXISTS "kayit_durum_durumTarihi_idx" ON "kayit"("durum", "durumTarihi");
