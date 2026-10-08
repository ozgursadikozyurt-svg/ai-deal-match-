// Anahtar CRM v3.21.2 · 8 Ekim 2026
// Platform yöneticisi (Özgür) için ofis yönetimi.
// GET   /api/platform/ofisler       → tüm ofisler + kullanıcı / kayıt sayıları
// POST  /api/platform/ofisler       → yeni ofis { ad, telefon?, sehir?, plan?, denemeGun? }
// PATCH /api/platform/ofisler?id=…  → { plan?, denemeGun?, durum?, notlar? }
import { prisma } from "@/lib/db";
import { ok, hata, sorgu } from "@/lib/http/yanit";
import { ofisListesi, ofisAc, ofisGuncelle } from "@/lib/services/ofis";

export async function GET() {
  try { return ok(await ofisListesi(prisma)); } catch (e) { return hata(e); }
}

export async function POST(req: Request) {
  try { return ok(await ofisAc(prisma, await req.json())); } catch (e) { return hata(e); }
}

export async function PATCH(req: Request) {
  try {
    const id = sorgu(req).id;
    if (!id) throw Object.assign(new Error("id gerekli"), { durum: 400 });
    return ok(await ofisGuncelle(prisma, id, await req.json()));
  } catch (e) { return hata(e); }
}
