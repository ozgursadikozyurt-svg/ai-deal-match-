/**
 * Anahtar CRM v3.45 · 27 Ekim 2026
 * SOHBETTEN GELEN KAYDIN KAYNAĞI — tek ortak kural.
 *
 * Özgür (27 Eki 2026): "İçeri veri olarak aktarılan talep / portföy eğer sohbet metni ise Emlak Grubu olarak işaretle.
 * Eğer kendi portföyüm varsa onu zaten telefon veya isimden kendi portföyüm olarak seçersin."
 *
 * Neden tek yerde? Kural daha önce üç ayrı yerde farklı yazılmıştı:
 *   · sohbet DOSYASI (demo/ice-aktarma.tsx) → portföye PARTNER yazıyordu, talebe yazmıyordu;
 *   · YAPIŞTIRILAN metin (demo/ai-kutusu.tsx) → hiç yazmıyordu, kayıt "Kendi portföyüm" görünüyordu;
 *   · gelen kutusu → aktarma yoluna göre değişiyordu.
 * Bu yüzden aynı mesaj, nereden girildiğine göre farklı kaynak alıyordu. Artık hepsi `sohbetKaynagi` çağırır.
 *
 * Kural:
 *  1. Mesajı BEN gönderdiysem (telefon ya da ad eşleşmesi) → KENDI (kendi portföyüm / kendi müşterim).
 *  2. Portal ilanı (portalUrl / portal kanalı) → dokunulmaz; o zaten web ilanıdır.
 *  3. Kalan her sohbet kaydı (talep de portföy de) → EMLAK_GRUBU.
 * "Sahibinden" yazan grup mesajı da EMLAK_GRUBU'dur: ilanı grupta paylaşan meslektaştır, ilan sahibi bilgisi
 * (ilanSahibiTipi: MALIK) ayrı alanda korunur — v3.36'daki kararın aynısı.
 */
import { kaynakUygula, type KaynakAlanlari, type KaynakSecimi } from "./kaynak";

/** Kendi kimliğim: sohbette "ben" sayılan telefonlar ve adlar (Ayarlar › paylaşım imzası + eklenenler). */
export interface BenimKimligim { telefonlar: string[]; adlar: string[] }

/** WhatsApp dışa aktarmalarında kendi mesajımın yazar alanı bu değerlerden biridir. */
const BEN_YAZARLARI = ["ben", "siz", "sen", "you", "me"];

const normAd = (s: string) => s.trim().toLocaleLowerCase("tr-TR").replace(/\s+/g, " ");
/** Telefonun son 10 hanesi: +90 / 0 / boşluk / parantez farkları eşleşmeyi bozmasın. */
export const son10 = (t: string | null | undefined): string => { const d = String(t ?? "").replace(/\D/g, ""); return d.length >= 10 ? d.slice(-10) : ""; };

/** Ayarlardaki imza ve ek kayıtlardan kimlik kur. */
export function kimlikKur(paylasim: { adSoyad?: string | null; telefon?: string | null } | null | undefined, ek?: { telefonlar?: string[]; adlar?: string[] } | null): BenimKimligim {
  const telefonlar = [paylasim?.telefon, ...(ek?.telefonlar ?? [])].map(son10).filter(Boolean);
  const adlar = [paylasim?.adSoyad, ...(ek?.adlar ?? [])].map((x) => normAd(String(x ?? ""))).filter((x) => x.length >= 3);
  return { telefonlar: [...new Set(telefonlar)], adlar: [...new Set(adlar)] };
}

export interface SohbetGondereni { gonderen?: string | null; telefon?: string | null; ad?: string | null }

/**
 * Mesajı ben mi gönderdim? Sırayla: dışa aktarmanın "Ben / Siz / You" yazarı → telefonun son 10 hanesi → ad eşleşmesi.
 * Ad eşleşmesi tam ad ister ("Özgür Özyurt"); yalnızca "Özgür" yazan bir meslektaş yanlışlıkla ben sayılmasın.
 */
export function benimMesajim(g: SohbetGondereni, kimlik: BenimKimligim): boolean {
  const yazar = normAd(String(g.gonderen ?? ""));
  if (yazar && BEN_YAZARLARI.includes(yazar)) return true;
  const t = son10(g.telefon) || son10(g.gonderen);
  if (t && kimlik.telefonlar.includes(t)) return true;
  const ad = normAd(String(g.ad ?? g.gonderen ?? ""));
  return !!ad && kimlik.adlar.includes(ad);
}

/** Portal ilanı mı (kaynak dokunulmaz)? */
const portalKaydi = (v: KaynakAlanlari & { portalUrl?: unknown; portalIlanNo?: unknown }) =>
  !!v.portalUrl || !!v.portalIlanNo || v.havuz === "DIS_ILAN" || ["SAHIBINDEN", "HEPSIEMLAK", "EMLAKJET"].includes(String(v.veriKanali ?? ""));

/** Sohbetten gelen kayda hangi kaynak yazılmalı (null = dokunma). */
export function sohbetKaynagi(v: KaynakAlanlari & { portalUrl?: unknown; portalIlanNo?: unknown }, g: SohbetGondereni, kimlik: BenimKimligim): KaynakSecimi | null {
  if (portalKaydi(v)) return null;
  return benimMesajim(g, kimlik) ? "KENDI" : "EMLAK_GRUBU";
}

/**
 * Kuralı taslağa uygular ve ne olduğunu söyler (ekranda "Emlak grubu olarak işaretlendi" rozetini besler).
 * Kullanıcı içe aktarma ekranında kaynağı elle değiştirebilir; bu yalnızca başlangıç değeridir.
 */
export function sohbetKaynagiUygula<T extends KaynakAlanlari & { portalUrl?: unknown; portalIlanNo?: unknown }>(
  v: T, g: SohbetGondereni, kimlik: BenimKimligim,
): { taslak: T; kaynak: KaynakSecimi | null; benim: boolean } {
  const benim = benimMesajim(g, kimlik);
  const k = sohbetKaynagi(v, g, kimlik);
  if (!k) return { taslak: v, kaynak: null, benim };
  const y = kaynakUygula(v, k);
  // v3.36 kararı korunur: grupta paylaşılan ilanın sahibi MALİK yazıyorsa bu bilgi silinmez
  // (kaynak Emlak grubu olur ama "ilanı mülk sahibi vermiş" bilgisi portföy edinme fırsatıdır).
  const sahip = (v as { ilanSahibiTipi?: string | null }).ilanSahibiTipi;
  if (k === "EMLAK_GRUBU" && sahip === "MALIK") (y as { ilanSahibiTipi?: string | null }).ilanSahibiTipi = "MALIK";
  return { taslak: y, kaynak: k, benim };
}
