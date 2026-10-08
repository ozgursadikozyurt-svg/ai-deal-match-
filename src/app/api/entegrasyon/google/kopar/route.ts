// Anahtar CRM v3.13 · 3 Ekim 2026
// POST /api/entegrasyon/google/kopar → bağlantıyı kaldırır. Kişiler Anahtar'da kalır; yalnızca Google ile senkron durur.
import { prisma } from "@/lib/db";
import { hata, ok } from "@/lib/http/yanit";
import { entegrasyon } from "@/lib/services/senkron";

export async function POST() {
  try {
    await entegrasyon(prisma, "GOOGLE_KISILER");
    await prisma.entegrasyon.updateMany({ where: { saglayici: "GOOGLE_KISILER" }, data: { durum: "BAGLI_DEGIL", tokenSifreli: null, syncToken: null, imlec: undefined, hesap: null } });
    return ok({ kopti: true, not: "Google hesabınızdaki erişimi tamamen kaldırmak için: myaccount.google.com → Güvenlik → Üçüncü taraf erişimi" });
  } catch (e) { return hata(e); }
}