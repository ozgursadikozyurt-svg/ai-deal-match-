// Anahtar CRM v3.13 · 3 Ekim 2026
// GET /api/lokasyon/mahalleler?ilceId=123[&q=alt][&tip=MAHALLE] → mahalle/köy listesi (autocomplete)
import { z } from "zod";
import { prisma } from "@/lib/db";
import { YerlesimTipi } from "@/generated/prisma/enums";
import { hata, ok, sorgu } from "@/lib/http/yanit";

const Q = z.object({
  ilceId: z.coerce.number().int().positive(),
  q: z.string().max(60).optional(),
  tip: z.nativeEnum(YerlesimTipi).optional(),
});

export async function GET(req: Request) {
  try {
    const { ilceId, q, tip } = Q.parse(sorgu(req));
    return ok(
      await prisma.mahalle.findMany({
        where: { ilceId, ...(tip && { tip }), ...(q && { ad: { contains: q, mode: "insensitive" } }) },
        orderBy: [{ tip: "asc" }, { ad: "asc" }],
        select: { id: true, ad: true, tip: true, bagliOlduguYer: true, postaKodu: true, altBolgeler: { select: { altBolgeId: true } } },
        take: 500,
      }),
    );
  } catch (e) { return hata(e); }
}