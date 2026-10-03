/**
 * Anahtar CRM v3.13 · 3 Ekim 2026
 * Seed: Türkiye il/ilçe/mahalle + Antalya piyasa katmanı.
 * Çalıştır:  npx prisma db seed           (tüm Türkiye, ~73 bin yerleşim, ~1 dk)
 *            LOKASYON_KAPSAM=07 npx prisma db seed   (sadece Antalya — geliştirme için hızlı)
 * İdempotent: tekrar çalıştırılabilir (skipDuplicates / upsert).
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../src/generated/prisma/client";
import { lokasyonAnahtari, slug } from "../../src/lib/lokasyon/normalize";
import { TURKIYE_ALT_BOLGELER } from "./turkiye-alt-bolgeler";
import { ANTALYA_IL_ID, ANTALYA_ALT_BOLGELER, ANTALYA_KOMSU_ILCELER, ANTALYA_ALIASLAR } from "./antalya";

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL!, max: Number(process.env.PG_POOL_MAX ?? 5) }) });
const DATA = path.join(__dirname, "data");
const oku = <T>(f: string): T => JSON.parse(fs.readFileSync(path.join(DATA, f), "utf8"));

type IlRow = { id: number; plaka: string; ad: string; slug: string };
type IlceRow = { id: number; ilId: number; ad: string; slug: string };
type MahRow = [ilceId: number, ad: string, tip: "MAHALLE" | "KOY" | "KOY_MAHALLESI" | "BELDE_MAHALLESI", bagli: string | null, posta: string, slug: string];

async function lokasyonlar() {
  const kapsam = process.env.LOKASYON_KAPSAM; // "07" veya boş (tümü)
  const iller = oku<IlRow[]>("iller.json").filter((i) => !kapsam || i.plaka === kapsam);
  const ilIdler = new Set(iller.map((i) => i.id));
  const ilceler = oku<IlceRow[]>("ilceler.json").filter((i) => ilIdler.has(i.ilId));
  const ilceIdler = new Set(ilceler.map((i) => i.id));
  const mahalleler = oku<MahRow[]>("mahalleler.json").filter((m) => ilceIdler.has(m[0]));

  await prisma.il.createMany({ data: iller, skipDuplicates: true });
  await prisma.ilce.createMany({ data: ilceler, skipDuplicates: true });
  const PARCA = 5000;
  for (let i = 0; i < mahalleler.length; i += PARCA) {
    await prisma.mahalle.createMany({
      data: mahalleler.slice(i, i + PARCA).map(([ilceId, ad, tip, bagliOlduguYer, postaKodu, slug]) => ({ ilceId, ad, tip, bagliOlduguYer, postaKodu, slug })),
      skipDuplicates: true,
    });
  }
  console.log(`✔ il=${iller.length} ilçe=${ilceler.length} mahalle/köy=${mahalleler.length}`);
  return ilIdler.has(ANTALYA_IL_ID);
}

async function antalya() {
  const ilceler = await prisma.ilce.findMany({ where: { ilId: ANTALYA_IL_ID } });
  const ilceId = (ad: string) => {
    const x = ilceler.find((i) => i.ad === ad);
    if (!x) throw new Error(`Antalya ilçesi bulunamadı: ${ad}`);
    return x.id;
  };
  const mahalleId = async (ilce: string, slug: string) =>
    (await prisma.mahalle.findUnique({ where: { ilceId_slug: { ilceId: ilceId(ilce), slug } } }))?.id;

  // Komşuluk (çift yönlü)
  const komsu = ANTALYA_KOMSU_ILCELER.flatMap(([a, b]) => [
    { ilceId: ilceId(a), komsuIlceId: ilceId(b) },
    { ilceId: ilceId(b), komsuIlceId: ilceId(a) },
  ]);
  await prisma.ilceKomsuluk.createMany({ data: komsu, skipDuplicates: true });

  // Alt bölgeler
  for (const b of ANTALYA_ALT_BOLGELER) {
    const ab = await prisma.altBolge.upsert({
      where: { ilId_slug: { ilId: ANTALYA_IL_ID, slug: b.slug } },
      update: {},
      create: { ilId: ANTALYA_IL_ID, ilceId: b.ilce ? ilceId(b.ilce) : null, ad: b.ad, slug: b.slug, tip: b.tip, dogrulandi: b.dogrulandi, aciklama: b.aciklama },
    });
    for (const [ilce, slug] of b.mahalleler) {
      const mid = await mahalleId(ilce, slug);
      if (!mid) { console.warn(`  ⚠ ${b.ad}: mahalle yok → ${ilce}/${slug}`); continue; }
      await prisma.altBolgeMahalle.upsert({
        where: { altBolgeId_mahalleId: { altBolgeId: ab.id, mahalleId: mid } },
        update: {},
        create: { altBolgeId: ab.id, mahalleId: mid },
      });
    }
  }

  // Aliaslar
  let n = 0;
  for (const a of ANTALYA_ALIASLAR) {
    const alias = lokasyonAnahtari(a.alias);
    const base = { alias, seviye: a.seviye, ilId: ANTALYA_IL_ID, kaynak: "notion" as const };
    let data: Parameters<typeof prisma.lokasyonAlias.create>[0]["data"];
    if (a.seviye === "ILCE") data = { ...base, ilceId: ilceId(a.ilce) };
    else if (a.seviye === "MAHALLE") {
      const mid = await mahalleId(a.ilce, a.mahalle);
      if (!mid) { console.warn(`  ⚠ alias mahalle yok: ${a.alias}`); continue; }
      data = { ...base, ilceId: ilceId(a.ilce), mahalleId: mid, ...(a.tip ? { tip: a.tip, aciklama: a.aciklama ?? null, kaynak: "kullanici" } : {}) };
    } else {
      const ab = await prisma.altBolge.findUnique({ where: { ilId_slug: { ilId: ANTALYA_IL_ID, slug: a.altBolge } } });
      if (!ab) continue;
      data = { ...base, altBolgeId: ab.id, ilceId: ab.ilceId };
    }
    await prisma.lokasyonAlias.upsert({
      where: { alias_seviye_ilId: { alias, seviye: a.seviye, ilId: ANTALYA_IL_ID } },
      update: {},
      create: data,
    });
    n++;
  }
  console.log(`✔ Antalya: ${ANTALYA_ALT_BOLGELER.length} alt bölge, ${komsu.length / 2} komşuluk, ${n} alias`);
}

/** v3.10 — diğer büyük şehirlerin başlangıç semt listesi (ilçe düzeyi, doğrulanmamış). Aynı adlı mahalle varsa atlanır. */
async function turkiyeAltBolgeleri() {
  let n = 0;
  for (const [ilAd, ilceAd, ad, tip] of TURKIYE_ALT_BOLGELER) {
    const il = await prisma.il.findFirst({ where: { ad: ilAd } });
    if (!il) continue; // LOKASYON_KAPSAM ile daraltılmış kurulum
    const ilce = ilceAd ? await prisma.ilce.findFirst({ where: { ilId: il.id, ad: ilceAd } }) : null;
    if (ilceAd && !ilce) { console.warn(`  ⚠ ilçe yok: ${ilAd}/${ilceAd}`); continue; }
    const s = slug(ad);
    if (ilce && (await prisma.mahalle.findUnique({ where: { ilceId_slug: { ilceId: ilce.id, slug: s } } }))) continue;
    await prisma.altBolge.upsert({ where: { ilId_slug: { ilId: il.id, slug: s } }, update: {}, create: { ilId: il.id, ilceId: ilce?.id ?? null, ad, slug: s, tip, dogrulandi: false, aciklama: "Başlangıç listesi (v3.10) — ilçe düzeyinde" } });
    n++;
  }
  console.log(`✔ Türkiye geneli: ${n} başlangıç alt bölgesi`);
}

(async () => {
  const antalyaVar = await lokasyonlar();
  if (antalyaVar) await antalya();
  await turkiyeAltBolgeleri();
})()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());