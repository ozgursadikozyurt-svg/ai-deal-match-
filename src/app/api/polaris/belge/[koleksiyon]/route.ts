// Anahtar CRM v3.43 · 25 Ekim 2026
// Polaris v7 · 21 Ekim 2026
// GET /api/polaris/belge/:koleksiyon[?bas=YYYY-MM-DD&bit=YYYY-MM-DD] → [{ id, veri }]
// bas/bit yalnızca belgenin "date" alanına göre süzer (days koleksiyonu). Yanıt Postgres'te JSON metni olarak
// kurulur ve olduğu gibi döner: Worker büyük kişi listesini çözümleyip yeniden yazmaz (işlemci sınırı).
import { prisma } from "@/lib/db";
import { hata } from "@/lib/http/yanit";
import { polarisKapi, adDenetle } from "@/lib/polaris";

const TARIH = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(req: Request, c: { params: Promise<Record<string, string>> }) {
  try {
    const b = polarisKapi();
    const kol = adDenetle((await c.params).koleksiyon, "koleksiyon");
    const q = new URL(req.url).searchParams;
    const bas = q.get("bas"), bit = q.get("bit");
    const p: unknown[] = [b.kullaniciId, kol];
    let sart = "";
    if (bas && TARIH.test(bas)) { p.push(bas); sart += ` and veri->>'date' >= $${p.length}`; }
    if (bit && TARIH.test(bit)) { p.push(bit); sart += ` and veri->>'date' <= $${p.length}`; }
    const r = await prisma.$queryRawUnsafe<{ j: string }[]>(
      `select coalesce(json_agg(json_build_object('id', belge_id, 'veri', veri) order by belge_id), '[]'::json)::text as j
         from polaris_belge where kullanici_id = $1 and koleksiyon = $2${sart}`,
      ...p,
    );
    return new Response(r[0]?.j ?? "[]", { headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
  } catch (e) { return hata(e); }
}
