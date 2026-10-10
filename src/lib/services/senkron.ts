/**
 * Anahtar CRM v3.22.2 · 10 Ekim 2026 (v3.13'ten)
 * Ekosistem senkron işi — Google Kişiler (v3.21: çift yönlü, çok ofisli) ve Notion (v3.21: gizli, kod yerinde). Planlama saf modüllerde (google/kisiler.ts, notion/plan.ts),
 * bu dosya planı veritabanına uygular, çalışma geçmişini ve çakışmaları yazar.
 *
 * Tetikleyiciler: Cloudflare zamanlayıcısı (v3.22.2: günde bir, 05:00 UTC = 08:00 TR — src/canli/worker.ts) · ekrandaki "Şimdi eşitle".
 * v3.22.2 — uygulama açılışında / 5 dakikada bir otomatik eşitleme KALDIRILDI (Cloudflare ücretsiz planda CPU sınırını aşıp 503 veriyordu).
 * Google People API'nin artımlı anahtarı (syncToken) zaten "son eşitlemeden beri değişenler" demektir: değişiklik yoksa tur tek bir
 * küçük istekle biter ve 7.800 kişilik rehber veritabanından hiç okunmaz.
 * Süre bütçesi: iş kaldığı yeri (Google sayfa anahtarı, Notion imleci) saklar; bütçe dolarsa sonraki tetikte devam eder.
 * Kilit: Entegrasyon.kilitBitis — iki iş aynı anda aynı bağlantıyı işlemez.
 */
import type { PrismaClient, Prisma } from "../../generated/prisma/client";
import { ofisBaglami, kiracilikIcinde } from "../kiracilik";
import { notionAcik } from "../ozellikler";
import { googleKisiDonustur, googleSenkronPlani, googleGonderimPlani, googleOlusturmaGovdesi, googleGuncellemeGovdesi, GOOGLE_ALANLARI, GONDERIM_ALANLARI, type GoogleDonusum, type GooglePerson, type MevcutKisi, type HaricListesi, type GonderimAdayi } from "../google/kisiler";
import { erisimYenile, gruplar, kisiSayfasi, kisiOlustur, kisiGetir, kisiGuncelle, GoogleHatasi } from "../google/istemci";
import { coz as sifreCoz } from "../guvenlik/sifre";
import { notionIstemcisi, type NotionIstemcisi } from "../notion/istemci";
import { dataSourceId, SENKRON_SIRASI, NOTION_TABLOLARI, type NotionTablo } from "../notion/yapilandirma";
import { kisiTaslagi, portfoyTaslagi, talepTaslagi, kisidenTalep, kayitHazirla, type KisiTaslagi, type KayitTaslagi, type NotionSayfa } from "../notion/donustur";
import { kisiPlani, kayitPlani, kaybolanlar, type MevcutNotionKayit, type MevcutNotionKisi, type HazirKayit } from "../notion/plan";
import { geriYazimDegerleri, geriYazimOzellikleri, geriYazimGerekli, eksikGeriYazimAlanlari } from "../notion/geri-yazim";
import { eslesmeOzetleri } from "../eslestirme/ozet";
import { eslesmeOnizle, type LokasyonBaglami } from "../eslestirme/onizleme";
import { komsulukKur } from "../lokasyon/komsuluk";
import { lokasyonIndeksiYukle } from "../lokasyon/cozumle";
import { kayitOlustur, ttlAyarlari } from "./kayit";
import { varsayilanValidUntil } from "../domain/gecerlilik";
import { esit, telAnahtari, type AlanCakismasi } from "../senkron/birlestir";

type Saglayici = "GOOGLE_KISILER" | "NOTION";
type Fetch = typeof fetch;
/** Bir çağrıda dışarıya yapılan istek sayacı — Cloudflare Workers ücretsiz planda çağrı başına 50 dış istek sınırı vardır */
export interface IstekSayaci { n: number; sinir: number }
export interface SenkronSecenek { tetik?: string; tam?: boolean; butceMs?: number; sayfaSiniri?: number; f?: Fetch; simdi?: () => Date; sayac?: IstekSayaci }
export interface EntegrasyonAyarlari {
  otomatik: boolean; aralikDk: number; geriYaz: boolean;
  /** v3.21 — çift yönlü: Anahtar'da elle eklenen / düzeltilen kişi Google'a da yazılır (varsayılan açık) */
  googleYaz: boolean;
  sadeceEtiketler: string[];
  /** v3.21 — bağlantıyı kuran kullanıcı (içe aktarılan kişilerin sahibi), bağlantı zamanı, Google'ın verdiği yazma izni */
  baglayanKullaniciId?: string; baglanti?: string; yazmaIzni?: boolean;
}
export const VARSAYILAN_AYAR: EntegrasyonAyarlari = { otomatik: true, aralikDk: 15, geriYaz: true, googleYaz: false, sadeceEtiketler: [] };
/** v3.22.2 — Google varsayılanı artık günde bir (1440 dk); anlık ihtiyaç için "Şimdi eşitle". v3.21: çift yönlü varsayılan açık. */
export const varsayilanAyar = (s: string): EntegrasyonAyarlari => (s === "GOOGLE_KISILER" ? { ...VARSAYILAN_AYAR, aralikDk: 1440, googleYaz: true } : VARSAYILAN_AYAR);
const J = (v: unknown) => (v ?? null) as Prisma.InputJsonValue;

// ───────── Ortak ─────────
export async function entegrasyon(prisma: PrismaClient, s: Saglayici) {
  const { ofisId } = ofisBaglami();
  return prisma.entegrasyon.upsert({ where: { ofisId_saglayici: { ofisId, saglayici: s } }, update: {}, create: { ofisId, saglayici: s, ayarlar: J(varsayilanAyar(s)) } });
}
export const ayarlarOf = (e: { ayarlar: unknown; saglayici?: string }): EntegrasyonAyarlari => ({ ...varsayilanAyar(e.saglayici ?? ""), ...((e.ayarlar as object) ?? {}) });

async function kilitAl(prisma: PrismaClient, s: Saglayici, ms: number): Promise<boolean> {
  const simdi = new Date();
  const r = await prisma.entegrasyon.updateMany({ where: { saglayici: s, OR: [{ kilitBitis: null }, { kilitBitis: { lt: simdi } }] }, data: { kilitBitis: new Date(simdi.getTime() + ms) } });
  return r.count === 1;
}
const kilitBirak = (prisma: PrismaClient, s: Saglayici) => prisma.entegrasyon.updateMany({ where: { saglayici: s }, data: { kilitBitis: null } });

