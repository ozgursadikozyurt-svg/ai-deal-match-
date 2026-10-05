/**
 * Anahtar CRM v3.14 · 3 Ekim 2026
 * AŞAMA 7 — Canlı sürümün veri köprüsü. Arayüz (demo ile aynı ekranlar) tüm durumu tek seferde okur
 * (`durumGetir`), değişiklikleri parça parça yazar (`degisiklikUygula`). Veritabanı ilişkisel kalır:
 * Notion/Google senkronu, toplu giriş, dışa aktarma ve eşleştirme servisleri aynı tablolarla çalışmaya devam eder.
 */
import { z } from "zod";
import type { PrismaClient } from "../../generated/prisma/client";
import { KayitTemel, MulkOzellikObje, KayitCreateSchema } from "../validation/kayit";
import { fingerprint, ttlAyarlari } from "./kayit";
import { varsayilanValidUntil as vu, TtlAyarSchema } from "../domain/gecerlilik";
import { AiAyarSchema, PaylasimAyarSchema, aiAyarNormalize, paylasimNormalize, calismaIliNormalize } from "../domain/ayarlar";
import { RolTanimSchema, rolNormalize, ROL_SINIRI } from "../domain/roller";

const KAYIT_ALANLARI = [...new Set([...Object.keys(KayitTemel.shape), "anaKategori"])].filter((k) => !["lokasyonlar", "kisiler", "ozellik", "kisiId"].includes(k)); // kisiId: kayıtta kisiler[0]'dan türetilir; arayüzdeki kişi kimlikleri cuid değildir
const OZELLIK_ALANLARI = Object.keys((MulkOzellikObje as any).shape ?? (MulkOzellikObje as any)._def?.schema?.shape ?? {});
const sade = (v: unknown): unknown => (v == null ? null : v instanceof Date ? v.toISOString() : typeof v === "object" && v && "toNumber" in (v as any) ? Number(v) : v);
const ARAYUZ = "arayuz";
const AYAR_ANAHTARLARI = ["ttl", "ai", "paylasim", "calismaIli", "roller", ARAYUZ];

// ───────── Okuma ─────────
export async function durumGetir(prisma: PrismaClient) {
  const [kayitlar, kisiler, eslesmeler, ayarlar] = await Promise.all([
    prisma.kayit.findMany({ include: { lokasyonlar: { orderBy: { sira: "asc" } }, ozellik: true, kisiBaglari: { orderBy: { birincil: "desc" } }, gorusmeNotlari: { orderBy: { tarih: "desc" } }, fotolar: { orderBy: { sira: "asc" } } }, orderBy: { createdAt: "desc" } }),
    prisma.kisi.findMany({ orderBy: { adSoyad: "asc" } }),
    prisma.match.findMany({ where: { OR: [{ durum: { not: "BEKLIYOR" } }, { operasyonNotu: { not: null } }], portfoyId: { not: null } } }),
    prisma.ayar.findMany({ where: { anahtar: { in: AYAR_ANAHTARLARI } } }),
  ]);
  return {
    kayitlar: kayitlar.map((k) => {
      const veri: Record<string, unknown> = Object.fromEntries(KAYIT_ALANLARI.map((a) => [a, sade((k as any)[a])]));
      veri.lokasyonlar = k.lokasyonlar.map((l) => ({ ilId: l.ilId, ilceId: l.ilceId, mahalleId: l.mahalleId, altBolgeId: l.altBolgeId, birincil: l.birincil }));
      veri.kisiler = k.kisiBaglari.map((b) => ({ kisiId: b.kisiId, rol: b.rol }));
      if (k.ozellik) veri.ozellik = Object.fromEntries(OZELLIK_ALANLARI.map((a) => [a, sade((k.ozellik as any)[a])]).filter(([, v]) => v != null && !(Array.isArray(v) && !v.length)));
      return { id: k.id, olusturma: k.createdAt.toISOString(), veri, notionId: k.notionId, fotolar: k.fotolar.map((f) => ({ id: f.id, ad: f.ad, en: f.en, boy: f.boy, boyut: f.boyut })), notlar: k.gorusmeNotlari.map((n) => ({ id: n.id, tarih: n.tarih.toISOString(), tur: n.tur, metin: n.metin, kisiId: n.kisiId })) };
    }),
    kisiler: kisiler.map((k) => ({ id: k.id, adSoyad: k.adSoyad, telefon: k.telefon, ikincilTelefon: k.ikincilTelefon, email: k.email, sirket: k.sirket, roller: k.roller, uzmanlikAileleri: k.uzmanlikAileleri, referans: k.referans, notlar: k.notlar, whatsappGruplari: k.whatsappGruplari, olusturma: k.createdAt.toISOString(), sonIletisim: k.sonIletisim?.toISOString() ?? null, kaynak: k.kaynak === "CSV" ? "MANUEL" : k.kaynak, ilanSahibiTipi: k.ilanSahibiTipi, googleResourceName: k.googleResourceName, kaynaktaSilindi: k.kaynaktaSilindi?.toISOString() ?? null })),
    eslesmeNotlari: Object.fromEntries(eslesmeler.map((m) => [`${m.talepId}~${m.portfoyId}`, { durum: m.durum === "BEKLIYOR" ? "YENI" : m.durum, not: m.operasyonNotu ?? "", ...(m.kopmaNedeni ? { neden: m.kopmaNedeni } : {}), ...(m.koparilma ? { tarih: m.koparilma.toISOString() } : {}) }])),
    ayarlar: { ttl: TtlAyarSchema.parse({ ...((ayarlar.find((a) => a.anahtar === "ttl")?.deger as object) ?? {}) }), ai: aiAyarNormalize(ayarlar.find((a) => a.anahtar === "ai")?.deger), paylasim: paylasimNormalize(ayarlar.find((a) => a.anahtar === "paylasim")?.deger), calismaIli: calismaIliNormalize(ayarlar.find((a) => a.anahtar === "calismaIli")?.deger), roller: rolNormalize(ayarlar.find((a) => a.anahtar === "roller")?.deger) },
    arayuz: (ayarlar.find((a) => a.anahtar === ARAYUZ)?.deger ?? {}) as Record<string, unknown>,
  };
}

