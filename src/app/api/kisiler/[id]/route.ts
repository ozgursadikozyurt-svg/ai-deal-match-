// Anahtar CRM v3.22.2 · 10 Ekim 2026
// GET   /api/kisiler/:id → kişi kartı (bilgiler + bağlı talepler / portföyler)
// PATCH /api/kisiler/:id → bilgileri güncelle
import { prisma } from "@/lib/db";
import { hata, ok } from "@/lib/http/yanit";
import { KisiSchema, kisiKarti } from "@/lib/services/kisi";
import { gonderimAlaniDegisti } from "@/lib/google/kisiler";
import { googleGonderimAcik } from "@/lib/services/senkron";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try { return ok(await kisiKarti(prisma, (await params).id)); } catch (e) { return hata(e); }
}
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const id = (await params).id, veri = KisiSchema.partial().parse(await req.json());
    // v3.21 — Google'a bağlı kişide ad / telefon / e-posta / şirket düzeltmesi Google'a da gider (çift yönlü açıksa)
    const eski = await prisma.kisi.findFirst({ where: { id }, select: { adSoyad: true, telefon: true, ikincilTelefon: true, email: true, sirket: true, googleResourceName: true } });
    const isaret = !!eski?.googleResourceName && gonderimAlaniDegisti(eski, veri as any) && (await googleGonderimAcik(prisma));
    return ok(await prisma.kisi.update({ where: { id }, data: { ...veri, ...(isaret ? { googleBekliyor: new Date() } : {}) } }));
  } catch (e) { return hata(e); }
}