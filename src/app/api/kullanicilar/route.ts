// Anahtar CRM v3.21.2 · 8 Ekim 2026
// GET   /api/kullanicilar        → ofisin kullanıcıları (ofis yöneticisi)
// PATCH /api/kullanicilar?id=…   → { rol?, aktif?, adSoyad?, telefon? }
import { z } from "zod";
import { prisma } from "@/lib/db";
import { ok, hata, sorgu } from "@/lib/http/yanit";
import { kullaniciListesi, kullaniciGuncelle } from "@/lib/services/ofis";

const Guncelle = z.object({
  rol: z.enum(["PLATFORM_YONETICISI", "OFIS_YONETICISI", "DANISMAN"]).optional(),
  aktif: z.boolean().optional(),
  adSoyad: z.string().max(120).optional(),
  telefon: z.string().max(40).optional(),
});

export async function GET() {
  try { return ok(await kullaniciListesi(prisma)); } catch (e) { return hata(e); }
}

export async function PATCH(req: Request) {
  try {
    const id = sorgu(req).id;
    if (!id) throw Object.assign(new Error("id gerekli"), { durum: 400 });
    return ok(await kullaniciGuncelle(prisma, id, Guncelle.parse(await req.json())));
  } catch (e) { return hata(e); }
}
