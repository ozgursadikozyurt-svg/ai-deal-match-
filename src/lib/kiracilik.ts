/**
 * Anahtar CRM v3.22.1 · 9 Ekim 2026
 * ÇOK OFİSLİ ÇEKİRDEK (kiracılık / multi-tenancy).
 *
 * Tek Supabase veritabanında birden çok emlak ofisi barınır. Her ofise ait satırda "ofisId" vardır.
 * Veri ayrımı tek tek sorgulara güvenilerek değil, BURADAN zorlanır: src/lib/db.ts'teki `prisma`
 * nesnesi bu dosyadaki sarmalayıcıdan geçer ve her sorguya ofis süzgecini kendisi ekler.
 *
 * Güvenli varsayılan (fail-closed): ofis bağlamı kurulmadan ofise ait bir tabloya dokunulursa
 * sorgu çalışmaz, hata fırlatılır. Yani "ofisId koymayı unutmak" sessiz veri sızıntısına değil,
 * görülebilir bir hataya yol açar.
 *
 * Bağlam iki yolla kurulur:
 *   kiracilikIcinde({ofisId, kullaniciId, rol, eposta}, is)  → normal istek (bir ofis adına)
 *   platformOlarak(is)                                        → zamanlayıcı, yedek, platform yönetimi
 */
import { AsyncLocalStorage } from "node:async_hooks";

export type Rol = "PLATFORM_YONETICISI" | "OFIS_YONETICISI" | "DANISMAN";

export interface Baglam {
  ofisId: string;
  kullaniciId: string;
  rol: Rol;
  eposta: string;
}

/** Ofise ait tablolar: her sorguya ofisId süzgeci eklenir, her oluşturmaya ofisId yazılır. */
export const OFIS_MODELLERI: ReadonlySet<string> = new Set([
  "kayit",
  "kisi",
  "match",
  "ayar",
  "lokasyonAday",
  "islenmisMesaj",
  "portalIlan",
  "entegrasyon",
  "senkronCalisma",
  "senkronCakisma",
  "senkronHaric",
  "notionSyncLog",
  "ingestionLog",
  "auditLog",
  "kayitNot",
  "kayitFoto",
  "kullanici",
  "davet",
]);

/**
 * Ebeveyni üzerinden erişilen tablolar. Kendi ofisId kolonları yoktur; her zaman bir Kayit ya da
 * Kisi satırının içinden (nested) yazılır ve okunur, o satır da ofise bağlıdır.
 * Doğrudan sorgulanmaları yasak değildir ama ofis süzgeci uygulanamaz — bu yüzden
 * tests/v320-db.test.ts bu modellerin kodda doğrudan sorgulanmadığını denetler.
 */
export const EBEVEYN_MODELLERI: ReadonlySet<string> = new Set(["mulkOzellik", "kayitLokasyon", "kayitKisi"]);

/** Tüm ofislerin paylaştığı başvuru verisi (il / ilçe / mahalle / alt bölge sözlükleri) — salt okunur. */
export const GENEL_MODELLER: ReadonlySet<string> = new Set([
  "il",
  "ilce",
  "mahalle",
  "altBolge",
  "altBolgeMahalle",
  "ilceKomsuluk",
  "lokasyonAlias",
]);

/**
 * Kısıtlı tablo: ofis kaydının kendisi. Yalnızca platform bağlamında ya da `where.id` açıkça
 * kendi ofisiniz olduğunda sorgulanabilir. Sessizce başka bir ofise yönlendirme yapılmaz.
 */
export const KISITLI_MODELLER: ReadonlySet<string> = new Set(["ofis"]);

const depo = new AsyncLocalStorage<Baglam | "platform">();

/** v3.20 göçünde açılan ofis ve sahibi (prisma/migrations/…_v320_cok_ofis) */
export const VARSAYILAN_OFIS_ID = "ofis_ozyurtlar_0001";
export const VARSAYILAN_KULLANICI_ID = "kull_ozgur_0001";

