/**
 * Anahtar CRM v3.21.2 · 8 Ekim 2026
 * DENEY TABANI — v3.10 motorunun dondurulmuş kopyası (yalnızca scripts/deney/model-karsilastir.ts kullanır; uygulama kullanmaz).
 * EŞLEŞTİRME MOTORU v2 (v3.5) — veritabanı ve yapay zekâ gerektirmeyen saf fonksiyon.
 * Metin benzerliği değil, ticari gayrimenkulün katı kuralları (Killer Criteria):
 *  1. Talep DNA'sı (talep-dna.ts): öldürücü kriterler = talepte "şart" denenler + kullanım amacının doğası
 *     (üretim → elektrik + ruhsat, soğuk zincir → soğuk hava…) + alan / bütçe / bölge (esnek denmedikçe).
 *  2. Öldürücü kriter karşılanmıyorsa UYGUN_DEGIL (skor ≤ 40). Bilinmiyorsa ya da talepte öldürücü bilgi
 *     eksikse en fazla KOSULLU ("sunmadan önce sor").
 *  3. Esnek: alan ±%20 / bütçe +%20; değilse alan ±%10 / bütçe +%10.
 *  4. Skor = Anahtar Uyum Matrisi (mülk grubuna göre ağırlıklar; talepte istenmeyen bileşen ağırlığı dağıtılır).
 *     Sanayi: Bölge 15 · Alan 15 · Fiyat 15 · Tip 10 · Elektrik 10 · Kullanım 10 · Yapı 5 · Ruhsat 5 · Açık alan 5 · Araç 5 · Diğer 5
 *  5. Lokasyon: aynı mahalle 1,0 · aynı alt bölge 0,9 · il geneli 0,8 · aynı ilçe 0,75 · komşu ilçe 0,4 · dışında 0.
 * Havuz sırası (Yetkili → CRM → Partner → Web ilanı) havuz.ts'de.
 */
import { MULK_OZELLIK_META, SIRALAMA, type MulkOzellikAlani } from "../../src/lib/domain/teknik-alanlar";
import { enIyiTipBenzerligi, MULK_TIPI_META } from "../../src/lib/domain/kategori";
import { odaSayisiAyristir } from "../../src/lib/domain/teknik-alanlar";
import { MULK_TIPI_META as TIP_META } from "../../src/lib/domain/kategori";
import { talepDnasi, type TalepDna } from "../../src/lib/eslestirme/talep-dna";

export type Uygunluk = "SUNULABILIR" | "KOSULLU" | "UYGUN_DEGIL";
export type KriterSonuc = "SAGLANDI" | "SAGLANMADI" | "BILINMIYOR";

export interface OnizlemeLokasyon {
  ilId: number;
  ilceId?: number | null;
  mahalleId?: number | null;
  altBolgeId?: number | null;
  birincil?: boolean;
}

export interface OnizlemeKayit {
  tip: "PORTFOY" | "TALEP";
  mulkTipi: string;
  alternatifMulkTipleri?: string[];
  islemTipi: string;
  alternatifIslemTipleri?: string[];
  fiyat?: number | null;
  minFiyat?: number | null;
  maxFiyat?: number | null;
  fiyatPeriyodu?: string;
  m2?: number | null;
  minM2?: number | null;
  maxM2?: number | null;
  m2ToleransYuzde?: number | null;
  odaSayisi?: string | null;
  krediyeUygun?: boolean | null;
  aciliyet?: string | null;
  lokasyonlar: OnizlemeLokasyon[];
  ozellik?: Record<string, unknown> & { kritikKriterler?: string[]; esnekKriterler?: string[]; eksikBilgiler?: string[]; kullanimAmaclari?: string[] };
}

export interface LokasyonBaglami {
  /** "ilceA-ilceB" (iki yönlü eklenmiş) */
  komsuIlceler: Set<string>;
  /** altBolgeId → o alt bölgenin mahalle ID'leri */
  altBolgeMahalleleri: Map<number, Set<number>>;
}

