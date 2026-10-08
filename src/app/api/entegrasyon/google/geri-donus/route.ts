// Anahtar CRM v3.13 · 3 Ekim 2026
// GET /api/entegrasyon/google/geri-donus?code&state → anahtarı şifreleyip saklar, ilk tam senkronu başlatır, Bağlantılar ekranına döner
import { prisma } from "@/lib/db";
import { kodTakasEt, yonlendirmeAdresi, idTokenEposta } from "@/lib/google/istemci";
import { sifrele, durumDogrula } from "@/lib/guvenlik/sifre";
import { entegrasyon, googleSenkronCalistir } from "@/lib/services/senkron";

export async function GET(req: Request) {
  const u = new URL(req.url);
  const geri = (q: string) => Response.redirect(`${(process.env.UYGULAMA_URL ?? u.origin).replace(/\/$/, "")}/baglantilar?google=${q}`, 302);
  try {
    if (u.searchParams.get("error")) return geri("iptal");
    durumDogrula(u.searchParams.get("state") ?? "");
    const t = await kodTakasEt(fetch, { code: u.searchParams.get("code") ?? "", clientId: process.env.GOOGLE_CLIENT_ID!, clientSecret: process.env.GOOGLE_CLIENT_SECRET!, redirectUri: yonlendirmeAdresi() });
    if (!t.refresh_token) return geri("yenileme-anahtari-yok");
    await entegrasyon(prisma, "GOOGLE_KISILER");
    await prisma.entegrasyon.updateMany({ where: { saglayici: "GOOGLE_KISILER" }, data: { durum: "BAGLI", hesap: idTokenEposta(t.id_token), tokenSifreli: sifrele(t.refresh_token), syncToken: null, imlec: undefined, sonHata: null } });
    await googleSenkronCalistir(prisma, { tetik: "ilk", tam: true }).catch(() => null); // kalanını zamanlayıcı tamamlar
    return geri("ok");
  } catch (e) { console.error(e); return geri("hata"); }
}