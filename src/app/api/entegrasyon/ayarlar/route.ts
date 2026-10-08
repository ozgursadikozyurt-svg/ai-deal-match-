// Anahtar CRM v3.13 · 3 Ekim 2026
// PUT /api/entegrasyon/ayarlar { saglayici, ayarlar: { otomatik, aralikDk, geriYaz, googleYaz, sadeceEtiketler } }
import { z } from "zod";
import { prisma } from "@/lib/db";
import { hata, ok } from "@/lib/http/yanit";
import { entegrasyon, ayarlarOf } from "@/lib/services/senkron";

const Govde = z.object({
  saglayici: z.enum(["GOOGLE_KISILER", "NOTION"]),
  ayarlar: z.object({ otomatik: z.boolean(), aralikDk: z.number().int().min(15).max(1440), geriYaz: z.boolean(), googleYaz: z.boolean(), sadeceEtiketler: z.array(z.string().max(80)).max(20) }).partial(),
});
export async function PUT(req: Request) {
  try {
    const g = Govde.parse(await req.json());
    const e = await entegrasyon(prisma, g.saglayici);
    const yeni = { ...ayarlarOf(e), ...g.ayarlar };
    await prisma.entegrasyon.updateMany({ where: { saglayici: g.saglayici }, data: { ayarlar: yeni } });
    return ok(yeni);
  } catch (e) { return hata(e); }
}