// Anahtar CRM v3.21.1 · 8 Ekim 2026
// GET   /api/kayit/:id  → detay (özellikler + lokasyon + eşleşmeler + audit)
// PATCH /api/kayit/:id  → düzenleme (Edit modu) — her alan değişikliği audit_log'a yazılır
import { prisma } from "@/lib/db";
import { KayitUpdateSchema } from "@/lib/validation/kayit";
import { kayitGuncelle } from "@/lib/services/kayit";
import { hata, ok } from "@/lib/http/yanit";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const kayit = await prisma.kayit.findUniqueOrThrow({
      where: { id },
      include: {
        ozellik: true,
        kisi: true,
        lokasyonlar: { include: { il: true, ilce: true, mahalle: true, altBolge: true }, orderBy: { sira: "asc" } },
        talepMatchleri: { orderBy: { finalSkor: "desc" }, take: 20 },
        portfoyMatchleri: { orderBy: { finalSkor: "desc" }, take: 20 },
        auditLoglari: { orderBy: { createdAt: "desc" }, take: 50 },
      },
    });
    return ok(kayit);
  } catch (e) { return hata(e); }
}

export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    return ok(await kayitGuncelle(prisma, id, KayitUpdateSchema.parse(await req.json())));
  } catch (e) { return hata(e); }
}