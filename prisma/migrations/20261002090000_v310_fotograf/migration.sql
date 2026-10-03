-- Anahtar CRM v3.10 · 2 Ekim 2026 — portföy fotoğrafları (kayit_foto). Dosyalar Supabase Storage'da; burada yalnızca yol + künye.
-- CreateTable
CREATE TABLE "kayit_foto" (
    "id" TEXT NOT NULL,
    "kayitId" TEXT NOT NULL,
    "sira" INTEGER NOT NULL DEFAULT 0,
    "ad" TEXT NOT NULL,
    "depoYolu" TEXT NOT NULL,
    "icerikTuru" TEXT NOT NULL DEFAULT 'image/jpeg',
    "en" INTEGER NOT NULL,
    "boy" INTEGER NOT NULL,
    "boyut" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kayit_foto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "kayit_foto_kayitId_sira_idx" ON "kayit_foto"("kayitId", "sira");

-- AddForeignKey
ALTER TABLE "kayit_foto" ADD CONSTRAINT "kayit_foto_kayitId_fkey" FOREIGN KEY ("kayitId") REFERENCES "kayit"("id") ON DELETE CASCADE ON UPDATE CASCADE;