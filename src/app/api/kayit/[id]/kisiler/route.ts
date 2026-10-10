// Anahtar CRM v3.22.2 · 10 Ekim 2026
// POST   /api/kayit/:id/kisiler { kisiId, rol }  → kişiyi kayda bağla
// DELETE /api/kayit/:id/kisiler?kisiId=&rol=     → bağı kaldır
import { prisma } from "@/lib/db";
import { hata, ok, sorgu } from "@/lib/http/yanit";
import { kayitKisiBagla } from "@/lib/services/kisi";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try { return ok(await kayitKisiBagla(prisma, (await params).id, await req.json()), 201); } catch (e) { return hata(e); }
}
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { kisiId, rol } = sorgu(req);
    await prisma.kayitKisi.deleteMany({ where: { kayitId: (await params).id, kisiId, ...(rol ? { rol: rol as never } : {}) } });
    return ok({ silindi: true });
  } catch (e) { return hata(e); }
}