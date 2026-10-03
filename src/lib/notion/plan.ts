/**
 * Anahtar CRM v3.13 · 3 Ekim 2026
 * Notion → Anahtar içe aktarma planlayıcısı (saf). Ne ekleneceğine, neyin güncelleneceğine, neyin çakıştığına
 * karar verir; uygulamayı sunucu (Prisma) ya da demo (tarayıcı deposu) yapar.
 *
 * Eşleştirme sırası — kişi: Notion kimliği → telefon → aynı ad. Kayıt: Notion kimliği → "benzer kayıt"
 * (aynı tip, mülk tipi, işlem; alan ve fiyat %3 içinde; ortak ilçe). İlk bağlamada benzer kayıt bulunursa
 * ikinci kopya oluşturulmaz, mevcut kayıt Notion sayfasına bağlanır.
 */
import { ucYonluBirlestir, telAnahtari, type AlanCakismasi } from "../senkron/birlestir";
import { NOTION_KAYIT_ALANLARI, NOTION_KISI_ALANLARI, kayitAlanlari, type KisiTaslagi, type KayitTaslagi, type NotionKayitAlan } from "./donustur";
import type { KayitCreateData } from "../validation/kayit";

type KisiAlan = (typeof NOTION_KISI_ALANLARI)[number];
export interface MevcutNotionKisi { id: string; adSoyad: string; telefon: string | null; notlar: string | null; referans: string | null; roller: string[]; uzmanlikAileleri: string[]; ilanSahibiTipi: string; notionId: string | null; notionSnapshot: Record<string, unknown> | null }
export interface KisiPlani {
  ekle: { taslak: KisiTaslagi }[];
  guncelle: { id: string; taslak: KisiTaslagi; degisiklik: Record<string, unknown>; yeniRoller: string[]; yeniUzmanlik: string[]; ilanSahibiTipi: string | null; snapshot: Record<string, unknown>; baglandi: boolean; cakismalar: AlanCakismasi[] }[];
  /** Notion kimliği → Anahtar kişi kimliği (yeni eklenecekler "yeni:<notionId>") */
  kimlik: Map<string, string>;
}

export function kisiPlani(mevcut: MevcutNotionKisi[], gelen: KisiTaslagi[]): KisiPlani {
  const plan: KisiPlani = { ekle: [], guncelle: [], kimlik: new Map() };
  const byN = new Map(mevcut.filter((k) => k.notionId).map((k) => [k.notionId!, k]));
  const byTel = new Map<string, MevcutNotionKisi>(); mevcut.forEach((k) => { const a = telAnahtari(k.telefon); if (a && !byTel.has(a)) byTel.set(a, k); });
  const byAd = new Map<string, MevcutNotionKisi>(); mevcut.forEach((k) => byAd.set(k.adSoyad.toLocaleLowerCase("tr").trim(), k));
  const dokunulan = new Set<string>();
  for (const t of gelen) {
    if (t.silindi) continue; // Notion'da silinen kişi Anahtar'da silinmez (kayıtlara bağlı olabilir)
    const a = telAnahtari(t.alanlar.telefon);
    const k = byN.get(t.notionId) ?? (a ? byTel.get(a) : undefined) ?? byAd.get(t.alanlar.adSoyad.toLocaleLowerCase("tr").trim());
    if (!k || dokunulan.has(k.id)) {
      if (k) { plan.kimlik.set(t.notionId, k.id); continue; }
      plan.ekle.push({ taslak: t }); plan.kimlik.set(t.notionId, "yeni:" + t.notionId); continue;
    }
    dokunulan.add(k.id);
    plan.kimlik.set(t.notionId, k.id);
    const baglandi = k.notionId !== t.notionId;
    const b = ucYonluBirlestir<Record<KisiAlan, unknown>>(k as any, t.alanlar as any, baglandi ? null : (k.notionSnapshot as any), [...NOTION_KISI_ALANLARI]);
    const cakismalar = b.cakismalar.filter((c) => !(c.alan === "telefon" && telAnahtari(c.yerel as string) === telAnahtari(c.uzak as string)));
    plan.guncelle.push({
      id: k.id, taslak: t, degisiklik: b.degisiklik, snapshot: b.yeniSnapshot, baglandi, cakismalar,
      yeniRoller: t.roller.filter((r) => !k.roller.includes(r)), yeniUzmanlik: t.uzmanlikAileleri.filter((u) => !k.uzmanlikAileleri.includes(u)),
      ilanSahibiTipi: k.ilanSahibiTipi === "BILINMIYOR" ? t.ilanSahibiTipi : null,
    });
  }
  return plan;
}

// ───────── Kayıtlar ─────────
export interface MevcutNotionKayit {
  id: string; tip: "PORTFOY" | "TALEP"; notionId: string | null; notionSnapshot: Record<string, unknown> | null;
  veri: Record<string, any>; ilceler: number[];
}
export interface HazirKayit { taslak: KayitTaslagi; veri: KayitCreateData | null; hatalar: string[]; kontrol: string[] }
export interface KayitPlani {
  ekle: { taslak: KayitTaslagi; veri: KayitCreateData; kontrol: string[] }[];
  guncelle: { id: string; taslak: KayitTaslagi; veri: KayitCreateData; degisiklik: Partial<Record<NotionKayitAlan, unknown>>; snapshot: Record<string, unknown>; baglandi: boolean; cakismalar: AlanCakismasi[]; kontrol: string[] }[];
  arsivle: { id: string; notionId: string }[];
  hatali: { notionId: string; baslik: string; hatalar: string[] }[];
  /** Notion'da talebe elle bağlanmış portföyler: [talep notionId, portföy notionId] */
  notionEslesmeleri: [string, string][];
  ozet: { gelen: number; yeni: number; guncellenen: number; baglanan: number; degismeyen: number; cakisma: number; kontrol: number; hatali: number; arsivlenen: number };
}