export interface KriterSatiri {
  anahtar: string;
  etiket: string;
  talep: string;
  portfoy: string;
  sonuc: KriterSonuc;
  kritik: boolean;
  /** v3.5 — 0–1 kısmi puan (tolerans içinde ama sınır dışı → 0,75) */
  puan?: number;
  /** v3.5 — matris bileşeni (ELEKTRIK, YAPI…) */
  bilesen?: string;
}

export interface MatrisBileseni { kod: string; etiket: string; agirlik: number; puan: number | null }

export interface OnizlemeSonucu {
  uygunluk: Uygunluk;
  skor: number; // 0–100
  /** v3.3 — mülk tipi uyumu: 1 aynı tip, 0.9 aynı aile, 0.4–0.6 benzer aile */
  tipUyumu: { oran: number; aciklama: string; talepTipi: string };
  lokasyonPuani: number | null; // null = lokasyon uyuşmuyor
  lokasyonAciklama: string;
  kriterler: KriterSatiri[];
  kritikEngeller: string[];
  bilinmeyenKritikler: string[];
  /** v3.5 — Anahtar Uyum Matrisi dökümü (puan null = talepte istenmedi, ağırlığı dağıtıldı) */
  matris: { ad: string; bilesenler: MatrisBileseni[] };
  /** v3.5 — talepte eksik öldürücü bilgiler (müşteriye sorulacak) */
  talepEksikleri: string[];
  dna: TalepDna;
}

// ───────── Anahtar Uyum Matrisi ─────────
type MatrisAdi = "SANAYI" | "TICARI" | "KONUT" | "ARSA";
const MATRISLER: Record<MatrisAdi, { ad: string; b: [string, string, number][] }> = {
  SANAYI: { ad: "Sanayi / depo", b: [["BOLGE", "Bölge", 15], ["ALAN", "Alan", 15], ["FIYAT", "Fiyat", 15], ["TIP", "Mülk tipi", 10], ["ELEKTRIK", "Elektrik", 10], ["KULLANIM", "Kullanım", 10], ["YAPI", "Yapı / yükseklik", 5], ["RUHSAT", "Ruhsat / iskan", 5], ["ACIK_ALAN", "Açık alan", 5], ["ARAC", "Araç erişimi", 5], ["DIGER", "Diğer", 5]] },
  TICARI: { ad: "Ticari", b: [["BOLGE", "Bölge", 20], ["ALAN", "Alan", 15], ["FIYAT", "Fiyat", 15], ["TIP", "Mülk tipi", 10], ["CEPHE", "Cephe / trafik", 15], ["RUHSAT", "Ruhsat / iskan", 5], ["OTOPARK", "Otopark", 5], ["KULLANIM", "Kullanım", 5], ["DIGER", "Diğer", 10]] },
  KONUT: { ad: "Konut", b: [["BOLGE", "Bölge", 20], ["FIYAT", "Fiyat", 20], ["ALAN", "Alan", 10], ["TIP", "Mülk tipi", 10], ["ODA", "Oda sayısı", 15], ["KONUT", "Konut özellikleri", 15], ["DIGER", "Diğer", 10]] },
  ARSA: { ad: "Arsa", b: [["BOLGE", "Bölge", 25], ["FIYAT", "Fiyat", 25], ["ALAN", "Alan", 20], ["IMAR", "İmar", 20], ["TIP", "Mülk tipi", 10]] },
};
/** Kriter → matris bileşeni (matriste yoksa DIGER) */
const BILESEN: Record<string, string> = {
  ALAN: "ALAN", KAPALI_ALAN: "ALAN", ARSA_ALANI: "ALAN", FIYAT: "FIYAT", MULK_TIPI: "TIP",
  ELEKTRIK: "ELEKTRIK", TRAFO: "ELEKTRIK", SANAYI_ELEKTRIGI: "ELEKTRIK",
  KULLANIM_AMACI: "KULLANIM", GIDAYA_UYGUNLUK: "KULLANIM", SOGUK_HAVA: "KULLANIM",
  YUKSEKLIK: "YAPI", CATI_DUVAR: "YAPI", KAPI: "YAPI", VINC: "YAPI", BINA_YASI: "YAPI",
  RUHSAT: "RUHSAT", ISKAN: "RUHSAT", IMAR: "IMAR", ACIK_ALAN: "ACIK_ALAN", ARAC_ERISIMI: "ARAC", RAMPA: "ARAC",
  CEPHE_VITRIN: "CEPHE", YAYA_TRAFIGI: "CEPHE", ARAC_TRAFIGI: "CEPHE", ZEMIN_KAT_GIRIS: "CEPHE", OTOPARK: "OTOPARK",
  ODA_SAYISI: "ODA", BANYO: "KONUT", ISINMA: "KONUT", ESYA: "KONUT", SITE_GUVENLIK: "KONUT", BALKON_BAHCE: "KONUT", CEPHE_YON: "KONUT", MANZARA: "KONUT", KREDI: "KONUT", KAT: "KONUT",
};
export function matrisOf(mulkTipi: string): MatrisAdi {
  const g = TIP_META[mulkTipi as keyof typeof TIP_META]?.grup;
  return g === "ENDUSTRIYEL" ? "SANAYI" : g === "KONUT" || g === "DEVRE_MULK" ? "KONUT" : g === "ARSA" ? "ARSA" : "TICARI";
}
const lokOran = (puan: number | null, ilGeneli: boolean) => (puan == null ? 0 : ilGeneli ? 0.8 : puan >= 20 ? 1 : puan >= 10 ? 0.9 : puan >= 0 ? 0.75 : 0.4);

