/**
 * Anahtar CRM v3.22.2 · 10 Ekim 2026
 * Demo için iki örnek WhatsApp dışa aktarım dosyası (kurgusal kişiler) ve bu mesajlar için
 * hazır yapay zekâ çıktıları. Yapay zekâ kullanılamayan görünümlerde içe aktarma akışını
 * uçtan uca denemek için kullanılır. Gerçek dosyalarda ayrıştırmayı yapay zekâ yapar.
 */
import { metinParmakIzi } from "../src/lib/ingest/whatsapp";

export const ORNEK_SOHBETLER: { dosya: string; icerik: string }[] = [
  {
    dosya: "WhatsApp Sohbeti - EMLAK BORSASI (örnek).txt",
    icerik: `28.09.2026 08:55 - Mesajlar ve aramalar uçtan uca şifrelidir. Bu sohbetin dışında kalan hiç kimse, WhatsApp bile, bunları okuyamaz veya dinleyemez.
28.09.2026 09:02 - Selim Y.: Günaydın
28.09.2026 09:14 - Selim Y.: Konyaaltı Liman'da 2+1 satılık daire, 90 m2, 3. kat, 8 yaşında, kombili, site içinde havuzlu. Krediye uygun. 5.450.000 TL
28.09.2026 09:31 - Nur Emlak: ACİL müşterim var. Lara tarafında 3+1 kiralık daire, eşyasız, asansörlü olsun. 45 bine kadar
28.09.2026 09:40 - +90 532 555 01 01: <Medya dahil edilmedi>
28.09.2026 10:05 - Kaan D.: Cender otel arkasında 140 m2 köşe dükkan kiralıktır, 10 metre vitrin. Aylık 120.000
28.09.2026 10:22 - Selim Y.: Teşekkürler
28.09.2026 11:10 - Burcu A.: Kepez Yeni Sanayi'de 500 m2 imalathane kiralık, sanayi elektriği var, 6 metre yükseklik, kamyon girer. 65 bin
28.09.2026 11:48 - Nur Emlak: Bu mesaj silindi
29.09.2026 09:20 - Kaan D.: Muratpaşa Şirinyalı'da 4+1 dubleks satılık, 220 m2, deniz manzaralı, 2 kapalı otopark. 14.750.000
29.09.2026 10:02 - Ferhat G.: Yatırımcı için Aksu veya Serik'te 20 dönüm tarla aranıyor, 30 milyona kadar
29.09.2026 12:15 - Burcu A.: Kepez Yeni Sanayi civarında 300-400 m2 atölye arayan müşterim var, 50 bine kadar kira`,
  },
  {
    dosya: "WhatsApp Sohbeti - ANTALYA SANAYİ EMLAK (örnek).txt",
    icerik: `[29.09.2026 08:30:12] Levent Ş.: Günaydın arkadaşlar
[29.09.2026 08:41:55] Levent Ş.: Döşemealtı OSB'de 3000 m2 kapalı fabrika satılık, 8 metre makas altı, 10 ton vinç, 630 kva trafo, ruhsatlı. 55 milyon
[29.09.2026 09:05:03] Burcu A.: Kepez Yeni Sanayi'de 500 m2 imalathane kiralık, sanayi elektriği var, 6 metre yükseklik, kamyon girer. 65 bin
[29.09.2026 09:30:44] Oya T.: Lojistik firması için Kepez veya Yeni Sanayi yakınında min 2000 m2 depo arıyoruz, TIR girişi ve rampa şart, 400 bine kadar
[29.09.2026 10:12:30] Levent Ş.: 👍
[29.09.2026 11:20:18] Murat K.: Aksu Kundu'da 1500 m2 soğuk hava deposu kiralık, -20 derece, gıdaya uygun, 280 bin aylık
[29.09.2026 14:02:09] Oya T.: sahibinden araba satılık 2015 model, ilgilenen yazsın`,
  },
];

