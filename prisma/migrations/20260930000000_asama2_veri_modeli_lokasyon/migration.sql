-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "KayitTipi" AS ENUM ('PORTFOY', 'TALEP');

-- CreateEnum
CREATE TYPE "Durum" AS ENUM ('ACTIVE', 'PASSIVE', 'EXPIRED', 'ARSIV');

-- CreateEnum
CREATE TYPE "Aciliyet" AS ENUM ('DUSUK', 'NORMAL', 'YUKSEK', 'ACIL');

-- CreateEnum
CREATE TYPE "AnaKategori" AS ENUM ('KONUT', 'ISYERI', 'ARSA', 'BINA', 'TURISTIK_TESIS', 'DEVRE_MULK');

-- CreateEnum
CREATE TYPE "MulkTipi" AS ENUM ('DAIRE', 'REZIDANS', 'MUSTAKIL_EV', 'VILLA', 'CIFTLIK_EVI', 'KOSK_KONAK', 'YALI', 'YAZLIK', 'PREFABRIK_EV', 'KOOPERATIF', 'DEPO_ANTREPO', 'FABRIKA_URETIM_TESISI', 'IMALATHANE', 'ATOLYE', 'SOGUK_HAVA_DEPOSU', 'LOJISTIK_MERKEZI', 'TAMIRHANE_OTO_SERVIS', 'ENERJI_SANTRALI', 'MADEN_OCAGI', 'DUKKAN_MAGAZA', 'SHOWROOM', 'AVM', 'PAZAR_YERI', 'BUFE_KANTIN', 'RESTORAN_LOKANTA', 'CAFE_BAR', 'PASTANE_FIRIN', 'AKARYAKIT_ISTASYONU', 'OTO_YIKAMA', 'OTOPARK_GARAJ', 'BURO_OFIS', 'OFIS_APARTMAN_DAIRESI', 'PLAZA', 'PLAZA_KATI_OFIS', 'REZIDANS_KATI_OFIS', 'IS_HANI_KATI', 'SAGLIK_MERKEZI_KLINIK', 'EGITIM_KURUMU', 'KRES', 'YURT', 'SPOR_TESISI', 'SPA_HAMAM', 'DUGUN_SALONU', 'SINEMA_KONFERANS', 'KIR_KAHVALTI_BAHCESI', 'CIFTLIK', 'ARSA', 'TARLA', 'BAG_BAHCE', 'ZEYTINLIK', 'KOMPLE_BINA', 'OTEL', 'BUTIK_OTEL', 'APART_OTEL', 'TATIL_KOYU', 'MOTEL', 'PANSIYON', 'HOSTEL', 'KAMP_ALANI', 'DEVRE_MULK', 'DIGER');

-- CreateEnum
CREATE TYPE "IslemTipi" AS ENUM ('SATILIK', 'KIRALIK', 'DEVREN_SATILIK', 'DEVREN_KIRALIK', 'KAT_KARSILIGI', 'GUNLUK_KIRALIK', 'SEZONLUK_KIRALIK', 'TAKAS');

-- CreateEnum
CREATE TYPE "ParaBirimi" AS ENUM ('TRY', 'USD', 'EUR', 'GBP');

-- CreateEnum
CREATE TYPE "FiyatPeriyodu" AS ENUM ('TOPLAM', 'AYLIK', 'YILLIK', 'GUNLUK');

-- CreateEnum
CREATE TYPE "ImarDurumu" AS ENUM ('KONUT', 'TICARI', 'TICARI_KONUT', 'SANAYI', 'DEPO_ANTREPO', 'TURIZM', 'TURIZM_KONUT', 'TURIZM_TICARI', 'TARLA', 'BAG_BAHCE', 'ZEYTINLIK', 'SERA', 'EGITIM', 'SAGLIK', 'ENERJI', 'OZEL_KULLANIM', 'SIT_ALANI', 'IMARSIZ', 'DIGER');

-- CreateEnum
CREATE TYPE "IlanSahibiTipi" AS ENUM ('MALIK', 'EMLAKCI', 'MUTEAHHIT', 'FIRMA', 'PARTNER', 'PORTAL', 'BILINMIYOR');

-- CreateEnum
CREATE TYPE "VeriKanali" AS ENUM ('WHATSAPP', 'SAHIBINDEN', 'HEPSIEMLAK', 'EMLAKJET', 'NOTION', 'KENDI_CRM', 'MANUEL', 'CSV', 'SESLI_NOT');

-- CreateEnum
CREATE TYPE "Havuz" AS ENUM ('KENDI_PORTFOY', 'PARTNER', 'DIS_ILAN');

