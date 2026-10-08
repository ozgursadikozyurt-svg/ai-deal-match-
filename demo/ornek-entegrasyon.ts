/**
 * Anahtar CRM v3.21.1 · 8 Ekim 2026
 * Demo ve testler için örnek dış veri — Notion API (2025-09-03) sayfa biçiminde ve Google People API yanıt biçiminde.
 * Alan adları Özgür'ün gerçek Notion tablolarıyla birebir (yapilandirma.ts). Kişi adları ve telefonlar KURGUSALDIR.
 * 1. tur = ilk bağlantı; 2. tur = "dış tarafta değişiklik oldu" senaryosu (artımlı senkron).
 */
import type { NotionSayfa, NotionOzellik } from "../src/lib/notion/donustur";
import type { GooglePerson, GoogleGrup } from "../src/lib/google/kisiler";

// ───────── Notion yardımcıları ─────────
const T = (s: string): NotionOzellik => ({ type: "title", title: s ? [{ plain_text: s }] : [] });
const RT = (s: string | null): NotionOzellik => ({ type: "rich_text", rich_text: s ? [{ plain_text: s }] : [] });
const N = (n: number | null): NotionOzellik => ({ type: "number", number: n });
const S = (s: string | null): NotionOzellik => ({ type: "select", select: s ? { name: s } : null });
const ST = (s: string): NotionOzellik => ({ type: "status", status: { name: s } });
const MS = (...a: string[]): NotionOzellik => ({ type: "multi_select", multi_select: a.map((name) => ({ name })) });
const PH = (s: string | null): NotionOzellik => ({ type: "phone_number", phone_number: s });
const R = (...ids: string[]): NotionOzellik => ({ type: "relation", relation: ids.map((id) => ({ id })) });
const sayfa = (id: string, gun: number, props: Record<string, NotionOzellik>, ek: Partial<NotionSayfa> = {}): NotionSayfa => ({
  object: "page", id, created_time: new Date(Date.UTC(2026, 8, 30 - gun, 9)).toISOString(), last_edited_time: new Date(Date.UTC(2026, 8, 30 - Math.min(gun, 2), 9)).toISOString(), properties: props, ...ek,
});

export const NK = { HAKAN: "nk-0001-hakan", SELIN: "nk-0002-selin", MURAT: "nk-0003-murat", ELIF: "nk-0004-elif" };
export const NP = { HACIALILER: "np-0001-hacialiler", KEPEZ: "np-0002-kepez", TOPALLI: "np-0003-topalli" };
export const NT = { LARA: "nt-0001-lara", GEBZE: "nt-0002-bos" };

const kisi = (id: string, ad: string, tel: string, rol: string[], ek: Record<string, NotionOzellik> = {}) => sayfa(id, 60, {
  Name: T(ad), Phone: PH(tel), ROL: MS(...rol), "Açıklama": RT(null), Referans: MS(), "Aradığı Mülk Tipi": MS(), "Hedef Bölge": MS(),
  "Bütçe": N(null), "Bütçe Min": N(null), "Bütçe Max": N(null), "Min M2": N(null), "Max M2": N(null), "Talep ": R(), "Mülkler ve Satış Tüneli": R(), "İlgilendiği Portföy": R(), ...ek,
});
const portfoy = (id: string, gun: number, p: { ad: string; tip: string[]; islem: string; fiyat: number | null; m2: number | null; bolge: string[]; durum: string; aciklama?: string; ruhsat?: string[]; sahip?: string[] }, ek: Partial<NotionSayfa> = {}) => sayfa(id, gun, {
  Name: T(p.ad), "Mülk Tipi": MS(...p.tip), "Satılık/Kiralık": S(p.islem), Fiyat: N(p.fiyat), M2: N(p.m2), "Oda Sayısı": MS(), "Bölge": MS(...p.bolge),
  "Ruhsat/İmar": MS(...(p.ruhsat ?? [])), "Açıklama": RT(p.aciklama ?? null), Durum: ST(p.durum), "Mülk Sahibi": R(...(p.sahip ?? [])),
  "Müşteri-Yatırımcılar-Kişiler": R(), "Talep (Telefon Kişi Rehberi)": R(), Konum: { type: "place", place: null },
}, ek);
const talep = (id: string, gun: number, p: { ad: string; tip: string[]; islem: string | null; min?: number | null; max?: number | null; minM2?: number | null; maxM2?: number | null; bolge: string[]; aciliyet?: string; durum: string; kaynak?: string; ne: string; kisi?: string[]; portfoyler?: string[] }, ek: Partial<NotionSayfa> = {}) => sayfa(id, gun, {
  "": T(p.ad), "Mülk Tipi": MS(...p.tip), "Kiralık/Satılık": S(p.islem), "Bütçe Min": N(p.min ?? null), "Bütçe Max": N(p.max ?? null), "Min M2": N(p.minM2 ?? null), "Max M2": N(p.maxM2 ?? null),
  "Oda/Bölüm Sayısı": MS(), "Bölge": MS(...p.bolge), Aciliyet: S(p.aciliyet ?? null), Durum: S(p.durum), "Müşteri nereden geldi?": S(p.kaynak ?? null),
  "Ne Arıyor": RT(p.ne), NOTLAR: RT(null), Telefon: PH(null), "Kişi Telefon Rehberi": R(...(p.kisi ?? [])), "Mülkler ve Satış Tüneli": R(...(p.portfoyler ?? [])),
}, ek);

