// Anahtar CRM v3.23 · 10 Ekim 2026
// GET  /api/durum[?yalniz=kisiler] → arayüzün tüm verisi (kayıtlar, kişiler, eşleşme takibi, ayarlar, arayüz durumu)
// POST /api/durum { kayitlar, kayitSil, kisiler, kisiSil, eslesmeNotlari, ayarlar, arayuz } → değişiklikleri yazar
//   Demo yedeğini (JSON) canlıya taşımak da bu uçla yapılır (tüm kayıt ve kişiler "değişiklik" olarak gönderilir).
import { prisma } from "@/lib/db";
import { hata, ok } from "@/lib/http/yanit";
import { durumGetir, kisileriGetir, degisiklikUygula, DegisiklikSchema } from "@/lib/services/durum";

// v3.21 — ?yalniz=kisiler: Google eşitlemesinden sonra arayüz yalnızca kişileri yeniler (tüm kayıtları yeniden indirmez)
// v3.22.2 — &sonra=<ISO zaman>: yalnızca o andan sonra eklenen / değişen kişiler (artımlı); yanıttaki `zaman` bir sonrakinin `sonra`sıdır
export async function GET(req: Request) {
  try {
    const q = new URL(req.url).searchParams;
    if (q.get("yalniz") === "kisiler") { const s = q.get("sonra"); return ok(await kisileriGetir(prisma, s ? new Date(s) : null)); }
    return ok(await durumGetir(prisma));
  } catch (e) { return hata(e); }
}
export async function POST(req: Request) { try { return ok(await degisiklikUygula(prisma, DegisiklikSchema.parse(await req.json()))); } catch (e) { return hata(e); } }