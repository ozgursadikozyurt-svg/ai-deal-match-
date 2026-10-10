// Anahtar CRM v3.22.2 · 10 Ekim 2026 (v3.13'ten)
// PUT /api/entegrasyon/ayarlar { saglayici, ayarlar: { otomatik, aralikDk, geriYaz, googleYaz, sadeceEtiketler } }
// v3.21: yalnızca ofis yöneticisi; googleYaz = "çift yönlü" anahtarı. İç alanlar (bağlayan kullanıcı, yazma izni) buradan değiştirilemez.
import { z } from "zod";
import { prisma } from "@/lib/db";
import { hata, ok } from "@/lib/http/yanit";
import { ofisBaglami } from "@/lib/kiracilik";
import { yetkiGerek } from "@/lib/guvenlik/yetki";
import { entegrasyon, ayarlarOf } from "@/lib/services/senkron";

const Govde = z.object({
  saglayici: z.enum(["GOOGLE_KISILER", "NOTION"]),
  ayarlar: z.object({ otomatik: z.boolean(), aralikDk: z.number().int().min(5).max(1440), geriYaz: z.boolean(), googleYaz: z.boolean(), sadeceEtiketler: z.array(z.string().max(80)).max(20) }).partial(),
});
export async function PUT(req: Request) {
  try {
    yetkiGerek(ofisBaglami().rol, "ofis.entegrasyon");
    const g = Govde.parse(await req.json());
    const e = await entegrasyon(prisma, g.saglayici);
    const onceki = ayarlarOf(e);
    const yeni = { ...onceki, ...g.ayarlar };
    // Etiket süzgeci değiştiyse Google baştan değerlendirilir (artımlı anahtar eski süzgece göreydi)
    const sifirla = g.saglayici === "GOOGLE_KISILER" && g.ayarlar.sadeceEtiketler && JSON.stringify(g.ayarlar.sadeceEtiketler) !== JSON.stringify(onceki.sadeceEtiketler);
    await prisma.entegrasyon.updateMany({ where: { saglayici: g.saglayici }, data: { ayarlar: yeni as any, ...(sifirla ? { syncToken: null, imlec: null as any } : {}) } });
    const { baglayanKullaniciId: _b, ...gorunen } = yeni;
    return ok(gorunen);
  } catch (e) { return hata(e); }
}
