/**
 * Anahtar CRM v3.13 · 3 Ekim 2026
 * Demo lokasyon indeksi — veritabanı seed'iyle aynı kaynaklardan (PTT verisi + antalya.ts) üretilir.
 * v3.10: Türkiye'nin tamamı. Çalışma ili (varsayılan Antalya) tam sözlükle; diğer 80 il gömülü sıkıştırılmış veriden
 * ilk ihtiyaçta açılır (~72 bin mahalle/köy). Kimlikler: Antalya mahalleleri 1…N (eski kayıtlarla uyumlu),
 * diğer iller 100000 + ilçeId×1000 + sıra; başlangıç alt bölgeleri 1000 + sıra.
 */
import { lokasyonCozumle, MERKEZ_ILCELER, type LokasyonIndeks, type CozulenLokasyon } from "../src/lib/lokasyon/cozumle";
import { lokasyonAnahtari } from "../src/lib/lokasyon/normalize";
import type { LokasyonBaglami } from "../src/lib/eslestirme/onizleme";
import { ANTALYA_ALT_BOLGELER, ANTALYA_ALIASLAR, ANTALYA_KOMSU_ILCELER } from "../prisma/seed/antalya";
import veri from "./antalya-veri.json";
import trVeri from "./turkiye-veri.json";
import { gunzipSync, strFromU8 } from "fflate";
import { cokIlliCozumle, type TurkiyeOzeti, type CokIlOrtami } from "../src/lib/lokasyon/turkiye";
import { TURKIYE_ALT_BOLGELER } from "../prisma/seed/turkiye-alt-bolgeler";
import { komsulukKur } from "../src/lib/lokasyon/komsuluk";

const ilceR = (veri.ilceler as { id: number; ad: string }[]);
const mahR = (veri.mahalleler as [number, string, string, string | null, string, string][]).map((m, n) => ({ id: n + 1, ilceId: m[0], ad: m[1], slug: m[5] }));
const ilceAdId = (ad: string) => ilceR.find((i) => i.ad === ad)!.id;
const mahId = (ilce: string, slug: string) => mahR.find((m) => m.ilceId === ilceAdId(ilce) && m.slug === slug)?.id ?? null;
const abler = ANTALYA_ALT_BOLGELER.map((b, n) => ({ id: n + 1, ilceId: b.ilce ? ilceAdId(b.ilce) : null, ad: b.ad, slug: b.slug, dogrulandi: b.dogrulandi, mahalleler: b.mahalleler.map(([i, s]) => mahId(i, s)).filter((x): x is number => x != null) }));

const ANTALYA: LokasyonIndeks = {
  ilId: 7,
  oncelikliIlceler: MERKEZ_ILCELER[7].map((ad) => ilceAdId(ad)),
  ilceler: ilceR.map((i) => ({ id: i.id, ad: i.ad })),
  mahalleler: mahR.map(({ id, ilceId, ad }) => ({ id, ilceId, ad })),
  altBolgeler: abler.map(({ id, ilceId, ad }) => ({ id, ilceId, ad })),
  aliaslar: ANTALYA_ALIASLAR.map((a) => {
    if (a.seviye === "ILCE") return { alias: a.alias, seviye: "ILCE" as const, ilceId: ilceAdId(a.ilce), mahalleId: null, altBolgeId: null };
    if (a.seviye === "MAHALLE") return { alias: a.alias, seviye: "MAHALLE" as const, ilceId: ilceAdId(a.ilce), mahalleId: mahId(a.ilce, a.mahalle), altBolgeId: null, tip: a.tip, aciklama: a.aciklama };
    const ab = abler.find((b) => b.slug === a.altBolge)!;
    return { alias: a.alias, seviye: "ALTBOLGE" as const, ilceId: ab.ilceId, mahalleId: null, altBolgeId: ab.id };
  }),
};

// ───────── Türkiye geneli ─────────
const OZET: TurkiyeOzeti = {
  iller: (trVeri.iller as [number, string][]).map(([id, ad]) => ({ id, ad })),
  ilceler: (trVeri.ilceler as [number, number, string][]).map(([id, ilId, ad]) => ({ id, ilId, ad })),
};
export const ILLER = OZET.iller.slice().sort((a, b) => a.ad.localeCompare(b.ad, "tr"));
const ilAd = new Map(OZET.iller.map((i) => [i.id, i.ad]));
const ilceBilgi = new Map(OZET.ilceler.map((i) => [i.id, i]));
export const ilAdiOf = (ilId: number) => ilAd.get(ilId) ?? `İl ${ilId}`;
export const ilceIli = (ilceId: number | null | undefined) => (ilceId ? ilceBilgi.get(ilceId)?.ilId ?? null : null);

