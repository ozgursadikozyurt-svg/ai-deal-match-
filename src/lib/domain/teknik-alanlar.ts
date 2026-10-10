/**
 * Anahtar CRM v3.24 · 10 Ekim 2026
 * MulkOzellik kolonlarının meta sözlüğü.
 * - UI form/filtre bileşenleri, Gemini çıktı şeması ve eşleştirme motoru buradan beslenir.
 * - `karsilastirma`: talep ↔ portföy kıyas yönü
 *     "min"   → portföy değeri ≥ talep değeri olmalı (elektrik, yükseklik…)
 *     "max"   → portföy değeri ≤ talep değeri olmalı (bina yaşı, mesafe…)
 *     "bool"  → talep true ise portföy true olmalı
 *     "sirali"→ enum sırasına göre ≥ (AracErisimi)
 *     "esit"  → aynı değer olmalı (imar, ısınma tipi…)
 *     "kume"  → talep kümesinden biri portföyde olmalı (kullanım amacı, cephe yönü)
 *     "bilgi" → skora girmez, sadece gösterim
 * - `gruplar`: alanın hangi mülk gruplarında anlamlı olduğu. v3.3'ten itibaren HER alanda açıkça yazılıdır
 *   (v3.2'de boş = hepsi idi; bu yüzden "Yalı" formunda trafo / sanayi elektriği görünüyordu).
 * - `formda: false`: formda ayrı alan olarak gösterilmez (ör. kVA — elektrik alanındaki birim seçiciyle girilir).
 */
import type { TeknikAlan } from "../../generated/prisma/enums";
import type { MulkGrubu } from "./kategori";

export type Karsilastirma = "min" | "max" | "bool" | "sirali" | "esit" | "kume" | "bilgi";

export interface AlanMeta {
  etiket: string;
  birim?: string;
  grup: string;
  karsilastirma: Karsilastirma;
  /** Eşleştirmede hangi TeknikAlan kriterine sayılır (öldürücü/esnek/eksik bilgi) */
  kriter?: TeknikAlan;
  /** Hangi mülk gruplarında anlamlı */
  gruplar: readonly MulkGrubu[];
  formda?: false;
}

// Mülk grubu kısaltmaları
const E = "ENDUSTRIYEL", T = "TICARI", O = "OFIS", H = "HIZMET", K = "KONUT", DM = "DEVRE_MULK", A = "ARSA", B = "BINA", TU = "TURIZM", D = "DIGER";
const TIC = [T, O, H] as const;
const KON = [K, DM] as const;
const HEPSI = [E, T, O, H, K, DM, A, B, TU, D] as const;

