// Anahtar CRM v3.13 · 3 Ekim 2026
// GET /api/disa-aktar?tablo=talepler|portfoyler|kisiler|eslesmeler|notlar&bicim=csv   → Excel'de açılan CSV
// GET /api/disa-aktar?bicim=json                                                      → tam yedek (tüm tablolar, her alan)
// Arşiv, yedek ya da başka bir CRM'e taşıma için. Tam veritabanı yedeği için ayrıca: Supabase → Database → Backups / pg_dump.
import { prisma } from "@/lib/db";
import { hata } from "@/lib/http/yanit";
import { csvYaz, kayitSutunlari, kisiSutunlari, eslesmeSutunlari, notSutunlari } from "@/lib/disa-aktar";

const dosya = (ad: string, govde: string, tur: string) => new Response(govde, { headers: { "content-type": `${tur}; charset=utf-8`, "content-disposition": `attachment; filename="${ad}"` } });
export async function GET(req: Request) {
  try {
    const q = new URL(req.url).searchParams;
    const tarih = new Date().toISOString().slice(0, 10);
    if (q.get("bicim") === "json") {
      const [kayitlar, kisiler, eslesmeler, notlar, ayarlar] = await Promise.all([
        prisma.kayit.findMany({ include: { lokasyonlar: true, ozellik: true, kisiBaglari: true } }), prisma.kisi.findMany(),
        prisma.match.findMany(), prisma.kayitNot.findMany(), prisma.ayar.findMany(),
      ]);
      return dosya(`anahtar-crm-yedek-${tarih}.json`, JSON.stringify({ surum: "3.8", tarih, kayitlar, kisiler, eslesmeler, notlar, ayarlar }, null, 1), "application/json");
    }
    const tablo = q.get("tablo") ?? "talepler";
    const kisiler = await prisma.kisi.findMany();
    const kisiAdi = (id: string) => kisiler.find((k) => k.id === id)?.adSoyad ?? id;
    let csv: string;
    if (tablo === "talepler" || tablo === "portfoyler") {
      const k = await prisma.kayit.findMany({ where: { tip: tablo === "talepler" ? "TALEP" : "PORTFOY" }, include: { lokasyonlar: true, ozellik: true, kisiBaglari: true }, orderBy: { createdAt: "desc" } });
      csv = csvYaz(k.map((x) => ({ id: x.id, olusturma: x.createdAt, veri: { ...x, kisiler: x.kisiBaglari.map((b) => ({ kisiId: b.kisiId, rol: b.rol })) } })), kayitSutunlari(kisiAdi));
    } else if (tablo === "kisiler") csv = csvYaz(kisiler as any[], kisiSutunlari);
    else if (tablo === "eslesmeler") {
      const m = await prisma.match.findMany({ include: { talep: { select: { baslik: true } }, portfoy: { select: { baslik: true } } } });
      csv = csvYaz(m.map((x) => ({ talepId: x.talepId, talep: x.talep.baslik, portfoyId: x.portfoyId, portfoy: x.portfoy?.baslik, skor: x.finalSkor, durum: x.durum, neden: x.kopmaNedeni, not: x.operasyonNotu, tarih: x.updatedAt })), eslesmeSutunlari);
    } else if (tablo === "notlar") {
      const n = await prisma.kayitNot.findMany({ include: { kayit: { select: { baslik: true } }, kisi: { select: { adSoyad: true } } }, orderBy: { tarih: "desc" } });
      csv = csvYaz(n.map((x) => ({ kayitId: x.kayitId, kayit: x.kayit.baslik, tarih: x.tarih, tur: x.tur, kisi: x.kisi?.adSoyad, metin: x.metin })), notSutunlari);
    } else throw new Error("tablo: talepler | portfoyler | kisiler | eslesmeler | notlar");
    return dosya(`anahtar-crm-${tablo}-${tarih}.csv`, csv, "text/csv");
  } catch (e) { return hata(e); }
}