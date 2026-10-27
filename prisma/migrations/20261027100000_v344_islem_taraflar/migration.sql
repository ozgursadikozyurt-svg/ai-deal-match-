-- Anahtar CRM v3.44 · 27 Ekim 2026 — İşlem detayı: paylaşılan kişi, referans, taraflar
-- Yalnızca EKLEME yapar; mevcut işlem satırlarına ve tutarlara dokunmaz.

-- A) İşlem üstünde paylaşılan danışman ve referans (rehberden ya da serbest ad)
ALTER TABLE "islem" ADD COLUMN "paylasilanKisiId" TEXT;
ALTER TABLE "islem" ADD COLUMN "paylasilanAd" TEXT;
ALTER TABLE "islem" ADD COLUMN "paylasilanTelefon" TEXT;
ALTER TABLE "islem" ADD COLUMN "referansKisiId" TEXT;
ALTER TABLE "islem" ADD COLUMN "referansAd" TEXT;

CREATE INDEX "islem_ofisId_referansKisiId_idx" ON "islem"("ofisId", "referansKisiId");
CREATE INDEX "islem_ofisId_paylasilanKisiId_idx" ON "islem"("ofisId", "paylasilanKisiId");

ALTER TABLE "islem" ADD CONSTRAINT "islem_paylasilanKisiId_fkey"
  FOREIGN KEY ("paylasilanKisiId") REFERENCES "kisi"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "islem" ADD CONSTRAINT "islem_referansKisiId_fkey"
  FOREIGN KEY ("referansKisiId") REFERENCES "kisi"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- B) İşlemin tarafları (Polaris'teki "Taraflar (rehberden)")
CREATE TABLE "islem_kisi" (
    "id" TEXT NOT NULL,
    "islemId" TEXT NOT NULL,
    "kisiId" TEXT NOT NULL,
    "rol" TEXT NOT NULL DEFAULT 'DIGER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "islem_kisi_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "islem_kisi_islemId_kisiId_rol_key" ON "islem_kisi"("islemId", "kisiId", "rol");
CREATE INDEX "islem_kisi_kisiId_idx" ON "islem_kisi"("kisiId");
ALTER TABLE "islem_kisi" ADD CONSTRAINT "islem_kisi_islemId_fkey"
  FOREIGN KEY ("islemId") REFERENCES "islem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "islem_kisi" ADD CONSTRAINT "islem_kisi_kisiId_fkey"
  FOREIGN KEY ("kisiId") REFERENCES "kisi"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Güvenlik — v3.14 kuralı: RLS açık, politika yok.
-- islem_kisi'de ofisId yok; erişim her zaman bağlı olduğu islem satırı üzerinden olur (kayit_kisi ile aynı desen).
ALTER TABLE "islem_kisi" ENABLE ROW LEVEL SECURITY;