async function cakismalariYaz(prisma: PrismaClient, s: Saglayici, hedefTip: "KISI" | "KAYIT", hedefId: string, cs: AlanCakismasi[]) {
  for (const c of cs) {
    const var_ = await prisma.senkronCakisma.findFirst({ where: { saglayici: s, hedefId, alan: c.alan, durum: "ACIK" } });
    const veri = { onceki: J(c.onceki), yerel: J(c.yerel), uzak: J(c.uzak) };
    if (var_) await prisma.senkronCakisma.update({ where: { id: var_.id }, data: veri });
    else await prisma.senkronCakisma.create({ data: { saglayici: s, hedefTip, hedefId, alan: c.alan, ...veri } });
  }
}

/** Sunucu tarafı konum bağlamı (komşu ilçeler, alt bölge mahalleleri) — eşleşme skoru için */
export async function lokasyonBaglamiYukle(prisma: PrismaClient): Promise<LokasyonBaglami> {
  const [k, a] = await Promise.all([prisma.ilceKomsuluk.findMany(), prisma.altBolgeMahalle.findMany()]);
  const m = new Map<number, Set<number>>();
  for (const x of a) { if (!m.has(x.altBolgeId)) m.set(x.altBolgeId, new Set()); m.get(x.altBolgeId)!.add(x.mahalleId); }
  // v3.11 — mahalle komşuluğu: Antalya mahalleleri (ilçe adı + slug) veritabanı kimliklerine bağlanır
  const mah = await prisma.mahalle.findMany({ where: { ilce: { ilId: 7 } }, select: { id: true, ad: true, slug: true, ilceId: true, ilce: { select: { ad: true } } } });
  const anahtar = new Map(mah.map((x) => [`${x.ilce.ad}|${x.slug}`, x]));
  const adlar = new Map(mah.map((x) => [x.id, x.ad]));
  const komsuluk = komsulukKur((ilce, slug) => { const x = anahtar.get(`${ilce}|${slug}`); return x ? { id: x.id, ilceId: x.ilceId } : null; });
  return { komsuIlceler: new Set(k.flatMap((x) => [`${x.ilceId}-${x.komsuIlceId}`, `${x.komsuIlceId}-${x.ilceId}`])), altBolgeMahalleleri: m, komsuluk, mahalleAdi: (id) => adlar.get(id) };
}
/** DB satırı → eşleştirme motorunun beklediği düz veri (Decimal → number) */
export function kayitVeri(k: any): Record<string, any> {
  const n = (v: any) => (v == null ? null : Number(v));
  return { ...k, fiyat: n(k.fiyat), minFiyat: n(k.minFiyat), maxFiyat: n(k.maxFiyat), lokasyonlar: k.lokasyonlar ?? [], ozellik: k.ozellik ?? undefined };
}

// ───────────────────────────── GOOGLE KİŞİLER (v3.21 — çift yönlü) ─────────────────────────────
/** Bir turda Google'dan istenen kişi sayısı. Küçük tutulur: her sayfa ayrı işlenip ilerleme saklanır (Worker süre sınırı). */
export const GOOGLE_SAYFA_BOYU = 100;
/** v3.21.1 — Bir turda (tek istekte) işlenen en çok sayfa. Worker'ın istek başına işlemci süresi sınırına takılmamak için
 *  büyük rehberler (ör. 8.000 kişi) çok sayıda kısa turda alınır; arayüz `devamEdecek` oldukça turu yineler. */
export const GOOGLE_TUR_SAYFA_SINIRI = 2;
/** Bir turda Google'a gönderilen en çok kişi (oluşturma + güncelleme). Kalanı sonraki tura kalır. */
export const GOOGLE_GONDERIM_SINIRI = 20;
type GoogleOzet = { gelen: number; yeni: number; guncellenen: number; baglanan: number; degismeyen: number; cakisma: number; silinen: number; atlanan: number; birlesen: number; haric: number; gonderilenYeni: number; gonderilenGuncel: number; gonderimHata: number; gonderimKalan: number };
const bosGoogleOzet = (): GoogleOzet => ({ gelen: 0, yeni: 0, guncellenen: 0, baglanan: 0, degismeyen: 0, cakisma: 0, silinen: 0, atlanan: 0, birlesen: 0, haric: 0, gonderilenYeni: 0, gonderilenGuncel: 0, gonderimHata: 0, gonderimKalan: 0 });
const kisiSec = { id: true, adSoyad: true, telefon: true, ikincilTelefon: true, email: true, sirket: true, notlar: true, roller: true, googleResourceName: true, googleSnapshot: true } as const;

/** Anahtar'dan silindiği için yeniden eklenmeyecek Google kişileri (kimlik + telefon anahtarı) */
export async function googleHaricListesi(prisma: PrismaClient): Promise<HaricListesi> {
  const h = await prisma.senkronHaric.findMany({ where: { saglayici: "GOOGLE_KISILER" }, select: { disKimlik: true, telefonAnahtar: true } });
  return { kimlikler: new Set(h.map((x) => x.disKimlik).filter((x): x is string => !!x)), telefonlar: new Set(h.map((x) => x.telefonAnahtar).filter((x): x is string => !!x)) };
}

/**
 * Kişiler Anahtar'dan SİLİNMEDEN HEMEN ÖNCE çağrılır. Google bağlıysa silinen kişilerin Google kimliği ve telefon
 * anahtarı "silinenler" listesine yazılır: kişi Google'da durur (oradan silinmez), ama bir sonraki eşitlemede
 * Anahtar'a geri de gelmez. Google bağlı değilse hiçbir şey yazılmaz.
 */
export async function googleSilinenleriIsaretle(prisma: PrismaClient, kisiIdleri: string[]): Promise<number> {
  if (!kisiIdleri.length) return 0;
  const e = await prisma.entegrasyon.findFirst({ where: { saglayici: "GOOGLE_KISILER" }, select: { durum: true } });
  if (!e || e.durum === "BAGLI_DEGIL") return 0;
  const kisiler = await prisma.kisi.findMany({ where: { id: { in: kisiIdleri } }, select: { adSoyad: true, telefon: true, googleResourceName: true } });
  const satirlar = kisiler.map((k) => ({ saglayici: "GOOGLE_KISILER" as const, disKimlik: k.googleResourceName, telefonAnahtar: telAnahtari(k.telefon), ad: k.adSoyad.slice(0, 160) })).filter((x) => x.disKimlik || x.telefonAnahtar);
  if (satirlar.length) await prisma.senkronHaric.createMany({ data: satirlar as any });
  return satirlar.length;
}

