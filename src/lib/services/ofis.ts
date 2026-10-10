/**
 * Anahtar CRM v3.23 · 10 Ekim 2026
 * OFİS, KULLANICI VE DAVET işlemleri.
 *
 * Hesap açma davetle olur: yönetici bir bağlantı üretir, bağlantıdaki gizli kodun yalnızca
 * SHA-256 özeti veritabanında durur (bağlantı sızsa bile veritabanından kod geri üretilemez).
 * Denetleme döneminde kimin kullandığını platform yöneticisi seçer; dönem bitince aynı akış
 * "kendi kendine kayıt" olarak açılabilir (yeniden yazmak gerekmez).
 */
import { z } from "zod";
import type { PrismaClient } from "../../generated/prisma/client";
import { ofisBaglami, platformOlarak, type Rol } from "../kiracilik";
import { PLANLAR, planSinirlari, yetkiGerek } from "../guvenlik/yetki";

export const DAVET_GUN = 14;

const ROL = z.enum(["PLATFORM_YONETICISI", "OFIS_YONETICISI", "DANISMAN"]);

export const OfisSchema = z.object({
  ad: z.string().min(2).max(120),
  telefon: z.string().max(32).optional(),
  sehir: z.string().max(60).optional(),
  plan: z.enum(["UCRETSIZ", "PRO", "PRO_PLUS"]).default("UCRETSIZ"),
  denemeGun: z.number().int().min(0).max(365).optional(),
});

export const DavetSchema = z.object({
  eposta: z.string().email().optional(),
  rol: ROL.default("DANISMAN"),
  gun: z.number().int().min(1).max(90).default(DAVET_GUN),
});

const TR_HARF: Record<string, string> = {
  "ı": "i", "İ": "i", "ş": "s", "Ş": "s", "ğ": "g", "Ğ": "g",
  "ü": "u", "Ü": "u", "ö": "o", "Ö": "o", "ç": "c", "Ç": "c", "â": "a", "î": "i", "û": "u",
};
/// Ofis adı → adres parçası. Türkçe harfler küçültmeden ÖNCE çevrilir:
/// "İ".toLowerCase() JavaScript'te "i" değil "i̇" (i + birleşen nokta) verir.
export const slugla = (ad: string) =>
  [...ad]
    .map((h) => TR_HARF[h] ?? h)
    .join("")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60) || "ofis";

// ---------------------------------------------------------------------------
//  Davet kodu
// ---------------------------------------------------------------------------

/** Tahmin edilemez 32 karakterlik kod (bağlantıda görünen tek yer) */
export function davetKoduUret(): string {
  const b = new Uint8Array(24);
  crypto.getRandomValues(b);
  return [...b].map((x) => "abcdefghijkmnpqrstuvwxyz23456789"[x % 32]).join("");
}

export async function kodOzeti(kod: string): Promise<string> {
  const ozet = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(kod));
  return [...new Uint8Array(ozet)].map((x) => x.toString(16).padStart(2, "0")).join("");
}

// ---------------------------------------------------------------------------
//  Ofis (platform yöneticisi)
// ---------------------------------------------------------------------------

export async function ofisAc(prisma: PrismaClient, girdi: z.input<typeof OfisSchema>) {
  const b = ofisBaglami();
  yetkiGerek(b.rol, "platform.ofisler");
  const g = OfisSchema.parse(girdi);
  return platformOlarak(async () => {
    let slug = slugla(g.ad);
    for (let i = 2; await prisma.ofis.findFirst({ where: { slug }, select: { id: true } }); i++) slug = `${slugla(g.ad)}-${i}`;
    return prisma.ofis.create({
      data: {
        ad: g.ad,
        slug,
        telefon: g.telefon ?? null,
        sehir: g.sehir ?? null,
        plan: g.plan,
        denemeBitis: g.denemeGun ? new Date(Date.now() + g.denemeGun * 864e5) : null,
      },
    });
  });
}

