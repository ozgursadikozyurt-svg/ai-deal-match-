// Anahtar CRM v3.23 · 10 Ekim 2026
// POST /api/gelen/al — OTURUMSUZ giriş kapısı: Gmail köprüsü (ya da başka bir otomasyon) bir dosyayı gelen kutusuna bırakır.
//   Gövde: dosyanın ham baytları.  Başlıklar: x-anahtar (ofisin gizli kodu; zorunlu), x-dosya-adi, x-gonderen, x-konu (URL-kodlu).
//   Yanıt: 201 { yeni: true } · 200 { yeni: false } (aynı dosya zaten kutuda) · 401 anahtar geçersiz · 413 çok büyük · 415 tür desteklenmiyor.
// Worker bu yolu oturum denetiminden geçirmez (src/canli/worker.ts); kimlik anahtarın kendisidir. Dosya yalnızca ONAY BEKLEYENLERE düşer:
// kullanıcı onaylamadan hiçbir kayıt havuza girmez, bu yüzden anahtarın sızması veriyi değiştirmez (anahtar Gelen kutusu › E-posta kurulumu'ndan yenilenir).
import { prisma } from "@/lib/db";
import { ok } from "@/lib/http/yanit";
import { gelenAl } from "@/lib/services/gelen";
import { GELEN_SINIR } from "@/lib/ingest/gelen";
import { gelenHataYaniti } from "@/lib/http/gelen-yanit";

const coz = (v: string | null) => { if (!v) return null; try { return decodeURIComponent(v); } catch { return v; } };

export async function POST(req: Request) {
  try {
    const kod = req.headers.get("x-anahtar") ?? new URL(req.url).searchParams.get("anahtar");
    if (Number(req.headers.get("content-length") ?? 0) > GELEN_SINIR) return ok({ hata: "BUYUK", mesaj: "Dosya çok büyük" }, 413);
    const veri = new Uint8Array(await req.arrayBuffer());
    const r = await gelenAl(prisma, kod, { ad: coz(req.headers.get("x-dosya-adi")), veri, kanal: "KOPRU", gonderen: coz(req.headers.get("x-gonderen")), konu: coz(req.headers.get("x-konu")), icerikTuru: req.headers.get("content-type") });
    return ok({ yeni: r.yeni, id: r.dosya.id }, r.yeni ? 201 : 200);
  } catch (e) { return gelenHataYaniti(e); }
}
