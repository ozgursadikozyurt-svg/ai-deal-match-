/**
 * Anahtar CRM v3.27 · 13 Ekim 2026
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
