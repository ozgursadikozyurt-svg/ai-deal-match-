/**
 * Anahtar CRM v3.44.1 · 27 Ekim 2026
 * İŞLEM (kapanan satış / kiralama) ve komisyonu. Yalnızca "islem.yonet" (ofis yöneticisi): asistan ve danışman göremez.
 * Polaris bu tabloyu Supabase üzerinden yalnızca okur. Kurallar: src/lib/domain/islem.ts
 *
 * v3.44 — İşlem detayı Polaris'teki kadar ayrıntılı: paylaşılan kişi (+ telefon), referans ve taraflar (rehberden).
 * Tutar alanları değişmedi; yeni alanların hepsi isteğe bağlı, eski kayıtlar olduğu gibi çalışır.
 *
 * v3.44.1 — Kişi bağları yazılmadan ÖNCE doğrulanır. Arayüzdeki rehber, henüz sunucuya yazılmamış
 * (ya da sonradan silinmiş) kişileri de gösterebiliyor; böyle bir kişi seçilince eskiden yabancı
 * anahtar hatası dönüyor ve işlem hiç kaydedilmiyordu. Artık bağ kurulamayan kişi adıyla saklanır,
 * işlem kaydedilir; kişi sunucuya yazıldıktan sonra elle yeniden seçilerek bağlanabilir.
 */
import { z } from "zod";
import type { PrismaClient } from "../../generated/prisma/client";
import { ofisBaglami } from "../kiracilik";
import { yetkiGerek } from "../guvenlik/yetki";
import { ISLEM_TURLERI, TARAF_ROLLERI } from "../domain/islem";
import { ILK_KAYNAKLAR } from "../domain/ilk-kaynak";

const tutar = z.number().finite().min(-1_000_000_000).max(10_000_000_000).nullish();
const gun = z.string().regex(/^\d{4}-\d{2}-\d{2}/, "Tarih YYYY-AA-GG olmalı");
const kimlik = z.string().max(64).nullish();
const ad = z.string().trim().max(200).nullish();
/** Taraf: rehberden kişi ya da serbest ad. En az biri dolu olmalı. */
const TarafSchema = z.object({ kisiId: kimlik, ad: ad, rol: z.enum(TARAF_ROLLERI).default("DIGER") })
  .refine((t) => !!(t.kisiId || t.ad?.trim()), { message: "Tarafın kişisi ya da adı gerekli" });
export const IslemSchema = z.object({
  tarih: gun,
  tahsilatTarihi: gun.nullish(),
  tur: z.enum(ISLEM_TURLERI).default("DIGER"),
  baslik: z.string().trim().min(2).max(300),
  bedel: tutar, paylasilan: tutar, ofisPayi: tutar, banaKalan: tutar,
  aciklama: z.string().trim().max(2000).nullish(),
  reklam: z.boolean().default(false),
  talepKaynagi: z.enum(ILK_KAYNAKLAR).nullish(),
  talepId: kimlik, portfoyId: kimlik, kisiId: kimlik,
  // v3.44
  paylasilanKisiId: kimlik, paylasilanAd: ad, paylasilanTelefon: z.string().trim().max(40).nullish(),
  referansKisiId: kimlik, referansAd: ad,
  taraflar: z.array(TarafSchema).max(20).nullish(),
});
export type IslemGirdi = z.infer<typeof IslemSchema>;

const gunOrtasi = (g: string) => new Date(`${g.slice(0, 10)}T12:00:00.000Z`);
const bosNull = (s: string | null | undefined) => (s && s.trim() ? s.trim() : null);
type Cozum = ReturnType<typeof kisileriCoz>;
const veriYap = (v: IslemGirdi, c: Cozum) => ({
  tarih: gunOrtasi(v.tarih), tahsilatTarihi: v.tahsilatTarihi ? gunOrtasi(v.tahsilatTarihi) : null,
  tur: v.tur, baslik: v.baslik, bedel: v.bedel ?? null, paylasilan: v.paylasilan ?? null, ofisPayi: v.ofisPayi ?? null, banaKalan: v.banaKalan ?? null,
  aciklama: v.aciklama ?? null, reklam: v.reklam, talepKaynagi: v.talepKaynagi ?? null, talepId: v.talepId ?? null, portfoyId: v.portfoyId ?? null, kisiId: v.kisiId ?? null,
  // v3.44 — rehberden seçilince serbest ad tutulmaz (ad kişi kartından okunur)
  // v3.44.1 — bağ kurulamadıysa kimlik düşer, ad kalır (kisileriCoz)
  paylasilanKisiId: c.paylasilan.id, paylasilanAd: c.paylasilan.id ? null : c.paylasilan.ad, paylasilanTelefon: bosNull(v.paylasilanTelefon),
  referansKisiId: c.referans.id, referansAd: c.referans.id ? null : c.referans.ad,
});
/** Aynı kişi (ya da aynı ad) aynı rolde iki kez eklenmesin */
const tarafVeri = (v: IslemGirdi) => {
  const g = new Map<string, { kisiId: string | null; ad: string | null; rol: string }>();
  for (const t of v.taraflar ?? []) {
    const a = bosNull(t.ad);
    g.set(`${t.kisiId ?? "ad:" + (a ?? "").toLocaleLowerCase("tr-TR")}|${t.rol}`, { kisiId: t.kisiId ?? null, ad: a, rol: t.rol });
  }
  return [...g.values()];
};

/**
 * v3.44.1 — Gönderilen kişi kimliklerinden gerçekten var olanları döndürür.
 * Prisma istemcisi ofis süzgeciyle sarmalı olduğundan başka ofisin kişisi de "yok" sayılır.
 */
