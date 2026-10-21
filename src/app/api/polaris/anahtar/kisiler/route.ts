// Polaris v7 · 21 Ekim 2026
// GET /api/polaris/anahtar/kisiler?son=<kisi id> → en çok 1000 kişi (id sırasıyla, son'dan sonrası)
// Polaris'in "Anahtar CRM ile eşitle" düğmesi bunu sayfa sayfa okur. Salt okunur; ofis süzgeci kiracılık katmanından gelir.
// Alan adları Polaris'in eski (Supabase execute_sql) sorgusuyla aynıdır: a t t2 e s r ky n rf uz wg sl sd ua tp pf gn.
import { prisma } from "@/lib/db";
import { hata, ok } from "@/lib/http/yanit";
import { polarisKapi } from "@/lib/polaris";

export async function GET(req: Request) {
  try {
    polarisKapi();
    const son = new URL(req.url).searchParams.get("son") ?? "";
    const kisiler = await prisma.kisi.findMany({
      where: son ? { id: { gt: son } } : {},
      orderBy: { id: "asc" },
      take: 1000,
      select: {
        id: true, adSoyad: true, telefon: true, ikincilTelefon: true, email: true, sirket: true, roller: true, kaynak: true,
        notlar: true, referans: true, uzmanlikAileleri: true, whatsappGruplari: true, sonIletisim: true, kaynaktaSilindi: true, updatedAt: true,
        // kayıt bağları ebeveyn (kişi) üzerinden okunur: kayit_kisi doğrudan sorgulanmaz (kiracılık süzgeci)
        kayitlar: { select: { id: true, tip: true } },
        kayitBaglari: { select: { kayit: { select: { id: true, tip: true } } } },
      },
    });
    const ids = kisiler.map((k) => k.id);
    const notlar = ids.length ? await prisma.kayitNot.groupBy({ by: ["kisiId"], where: { kisiId: { in: ids } }, _max: { tarih: true } }) : [];
    const say = new Map<string, { t: Set<string>; p: Set<string> }>();
    for (const k of kisiler) {
      const s = { t: new Set<string>(), p: new Set<string>() };
      for (const y of [...k.kayitlar, ...k.kayitBaglari.map((b) => b.kayit)]) {
        if (!y) continue;
        if (String(y.tip) === "TALEP") s.t.add(y.id); else if (String(y.tip) === "PORTFOY") s.p.add(y.id);
      }
      say.set(k.id, s);
    }
    const gn = new Map(notlar.map((n) => [n.kisiId, n._max.tarih]));
    const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);
    return ok(kisiler.map((k) => ({
      id: k.id, a: k.adSoyad, t: k.telefon, t2: k.ikincilTelefon, e: k.email, s: k.sirket, r: k.roller, ky: k.kaynak,
      n: k.notlar ? k.notlar.slice(0, 300) : null, rf: k.referans, uz: k.uzmanlikAileleri, wg: k.whatsappGruplari,
      sl: iso(k.sonIletisim), sd: iso(k.kaynaktaSilindi), ua: iso(k.updatedAt),
      tp: say.get(k.id)?.t.size ?? 0, pf: say.get(k.id)?.p.size ?? 0, gn: iso(gn.get(k.id) ?? null),
    })));
  } catch (e) { return hata(e); }
}
