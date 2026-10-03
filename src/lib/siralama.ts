/**
 * Anahtar CRM v3.13 · 3 Ekim 2026
 * Listelerde sıralama: fiyat, alan, kayda giriş, kalan süre, skor, ad… Artan / azalan. Boş değerler her zaman sonda.
 */
export type Yon = "artan" | "azalan";
export interface Siralama { alan: string; yon: Yon }
export interface SiralamaSecenegi<T> { alan: string; etiket: string; deger: (x: T) => number | string | null | undefined; varsayilanYon: Yon }
export function sirala<T>(liste: T[], s: Siralama | null, secenekler: SiralamaSecenegi<T>[]): T[] {
  const sec = s && secenekler.find((x) => x.alan === s.alan);
  if (!sec) return liste;
  const k = s!.yon === "artan" ? 1 : -1;
  return liste.map((x, i) => [x, sec.deger(x), i] as const).sort((a, b) => {
    const av = a[1], bv = b[1];
    const ab = av == null || av === "", bb = bv == null || bv === "";
    if (ab || bb) return ab && bb ? a[2] - b[2] : ab ? 1 : -1;
    const c = typeof av === "string" ? av.localeCompare(String(bv), "tr") : (av as number) - (bv as number);
    return c * k || a[2] - b[2];
  }).map((x) => x[0]);
}
export const yonEtiket = (alan: string, yon: Yon) => {
  const metin = /ad|baslik/.test(alan);
  const tarih = /tarih|giris|olusturma|sure|kalan/.test(alan);
  return metin ? (yon === "artan" ? "A → Z" : "Z → A") : tarih ? (yon === "artan" ? "Eskiden yeniye" : "Yeniden eskiye") : yon === "artan" ? "Küçükten büyüğe" : "Büyükten küçüğe";
};