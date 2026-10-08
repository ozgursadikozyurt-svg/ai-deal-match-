-- Anahtar CRM v3.20 · 7 Ekim 2026 — ÇOK OFİSLİ ALTYAPI
--
-- Ne yapar: tek ofis için yazılmış veritabanını birden çok emlak ofisinin güvenle barınabileceği
-- yapıya çevirir. Mevcut veri KAYBOLMAZ: "Özyurtlar Gayrimenkul" adında bir ofis açılır ve
-- bugüne kadarki tüm talep, portföy, kişi, eşleşme, ayar ve log satırları bu ofise bağlanır.
--
-- Sıra önemlidir:
--   1) ofis / kullanici / davet tabloları
--   2) varsayılan ofis + platform yöneticisi satırı
--   3) var olan tablolara ofisId (geçici DEFAULT ile → eski satırlar dolar → DEFAULT kaldırılır)
--   4) benzersizlik kuralları ofis içine alınır (iki ofis aynı telefonu / aynı ilanı tutabilir)
--   5) yabancı anahtarlar, indeksler, RLS

-- ---------------------------------------------------------------------------
-- 1) Enum'lar
-- ---------------------------------------------------------------------------
CREATE TYPE "Rol" AS ENUM ('PLATFORM_YONETICISI', 'OFIS_YONETICISI', 'DANISMAN');
CREATE TYPE "Plan" AS ENUM ('UCRETSIZ', 'PRO', 'PRO_PLUS');
CREATE TYPE "OfisDurumu" AS ENUM ('AKTIF', 'ASKIDA');
CREATE TYPE "Gorunurluk" AS ENUM ('OFIS', 'OZEL');
CREATE TYPE "DavetDurumu" AS ENUM ('BEKLIYOR', 'KULLANILDI', 'IPTAL');

