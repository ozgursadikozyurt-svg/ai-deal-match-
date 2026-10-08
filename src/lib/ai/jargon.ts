/**
 * Anahtar CRM v3.21.2 · 8 Ekim 2026
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
  // v3.18 — gerçek WhatsApp grup dökümünde en sık geçen ifadeler (ölçüm: 1.376 emlak mesajı)
  { re: /e[şs]yas[ıi]z/u, alan: "esyaDurumu", deger: "ESYASIZ", etiket: "Eşyasız" },
  { re: /e[şs]yal[ıi]|mobilyal[ıi]|full\s*e[şs]ya/u, alan: "esyaDurumu", deger: "ESYALI", etiket: "Eşyalı" },
  { re: /g[üu]venlikli|g[üu]venlik\s*(var|li)|24\s*saat\s*g[üu]venlik/u, alan: "guvenlik", deger: true, etiket: "Güvenlikli" },
  { re: /jenerat[öo]r/u, alan: "jenerator", deger: true, etiket: "Jeneratörlü" },
  { re: /balkonlu|balkon\s*var|(?<![\p{L}])balkon(?![\p{L}])/u, alan: "balkon", deger: true, etiket: "Balkonlu" },
  { re: /terasl[ıi]|teras\s*var|(?<![\p{L}])teras(?![\p{L}])/u, alan: "teras", deger: true, etiket: "Teraslı" },
  { re: /do[ğg]algaz|kombi(?!\s*yok)/u, alan: "isinmaTipi", deger: "DOGALGAZ_KOMBI", etiket: "Doğalgaz / kombi" },
  { re: /yerden\s*[ıi]s[ıi]tma/u, alan: "isinmaTipi", deger: "YERDEN_ISITMA", etiket: "Yerden ısıtma" },
  { re: /merkezi\s*[ıi]s[ıi]tma|pay\s*[öo]l[çc]er/u, alan: "isinmaTipi", deger: "MERKEZI", etiket: "Merkezi ısıtma" },
  { re: /bah[çc]eli|bah[çc]e\s*(kullan[ıi]m|var)/u, alan: "bahce", deger: true, etiket: "Bahçeli" },
  { re: /imarl[ıi]|imar[ıi]\s*var|konut\s*imarl[ıi]/u, alan: "imarDurumu", deger: "KONUT", etiket: "Konut imarlı" },
  { re: /tarla\s*vasf|tarla\s*imar/u, alan: "imarDurumu", deger: "TARLA", etiket: "Tarla vasıflı" },
  // Arsa
  { re: /tek\s*tapu\s*tek\s*imza|m[üu]stakil\s*tapu/u, alan: "tapuTipi", deger: "MUSTAKIL", etiket: "Tek tapu tek imza" },
];

/** Alan karşılığı OLMAYAN jargon: kaydın "Notlar" alanına yazılır (bilgi kaybolmasın) */
export const JARGON_NOTLUK: { re: RegExp; not: string }[] = [
  // v3.18 — sohbette sık geçen, alan karşılığı henüz olmayan ifadeler
  { re: /sorunsuz/u, not: "Tapu / kredi yönünden sorunsuz" },
  { re: /hisseli/u, not: "Hisseli tapu" },
  { re: /yat[ıi]r[ıi]ml[ıi]k|kira\s*getiri|getirisi\s*var|getiri\s*%/u, not: "Yatırımlık — kira getirisi var" },
  { re: /teslim(?!\s*tarihi\s*yok)|in[şs]aat\s*a[şs]ama|%\s*\d{1,3}\s*bitmi/u, not: "Proje / inşaat aşamasında — teslim tarihi sorulmalı" },
  { re: /tramvay|otob[üu]s\s*dura|dura[ğg]a\s*yak[ıi]n|metroya\s*yak[ıi]n/u, not: "Toplu taşımaya yakın" },
  { re: /okula\s*yak[ıi]n|[üu]niversiteye\s*yak[ıi]n/u, not: "Okula / üniversiteye yakın" },
  { re: /da[ğg]\s*manzara|[şs]ehir\s*manzara|do[ğg]a\s*manzara|manzaral[ıi]/u, not: "Manzaralı (deniz dışı)" },
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

/** v3.18 — "güney cephe", "doğu batı cepheli" → cephe yönleri */
export function cepheYonleriOku(m: string): string[] {
  const y: [RegExp, string][] = [[/g[üu]ney/u, "GUNEY"], [/kuzey/u, "KUZEY"], [/do[ğg]u/u, "DOGU"], [/bat[ıi]/u, "BATI"]];
  if (!/cephe|cepheli/u.test(m)) return [];
  const pencere = m.slice(Math.max(0, m.search(/cephe/u) - 40), m.search(/cephe/u) + 10);
  return y.filter(([re]) => re.test(pencere)).map(([, k]) => k);
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

// ───────────────────────── v3.18 — portal bağlantısı ve WhatsApp gürültüsü ─────────────────────────

/**
 * Sahibinden / Emlakjet / Hepsiemlak bağlantısının adresinde mülk tipi, işlem ve oda sayısı yazılıdır:
 *   .../ilan/emlak-konut-satilik-arapsuyu-gursu-da-4-plus1-bahcedubleksi-1317953785/detay
 * Grupta paylaşılan pek çok ilan yalnızca bağlantıdan ibaret; metin olmadığında bu bilgi tek kaynaktır.
 */
export function baglantidanOku(url: string): { tip?: "PORTFOY"; islemTipi?: string; mulkTipi?: string; odaSayisi?: string; ilanNo?: string } {
  const u = url.toLocaleLowerCase("tr");
  if (!/sahibinden\.com|emlakjet\.com|hepsiemlak\.com/.test(u)) return {};
  const sonuc: ReturnType<typeof baglantidanOku> = { tip: "PORTFOY" };
  if (/-satilik-|\/satilik/.test(u)) sonuc.islemTipi = "SATILIK";
  else if (/-devren-/.test(u)) sonuc.islemTipi = /kiralik/.test(u) ? "DEVREN_KIRALIK" : "DEVREN_SATILIK";
  else if (/-kiralik-|\/kiralik/.test(u)) sonuc.islemTipi = "KIRALIK";
  const tipler: [RegExp, string][] = [
    [/-residence-|rezidans/, "REZIDANS"], [/mustakil-ev|-villa-|villa/, "VILLA"], [/yazlik/, "YAZLIK"],
    [/is-yeri-.*dukkan|-dukkan-|magaza/, "DUKKAN_MAGAZA"], [/-ofis-|buro/, "BURO_OFIS"],
    [/depo|antrepo/, "DEPO_ANTREPO"], [/fabrika/, "FABRIKA"], [/-otel-|hotel|apart-otel/, "OTEL"],
    [/arsa|tarla|-bag-|bahce-arazi/, "ARSA"], [/devremulk/, "DEVREMULK"],
    [/emlak-konut-|-daire-|konut-satilik|konut-kiralik/, "DAIRE"], [/is-yeri/, "DUKKAN_MAGAZA"],
  ];
  for (const [re, t] of tipler) if (re.test(u)) { sonuc.mulkTipi = t; break; }
  const oda = u.match(/(\d{1,2})-plus(\d)/);
  if (oda) sonuc.odaSayisi = `${oda[1]}+${oda[2]}`;
  const no = u.match(/-(\d{8,12})(?:\/|$)/);
  if (no) sonuc.ilanNo = no[1];
  return sonuc;
}

/**
 * WhatsApp dışa aktarımındaki sistem satırları ve ek göstergeleri metinden ayıklar
 * ("güvenlik kodu değişti", "[Görsel]", "Bu mesaj silindi", alıntı satırları).
 * Bunlar ayrıştırıcıyı yanıltıyor ve mülk tipi / fiyat aramasını bozuyordu.
 */
export function whatsappGurultusuTemizle(metin: string): string {
  return metin
    .replace(/\[(G[öo]rsel|Video|Sesli mesaj|Belge|Sticker|GIF|Ki[şs]i kart[ıi]|Konum)\]/gu, " ")
    .replace(/^.*ki[şs]isinin g[üu]venlik kodu de[ğg]i[şs]ti.*$/gimu, " ")
    .replace(/^.*(bu mesaj[ıi]? sildi|bu mesaj silindi|mesaj[ıi] sildiniz).*$/gimu, " ")
    .replace(/^.*(mesajlar ve aramalar u[çc]tan uca|grup a[çc][ıi]klamas[ıi]n[ıi] de[ğg]i[şs]tirdi|gruba kat[ıi]ld[ıi]|gruptan ayr[ıi]ld[ıi]|grup konusunu|eklendi|[çc][ıi]kar[ıi]ld[ıi])$/gimu, " ")
    .replace(/^\s*>\s*_.*_\s*$/gmu, " ")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}
