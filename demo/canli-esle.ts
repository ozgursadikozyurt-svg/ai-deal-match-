/**
 * Anahtar CRM v3.22 · 9 Ekim 2026
 * Canlı — arayüz durumu (DepoDurumu) ile sunucu durumu (/api/durum) arasındaki eşleme ve fark hesabı. Saf işlevler (ağ yok): testlenebilir.
 *  sunucudanDurum: GET /api/durum cevabı → arayüzün beklediği durum
 *  imzaAl / planla: son kaydedilenle şimdiki durumu karşılaştırır, yalnızca değişenleri POST /api/durum parçalarına böler
 */
import { bosBaglanti, bosGoogleBaglanti, aiAyari, paylasimAyari, calismaIli, sahiplikAyari, type DepoDurumu, type Kayit, type Kisi } from "./depo";
import { sahiplikNormalize } from "../src/lib/domain/sahiplik";
import { ORNEK_VERI_SURUMU } from "./ornek-veri";
import { aiAyarNormalize, paylasimNormalize, calismaIliNormalize } from "../src/lib/domain/ayarlar";
import { ttlNormalize } from "../src/lib/domain/gecerlilik";
import { rolNormalize } from "../src/lib/domain/roller";

export interface SunucuDurumu {
  kayitlar: { id: string; olusturma: string; veri: Record<string, unknown>; notionId?: string | null; notlar?: Kayit["notlar"]; fotolar?: { id: string; ad: string; en: number; boy: number; boyut: number }[] }[];
  kisiler: Record<string, any>[];
  eslesmeNotlari: DepoDurumu["eslesmeNotlari"];
  ayarlar: { ttl?: unknown; ai?: unknown; paylasim?: unknown; calismaIli?: unknown; roller?: unknown; sahiplik?: unknown };
  arayuz: Record<string, any>;
}

/** null değerli alanlar arayüzde "yok" demektir (undefined): sunucudan gelen null'lar atılır */
export const nullAt = (o: Record<string, unknown>) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== null));

export function sunucudanDurum(s: SunucuDurumu): DepoDurumu {
  const a = s.arayuz ?? {};
  return {
    veriSurumu: ORNEK_VERI_SURUMU,
    kayitlar: s.kayitlar.map((k) => ({ id: k.id, olusturma: k.olusturma, veri: nullAt(k.veri) as any, notionId: k.notionId ?? null, notlar: k.notlar ?? [], fotolar: k.fotolar ?? [] }) as Kayit),
    eslesmeNotlari: s.eslesmeNotlari ?? {},
    testler: a.testler ?? {}, geriBildirim: a.geriBildirim ?? "",
    ayarlar: { ttl: ttlNormalize(s.ayarlar?.ttl), ai: aiAyarNormalize(s.ayarlar?.ai), paylasim: paylasimNormalize(s.ayarlar?.paylasim), calismaIli: calismaIliNormalize(s.ayarlar?.calismaIli), sahiplik: sahiplikNormalize(s.ayarlar?.sahiplik) },
    ogrenilen: a.ogrenilen ?? [], adaylar: a.adaylar ?? [], aktifIceAktarma: null, iceAktarmaGecmisi: a.iceAktarmaGecmisi ?? [],
    roller: rolNormalize(s.ayarlar?.roller),
    kisiler: s.kisiler.map((k) => nullAt(k)) as unknown as Kisi[],
    islenmisMesajlar: a.islenmisMesajlar ?? [], dosyaIzleri: a.dosyaIzleri ?? {}, favoriler: a.favoriler ?? [],
    baglantilar: { google: bosGoogleBaglanti(), notion: bosBaglanti() }, senkronGecmisi: [], cakismalar: [], googleBekleyen: [], googleCanli: null,
  };
}