/** Platform panosu: ofisler + kullanım sayıları (v3.22'de kullanım ölçümü genişleyecek) */
export async function ofisListesi(prisma: PrismaClient) {
  const b = ofisBaglami();
  yetkiGerek(b.rol, "platform.ofisler");
  return platformOlarak(() =>
    prisma.ofis.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true, ad: true, slug: true, durum: true, plan: true, sinirsiz: true, denemeBitis: true,
        sehir: true, createdAt: true,
        _count: { select: { kullanicilar: true, kayitlar: true, kisiler: true, matchler: true } },
      },
    }),
  );
}

/** Etkin plan: deneme süresi dolmamışsa PRO sayılır */
export function etkinPlan(o: { plan: string; denemeBitis: Date | null; sinirsiz: boolean }) {
  const denemeAktif = !!o.denemeBitis && o.denemeBitis > new Date();
  const kod = (denemeAktif && o.plan === "UCRETSIZ" ? "PRO" : o.plan) as keyof typeof PLANLAR; // deneme Pro+ ofisi düşürmez
  return { kod, denemeAktif, sinirlar: planSinirlari(kod, o.sinirsiz) };
}

// ---------------------------------------------------------------------------
//  Davet
// ---------------------------------------------------------------------------

/** Davet üretir; düz kodu YALNIZCA burada döner (bir daha gösterilemez). */
export async function davetUret(prisma: PrismaClient, girdi: z.input<typeof DavetSchema>, hedefOfisId?: string) {
  const b = ofisBaglami();
  yetkiGerek(b.rol, "ofis.davet");
  const g = DavetSchema.parse(girdi);

  // Başka bir ofise davet üretmek platform yetkisi ister
  const ofisId = hedefOfisId ?? b.ofisId;
  if (ofisId !== b.ofisId) yetkiGerek(b.rol, "platform.ofisler");
  // Ofis yöneticisi kendisinden yetkili rol dağıtamaz
  if (g.rol === "PLATFORM_YONETICISI") yetkiGerek(b.rol, "platform.ofisler");

  const kod = davetKoduUret();
  const ozet = await kodOzeti(kod);
  const sonKullanma = new Date(Date.now() + g.gun * 864e5);
  const davet = await platformOlarak(() =>
    prisma.davet.create({
      data: {
        ofisId,
        kodOzeti: ozet,
        eposta: g.eposta?.toLowerCase() ?? null,
        rol: g.rol as Rol,
        sonKullanma,
        olusturanId: b.kullaniciId,
      },
      select: { id: true },
    }),
  );
  // Düz kod burada döner ve bir daha gösterilemez (veritabanında yalnızca özeti var)
  return { id: davet.id, kod, sonKullanma };
}

/**
 * Daveti kabul et: kodu doğrular, kullanıcıyı o ofiste açar, daveti kapatır.
 * Platform bağlamında çalışır — kişinin henüz bir ofisi yoktur.
 */
export type DavetSonucu =
  | { kullanici: { id: string; ofisId: string; rol: Rol } }
  | { hata: string; durum: 402 | 403 | 404 | 409 | 410 };

