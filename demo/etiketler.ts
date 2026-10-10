/**
 * Anahtar CRM v3.23 · 10 Ekim 2026
 * Ekranda gösterilen Türkçe etiketler. Ana kategori / mülk tipi / işlem / ilan sahibi etiketleri
 * src/lib/domain/kategori.ts'den gelir; burada sadece teknik enum değerleri var.
 * Burada olmayan bir değer eklenirse ekran onu otomatik "Büyük Harf" biçimiyle gösterir.
 */
import { ANA_KATEGORI_ETIKET, ISLEM_TIPI_ETIKET, ILAN_SAHIBI_ETIKET, VERI_KANALI_ETIKET, MULK_TIPI_META, MUSTERI_KAYNAGI_ETIKET, HAVUZ_ETIKET, PORTFOY_ALINABILIRLIK_ETIKET } from "../src/lib/domain/kategori";

const E: Record<string, string> = {
  // Araç erişimi
  YOK: "Yok", BINEK: "Binek", PANELVAN: "Panelvan", KAMYONET: "Kamyonet", KAMYON: "Kamyon", TIR: "TIR",
  // Ruhsat
  RUHSATLI: "Ruhsatlı", YAPI_KAYITLI: "Yapı kayıtlı", KAYITSIZ: "Kayıtsız", INSAAT_HALINDE: "İnşaat hâlinde",
  // Tapu
  KAT_MULKIYETI: "Kat mülkiyeti", KAT_IRTIFAKI: "Kat irtifakı", MUSTAKIL_PARSEL: "Müstakil parsel", HISSELI: "Hisseli", ARSA_TAPULU: "Arsa tapulu", KOOPERATIF: "Kooperatif", TAHSIS: "Tahsis",
  // İmar
  KONUT: "Konut", TICARI: "Ticari", TICARI_KONUT: "Ticari + konut", SANAYI: "Sanayi", DEPO_ANTREPO: "Depo / antrepo", TURIZM: "Turizm", TURIZM_KONUT: "Turizm + konut", TURIZM_TICARI: "Turizm + ticari", TARLA: "Tarla", BAG_BAHCE: "Bağ / bahçe", ZEYTINLIK: "Zeytinlik", SERA: "Sera", EGITIM: "Eğitim", SAGLIK: "Sağlık", ENERJI: "Enerji", OZEL_KULLANIM: "Özel kullanım", SIT_ALANI: "Sit alanı", IMARSIZ: "İmarsız", DIGER: "Diğer",
  // Yapı
  CELIK_KONSTRUKSIYON: "Çelik konstrüksiyon", BETONARME: "Betonarme", PREFABRIK: "Prefabrik", YIGMA: "Yığma", KARMA: "Karma",
  SANDVIC_PANEL: "Sandviç panel", TRAPEZ_SAC: "Trapez sac", YALITIMLI_TRAPEZ: "Yalıtımlı trapez", BETON: "Beton", TUGLA_BRIKET: "Tuğla / briket",
  HELIKOPTER_BETON: "Helikopter beton", EPOKSI: "Epoksi", SAHA_BETONU: "Saha betonu", SERAMIK_KAROLAJ: "Seramik / karolaj", TOPRAK: "Toprak",
  // Otopark / trafik
  ACIK: "Açık", KAPALI: "Kapalı", ACIK_VE_KAPALI: "Açık ve kapalı", CADDE_USTU: "Cadde üstü",
  DUSUK: "Düşük", ORTA: "Orta", YUKSEK: "Yüksek", COK_YUKSEK: "Çok yüksek",
  // Kullanım amacı
  DEPOLAMA: "Depolama", LOJISTIK_DAGITIM: "Lojistik / dağıtım", URETIM: "Üretim", GIDA_URETIM: "Gıda üretimi", GIDA_DEPOLAMA: "Gıda depolama", SOGUK_ZINCIR: "Soğuk zincir", E_TICARET: "E-ticaret", SHOWROOM: "Showroom", PERAKENDE: "Perakende", MARKET: "Market", RESTORAN_KAFE: "Restoran / kafe", OFIS: "Ofis", BANKA_SUBE: "Banka şubesi", SPOR: "Spor", OTO_SERVIS: "Oto servis", KONAKLAMA: "Konaklama", ETKINLIK: "Etkinlik", TARIM: "Tarım", YATIRIM_KIRA_GELIRI: "Yatırım / kira geliri",
  // Turizm belgesi
  BAKANLIK_BELGELI: "Bakanlık belgeli", BELEDIYE_BELGELI: "Belediye belgeli",
  // Kira ödeme
  AYLIK: "Aylık", UC_AYLIK: "3 aylık", ALTI_AYLIK_PESIN: "6 aylık peşin", YILLIK_PESIN: "Yıllık peşin",
  // Fiyat periyodu, para
  TOPLAM: "Toplam", YILLIK: "Yıllık", GUNLUK: "Günlük", TRY: "TL", USD: "USD", EUR: "EUR", GBP: "GBP",
  // Aciliyet, durum
  NORMAL: "Normal", ACIL: "Acil", ACTIVE: "Aktif", PASSIVE: "Pasif", EXPIRED: "Süresi doldu", ARSIV: "Arşiv",
  PORTFOY: "Portföy", TALEP: "Talep",
  // Konut (v3.3)
  DOGALGAZ_KOMBI: "Doğalgaz kombi", MERKEZI: "Merkezi", MERKEZI_PAY_OLCER: "Merkezi (pay ölçer)", YERDEN_ISITMA: "Yerden ısıtma", KLIMA: "Klima", ISI_POMPASI: "Isı pompası", SOBA: "Soba", GUNES_ENERJISI: "Güneş enerjisi",
  ESYALI: "Eşyalı", YARI_ESYALI: "Yarı eşyalı", ESYASIZ: "Eşyasız",
  KUZEY: "Kuzey", GUNEY: "Güney", DOGU: "Doğu", BATI: "Batı",
  HER_IKISI: "Portföy + talep", GURULTU: "Gürültü",
};