/** Google bağlı ve çift yönlü açık mı? (kişi kaydedilirken "gönderilecek" işareti koymak için) */
export async function googleGonderimAcik(prisma: PrismaClient): Promise<boolean> {
  const e = await prisma.entegrasyon.findFirst({ where: { saglayici: "GOOGLE_KISILER" } });
  if (!e || e.durum !== "BAGLI") return false;
  const a = ayarlarOf(e);
  return a.googleYaz && a.yazmaIzni !== false;
}

/** "Silinenleri yeniden getir": listeyi boşaltır ve bir sonraki eşitlemeyi tam eşitleme yapar (Google'daki herkes yeniden değerlendirilir). */
export async function googleHaricTemizle(prisma: PrismaClient): Promise<{ temizlenen: number }> {
  const r = await prisma.senkronHaric.deleteMany({ where: { saglayici: "GOOGLE_KISILER" } });
  await prisma.entegrasyon.updateMany({ where: { saglayici: "GOOGLE_KISILER" }, data: { syncToken: null, imlec: J(null) } });
  return { temizlenen: r.count };
}

/**
 * Bir ofisin Google Kişiler eşitlemesi — iki aşama, tek tur:
 *   1) ÇEK  (Google → Anahtar): sayfa sayfa (200'er). Her sayfa planlanır, uygulanır, ilerleme saklanır.
 *      Süre bütçesi dolarsa `devamEdecek: true` döner; sonraki çağrı kaldığı sayfadan sürer.
 *   2) GÖNDER (Anahtar → Google): çekme bittiyse ve çift yönlü açıksa. Bekleyen yeni kişiler oluşturulur,
 *      Anahtar'da düzeltilen alanlar güncellenir. Google'dan hiçbir şey SİLİNMEZ.
 */