-- CreateEnum
CREATE TYPE "PortfoyAlinabilirlik" AS ENUM ('COK_YUKSEK', 'YUKSEK', 'ORTA', 'DUSUK', 'BILINMIYOR');

-- CreateEnum
CREATE TYPE "MusteriKaynagi" AS ENUM ('SAHA', 'REFERANS', 'REKLAM', 'ILAN', 'WHATSAPP_GRUBU', 'PORTAL', 'DIGER');

-- CreateEnum
CREATE TYPE "KisiRolu" AS ENUM ('ALICI', 'SATICI', 'KIRACI', 'KIRAYA_VEREN', 'YATIRIMCI', 'EMLAKCI', 'MUTEAHHIT', 'FIRMA', 'IS_ORTAGI');

-- CreateEnum
CREATE TYPE "KisiKaynagi" AS ENUM ('WHATSAPP', 'GOOGLE', 'NOTION', 'MANUEL', 'CSV');

-- CreateEnum
CREATE TYPE "AracErisimi" AS ENUM ('YOK', 'BINEK', 'PANELVAN', 'KAMYONET', 'KAMYON', 'TIR');

-- CreateEnum
CREATE TYPE "RuhsatDurumu" AS ENUM ('RUHSATLI', 'YAPI_KAYITLI', 'KAYITSIZ', 'INSAAT_HALINDE');

-- CreateEnum
CREATE TYPE "TapuTipi" AS ENUM ('KAT_MULKIYETI', 'KAT_IRTIFAKI', 'MUSTAKIL_PARSEL', 'HISSELI', 'ARSA_TAPULU', 'KOOPERATIF', 'TAHSIS');

-- CreateEnum
CREATE TYPE "CatiTipi" AS ENUM ('SANDVIC_PANEL', 'TRAPEZ_SAC', 'YALITIMLI_TRAPEZ', 'BETONARME', 'PREFABRIK', 'DIGER');

-- CreateEnum
CREATE TYPE "DuvarTipi" AS ENUM ('BETON', 'SANDVIC_PANEL', 'TRAPEZ_SAC', 'TUGLA_BRIKET', 'PREFABRIK', 'KARMA');

-- CreateEnum
CREATE TYPE "ZeminTipi" AS ENUM ('HELIKOPTER_BETON', 'EPOKSI', 'SAHA_BETONU', 'SERAMIK_KAROLAJ', 'TOPRAK', 'DIGER');

-- CreateEnum
CREATE TYPE "YapiSistemi" AS ENUM ('CELIK_KONSTRUKSIYON', 'BETONARME', 'PREFABRIK', 'YIGMA', 'KARMA');

-- CreateEnum
CREATE TYPE "OtoparkDurumu" AS ENUM ('YOK', 'ACIK', 'KAPALI', 'ACIK_VE_KAPALI', 'CADDE_USTU');

-- CreateEnum
CREATE TYPE "TrafikSeviyesi" AS ENUM ('DUSUK', 'ORTA', 'YUKSEK', 'COK_YUKSEK');

-- CreateEnum
CREATE TYPE "KiraOdemeSekli" AS ENUM ('AYLIK', 'UC_AYLIK', 'ALTI_AYLIK_PESIN', 'YILLIK_PESIN');

-- CreateEnum
CREATE TYPE "TurizmBelgesi" AS ENUM ('BAKANLIK_BELGELI', 'BELEDIYE_BELGELI', 'YOK');

-- CreateEnum
CREATE TYPE "KullanimAmaci" AS ENUM ('DEPOLAMA', 'LOJISTIK_DAGITIM', 'URETIM', 'GIDA_URETIM', 'GIDA_DEPOLAMA', 'SOGUK_ZINCIR', 'E_TICARET', 'SHOWROOM', 'PERAKENDE', 'MARKET', 'RESTORAN_KAFE', 'OFIS', 'BANKA_SUBE', 'EGITIM', 'SAGLIK', 'SPOR', 'OTO_SERVIS', 'KONAKLAMA', 'ETKINLIK', 'TARIM', 'YATIRIM_KIRA_GELIRI', 'DIGER');

