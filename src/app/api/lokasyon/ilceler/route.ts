// Anahtar CRM v3.22 · 9 Ekim 2026
// GET /api/lokasyon/ilceler?ilId=7 → ilçeler (+ komşu ilçe ID'leri)
import { z } from "zod";
import { prisma } from "@/lib/db";
import { hata, ok, sorgu } from "@/lib/http/yanit";

const Q = z.object({ ilId: z.coerce.number().int().min(1).max(81) });

export async function GET(req: Request) {
  try {
    const { ilId } = Q.parse(sorgu(req));
    const ilceler = await prisma.ilce.findMany({
      where: { ilId },
      orderBy: { ad: "asc" },
      select: { id: true, ad: true, komsular: { select: { komsuIlceId: true } } },
    });
    return ok(ilceler.map((i) => ({ id: i.id, ad: i.ad, komsuIlceIdleri: i.komsular.map((k) => k.komsuIlceId) })));
  } catch (e) { return hata(e); }
}