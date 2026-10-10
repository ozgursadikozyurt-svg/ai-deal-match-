// Anahtar CRM v3.23 · 10 Ekim 2026
// POST /api/ai/json { istem, sistem? } → { sonuc }  — arayüzün genel yapay zekâ çağrısı (AI kutusu, WhatsApp içe aktarma, bağlantı denemesi).
// Sağlayıcı / model / adres Ayarlar › Yapay zekâ'dan (veritabanı), anahtar sunucudaki AI_API_KEY'den gelir; anahtar tarayıcıya hiç inmez.
import { z } from "zod";
import { prisma } from "@/lib/db";
import { hata, ok } from "@/lib/http/yanit";
import { aiAyarNormalize } from "@/lib/domain/ayarlar";
import { aiJsonIste, AiHatasi } from "@/lib/ai/saglayici";

const G = z.object({ istem: z.string().min(1).max(200_000), sistem: z.string().max(20_000).optional() });
export async function POST(req: Request) {
  try {
    const g = G.parse(await req.json());
    const ayar = aiAyarNormalize((await prisma.ayar.findFirst({ where: { anahtar: "ai" } }))?.deger);
    try {
      const sonuc = await aiJsonIste(ayar, process.env.AI_API_KEY || process.env.GEMINI_API_KEY, g.istem, { sistem: g.sistem, zamanAsimiMs: 45_000 });
      return ok({ sonuc });
    } catch (e) {
      if (e instanceof AiHatasi) return ok({ hata: e.kod, mesaj: e.message }, e.kod === "ANAHTAR_YOK" || e.kod === "AYAR_EKSIK" ? 503 : 502);
      throw e;
    }
  } catch (e) { return hata(e); }
}
