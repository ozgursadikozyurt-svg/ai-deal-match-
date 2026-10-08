// Anahtar CRM v3.21.2 · 8 Ekim 2026
// GET /api/ayarlar → { ttl, ai, paylasim, calismaIli, aiAnahtarVar }
// PUT /api/ayarlar { ttl?, ai?, paylasim?, calismaIli? } → yalnızca gönderilenler güncellenir.
//   ttl: varsayılan geçerlilik süreleri (yeni kayıtlara uygulanır; mevcutlar değişmez)
//   ai (v3.10): sağlayıcı, model, adres, güven eşiği, otomatik yorumlama — API anahtarı burada değil, AI_API_KEY ortam değişkeninde
//   paylasim (v3.10): portföy föyündeki imza · calismaIli (v3.10): varsayılan il (plaka)
import { z } from "zod";
import { prisma } from "@/lib/db";
import { ayarYaz } from "@/lib/services/ayar";
import { hata, ok } from "@/lib/http/yanit";
import { TtlAyarSchema, ttlAyarlari } from "@/lib/services/kayit";
import { AiAyarSchema, PaylasimAyarSchema, aiAyarNormalize, paylasimNormalize, calismaIliNormalize } from "@/lib/domain/ayarlar";

const oku = async (anahtar: string) => (await prisma.ayar.findFirst({ where: { anahtar } }))?.deger;
const yaz = (anahtar: string, deger: unknown) => ayarYaz(prisma, anahtar, deger);

export async function GET() {
  try {
    return ok({ ttl: await ttlAyarlari(prisma), ai: aiAyarNormalize(await oku("ai")), paylasim: paylasimNormalize(await oku("paylasim")), calismaIli: calismaIliNormalize(await oku("calismaIli")), aiAnahtarVar: !!(process.env.AI_API_KEY || process.env.GEMINI_API_KEY) });
  } catch (e) { return hata(e); }
}
export async function PUT(req: Request) {
  try {
    const g = z.object({ ttl: TtlAyarSchema.optional(), ai: AiAyarSchema.optional(), paylasim: PaylasimAyarSchema.optional(), calismaIli: z.number().int().min(1).max(81).optional() }).parse(await req.json());
    if (g.ttl) await yaz("ttl", g.ttl);
    if (g.ai) await yaz("ai", g.ai);
    if (g.paylasim) await yaz("paylasim", g.paylasim);
    if (g.calismaIli) await yaz("calismaIli", g.calismaIli);
    return ok(g);
  } catch (e) { return hata(e); }
}