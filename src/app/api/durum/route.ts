// Anahtar CRM v3.14 · 3 Ekim 2026
// GET  /api/durum → arayüzün tüm verisi (kayıtlar, kişiler, eşleşme takibi, ayarlar, arayüz durumu)
// POST /api/durum { kayitlar, kayitSil, kisiler, kisiSil, eslesmeNotlari, ayarlar, arayuz } → değişiklikleri yazar
//   Demo yedeğini (JSON) canlıya taşımak da bu uçla yapılır (tüm kayıt ve kişiler "değişiklik" olarak gönderilir).
import { prisma } from "@/lib/db";
import { hata, ok } from "@/lib/http/yanit";
import { durumGetir, degisiklikUygula, DegisiklikSchema } from "@/lib/services/durum";

export async function GET() { try { return ok(await durumGetir(prisma)); } catch (e) { return hata(e); } }
export async function POST(req: Request) { try { return ok(await degisiklikUygula(prisma, DegisiklikSchema.parse(await req.json()))); } catch (e) { return hata(e); } }