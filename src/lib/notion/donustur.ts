/**
 * Anahtar CRM v3.24 · 10 Ekim 2026
 * Notion API sayfası → Anahtar taslağı (kişi / portföy / talep). Veritabanısız, saf fonksiyonlar;
 * demo ve sunucu senkron işi aynı kodu kullanır. Enum çevirileri: ./eslestirme.ts
 */
import { NOTION_MULK_TIPI, NOTION_ISLEM_TIPI, NOTION_ACILIYET, NOTION_MUSTERI_KAYNAGI, NOTION_RUHSAT, NOTION_ROL, NOTION_TALEP_DURUM, NOTION_PORTFOY_DURUM } from "./eslestirme";
import { NOTION_TABLOLARI, type NotionTablo } from "./yapilandirma";
import { hizliAyristir } from "../ai/hizli-ayristirici";
import { lokasyonCozumle, type LokasyonIndeks } from "../lokasyon/cozumle";
import { KayitCreateSchema, type KayitCreateInput, type KayitCreateData } from "../validation/kayit";
import { telE164, cepMi } from "../senkron/birlestir";

// ───────── Notion API tipleri (yalnızca okunanlar) ─────────
export interface NotionOzellik {
  type: string;
  title?: { plain_text: string }[]; rich_text?: { plain_text: string }[];
  number?: number | null; select?: { name: string } | null; status?: { name: string } | null;
  multi_select?: { name: string }[]; phone_number?: string | null; email?: string | null; url?: string | null;
  relation?: { id: string }[]; created_time?: string; date?: { start: string } | null;
  place?: { lat?: number; lon?: number; name?: string; address?: string } | null;
}
export interface NotionSayfa {
  object?: "page"; id: string; created_time: string; last_edited_time: string;
  archived?: boolean; in_trash?: boolean; url?: string;
  properties: Record<string, NotionOzellik>;
}

// ───────── Alan okuyucular ─────────
const duz = (a?: { plain_text: string }[]) => (a ?? []).map((x) => x.plain_text).join("").trim();
export function oku(s: NotionSayfa, ad: string): NotionOzellik | undefined {
  return ad === "" ? Object.values(s.properties).find((p) => p.type === "title") : s.properties[ad];
}
export const metin = (s: NotionSayfa, ad: string): string | null => {
  const p = oku(s, ad); if (!p) return null;
  const v = p.type === "title" ? duz(p.title) : p.type === "rich_text" ? duz(p.rich_text) : p.type === "phone_number" ? p.phone_number ?? "" : p.type === "email" ? p.email ?? "" : p.type === "url" ? p.url ?? "" : "";
  return v.trim() || null;
};
export const sayi = (s: NotionSayfa, ad: string): number | null => { const v = oku(s, ad)?.number; return typeof v === "number" && isFinite(v) && v > 0 ? v : null; };
export const secim = (s: NotionSayfa, ad: string): string | null => { const p = oku(s, ad); return (p?.select ?? p?.status)?.name ?? null; };
export const coklu = (s: NotionSayfa, ad: string): string[] => (oku(s, ad)?.multi_select ?? []).map((x) => x.name);
export const iliski = (s: NotionSayfa, ad: string): string[] => (oku(s, ad)?.relation ?? []).map((x) => x.id);
export const idNorm = (id: string) => id.replace(/-/g, "").toLowerCase();

// ───────── Taslaklar ─────────
export interface KisiTaslagi {
  tablo: "KISI"; notionId: string; sonDuzenleme: string; silindi: boolean;
  alanlar: { adSoyad: string; telefon: string | null; notlar: string | null; referans: string | null };
  roller: string[]; uzmanlikAileleri: string[]; ilanSahibiTipi: string | null;
  /** Kişi kartındaki "aradığı mülk" bilgisi — bağlı talebi yoksa bundan talep türetilir */
  aradigi: { tipler: string[]; bolgeler: string[]; minFiyat: number | null; maxFiyat: number | null; minM2: number | null; maxM2: number | null } | null;
  bagliTalepVar: boolean;
}
export interface KayitTaslagi {
  tablo: "PORTFOY" | "TALEP"; notionId: string; sonDuzenleme: string; silindi: boolean; olusturma: string;
  girdi: Omit<KayitCreateInput, "lokasyonlar" | "kisiler">;
  bolgeler: string[];
  kisiBaglari: { notionId: string; rol: "SAHIP" | "MUSTERI" | "IRTIBAT" }[];
  /** Talepte Notion'da elle ilişkilendirilmiş portföyler → eşleşme takibine "Bildirildi" olarak düşer */
  notionEslesmeleri: string[];
  kontrol: string[];
}

