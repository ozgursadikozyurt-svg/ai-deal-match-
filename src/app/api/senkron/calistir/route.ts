// Anahtar CRM v3.22.1 · 9 Ekim 2026 (v3.13'ten)
// POST /api/senkron/calistir { kaynak?: "google"|"notion"|"hepsi", tetik?: "zamanlayici"|"kullanici", tam?: boolean }
//
// İki çağıran var:
//  - Zamanlayıcı ("Authorization: Bearer <CRON_SECRET>") → Worker platform bağlamı kurar; Google'ı bağlı TÜM ofisler sırayla eşitlenir.
//    (Cloudflare zamanlayıcısı aynı işi src/canli/worker.ts içinden doğrudan çağırır; bu uç dış zamanlayıcılar için durur.)
//  - Oturum açmış ofis yöneticisi ("Şimdi eşitle", uygulama açılışı) → yalnızca kendi ofisi. Yanıttaki `devamEdecek: true`
//    ise arayüz aynı isteği yineler (büyük rehberlerde ilk içe aktarma birkaç turda biter).
import { z } from "zod";
import { prisma } from "@/lib/db";
import { hata, ok } from "@/lib/http/yanit";
import { baglamOku, ofisBaglami } from "@/lib/kiracilik";
import { yetkiGerek } from "@/lib/guvenlik/yetki";
import { senkronCalistir, tumOfislerdeGoogleSenkron } from "@/lib/services/senkron";

export const maxDuration = 60;
const Govde = z.object({ kaynak: z.enum(["google", "notion", "hepsi"]).default("hepsi"), tetik: z.enum(["zamanlayici", "kullanici"]).default("kullanici"), tam: z.boolean().default(false) });

export async function POST(req: Request) {
  try {
    const g = Govde.parse(await req.json().catch(() => ({})));
    if (baglamOku() === "platform") return ok({ ofisler: await tumOfislerdeGoogleSenkron(prisma) });
    yetkiGerek(ofisBaglami().rol, "ofis.entegrasyon");
    return ok(await senkronCalistir(prisma, { kaynak: g.kaynak, tetik: "kullanici", tam: g.tam }));
  } catch (e) { return hata(e); }
}
