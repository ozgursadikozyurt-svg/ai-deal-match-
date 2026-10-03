// Anahtar CRM v3.14 · 3 Ekim 2026
// GET /api/saglik → uygulama ve veritabanı ayakta mı (giriş gerektirmez; içerik döndürmez)
import { prisma } from "@/lib/db";
export async function GET() {
  try { await prisma.$queryRawUnsafe("SELECT 1"); return Response.json({ ok: true, vt: true }); }
  catch { return Response.json({ ok: true, vt: false }, { status: 503 }); }
}