export const MULK_OZELLIK_META = {
  // Alanlar
  kapaliAlanM2: { etiket: "Kapalı alan", birim: "m²", grup: "Alan", karsilastirma: "min", kriter: "KAPALI_ALAN", gruplar: [E, ...TIC, B, TU, D] },
  acikAlanM2: { etiket: "Açık alan", birim: "m²", grup: "Alan", karsilastirma: "min", kriter: "ACIK_ALAN", gruplar: [E, T, H, B, TU, D] },
  arsaAlanM2: { etiket: "Arsa alanı", birim: "m²", grup: "Alan", karsilastirma: "min", kriter: "ARSA_ALANI", gruplar: [E, A, B, TU, K, D] },
  sundurmaM2: { etiket: "Sundurma", birim: "m²", grup: "Alan", karsilastirma: "bilgi", gruplar: [E] },
  ofisAlanM2: { etiket: "Ofis alanı", birim: "m²", grup: "Alan", karsilastirma: "bilgi", gruplar: [E] },
  girisKatM2: { etiket: "Giriş kat alanı", birim: "m²", grup: "Alan", karsilastirma: "min", kriter: "ZEMIN_KAT_GIRIS", gruplar: [...TIC] },
  asmaKatM2: { etiket: "Asma kat", birim: "m²", grup: "Alan", karsilastirma: "bilgi", gruplar: [T, H] },
  bodrumM2: { etiket: "Bodrum", birim: "m²", grup: "Alan", karsilastirma: "bilgi", gruplar: [T, H, B] },
  bolunebilir: { etiket: "Bölünebilir", grup: "Alan", karsilastirma: "bool", gruplar: [E, ...TIC, B] },
  minBolumM2: { etiket: "Min. bölüm", birim: "m²", grup: "Alan", karsilastirma: "bilgi", gruplar: [E, ...TIC, B] },

  // Konut (v3.3)
  banyoSayisi: { etiket: "Banyo sayısı", grup: "Konut", karsilastirma: "min", kriter: "BANYO", gruplar: [...KON] },
  isinmaTipi: { etiket: "Isınma", grup: "Konut", karsilastirma: "esit", kriter: "ISINMA", gruplar: [...KON, O, B] },
  esyaDurumu: { etiket: "Eşya", grup: "Konut", karsilastirma: "esit", kriter: "ESYA", gruplar: [...KON, TU] },
  siteIcinde: { etiket: "Site içinde", grup: "Konut", karsilastirma: "bool", kriter: "SITE_GUVENLIK", gruplar: [...KON] },
  guvenlik: { etiket: "Güvenlik", grup: "Konut", karsilastirma: "bool", kriter: "SITE_GUVENLIK", gruplar: [...KON, O, B] },
  balkon: { etiket: "Balkon", grup: "Konut", karsilastirma: "bool", kriter: "BALKON_BAHCE", gruplar: [...KON] },
  teras: { etiket: "Teras", grup: "Konut", karsilastirma: "bool", kriter: "BALKON_BAHCE", gruplar: [...KON, TU] },
  bahce: { etiket: "Bahçe", grup: "Konut", karsilastirma: "bool", kriter: "BALKON_BAHCE", gruplar: [...KON, TU] },
  dubleks: { etiket: "Dubleks", grup: "Konut", karsilastirma: "bool", gruplar: [...KON] },
  ebeveynBanyosu: { etiket: "Ebeveyn banyosu", grup: "Konut", karsilastirma: "bool", gruplar: [...KON] },
  cepheYonleri: { etiket: "Cephe yönü", grup: "Konut", karsilastirma: "kume", kriter: "CEPHE_YON", gruplar: [...KON, O] },
  denizManzarasi: { etiket: "Deniz manzarası", grup: "Konut", karsilastirma: "bool", kriter: "MANZARA", gruplar: [...KON, TU, O] },
  engelliErisimi: { etiket: "Engelli erişimi", grup: "Konut", karsilastirma: "bool", gruplar: [...KON, ...TIC, B, TU] },

  // Yükseklik / erişim
  netYukseklikM: { etiket: "Net yükseklik", birim: "m", grup: "Yükseklik & Erişim", karsilastirma: "min", kriter: "YUKSEKLIK", gruplar: [E] },
  makasAltiYukseklikM: { etiket: "Makas altı yükseklik", birim: "m", grup: "Yükseklik & Erişim", karsilastirma: "min", kriter: "YUKSEKLIK", gruplar: [E] },
  kapiSayisi: { etiket: "Kapı sayısı", grup: "Yükseklik & Erişim", karsilastirma: "min", kriter: "KAPI", gruplar: [E] },
  kapiGenislikM: { etiket: "Kapı genişliği", birim: "m", grup: "Yükseklik & Erişim", karsilastirma: "min", kriter: "KAPI", gruplar: [E] },
  kapiYukseklikM: { etiket: "Kapı yüksekliği", birim: "m", grup: "Yükseklik & Erişim", karsilastirma: "min", kriter: "KAPI", gruplar: [E] },
  otomatikKapi: { etiket: "Otomatik kapı", grup: "Yükseklik & Erişim", karsilastirma: "bool", gruplar: [E] },
  aracErisimi: { etiket: "Araç erişimi (en büyük)", grup: "Yükseklik & Erişim", karsilastirma: "sirali", kriter: "ARAC_ERISIMI", gruplar: [E] },
  tirManevraAlani: { etiket: "TIR manevra alanı", grup: "Yükseklik & Erişim", karsilastirma: "bool", kriter: "ARAC_ERISIMI", gruplar: [E] },
  rampa: { etiket: "Yükleme rampası", grup: "Yükseklik & Erişim", karsilastirma: "bool", kriter: "RAMPA", gruplar: [E] },
  rampaSayisi: { etiket: "Rampa sayısı", grup: "Yükseklik & Erişim", karsilastirma: "min", kriter: "RAMPA", gruplar: [E] },
  vinc: { etiket: "Vinç", grup: "Yükseklik & Erişim", karsilastirma: "bool", kriter: "VINC", gruplar: [E] },
  vincKapasitesiTon: { etiket: "Vinç kapasitesi", birim: "ton", grup: "Yükseklik & Erişim", karsilastirma: "min", kriter: "VINC", gruplar: [E] },
  yukAsansoru: { etiket: "Yük asansörü", grup: "Yükseklik & Erişim", karsilastirma: "bool", gruplar: [E, T, B] },

  // Enerji
  elektrikGucuKw: { etiket: "Elektrik gücü", birim: "kW", grup: "Enerji", karsilastirma: "min", kriter: "ELEKTRIK", gruplar: [E, T, H, TU, D] },
  elektrikGucuKva: { etiket: "Elektrik gücü (ilandaki kVA)", birim: "kVA", grup: "Enerji", karsilastirma: "bilgi", gruplar: [E, T, H, TU, D], formda: false },
  elektrikGucuHam: { etiket: "Elektrik (ilandaki ifade)", grup: "Enerji", karsilastirma: "bilgi", gruplar: [E, T, H, TU, D], formda: false },
  trafo: { etiket: "Trafo", grup: "Enerji", karsilastirma: "bool", kriter: "TRAFO", gruplar: [E, TU] },
  trafoGucuKva: { etiket: "Trafo gücü", birim: "kVA", grup: "Enerji", karsilastirma: "min", kriter: "TRAFO", gruplar: [E] },
  sanayiElektrigi: { etiket: "Sanayi elektriği", grup: "Enerji", karsilastirma: "bool", kriter: "SANAYI_ELEKTRIGI", gruplar: [E, T] },
  jenerator: { etiket: "Jeneratör", grup: "Enerji", karsilastirma: "bool", gruplar: [E, T, H, TU, B] },

  // Yangın
  yanginSistemi: { etiket: "Yangın söndürme sistemi", grup: "Yangın & Güvenlik", karsilastirma: "bool", kriter: "YANGIN_SISTEMI", gruplar: [E, ...TIC, TU, B] },
  sprinkler: { etiket: "Sprinkler", grup: "Yangın & Güvenlik", karsilastirma: "bool", kriter: "SPRINKLER", gruplar: [E, T, TU] },
  yanginAlgilama: { etiket: "Yangın algılama", grup: "Yangın & Güvenlik", karsilastirma: "bool", kriter: "YANGIN_SISTEMI", gruplar: [E, ...TIC, TU, B] },
  paratoner: { etiket: "Paratoner", grup: "Yangın & Güvenlik", karsilastirma: "bool", gruplar: [E] },

  // Hukuki
  iskan: { etiket: "İskan", grup: "Hukuki", karsilastirma: "bool", kriter: "ISKAN", gruplar: [...KON, E, ...TIC, B, TU] },
  ruhsatDurumu: { etiket: "Ruhsat durumu", grup: "Hukuki", karsilastirma: "sirali", kriter: "RUHSAT", gruplar: [E, ...TIC, B, TU] },
  isyeriAcmaRuhsati: { etiket: "İşyeri açma ruhsatı", grup: "Hukuki", karsilastirma: "bool", kriter: "RUHSAT", gruplar: [E, ...TIC] },
  numarataj: { etiket: "Numarataj", grup: "Hukuki", karsilastirma: "bool", gruplar: [E, ...TIC] },
  tapuTipi: { etiket: "Tapu tipi", grup: "Hukuki", karsilastirma: "bilgi", gruplar: HEPSI },
  imarDurumu: { etiket: "İmar durumu", grup: "Hukuki", karsilastirma: "esit", kriter: "IMAR", gruplar: [A] },
  adaNo: { etiket: "Ada", grup: "Hukuki", karsilastirma: "bilgi", gruplar: [A, E, B] },
  parselNo: { etiket: "Parsel", grup: "Hukuki", karsilastirma: "bilgi", gruplar: [A, E, B] },
  emsalKaks: { etiket: "Emsal (KAKS)", grup: "Hukuki", karsilastirma: "min", kriter: "IMAR", gruplar: [A] },
  taks: { etiket: "TAKS", grup: "Hukuki", karsilastirma: "bilgi", gruplar: [A] },

  // İklim
  sogukHava: { etiket: "Soğuk hava", grup: "İklim & Gıda", karsilastirma: "bool", kriter: "SOGUK_HAVA", gruplar: [E] },
  sogukHavaM2: { etiket: "Soğuk hava alanı", birim: "m²", grup: "İklim & Gıda", karsilastirma: "min", kriter: "SOGUK_HAVA", gruplar: [E] },
  sogukHavaMinC: { etiket: "Soğuk hava min.", birim: "°C", grup: "İklim & Gıda", karsilastirma: "bilgi", gruplar: [E] },
  sogukHavaMaxC: { etiket: "Soğuk hava maks.", birim: "°C", grup: "İklim & Gıda", karsilastirma: "bilgi", gruplar: [E] },
  iklimlendirme: { etiket: "İklimlendirme", grup: "İklim & Gıda", karsilastirma: "bool", gruplar: [E, ...TIC, B, TU] },
  havalandirma: { etiket: "Havalandırma", grup: "İklim & Gıda", karsilastirma: "bool", gruplar: [E, T, H] },
  gidayaUygun: { etiket: "Gıdaya uygun", grup: "İklim & Gıda", karsilastirma: "bool", kriter: "GIDAYA_UYGUNLUK", gruplar: [E, T] },

  // Yapı
  yapiSistemi: { etiket: "Yapı sistemi", grup: "Yapı", karsilastirma: "bilgi", gruplar: [E, B] },
  catiTipi: { etiket: "Çatı", grup: "Yapı", karsilastirma: "esit", kriter: "CATI_DUVAR", gruplar: [E] },
  duvarTipi: { etiket: "Duvar", grup: "Yapı", karsilastirma: "esit", kriter: "CATI_DUVAR", gruplar: [E] },
  zeminTipi: { etiket: "Zemin", grup: "Yapı", karsilastirma: "bilgi", gruplar: [E, T] },
  zeminYukTasimaTonM2: { etiket: "Zemin yük taşıma", birim: "ton/m²", grup: "Yapı", karsilastirma: "min", gruplar: [E] },
  binaYasi: { etiket: "Bina yaşı", grup: "Yapı", karsilastirma: "max", kriter: "BINA_YASI", gruplar: [...KON, E, ...TIC, B, TU] },
  katSayisi: { etiket: "Binanın kat sayısı", grup: "Yapı", karsilastirma: "bilgi", gruplar: [...KON, ...TIC, B, TU] },
  bulunduguKat: { etiket: "Bulunduğu kat", grup: "Yapı", karsilastirma: "bilgi", kriter: "KAT", gruplar: [...KON, ...TIC] },
  istenenKatlar: { etiket: "İstenen kat(lar)", grup: "Yapı", karsilastirma: "bilgi", kriter: "KAT", gruplar: [...KON, ...TIC] },

  // Sosyal
  ofis: { etiket: "Ofis", grup: "Sosyal alanlar", karsilastirma: "bool", kriter: "OFIS_SOSYAL", gruplar: [E] },
  ofisOdaSayisi: { etiket: "Ofis oda sayısı", grup: "Sosyal alanlar", karsilastirma: "min", kriter: "OFIS_SOSYAL", gruplar: [E, O] },
  wc: { etiket: "WC", grup: "Sosyal alanlar", karsilastirma: "bool", gruplar: [E, ...TIC] },
  wcSayisi: { etiket: "WC sayısı", grup: "Sosyal alanlar", karsilastirma: "min", gruplar: [E, ...TIC] },
  mutfak: { etiket: "Mutfak", grup: "Sosyal alanlar", karsilastirma: "bool", gruplar: [E, ...TIC] },
  personelAlani: { etiket: "Personel alanı", grup: "Sosyal alanlar", karsilastirma: "bool", gruplar: [E, T, H, TU] },
  sundurma: { etiket: "Sundurma", grup: "Sosyal alanlar", karsilastirma: "bool", gruplar: [E] },
  sondaj: { etiket: "Sondaj suyu", grup: "Sosyal alanlar", karsilastirma: "bool", gruplar: [E, A, TU] },

  // Perakende
  cepheUzunluguM: { etiket: "Cephe uzunluğu", birim: "m", grup: "Cephe & Trafik", karsilastirma: "min", kriter: "CEPHE_VITRIN", gruplar: [T, H] },
  cepheSayisi: { etiket: "Cephe sayısı", grup: "Cephe & Trafik", karsilastirma: "min", kriter: "CEPHE_VITRIN", gruplar: [T, H] },
  vitrin: { etiket: "Vitrin", grup: "Cephe & Trafik", karsilastirma: "bool", kriter: "CEPHE_VITRIN", gruplar: [T, H] },
  koseKonum: { etiket: "Köşe", grup: "Cephe & Trafik", karsilastirma: "bool", kriter: "CEPHE_VITRIN", gruplar: [T, H] },
  anaCaddeUzeri: { etiket: "Ana cadde üzeri", grup: "Cephe & Trafik", karsilastirma: "bool", kriter: "CEPHE_VITRIN", gruplar: [...TIC, A, B, TU] },
  duzGiris: { etiket: "Düz giriş", grup: "Cephe & Trafik", karsilastirma: "bool", kriter: "ZEMIN_KAT_GIRIS", gruplar: [T, H] },
  asmaKat: { etiket: "Asma kat", grup: "Cephe & Trafik", karsilastirma: "bilgi", gruplar: [T, H] },
  bodrum: { etiket: "Bodrum", grup: "Cephe & Trafik", karsilastirma: "bilgi", gruplar: [T, H, K] },
  baca: { etiket: "Baca", grup: "Cephe & Trafik", karsilastirma: "bool", gruplar: [T, H] },
  asansor: { etiket: "Asansör", grup: "Cephe & Trafik", karsilastirma: "bool", gruplar: [...KON, ...TIC, B, TU] },
  otoparkDurumu: { etiket: "Otopark", grup: "Cephe & Trafik", karsilastirma: "bool", kriter: "OTOPARK", gruplar: [...KON, E, ...TIC, B, TU] },
  otoparkKapasitesi: { etiket: "Otopark kapasitesi", grup: "Cephe & Trafik", karsilastirma: "min", kriter: "OTOPARK", gruplar: [E, ...TIC, B, TU] },
  yayaTrafigi: { etiket: "Yaya trafiği", grup: "Cephe & Trafik", karsilastirma: "sirali", kriter: "YAYA_TRAFIGI", gruplar: [T, H] },
  aracTrafigi: { etiket: "Araç trafiği", grup: "Cephe & Trafik", karsilastirma: "sirali", kriter: "ARAC_TRAFIGI", gruplar: [T, H, A] },

  // Erişilebilirlik
  anaYolaMesafeM: { etiket: "Ana yola mesafe", birim: "m", grup: "Konum avantajı", karsilastirma: "max", gruplar: [E, A, T, TU] },
  cevreYolunaMesafeM: { etiket: "Çevre yoluna mesafe", birim: "m", grup: "Konum avantajı", karsilastirma: "max", gruplar: [E, A] },
  havalimaninaMesafeM: { etiket: "Havalimanına mesafe", birim: "m", grup: "Konum avantajı", karsilastirma: "max", gruplar: [E, TU] },
  limanaMesafeM: { etiket: "Limana mesafe", birim: "m", grup: "Konum avantajı", karsilastirma: "max", gruplar: [E] },
  denizeMesafeM: { etiket: "Denize mesafe", birim: "m", grup: "Konum avantajı", karsilastirma: "max", gruplar: [...KON, TU, A] },
  osbIcinde: { etiket: "OSB içinde", grup: "Konum avantajı", karsilastirma: "bool", gruplar: [E, A] },

  kullanimAmaclari: { etiket: "Kullanım amacı", grup: "Kullanım", karsilastirma: "kume", kriter: "KULLANIM_AMACI", gruplar: [E, ...TIC, A, B, TU, D] },

  // Turizm
  otelOdaSayisi: { etiket: "Oda sayısı (otel)", grup: "Turizm", karsilastirma: "min", gruplar: [TU] },
  yatakKapasitesi: { etiket: "Yatak kapasitesi", grup: "Turizm", karsilastirma: "min", gruplar: [TU] },
  yildiz: { etiket: "Yıldız", grup: "Turizm", karsilastirma: "min", gruplar: [TU] },
  turizmBelgesi: { etiket: "Turizm belgesi", grup: "Turizm", karsilastirma: "bilgi", gruplar: [TU] },
  havuz: { etiket: "Havuz", grup: "Turizm", karsilastirma: "bool", gruplar: [...KON, TU] },

  // Kira / devir
  kiraOdemeSekli: { etiket: "Kira ödeme şekli", grup: "Kira & Devir", karsilastirma: "bilgi", gruplar: [E, ...TIC, ...KON, B] },
  depozitoAy: { etiket: "Depozito", birim: "ay", grup: "Kira & Devir", karsilastirma: "bilgi", gruplar: [E, ...TIC, ...KON] },
  minKiraSuresiYil: { etiket: "Kira süresi", birim: "yıl", grup: "Kira & Devir", karsilastirma: "bilgi", kriter: "KIRA_SURESI", gruplar: [E, ...TIC, TU] },
  bosalmaTarihi: { etiket: "Boşalma tarihi", grup: "Kira & Devir", karsilastirma: "bilgi", gruplar: [E, ...TIC, ...KON] },
  kiracili: { etiket: "Kiracılı", grup: "Kira & Devir", karsilastirma: "bool", gruplar: [E, ...TIC, ...KON, B] },
  mevcutKiraGeliri: { etiket: "Mevcut kira geliri", birim: "TL", grup: "Kira & Devir", karsilastirma: "bilgi", gruplar: [E, ...TIC, ...KON, B, TU] },
  devirBedeli: { etiket: "Devir bedeli", birim: "TL", grup: "Kira & Devir", karsilastirma: "max", gruplar: [T, H, TU] },
  aidat: { etiket: "Aidat", birim: "TL", grup: "Kira & Devir", karsilastirma: "bilgi", gruplar: [...KON, O, T] },
} as const satisfies Record<string, AlanMeta>;