async function varOlanKisiler(prisma: PrismaClient, idler: (string | null | undefined)[]) {
  const liste = [...new Set(idler.filter((x): x is string => !!x))];
  if (!liste.length) return new Map<string, string>();
  const bulunan = await prisma.kisi.findMany({ where: { id: { in: liste } }, select: { id: true, adSoyad: true } });
  return new Map(bulunan.map((k) => [k.id, k.adSoyad]));
}

/**
 * Bağ kurulamayan kişileri ada düşürür: işlem yine kaydedilir, hiçbir bilgi kaybolmaz.
 * `adlar`: arayüzün gönderdiği adlar (rehberde görünen ad) — bağ kopunca bunlar saklanır.
 */
function kisileriCoz(v: IslemGirdi, var_: Map<string, string>, taraflar: ReturnType<typeof tarafVeri>) {
  const bagsiz: string[] = [];
  const coz = (id: string | null | undefined, yedekAd: string | null | undefined) => {
    if (!id) return { id: null, ad: bosNull(yedekAd) };
    if (var_.has(id)) return { id, ad: null };
    const a = bosNull(yedekAd);
    bagsiz.push(a ?? "bir kişi");
    return { id: null, ad: a };
  };
  const p = coz(v.paylasilanKisiId, v.paylasilanAd);
  const r = coz(v.referansKisiId, v.referansAd);
  const t = taraflar.map((x) => {
    const c = coz(x.kisiId, x.ad);
    return { kisiId: c.id, ad: c.id ? null : c.ad, rol: x.rol };
  }).filter((x) => x.kisiId || x.ad);
  return { paylasilan: p, referans: r, taraflar: t, bagsiz };
}
const sayi = (d: unknown) => (d == null ? null : Number(d));
const gunYaz = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);
const KISI_SEC = { select: { id: true, adSoyad: true, telefon: true } } as const;

/** Veritabanı satırını ekranın beklediği düz biçime çevirir (kişi adları çözülmüş hâlde). */
const disaYaz = (x: any) => ({
  ...x,
  tarih: gunYaz(x.tarih), tahsilatTarihi: gunYaz(x.tahsilatTarihi),
  bedel: sayi(x.bedel), paylasilan: sayi(x.paylasilan), ofisPayi: sayi(x.ofisPayi), banaKalan: sayi(x.banaKalan),
  paylasilanAd: x.paylasilanKisi?.adSoyad ?? x.paylasilanAd ?? null,
  paylasilanTelefon: x.paylasilanTelefon ?? x.paylasilanKisi?.telefon ?? null,
  referansAd: x.referansKisi?.adSoyad ?? x.referansAd ?? null,
  taraflar: (x.taraflar ?? []).map((t: any) => ({ kisiId: t.kisiId, rol: t.rol, ad: t.kisi?.adSoyad ?? t.ad ?? "", telefon: t.kisi?.telefon ?? null })),
  paylasilanKisi: undefined, referansKisi: undefined,
});
const ICERIK = { paylasilanKisi: KISI_SEC, referansKisi: KISI_SEC, taraflar: { include: { kisi: KISI_SEC } } } as const;

export async function islemListesi(prisma: PrismaClient) {
  yetkiGerek(ofisBaglami().rol, "islem.yonet");
  const l = await prisma.islem.findMany({ orderBy: [{ tarih: "desc" }, { createdAt: "desc" }], include: ICERIK as any });
  return l.map(disaYaz);
}

export async function islemOlustur(prisma: PrismaClient, girdi: unknown) {
  const b = ofisBaglami();
  yetkiGerek(b.rol, "islem.yonet");
  const v = IslemSchema.parse(girdi);
  const t = tarafVeri(v);
  const c = kisileriCoz(v, await varOlanKisiler(prisma, [v.paylasilanKisiId, v.referansKisiId, ...t.map((x) => x.kisiId)]), t);
  const { id } = await prisma.islem.create({
    data: { ...veriYap(v, c), sahipKullaniciId: b.kullaniciId ?? null, ...(c.taraflar.length ? { taraflar: { create: c.taraflar } } : {}) } as any,
    select: { id: true },
  });
  return { id, bagsiz: c.bagsiz };
}

export async function islemGuncelle(prisma: PrismaClient, id: string, girdi: unknown) {
  yetkiGerek(ofisBaglami().rol, "islem.yonet");
  const v = IslemSchema.parse(girdi);
  if (!(await prisma.islem.findFirst({ where: { id }, select: { id: true } }))) throw Object.assign(new Error("İşlem bulunamadı"), { code: "P2025" });
  const t = tarafVeri(v);
  const c = kisileriCoz(v, await varOlanKisiler(prisma, [v.paylasilanKisiId, v.referansKisiId, ...t.map((x) => x.kisiId)]), t);
  // Taraflar tam kayıt olarak gelir: önce temizlenir, sonra gönderilenler yazılır.
  await prisma.islem.update({ where: { id }, data: { ...veriYap(v, c), taraflar: { deleteMany: {}, ...(c.taraflar.length ? { create: c.taraflar } : {}) } } as any });
  return { id, bagsiz: c.bagsiz };
}

export async function islemSil(prisma: PrismaClient, id: string) {
  yetkiGerek(ofisBaglami().rol, "islem.yonet");
  if (!(await prisma.islem.findFirst({ where: { id }, select: { id: true } }))) throw Object.assign(new Error("İşlem bulunamadı"), { code: "P2025" });
  await prisma.islem.delete({ where: { id } });
  return { id };
}
