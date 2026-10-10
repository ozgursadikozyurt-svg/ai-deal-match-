/**
 * Anahtar CRM v3.22.2 · 10 Ekim 2026
 * Demo örnek verisi — ticari kayıtlar Notion CRM'den, konut kayıtları WhatsApp grup örneklerinden türetildi (v3.3). Kişi adları ve telefonlar KURGUSALDIR.
 * Her kayıt yüklenirken gerçek doğrulamadan (KayitCreateSchema) ve gerçek konum çözücüden geçer;
 * geçemeyen kayıt ekranda "örnek veri hatası" olarak görünür (şema değişince erken uyarı).
 */
import type { KayitCreateInput } from "../src/lib/validation/kayit";

export type OrnekKayit = Omit<KayitCreateInput, "lokasyonlar"> & { oid: string; gunOnce: number; /** v3.22 — talepte hariç tutulan yerler */ haricHam?: string };

export const ORNEK_VERI_SURUMU = "3.22-1";

export const ORNEK_PORTFOYLER: OrnekKayit[] = [
  {
    oid: "P1", gunOnce: 20, tip: "PORTFOY", mulkTipi: "DEPO_ANTREPO", islemTipi: "KIRALIK", fiyat: 300000, fiyatPeriyodu: "AYLIK", m2: 4000,
    lokasyonHam: "Aksu / Hacıaliler", veriKanali: "NOTION", ilanSahibiTipi: "MALIK", portfoyAlinabilirlik: "COK_YUKSEK", yetkili: true,
    gondeAdi: "Mehmet K. (örnek)", gondeTelefon: "+905550000101", baslik: "Hacıaliler 4000 m² depo 400 kW",
    hamMetin: "4000 m2 Kapalı 2000 m2 Açık alan\n400 kw elektirik gücü , yanlar panel ve\nÜzeri trapez saç\nKira Yıllık isteniyor",
    ozellik: { kapaliAlanM2: 4000, acikAlanM2: 2000, elektrikGucuKw: 400, elektrikGucuHam: "400 kw", duvarTipi: "SANDVIC_PANEL", catiTipi: "TRAPEZ_SAC", kiraOdemeSekli: "YILLIK_PESIN", kullanimAmaclari: ["DEPOLAMA", "URETIM"] },
  },
  {
    oid: "P2", kayitGrubu: "EMLAK BORSASI", gunOnce: 40, tip: "PORTFOY", mulkTipi: "DEPO_ANTREPO", islemTipi: "KIRALIK", fiyat: 710000, fiyatPeriyodu: "AYLIK", m2: 8000,
    lokasyonHam: "Aksu / Kundu", veriKanali: "WHATSAPP", ilanSahibiTipi: "EMLAKCI", gondeAdi: "Selin A. (örnek)", gondeSirket: "Örnek Gayrimenkul", gondeTelefon: "+905550000102",
    baslik: "Kundu 8000 m² rampalı depo", hamMetin: "8000 M2 400 kwa depo Aksu Kundu Rampalı\n11 dönüm arsa içinde, 6 mt makas altı, 4 kapı 2 rampa, TIR girer\nOfis ve wc mevcut. Aylık 710.000 + kdv",
    ozellik: { kapaliAlanM2: 8000, arsaAlanM2: 11000, makasAltiYukseklikM: 6, kapiSayisi: 4, rampaSayisi: 2, elektrikGucuKva: 400, trafoGucuKva: 400, ofis: true, wc: true, duvarTipi: "SANDVIC_PANEL", catiTipi: "SANDVIC_PANEL", aracErisimi: "TIR", tirManevraAlani: true },
  },
  {
    oid: "P3", gunOnce: 12, tip: "PORTFOY", mulkTipi: "FABRIKA_URETIM_TESISI", islemTipi: "SATILIK", fiyat: 42500000, m2: 3200,
    lokasyonHam: "Antalya OSB", veriKanali: "MANUEL", ilanSahibiTipi: "FIRMA", gondeAdi: "Örnek Makine A.Ş. (örnek)", gondeTelefon: "+905550000103",
    baslik: "OSB 3200 m² vinçli fabrika", hamMetin: "OSB içinde satılık fabrika. 2400 kapalı 800 açık. Makas altı 9 metre, 10 ton köprülü vinç, 400 kVA trafo, sprinkler, iskanlı ve ruhsatlı. 42.5 milyon",
    ozellik: { kapaliAlanM2: 2400, acikAlanM2: 800, makasAltiYukseklikM: 9, vincKapasitesiTon: 10, trafoGucuKva: 400, elektrikGucuKva: 400, sprinkler: true, yanginSistemi: true, iskan: true, ruhsatDurumu: "RUHSATLI", osbIcinde: true, aracErisimi: "TIR", yapiSistemi: "CELIK_KONSTRUKSIYON" },
  },
  {
    oid: "P4", kayitGrubu: "ANTALYA SANAYİ EMLAK", gunOnce: 35, tip: "PORTFOY", mulkTipi: "SOGUK_HAVA_DEPOSU", islemTipi: "KIRALIK", fiyat: 185000, fiyatPeriyodu: "AYLIK", m2: 1200,
    lokasyonHam: "Kepez / Altınova Sinan", veriKanali: "WHATSAPP", ilanSahibiTipi: "MALIK", gondeAdi: "Hasan T. (örnek)", gondeTelefon: "+905550000104",
    baslik: "Altınova 1200 m² soğuk hava deposu", hamMetin: "Altınova Sinan'da 1200 m2 depo, içinde 800 m2 soğuk oda (-18 / +4). Gıdaya uygun, 250 kw, kamyon rampası var. 185 bin aylık",
    ozellik: { kapaliAlanM2: 1200, sogukHava: true, sogukHavaM2: 800, sogukHavaMinC: -18, sogukHavaMaxC: 4, gidayaUygun: true, elektrikGucuKw: 250, aracErisimi: "KAMYON", rampaSayisi: 1, kullanimAmaclari: ["GIDA_DEPOLAMA", "SOGUK_ZINCIR"] },
  },
  {
    oid: "P5", kayitGrubu: "EMLAK BORSASI", gunOnce: 5, tip: "PORTFOY", mulkTipi: "DUKKAN_MAGAZA", islemTipi: "KIRALIK", fiyat: 150000, fiyatPeriyodu: "AYLIK", m2: 180,
    lokasyonHam: "Muratpaşa / Gençlik", veriKanali: "WHATSAPP", ilanSahibiTipi: "EMLAKCI", gondeAdi: "Burak D. (örnek)", gondeTelefon: "+905550000105",
    baslik: "Işıklar köşe vitrinli mağaza", hamMetin: "Işıklar Caddesi üzeri köşe dükkan 120 m2 giriş + 60 m2 asma kat. 12 metre vitrin. Aylık 150.000",
    ozellik: { girisKatM2: 120, asmaKatM2: 60, cepheUzunluguM: 12, cepheSayisi: 2, vitrin: true, koseKonum: true, anaCaddeUzeri: true, duzGiris: true, yayaTrafigi: "COK_YUKSEK", aracTrafigi: "YUKSEK", kullanimAmaclari: ["PERAKENDE", "SHOWROOM"] },
  },
  {
    oid: "P6", gunOnce: 9, tip: "PORTFOY", mulkTipi: "DUKKAN_MAGAZA", islemTipi: "SATILIK", fiyat: 65000000, m2: 450,
    yetkili: true, lokasyonHam: "Muratpaşa / Güzeloba", veriKanali: "MANUEL", ilanSahibiTipi: "MUTEAHHIT", gondeAdi: "Örnek Yapı Ltd. (örnek)", gondeTelefon: "+905550000106",
    baslik: "Lara ana cadde 450 m² dükkan", hamMetin: "Lara Güzeloba ana cadde üzeri sıfır bina zemin kat 450 m2 dükkan, 25 metre cephe, önünde 20 araçlık açık otopark. İskanlı. 65 milyon",
    ozellik: { girisKatM2: 450, cepheUzunluguM: 25, vitrin: true, anaCaddeUzeri: true, otoparkDurumu: "ACIK", otoparkKapasitesi: 20, iskan: true, binaYasi: 0, yayaTrafigi: "YUKSEK" },
  },
  {
    oid: "P7", kayitGrubu: "ANTALYA SANAYİ EMLAK", gunOnce: 30, tip: "PORTFOY", mulkTipi: "ATOLYE", islemTipi: "KIRALIK", fiyat: 55000, fiyatPeriyodu: "AYLIK", m2: 600,
    lokasyonHam: "Kepez / Varsak Karşıyaka", veriKanali: "WHATSAPP", ilanSahibiTipi: "MALIK", gondeAdi: "Ali R. (örnek)", gondeTelefon: "+905550000107",
    baslik: "Varsak 600 m² atölye", hamMetin: "Varsak'ta 600 m2 atölye, 5 metre yükseklik, kamyonet girer, sanayi elektriği 60 kva. 55 bin",
    ozellik: { kapaliAlanM2: 600, netYukseklikM: 5, aracErisimi: "KAMYONET", sanayiElektrigi: true, elektrikGucuKva: 60, elektrikGucuHam: "60 kva", kullanimAmaclari: ["URETIM"] },
  },
  {
    oid: "P8", gunOnce: 60, tip: "PORTFOY", mulkTipi: "ARSA", islemTipi: "SATILIK", fiyat: 36000000, m2: 12000,
    lokasyonHam: "Aksu / Pınarlı", veriKanali: "SAHIBINDEN", ilanSahibiTipi: "MALIK", havuz: "DIS_ILAN", portalUrl: "https://www.sahibinden.com/ilan/ornek-12-donum", portalIlanNo: "ORNEK-1188",
    gondeAdi: "Veli S. (örnek)", gondeTelefon: "+905550000108", baslik: "Pınarlı 12 dönüm sanayi imarlı arsa",
    hamMetin: "Aksu Pınarlı'da 12 dönüm sanayi imarlı arsa, emsal 1.00, yola cepheli. Sahibinden 36 milyon",
    ozellik: { arsaAlanM2: 12000, imarDurumu: "SANAYI", emsalKaks: 1, tapuTipi: "MUSTAKIL_PARSEL", anaYolaMesafeM: 0 },
  },
  {
    oid: "P9", gunOnce: 15, tip: "PORTFOY", mulkTipi: "BUTIK_OTEL", islemTipi: "SATILIK", fiyat: 6500000, paraBirimi: "EUR", m2: 2600,
    lokasyonHam: "Serik / Belek", veriKanali: "MANUEL", ilanSahibiTipi: "PARTNER", havuz: "PARTNER", gondeAdi: "Partner ofis (örnek)", gondeTelefon: "+905550000109",
    baslik: "Belek 42 odalı butik otel", hamMetin: "Belek'te bakanlık belgeli 42 oda 90 yatak butik otel, havuzlu, denize 800 metre. 6.5 milyon Euro",
    ozellik: { otelOdaSayisi: 42, yatakKapasitesi: 90, turizmBelgesi: "BAKANLIK_BELGELI", havuz: true, denizeMesafeM: 800, kullanimAmaclari: ["KONAKLAMA"] },
  },
  {
    oid: "P10", kayitGrubu: "EMLAKÇILAR GRUBU", gunOnce: 3, tip: "PORTFOY", mulkTipi: "RESTORAN_LOKANTA", islemTipi: "DEVREN_KIRALIK", fiyat: 90000, fiyatPeriyodu: "AYLIK", m2: 250,
    lokasyonHam: "Kepez / Erenköy", veriKanali: "WHATSAPP", ilanSahibiTipi: "EMLAKCI", gondeAdi: "Emre Ç. (örnek)", gondeTelefon: "+905550000110",
    baslik: "Kepez devren restoran", hamMetin: "Devren kiralık restoran Kepez Erenköy, 250 m2, bacası ve mutfağı hazır. Devir 3.5 milyon, kira 90 bin",
    ozellik: { devirBedeli: 3500000, baca: true, mutfak: true, girisKatM2: 250, duzGiris: true, kullanimAmaclari: ["RESTORAN_KAFE"] },
  },
  // ── Konut (v3.3) ──
  {
    oid: "P11", kayitGrubu: "EMLAK BORSASI", gunOnce: 4, tip: "PORTFOY", mulkTipi: "DAIRE", islemTipi: "SATILIK", fiyat: 7900000, m2: 145, netM2: 125, odaSayisi: "3+1", krediyeUygun: true,
    lokasyonHam: "Konyaaltı / Hurma", veriKanali: "WHATSAPP", ilanSahibiTipi: "EMLAKCI", gondeAdi: "Ayşe K. (örnek)", gondeTelefon: "+905550000111",
    baslik: "Hurma 3+1 havuzlu sitede daire", hamMetin: "Konyaaltı Hurma'da havuzlu site içinde 3+1, 145 m2 brüt 125 net, 4. kat, 6 yaşında, doğalgaz kombi, güney cephe, krediye uygun. 7.9 milyon",
    ozellik: { banyoSayisi: 2, bulunduguKat: 4, katSayisi: 6, binaYasi: 6, isinmaTipi: "DOGALGAZ_KOMBI", siteIcinde: true, havuz: true, asansor: true, otoparkDurumu: "KAPALI", balkon: true, cepheYonleri: ["GUNEY"], ebeveynBanyosu: true, aidat: 2500, iskan: true },
  },
  {
    oid: "P12", kayitGrubu: "EMLAKÇILAR GRUBU", gunOnce: 7, tip: "PORTFOY", mulkTipi: "DAIRE", islemTipi: "KIRALIK", fiyat: 32000, fiyatPeriyodu: "AYLIK", m2: 95, odaSayisi: "2+1",
    lokasyonHam: "Muratpaşa / Meltem", veriKanali: "WHATSAPP", ilanSahibiTipi: "MALIK", gondeAdi: "Mustafa E. (örnek)", gondeTelefon: "+905550000112",
    baslik: "Meltem 2+1 eşyalı kiralık", hamMetin: "Meltem'de 2+1 eşyalı kiralık daire, 95 m2, 2. kat, asansörlü, kombili. Aylık 32.000, 2 depozito",
    ozellik: { banyoSayisi: 1, bulunduguKat: 2, esyaDurumu: "ESYALI", isinmaTipi: "DOGALGAZ_KOMBI", asansor: true, balkon: true, depozitoAy: 2 },
  },
  {
    oid: "P13", gunOnce: 18, tip: "PORTFOY", mulkTipi: "VILLA", islemTipi: "SATILIK", fiyat: 24500000, m2: 320, odaSayisi: "5+2",
    lokasyonHam: "Döşemealtı", veriKanali: "MANUEL", ilanSahibiTipi: "MUTEAHHIT", gondeAdi: "Örnek İnşaat (örnek)", gondeTelefon: "+905550000113",
    baslik: "Döşemealtı müstakil havuzlu villa", hamMetin: "Döşemealtı'nda 700 m2 arsa içinde 320 m2 5+2 müstakil villa, özel havuz, yerden ısıtma, sıfır. 24.5 milyon",
    ozellik: { arsaAlanM2: 700, banyoSayisi: 4, binaYasi: 0, isinmaTipi: "YERDEN_ISITMA", havuz: true, bahce: true, otoparkDurumu: "KAPALI", dubleks: true, iskan: true },
  },
  // ── v3.22: danışmanın KENDİ portföyü (imzadaki telefonla gruptan gelmiş) ve ofis arkadaşının portföyü ──
  {
    oid: "P14", kayitGrubu: "EMLAK BORSASI", gunOnce: 2, tip: "PORTFOY", mulkTipi: "DAIRE", islemTipi: "SATILIK", fiyat: 8200000, m2: 150, netM2: 130, odaSayisi: "3+1", krediyeUygun: true,
    lokasyonHam: "Konyaaltı / Liman", veriKanali: "WHATSAPP", ilanSahibiTipi: "EMLAKCI", gondeAdi: "Özgür Özyurt", gondeTelefon: "+905309365427", gondeSirket: "Özyurtlar Gayrimenkul",
    baslik: "Liman 3+1 denize yürüme mesafesinde", hamMetin: "Konyaaltı Liman'da denize 5 dk, 3+1, 150 m2 brüt, site içinde, krediye uygun, 3. kat. 8.2 milyon. Yetkili portföyümüzdür.",
    ozellik: { banyoSayisi: 2, bulunduguKat: 3, katSayisi: 5, binaYasi: 4, isinmaTipi: "DOGALGAZ_KOMBI", siteIcinde: true, asansor: true, balkon: true, iskan: true },
  },
  {
    oid: "P15", gunOnce: 6, tip: "PORTFOY", mulkTipi: "DUKKAN_MAGAZA", islemTipi: "KIRALIK", fiyat: 55000, fiyatPeriyodu: "AYLIK", m2: 120,
    lokasyonHam: "Muratpaşa / Fener", veriKanali: "WHATSAPP", ilanSahibiTipi: "EMLAKCI", gondeAdi: "Selin Y. (örnek)", gondeTelefon: "+905550000115", gondeSirket: "Özyurtlar Gayrimenkul",
    baslik: "Fener cadde üstü kiralık dükkan", hamMetin: "Fener'de cadde üstü 120 m2 kiralık dükkan, vitrinli, zemin kat. Aylık 55.000",
    ozellik: { vitrin: true },
  },
];

