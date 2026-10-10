// Anahtar CRM v3.24 · 10 Ekim 2026
// GET  /api/lokasyon/alt-bolgeler?ilId=7          → piyasa bölgeleri (Lara, Altınova, OSB…)
// POST /api/lokasyon/alt-bolgeler                  → yeni alt bölge + mahalle eşlemesi
import { z } from "zod";
import { prisma } from "@/lib/db";
import { AltBolgeTipi } from "@/generated/prisma/enums";
import { slug } from "@/lib/lokasyon/normalize";
import { hata, ok, sorgu } from "@/lib/http/yanit";

export async function GET(req: Request) {
  try {
    const { ilId } = z.object({ ilId: z.coerce.number().int().default(7) }).parse(sorgu(req));
    return ok(
      await prisma.altBolge.findMany({
        where: { ilId },
        orderBy: { ad: "asc" },
        include: { ilce: { select: { ad: true } }, mahalleler: { include: { mahalle: { select: { id: true, ad: true, ilceId: true } } } } },
      }),
    );
  } catch (e) { return hata(e); }
}

const Yeni = z.object({
  ilId: z.number().int().min(1).max(81),
  ilceId: z.number().int().positive().nullish(),
  ad: z.string().trim().min(2).max(80),
  tip: z.nativeEnum(AltBolgeTipi).default("SEMT"),
  mahalleIdleri: z.array(z.number().int().positive()).max(200).default([]),
  aciklama: z.string().max(300).nullish(),
});

export async function POST(req: Request) {
  try {
    const v = Yeni.parse(await req.json());
    const ab = await prisma.altBolge.create({
      data: {
        ilId: v.ilId, ilceId: v.ilceId, ad: v.ad, slug: slug(v.ad), tip: v.tip, aciklama: v.aciklama, dogrulandi: true,
        mahalleler: { create: v.mahalleIdleri.map((mahalleId) => ({ mahalleId })) },
      },
    });
    return ok(ab, 201);
  } catch (e) { return hata(e); }
}