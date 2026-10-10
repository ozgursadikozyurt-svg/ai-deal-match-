// Anahtar CRM v3.24 · 10 Ekim 2026
// POST /api/ingest/tablo (multipart: dosya=<.xlsx|.csv|.txt>, secenek=<JSON>) → önizleme: sütun eşleme, satır başına
//   Hazır / Kontrol / Tekrar / Hatalı, doğrulanmış kayıt verisi ve kişi. Yapay zekâ çağrılmaz. Ekleme: POST /api/ingest/toplu-ekle
import { prisma } from "@/lib/db";
import { hata, ok } from "@/lib/http/yanit";
import { dosyaOnizle } from "@/lib/services/toplu";

export async function POST(req: Request) {
  try {
    const f = await req.formData();
    const dosya = f.get("dosya");
    if (!(dosya instanceof File)) throw new Error("dosya alanı gerekli");
    if (dosya.size > 15 * 1024 * 1024) throw new Error("Dosya 15 MB'tan büyük");
    return ok(await dosyaOnizle(prisma, dosya.name, new Uint8Array(await dosya.arrayBuffer()), JSON.parse(String(f.get("secenek") ?? "{}"))));
  } catch (e) { return hata(e); }
}