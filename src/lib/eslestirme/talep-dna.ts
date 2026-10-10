/**
 * Anahtar CRM v3.24 · 10 Ekim 2026
 * TALEP DNA'SI — bir talebin eşleştirmeden önce çıkarılan "genetiği":
 *  - Aciliyet
 *  - Kritik (öldürücü) kriterler: karşılanmazsa portföy UYGUN_DEGIL
 *      · talepte açıkça "şart" denenler (kritikKriterler)
 *      · kullanım amacının doğası gereği öldürücü olanlar (üretim → elektrik + ruhsat) — talepte değer varsa
 *      · alan, bütçe ve bölge — talep "esnek" demedikçe
 *  - Esnek kriterler: alan ±%20, bütçe +%20 (esnek değilse alan ±%10, bütçe +%10)
 *  - Eksik bilgi: amacın gerektirdiği ama talepte olmayan bilgiler → "Doğru eşleştirme için N kritik bilgi eksik"
 *    ve müşteriye gönderilecek hazır soru mesajı.
 * Saf fonksiyon: veritabanı ve yapay zekâ gerektirmez (demo, API ve eşleştirme motoru aynı kodu kullanır).
 */
import { MULK_OZELLIK_META, istenenKatlarOf, katYaz, type MulkOzellikAlani } from "../domain/teknik-alanlar";
import { MULK_TIPI_META, aileOf } from "../domain/kategori";

export type Kriter = string; // TeknikAlan enum değeri (MULK_TIPI, ALAN, ELEKTRIK…)

export const KRITER_ADI: Record<string, string> = {
  LOKASYON: "Bölge", FIYAT: "Bütçe", ALAN: "Alan (m²)", KAPALI_ALAN: "Kapalı alan", ACIK_ALAN: "Açık alan", ARSA_ALANI: "Arsa alanı",
  YUKSEKLIK: "Yükseklik", KAPI: "Kapı ölçüsü", ARAC_ERISIMI: "Araç erişimi (TIR / kamyon)", RAMPA: "Rampa", VINC: "Vinç", ELEKTRIK: "Minimum elektrik (kW)",
  TRAFO: "Trafo", SANAYI_ELEKTRIGI: "Sanayi elektriği", YANGIN_SISTEMI: "Yangın sistemi", SPRINKLER: "Sprinkler", ISKAN: "İskan", RUHSAT: "Ruhsat",
  SOGUK_HAVA: "Soğuk hava", GIDAYA_UYGUNLUK: "Gıdaya uygunluk", CATI_DUVAR: "Çatı / duvar", OFIS_SOSYAL: "Ofis / sosyal alan", OTOPARK: "Otopark",
  YAYA_TRAFIGI: "Yaya trafiği", ARAC_TRAFIGI: "Araç trafiği", CEPHE_VITRIN: "Cephe / vitrin", ZEMIN_KAT_GIRIS: "Zemin kat girişi", KULLANIM_AMACI: "Kullanım amacı",
  KIRA_SURESI: "Kira süresi", ODA_SAYISI: "Oda sayısı", IMAR: "İmar durumu", BANYO: "Banyo", ISINMA: "Isınma", ESYA: "Eşya", SITE_GUVENLIK: "Site / güvenlik",
  CEPHE_YON: "Cephe yönü", BINA_YASI: "Bina yaşı", KAT: "Kat", BALKON_BAHCE: "Balkon / bahçe", MANZARA: "Manzara", KREDI: "Krediye uygunluk", MULK_TIPI: "Mülk tipi",
};

/** Müşteriye sorulacak soru (WhatsApp mesajı taslağında kullanılır) */
export const KRITER_SORUSU: Record<string, string> = {
  LOKASYON: "Hangi bölgeler olur? (ilçe / mahalle)", FIYAT: "Bütçe üst sınırı nedir?", ALAN: "Kaç m² aralığında olmalı?",
  ELEKTRIK: "Minimum elektrik gücü kaç kW olmalı?", RUHSAT: "Üretim / işyeri açma ruhsatı şart mı?", ISKAN: "İskan şart mı?",
  YUKSEKLIK: "Minimum net yükseklik kaç metre olmalı?", ARAC_ERISIMI: "TIR mı kamyon mu girecek?", RAMPA: "Yükleme rampası şart mı?",
  SANAYI_ELEKTRIGI: "Sanayi elektriği (trifaze) gerekli mi?", SOGUK_HAVA: "Soğuk hava gerekiyor mu, kaç derece ve kaç m²?", GIDAYA_UYGUNLUK: "Gıdaya uygun (hijyen, zemin) olması şart mı?",
  ACIK_ALAN: "Açık alan / saha ihtiyacı var mı, kaç m²?", OFIS_SOSYAL: "Ofis / sosyal alan gerekiyor mu?", CEPHE_VITRIN: "Cephe / vitrin genişliği önemli mi?",
  YAYA_TRAFIGI: "Yaya trafiği yoğun bir cadde mi olmalı?", ARAC_TRAFIGI: "Ana yol / araç trafiği önemli mi?", ZEMIN_KAT_GIRIS: "Zemin kat / düz giriş şart mı?",
  OTOPARK: "Otopark gerekli mi, kaç araç?", ODA_SAYISI: "Kaç oda olmalı?", IMAR: "İmar durumu (konut / ticari / sanayi) ne olmalı?", KULLANIM_AMACI: "Mülkü ne amaçla kullanacak?",
};

