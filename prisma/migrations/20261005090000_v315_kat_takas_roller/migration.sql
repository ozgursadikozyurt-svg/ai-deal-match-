-- Anahtar CRM v3.15 · 5 Ekim 2026
-- 1) Talepte çoklu kat seçimi: mulk_ozellik.istenenKatlar (metin dizisi)
ALTER TABLE "mulk_ozellik" ADD COLUMN "istenenKatlar" TEXT[] DEFAULT ARRAY[]::TEXT[];
-- Eski tek değerli katı olan TALEPLERİ çoklu alana taşı (bulunduguKat korunur; eşleştirme motoru ikisini de okur)
UPDATE "mulk_ozellik" o SET "istenenKatlar" = ARRAY[o."bulunduguKat"::TEXT]
  FROM "kayit" k WHERE k."id" = o."kayitId" AND k."tip" = 'TALEP' AND o."bulunduguKat" IS NOT NULL;

-- 2) Takasa açık (portföy + talep)
ALTER TABLE "kayit" ADD COLUMN "takasaAcik" BOOLEAN;

-- 3) Dinamik kişi rolleri: enum dizisi → serbest metin dizisi (mevcut değerler aynen korunur)
ALTER TABLE "kisi" ALTER COLUMN "roller" TYPE TEXT[] USING "roller"::TEXT[];