export const NOTION_TUR1 = {
  KISI: [
    kisi(NK.HAKAN, "Hakan T. (örnek)", "+90 555 000 04 01", ["YATIRIMCI"], { "Aradığı Mülk Tipi": MS("Depo"), "Hedef Bölge": MS("Kepez"), "Bütçe Max": N(250000), "Min M2": N(1500), "Açıklama": RT("Kiralık depo arıyor, TIR girişi şart") }),
    kisi(NK.SELIN, "Selin A. (örnek)", "0555 000 01 02", ["EMLAKÇI DEPO"]),
    kisi(NK.MURAT, "Murat Y. (örnek)", "+905550000402", ["SATICI"]),
    kisi(NK.ELIF, "Elif D. (örnek)", "+905550000403", ["ALICI"], { "Talep ": R(NT.LARA) }),
  ],
  PORTFOY: [
    portfoy(NP.HACIALILER, 30, { ad: "Hacıaliler 4000 m² depo 400 kW", tip: ["Depo"], islem: "Kiralık", fiyat: 300000, m2: 4000, bolge: ["Aksu"], durum: "Portföye Alındı" }),
    portfoy(NP.KEPEZ, 6, { ad: "Kepez Sanayi 1800 m² depo", tip: ["Depo"], islem: "Kiralık", fiyat: 210000, m2: 1800, bolge: ["Kepez"], durum: "Açık Portföy", ruhsat: ["Ruhsatlı"], sahip: [NK.MURAT], aciklama: "1800 m2 kapalı depo, 7 m yükseklik, TIR girer, 150 kW elektrik, rampa var" }),
    portfoy(NP.TOPALLI, 45, { ad: "Topallı 650 m² dükkan", tip: ["Dükkan"], islem: "Satılık", fiyat: 18500000, m2: 650, bolge: ["Topallı"], durum: "Satıldı/Kiralandı" }),
  ],
  TALEP: [
    talep(NT.LARA, 8, { ad: "Elif Hn. Lara dükkan", tip: ["Dükkan"], islem: "Kiralık", max: 120000, minM2: 100, maxM2: 200, bolge: ["Lara"], aciliyet: "Yüksek", durum: "Görüşüldü", kaynak: "Referans", ne: "Lara'da cadde üstü 100-200 m2 dükkan, kafe için", kisi: [NK.ELIF] }),
    talep(NT.GEBZE, 3, { ad: "", tip: [], islem: null, bolge: [], durum: "Yeni Talep", ne: "Gebze tarafında satılık fabrika soruyor, detay sonra" }),
  ],
};

