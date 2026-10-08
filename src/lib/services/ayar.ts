/**
 * Anahtar CRM v3.21.2 · 8 Ekim 2026
 * Ayar okuma / yazma — ayarlar ofis başına tutulur (birincil anahtar: ofisId + anahtar).
 * Okumada ofis süzgeci src/lib/kiracilik.ts tarafından kendiliğinden eklenir; yazmada bileşik
 * anahtar gerektiği için ofisId burada açıkça verilir.
 *
 * İstemci parametre olarak alınır (projenin diğer servisleriyle aynı düzen): böylece istek
 * boyunca tek bağlantı kullanılır.
 */
import type { PrismaClient } from "../../generated/prisma/client";
import { ofisBaglami } from "../kiracilik";

export const ayarOku = async (prisma: PrismaClient, anahtar: string): Promise<unknown> =>
  (await prisma.ayar.findFirst({ where: { anahtar } }))?.deger;

export function ayarYaz(prisma: PrismaClient, anahtar: string, deger: unknown) {
  const { ofisId } = ofisBaglami();
  return prisma.ayar.upsert({
    where: { ofisId_anahtar: { ofisId, anahtar } },
    update: { deger: deger as object },
    create: { ofisId, anahtar, deger: deger as object },
  });
}