const A = NOTION_TABLOLARI;
const ROL_UZMANLIK: Record<string, string[]> = { "EMLAKÇI DEPO": ["DEPO", "URETIM"], "EMLAKÇI TİCARİ": ["DUKKAN", "OFIS", "YEME_ICME"] };

export function kisiTaslagi(s: NotionSayfa): KisiTaslagi | null {
  const f = A.KISI.alan;
  const ad = metin(s, f.ad);
  const tel = telE164(metin(s, f.telefon));
  const adSoyad = ad ?? (tel ? tel : null);
  if (!adSoyad) return null;
  const rolEt = coklu(s, f.rol);
  const roller = [...new Set(rolEt.flatMap((r) => NOTION_ROL[r]?.roller ?? []))];
  const ilanSahibi = rolEt.map((r) => NOTION_ROL[r]?.ilanSahibi).find(Boolean) ?? null;
  const tipler = coklu(s, f.aradigiTip);
  const butce = sayi(s, f.butce);
  return {
    tablo: "KISI", notionId: s.id, sonDuzenleme: s.last_edited_time, silindi: !!(s.archived || s.in_trash),
    alanlar: { adSoyad, telefon: tel, notlar: metin(s, f.aciklama), referans: coklu(s, f.referans).join(", ") || null },
    roller, uzmanlikAileleri: [...new Set(rolEt.flatMap((r) => ROL_UZMANLIK[r] ?? []))], ilanSahibiTipi: ilanSahibi,
    aradigi: tipler.length ? { tipler, bolgeler: coklu(s, f.hedefBolge), minFiyat: sayi(s, f.butceMin), maxFiyat: sayi(s, f.butceMax) ?? butce, minM2: sayi(s, f.minM2), maxM2: sayi(s, f.maxM2) } : null,
    bagliTalepVar: iliski(s, f.talepler).length > 0,
  };
}

function tipIslem(tipEt: string[], islemEt: string | null, metinler: string, kontrol: string[]) {
  const tipler = [...new Set(tipEt.map((t) => NOTION_MULK_TIPI[t]).filter(Boolean))];
  const h = !tipler.length || !islemEt ? hizliAyristir(metinler) : null;
  let mulkTipi = tipler[0] ?? h?.mulkTipi ?? null;
  if (!tipler.length) kontrol.push(mulkTipi ? "Mülk tipi Notion'da boş; açıklamadan tahmin edildi" : "Mülk tipi yok");
  mulkTipi ??= "DIGER";
  let islemTipi = (islemEt && NOTION_ISLEM_TIPI[islemEt]) || h?.islemTipi || null;
  if (!islemEt) kontrol.push(islemTipi ? "Satılık/kiralık Notion'da boş; açıklamadan tahmin edildi" : "Satılık/kiralık belirtilmemiş (kiralık varsayıldı)");
  islemTipi ??= "KIRALIK";
  return { mulkTipi: mulkTipi as any, alternatifMulkTipleri: tipler.slice(1, 6) as any[], islemTipi: islemTipi as any };
}
const odaNorm = (o?: string) => (!o ? null : o === "5>" ? "5+" : o);
/** Kiralıkta Notion bütçesi aylık kabul edilir; metinde "yıllık" geçiyorsa yıllık */
const periyot = (islem: string, metinler: string) => (/KIRALIK/.test(islem) ? (/y[ıi]ll[ıi]k/i.test(metinler) ? "YILLIK" : "AYLIK") : "TOPLAM");

