-- Anahtar.ai v3.6 · 30 Eylül 2026
-- v3.5 → v3.6: Google Kişiler + Notion senkronu (bağlantı, çalışma geçmişi, çakışma), kişi/kayıt senkron fotoğrafları
-- CreateEnum
CREATE TYPE "EntegrasyonSaglayici" AS ENUM ('GOOGLE_KISILER', 'NOTION');

-- CreateEnum
CREATE TYPE "EntegrasyonDurum" AS ENUM ('BAGLI_DEGIL', 'BAGLI', 'HATA', 'YENIDEN_YETKI');

-- CreateEnum
CREATE TYPE "CakismaDurum" AS ENUM ('ACIK', 'YEREL_SECILDI', 'UZAK_SECILDI');

-- AlterEnum
ALTER TYPE "SyncDurum" ADD VALUE 'CAKISMA';

-- AlterTable
ALTER TABLE "kayit" ADD COLUMN     "notionGeriYazim" JSONB,
ADD COLUMN     "notionSnapshot" JSONB;

-- AlterTable
ALTER TABLE "kisi" ADD COLUMN     "googleEtag" TEXT,
ADD COLUMN     "googleSnapshot" JSONB,
ADD COLUMN     "kaynaktaSilindi" TIMESTAMP(3),
ADD COLUMN     "notionSnapshot" JSONB;

-- CreateTable
CREATE TABLE "entegrasyon" (
    "id" TEXT NOT NULL,
    "saglayici" "EntegrasyonSaglayici" NOT NULL,
    "durum" "EntegrasyonDurum" NOT NULL DEFAULT 'BAGLI_DEGIL',
    "hesap" TEXT,
    "tokenSifreli" TEXT,
    "syncToken" TEXT,
    "imlec" JSONB,
    "ayarlar" JSONB,
    "sonSenkron" TIMESTAMP(3),
    "sonHata" TEXT,
    "kilitBitis" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "entegrasyon_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "senkron_calisma" (
    "id" TEXT NOT NULL,
    "saglayici" "EntegrasyonSaglayici" NOT NULL,
    "tetik" TEXT NOT NULL DEFAULT 'zamanlayici',
    "baslangic" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "bitis" TIMESTAMP(3),
    "durum" "SyncDurum" NOT NULL DEFAULT 'BASARILI',
    "yeni" INTEGER NOT NULL DEFAULT 0,
    "guncellenen" INTEGER NOT NULL DEFAULT 0,
    "baglanan" INTEGER NOT NULL DEFAULT 0,
    "cakisma" INTEGER NOT NULL DEFAULT 0,
    "atlanan" INTEGER NOT NULL DEFAULT 0,
    "silinen" INTEGER NOT NULL DEFAULT 0,
    "geriYazilan" INTEGER NOT NULL DEFAULT 0,
    "devamEdecek" BOOLEAN NOT NULL DEFAULT false,
    "ozet" JSONB,
    "hata" TEXT,

    CONSTRAINT "senkron_calisma_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "senkron_cakisma" (
    "id" TEXT NOT NULL,
    "saglayici" "EntegrasyonSaglayici" NOT NULL,
    "hedefTip" TEXT NOT NULL,
    "hedefId" TEXT NOT NULL,
    "alan" TEXT NOT NULL,
    "onceki" JSONB,
    "yerel" JSONB,
    "uzak" JSONB,
    "durum" "CakismaDurum" NOT NULL DEFAULT 'ACIK',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cozuldu" TIMESTAMP(3),

    CONSTRAINT "senkron_cakisma_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "entegrasyon_saglayici_key" ON "entegrasyon"("saglayici");

-- CreateIndex
CREATE INDEX "senkron_calisma_saglayici_baslangic_idx" ON "senkron_calisma"("saglayici", "baslangic");

-- CreateIndex
CREATE INDEX "senkron_cakisma_hedefId_idx" ON "senkron_cakisma"("hedefId");

-- CreateIndex
CREATE INDEX "senkron_cakisma_durum_idx" ON "senkron_cakisma"("durum");