/**
 * Anahtar CRM v3.44 · 27 Ekim 2026
 * İŞLEM (kapanan satış / kiralama) ve komisyonu. Yalnızca "islem.yonet" (ofis yöneticisi): asistan ve danışman göremez.
 * Polaris bu tabloyu Supabase üzerinden yalnızca okur. Kurallar: src/lib/domain/islem.ts
 *
 * v3.44 — İşlem detayı Polaris'teki kadar ayrıntılı: paylaşılan kişi (+ telefon), referans ve taraflar (rehberden).
 * Tutar alanları değişmedi; yeni alanların hepsi isteğe bağlı, eski kayıtlar olduğu gibi çalışır.
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
/** Taraf: rehberden kişi (kisiId) zorunlu — serbest ad yalnızca paylaşılan kişi ve referans için var. */
const TarafSchema = z.object({ kisiId: z.string().max(64), rol: z.enum(TARAF_ROLLERI).default("DIGER") });
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
const veriYap = (v: IslemGirdi) => ({
  tarih: gunOrtasi(v.tarih), tahsilatTarihi: v.tahsilatTarihi ? gunOrtasi(v.tahsilatTarihi) : null,
  tur: v.tur, baslik: v.baslik, bedel: v.bedel ?? null, paylasilan: v.paylasilan ?? null, ofisPayi: v.ofisPayi ?? null, banaKalan: v.banaKalan ?? null,
  aciklama: v.aciklama ?? null, reklam: v.reklam, talepKaynagi: v.talepKaynagi ?? null, talepId: v.talepId ?? null, portfoyId: v.portfoyId ?? null, kisiId: v.kisiId ?? null,
  // v3.44 — rehberden seçilince serbest ad tutulmaz (ad kişi kartından okunur)
  paylasilanKisiId: v.paylasilanKisiId ?? null, paylasilanAd: v.paylasilanKisiId ? null : bosNull(v.paylasilanAd), paylasilanTelefon: bosNull(v.paylasilanTelefon),
  referansKisiId: v.referansKisiId ?? null, referansAd: v.referansKisiId ? null : bosNull(v.referansAd),
});
/** Aynı kişi aynı rolde iki kez eklenmesin (tabloda benzersiz) */
const tarafVeri = (v: IslemGirdi) => {
  const g = new Map<string, { kisiId: string; rol: string }>();
  for (const t of v.taraflar ?? []) g.set(`${t.kisiId}|${t.rol}`, { kisiId: t.kisiId, rol: t.rol });
  return [...g.values()];
};
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
  taraflar: (x.taraflar ?? []).map((t: any) => ({ kisiId: t.kisiId, rol: t.rol, ad: t.kisi?.adSoyad ?? "", telefon: t.kisi?.telefon ?? null })),
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
  return prisma.islem.create({
    data: { ...veriYap(v), sahipKullaniciId: b.kullaniciId ?? null, ...(t.length ? { taraflar: { create: t } } : {}) } as any,
    select: { id: true },
  });
}

export async function islemGuncelle(prisma: PrismaClient, id: string, girdi: unknown) {
  yetkiGerek(ofisBaglami().rol, "islem.yonet");
  const v = IslemSchema.parse(girdi);
  if (!(await prisma.islem.findFirst({ where: { id }, select: { id: true } }))) throw Object.assign(new Error("İşlem bulunamadı"), { code: "P2025" });
  const t = tarafVeri(v);
  // Taraflar tam kayıt olarak gelir: önce temizlenir, sonra gönderilenler yazılır.
  await prisma.islem.update({ where: { id }, data: { ...veriYap(v), taraflar: { deleteMany: {}, ...(t.length ? { create: t } : {}) } } as any });
  return { id };
}

export async function islemSil(prisma: PrismaClient, id: string) {
  yetkiGerek(ofisBaglami().rol, "islem.yonet");
  if (!(await prisma.islem.findFirst({ where: { id }, select: { id: true } }))) throw Object.assign(new Error("İşlem bulunamadı"), { code: "P2025" });
  await prisma.islem.delete({ where: { id } });
  return { id };
}