export function portfoyTaslagi(s: NotionSayfa): KayitTaslagi {
  const f = A.PORTFOY.alan;
  const kontrol: string[] = [];
  const baslik = metin(s, f.baslik), aciklama = metin(s, f.aciklama);
  const ti = tipIslem(coklu(s, f.mulkTipi), secim(s, f.islem), [baslik, aciklama].filter(Boolean).join("\n"), kontrol);
  const fiyat = sayi(s, f.fiyat), m2 = sayi(s, f.m2);
  if (!fiyat && !m2) kontrol.push("Fiyat ve m² yok");
  const ruhsat = coklu(s, f.ruhsat).map((r) => NOTION_RUHSAT[r]).find(Boolean);
  const yer = oku(s, f.konum)?.place;
  const durumEt = secim(s, f.durum);
  const sahip = iliski(s, f.sahip);
  return {
    tablo: "PORTFOY", notionId: s.id, sonDuzenleme: s.last_edited_time, olusturma: s.created_time, silindi: !!(s.archived || s.in_trash),
    girdi: {
      tip: "PORTFOY", ...ti, fiyat, fiyatPeriyodu: periyot(ti.islemTipi, aciklama ?? "") as any, m2, odaSayisi: odaNorm(coklu(s, f.oda)[0]),
      durum: (durumEt && NOTION_PORTFOY_DURUM[durumEt]) || "ACTIVE", baslik: baslik?.slice(0, 160) ?? null, hamMetin: aciklama,
      veriKanali: "NOTION", lokasyonHam: coklu(s, f.bolge).join(", ").slice(0, 200) || null,
      ...(yer?.lat && yer?.lon ? { enlem: yer.lat, boylam: yer.lon, adres: yer.address ?? yer.name ?? null } : {}),
      ...(ruhsat ? { ozellik: { ruhsatDurumu: ruhsat } as any } : {}),
    },
    bolgeler: coklu(s, f.bolge),
    kisiBaglari: [...sahip.map((id) => ({ notionId: id, rol: "SAHIP" as const })), ...[...iliski(s, f.ilgili), ...iliski(s, f.talepKisileri)].filter((id) => !sahip.includes(id)).map((id) => ({ notionId: id, rol: "IRTIBAT" as const }))],
    notionEslesmeleri: [], kontrol,
  };
}

export function talepTaslagi(s: NotionSayfa): KayitTaslagi {
  const f = A.TALEP.alan;
  const kontrol: string[] = [];
  const baslik = metin(s, f.baslik), neAriyor = metin(s, f.neAriyor);
  const ti = tipIslem(coklu(s, f.mulkTipi), secim(s, f.islem), [baslik, neAriyor].filter(Boolean).join("\n"), kontrol);
  const minFiyat = sayi(s, f.butceMin), maxFiyat = sayi(s, f.butceMax), minM2 = sayi(s, f.minM2), maxM2 = sayi(s, f.maxM2);
  if (!maxFiyat && !minM2 && !maxM2) kontrol.push("Bütçe ve m² yok");
  const tel = telE164(metin(s, f.telefon));
  const durumEt = secim(s, f.durum);
  const aciliyetEt = secim(s, f.aciliyet);
  const kaynakEt = secim(s, f.kaynak);
  return {
    tablo: "TALEP", notionId: s.id, sonDuzenleme: s.last_edited_time, olusturma: s.created_time, silindi: !!(s.archived || s.in_trash),
    girdi: {
      tip: "TALEP", ...ti,
      minFiyat: minFiyat && maxFiyat && minFiyat > maxFiyat ? maxFiyat : minFiyat, maxFiyat: minFiyat && maxFiyat && minFiyat > maxFiyat ? minFiyat : maxFiyat,
      fiyatPeriyodu: periyot(ti.islemTipi, neAriyor ?? "") as any,
      minM2: minM2 && maxM2 && minM2 > maxM2 ? maxM2 : minM2, maxM2: minM2 && maxM2 && minM2 > maxM2 ? minM2 : maxM2,
      odaSayisi: odaNorm(coklu(s, f.oda)[0]),
      durum: (durumEt && NOTION_TALEP_DURUM[durumEt]) || "ACTIVE", aciliyet: (aciliyetEt && NOTION_ACILIYET[aciliyetEt]) || "NORMAL",
      musteriKaynagi: (kaynakEt && NOTION_MUSTERI_KAYNAGI[kaynakEt]) || null,
      baslik: (baslik ?? neAriyor?.split("\n")[0].slice(0, 70))?.slice(0, 160) ?? null, hamMetin: neAriyor, operasyonNotu: metin(s, f.notlar),
      gondeTelefon: cepMi(tel) ? tel : null, veriKanali: "NOTION", lokasyonHam: coklu(s, f.bolge).join(", ").slice(0, 200) || null,
    },
    bolgeler: coklu(s, f.bolge),
    kisiBaglari: iliski(s, f.kisi).map((id) => ({ notionId: id, rol: "MUSTERI" as const })),
    notionEslesmeleri: iliski(s, f.portfoyler), kontrol,
  };
}