const MAH_TABAN = 100000, ALT_TABAN = 1000;
let digerMah: Map<number, string[]> | null = null;
/** Antalya dışındaki mahalle/köy adları: ilk çağrıda açılır (≈260 KB gzip → 730 KB) */
function digerMahalleler(): Map<number, string[]> {
  if (digerMah) return digerMah;
  const ikili = atob(trVeri.mahGz as string);
  const bayt = new Uint8Array(ikili.length);
  for (let i = 0; i < ikili.length; i++) bayt[i] = ikili.charCodeAt(i);
  const satirlar = JSON.parse(strFromU8(gunzipSync(bayt))) as [number, string][];
  return (digerMah = new Map(satirlar.map(([id, adlar]) => [id, adlar.split("|")])));
}
const trAltlar = TURKIYE_ALT_BOLGELER.map(([il, ilce, ad], n) => {
  const ilId = OZET.iller.find((i) => i.ad === il)?.id ?? 0;
  return { id: ALT_TABAN + n, ilId, ilceId: ilce ? OZET.ilceler.find((i) => i.ilId === ilId && i.ad === ilce)?.id ?? null : null, ad };
});
const ilOnbellek = new Map<number, LokasyonIndeks>([[7, ANTALYA]]);
/** Bir ilin tam indeksi (ilçe + mahalle + başlangıç alt bölgeleri). Antalya'da piyasa sözlüğü de vardır. */
export function ilIndeksi(ilId: number): LokasyonIndeks | null {
  const c = ilOnbellek.get(ilId);
  if (c) return c;
  if (!ilAd.has(ilId)) return null;
  const ilceler = OZET.ilceler.filter((i) => i.ilId === ilId).map(({ id, ad }) => ({ id, ad }));
  const mah = digerMahalleler();
  const mahalleler = ilceler.flatMap((i) => (mah.get(i.id) ?? []).map((ad, n) => ({ id: MAH_TABAN + i.id * 1000 + n, ilceId: i.id, ad })));
  const anahtarlar = new Set(mahalleler.map((m) => `${m.ilceId}|${lokasyonAnahtari(m.ad)}`));
  // Aynı ilçede aynı adlı resmî mahalle varsa başlangıç alt bölgesi gereksizdir
  const altBolgeler = trAltlar.filter((b) => b.ilId === ilId && !(b.ilceId && anahtarlar.has(`${b.ilceId}|${lokasyonAnahtari(b.ad)}`))).map(({ id, ilceId, ad }) => ({ id, ilceId, ad }));
  const ix: LokasyonIndeks = { ilId, ilceler, mahalleler, altBolgeler, aliaslar: [] };
  ilOnbellek.set(ilId, ix);
  return ix;
}
const ORTAM: CokIlOrtami = { ozet: OZET, indeksAl: ilIndeksi };

export type Alias = LokasyonIndeks["aliaslar"][number] & { ilId?: number };
/** Seed'deki sözlük (Notion yazımları + referans noktalar) */
export const SEED_ALIASLAR = ANTALYA.aliaslar;
/** Aktif indeks = çalışma ili + kullanıcının öğrettikleri + Türkiye ortamı. Değişince yeni nesne kurulur (çözücü önbelleği nesneye bağlı). */
let calismaIliId = 7;
let sonOgrenilen: Alias[] = [];
const kur = (): LokasyonIndeks => {
  const temel = ilIndeksi(calismaIliId) ?? ANTALYA;
  return { ...temel, aliaslar: [...sonOgrenilen.filter((a) => (a.ilId ?? 7) === calismaIliId), ...temel.aliaslar], turkiye: ORTAM };
};
export let INDEKS: LokasyonIndeks = kur();
export const calismaIliOku = () => calismaIliId;
export function ogrenilenleriYukle(ogrenilen: Alias[], calismaIli = calismaIliId) {
  if (ogrenilen === sonOgrenilen && calismaIli === calismaIliId) return;
  sonOgrenilen = ogrenilen; calismaIliId = ilAd.has(calismaIli) ? calismaIli : 7;
  INDEKS = kur();
  oneriHavuzu = null;
}