export interface AmacProfili { kod: string; etiket: string; oldurucu: Kriter[]; onemli: Kriter[] }

/** Kullanım amacı → doğası gereği öldürücü ve önemli kriterler (Notion talep örnekleri + saha tecrübesi) */
export const AMAC_PROFILLERI: Record<string, AmacProfili> = {
  URETIM: { kod: "URETIM", etiket: "Üretim", oldurucu: ["ELEKTRIK", "RUHSAT"], onemli: ["YUKSEKLIK", "ARAC_ERISIMI", "SANAYI_ELEKTRIGI", "ISKAN"] },
  GIDA_URETIM: { kod: "GIDA_URETIM", etiket: "Gıda üretimi", oldurucu: ["ELEKTRIK", "RUHSAT", "GIDAYA_UYGUNLUK"], onemli: ["YUKSEKLIK", "ARAC_ERISIMI"] },
  SOGUK_ZINCIR: { kod: "SOGUK_ZINCIR", etiket: "Soğuk zincir", oldurucu: ["SOGUK_HAVA", "ELEKTRIK"], onemli: ["GIDAYA_UYGUNLUK", "ARAC_ERISIMI", "RAMPA"] },
  GIDA_DEPOLAMA: { kod: "GIDA_DEPOLAMA", etiket: "Gıda depolama", oldurucu: ["GIDAYA_UYGUNLUK"], onemli: ["SOGUK_HAVA", "ARAC_ERISIMI", "YUKSEKLIK"] },
  LOJISTIK_DAGITIM: { kod: "LOJISTIK_DAGITIM", etiket: "Lojistik / dağıtım", oldurucu: ["ARAC_ERISIMI"], onemli: ["RAMPA", "YUKSEKLIK", "ACIK_ALAN"] },
  E_TICARET: { kod: "E_TICARET", etiket: "E-ticaret deposu", oldurucu: ["ARAC_ERISIMI"], onemli: ["RAMPA", "YUKSEKLIK", "OFIS_SOSYAL"] },
  DEPOLAMA: { kod: "DEPOLAMA", etiket: "Depolama", oldurucu: [], onemli: ["YUKSEKLIK", "ARAC_ERISIMI"] },
  PERAKENDE: { kod: "PERAKENDE", etiket: "Perakende", oldurucu: [], onemli: ["CEPHE_VITRIN", "YAYA_TRAFIGI", "ZEMIN_KAT_GIRIS"] },
  MARKET: { kod: "MARKET", etiket: "Market", oldurucu: [], onemli: ["CEPHE_VITRIN", "OTOPARK", "ARAC_TRAFIGI"] },
  SHOWROOM: { kod: "SHOWROOM", etiket: "Showroom", oldurucu: [], onemli: ["CEPHE_VITRIN", "ARAC_TRAFIGI", "OTOPARK"] },
  RESTORAN_KAFE: { kod: "RESTORAN_KAFE", etiket: "Restoran / kafe", oldurucu: ["RUHSAT"], onemli: ["CEPHE_VITRIN", "YAYA_TRAFIGI"] },
  OFIS: { kod: "OFIS", etiket: "Ofis", oldurucu: [], onemli: ["OTOPARK", "ISKAN"] },
  BANKA_SUBE: { kod: "BANKA_SUBE", etiket: "Banka şubesi", oldurucu: [], onemli: ["CEPHE_VITRIN", "ZEMIN_KAT_GIRIS", "OTOPARK"] },
  SAGLIK: { kod: "SAGLIK", etiket: "Sağlık", oldurucu: ["RUHSAT", "ISKAN"], onemli: ["OTOPARK"] },
  EGITIM: { kod: "EGITIM", etiket: "Eğitim", oldurucu: ["RUHSAT", "ISKAN"], onemli: ["ACIK_ALAN"] },
  OTO_SERVIS: { kod: "OTO_SERVIS", etiket: "Oto servis", oldurucu: ["RUHSAT"], onemli: ["ARAC_ERISIMI", "ELEKTRIK", "YUKSEKLIK"] },
  KONUT: { kod: "KONUT", etiket: "Konut", oldurucu: [], onemli: ["ODA_SAYISI"] },
  ARSA: { kod: "ARSA", etiket: "Arsa", oldurucu: [], onemli: ["IMAR"] },
};
/** Kullanım amacı yazılmamışsa mülk ailesinden varsayılan profil */
const AILE_PROFILI: Record<string, string> = { URETIM: "URETIM", DEPO: "DEPOLAMA", DUKKAN: "PERAKENDE", YEME_ICME: "RESTORAN_KAFE", OFIS: "OFIS", DAIRE: "KONUT", MUSTAKIL: "KONUT", ARSA: "ARSA", OTO: "OTO_SERVIS" };

