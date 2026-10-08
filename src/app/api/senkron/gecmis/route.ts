// Anahtar CRM v3.21.2 · 8 Ekim 2026
// GET /api/senkron/gecmis?saglayici=NOTION → son 50 senkron çalışması
import { prisma } from "@/lib/db";
import { hata, ok, sorgu } from "@/lib/http/yanit";

export async function GET(req: Request) {
  try {
    const { saglayici } = sorgu(req);
    return ok(await prisma.senkronCalisma.findMany({ where: saglayici ? { saglayici: saglayici as any } : {}, orderBy: { baslangic: "desc" }, take: 50 }));
  } catch (e) { return hata(e); }
}