/**
 * Anahtar CRM v3.22 · 9 Ekim 2026
 * Kategori / işlem / kaynak enum'larının Türkçe etiketleri ve iş kuralları.
 * Tek kaynak: Prisma enum'ları (src/generated/prisma). UI dropdown'ları, Gemini şeması
 * ve Notion eşlemesi bu dosyadan beslenir — hiçbir yerde elle string yazılmaz.
 */
import {
  AnaKategori,
  MulkTipi,
  IslemTipi,
  IlanSahibiTipi,
  VeriKanali,
  Havuz,
  MusteriKaynagi,
  PortfoyAlinabilirlik,
} from "../../generated/prisma/enums";

export const ANA_KATEGORI_ETIKET: Record<AnaKategori, string> = {
  KONUT: "Konut",
  ISYERI: "İş Yeri (Ticari / Endüstriyel)",
  ARSA: "Arsa",
  BINA: "Bina",
  TURISTIK_TESIS: "Turistik Tesis",
  DEVRE_MULK: "Devre Mülk",
};

/** Alt grup — UI'da optgroup, eşleştirmede "aynı aile" toleransı için */
export type MulkGrubu =
  | "KONUT"
  | "ENDUSTRIYEL"
  | "TICARI"
  | "OFIS"
  | "HIZMET"
  | "ARSA"
  | "BINA"
  | "TURIZM"
  | "DEVRE_MULK"
  | "DIGER";