-- ---------------------------------------------------------------------------
-- 2) Ofis / kullanıcı / davet
-- ---------------------------------------------------------------------------
CREATE TABLE "ofis" (
    "id" TEXT NOT NULL,
    "ad" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "durum" "OfisDurumu" NOT NULL DEFAULT 'AKTIF',
    "plan" "Plan" NOT NULL DEFAULT 'UCRETSIZ',
    "sinirsiz" BOOLEAN NOT NULL DEFAULT false,
    "denemeBitis" TIMESTAMP(3),
    "telefon" TEXT,
    "sehir" TEXT,
    "notlar" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ofis_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "kullanici" (
    "id" TEXT NOT NULL,
    "ofisId" TEXT NOT NULL DEFAULT '',
    "eposta" TEXT NOT NULL,
    "adSoyad" TEXT,
    "telefon" TEXT,
    "rol" "Rol" NOT NULL DEFAULT 'DANISMAN',
    "aktif" BOOLEAN NOT NULL DEFAULT true,
    "sonGiris" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "kullanici_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "davet" (
    "id" TEXT NOT NULL,
    "ofisId" TEXT NOT NULL DEFAULT '',
    "kodOzeti" TEXT NOT NULL,
    "eposta" TEXT,
    "rol" "Rol" NOT NULL DEFAULT 'DANISMAN',
    "durum" "DavetDurumu" NOT NULL DEFAULT 'BEKLIYOR',
    "sonKullanma" TIMESTAMP(3) NOT NULL,
    "olusturanId" TEXT,
    "kullanilan" TIMESTAMP(3),
    "kullananEposta" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "davet_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ofis_slug_key" ON "ofis"("slug");
CREATE INDEX "ofis_durum_idx" ON "ofis"("durum");
CREATE UNIQUE INDEX "kullanici_eposta_key" ON "kullanici"("eposta");
CREATE INDEX "kullanici_ofisId_aktif_idx" ON "kullanici"("ofisId", "aktif");
CREATE UNIQUE INDEX "davet_kodOzeti_key" ON "davet"("kodOzeti");
CREATE INDEX "davet_ofisId_durum_idx" ON "davet"("ofisId", "durum");

ALTER TABLE "kullanici" ADD CONSTRAINT "kullanici_ofisId_fkey" FOREIGN KEY ("ofisId") REFERENCES "ofis"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "davet" ADD CONSTRAINT "davet_ofisId_fkey" FOREIGN KEY ("ofisId") REFERENCES "ofis"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "davet" ADD CONSTRAINT "davet_olusturanId_fkey" FOREIGN KEY ("olusturanId") REFERENCES "kullanici"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- 3) Varsayılan ofis ve sahibi — mevcut verinin yeni adresi
--    Kimlikler sabittir: göç yeniden çalıştırılsa da aynı satıra bağlanır.
-- ---------------------------------------------------------------------------
INSERT INTO "ofis" ("id", "ad", "slug", "durum", "plan", "sinirsiz", "sehir", "updatedAt")
VALUES ('ofis_ozyurtlar_0001', 'Özyurtlar Gayrimenkul', 'ozyurtlar-gayrimenkul', 'AKTIF', 'PRO', true, 'Antalya', CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "kullanici" ("id", "ofisId", "eposta", "adSoyad", "rol", "aktif", "updatedAt")
VALUES ('kull_ozgur_0001', 'ofis_ozyurtlar_0001', 'ozgursadikozyurt@gmail.com', 'Özgür Özyurt', 'PLATFORM_YONETICISI', true, CURRENT_TIMESTAMP)
ON CONFLICT ("eposta") DO NOTHING;

-- ---------------------------------------------------------------------------
-- 4) Var olan tablolara ofisId — eski satırlar varsayılan ofise bağlanır
-- ---------------------------------------------------------------------------
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'lokasyon_aday', 'kayit', 'kisi', 'match', 'portal_ilan',
    'audit_log', 'ingestion_log', 'entegrasyon', 'senkron_calisma',
    'senkron_cakisma', 'notion_sync_log', 'kayit_not', 'kayit_foto'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ADD COLUMN "ofisId" TEXT NOT NULL DEFAULT %L', t, 'ofis_ozyurtlar_0001');
    -- Göçten sonra varsayılan '' olur: şemayla aynı kalır ve süzgeci atlayan bir yazma
    -- yabancı anahtar hatasına düşer (sessizce yanlış ofise yazılmaz).
    EXECUTE format('ALTER TABLE %I ALTER COLUMN "ofisId" SET DEFAULT %L', t, '');
  END LOOP;
END $$;

-- Birincil anahtarı değişen iki tablo (ayar: ofis başına ayar; islenmis_mesaj: ofis başına AI geçmişi)
ALTER TABLE "ayar" ADD COLUMN "ofisId" TEXT NOT NULL DEFAULT 'ofis_ozyurtlar_0001';
ALTER TABLE "ayar" ALTER COLUMN "ofisId" SET DEFAULT '';
ALTER TABLE "ayar" DROP CONSTRAINT "ayar_pkey";
ALTER TABLE "ayar" ADD CONSTRAINT "ayar_pkey" PRIMARY KEY ("ofisId", "anahtar");

ALTER TABLE "islenmis_mesaj" ADD COLUMN "ofisId" TEXT NOT NULL DEFAULT 'ofis_ozyurtlar_0001';
ALTER TABLE "islenmis_mesaj" ALTER COLUMN "ofisId" SET DEFAULT '';
ALTER TABLE "islenmis_mesaj" DROP CONSTRAINT "islenmis_mesaj_pkey";
ALTER TABLE "islenmis_mesaj" ADD CONSTRAINT "islenmis_mesaj_pkey" PRIMARY KEY ("ofisId", "parmakIzi");

-- Sahiplik ve görünürlük: mevcut kayıtlar ofis sahibine ait, portföyler ofis ortak,
-- kişiler ve talepler sahibine özel (müşteri listesi danışmanın en değerli varlığı).
ALTER TABLE "kayit" ADD COLUMN "gorunurluk" "Gorunurluk" NOT NULL DEFAULT 'OFIS';
ALTER TABLE "kayit" ADD COLUMN "sahipKullaniciId" TEXT;
ALTER TABLE "kisi"  ADD COLUMN "gorunurluk" "Gorunurluk" NOT NULL DEFAULT 'OZEL';
ALTER TABLE "kisi"  ADD COLUMN "sahipKullaniciId" TEXT;

UPDATE "kayit" SET "sahipKullaniciId" = 'kull_ozgur_0001' WHERE "sahipKullaniciId" IS NULL;
UPDATE "kayit" SET "gorunurluk" = 'OZEL' WHERE "tip" = 'TALEP';
UPDATE "kisi"  SET "sahipKullaniciId" = 'kull_ozgur_0001' WHERE "sahipKullaniciId" IS NULL;

-- ---------------------------------------------------------------------------
-- 5) Benzersizlik ofis içine alınır
--    Eskiden telefon / ilan bağlantısı / parmak izi TÜM sistemde tekti; ikinci ofis buna çarpardı.
-- ---------------------------------------------------------------------------
DROP INDEX "lokasyon_aday_ilId_ifade_key";
DROP INDEX "kayit_fingerprint_key";
DROP INDEX "kayit_notionId_key";
DROP INDEX "kisi_telefon_key";
DROP INDEX "kisi_googleResourceName_key";
DROP INDEX "kisi_notionId_key";
DROP INDEX "portal_ilan_url_key";
DROP INDEX "entegrasyon_saglayici_key";