-- CreateEnum
CREATE TYPE "TeknikAlan" AS ENUM ('MULK_TIPI', 'ISLEM_TIPI', 'LOKASYON', 'FIYAT', 'ALAN', 'KAPALI_ALAN', 'ACIK_ALAN', 'ARSA_ALANI', 'YUKSEKLIK', 'KAPI', 'ARAC_ERISIMI', 'RAMPA', 'VINC', 'ELEKTRIK', 'TRAFO', 'SANAYI_ELEKTRIGI', 'YANGIN_SISTEMI', 'SPRINKLER', 'ISKAN', 'RUHSAT', 'SOGUK_HAVA', 'GIDAYA_UYGUNLUK', 'CATI_DUVAR', 'OFIS_SOSYAL', 'OTOPARK', 'YAYA_TRAFIGI', 'ARAC_TRAFIGI', 'CEPHE_VITRIN', 'ZEMIN_KAT_GIRIS', 'KULLANIM_AMACI', 'KIRA_SURESI', 'ODA_SAYISI', 'IMAR');

-- CreateEnum
CREATE TYPE "YerlesimTipi" AS ENUM ('MAHALLE', 'KOY', 'KOY_MAHALLESI', 'BELDE_MAHALLESI');

-- CreateEnum
CREATE TYPE "AltBolgeTipi" AS ENUM ('SEMT', 'TICARI_AKS', 'OSB', 'SANAYI_SITESI', 'TURIZM_BOLGESI', 'DIGER');

-- CreateEnum
CREATE TYPE "LokasyonSeviyesi" AS ENUM ('IL', 'ILCE', 'MAHALLE', 'ALTBOLGE');

-- CreateEnum
CREATE TYPE "MatchDurum" AS ENUM ('BEKLIYOR', 'BILDIRILDI', 'GORUSULDU', 'GOSTERIM', 'PAZARLIK', 'KAPANDI', 'REDDEDILDI');

-- CreateEnum
CREATE TYPE "Uygunluk" AS ENUM ('SUNULABILIR', 'KOSULLU', 'UYGUN_DEGIL');

-- CreateEnum
CREATE TYPE "PortalIlanDurum" AS ENUM ('HAM', 'ONIZLEME', 'ONAYLANDI', 'REDDEDILDI');

-- CreateEnum
CREATE TYPE "SyncDurum" AS ENUM ('BASARILI', 'HATA', 'TEKRAR_DENENECEK');