// ───────── Yazma ─────────
const NotZ = z.object({ id: z.string(), tarih: z.string(), tur: z.enum(["GORUSME", "ARAMA", "WHATSAPP", "GOSTERIM", "NOT"]), metin: z.string().min(1).max(5000), kisiId: z.string().nullish() });
const KayitZ = z.object({ id: z.string().min(1).max(64), olusturma: z.string().optional(), veri: z.record(z.unknown()), notlar: z.array(NotZ).optional() });
const KisiZ = z.object({
  id: z.string().min(1).max(64), adSoyad: z.string().min(1).max(160), telefon: z.string().nullish(), ikincilTelefon: z.string().nullish(), email: z.string().nullish(), sirket: z.string().nullish(),
  roller: z.array(z.string()).default([]), uzmanlikAileleri: z.array(z.string()).default([]), referans: z.string().nullish(), notlar: z.string().nullish(), whatsappGruplari: z.array(z.string()).default([]),
  olusturma: z.string().optional(), sonIletisim: z.string().nullish(), kaynak: z.string().optional(), ilanSahibiTipi: z.string().optional(),
});
const EsNotZ = z.object({ durum: z.string(), not: z.string().default(""), neden: z.string().optional(), tarih: z.string().optional() }).nullable();
export const DegisiklikSchema = z.object({
  kayitlar: z.array(KayitZ).max(5000).default([]), kayitSil: z.array(z.string()).max(5000).default([]),
  kisiler: z.array(KisiZ).max(5000).default([]), kisiSil: z.array(z.string()).max(5000).default([]),
  eslesmeNotlari: z.record(EsNotZ).default({}),
  ayarlar: z.object({ ttl: z.record(z.number()).optional(), ai: AiAyarSchema.optional(), paylasim: PaylasimAyarSchema.optional(), calismaIli: z.number().int().optional(), roller: z.array(RolTanimSchema).max(ROL_SINIRI).optional() }).optional(),
  arayuz: z.record(z.unknown()).optional(),
});
export type Degisiklik = z.output<typeof DegisiklikSchema>;

