-- Anahtar CRM v3.35 · 19 Ekim 2026 — Yetki belgesi alanları, randevu ve işlem tabloları
-- Yalnızca EKLEME yapar; mevcut veriye dokunmaz.

-- A) Portföyde yetki belgesi no ve taşınmaz (TKGM) kimliği
ALTER TABLE "kayit" ADD COLUMN "yetkiBelgeNo" TEXT;
ALTER TABLE "kayit" ADD COLUMN "tasinmazNo" TEXT;

-- B) Randevu
CREATE TABLE "randevu" (
    "id" TEXT NOT NULL,
    "ofisId" TEXT NOT NULL DEFAULT '',
    "sahipKullaniciId" TEXT,
    "tarih" TIMESTAMP(3) NOT NULL,
    "tur" TEXT NOT NULL DEFAULT 'GOSTERIM',
    "sonuc" TEXT NOT NULL DEFAULT 'PLANLANDI',
    "talepId" TEXT,
    "portfoyId" TEXT,
    "kisiId" TEXT,
    "not" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "randevu_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "randevu_ofisId_tarih_idx" ON "randevu"("ofisId", "tarih");
CREATE INDEX "randevu_ofisId_talepId_idx" ON "randevu"("ofisId", "talepId");
CREATE INDEX "randevu_ofisId_portfoyId_idx" ON "randevu"("ofisId", "portfoyId");
ALTER TABLE "randevu" ADD CONSTRAINT "randevu_ofisId_fkey" FOREIGN KEY ("ofisId") REFERENCES "ofis"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- C) İşlem ve komisyon
CREATE TABLE "islem" (
    "id" TEXT NOT NULL,
    "ofisId" TEXT NOT NULL DEFAULT '',
    "sahipKullaniciId" TEXT,
    "tarih" TIMESTAMP(3) NOT NULL,
    "tahsilatTarihi" TIMESTAMP(3),
    "tur" TEXT NOT NULL DEFAULT 'DIGER',
    "baslik" TEXT NOT NULL,
    "bedel" DECIMAL(16,2),
    "paylasilan" DECIMAL(14,2),
    "ofisPayi" DECIMAL(14,2),
    "banaKalan" DECIMAL(14,2),
    "aciklama" TEXT,
    "reklam" BOOLEAN NOT NULL DEFAULT false,
    "talepKaynagi" TEXT,
    "talepId" TEXT,
    "portfoyId" TEXT,
    "kisiId" TEXT,
    "disKaynak" TEXT,
    "disKimlik" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "islem_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "islem_ofisId_disKaynak_disKimlik_key" ON "islem"("ofisId", "disKaynak", "disKimlik");
CREATE INDEX "islem_ofisId_tarih_idx" ON "islem"("ofisId", "tarih");
CREATE INDEX "islem_ofisId_tahsilatTarihi_idx" ON "islem"("ofisId", "tahsilatTarihi");
ALTER TABLE "islem" ADD CONSTRAINT "islem_ofisId_fkey" FOREIGN KEY ("ofisId") REFERENCES "ofis"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Güvenlik — v3.14 kuralı: RLS açık, politika yok
ALTER TABLE "randevu" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "islem" ENABLE ROW LEVEL SECURITY;
