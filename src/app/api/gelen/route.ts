// Anahtar CRM v3.23 · 10 Ekim 2026
// GELEN KUTUSU — e-postayla ya da yüklemeyle gelen ham dosyalar (WhatsApp .zip / .txt, Revy .xlsx, .eml).
// GET    /api/gelen                 → { dosyalar: [{ id, ad, tur, boyut, kanal, gonderen, konu, gelis, url }], depo }   (url: 1 saat geçerli)
// POST   /api/gelen  (multipart: dosya)  → ekrandan yükleme; aynı içerik zaten kutudaysa { yeni: false }
// DELETE /api/gelen?id=a,b,c  |  ?hepsi=1 → dosyaları siler (künye + depo)
// Sunucu dosyayı açmaz; ayrıştırma ve mükerrer denetimi tarayıcıdadır (bkz. src/lib/services/gelen.ts).
import { prisma } from "@/lib/db";
import { ok } from "@/lib/http/yanit";
import { gelenHataYaniti } from "@/lib/http/gelen-yanit";
import { gelenKaydet, gelenListe, gelenDosyaSil } from "@/lib/services/gelen";

export async function GET() {
  try { return ok(await gelenListe(prisma)); } catch (e) { return gelenHataYaniti(e); }
}
export async function POST(req: Request) {
  try {
    const dosya = (await req.formData()).get("dosya");
    if (!(dosya instanceof File)) return ok({ hata: "DOGRULAMA", mesaj: "dosya alanı gerekli" }, 422);
    const r = await gelenKaydet(prisma, { ad: dosya.name, veri: new Uint8Array(await dosya.arrayBuffer()), kanal: "YUKLEME", icerikTuru: dosya.type });
    return ok(r, r.yeni ? 201 : 200);
  } catch (e) { return gelenHataYaniti(e); }
}
export async function DELETE(req: Request) {
  try {
    const s = new URL(req.url).searchParams;
    const ids = s.get("hepsi") ? null : (s.get("id") ?? "").split(",").map((x) => x.trim()).filter(Boolean).slice(0, 500);
    if (ids && !ids.length) return ok({ hata: "DOGRULAMA", mesaj: "id ya da hepsi=1 gerekli" }, 422);
    return ok({ silinen: await gelenDosyaSil(prisma, ids) });
  } catch (e) { return gelenHataYaniti(e); }
}