export async function davetiKabulEt(prisma: PrismaClient, kod: string, eposta: string): Promise<DavetSonucu> {
  const e = eposta.trim().toLowerCase();
  const ozet = await kodOzeti(kod.trim());
  return platformOlarak(async () => {
    const d = await prisma.davet.findFirst({ where: { kodOzeti: ozet } });
    if (!d) return { hata: "Davet bağlantısı geçersiz", durum: 404 as const };
    if (d.durum !== "BEKLIYOR") return { hata: "Bu davet daha önce kullanılmış ya da iptal edilmiş", durum: 409 as const };
    if (d.sonKullanma < new Date()) return { hata: "Davetin süresi dolmuş, yöneticinizden yeni bağlantı isteyin", durum: 410 as const };
    if (d.eposta && d.eposta !== e) return { hata: "Bu davet başka bir e-posta için üretilmiş", durum: 403 as const };

    const mevcut = await prisma.kullanici.findFirst({ where: { eposta: e }, select: { id: true, ofisId: true } });
    if (mevcut) return { hata: "Bu e-postanın zaten bir hesabı var", durum: 409 as const };

    const ofis = await prisma.ofis.findFirst({ where: { id: d.ofisId }, select: { plan: true, denemeBitis: true, sinirsiz: true } });
    const sinir = ofis ? etkinPlan(ofis as never).sinirlar : planSinirlari("UCRETSIZ");
    const sayi = await prisma.kullanici.count({ where: { ofisId: d.ofisId, aktif: true } });
    if (sayi >= sinir.kullanici)
      return { hata: `Bu ofisin planında en çok ${sinir.kullanici} kullanıcı olabilir (${sinir.etiket}). Pro'ya geçmek gerekiyor.`, durum: 402 as const };

    const k = await prisma.kullanici.create({
      data: { ofisId: d.ofisId, eposta: e, rol: d.rol, sonGiris: new Date() },
      select: { id: true, ofisId: true, rol: true },
    });
    await prisma.davet.update({
      where: { id: d.id },
      data: { durum: "KULLANILDI", kullanilan: new Date(), kullananEposta: e },
    });
    return { kullanici: { id: k.id, ofisId: k.ofisId, rol: k.rol as Rol } };
  });
}

// ---------------------------------------------------------------------------
//  Kullanıcı (ofis yöneticisi)
// ---------------------------------------------------------------------------

export async function kullaniciListesi(prisma: PrismaClient) {
  const b = ofisBaglami();
  yetkiGerek(b.rol, "ofis.kullanicilar");
  return prisma.kullanici.findMany({
    orderBy: { createdAt: "asc" },
    select: { id: true, eposta: true, adSoyad: true, telefon: true, rol: true, aktif: true, sonGiris: true, createdAt: true },
  });
}

export async function kullaniciGuncelle(prisma: PrismaClient, id: string, veri: { rol?: Rol; aktif?: boolean; adSoyad?: string; telefon?: string }) {
  const b = ofisBaglami();
  yetkiGerek(b.rol, "ofis.kullanicilar");
  if (veri.rol === "PLATFORM_YONETICISI") yetkiGerek(b.rol, "platform.ofisler");
  if (id === b.kullaniciId && (veri.aktif === false || (veri.rol && veri.rol !== b.rol)))
    throw Object.assign(new Error("Kendi rolünüzü düşüremez ya da hesabınızı kapatamazsınız"), { durum: 400 });
  // where'e ofisId süzgeci kiracilik katmanında eklenir → başka ofisin kullanıcısı güncellenemez
  return prisma.kullanici.update({
    where: { id },
    data: veri,
    select: { id: true, eposta: true, rol: true, aktif: true },
  });
}

/** Platform yöneticisi: plan, deneme süresi, askıya alma */
export const OfisGuncelleSchema = z.object({
  plan: z.enum(["UCRETSIZ", "PRO", "PRO_PLUS"]).optional(),
  denemeGun: z.number().int().min(0).max(365).optional(), // 0 = denemeyi bitir
  durum: z.enum(["AKTIF", "ASKIDA"]).optional(),
  notlar: z.string().max(2000).optional(),
});

export async function ofisGuncelle(prisma: PrismaClient, id: string, girdi: z.input<typeof OfisGuncelleSchema>) {
  const b = ofisBaglami();
  yetkiGerek(b.rol, "platform.plan");
  const g = OfisGuncelleSchema.parse(girdi);
  if (id === b.ofisId && g.durum === "ASKIDA")
    throw Object.assign(new Error("Kendi ofisinizi askıya alamazsınız"), { durum: 400 });
  return platformOlarak(() =>
    prisma.ofis.update({
      where: { id },
      data: {
        ...(g.plan ? { plan: g.plan } : {}),
        ...(g.durum ? { durum: g.durum } : {}),
        ...(g.notlar != null ? { notlar: g.notlar } : {}),
        ...(g.denemeGun != null ? { denemeBitis: g.denemeGun ? new Date(Date.now() + g.denemeGun * 864e5) : null } : {}),
      },
      select: { id: true, plan: true, durum: true, denemeBitis: true },
    }),
  );
}
