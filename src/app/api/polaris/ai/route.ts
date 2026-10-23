// Anahtar CRM v3.41 · 23 Ekim 2026
// Polaris v7 · 21 Ekim 2026
// POST /api/polaris/ai { istem, sistem?, json? } → { metin, model }
// Polaris'in mentoru, haftalık değerlendirme yorumu ve "AI ile ders çıkar" bu çağrıyı kullanır.
// Sağlayıcı ve model Anahtar CRM'in Ayarlar › Yapay zekâ kaydından (şu an Gemini Flash), anahtar sunucudaki AI_API_KEY'den gelir;
// anahtar tarayıcıya inmez. İsteğe bağlı POLARIS_AI_MODEL değişkeni yalnızca Polaris için modeli değiştirir.
// Kişi adları ve telefonlar tarayıcıda maskelenip gönderilir (ücretsiz katman) — bkz. public/polaris.html › aiMaske.
import { z } from "zod";
import { prisma } from "@/lib/db";
import { hata, ok } from "@/lib/http/yanit";
import { aiAyarNormalize } from "@/lib/domain/ayarlar";
import { aiJsonIste, AiHatasi } from "@/lib/ai/saglayici";
import { polarisKapi } from "@/lib/polaris";

const G = z.object({ istem: z.string().min(1).max(120_000), sistem: z.string().max(20_000).optional(), json: z.boolean().optional() });
const KALIP = 'Yanıtını yalnızca şu biçimde bir JSON nesnesi olarak ver: {"yanit": "<Türkçe yanıt metni>"}. Metin içinde satır sonu için \\n kullan. Markdown başlığı kullanma.';

export async function POST(req: Request) {
  try {
    polarisKapi();
    const g = G.parse(await req.json());
    const ayar = aiAyarNormalize((await prisma.ayar.findFirst({ where: { anahtar: "ai" } }))?.deger);
    const model = process.env.POLARIS_AI_MODEL || ayar.model;
    try {
      const sonuc = (await aiJsonIste({ ...ayar, model }, process.env.AI_API_KEY || process.env.GEMINI_API_KEY, g.istem, {
        sistem: [g.sistem, g.json ? "" : KALIP].filter(Boolean).join("\n\n") || undefined, zamanAsimiMs: 50_000,
      })) as { yanit?: unknown };
      // json: true → istemin istediği JSON olduğu gibi döner (ders çıkarma); değilse {"yanit": metin} kalıbından metin alınır
      const metin = !g.json && typeof sonuc?.yanit === "string" ? sonuc.yanit : JSON.stringify(sonuc);
      return ok({ metin, model });
    } catch (e) {
      if (e instanceof AiHatasi) return ok({ hata: e.kod, mesaj: e.message }, e.kod === "ANAHTAR_YOK" || e.kod === "AYAR_EKSIK" ? 503 : 502);
      throw e;
    }
  } catch (e) { return hata(e); }
}