export const ALT_BOLGELER = abler;
export const ilcelerOf = (ilId: number) => OZET.ilceler.filter((i) => i.ilId === ilId).map(({ id, ad }) => ({ id, ad })).sort((a, b) => a.ad.localeCompare(b.ad, "tr"));
/** Çalışma ilinin ilçeleri (filtre ve formlardaki hazır liste) */
export const ILCELER = ilcelerOf(7);
export const mahallelerOf = (ilceId: number) => (ilIndeksi(ilceIli(ilceId) ?? 7)?.mahalleler ?? []).filter((m) => m.ilceId === ilceId).sort((a, b) => a.ad.localeCompare(b.ad, "tr"));

/** v3.11 — Antalya mahalle komşuluk / mesafe tablosu (ilçe adı + slug → demo kimliği) */
const mahAnahtar = new Map(mahR.map((m) => [`${m.ilceId}|${m.slug}`, m]));
const ilceAdMap = new Map(ilceR.map((i) => [i.ad, i.id]));
export const KOMSULUK = komsulukKur((ilce, slug) => { const m = mahAnahtar.get(`${ilceAdMap.get(ilce)}|${slug}`); return m ? { id: m.id, ilceId: m.ilceId } : null; });
export const BAGLAM: LokasyonBaglami = {
  komsuIlceler: new Set(ANTALYA_KOMSU_ILCELER.flatMap(([a, b]) => [`${ilceAdId(a)}-${ilceAdId(b)}`, `${ilceAdId(b)}-${ilceAdId(a)}`])),
  altBolgeMahalleleri: new Map(abler.map((b) => [b.id, new Set(b.mahalleler)])),
  komsuluk: KOMSULUK,
  mahalleAdi: (id) => (id < 100000 ? mahR[id - 1]?.ad : undefined),
};

/**
 * v3.11 — v3.10'da kaydedilmiş kayıtlardaki yanlış ilçeye çözülmüş aynı adlı mahalleyi onarır:
 * "Fener, Çağlayan" talebinde Çağlayan Manavgat'a yazılmıştı. Kaydın diğer konumlarının ilçesinde aynı adlı
 * mahalle varsa (ve mevcut ilçe o konumların ilçesi değilse) mahalle o ilçeye taşınır. Yalnızca Antalya kimlikleri.
 */
export function belirsizKonumOnar<T extends { ilceId?: number | null; mahalleId?: number | null }>(ls: T[]): { lokasyonlar: T[]; degisti: boolean } {
  if (ls.length < 2) return { lokasyonlar: ls, degisti: false };
  let degisti = false;
  const yeni = ls.map((l, i) => {
    if (!l.mahalleId || l.mahalleId >= MAH_TABAN) return l;
    const m = mahR[l.mahalleId - 1];
    const baglam = new Set(ls.filter((_, j) => j !== i).map((o) => o.ilceId).filter((x): x is number => !!x));
    if (!m || baglam.has(m.ilceId)) return l;
    const aday = mahR.filter((x) => x.id !== m.id && baglam.has(x.ilceId) && lokasyonAnahtari(x.ad) === lokasyonAnahtari(m.ad));
    if (aday.length !== 1) return l;
    degisti = true;
    return { ...l, ilceId: aday[0].ilceId, mahalleId: aday[0].id };
  });
  return { lokasyonlar: degisti ? yeni : ls, degisti };
}

/** Serbest metin / ifade listesi → konumlar. Başka il adı geçen ifadeler o ilde çözülür. */
export const coz = (metin: string | string[]) => cokIlliCozumle(metin, INDEKS);