const fmt = (v: unknown): string => {
  if (v == null) return "—";
  if (typeof v === "boolean") return v ? "Var" : "Yok";
  if (Array.isArray(v)) return v.length ? v.join(", ") : "—";
  if (typeof v === "number") return v.toLocaleString("tr-TR");
  return String(v);
};

/**
 * Talep ile portföyün temel uyumu (tip ve işlem). false ise hiç karşılaştırılmaz.
 * v3.3: tip uyumu src/lib/domain/kategori.ts'deki aile/benzerlik tablosundan gelir
 * (Depo ↔ Fabrika/İmalathane benzer, Dükkan ↔ Restoran benzer, Daire ↔ Depo asla).
 */
export function temelUyum(t: OnizlemeKayit, p: OnizlemeKayit): boolean {
  const islemler = new Set([t.islemTipi, ...(t.alternatifIslemTipleri ?? [])]);
  const tip = enIyiTipBenzerligi([t.mulkTipi, ...(t.alternatifMulkTipleri ?? [])] as any, p.mulkTipi as any);
  return (tip?.oran ?? 0) >= 0.4 && islemler.has(p.islemTipi);
}

function lokasyonPuani(t: OnizlemeKayit, p: OnizlemeKayit, b: LokasyonBaglami): { puan: number | null; aciklama: string } {
  const pl = p.lokasyonlar.find((l) => l.birincil) ?? p.lokasyonlar[0];
  if (!pl) return { puan: 0, aciklama: "Portföyün konumu girilmemiş" };
  if (!t.lokasyonlar.length) return { puan: 0, aciklama: "Talepte bölge sınırı yok (il geneli)" };
  // v3.10 — Türkiye geneli: talep başka bir ilde arıyorsa o ilin dışındaki portföy "bölge dışı"dır
  const tIller = new Set(t.lokasyonlar.map((l) => l.ilId).filter(Boolean));
  if (tIller.size && pl.ilId && !tIller.has(pl.ilId)) return { puan: null, aciklama: "Talep edilen ilin dışında" };
  if (t.lokasyonlar.every((l) => !l.ilceId && !l.altBolgeId)) return { puan: 0, aciklama: "Talepte bölge sınırı yok (il geneli)" };
  let enIyi: { puan: number | null; aciklama: string } = { puan: null, aciklama: "Talep edilen bölgelerin dışında" };
  const dene = (puan: number, aciklama: string) => {
    if (enIyi.puan == null || puan > enIyi.puan) enIyi = { puan, aciklama };
  };
  for (const tl of t.lokasyonlar) {
    if (tl.mahalleId && pl.mahalleId === tl.mahalleId) dene(20, "Aynı mahalle (+20)");
    else if (tl.altBolgeId) {
      const set = b.altBolgeMahalleleri.get(tl.altBolgeId);
      if ((pl.altBolgeId && pl.altBolgeId === tl.altBolgeId) || (pl.mahalleId && set?.has(pl.mahalleId))) dene(10, "Aynı alt bölge (+10)");
    } else if (tl.ilceId && pl.ilceId === tl.ilceId) dene(tl.mahalleId ? 0 : 0, tl.mahalleId ? "Aynı ilçe, farklı mahalle (0)" : "Aynı ilçe (0)");
    if (tl.ilceId && pl.ilceId && tl.ilceId !== pl.ilceId && b.komsuIlceler.has(`${tl.ilceId}-${pl.ilceId}`)) dene(-15, "Komşu ilçe (−15)");
    // Mahalle istenmiş ama portföy aynı ilçede başka mahallede → ilçe eşleşmesi say
    if (tl.mahalleId && pl.ilceId === tl.ilceId && pl.mahalleId !== tl.mahalleId) dene(0, "Aynı ilçe, farklı mahalle (0)");
  }
  return enIyi;
}