export async function googleSenkronCalistir(prisma: PrismaClient, o: SenkronSecenek = {}) {
  const f0 = o.f ?? fetch, butce = o.butceMs ?? 20_000, bas = Date.now();
  // Dış istek sayacı: sınır dolunca tur erken biter, kalan iş sonraki tura kalır (Workers ücretsiz plan: çağrı başına 50)
  const sayac = o.sayac ?? { n: 0, sinir: 40 };
  const f = ((...a: Parameters<Fetch>) => { sayac.n++; return f0(...a); }) as Fetch;
  const yer = (gerek = 1) => sayac.n + gerek <= sayac.sinir;
  const e = await entegrasyon(prisma, "GOOGLE_KISILER");
  if (e.durum !== "BAGLI" || !e.tokenSifreli) return { atlandi: "Google Kişiler bağlı değil" };
  if (!yer(3)) return { atlandi: "Bu turda istek sınırı doldu" };
  if (!(await kilitAl(prisma, "GOOGLE_KISILER", butce + 15_000))) return { atlandi: "Başka bir senkron sürüyor" };
  const im: { sayfa?: string | null; calismaId?: string | null } = o.tam ? {} : { ...((e.imlec as object) ?? {}) };
  // Yarım kalmış bir içe aktarma sürüyorsa aynı geçmiş satırı büyür (her tur için ayrı satır açılmaz)
  const onceki = im.calismaId ? await prisma.senkronCalisma.findFirst({ where: { id: im.calismaId } }) : null;
  const calisma = onceki ?? (await prisma.senkronCalisma.create({ data: { saglayici: "GOOGLE_KISILER", tetik: o.tetik ?? "zamanlayici" } }));
  const ozet: GoogleOzet = { ...bosGoogleOzet(), ...((onceki?.ozet as object) ?? {}) };
  let syncToken = o.tam ? null : e.syncToken;
  let sayfa = im.sayfa ?? null;
  let bitti = false, gonderimde = false;
  const imlecYaz = () => J({ ...(sayfa ? { sayfa } : {}), ...(bitti ? {} : { calismaId: calisma.id }) });
  try {
    const ayar = ayarlarOf(e);
    const tok = await erisimYenile(f, { refreshToken: sifreCoz(e.tokenSifreli), clientId: process.env.GOOGLE_CLIENT_ID!, clientSecret: process.env.GOOGLE_CLIENT_SECRET! });
    // v3.22.2 — Bağlam (etiket adları, sahip, silinenler listesi, TÜM kişiler) YALNIZCA Google'dan değişen kişi geldiyse yüklenir.
    // Artımlı anahtarla "değişiklik yok" turu 7.800 kişiyi okumaz (eskiden her tur okuyordu: Worker CPU sınırı / 503).
    let grupAdi: Map<string, string> | null = null;
    const grupAdlari = async () => (grupAdi ??= new Map((await gruplar(f, tok.access_token)).map((g) => [g.resourceName, g.formattedName ?? g.name ?? ""])));
    let baglam: { sahip: string | null; haric: HaricListesi; mevcut: MevcutKisi[] } | null = null;
    const baglamYukle = async () => {
      if (baglam) return baglam;
      // İçe aktarılan kişilerin sahibi: bağlantıyı kuran kullanıcı (hâlâ ofisteyse)
      const sahipAday = ayar.baglayanKullaniciId ?? ofisBaglami().kullaniciId;
      const sahip = sahipAday && (await prisma.kullanici.findFirst({ where: { id: sahipAday }, select: { id: true } })) ? sahipAday : null;
      const haric = await googleHaricListesi(prisma);
      const mevcut: MevcutKisi[] = (await prisma.kisi.findMany({ select: kisiSec })).map((k) => ({ ...k, googleSnapshot: k.googleSnapshot as any }));
      return (baglam = { sahip, haric, mevcut });
    };

    // ───── 1) ÇEK: Google → Anahtar ─────
    let sayfaSifirlandi = false, islenenSayfa = 0;
    const sayfaSiniri = o.sayfaSiniri ?? GOOGLE_TUR_SAYFA_SINIRI;
    while (!bitti && Date.now() - bas < butce && yer() && islenenSayfa < sayfaSiniri) {
      islenenSayfa++;
      let r;
      try { r = await kisiSayfasi(f, tok.access_token, { sayfaToken: sayfa, syncToken, sayfaBoyu: GOOGLE_SAYFA_BOYU }); }
      catch (x) {
        // Artımlı anahtarın ya da sayfa anahtarının süresi dolduysa baştan (tam) çekilir — bir kez
        const sifirla = x instanceof GoogleHatasi && ((x.neden === "SYNC_TOKEN_DOLDU" && syncToken) || (x.durum === 400 && sayfa && !sayfaSifirlandi));
        if (sifirla) { syncToken = null; sayfa = null; sayfaSifirlandi = true; continue; }
        throw x;
      }
      if (!(r.connections ?? []).length) { // değişiklik yok / boş sayfa: planlanacak bir şey yok
        sayfa = r.nextPageToken ?? null;
        if (!sayfa) { syncToken = r.nextSyncToken ?? syncToken; bitti = true; }
        await prisma.entegrasyon.updateMany({ where: { saglayici: "GOOGLE_KISILER" }, data: { syncToken, imlec: imlecYaz() } });
        continue;
      }
      const { sahip, haric, mevcut } = await baglamYukle();
      const gAd = await grupAdlari();
      const donusum: GoogleDonusum[] = (r.connections ?? []).map((p) => googleKisiDonustur(p, gAd, ayar.sadeceEtiketler));
      const plan = googleSenkronPlani(mevcut, donusum, haric);
      const mevcutById = new Map(mevcut.map((m) => [m.id, m]));

      // a) yeni kişiler — tek sorgu; aynı telefon başka kanaldan / başka danışmanda varsa atlanır (birleşen sayılır)
      if (plan.ekle.length) {
        const eklenen = await prisma.kisi.createManyAndReturn({
          data: plan.ekle.map((x) => ({ ...(x.alanlar as any), roller: x.roller, kaynak: "GOOGLE", googleResourceName: x.resourceName, googleEtag: x.etag, googleSnapshot: J(x.snapshot), sahipKullaniciId: sahip })),
          skipDuplicates: true, select: kisiSec,
        });
        for (const k of eklenen) mevcut.push({ ...k, googleSnapshot: k.googleSnapshot as any });
        const atlandi = plan.ekle.length - eklenen.length;
        plan.ozet.yeni -= atlandi; plan.ozet.birlesen += atlandi;
      }
      // b) güncellenen / yeni bağlanan kişiler — yalnızca gerçekten değişen satır yazılır
      for (const x of plan.guncelle) {
        const k = mevcutById.get(x.id)!;
        const degisti = Object.keys(x.degisiklik).length > 0 || x.yeniRoller.length > 0 || x.baglandi || !esit(k.googleSnapshot, x.snapshot);
        if (!degisti) continue;
        const roller = [...new Set([...k.roller, ...x.yeniRoller])];
        try {
          await prisma.kisi.update({ where: { id: x.id }, data: { ...(x.degisiklik as any), roller, googleResourceName: x.resourceName, googleEtag: x.etag, googleSnapshot: J(x.snapshot), kaynaktaSilindi: null } });
          Object.assign(k, x.degisiklik, { roller, googleResourceName: x.resourceName, googleSnapshot: x.snapshot });
        } catch (err: any) {
          // Google'daki yeni telefon Anahtar'da başka bir kişide kayıtlı: telefon dışındaki alanlar alınır
          if (err?.code !== "P2002") throw err;
          const { telefon: yeniTel, ...kalan } = x.degisiklik as any;
          await prisma.kisi.update({ where: { id: x.id }, data: { ...kalan, roller, googleResourceName: x.resourceName, googleEtag: x.etag, googleSnapshot: J(x.snapshot), kaynaktaSilindi: null } });
          Object.assign(k, kalan, { roller, googleResourceName: x.resourceName, googleSnapshot: x.snapshot });
          x.cakismalar.push({ alan: "telefon", onceki: k.telefon, yerel: k.telefon, uzak: yeniTel });
          plan.ozet.cakisma++;
        }
        await cakismalariYaz(prisma, "GOOGLE_KISILER", "KISI", x.id, x.cakismalar);
      }
      // c) Google'da silinen: Anahtar'da kalır, bağı kopar
      for (const x of plan.bagiKopar) {
        const k = await prisma.kisi.findFirst({ where: { id: x.id }, select: { notlar: true } });
        await prisma.kisi.update({ where: { id: x.id }, data: { googleResourceName: null, googleSnapshot: J(null), googleBekliyor: null, kaynaktaSilindi: new Date(), notlar: [k?.notlar, `Google Kişiler'den silindi (${new Date().toLocaleDateString("tr-TR")})`].filter(Boolean).join("\n") } });
        const m = mevcutById.get(x.id); if (m) { m.googleResourceName = null; m.googleSnapshot = null; }
      }
      for (const a of Object.keys(plan.ozet) as (keyof typeof plan.ozet)[]) ozet[a] += plan.ozet[a];
      sayfa = r.nextPageToken ?? null;
      if (!sayfa) { syncToken = r.nextSyncToken ?? null; bitti = true; }
      // İlerleme her sayfadan sonra saklanır: tur yarıda kesilse de işlenen sayfa yeniden işlenmez
      await prisma.entegrasyon.updateMany({ where: { saglayici: "GOOGLE_KISILER" }, data: { syncToken, imlec: imlecYaz() } });
    }

    // ───── 2) GÖNDER: Anahtar → Google (çekme bittiyse) ─────
    // Yalnızca "gönderilecek" işaretli kişiler (kisi.googleBekliyor): elle eklenen yeni kişi ya da Anahtar'da düzeltilen bağlı kişi.
    const yazma = ayar.googleYaz && ayar.yazmaIzni !== false;
    if (bitti && yazma && Date.now() - bas < butce) {
      const adaylar = await prisma.kisi.findMany({ where: { googleBekliyor: { not: null } }, orderBy: { googleBekliyor: "asc" }, take: 500, select: { ...kisiSec, googleBekliyor: true, kaynaktaSilindi: true } });
      if (!adaylar.length) ozet.gonderimKalan = 0; // v3.22.2 — gönderilecek kişi yoksa başka hiçbir sorgu / istek yapılmaz
      else {
      gonderimde = true;
      const gAd = await grupAdlari();
      const cakismali = new Set((await prisma.senkronCakisma.findMany({ where: { saglayici: "GOOGLE_KISILER", durum: "ACIK", hedefTip: "KISI" }, select: { hedefId: true } })).map((c) => c.hedefId));
      // Etiket süzgeci açıkken Google'da "görmediğimiz" kişiler olabilir → mükerrer açmamak için yeni kişi gönderilmez
      const gp = googleGonderimPlani(adaylar.map((k): GonderimAdayi => ({ ...k, googleSnapshot: k.googleSnapshot as any })), { cakismali, sinir: GOOGLE_GONDERIM_SINIRI, olusturma: !ayar.sadeceEtiketler.length });
      const snapOf = (p: GooglePerson, yedek: object) => { const d = googleKisiDonustur(p, gAd); return d.kisi ? Object.fromEntries(GOOGLE_ALANLARI.map((a) => [a, d.kisi![a]])) : yedek; };
      const olumcul = (err: unknown) => err instanceof GoogleHatasi && (err.neden === "YENIDEN_YETKI" || err.durum === 403);
      let islenmeyen = 0;
      if (gp.temizle.length) await prisma.kisi.updateMany({ where: { id: { in: gp.temizle } }, data: { googleBekliyor: null } });
      for (const x of gp.olustur) {
        if (Date.now() - bas > butce || !yer(1)) { islenmeyen++; continue; }
        try {
          const p = await kisiOlustur(f, tok.access_token, googleOlusturmaGovdesi(x.alanlar));
          await prisma.kisi.update({ where: { id: x.id }, data: { googleResourceName: p.resourceName, googleEtag: p.etag ?? null, googleBekliyor: null, googleSnapshot: J(snapOf(p, { ...x.alanlar, ikincilTelefon: x.alanlar.ikincilTelefon ?? null, email: x.alanlar.email ?? null, sirket: x.alanlar.sirket ?? null, notlar: null })) } });
          ozet.gonderilenYeni++;
        } catch (err) { if (olumcul(err)) throw err; ozet.gonderimHata++; }
      }
      for (const x of gp.guncelle) {
        if (Date.now() - bas > butce || !yer(2)) { islenmeyen++; continue; }
        try {
          const guncel = await kisiGetir(f, tok.access_token, x.resourceName);
          if (!guncel || guncel.metadata?.deleted) { // Google'da silinmiş: Anahtar'da kalır, bağı kopar, yeniden oluşturulmaz
            await prisma.kisi.update({ where: { id: x.id }, data: { googleResourceName: null, googleSnapshot: J(null), googleBekliyor: null, kaynaktaSilindi: new Date() } });
            ozet.silinen++; continue;
          }
          const { govde, maske } = googleGuncellemeGovdesi(guncel, x.degisen, x.onceki);
          const sonuc = maske.length ? await kisiGuncelle(f, tok.access_token, x.resourceName, govde, maske) : guncel;
          await prisma.kisi.update({ where: { id: x.id }, data: { googleEtag: sonuc.etag ?? null, googleBekliyor: null, googleSnapshot: J({ ...x.onceki, ...x.degisen }) } });
          if (maske.length) ozet.gonderilenGuncel++;
        } catch (err) { if (olumcul(err)) throw err; ozet.gonderimHata++; } // işaret durur → sonraki turda yeniden denenir
      }
      ozet.gonderimKalan = gp.kalan + islenmeyen;
      }
    }

    const devam = !bitti || ozet.gonderimKalan > 0;
    await prisma.entegrasyon.updateMany({ where: { saglayici: "GOOGLE_KISILER" }, data: { syncToken, imlec: imlecYaz(), sonSenkron: new Date(), sonHata: null } });
    await prisma.senkronCalisma.update({ where: { id: calisma.id }, data: { bitis: new Date(), durum: ozet.cakisma ? "CAKISMA" : "BASARILI", yeni: ozet.yeni, guncellenen: ozet.guncellenen, baglanan: ozet.baglanan, cakisma: ozet.cakisma, atlanan: ozet.atlanan, silinen: ozet.silinen, geriYazilan: ozet.gonderilenYeni + ozet.gonderilenGuncel, devamEdecek: devam, ozet: J(ozet) } });
    return { calismaId: calisma.id, ozet, devamEdecek: devam };
  } catch (x: any) {
    const yeniden = x instanceof GoogleHatasi && x.neden === "YENIDEN_YETKI";
    // Yazma izni yoksa (403) çift yönlü kapatılır; çekme çalışmaya devam eder
    const yazmaYok = gonderimde && x instanceof GoogleHatasi && x.durum === 403;
    await prisma.entegrasyon.updateMany({ where: { saglayici: "GOOGLE_KISILER" }, data: { sonHata: String(x?.message ?? x).slice(0, 500), syncToken, imlec: imlecYaz(), ...(yeniden ? { durum: "YENIDEN_YETKI" } : {}), ...(yazmaYok ? { ayarlar: J({ ...ayarlarOf(e), yazmaIzni: false }) } : {}) } });
    await prisma.senkronCalisma.update({ where: { id: calisma.id }, data: { bitis: new Date(), durum: "HATA", hata: String(x?.message ?? x).slice(0, 1000), ozet: J(ozet) } });
    throw x;
  } finally { await kilitBirak(prisma, "GOOGLE_KISILER"); }
}

