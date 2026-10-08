// Anahtar CRM v3.20 · 7 Ekim 2026
// GET /api/oturum → kim giriş yaptı, hangi ofis, hangi rol, hangi plan, hangi yetkiler.
// Arayüz açılışta bunu çağırır ve ekranları buna göre kurar (yönetici bölümleri, fotoğraf kilidi…).
import { prisma } from "@/lib/db";
import { ok, hata } from "@/lib/http/yanit";
import { ofisBaglami } from "@/lib/kiracilik";
import { oturumOzeti } from "@/canli/oturum";

export async function GET() {
  try {
    return ok(await oturumOzeti(prisma, ofisBaglami()));
  } catch (e) {
    return hata(e);
  }
}