// ───────── fark hesabı ─────────
export interface Imza { kayit: Map<string, string>; kisi: Map<string, string>; es: Map<string, string>; ayar: Record<string, string>; arayuz: string }
// v3.21 — googleaGonder: "bu kişiyi Google'a da ekle" isteği (elle eklenen kişi / "Google'a gönder"). Sunucu, Google bağlı ve çift yönlü açıksa uygular.
const KISI_ALANLARI = ["id", "adSoyad", "telefon", "ikincilTelefon", "email", "sirket", "roller", "uzmanlikAileleri", "referans", "notlar", "whatsappGruplari", "olusturma", "sonIletisim", "kaynak", "ilanSahibiTipi", "googleaGonder"] as const;
export const kisiYuku = (k: Kisi) => Object.fromEntries(KISI_ALANLARI.map((a) => [a, (k as any)[a]]).filter(([, v]) => v !== undefined));
const kayitYuku = (k: Kayit) => ({ id: k.id, olusturma: k.olusturma, veri: k.veri, notlar: k.notlar ?? [] });
const arayuzYuku = (d: DepoDurumu) => ({ testler: d.testler, geriBildirim: d.geriBildirim, ogrenilen: d.ogrenilen, adaylar: d.adaylar, iceAktarmaGecmisi: d.iceAktarmaGecmisi, islenmisMesajlar: d.islenmisMesajlar, dosyaIzleri: d.dosyaIzleri, favoriler: d.favoriler ?? [] });
const ayarYuku = (d: DepoDurumu) => ({ ttl: d.ayarlar.ttl, ai: aiAyari(d), paylasim: paylasimAyari(d), calismaIli: calismaIli(d), roller: d.roller ?? [], sahiplik: sahiplikAyari(d) });

export function imzaAl(d: DepoDurumu): Imza {
  const ay = ayarYuku(d);
  return {
    kayit: new Map(d.kayitlar.map((k) => [k.id, JSON.stringify(kayitYuku(k))])),
    kisi: new Map(d.kisiler.map((k) => [k.id, JSON.stringify(kisiYuku(k))])),
    es: new Map(Object.entries(d.eslesmeNotlari).map(([a, n]) => [a, JSON.stringify(n)])),
    ayar: Object.fromEntries(Object.entries(ay).map(([a, v]) => [a, JSON.stringify(v)])),
    arayuz: JSON.stringify(arayuzYuku(d)),
  };
}

export interface Plan { parcalar: Record<string, unknown>[]; imza: Imza; bos: boolean; kayitSayisi: number }
export function planla(onceki: Imza, d: DepoDurumu, parcaBoyu = 100): Plan {
  const yeni = imzaAl(d);
  const kisiler = d.kisiler.filter((k) => onceki.kisi.get(k.id) !== yeni.kisi.get(k.id)).map(kisiYuku);
  const kisiSil = [...onceki.kisi.keys()].filter((id) => !yeni.kisi.has(id));
  const kayitlar = d.kayitlar.filter((k) => onceki.kayit.get(k.id) !== yeni.kayit.get(k.id)).map(kayitYuku);
  const kayitSil = [...onceki.kayit.keys()].filter((id) => !yeni.kayit.has(id));
  const es: Record<string, unknown> = {};
  for (const [a, v] of yeni.es) if (onceki.es.get(a) !== v) es[a] = d.eslesmeNotlari[a];
  for (const a of onceki.es.keys()) if (!yeni.es.has(a)) es[a] = null;
  const ayarlar = Object.fromEntries(Object.entries(ayarYuku(d)).filter(([a]) => onceki.ayar[a] !== yeni.ayar[a]));
  const arayuz = onceki.arayuz !== yeni.arayuz ? arayuzYuku(d) : undefined;

  const parcalar: Record<string, unknown>[] = [];
  // 1) kişiler + ayarlar + arayüz durumu (kayıtlar kişilere bağlanır)  2) kayıtlar (parça parça)  3) silmeler ve eşleşme takibi (kayıtlar var olmalı)
  const ilk: Record<string, unknown> = {};
  if (kisiler.length) ilk.kisiler = kisiler;
  if (Object.keys(ayarlar).length) ilk.ayarlar = ayarlar;
  if (arayuz) ilk.arayuz = arayuz;
  if (Object.keys(ilk).length) parcalar.push(ilk);
  for (let i = 0; i < kayitlar.length; i += parcaBoyu) parcalar.push({ kayitlar: kayitlar.slice(i, i + parcaBoyu) });
  const son: Record<string, unknown> = {};
  if (kayitSil.length) son.kayitSil = kayitSil;
  if (kisiSil.length) son.kisiSil = kisiSil;
  if (Object.keys(es).length) son.eslesmeNotlari = es;
  if (Object.keys(son).length) parcalar.push(son);
  return { parcalar, imza: yeni, bos: parcalar.length === 0, kayitSayisi: kayitlar.length };
}