export type MulkOzellikAlani = keyof typeof MULK_OZELLIK_META;

/** Bir alan bu mülk grubunda anlamlı mı? */
export const alanGruptaMi = (alan: MulkOzellikAlani, grup: MulkGrubu) => (MULK_OZELLIK_META[alan].gruplar as readonly string[]).includes(grup);

/** kVA → kW dönüşümü (güç faktörü varsayımı). Ticari ilanlarda "kW/kVA" sıkça karıştırılır. */
export const GUC_FAKTORU = 0.8;
export function kvaToKw(kva: number): number {
  return Math.round(kva * GUC_FAKTORU * 10) / 10;
}

/** Sıralı enum'lar için karşılaştırma sırası (düşük → yüksek) */
export const SIRALAMA = {
  aracErisimi: ["YOK", "BINEK", "PANELVAN", "KAMYONET", "KAMYON", "TIR"],
  // Ruhsatlı > Yapı Kayıtlı > İnşaat halinde > Kayıtsız
  ruhsatDurumu: ["KAYITSIZ", "INSAAT_HALINDE", "YAPI_KAYITLI", "RUHSATLI"],
  yayaTrafigi: ["DUSUK", "ORTA", "YUKSEK", "COK_YUKSEK"],
  aracTrafigi: ["DUSUK", "ORTA", "YUKSEK", "COK_YUKSEK"],
} as const;

