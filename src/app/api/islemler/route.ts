// Anahtar CRM v3.40 · 23 Ekim 2026 — işlem ve komisyon (yalnızca ofis yöneticisi: islem.yonet)
// GET → liste · POST → yeni · PATCH ?id= → güncelle (tam kayıt) · DELETE ?id= → sil
import { prisma } from "@/lib/db";
import { ok, hata, sorgu } from "@/lib/http/yanit";
import { islemListesi, islemOlustur, islemGuncelle, islemSil } from "@/lib/services/islem";

const idAl = (req: Request) => { const id = sorgu(req).id; if (!id) throw Object.assign(new Error("id gerekli"), { durum: 400 }); return id; };
export async function GET() { try { return ok(await islemListesi(prisma)); } catch (e) { return hata(e); } }
export async function POST(req: Request) { try { return ok(await islemOlustur(prisma, await req.json()), 201); } catch (e) { return hata(e); } }
export async function PATCH(req: Request) { try { return ok(await islemGuncelle(prisma, idAl(req), await req.json())); } catch (e) { return hata(e); } }
export async function DELETE(req: Request) { try { return ok(await islemSil(prisma, idAl(req))); } catch (e) { return hata(e); } }