/**
 * Zamanlayıcı (platform bağlamı): Google'ı bağlı ofisleri sırayla eşitler — en uzun süredir eşitlenmeyen önce.
 * Her ofis kendi bağlamında (bağlantıyı kuran kullanıcı adına, ofis yöneticisi yetkisiyle) çalışır; ofisler birbirini görmez.
 */
export async function tumOfislerdeGoogleSenkron(prisma: PrismaClient, o: SenkronSecenek & { enFazla?: number } = {}) {
  const liste = await prisma.entegrasyon.findMany({ where: { saglayici: "GOOGLE_KISILER", durum: "BAGLI", ofis: { durum: "AKTIF" } }, orderBy: { sonSenkron: { sort: "asc", nulls: "first" } }, take: o.enFazla ?? 5 });
  const sayac: IstekSayaci = o.sayac ?? { n: 0, sinir: 40 }; // tüm ofisler için ORTAK sınır (tek Worker çağrısı)
  const sonuc: { ofisId: string; sonuc: unknown }[] = [];
  for (const e of liste) {
    const a = ayarlarOf(e);
    if (!a.otomatik || (e.sonSenkron && Date.now() - e.sonSenkron.getTime() < a.aralikDk * 60_000 - 30_000)) { sonuc.push({ ofisId: e.ofisId, sonuc: { atlandi: "Zamanı gelmedi" } }); continue; }
    if (sayac.n + 3 > sayac.sinir) { sonuc.push({ ofisId: e.ofisId, sonuc: { atlandi: "Bu turda istek sınırı doldu" } }); continue; }
    try {
      const r = await kiracilikIcinde({ ofisId: e.ofisId, kullaniciId: a.baglayanKullaniciId ?? "", rol: "OFIS_YONETICISI", eposta: e.hesap ?? "" }, () => googleSenkronCalistir(prisma, { ...o, sayac, tetik: "zamanlayici", butceMs: o.butceMs ?? 12_000 }));
      sonuc.push({ ofisId: e.ofisId, sonuc: r });
    } catch (x: any) { sonuc.push({ ofisId: e.ofisId, sonuc: { hata: String(x?.message ?? x).slice(0, 300) } }); }
  }
  return sonuc;
}

