/**
 * Anahtar CRM v3.13 · 3 Ekim 2026
 * API giriş modelleri (Zod) — Kayit + MulkOzellik + Lokasyon.
 * AI çıktısı da, manuel form da, Notion importu da AYNI şemadan geçer.
 * Enum dışı değer, serbest paragraf veya birim hatası DB'ye ulaşamaz.
 */
import { z } from "zod";
import {
  KayitTipi, Durum, Aciliyet, AnaKategori, MulkTipi, IslemTipi, ParaBirimi, FiyatPeriyodu,
  ImarDurumu, IlanSahibiTipi, VeriKanali, Havuz, PortfoyAlinabilirlik, MusteriKaynagi,
  AracErisimi, RuhsatDurumu, TapuTipi, CatiTipi, DuvarTipi, ZeminTipi, YapiSistemi,
  OtoparkDurumu, TrafikSeviyesi, KiraOdemeSekli, TurizmBelgesi, KullanimAmaci, TeknikAlan,
  IsinmaTipi, EsyaDurumu, Yon, KayitKisiRolu,
} from "../../generated/prisma/enums";
import { anaKategoriOf, islemKategoriUyumlu } from "../domain/kategori";
import { kvaToKw } from "../domain/teknik-alanlar";

const en = <T extends Record<string, string>>(e: T) => z.nativeEnum(e);
const pozitif = (max: number) => z.number().finite().min(0).max(max);
const m2 = pozitif(10_000_000).nullish();
const metre = pozitif(60).nullish();
const adet = z.number().int().min(0).max(10_000).nullish();
const bool = z.boolean().nullish();
const para = z.union([z.number(), z.string().regex(/^\d+(\.\d{1,2})?$/)]).transform(Number).pipe(pozitif(1e13)).nullish();
/** Kısa, tek satırlık ifade — paragraf değil */
const kisaMetin = (n = 120) => z.string().trim().max(n).nullish();

