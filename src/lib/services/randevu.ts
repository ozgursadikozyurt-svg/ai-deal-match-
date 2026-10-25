/**
 * Anahtar CRM v3.43 · 25 Ekim 2026
 * RANDEVU — gösterim / görüşme. Asistan dahil kayıt yazabilen herkes açar ve sonucunu girer; yapan kullanıcı sunucuda yazılır.
 * Silme yok: yanlış randevu "İptal" yapılır (asistan performansı ve Polaris sayıları bu kayıtlardan okunur).
 */
import { z } from "zod";
import type { PrismaClient } from "../../generated/prisma/client";
import { ofisBaglami } from "../kiracilik";
import { yetkiGerek } from "../guvenlik/yetki";
import { RANDEVU_TURLERI, RANDEVU_SONUCLARI } from "../domain/islem";

const kimlik = z.string().max(64).nullish();
export const RandevuSchema = z.object({
  tarih: z.coerce.date(),
  tur: z.enum(RANDEVU_TURLERI).default("GOSTERIM"),
  sonuc: z.enum(RANDEVU_SONUCLARI).default("PLANLANDI"),
  talepId: kimlik, portfoyId: kimlik, kisiId: kimlik,
  not: z.string().trim().max(1000).nullish(),
});
export const RandevuGuncelleSchema = RandevuSchema.partial();

/** ?kayitId=… → o talep ya da portföyün randevuları; yoksa son 500 */
export async function randevuListesi(prisma: PrismaClient, kayitId?: string) {
  yetkiGerek(ofisBaglami().rol, "kayit.oku");
  return prisma.randevu.findMany({ where: kayitId ? { OR: [{ talepId: kayitId }, { portfoyId: kayitId }] } : {}, orderBy: { tarih: "desc" }, take: 500 });
}

export async function randevuOlustur(prisma: PrismaClient, girdi: unknown) {
  const b = ofisBaglami();
  yetkiGerek(b.rol, "kayit.yaz");
  const v = RandevuSchema.parse(girdi);
  if (!v.talepId && !v.portfoyId) throw Object.assign(new Error("Randevu bir talebe ya da portföye bağlı olmalı"), { durum: 400 });
  return prisma.randevu.create({ data: { ...v, talepId: v.talepId ?? null, portfoyId: v.portfoyId ?? null, kisiId: v.kisiId ?? null, not: v.not ?? null, sahipKullaniciId: b.kullaniciId ?? null } as any });
}

export async function randevuGuncelle(prisma: PrismaClient, id: string, girdi: unknown) {
  yetkiGerek(ofisBaglami().rol, "kayit.yaz");
  const v = RandevuGuncelleSchema.parse(girdi);
  if (!(await prisma.randevu.findFirst({ where: { id }, select: { id: true } }))) throw Object.assign(new Error("Randevu bulunamadı"), { code: "P2025" });
  return prisma.randevu.update({ where: { id }, data: v as any });
}