// ───────────────────────────── NOTION ─────────────────────────────
/** Bir tablodan (artımlı ya da tam) sayfaları süre bütçesi içinde çeker */
async function sayfalariCek(n: NotionIstemcisi, t: NotionTablo, im: { sonra?: string | null; imlec?: string | null }, tam: boolean, bitisZamani: number) {
  const sayfalar: NotionSayfa[] = [];
  let imlec = im.imlec ?? null, enSon = im.sonra ?? null, bitti = false;
  const sonra = tam ? null : im.sonra ? new Date(new Date(im.sonra).getTime() - 120_000).toISOString() : null; // Notion dakikaya yuvarlar → 2 dk geri
  while (Date.now() < bitisZamani) {
    const r = await n.sorgula(dataSourceId(t), { imlec, sonra });
    sayfalar.push(...r.results);
    for (const s of r.results) if (!enSon || s.last_edited_time > enSon) enSon = s.last_edited_time;
    if (!r.has_more) { bitti = true; imlec = null; break; }
    imlec = r.next_cursor;
  }
  return { sayfalar, bitti, imlec, enSon };
}

export async function notionSenkronCalistir(prisma: PrismaClient, o: SenkronSecenek & { token?: string; uygulamaUrl?: string } = {}) {
  const butce = o.butceMs ?? 45_000, bas = Date.now(), simdi = o.simdi?.() ?? new Date();
  const e = await entegrasyon(prisma, "NOTION");
  const token = o.token ?? process.env.NOTION_TOKEN;
  if (e.durum !== "BAGLI" || !token) return { atlandi: "Notion bağlı değil" };
  if (!(await kilitAl(prisma, "NOTION", butce + 15_000))) return { atlandi: "Başka bir senkron sürüyor" };
  const calisma = await prisma.senkronCalisma.create({ data: { saglayici: "NOTION", tetik: o.tetik ?? "zamanlayici" } });
  const n = notionIstemcisi(token, o.f ?? fetch);
  const imlec: any = { ...((e.imlec as object) ?? {}) };
  const ayar = ayarlarOf(e);
  // Günde bir tam tarama: Notion'da silinen sayfaları yakalamak için
  const tam = o.tam || !imlec.tamTarama || simdi.getTime() - new Date(imlec.tamTarama).getTime() > 86_400_000;
  const ozet = { yeni: 0, guncellenen: 0, baglanan: 0, degismeyen: 0, cakisma: 0, kontrol: 0, hatali: 0, arsivlenen: 0, geriYazilan: 0, notionEslesmesi: 0, kisiYeni: 0, kisiGuncellenen: 0 };
  const kontrolListesi: { notionId: string; baslik: string; nedenler: string[] }[] = [];
  const hataListesi: { notionId: string; baslik: string; hatalar: string[] }[] = [];
  let devam = false;
  try {
    const ix = await lokasyonIndeksiYukle(prisma);
    const ttl = await ttlAyarlari(prisma);
    const turetilenTalepler: KayitTaslagi[] = [];
    const tumGorulen: Record<string, Set<string>> = {};
    const notionEslesmeleri: [string, string][] = [];
    for (const t of SENKRON_SIRASI) {
      const c = await sayfalariCek(n, t, imlec[t] ?? {}, tam, bas + butce * 0.7);
      if (!c.bitti) devam = true;
      imlec[t] = { sonra: c.bitti ? c.enSon : (imlec[t]?.sonra ?? null), imlec: c.imlec };
      if (tam && c.bitti) tumGorulen[t] = new Set(c.sayfalar.map((s) => s.id));

      if (t === "KISI") {
        const taslaklar = c.sayfalar.map(kisiTaslagi).filter((x): x is KisiTaslagi => !!x);
        const mevcut = (await prisma.kisi.findMany()).map((k): MevcutNotionKisi => ({ id: k.id, adSoyad: k.adSoyad, telefon: k.telefon, notlar: k.notlar, referans: k.referans, roller: k.roller, uzmanlikAileleri: k.uzmanlikAileleri, ilanSahibiTipi: k.ilanSahibiTipi, notionId: k.notionId, notionSnapshot: k.notionSnapshot as any }));
        const p = kisiPlani(mevcut, taslaklar);
        for (const x of p.ekle) {
          const a = x.taslak.alanlar;
          try { await prisma.kisi.create({ data: { ...a, roller: x.taslak.roller as any, uzmanlikAileleri: x.taslak.uzmanlikAileleri, ilanSahibiTipi: (x.taslak.ilanSahibiTipi ?? "BILINMIYOR") as any, kaynak: "NOTION", notionId: x.taslak.notionId, notionSnapshot: J(a) } }); ozet.kisiYeni++; }
          catch (err: any) { if (err?.code !== "P2002") throw err; }
        }
        for (const x of p.guncelle) {
          const k = mevcut.find((m) => m.id === x.id)!;
          await prisma.kisi.update({ where: { id: x.id }, data: { ...(x.degisiklik as any), roller: [...new Set([...k.roller, ...x.yeniRoller])] as any, uzmanlikAileleri: [...new Set([...k.uzmanlikAileleri, ...x.yeniUzmanlik])], ...(x.ilanSahibiTipi ? { ilanSahibiTipi: x.ilanSahibiTipi as any } : {}), notionId: x.taslak.notionId, notionSnapshot: J(x.snapshot) } });
          await cakismalariYaz(prisma, "NOTION", "KISI", x.id, x.cakismalar);
          if (Object.keys(x.degisiklik).length || x.yeniRoller.length) ozet.kisiGuncellenen++;
          ozet.cakisma += x.cakismalar.length;
        }
        for (const k of taslaklar) { const tt = kisidenTalep(k, k.sonDuzenleme); if (tt) turetilenTalepler.push(tt); }
        continue;
      }

      const kisiMap = new Map((await prisma.kisi.findMany({ where: { notionId: { not: null } }, select: { id: true, notionId: true } })).map((k) => [k.notionId!, k.id]));
      const taslaklar = [...c.sayfalar.map(t === "PORTFOY" ? portfoyTaslagi : talepTaslagi), ...(t === "TALEP" ? turetilenTalepler : [])];
      const hazir: HazirKayit[] = taslaklar.map((tt) => ({ taslak: tt, ...kayitHazirla(tt, ix, (id) => kisiMap.get(id), varsayilanValidUntil(tt.tablo, tt.girdi.islemTipi as string, tt.girdi.aciliyet as string, simdi, ttl)) }));
      const mevcutRows = await prisma.kayit.findMany({ where: { tip: t }, include: { lokasyonlar: true, ozellik: true } });
      const mevcut: MevcutNotionKayit[] = mevcutRows.map((k) => ({ id: k.id, tip: t, notionId: k.notionId, notionSnapshot: k.notionSnapshot as any, veri: kayitVeri(k), ilceler: k.lokasyonlar.map((l) => l.ilceId).filter((x): x is number => x != null) }));
      const p = kayitPlani(mevcut, hazir);
      for (const x of p.ekle) {
        try {
          const k = await kayitOlustur(prisma, x.veri);
          await prisma.kayit.update({ where: { id: k.id }, data: { notionId: x.taslak.notionId, notionSonSync: simdi, notionSnapshot: J({ ...Object.fromEntries(Object.entries(x.veri).filter(([a]) => a !== "lokasyonlar" && a !== "kisiler" && a !== "ozellik")), __tablo: x.taslak.tablo, __duzenleme: x.taslak.sonDuzenleme }) } });
          ozet.yeni++;
          if (x.kontrol.length) { ozet.kontrol++; kontrolListesi.push({ notionId: x.taslak.notionId, baslik: String(x.veri.baslik ?? ""), nedenler: x.kontrol }); }
        } catch (err: any) {
          if (err?.code !== "P2002") throw err;
          hataListesi.push({ notionId: x.taslak.notionId, baslik: String(x.veri.baslik ?? ""), hatalar: ["Aynı metinli kayıt zaten var (WhatsApp'tan gelmiş olabilir)"] });
        }
      }
      for (const x of p.guncelle) {
        const d: any = { ...x.degisiklik };
        if ("lokasyonHam" in d) {
          await prisma.kayitLokasyon.deleteMany({ where: { kayitId: x.id } });
          d.lokasyonlar = { create: x.veri.lokasyonlar.map((l, sira) => ({ ...l, sira })) };
        }
        await prisma.kayit.update({ where: { id: x.id }, data: { ...d, notionId: x.taslak.notionId, notionSonSync: simdi, notionSnapshot: J(x.snapshot) } });
        for (const b of x.veri.kisiler) await prisma.kayitKisi.upsert({ where: { kayitId_kisiId_rol: { kayitId: x.id, kisiId: b.kisiId, rol: b.rol as any } }, update: {}, create: { kayitId: x.id, kisiId: b.kisiId, rol: b.rol as any } });
        await cakismalariYaz(prisma, "NOTION", "KAYIT", x.id, x.cakismalar);
      }
      for (const x of [...p.arsivle, ...(tam && tumGorulen[t] ? kaybolanlar(mevcut, t, tumGorulen[t]) : [])])
        await prisma.kayit.update({ where: { id: x.id }, data: { durum: "ARSIV", arsivNotu: "Notion'da silindi / çöpe atıldı" } });
      notionEslesmeleri.push(...p.notionEslesmeleri);
      ozet.guncellenen += p.ozet.guncellenen; ozet.baglanan += p.ozet.baglanan; ozet.degismeyen += p.ozet.degismeyen; ozet.cakisma += p.ozet.cakisma; ozet.hatali += p.ozet.hatali; ozet.arsivlenen += p.ozet.arsivlenen;
      hataListesi.push(...p.hatali);
    }

    // Notion'da talebe elle bağlanmış portföyler → eşleşme takibine "Bildirildi"
    if (notionEslesmeleri.length) {
      const b = await lokasyonBaglamiYukle(prisma);
      for (const [tn, pn] of notionEslesmeleri) {
        const [tk, pk] = await Promise.all([prisma.kayit.findFirst({ where: { notionId: tn }, include: { lokasyonlar: true, ozellik: true } }), prisma.kayit.findFirst({ where: { notionId: pn }, include: { lokasyonlar: true, ozellik: true } })]);
        if (!tk || !pk) continue;
        const s = eslesmeOnizle(kayitVeri(tk) as any, kayitVeri(pk) as any, b);
        await prisma.match.upsert({ where: { talepId_portfoyId: { talepId: tk.id, portfoyId: pk.id } }, update: {}, create: { talepId: tk.id, portfoyId: pk.id, matematikSkor: s.skor, finalSkor: s.skor, uygunluk: s.uygunluk, durum: "BILDIRILDI", operasyonNotu: "Notion'da ilişkilendirilmişti" } });
        ozet.notionEslesmesi++;
      }
    }

    // Geri yazım: eşleşme skoru, sayısı, en iyi eşleşme, uygulama linki
    if (ayar.geriYaz && Date.now() - bas < butce) {
      if (!imlec.alanlarHazir) {
        for (const t of ["PORTFOY", "TALEP"] as const) {
          const sema = await n.semaGetir(dataSourceId(t));
          const eksik = eksikGeriYazimAlanlari(Object.keys(sema.properties));
          if (Object.keys(eksik).length) await n.alanEkle(dataSourceId(t), eksik);
        }
        imlec.alanlarHazir = true;
      }
      const tum = await prisma.kayit.findMany({ where: { durum: "ACTIVE" }, include: { lokasyonlar: true, ozellik: true } });
      const oz = eslesmeOzetleri(tum.map((k) => ({ id: k.id, veri: kayitVeri(k) })), await lokasyonBaglamiYukle(prisma));
      const url = (o.uygulamaUrl ?? process.env.UYGULAMA_URL ?? "").replace(/\/$/, "");
      for (const k of tum) {
        if (!k.notionId || k.notionId.includes("#")) continue;
        if (Date.now() - bas > butce) { devam = true; break; }
        const d = geriYazimDegerleri(oz.get(k.id), url ? `${url}/kayit/${k.id}` : null);
        if (!geriYazimGerekli(k.notionGeriYazim, d)) continue;
        try {
          const s = await n.sayfaGuncelle(k.notionId, geriYazimOzellikleri(d, simdi));
          await prisma.kayit.update({ where: { id: k.id }, data: { notionGeriYazim: J(d), notionSonSync: new Date(s.last_edited_time ?? simdi) } });
          ozet.geriYazilan++;
        } catch (err: any) {
          await prisma.notionSyncLog.create({ data: { kayitId: k.id, notionId: k.notionId, yon: "anahtar_to_notion", durum: "HATA", hata: String(err?.message ?? err).slice(0, 500) } });
        }
      }
    }
    if (tam && !devam) imlec.tamTarama = simdi.toISOString();
    await prisma.entegrasyon.updateMany({ where: { saglayici: "NOTION" }, data: { imlec: J(imlec), sonSenkron: new Date(), sonHata: null } });
    await prisma.senkronCalisma.update({ where: { id: calisma.id }, data: { bitis: new Date(), durum: ozet.cakisma ? "CAKISMA" : "BASARILI", yeni: ozet.yeni, guncellenen: ozet.guncellenen, baglanan: ozet.baglanan, cakisma: ozet.cakisma, atlanan: ozet.hatali, silinen: ozet.arsivlenen, geriYazilan: ozet.geriYazilan, devamEdecek: devam, ozet: J({ ...ozet, kontrolListesi: kontrolListesi.slice(0, 50), hataListesi: hataListesi.slice(0, 50) }) } });
    return { calismaId: calisma.id, ozet, kontrolListesi, hataListesi, devamEdecek: devam };
  } catch (x: any) {
    await prisma.entegrasyon.updateMany({ where: { saglayici: "NOTION" }, data: { sonHata: String(x?.message ?? x), imlec: J(imlec) } });
    await prisma.senkronCalisma.update({ where: { id: calisma.id }, data: { bitis: new Date(), durum: "HATA", hata: String(x?.message ?? x).slice(0, 1000) } });
    throw x;
  } finally { await kilitBirak(prisma, "NOTION"); }
}

