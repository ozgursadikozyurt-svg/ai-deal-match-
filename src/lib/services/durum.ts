/**
 * Anahtar CRM v3.43 · 25 Ekim 2026 (v3.14'ten)
 * AŞAMA 7 — Canlı sürümün veri köprüsü. Arayüz (demo ile aynı ekranlar) tüm durumu tek seferde okur
 * (`durumGetir`), değişiklikleri parça parça yazar (`degisiklikUygula`). Veritabanı ilişkisel kalır:
 * Notion/Google senkronu, toplu giriş, dışa aktarma ve eşleştirme servisleri aynı tablolarla çalışmaya devam eder.
 */
import { z } from "zod";
import type { PrismaClient } from "../../generated/prisma/client";
import { KayitTemel, MulkOzellikObje, KayitCreateSchema } from "../validation/kayit";
import { fingerprint, ttlAyarlari } from "./kayit";
import { ayarYaz } from "./ayar";
import { varsayilanValidUntil as vu, TtlAyarSchema, TTL_VARSAYILAN } from "../domain/gecerlilik";
import { AiAyarSchema, PaylasimAyarSchema, aiAyarNormalize, paylasimNormalize, calismaIliNormalize } from "../domain/ayarlar";
import { RolTanimSchema, rolNormalize, ROL_SINIRI } from "../domain/roller";
import { SahiplikAyarSchema, sahiplikNormalize } from "../domain/sahiplik";
import { GOREV_SINIRI, ILGILENEN_SINIRI, gorevlerNormalize, ilgilenenlerNormalize } from "../domain/gorev";
import { gonderimAlaniDegisti } from "../google/kisiler";
import { googleSilinenleriIsaretle, googleGonderimAcik } from "./senkron";
import { yetkiVar } from "../guvenlik/yetki";
import { ilkKaynakKarari, ilkYanitKarari } from "../domain/ilk-kaynak";
import { istekSahibi } from "./istek";
export { istekSahibi } from "./istek";
const AYAR_YONETIM = ["ttl", "ai", "paylasim", "calismaIli", "roller", "sahiplik"] as const;

const KAYIT_ALANLARI = [...new Set([...Object.keys(KayitTemel.shape), "anaKategori"])].filter((k) => !["lokasyonlar", "kisiler", "ozellik", "kisiId"].includes(k)); // kisiId: kayıtta kisiler[0]'dan türetilir; arayüzdeki kişi kimlikleri cuid değildir
const OZELLIK_ALANLARI = Object.keys((MulkOzellikObje as any).shape ?? (MulkOzellikObje as any)._def?.schema?.shape ?? {});
const sade = (v: unknown): unknown => (v == null ? null : v instanceof Date ? v.toISOString() : typeof v === "object" && v && "toNumber" in (v as any) ? Number(v) : v);
const ARAYUZ = "arayuz";
/** v3.36 — kaydetme hata günlüğü (ayar anahtarı) */
export const KAYIT_GUNLUGU = "kayitGunlugu";
const AYAR_ANAHTARLARI = ["ttl", "ai", "paylasim", "calismaIli", "roller", "sahiplik", "gorevler", "ilgilenenler", ARAYUZ];

// ───────── Okuma ─────────
/** Veritabanı kişisi → arayüz kişisi. v3.21: googleBekliyor = "Google'a gönderilecek" işareti (rozet için). */
const kisiSatiri = (k: any) => ({ id: k.id, adSoyad: k.adSoyad, telefon: k.telefon, ikincilTelefon: k.ikincilTelefon, email: k.email, sirket: k.sirket, roller: k.roller, uzmanlikAileleri: k.uzmanlikAileleri, referans: k.referans, notlar: k.notlar, whatsappGruplari: k.whatsappGruplari, olusturma: k.createdAt.toISOString(), sonIletisim: k.sonIletisim?.toISOString() ?? null, kaynak: k.kaynak === "CSV" ? "MANUEL" : k.kaynak, ilanSahibiTipi: k.ilanSahibiTipi, googleResourceName: k.googleResourceName, kaynaktaSilindi: k.kaynaktaSilindi?.toISOString() ?? null, googleBekliyor: k.googleBekliyor?.toISOString() ?? null });
/**
 * v3.22.2 — Kişi okumalarında yalnızca arayüzün kullandığı sütunlar çekilir. Eskiden `findMany()` her satırın Google anlık görüntüsünü
 * (googleSnapshot JSON), etag'ini ve Notion alanlarını da getiriyordu: 7.800 kişide ~3 MB gereksiz ayrıştırma = Cloudflare ücretsiz
 * planda "Exceeded CPU Time Limits" (503) hatalarının asıl nedeni.
 */
