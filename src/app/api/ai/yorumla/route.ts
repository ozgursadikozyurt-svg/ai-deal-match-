// Anahtar CRM v3.13 · 3 Ekim 2026
// POST /api/ai/yorumla { metin, ai?, istem? }  — Akıllı girişin sunucu tarafı.
//   1) Kural tabanlı (ücretsiz): metnin NE olduğuna karar verir (portal ilan sayfası, WhatsApp sohbet dökümü, toplu liste, tek kayıt,
//      bağlantı, kişi, soru), parçalara ayırır, her parçanın konum ifadelerini çözer, güven puanını hesaplar. Kayıt AÇMAZ.
//   2) ai: true (v3.10): Ayarlar › Yapay zekâ'daki sağlayıcıya (AI_API_KEY) yorumlatır; kayıtlar AiParseCiktiSchema ile tek tek
//      doğrulanır. Sağlayıcı hata verirse kural tabanlı sonuç yine döner, `aiHata` alanı nedenini taşır.
//   aiOnerilir: güven, ayarlardaki eşiğin altındaysa true. istem: true → gönderilecek istem metni de döner (hata ayıklama).
import { z } from "zod";
import { prisma } from "@/lib/db";
import { hata, ok } from "@/lib/http/yanit";
import { yorumla, aiYorumIstemi } from "@/lib/ai/yorumlayici";
import { aiJsonIste, AiHatasi } from "@/lib/ai/saglayici";
import { aiAyarNormalize, calismaIliNormalize } from "@/lib/domain/ayarlar";
import { GEMINI_RESPONSE_SCHEMA, GEMINI_SISTEM_TALIMATI } from "@/lib/ai/gemini-cikti-semasi";
import { aiYanitiniDogrula } from "@/lib/ai/yorum-dogrula";
import { cokIlliCozumle, cokIlliIndeks } from "@/lib/lokasyon/turkiye";

const Girdi = z.object({ metin: z.string().trim().min(3).max(200_000), ai: z.boolean().optional(), istem: z.boolean().optional() });
const AI_UST_SINIR = 12_000;

export async function POST(req: Request) {
  try {
    const { metin, ai, istem } = Girdi.parse(await req.json());
    // v3.10 — Türkiye geneli: çalışma ili + metinde adı geçen diğer illerin indeksleri
    const ix = await cokIlliIndeks(prisma, metin, calismaIliNormalize((await prisma.ayar.findFirst({ where: { anahtar: "calismaIli" } }))?.deger));
    const ayar = aiAyarNormalize((await prisma.ayar.findFirst({ where: { anahtar: "ai" } }))?.deger);
    const y = yorumla(metin, ix);
    const parcalar = y.parcalar.map((p) => {
      const c = p.konumlar.length ? cokIlliCozumle(p.konumlar, ix) : { lokasyonlar: [], cozulemeyen: [] };
      return { ...p, lokasyonlar: c.lokasyonlar, cozulemeyen: c.cozulemeyen };
    });
    const aiOnerilir = y.tur !== "SORU" && y.guven * 100 < ayar.esik;
    const yanit: Record<string, unknown> = { tur: y.tur, aciklama: y.aciklama, guven: y.guven, esik: ayar.esik, tipIpucu: y.tipIpucu, atlanan: y.atlanan, kisiler: y.kisiler, parcalar, aiOnerilir };
    const gonderilecek = metin.length <= AI_UST_SINIR ? aiYorumIstemi(metin, y, GEMINI_SISTEM_TALIMATI, GEMINI_RESPONSE_SCHEMA) + `\nHer kayda "kaynakMetin" alanı ekle: o kaydın çıkarıldığı özgün metin parçası (aynen, en fazla 600 karakter).` : null;
    if (istem && gonderilecek) yanit.aiIstemi = gonderilecek;
    if (ai) {
      if (!gonderilecek) yanit.aiHata = { kod: "UZUN", mesaj: `Metin ${AI_UST_SINIR} karakterden uzun; sohbet dosyası olarak yükleyin` };
      else try {
        yanit.aiYorum = aiYanitiniDogrula(await aiJsonIste(ayar, process.env.AI_API_KEY || process.env.GEMINI_API_KEY, gonderilecek));
        yanit.aiModel = `${ayar.saglayici} · ${ayar.model}`;
      } catch (e) {
        if (!(e instanceof AiHatasi)) throw e;
        yanit.aiHata = { kod: e.kod, mesaj: e.message };
      }
    }
    return ok(yanit);
  } catch (e) { return hata(e); }
}