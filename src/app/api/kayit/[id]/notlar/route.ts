// Anahtar CRM v3.24 · 10 Ekim 2026
// GET    /api/kayit/:id/notlar                          → görüşme / not akışı (yeniden eskiye)
// POST   /api/kayit/:id/notlar { tur, metin, kisiId? }  → not ekler; kişi seçildiyse kişinin "son iletişim"i güncellenir
// DELETE /api/kayit/:id/notlar?notId=…                  → notu siler
import { prisma } from "@/lib/db";
import { hata, ok } from "@/lib/http/yanit";
import { notEkle, notlar, NotSchema } from "@/lib/services/toplu";

type Ctx = { params: Promise<{ id: string }> };
export async function GET(_req: Request, { params }: Ctx) {
  try { return ok(await notlar(prisma, (await params).id)); } catch (e) { return hata(e); }
}
export async function POST(req: Request, { params }: Ctx) {
  try { return ok(await notEkle(prisma, (await params).id, NotSchema.parse(await req.json())), 201); } catch (e) { return hata(e); }
}
export async function DELETE(req: Request, { params }: Ctx) {
  try {
    const notId = new URL(req.url).searchParams.get("notId");
    if (!notId) throw new Error("notId gerekli");
    await prisma.kayitNot.deleteMany({ where: { id: notId, kayitId: (await params).id } });
    return ok({ silindi: true });
  } catch (e) { return hata(e); }
}