const KISI_SEC = { id: true, adSoyad: true, telefon: true, ikincilTelefon: true, email: true, sirket: true, roller: true, uzmanlikAileleri: true, referans: true, notlar: true, whatsappGruplari: true, createdAt: true, sonIletisim: true, kaynak: true, ilanSahibiTipi: true, googleResourceName: true, kaynaktaSilindi: true, googleBekliyor: true } as const;
/** Saat sapması / aynı saniyedeki yazma kaçmasın diye "sonra" sorgusu bu kadar geriden başlar */
export const ARTIMLI_PAYI_MS = 120_000;
/**
 * v3.21 — yalnızca kişiler (Google eşitlemesinden sonra arayüzün yenilediği parça).
 * v3.22.2 — `sonra` verilirse yalnızca o andan sonra eklenen / değişen kişiler gelir (artımlı): 7.800 kişinin hepsini her eşitlemeden
 * sonra yeniden indirmek yerine birkaç satır. Yanıttaki `zaman` bir sonraki çağrının `sonra` değeridir.
 */
export async function kisileriGetir(prisma: PrismaClient, sonra?: Date | null) {
  const zaman = new Date().toISOString();
  const where = sonra && !Number.isNaN(sonra.getTime()) ? { updatedAt: { gte: new Date(sonra.getTime() - ARTIMLI_PAYI_MS) } } : undefined;
  const satirlar = await prisma.kisi.findMany({ where, select: KISI_SEC, orderBy: { adSoyad: "asc" } });
  return { kisiler: satirlar.map(kisiSatiri), zaman, artimli: !!where };
}
const KAYIT_INCLUDE = { lokasyonlar: { orderBy: { sira: "asc" } }, ozellik: true, kisiBaglari: { orderBy: { birincil: "desc" } }, gorusmeNotlari: { orderBy: { tarih: "desc" } }, fotolar: { orderBy: { sira: "asc" } } } as const;
/** Veritabanı kaydı → arayüz kaydı */
const kayitCikti = (k: any) => {
      const veri: Record<string, unknown> = Object.fromEntries(KAYIT_ALANLARI.map((a) => [a, sade((k as any)[a])]));
      veri.lokasyonlar = k.lokasyonlar.map((l: any) => ({ ilId: l.ilId, ilceId: l.ilceId, mahalleId: l.mahalleId, altBolgeId: l.altBolgeId, birincil: l.birincil, ...(l.haric ? { haric: true } : {}) }));
      veri.kisiler = k.kisiBaglari.map((b: any) => ({ kisiId: b.kisiId, rol: b.rol }));
      if (k.ozellik) veri.ozellik = Object.fromEntries(OZELLIK_ALANLARI.map((a) => [a, sade((k.ozellik as any)[a])]).filter(([, v]) => v != null && !(Array.isArray(v) && !v.length)));
      return { id: k.id, olusturma: k.createdAt.toISOString(), veri, notionId: k.notionId, fotolar: k.fotolar.map((f: any) => ({ id: f.id, ad: f.ad, en: f.en, boy: f.boy, boyut: f.boyut })), notlar: k.gorusmeNotlari.map((n: any) => ({ id: n.id, tarih: n.tarih.toISOString(), tur: n.tur, metin: n.metin, kisiId: n.kisiId })) };
    };
