// Anahtar CRM v3.24 · 10 Ekim 2026
// Gelen kutusunda "atla / temizle" denen kayıtların anahtarları — aynı ilan sonraki dökümde yeniden sorulmaz.
// GET    /api/gelen/atlanan                      → { anahtarlar: [...] }
// POST   /api/gelen/atlanan { anahtarlar: [...] } → ekler (parça parça gönderilir; tek istekte en çok 2.000)
// DELETE /api/gelen/atlanan                       → hepsini unutur ("atlananları geri getir");  gövdede { anahtarlar } varsa yalnızca onlar (geri al)
import { z } from "zod";
import { prisma } from "@/lib/db";
import { hata, ok } from "@/lib/http/yanit";
import { atlananlariGetir, atlananEkle, atlananSil } from "@/lib/services/gelen";

const Govde = z.object({ anahtarlar: z.array(z.string().min(3).max(130)).min(1).max(2000) });

export async function GET() {
  try { return ok({ anahtarlar: await atlananlariGetir(prisma) }); } catch (e) { return hata(e); }
}
export async function POST(req: Request) {
  try { return ok({ eklenen: await atlananEkle(prisma, Govde.parse(await req.json()).anahtarlar) }); } catch (e) { return hata(e); }
}
export async function DELETE(req: Request) {
  try {
    const g = await req.json().catch(() => null);
    return ok({ silinen: await atlananSil(prisma, g ? Govde.parse(g).anahtarlar : undefined) });
  } catch (e) { return hata(e); }
}
