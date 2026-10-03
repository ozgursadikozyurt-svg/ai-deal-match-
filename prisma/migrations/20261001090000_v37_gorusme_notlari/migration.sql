-- Anahtar.ai v3.7 · 1 Ekim 2026 — görüşme/not akışı (kayit_not) + portalIlanNo indeksi (toplu içe aktarmada tekrar kontrolü)
-- CreateEnum
CREATE TYPE "NotTuru" AS ENUM ('GORUSME', 'ARAMA', 'WHATSAPP', 'GOSTERIM', 'NOT');

-- CreateTable
CREATE TABLE "kayit_not" (
    "id" TEXT NOT NULL,
    "kayitId" TEXT NOT NULL,
    "tur" "NotTuru" NOT NULL DEFAULT 'NOT',
    "metin" TEXT NOT NULL,
    "kisiId" TEXT,
    "tarih" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kayit_not_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "kayit_not_kayitId_tarih_idx" ON "kayit_not"("kayitId", "tarih");

-- CreateIndex
CREATE INDEX "kayit_not_kisiId_idx" ON "kayit_not"("kisiId");

-- CreateIndex
CREATE INDEX "kayit_portalIlanNo_idx" ON "kayit"("portalIlanNo");

-- AddForeignKey
ALTER TABLE "kayit_not" ADD CONSTRAINT "kayit_not_kayitId_fkey" FOREIGN KEY ("kayitId") REFERENCES "kayit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kayit_not" ADD CONSTRAINT "kayit_not_kisiId_fkey" FOREIGN KEY ("kisiId") REFERENCES "kisi"("id") ON DELETE SET NULL ON UPDATE CASCADE;