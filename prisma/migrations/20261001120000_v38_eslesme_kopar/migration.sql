-- Anahtar.ai v3.8 · 1 Ekim 2026 — eşleşmeyi kopar: match.kopmaNedeni, match.koparilma
-- AlterTable
ALTER TABLE "match" ADD COLUMN     "koparilma" TIMESTAMP(3),
ADD COLUMN     "kopmaNedeni" TEXT;