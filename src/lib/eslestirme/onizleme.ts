/**
 * Anahtar CRM v3.23 · 10 Ekim 2026
 * EŞLEŞTİRME MOTORU v3 (v3.11; v2 = v3.5) — veritabanı ve yapay zekâ gerektirmeyen saf fonksiyon.
 * Metin benzerliği değil, ticari gayrimenkulün katı kuralları (Killer Criteria):
 *  1. Talep DNA'sı (talep-dna.ts): öldürücü kriterler = talepte "şart" denenler + kullanım amacının doğası
 *     (üretim → elektrik + ruhsat, soğuk zincir → soğuk hava…) + alan / bütçe / bölge (esnek denmedikçe).
 *  2. Öldürücü kriter karşılanmıyorsa UYGUN_DEGIL (skor ≤ 40). Bilinmiyorsa ya da talepte öldürücü bilgi
 *     eksikse en fazla KOSULLU ("sunmadan önce sor").
 *  3. Esnek: alan ±%20 / bütçe +%20; değilse alan ±%10 / bütçe +%10.
 *  4. Skor = Anahtar Uyum Matrisi (mülk grubuna göre ağırlıklar; talepte istenmeyen bileşen ağırlığı dağıtılır).
 *     Sanayi: Bölge 15 · Alan 15 · Fiyat 15 · Tip 10 · Elektrik 10 · Kullanım 10 · Yapı 5 · Ruhsat 5 · Açık alan 5 · Araç 5 · Diğer 5
 *  5. Lokasyon (v3.11 — mahalle komşuluğu, src/lib/lokasyon/komsuluk.ts): istenen mahalle / alt bölge / ilçe 1,0 ·
 *     sınır komşusu mahalle 0,85 · sınırdan ≤ 1,5 km 0,65 · ≤ 3 km 0,40 (koşullu) · daha uzak = bölge dışı
 *     ("bölge esnek" denmişse ≤ 5 km 0,15) · il geneli 0,8. İlçe sınırı engel değildir: Meltem (Muratpaşa) ↔ Arapsuyu (Konyaaltı) komşudur.
 *     Sınır verisi olmayan yerde (başka il, mahallesi girilmemiş portföy) eski kural: aynı ilçe 0,75 · komşu ilçe 0,4.
 *  6. Oda (v3.11): istenen oda 1,0 · bir oda fazla 0,6 · iki+ oda fazla ya da eksik = sağlanmadı.
 *  7. Bütçe altı (v3.11): fiyat bütçenin çok altındaysa (< %60 → 0,8 · < %40 → 0,6) puan düşer; talepte alt sınır varsa o kullanılır.
 *  8. Bir bileşenin puanı 0,6'nın altındaysa eşleşme en fazla KOŞULLU olur (v3.10'da uzak mahalle "Sunulabilir" çıkıyordu).
 * Sayılar MODEL'de (aşağıda) durur; seçim gerekçesi ve deney: scripts/deney/model-karsilastir.ts, ALTYAPI §28.
 * Havuz sırası (Yetkili → CRM → Partner → Web ilanı) havuz.ts'de.
 */
import { MULK_OZELLIK_META, SIRALAMA, type MulkOzellikAlani } from "../domain/teknik-alanlar";
import { enIyiTipBenzerligi, MULK_TIPI_META } from "../domain/kategori";
import { odaSayisiAyristir, odaListesi, odaFarkPuani, istenenKatlarOf, katUyumu, katYaz } from "../domain/teknik-alanlar";

/** v3.15 — iki taraf da takasa açıksa eşleşme puanına eklenen küçük bonus (ayrı kriter satırı; uygunluk kararını değiştirmez). */
export const TAKAS_BONUS = 3;

/** v3.17 — skorun tavana çıkabilmesi için karşılaştırılabilmiş olması gereken alan sayısı */
export const VERI_YETERLI = 6;
/** v3.17 — eksik her alan için skor tavanından düşülen puan */
export const EKSIK_VERI_CEZASI = 7;
/** v3.19 — ölçülemeyen çekirdek bileşenin (alan/oda/fiyat) puanı: 1'e değil, kararsız 0,4'e sayılır */
export const BILINMEYEN_PUAN = 0.4;
/**
 * v3.22 — fiyat karşılaştırılamayan eşleşmenin (talepte bütçe ya da portföyde fiyat yok) skor çarpanı.
 * Ölçüm (v3.21): bütçesiz ama bölge / oda / m² tutan konut talebi 84, depo talebi 85 alıyordu; aynı talep bütçeyle 100.
 * Fiyatı hiç bilinmeyen bir eşleşme, bütçesi doğrulanmış çoğu eşleşmenin önüne geçiyordu.
 * Çarpan 0,75: en iyi bütçesiz eşleşme ~63–69'da kalır ("Skor ≥ 70" süzgecinin ve portföy edinme eşiği 80'in altı);
 * düz tavan yerine çarpan, bütçesizler arasındaki sırayı korur (m²'si de eksik olan daha aşağıda kalır).
 */