/** Eşleşme takibi + ayarlar + arayüz durumu (kayıt ve kişi listeleri dışındaki her şey) */
const digerCikti = (eslesmeler: any[], ayarlar: any[]) => ({
    eslesmeNotlari: Object.fromEntries(eslesmeler.map((m) => [`${m.talepId}~${m.portfoyId}`, { durum: m.durum === "BEKLIYOR" ? "YENI" : m.durum, not: m.operasyonNotu ?? "", ...(m.kopmaNedeni ? { neden: m.kopmaNedeni } : {}), ...(m.koparilma ? { tarih: m.koparilma.toISOString() } : {}) }])),
    ayarlar: { ttl: TtlAyarSchema.parse({ ...TTL_VARSAYILAN, ...((ayarlar.find((a) => a.anahtar === "ttl")?.deger as object) ?? {}) }), ai: aiAyarNormalize(ayarlar.find((a) => a.anahtar === "ai")?.deger), paylasim: paylasimNormalize(ayarlar.find((a) => a.anahtar === "paylasim")?.deger), calismaIli: calismaIliNormalize(ayarlar.find((a) => a.anahtar === "calismaIli")?.deger), roller: rolNormalize(ayarlar.find((a) => a.anahtar === "roller")?.deger), sahiplik: sahiplikNormalize(ayarlar.find((a) => a.anahtar === "sahiplik")?.deger), gorevler: gorevlerNormalize(ayarlar.find((a) => a.anahtar === "gorevler")?.deger), ilgilenenler: ilgilenenlerNormalize(ayarlar.find((a) => a.anahtar === "ilgilenenler")?.deger) },
    arayuz: (ayarlar.find((a) => a.anahtar === ARAYUZ)?.deger ?? {}) as Record<string, unknown>,
});
const DIGER_SORGULARI = (prisma: PrismaClient) => [
  prisma.match.findMany({ where: { OR: [{ durum: { not: "BEKLIYOR" } }, { operasyonNotu: { not: null } }], portfoyId: { not: null } } }),
  prisma.ayar.findMany({ where: { anahtar: { in: AYAR_ANAHTARLARI } } }),
] as const;

export async function durumGetir(prisma: PrismaClient) {
  const zaman = new Date().toISOString(); // kişi okumasından ÖNCE alınır: sonraki artımlı çağrı hiçbir değişikliği kaçırmaz
  const [kayitlar, kisiler, eslesmeler, ayarlar] = await Promise.all([
    prisma.kayit.findMany({ include: KAYIT_INCLUDE, orderBy: { createdAt: "desc" } }),
    prisma.kisi.findMany({ select: KISI_SEC, orderBy: { adSoyad: "asc" } }),
    ...DIGER_SORGULARI(prisma),
  ]);
  return { kisiZamani: zaman, kayitlar: kayitlar.map(kayitCikti), kisiler: kisiler.map(kisiSatiri), ...digerCikti(eslesmeler, ayarlar) };
}

/**
 * v3.40 — PARÇALI AÇILIŞ. Tüm veriyi tek istekte çekmek (tüm kayıtlar + ~7.800 kişi + eşleşme + ayar) Cloudflare ücretsiz planın istek başına
 * işlemci sınırını (10 ms) aşıyordu: günde 100'den fazla "Exceeded CPU Time Limits" (503). Arayüz artık veriyi küçük parçalarla alır:
 *   ?parca=diger                → eşleşme takibi + ayarlar + arayüz durumu + kisiZamani
 *   ?parca=kayit&atla=0&al=60   → kayıtlar (sayfa sayfa)   ·   ?parca=kisi&atla=0&al=1000 → kişiler (sayfa sayfa)
 * Yanıttaki `sonraki` bir sonraki sayfanın `atla` değeridir (null = bitti). Parametresiz GET eskisi gibi her şeyi tek seferde verir.
 */
export const DURUM_KAYIT_PARCA = 60, DURUM_KISI_PARCA = 1000;
export async function durumParcasiGetir(prisma: PrismaClient, parca: "kayit" | "kisi" | "diger", atla = 0, al?: number, ilgili = false) {
  const skip = Math.max(0, Math.floor(atla) || 0);
  if (parca === "diger") {
    const zaman = new Date().toISOString();
    const [eslesmeler, ayarlar, kisiToplam] = await Promise.all([...DIGER_SORGULARI(prisma), prisma.kisi.count()]);
    return { kisiZamani: zaman, kisiToplam, ...digerCikti(eslesmeler, ayarlar) };
  }
  if (parca === "kisi") {
    const take = Math.min(Math.max(1, Math.floor(al ?? DURUM_KISI_PARCA) || DURUM_KISI_PARCA), 2000);
    // v3.41 — ilgili=1: yalnızca bir talebe / portföye bağlı kişiler (açılışta bunlar yüklenir; rehberin geri kalanı "Devam et" ile gelir)
    let where: { id: { in: string[] } } | undefined;
    if (ilgili) {
      // ofis süzgeci yalnızca Kayit'ta uygulanır (ebeveyn üzerinden): bağ tablosu doğrudan sorgulanmaz
      const kayitlar = await prisma.kayit.findMany({ select: { kisiId: true, kisiBaglari: { select: { kisiId: true } } } });
      const ids = new Set<string>();
      for (const k of kayitlar as any[]) { if (k.kisiId) ids.add(k.kisiId); for (const b of k.kisiBaglari) ids.add(b.kisiId); }
      where = { id: { in: [...ids] } };
    }
    const satirlar = await prisma.kisi.findMany({ where, select: KISI_SEC, orderBy: [{ adSoyad: "asc" }, { id: "asc" }], skip, take });
    return { kisiler: satirlar.map(kisiSatiri), sonraki: satirlar.length === take ? skip + take : null };
  }
  const take = Math.min(Math.max(1, Math.floor(al ?? DURUM_KAYIT_PARCA) || DURUM_KAYIT_PARCA), 200);
  const satirlar = await prisma.kayit.findMany({ include: KAYIT_INCLUDE, orderBy: [{ createdAt: "desc" }, { id: "asc" }], skip, take });
  return { kayitlar: satirlar.map(kayitCikti), sonraki: satirlar.length === take ? skip + take : null };
}