CREATE UNIQUE INDEX "lokasyon_aday_ofisId_ilId_ifade_key" ON "lokasyon_aday"("ofisId", "ilId", "ifade");
CREATE UNIQUE INDEX "kayit_ofisId_fingerprint_key" ON "kayit"("ofisId", "fingerprint");
CREATE UNIQUE INDEX "kayit_ofisId_notionId_key" ON "kayit"("ofisId", "notionId");
CREATE UNIQUE INDEX "kisi_ofisId_telefon_key" ON "kisi"("ofisId", "telefon");
CREATE UNIQUE INDEX "kisi_ofisId_googleResourceName_key" ON "kisi"("ofisId", "googleResourceName");
CREATE UNIQUE INDEX "kisi_ofisId_notionId_key" ON "kisi"("ofisId", "notionId");
CREATE UNIQUE INDEX "portal_ilan_ofisId_url_key" ON "portal_ilan"("ofisId", "url");
CREATE UNIQUE INDEX "entegrasyon_ofisId_saglayici_key" ON "entegrasyon"("ofisId", "saglayici");

-- ---------------------------------------------------------------------------
-- 6) Arama indeksleri (her sorgu artık ofisId ile süzülüyor)
-- ---------------------------------------------------------------------------
CREATE INDEX "lokasyon_aday_ofisId_idx" ON "lokasyon_aday"("ofisId");
CREATE INDEX "kayit_ofisId_tip_durum_idx" ON "kayit"("ofisId", "tip", "durum");
CREATE INDEX "kayit_ofisId_sahipKullaniciId_idx" ON "kayit"("ofisId", "sahipKullaniciId");
CREATE INDEX "kisi_ofisId_sahipKullaniciId_idx" ON "kisi"("ofisId", "sahipKullaniciId");
CREATE INDEX "match_ofisId_idx" ON "match"("ofisId");
CREATE INDEX "portal_ilan_ofisId_idx" ON "portal_ilan"("ofisId");
CREATE INDEX "audit_log_ofisId_idx" ON "audit_log"("ofisId");
CREATE INDEX "ingestion_log_ofisId_idx" ON "ingestion_log"("ofisId");
CREATE INDEX "senkron_calisma_ofisId_idx" ON "senkron_calisma"("ofisId");
CREATE INDEX "senkron_cakisma_ofisId_idx" ON "senkron_cakisma"("ofisId");
CREATE INDEX "notion_sync_log_ofisId_idx" ON "notion_sync_log"("ofisId");
CREATE INDEX "kayit_not_ofisId_idx" ON "kayit_not"("ofisId");
CREATE INDEX "kayit_foto_ofisId_idx" ON "kayit_foto"("ofisId");

