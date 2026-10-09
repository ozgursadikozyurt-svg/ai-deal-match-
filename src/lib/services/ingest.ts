/**
 * Anahtar CRM v3.22.1 · 9 Ekim 2026
 * İçe aktarmada tekrar harcamayı önleme: daha önce yapay zekâya gönderilmiş mesajlar ve aynı dosyalar.
 */
import type { PrismaClient } from "../../generated/prisma/client";
import { metinParmakIzi, type WaMesaj } from "../ingest/whatsapp";

/** Veritabanındaki işlenmiş mesaj parmak izlerinden verilen listede olanlar */
export async function oncedenIslenmisler(prisma: PrismaClient, metinler: string[]): Promise<Set<string>> {
  const izler = [...new Set(metinler.map(metinParmakIzi))];
  const out = new Set<string>();
  for (let i = 0; i < izler.length; i += 1000) {
    const r = await prisma.islenmisMesaj.findMany({ where: { parmakIzi: { in: izler.slice(i, i + 1000) } }, select: { parmakIzi: true } });
    r.forEach((x) => out.add(x.parmakIzi));
  }
  return out;
}

/** Yapay zekâya gönderilen mesajları işaretle (kayıt çıksın çıkmasın) */
export async function islenmisKaydet(prisma: PrismaClient, mesajlar: Pick<WaMesaj, "metin" | "grup" | "tarih">[], ingestionId: string, kayitSayisi: Record<string, number> = {}) {
  await prisma.islenmisMesaj.createMany({
    data: mesajlar.map((m) => { const pi = metinParmakIzi(m.metin); return { parmakIzi: pi, grup: m.grup, mesajTarihi: m.tarih ? new Date(m.tarih) : null, ingestionId, kayitSayisi: kayitSayisi[pi] ?? 0 }; }),
    skipDuplicates: true,
  });
}

/** Aynı dosya daha önce yüklendi mi? */
export async function oncekiDosya(prisma: PrismaClient, parmakIzi: string) {
  return prisma.ingestionLog.findFirst({ where: { dosyaParmakIzleri: { has: parmakIzi } }, orderBy: { createdAt: "desc" }, select: { id: true, createdAt: true, dosyaAdi: true } });
}