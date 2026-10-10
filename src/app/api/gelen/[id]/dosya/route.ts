// Anahtar CRM v3.24 · 10 Ekim 2026
// GET /api/gelen/:id/dosya → ham dosyanın gövdesi (akış olarak aktarılır; sunucu içeriğe dokunmaz).
// Olağan yol imzalı bağlantıdır (GET /api/gelen yanıtındaki `url`); tarayıcı ona ulaşamazsa bu yola düşer.
import { prisma } from "@/lib/db";
import { ok } from "@/lib/http/yanit";
import { gelenIndir } from "@/lib/depolama/supabase";
import { gelenHataYaniti } from "@/lib/http/gelen-yanit";

type Ctx = { params: Promise<{ id: string }> };
export async function GET(_req: Request, { params }: Ctx) {
  try {
    const d = await prisma.gelenDosya.findFirst({ where: { id: (await params).id }, select: { depoYolu: true } });
    if (!d?.depoYolu) return ok({ hata: "BULUNAMADI" }, 404);
    const r = await gelenIndir(d.depoYolu);
    return new Response(r.body, { status: 200, headers: { "content-type": "application/octet-stream", "cache-control": "private, no-store" } });
  } catch (e) { return gelenHataYaniti(e); }
}