// ---------------------------------------------------------------------------
//  MulkOzellik
// ---------------------------------------------------------------------------
export const MulkOzellikObje = z
  .object({
    kapaliAlanM2: m2, acikAlanM2: m2, arsaAlanM2: m2, sundurmaM2: m2, ofisAlanM2: m2,
    girisKatM2: m2, asmaKatM2: m2, bodrumM2: m2, bolunebilir: bool, minBolumM2: m2,

    netYukseklikM: metre, makasAltiYukseklikM: metre,
    kapiSayisi: adet, kapiGenislikM: metre, kapiYukseklikM: metre, otomatikKapi: bool,
    aracErisimi: en(AracErisimi).nullish(), tirManevraAlani: bool,
    rampa: bool, rampaSayisi: adet, vinc: bool, vincKapasitesiTon: pozitif(1000).nullish(), yukAsansoru: bool,

    elektrikGucuKw: pozitif(100_000).nullish(), elektrikGucuKva: pozitif(100_000).nullish(),
    elektrikGucuHam: kisaMetin(60), trafo: bool, trafoGucuKva: pozitif(100_000).nullish(),
    sanayiElektrigi: bool, jenerator: bool,

    yanginSistemi: bool, sprinkler: bool, yanginAlgilama: bool, paratoner: bool,

    iskan: bool, ruhsatDurumu: en(RuhsatDurumu).nullish(), isyeriAcmaRuhsati: bool, numarataj: bool,
    tapuTipi: en(TapuTipi).nullish(), imarDurumu: en(ImarDurumu).nullish(),
    adaNo: kisaMetin(20), parselNo: kisaMetin(20), emsalKaks: pozitif(20).nullish(), taks: pozitif(1).nullish(),

    sogukHava: bool, sogukHavaM2: m2,
    sogukHavaMinC: z.number().min(-60).max(40).nullish(), sogukHavaMaxC: z.number().min(-60).max(40).nullish(),
    iklimlendirme: bool, havalandirma: bool, gidayaUygun: bool,

    yapiSistemi: en(YapiSistemi).nullish(), catiTipi: en(CatiTipi).nullish(), duvarTipi: en(DuvarTipi).nullish(),
    zeminTipi: en(ZeminTipi).nullish(), zeminYukTasimaTonM2: pozitif(100).nullish(),
    binaYasi: z.number().int().min(0).max(300).nullish(), katSayisi: z.number().int().min(0).max(150).nullish(),
    bulunduguKat: z.number().int().min(-10).max(150).nullish(),
    /** v3.15 — talepte çoklu kat: "-1", "0", "1"…"N", "ARA", "SON" */
    istenenKatlar: z.array(z.string().regex(/^(-?\d{1,3}|ARA|SON)$/)).max(14).default([]),

    ofis: bool, ofisOdaSayisi: adet, wc: bool, wcSayisi: adet, mutfak: bool, personelAlani: bool,
    sundurma: bool, sondaj: bool,

    cepheUzunluguM: pozitif(1000).nullish(), cepheSayisi: z.number().int().min(0).max(4).nullish(),
    vitrin: bool, koseKonum: bool, anaCaddeUzeri: bool, duzGiris: bool, asmaKat: bool, bodrum: bool,
    baca: bool, asansor: bool, otoparkDurumu: en(OtoparkDurumu).nullish(), otoparkKapasitesi: adet,
    yayaTrafigi: en(TrafikSeviyesi).nullish(), aracTrafigi: en(TrafikSeviyesi).nullish(),

    anaYolaMesafeM: z.number().int().min(0).max(1_000_000).nullish(),
    cevreYolunaMesafeM: z.number().int().min(0).max(1_000_000).nullish(),
    havalimaninaMesafeM: z.number().int().min(0).max(1_000_000).nullish(),
    limanaMesafeM: z.number().int().min(0).max(1_000_000).nullish(),
    denizeMesafeM: z.number().int().min(0).max(1_000_000).nullish(),
    osbIcinde: bool,

    kullanimAmaclari: z.array(en(KullanimAmaci)).max(10).default([]),

    // Konut (v3.3)
    banyoSayisi: z.number().int().min(0).max(50).nullish(), isinmaTipi: en(IsinmaTipi).nullish(), esyaDurumu: en(EsyaDurumu).nullish(),
    siteIcinde: bool, guvenlik: bool, balkon: bool, teras: bool, bahce: bool, dubleks: bool, ebeveynBanyosu: bool,
    cepheYonleri: z.array(en(Yon)).max(4).default([]), denizManzarasi: bool, engelliErisimi: bool,

    otelOdaSayisi: adet, yatakKapasitesi: adet, yildiz: z.number().int().min(1).max(5).nullish(),
    turizmBelgesi: en(TurizmBelgesi).nullish(), havuz: bool,

    kiraOdemeSekli: en(KiraOdemeSekli).nullish(), depozitoAy: pozitif(36).nullish(),
    minKiraSuresiYil: pozitif(99).nullish(), bosalmaTarihi: z.coerce.date().nullish(),
    kiracili: bool, mevcutKiraGeliri: para, devirBedeli: para, aidat: para,

    kritikKriterler: z.array(en(TeknikAlan)).max(15).default([]),
    esnekKriterler: z.array(en(TeknikAlan)).max(15).default([]),
    eksikBilgiler: z.array(en(TeknikAlan)).max(20).default([]),
  })
  .strict(); // tanımsız alan = hata (AI'ın uydurduğu "ozellik_x" reddedilir)

function ozellikNormalize<T extends Partial<z.output<typeof MulkOzellikObje>>>(o: T): T {
    // kVA verilip kW verilmediyse normalize et
    if (o.elektrikGucuKw == null && o.elektrikGucuKva != null) o.elektrikGucuKw = kvaToKw(o.elektrikGucuKva);
    // Alt değer varsa üst bayrağı işaretle (tutarlılık)
    if (o.sogukHavaM2) o.sogukHava ??= true;
    if (o.rampaSayisi) o.rampa ??= true;
    if (o.vincKapasitesiTon) o.vinc ??= true;
    if (o.trafoGucuKva) o.trafo ??= true;
    if (o.ofisOdaSayisi) o.ofis ??= true;
    if (o.wcSayisi) o.wc ??= true;
    if (o.sundurmaM2) o.sundurma ??= true;
    return o;
}

export const MulkOzellikSchema = MulkOzellikObje.transform(ozellikNormalize);
/** PATCH için: default'lar uygulanmaz → gönderilmeyen dizi alanları silinmez */
export const MulkOzellikPatchSchema = MulkOzellikObje.partial().transform(ozellikNormalize);

export type MulkOzellikInput = z.input<typeof MulkOzellikSchema>;
export type MulkOzellikData = z.output<typeof MulkOzellikSchema>;

