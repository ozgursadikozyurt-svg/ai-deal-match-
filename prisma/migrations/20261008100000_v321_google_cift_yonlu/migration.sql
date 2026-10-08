-- Anahtar CRM v3.21 · 8 Ekim 2026 — Çift yönlü Google Kişiler
-- Yalnızca EKLEME yapar (yeni sütun + yeni tablo); mevcut veriye dokunmaz, geri dönüşü güvenlidir.

-- 1) Google'a gönderilmeyi bekleyen kişi işareti (elle eklenen / "Google'a gönder" denen kişi)
ALTER TABLE "kisi" ADD COLUMN "googleBekliyor" TIMESTAMP(3);
CREATE INDEX "kisi_ofisId_googleBekliyor_idx" ON "kisi"("ofisId", "googleBekliyor");

-- 2) Anahtar'dan silinen kişiler: Google'dan silinmez, ama bir sonraki eşitlemede geri de gelmez
CREATE TABLE "senkron_haric" (
    "id" TEXT NOT NULL,
    "ofisId" TEXT NOT NULL DEFAULT '',
    "saglayici" "EntegrasyonSaglayici" NOT NULL,
    "disKimlik" TEXT,
    "telefonAnahtar" TEXT,
    "ad" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "senkron_haric_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "senkron_haric_ofisId_saglayici_disKimlik_idx" ON "senkron_haric"("ofisId", "saglayici", "disKimlik");
CREATE INDEX "senkron_haric_ofisId_saglayici_telefonAnahtar_idx" ON "senkron_haric"("ofisId", "saglayici", "telefonAnahtar");
ALTER TABLE "senkron_haric" ADD CONSTRAINT "senkron_haric_ofisId_fkey" FOREIGN KEY ("ofisId") REFERENCES "ofis"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 3) Güvenlik — v3.14 kuralı yeni tabloda da geçerli: RLS açık, politika yok (Supabase REST erişemez)
ALTER TABLE "senkron_haric" ENABLE ROW LEVEL SECURITY;