function karsilastir(alan: MulkOzellikAlani, tv: unknown, pv: unknown): KriterSonuc {
  const meta = MULK_OZELLIK_META[alan];
  if (pv == null) return "BILINMIYOR";
  switch (meta.karsilastirma) {
    case "min": return (pv as number) >= (tv as number) ? "SAGLANDI" : "SAGLANMADI";
    case "max": return (pv as number) <= (tv as number) ? "SAGLANDI" : "SAGLANMADI";
    case "bool":
      if (alan === "otoparkDurumu") return tv === "YOK" || pv !== "YOK" ? "SAGLANDI" : "SAGLANMADI";
      return tv === true ? (pv === true ? "SAGLANDI" : "SAGLANMADI") : "SAGLANDI";
    case "sirali": {
      const s = SIRALAMA[alan as keyof typeof SIRALAMA] as readonly string[];
      return s.indexOf(pv as string) >= s.indexOf(tv as string) ? "SAGLANDI" : "SAGLANMADI";
    }
    case "esit": return pv === tv ? "SAGLANDI" : "SAGLANMADI";
    case "kume": {
      const a = tv as string[], bb = pv as string[];
      if (!a?.length) return "SAGLANDI";
      if (!bb?.length) return "BILINMIYOR";
      return a.some((x) => bb.includes(x)) ? "SAGLANDI" : "SAGLANMADI";
    }
    default: return "SAGLANDI";
  }
}