type AiK = Record<string, any>;
const S: [string, AiK[]][] = [
  ["Konyaaltı Liman'da 2+1 satılık daire", [{ tip: "PORTFOY", mulkTipi: "DAIRE", islemTipi: "SATILIK", fiyat: 5450000, m2: 90, odaSayisi: "2+1", krediyeUygun: true, lokasyonIfadeleri: ["Konyaaltı Liman"], ilanSahibiTipi: "BILINMIYOR", ozet: "Liman 2+1 havuzlu sitede daire", ozellik: { bulunduguKat: 3, binaYasi: 8, isinmaTipi: "DOGALGAZ_KOMBI", siteIcinde: true, havuz: true } }]],
  ["Lara tarafında 3+1 kiralık daire", [{ tip: "TALEP", mulkTipi: "DAIRE", islemTipi: "KIRALIK", aciliyet: "ACIL", maxFiyat: 45000, fiyatPeriyodu: "AYLIK", odaSayisi: "3+1", lokasyonIfadeleri: ["Lara"], ilanSahibiTipi: "EMLAKCI", firma: "Nur Emlak", ozet: "Lara 3+1 eşyasız kiralık", ozellik: { esyaDurumu: "ESYASIZ", asansor: true, kritikKriterler: ["ODA_SAYISI"], eksikBilgiler: ["KAT"] } }]],
  ["Cender otel arkasında 140 m2 köşe dükkan", [{ tip: "PORTFOY", mulkTipi: "DUKKAN_MAGAZA", islemTipi: "KIRALIK", fiyat: 120000, fiyatPeriyodu: "AYLIK", m2: 140, lokasyonIfadeleri: ["Cender otel arkası"], ilanSahibiTipi: "BILINMIYOR", ozet: "Cender Otel arkası 140 m² köşe dükkan", ozellik: { koseKonum: true, vitrin: true, cepheUzunluguM: 10 } }]],
  ["Kepez Yeni Sanayi'de 500 m2 imalathane", [{ tip: "PORTFOY", mulkTipi: "IMALATHANE", islemTipi: "KIRALIK", fiyat: 65000, fiyatPeriyodu: "AYLIK", m2: 500, lokasyonIfadeleri: ["Kepez", "Yeni Sanayi"], ilanSahibiTipi: "BILINMIYOR", ozet: "Yeni Sanayi 500 m² imalathane", ozellik: { kapaliAlanM2: 500, sanayiElektrigi: true, netYukseklikM: 6, aracErisimi: "KAMYON" } }]],
  ["Şirinyalı'da 4+1 dubleks", [{ tip: "PORTFOY", mulkTipi: "DAIRE", islemTipi: "SATILIK", fiyat: 14750000, m2: 220, odaSayisi: "4+1", lokasyonIfadeleri: ["Muratpaşa Şirinyalı"], ilanSahibiTipi: "BILINMIYOR", ozet: "Şirinyalı 4+1 deniz manzaralı dubleks", ozellik: { dubleks: true, denizManzarasi: true, otoparkDurumu: "KAPALI" } }]],
  ["20 dönüm tarla aranıyor", [{ tip: "TALEP", mulkTipi: "TARLA", alternatifMulkTipleri: ["ARSA"], islemTipi: "SATILIK", minM2: 20000, maxFiyat: 30000000, lokasyonIfadeleri: ["Aksu", "Serik"], ilanSahibiTipi: "BILINMIYOR", ozet: "Aksu/Serik 20 dönüm tarla (yatırım)", ozellik: { kullanimAmaclari: ["YATIRIM_KIRA_GELIRI"], eksikBilgiler: ["IMAR"] } }]],
  ["300-400 m2 atölye arayan", [{ tip: "TALEP", mulkTipi: "ATOLYE", alternatifMulkTipleri: ["IMALATHANE"], islemTipi: "KIRALIK", minM2: 300, maxM2: 400, maxFiyat: 50000, fiyatPeriyodu: "AYLIK", lokasyonIfadeleri: ["Kepez Yeni Sanayi civarı"], ilanSahibiTipi: "EMLAKCI", ozet: "Yeni Sanayi civarı 300–400 m² atölye", ozellik: { eksikBilgiler: ["ELEKTRIK", "YUKSEKLIK"] } }]],
  ["Döşemealtı OSB'de 3000 m2 kapalı fabrika", [{ tip: "PORTFOY", mulkTipi: "FABRIKA_URETIM_TESISI", islemTipi: "SATILIK", fiyat: 55000000, m2: 3000, lokasyonIfadeleri: ["Döşemealtı", "OSB"], ilanSahibiTipi: "BILINMIYOR", ozet: "OSB 3000 m² vinçli ruhsatlı fabrika", ozellik: { kapaliAlanM2: 3000, makasAltiYukseklikM: 8, vincKapasitesiTon: 10, trafoGucuKva: 630, ruhsatDurumu: "RUHSATLI", osbIcinde: true } }]],
  ["Lojistik firması için Kepez veya Yeni Sanayi", [{ tip: "TALEP", mulkTipi: "DEPO_ANTREPO", alternatifMulkTipleri: ["LOJISTIK_MERKEZI"], islemTipi: "KIRALIK", minM2: 2000, maxFiyat: 400000, fiyatPeriyodu: "AYLIK", lokasyonIfadeleri: ["Kepez", "Yeni Sanayi yakını"], ilanSahibiTipi: "FIRMA", ozet: "Kepez 2000+ m² TIR'lı rampalı depo", ozellik: { aracErisimi: "TIR", rampa: true, kullanimAmaclari: ["LOJISTIK_DAGITIM"], kritikKriterler: ["ARAC_ERISIMI", "RAMPA"], eksikBilgiler: ["YUKSEKLIK", "ELEKTRIK"] } }]],
  ["Aksu Kundu'da 1500 m2 soğuk hava deposu", [{ tip: "PORTFOY", mulkTipi: "SOGUK_HAVA_DEPOSU", islemTipi: "KIRALIK", fiyat: 280000, fiyatPeriyodu: "AYLIK", m2: 1500, lokasyonIfadeleri: ["Aksu Kundu"], ilanSahibiTipi: "BILINMIYOR", ozet: "Kundu 1500 m² soğuk hava deposu", ozellik: { sogukHava: true, sogukHavaM2: 1500, sogukHavaMinC: -20, gidayaUygun: true } }]],
];

/** Mesaj metnine göre hazır yapay zekâ çıktısı (yoksa boş = kayıt çıkmadı) */
export function hazirAiSonucu(metin: string): AiK[] {
  const pi = metinParmakIzi(metin);
  return S.find(([k]) => pi.includes(metinParmakIzi(k)))?.[1] ?? [];
}