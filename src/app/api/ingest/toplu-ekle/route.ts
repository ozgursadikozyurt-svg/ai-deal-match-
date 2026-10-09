// Anahtar CRM v3.22 · 9 Ekim 2026
// POST /api/ingest/toplu-ekle { satirlar: [{ veri: KayitCreate, kisi?: {adSoyad, telefon?, sirket?, roller[], rol} }] }
//   → { eklenen, tekrar, yeniKisi, hata[] } — dosya önizlemesi ve toplu mesajın ortak ekleme ucu
import { prisma } from "@/lib/db";
import { hata, ok } from "@/lib/http/yanit";
import { topluEkle, TopluEkleSchema } from "@/lib/services/toplu";

export async function POST(req: Request) {
  try { return ok(await topluEkle(prisma, TopluEkleSchema.parse(await req.json())), 201); } catch (e) { return hata(e); }
}