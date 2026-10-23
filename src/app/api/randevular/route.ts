// Anahtar CRM v3.41 · 23 Ekim 2026 — randevu (gösterim / görüşme)
// GET ?kayitId= → o talep / portföyün randevuları · POST → yeni · PATCH ?id= → sonuç, tarih, not
import { prisma } from "@/lib/db";
import { ok, hata, sorgu } from "@/lib/http/yanit";
import { randevuListesi, randevuOlustur, randevuGuncelle } from "@/lib/services/randevu";

export async function GET(req: Request) { try { return ok(await randevuListesi(prisma, sorgu(req).kayitId)); } catch (e) { return hata(e); } }
export async function POST(req: Request) { try { return ok(await randevuOlustur(prisma, await req.json()), 201); } catch (e) { return hata(e); } }
export async function PATCH(req: Request) {
  try { const id = sorgu(req).id; if (!id) throw Object.assign(new Error("id gerekli"), { durum: 400 }); return ok(await randevuGuncelle(prisma, id, await req.json())); } catch (e) { return hata(e); }
}
