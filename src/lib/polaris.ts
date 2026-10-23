/**
 * Anahtar CRM v3.42 · 23 Ekim 2026
 * Polaris v7 · 21 Ekim 2026
 * Polaris (Özgür'ün kişisel çalışma rehberi) — anahtarcrm.com/polaris. Arayüz: public/polaris.html.
 * Veri: public.polaris_belge (koleksiyon / belge / jsonb). Anahtar CRM'in ofis tablolarından ayrıdır;
 * ham SQL yalnızca bu tabloda kullanılır (ofise ait tablolar Prisma modelleriyle, kiracılık süzgecinden geçerek okunur).
 * Kapı: yalnızca PLATFORM_YONETICISI rolü (asistan ve diğer ofisler Polaris'i görmez — karar belgesi v1.4).
 */
import { ofisBaglami, type Baglam } from "./kiracilik";

export class PolarisHatasi extends Error {
  constructor(public durum: number, mesaj: string) { super(mesaj); }
}

/** Polaris'i açabilecek tek rol: platform yöneticisi (Özgür). */
export function polarisKapi(): Baglam {
  const b = ofisBaglami();
  if (b.rol !== "PLATFORM_YONETICISI") throw new PolarisHatasi(403, "Polaris yalnızca hesap sahibine açıktır");
  return b;
}

const AD = /^[A-Za-z0-9_.:@+-]{1,120}$/;
export function adDenetle(ad: string, ne: string): string {
  if (!AD.test(ad)) throw new PolarisHatasi(400, `Geçersiz ${ne}`);
  return ad;
}

/** Belge gövdesi en çok 900 KB (kişi parçaları ~70 KB). */
export const BELGE_SINIRI = 900_000;
