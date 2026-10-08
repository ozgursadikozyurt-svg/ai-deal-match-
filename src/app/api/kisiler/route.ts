// Anahtar CRM v3.21.1 · 8 Ekim 2026
// GET  /api/kisiler?q=meh   → yazdıkça arama (ad, şirket, telefonun son hanesi)
// POST /api/kisiler { adSoyad, telefon?, roller? … } → aynı telefon varsa mevcut kişi döner
import { prisma } from "@/lib/db";
import { hata, ok, sorgu } from "@/lib/http/yanit";
import { kisiAra, kisiOlusturVeyaBul } from "@/lib/services/kisi";

export async function GET(req: Request) {
  try { const { q = "" } = sorgu(req); return ok(await kisiAra(prisma, q)); } catch (e) { return hata(e); }
}
export async function POST(req: Request) {
  try { return ok(await kisiOlusturVeyaBul(prisma, await req.json()), 201); } catch (e) { return hata(e); }
}