-- Anahtar.ai v3.5 · 30 Eylül 2026
-- v3.4 → v3.5: yetki belgeli portföy (havuz akışı: Yetkili → CRM → Partner → Web ilanı)
-- AlterTable
ALTER TABLE "kayit" ADD COLUMN     "yetkiBitis" TIMESTAMP(3),
ADD COLUMN     "yetkili" BOOLEAN NOT NULL DEFAULT false;