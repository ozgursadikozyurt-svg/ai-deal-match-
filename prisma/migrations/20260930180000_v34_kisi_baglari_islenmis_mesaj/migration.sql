-- Anahtar.ai v3.4 · 30 Eylül 2026
-- v3.3 → v3.4: kayıt ↔ kişi bağları (rol ile), Notion kişi alanları, işlenmiş mesaj kaydı (tekrar AI harcamasını önler), TTL satılık/kiralık
-- CreateEnum
CREATE TYPE "KayitKisiRolu" AS ENUM ('SAHIP', 'MUSTERI', 'EMLAKCI', 'ARACI', 'IRTIBAT', 'DIGER');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "KisiRolu" ADD VALUE 'AL_SAT';
ALTER TYPE "KisiRolu" ADD VALUE 'YATIRIMCI_VIP';

-- AlterTable
ALTER TABLE "kisi" ADD COLUMN     "referans" TEXT,
ADD COLUMN     "sonIletisim" TIMESTAMP(3),
ADD COLUMN     "uzmanlikAileleri" TEXT[],
ADD COLUMN     "whatsappGruplari" TEXT[];

-- AlterTable
ALTER TABLE "ingestion_log" ADD COLUMN     "dosyaParmakIzleri" TEXT[],
ADD COLUMN     "oncedenIslenmis" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "kayit_kisi" (
    "id" TEXT NOT NULL,
    "kayitId" TEXT NOT NULL,
    "kisiId" TEXT NOT NULL,
    "rol" "KayitKisiRolu" NOT NULL DEFAULT 'DIGER',
    "birincil" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kayit_kisi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "islenmis_mesaj" (
    "parmakIzi" TEXT NOT NULL,
    "grup" TEXT,
    "mesajTarihi" TIMESTAMP(3),
    "ingestionId" TEXT,
    "kayitSayisi" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "islenmis_mesaj_pkey" PRIMARY KEY ("parmakIzi")
);

-- CreateIndex
CREATE INDEX "kayit_kisi_kisiId_idx" ON "kayit_kisi"("kisiId");

-- CreateIndex
CREATE UNIQUE INDEX "kayit_kisi_kayitId_kisiId_rol_key" ON "kayit_kisi"("kayitId", "kisiId", "rol");

-- CreateIndex
CREATE INDEX "islenmis_mesaj_grup_mesajTarihi_idx" ON "islenmis_mesaj"("grup", "mesajTarihi");

-- AddForeignKey
ALTER TABLE "kayit_kisi" ADD CONSTRAINT "kayit_kisi_kayitId_fkey" FOREIGN KEY ("kayitId") REFERENCES "kayit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kayit_kisi" ADD CONSTRAINT "kayit_kisi_kisiId_fkey" FOREIGN KEY ("kisiId") REFERENCES "kisi"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- v3.4 — TTL ayarı işlem tipine göre ayrıldı (satılık / kiralık). Eski biçim varsa yenisine çevrilir.
UPDATE "ayar" SET "deger" = jsonb_build_object(
  'PORTFOY_SATILIK', COALESCE(("deger"->>'PORTFOY')::int, 90),
  'PORTFOY_KIRALIK', 45,
  'TALEP_SATILIK', COALESCE(("deger"->>'TALEP')::int, 60),
  'TALEP_KIRALIK', 30,
  'TALEP_ACIL', COALESCE(("deger"->>'TALEP_ACIL')::int, 30)
), "updatedAt" = now()
WHERE "anahtar" = 'ttl' AND NOT ("deger" ? 'PORTFOY_SATILIK');