export interface DnaGirdi {
  tip: "PORTFOY" | "TALEP";
  mulkTipi: string;
  alternatifMulkTipleri?: string[];
  aciliyet?: string | null;
  maxFiyat?: number | null;
  minM2?: number | null;
  maxM2?: number | null;
  m2ToleransYuzde?: number | null;
  odaSayisi?: string | null;
  krediyeUygun?: boolean | null;
  lokasyonlar: { ilceId?: number | null; mahalleId?: number | null; altBolgeId?: number | null; haric?: boolean }[];
  ozellik?: Record<string, unknown> & { kritikKriterler?: string[]; esnekKriterler?: string[]; eksikBilgiler?: string[]; kullanimAmaclari?: string[] };
}

export interface DnaKriter { kriter: Kriter; etiket: string; deger?: string; kaynak: "TALEP" | "AMAC" | "VARSAYILAN" }
export interface DnaEksik { kriter: Kriter; etiket: string; soru: string; oldurucu: boolean }
export interface TalepDna {
  aciliyet: string;
  profiller: { kod: string; etiket: string }[];
  kritik: DnaKriter[];
  esnek: { kriter: Kriter; etiket: string; aciklama: string }[];
  eksik: DnaEksik[];
  /** Alan toleransı (yüzde) — esnek ALAN: 20, değilse talepteki değer ya da 10 */
  m2Tolerans: number;
  /** Bütçe aşım toleransı (yüzde) — esnek FIYAT: 20, değilse 10 */
  fiyatTolerans: number;
  /** "Doğru eşleştirme için 3 kritik bilgi eksik: …" (yoksa null) */
  uyari: string | null;
  /** Müşteriye gönderilecek soru mesajı taslağı (yoksa null) */
  soruMesaji: string | null;
}

const fmt = (v: unknown) => (typeof v === "number" ? v.toLocaleString("tr-TR") : Array.isArray(v) ? v.join(", ") : v === true ? "Şart" : String(v));

/** Talepte bu kriter için bir değer var mı? (varsa kısa metni) */
export function kriterDegeri(t: DnaGirdi, k: Kriter): string | null {
  const o = (t.ozellik ?? {}) as Record<string, unknown>;
  if (k === "ALAN") return t.minM2 != null || t.maxM2 != null ? `${t.minM2 != null ? fmt(t.minM2) : "…"}–${t.maxM2 != null ? fmt(t.maxM2) : "…"} m²` : null;
  if (k === "FIYAT") return t.maxFiyat != null ? `≤ ${fmt(t.maxFiyat)}` : null;
  if (k === "LOKASYON") { const n = t.lokasyonlar.filter((l) => !l.haric && (l.ilceId || l.altBolgeId || l.mahalleId)).length; return n ? `${n} bölge` : null; }
  if (k === "ODA_SAYISI") return t.odaSayisi ?? null;
  if (k === "KREDI") return t.krediyeUygun ? "İstiyor" : null;
  if (k === "MULK_TIPI") return t.mulkTipi;
  if (k === "KAT") { const kk = istenenKatlarOf(o); return kk.length ? katYaz(kk) : null; } // v3.15: çoklu kat
  for (const [alan, meta] of Object.entries(MULK_OZELLIK_META)) {
    if ((meta as any).kriter !== k) continue;
    const v = o[alan as MulkOzellikAlani];
    if (v == null || v === false || (Array.isArray(v) && !v.length)) continue;
    return (meta as any).karsilastirma === "min" ? `≥ ${fmt(v)}${(meta as any).birim ? " " + (meta as any).birim : ""}` : fmt(v);
  }
  return null;
}

