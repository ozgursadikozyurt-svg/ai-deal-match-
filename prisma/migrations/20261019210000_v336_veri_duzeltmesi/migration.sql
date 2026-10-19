-- Anahtar CRM v3.36 · 19 Ekim 2026 — Veri düzeltmesi: yanlış okunmuş talep / portföy alanları (şema DEĞİŞMEZ)
-- Kaynak: 19 Eki 2026 eşleştirme incelemesi (docs/ANAHTAR_CRM_EK_v3.36_19Ekim2026.md › B). Her satır yalnızca değer HÂLÂ yanlışsa
-- değişir (tekrar çalıştırılabilir; kimlikleri olmayan veritabanında — demo, test — hiçbir şey yapmaz). Her değişiklik audit_log'a yazılır.

CREATE TEMP TABLE "_v336" ("kayitId" TEXT, "alan" TEXT, "eski" JSONB, "yeni" JSONB) ON COMMIT DROP;

-- 1) "ara kat" talepleri: olumsuz cümledeki giriş kat / yapay zekânın eklediği kat listesi → yalnızca ARA
INSERT INTO "_v336" SELECT "kayitId", 'istenenKatlar', to_jsonb("istenenKatlar"), '["ARA"]' FROM "mulk_ozellik"
  WHERE "kayitId" IN ('TDEG1916','TIX67256','TQL1R374','TIX67734') AND "istenenKatlar" IS DISTINCT FROM ARRAY['ARA']::TEXT[];
UPDATE "mulk_ozellik" SET "istenenKatlar" = ARRAY['ARA']::TEXT[] WHERE "kayitId" IN ('TDEG1916','TIX67256','TQL1R374','TIX67734') AND "istenenKatlar" IS DISTINCT FROM ARRAY['ARA']::TEXT[];
-- "2. kat ve üstü … son katta olabilir"
INSERT INTO "_v336" SELECT "kayitId", 'istenenKatlar', to_jsonb("istenenKatlar"), '["ARA","SON"]' FROM "mulk_ozellik" WHERE "kayitId" = 'TIVQA289' AND COALESCE(array_length("istenenKatlar", 1), 0) = 0;
UPDATE "mulk_ozellik" SET "istenenKatlar" = ARRAY['ARA','SON']::TEXT[] WHERE "kayitId" = 'TIVQA289' AND COALESCE(array_length("istenenKatlar", 1), 0) = 0;

-- 2) Talepte "bulunduğu kat" (oda sayısından / koşul cümlesinden okunmuştu: "2+1 katta" → 1. kat, "bahçe katı öncelikli" şart değil)
INSERT INTO "_v336" SELECT "kayitId", 'bulunduguKat', to_jsonb("bulunduguKat"), 'null' FROM "mulk_ozellik"
  WHERE "kayitId" IN ('TCNFI447','TY4MO000','TXBPK000','TXBPK001','TIVQA289','TI49W000','TIX67734') AND "bulunduguKat" IS NOT NULL;
UPDATE "mulk_ozellik" SET "bulunduguKat" = NULL WHERE "kayitId" IN ('TCNFI447','TY4MO000','TXBPK000','TXBPK001','TIVQA289','TI49W000','TIX67734') AND "bulunduguKat" IS NOT NULL;

-- 3) Talepte anlamsız elektrik isteği (0 kW, 5 kW)
INSERT INTO "_v336" SELECT o."kayitId", 'elektrikGucuKw', to_jsonb(o."elektrikGucuKw"), 'null' FROM "mulk_ozellik" o JOIN "kayit" k ON k."id" = o."kayitId"
  WHERE k."tip" = 'TALEP' AND o."elektrikGucuKw" < 10;
UPDATE "mulk_ozellik" o SET "elektrikGucuKw" = NULL FROM "kayit" k WHERE k."id" = o."kayitId" AND k."tip" = 'TALEP' AND o."elektrikGucuKw" < 10;

-- 4) Okunmamış bina yaşı ("5 yaşa kadar", "yaşı en fazla 16-17", "yeni bina")
INSERT INTO "_v336" SELECT o."kayitId", 'binaYasi', to_jsonb(o."binaYasi"), to_jsonb(x.v) FROM "mulk_ozellik" o
  JOIN (VALUES ('THJ92897', 4), ('TIVQ9881', 15), ('TXA24S24', 5), ('T2TB6K58', 17), ('TQL1R374', 5)) AS x(i, v) ON o."kayitId" = x.i WHERE o."binaYasi" IS NULL;
UPDATE "mulk_ozellik" o SET "binaYasi" = x.v FROM (VALUES ('THJ92897', 4), ('TIVQ9881', 15), ('TXA24S24', 5), ('T2TB6K58', 17), ('TQL1R374', 5)) AS x(i, v)
  WHERE o."kayitId" = x.i AND o."binaYasi" IS NULL;

