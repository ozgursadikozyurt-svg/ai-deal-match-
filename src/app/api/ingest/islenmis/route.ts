// Anahtar CRM v3.24 · 10 Ekim 2026
// POST /api/ingest/islenmis { ingestionId, mesajlar: [{ metin, grup, tarih }], kayitSayisi? }
// Yapay zekâya gönderilen mesajları işaretler; aynı mesaj bir daha gönderilmez.
import { z } from "zod";
import { prisma } from "@/lib/db";
import { hata, ok } from "@/lib/http/yanit";
import { islenmisKaydet } from "@/lib/services/ingest";

const Govde = z.object({ ingestionId: z.string(), mesajlar: z.array(z.object({ metin: z.string().max(20000), grup: z.string().max(200), tarih: z.string().nullable() })).max(2000), kayitSayisi: z.record(z.number()).optional() });
export async function POST(req: Request) {
  try { const g = Govde.parse(await req.json()); await islenmisKaydet(prisma, g.mesajlar, g.ingestionId, g.kayitSayisi); return ok({ islendi: g.mesajlar.length }); } catch (e) { return hata(e); }
}