/**
 * YALNIZCA TESTLER İÇİN. node:test dosyaları her çağrıyı kiracilikIcinde(...) ile sarmak zorunda
 * kalmasın diye bir yedek bağlam kurar. Uygulama kodunda (src/app, src/canli, src/lib) ASLA
 * çağrılmaz — tests/v320.test.ts bunu denetler; çağrılırsa test kırmızıya döner.
 */
let testBaglami: Baglam | "platform" | undefined;
export function SADECE_TEST_baglamiSabitle(b: Baglam | "platform" | undefined): void {
  testBaglami = b;
}

const aktifBaglam = (): Baglam | "platform" | undefined => depo.getStore() ?? testBaglami;

export function kiracilikIcinde<T>(b: Baglam, is: () => Promise<T>): Promise<T> {
  if (!b?.ofisId) throw new KiracilikHatasi("Ofis bağlamı kurulamadı: ofisId boş");
  return depo.run(b, is);
}

/** Zamanlayıcı, yedek ve platform yönetimi: ofis süzgeci uygulanmaz. Dikkatli kullanılır. */
export function platformOlarak<T>(is: () => Promise<T>): Promise<T> {
  return depo.run("platform", is);
}

export const baglamOku = (): Baglam | "platform" | undefined => aktifBaglam();

/** İstek sırasındaki ofis bağlamı; yoksa hata. Rota kodunda "benim ofisim" demenin yolu. */
export function ofisBaglami(): Baglam {
  const b = aktifBaglam();
  if (!b || b === "platform") throw new KiracilikHatasi("Bu işlem bir ofis bağlamı gerektirir");
  return b;
}

export class KiracilikHatasi extends Error {
  constructor(mesaj: string) {
    super(mesaj);
    this.name = "KiracilikHatasi";
  }
}

// ---------------------------------------------------------------------------
//  Sorgu dönüştürme
// ---------------------------------------------------------------------------

/** findUnique ofisId ile çalışmaz (yalnız benzersiz alan kabul eder) → findFirst'e çevrilir. */
const TEKILDEN_COGULA: Record<string, string> = { findUnique: "findFirst", findUniqueOrThrow: "findFirstOrThrow" };
const OKUMA = new Set(["findFirst", "findFirstOrThrow", "findMany", "count", "aggregate", "groupBy"]);
const WHERE_YAZMA = new Set(["update", "delete", "updateMany", "deleteMany"]);
const OLUSTURMA = new Set(["create", "createMany", "createManyAndReturn"]);

/** Danışman, ofis ortak kayıtlarını ve kendi kayıtlarını görür; meslektaşının özel kaydını görmez. */
export function gorunurlukSuzgeci(b: Baglam, model: string): object | undefined {
  if (b.rol !== "DANISMAN") return undefined;
  if (model !== "kayit" && model !== "kisi") return undefined;
  return { OR: [{ gorunurluk: "OFIS" }, { sahipKullaniciId: b.kullaniciId }] };
}

const suzgecEkle = (where: unknown, ek: object[]): object => {
  const mevcut = where && typeof where === "object" ? (where as object) : undefined;
  const parcalar = [...ek, ...(mevcut ? [mevcut] : [])];
  return parcalar.length === 1 ? parcalar[0] : { AND: parcalar };
};

/**
 * Bir Prisma çağrısını ofis bağlamına göre yeniden yazar.
 * Dönen `islem` farklıysa (findUnique → findFirst) çağrı o isimle yapılır.
 */
