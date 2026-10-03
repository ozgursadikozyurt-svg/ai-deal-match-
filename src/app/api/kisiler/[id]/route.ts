// Anahtar CRM v3.13 · 3 Ekim 2026
// GET   /api/kisiler/:id → kişi kartı (bilgiler + bağlı talepler / portföyler)
// PATCH /api/kisiler/:id → bilgileri güncelle
import { prisma } from "@/lib/db";
import { hata, ok } from "@/lib/http/yanit";
import { KisiSchema, kisiKarti } from "@/lib/services/kisi";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try { return ok(await kisiKarti(prisma, (await params).id)); } catch (e) { return hata(e); }
}
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try { return ok(await prisma.kisi.update({ where: { id: (await params).id }, data: KisiSchema.partial().parse(await req.json()) })); } catch (e) { return hata(e); }
}