export const MULK_TIPI_META: Record<MulkTipi, { etiket: string; ana: AnaKategori; grup: MulkGrubu }> = {
  DAIRE: { etiket: "Daire", ana: "KONUT", grup: "KONUT" },
  REZIDANS: { etiket: "Rezidans", ana: "KONUT", grup: "KONUT" },
  MUSTAKIL_EV: { etiket: "Müstakil Ev", ana: "KONUT", grup: "KONUT" },
  VILLA: { etiket: "Villa", ana: "KONUT", grup: "KONUT" },
  CIFTLIK_EVI: { etiket: "Çiftlik Evi", ana: "KONUT", grup: "KONUT" },
  KOSK_KONAK: { etiket: "Köşk / Konak", ana: "KONUT", grup: "KONUT" },
  YALI: { etiket: "Yalı", ana: "KONUT", grup: "KONUT" },
  YAZLIK: { etiket: "Yazlık", ana: "KONUT", grup: "KONUT" },
  PREFABRIK_EV: { etiket: "Prefabrik Ev", ana: "KONUT", grup: "KONUT" },
  KOOPERATIF: { etiket: "Kooperatif", ana: "KONUT", grup: "KONUT" },

  DEPO_ANTREPO: { etiket: "Depo / Antrepo", ana: "ISYERI", grup: "ENDUSTRIYEL" },
  FABRIKA_URETIM_TESISI: { etiket: "Fabrika / Üretim Tesisi", ana: "ISYERI", grup: "ENDUSTRIYEL" },
  IMALATHANE: { etiket: "İmalathane", ana: "ISYERI", grup: "ENDUSTRIYEL" },
  ATOLYE: { etiket: "Atölye", ana: "ISYERI", grup: "ENDUSTRIYEL" },
  SOGUK_HAVA_DEPOSU: { etiket: "Soğuk Hava Deposu", ana: "ISYERI", grup: "ENDUSTRIYEL" },
  LOJISTIK_MERKEZI: { etiket: "Lojistik Merkezi", ana: "ISYERI", grup: "ENDUSTRIYEL" },
  TAMIRHANE_OTO_SERVIS: { etiket: "Tamirhane / Oto Servis", ana: "ISYERI", grup: "ENDUSTRIYEL" },
  ENERJI_SANTRALI: { etiket: "Enerji Santrali", ana: "ISYERI", grup: "ENDUSTRIYEL" },
  MADEN_OCAGI: { etiket: "Maden Ocağı", ana: "ISYERI", grup: "ENDUSTRIYEL" },

  DUKKAN_MAGAZA: { etiket: "Dükkan / Mağaza", ana: "ISYERI", grup: "TICARI" },
  SHOWROOM: { etiket: "Showroom / Teşhir", ana: "ISYERI", grup: "TICARI" },
  AVM: { etiket: "AVM", ana: "ISYERI", grup: "TICARI" },
  PAZAR_YERI: { etiket: "Pazar Yeri", ana: "ISYERI", grup: "TICARI" },
  BUFE_KANTIN: { etiket: "Büfe / Kantin", ana: "ISYERI", grup: "TICARI" },
  RESTORAN_LOKANTA: { etiket: "Restoran / Lokanta", ana: "ISYERI", grup: "TICARI" },
  CAFE_BAR: { etiket: "Cafe / Bar", ana: "ISYERI", grup: "TICARI" },
  PASTANE_FIRIN: { etiket: "Pastane / Fırın", ana: "ISYERI", grup: "TICARI" },
  AKARYAKIT_ISTASYONU: { etiket: "Akaryakıt İstasyonu", ana: "ISYERI", grup: "TICARI" },
  OTO_YIKAMA: { etiket: "Oto Yıkama", ana: "ISYERI", grup: "TICARI" },
  OTOPARK_GARAJ: { etiket: "Otopark / Garaj", ana: "ISYERI", grup: "TICARI" },

  BURO_OFIS: { etiket: "Büro / Ofis", ana: "ISYERI", grup: "OFIS" },
  OFIS_APARTMAN_DAIRESI: { etiket: "Ofis (Apartman Dairesi)", ana: "ISYERI", grup: "OFIS" },
  PLAZA: { etiket: "Plaza", ana: "ISYERI", grup: "OFIS" },
  PLAZA_KATI_OFIS: { etiket: "Plaza Katı / Ofisi", ana: "ISYERI", grup: "OFIS" },
  REZIDANS_KATI_OFIS: { etiket: "Rezidans Katı / Ofisi", ana: "ISYERI", grup: "OFIS" },
  IS_HANI_KATI: { etiket: "İş Hanı Katı", ana: "ISYERI", grup: "OFIS" },

  SAGLIK_MERKEZI_KLINIK: { etiket: "Sağlık Merkezi / Klinik", ana: "ISYERI", grup: "HIZMET" },
  EGITIM_KURUMU: { etiket: "Eğitim Kurumu / Kurs", ana: "ISYERI", grup: "HIZMET" },
  KRES: { etiket: "Kreş", ana: "ISYERI", grup: "HIZMET" },
  YURT: { etiket: "Yurt", ana: "ISYERI", grup: "HIZMET" },
  SPOR_TESISI: { etiket: "Spor Tesisi", ana: "ISYERI", grup: "HIZMET" },
  SPA_HAMAM: { etiket: "SPA / Hamam / Sauna", ana: "ISYERI", grup: "HIZMET" },
  DUGUN_SALONU: { etiket: "Düğün Salonu", ana: "ISYERI", grup: "HIZMET" },
  SINEMA_KONFERANS: { etiket: "Sinema / Konferans Salonu", ana: "ISYERI", grup: "HIZMET" },
  KIR_KAHVALTI_BAHCESI: { etiket: "Kır & Kahvaltı Bahçesi", ana: "ISYERI", grup: "HIZMET" },
  CIFTLIK: { etiket: "Çiftlik", ana: "ISYERI", grup: "HIZMET" },

  ARSA: { etiket: "Arsa", ana: "ARSA", grup: "ARSA" },
  TARLA: { etiket: "Tarla", ana: "ARSA", grup: "ARSA" },
  BAG_BAHCE: { etiket: "Bağ / Bahçe", ana: "ARSA", grup: "ARSA" },
  ZEYTINLIK: { etiket: "Zeytinlik", ana: "ARSA", grup: "ARSA" },

  KOMPLE_BINA: { etiket: "Komple Bina", ana: "BINA", grup: "BINA" },

  OTEL: { etiket: "Otel", ana: "TURISTIK_TESIS", grup: "TURIZM" },
  BUTIK_OTEL: { etiket: "Butik Otel", ana: "TURISTIK_TESIS", grup: "TURIZM" },
  APART_OTEL: { etiket: "Apart Otel", ana: "TURISTIK_TESIS", grup: "TURIZM" },
  TATIL_KOYU: { etiket: "Tatil Köyü", ana: "TURISTIK_TESIS", grup: "TURIZM" },
  MOTEL: { etiket: "Motel", ana: "TURISTIK_TESIS", grup: "TURIZM" },
  PANSIYON: { etiket: "Pansiyon", ana: "TURISTIK_TESIS", grup: "TURIZM" },
  HOSTEL: { etiket: "Hostel", ana: "TURISTIK_TESIS", grup: "TURIZM" },
  KAMP_ALANI: { etiket: "Kamp Alanı", ana: "TURISTIK_TESIS", grup: "TURIZM" },

  DEVRE_MULK: { etiket: "Devre Mülk", ana: "DEVRE_MULK", grup: "DEVRE_MULK" },
  DIGER: { etiket: "Diğer", ana: "ISYERI", grup: "DIGER" },
};

export const ISLEM_TIPI_ETIKET: Record<IslemTipi, string> = {
  SATILIK: "Satılık",
  KIRALIK: "Kiralık",
  DEVREN_SATILIK: "Devren Satılık (Devirlik)",
  DEVREN_KIRALIK: "Devren Kiralık",
  KAT_KARSILIGI: "Kat Karşılığı",
  GUNLUK_KIRALIK: "Günlük Kiralık",
  SEZONLUK_KIRALIK: "Sezonluk Kiralık",
  TAKAS: "Takas",
};