-- CreateTable
CREATE TABLE "il" (
    "id" INTEGER NOT NULL,
    "plaka" CHAR(2) NOT NULL,
    "ad" TEXT NOT NULL,
    "slug" TEXT NOT NULL,

    CONSTRAINT "il_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ilce" (
    "id" INTEGER NOT NULL,
    "ilId" INTEGER NOT NULL,
    "ad" TEXT NOT NULL,
    "slug" TEXT NOT NULL,

    CONSTRAINT "ilce_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mahalle" (
    "id" SERIAL NOT NULL,
    "ilceId" INTEGER NOT NULL,
    "ad" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "tip" "YerlesimTipi" NOT NULL DEFAULT 'MAHALLE',
    "bagliOlduguYer" TEXT,
    "postaKodu" VARCHAR(5),
    "enlem" DOUBLE PRECISION,
    "boylam" DOUBLE PRECISION,

    CONSTRAINT "mahalle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alt_bolge" (
    "id" SERIAL NOT NULL,
    "ilId" INTEGER NOT NULL,
    "ilceId" INTEGER,
    "ad" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "tip" "AltBolgeTipi" NOT NULL DEFAULT 'SEMT',
    "aciklama" TEXT,
    "dogrulandi" BOOLEAN NOT NULL DEFAULT false,
    "enlem" DOUBLE PRECISION,
    "boylam" DOUBLE PRECISION,

    CONSTRAINT "alt_bolge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alt_bolge_mahalle" (
    "altBolgeId" INTEGER NOT NULL,
    "mahalleId" INTEGER NOT NULL,

    CONSTRAINT "alt_bolge_mahalle_pkey" PRIMARY KEY ("altBolgeId","mahalleId")
);

-- CreateTable
CREATE TABLE "ilce_komsuluk" (
    "ilceId" INTEGER NOT NULL,
    "komsuIlceId" INTEGER NOT NULL,

    CONSTRAINT "ilce_komsuluk_pkey" PRIMARY KEY ("ilceId","komsuIlceId")
);

-- CreateTable
CREATE TABLE "lokasyon_alias" (
    "id" SERIAL NOT NULL,
    "alias" TEXT NOT NULL,
    "seviye" "LokasyonSeviyesi" NOT NULL,
    "ilId" INTEGER,
    "ilceId" INTEGER,
    "mahalleId" INTEGER,
    "altBolgeId" INTEGER,
    "kaynak" TEXT,

    CONSTRAINT "lokasyon_alias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kayit_lokasyon" (
    "id" TEXT NOT NULL,
    "kayitId" TEXT NOT NULL,
    "ilId" INTEGER NOT NULL,
    "ilceId" INTEGER,
    "mahalleId" INTEGER,
    "altBolgeId" INTEGER,
    "birincil" BOOLEAN NOT NULL DEFAULT false,
    "sira" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "kayit_lokasyon_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kayit" (
    "id" TEXT NOT NULL,
    "tip" "KayitTipi" NOT NULL,
    "durum" "Durum" NOT NULL DEFAULT 'ACTIVE',
    "aciliyet" "Aciliyet" NOT NULL DEFAULT 'NORMAL',
    "anaKategori" "AnaKategori" NOT NULL,
    "mulkTipi" "MulkTipi" NOT NULL,
    "alternatifMulkTipleri" "MulkTipi"[],
    "islemTipi" "IslemTipi" NOT NULL,
    "alternatifIslemTipleri" "IslemTipi"[],
    "fiyat" DECIMAL(16,2),
    "minFiyat" DECIMAL(16,2),
    "maxFiyat" DECIMAL(16,2),
    "paraBirimi" "ParaBirimi" NOT NULL DEFAULT 'TRY',
    "fiyatPeriyodu" "FiyatPeriyodu" NOT NULL DEFAULT 'TOPLAM',
    "krediyeUygun" BOOLEAN,
    "m2" DOUBLE PRECISION,
    "netM2" DOUBLE PRECISION,
    "minM2" DOUBLE PRECISION,
    "maxM2" DOUBLE PRECISION,
    "m2ToleransYuzde" DOUBLE PRECISION,
    "odaSayisi" TEXT,
    "lokasyonHam" TEXT,
    "adres" TEXT,
    "enlem" DOUBLE PRECISION,
    "boylam" DOUBLE PRECISION,
    "veriKanali" "VeriKanali" NOT NULL DEFAULT 'WHATSAPP',
    "ilanSahibiTipi" "IlanSahibiTipi" NOT NULL DEFAULT 'BILINMIYOR',
    "havuz" "Havuz" NOT NULL DEFAULT 'KENDI_PORTFOY',
    "musteriKaynagi" "MusteriKaynagi",
    "portfoyAlinabilirlik" "PortfoyAlinabilirlik" NOT NULL DEFAULT 'BILINMIYOR',
    "kisiId" TEXT,
    "gondeAdi" TEXT,
    "gondeTelefon" TEXT,
    "gondeSirket" TEXT,
    "kayitGrubu" TEXT,
    "portalUrl" TEXT,
    "portalIlanNo" TEXT,
    "portalIlanSahibi" TEXT,
    "baslik" TEXT,
    "ozet" TEXT,
    "hamMetin" TEXT,
    "operasyonNotu" TEXT,
    "arsivNotu" TEXT,
    "ozelSartlar" TEXT[],
    "validUntil" TIMESTAMP(3) NOT NULL,
    "ttlUyariGonderildi" BOOLEAN NOT NULL DEFAULT false,
    "fingerprint" TEXT NOT NULL,
    "notionId" TEXT,
    "notionSonSync" TIMESTAMP(3),
    "alanGuvenleri" JSONB,
    "aiModelVersiyon" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "kayit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mulk_ozellik" (
    "id" TEXT NOT NULL,
    "kayitId" TEXT,
    "portalIlanId" TEXT,
    "kapaliAlanM2" DOUBLE PRECISION,
    "acikAlanM2" DOUBLE PRECISION,
    "arsaAlanM2" DOUBLE PRECISION,
    "sundurmaM2" DOUBLE PRECISION,
    "ofisAlanM2" DOUBLE PRECISION,
    "girisKatM2" DOUBLE PRECISION,
    "asmaKatM2" DOUBLE PRECISION,
    "bodrumM2" DOUBLE PRECISION,
    "bolunebilir" BOOLEAN,
    "minBolumM2" DOUBLE PRECISION,
    "netYukseklikM" DOUBLE PRECISION,
    "makasAltiYukseklikM" DOUBLE PRECISION,
    "kapiSayisi" INTEGER,
    "kapiGenislikM" DOUBLE PRECISION,
    "kapiYukseklikM" DOUBLE PRECISION,
    "otomatikKapi" BOOLEAN,
    "aracErisimi" "AracErisimi",
    "tirManevraAlani" BOOLEAN,
    "rampa" BOOLEAN,
    "rampaSayisi" INTEGER,
    "vinc" BOOLEAN,
    "vincKapasitesiTon" DOUBLE PRECISION,
    "yukAsansoru" BOOLEAN,
    "elektrikGucuKw" DOUBLE PRECISION,
    "elektrikGucuKva" DOUBLE PRECISION,
    "elektrikGucuHam" TEXT,
    "trafo" BOOLEAN,
    "trafoGucuKva" DOUBLE PRECISION,
    "sanayiElektrigi" BOOLEAN,
    "jenerator" BOOLEAN,
    "yanginSistemi" BOOLEAN,
    "sprinkler" BOOLEAN,
    "yanginAlgilama" BOOLEAN,
    "paratoner" BOOLEAN,
    "iskan" BOOLEAN,
    "ruhsatDurumu" "RuhsatDurumu",
    "isyeriAcmaRuhsati" BOOLEAN,
    "numarataj" BOOLEAN,
    "tapuTipi" "TapuTipi",
    "imarDurumu" "ImarDurumu",
    "adaNo" TEXT,
    "parselNo" TEXT,
    "emsalKaks" DOUBLE PRECISION,
    "taks" DOUBLE PRECISION,
    "sogukHava" BOOLEAN,
    "sogukHavaM2" DOUBLE PRECISION,
    "sogukHavaMinC" DOUBLE PRECISION,
    "sogukHavaMaxC" DOUBLE PRECISION,
    "iklimlendirme" BOOLEAN,
    "havalandirma" BOOLEAN,
    "gidayaUygun" BOOLEAN,
    "yapiSistemi" "YapiSistemi",
    "catiTipi" "CatiTipi",
    "duvarTipi" "DuvarTipi",
    "zeminTipi" "ZeminTipi",
    "zeminYukTasimaTonM2" DOUBLE PRECISION,
    "binaYasi" INTEGER,
    "katSayisi" INTEGER,
    "bulunduguKat" INTEGER,
    "ofis" BOOLEAN,
    "ofisOdaSayisi" INTEGER,
    "wc" BOOLEAN,
    "wcSayisi" INTEGER,
    "mutfak" BOOLEAN,
    "personelAlani" BOOLEAN,
    "sundurma" BOOLEAN,
    "sondaj" BOOLEAN,
    "cepheUzunluguM" DOUBLE PRECISION,
    "cepheSayisi" INTEGER,
    "vitrin" BOOLEAN,
    "koseKonum" BOOLEAN,
    "anaCaddeUzeri" BOOLEAN,
    "duzGiris" BOOLEAN,
    "asmaKat" BOOLEAN,
    "bodrum" BOOLEAN,
    "baca" BOOLEAN,
    "asansor" BOOLEAN,
    "otoparkDurumu" "OtoparkDurumu",
    "otoparkKapasitesi" INTEGER,
    "yayaTrafigi" "TrafikSeviyesi",
    "aracTrafigi" "TrafikSeviyesi",
    "anaYolaMesafeM" INTEGER,
    "cevreYolunaMesafeM" INTEGER,
    "havalimaninaMesafeM" INTEGER,
    "limanaMesafeM" INTEGER,
    "denizeMesafeM" INTEGER,
    "osbIcinde" BOOLEAN,
    "kullanimAmaclari" "KullanimAmaci"[],
    "otelOdaSayisi" INTEGER,
    "yatakKapasitesi" INTEGER,
    "yildiz" INTEGER,
    "turizmBelgesi" "TurizmBelgesi",
    "havuz" BOOLEAN,
    "kiraOdemeSekli" "KiraOdemeSekli",
    "depozitoAy" DOUBLE PRECISION,
    "minKiraSuresiYil" DOUBLE PRECISION,
    "bosalmaTarihi" TIMESTAMP(3),
    "kiracili" BOOLEAN,
    "mevcutKiraGeliri" DECIMAL(16,2),
    "devirBedeli" DECIMAL(16,2),
    "aidat" DECIMAL(12,2),
    "kritikKriterler" "TeknikAlan"[],
    "esnekKriterler" "TeknikAlan"[],
    "eksikBilgiler" "TeknikAlan"[],
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mulk_ozellik_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kisi" (
    "id" TEXT NOT NULL,
    "adSoyad" TEXT NOT NULL,
    "telefon" TEXT,
    "ikincilTelefon" TEXT,
    "email" TEXT,
    "sirket" TEXT,
    "roller" "KisiRolu"[],
    "ilanSahibiTipi" "IlanSahibiTipi" NOT NULL DEFAULT 'BILINMIYOR',
    "kaynak" "KisiKaynagi" NOT NULL DEFAULT 'MANUEL',
    "notlar" TEXT,
    "googleResourceName" TEXT,
    "notionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "kisi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "match" (
    "id" TEXT NOT NULL,
    "talepId" TEXT NOT NULL,
    "portfoyId" TEXT,
    "portalIlanId" TEXT,
    "havuz" "Havuz" NOT NULL DEFAULT 'KENDI_PORTFOY',
    "matematikSkor" DOUBLE PRECISION NOT NULL,
    "lokasyonBonus" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "aiSkor" DOUBLE PRECISION,
    "finalSkor" DOUBLE PRECISION NOT NULL,
    "aiAnaliz" TEXT,
    "uygunluk" "Uygunluk",
    "kritikEngeller" "TeknikAlan"[],
    "eksikBilgiler" "TeknikAlan"[],
    "kriterDokumu" JSONB,
    "durum" "MatchDurum" NOT NULL DEFAULT 'BEKLIYOR',
    "operasyonNotu" TEXT,
    "notGuncellendi" TIMESTAMP(3),
    "talepSahibiAdi" TEXT,
    "talepSahibiTel" TEXT,
    "portfoySahibiAdi" TEXT,
    "portfoySahibiTel" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "match_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "portal_ilan" (
    "id" TEXT NOT NULL,
    "kanal" "VeriKanali" NOT NULL,
    "url" TEXT NOT NULL,
    "ilanNo" TEXT,
    "baslik" TEXT,
    "hamIcerik" TEXT,
    "ilanSahibiAdi" TEXT,
    "ilanSahibiTel" TEXT,
    "ilanSahibiTipi" "IlanSahibiTipi" NOT NULL DEFAULT 'PORTAL',
    "anaKategori" "AnaKategori",
    "mulkTipi" "MulkTipi",
    "islemTipi" "IslemTipi",
    "fiyat" DECIMAL(16,2),
    "paraBirimi" "ParaBirimi" NOT NULL DEFAULT 'TRY',
    "fiyatPeriyodu" "FiyatPeriyodu" NOT NULL DEFAULT 'TOPLAM',
    "m2" DOUBLE PRECISION,
    "ilId" INTEGER,
    "ilceId" INTEGER,
    "mahalleId" INTEGER,
    "altBolgeId" INTEGER,
    "ilkGorulme" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sonGorulme" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fiyatGecmisi" JSONB,
    "portfoyEdinmeSkoru" DOUBLE PRECISION,
    "durum" "PortalIlanDurum" NOT NULL DEFAULT 'HAM',
    "kayitId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "portal_ilan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" TEXT NOT NULL,
    "kayitId" TEXT NOT NULL,
    "alan" TEXT NOT NULL,
    "eskiDeger" JSONB,
    "yeniDeger" JSONB,
    "kaynak" TEXT NOT NULL DEFAULT 'kullanici',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ingestion_log" (
    "id" TEXT NOT NULL,
    "kanal" "VeriKanali" NOT NULL,
    "dosyaAdi" TEXT,
    "grupAdi" TEXT,
    "toplamMesaj" INTEGER NOT NULL DEFAULT 0,
    "gurultu" INTEGER NOT NULL DEFAULT 0,
    "yeniKayit" INTEGER NOT NULL DEFAULT 0,
    "duplicate" INTEGER NOT NULL DEFAULT 0,
    "lokasyonCozulemedi" INTEGER NOT NULL DEFAULT 0,
    "hata" INTEGER NOT NULL DEFAULT 0,
    "detay" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ingestion_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notion_sync_log" (
    "id" TEXT NOT NULL,
    "kayitId" TEXT,
    "notionId" TEXT,
    "yon" TEXT NOT NULL DEFAULT 'supabase_to_notion',
    "durum" "SyncDurum" NOT NULL,
    "hata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notion_sync_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "il_plaka_key" ON "il"("plaka");

-- CreateIndex
CREATE UNIQUE INDEX "il_slug_key" ON "il"("slug");

-- CreateIndex
CREATE INDEX "ilce_ilId_idx" ON "ilce"("ilId");

-- CreateIndex
CREATE UNIQUE INDEX "ilce_ilId_slug_key" ON "ilce"("ilId", "slug");

-- CreateIndex
CREATE INDEX "mahalle_ilceId_idx" ON "mahalle"("ilceId");

-- CreateIndex
CREATE INDEX "mahalle_ad_idx" ON "mahalle"("ad");

-- CreateIndex
CREATE UNIQUE INDEX "mahalle_ilceId_slug_key" ON "mahalle"("ilceId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "alt_bolge_ilId_slug_key" ON "alt_bolge"("ilId", "slug");

-- CreateIndex
CREATE INDEX "lokasyon_alias_alias_idx" ON "lokasyon_alias"("alias");

-- CreateIndex
CREATE UNIQUE INDEX "lokasyon_alias_alias_seviye_ilId_key" ON "lokasyon_alias"("alias", "seviye", "ilId");

-- CreateIndex
CREATE INDEX "kayit_lokasyon_kayitId_idx" ON "kayit_lokasyon"("kayitId");

-- CreateIndex
CREATE INDEX "kayit_lokasyon_ilceId_idx" ON "kayit_lokasyon"("ilceId");

-- CreateIndex
CREATE INDEX "kayit_lokasyon_mahalleId_idx" ON "kayit_lokasyon"("mahalleId");

-- CreateIndex
CREATE INDEX "kayit_lokasyon_altBolgeId_idx" ON "kayit_lokasyon"("altBolgeId");

-- CreateIndex
CREATE UNIQUE INDEX "kayit_fingerprint_key" ON "kayit"("fingerprint");

-- CreateIndex
CREATE UNIQUE INDEX "kayit_notionId_key" ON "kayit"("notionId");

-- CreateIndex
CREATE INDEX "kayit_tip_durum_idx" ON "kayit"("tip", "durum");

-- CreateIndex
CREATE INDEX "kayit_anaKategori_mulkTipi_idx" ON "kayit"("anaKategori", "mulkTipi");

-- CreateIndex
CREATE INDEX "kayit_islemTipi_idx" ON "kayit"("islemTipi");

-- CreateIndex
CREATE INDEX "kayit_validUntil_idx" ON "kayit"("validUntil");

-- CreateIndex
CREATE INDEX "kayit_gondeTelefon_idx" ON "kayit"("gondeTelefon");

-- CreateIndex
CREATE INDEX "kayit_kisiId_idx" ON "kayit"("kisiId");

-- CreateIndex
CREATE UNIQUE INDEX "mulk_ozellik_kayitId_key" ON "mulk_ozellik"("kayitId");

-- CreateIndex
CREATE UNIQUE INDEX "mulk_ozellik_portalIlanId_key" ON "mulk_ozellik"("portalIlanId");

-- CreateIndex
CREATE INDEX "mulk_ozellik_kapaliAlanM2_idx" ON "mulk_ozellik"("kapaliAlanM2");

-- CreateIndex
CREATE INDEX "mulk_ozellik_elektrikGucuKw_idx" ON "mulk_ozellik"("elektrikGucuKw");

-- CreateIndex
CREATE INDEX "mulk_ozellik_netYukseklikM_idx" ON "mulk_ozellik"("netYukseklikM");

-- CreateIndex
CREATE INDEX "mulk_ozellik_aracErisimi_idx" ON "mulk_ozellik"("aracErisimi");

-- CreateIndex
CREATE INDEX "mulk_ozellik_ruhsatDurumu_idx" ON "mulk_ozellik"("ruhsatDurumu");

-- CreateIndex
CREATE UNIQUE INDEX "kisi_telefon_key" ON "kisi"("telefon");

-- CreateIndex
CREATE UNIQUE INDEX "kisi_googleResourceName_key" ON "kisi"("googleResourceName");

-- CreateIndex
CREATE UNIQUE INDEX "kisi_notionId_key" ON "kisi"("notionId");

-- CreateIndex
CREATE INDEX "kisi_adSoyad_idx" ON "kisi"("adSoyad");

-- CreateIndex
CREATE INDEX "match_finalSkor_idx" ON "match"("finalSkor");

-- CreateIndex
CREATE INDEX "match_durum_idx" ON "match"("durum");

-- CreateIndex
CREATE UNIQUE INDEX "match_talepId_portfoyId_key" ON "match"("talepId", "portfoyId");

-- CreateIndex
CREATE UNIQUE INDEX "match_talepId_portalIlanId_key" ON "match"("talepId", "portalIlanId");

-- CreateIndex
CREATE UNIQUE INDEX "portal_ilan_url_key" ON "portal_ilan"("url");

-- CreateIndex
CREATE UNIQUE INDEX "portal_ilan_kayitId_key" ON "portal_ilan"("kayitId");

-- CreateIndex
CREATE INDEX "portal_ilan_kanal_durum_idx" ON "portal_ilan"("kanal", "durum");

-- CreateIndex
CREATE INDEX "portal_ilan_ilceId_idx" ON "portal_ilan"("ilceId");

-- CreateIndex
CREATE INDEX "audit_log_kayitId_idx" ON "audit_log"("kayitId");

-- CreateIndex
CREATE INDEX "notion_sync_log_durum_idx" ON "notion_sync_log"("durum");

-- AddForeignKey
ALTER TABLE "ilce" ADD CONSTRAINT "ilce_ilId_fkey" FOREIGN KEY ("ilId") REFERENCES "il"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mahalle" ADD CONSTRAINT "mahalle_ilceId_fkey" FOREIGN KEY ("ilceId") REFERENCES "ilce"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alt_bolge" ADD CONSTRAINT "alt_bolge_ilId_fkey" FOREIGN KEY ("ilId") REFERENCES "il"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alt_bolge" ADD CONSTRAINT "alt_bolge_ilceId_fkey" FOREIGN KEY ("ilceId") REFERENCES "ilce"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alt_bolge_mahalle" ADD CONSTRAINT "alt_bolge_mahalle_altBolgeId_fkey" FOREIGN KEY ("altBolgeId") REFERENCES "alt_bolge"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alt_bolge_mahalle" ADD CONSTRAINT "alt_bolge_mahalle_mahalleId_fkey" FOREIGN KEY ("mahalleId") REFERENCES "mahalle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ilce_komsuluk" ADD CONSTRAINT "ilce_komsuluk_ilceId_fkey" FOREIGN KEY ("ilceId") REFERENCES "ilce"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ilce_komsuluk" ADD CONSTRAINT "ilce_komsuluk_komsuIlceId_fkey" FOREIGN KEY ("komsuIlceId") REFERENCES "ilce"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lokasyon_alias" ADD CONSTRAINT "lokasyon_alias_ilId_fkey" FOREIGN KEY ("ilId") REFERENCES "il"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lokasyon_alias" ADD CONSTRAINT "lokasyon_alias_ilceId_fkey" FOREIGN KEY ("ilceId") REFERENCES "ilce"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lokasyon_alias" ADD CONSTRAINT "lokasyon_alias_mahalleId_fkey" FOREIGN KEY ("mahalleId") REFERENCES "mahalle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lokasyon_alias" ADD CONSTRAINT "lokasyon_alias_altBolgeId_fkey" FOREIGN KEY ("altBolgeId") REFERENCES "alt_bolge"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kayit_lokasyon" ADD CONSTRAINT "kayit_lokasyon_kayitId_fkey" FOREIGN KEY ("kayitId") REFERENCES "kayit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kayit_lokasyon" ADD CONSTRAINT "kayit_lokasyon_ilId_fkey" FOREIGN KEY ("ilId") REFERENCES "il"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kayit_lokasyon" ADD CONSTRAINT "kayit_lokasyon_ilceId_fkey" FOREIGN KEY ("ilceId") REFERENCES "ilce"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kayit_lokasyon" ADD CONSTRAINT "kayit_lokasyon_mahalleId_fkey" FOREIGN KEY ("mahalleId") REFERENCES "mahalle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kayit_lokasyon" ADD CONSTRAINT "kayit_lokasyon_altBolgeId_fkey" FOREIGN KEY ("altBolgeId") REFERENCES "alt_bolge"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kayit" ADD CONSTRAINT "kayit_kisiId_fkey" FOREIGN KEY ("kisiId") REFERENCES "kisi"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mulk_ozellik" ADD CONSTRAINT "mulk_ozellik_kayitId_fkey" FOREIGN KEY ("kayitId") REFERENCES "kayit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mulk_ozellik" ADD CONSTRAINT "mulk_ozellik_portalIlanId_fkey" FOREIGN KEY ("portalIlanId") REFERENCES "portal_ilan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match" ADD CONSTRAINT "match_talepId_fkey" FOREIGN KEY ("talepId") REFERENCES "kayit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match" ADD CONSTRAINT "match_portfoyId_fkey" FOREIGN KEY ("portfoyId") REFERENCES "kayit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match" ADD CONSTRAINT "match_portalIlanId_fkey" FOREIGN KEY ("portalIlanId") REFERENCES "portal_ilan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "portal_ilan" ADD CONSTRAINT "portal_ilan_ilId_fkey" FOREIGN KEY ("ilId") REFERENCES "il"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "portal_ilan" ADD CONSTRAINT "portal_ilan_ilceId_fkey" FOREIGN KEY ("ilceId") REFERENCES "ilce"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "portal_ilan" ADD CONSTRAINT "portal_ilan_mahalleId_fkey" FOREIGN KEY ("mahalleId") REFERENCES "mahalle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "portal_ilan" ADD CONSTRAINT "portal_ilan_altBolgeId_fkey" FOREIGN KEY ("altBolgeId") REFERENCES "alt_bolge"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "portal_ilan" ADD CONSTRAINT "portal_ilan_kayitId_fkey" FOREIGN KEY ("kayitId") REFERENCES "kayit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_kayitId_fkey" FOREIGN KEY ("kayitId") REFERENCES "kayit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

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