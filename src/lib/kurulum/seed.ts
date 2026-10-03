/**
 * Anahtar CRM v3.14 · 3 Ekim 2026
 * Konum verisi kurulumu (il / ilçe / mahalle + Antalya alt bölge, komşuluk, alias) — hem komut satırı seed'i
 * (prisma/seed/index.ts) hem canlıdaki "Kurulumu tamamla" ucu (/api/kurulum) bu fonksiyonları kullanır.
 * İdempotent: tekrar çalıştırılabilir.
 */
import type { PrismaClient } from "../../generated/prisma/client";
import { lokasyonAnahtari } from "../lokasyon/normalize";
import { ANTALYA_IL_ID, ANTALYA_ALT_BOLGELER, ANTALYA_KOMSU_ILCELER, ANTALYA_ALIASLAR } from "../../../prisma/seed/antalya";

export type IlRow = { id: number; plaka: string; ad: string; slug: string };
export type IlceRow = { id: number; ilId: number; ad: string; slug: string };
export type MahRow = [ilceId: number, ad: string, tip: "MAHALLE" | "KOY" | "KOY_MAHALLESI" | "BELDE_MAHALLESI", bagli: string | null, posta: string, slug: string];

/**
 * `kimlikli: true` (canlı kurulum): mahalle ve alt bölge kimlikleri arayüzdeki konum dizini ile birebir aynı verilir
 * (mahalle = dosya sırası + 1, alt bölge = liste sırası + 1). Arayüz konumu bu kimliklerle kaydeder; bu yüzden
 * canlı veritabanı yalnızca bu kurulumla (Antalya) hazırlanmalıdır.
 */
export async function lokasyonSeed(prisma: PrismaClient, v: LokasyonVerisi, log: (m: string) => void = console.log, kimlikli = false) {
  const { iller, ilceler, mahalleler } = v;
  const ilIdler = new Set(iller.map((i) => i.id));

  await prisma.il.createMany({ data: iller, skipDuplicates: true });
  await prisma.ilce.createMany({ data: ilceler, skipDuplicates: true });
  const PARCA = 250; // v4.0: küçük parçalar — Workers soket bağlantısında büyük tek paket yerine
  for (let i = 0; i < mahalleler.length; i += PARCA) {
    await prisma.mahalle.createMany({
      data: mahalleler.slice(i, i + PARCA).map(([ilceId, ad, tip, bagliOlduguYer, postaKodu, slug], j) => ({ ...(kimlikli ? { id: i + j + 1 } : {}), ilceId, ad, tip, bagliOlduguYer, postaKodu, slug })),
      skipDuplicates: true,
    });
  }
  log(`✔ il=${iller.length} ilçe=${ilceler.length} mahalle/köy=${mahalleler.length}`);
  return ilIdler.has(ANTALYA_IL_ID);
}

export async function antalyaSeed(prisma: PrismaClient, log: (m: string) => void = console.log, kimlikli = false) {
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
  for (const [sira, b] of ANTALYA_ALT_BOLGELER.entries()) {
    const ab = await prisma.altBolge.upsert({
      where: { ilId_slug: { ilId: ANTALYA_IL_ID, slug: b.slug } },
      update: {},
      create: { ...(kimlikli ? { id: sira + 1 } : {}), ilId: ANTALYA_IL_ID, ilceId: b.ilce ? ilceId(b.ilce) : null, ad: b.ad, slug: b.slug, tip: b.tip, dogrulandi: b.dogrulandi, aciklama: b.aciklama },
    });
    for (const [ilce, slug] of b.mahalleler) {
      const mid = await mahalleId(ilce, slug);
      if (!mid) { log(`  ⚠ ${b.ad}: mahalle yok → ${ilce}/${slug}`); continue; }
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
      if (!mid) { log(`  ⚠ alias mahalle yok: ${a.alias}`); continue; }
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
  log(`✔ Antalya: ${ANTALYA_ALT_BOLGELER.length} alt bölge, ${komsu.length / 2} komşuluk, ${n} alias`);
}


export interface LokasyonVerisi { iller: IlRow[]; ilceler: IlceRow[]; mahalleler: MahRow[] }
export { ANTALYA_IL_ID };

/** Elle kimlik verildikten sonra sayaçları ileri al (sonraki eklemeler çakışmasın) */
export async function sayaclariDuzelt(prisma: PrismaClient) {
  for (const t of ["mahalle", "alt_bolge"]) await prisma.$executeRawUnsafe(`SELECT setval(pg_get_serial_sequence('"${t}"', 'id'), GREATEST((SELECT COALESCE(MAX(id), 0) FROM "${t}"), 1))`);
}
/** Canlı veritabanındaki konum kimlikleri arayüzün dizini ile aynı mı? (ilk ve son mahalle adıyla kontrol) */
export async function kimlikUyumu(prisma: PrismaClient, v: LokasyonVerisi) {
  const ilk = await prisma.mahalle.findUnique({ where: { id: 1 }, select: { slug: true, ilceId: true } });
  const son = await prisma.mahalle.findUnique({ where: { id: v.mahalleler.length }, select: { slug: true, ilceId: true } });
  const a = v.mahalleler[0], b = v.mahalleler[v.mahalleler.length - 1];
  return !!ilk && !!son && ilk.slug === a[5] && ilk.ilceId === a[0] && son.slug === b[5] && son.ilceId === b[0];
}