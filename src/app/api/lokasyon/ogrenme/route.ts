// Anahtar CRM v3.21.2 · 8 Ekim 2026
// Konum öğrenme (bkz. src/lib/lokasyon/ogrenme.ts)
// GET  /api/lokasyon/ogrenme?durum=BEKLIYOR   → adaylar + en olası konum önerisi (güçlü/zayıf)
// POST /api/lokasyon/ogrenme { ifade, hedef: { ilceId, mahalleId?, altBolgeId? }, tip? }  → onayla: sözlüğe (alias) ekle
// POST /api/lokasyon/ogrenme { ifade, reddet: true }  → bir daha önerme
import { z } from "zod";
import { prisma } from "@/lib/db";
import { hata, ok, sorgu } from "@/lib/http/yanit";
import { adayOnerisi, aliasTipiTahmin, type KonumAdayi } from "@/lib/lokasyon/ogrenme";
import { lokasyonIndeksiniYenile } from "@/lib/lokasyon/cozumle";

export async function GET(req: Request) {
  try {
    const { durum = "BEKLIYOR", ilId = "7" } = sorgu(req);
    const adaylar = await prisma.lokasyonAday.findMany({ where: { ilId: Number(ilId), durum: durum as never }, orderBy: [{ gorulme: "desc" }], take: 200 });
    return ok(adaylar.map((a) => ({ ...a, oneri: adayOnerisi({ ...a, gorunen: a.ifade, birlikteGecis: a.birlikteGecis as KonumAdayi["birlikteGecis"], durum: a.durum, sonGorulme: a.sonGorulme.toISOString(), ornekMetin: a.ornekMetin ?? undefined }) })));
  } catch (e) { return hata(e); }
}

const Govde = z.union([
  z.object({ ifade: z.string().min(2).max(80), ilId: z.number().int().default(7), reddet: z.literal(true) }),
  z.object({
    ifade: z.string().min(2).max(80), ilId: z.number().int().default(7),
    hedef: z.object({ ilceId: z.number().int().positive(), mahalleId: z.number().int().positive().nullish(), altBolgeId: z.number().int().positive().nullish() }),
    tip: z.enum(["YAZIM", "REFERANS_NOKTA", "SEMT"]).optional(), aciklama: z.string().max(120).nullish(),
  }),
]);

export async function POST(req: Request) {
  try {
    const g = Govde.parse(await req.json());
    if ("reddet" in g) {
      // v3.20: benzersiz anahtar artık [ofisId, ilId, ifade] — ofisId süzgeci kiracilik katmanından gelir
      await prisma.lokasyonAday.updateMany({ where: { ilId: g.ilId, ifade: g.ifade }, data: { durum: "REDDEDILDI" } });
      return ok({ reddedildi: g.ifade });
    }
    const seviye = g.hedef.mahalleId ? "MAHALLE" : g.hedef.altBolgeId ? "ALTBOLGE" : "ILCE";
    const tip = g.tip ?? aliasTipiTahmin(g.ifade);
    const alias = await prisma.lokasyonAlias.upsert({
      where: { alias_seviye_ilId: { alias: g.ifade, seviye, ilId: g.ilId } },
      update: { ilceId: g.hedef.ilceId, mahalleId: g.hedef.mahalleId ?? null, altBolgeId: g.hedef.altBolgeId ?? null, tip, aciklama: g.aciklama ?? null, onaylandi: true },
      create: { alias: g.ifade, seviye, ilId: g.ilId, ilceId: g.hedef.ilceId, mahalleId: g.hedef.mahalleId ?? null, altBolgeId: g.hedef.altBolgeId ?? null, tip, aciklama: g.aciklama ?? null, kaynak: "ogrenme" },
    });
    await prisma.lokasyonAday.updateMany({ where: { ilId: g.ilId, ifade: g.ifade }, data: { durum: "ONAYLANDI" } });
    lokasyonIndeksiniYenile(g.ilId);
    return ok(alias, 201);
  } catch (e) { return hata(e); }
}