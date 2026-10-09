/**
 * Anahtar CRM v3.22 · 9 Ekim 2026
 * Toplu içe aktarma (dosya / toplu mesaj) ve görüşme notları — sunucu servisi.
 * Önizleme saf fonksiyonlarla (src/lib/ingest/*) yapılır; burada yalnızca veritabanı işleri var:
 * aynı ilanı tanıma (ilan no / bağlantı), kişiyi telefonla ya da adla bulma, kayıtları tek tek oluşturma.
 */
import { z } from "zod";
import type { PrismaClient } from "../../generated/prisma/client";
import { KayitCreateSchema } from "../validation/kayit";
import { kayitOlustur, ttlAyarlari } from "./kayit";
import { kisiOlusturVeyaBul } from "./kisi";
import { lokasyonIndeksiYukle } from "../lokasyon/cozumle";
import { dosyaOku } from "../ingest/xlsx";
import { dosyaSatirlari, dosyaTuruTahmin, satirDonustur, satirHazirla, type AktarimSecenek, type DosyaTuru } from "../ingest/tablo";
import { anahtarKumesi, tekrarAnahtarlari, type TekrarVeri } from "../ingest/tekrar";

/** v3.8 — aynı tip/mülk/işlem kombinasyonundaki mevcut kayıtların tekrar anahtarları (talepler dahil) */
export async function mevcutAnahtarlar(prisma: PrismaClient, adaylar: { tip: string; mulkTipi: string; islemTipi: string; portalIlanNo?: string | null; portalUrl?: string | null }[]) {
  const kombi = [...new Map(adaylar.map((a) => [`${a.tip}|${a.mulkTipi}|${a.islemTipi}`, { tip: a.tip, mulkTipi: a.mulkTipi, islemTipi: a.islemTipi }])).values()];
  const ilanlar = adaylar.flatMap((a) => [a.portalIlanNo, a.portalUrl].filter(Boolean) as string[]);
  if (!kombi.length && !ilanlar.length) return new Set<string>();
  const kayitlar = await prisma.kayit.findMany({
    where: { OR: [...kombi.map((k) => ({ tip: k.tip as any, mulkTipi: k.mulkTipi as any, islemTipi: k.islemTipi as any })), ...(ilanlar.length ? [{ portalIlanNo: { in: ilanlar } }, { portalUrl: { in: ilanlar } }] : [])] },
    select: { tip: true, mulkTipi: true, islemTipi: true, odaSayisi: true, fiyat: true, minFiyat: true, maxFiyat: true, m2: true, minM2: true, maxM2: true, portalIlanNo: true, portalUrl: true, gondeTelefon: true, gondeAdi: true, hamMetin: true,
      lokasyonlar: { select: { ilceId: true, mahalleId: true, altBolgeId: true } }, kisiBaglari: { orderBy: { birincil: "desc" }, take: 1, select: { kisi: { select: { adSoyad: true } } } } },
  });
  return anahtarKumesi(kayitlar.map((k) => ({ veri: { ...k, fiyat: k.fiyat == null ? null : Number(k.fiyat), minFiyat: k.minFiyat == null ? null : Number(k.minFiyat), maxFiyat: k.maxFiyat == null ? null : Number(k.maxFiyat), m2: k.m2 == null ? null : Number(k.m2), minM2: k.minM2 == null ? null : Number(k.minM2), maxM2: k.maxM2 == null ? null : Number(k.maxM2) } as TekrarVeri, kisiAdi: k.kisiBaglari[0]?.kisi.adSoyad ?? k.gondeAdi })));
}

export const OnizleSecenek = z.object({
  dosyaTuru: z.enum(["PORTAL", "MESLEKTAS", "KENDI", "TALEP_LISTESI"]).optional(),
  varsayilanSahip: z.enum(["MALIK", "EMLAKCI", "PARTNER"]).default("EMLAKCI"),
  varsayilanIslem: z.enum(["SATILIK", "KIRALIK"]).default("SATILIK"),
  ilanGun: z.number().int().min(1).max(730).optional(),
  sayfalar: z.array(z.string()).optional(),
});

export async function dosyaOnizle(prisma: PrismaClient, ad: string, veri: Uint8Array, s: z.input<typeof OnizleSecenek>) {
  const o = OnizleSecenek.parse(s);
  const bloklar = dosyaSatirlari(dosyaOku(ad, veri), o.sayfalar);
  if (!bloklar.length) throw new Error("Başlık satırı bulunamadı");
  const tahmin = dosyaTuruTahmin(bloklar[0].eslesme);
  const dosyaTuru: DosyaTuru = o.dosyaTuru ?? tahmin.dosyaTuru;
  const ttl = await ttlAyarlari(prisma);
  const sec: AktarimSecenek = { tip: dosyaTuru === "TALEP_LISTESI" ? "TALEP" : "PORTFOY", dosyaTuru, varsayilanSahip: o.varsayilanSahip, varsayilanIslem: o.varsayilanIslem, ilanGun: o.ilanGun ?? ttl.DIS_ILAN ?? 90, bugun: new Date(), dosyaAdi: ad };
  const ix = await lokasyonIndeksiYukle(prisma);
  const satirlar = bloklar.flatMap((b) => b.satirlar.map((r) => ({ sayfa: b.sayfa, ...satirHazirla(satirDonustur(r.hucreler, b.eslesme, sec, r.no), ix) }))).filter((x) => x.durum !== "BOS");
  const varolan = await mevcutAnahtarlar(prisma, satirlar.filter((x) => x.veri).map((x) => x.veri!));
  const gorulen = new Set<string>();
  const tekrarMi = (x: (typeof satirlar)[number]) => { if (!x.veri) return false; const a = tekrarAnahtarlari(x.veri as any, x.kisi?.adSoyad ?? x.girdi.gondeAdi); const t = a.some((y) => varolan.has(y) || gorulen.has(y)); a.forEach((y) => gorulen.add(y)); return t; };
  return {
    dosyaTuru, tahmin, sayfalar: bloklar.map((b) => ({ ad: b.sayfa, baslikSatiri: b.eslesme.baslikSatiri, sutunlar: b.eslesme.sutunlar, basliklar: b.eslesme.basliklar })),
    satirlar: satirlar.map((x) => ({ sayfa: x.sayfa, satirNo: x.satirNo, durum: !x.veri ? "HATALI" : tekrarMi(x) ? "TEKRAR" : x.durum, veri: x.veri, kisi: x.kisi, sahipTuru: x.sahipTuru, kontrol: x.kontrol, hatalar: x.hatalar })),
  };
}

