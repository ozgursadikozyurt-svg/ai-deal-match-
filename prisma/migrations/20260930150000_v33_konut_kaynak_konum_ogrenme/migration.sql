-- Anahtar.ai v3.3 · 30 Eylül 2026
-- v3.2 → v3.3: konut alanları, kaynak bilgisi (mesaj tarihi, dosya), konum öğrenme (alias tipi + aday tablosu), ayarlar (TTL)
-- CreateEnum
CREATE TYPE "IsinmaTipi" AS ENUM ('DOGALGAZ_KOMBI', 'MERKEZI', 'MERKEZI_PAY_OLCER', 'YERDEN_ISITMA', 'KLIMA', 'ISI_POMPASI', 'SOBA', 'GUNES_ENERJISI', 'YOK');

-- CreateEnum
CREATE TYPE "EsyaDurumu" AS ENUM ('ESYALI', 'YARI_ESYALI', 'ESYASIZ');

-- CreateEnum
CREATE TYPE "Yon" AS ENUM ('KUZEY', 'GUNEY', 'DOGU', 'BATI');

-- CreateEnum
CREATE TYPE "AliasTipi" AS ENUM ('YAZIM', 'REFERANS_NOKTA', 'SEMT');

-- CreateEnum
CREATE TYPE "AdayDurumu" AS ENUM ('BEKLIYOR', 'ONAYLANDI', 'REDDEDILDI');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "TeknikAlan" ADD VALUE 'BANYO';
ALTER TYPE "TeknikAlan" ADD VALUE 'ISINMA';
ALTER TYPE "TeknikAlan" ADD VALUE 'ESYA';
ALTER TYPE "TeknikAlan" ADD VALUE 'SITE_GUVENLIK';
ALTER TYPE "TeknikAlan" ADD VALUE 'CEPHE_YON';
ALTER TYPE "TeknikAlan" ADD VALUE 'BINA_YASI';
ALTER TYPE "TeknikAlan" ADD VALUE 'KAT';
ALTER TYPE "TeknikAlan" ADD VALUE 'BALKON_BAHCE';
ALTER TYPE "TeknikAlan" ADD VALUE 'MANZARA';
ALTER TYPE "TeknikAlan" ADD VALUE 'KREDI';

-- AlterTable
ALTER TABLE "lokasyon_alias" ADD COLUMN     "aciklama" TEXT,
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "kullanimSayisi" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "onaylandi" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "tip" "AliasTipi" NOT NULL DEFAULT 'YAZIM';

-- AlterTable
ALTER TABLE "kayit" ADD COLUMN     "ingestionId" TEXT,
ADD COLUMN     "kaynakDosya" TEXT,
ADD COLUMN     "mesajTarihi" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "mulk_ozellik" ADD COLUMN     "bahce" BOOLEAN,
ADD COLUMN     "balkon" BOOLEAN,
ADD COLUMN     "banyoSayisi" INTEGER,
ADD COLUMN     "cepheYonleri" "Yon"[],
ADD COLUMN     "denizManzarasi" BOOLEAN,
ADD COLUMN     "dubleks" BOOLEAN,
ADD COLUMN     "ebeveynBanyosu" BOOLEAN,
ADD COLUMN     "engelliErisimi" BOOLEAN,
ADD COLUMN     "esyaDurumu" "EsyaDurumu",
ADD COLUMN     "guvenlik" BOOLEAN,
ADD COLUMN     "isinmaTipi" "IsinmaTipi",
ADD COLUMN     "siteIcinde" BOOLEAN,
ADD COLUMN     "teras" BOOLEAN;

-- CreateTable
CREATE TABLE "lokasyon_aday" (
    "id" TEXT NOT NULL,
    "ilId" INTEGER NOT NULL DEFAULT 7,
    "ifade" TEXT NOT NULL,
    "ornekMetin" TEXT,
    "gorulme" INTEGER NOT NULL DEFAULT 1,
    "birlikteGecis" JSONB NOT NULL DEFAULT '{}',
    "durum" "AdayDurumu" NOT NULL DEFAULT 'BEKLIYOR',
    "sonGorulme" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lokasyon_aday_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ayar" (
    "anahtar" TEXT NOT NULL,
    "deger" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ayar_pkey" PRIMARY KEY ("anahtar")
);

-- CreateIndex
CREATE INDEX "lokasyon_aday_durum_gorulme_idx" ON "lokasyon_aday"("durum", "gorulme");

-- CreateIndex
CREATE UNIQUE INDEX "lokasyon_aday_ilId_ifade_key" ON "lokasyon_aday"("ilId", "ifade");

-- v3.3 — elle eklenen bütünlük kuralları ve varsayılan ayarlar
ALTER TABLE "mulk_ozellik" ADD CONSTRAINT "mulk_ozellik_banyo_chk" CHECK ("banyoSayisi" IS NULL OR "banyoSayisi" BETWEEN 0 AND 50);
CREATE INDEX "kayit_mesajTarihi_idx" ON "kayit"("mesajTarihi");
INSERT INTO "ayar" ("anahtar", "deger", "updatedAt") VALUES ('ttl', '{"PORTFOY": 90, "TALEP": 60, "TALEP_ACIL": 30}', now()) ON CONFLICT ("anahtar") DO NOTHING;