// ---------------------------------------------------------------------------
//  Lokasyon (ID tabanlı — metin çözümleme /api/lokasyon/coz ile ayrı yapılır)
// ---------------------------------------------------------------------------
export const KayitLokasyonSchema = z
  .object({
    ilId: z.number().int().min(1).max(81),
    ilceId: z.number().int().positive().nullish(),
    mahalleId: z.number().int().positive().nullish(),
    altBolgeId: z.number().int().positive().nullish(),
    birincil: z.boolean().default(false),
  })
  .refine((l) => !l.mahalleId || l.ilceId, { message: "Mahalle verildiyse ilçe de verilmeli", path: ["ilceId"] });

// ---------------------------------------------------------------------------
//  Kayit
// ---------------------------------------------------------------------------
export const KayitTemel = z.object({
  tip: en(KayitTipi),
  durum: en(Durum).default("ACTIVE"),
  aciliyet: en(Aciliyet).default("NORMAL"),

  anaKategori: en(AnaKategori).optional(), // verilmezse mulkTipi'nden türetilir
  mulkTipi: en(MulkTipi),
  alternatifMulkTipleri: z.array(en(MulkTipi)).max(5).default([]),
  islemTipi: en(IslemTipi),
  alternatifIslemTipleri: z.array(en(IslemTipi)).max(3).default([]),

  fiyat: para, minFiyat: para, maxFiyat: para,
  paraBirimi: en(ParaBirimi).default("TRY"),
  fiyatPeriyodu: en(FiyatPeriyodu).default("TOPLAM"),
  krediyeUygun: bool,
  /** v3.15 — takasa açık (portföy + talep) */
  takasaAcik: bool,

  m2, netM2: m2, minM2: m2, maxM2: m2,
  m2ToleransYuzde: pozitif(100).nullish(),
  odaSayisi: kisaMetin(60), // v3.19: talepte çoklu seçim → "2+1, 3+1"

  lokasyonlar: z.array(KayitLokasyonSchema).max(15).default([]),
  lokasyonHam: kisaMetin(200),
  adres: kisaMetin(300),
  enlem: z.number().min(35).max(43).nullish(), // Türkiye sınır kutusu
  boylam: z.number().min(25).max(45).nullish(),

  veriKanali: en(VeriKanali).default("MANUEL"),
  ilanSahibiTipi: en(IlanSahibiTipi).default("BILINMIYOR"),
  havuz: en(Havuz).default("KENDI_PORTFOY"),
  yetkili: z.boolean().default(false), // v3.5 — yetki belgeli portföy
  yetkiBitis: z.coerce.date().nullish(),
  musteriKaynagi: en(MusteriKaynagi).nullish(),
  portfoyAlinabilirlik: en(PortfoyAlinabilirlik).default("BILINMIYOR"),
  kisiId: z.string().cuid().nullish(),

  gondeAdi: kisaMetin(120), gondeTelefon: z.string().regex(/^\+90\d{10}$/, "Telefon +905xxxxxxxxx formatında olmalı").nullish(),
  gondeSirket: kisaMetin(120), kayitGrubu: kisaMetin(120),
  // Kaynak bilgisi (v3.3): mesajın gönderildiği an, içe aktarılan dosya, içe aktarma işi
  mesajTarihi: z.coerce.date().nullish(), kaynakDosya: kisaMetin(200), ingestionId: kisaMetin(40),
  // v3.4 — kayda bağlı kişiler (Kişiler tablosundan; bir kayıtta birden fazla kişi, her biri bir rolle)
  kisiler: z.array(z.object({ kisiId: z.string().min(1).max(40), rol: en(KayitKisiRolu).default("DIGER") })).max(10).default([]),

  portalUrl: z.string().url().nullish(), portalIlanNo: kisaMetin(40), portalIlanSahibi: kisaMetin(120),

  baslik: kisaMetin(160),
  ozet: kisaMetin(280),
  hamMetin: z.string().max(20_000).nullish(),
  operasyonNotu: z.string().max(5_000).nullish(),
  ozelSartlar: z.array(z.string().trim().min(2).max(60)).max(10).default([]),

  validUntil: z.coerce.date().optional(), // verilmezse TTL kuralı (servis katmanı)
  ozellik: MulkOzellikSchema.optional(),
});

