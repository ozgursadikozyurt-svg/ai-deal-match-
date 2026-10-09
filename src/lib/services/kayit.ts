/**
 * Anahtar CRM v3.22.1 · 9 Ekim 2026
 * Kayıt servis katmanı — API route'ları, WhatsApp ingest ve Notion import aynı fonksiyonları kullanır.
 */
import { createHash } from "node:crypto";
import type { Prisma, PrismaClient } from "../../generated/prisma/client";
import type { KayitCreateData, KayitListeFiltre, MulkOzellikData } from "../validation/kayit";
import { KayitUpdateSchema } from "../validation/kayit";
import { z } from "zod";

/** TTL (gün): kurallar src/lib/domain/gecerlilik.ts'te; ekrandan değiştirilen değerler `ayar` tablosunda ("ttl"). */
export { TTL_VARSAYILAN, TtlAyarSchema, varsayilanValidUntil, type TtlAyar } from "../domain/gecerlilik";
import { ttlNormalize, varsayilanValidUntil as vu, type TtlAyar as TA } from "../domain/gecerlilik";
export async function ttlAyarlari(prisma: PrismaClient): Promise<TA> {
  const a = await prisma.ayar.findFirst({ where: { anahtar: "ttl" } });
  return ttlNormalize(a?.deger);
}

/** Süreyi uzat: bugünden (süresi dolmuşsa) veya mevcut bitişten itibaren N gün; EXPIRED ise tekrar ACTIVE yapar */
export async function sureUzat(prisma: PrismaClient, id: string, gun: number) {
  const k = await prisma.kayit.findUniqueOrThrow({ where: { id } });
  const taban = Math.max(Date.now(), k.validUntil.getTime());
  return prisma.kayit.update({ where: { id }, data: { validUntil: new Date(taban + gun * 86_400_000), ttlUyariGonderildi: false, ...(k.durum === "EXPIRED" ? { durum: "ACTIVE" } : {}) } });
}

/** Duplicate önleme: ham metin varsa ona, yoksa yapısal alanlara göre */
export function fingerprint(k: KayitCreateData): string {
  const norm = (s?: string | null) => (s ?? "").toLocaleLowerCase("tr").replace(/\s+/g, " ").trim();
  const temel = k.hamMetin
    ? norm(k.hamMetin)
    : [k.tip, k.mulkTipi, k.islemTipi, k.fiyat ?? k.maxFiyat, k.m2 ?? k.minM2, k.gondeTelefon, k.lokasyonlar[0]?.mahalleId ?? k.lokasyonlar[0]?.ilceId, norm(k.baslik)].join("|");
  return createHash("sha256").update(temel).digest("hex").slice(0, 40);
}

/** Zod çıktısı → Prisma nested create (undefined/null temizliği) */
function ozellikData(o: Partial<MulkOzellikData>): Prisma.MulkOzellikCreateWithoutKayitInput {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Prisma.MulkOzellikCreateWithoutKayitInput;
}

export async function kayitOlustur(prisma: PrismaClient, k: KayitCreateData) {
  const { lokasyonlar, ozellik, validUntil, kisiler, ...alanlar } = k;
  return prisma.kayit.create({
    data: {
      ...alanlar,
      validUntil: validUntil ?? vu(k.tip, k.islemTipi, k.aciliyet, new Date(), await ttlAyarlari(prisma)),
      fingerprint: fingerprint(k),
      lokasyonlar: { create: lokasyonlar.map((l, sira) => ({ ...l, sira })) },
      ...(kisiler.length ? { kisiId: alanlar.kisiId ?? kisiler[0].kisiId, kisiBaglari: { create: kisiler.map((b, i) => ({ kisiId: b.kisiId, rol: b.rol, birincil: i === 0 })) } } : {}),
      ...(ozellik ? { ozellik: { create: ozellikData(ozellik) } } : {}),
    },
    include: { ozellik: true, lokasyonlar: true },
  });
}