// ───────── Yazma ─────────
const NotZ = z.object({ id: z.string(), tarih: z.string(), tur: z.enum(["GORUSME", "ARAMA", "WHATSAPP", "GOSTERIM", "NOT"]), metin: z.string().min(1).max(5000), kisiId: z.string().nullish() });
const KayitZ = z.object({ id: z.string().min(1).max(64), olusturma: z.string().optional(), veri: z.record(z.unknown()), notlar: z.array(NotZ).optional() });
const KisiZ = z.object({
  id: z.string().min(1).max(64), adSoyad: z.string().min(1).max(160), telefon: z.string().nullish(), ikincilTelefon: z.string().nullish(), email: z.string().nullish(), sirket: z.string().nullish(),
  roller: z.array(z.string()).default([]), uzmanlikAileleri: z.array(z.string()).default([]), referans: z.string().nullish(), notlar: z.string().nullish(), whatsappGruplari: z.array(z.string()).default([]),
  olusturma: z.string().optional(), sonIletisim: z.string().nullish(), kaynak: z.string().optional(), ilanSahibiTipi: z.string().optional(),
  /** v3.21 — arayüz: "bu kişi elle eklendi / Google'a gönder dendi". Yalnızca Google bağlı ve çift yönlü açıkken dikkate alınır. */
  googleaGonder: z.boolean().optional(),
});
const EsNotZ = z.object({ durum: z.string(), not: z.string().default(""), neden: z.string().optional(), tarih: z.string().optional() }).nullable();
export const DegisiklikSchema = z.object({
  kayitlar: z.array(KayitZ).max(5000).default([]), kayitSil: z.array(z.string()).max(5000).default([]),
  kisiler: z.array(KisiZ).max(5000).default([]), kisiSil: z.array(z.string()).max(5000).default([]),
  eslesmeNotlari: z.record(EsNotZ).default({}),
  ayarlar: z.object({ ttl: z.record(z.number()).optional(), ai: AiAyarSchema.optional(), paylasim: PaylasimAyarSchema.optional(), calismaIli: z.number().int().optional(), roller: z.array(RolTanimSchema).max(ROL_SINIRI).optional(), sahiplik: SahiplikAyarSchema.optional(), /** v3.25 — Bugün panosu görevleri ve ilgilenenler (ofis ayarı olarak JSON) */ gorevler: z.array(z.unknown()).max(GOREV_SINIRI).optional(), ilgilenenler: z.array(z.unknown()).max(ILGILENEN_SINIRI).optional() }).optional(),
  arayuz: z.record(z.unknown()).optional(),
  /** v3.36 — arayüzün yaşadığı kaydetme hataları (503, bağlantı kopması…): sunucu "kayitGunlugu" ayarına ekler; neden hata verdiği sonradan okunabilsin */
  kayitHatalari: z.array(z.object({ zaman: z.string().max(40), mesaj: z.string().max(300), durum: z.number().int().optional(), kayit: z.number().int().optional() })).max(30).optional(),
});
export type Degisiklik = z.output<typeof DegisiklikSchema>;