export const FIYATSIZ_CARPAN = 0.75;
/** v3.22.1 — talepte "istemiyor" denince portföyde var olması uyumsuzluk sayılan evet/hayır alanları */
export const ISTENMEYEBILIR: ReadonlySet<string> = new Set(["siteIcinde", "havuz"]);

/** v3.17 — iki kayıtta da boş olan ve skoru şüpheli kılan temel alanlar (kullanıcıya "tamamlayın" denir) */
export function eksikVeriUyarilari(t: OnizlemeKayit, p: OnizlemeKayit): string[] {
  const u: string[] = [];
  const talepAlan = t.minM2 == null && t.maxM2 == null, portfoyAlan = p.m2 == null;
  if (talepAlan || portfoyAlan) u.push(`m² bilgisi yok (${talepAlan && portfoyAlan ? "talep ve portföy" : talepAlan ? "talep" : "portföy"})`);
  // oda yalnızca konut grubunda aranır (depo, arsa, dükkan için anlamsız uyarı verilmez)
  if (matrisOf(t.mulkTipi) === "KONUT" && !t.odaSayisi && !p.odaSayisi) u.push("oda sayısı yok");
  if (t.maxFiyat == null && t.minFiyat == null) u.push("talepte bütçe yok");
  if (p.fiyat == null) u.push("portföyde fiyat yok");
  const mahalle = (x: OnizlemeKayit) => arananLok(x.lokasyonlar).some((l) => l.mahalleId != null || l.altBolgeId != null);
  if (!mahalle(t) && !mahalle(p)) u.push("konum yalnızca ilçe düzeyinde");
  const oz = (x: OnizlemeKayit) => Object.keys(x.ozellik ?? {}).length;
  if (oz(t) + oz(p) === 0) u.push("teknik özellik girilmemiş");
  return u;
}
import { MULK_TIPI_META as TIP_META } from "../domain/kategori";
import { talepDnasi, type TalepDna } from "./talep-dna";
import type { KomsulukIndeksi, MahalleYakinligi } from "../lokasyon/komsuluk";
import { arananLok, haricLok, haricteMi } from "../lokasyon/haric";

/** v3.11 — puanlama modeli. Değerler etiketli senaryo deneyinde seçildi (scripts/deney/model-karsilastir.ts). */
export interface ModelAyar {
  lok: {
    /** sınır komşusu mahalle */ komsu: number;
    /** sınırdan ≤ yakinM */ yakin: number; yakinM: number;
    /** sınırdan ≤ ortaM (koşullu) */ orta: number; ortaM: number;
    /** sınırdan ≤ uzakM — yalnızca "bölge esnek" talepte sayılır */ uzak: number; uzakM: number;
    /** talep yalnızca ilçe demiş, portföy o ilçede */ ilce: number;
    /** sınır verisi yokken: aynı ilçe / komşu ilçe */ ilceVerisiz: number; komsuIlce: number;
    /** alt bölgenin mahalleleri tanımlı değil, portföy aynı ilçede */ altBolgeTanimsiz: number;
    ilGeneli: number;
  };
  oda: { fazla1: number; fazla2: number };
  /** fiyat / bütçe oranı esik'in altındaysa puan; null = bütçe altı cezası yok */
  fiyatAlt: { esik1: number; puan1: number; esik2: number; puan2: number } | null;
  /** bir bileşenin puanı bunun altındaysa eşleşme en fazla KOŞULLU */
  kosulluAlti: number;
}
export const MODEL: ModelAyar = {
  lok: { komsu: 0.85, yakin: 0.65, yakinM: 1500, orta: 0.4, ortaM: 3000, uzak: 0.15, uzakM: 5000, ilce: 1, ilceVerisiz: 0.75, komsuIlce: 0.4, altBolgeTanimsiz: 0.5, ilGeneli: 0.8 },
  oda: { fazla1: 0.6, fazla2: 0.25 },
  fiyatAlt: { esik1: 0.6, puan1: 0.8, esik2: 0.4, puan2: 0.6 },
  kosulluAlti: 0.6,
};
export type LokasyonKademe = "AYNI_MAHALLE" | "ALT_BOLGE" | "ILCE" | "KOMSU_MAHALLE" | "YAKIN" | "ORTA" | "UZAK" | "ILCE_VERISIZ" | "KOMSU_ILCE" | "IL_GENELI" | "BILINMIYOR" | "DISINDA";

export type Uygunluk = "SUNULABILIR" | "KOSULLU" | "UYGUN_DEGIL";
export type KriterSonuc = "SAGLANDI" | "SAGLANMADI" | "BILINMIYOR";