export interface KayitLok { ilId: number; ilceId: number | null; mahalleId: number | null; altBolgeId: number | null; birincil: boolean; etiket: string; seviye: CozulenLokasyon["seviye"] }
export function cozulenToKayitLok(ls: CozulenLokasyon[], portfoy: boolean): KayitLok[] {
  return ls.map((l, i) => ({ ilId: l.ilId, ilceId: l.ilceId, mahalleId: l.mahalleId, altBolgeId: l.altBolgeId, birincil: portfoy && i === 0, etiket: l.etiket, seviye: l.seviye }));
}
/** Görünen ad. Çalışma ili dışındaki konumlara il adı eklenir: "Bornova · İzmir". */
export function lokEtiket(l: { ilId?: number | null; ilceId?: number | null; mahalleId?: number | null; altBolgeId?: number | null }): string {
  const il = ilceIli(l.ilceId) ?? l.ilId ?? calismaIliId;
  const ek = il !== calismaIliId ? ` · ${ilAdiOf(il)}` : "";
  if (l.altBolgeId) {
    if (l.altBolgeId >= ALT_TABAN) { const b = trAltlar[l.altBolgeId - ALT_TABAN]; return b ? `${b.ad}${b.ilId !== calismaIliId ? ` · ${ilAdiOf(b.ilId)}` : ""}` : "?"; }
    return (ALT_BOLGELER.find((b) => b.id === l.altBolgeId)?.ad ?? "?") + (calismaIliId !== 7 ? " · Antalya" : "");
  }
  const ilce = l.ilceId ? ilceBilgi.get(l.ilceId)?.ad : undefined;
  if (l.mahalleId) {
    const mah = l.mahalleId >= MAH_TABAN
      ? digerMahalleler().get(Math.floor((l.mahalleId - MAH_TABAN) / 1000))?.[(l.mahalleId - MAH_TABAN) % 1000]
      : ANTALYA.mahalleler[l.mahalleId - 1]?.ad;
    return `${ilce} / ${mah ?? "?"}${ek}`;
  }
  return ilce ? `${ilce}${ek}` : `${ilAdiOf(il)} (il geneli)`;
}

