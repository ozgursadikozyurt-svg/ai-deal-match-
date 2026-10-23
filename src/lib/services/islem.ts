/**
 * Anahtar CRM v3.41 · 23 Ekim 2026
 * İŞLEM (kapanan satış / kiralama) ve komisyonu. Yalnızca "islem.yonet" (ofis yöneticisi): asistan ve danışman göremez.
 * Polaris bu tabloyu Supabase üzerinden yalnızca okur (sonraki adım). Kurallar: src/lib/domain/islem.ts
 */
import { z } from "zod";
import type { PrismaClient } from "../../generated/prisma/client";
import { ofisBaglami } from "../kiracilik";
import { yetkiGerek } from "../guvenlik/yetki";
import { ISLEM_TURLERI } from "../domain/islem";
import { ILK_KAYNAKLAR } from "../domain/ilk-kaynak";

const tutar = z.number().finite().min(-1_000_000_000).max(10_000_000_000).nullish();
const gun = z.string().regex(/^\d{4}-\d{2}-\d{2}/, "Tarih YYYY-AA-GG olmalı");
const kimlik = z.string().max(64).nullish();
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
});
export type IslemGirdi = z.infer<typeof IslemSchema>;

const gunOrtasi = (g: string) => new Date(`${g.slice(0, 10)}T12:00:00.000Z`);
const veriYap = (v: IslemGirdi) => ({
  tarih: gunOrtasi(v.tarih), tahsilatTarihi: v.tahsilatTarihi ? gunOrtasi(v.tahsilatTarihi) : null,
  tur: v.tur, baslik: v.baslik, bedel: v.bedel ?? null, paylasilan: v.paylasilan ?? null, ofisPayi: v.ofisPayi ?? null, banaKalan: v.banaKalan ?? null,
  aciklama: v.aciklama ?? null, reklam: v.reklam, talepKaynagi: v.talepKaynagi ?? null, talepId: v.talepId ?? null, portfoyId: v.portfoyId ?? null, kisiId: v.kisiId ?? null,
});
const sayi = (d: unknown) => (d == null ? null : Number(d));
const gunYaz = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

export async function islemListesi(prisma: PrismaClient) {
  yetkiGerek(ofisBaglami().rol, "islem.yonet");
  const l = await prisma.islem.findMany({ orderBy: [{ tarih: "desc" }, { createdAt: "desc" }] });
  return l.map((x) => ({ ...x, tarih: gunYaz(x.tarih), tahsilatTarihi: gunYaz(x.tahsilatTarihi), bedel: sayi(x.bedel), paylasilan: sayi(x.paylasilan), ofisPayi: sayi(x.ofisPayi), banaKalan: sayi(x.banaKalan) }));
}

export async function islemOlustur(prisma: PrismaClient, girdi: unknown) {
  const b = ofisBaglami();
  yetkiGerek(b.rol, "islem.yonet");
  const v = IslemSchema.parse(girdi);
  return prisma.islem.create({ data: { ...veriYap(v), sahipKullaniciId: b.kullaniciId ?? null } as any, select: { id: true } });
}

export async function islemGuncelle(prisma: PrismaClient, id: string, girdi: unknown) {
  yetkiGerek(ofisBaglami().rol, "islem.yonet");
  const v = IslemSchema.parse(girdi);
  if (!(await prisma.islem.findFirst({ where: { id }, select: { id: true } }))) throw Object.assign(new Error("İşlem bulunamadı"), { code: "P2025" });
  await prisma.islem.update({ where: { id }, data: veriYap(v) as any });
  return { id };
}

export async function islemSil(prisma: PrismaClient, id: string) {
  yetkiGerek(ofisBaglami().rol, "islem.yonet");
  if (!(await prisma.islem.findFirst({ where: { id }, select: { id: true } }))) throw Object.assign(new Error("İşlem bulunamadı"), { code: "P2025" });
  await prisma.islem.delete({ where: { id } });
  return { id };
}
