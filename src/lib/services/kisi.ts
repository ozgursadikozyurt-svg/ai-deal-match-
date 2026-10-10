/**
 * Anahtar CRM v3.23 · 10 Ekim 2026
 * Kişiler: arama (ad / telefon / şirket), telefonla tekilleştirerek ekleme, kişi kartı, kayda bağlama.
 */
import { z } from "zod";
import type { PrismaClient } from "../../generated/prisma/client";
import { KayitKisiRolu, IlanSahibiTipi } from "../../generated/prisma/enums";
import { telNormalize } from "../ingest/whatsapp";

export const KisiSchema = z.object({
  adSoyad: z.string().trim().min(2).max(120),
  telefon: z.string().max(30).nullish().transform((t) => telNormalize(t) ?? (t?.trim() || null)),
  sirket: z.string().trim().max(120).nullish(),
  email: z.string().email().nullish(),
  roller: z.array(z.string().regex(/^[A-Z0-9_]{2,40}$/)).max(14).default([]), // v3.15: dinamik roller (Ayarlar › Kişi rolleri)
  ilanSahibiTipi: z.nativeEnum(IlanSahibiTipi).default("BILINMIYOR"),
  uzmanlikAileleri: z.array(z.string().max(20)).max(10).default([]),
  referans: z.string().max(200).nullish(),
  notlar: z.string().max(5000).nullish(),
});

export function kisiAra(prisma: PrismaClient, q: string, limit = 20) {
  const tel = q.replace(/\D/g, "");
  return prisma.kisi.findMany({
    where: { OR: [{ adSoyad: { contains: q, mode: "insensitive" } }, { sirket: { contains: q, mode: "insensitive" } }, ...(tel.length >= 4 ? [{ telefon: { contains: tel.slice(-10) } }] : [])] },
    orderBy: [{ sonIletisim: { sort: "desc", nulls: "last" } }, { adSoyad: "asc" }], take: limit,
  });
}

/** Aynı telefon varsa mevcut kişiyi döner (rollerini birleştirir), yoksa oluşturur */
export async function kisiOlusturVeyaBul(prisma: PrismaClient, girdi: z.input<typeof KisiSchema>) {
  const k = KisiSchema.parse(girdi);
  if (k.telefon) {
    const var_ = await prisma.kisi.findFirst({ where: { telefon: k.telefon } });
    if (var_) return prisma.kisi.update({ where: { id: var_.id }, data: { roller: [...new Set([...var_.roller, ...k.roller])], sirket: var_.sirket ?? k.sirket } });
  }
  return prisma.kisi.create({ data: { ...k, kaynak: "MANUEL" } });
}

export function kisiKarti(prisma: PrismaClient, id: string) {
  return prisma.kisi.findUniqueOrThrow({
    where: { id },
    include: { kayitBaglari: { include: { kayit: { include: { lokasyonlar: true, ozellik: true } } }, orderBy: { createdAt: "desc" } } },
  });
}

export const BaglaSchema = z.object({ kisiId: z.string().min(1), rol: z.nativeEnum(KayitKisiRolu).default("DIGER") });
export async function kayitKisiBagla(prisma: PrismaClient, kayitId: string, b: z.input<typeof BaglaSchema>) {
  const { kisiId, rol } = BaglaSchema.parse(b);
  const bag = await prisma.kayitKisi.upsert({ where: { kayitId_kisiId_rol: { kayitId, kisiId, rol } }, update: {}, create: { kayitId, kisiId, rol } });
  await prisma.kayit.updateMany({ where: { id: kayitId, kisiId: null }, data: { kisiId } });
  return bag;
}