/** "3+1" → { oda: 3, salon: 1 }; "5 oda ofis" → { oda: 5 }; "stüdyo / 1+0" → { oda: 1, salon: 0 } */
export function odaSayisiAyristir(s?: string | null): { oda: number; salon?: number } | null {
  if (!s) return null;
  const t = s.toLocaleLowerCase("tr");
  if (/st[uü]dyo/.test(t)) return { oda: 1, salon: 0 };
  const m = t.match(/(\d+)\s*\+\s*(\d+)/);
  if (m) return { oda: Number(m[1]), salon: Number(m[2]) };
  const n = t.match(/(\d+)\s*oda/);
  return n ? { oda: Number(n[1]) } : null;
}
/**
 * v3.19 — talepte oda sayısı çoklu seçimdir ("2+1, 3+1"); veritabanında virgülle ayrılmış metin olarak saklanır
 * (şema değişmez). Tek değerli eski kayıtlar da aynen okunur.
 */
export function odaListesi(s?: string | null): { etiket: string; oda: number; salon?: number }[] {
  if (!s) return [];
  return s.split(/[,;|]|\s+(?:veya|ya da)\s+/i).map((x) => x.trim()).filter(Boolean)
    .map((x) => { const r = odaSayisiAyristir(x); return r ? { etiket: x.replace(/\s+/g, ""), ...r } : null; })
    .filter((x): x is { etiket: string; oda: number; salon?: number } => !!x);
}
export const odaYaz = (liste: readonly string[]): string => liste.join(", ");
/** Oda farkına göre kısmi puan: tam 1 · bir oda fazla `fazla1` · iki+ fazla `fazla2` · eksik 0 */
export function odaFarkPuani(fark: number, fazla1: number, fazla2: number): number {
  return fark === 0 ? 1 : fark === 1 ? fazla1 : fark >= 2 ? fazla2 : 0;
}
// ───────────────────────── v3.15 — çoklu kat seçimi ─────────────────────────
/** Talepte seçilebilen katlar: "-1" bodrum, "0" giriş/zemin, "1"…"10", "ARA" (ara kat), "SON" (son kat). */
export const KAT_SECENEKLERI: readonly (readonly [string, string])[] = [
  ["-1", "Bodrum"], ["0", "Giriş / Zemin"],
  ...Array.from({ length: 10 }, (_, i) => [String(i + 1), `${i + 1}. kat`] as const),
  ["ARA", "Ara kat"], ["SON", "Son kat"],
];
export const katYaz = (a: readonly string[]): string => a.map((x) => KAT_SECENEKLERI.find(([k]) => k === x)?.[1] ?? `${x}. kat`).join(", ");
/**
 * Talepteki kat seçeneklerinden biri portföyün katına uyuyor mu?
 *  - Sayılar: aynı kat. "ARA": 1 ≤ kat < binanın kat sayısı. "SON": kat = binanın kat sayısı.
 *  - Portföyün katı bilinmiyorsa (ya da ARA/SON isteniyor ama bina kat sayısı yoksa) → BILINMIYOR.
 */
export function katUyumu(istenen: readonly string[], kat?: number | null, katSayisi?: number | null): "SAGLANDI" | "SAGLANMADI" | "BILINMIYOR" {
  if (!istenen.length) return "SAGLANDI";
  if (kat == null) return "BILINMIYOR";
  if (istenen.some((x) => x !== "ARA" && x !== "SON" && Number(x) === kat)) return "SAGLANDI";
  const goreli = istenen.filter((x) => x === "ARA" || x === "SON");
  if (!goreli.length) return "SAGLANMADI";
  if (katSayisi == null) return "BILINMIYOR";
  return goreli.some((x) => (x === "ARA" ? kat >= 1 && kat < katSayisi : kat === katSayisi)) ? "SAGLANDI" : "SAGLANMADI";
}
/** Talepten istenen katları okur: yeni çoklu alan, yoksa eski tek değerli bulunduguKat. */
export const istenenKatlarOf = (o?: Record<string, unknown> | null): string[] => {
  const c = o?.istenenKatlar as string[] | undefined;
  if (c?.length) return c;
  return typeof o?.bulunduguKat === "number" ? [String(o.bulunduguKat)] : [];
};