// ───────── Yazarken öneri (autocomplete) ─────────
export interface KonumOnerisi { anahtar: string; etiket: string; alt: string; tur: "IL" | "ILCE" | "MAHALLE" | "ALTBOLGE" | "REFERANS" | "YAZIM"; lok: { ilId: number; ilceId: number | null; mahalleId: number | null; altBolgeId: number | null } }
type HavuzOgesi = KonumOnerisi & { k: string; uzak?: boolean };
let oneriHavuzu: HavuzOgesi[] | null = null;
function havuz() {
  if (oneriHavuzu) return oneriHavuzu;
  const ix = INDEKS, il = ix.ilId;
  const ilceAd = new Map(ix.ilceler.map((i) => [i.id, i.ad]));
  const h: HavuzOgesi[] = [];
  for (const b of ix.altBolgeler) h.push({ k: lokasyonAnahtari(b.ad), anahtar: `a:${b.id}`, etiket: b.ad, alt: `Alt bölge${b.ilceId ? " · " + ilceAd.get(b.ilceId) : ""}`, tur: "ALTBOLGE", lok: { ilId: il, ilceId: b.ilceId, mahalleId: null, altBolgeId: b.id } });
  for (const i of ix.ilceler) h.push({ k: lokasyonAnahtari(i.ad), anahtar: `i:${i.id}`, etiket: i.ad, alt: "İlçe", tur: "ILCE", lok: { ilId: il, ilceId: i.id, mahalleId: null, altBolgeId: null } });
  for (const a of ix.aliaslar) {
    if (a.tip !== "REFERANS_NOKTA" && !a.altBolgeId && a.seviye !== "MAHALLE") continue;
    const hedef = lokEtiket(a);
    h.push({ k: lokasyonAnahtari(a.alias), anahtar: `r:${a.alias}`, etiket: a.alias, alt: `${a.tip === "REFERANS_NOKTA" ? "Referans nokta" : "Diğer yazım"} → ${hedef}`, tur: a.tip === "REFERANS_NOKTA" ? "REFERANS" : "YAZIM", lok: { ilId: il, ilceId: a.ilceId, mahalleId: a.mahalleId, altBolgeId: a.altBolgeId } });
  }
  for (const m of ix.mahalleler) h.push({ k: lokasyonAnahtari(m.ad), anahtar: `m:${m.id}`, etiket: m.ad, alt: `Mahalle · ${ilceAd.get(m.ilceId)}`, tur: "MAHALLE", lok: { ilId: il, ilceId: m.ilceId, mahalleId: m.id, altBolgeId: null } });
  // Türkiye: iller, diğer illerin ilçeleri ve başlangıç semtleri (mahalleleri "İzmir Kazım…" / "Bornova Kazım…" yazınca gelir)
  for (const i of OZET.iller) if (i.id !== il) h.push({ k: lokasyonAnahtari(i.ad), anahtar: `il:${i.id}`, etiket: i.ad, alt: "İl geneli", tur: "IL", uzak: true, lok: { ilId: i.id, ilceId: null, mahalleId: null, altBolgeId: null } });
  for (const i of OZET.ilceler) if (i.ilId !== il) h.push({ k: lokasyonAnahtari(i.ad), anahtar: `i:${i.id}`, etiket: i.ad, alt: `İlçe · ${ilAdiOf(i.ilId)}`, tur: "ILCE", uzak: true, lok: { ilId: i.ilId, ilceId: i.id, mahalleId: null, altBolgeId: null } });
  for (const b of trAltlar) if (b.ilId !== il) h.push({ k: lokasyonAnahtari(b.ad), anahtar: `a:${b.id}`, etiket: b.ad, alt: `Semt · ${b.ilceId ? ilceBilgi.get(b.ilceId)?.ad + ", " : ""}${ilAdiOf(b.ilId)}`, tur: "ALTBOLGE", uzak: true, lok: { ilId: b.ilId, ilceId: b.ilceId, mahalleId: null, altBolgeId: b.id } });
  return (oneriHavuzu = h);
}
const TUR_SIRA = { ALTBOLGE: 0, ILCE: 1, IL: 2, REFERANS: 3, YAZIM: 4, MAHALLE: 5 };
const ilAnahtar = new Map(OZET.iller.map((i) => [lokasyonAnahtari(i.ad), i.id]));
/** Yazılan harflere göre en fazla `n` öneri: tam eşleşme > baştan eşleşme > kelime başı > içinde geçen; çalışma ili önce gelir */
export function konumOner(yazi: string, n = 8): KonumOnerisi[] {
  const q = lokasyonAnahtari(yazi);
  if (q.length < 2) return [];
  const puan = (k: string, s: string) => (k === s ? 0 : k.startsWith(s) ? 1 : k.split(" ").some((w) => w.startsWith(s)) ? 2 : k.includes(s) ? 3 : 9);
  // "izmir kazım", "bornova kazım" → o ilin / ilçenin mahalleleri
  const [ilk, ...gerisi] = q.split(" ");
  const kalan = gerisi.join(" ");
  const uzakIl = ilAnahtar.get(ilk);
  const uzakIlceler = OZET.ilceler.filter((i) => i.ilId !== calismaIliId && lokasyonAnahtari(i.ad) === ilk);
  let ek: KonumOnerisi[] = [];
  if (kalan.length >= 2 && ((uzakIl && uzakIl !== calismaIliId) || uzakIlceler.length === 1)) {
    const ilId = uzakIl && uzakIl !== calismaIliId ? uzakIl : uzakIlceler[0].ilId;
    const ix = ilIndeksi(ilId);
    const ilceSinir = uzakIl && uzakIl !== calismaIliId ? null : uzakIlceler[0].id;
    if (ix) {
      const ia = new Map(ix.ilceler.map((i) => [i.id, i.ad]));
      const aday: (KonumOnerisi & { p: number })[] = [];
      if (!ilceSinir) for (const i of ix.ilceler) { const p = puan(lokasyonAnahtari(i.ad), kalan); if (p < 9) aday.push({ p, anahtar: `i:${i.id}`, etiket: i.ad, alt: `İlçe · ${ilAdiOf(ilId)}`, tur: "ILCE", lok: { ilId, ilceId: i.id, mahalleId: null, altBolgeId: null } }); }
      for (const m of ix.mahalleler) { if (ilceSinir && m.ilceId !== ilceSinir) continue; const p = puan(lokasyonAnahtari(m.ad), kalan); if (p < 9) aday.push({ p: p + 0.5, anahtar: `m:${m.id}`, etiket: m.ad, alt: `Mahalle · ${ia.get(m.ilceId)}, ${ilAdiOf(ilId)}`, tur: "MAHALLE", lok: { ilId, ilceId: m.ilceId, mahalleId: m.id, altBolgeId: null } }); }
      ek = aday.sort((a, b) => a.p - b.p || a.etiket.localeCompare(b.etiket, "tr")).slice(0, n).map(({ p, ...o }) => o);
    }
  }
  if (ek.length) return ek;
  return havuz().map((o) => ({ o, p: puan(o.k, q) + (o.uzak ? 0.5 : 0) })).filter((x) => x.p < 9)
    .sort((a, b) => a.p - b.p || TUR_SIRA[a.o.tur] - TUR_SIRA[b.o.tur] || a.o.etiket.localeCompare(b.o.etiket, "tr"))
    .slice(0, n).map(({ o: { k, uzak, ...o } }) => o);
}