export const ILAN_SAHIBI_ETIKET: Record<IlanSahibiTipi, string> = {
  MALIK: "Malik",
  EMLAKCI: "Emlakçı",
  MUTEAHHIT: "Müteahhit",
  FIRMA: "Firma",
  PARTNER: "Partner",
  PORTAL: "Portal",
  BILINMIYOR: "Bilinmiyor",
};

export const VERI_KANALI_ETIKET: Record<VeriKanali, string> = {
  WHATSAPP: "WhatsApp",
  SAHIBINDEN: "Sahibinden",
  HEPSIEMLAK: "Hepsiemlak",
  EMLAKJET: "Emlakjet",
  NOTION: "Notion",
  KENDI_CRM: "Kendi CRM",
  MANUEL: "Manuel",
  CSV: "CSV",
  SESLI_NOT: "Sesli Not",
};

export const HAVUZ_ETIKET: Record<Havuz, string> = {
  KENDI_PORTFOY: "Kendi Portföyüm",
  PARTNER: "Partner Ağı",
  DIS_ILAN: "Web İlanı",
};

export const MUSTERI_KAYNAGI_ETIKET: Record<MusteriKaynagi, string> = {
  SAHA: "Saha",
  REFERANS: "Referans",
  REKLAM: "Reklam",
  ILAN: "İlan",
  WHATSAPP_GRUBU: "WhatsApp Grubu",
  PORTAL: "Portal",
  DIGER: "Diğer",
};

export const PORTFOY_ALINABILIRLIK_ETIKET: Record<PortfoyAlinabilirlik, string> = {
  COK_YUKSEK: "Çok Yüksek",
  YUKSEK: "Yüksek",
  ORTA: "Orta",
  DUSUK: "Düşük",
  BILINMIYOR: "Bilinmiyor",
};

/** Kural: mulkTipi → anaKategori tutarlılığı (API & AI çıktısı doğrulamasında kullanılır) */
export function anaKategoriOf(tip: MulkTipi): AnaKategori {
  return MULK_TIPI_META[tip].ana;
}

/** Konut kategorisinde devren işlem mantıksız — erken uyarı */
export function islemKategoriUyumlu(ana: AnaKategori, islem: IslemTipi): boolean {
  if (islem === "DEVREN_SATILIK" || islem === "DEVREN_KIRALIK") return ana === "ISYERI" || ana === "TURISTIK_TESIS";
  if (islem === "KAT_KARSILIGI") return ana === "ARSA" || ana === "BINA";
  if (islem === "GUNLUK_KIRALIK" || islem === "SEZONLUK_KIRALIK")
    return ana === "KONUT" || ana === "TURISTIK_TESIS" || ana === "DEVRE_MULK";
  return true;
}

