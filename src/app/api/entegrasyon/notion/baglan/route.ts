// Anahtar CRM v3.13 · 3 Ekim 2026
// POST /api/entegrasyon/notion/baglan → NOTION_TOKEN ile üç tabloyu doğrular; tamamsa bağlar ve ilk içe aktarmayı başlatır.
// Yanıt: alan eşleme raporu (eşleşen / bilerek okunmayan / tanınmayan alanlar)
import { prisma } from "@/lib/db";
import { hata, ok } from "@/lib/http/yanit";
import { entegrasyon, notionBaglantiRaporu, notionSenkronCalistir } from "@/lib/services/senkron";

export async function POST() {
  try {
    const token = process.env.NOTION_TOKEN;
    if (!token) return Response.json({ hata: "AYAR_EKSIK", mesaj: "NOTION_TOKEN tanımlı değil (ALTYAPI §26.3)" }, { status: 503 });
    const rapor = await notionBaglantiRaporu(token);
    await entegrasyon(prisma, "NOTION");
    await prisma.entegrasyon.updateMany({ where: { saglayici: "NOTION" }, data: { durum: rapor.tamam ? "BAGLI" : "HATA", hesap: "Gayrimenkul CRM", sonHata: rapor.tamam ? null : "Bazı tablolara erişilemedi" } });
    const ilk = rapor.tamam ? await notionSenkronCalistir(prisma, { tetik: "ilk", tam: true }).catch((x) => ({ hata: String(x?.message ?? x) })) : null;
    return ok({ rapor, ilk });
  } catch (e) { return hata(e); }
}