// Anahtar CRM v3.43 · 25 Ekim 2026
// GET   /api/kampanyalar              → yönetici: bütçe, harcama, kayıt sayısı ve maliyetle · diğer roller: yalnızca açık kampanya adları
// POST  /api/kampanyalar              → { kanal, ad, butce?, baslangic?, bitis?, aciklama? } (ofis yöneticisi)
// PATCH /api/kampanyalar?id=…         → { kanal?, butce?, baslangic?, bitis?, aktif?, aciklama? } (ad değişmez)
// PUT   /api/kampanyalar?id=…         → { ay: "2026-10", tutar } aylık harcama; tutar 0 / boş = satırı sil
import { prisma } from "@/lib/db";
import { ok, hata, sorgu } from "@/lib/http/yanit";
import { kampanyaListesi, kampanyaOlustur, kampanyaGuncelle, harcamaYaz } from "@/lib/services/kampanya";

const idAl = (req: Request) => {
  const id = sorgu(req).id;
  if (!id) throw Object.assign(new Error("id gerekli"), { durum: 400 });
  return id;
};

export async function GET() { try { return ok(await kampanyaListesi(prisma)); } catch (e) { return hata(e); } }
export async function POST(req: Request) { try { return ok(await kampanyaOlustur(prisma, await req.json()), 201); } catch (e) { return hata(e); } }
export async function PATCH(req: Request) { try { return ok(await kampanyaGuncelle(prisma, idAl(req), await req.json())); } catch (e) { return hata(e); } }
export async function PUT(req: Request) { try { return ok(await harcamaYaz(prisma, idAl(req), await req.json())); } catch (e) { return hata(e); } }
