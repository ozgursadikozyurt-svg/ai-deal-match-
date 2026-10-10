// Anahtar CRM v3.23 · 10 Ekim 2026
// Gelen kutusunun adresi ve Gmail köprüsünün anahtarı.
// GET  /api/gelen/adres                 → { kod, eposta, kopru }   eposta: alan adı bağlıysa "<kod>@<GELEN_ALAN_ADI>", değilse null
// POST /api/gelen/adres { yenile: true } → yeni kod üretir (eski adres ve köprü anahtarı çalışmaz olur) — yalnızca ofis yöneticisi
import { prisma } from "@/lib/db";
import { hata, ok } from "@/lib/http/yanit";
import { ofisBaglami } from "@/lib/kiracilik";
import { yetkiGerek } from "@/lib/guvenlik/yetki";
import { gelenKodGetir } from "@/lib/services/gelen";

const yanit = (req: Request, kod: string) => {
  const alan = (process.env.GELEN_ALAN_ADI ?? "").trim().toLowerCase().replace(/^@/, "");
  return { kod, eposta: alan ? `${kod}@${alan}` : null, kopru: `${new URL(req.url).origin}/api/gelen/al` };
};
export async function GET(req: Request) {
  try { return ok(yanit(req, await gelenKodGetir(prisma))); } catch (e) { return hata(e); }
}
export async function POST(req: Request) {
  try {
    yetkiGerek(ofisBaglami().rol, "ofis.ayarlar");
    return ok(yanit(req, await gelenKodGetir(prisma, true)));
  } catch (e) { return hata(e); }
}
