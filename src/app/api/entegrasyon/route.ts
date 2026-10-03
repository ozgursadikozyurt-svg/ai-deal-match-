// Anahtar CRM v3.13 · 3 Ekim 2026
// GET /api/entegrasyon → Google Kişiler + Notion bağlantı durumu, ayarlar, son çalışmalar, açık çakışma sayısı (gizli anahtarlar dönmez)
import { prisma } from "@/lib/db";
import { hata, ok } from "@/lib/http/yanit";
import { entegrasyon, ayarlarOf } from "@/lib/services/senkron";

export async function GET() {
  try {
    const sonuc = [];
    for (const s of ["GOOGLE_KISILER", "NOTION"] as const) {
      const e = await entegrasyon(prisma, s);
      const [calismalar, cakisma] = await Promise.all([
        prisma.senkronCalisma.findMany({ where: { saglayici: s }, orderBy: { baslangic: "desc" }, take: 10 }),
        prisma.senkronCakisma.count({ where: { saglayici: s, durum: "ACIK" } }),
      ]);
      sonuc.push({ saglayici: s, durum: e.durum, hesap: e.hesap, sonSenkron: e.sonSenkron, sonHata: e.sonHata, ayarlar: ayarlarOf(e), calismalar, acikCakisma: cakisma,
        hazir: s === "NOTION" ? !!process.env.NOTION_TOKEN : !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.ENTEGRASYON_SIFRE_ANAHTARI) });
    }
    return ok(sonuc);
  } catch (e) { return hata(e); }
}