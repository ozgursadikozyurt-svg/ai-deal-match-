// Anahtar CRM v3.21.2 · 8 Ekim 2026
// POST   /api/eslesme/kopar { talepId, portfoyId, neden, not? } → eşleşme koparılır (durum REDDEDILDI), bir daha önerilmez
// DELETE /api/eslesme/kopar?talepId=…&portfoyId=…              → geri alınır (durum BEKLIYOR)
import { z } from "zod";
import { prisma } from "@/lib/db";
import { hata, ok } from "@/lib/http/yanit";
import { KOPMA_NEDENLERI } from "@/lib/eslestirme/kopar";

const Govde = z.object({ talepId: z.string().min(1), portfoyId: z.string().min(1), neden: z.enum(KOPMA_NEDENLERI.map((x) => x[0]) as [string, ...string[]]), not: z.string().max(2000).optional() });
export async function POST(req: Request) {
  try {
    const g = Govde.parse(await req.json());
    const veri = { durum: "REDDEDILDI" as const, kopmaNedeni: g.neden, koparilma: new Date(), ...(g.not ? { operasyonNotu: g.not, notGuncellendi: new Date() } : {}) };
    return ok(await prisma.match.upsert({ where: { talepId_portfoyId: { talepId: g.talepId, portfoyId: g.portfoyId } }, update: veri, create: { talepId: g.talepId, portfoyId: g.portfoyId, matematikSkor: 0, finalSkor: 0, ...veri } }));
  } catch (e) { return hata(e); }
}
export async function DELETE(req: Request) {
  try {
    const q = new URL(req.url).searchParams;
    const talepId = q.get("talepId"), portfoyId = q.get("portfoyId");
    if (!talepId || !portfoyId) throw new Error("talepId ve portfoyId gerekli");
    return ok(await prisma.match.update({ where: { talepId_portfoyId: { talepId, portfoyId } }, data: { durum: "BEKLIYOR", kopmaNedeni: null, koparilma: null } }));
  } catch (e) { return hata(e); }
}