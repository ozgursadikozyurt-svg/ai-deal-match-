// Anahtar CRM v3.13 · 3 Ekim 2026
// GET  /api/senkron/cakismalar            → açık çakışmalar (aynı alan iki tarafta farklı değişmiş)
// POST /api/senkron/cakismalar { id | ids[] | tumu: true, secim: "YEREL"|"UZAK" } → Anahtar'daki kalsın / dış kaynaktakini al
//   v3.7: toplu seçim — seçilenler ya da tüm açık çakışmalar tek istekle
import { z } from "zod";
import { prisma } from "@/lib/db";
import { hata, ok } from "@/lib/http/yanit";
import { cakismaCoz } from "@/lib/services/senkron";

export async function GET() {
  try { return ok(await prisma.senkronCakisma.findMany({ where: { durum: "ACIK" }, orderBy: { createdAt: "desc" }, take: 200 })); } catch (e) { return hata(e); }
}
export async function POST(req: Request) {
  try {
    const g = z.object({ id: z.string().min(1).optional(), ids: z.array(z.string().min(1)).max(500).optional(), tumu: z.boolean().optional(), secim: z.enum(["YEREL", "UZAK"]) }).parse(await req.json());
    const ids = g.tumu ? (await prisma.senkronCakisma.findMany({ where: { durum: "ACIK" }, select: { id: true } })).map((x) => x.id) : g.ids ?? (g.id ? [g.id] : []);
    const sonuc = []; for (const id of ids) sonuc.push(await cakismaCoz(prisma, id, g.secim));
    return ok({ cozulen: sonuc.length });
  } catch (e) { return hata(e); }
}