export async function degisiklikUygula(prisma: PrismaClient, g: Degisiklik) {
  const hatalar: { id: string; mesaj: string }[] = [];
  const ttl = await ttlAyarlari(prisma);
  // 1) Kişiler önce (kayıtlar kişilere bağlanır)
  for (const k of g.kisiler) {
    const veri = { adSoyad: k.adSoyad, telefon: k.telefon || null, ikincilTelefon: k.ikincilTelefon || null, email: k.email || null, sirket: k.sirket || null, roller: k.roller as any, uzmanlikAileleri: k.uzmanlikAileleri, referans: k.referans ?? null, notlar: k.notlar ?? null, whatsappGruplari: k.whatsappGruplari, sonIletisim: k.sonIletisim ? new Date(k.sonIletisim) : null, ...(k.ilanSahibiTipi ? { ilanSahibiTipi: k.ilanSahibiTipi as any } : {}) };
    try { await prisma.kisi.upsert({ where: { id: k.id }, update: veri, create: { id: k.id, ...veri, kaynak: (["WHATSAPP", "GOOGLE", "NOTION", "MANUEL"].includes(k.kaynak ?? "") ? k.kaynak : "MANUEL") as any, ...(k.olusturma ? { createdAt: new Date(k.olusturma) } : {}) } }); }
    catch (e: any) { hatalar.push({ id: k.id, mesaj: e?.code === "P2002" ? "Bu telefon numarası başka bir kişide kayıtlı" : String(e?.message ?? e).slice(0, 200) }); }
  }
  // 2) Kayıtlar: alt tablolar (konum, özellik, kişi bağları, notlar) silinip yeniden yazılır
  for (const k of g.kayitlar) {
    const p = KayitCreateSchema.safeParse(k.veri);
    if (!p.success) { hatalar.push({ id: k.id, mesaj: p.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ").slice(0, 300) }); continue; }
    const { lokasyonlar, ozellik, validUntil, kisiler, ...alanlar } = p.data;
    const veri = { ...alanlar, validUntil: validUntil ?? vu(p.data.tip, p.data.islemTipi, p.data.aciliyet, new Date(), ttl), kisiId: kisiler[0]?.kisiId ?? null };
    try {
      await prisma.$transaction(async (tx) => {
        const var_ = await tx.kayit.findUnique({ where: { id: k.id }, select: { id: true } });
        if (var_) {
          await tx.kayitLokasyon.deleteMany({ where: { kayitId: k.id } });
          await tx.kayitKisi.deleteMany({ where: { kayitId: k.id } });
          await tx.mulkOzellik.deleteMany({ where: { kayitId: k.id } });
          await tx.kayit.update({ where: { id: k.id }, data: veri as any });
        } else {
          let fp = fingerprint(p.data);
          if (await tx.kayit.findUnique({ where: { fingerprint: fp }, select: { id: true } })) fp = fp.slice(0, 24) + k.id.slice(0, 16);
          await tx.kayit.create({ data: { id: k.id, ...(veri as any), fingerprint: fp, ...(k.olusturma ? { createdAt: new Date(k.olusturma) } : {}) } });
        }
        if (lokasyonlar.length) await tx.kayitLokasyon.createMany({ data: lokasyonlar.map((l, sira) => ({ ...l, sira, kayitId: k.id })) });
        if (kisiler.length) await tx.kayitKisi.createMany({ data: kisiler.map((b, i) => ({ kisiId: b.kisiId, rol: b.rol as any, birincil: i === 0, kayitId: k.id })) });
        if (ozellik) await tx.mulkOzellik.create({ data: { ...(Object.fromEntries(Object.entries(ozellik).filter(([, v]) => v !== undefined)) as any), kayitId: k.id } });
        if (k.notlar) {
          await tx.kayitNot.deleteMany({ where: { kayitId: k.id } });
          if (k.notlar.length) await tx.kayitNot.createMany({ data: k.notlar.map((n) => ({ id: n.id, kayitId: k.id, tur: n.tur, metin: n.metin, kisiId: n.kisiId ?? null, tarih: new Date(n.tarih) })) });
        }
      });
    } catch (e: any) { hatalar.push({ id: k.id, mesaj: String(e?.message ?? e).slice(0, 300) }); }
  }
  // 3) Silmeler
  if (g.kayitSil.length) await prisma.kayit.deleteMany({ where: { id: { in: g.kayitSil } } });
  if (g.kisiSil.length) {
    await prisma.kayit.updateMany({ where: { kisiId: { in: g.kisiSil } }, data: { kisiId: null } });
    await prisma.kayitKisi.deleteMany({ where: { kisiId: { in: g.kisiSil } } });
    await prisma.kisi.deleteMany({ where: { id: { in: g.kisiSil } } });
  }
  // 4) Eşleşme takibi (not, aşama, koparma)
  for (const [anahtar, n] of Object.entries(g.eslesmeNotlari)) {
    const [talepId, portfoyId] = anahtar.split("~");
    if (!talepId || !portfoyId) continue;
    const veri = n
      ? { durum: (n.durum === "YENI" ? "BEKLIYOR" : n.durum) as any, operasyonNotu: n.not || null, notGuncellendi: new Date(), kopmaNedeni: n.durum === "REDDEDILDI" ? n.neden ?? "DIGER" : null, koparilma: n.durum === "REDDEDILDI" ? (n.tarih ? new Date(n.tarih) : new Date()) : null }
      : { durum: "BEKLIYOR" as any, operasyonNotu: null, kopmaNedeni: null, koparilma: null };
    try { await prisma.match.upsert({ where: { talepId_portfoyId: { talepId, portfoyId } }, update: veri, create: { talepId, portfoyId, matematikSkor: 0, finalSkor: 0, ...veri } }); }
    catch (e: any) { hatalar.push({ id: anahtar, mesaj: String(e?.message ?? e).slice(0, 200) }); }
  }
  // 5) Ayarlar ve arayüz durumu (öğrenilen konumlar, test işaretleri, içe aktarma geçmişi…)
  if (g.ayarlar) {
    const yaz = (anahtar: string, deger: unknown) => prisma.ayar.upsert({ where: { anahtar }, update: { deger: deger as any }, create: { anahtar, deger: deger as any } });
    if (g.ayarlar.ttl) await yaz("ttl", TtlAyarSchema.parse(g.ayarlar.ttl));
    if (g.ayarlar.ai) await yaz("ai", g.ayarlar.ai);
    if (g.ayarlar.paylasim) await yaz("paylasim", g.ayarlar.paylasim);
    if (g.ayarlar.calismaIli != null) await yaz("calismaIli", g.ayarlar.calismaIli);
    if (g.ayarlar.roller) await yaz("roller", rolNormalize(g.ayarlar.roller)); // v3.15: özel roller + yeniden adlandırmalar
  }
  if (g.arayuz) await prisma.ayar.upsert({ where: { anahtar: ARAYUZ }, update: { deger: g.arayuz as any }, create: { anahtar: ARAYUZ, deger: g.arayuz as any } });
  return { tamam: hatalar.length === 0, hatalar };
}