export interface OnizlemeLokasyon {
  ilId: number;
  ilceId?: number | null;
  mahalleId?: number | null;
  altBolgeId?: number | null;
  birincil?: boolean;
  /** v3.22 — talepte hariç tutulan bölge ("Hurma, Sarısu HARİÇ"): portföy burada ise eşleşme kesin engellenir */
  haric?: boolean;
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
  /** v3.15 — takasa açık (talep ve portföy) */
  takasaAcik?: boolean | null;
  aciliyet?: string | null;
  lokasyonlar: OnizlemeLokasyon[];
  ozellik?: Record<string, unknown> & { kritikKriterler?: string[]; esnekKriterler?: string[]; eksikBilgiler?: string[]; kullanimAmaclari?: string[] };
}

export interface LokasyonBaglami {
  /** "ilceA-ilceB" (iki yönlü eklenmiş) */
  komsuIlceler: Set<string>;
  /** altBolgeId → o alt bölgenin mahalle ID'leri */
  altBolgeMahalleleri: Map<number, Set<number>>;
  /** v3.11 — mahalle komşuluk / mesafe tablosu (yoksa eski ilçe kuralı işler) */
  komsuluk?: KomsulukIndeksi;
  /** v3.11 — açıklama metni için mahalle adı ("Komşu mahalle · Fener'e sınır") */
  mahalleAdi?: (mahalleId: number) => string | undefined;
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
  /** Eski gösterge (+20 aynı mahalle · +10 alt bölge · 0 · −15 komşu ilçe); null = bölge dışı. Skoru lokasyonOrani belirler. */
  lokasyonPuani: number | null;
  /** v3.11 — konum uyumu 0–1 (matristeki "Bölge" bileşeninin puanı) */
  lokasyonOrani: number;
  /** v3.11 — konum kademesi (ekranda etiket ve filtre için) */
  lokasyonKademe: LokasyonKademe;
  /** v3.11 — istenen bölgeye sınırdan sınıra mesafe (m); komşuysa 0, bilinmiyorsa null */
  lokasyonMesafeM: number | null;
  lokasyonAciklama: string;
  kriterler: KriterSatiri[];
  kritikEngeller: string[];
  bilinmeyenKritikler: string[];
  /** v3.5 — Anahtar Uyum Matrisi dökümü (puan null = talepte istenmedi, ağırlığı dağıtıldı) */
  matris: { ad: string; bilesenler: MatrisBileseni[] };
  /** v3.5 — talepte eksik öldürücü bilgiler (müşteriye sorulacak) */
  talepEksikleri: string[];
  /** v3.17 — "Genel özellikler eksik, tamamlayın": skorun güvenilir olması için doldurulması gereken alanlar */
  veriEksikleri: string[];
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

interface LokSonuc { puan: number | null; oran: number; kademe: LokasyonKademe; mesafeM: number | null; aciklama: string; /** portföyün mahallesi bilinmiyor → sunmadan önce sor */ belirsiz?: boolean; /** v3.22 — portföy talebin hariç tuttuğu yerde */ haric?: boolean }
const kmYaz = (m: number) => (m < 950 ? `${Math.max(100, Math.round(m / 100) * 100)} m` : `${(m / 1000).toFixed(1).replace(".", ",")} km`);

/**
 * v3.11 — konum uyumu. Talebin her bölgesi için portföyün (birincil) konumuna bakılır, en iyisi alınır.
 * Sıra: tam istenen yer → mahalle komşuluğu / mesafesi (sınır verisi varsa) → eski ilçe kuralı (veri yoksa).
 */
function lokasyonPuani(t0: OnizlemeKayit, p: OnizlemeKayit, b: LokasyonBaglami, A: ModelAyar, esnek: boolean): LokSonuc {
  const L = A.lok;
  const pl = p.lokasyonlar.find((l) => l.birincil) ?? p.lokasyonlar[0];
  if (!pl) return { puan: 0, oran: L.ilGeneli, kademe: "BILINMIYOR", mesafeM: null, aciklama: "Portföyün konumu girilmemiş" };
  // v3.22 — hariç tutulan bölge: "Hurma, Sarısu HARİÇ" → Hurma'daki portföy "bölge esnek" denmiş olsa da elenir
  const h = haricteMi(pl, haricLok(t0.lokasyonlar), b.altBolgeMahalleleri);
  if (h) {
    const ad = (h.mahalleId && b.mahalleAdi?.(h.mahalleId)) || null;
    return { puan: null, oran: 0, kademe: "DISINDA", mesafeM: null, aciklama: `Talepte hariç tutulan bölge${ad ? ` · ${ad}` : ""}`, haric: true };
  }
  const t = { ...t0, lokasyonlar: arananLok(t0.lokasyonlar) };
  if (!t.lokasyonlar.length) return { puan: 0, oran: L.ilGeneli, kademe: "IL_GENELI", mesafeM: null, aciklama: "Talepte bölge sınırı yok (il geneli)" };
  // v3.10 — Türkiye geneli: talep başka bir ilde arıyorsa o ilin dışındaki portföy "bölge dışı"dır
  const tIller = new Set(t.lokasyonlar.map((l) => l.ilId).filter(Boolean));
  if (tIller.size && pl.ilId && !tIller.has(pl.ilId)) return { puan: null, oran: 0, kademe: "DISINDA", mesafeM: null, aciklama: "Talep edilen ilin dışında" };
  if (t.lokasyonlar.every((l) => !l.ilceId && !l.altBolgeId)) return { puan: 0, oran: L.ilGeneli, kademe: "IL_GENELI", mesafeM: null, aciklama: "Talepte bölge sınırı yok (il geneli)" };

  let enIyi: LokSonuc = { puan: null, oran: 0, kademe: "DISINDA", mesafeM: null, aciklama: "Talep edilen bölgelerin dışında" };
  const dene = (s: LokSonuc) => { if (s.oran > enIyi.oran || (s.oran === enIyi.oran && enIyi.puan == null && s.puan != null)) enIyi = s; };
  const K = b.komsuluk;
  const ad = (id?: number | null) => (id && b.mahalleAdi?.(id)) || null;
  const pVeri = !!(K && pl.mahalleId && K.veriVar(pl.mahalleId));
  /** Mesafe kademesi: komşu → yakın → orta → (esnekse) uzak → bölge dışı */
  const kademele = (y: MahalleYakinligi | null, hedef: string | null) => {
    if (!y) return;
    const neye = hedef ? `${hedef} sınırına ` : "sınıra ";
    if (y.komsu) dene({ puan: 0, oran: L.komsu, kademe: "KOMSU_MAHALLE", mesafeM: 0, aciklama: hedef ? `Komşu mahalle · ${hedef} ile sınır` : "Komşu mahalle" });
    else if (y.mesafeM <= L.yakinM) dene({ puan: 0, oran: L.yakin, kademe: "YAKIN", mesafeM: y.mesafeM, aciklama: `Yakın mahalle · ${neye}${kmYaz(y.mesafeM)}` });
    else if (y.mesafeM <= L.ortaM) dene({ puan: 0, oran: L.orta, kademe: "ORTA", mesafeM: y.mesafeM, aciklama: `Biraz uzak · ${neye}${kmYaz(y.mesafeM)}` });
    else if (y.mesafeM <= L.uzakM) {
      // Uzak: yalnızca "bölge esnek" denmişse sayılır; değilse bölge dışıdır (mesafe yine de açıklamaya yazılır)
      if (esnek) dene({ puan: 0, oran: L.uzak, kademe: "UZAK", mesafeM: y.mesafeM, aciklama: `Uzak · ${neye}${kmYaz(y.mesafeM)}` });
      else if (enIyi.puan == null && (enIyi.mesafeM == null || y.mesafeM < enIyi.mesafeM)) enIyi = { ...enIyi, mesafeM: y.mesafeM, aciklama: `Bölge dışı · ${neye}${kmYaz(y.mesafeM)}` };
    }
  };
  for (const tl of t.lokasyonlar) {
    // 1) Tam istenen yer
    if (tl.mahalleId && pl.mahalleId === tl.mahalleId) { dene({ puan: 20, oran: 1, kademe: "AYNI_MAHALLE", mesafeM: 0, aciklama: "Aynı mahalle (+20)" }); continue; }
    const set = tl.altBolgeId ? b.altBolgeMahalleleri.get(tl.altBolgeId) : undefined;
    if (tl.altBolgeId && ((pl.altBolgeId && pl.altBolgeId === tl.altBolgeId) || (pl.mahalleId && set?.has(pl.mahalleId)))) { dene({ puan: 10, oran: 1, kademe: "ALT_BOLGE", mesafeM: 0, aciklama: "Aynı alt bölge (+10)" }); continue; }
    if (!tl.mahalleId && !tl.altBolgeId && tl.ilceId && pl.ilceId === tl.ilceId) { dene({ puan: 0, oran: L.ilce, kademe: "ILCE", mesafeM: 0, aciklama: "Aynı ilçe (0)" }); continue; }
    // 2) Mahalle komşuluğu / mesafesi (sınır verisi olan yerde)
    let olculdu = false;
    if (K && pVeri) {
      if (tl.mahalleId && K.veriVar(tl.mahalleId)) { olculdu = true; kademele(K.mahalle(tl.mahalleId, pl.mahalleId!), ad(tl.mahalleId)); }
      else if (tl.altBolgeId && set?.size) {
        const olc = [...set].filter((m) => K.veriVar(m));
        if (olc.length) {
          olculdu = true;
          let y: MahalleYakinligi | null = null, hedef: number | null = null;
          for (const m of olc) { const x = K.mahalle(m, pl.mahalleId!); if (x && (!y || (x.komsu && !y.komsu) || (x.komsu === y.komsu && x.mesafeM < y.mesafeM))) { y = x; hedef = m; } }
          kademele(y, ad(hedef));
        }
      } else if (!tl.mahalleId && !tl.altBolgeId && tl.ilceId) { olculdu = true; kademele(K.ilceye(pl.mahalleId!, tl.ilceId), null); }
    }
    if (olculdu) continue;
    // 3) Sınır verisi yok (başka il, mahallesi girilmemiş portföy, mahalleleri tanımsız alt bölge) → ilçe kuralı
    if (tl.ilceId && pl.ilceId === tl.ilceId) {
      if (tl.altBolgeId) dene({ puan: 0, oran: L.altBolgeTanimsiz, kademe: "ILCE_VERISIZ", mesafeM: null, aciklama: "Aynı ilçe · alt bölgeye uzaklığı bilinmiyor" });
      else dene({ puan: 0, oran: L.ilceVerisiz, kademe: "ILCE_VERISIZ", mesafeM: null, aciklama: pl.mahalleId ? "Aynı ilçe, farklı mahalle (0)" : "Aynı ilçe · portföyün mahallesi girilmemiş", belirsiz: !pl.mahalleId && !!(tl.mahalleId || tl.altBolgeId) });
    } else if (tl.ilceId && pl.ilceId && b.komsuIlceler.has(`${tl.ilceId}-${pl.ilceId}`)) dene({ puan: -15, oran: L.komsuIlce, kademe: "KOMSU_ILCE", mesafeM: null, aciklama: "Komşu ilçe (−15)" });
  }
  return enIyi;
}

/** v3.22.1 — satış işlemleri: fiyat her zaman toplam bedeldir (kayıttaki periyot yanlış girilmiş olsa da) */
export const SATIS_ISLEMLERI: ReadonlySet<string> = new Set(["SATILIK", "DEVREN_SATILIK", "KAT_KARSILIGI", "TAKAS"]);
/** Kaydın fiyat periyodu, işlem tipine göre düzeltilmiş hâli */
export function etkinPeriyot(k: { islemTipi: string; fiyatPeriyodu?: string | null }, islem = k.islemTipi): string {
  if (SATIS_ISLEMLERI.has(islem)) return "TOPLAM";
  return k.fiyatPeriyodu ?? (/KIRALIK/.test(islem) ? "AYLIK" : "TOPLAM");
}
/** Portföy fiyatını talebin periyoduna çevirir (aylık ↔ yıllık); çevrilemiyorsa farkli = true */
function periyotlar(t: OnizlemeKayit, p: OnizlemeKayit): { tPer: string; pPer: string; carpan: number; farkli: boolean } {
  const tPer = etkinPeriyot(t, p.islemTipi), pPer = etkinPeriyot(p);
  if (tPer === pPer) return { tPer, pPer, carpan: 1, farkli: false };
  if (tPer === "AYLIK" && pPer === "YILLIK") return { tPer, pPer, carpan: 1 / 12, farkli: false };
  if (tPer === "YILLIK" && pPer === "AYLIK") return { tPer, pPer, carpan: 12, farkli: false };
  return { tPer, pPer, carpan: 1, farkli: true };
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

export function eslesmeOnizle(t: OnizlemeKayit, p: OnizlemeKayit, b: LokasyonBaglami, ayar: ModelAyar = MODEL): OnizlemeSonucu {
  const A = ayar;
  const dna = talepDnasi(t as any);
  const kritik = new Set(dna.kritik.map((k) => k.kriter));
  const esnek = new Set(t.ozellik?.esnekKriterler ?? []);
  const satirlar: KriterSatiri[] = [];

  // Mülk tipi
  const tu = enIyiTipBenzerligi([t.mulkTipi, ...(t.alternatifMulkTipleri ?? [])] as any, p.mulkTipi as any);
  const tipUyumu = { oran: tu.oran, aciklama: tu.aciklama, talepTipi: tu.tip };
  if (tu.oran < 1) satirlar.push({ anahtar: "mulkTipi", etiket: "Mülk tipi", talep: String(MULK_TIPI_META[tu.tip as keyof typeof MULK_TIPI_META]?.etiket ?? tu.tip), portfoy: String(MULK_TIPI_META[p.mulkTipi as keyof typeof MULK_TIPI_META]?.etiket ?? p.mulkTipi), sonuc: tu.oran >= 0.9 ? "SAGLANDI" : "BILINMIYOR", kritik: kritik.has("MULK_TIPI"), bilesen: "TIP_SATIR" });
  // Oda sayısı (konut / ofis). v3.11: "2+1" isteyen müşteriye 3+1 tam uyum değildir —
  // istenen oda 1,0 · bir oda fazla kısmi puan (sunulabilir) · iki+ oda fazla ya da eksik = sağlanmadı.
  // v3.19 — çoklu oda: talep "2+1, 3+1" isteyebilir; portföy en yakın seçeneğe göre değerlendirilir (en iyi puan).
  const toL = odaListesi(t.odaSayisi), po = odaSayisiAyristir(p.odaSayisi);
  if (toL.length) {
    let en: { fark: number; puan: number } | null = null;
    if (po) for (const to of toL) { const fark = po.oda - to.oda; const puan = odaFarkPuani(fark, A.oda.fazla1, A.oda.fazla2); if (!en || puan > en.puan) en = { fark, puan }; }
    const fark = en?.fark ?? null;
    const sonuc: KriterSonuc = fark == null ? "BILINMIYOR" : fark === 0 || fark === 1 ? "SAGLANDI" : "SAGLANMADI";
    const puan = en ? en.puan : 0.5;
    const not = fark == null || fark === 0 ? "" : fark > 0 ? ` (${fark} oda fazla)` : ` (${-fark} oda eksik)`;
    satirlar.push({ anahtar: "odaSayisi", etiket: "Oda sayısı", talep: toL.map((x) => x.etiket).join(" / "), portfoy: (p.odaSayisi ?? "—") + not, sonuc, kritik: kritik.has("ODA_SAYISI"), puan, bilesen: "ODA" });
  }
  if (t.krediyeUygun) satirlar.push({ anahtar: "krediyeUygun", etiket: "Krediye uygun", talep: "İstiyor", portfoy: p.krediyeUygun == null ? "—" : p.krediyeUygun ? "Var" : "Yok", sonuc: p.krediyeUygun == null ? "BILINMIYOR" : p.krediyeUygun ? "SAGLANDI" : "SAGLANMADI", kritik: kritik.has("KREDI"), bilesen: "KONUT" });
  // v3.15 — çoklu kat: talep birden çok kata uygun olabilir ("Giriş", "3. kat", "Ara kat"…); biri tutarsa karşılanmış sayılır.
  // Eski tek değerli talep katı (bulunduguKat) da okunur.
  const istenenKat = istenenKatlarOf(t.ozellik);
  if (istenenKat.length) {
    const pk = typeof p.ozellik?.bulunduguKat === "number" ? p.ozellik.bulunduguKat : null;
    const ks = typeof p.ozellik?.katSayisi === "number" ? p.ozellik.katSayisi : null;
    const katSonuc = katUyumu(istenenKat, pk, ks);
    // v3.19 — portföy "ara kat" yazmasa da bulunduğu kat ve bina kat sayısından hesaplanır; sonuç kartta açıklanır
    const goreli = istenenKat.includes("ARA") || istenenKat.includes("SON");
    const hesap = pk == null ? "" : ks != null ? ` (${pk}/${ks}${goreli ? pk >= 1 && pk < ks ? " · ara kat" : pk === ks ? " · son kat" : pk <= 0 ? " · giriş/zemin" : "" : ""})` : goreli ? " (bina kat sayısı yok)" : "";
    satirlar.push({ anahtar: "istenenKatlar", etiket: "Kat", talep: katYaz(istenenKat), portfoy: pk == null ? "—" : katYaz([String(pk)]) + hesap, sonuc: katSonuc, kritik: kritik.has("KAT"), puan: katSonuc === "SAGLANDI" ? 1 : katSonuc === "SAGLANMADI" ? 0.2 : 0.5, bilesen: BILESEN.KAT ?? "DIGER" });
  }
  // v3.15 — takas: iki taraf da açıksa küçük bonus (aşağıda skora eklenir); matris bileşenlerine girmez
  const takasUyumu = t.takasaAcik === true && p.takasaAcik === true;
  if (takasUyumu) satirlar.push({ anahtar: "takasaAcik", etiket: "Takasa açık", talep: "Evet", portfoy: "Evet", sonuc: "SAGLANDI", kritik: false, puan: 1, bilesen: "TIP_SATIR" });
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
    // v3.22.1 — fiyat periyodu işlem tipine göre okunur: satışta (satılık, devren satılık, kat karşılığı, takas) her iki taraf
    // TOPLAM'dır. Formda yeni kayıt "Aylık" ile açılıyordu; satılığa çevrilen talep "Aylık 12.000.000" kalıyor, 11.750.000'lik
    // satılık daire "fiyat bilinmiyor" çıkıyordu. Kirada aylık ↔ yıllık 12 ile çevrilir.
    const per = periyotlar(t, p);
    const pf = p.fiyat != null ? p.fiyat * per.carpan : null;
    const periyotFarkli = per.farkli;
    const ust = t.maxFiyat * (1 + dna.fiyatTolerans / 100);
    const sonuc: KriterSonuc = pf == null || periyotFarkli ? "BILINMIYOR" : pf <= ust ? "SAGLANDI" : "SAGLANMADI";
    // v3.11 — bütçe altı: fiyat bütçenin çok altındaysa mülk büyük olasılıkla müşterinin aradığı segmentte değildir.
    // Engel değildir (sonuç "sağlandı" kalır), yalnızca puanı düşürür. Talepte alt sınır (minFiyat) varsa o esas alınır.
    let altPuan = 1, altNot = "";
    if (sonuc === "SAGLANDI" && pf! <= t.maxFiyat) {
      if (t.minFiyat != null && t.minFiyat > 0) {
        if (pf! < t.minFiyat) { altPuan = pf! >= t.minFiyat * 0.85 ? 0.8 : 0.5; altNot = " · alt sınırın altında"; }
      } else if (A.fiyatAlt && t.maxFiyat > 0) {
        const r = pf! / t.maxFiyat;
        if (r < A.fiyatAlt.esik2) { altPuan = A.fiyatAlt.puan2; altNot = ` · bütçenin %${Math.round(r * 100)}'i`; }
        else if (r < A.fiyatAlt.esik1) { altPuan = A.fiyatAlt.puan1; altNot = ` · bütçenin %${Math.round(r * 100)}'i`; }
      }
    }
    satirlar.push({ anahtar: "fiyat", etiket: `Fiyat (≤ bütçe +%${dna.fiyatTolerans})`, talep: (t.minFiyat != null && t.minFiyat > 0 ? `${fmt(t.minFiyat)} – ` : "≤ ") + fmt(t.maxFiyat), portfoy: pf == null ? "—" : fmt(p.fiyat) + (periyotFarkli ? ` (${p.fiyatPeriyodu})` : per.carpan !== 1 ? ` (${per.pPer === "YILLIK" ? "yıllık" : "aylık"} · ${fmt(Math.round(pf))} ${per.tPer === "YILLIK" ? "yıllık" : "aylık"})` : "") + altNot, sonuc, kritik: kritik.has("FIYAT"), puan: sonuc === "BILINMIYOR" ? 0.5 : pf! <= t.maxFiyat ? altPuan : sonuc === "SAGLANDI" ? 0.75 : 0, bilesen: "FIYAT" });
  }
  // Teknik alanlar: talepte dolu olan her karşılaştırılabilir alan
  for (const [alan, tv] of Object.entries(t.ozellik ?? {})) {
    const meta = MULK_OZELLIK_META[alan as MulkOzellikAlani];
    if (!meta || meta.karsilastirma === "bilgi" || tv == null || (Array.isArray(tv) && !tv.length)) continue;
    if (meta.karsilastirma === "bool" && tv === false) {
      // v3.22.1 — "Site içi olmayan", "havuz istemiyor": portföyde varsa yumuşak uyumsuzluk (Koşullu; engel değil).
      // Diğer evet/hayır alanlarında "istemiyor" hâlâ kısıt sayılmaz.
      if (ISTENMEYEBILIR.has(alan) && p.ozellik?.[alan] === true) satirlar.push({ anahtar: alan, etiket: meta.etiket, talep: "İstemiyor", portfoy: "Var", sonuc: "SAGLANMADI", kritik: false, puan: 0.3, bilesen: "KONUT" });
      continue;
    }
    const pv = p.ozellik?.[alan];
    const kr = "kriter" in meta ? (meta.kriter as string | undefined) : undefined;
    satirlar.push({
      anahtar: alan, etiket: meta.etiket + ("birim" in meta && meta.birim ? ` (${meta.birim})` : ""),
      talep: meta.karsilastirma === "min" ? `≥ ${fmt(tv)}` : meta.karsilastirma === "max" ? `≤ ${fmt(tv)}` : meta.karsilastirma === "sirali" ? `en az ${fmt(tv)}` : fmt(tv),
      portfoy: fmt(pv), sonuc: karsilastir(alan as MulkOzellikAlani, tv, pv),
      kritik: !!kr && kritik.has(kr), bilesen: kr ? BILESEN[kr] ?? "DIGER" : "DIGER",
    });
  }

  const lokKritik = !esnek.has("LOKASYON");
  const lok = lokasyonPuani(t, p, b, A, !lokKritik);
  const kritikEngeller = satirlar.filter((s) => s.kritik && s.sonuc === "SAGLANMADI").map((s) => s.etiket);
  if (lok.haric) kritikEngeller.push("Hariç tutulan bölge");
  else if (lok.puan == null && lokKritik) kritikEngeller.push("Lokasyon");
  const bilinmeyenKritikler = satirlar.filter((s) => s.kritik && s.sonuc === "BILINMIYOR").map((s) => s.etiket);
  const talepEksikleri = dna.eksik.filter((e) => e.oldurucu && e.kriter !== "LOKASYON").map((e) => e.etiket);

  // Anahtar Uyum Matrisi
  const mAdi = matrisOf(t.mulkTipi), M = MATRISLER[mAdi];
  const kodlar = new Set(M.b.map((x) => x[0]));
  const puanOf = (s: KriterSatiri) => s.puan ?? (s.sonuc === "SAGLANDI" ? 1 : s.sonuc === "SAGLANMADI" ? 0 : 0.5);
  const bilesenler: MatrisBileseni[] = M.b.map(([kod, etiket, agirlik]) => {
    if (kod === "BOLGE") return { kod, etiket, agirlik, puan: lok.oran };
    if (kod === "TIP") return { kod, etiket, agirlik, puan: tipUyumu.oran };
    const ss = satirlar.filter((s) => s.bilesen && s.bilesen !== "TIP_SATIR" && (kodlar.has(s.bilesen) ? s.bilesen : "DIGER") === kod);
    return { kod, etiket, agirlik, puan: ss.length ? ss.reduce((a, s) => a + puanOf(s), 0) / ss.length : null };
  });
  // v3.19 — ölçülemeyen ÇEKİRDEK bileşen (alan, oda, fiyat) artık "yok sayılıp ağırlığı dağıtılmaz":
  // bilinmeyen bilgi lehe sayılmaz. Ağırlığı korunur, puanı BILINMEYEN_PUAN alınır → skor doğal olarak düşer.
  const CEKIRDEK = new Set(["ALAN", "ODA", "FIYAT"]);
  const eksikCekirdek = bilesenler.filter((x) => x.puan == null && CEKIRDEK.has(x.kod));
  for (const x of eksikCekirdek) (x as { puan: number | null }).puan = BILINMEYEN_PUAN;
  const sayilan = bilesenler.filter((x) => x.puan != null);
  const toplamW = sayilan.reduce((a, x) => a + x.agirlik, 0);
  let skor = Math.round((100 * sayilan.reduce((a, x) => a + x.agirlik * (x.puan as number), 0)) / Math.max(1, toplamW));
  if (takasUyumu) skor += TAKAS_BONUS; // v3.15

  const veriEksikleri = eksikVeriUyarilari(t, p);
  // Yalnızca ilçe + fiyat gibi çok az alan karşılaştırıldıysa skor yine de kesin görünmesin (eski v3.17 tavanı, çifte sayım olmadan)
  const olculen = bilesenler.filter((x) => x.puan != null && !eksikCekirdek.includes(x)).length;
  if (veriEksikleri.length && olculen < 3) skor = Math.min(skor, 100 - EKSIK_VERI_CEZASI * (3 - olculen) * 2);
  const fiyatSatiri = satirlar.find((s) => s.anahtar === "fiyat");
  const fiyatKarsilastirilamadi = eksikCekirdek.some((x) => x.kod === "FIYAT");
  // v3.22 — bütçe / fiyat bilinmiyorsa skor tavanı (bkz. FIYATSIZ_CARPAN)
  const fiyatBilinmiyor = fiyatKarsilastirilamadi || fiyatSatiri?.sonuc === "BILINMIYOR";
  // v3.22.1 — çekirdek bilgi (oda, m², fiyat) portföyde yoksa "Sunulabilir" denmez: sunmadan önce sorulur
  const cekirdekBilinmiyor = satirlar.some((x) => (x.anahtar === "odaSayisi" || x.anahtar === "m2" || x.anahtar === "fiyat") && x.sonuc === "BILINMIYOR");
  const cekirdekKosullu = fiyatKarsilastirilamadi || eksikCekirdek.length >= 2 || cekirdekBilinmiyor;

  skor -= 5 * talepEksikleri.length; // talepte öldürücü bilgi eksikse skor "kesin" görünmesin
  if (fiyatBilinmiyor) skor = Math.round(skor * FIYATSIZ_CARPAN);
  skor = Math.max(0, Math.min(100, skor));

  const uygunluk: Uygunluk = kritikEngeller.length ? "UYGUN_DEGIL"
    : bilinmeyenKritikler.length || talepEksikleri.length || cekirdekKosullu || tipUyumu.oran < 0.9 || satirlar.some((s) => s.sonuc === "SAGLANMADI")
      // v3.11 — zayıf bileşen: konum "biraz uzak / bilinmiyor" ya da bir satırın puanı eşiğin altında → sunmadan önce sor
      || lok.belirsiz || (lok.kademe !== "IL_GENELI" && lok.kademe !== "BILINMIYOR" && lok.oran < A.kosulluAlti) || satirlar.some((s) => s.sonuc === "SAGLANDI" && s.puan != null && s.puan < A.kosulluAlti) ? "KOSULLU" : "SUNULABILIR";
  return {
    uygunluk, tipUyumu, skor: uygunluk === "UYGUN_DEGIL" ? Math.min(skor, 40) : skor, lokasyonPuani: lok.puan, lokasyonOrani: lok.oran, lokasyonKademe: lok.kademe, lokasyonMesafeM: lok.mesafeM, lokasyonAciklama: lok.aciklama,
    kriterler: satirlar, kritikEngeller, bilinmeyenKritikler, matris: { ad: M.ad, bilesenler }, talepEksikleri, veriEksikleri, dna,
  };
}