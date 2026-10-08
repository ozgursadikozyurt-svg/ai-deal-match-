/**
 * Anahtar CRM v3.21.1 · 8 Ekim 2026
 * Tam yedek (JSON) — Ayarlar'daki indirme, /api/disa-aktar?bicim=json ve haftalık otomatik yedek aynı içeriği üretir.
 * Haftalık yedek Supabase Storage'daki özel "yedekler" kovasına yazılır (Supabase Free'de otomatik yedek olmadığı için);
 * son 12 yedek tutulur. SUPABASE_SERVICE_ROLE_KEY yoksa atlanır.
 */
import type { PrismaClient } from "../../generated/prisma/client";

export async function tamYedek(prisma: PrismaClient) {
  const [kayitlar, kisiler, eslesmeler, notlar, ayarlar] = await Promise.all([
    prisma.kayit.findMany({ include: { lokasyonlar: true, ozellik: true, kisiBaglari: true } }), prisma.kisi.findMany(),
    prisma.match.findMany(), prisma.kayitNot.findMany(), prisma.ayar.findMany(),
  ]);
  return { surum: "4.0", tarih: new Date().toISOString(), kayitlar, kisiler, eslesmeler, notlar, ayarlar };
}

export async function yedegiDepola(icerik: string, env: { SUPABASE_URL?: string; SUPABASE_SERVICE_ROLE_KEY?: string }, f: typeof fetch = fetch, sakla = 12) {
  const u = env.SUPABASE_URL?.replace(/\/$/, ""), k = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!u || !k) return { atlandi: "SUPABASE_SERVICE_ROLE_KEY yok" };
  const h = { authorization: `Bearer ${k}`, apikey: k };
  await f(`${u}/storage/v1/bucket`, { method: "POST", headers: { ...h, "content-type": "application/json" }, body: JSON.stringify({ id: "yedekler", name: "yedekler", public: false }) }).catch(() => {});
  const ad = `anahtarcrm-yedek-${new Date().toISOString().slice(0, 10)}.json`;
  const r = await f(`${u}/storage/v1/object/yedekler/${ad}`, { method: "POST", headers: { ...h, "content-type": "application/json", "x-upsert": "true" }, body: icerik });
  if (!r.ok) throw new Error(`Yedek yüklenemedi: ${r.status} ${await r.text()}`);
  const liste: { name: string }[] = await (await f(`${u}/storage/v1/object/list/yedekler`, { method: "POST", headers: { ...h, "content-type": "application/json" }, body: JSON.stringify({ prefix: "", limit: 100, sortBy: { column: "name", order: "desc" } }) })).json().catch(() => []);
  const eski = (Array.isArray(liste) ? liste : []).map((x) => x.name).filter((n) => n.startsWith("anahtarcrm-yedek-")).sort().reverse().slice(sakla);
  if (eski.length) await f(`${u}/storage/v1/object/yedekler`, { method: "DELETE", headers: { ...h, "content-type": "application/json" }, body: JSON.stringify({ prefixes: eski }) });
  return { ad, silinen: eski.length };
}