/** Liste filtresi → Prisma where. Teknik filtreler MulkOzellik ilişkisi üzerinden. */
export function listeWhere(f: KayitListeFiltre): Prisma.KayitWhereInput {
  const oz: Prisma.MulkOzellikWhereInput = {};
  if (f.minKapaliAlan != null) oz.kapaliAlanM2 = { gte: f.minKapaliAlan };
  if (f.minAcikAlan != null) oz.acikAlanM2 = { gte: f.minAcikAlan };
  if (f.minYukseklik != null) oz.OR = [{ netYukseklikM: { gte: f.minYukseklik } }, { makasAltiYukseklikM: { gte: f.minYukseklik } }];
  if (f.minElektrikKw != null) oz.elektrikGucuKw = { gte: f.minElektrikKw };
  if (f.minKapiYukseklik != null) oz.kapiYukseklikM = { gte: f.minKapiYukseklik };
  if (f.aracErisimi) {
    const sira = ["YOK", "BINEK", "PANELVAN", "KAMYONET", "KAMYON", "TIR"] as const;
    oz.aracErisimi = { in: sira.slice(sira.indexOf(f.aracErisimi)) as unknown as (typeof sira)[number][] };
  }
  for (const b of ["rampa", "vinc", "trafo", "sanayiElektrigi", "yanginSistemi", "sprinkler", "iskan", "sogukHava", "gidayaUygun", "vitrin", "anaCaddeUzeri"] as const)
    if (f[b] != null) (oz as Record<string, unknown>)[b] = f[b];
  if (f.ruhsatDurumu?.length) oz.ruhsatDurumu = { in: f.ruhsatDurumu };
  if (f.kullanimAmaci?.length) oz.kullanimAmaclari = { hasSome: f.kullanimAmaci };

  const lok: Prisma.KayitLokasyonWhereInput[] = [];
  if (f.ilceId?.length) lok.push({ ilceId: { in: f.ilceId } });
  if (f.mahalleId?.length) lok.push({ mahalleId: { in: f.mahalleId } });
  if (f.altBolgeId?.length) lok.push({ altBolgeId: { in: f.altBolgeId } }, { mahalle: { altBolgeler: { some: { altBolgeId: { in: f.altBolgeId } } } } });

  const fiyatAlani = f.tip === "TALEP" ? "maxFiyat" : "fiyat";
  const m2Alani = f.tip === "TALEP" ? "minM2" : "m2";
  const aralik = (min?: number, max?: number) => ({ ...(min != null && { gte: min }), ...(max != null && { lte: max }) });

  const and: Prisma.KayitWhereInput[] = [];
  if (f.tip) and.push({ tip: f.tip });
  and.push(f.durum?.length ? { durum: { in: f.durum } } : { durum: "ACTIVE" });
  if (f.anaKategori?.length) and.push({ anaKategori: { in: f.anaKategori } });
  if (f.mulkTipi?.length) and.push({ OR: [{ mulkTipi: { in: f.mulkTipi } }, { alternatifMulkTipleri: { hasSome: f.mulkTipi } }] });
  if (f.islemTipi?.length) and.push({ islemTipi: { in: f.islemTipi } });
  if (f.ilanSahibiTipi?.length) and.push({ ilanSahibiTipi: { in: f.ilanSahibiTipi } });
  if (f.veriKanali?.length) and.push({ veriKanali: { in: f.veriKanali } });
  if (f.minFiyat != null || f.maxFiyat != null) and.push({ [fiyatAlani]: aralik(f.minFiyat, f.maxFiyat) });
  if (f.minM2 != null || f.maxM2 != null) and.push({ [m2Alani]: aralik(f.minM2, f.maxM2) });
  if (f.ilId) and.push({ lokasyonlar: { some: { ilId: f.ilId } } });
  if (lok.length) and.push({ lokasyonlar: { some: { haric: false, OR: lok } } }); // v3.22: hariç tutulan bölge aranan bölge sayılmaz
  if (Object.keys(oz).length) and.push({ ozellik: { is: oz } });
  if (f.q)
    and.push({ OR: (["baslik", "ozet", "hamMetin", "gondeAdi"] as const).map((k) => ({ [k]: { contains: f.q, mode: "insensitive" as const } })) });
  return { AND: and };
}

export async function kayitListele(prisma: PrismaClient, f: KayitListeFiltre) {
  const where = listeWhere(f);
  const [toplam, kayitlar] = await prisma.$transaction([
    prisma.kayit.count({ where }),
    prisma.kayit.findMany({
      where,
      include: {
        ozellik: true,
        lokasyonlar: { include: { ilce: { select: { ad: true } }, mahalle: { select: { ad: true } }, altBolge: { select: { ad: true } } }, orderBy: { sira: "asc" } },
      },
      orderBy: { [f.sirala]: f.yon },
      skip: (f.sayfa - 1) * f.sayfaBoyutu,
      take: f.sayfaBoyutu,
    }),
  ]);
  return { toplam, sayfa: f.sayfa, sayfaBoyutu: f.sayfaBoyutu, kayitlar };
}

/** PATCH + AuditLog (PRD: tüm değişiklikler audit_log'da) */
export async function kayitGuncelle(prisma: PrismaClient, id: string, veri: z.output<typeof KayitUpdateSchema>, kaynak = "kullanici") {
  return prisma.$transaction(async (tx) => {
    const eski = await tx.kayit.findUniqueOrThrow({ where: { id }, include: { ozellik: true } });
    const { ozellik, lokasyonlar, ...alanlar } = veri;
    const loglar: Prisma.AuditLogCreateManyInput[] = [];
    for (const [k, v] of Object.entries(alanlar))
      if (v !== undefined && JSON.stringify((eski as Record<string, unknown>)[k]) !== JSON.stringify(v))
        loglar.push({ kayitId: id, alan: k, eskiDeger: (eski as Record<string, unknown>)[k] as Prisma.InputJsonValue, yeniDeger: v as Prisma.InputJsonValue, kaynak });
    if (ozellik)
      for (const [k, v] of Object.entries(ozellik))
        if (v !== undefined && JSON.stringify((eski.ozellik as Record<string, unknown> | null)?.[k] ?? null) !== JSON.stringify(v))
          loglar.push({ kayitId: id, alan: `ozellik.${k}`, eskiDeger: ((eski.ozellik as Record<string, unknown> | null)?.[k] ?? null) as Prisma.InputJsonValue, yeniDeger: v as Prisma.InputJsonValue, kaynak });

    const guncel = await tx.kayit.update({
      where: { id },
      data: {
        ...alanlar,
        ...(ozellik && { ozellik: { upsert: { create: ozellikData(ozellik), update: ozellikData(ozellik) } } }),
        ...(lokasyonlar && { lokasyonlar: { deleteMany: {}, create: lokasyonlar.map((l, sira) => ({ ...l, sira })) } }),
      },
      include: { ozellik: true, lokasyonlar: true },
    });
    if (loglar.length) await tx.auditLog.createMany({ data: loglar });
    return { kayit: guncel, degisenAlanSayisi: loglar.length };
  });
}