/** v3.28 — veritabanı bağlantısının koptuğunu gösteren (geçici) hata */
export const geciciBaglantiHatasi = (e: unknown) => /connection terminated|econnreset|connection ended|socket hang up|terminating connection|client has encountered a connection error/i.test(String((e as any)?.message ?? e));
/** v3.28 — geçici bağlantı hatasında işi bir kez daha dener (havuz kopan bağlantıyı atar, yenisini açar). İşler tekrar edilebilir (sil + yaz). */
export async function geciciyseTekrarla<T>(is: () => Promise<T>): Promise<T> {
  try { return await is(); } catch (e) { if (!geciciBaglantiHatasi(e)) throw e; await new Promise((r) => setTimeout(r, 150)); return await is(); }
}
/**
 * v3.28 — gelen kayıtlardaki konum kimliklerinden veritabanında olmayanları bulur; dönen işlev bir kaydın konumları için
 * hata metni (yoksa null) verir. Kimlik yoksa sorgu atılmaz.
 */
export async function konumKimlikleri(prisma: PrismaClient, kayitlar: { veri: Record<string, unknown> }[]): Promise<(l: unknown) => string | null> {
  const ilce = new Set<number>(), mah = new Set<number>(), ab = new Set<number>();
  for (const k of kayitlar) for (const l of ((k.veri as any)?.lokasyonlar ?? []) as any[]) {
    if (Number.isInteger(l?.ilceId)) ilce.add(l.ilceId); if (Number.isInteger(l?.mahalleId)) mah.add(l.mahalleId); if (Number.isInteger(l?.altBolgeId)) ab.add(l.altBolgeId);
  }
  if (!ilce.size && !mah.size && !ab.size) return () => null;
  const [i, m, a] = await Promise.all([
    ilce.size ? prisma.ilce.findMany({ where: { id: { in: [...ilce] } }, select: { id: true } }) : [],
    mah.size ? prisma.mahalle.findMany({ where: { id: { in: [...mah] } }, select: { id: true } }) : [],
    ab.size ? prisma.altBolge.findMany({ where: { id: { in: [...ab] } }, select: { id: true } }) : [],
  ]);
  const vI = new Set(i.map((x) => x.id)), vM = new Set(m.map((x) => x.id)), vA = new Set(a.map((x) => x.id));
  return (ls) => {
    const eksik: string[] = [];
    for (const l of (Array.isArray(ls) ? ls : []) as any[]) {
      if (Number.isInteger(l?.ilceId) && !vI.has(l.ilceId)) eksik.push(`ilçe #${l.ilceId}`);
      if (Number.isInteger(l?.mahalleId) && !vM.has(l.mahalleId)) eksik.push(`mahalle #${l.mahalleId}`);
      if (Number.isInteger(l?.altBolgeId) && !vA.has(l.altBolgeId)) eksik.push(`alt bölge #${l.altBolgeId}`);
    }
    return eksik.length ? `Konum tanınmıyor (${[...new Set(eksik)].join(", ")}) — bu il / ilçe veritabanında yüklü değil; konumu düzeltip yeniden kaydedin` : null;
  };
}