export function talepProfilleri(t: DnaGirdi): AmacProfili[] {
  const amaclar = (t.ozellik?.kullanimAmaclari ?? []).filter((a) => AMAC_PROFILLERI[a]);
  if (amaclar.length) return amaclar.map((a) => AMAC_PROFILLERI[a]);
  if (t.mulkTipi === "SOGUK_HAVA_DEPOSU") return [AMAC_PROFILLERI.SOGUK_ZINCIR];
  const kod = AILE_PROFILI[aileOf(t.mulkTipi as any)?.kod ?? ""];
  return kod ? [AMAC_PROFILLERI[kod]] : [];
}

export function talepDnasi(t: DnaGirdi): TalepDna {
  const o = t.ozellik ?? {};
  const acikKritik = new Set(o.kritikKriterler ?? []);
  const esnekSet = new Set(o.esnekKriterler ?? []);
  const profiller = talepProfilleri(t);
  const grup = MULK_TIPI_META[t.mulkTipi as keyof typeof MULK_TIPI_META]?.grup;
  const kritik: DnaKriter[] = [];
  const ekle = (k: Kriter, kaynak: DnaKriter["kaynak"]) => {
    if (esnekSet.has(k) || kritik.some((x) => x.kriter === k)) return;
    const d = kriterDegeri(t, k);
    if (d == null && kaynak !== "TALEP") return; // değer yoksa karşılaştırılacak bir şey yok → eksik bilgi olur
    kritik.push({ kriter: k, etiket: KRITER_ADI[k] ?? k, deger: d ?? undefined, kaynak });
  };
  for (const k of acikKritik) ekle(k, "TALEP");
  for (const p of profiller) for (const k of p.oldurucu) ekle(k, "AMAC");
  for (const k of ["LOKASYON", "ALAN", "FIYAT"]) ekle(k, "VARSAYILAN");

  const m2Tolerans = esnekSet.has("ALAN") ? Math.max(20, t.m2ToleransYuzde ?? 0) : t.m2ToleransYuzde ?? 10;
  const fiyatTolerans = esnekSet.has("FIYAT") ? 20 : 10;
  const esnek = [...esnekSet].map((k) => ({ kriter: k, etiket: KRITER_ADI[k] ?? k, aciklama: k === "ALAN" ? `±%${m2Tolerans}` : k === "FIYAT" ? `bütçe +%${fiyatTolerans}` : k === "LOKASYON" ? "5 km'ye kadar uzak mahalleler de olur" : "pazarlığa açık" }));

  // Eksik bilgi: temel (bölge, bütçe, alan/oda) + amaç profilinin öldürücü ve önemli kriterleri + yapay zekânın işaretledikleri
  const eksik: DnaEksik[] = [];
  const eksikEkle = (k: Kriter, oldurucu: boolean) => {
    if (kriterDegeri(t, k) != null || eksik.some((x) => x.kriter === k)) return;
    eksik.push({ kriter: k, etiket: KRITER_ADI[k] ?? k, soru: KRITER_SORUSU[k] ?? `${KRITER_ADI[k] ?? k} bilgisi?`, oldurucu });
  };
  eksikEkle("LOKASYON", true);
  eksikEkle("FIYAT", false);
  if (grup === "KONUT") { if (kriterDegeri(t, "ALAN") == null) eksikEkle("ODA_SAYISI", false); }
  else if (grup !== "TURIZM" && grup !== "DEVRE_MULK") eksikEkle("ALAN", true); // otelde ölçü oda / yatak sayısıdır
  for (const p of profiller) { p.oldurucu.forEach((k) => eksikEkle(k, true)); p.onemli.forEach((k) => eksikEkle(k, false)); }
  for (const k of o.eksikBilgiler ?? []) eksikEkle(k, acikKritik.has(k));
  eksik.sort((a, b) => Number(b.oldurucu) - Number(a.oldurucu));

  const kritikEksik = eksik.filter((e) => e.oldurucu);
  const uyari = kritikEksik.length ? `Doğru eşleştirme için ${kritikEksik.length} kritik bilgi eksik: ${kritikEksik.map((e) => e.etiket).join(", ")}` : null;
  const soruMesaji = eksik.length ? ["Merhaba, size en doğru yerleri sunabilmem için birkaç bilgiye ihtiyacım var:", ...eksik.slice(0, 6).map((e, i) => `${i + 1}. ${e.soru}`), "Teşekkürler."].join("\n") : null;
  return { aciliyet: t.aciliyet ?? "NORMAL", profiller: profiller.map((p) => ({ kod: p.kod, etiket: p.etiket })), kritik, esnek, eksik, m2Tolerans, fiyatTolerans, uyari, soruMesaji };
}