/** Teknik kriter (TeknikAlan) etiketleri — Talep DNA'da */
export const KRITER_ETIKET: Record<string, string> = {
  MULK_TIPI: "Mülk tipi", ISLEM_TIPI: "İşlem tipi", LOKASYON: "Lokasyon", FIYAT: "Fiyat / bütçe", ALAN: "Alan", KAPALI_ALAN: "Kapalı alan", ACIK_ALAN: "Açık alan", ARSA_ALANI: "Arsa alanı", YUKSEKLIK: "Yükseklik", KAPI: "Kapı", ARAC_ERISIMI: "Araç erişimi", RAMPA: "Rampa", VINC: "Vinç", ELEKTRIK: "Elektrik gücü", TRAFO: "Trafo", SANAYI_ELEKTRIGI: "Sanayi elektriği", YANGIN_SISTEMI: "Yangın sistemi", SPRINKLER: "Sprinkler", ISKAN: "İskan", RUHSAT: "Ruhsat", SOGUK_HAVA: "Soğuk hava", GIDAYA_UYGUNLUK: "Gıdaya uygunluk", CATI_DUVAR: "Çatı / duvar", OFIS_SOSYAL: "Ofis / sosyal alan", OTOPARK: "Otopark", YAYA_TRAFIGI: "Yaya trafiği", ARAC_TRAFIGI: "Araç trafiği", CEPHE_VITRIN: "Cephe / vitrin", ZEMIN_KAT_GIRIS: "Zemin kat girişi", KULLANIM_AMACI: "Kullanım amacı", KIRA_SURESI: "Kira süresi", ODA_SAYISI: "Oda sayısı", IMAR: "İmar",
  BANYO: "Banyo sayısı", ISINMA: "Isınma", ESYA: "Eşya", SITE_GUVENLIK: "Site / güvenlik", CEPHE_YON: "Cephe yönü", BINA_YASI: "Bina yaşı", KAT: "Kat", BALKON_BAHCE: "Balkon / bahçe", MANZARA: "Manzara", KREDI: "Krediye uygunluk",
};

const buyukHarf = (v: string) => v.toLocaleLowerCase("tr").replace(/_/g, " ").replace(/^./, (c) => c.toLocaleUpperCase("tr"));

export function etiket(v: unknown): string {
  if (v == null || v === "") return "—";
  if (typeof v === "boolean") return v ? "Var" : "Yok";
  if (typeof v === "number") return v.toLocaleString("tr-TR");
  if (Array.isArray(v)) return v.map(etiket).join(", ");
  const s = String(v);
  return (MULK_TIPI_META as Record<string, { etiket: string }>)[s]?.etiket
    ?? (ISLEM_TIPI_ETIKET as Record<string, string>)[s]
    ?? E[s] ?? KRITER_ETIKET[s] ?? buyukHarf(s);
}

export { ANA_KATEGORI_ETIKET, ISLEM_TIPI_ETIKET, ILAN_SAHIBI_ETIKET, VERI_KANALI_ETIKET, MULK_TIPI_META, MUSTERI_KAYNAGI_ETIKET, HAVUZ_ETIKET, PORTFOY_ALINABILIRLIK_ETIKET };

export const tl = (n?: number | null, periyot?: string) =>
  n == null ? "—" : n.toLocaleString("tr-TR") + " TL" + (periyot === "AYLIK" ? " / ay" : periyot === "YILLIK" ? " / yıl" : periyot === "GUNLUK" ? " / gün" : "");