export function cagriyiDonustur(
  model: string,
  islem: string,
  args: any,
  baglam: Baglam | "platform" | undefined,
): { islem: string; args: any } {
  if (GENEL_MODELLER.has(model) || EBEVEYN_MODELLERI.has(model)) return { islem, args };

  if (KISITLI_MODELLER.has(model)) {
    if (baglam === "platform") return { islem, args };
    if (!baglam) throw new KiracilikHatasi(`"${model}" tablosu ofis bağlamı olmadan sorgulanamaz`);
    const istenen = args?.where?.id;
    if (typeof istenen === "string" && istenen === baglam.ofisId) return { islem, args };
    throw new KiracilikHatasi(`"${model}" yalnızca kendi ofisiniz için sorgulanabilir (where.id = kendi ofisId)`);
  }

  if (!OFIS_MODELLERI.has(model)) return { islem, args };
  if (baglam === "platform") return { islem, args };
  if (!baglam) {
    throw new KiracilikHatasi(
      `"${model}" ofise ait bir tablo; ofis bağlamı kurulmadan erişilemez. ` +
        `İsteği kiracilikIcinde(...) ile sarın ya da bilinçli olarak platformOlarak(...) kullanın.`,
    );
  }

  const ofisSuzgeci = { ofisId: baglam.ofisId };
  const gorunurluk = gorunurlukSuzgeci(baglam, model);
  const yeni = { ...(args ?? {}) };
  const hedefIslem = TEKILDEN_COGULA[islem] ?? islem;

  if (OKUMA.has(hedefIslem)) {
    yeni.where = suzgecEkle(yeni.where, gorunurluk ? [ofisSuzgeci, gorunurluk] : [ofisSuzgeci]);
    return { islem: hedefIslem, args: yeni };
  }

  if (WHERE_YAZMA.has(islem)) {
    // update / delete where'i mantıksal işleç (AND / OR) kabul etmez; süzgeç DÜZ alan olarak eklenir
    // (Prisma "extendedWhereUnique": benzersiz anahtarın yanına skaler alan konabilir).
    // Çağıran kendi ofisId'sini yazmış olsa bile bağlamdaki değer kazanır.
    yeni.where = { ...(yeni.where ?? {}), ...ofisSuzgeci };
    return { islem, args: yeni };
  }

  if (OLUSTURMA.has(islem)) {
    const yaz = (d: any) => (Array.isArray(d) ? d.map((x) => ({ ...x, ...ofisSuzgeci })) : { ...d, ...ofisSuzgeci });
    if (yeni.data !== undefined) yeni.data = yaz(yeni.data);
    return { islem, args: yeni };
  }

  if (islem === "upsert") {
    // where: zaten ofise özgü benzersiz anahtar (cuid ya da [ofisId, …] bileşik) — dokunulmaz.
    if (yeni.create !== undefined) yeni.create = { ...yeni.create, ...ofisSuzgeci };
    return { islem, args: yeni };
  }

  return { islem, args: yeni };
}

// ---------------------------------------------------------------------------
//  İstemci sarmalayıcı
// ---------------------------------------------------------------------------

const MODEL_OLMAYAN = (ad: string) => ad.startsWith("$") || ad.startsWith("_") || ad === "then" || ad === "constructor";

/** Bir Prisma istemcisini (ya da işlem içindeki `tx`'i) ofis süzgeci uygulayan bir vekille sarar. */
export function istemciyiSarmala<T extends object>(istemci: T): T {
  return new Proxy(istemci, {
    get(hedef, ad: string) {
      const deger = (hedef as any)[ad];

      if (ad === "$transaction" && typeof deger === "function") {
        return (ilk: any, ...kalan: any[]) =>
          typeof ilk === "function"
            ? deger.call(hedef, (tx: object) => ilk(istemciyiSarmala(tx)), ...kalan)
            : deger.call(hedef, ilk, ...kalan);
      }

      if (MODEL_OLMAYAN(ad) || typeof deger !== "object" || deger === null) {
        return typeof deger === "function" ? deger.bind(hedef) : deger;
      }

      // Model delegesi → işlemleri yeniden yazan vekil
      return new Proxy(deger, {
        get(delege, islem: string) {
          const fn = (delege as any)[islem];
          if (typeof fn !== "function") return fn;
          return (args?: any) => {
            const d = cagriyiDonustur(ad, islem, args, aktifBaglam());
            const calistir = d.islem === islem ? fn : (delege as any)[d.islem];
            return calistir.call(delege, d.args);
          };
        },
      });
    },
  }) as T;
}