/** 2. tur: Notion'da biri düzenledi — Lara bütçesi 150.000; Kepez deposu 200.000'e indi; Hacıaliler 320.000 oldu; Topallı çöpe atıldı */
export const NOTION_TUR2 = {
  KISI: [] as NotionSayfa[],
  PORTFOY: [
    portfoy(NP.HACIALILER, 30, { ad: "Hacıaliler 4000 m² depo 400 kW", tip: ["Depo"], islem: "Kiralık", fiyat: 320000, m2: 4000, bolge: ["Aksu"], durum: "Portföye Alındı" }, { last_edited_time: "2026-09-30T10:05:00.000Z" }),
    portfoy(NP.KEPEZ, 6, { ad: "Kepez Sanayi 1800 m² depo", tip: ["Depo"], islem: "Kiralık", fiyat: 200000, m2: 1800, bolge: ["Kepez"], durum: "Teklif Verildi", ruhsat: ["Ruhsatlı"], sahip: [NK.MURAT], aciklama: "1800 m2 kapalı depo, 7 m yükseklik, TIR girer, 150 kW elektrik, rampa var" }, { last_edited_time: "2026-09-30T10:06:00.000Z" }),
    portfoy(NP.TOPALLI, 45, { ad: "Topallı 650 m² dükkan", tip: ["Dükkan"], islem: "Satılık", fiyat: 18500000, m2: 650, bolge: ["Topallı"], durum: "Satıldı/Kiralandı" }, { in_trash: true, last_edited_time: "2026-09-30T10:07:00.000Z" }),
  ],
  TALEP: [
    talep(NT.LARA, 8, { ad: "Elif Hn. Lara dükkan", tip: ["Dükkan"], islem: "Kiralık", max: 150000, minM2: 100, maxM2: 200, bolge: ["Lara"], aciliyet: "Yüksek", durum: "Sunuldu", kaynak: "Referans", ne: "Lara'da cadde üstü 100-200 m2 dükkan, kafe için", kisi: [NK.ELIF] }, { last_edited_time: "2026-09-30T10:08:00.000Z" }),
  ],
};
/** 2. turdan önce Anahtar'da yapılmış yerel düzeltme (çakışma örneği): Hacıaliler fiyatı 290.000 */
export const NOTION_TUR2_YEREL = { notionId: NP.HACIALILER, alan: "fiyat", deger: 290000 };

// ───────── Google ─────────
export const GOOGLE_GRUPLAR: GoogleGrup[] = [
  { resourceName: "contactGroups/emlak", formattedName: "Emlakçılar", groupType: "USER_CONTACT_GROUP" },
  { resourceName: "contactGroups/yatirim", formattedName: "Yatırımcılar", groupType: "USER_CONTACT_GROUP" },
  { resourceName: "contactGroups/muteahhit", formattedName: "Müteahhitler", groupType: "USER_CONTACT_GROUP" },
  { resourceName: "contactGroups/aile", formattedName: "Aile", groupType: "USER_CONTACT_GROUP" },
];
const kisiG = (id: string, ad: string, tel: string[], ek: Partial<GooglePerson> = {}, grup: string[] = []): GooglePerson => ({
  resourceName: `people/${id}`, etag: `%E${id}`, names: [{ displayName: ad, metadata: { primary: true } }],
  phoneNumbers: tel.map((value, i) => ({ value, metadata: { primary: i === 0 } })),
  memberships: grup.map((g) => ({ contactGroupMembership: { contactGroupResourceName: `contactGroups/${g}` } })), ...ek,
});
export const GOOGLE_TUR1: GooglePerson[] = [
  kisiG("c101", "Selin Aksoy (örnek)", ["+90 555 000 01 02"], { organizations: [{ name: "Örnek Gayrimenkul" }] }, ["emlak"]),
  kisiG("c102", "Kemal Usta (örnek)", ["0555 000 03 01"], { emailAddresses: [{ value: "kemal@ornek.com" }] }, ["yatirim"]),
  kisiG("c103", "Annem", ["+905550000302"], {}, ["aile"]),
  kisiG("c104", "Burak — Örnek Lojistik (örnek)", ["0555 000 03 03", "0555 000 03 04"], { organizations: [{ name: "Örnek Lojistik A.Ş." }], biographies: [{ value: "Kundu'da 5.000 m² depo arıyor (geçen ay)" }] }),
  kisiG("c105", "Deniz K. (örnek)", [], { emailAddresses: [{ value: "deniz@ornek.com" }] }),
  kisiG("c106", "Kemal U.", ["+905550000301"], {}, ["yatirim"]),
  kisiG("c107", "Örnek Yapı Ltd. (örnek)", ["0242 000 00 11"], {}, ["muteahhit"]),
];
export const GOOGLE_TUR2: GooglePerson[] = [
  kisiG("c102", "Kemal Usta (örnek)", ["0555 000 03 01"], { emailAddresses: [{ value: "kemal@ornek.com" }], organizations: [{ name: "Usta Yatırım (örnek)" }] }, ["yatirim"]),
  { resourceName: "people/c103", metadata: { deleted: true } },
  kisiG("c108", "Ayşe Emlak (örnek)", ["0555 000 03 05"], { organizations: [{ name: "Ayşe Emlak" }] }, ["emlak"]),
];