/**
 * Anahtar CRM v3.46 · 28 Ekim 2026
 * PLAN SINIRLARI — sunucuda uygulanır. Eskiden yalnızca Yönetim ekranında YAZIYORDU (yetki.ts › PLANLAR); sunucu denetlemiyordu:
 * ücretsiz ofis sınırsız yapay zekâ (platformun AI_API_KEY'i), fotoğraf ve Google eşitlemesi kullanabiliyordu.
 *  - Günlük yapay zekâ hakkı: ofis başına, İstanbul gününe göre sayılır (ayar "aiKullanim" = { gun, sayi }).
 *  - Fotoğraf: planın kayıt başına fotoğraf sayısı (ücretsizde 0 → kapalı).
 *  - Google / Notion bağlantısı: planda entegrasyon yoksa açılamaz.
 * Sınırsız ofis (Özyurtlar) ve platform bağlamı (zamanlayıcı) hiçbir sınıra takılmaz. Hata durumu 402 → arayüzde "PLAN".
 */
import type { PrismaClient } from "../../generated/prisma/client";
import { baglamOku } from "../kiracilik";
import { SINIRSIZ, type PlanSinirlari } from "../guvenlik/yetki";
import { etkinPlan } from "./ofis";
import { ayarOku, ayarYaz } from "./ayar";
import { FOTO_SINIR } from "../domain/foto";

export const AI_SAYAC = "aiKullanim";

export class PlanHatasi extends Error {
  durum = 402;
  constructor(mesaj: string) { super(mesaj); this.name = "PlanHatasi"; }
}

/** İstanbul takvim günü (YYYY-AA-GG) — gün sayacı gece yarısı TR saatiyle yenilenir */
export const trGunu = (t = new Date()) => new Date(t.getTime() + 3 * 3_600_000).toISOString().slice(0, 10);

export async function ofisSinirlari(prisma: PrismaClient): Promise<PlanSinirlari & { planKodu: string }> {
  const b = baglamOku();
  if (!b || b === "platform") return { ...SINIRSIZ, planKodu: "PLATFORM" };
  const o = await prisma.ofis.findFirst({ where: { id: b.ofisId }, select: { plan: true, denemeBitis: true, sinirsiz: true } });
  if (!o) return { ...etkinPlan({ plan: "UCRETSIZ", denemeBitis: null, sinirsiz: false }).sinirlar, planKodu: "UCRETSIZ" };
  const e = etkinPlan(o);
  return { ...e.sinirlar, planKodu: o.sinirsiz ? "SINIRSIZ" : e.kod };
}

/** Yapay zekâ çağrısından ÖNCE çağrılır: hak varsa sayacı bir artırır, yoksa PlanHatasi (402) fırlatır. */
export async function aiHakkiDus(prisma: PrismaClient, simdi = new Date()): Promise<{ kullanilan: number; sinir: number }> {
  const s = await ofisSinirlari(prisma);
  if (s.planKodu === "PLATFORM") return { kullanilan: 0, sinir: s.gunlukAi };
  const gun = trGunu(simdi);
  const eski = (await ayarOku(prisma, AI_SAYAC)) as { gun?: string; sayi?: number } | undefined;
  const sayi = eski?.gun === gun && typeof eski.sayi === "number" ? eski.sayi : 0;
  if (sayi >= s.gunlukAi) throw new PlanHatasi(`Bugünkü yapay zekâ hakkınız doldu (${s.etiket}: günde ${s.gunlukAi}). Yarın yenilenir; kural tabanlı okuma çalışmaya devam eder.`);
  await ayarYaz(prisma, AI_SAYAC, { gun, sayi: sayi + 1 });
  return { kullanilan: sayi + 1, sinir: s.gunlukAi };
}

/** Bu kayda bir fotoğraf daha eklenebilir mi? (planın kayıt başına sınırı; 0 = kapalı) */
export async function fotoPlanDenetle(prisma: PrismaClient, mevcutSayi: number): Promise<void> {
  const s = await ofisSinirlari(prisma);
  if (s.fotoBasinaKayit <= 0) throw new PlanHatasi(`Fotoğraf yükleme ${s.etiket} planda kapalı — Pro planda açılır.`);
  // Plan sınırı genel sınıra (FOTO_SINIR) eşit ya da büyükse adedi fotoDenetle söyler (aynı 422 mesajı korunur)
  if (s.fotoBasinaKayit < FOTO_SINIR && mevcutSayi >= s.fotoBasinaKayit) throw new PlanHatasi(`${s.etiket} planda bir portföye en fazla ${s.fotoBasinaKayit} fotoğraf eklenebilir.`);
}

/** Google / Notion bağlantısı planda var mı? */
export async function entegrasyonPlanDenetle(prisma: PrismaClient): Promise<void> {
  const s = await ofisSinirlari(prisma);
  if (!s.entegrasyon) throw new PlanHatasi(`Google Kişiler eşitlemesi ${s.etiket} planda kapalı — Pro planda açılır.`);
}