// ---------------------------------------------------------------------------
//  v3.3 — Sade mülk aileleri (ekranda kısa liste) ve benzerlik tablosu (eşleştirme)
//  Veritabanı 61 ayrıntılı tipi korur (portal ilanlarıyla birebir eşleşme için);
//  kullanıcı önce aileyi seçer, isterse ayrıntıya iner. Eşleştirme hangi tiplerin
//  birbirinin yerine geçebileceğini bu tablodan okur — yapay zekânın serbest yorumundan değil.
// ---------------------------------------------------------------------------
export interface MulkAilesi { kod: string; etiket: string; tipler: MulkTipi[] }
export const MULK_AILELERI: MulkAilesi[] = [
  { kod: "DAIRE", etiket: "Daire / Rezidans", tipler: ["DAIRE", "REZIDANS", "KOOPERATIF"] },
  { kod: "MUSTAKIL", etiket: "Müstakil / Villa", tipler: ["VILLA", "MUSTAKIL_EV", "YAZLIK", "CIFTLIK_EVI", "KOSK_KONAK", "YALI", "PREFABRIK_EV"] },
  { kod: "DEPO", etiket: "Depo / Lojistik", tipler: ["DEPO_ANTREPO", "LOJISTIK_MERKEZI", "SOGUK_HAVA_DEPOSU"] },
  { kod: "URETIM", etiket: "Fabrika / İmalathane / Atölye", tipler: ["FABRIKA_URETIM_TESISI", "IMALATHANE", "ATOLYE", "TAMIRHANE_OTO_SERVIS"] },
  { kod: "DUKKAN", etiket: "Dükkan / Mağaza", tipler: ["DUKKAN_MAGAZA", "SHOWROOM", "AVM", "PAZAR_YERI", "BUFE_KANTIN"] },
  { kod: "YEME_ICME", etiket: "Restoran / Kafe", tipler: ["RESTORAN_LOKANTA", "CAFE_BAR", "PASTANE_FIRIN"] },
  { kod: "OFIS", etiket: "Ofis / Büro", tipler: ["BURO_OFIS", "OFIS_APARTMAN_DAIRESI", "PLAZA_KATI_OFIS", "REZIDANS_KATI_OFIS", "IS_HANI_KATI", "PLAZA"] },
  { kod: "HIZMET", etiket: "Sağlık / Eğitim / Spor / Salon", tipler: ["SAGLIK_MERKEZI_KLINIK", "EGITIM_KURUMU", "KRES", "YURT", "SPOR_TESISI", "SPA_HAMAM", "DUGUN_SALONU", "SINEMA_KONFERANS", "KIR_KAHVALTI_BAHCESI"] },
  { kod: "OTO", etiket: "Akaryakıt / Oto / Otopark", tipler: ["AKARYAKIT_ISTASYONU", "OTO_YIKAMA", "OTOPARK_GARAJ"] },
  { kod: "ARSA", etiket: "Arsa / Tarla", tipler: ["ARSA", "TARLA", "BAG_BAHCE", "ZEYTINLIK", "CIFTLIK"] },
  { kod: "BINA", etiket: "Komple Bina", tipler: ["KOMPLE_BINA"] },
  { kod: "TURIZM", etiket: "Otel / Turizm Tesisi", tipler: ["OTEL", "BUTIK_OTEL", "APART_OTEL", "TATIL_KOYU", "MOTEL", "PANSIYON", "HOSTEL", "KAMP_ALANI"] },
  { kod: "DEVRE_MULK", etiket: "Devre Mülk", tipler: ["DEVRE_MULK"] },
  { kod: "DIGER", etiket: "Enerji / Maden / Diğer", tipler: ["ENERJI_SANTRALI", "MADEN_OCAGI", "DIGER"] },
];
export const aileOf = (tip: MulkTipi) => MULK_AILELERI.find((a) => a.tipler.includes(tip))!;

/**
 * Aileler arası yakınlık (0–1). Aynı tip = 1, aynı aile = 0.9.
 * Burada olmayan aile çiftleri birbirine sunulmaz.
 */
const AILE_YAKINLIK: [string, string, number, string][] = [
  ["DEPO", "URETIM", 0.6, "Depo arayana üretim binası, üretim yeri arayana depo çoğu zaman uyar (yükseklik, elektrik, araç erişimi aynı kriterler)"],
  ["DUKKAN", "YEME_ICME", 0.6, "Cadde dükkanı restoran/kafeye dönüşebilir (baca ve ruhsat kontrol edilmeli)"],
  ["OFIS", "HIZMET", 0.5, "Klinik, kurs, danışmanlık gibi işler ofis katında da yapılabilir"],
  ["DAIRE", "OFIS", 0.4, "Ofis olarak kullanılabilecek daire (ticari kullanım izni kontrol edilmeli)"],
  ["BINA", "TURIZM", 0.5, "Komple bina apart/otel dönüşümüne uygun olabilir"],
  ["MUSTAKIL", "TURIZM", 0.4, "Butik otel / pansiyon dönüşümü"],
];

export function tipBenzerligi(a: MulkTipi, b: MulkTipi): { oran: number; aciklama: string } {
  if (a === b) return { oran: 1, aciklama: "Aynı mülk tipi" };
  const aa = aileOf(a).kod, bb = aileOf(b).kod;
  if (aa === bb) return { oran: 0.9, aciklama: `Aynı aile (${aileOf(a).etiket})` };
  const y = AILE_YAKINLIK.find(([x, z]) => (x === aa && z === bb) || (x === bb && z === aa));
  return y ? { oran: y[2], aciklama: y[3] } : { oran: 0, aciklama: "Farklı mülk ailesi" };
}
/** Talep tiplerinin (ana + alternatifler) portföy tipine en iyi uyumu */
export function enIyiTipBenzerligi(talepTipleri: MulkTipi[], portfoyTipi: MulkTipi) {
  return talepTipleri.map((t) => ({ tip: t, ...tipBenzerligi(t, portfoyTipi) })).sort((x, y) => y.oran - x.oran)[0];
}
/** Bir aileye benzer (sunulabilir) diğer aileler, yakınlık sırasıyla */
export function benzerAileler(kod: string): { aile: MulkAilesi; oran: number; aciklama: string }[] {
  return AILE_YAKINLIK.filter(([a, b]) => a === kod || b === kod)
    .map(([a, b, oran, aciklama]) => ({ aile: MULK_AILELERI.find((x) => x.kod === (a === kod ? b : a))!, oran, aciklama }))
    .sort((x, y) => y.oran - x.oran);
}