function kurallar(k: z.infer<typeof KayitTemel>, ctx: z.RefinementCtx) {
  const ana = anaKategoriOf(k.mulkTipi);
  if (k.anaKategori && k.anaKategori !== ana && k.mulkTipi !== "DIGER")
    ctx.addIssue({ code: "custom", path: ["anaKategori"], message: `${k.mulkTipi} → ${ana} olmalı` });
  if (!islemKategoriUyumlu(k.anaKategori ?? ana, k.islemTipi))
    ctx.addIssue({ code: "custom", path: ["islemTipi"], message: `${k.islemTipi} bu kategoriyle uyumsuz` });
  if (k.minM2 != null && k.maxM2 != null && k.minM2 > k.maxM2)
    ctx.addIssue({ code: "custom", path: ["minM2"], message: "minM2 > maxM2" });
  if (k.minFiyat != null && k.maxFiyat != null && k.minFiyat > k.maxFiyat)
    ctx.addIssue({ code: "custom", path: ["minFiyat"], message: "minFiyat > maxFiyat" });
  if (k.tip === "PORTFOY" && k.lokasyonlar.length > 1 && k.lokasyonlar.filter((l) => l.birincil).length !== 1)
    ctx.addIssue({ code: "custom", path: ["lokasyonlar"], message: "Portföyde tam olarak bir birincil lokasyon olmalı" });
  if (k.tip === "PORTFOY" && k.ozellik && (k.ozellik.kritikKriterler.length || k.ozellik.esnekKriterler.length))
    ctx.addIssue({ code: "custom", path: ["ozellik", "kritikKriterler"], message: "Kritik/esnek kriter sadece TALEP kayıtlarında" });
}

export const KayitCreateSchema = KayitTemel.superRefine(kurallar).transform((k) => ({
  ...k,
  anaKategori: k.anaKategori ?? anaKategoriOf(k.mulkTipi),
  lokasyonlar: k.lokasyonlar.map((l, i) => ({ ...l, birincil: l.birincil || (k.lokasyonlar.length === 1 && i === 0) })),
}));

/** PATCH: tüm alanlar opsiyonel; tip değiştirilemez */
export const KayitUpdateSchema = KayitTemel.omit({ tip: true })
  .partial()
  .extend({ ozellik: MulkOzellikPatchSchema.optional(), arsivNotu: z.string().max(1000).nullish() })
  .strict();

export type KayitCreateInput = z.input<typeof KayitCreateSchema>;
export type KayitCreateData = z.output<typeof KayitCreateSchema>;

// ---------------------------------------------------------------------------
//  Liste / filtre sorgusu (GET /api/kayit?…) — teknik filtreler dahil
// ---------------------------------------------------------------------------
const csvEnum = <T extends Record<string, string>>(e: T) =>
  z.string().transform((s) => s.split(",").filter(Boolean)).pipe(z.array(z.nativeEnum(e))).optional();
const num = z.coerce.number().finite().optional();
const qbool = z.enum(["true", "false"]).transform((v) => v === "true").optional();

export const KayitListeQuery = z.object({
  tip: en(KayitTipi).optional(),
  durum: csvEnum(Durum),
  anaKategori: csvEnum(AnaKategori),
  mulkTipi: csvEnum(MulkTipi),
  islemTipi: csvEnum(IslemTipi),
  ilanSahibiTipi: csvEnum(IlanSahibiTipi),
  veriKanali: csvEnum(VeriKanali),
  ilId: z.coerce.number().int().optional(),
  ilceId: z.string().transform((s) => s.split(",").map(Number)).optional(),
  mahalleId: z.string().transform((s) => s.split(",").map(Number)).optional(),
  altBolgeId: z.string().transform((s) => s.split(",").map(Number)).optional(),
  minFiyat: num, maxFiyat: num, minM2: num, maxM2: num,
  // teknik
  minKapaliAlan: num, minAcikAlan: num, minYukseklik: num, minElektrikKw: num, minKapiYukseklik: num,
  aracErisimi: en(AracErisimi).optional(),
  rampa: qbool, vinc: qbool, trafo: qbool, sanayiElektrigi: qbool, yanginSistemi: qbool, sprinkler: qbool,
  iskan: qbool, sogukHava: qbool, gidayaUygun: qbool, vitrin: qbool, anaCaddeUzeri: qbool,
  ruhsatDurumu: csvEnum(RuhsatDurumu),
  kullanimAmaci: csvEnum(KullanimAmaci),
  q: z.string().max(100).optional(),
  sayfa: z.coerce.number().int().min(1).default(1),
  sayfaBoyutu: z.coerce.number().int().min(1).max(100).default(25),
  sirala: z.enum(["createdAt", "validUntil", "fiyat", "m2"]).default("createdAt"),
  yon: z.enum(["asc", "desc"]).default("desc"),
});
export type KayitListeFiltre = z.output<typeof KayitListeQuery>;