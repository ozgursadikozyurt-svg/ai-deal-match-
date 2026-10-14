// Anahtar CRM v3.30 · 14 Ekim 2026
// POST /api/kayit-ol { ofisAd, adSoyad, telefon?, sehir?, onay: true } → davetsiz gelen danışman kendi ofisini açar
// (ofis yöneticisi, 14 gün Pro deneme). Yalnızca Cloudflare'de ACIK_KAYIT=1 ise açıktır (src/canli/worker.ts).
// Ofis bağlamı GEREKTİRMEZ ama giriş şarttır: e-posta doğrulanmış oturum anahtarından gelir, istekten değil.
import { prisma } from "@/lib/db";
import { ok, hata } from "@/lib/http/yanit";
import { kendiOfisiniAc } from "@/lib/services/ofis";
import { davetEpostasi } from "@/canli/davet-baglam";

export async function POST(req: Request) {
  try {
    const eposta = davetEpostasi();
    if (!eposta) return ok({ hata: "KIMLIK", mesaj: "Kayıt için önce e-postanızla giriş yapın" }, 401);
    const s = await kendiOfisiniAc(prisma, eposta, await req.json());
    if ("hata" in s) return ok({ hata: "KAYIT", mesaj: s.hata }, s.durum);
    return ok({ tamam: true, ofisId: s.kullanici.ofisId, denemeBitis: s.denemeBitis }, 201);
  } catch (e) {
    return hata(e);
  }
}
