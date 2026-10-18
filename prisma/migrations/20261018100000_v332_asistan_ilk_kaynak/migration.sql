-- Anahtar CRM v3.32 · 18 Ekim 2026 — Asistan rolü + değiştirilemez ilk kaynak + ilk yanıt
-- Yalnızca EKLEME yapar; mevcut veri silinmez. Boş kalan alanlar geriye dönük doldurulur (aşağıda).

-- 1) Asistan rolü ve yardım ettiği kullanıcı
ALTER TYPE "Rol" ADD VALUE IF NOT EXISTS 'ASISTAN';
ALTER TABLE "kullanici" ADD COLUMN IF NOT EXISTS "yardimEdilenId" TEXT;

-- 2) İlk kaynak (kilitli) ve ilk yanıt
ALTER TABLE "kayit" ADD COLUMN IF NOT EXISTS "ilkKaynak" TEXT;
ALTER TABLE "kayit" ADD COLUMN IF NOT EXISTS "ilkKaynakDetay" TEXT;
ALTER TABLE "kayit" ADD COLUMN IF NOT EXISTS "ilkKaynakTarihi" TIMESTAMP(3);
ALTER TABLE "kayit" ADD COLUMN IF NOT EXISTS "ilkYanit" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "kayit_ofisId_ilkKaynak_idx" ON "kayit"("ofisId", "ilkKaynak");

-- 3) Geriye dönük doldurma — src/lib/domain/ilk-kaynak.ts › tahminIlkKaynak ile aynı kurallar.
--    Tahmin edilemeyen (doğrudan / kendi müşterim) kayıtlarda boş kalır; arayüzden BİR KEZ doldurulabilir.
UPDATE "kayit" SET "ilkKaynak" = CASE
    WHEN "musteriKaynagi" = 'REKLAM' THEN 'REKLAM'
    WHEN "musteriKaynagi" = 'REFERANS' THEN 'REFERANS'
    WHEN "musteriKaynagi" = 'SAHA' THEN 'SAHA'
    WHEN "musteriKaynagi" = 'WHATSAPP_GRUBU' THEN 'EMLAK_GRUBU'
    WHEN "musteriKaynagi" = 'DIGER' THEN 'DIGER'
    WHEN ("havuz" = 'DIS_ILAN' OR "ilanSahibiTipi" = 'PORTAL' OR "veriKanali" IN ('SAHIBINDEN', 'HEPSIEMLAK', 'EMLAKJET') OR "musteriKaynagi" IN ('ILAN', 'PORTAL'))
      THEN CASE WHEN "ilanSahibiTipi" = 'MALIK' THEN 'SAHIBINDEN' ELSE 'PORTAL' END
    WHEN "havuz" = 'PARTNER' OR "ilanSahibiTipi" IN ('EMLAKCI', 'PARTNER') OR "veriKanali" = 'WHATSAPP' THEN 'EMLAK_GRUBU'
    ELSE NULL END
  WHERE "ilkKaynak" IS NULL;
UPDATE "kayit" SET "ilkKaynakTarihi" = COALESCE(LEAST("mesajTarihi", "createdAt"), "createdAt") WHERE "ilkKaynakTarihi" IS NULL;

-- İlk yanıt: eski kayıtlarda en erken temas notunun tarihi (elde olan en iyi bilgi). Yeni notlarda sunucu kaydedildiği anı yazar.
UPDATE "kayit" k SET "ilkYanit" = n.ilk
  FROM (SELECT "kayitId", MIN("tarih") AS ilk FROM "kayit_not" WHERE "tur" IN ('ARAMA', 'WHATSAPP', 'GORUSME', 'GOSTERIM') GROUP BY "kayitId") n
  WHERE k."id" = n."kayitId" AND k."ilkYanit" IS NULL;

-- 4) Sahipsiz özel kişiler ofisin ilk yöneticisine bağlanır: asistan, yardım ettiği yöneticinin rehberini görebilsin
--    (arayüzden eklenen kişilerin sahibi v3.32'ye kadar boş kalıyordu; Google'dan gelenlerin sahibi zaten doluydu).
UPDATE "kisi" k SET "sahipKullaniciId" = (
    SELECT u."id" FROM "kullanici" u
    WHERE u."ofisId" = k."ofisId" AND u."aktif" = true AND u."rol" IN ('PLATFORM_YONETICISI', 'OFIS_YONETICISI')
    ORDER BY u."createdAt" ASC LIMIT 1)
  WHERE k."sahipKullaniciId" IS NULL;
