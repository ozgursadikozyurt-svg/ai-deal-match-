/**
 * Anahtar CRM v3.43 · 25 Ekim 2026
 * Metinde kiranın YILLIK olduğunu söyleyen ifade var mı? ("yıllık kira 1.000.000", "kirası yıllık", "1.300.000 TL/yıl").
 * Ölçüm (13 Eki 2026): portal tablosundan gelen kiralık depolarda periyot her zaman "aylık" yazılıyordu; "YILLIK KİRA 1.000.000"
 * başlıklı ilan ayda 1 milyon görünüyor ve bütçesi 150 bin olan talebe hiç gösterilmiyordu.
 * "15 yıllık bina" (yaş), "yıllık aidat" ve "kira yıllık peşin ödenir" (ödeme şekli; tutar aylık) kira tutarı sayılmaz.
 */
// "yıllık peşin" / "yıllık ödenir" ödeme şeklidir, tutar yine aylık olabilir ("KİRA BEDELİ YILLIK PEŞİN", ayda 35 bin): sayılmaz.
const DEGIL = String.raw`(?!\s*(?:pe[şs]in|[öo]de))`;
const YILLIK_KIRA = new RegExp(
  String.raw`y[ıi]ll[ıi]k${DEGIL}\s*(?:kira(?:s[ıi])?|bedel(?:i)?|tutar(?:[ıi])?|fiyat(?:[ıi])?)(?!\s*pe[şs]in)` +
  String.raw`|kira(?:s[ıi])?\s*(?:bedeli\s*)?y[ıi]ll[ıi]k${DEGIL}` +
  String.raw`|(?:tl|₺)?\s*\/\s*y[ıi]l(?![\p{L}])` +
  String.raw`|y[ıi]ll[ıi]k\s*\d`, "iu");
export const yillikKiraIfadesi = (metin: string | null | undefined): boolean => !!metin && YILLIK_KIRA.test(metin.toLocaleLowerCase("tr"));

const tl = (n: number) => Math.round(n).toLocaleString("tr-TR");
/**
 * v3.27 — kirada fiyat / bütçe HER ZAMAN AYLIK saklanır (karşılaştırma ve ekranda okuma kolaylığı). Yıllık girilen kira 12'ye
 * bölünür, ödeme şekli "Yıllık peşin" olarak işaretlenir ve asıl yıllık tutar işlem notuna yazılır. Kirada TOPLAM → AYLIK.
 * Satış ve günlük kira dokunulmaz. Aynı kayıt ikinci kez geçerse değişmez (zaten AYLIK).
 */
export function kirayiAyligaCevir<T extends { islemTipi?: string | null; fiyatPeriyodu?: string | null; fiyat?: number | null; minFiyat?: number | null; maxFiyat?: number | null; operasyonNotu?: string | null; ozellik?: any }>(k: T): T {
  if (!/KIRALIK/.test(k.islemTipi ?? "") || /GUNLUK/.test(k.islemTipi ?? "")) return k;
  if (k.fiyatPeriyodu === "TOPLAM" || k.fiyatPeriyodu == null) return { ...k, fiyatPeriyodu: "AYLIK" };
  if (k.fiyatPeriyodu !== "YILLIK") return k;
  const bol = (v: number | null | undefined) => (v == null ? v : Math.round(v / 12));
  const yillik = k.fiyat ?? k.maxFiyat ?? k.minFiyat;
  const not = yillik != null ? `Kira yıllık isteniyor: ${tl(yillik)} TL/yıl (aylık ≈ ${tl(yillik / 12)} TL)` : "Kira yıllık isteniyor";
  const eskiNot = k.operasyonNotu ?? "";
  return {
    ...k, fiyatPeriyodu: "AYLIK", fiyat: bol(k.fiyat), minFiyat: bol(k.minFiyat), maxFiyat: bol(k.maxFiyat),
    operasyonNotu: eskiNot.includes("Kira yıllık isteniyor") ? eskiNot : [eskiNot, not].filter(Boolean).join(" · "),
    ...(k.ozellik ? { ozellik: { ...k.ozellik, kiraOdemeSekli: k.ozellik.kiraOdemeSekli ?? "YILLIK_PESIN" } } : {}),
  };
}
