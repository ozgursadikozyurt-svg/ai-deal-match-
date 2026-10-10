-- Anahtar CRM v3.23 · 10 Ekim 2026 — Gelen kutusu (e-postayla / yüklemeyle gelen dosyalar, onay bekleyenler)
-- Yalnızca EKLEME yapar (bir yeni sütun + iki yeni tablo); mevcut veriye dokunmaz, geri dönüşü güvenlidir.

-- 1) Ofisin gelen kutusu adresi: e-posta adresinin yerel kısmı ve Gmail köprüsünün anahtarı (gizli)
ALTER TABLE "ofis" ADD COLUMN "gelenKod" TEXT;
CREATE UNIQUE INDEX "ofis_gelenKod_key" ON "ofis"("gelenKod");

-- 2) Gelen ham dosyaların künyesi (dosyanın kendisi Supabase Storage'da, "gelen" kovasında)
CREATE TABLE "gelen_dosya" (
    "id" TEXT NOT NULL,
    "ofisId" TEXT NOT NULL DEFAULT '',
    "ad" TEXT NOT NULL,
    "tur" TEXT NOT NULL,
    "boyut" INTEGER NOT NULL,
    "ozet" TEXT NOT NULL,
    "kanal" TEXT NOT NULL DEFAULT 'YUKLEME',
    "gonderen" TEXT,
    "konu" TEXT,
    "depoYolu" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gelen_dosya_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "gelen_dosya_ofisId_createdAt_idx" ON "gelen_dosya"("ofisId", "createdAt");
CREATE UNIQUE INDEX "gelen_dosya_ofisId_ozet_key" ON "gelen_dosya"("ofisId", "ozet");
ALTER TABLE "gelen_dosya" ADD CONSTRAINT "gelen_dosya_ofisId_fkey" FOREIGN KEY ("ofisId") REFERENCES "ofis"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 3) "Atla / temizle" denen kayıtların anahtarları (aynı ilan sonraki dökümde yeniden gösterilmez)
CREATE TABLE "gelen_atlanan" (
    "ofisId" TEXT NOT NULL DEFAULT '',
    "anahtar" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gelen_atlanan_pkey" PRIMARY KEY ("ofisId","anahtar")
);
CREATE INDEX "gelen_atlanan_ofisId_createdAt_idx" ON "gelen_atlanan"("ofisId", "createdAt");
ALTER TABLE "gelen_atlanan" ADD CONSTRAINT "gelen_atlanan_ofisId_fkey" FOREIGN KEY ("ofisId") REFERENCES "ofis"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 4) Güvenlik — v3.14 kuralı yeni tablolarda da geçerli: RLS açık, politika yok (Supabase REST erişemez)
ALTER TABLE "gelen_dosya" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "gelen_atlanan" ENABLE ROW LEVEL SECURITY;