/** Notion bağlantısını doğrular: üç tablo erişilebilir mi, beklenen alanlar var mı (bağlantı raporu) */
export async function notionBaglantiRaporu(token: string, f: Fetch = fetch) {
  const { alanRaporu } = await import("../notion/geri-yazim");
  const n = notionIstemcisi(token, f);
  const tablolar = [];
  for (const t of SENKRON_SIRASI) {
    try {
      const s = await n.semaGetir(dataSourceId(t));
      tablolar.push({ tablo: t, ad: NOTION_TABLOLARI[t].ad, erisim: true, ...alanRaporu(NOTION_TABLOLARI[t].alan as any, s.properties, NOTION_TABLOLARI[t].okunmayan as any) });
    } catch (x: any) { tablolar.push({ tablo: t, ad: NOTION_TABLOLARI[t].ad, erisim: false, hata: String(x?.message ?? x) }); }
  }
  return { tamam: tablolar.every((t) => t.erisim), tablolar };
}

// ───────── Hepsi + çakışma çözümü ─────────
export async function senkronCalistir(prisma: PrismaClient, o: SenkronSecenek & { kaynak?: "google" | "notion" | "hepsi" } = {}) {
  const sonuc: Record<string, unknown> = {};
  const otomatik = (o.tetik ?? "zamanlayici") === "zamanlayici";
  for (const [ad, s, fn] of [["google", "GOOGLE_KISILER", googleSenkronCalistir], ["notion", "NOTION", notionSenkronCalistir]] as const) {
    if (o.kaynak && o.kaynak !== "hepsi" && o.kaynak !== ad) continue;
    if (ad === "notion" && !notionAcik()) continue; // v3.21 — Notion senkronu gizli (src/lib/ozellikler.ts)
    const e = await entegrasyon(prisma, s);
    const a = ayarlarOf(e);
    if (otomatik && (!a.otomatik || (e.sonSenkron && Date.now() - e.sonSenkron.getTime() < a.aralikDk * 60_000 - 30_000))) { sonuc[ad] = { atlandi: "Zamanı gelmedi" }; continue; }
    try { sonuc[ad] = await (fn as any)(prisma, { ...o, butceMs: o.butceMs ?? 20_000 }); }
    catch (x: any) { sonuc[ad] = { hata: String(x?.message ?? x) }; }
  }
  return sonuc;
}

export async function cakismaCoz(prisma: PrismaClient, id: string, secim: "YEREL" | "UZAK") {
  const c = await prisma.senkronCakisma.findUniqueOrThrow({ where: { id } });
  if (c.durum !== "ACIK") return c;
  if (secim === "UZAK") {
    if (c.hedefTip === "KISI") await prisma.kisi.update({ where: { id: c.hedefId }, data: { [c.alan]: c.uzak as any } });
    else await prisma.kayit.update({ where: { id: c.hedefId }, data: { [c.alan]: c.uzak as any } });
  } else if (c.saglayici === "GOOGLE_KISILER" && c.hedefTip === "KISI" && (GONDERIM_ALANLARI as readonly string[]).includes(c.alan)) {
    // v3.21 — çift yönlü: "Anahtar'daki kalsın" denen değer Google'a da yazılır (bir sonraki eşitlemede)
    await prisma.kisi.updateMany({ where: { id: c.hedefId, googleResourceName: { not: null } }, data: { googleBekliyor: new Date() } });
  }
  return prisma.senkronCakisma.update({ where: { id }, data: { durum: secim === "UZAK" ? "UZAK_SECILDI" : "YEREL_SECILDI", cozuldu: new Date() } });
}