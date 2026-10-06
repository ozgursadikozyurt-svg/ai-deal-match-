/**
 * Anahtar CRM v3.17 · 6 Ekim 2026
 * Emlak jargonu sözlüğü — WhatsApp / ilan metinlerindeki kısaltma ve deyimleri teknik alanlara çevirir.
 * Sözlüğün insan tarafından okunur hali: docs/emlak_jargon.md (ikisi birlikte güncellenir, tests/v317.test.ts ikisini de denetler).
 * Buradaki kurallar yapay zekâdan ÖNCE çalışır: ne kadar çok jargon kuralla çözülürse o kadar az yapay zekâ çağrısı yapılır.
 */

/** Jargon kuralı: metinde `re` görülürse `alan` = `deger` (alanı olmayan kayıtlar yalnızca nota yazılır). */
export interface JargonKurali {
  re: RegExp;
  /** MulkOzellik alanı ya da kayıt alanı (krediyeUygun, takasaAcik) */
  alan?: string;
  deger?: unknown;
  /** Kayıt alanı mı (ozellik yerine kaydın kendi alanı) */
  kayitAlani?: boolean;
  /** Not alanına düşecek açıklama (alan karşılığı olmayan jargon buradan kaydedilir) */
  not?: string;
  etiket: string;
}

/** Alan karşılığı OLAN jargon (teknik özelliğe çevrilir) */
export const JARGON_ALANLI: JargonKurali[] = [
  // Finansman ve tapu
  { re: /full\s*kredi|kredi(ye)?\s*(uygun|a[çc][ıi]k)|kredi\s*s[ıi]n[ıi]r[ıi]\s*bulunmayan/u, alan: "krediyeUygun", deger: true, kayitAlani: true, etiket: "Krediye uygun" },
  { re: /takasl[ıi]|takasa\s*a[çc][ıi]k|takas\s*olur/u, alan: "takasaAcik", deger: true, kayitAlani: true, etiket: "Takasa açık" },
  { re: /iskanl[ıi]|iskan\s*(var|al[ıi]nm[ıi][şs])/u, alan: "iskan", deger: true, etiket: "İskanlı" },
  // Konut özellikleri
  { re: /ebeveyn\s*banyo/u, alan: "ebeveynBanyosu", deger: true, etiket: "Ebeveyn banyolu" },
  { re: /(kapal[ıi]|a[çc][ıi]k)\s*otopark|otopark[ıi]?\s*var|otoparkl[ıi]/u, alan: "otoparkDurumu", deger: true, etiket: "Otoparklı" },
  { re: /havuzlu|havuz\s*var/u, alan: "havuz", deger: true, etiket: "Havuzlu" },
  { re: /asans[öo]rl?[üu]?/u, alan: "asansor", deger: true, etiket: "Asansörlü" },
  { re: /site\s*i[çc]|site\s*içinde|g[üu]venlikli\s*site/u, alan: "siteIcinde", deger: true, etiket: "Site içinde" },
  { re: /deniz\s*manzara/u, alan: "denizManzarasi", deger: true, etiket: "Deniz manzaralı" },
  { re: /(ters\s*)?d[üu]pleks|dubleks|dublex|[çc]ift\s*kat/u, alan: "dubleks", deger: true, etiket: "Dubleks" },
  // Arsa
  { re: /tek\s*tapu\s*tek\s*imza|m[üu]stakil\s*tapu/u, alan: "tapuTipi", deger: "MUSTAKIL", etiket: "Tek tapu tek imza" },
];

