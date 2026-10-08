// Anahtar CRM v3.21.1 · 8 Ekim 2026 (v3.13'ten)
// GET /api/entegrasyon → bağlantı durumu, ayarlar, son çalışmalar, açık çakışma sayısı (gizli anahtarlar dönmez).
// v3.21: yalnızca Google Kişiler döner (Notion gizli — src/lib/ozellikler.ts). Ek alanlar: yetkili (bağlamaya yetkisi var mı),
// bagliKisi / bekleyen (Google'a gönderilecek) / haric (Anahtar'dan silindiği için geri gelmeyecek) sayıları.
import { prisma } from "@/lib/db";
import { hata, ok } from "@/lib/http/yanit";
import { ofisBaglami } from "@/lib/kiracilik";
import { yetkiVar } from "@/lib/guvenlik/yetki";
import { notionAcik } from "@/lib/ozellikler";
import { entegrasyon, ayarlarOf } from "@/lib/services/senkron";

export async function GET() {
  try {
    const yetkili = yetkiVar(ofisBaglami().rol, "ofis.entegrasyon");
    const sonuc = [];
    for (const s of (notionAcik() ? ["GOOGLE_KISILER", "NOTION"] : ["GOOGLE_KISILER"]) as ("GOOGLE_KISILER" | "NOTION")[]) {
      const e = await entegrasyon(prisma, s);
      const [calismalar, cakisma] = await Promise.all([
        prisma.senkronCalisma.findMany({ where: { saglayici: s }, orderBy: { baslangic: "desc" }, take: 10 }),
        prisma.senkronCakisma.count({ where: { saglayici: s, durum: "ACIK" } }),
      ]);
      const { baglayanKullaniciId: _b, ...ayarlar } = ayarlarOf(e);
      const ek = s === "GOOGLE_KISILER" ? {
        bagliKisi: await prisma.kisi.count({ where: { googleResourceName: { not: null } } }),
        bekleyen: await prisma.kisi.count({ where: { googleBekliyor: { not: null } } }),
        haric: await prisma.senkronHaric.count({ where: { saglayici: s } }),
        devamEdiyor: !!(e.imlec as any)?.sayfa,
      } : {};
      sonuc.push({ saglayici: s, durum: e.durum, hesap: e.hesap, sonSenkron: e.sonSenkron, sonHata: e.sonHata, ayarlar, calismalar, acikCakisma: cakisma, yetkili, ...ek,
        hazir: s === "NOTION" ? !!process.env.NOTION_TOKEN : !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) });
    }
    return ok(sonuc);
  } catch (e) { return hata(e); }
}