-- ---------------------------------------------------------------------------
-- 7) Yabancı anahtarlar — ofis silinince ofisin tüm verisi gider (CASCADE)
-- ---------------------------------------------------------------------------
ALTER TABLE "lokasyon_aday"   ADD CONSTRAINT "lokasyon_aday_ofisId_fkey"   FOREIGN KEY ("ofisId") REFERENCES "ofis"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ayar"            ADD CONSTRAINT "ayar_ofisId_fkey"            FOREIGN KEY ("ofisId") REFERENCES "ofis"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "kayit"           ADD CONSTRAINT "kayit_ofisId_fkey"           FOREIGN KEY ("ofisId") REFERENCES "ofis"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "kayit"           ADD CONSTRAINT "kayit_sahipKullaniciId_fkey" FOREIGN KEY ("sahipKullaniciId") REFERENCES "kullanici"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "kisi"            ADD CONSTRAINT "kisi_ofisId_fkey"            FOREIGN KEY ("ofisId") REFERENCES "ofis"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "kisi"            ADD CONSTRAINT "kisi_sahipKullaniciId_fkey"  FOREIGN KEY ("sahipKullaniciId") REFERENCES "kullanici"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "islenmis_mesaj"  ADD CONSTRAINT "islenmis_mesaj_ofisId_fkey"  FOREIGN KEY ("ofisId") REFERENCES "ofis"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "match"           ADD CONSTRAINT "match_ofisId_fkey"           FOREIGN KEY ("ofisId") REFERENCES "ofis"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "portal_ilan"     ADD CONSTRAINT "portal_ilan_ofisId_fkey"     FOREIGN KEY ("ofisId") REFERENCES "ofis"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "audit_log"       ADD CONSTRAINT "audit_log_ofisId_fkey"       FOREIGN KEY ("ofisId") REFERENCES "ofis"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ingestion_log"   ADD CONSTRAINT "ingestion_log_ofisId_fkey"   FOREIGN KEY ("ofisId") REFERENCES "ofis"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "entegrasyon"     ADD CONSTRAINT "entegrasyon_ofisId_fkey"     FOREIGN KEY ("ofisId") REFERENCES "ofis"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "senkron_calisma" ADD CONSTRAINT "senkron_calisma_ofisId_fkey" FOREIGN KEY ("ofisId") REFERENCES "ofis"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "senkron_cakisma" ADD CONSTRAINT "senkron_cakisma_ofisId_fkey" FOREIGN KEY ("ofisId") REFERENCES "ofis"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "notion_sync_log" ADD CONSTRAINT "notion_sync_log_ofisId_fkey" FOREIGN KEY ("ofisId") REFERENCES "ofis"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "kayit_not"       ADD CONSTRAINT "kayit_not_ofisId_fkey"       FOREIGN KEY ("ofisId") REFERENCES "ofis"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "kayit_foto"      ADD CONSTRAINT "kayit_foto_ofisId_fkey"      FOREIGN KEY ("ofisId") REFERENCES "ofis"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- 8) Güvenlik — v3.14'teki kural yeni tablolarda da geçerli:
--    satır düzeyi güvenlik açık, politika yok → Supabase REST (anon/authenticated) hiçbir satıra
--    erişemez. Uygulama Prisma + postgres rolüyle bağlanır ve RLS'yi aşar.
-- ---------------------------------------------------------------------------
ALTER TABLE "ofis" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "kullanici" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "davet" ENABLE ROW LEVEL SECURITY;