-- 5) Kiralık "boş daire" = eşyasız
INSERT INTO "_v336" SELECT "kayitId", 'esyaDurumu', to_jsonb("esyaDurumu"), '"ESYASIZ"' FROM "mulk_ozellik" WHERE "kayitId" IN ('TCPZ2D64','TCNFHR99','TCNFHV35') AND "esyaDurumu" IS NULL;
UPDATE "mulk_ozellik" SET "esyaDurumu" = 'ESYASIZ' WHERE "kayitId" IN ('TCPZ2D64','TCNFHR99','TCNFHV35') AND "esyaDurumu" IS NULL;

-- 6) "80 mt² ve üstü" okunmamış
INSERT INTO "_v336" SELECT "id", 'minM2', 'null', '80' FROM "kayit" WHERE "id" = 'THJ8ZO41' AND "minM2" IS NULL AND "maxM2" IS NULL;
UPDATE "kayit" SET "minM2" = 80 WHERE "id" = 'THJ8ZO41' AND "minM2" IS NULL AND "maxM2" IS NULL;

-- 7) "Bayındır Fabrikalar mah" yazan daire talebi Fabrika tipine düşmüştü
INSERT INTO "_v336" SELECT "id", 'mulkTipi', to_jsonb("mulkTipi"::TEXT), '"DAIRE"' FROM "kayit" WHERE "id" = 'TY4MO000' AND "mulkTipi" = 'FABRIKA_URETIM_TESISI';
UPDATE "kayit" SET "mulkTipi" = 'DAIRE', "anaKategori" = 'KONUT', "baslik" = 'Soğuksu, Güvenlik, Yıldız 3+1, 2+1 en az 120 m² daire — satılık talebi'
  WHERE "id" = 'TY4MO000' AND "mulkTipi" = 'FABRIKA_URETIM_TESISI';

-- 8) "Güney cephe" Alanya'daki Güney Mahallesi sanılmıştı (talep ve portföylerde)
INSERT INTO "_v336" SELECT "kayitId", 'lokasyon', '"Güney (Alanya) — cephe yazısından"', '"silindi"' FROM "kayit_lokasyon" WHERE "id" IN ('cmv862b8y001hpsp7t0fxggn1','cmvany5zl001gpsp7ckwbv2js','cmv9hh1xj0002psp7xbb1hmmf');
DELETE FROM "kayit_lokasyon" WHERE "id" IN ('cmv862b8y001hpsp7t0fxggn1','cmvany5zl001gpsp7ckwbv2js','cmv9hh1xj0002psp7xbb1hmmf');
INSERT INTO "_v336" SELECT "kayitId", 'lokasyon', '"Güney (Alanya)"', '"Fevzi Çakmak (Kepez)"' FROM "kayit_lokasyon" WHERE "id" = 'cmv9hjbsj001cpsp7lip3e2jv' AND "mahalleId" <> 532;
UPDATE "kayit_lokasyon" SET "ilceId" = 103, "mahalleId" = 532 WHERE "id" = 'cmv9hjbsj001cpsp7lip3e2jv' AND "mahalleId" <> 532 AND EXISTS (SELECT 1 FROM "mahalle" WHERE "id" = 532 AND "ilceId" = 103);
UPDATE "kayit" SET "baslik" = 'Fevzi Çakmak 2+1 105 m² daire, satılık' WHERE "id" = 'PHJ90292' AND "baslik" LIKE 'Güney %';
INSERT INTO "_v336" SELECT "kayitId", 'lokasyon', '"Güney (Alanya)"', '"Çağlayan (Muratpaşa)"' FROM "kayit_lokasyon" WHERE "id" = 'cmv9hjbyh001fpsp7u6d819o8' AND "mahalleId" <> 837;
UPDATE "kayit_lokasyon" SET "ilceId" = 108, "mahalleId" = 837 WHERE "id" = 'cmv9hjbyh001fpsp7u6d819o8' AND "mahalleId" <> 837 AND EXISTS (SELECT 1 FROM "mahalle" WHERE "id" = 837 AND "ilceId" = 108);
UPDATE "kayit" SET "baslik" = 'Çağlayan 3+1 125 m² daire, satılık' WHERE "id" = 'PHJ90484' AND "baslik" LIKE 'Güney %';

-- Değişen kayıtlar arayüzde yenilensin; her değişiklik geçmişe yazılır
UPDATE "kayit" SET "updatedAt" = CURRENT_TIMESTAMP WHERE "id" IN (SELECT DISTINCT "kayitId" FROM "_v336");
INSERT INTO "audit_log" ("id", "kayitId", "alan", "eskiDeger", "yeniDeger", "kaynak", "ofisId")
  SELECT gen_random_uuid()::TEXT, d."kayitId", d."alan", d."eski", d."yeni", 'v3.36 veri düzeltmesi (talep metni yanlış okunmuştu)', k."ofisId"
  FROM "_v336" d JOIN "kayit" k ON k."id" = d."kayitId";
