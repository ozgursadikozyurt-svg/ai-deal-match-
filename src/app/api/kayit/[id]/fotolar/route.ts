// Anahtar CRM v3.13 · 3 Ekim 2026
// Portföy fotoğrafları (en fazla 8; dosyalar Supabase Storage'da özel kovada, veritabanında yalnızca yol + künye)
// GET    /api/kayit/:id/fotolar                 → [{ id, sira, ad, en, boy, boyut, url }]  (url: 1 saat geçerli imzalı bağlantı)
// POST   /api/kayit/:id/fotolar  (multipart: dosya, en, boy)  → tarayıcıda küçültülmüş tek fotoğraf yükler
// PATCH  /api/kayit/:id/fotolar  { sira: [fotoId, …] }        → sıralama (ilk = kapak)
// DELETE /api/kayit/:id/fotolar?fotoId=…        → fotoğrafı siler (depodan da)
import { z } from "zod";
import { prisma } from "@/lib/db";
import { hata, ok } from "@/lib/http/yanit";
import { fotoDenetle, fotoYolu, FOTO_SINIR } from "@/lib/domain/foto";
import { ofisBaglami } from "@/lib/kiracilik";
import { dosyaYukle, dosyalariSil, imzaliBaglantilar, DepoHatasi } from "@/lib/depolama/supabase";

type Ctx = { params: Promise<{ id: string }> };
const depoHatasi = (e: unknown) => (e instanceof DepoHatasi ? ok({ hata: e.kod === "AYAR_YOK" ? "DEPO_KAPALI" : "DEPO", mesaj: e.message }, e.kod === "AYAR_YOK" ? 503 : 502) : hata(e));

export async function GET(_req: Request, { params }: Ctx) {
  try {
    const fotolar = await prisma.kayitFoto.findMany({ where: { kayitId: (await params).id }, orderBy: { sira: "asc" } });
    const url = await imzaliBaglantilar(fotolar.map((f) => f.depoYolu));
    return ok(fotolar.map(({ depoYolu, ...f }) => ({ ...f, url: url[depoYolu] ?? null })));
  } catch (e) { return depoHatasi(e); }
}
export async function POST(req: Request, { params }: Ctx) {
  try {
    const kayitId = (await params).id;
    const kayit = await prisma.kayit.findUnique({ where: { id: kayitId }, select: { tip: true, _count: { select: { fotolar: true } } } });
    if (!kayit) return ok({ hata: "BULUNAMADI" }, 404);
    if (kayit.tip !== "PORTFOY") return ok({ hata: "DOGRULAMA", mesaj: "Fotoğraf yalnızca portföye eklenir" }, 422);
    const form = await req.formData();
    const dosya = form.get("dosya");
    if (!(dosya instanceof File)) return ok({ hata: "DOGRULAMA", mesaj: "dosya alanı gerekli" }, 422);
    const sorun = fotoDenetle({ tur: dosya.type, boyut: dosya.size }, kayit._count.fotolar);
    if (sorun) return ok({ hata: "DOGRULAMA", mesaj: sorun }, 422);
    const olcu = z.object({ en: z.coerce.number().int().min(1).max(8000), boy: z.coerce.number().int().min(1).max(8000) }).parse({ en: form.get("en"), boy: form.get("boy") });
    const foto = await prisma.kayitFoto.create({ data: { kayitId, sira: kayit._count.fotolar, ad: dosya.name.replace(/\.[^.]+$/, "").slice(0, 60) || "fotograf", ...olcu, boyut: dosya.size, icerikTuru: dosya.type, depoYolu: "" } });
    const depoYolu = fotoYolu(ofisBaglami().ofisId, kayitId, foto.id, dosya.type);
    try { await dosyaYukle(depoYolu, await dosya.arrayBuffer(), dosya.type); }
    catch (e) { await prisma.kayitFoto.delete({ where: { id: foto.id } }); throw e; }
    await prisma.kayitFoto.update({ where: { id: foto.id }, data: { depoYolu } });
    const { depoYolu: _y, ...kunye } = { ...foto, depoYolu };
    return ok({ ...kunye, url: (await imzaliBaglantilar([depoYolu]))[depoYolu] ?? null, kalan: FOTO_SINIR - kayit._count.fotolar - 1 }, 201);
  } catch (e) { return depoHatasi(e); }
}
export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const kayitId = (await params).id;
    const { sira } = z.object({ sira: z.array(z.string().min(1).max(40)).min(1).max(FOTO_SINIR) }).parse(await req.json());
    const mevcut = new Set((await prisma.kayitFoto.findMany({ where: { kayitId }, select: { id: true } })).map((f) => f.id));
    if (sira.length !== mevcut.size || sira.some((id) => !mevcut.has(id)) || new Set(sira).size !== sira.length) return ok({ hata: "DOGRULAMA", mesaj: "sira, kaydın tüm fotoğraflarını birer kez içermeli" }, 422);
    for (const [n, id] of sira.entries()) await prisma.kayitFoto.update({ where: { id }, data: { sira: n } });
    return ok({ sira });
  } catch (e) { return hata(e); }
}
export async function DELETE(req: Request, { params }: Ctx) {
  try {
    const kayitId = (await params).id, fotoId = new URL(req.url).searchParams.get("fotoId");
    if (!fotoId) return ok({ hata: "DOGRULAMA", mesaj: "fotoId gerekli" }, 422);
    const foto = await prisma.kayitFoto.findFirst({ where: { id: fotoId, kayitId } });
    if (!foto) return ok({ hata: "BULUNAMADI" }, 404);
    await prisma.kayitFoto.delete({ where: { id: foto.id } });
    const kalan = await prisma.kayitFoto.findMany({ where: { kayitId }, orderBy: { sira: "asc" }, select: { id: true } });
    for (const [n, f] of kalan.entries()) await prisma.kayitFoto.update({ where: { id: f.id }, data: { sira: n } });
    if (foto.depoYolu) await dosyalariSil([foto.depoYolu]).catch((e) => console.error("Depodan silinemedi (kayıt silindi):", e));
    return ok({ silindi: true });
  } catch (e) { return depoHatasi(e); }
}