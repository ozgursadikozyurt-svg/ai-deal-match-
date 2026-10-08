// Anahtar CRM v3.21.1 · 8 Ekim 2026
// POST /api/kayit/:id/sure { gun: 30 }  → geçerliliği uzatır (süresi dolmuşsa bugünden itibaren; EXPIRED → ACTIVE)
// Belirli bir tarih için PATCH /api/kayit/:id { validUntil } kullanılır.
import { z } from "zod";
import { prisma } from "@/lib/db";
import { hata, ok } from "@/lib/http/yanit";
import { sureUzat } from "@/lib/services/kayit";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { gun } = z.object({ gun: z.number().int().min(1).max(730) }).parse(await req.json());
    return ok(await sureUzat(prisma, id, gun));
  } catch (e) { return hata(e); }
}