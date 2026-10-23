/**
 * Anahtar CRM v3.42 · 23 Ekim 2026
 * KAMPANYA — reklam kampanyaları ve elle girilen aylık harcama.
 *
 * Basit bağ: bir kayıt kampanyaya `kayit.ilkKaynakDetay` = kampanya adı ile bağlanır. Bu yüzden ad oluşturulduktan sonra
 * değişmez; kampanya bitince silinmez, "kapatılır" (aktif = false) ve forma seçenek olarak gelmez ama geçmiş raporda kalır.
 * Bütçe ve harcamayı yalnızca "kampanya.yonet" yetkisi (ofis yöneticisi) görür; diğer roller yalnızca açık kampanya adlarını.
 */
import { z } from "zod";
import type { PrismaClient } from "../../generated/prisma/client";
import { ofisBaglami } from "../kiracilik";
import { yetkiGerek, yetkiVar } from "../guvenlik/yetki";

import { KAMPANYA_KANALLARI } from "./kampanya-ortak";
export { KAMPANYA_KANALLARI, KANAL_ETIKETI, kayitBasinaMaliyet } from "./kampanya-ortak";
import { kayitBasinaMaliyet } from "./kampanya-ortak";

const tutar = z.number().finite().min(0).max(100_000_000);
export const KampanyaOlusturSchema = z.object({
  kanal: z.enum(KAMPANYA_KANALLARI),
  ad: z.string().trim().min(2).max(120),
  butce: tutar.nullish(),
  baslangic: z.coerce.date().nullish(),
  bitis: z.coerce.date().nullish(),
  aciklama: z.string().trim().max(500).nullish(),
});
export const KampanyaGuncelleSchema = z.object({
  kanal: z.enum(KAMPANYA_KANALLARI).optional(),
  butce: tutar.nullable().optional(),
  baslangic: z.coerce.date().nullable().optional(),
  bitis: z.coerce.date().nullable().optional(),
  aktif: z.boolean().optional(),
  aciklama: z.string().trim().max(500).nullable().optional(),
});
export const HarcamaSchema = z.object({
  ay: z.string().regex(/^20\d\d-(0[1-9]|1[0-2])$/, "Ay AAAA-AA biçiminde olmalı (ör. 2026-10)"),
  /** 0 ya da boş = o ayın harcama satırını sil */
  tutar: tutar.nullable(),
});

const sayi = (d: unknown) => (d == null ? null : Number(d));
const istek400 = (m: string) => Object.assign(new Error(m), { durum: 400 });

export async function kampanyaListesi(prisma: PrismaClient) {
  const b = ofisBaglami();
  const yonetir = yetkiVar(b.rol, "kampanya.yonet");
  const satirlar = await prisma.kampanya.findMany({ where: yonetir ? {} : { aktif: true }, orderBy: [{ aktif: "desc" }, { createdAt: "desc" }], include: { harcamalar: { orderBy: { ay: "desc" } } } });
  if (!yonetir) return satirlar.map((k) => ({ id: k.id, kanal: k.kanal, ad: k.ad }));
  const sayim = await prisma.kayit.groupBy({ by: ["ilkKaynakDetay"], where: { ilkKaynakDetay: { in: satirlar.map((k) => k.ad) } }, _count: { _all: true } });
  const adet = new Map(sayim.map((x) => [x.ilkKaynakDetay, x._count._all]));
  return satirlar.map((k) => {
    const toplam = k.harcamalar.reduce((t, h) => t + Number(h.tutar), 0);
    const kayitSayisi = adet.get(k.ad) ?? 0;
    return {
      id: k.id, kanal: k.kanal, ad: k.ad, butce: sayi(k.butce), baslangic: k.baslangic, bitis: k.bitis, aktif: k.aktif, aciklama: k.aciklama,
      kayitSayisi, toplamHarcama: toplam, kayitBasinaMaliyet: kayitBasinaMaliyet(toplam, kayitSayisi),
      harcamalar: k.harcamalar.map((h) => ({ ay: h.ay, tutar: Number(h.tutar) })),
    };
  });
}

export async function kampanyaOlustur(prisma: PrismaClient, girdi: unknown) {
  yetkiGerek(ofisBaglami().rol, "kampanya.yonet");
  const v = KampanyaOlusturSchema.parse(girdi);
  if (v.baslangic && v.bitis && v.bitis < v.baslangic) throw istek400("Bitiş tarihi başlangıçtan önce olamaz");
  if (await prisma.kampanya.findFirst({ where: { ad: v.ad }, select: { id: true } })) throw istek400("Bu adla bir kampanya zaten var");
  return prisma.kampanya.create({ data: { kanal: v.kanal, ad: v.ad, butce: v.butce ?? null, baslangic: v.baslangic ?? null, bitis: v.bitis ?? null, aciklama: v.aciklama ?? null } as any, select: { id: true } });
}

export async function kampanyaGuncelle(prisma: PrismaClient, id: string, girdi: unknown) {
  yetkiGerek(ofisBaglami().rol, "kampanya.yonet");
  const v = KampanyaGuncelleSchema.parse(girdi);
  const mevcut = await prisma.kampanya.findFirst({ where: { id }, select: { id: true, baslangic: true, bitis: true } });
  if (!mevcut) throw Object.assign(new Error("Kampanya bulunamadı"), { code: "P2025" });
  const bas = v.baslangic === undefined ? mevcut.baslangic : v.baslangic, bit = v.bitis === undefined ? mevcut.bitis : v.bitis;
  if (bas && bit && bit < bas) throw istek400("Bitiş tarihi başlangıçtan önce olamaz");
  await prisma.kampanya.update({ where: { id }, data: v as any });
  return { id };
}

export async function harcamaYaz(prisma: PrismaClient, kampanyaId: string, girdi: unknown) {
  yetkiGerek(ofisBaglami().rol, "kampanya.yonet");
  const v = HarcamaSchema.parse(girdi);
  if (!(await prisma.kampanya.findFirst({ where: { id: kampanyaId }, select: { id: true } }))) throw Object.assign(new Error("Kampanya bulunamadı"), { code: "P2025" });
  const var_ = await prisma.kampanyaHarcama.findFirst({ where: { kampanyaId, ay: v.ay }, select: { id: true } });
  if (!v.tutar) { if (var_) await prisma.kampanyaHarcama.delete({ where: { id: var_.id } }); return { ay: v.ay, tutar: 0 }; }
  if (var_) await prisma.kampanyaHarcama.update({ where: { id: var_.id }, data: { tutar: v.tutar } });
  else await prisma.kampanyaHarcama.create({ data: { kampanyaId, ay: v.ay, tutar: v.tutar } as any });
  return { ay: v.ay, tutar: v.tutar };
}
