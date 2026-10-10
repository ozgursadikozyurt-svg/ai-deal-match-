// Anahtar CRM v3.24 · 10 Ekim 2026
// GET /api/lokasyon/iller → 81 il
import { prisma } from "@/lib/db";
import { hata, ok } from "@/lib/http/yanit";

export async function GET() {
  try {
    return ok(await prisma.il.findMany({ orderBy: { ad: "asc" }, select: { id: true, plaka: true, ad: true } }));
  } catch (e) { return hata(e); }
}