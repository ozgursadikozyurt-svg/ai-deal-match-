// Anahtar CRM v3.23 · 10 Ekim 2026
// POST /api/ingest/toplu-mesaj { metin } → mesajdaki ayrı kayıtlar (kişi, ayrıştırılmış alanlar, konum ifadeleri, miras alınanlar)
import { z } from "zod";
import { prisma } from "@/lib/db";
import { hata, ok } from "@/lib/http/yanit";
import { mesajiBol } from "@/lib/ingest/toplu-mesaj";
import { lokasyonIndeksiYukle } from "@/lib/lokasyon/cozumle";

export async function POST(req: Request) {
  try {
    const { metin } = z.object({ metin: z.string().min(3).max(50_000) }).parse(await req.json());
    return ok(mesajiBol(metin, await lokasyonIndeksiYukle(prisma)));
  } catch (e) { return hata(e); }
}