export async function degisiklikUygula(prisma: PrismaClient, g: Degisiklik) {
  const hatalar: { id: string; mesaj: string }[] = [];
  /** v3.32 — kaydı reddetmeyen ama kullanıcıya söylenmesi gereken durumlar (ör. kilitli ilk kaynak değiştirilmek istendi) */
  const uyarilar: { id: string; mesaj: string }[] = [];
  const { rol, sahipId } = istekSahibi();
  const simdi = new Date();
  const ttl = await ttlAyarlari(prisma);
  // 1) Kişiler önce (kayıtlar kişilere bağlanır)
  // v3.21 — çift yönlü Google: bağlantı açıksa (a) elle eklenen yeni kişi, (b) Google'a bağlı kişide ad / telefon / e-posta / şirket
  // düzeltmesi "gönderilecek" diye işaretlenir; bir sonraki eşitleme Google'a yazar. Toplu içe aktarma işaretlenmez (arayüz işaret koymaz).
  const gonder = g.kisiler.length ? await googleGonderimAcik(prisma) : false;
  const eskiler = gonder ? new Map((await prisma.kisi.findMany({ where: { id: { in: g.kisiler.map((k) => k.id) } }, select: { id: true, adSoyad: true, telefon: true, ikincilTelefon: true, email: true, sirket: true, googleResourceName: true } })).map((k) => [k.id, k])) : new Map();
  for (const k of g.kisiler) {
    const eski = eskiler.get(k.id);
    const isaret = !gonder ? false : eski?.googleResourceName ? gonderimAlaniDegisti(eski, { adSoyad: k.adSoyad, telefon: k.telefon, ikincilTelefon: k.ikincilTelefon, email: k.email, sirket: k.sirket }) : !!k.googleaGonder && !!k.telefon;
    const veri = { adSoyad: k.adSoyad, telefon: k.telefon || null, ikincilTelefon: k.ikincilTelefon || null, email: k.email || null, sirket: k.sirket || null, roller: k.roller as any, uzmanlikAileleri: k.uzmanlikAileleri, referans: k.referans ?? null, notlar: k.notlar ?? null, whatsappGruplari: k.whatsappGruplari, sonIletisim: k.sonIletisim ? new Date(k.sonIletisim) : null, ...(k.ilanSahibiTipi ? { ilanSahibiTipi: k.ilanSahibiTipi as any } : {}), ...(isaret ? { googleBekliyor: new Date() } : {}) };
    try { await prisma.kisi.upsert({ where: { id: k.id }, update: veri, create: { id: k.id, ...veri, ...(sahipId ? { sahipKullaniciId: sahipId } : {}), kaynak: (["WHATSAPP", "GOOGLE", "NOTION", "MANUEL"].includes(k.kaynak ?? "") ? k.kaynak : "MANUEL") as any, ...(k.olusturma ? { createdAt: new Date(k.olusturma) } : {}) } }); }
    catch (e: any) { hatalar.push({ id: k.id, mesaj: e?.code === "P2002" ? "Bu telefon numarası başka bir kişide kayıtlı" : String(e?.message ?? e).slice(0, 200) }); }
  }
  // 2) Kayıtlar: alt tablolar (konum, özellik, kişi bağları, notlar) silinip yeniden yazılır
  // v3.28 — konum ön denetimi: veritabanında olmayan ilçe / mahalle / alt bölge (ör. Antalya dışı) işlemi yabancı anahtar hatasıyla
  // bozmasın; kayıt anlaşılır mesajla reddedilir. (14 Eki 2026: iki kayıt "kayit_lokasyon_ilceId_fkey" ile düştü.)
  const konumDenetimi = await konumKimlikleri(prisma, g.kayitlar);
  for (const k of g.kayitlar) {
    const eksikKonum = konumDenetimi((k.veri as any)?.lokasyonlar);
    if (eksikKonum) { hatalar.push({ id: k.id, mesaj: eksikKonum }); continue; }
    const p = KayitCreateSchema.safeParse(k.veri);
    if (!p.success) { hatalar.push({ id: k.id, mesaj: p.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ").slice(0, 300) }); continue; }
    // v3.32 — ilk kaynak zamanı ve ilk yanıt istemciden alınmaz (sunucu yazar); ilk kaynak / ayrıntısı kilit kuralından geçer
    const { lokasyonlar, ozellik, validUntil, kisiler, ilkKaynakTarihi: _t, ilkYanit: _y, ilkKaynak: _k, ilkKaynakDetay: _d, ...alanlar } = p.data as typeof p.data & { ilkKaynakTarihi?: unknown; ilkYanit?: unknown; ilkKaynak?: unknown; ilkKaynakDetay?: unknown };
    // v3.22: isaret açıkça yazılır — "Otomatik"e dönülünce (alan yok) eski elle işaret veritabanında kalmasın
    const veri = { ...alanlar, isaret: p.data.isaret ?? null, validUntil: validUntil ?? vu(p.data.tip, p.data.islemTipi, p.data.aciliyet, new Date(), ttl), kisiId: kisiler[0]?.kisiId ?? null };
    const gelenVeri = k.veri as Record<string, unknown>; // ilk kaynak alanlarının "hiç gönderilmedi" ile "boş gönderildi" farkı ham veriden okunur
    let kUyari: string | undefined;
    try {
      await geciciyseTekrarla(() => prisma.$transaction(async (tx) => {
        const var_ = await tx.kayit.findUnique({ where: { id: k.id }, select: { id: true, ilkKaynak: true, ilkKaynakDetay: true, ilkKaynakTarihi: true, ilkYanit: true, durum: true, durumTarihi: true } });
        const karar = ilkKaynakKarari(var_ ?? null, { ...p.data, ilkKaynak: gelenVeri.ilkKaynak as string | null | undefined, ilkKaynakDetay: gelenVeri.ilkKaynakDetay as string | null | undefined }, yetkiVar(rol, "kaynak.duzelt"), simdi, k.olusturma ? new Date(k.olusturma) : null);
        const yanit = k.notlar ? ilkYanitKarari(var_?.ilkYanit, k.notlar.map((n) => n.tur), simdi) : var_?.ilkYanit ?? null;
        // v3.38 — durum tarihi sunucuda yazılır: durum değiştiyse şimdi; değişmediyse eskisi; yeni kayıtta (aktif değilse) istemcinin değeri ya da şimdi
        const durumTarihi = var_ ? (var_.durum !== p.data.durum ? simdi : var_.durumTarihi ?? null) : p.data.durum !== "ACTIVE" ? p.data.durumTarihi ?? simdi : null;
        const tamVeri = { ...veri, ...karar.yaz, ilkYanit: yanit, durumTarihi };
        if (var_) {
          await tx.kayitLokasyon.deleteMany({ where: { kayitId: k.id } });
          await tx.kayitKisi.deleteMany({ where: { kayitId: k.id } });
          await tx.mulkOzellik.deleteMany({ where: { kayitId: k.id } });
          await tx.kayit.update({ where: { id: k.id }, data: tamVeri as any });
          if (karar.degisiklikler.length) await tx.auditLog.createMany({ data: karar.degisiklikler.map((d) => ({ kayitId: k.id, alan: d.alan, eskiDeger: d.eski as any, yeniDeger: d.yeni as any, kaynak: "kullanici" })) });
        } else {
          let fp = fingerprint(p.data);
          if (await tx.kayit.findFirst({ where: { fingerprint: fp }, select: { id: true } })) fp = fp.slice(0, 24) + k.id.slice(0, 16);
          await tx.kayit.create({ data: { id: k.id, ...(tamVeri as any), ...(sahipId ? { sahipKullaniciId: sahipId } : {}), fingerprint: fp, ...(k.olusturma ? { createdAt: new Date(k.olusturma) } : {}) } });
        }
        kUyari = karar.uyari; // işlem yeniden denenirse üzerine yazılır (uyarı iki kez düşmez)
        if (lokasyonlar.length) await tx.kayitLokasyon.createMany({ data: lokasyonlar.map((l, sira) => ({ ...l, sira, kayitId: k.id })) });
        if (kisiler.length) await tx.kayitKisi.createMany({ data: kisiler.map((b, i) => ({ kisiId: b.kisiId, rol: b.rol as any, birincil: i === 0, kayitId: k.id })) });
        if (ozellik) await tx.mulkOzellik.create({ data: { ...(Object.fromEntries(Object.entries(ozellik).filter(([, v]) => v !== undefined)) as any), kayitId: k.id } });
        if (k.notlar) {
          await tx.kayitNot.deleteMany({ where: { kayitId: k.id } });
          if (k.notlar.length) await tx.kayitNot.createMany({ data: k.notlar.map((n) => ({ id: n.id, kayitId: k.id, tur: n.tur, metin: n.metin, kisiId: n.kisiId ?? null, tarih: new Date(n.tarih) })) });
        }
      }));
      if (kUyari) uyarilar.push({ id: k.id, mesaj: kUyari });
    } catch (e: any) { hatalar.push({ id: k.id, mesaj: String(e?.message ?? e).slice(0, 300) }); }
  }
  // 3) Silmeler — v3.32: silme yetkisi olmayan (asistan) silemez; kayıtlar yerinde kalır, arayüz yeniden yüklenince geri gelir
  if ((g.kayitSil.length || g.kisiSil.length) && !yetkiVar(rol, "kayit.sil")) {
    for (const id of [...g.kayitSil, ...g.kisiSil]) hatalar.push({ id, mesaj: "Silme yetkiniz yok — silinmesi gerekeni not düşüp yöneticinize bildirin" });
    g = { ...g, kayitSil: [], kisiSil: [] };
  }
  if (g.kayitSil.length) await prisma.kayit.deleteMany({ where: { id: { in: g.kayitSil } } });
  if (g.kisiSil.length) {
    // v3.21 — Anahtar'dan silinen kişi Google'dan SİLİNMEZ; yalnızca "geri gelmesin" listesine yazılır (Google bağlıysa)
    await googleSilinenleriIsaretle(prisma, g.kisiSil);
    await prisma.kayit.updateMany({ where: { kisiId: { in: g.kisiSil } }, data: { kisiId: null } });
    await prisma.kayitKisi.deleteMany({ where: { kisiId: { in: g.kisiSil } } });
    await prisma.kisi.deleteMany({ where: { id: { in: g.kisiSil } } });
  }
  // 4) Eşleşme takibi (not, aşama, koparma)
  for (const [anahtar, n] of Object.entries(g.eslesmeNotlari)) {
    const [talepId, portfoyId] = anahtar.split("~");
    if (!talepId || !portfoyId) continue;
    const veri = n
      ? { durum: (n.durum === "YENI" ? "BEKLIYOR" : n.durum) as any, operasyonNotu: n.not || null, notGuncellendi: new Date(), kopmaNedeni: n.durum === "REDDEDILDI" ? n.neden ?? "DIGER" : null, koparilma: n.durum === "REDDEDILDI" ? (n.tarih ? new Date(n.tarih) : new Date()) : null }
      : { durum: "BEKLIYOR" as any, operasyonNotu: null, kopmaNedeni: null, koparilma: null };
    try { await prisma.match.upsert({ where: { talepId_portfoyId: { talepId, portfoyId } }, update: veri, create: { talepId, portfoyId, matematikSkor: 0, finalSkor: 0, ...veri } }); }
    catch (e: any) { hatalar.push({ id: anahtar, mesaj: String(e?.message ?? e).slice(0, 200) }); }
  }
  // 5) Ayarlar ve arayüz durumu (öğrenilen konumlar, test işaretleri, içe aktarma geçmişi…)
  if (g.ayarlar && !yetkiVar(rol, "ofis.ayarlar") && AYAR_YONETIM.some((a) => (g.ayarlar as any)[a] !== undefined)) {
    // v3.32 — ofis ayarlarını (süreler, yapay zekâ, imza, roller, Benim ve ofisim) yalnızca ofis yöneticisi değiştirir; görevler ve ilgilenenler herkesin
    uyarilar.push({ id: "ayarlar", mesaj: "Ofis ayarlarını yalnızca ofis yöneticisi değiştirebilir; ayar değişikliği kaydedilmedi" });
    g = { ...g, ayarlar: Object.fromEntries(Object.entries(g.ayarlar).filter(([a]) => !(AYAR_YONETIM as readonly string[]).includes(a))) as Degisiklik["ayarlar"] };
  }
  if (g.ayarlar) {
    const yaz = (anahtar: string, deger: unknown) => ayarYaz(prisma, anahtar, deger);
    if (g.ayarlar.ttl) await yaz("ttl", TtlAyarSchema.parse(g.ayarlar.ttl));
    if (g.ayarlar.ai) await yaz("ai", g.ayarlar.ai);
    if (g.ayarlar.paylasim) await yaz("paylasim", g.ayarlar.paylasim);
    if (g.ayarlar.calismaIli != null) await yaz("calismaIli", g.ayarlar.calismaIli);
    if (g.ayarlar.roller) await yaz("roller", rolNormalize(g.ayarlar.roller)); // v3.15: özel roller + yeniden adlandırmalar
    if (g.ayarlar.sahiplik) await yaz("sahiplik", g.ayarlar.sahiplik); // v3.22: Benim ve ofisim
    if (g.ayarlar.gorevler) await yaz("gorevler", gorevlerNormalize(g.ayarlar.gorevler)); // v3.25: Bugün panosu (boş liste de yazılır: tüm görevler silinebilir)
    if (g.ayarlar.ilgilenenler) await yaz("ilgilenenler", ilgilenenlerNormalize(g.ayarlar.ilgilenenler)); // v3.25: İlgilenenler
  }
  if (g.arayuz) await ayarYaz(prisma, ARAYUZ, g.arayuz);
  // v3.36 — kaydetme günlüğü: reddedilen kayıtlar ve arayüzün bildirdiği ağ / sunucu hataları (son 60). Yalnızca hata varken yazılır.
  if (hatalar.length || g.kayitHatalari?.length) {
    try {
      const eski = await prisma.ayar.findFirst({ where: { anahtar: KAYIT_GUNLUGU }, select: { deger: true } });
      const yeni = [...(g.kayitHatalari ?? []).map((h) => ({ ...h, kaynak: "arayuz" })), ...hatalar.map((h) => ({ zaman: simdi.toISOString(), mesaj: h.mesaj.slice(0, 300), kimlik: h.id, kaynak: "sunucu" }))];
      await ayarYaz(prisma, KAYIT_GUNLUGU, [...(Array.isArray(eski?.deger) ? (eski!.deger as unknown[]) : []), ...yeni].slice(-60));
    } catch { /* günlük yazılamazsa kayıt sonucu etkilenmez */ }
  }
  return { tamam: hatalar.length === 0, hatalar, uyarilar };
}