export function eslesmeOnizle(t: OnizlemeKayit, p: OnizlemeKayit, b: LokasyonBaglami): OnizlemeSonucu {
  const dna = talepDnasi(t as any);
  const kritik = new Set(dna.kritik.map((k) => k.kriter));
  const esnek = new Set(t.ozellik?.esnekKriterler ?? []);
  const satirlar: KriterSatiri[] = [];

  // Mülk tipi
  const tu = enIyiTipBenzerligi([t.mulkTipi, ...(t.alternatifMulkTipleri ?? [])] as any, p.mulkTipi as any);
  const tipUyumu = { oran: tu.oran, aciklama: tu.aciklama, talepTipi: tu.tip };
  if (tu.oran < 1) satirlar.push({ anahtar: "mulkTipi", etiket: "Mülk tipi", talep: String(MULK_TIPI_META[tu.tip as keyof typeof MULK_TIPI_META]?.etiket ?? tu.tip), portfoy: String(MULK_TIPI_META[p.mulkTipi as keyof typeof MULK_TIPI_META]?.etiket ?? p.mulkTipi), sonuc: tu.oran >= 0.9 ? "SAGLANDI" : "BILINMIYOR", kritik: kritik.has("MULK_TIPI"), bilesen: "TIP_SATIR" });
  // Oda sayısı (konut / ofis): talepteki oda en az olarak okunur ("3+1" → en az 3 oda)
  const to = odaSayisiAyristir(t.odaSayisi), po = odaSayisiAyristir(p.odaSayisi);
  if (to) satirlar.push({ anahtar: "odaSayisi", etiket: "Oda sayısı", talep: `en az ${t.odaSayisi}`, portfoy: p.odaSayisi ?? "—", sonuc: !po ? "BILINMIYOR" : po.oda >= to.oda ? "SAGLANDI" : "SAGLANMADI", kritik: kritik.has("ODA_SAYISI"), bilesen: "ODA" });
  if (t.krediyeUygun) satirlar.push({ anahtar: "krediyeUygun", etiket: "Krediye uygun", talep: "İstiyor", portfoy: p.krediyeUygun == null ? "—" : p.krediyeUygun ? "Var" : "Yok", sonuc: p.krediyeUygun == null ? "BILINMIYOR" : p.krediyeUygun ? "SAGLANDI" : "SAGLANMADI", kritik: kritik.has("KREDI"), bilesen: "KONUT" });
  // Alan (m²) — tolerans DNA'dan: esnek ±%20, değilse ±%10
  const tol = 1 + dna.m2Tolerans / 100;
  if (t.minM2 != null || t.maxM2 != null) {
    const pm2 = p.m2 ?? (p.ozellik?.kapaliAlanM2 as number | undefined) ?? (p.ozellik?.arsaAlanM2 as number | undefined) ?? null;
    const siki = pm2 != null && (t.minM2 == null || pm2 >= t.minM2) && (t.maxM2 == null || pm2 <= t.maxM2);
    const tolerans = pm2 != null && (t.minM2 == null || pm2 >= t.minM2 * (2 - tol)) && (t.maxM2 == null || pm2 <= t.maxM2 * tol); // ±%: 1000 m² → 800 / 900
    const sonuc: KriterSonuc = pm2 == null ? "BILINMIYOR" : tolerans ? "SAGLANDI" : "SAGLANMADI";
    satirlar.push({ anahtar: "m2", etiket: `Alan (±%${dna.m2Tolerans})`, talep: `${fmt(t.minM2)} – ${fmt(t.maxM2)} m²`, portfoy: pm2 == null ? "—" : `${fmt(pm2)} m²`, sonuc, kritik: kritik.has("ALAN"), puan: pm2 == null ? 0.5 : siki ? 1 : tolerans ? 0.75 : 0, bilesen: "ALAN" });
  }
  // Fiyat — esnek bütçe +%20, değilse +%10
  if (t.maxFiyat != null) {
    const pf = p.fiyat ?? null;
    const periyotFarkli = p.fiyatPeriyodu && t.fiyatPeriyodu && p.fiyatPeriyodu !== t.fiyatPeriyodu;
    const ust = t.maxFiyat * (1 + dna.fiyatTolerans / 100);
    const sonuc: KriterSonuc = pf == null || periyotFarkli ? "BILINMIYOR" : pf <= ust ? "SAGLANDI" : "SAGLANMADI";
    satirlar.push({ anahtar: "fiyat", etiket: `Fiyat (≤ bütçe +%${dna.fiyatTolerans})`, talep: `≤ ${fmt(t.maxFiyat)}`, portfoy: pf == null ? "—" : fmt(pf) + (periyotFarkli ? ` (${p.fiyatPeriyodu})` : ""), sonuc, kritik: kritik.has("FIYAT"), puan: sonuc === "BILINMIYOR" ? 0.5 : pf! <= t.maxFiyat ? 1 : sonuc === "SAGLANDI" ? 0.75 : 0, bilesen: "FIYAT" });
  }
  // Teknik alanlar: talepte dolu olan her karşılaştırılabilir alan
  for (const [alan, tv] of Object.entries(t.ozellik ?? {})) {
    const meta = MULK_OZELLIK_META[alan as MulkOzellikAlani];
    if (!meta || meta.karsilastirma === "bilgi" || tv == null || (Array.isArray(tv) && !tv.length)) continue;
    if (meta.karsilastirma === "bool" && tv === false) continue; // "istemiyorum" kısıt değildir
    const pv = p.ozellik?.[alan];
    const kr = "kriter" in meta ? (meta.kriter as string | undefined) : undefined;
    satirlar.push({
      anahtar: alan, etiket: meta.etiket + ("birim" in meta && meta.birim ? ` (${meta.birim})` : ""),
      talep: meta.karsilastirma === "min" ? `≥ ${fmt(tv)}` : meta.karsilastirma === "max" ? `≤ ${fmt(tv)}` : meta.karsilastirma === "sirali" ? `en az ${fmt(tv)}` : fmt(tv),
      portfoy: fmt(pv), sonuc: karsilastir(alan as MulkOzellikAlani, tv, pv),
      kritik: !!kr && kritik.has(kr), bilesen: kr ? BILESEN[kr] ?? "DIGER" : "DIGER",
    });
  }

  const lok = lokasyonPuani(t, p, b);
  const lokKritik = !esnek.has("LOKASYON");
  const kritikEngeller = satirlar.filter((s) => s.kritik && s.sonuc === "SAGLANMADI").map((s) => s.etiket);
  if (lok.puan == null && lokKritik) kritikEngeller.push("Lokasyon");
  const bilinmeyenKritikler = satirlar.filter((s) => s.kritik && s.sonuc === "BILINMIYOR").map((s) => s.etiket);
  const talepEksikleri = dna.eksik.filter((e) => e.oldurucu && e.kriter !== "LOKASYON").map((e) => e.etiket);

  // Anahtar Uyum Matrisi
  const mAdi = matrisOf(t.mulkTipi), M = MATRISLER[mAdi];
  const kodlar = new Set(M.b.map((x) => x[0]));
  const ilGeneli = !t.lokasyonlar.some((l) => l.ilceId || l.altBolgeId);
  const puanOf = (s: KriterSatiri) => s.puan ?? (s.sonuc === "SAGLANDI" ? 1 : s.sonuc === "SAGLANMADI" ? 0 : 0.5);
  const bilesenler: MatrisBileseni[] = M.b.map(([kod, etiket, agirlik]) => {
    if (kod === "BOLGE") return { kod, etiket, agirlik, puan: lokOran(lok.puan, ilGeneli) };
    if (kod === "TIP") return { kod, etiket, agirlik, puan: tipUyumu.oran };
    const ss = satirlar.filter((s) => s.bilesen && s.bilesen !== "TIP_SATIR" && (kodlar.has(s.bilesen) ? s.bilesen : "DIGER") === kod);
    return { kod, etiket, agirlik, puan: ss.length ? ss.reduce((a, s) => a + puanOf(s), 0) / ss.length : null };
  });
  const sayilan = bilesenler.filter((x) => x.puan != null);
  const toplamW = sayilan.reduce((a, x) => a + x.agirlik, 0);
  let skor = Math.round((100 * sayilan.reduce((a, x) => a + x.agirlik * (x.puan as number), 0)) / Math.max(1, toplamW));
  skor -= 5 * talepEksikleri.length; // talepte öldürücü bilgi eksikse skor "kesin" görünmesin
  skor = Math.max(0, Math.min(100, skor));

  const uygunluk: Uygunluk = kritikEngeller.length ? "UYGUN_DEGIL"
    : bilinmeyenKritikler.length || talepEksikleri.length || tipUyumu.oran < 0.9 || satirlar.some((s) => s.sonuc === "SAGLANMADI") ? "KOSULLU" : "SUNULABILIR";
  return {
    uygunluk, tipUyumu, skor: uygunluk === "UYGUN_DEGIL" ? Math.min(skor, 40) : skor, lokasyonPuani: lok.puan, lokasyonAciklama: lok.aciklama,
    kriterler: satirlar, kritikEngeller, bilinmeyenKritikler, matris: { ad: M.ad, bilesenler }, talepEksikleri, dna,
  };
}