/** Kişi kartında aradığı mülk yazılı ama bağlı talebi yoksa → talep türetilir (eşleştirmeye girsin diye) */
export function kisidenTalep(k: KisiTaslagi, olusturma: string): KayitTaslagi | null {
  if (!k.aradigi || k.bagliTalepVar || k.silindi) return null;
  const kontrol: string[] = ["Kişi kartındaki 'Aradığı Mülk' bilgisinden türetildi"];
  const ti = tipIslem(k.aradigi.tipler, null, k.alanlar.notlar ?? "", kontrol);
  return {
    tablo: "TALEP", notionId: `${k.notionId}#talep`, sonDuzenleme: k.sonDuzenleme, olusturma, silindi: false,
    girdi: { tip: "TALEP", ...ti, minFiyat: k.aradigi.minFiyat, maxFiyat: k.aradigi.maxFiyat, fiyatPeriyodu: periyot(ti.islemTipi, k.alanlar.notlar ?? "") as any, minM2: k.aradigi.minM2, maxM2: k.aradigi.maxM2,
      baslik: `${k.alanlar.adSoyad} — aradığı mülk`.slice(0, 160), hamMetin: k.alanlar.notlar, veriKanali: "NOTION", lokasyonHam: k.aradigi.bolgeler.join(", ").slice(0, 200) || null },
    bolgeler: k.aradigi.bolgeler, kisiBaglari: [{ notionId: k.notionId, rol: "MUSTERI" }], notionEslesmeleri: [], kontrol,
  };
}

export function sayfaTaslagi(t: NotionTablo, s: NotionSayfa) {
  return t === "KISI" ? kisiTaslagi(s) : t === "PORTFOY" ? portfoyTaslagi(s) : talepTaslagi(s);
}

/**
 * Taslak → doğrulanmış kayıt verisi: konumlar çözülür (Notion "Bölge" seçenekleri, alias sözlüğüyle; "Murtpaşa" → Muratpaşa),
 * kişi bağları Anahtar kişi kimliklerine çevrilir, KayitCreateSchema'dan geçirilir.
 */
export function kayitHazirla(t: KayitTaslagi, ix: LokasyonIndeks, kisiIdOf: (notionId: string) => string | undefined, validUntil?: Date):
  { veri: KayitCreateData | null; hatalar: string[]; kontrol: string[]; cozulemeyen: string[] } {
  const kontrol = [...t.kontrol];
  const r = t.bolgeler.length ? lokasyonCozumle(t.bolgeler, ix) : { lokasyonlar: [], cozulemeyen: [] };
  const lokasyonlar = r.lokasyonlar.map((l, i) => ({ ilId: ix.ilId, ilceId: l.ilceId ?? null, mahalleId: l.mahalleId ?? null, altBolgeId: l.altBolgeId ?? null, birincil: t.tablo === "PORTFOY" && i === 0 }));
  if (r.cozulemeyen.length) kontrol.push(`Tanınmayan bölge: ${r.cozulemeyen.join(", ")}`);
  if (!t.bolgeler.length) kontrol.push("Bölge yok");
  const kisiler = t.kisiBaglari.map((b) => ({ kisiId: kisiIdOf(b.notionId), rol: b.rol })).filter((b): b is { kisiId: string; rol: typeof b.rol } => !!b.kisiId);
  const tekil = kisiler.filter((b, i) => kisiler.findIndex((x) => x.kisiId === b.kisiId) === i).slice(0, 10);
  const p = KayitCreateSchema.safeParse({ ...t.girdi, lokasyonlar, kisiler: tekil, ...(validUntil ? { validUntil } : {}) });
  if (!p.success) return { veri: null, hatalar: p.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`), kontrol, cozulemeyen: r.cozulemeyen };
  return { veri: p.data, hatalar: [], kontrol, cozulemeyen: r.cozulemeyen };
}

// ───────── Birleştirilen (senkronlanan) kayıt alanları ─────────
export const NOTION_KAYIT_ALANLARI = ["baslik", "mulkTipi", "alternatifMulkTipleri", "islemTipi", "fiyat", "minFiyat", "maxFiyat", "fiyatPeriyodu", "m2", "minM2", "maxM2", "odaSayisi", "lokasyonHam", "aciliyet", "durum", "musteriKaynagi", "hamMetin", "operasyonNotu", "gondeTelefon"] as const;
export type NotionKayitAlan = (typeof NOTION_KAYIT_ALANLARI)[number];
export const NOTION_KISI_ALANLARI = ["adSoyad", "telefon", "notlar", "referans"] as const;
/** Karşılaştırma için sadeleştirilmiş kayıt alanları */
export function kayitAlanlari(v: Record<string, any>): Record<NotionKayitAlan, unknown> {
  return Object.fromEntries(NOTION_KAYIT_ALANLARI.map((a) => [a, v[a] instanceof Object && "toNumber" in v[a] ? Number(v[a]) : v[a] ?? null])) as any;
}