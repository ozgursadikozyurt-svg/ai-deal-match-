// Anahtar CRM v3.22.2 · 10 Ekim 2026
// POST /api/lokasyon/coz  { "metin": "Aksu, Yenigöl / Altınova olur", "ilId": 7 }
// v3.10: metinde başka il adı geçerse ("İzmir Bornova") o ilde çözülür; ilId = çalışma ili (verilmezse Ayarlar'daki).
// → { lokasyonlar: [{ilceId, mahalleId, altBolgeId, etiket, guven, belirsiz?}], cozulemeyen: [...] }
// WhatsApp ingest ve Hızlı Import bu servisi kullanır; AI asla lokasyon ID'si üretmez.
import { z } from "zod";
import { prisma } from "@/lib/db";
import { cokIlliCozumle, cokIlliIndeks } from "@/lib/lokasyon/turkiye";
import { calismaIliNormalize } from "@/lib/domain/ayarlar";
import { hata, ok } from "@/lib/http/yanit";

const Govde = z.object({
  metin: z.union([z.string().min(2).max(500), z.array(z.string().max(60)).min(1).max(20)]),
  ilId: z.number().int().min(1).max(81).optional(),
});

export async function POST(req: Request) {
  try {
    const { metin, ilId } = Govde.parse(await req.json());
    const il = ilId ?? calismaIliNormalize((await prisma.ayar.findFirst({ where: { anahtar: "calismaIli" } }))?.deger);
    return ok(cokIlliCozumle(metin, await cokIlliIndeks(prisma, Array.isArray(metin) ? metin.join(", ") : metin, il)));
  } catch (e) { return hata(e); }
}