const yakin = (a: unknown, b: unknown) => (a == null && b == null) || (a != null && b != null && Math.abs(Number(a) - Number(b)) <= 0.03 * Math.max(Number(a), Number(b)));
export function benzerKayit(v: KayitCreateData, mevcut: MevcutNotionKayit[]): MevcutNotionKayit | undefined {
  const ilceler = new Set(v.lokasyonlar.map((l) => l.ilceId).filter(Boolean));
  return mevcut.find((m) => !m.notionId && m.tip === v.tip && m.veri.mulkTipi === v.mulkTipi && m.veri.islemTipi === v.islemTipi
    && (v.tip === "PORTFOY" ? yakin(m.veri.m2, v.m2) && yakin(m.veri.fiyat, v.fiyat) : yakin(m.veri.maxFiyat, v.maxFiyat) && yakin(m.veri.minM2 ?? m.veri.maxM2, v.minM2 ?? v.maxM2))
    && (v.m2 ?? v.fiyat ?? v.maxFiyat ?? v.minM2) != null
    && (!ilceler.size || m.ilceler.some((i) => ilceler.has(i))));
}

export function kayitPlani(mevcut: MevcutNotionKayit[], gelen: HazirKayit[]): KayitPlani {
  const plan: KayitPlani = { ekle: [], guncelle: [], arsivle: [], hatali: [], notionEslesmeleri: [], ozet: { gelen: gelen.length, yeni: 0, guncellenen: 0, baglanan: 0, degismeyen: 0, cakisma: 0, kontrol: 0, hatali: 0, arsivlenen: 0 } };
  const byN = new Map(mevcut.filter((k) => k.notionId).map((k) => [k.notionId!, k]));
  const bagli = new Set<string>();
  for (const g of gelen) {
    const t = g.taslak;
    const var_ = byN.get(t.notionId);
    if (t.silindi) { if (var_ && var_.veri.durum !== "ARSIV") { plan.arsivle.push({ id: var_.id, notionId: t.notionId }); plan.ozet.arsivlenen++; } continue; }
    if (!g.veri) { plan.hatali.push({ notionId: t.notionId, baslik: String(t.girdi.baslik ?? t.notionId), hatalar: g.hatalar }); plan.ozet.hatali++; continue; }
    for (const p of t.notionEslesmeleri) plan.notionEslesmeleri.push([t.notionId, p]);
    const k = var_ ?? benzerKayit(g.veri, mevcut.filter((m) => !bagli.has(m.id)));
    if (!k) { plan.ekle.push({ taslak: t, veri: g.veri, kontrol: g.kontrol }); plan.ozet.yeni++; if (g.kontrol.length) plan.ozet.kontrol++; continue; }
    bagli.add(k.id);
    const baglandi = k.notionId !== t.notionId;
    const uzak = kayitAlanlari(g.veri);
    const b = ucYonluBirlestir<Record<NotionKayitAlan, unknown>>(kayitAlanlari(k.veri), uzak, baglandi ? null : (k.notionSnapshot as any), [...NOTION_KAYIT_ALANLARI]);
    // İlk bağlamada açıklayıcı alanlardaki fark (yerel konum/başlık genelde daha ayrıntılı) çakışma sayılmaz; yerel korunur
    const cakismalar = baglandi ? b.cakismalar.filter((c) => ILK_BAGLAMA_CAKISMA.has(c.alan)) : b.cakismalar;
    plan.guncelle.push({ id: k.id, taslak: t, veri: g.veri, degisiklik: b.degisiklik, snapshot: { ...b.yeniSnapshot, __tablo: t.tablo, __duzenleme: t.sonDuzenleme }, baglandi, cakismalar, kontrol: g.kontrol });
    if (baglandi) plan.ozet.baglanan++;
    else if (Object.keys(b.degisiklik).length) plan.ozet.guncellenen++;
    else plan.ozet.degismeyen++;
    plan.ozet.cakisma += cakismalar.length;
  }
  return plan;
}
const ILK_BAGLAMA_CAKISMA = new Set(["mulkTipi", "islemTipi", "fiyat", "minFiyat", "maxFiyat", "m2", "minM2", "maxM2", "durum"]);

/** Tam taramada Notion'da artık bulunmayan (silinmiş/çöpe atılmış) sayfalara bağlı kayıtlar */
export function kaybolanlar(mevcut: MevcutNotionKayit[], tablo: "PORTFOY" | "TALEP", gorulen: Set<string>): { id: string; notionId: string }[] {
  return mevcut.filter((m) => m.notionId && !m.notionId.includes("#") && m.tip === tablo && (m.notionSnapshot as any)?.__tablo === tablo && !gorulen.has(m.notionId) && m.veri.durum !== "ARSIV").map((m) => ({ id: m.id, notionId: m.notionId! }));
}

export const OZET_ETIKET: Record<string, string> = { yeni: "Yeni", guncellenen: "Güncellenen", baglanan: "Mevcut kayda bağlanan", degismeyen: "Değişmeyen", cakisma: "Çakışma", kontrol: "Kontrol gerekli", hatali: "Şemaya uymayan", arsivlenen: "Arşivlenen", silinen: "Kaynakta silinen", atlanan: "Atlanan", birlesen: "Birleşen kopya" };