// Anahtar CRM v3.23 · 10 Ekim 2026
// GET  /api/davet            → ofisin davetleri (kod gösterilmez, yalnızca durum)
// POST /api/davet            → yeni davet üretir; yanıtta bağlantı kodu BİR KEZ döner
//        { eposta?, rol?, gun?, ofisId? }  — ofisId yalnızca platform yöneticisi için
// DELETE /api/davet?id=…     → bekleyen daveti iptal eder
import { z } from "zod";
import { prisma } from "@/lib/db";
import { ok, hata, sorgu } from "@/lib/http/yanit";
import { ofisBaglami } from "@/lib/kiracilik";
import { yetkiGerek } from "@/lib/guvenlik/yetki";
import { davetUret, DavetSchema } from "@/lib/services/ofis";

export async function GET() {
  try {
    const b = ofisBaglami();
    yetkiGerek(b.rol, "ofis.davet");
    return ok(
      await prisma.davet.findMany({
        orderBy: { createdAt: "desc" },
        select: { id: true, eposta: true, rol: true, durum: true, sonKullanma: true, kullanilan: true, kullananEposta: true, createdAt: true },
      }),
    );
  } catch (e) {
    return hata(e);
  }
}

export async function POST(req: Request) {
  try {
    const g = DavetSchema.extend({ ofisId: z.string().optional() }).parse(await req.json());
    const { ofisId, ...davet } = g;
    return ok(await davetUret(prisma, davet, ofisId), 201);
  } catch (e) {
    return hata(e);
  }
}

export async function DELETE(req: Request) {
  try {
    const b = ofisBaglami();
    yetkiGerek(b.rol, "ofis.davet");
    const { id } = sorgu(req);
    if (!id) return ok({ hata: "id gerekli" }, 400);
    return ok(await prisma.davet.update({ where: { id }, data: { durum: "IPTAL" }, select: { id: true, durum: true } }));
  } catch (e) {
    return hata(e);
  }
}