export const ORNEK_TALEPLER: OrnekKayit[] = [
  {
    oid: "T1", gunOnce: 6, tip: "TALEP", mulkTipi: "FABRIKA_URETIM_TESISI", alternatifMulkTipleri: ["DEPO_ANTREPO"], islemTipi: "KIRALIK", aciliyet: "YUKSEK",
    maxFiyat: 120000, fiyatPeriyodu: "AYLIK", minM2: 1000, m2ToleransYuzde: 20, musteriKaynagi: "ILAN", ilanSahibiTipi: "FIRMA",
    lokasyonHam: "Aksu Pınarlı çevresi, Yenigöl, Altınova, Cihadiye", gondeAdi: "Kazan üreticisi firma (örnek)", gondeTelefon: "+905550000201",
    baslik: "Kazan üretim tesisi — 1000 m² üzeri", hamMetin: "Kazan üretimi için 1000 m2 üzeri tesis arıyoruz. 50-60 kW elektrik şart. Aksu Pınarlı çevresi ve Yenigöl Altınova Cihadiye olur. Aylık 120 bine kadar",
    ozellik: { elektrikGucuKw: 50, kullanimAmaclari: ["URETIM"], kritikKriterler: ["ELEKTRIK", "ALAN"], esnekKriterler: ["LOKASYON"], eksikBilgiler: ["RUHSAT", "ARAC_ERISIMI", "YUKSEKLIK"] },
  },
  {
    oid: "T2", kayitGrubu: "ANTALYA SANAYİ EMLAK", gunOnce: 2, tip: "TALEP", mulkTipi: "DEPO_ANTREPO", alternatifMulkTipleri: ["LOJISTIK_MERKEZI"], islemTipi: "KIRALIK", aciliyet: "ACIL",
    minM2: 3000, maxM2: 10000, maxFiyat: 750000, fiyatPeriyodu: "AYLIK", ilanSahibiTipi: "FIRMA", musteriKaynagi: "WHATSAPP_GRUBU",
    lokasyonHam: "Aksu, Havalimanı yakını, Kepez", gondeAdi: "Örnek Lojistik (örnek)", gondeTelefon: "+905550000202",
    baslik: "TIR'lı lojistik depo 3000+ m²", hamMetin: "ACİL lojistik firması için min 3000 m2 depo. TIR girişi ve rampa şart. Makas altı 6 mt olursa iyi. 200 kw üstü elektrik. Aksu, havalimanı yakını veya Kepez",
    ozellik: { aracErisimi: "TIR", rampa: true, makasAltiYukseklikM: 6, elektrikGucuKw: 200, kullanimAmaclari: ["LOJISTIK_DAGITIM", "DEPOLAMA"], kritikKriterler: ["ARAC_ERISIMI", "RAMPA"], esnekKriterler: ["YUKSEKLIK"], eksikBilgiler: ["RUHSAT"] },
  },
  {
    oid: "T3", gunOnce: 10, tip: "TALEP", mulkTipi: "DUKKAN_MAGAZA", islemTipi: "SATILIK", maxFiyat: 70000000, minM2: 400, musteriKaynagi: "SAHA", ilanSahibiTipi: "BILINMIYOR",
    lokasyonHam: "Lara", gondeAdi: "Yatırımcı (örnek)", gondeTelefon: "+905550000203", baslik: "Lara ana cadde dükkan (yatırım)",
    hamMetin: "Lara'da ana cadde üzeri min 400 m2 satılık dükkan, otoparklı olması şart. 70 milyona kadar",
    ozellik: { anaCaddeUzeri: true, otoparkDurumu: "ACIK", kritikKriterler: ["OTOPARK", "CEPHE_VITRIN"], kullanimAmaclari: ["YATIRIM_KIRA_GELIRI"] },
  },
  {
    oid: "T4", gunOnce: 14, tip: "TALEP", mulkTipi: "SOGUK_HAVA_DEPOSU", alternatifMulkTipleri: ["DEPO_ANTREPO"], islemTipi: "KIRALIK", minM2: 800, maxM2: 1500, maxFiyat: 200000, fiyatPeriyodu: "AYLIK",
    ilanSahibiTipi: "FIRMA", musteriKaynagi: "REFERANS", lokasyonHam: "Altınova, Havalimanı", gondeAdi: "Gıda toptancısı (örnek)", gondeTelefon: "+905550000204",
    baslik: "Gıda için soğuk hava deposu", hamMetin: "Donuk gıda için en az 600 m2 soğuk odası olan depo lazım, gıdaya uygun olmalı. Altınova ya da havalimanı tarafı. 200 bine kadar",
    ozellik: { sogukHava: true, sogukHavaM2: 600, gidayaUygun: true, kullanimAmaclari: ["GIDA_DEPOLAMA"], kritikKriterler: ["SOGUK_HAVA", "GIDAYA_UYGUNLUK"], eksikBilgiler: ["ELEKTRIK"] },
  },
  {
    oid: "T5", gunOnce: 21, tip: "TALEP", mulkTipi: "FABRIKA_URETIM_TESISI", islemTipi: "SATILIK", minM2: 2500, maxM2: 5000, maxFiyat: 45000000,
    ilanSahibiTipi: "FIRMA", musteriKaynagi: "REFERANS", lokasyonHam: "OSB, Döşemealtı", gondeAdi: "Metal işleme firması (örnek)", gondeTelefon: "+905550000205",
    baslik: "OSB'de vinçli fabrika (satın alma)", hamMetin: "OSB veya Döşemealtı'nda satılık fabrika, 2500-5000 m2. En az 5 ton vinç ve 250 kVA trafo şart, ruhsatlı olmalı. 45 milyona kadar",
    ozellik: { vincKapasitesiTon: 5, trafoGucuKva: 250, ruhsatDurumu: "RUHSATLI", kritikKriterler: ["VINC", "RUHSAT"], esnekKriterler: ["LOKASYON"] },
  },
  {
    oid: "T6", kayitGrubu: "EMLAK BORSASI", gunOnce: 4, tip: "TALEP", mulkTipi: "DUKKAN_MAGAZA", alternatifMulkTipleri: ["SHOWROOM"], islemTipi: "KIRALIK", minM2: 150, maxM2: 250, maxFiyat: 160000, fiyatPeriyodu: "AYLIK",
    ilanSahibiTipi: "FIRMA", musteriKaynagi: "WHATSAPP_GRUBU", lokasyonHam: "Işıklar, Konyaaltı Hurma", gondeAdi: "Giyim markası (örnek)", gondeTelefon: "+905550000206",
    baslik: "Vitrinli mağaza — Işıklar / Hurma", hamMetin: "Marka mağazası için 150-250 m2 kiralık, vitrin şart, en az 8 metre cephe, yaya trafiği yüksek olmalı. Işıklar veya Konyaaltı Hurma. 160 bine kadar",
    ozellik: { vitrin: true, cepheUzunluguM: 8, yayaTrafigi: "YUKSEK", kritikKriterler: ["CEPHE_VITRIN", "YAYA_TRAFIGI"], kullanimAmaclari: ["PERAKENDE"] },
  },
  {
    oid: "T7", gunOnce: 58, tip: "TALEP", mulkTipi: "ARSA", alternatifMulkTipleri: ["TARLA"], islemTipi: "SATILIK", minM2: 10000, maxM2: 15000, maxFiyat: 40000000,
    ilanSahibiTipi: "BILINMIYOR", musteriKaynagi: "REKLAM", lokasyonHam: "Aksu, Serik", gondeAdi: "Yatırımcı (örnek)", gondeTelefon: "+905550000207",
    baslik: "10–15 dönüm sanayi imarlı arsa", hamMetin: "10-15 dönüm sanayi imarlı arsa, Aksu veya Serik. 40 milyona kadar",
    ozellik: { imarDurumu: "SANAYI", kritikKriterler: ["IMAR"] },
  },
  {
    oid: "T8", gunOnce: 25, tip: "TALEP", mulkTipi: "BUTIK_OTEL", alternatifMulkTipleri: ["OTEL", "APART_OTEL"], islemTipi: "SATILIK", maxFiyat: 7000000, paraBirimi: "EUR",
    ilanSahibiTipi: "PARTNER", musteriKaynagi: "REFERANS", lokasyonHam: "Belek, Kemer, Side", gondeAdi: "Yabancı yatırımcı (örnek)", gondeTelefon: "+905550000208",
    baslik: "Butik otel yatırımı (≤ 7 M€)", hamMetin: "Yatırımcı için en az 30 odalı havuzlu butik otel. Belek, Kemer veya Side. 7 milyon Euro'ya kadar",
    ozellik: { otelOdaSayisi: 30, havuz: true, kullanimAmaclari: ["KONAKLAMA"] },
  },
  // ── Konut + benzer tip örnekleri (v3.3) ──
  {
    oid: "T9", kayitGrubu: "EMLAK BORSASI", gunOnce: 3, tip: "TALEP", mulkTipi: "DAIRE", alternatifMulkTipleri: ["REZIDANS"], islemTipi: "SATILIK", aciliyet: "ACIL", maxFiyat: 8000000, minM2: 120, odaSayisi: "3+1", krediyeUygun: true,
    ilanSahibiTipi: "EMLAKCI", musteriKaynagi: "WHATSAPP_GRUBU", lokasyonHam: "Konyaaltı, Muratpaşa Soğuksu", gondeAdi: "Emlak danışmanı (örnek)", gondeTelefon: "+905550000209",
    baslik: "3+1 daire, krediye uygun, asansörlü", hamMetin: "ACİL müşterim var: Konyaaltı veya Soğuksu tarafı 3+1 min 120 m2, asansörlü, site olursa iyi olur, krediye uygun olmalı. 8 milyona kadar",
    ozellik: { asansor: true, siteIcinde: true, kritikKriterler: ["ODA_SAYISI", "KREDI"], esnekKriterler: ["SITE_GUVENLIK"], eksikBilgiler: ["BINA_YASI", "KAT"] },
  },
  {
    oid: "T10", gunOnce: 5, tip: "TALEP", mulkTipi: "DAIRE", islemTipi: "KIRALIK", maxFiyat: 35000, fiyatPeriyodu: "AYLIK", odaSayisi: "2+1",
    ilanSahibiTipi: "BILINMIYOR", musteriKaynagi: "REFERANS", lokasyonHam: "Meltem, Konyaaltı", gondeAdi: "Öğretim görevlisi (örnek)", gondeTelefon: "+905550000210",
    baslik: "Eşyalı 2+1 kiralık (Meltem / Konyaaltı)", hamMetin: "Üniversiteye yakın, Meltem ya da Konyaaltı, eşyalı 2+1, 35 bine kadar",
    ozellik: { esyaDurumu: "ESYALI", kritikKriterler: ["ESYA"] },
  },
  {
    oid: "T11", gunOnce: 12, tip: "TALEP", mulkTipi: "VILLA", alternatifMulkTipleri: ["MUSTAKIL_EV"], islemTipi: "SATILIK", maxFiyat: 25000000, minM2: 250, odaSayisi: "4+1",
    ilanSahibiTipi: "BILINMIYOR", musteriKaynagi: "SAHA", lokasyonHam: "Döşemealtı, Konyaaltı", gondeAdi: "Aile (örnek)", gondeTelefon: "+905550000211",
    baslik: "Havuzlu müstakil villa ≤ 25 M", hamMetin: "Döşemealtı veya Konyaaltı'nda en az 4+1, havuzlu müstakil villa, 25 milyona kadar",
    ozellik: { havuz: true, kritikKriterler: ["ODA_SAYISI"] },
  },
  {
    oid: "T12", kayitGrubu: "ANTALYA SANAYİ EMLAK", gunOnce: 1, tip: "TALEP", mulkTipi: "IMALATHANE", islemTipi: "KIRALIK", minM2: 400, maxM2: 800, maxFiyat: 70000, fiyatPeriyodu: "AYLIK",
    ilanSahibiTipi: "FIRMA", musteriKaynagi: "WHATSAPP_GRUBU", lokasyonHam: "Kepez, Yeni Sanayi civarı", gondeAdi: "Mobilya atölyesi (örnek)", gondeTelefon: "+905550000212",
    baslik: "Mobilya imalathanesi 400–800 m²", hamMetin: "Mobilya imalatı için Kepez veya Yeni Sanayi civarında 400-800 m2 imalathane, sanayi elektriği şart, 70 bine kadar",
    ozellik: { sanayiElektrigi: true, kullanimAmaclari: ["URETIM"], kritikKriterler: ["SANAYI_ELEKTRIGI"], eksikBilgiler: ["YUKSEKLIK", "ARAC_ERISIMI"] },
  },
  // ── v3.5: e-ticaret deposu (AI kutusundaki örnek Sahibinden ilanı bununla ve T2 ile eşleşir → portföy edinme fırsatı) ──
  {
    oid: "T13", kayitGrubu: "EMLAK BORSASI", gunOnce: 3, tip: "TALEP", mulkTipi: "DEPO_ANTREPO", islemTipi: "KIRALIK", minM2: 2500, maxM2: 4000, maxFiyat: 500000, fiyatPeriyodu: "AYLIK",
    ilanSahibiTipi: "EMLAKCI", musteriKaynagi: "WHATSAPP_GRUBU", lokasyonHam: "Aksu, Kepez", gondeAdi: "Emlak danışmanı Burak (örnek)", gondeTelefon: "+905550000213",
    baslik: "E-ticaret deposu 2500–4000 m²", hamMetin: "E-ticaret firması için Aksu veya Kepez'de 2500-4000 m2 kiralık depo, TIR girmeli, en az 150 kW elektrik. 500 bine kadar",
    ozellik: { aracErisimi: "TIR", elektrikGucuKw: 150, kullanimAmaclari: ["E_TICARET"], kritikKriterler: ["ARAC_ERISIMI"] },
  },
  // ── v3.22: "HARİÇ" — Hurma ve Sarısu istenmiyor; Konyaaltı'nın geri kalanı olur. P11 (Hurma) elenir, P14 (Liman) gelir. ──
  {
    oid: "T14", kayitGrubu: "EMLAK BORSASI", gunOnce: 1, tip: "TALEP", mulkTipi: "DAIRE", islemTipi: "SATILIK", maxFiyat: 8500000, minM2: 130, odaSayisi: "3+1",
    ilanSahibiTipi: "BILINMIYOR", musteriKaynagi: "WHATSAPP_GRUBU", lokasyonHam: "Konyaaltı", haricHam: "Hurma, Sarısu", gondeAdi: "Doğrudan müşteri (örnek)", gondeTelefon: "+905550000214",
    baslik: "Konyaaltı (Hurma, Sarısu hariç) 3+1 daire — satılık talebi", hamMetin: "Hurma, Sarısu HARİÇ Konyaaltı'nda 3+1 en az 130 m2 satılık daire arıyorum, 8.5 milyona kadar",
  },
  // ── v3.22: bütçesi yazılmamış talep — skor en fazla ~65 (fiyat karşılaştırılamaz) ──
  {
    oid: "T15", gunOnce: 2, tip: "TALEP", mulkTipi: "DAIRE", islemTipi: "SATILIK", minM2: 120, odaSayisi: "3+1",
    ilanSahibiTipi: "BILINMIYOR", musteriKaynagi: "REFERANS", lokasyonHam: "Konyaaltı", gondeAdi: "Referans müşteri (örnek)", gondeTelefon: "+905550000215",
    baslik: "Konyaaltı 3+1 daire — bütçe yazmamış", hamMetin: "Konyaaltı'nda 3+1 en az 120 m2 daire bakıyoruz",
  },
];