/** Alan karşılığı OLMAYAN jargon: kaydın "Notlar" alanına yazılır (bilgi kaybolmasın) */
export const JARGON_NOTLUK: { re: RegExp; not: string }[] = [
  { re: /yabanc[ıi]ya\s*sat[ıi][şs]|vatanda[şs]l[ıi][ğg]a\s*uygun|ikamet\s*(ve|,)?\s*yabanc[ıi]/u, not: "Yabancıya satışa / vatandaşlığa uygun" },
  { re: /eminevim|kat[ıi]l[ıi]mevim|fuzulev/u, not: "Faizsiz finansman sistemine uygun (Eminevim / Katılımevim / Fuzulev)" },
  { re: /kapal[ıi]\s*portf[öo]y|ilan\s*d[ıi][şs][ıi]|direk\s*sunum/u, not: "Kapalı portföy — ilan sitelerinde yayınlanmıyor" },
  { re: /payla[şs][ıi]ma\s*a[çc][ıi]k|birlikte\s*satal[ıi]m|co-?broker/u, not: "Paylaşıma açık (birlikte satalım)" },
  { re: /al\s*sata\s*uygun|emsallerinin\s*alt[ıi]nda|kelepir|f[ıi]rsat\s*[üu]r[üu]n/u, not: "Al-sat / emsallerinin altında fırsat" },
  { re: /kentsel\s*d[öo]n[üu][şs][üu]m/u, not: "Kentsel dönüşüm" },
  { re: /kat\s*kar[şs][ıi]l[ıi][ğg][ıi]/u, not: "Kat karşılığı" },
  { re: /i[çc]i\s*(yap[ıi]l[ıi]|yenilen)|masrafs[ıi]z|tadilats[ıi]z|tadilatl[ıi]|oturuma\s*haz[ıi]r/u, not: "İçi yapılı / masrafsız" },
  { re: /ges'?e\s*uygun|g[üu]ne[şs]\s*enerji/u, not: "GES'e uygun" },
  { re: /marjinal/u, not: "Marjinal tarım arazisi raporu" },
  { re: /amerikan\s*mutfak|a[çc][ıi]k\s*mutfak/u, not: "Amerikan (açık) mutfak" },
  { re: /ayr[ıi]\s*mutfak|kapal[ıi]\s*mutfak/u, not: "Ayrı (kapalı) mutfak" },
  { re: /bah[çc]e\s*kat[ıi]|bah[çc]e\s*dubleks/u, not: "Bahçe katı / bahçe dublesi" },
  { re: /nakit\s*al[ıi]m|nakite\s*indirim/u, not: "Nakit alım" },
];

/** "8/9" = 9 katlı binanın 8. katı · "12/6" = 12 katlının 6'sı (büyük olan bina kat sayısıdır) */
export function katOku(m: string): { bulunduguKat?: number; katSayisi?: number } {
  const g = m.match(/(?<![\d/.,])(\d{1,2})\s*\/\s*(\d{1,2})(?![\d/])(?![^.,;\s]*\s*(m2|m²|tl|₺))/u);
  if (g) {
    const a = Number(g[1]), b = Number(g[2]);
    if (a <= 60 && b <= 60 && (a > 0 || b > 0)) return { bulunduguKat: Math.min(a, b), katSayisi: Math.max(a, b) };
  }
  const tek = m.match(/(?<![\d])(\d{1,2})\s*\.?\s*kat(?!l[ıi])(?!\s*kar[şs][ıi]l)(?!\s*say)/u);
  if (tek) return { bulunduguKat: Number(tek[1]) };
  const sayili = m.match(/(\d{1,2})\s*katl[ıi]/u);
  return sayili ? { katSayisi: Number(sayili[1]) } : {};
}

/** "SIFIR" = 0 yaş · "15 yıllık" = 15 yaş */
export function binaYasiOku(m: string): number | undefined {
  if (/\bs[ıi]f[ıi]r\b|\bs[ıi]f[ıi]r\s*bina|yeni\s*bina|yap[ıi]m[ıi]\s*yeni/u.test(m)) return 0;
  const g = m.match(/(\d{1,3})\s*(?:y[ıi]ll[ıi]k|ya[şs][ıi]nda|ya[şs][ıi]\b)/u);
  return g ? Number(g[1]) : undefined;
}

/** "0.70 emsal" / "emsal 0,70" */
export function emsalOku(m: string): number | undefined {
  const g = m.match(/(?:emsal[^\d]{0,8}(\d[\d.,]*)|(\d[\d.,]*)\s*emsal)/u);
  const s = g?.[1] ?? g?.[2];
  if (!s) return undefined;
  const n = Number(s.replace(",", "."));
  return Number.isFinite(n) && n > 0 && n <= 10 ? n : undefined;
}

/**
 * Kat jargonundan istenen kat seçenekleri (talepte çoklu kat):
 * "arakat" / "katta" → ARA · "yüksek giriş" / "giriş" / "zemin" / "bahçe katı" → 0 · "son kat" / "çatı katı" → SON · "bodrum" → -1
 */
export function katJargonu(m: string): string[] {
  const k: string[] = [];
  if (/ara\s*kat|arakat|(?<![\p{L}])katta(?![\p{L}])/u.test(m)) k.push("ARA");
  if (/y[üu]ksek\s*giri[şs]|(?<![\p{L}])giri[şs]\s*kat|zemin\s*kat|bah[çc]e\s*kat/u.test(m)) k.push("0");
  if (/son\s*kat|[çc]at[ıi]\s*kat/u.test(m)) k.push("SON");
  if (/bodrum\s*kat/u.test(m)) k.push("-1");
  return k;
}

/**
 * Fiyat jargonu düzeltmesi: metinde yazılan ham sayıyı bağlama göre düzeltir.
 *  - "15.5 TL" satılık konut için 15.500.000 TL (kimse 15 lira yazmaz)
 *  - "13500 000" → 13.500.000 (boşlukla bölünmüş binlik)
 *  - Kira bağlamında "7.500" 7.500 TL kalır; satılıkta 7.500.000 olur.
 * Dönen değer null ise düzeltme gerekmiyordur.
 */
export function fiyatDuzelt(deger: number | null | undefined, o: { kira: boolean; arsa?: boolean }): number | null {
  if (deger == null || !Number.isFinite(deger) || deger <= 0) return null;
  if (o.kira) return deger < 100 ? deger * 1000 : null;      // "25" → 25.000 TL kira
  if (deger < 1000) return deger * 1_000_000;                 // "15.5" / "17" → milyon
  if (deger < 100_000) return deger * 1000;                   // "7.500" / "13500" → bin katı
  return null;
}

/** Boşlukla bölünmüş binlikleri birleştirir: "13500 000" → "13500000" (fiyat okuyucudan önce çalışır) */
/**
 * Boşlukla bölünmüş binlikleri birleştirip binlik noktasıyla yazar: "13500 000" → "13.500.000".
 * (Düz birleştirme "13500000" ilan numarası sanılırdı; noktalı yazım fiyat okuyucunun tanıdığı biçimdir.)
 */
export function bosluklukBinlik(metin: string): string {
  // Telefon numaralarına dokunulmaz: ilk öbek 4-6 hane olmalı ve 0 ile başlamamalı ("532 111 22 33" / "0555 111 22 33" birleşmez)
  return metin.replace(/(?<![\d.,+])([1-9]\d{3,5})((?:\s+\d{3})+)(?![\d.,])/gu, (tum, bas: string, kalan: string) => {
    const ham = bas + kalan.replace(/\s+/g, "");
    if (ham.length > 12) return tum;
    return ham.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  });
}