export const TopluEkleSchema = z.object({
  satirlar: z.array(z.object({
    veri: KayitCreateSchema,
    kisi: z.object({ adSoyad: z.string().min(2).max(120), telefon: z.string().nullish(), sirket: z.string().nullish(), roller: z.array(z.string()).default([]), rol: z.enum(["SAHIP", "MUSTERI", "EMLAKCI", "ARACI", "IRTIBAT", "DIGER"]) }).nullish(),
  })).min(1).max(2000),
});

/** Seçilen satırları ekler. Kişi: telefon varsa telefonla, yoksa aynı ad (+şirket) ile bulunur; yoksa açılır. */
export async function topluEkle(prisma: PrismaClient, g: z.output<typeof TopluEkleSchema>) {
  const sonuc = { eklenen: 0, tekrar: 0, yeniKisi: 0, hata: [] as { sira: number; mesaj: string }[] };
  const onbellek = new Map<string, string>();
  const varolan = await mevcutAnahtarlar(prisma, g.satirlar.map((s) => s.veri));
  for (const [sira, s] of g.satirlar.entries()) {
    try {
      const anah = tekrarAnahtarlari(s.veri as any, s.kisi?.adSoyad ?? s.veri.gondeAdi);
      if (anah.some((a) => varolan.has(a))) { sonuc.tekrar++; continue; }
      anah.forEach((a) => varolan.add(a));
      let kisiler = s.veri.kisiler;
      if (s.kisi) {
        const anahtar = `${s.kisi.telefon ?? ""}|${s.kisi.adSoyad.toLocaleLowerCase("tr")}|${s.kisi.sirket ?? ""}`;
        let id = onbellek.get(anahtar);
        if (!id) {
          const adla = !s.kisi.telefon ? await prisma.kisi.findFirst({ where: { adSoyad: { equals: s.kisi.adSoyad, mode: "insensitive" }, ...(s.kisi.sirket ? { OR: [{ sirket: s.kisi.sirket }, { sirket: null }] } : {}) } }) : null;
          if (adla) id = adla.id;
          else {
            const once = await prisma.kisi.count();
            id = (await kisiOlusturVeyaBul(prisma, { adSoyad: s.kisi.adSoyad, telefon: s.kisi.telefon, sirket: s.kisi.sirket, roller: s.kisi.roller as any, notlar: "Toplu içe aktarmadan" })).id;
            if ((await prisma.kisi.count()) > once) sonuc.yeniKisi++;
          }
          onbellek.set(anahtar, id);
        }
        kisiler = [...kisiler, { kisiId: id, rol: s.kisi.rol }].slice(0, 10) as typeof kisiler;
      }
      if (s.veri.portalIlanNo && (await prisma.kayit.findFirst({ where: { portalIlanNo: s.veri.portalIlanNo }, select: { id: true } }))) { sonuc.tekrar++; continue; }
      await kayitOlustur(prisma, { ...s.veri, kisiler });
      sonuc.eklenen++;
    } catch (e: any) {
      if (e?.code === "P2002") sonuc.tekrar++; else sonuc.hata.push({ sira, mesaj: String(e?.message ?? e).slice(0, 200) });
    }
  }
  return sonuc;
}

// ───────── Görüşme notları ─────────
export const NotSchema = z.object({ tur: z.enum(["GORUSME", "ARAMA", "WHATSAPP", "GOSTERIM", "NOT"]).default("NOT"), metin: z.string().trim().min(2).max(5000), kisiId: z.string().nullish(), tarih: z.coerce.date().optional() });
export async function notEkle(prisma: PrismaClient, kayitId: string, n: z.output<typeof NotSchema>) {
  const not = await prisma.kayitNot.create({ data: { kayitId, tur: n.tur, metin: n.metin, kisiId: n.kisiId ?? null, ...(n.tarih ? { tarih: n.tarih } : {}) } });
  if (n.kisiId && n.tur !== "NOT") await prisma.kisi.update({ where: { id: n.kisiId }, data: { sonIletisim: not.tarih } });
  return not;
}
export const notlar = (prisma: PrismaClient, kayitId: string) => prisma.kayitNot.findMany({ where: { kayitId }, orderBy: { tarih: "desc" }, include: { kisi: { select: { id: true, adSoyad: true } } } });