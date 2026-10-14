-- Anahtar CRM v3.29 · 14 Ekim 2026 — "asansör şart", "havuz şart" talepte öldürücü (kritik) işaretlenebilsin
-- Yalnızca EKLEME yapar (TeknikAlan enum'una iki değer); mevcut veriye dokunmaz.
ALTER TYPE "TeknikAlan" ADD VALUE IF NOT EXISTS 'ASANSOR';
ALTER TYPE "TeknikAlan" ADD VALUE IF NOT EXISTS 'HAVUZ';
