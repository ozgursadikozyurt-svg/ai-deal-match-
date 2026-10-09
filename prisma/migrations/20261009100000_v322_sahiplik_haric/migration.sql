-- Anahtar CRM v3.22 · 9 Ekim 2026 — "Benim / Ofisim" işareti ve talepte hariç tutulan bölge
-- Yalnızca EKLEME yapar (iki yeni sütun, varsayılanlı); mevcut veriye dokunmaz, geri dönüşü güvenlidir.

-- 1) Kayda elle konan sahiplik işareti: BENIM · OFIS · DIS (boş = otomatik, Ayarlar › Benim ve ofisim)
ALTER TABLE "kayit" ADD COLUMN "isaret" TEXT;

-- 2) Talep konumunda "hariç" satırı ("Hurma, Sarısu HARİÇ")
ALTER TABLE "kayit_lokasyon" ADD COLUMN "haric" BOOLEAN NOT NULL DEFAULT false;
