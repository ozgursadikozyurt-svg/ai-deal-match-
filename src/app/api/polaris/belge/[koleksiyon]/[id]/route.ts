// Anahtar CRM v3.42 · 23 Ekim 2026
// Polaris v7 · 21 Ekim 2026
// GET    /api/polaris/belge/:koleksiyon/:id → { var: true, veri } | { var: false }
// PUT    /api/polaris/belge/:koleksiyon/:id  (gövde: belgenin JSON'u) → { ok: true }
// DELETE /api/polaris/belge/:koleksiyon/:id → { ok: true }
// Gövde çözümlenmeden Postgres'e jsonb olarak verilir; geçersiz JSON'u veritabanı reddeder.
import { prisma } from "@/lib/db";
import { hata, ok } from "@/lib/http/yanit";
import { polarisKapi, adDenetle, PolarisHatasi, BELGE_SINIRI } from "@/lib/polaris";

const yol = async (c: { params: Promise<Record<string, string>> }) => {
  const p = await c.params;
  return { kol: adDenetle(p.koleksiyon, "koleksiyon"), id: adDenetle(p.id, "belge") };
};

export async function GET(_req: Request, c: { params: Promise<Record<string, string>> }) {
  try {
    const b = polarisKapi();
    const { kol, id } = await yol(c);
    const r = await prisma.$queryRawUnsafe<{ j: string }[]>(
      `select veri::text as j from polaris_belge where kullanici_id = $1 and koleksiyon = $2 and belge_id = $3`,
      b.kullaniciId, kol, id,
    );
    const govde = r.length ? `{"var":true,"veri":${r[0].j}}` : `{"var":false}`;
    return new Response(govde, { headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
  } catch (e) { return hata(e); }
}

export async function PUT(req: Request, c: { params: Promise<Record<string, string>> }) {
  try {
    const b = polarisKapi();
    const { kol, id } = await yol(c);
    const metin = await req.text();
    if (!metin || metin.length > BELGE_SINIRI) throw new PolarisHatasi(413, "Belge boş ya da çok büyük");
    const t = metin.trimStart()[0];
    if (t !== "{") throw new PolarisHatasi(400, "Belge bir JSON nesnesi olmalı");
    await prisma.$executeRawUnsafe(
      `insert into polaris_belge (kullanici_id, koleksiyon, belge_id, veri, guncellendi) values ($1, $2, $3, $4::jsonb, now())
       on conflict (kullanici_id, koleksiyon, belge_id) do update set veri = excluded.veri, guncellendi = now()`,
      b.kullaniciId, kol, id, metin,
    );
    return ok({ ok: true });
  } catch (e) { return hata(e); }
}

export async function DELETE(_req: Request, c: { params: Promise<Record<string, string>> }) {
  try {
    const b = polarisKapi();
    const { kol, id } = await yol(c);
    await prisma.$executeRawUnsafe(`delete from polaris_belge where kullanici_id = $1 and koleksiyon = $2 and belge_id = $3`, b.kullaniciId, kol, id);
    return ok({ ok: true });
  } catch (e) { return hata(e); }
}
