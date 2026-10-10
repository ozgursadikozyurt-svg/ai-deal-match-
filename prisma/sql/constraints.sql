-- Anahtar CRM v3.22.2 · 10 Ekim 2026
-- ---------------------------------------------------------------------------
-- Prisma'nın ifade edemediği bütünlük kuralları (elle eklenir, migration sonuna)
-- ---------------------------------------------------------------------------

-- MulkOzellik ya bir Kayit'a ya bir PortalIlan'a bağlı olmalı (ikisi birden değil)
ALTER TABLE "mulk_ozellik" ADD CONSTRAINT "mulk_ozellik_tek_sahip_chk"
  CHECK (num_nonnulls("kayitId", "portalIlanId") = 1);

-- Match: iç havuz (portfoyId) veya dış havuz (portalIlanId) — tam olarak biri
ALTER TABLE "match" ADD CONSTRAINT "match_tek_hedef_chk"
  CHECK (num_nonnulls("portfoyId", "portalIlanId") = 1);

-- Talep aralıkları tutarlı olmalı
ALTER TABLE "kayit" ADD CONSTRAINT "kayit_m2_aralik_chk"
  CHECK ("minM2" IS NULL OR "maxM2" IS NULL OR "minM2" <= "maxM2");
ALTER TABLE "kayit" ADD CONSTRAINT "kayit_fiyat_aralik_chk"
  CHECK ("minFiyat" IS NULL OR "maxFiyat" IS NULL OR "minFiyat" <= "maxFiyat");

-- KayitLokasyon: mahalle/alt bölge verildiyse en azından il dolu (zaten NOT NULL);
-- mahalle verildiyse ilçe de verilmeli (seviye tutarlılığı)
ALTER TABLE "kayit_lokasyon" ADD CONSTRAINT "kayit_lokasyon_seviye_chk"
  CHECK ("mahalleId" IS NULL OR "ilceId" IS NOT NULL);

-- Kayıt başına tek birincil lokasyon
CREATE UNIQUE INDEX "kayit_lokasyon_tek_birincil_idx"
  ON "kayit_lokasyon"("kayitId") WHERE "birincil" = true;

-- Makul değer aralıkları (AI'ın saçma değer yazmasını DB seviyesinde de engeller)
ALTER TABLE "mulk_ozellik" ADD CONSTRAINT "mulk_ozellik_deger_chk" CHECK (
      ("netYukseklikM"       IS NULL OR "netYukseklikM"       BETWEEN 0 AND 60)
  AND ("makasAltiYukseklikM" IS NULL OR "makasAltiYukseklikM" BETWEEN 0 AND 60)
  AND ("elektrikGucuKw"      IS NULL OR "elektrikGucuKw"      BETWEEN 0 AND 100000)
  AND ("trafoGucuKva"        IS NULL OR "trafoGucuKva"        BETWEEN 0 AND 100000)
  AND ("yildiz"              IS NULL OR "yildiz"              BETWEEN 1 AND 5)
  AND ("sogukHavaMinC"       IS NULL OR "sogukHavaMaxC" IS NULL OR "sogukHavaMinC" <= "sogukHavaMaxC")
);