-- Anahtar CRM v3.34 · 19 Ekim 2026 — Reklam kampanyası ve aylık harcama
-- Yalnızca EKLEME yapar (iki yeni tablo); mevcut veriye dokunmaz.
CREATE TABLE "kampanya" (
    "id" TEXT NOT NULL,
    "ofisId" TEXT NOT NULL DEFAULT '',
    "kanal" TEXT NOT NULL,
    "ad" TEXT NOT NULL,
    "butce" DECIMAL(14,2),
    "baslangic" TIMESTAMP(3),
    "bitis" TIMESTAMP(3),
    "aktif" BOOLEAN NOT NULL DEFAULT true,
    "aciklama" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "kampanya_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "kampanya_ofisId_ad_key" ON "kampanya"("ofisId", "ad");
CREATE INDEX "kampanya_ofisId_aktif_idx" ON "kampanya"("ofisId", "aktif");
ALTER TABLE "kampanya" ADD CONSTRAINT "kampanya_ofisId_fkey" FOREIGN KEY ("ofisId") REFERENCES "ofis"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "kampanya_harcama" (
    "id" TEXT NOT NULL,
    "ofisId" TEXT NOT NULL DEFAULT '',
    "kampanyaId" TEXT NOT NULL,
    "ay" TEXT NOT NULL,
    "tutar" DECIMAL(14,2) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "kampanya_harcama_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "kampanya_harcama_kampanyaId_ay_key" ON "kampanya_harcama"("kampanyaId", "ay");
CREATE INDEX "kampanya_harcama_ofisId_ay_idx" ON "kampanya_harcama"("ofisId", "ay");
ALTER TABLE "kampanya_harcama" ADD CONSTRAINT "kampanya_harcama_ofisId_fkey" FOREIGN KEY ("ofisId") REFERENCES "ofis"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "kampanya_harcama" ADD CONSTRAINT "kampanya_harcama_kampanyaId_fkey" FOREIGN KEY ("kampanyaId") REFERENCES "kampanya"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Eski kayıtlarda yazılı reklam kampanya adları kampanya olarak açılır (bütçe ve harcama sonra elle girilir)
INSERT INTO "kampanya" ("id", "ofisId", "kanal", "ad")
SELECT 'kmp_' || md5("ofisId" || '|' || "ilkKaynakDetay"), "ofisId", min("ilkKaynak"), "ilkKaynakDetay"
FROM "kayit"
WHERE "ilkKaynak" IN ('META_REKLAM', 'GOOGLE_REKLAM', 'REKLAM') AND "ilkKaynakDetay" IS NOT NULL AND btrim("ilkKaynakDetay") <> ''
GROUP BY "ofisId", "ilkKaynakDetay"
ON CONFLICT DO NOTHING;

-- Güvenlik — v3.14 kuralı: RLS açık, politika yok
ALTER TABLE "kampanya" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "kampanya_harcama" ENABLE ROW LEVEL SECURITY;
