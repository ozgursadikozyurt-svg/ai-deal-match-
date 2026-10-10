// Anahtar CRM v3.23 · 10 Ekim 2026
// GET  /api/kayit?tip=TALEP&mulkTipi=DEPO_ANTREPO&minElektrikKw=50&ilceId=12,15  → filtreli liste
// POST /api/kayit                                                                → yeni portföy/talep
import { prisma } from "@/lib/db";
import { KayitCreateSchema, KayitListeQuery } from "@/lib/validation/kayit";
import { kayitListele, kayitOlustur } from "@/lib/services/kayit";
import { hata, ok, sorgu } from "@/lib/http/yanit";

export async function GET(req: Request) {
  try {
    return ok(await kayitListele(prisma, KayitListeQuery.parse(sorgu(req))));
  } catch (e) { return hata(e); }
}

export async function POST(req: Request) {
  try {
    const veri = KayitCreateSchema.parse(await req.json());
    return ok(await kayitOlustur(prisma, veri), 201);
  } catch (e) { return hata(e); }
}