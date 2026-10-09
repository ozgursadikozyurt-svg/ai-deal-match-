// Anahtar CRM v3.22.1 · 9 Ekim 2026
// POST /api/ai/dene { ai? } — Ayarlar › Yapay zekâ ekranındaki "Bağlantıyı dene" düğmesi.
//   Gövdede `ai` verilirse KAYDETMEDEN o ayarla, verilmezse kayıtlı ayarla küçük bir deneme çağrısı yapar.
//   → { tamam: true, model, sureMs } ya da { tamam: false, kod, mesaj }   (anahtar: AI_API_KEY ortam değişkeni)
import { z } from "zod";
import { prisma } from "@/lib/db";
import { hata, ok } from "@/lib/http/yanit";
import { AiAyarSchema, aiAyarNormalize } from "@/lib/domain/ayarlar";
import { aiJsonIste, AiHatasi } from "@/lib/ai/saglayici";

export async function POST(req: Request) {
  try {
    const g = z.object({ ai: AiAyarSchema.optional() }).parse(await req.json().catch(() => ({})));
    const ayar = g.ai ?? aiAyarNormalize((await prisma.ayar.findFirst({ where: { anahtar: "ai" } }))?.deger);
    const t = Date.now();
    try {
      await aiJsonIste(ayar, process.env.AI_API_KEY || process.env.GEMINI_API_KEY, 'Yalnızca şu JSON\'u döndür: {"tamam": true}', { zamanAsimiMs: 15_000 });
      return ok({ tamam: true, model: `${ayar.saglayici} · ${ayar.model}`, sureMs: Date.now() - t });
    } catch (e) {
      if (e instanceof AiHatasi) return ok({ tamam: false, kod: e.kod, mesaj: e.message });
      throw e;
    }
  } catch (e) { return hata(e); }
}