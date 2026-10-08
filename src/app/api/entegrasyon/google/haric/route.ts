// Anahtar CRM v3.21 · 8 Ekim 2026
// GET    /api/entegrasyon/google/haric → Anahtar'dan silindiği için Google'dan geri gelmeyecek kişiler (son 200)
// DELETE /api/entegrasyon/google/haric → "Silinenleri yeniden getir": liste boşalır, bir sonraki eşitleme tam yapılır
// (Kural: Anahtar'dan silinen kişi Google'dan SİLİNMEZ; bu liste yalnızca "geri gelmesin" kaydıdır.)
import { prisma } from "@/lib/db";
import { hata, ok } from "@/lib/http/yanit";
import { ofisBaglami } from "@/lib/kiracilik";
import { yetkiGerek } from "@/lib/guvenlik/yetki";
import { googleHaricTemizle } from "@/lib/services/senkron";

export async function GET() {
  try {
    yetkiGerek(ofisBaglami().rol, "ofis.entegrasyon");
    const [liste, toplam] = await Promise.all([
      prisma.senkronHaric.findMany({ where: { saglayici: "GOOGLE_KISILER" }, orderBy: { createdAt: "desc" }, take: 200, select: { id: true, ad: true, createdAt: true } }),
      prisma.senkronHaric.count({ where: { saglayici: "GOOGLE_KISILER" } }),
    ]);
    return ok({ toplam, liste });
  } catch (e) { return hata(e); }
}
export async function DELETE() {
  try {
    yetkiGerek(ofisBaglami().rol, "ofis.entegrasyon");
    return ok(await googleHaricTemizle(prisma));
  } catch (e) { return hata(e); }
}
