-- Anahtar CRM v3.26 · 12 Ekim 2026 — talep / portföy açıklaması
-- Yalnızca EKLEME yapar (bir boş sütun); mevcut veriye dokunmaz.
ALTER TABLE "kayit" ADD COLUMN "aciklama" TEXT;
