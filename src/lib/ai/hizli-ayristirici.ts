/**
 * Anahtar CRM v3.13 · 3 Ekim 2026
 * HIZLI AYRIŞTIRICI — yapay zekâdan ÖNCE çalışan kural tabanlı (regex + sözlük) çözümleyici. Ücretsizdir.
 * Amaç: yapıştırılan WhatsApp mesajı / portal ilanı ya da doğal dil sorusunun çoğunu yapay zekâ
 * çağırmadan anlamak; yapay zekâ yalnızca kural tabanlı sonuç "yeterli" değilse çağrılır.
 *
 *  metinTuru()        → "SORU" (veritabanı sorgusu) | "ILAN" (kayda dönüşecek metin)
 *  hizliAyristir()    → tip, mülk tipi, işlem, fiyat, m², oda, telefon, portal, ilan no, şirket, teknik alanlar
 *  soruFiltresi()     → "Kepez'de 1000 m² üstü kiralık depo var mı?" → { hedef, aile, işlem, m2Min, … }
 *  metindenKonumlar() → metindeki ilçe / mahalle / alt bölge / referans nokta ifadeleri (çözücüye verilir)
 *
 * Saf fonksiyonlar; demo ve sunucu (/api/ai/ara) aynı kodu kullanır.
 */
import { JARGON_ALANLI, JARGON_NOTLUK, katOku, katJargonu, binaYasiOku, emsalOku, cepheYonleriOku, baglantidanOku, whatsappGurultusuTemizle, fiyatDuzelt, bosluklukBinlik } from "./jargon";
import { lokasyonAnahtari } from "../lokasyon/normalize";
import type { LokasyonIndeks } from "../lokasyon/cozumle";

export type MetinTuru = "SORU" | "ILAN";

const kucuk = (s: string) => s.toLocaleLowerCase("tr");
/** "5.450.000" → 5450000 · "6,5" → 6.5 · "1.200,50" → 1200.5 */
export function sayiOku(s: string): number | null {
  let t = s.trim();
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(t)) t = t.replace(/\./g, "").replace(",", ".");
  else if (/^\d{1,3}(,\d{3})+$/.test(t)) t = t.replace(/,/g, "");
  else t = t.replace(",", ".");
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

// ───────── Sözlükler (uzun ifadeler önce) ─────────
const TIP_SOZLUK: [RegExp, string][] = [
  [/so[ğg]uk\s*hava\s*(deposu)?/, "SOGUK_HAVA_DEPOSU"], [/lojistik\s*(merkez|depo|tesis)/, "LOJISTIK_MERKEZI"], [/\b(depo|antrepo|ambar)/, "DEPO_ANTREPO"],
  [/fabrika|[üu]retim\s*tesis/, "FABRIKA_URETIM_TESISI"], [/imalathane/, "IMALATHANE"], [/at[öo]lye/, "ATOLYE"], [/oto\s*servis|tamirhane/, "TAMIRHANE_OTO_SERVIS"],
  [/showroom/, "SHOWROOM"], [/d[üu]kkan|ma[ğg]aza/, "DUKKAN_MAGAZA"], [/restoran|lokanta/, "RESTORAN_LOKANTA"], [/(?<![\p{L}])(kafe|cafe|bar)(?![\p{L}])/u, "CAFE_BAR"],
  [/plaza\s*kat/, "PLAZA_KATI_OFIS"], [/\b(ofis|b[üu]ro)/, "BURO_OFIS"], [/butik\s*otel/, "BUTIK_OTEL"], [/(?<![\p{L}])otel(?![\p{L}])/u, "OTEL"],
  [/rezidans/, "REZIDANS"], [/villa/, "VILLA"], [/m[üu]stakil/, "MUSTAKIL_EV"], [/daire|\bapartman/, "DAIRE"],
  [/tarla/, "TARLA"], [/zeytinlik/, "ZEYTINLIK"], [/\barsa/, "ARSA"], [/komple\s*bina/, "KOMPLE_BINA"],
];
const AILE_SOZLUK: [RegExp, string][] = [
  [/depo|antrepo|lojistik|so[ğg]uk\s*hava/, "DEPO"], [/fabrika|imalathane|at[öo]lye|[üu]retim/, "URETIM"], [/d[üu]kkan|ma[ğg]aza|showroom/, "DUKKAN"],
  [/restoran|kafe|cafe|lokanta/, "YEME_ICME"], [/ofis|b[üu]ro|plaza/, "OFIS"], [/villa|m[üu]stakil/, "MUSTAKIL"], [/daire|rezidans|konut|ev\b/, "DAIRE"],
  [/arsa|tarla/, "ARSA"], [/otel/, "TURIZM"],
];
const AMAC_SOZLUK: [RegExp, string][] = [
  [/g[ıi]da\s*[üu]retim/, "GIDA_URETIM"], [/so[ğg]uk\s*zincir|so[ğg]uk\s*hava/, "SOGUK_ZINCIR"], [/e-?ticaret/, "E_TICARET"], [/lojistik|da[ğg][ıi]t[ıi]m/, "LOJISTIK_DAGITIM"],
  [/[üu]retim|imalat/, "URETIM"], [/market/, "MARKET"], [/showroom/, "SHOWROOM"], [/yat[ıi]r[ıi]m/, "YATIRIM_KIRA_GELIRI"],
];

// v3.12 — zayıf ipuçları ("lazım", "ihtiyaç", "kadar", "olsun") ilan metinlerinde de geçer: "tapu yapmamız LAZIM", "10 KATA KADAR müsaadeli",
// "Yeni Yılınız kutlu olsun". Yalnızca talep anlamı taşıyan biçimleri sayılır.
export const TALEP_IPUCU = new RegExp([
  "ar[ıi]yor(?:uz|um)?", "aran[ıi]yor", "arayan", "aray[ıi][şs][ıi]m", "tale[pb](?:i|ler|leri|imiz|lerimiz)?(?![\\p{L}])(?!\\s*eden)", "istiyor", "m[üu][şs]terim\\s*var", "m[üu][şs]terimiz",
  "(?:daire|ev|villa|arsa|tarla|d[üu]kkan|ma[ğg]aza|i[şs]yeri|depo|ofis|b[üu]ro|fabrika|at[öo]lye|st[üu]dyo|m[üu]lk|yer|lokanta|otel)\\s*(?:bir\\s*)?laz[ıi]m(?![\\p{L}])",
  "laz[ıi]m\\s*olan", "(?<!tadilat\\p{L}*\\s)(?<!bak[ıi]m\\p{L}*\\s)(?<!onar[ıi]m\\p{L}*\\s)(?<!yenileme\\p{L}*\\s)(?<!boya\\p{L}*\\s)ihtiya[çc](?:[ıi]|[ıi]m[ıi]z|[ıi]m)?\\s*(?:var|olan)", "ihtiya[çc]\\s*duyan",
  "(?:\\d|milyon|bin|tl|₺|dolar|usd|euro|€)\\p{L}{0,3}['’]?\\p{L}{0,2}\\s*kadar(?![\\p{L}])", "b[üu]t[çc]e",
].join("|"), "u");
const PORTFOY_IPUCU = /sat[ıi]l[ıi]k(t[ıi]r)?\b|kiral[ıi]k(t[ıi]r)?\b|sat[ıi][şs]ta|sat[ıi]l[ıi]r|kiraya\s*verilecek|ilan\s*no|portf[öo]y[üu]m[üu]z|m[üu]lk\s*sahibi|mevcut/;

export interface HizliSonuc {
  tur: MetinTuru;
  tip: "PORTFOY" | "TALEP" | null;
  mulkTipi: string | null;
  aileKodu: string | null;
  islemTipi: string | null;
  fiyat: number | null;
  minFiyat: number | null;
  maxFiyat: number | null;
  fiyatPeriyodu: "TOPLAM" | "AYLIK" | "GUNLUK" | null; // v3.9: GUNLUK (portal sayfasından)
  paraBirimi: "TRY" | "USD" | "EUR" | "GBP";
  m2: number | null;
  minM2: number | null;
  maxM2: number | null;
  m2Esnek: boolean;
  odaSayisi: string | null;
  telefon: string | null;
  /** Telefonun önündeki kişi adı (varsa) */
  kisiAdi: string | null;
  /** v3.17 — alan karşılığı olmayan jargon (yabancıya satış, kapalı portföy…): kaydın notuna yazılır */
  jargonNotlari: string[];
  /** v3.17 — jargondan çıkan kayıt alanları: krediyeUygun, takasaAcik */
  kayitAlanlari: Record<string, unknown>;
  portal: "SAHIBINDEN" | "EMLAKJET" | "HEPSIEMLAK" | null;
  portalUrl: string | null;
  ilanNo: string | null;
  sirket: string | null;
  ilanSahibiTipi: "MALIK" | "EMLAKCI" | "PORTAL" | "MUTEAHHIT" | "FIRMA" | null; // v3.9: portal "Kimden" alanı
  aciliyet: "ACIL" | null;
  /** İşlem metinde yazmıyordu, fiyat düzeyinden / mülk tipinden tahmin edildi */
  islemTahmini: boolean;
  ozellik: Record<string, unknown>;
  /** Kural tabanlı bulunan alan sayısı (güven göstergesi) */
  bulunan: string[];
  /** Kayda dönüşmek için eksik temel alanlar */
  eksik: string[];
  /** true → yapay zekâya gerek yok (tip + mülk + işlem + (fiyat | alan | oda) bulundu; konumu çağıran ekler) */
  yeterli: boolean;
}

export function metinTuru(metin: string): MetinTuru {
  const m = kucuk(metin.trim());
  if (/https?:\/\//.test(m) || /(\+?90|0)?\s?5\d{2}[\s-]?\d{3}[\s-]?\d{2}[\s-]?\d{2}/.test(m)) return "ILAN";
  const soruKelime = /\b(var\s*m[ıi]|kaç|hangi|g[öo]ster|listele|bul\b|neler|nerede|en\s*ucuz|en\s*b[üu]y[üu]k|olan\s*(portf[öo]y|talep)|portf[öo]ylerim|taleplerim)/;
  if (m.length <= 180 && (m.endsWith("?") || soruKelime.test(m))) return "SORU";
  return "ILAN";
}

const CARPAN = (b?: string) => (!b ? 1 : /milyon|mn|\bm\b/.test(b) ? 1e6 : /milyar/.test(b) ? 1e9 : /bin|\bk\b/.test(b) ? 1e3 : 1);

/** Metindeki para ifadeleri (m², kW vb. birimli sayılar hariç) */
function paralar(m: string): { deger: number; acik: boolean; kadar: boolean; aylik: boolean; para: HizliSonuc["paraBirimi"] }[] {
  const r: ReturnType<typeof paralar> = [];
  const re = /(?<![\p{L}\d.,+])(\d[\d.,]*)\s*(milyar\p{L}*|milyon\p{L}*|mn\b|bin(?!ek)\p{L}*|k\b)?\s*(tl\b|₺|try\b|lira\b|euro\b|eur\b|€|usd\b|dolar\b|\$|gbp\b|sterlin\b)?('?[ey]?\s*kadar|\s*kadar|\s*alt[ıi])?/gu;
  let x: RegExpExecArray | null;
  while ((x = re.exec(m))) {
    const [tum, sayi, buyuk, birim, kadar] = x;
    const sonra = m.slice(x.index + tum.length, x.index + tum.length + 12);
    const once = m.slice(Math.max(0, x.index - 14), x.index);
    if (/^\s*(m2|m²|mt2|metre|m\b|metrekare|kw|kva|ton|d[öo]n[üu]m|oda|kat|ya[şs]|y[ıi]l|\+|adet|ki[şs]i|yatak|dk|km|derece|°)/.test(sonra) && !birim) continue;
    if (/\+\s*$/.test(once) || /\d\s*\+$/.test(sayi)) continue;
    if (/(\d{3})[\s-]?(\d{2})[\s-]?(\d{2})/.test(m.slice(x.index, x.index + 14)) && /^0?5/.test(sayi)) continue; // telefon
    if (/^\d{7,}$/.test(sayi)) continue; // ilan no / ayraçsız uzun sayı
    const n = sayiOku(sayi);
    if (n == null) continue;
    const deger = n * CARPAN(buyuk);
    if (!buyuk && !birim && deger < 1000) continue; // "3. kat", "8 yaşında"
    if (deger < 1000 && !birim) continue;
    if (deger < 1000 && birim) { r.push({ acik: true, deger, kadar: !!kadar, aylik: /ayl[ıi]k|kira/.test(once + sonra), para: /euro|eur|€/.test(birim) ? "EUR" : /usd|dolar|\$/.test(birim) ? "USD" : /gbp|sterlin/.test(birim) ? "GBP" : "TRY" }); continue; } // v3.17: "15.5 TL" → jargon düzeltmesi fiyatı milyona çevirir
    const para: HizliSonuc["paraBirimi"] = /euro|eur|€/.test(birim ?? "") ? "EUR" : /usd|dolar|\$/.test(birim ?? "") ? "USD" : /gbp|sterlin/.test(birim ?? "") ? "GBP" : "TRY";
    r.push({ acik: !!(buyuk || birim) || /\./.test(sayi), deger, kadar: !!kadar || /kadar|max|en\s*fazla|b[üu]t[çc]e/.test(sonra + once), aylik: /ayl[ıi]k|kira/.test(once + sonra), para });
  }
  return r;
}

/**
 * v3.10 — para yazımlarını ayrıştırıcının tanıdığı biçime çevirir:
 * "₺35.000" / "35.000₺" → "35.000 TL" · "$250.000" → "250.000 USD" · "€ 1.250.000" → "1.250.000 EUR" · "£…" → GBP
 * "3.250.000.-TL" / "3.250.000,-" → "3.250.000 TL" · "8.5M TL" → "8,5 milyon TL"
 */
export function paraNormalize(metin: string): string {
  const kod: Record<string, string> = { "₺": "TL", "$": "USD", "€": "EUR", "£": "GBP" };
  return metin
    // v3.12 — "5.450.000. ₺" / "5.450.000.₺" (sondaki nokta): binlik ayraç sanılıp para okunamıyordu
    .replace(/(\d{1,3}(?:\.\d{3})+)[.,]\s*(?=[₺€£]|tl\b|try\b)/giu, "$1 ")
    .replace(/([₺$€£])\s*(\d[\d.,]*(?:\s*(?:milyon|milyar|bin|mn|k)\b)?)/giu, (_, s: string, n: string) => `${n} ${kod[s]}`)
    .replace(/(\d)\s*([₺€£])/gu, (_, n: string, s: string) => `${n} ${kod[s]}`)
    .replace(/(\d)\s*\$(?!\d)/g, "$1 USD")
    .replace(/(\d)[.,]-\s*(tl\b)?/gi, "$1 TL")
    .replace(/(\d[\d.,]*)\s*m\s*(?=(tl|try|usd|eur|euro|dolar|gbp)\b)/gi, (_, n: string) => `${n.replace(".", ",")} milyon `);
}

export function hizliAyristir(metin0: string): HizliSonuc {
  const metin = paraNormalize(bosluklukBinlik(whatsappGurultusuTemizle(metin0))); // v3.17–v3.18: boşluklu binlik + WhatsApp sistem satırları
  const ham = metin.trim();
  const m = kucuk(ham);
  const bulunan: string[] = [];
  const ozellik: Record<string, unknown> = {};
  const bul = (ad: string) => bulunan.push(ad);

  // Portal / ilan no / telefon
  const url = ham.match(/https?:\/\/[^\s)]+/)?.[0] ?? null;
  const portal: HizliSonuc["portal"] = /sahibinden\.com|shbd\.io/.test(m) ? "SAHIBINDEN" : /emlakjet\.com/.test(m) ? "EMLAKJET" : /hepsiemlak\.com/.test(m) ? "HEPSIEMLAK"
    : /\bemlakjet\b/.test(m) ? "EMLAKJET" : /\bhepsiemlak\b/.test(m) ? "HEPSIEMLAK" : /\bsahibinden\.?com\b|ilan\s*no/.test(m) ? "SAHIBINDEN" : null;
  if (portal) bul("kaynak");
  const ilanNo = ham.match(/[İi]lan\s*(?:No|Numaras[ıi])\s*[:.#]?\s*(\d{6,12})/i)?.[1] ?? url?.match(/(\d{8,12})/)?.[1] ?? null;
  const telHam = ham.match(/(\+?90[\s-]?)?\(?0?5\d{2}\)?[\s-]?\d{3}[\s-]?\d{2}[\s-]?\d{2}/)?.[0] ?? null;
  const telefon = telHam ? "+90" + telHam.replace(/\D/g, "").replace(/^90/, "").replace(/^0/, "") : null;
  if (telefon) bul("telefon");
  // Telefonun hemen önündeki ad: "— Can Ö. 0544…" / "Mehmet K. 0533…"
  const kisiAdi = telHam ? ham.slice(Math.max(0, ham.indexOf(telHam) - 40), ham.indexOf(telHam)).replace(/.*\b(?:TL|TRY|USD|EUR|EURO|GBP)\b/u, "").match(/([A-ZÇĞİÖŞÜ][\p{L}]+\.?(?:\s+[A-ZÇĞİÖŞÜ][\p{L}]*\.?){0,2})\s*[:\-–—]?\s*$/u)?.[1] ?? null : null;

  // Şirket / ilan sahibi
  const sirket = ham.match(/([A-ZÇĞİÖŞÜ][\wÇĞİÖŞÜçğıöşü&.]*(?:\s+[A-ZÇĞİÖŞÜ][\wÇĞİÖŞÜçğıöşü&.]*){0,3}\s+(?:Emlak|Gayrimenkul|Gayrimenkul Danışmanlığı|Yatırım|Realty|Real Estate|İnşaat))\b/)?.[1]
    ?? ham.match(/\b(RE\/?MAX\s+\w+|Century\s*21\s*\w*|Coldwell\s+Banker\s*\w*|Turyap\s*\w*)/i)?.[1] ?? null;
  if (sirket) bul("şirket");
  const ilanSahibiTipi: HizliSonuc["ilanSahibiTipi"] = /kimden\s*:?\s*sahibinden|sahibinden\s+(sat[ıi]l[ıi]k|kiral[ıi]k)|m[üu]lk\s*sahibi(yim)?\b/.test(m) ? "MALIK" : sirket || /emlak(ç[ıi]|\s*ofisi)|kimden\s*:?\s*emlak/.test(m) ? "EMLAKCI" : portal ? "PORTAL" : null;

  // İşlem
  let islemTipi: string | null = /devren\s*kiral[ıi]k|devren/.test(m) ? "DEVREN_KIRALIK" : /kiral[ıi]k|kiraya|\bkira\b|ayl[ıi]k/.test(m) ? "KIRALIK" : /sat[ıi]l[ıi]k|sat[ıi][şs]|sat[ıi]l[ıi]r|al[ıi]c[ıi]|sat[ıi]n\s*al/.test(m) ? "SATILIK" : null;
  if (islemTipi) bul("işlem");

  // Mülk tipi
  let mulkTipi = TIP_SOZLUK.find(([re]) => re.test(m))?.[1] ?? null;
  const oda = m.match(/\b(\d{1,2})\s*\+\s*(\d)\b/);
  let odaSayisi = oda ? `${oda[1]}+${oda[2]}` : /st[üu]dyo|1\s*\+\s*0/.test(m) ? "1+0" : null;
  if (!mulkTipi && odaSayisi) mulkTipi = "DAIRE";
  let aileKodu = AILE_SOZLUK.find(([re]) => re.test(m))?.[1] ?? null;
  if (mulkTipi) bul("mülk tipi");
  if (odaSayisi) bul("oda");

  // Tip (portföy / talep)
  const tIpucu = TALEP_IPUCU.test(m), pIpucu = PORTFOY_IPUCU.test(m) || !!portal || !!ilanNo;
  let tip: HizliSonuc["tip"] = tIpucu && !(portal || ilanNo) ? "TALEP" : pIpucu ? "PORTFOY" : tIpucu ? "TALEP"
    : /\d\s*(tl|₺|euro|€|usd|\$|milyon|bin)/.test(m) ? "PORTFOY" : null; // fiyat yazılmış, arama ifadesi yok → ilan

  // m²
  let m2: number | null = null, minM2: number | null = null, maxM2: number | null = null;
  const aralik = m.match(/(\d[\d.,]*)\s*(?:-|–|ile|ila)\s*(\d[\d.,]*)\s*(?:m2|m²|mt2|metrekare|metre\s*kare)/);
  const tek = [...m.matchAll(/(?:(min(?:imum)?|en\s*az|en\s*fazla|max(?:imum)?)\s*)?(\d[\d.,]*)\s*(?:m2|m²|mt2|metrekare|metre\s*kare|m\s*kare)(\s*(?:[üu]st[üu]|[üu]zeri|ve\s*[üu]zeri|alt[ıi]))?/g)];
  const donum = m.match(/(\d[\d.,]*)\s*d[öo]n[üu]m/);
  if (aralik) { minM2 = sayiOku(aralik[1]); maxM2 = sayiOku(aralik[2]); }
  else if (tek.length) {
    const [, on, sayi, son] = tek[0]; const n = sayiOku(sayi);
    if (/fazla|max|alt/.test((on ?? "") + (son ?? ""))) maxM2 = n; else if (/min|az|[üu]st|[üu]zeri/.test((on ?? "") + (son ?? ""))) minM2 = n; else m2 = n;
    const kapali = m.match(/(\d[\d.,]*)\s*m[2²]\s*kapal[ıi]/), acik = m.match(/(\d[\d.,]*)\s*m[2²]\s*a[çc][ıi]k/);
    if (kapali) ozellik.kapaliAlanM2 = sayiOku(kapali[1]);
    if (acik) ozellik.acikAlanM2 = sayiOku(acik[1]);
  } else if (donum) m2 = (sayiOku(donum[1]) ?? 0) * 1000;
  const m2Esnek = /civar[ıi]|yakla[şs][ıi]k|a[şs]a[ğg][ıi]\s*yukar[ıi]|±|gibi\b|esnek/.test(m) && (m2 != null || minM2 != null || maxM2 != null);
  if (m2 != null || minM2 != null || maxM2 != null) bul("alan");

  // Fiyat
  const p = paralar(m);
  let fiyat: number | null = null, minFiyat: number | null = null, maxFiyat: number | null = null;
  const paraBirimi = p[0]?.para ?? "TRY";
  if (p.length) {
    const aday = p.filter((x) => x.acik).length ? p.filter((x) => x.acik) : p;
    if (tip === "TALEP") maxFiyat = Math.max(...aday.map((x) => x.deger)); else fiyat = (aday.find((x) => !x.kadar) ?? aday[0]).deger;
    bul("fiyat");
  }
  // İşlem yazılmamışsa tahmin: arsa/tarla ya da yatırım → satılık; ticari mülkte fiyat düzeyi (≤ 1,5 milyon ≈ aylık kira)
  let islemTahmini = false;
  if (!islemTipi) {
    const f = fiyat ?? maxFiyat;
    if (/^(ARSA|TARLA|ZEYTINLIK|BAG_BAHCE)$/.test(mulkTipi ?? "") || /yat[ıi]r[ıi]m|sat[ıi]n\s*al|almak/.test(m)) islemTipi = "SATILIK";
    else if (f != null) islemTipi = f <= (paraBirimi === "TRY" ? 1_500_000 : 6_000) ? "KIRALIK" : "SATILIK"; // döviz: 80.000 USD aylık kira olamaz
    if (islemTipi) { islemTahmini = true; bul("işlem (tahmin)"); }
  }
  const kiralik = islemTipi === "KIRALIK" || islemTipi === "DEVREN_KIRALIK";
  const fiyatPeriyodu: HizliSonuc["fiyatPeriyodu"] = !p.length ? null : kiralik ? "AYLIK" : "TOPLAM";

  // Talepte tek m² → alt sınır (±%10 toleransla eşleşir)
  if (tip === "TALEP" && m2 != null) { minM2 = m2; m2 = null; }

  const kayitAlanlari: Record<string, unknown> = {}; // v3.17 — jargondan gelen kayıt alanları (krediyeUygun, takasaAcik)
  // Teknik alanlar
  const kw = m.match(/(\d[\d.,]*)\s*(kw|kilovat)/), kva = m.match(/(\d[\d.,]*)\s*kva/);
  if (kw) ozellik.elektrikGucuKw = sayiOku(kw[1]);
  if (kva) ozellik.trafoGucuKva = sayiOku(kva[1]);
  const yuk = m.match(/(?:y[üu]kseklik|tavan|makas\s*alt[ıi])[^\d]{0,12}(\d[\d.,]*)\s*(?:m|metre)?|(\d[\d.,]*)\s*(?:m|metre)\s*(?:y[üu]kseklik|tavan|net\s*y[üu]kseklik|makas)/);
  if (yuk) ozellik[/makas/.test(yuk[0]) ? "makasAltiYukseklikM" : "netYukseklikM"] = sayiOku(yuk[1] ?? yuk[2]);
  if (/\bt[ıi]r\b/.test(m)) ozellik.aracErisimi = "TIR"; else if (/kamyon\b/.test(m)) ozellik.aracErisimi = "KAMYON";
  if (/rampa/.test(m)) ozellik.rampa = true;
  const vinc = m.match(/(\d+)\s*ton(luk)?\s*vin[çc]|vin[çc]/);
  if (vinc) { ozellik.vinc = true; if (vinc[1]) ozellik.vincKapasitesiTon = Number(vinc[1]); }
  if (/so[ğg]uk\s*hava/.test(m)) ozellik.sogukHava = true;
  if (/g[ıi]daya\s*uygun/.test(m)) ozellik.gidayaUygun = true;
  if (/sanayi\s*elektri|trifaze/.test(m)) ozellik.sanayiElektrigi = true;
  if (/ruhsatl[ıi]/.test(m)) ozellik.ruhsatDurumu = "RUHSATLI";
  if (/iskanl[ıi]|iskan\s*var/.test(m)) ozellik.iskan = true;
  if (/yang[ıi]n\s*(sistem|s[öo]nd[üu]rme)/.test(m)) ozellik.yanginSistemi = true;
  if (/sprinkler/.test(m)) ozellik.sprinkler = true;
  if (/k[öo][şs]e\b/.test(m)) ozellik.koseKonum = true;
  if (/vitrin/.test(m)) ozellik.vitrin = true;
  const cephe = m.match(/(\d+[.,]?\d*)\s*(?:m|metre)\s*(?:vitrin|cephe)/);
  if (cephe) ozellik.cepheUzunluguM = sayiOku(cephe[1]);
  if (/ana\s*cadde/.test(m)) ozellik.anaCaddeUzeri = true;
  if (/e[şs]yas[ıi]z/.test(m)) ozellik.esyaDurumu = "ESYASIZ"; else if (/e[şs]yal[ıi]/.test(m)) ozellik.esyaDurumu = "ESYALI";
  if (/asans[öo]r/.test(m)) ozellik.asansor = true;
  if (/site\s*i[çc]i/.test(m)) ozellik.siteIcinde = true;
  if (/havuz/.test(m)) ozellik.havuz = true;
  if (/deniz\s*manzara/.test(m)) ozellik.denizManzarasi = true;
  const amac = tip === "TALEP" ? AMAC_SOZLUK.filter(([re]) => re.test(m)).map(([, a]) => a) : [];
  if (amac.length) ozellik.kullanimAmaclari = [...new Set(amac)];
  // ───── v3.17 — jargon sözlüğü (docs/emlak_jargon.md): kat, bina yaşı, emsal ve anahtar kelimeler
  const kat = katOku(m);
  if (kat.bulunduguKat != null) ozellik.bulunduguKat = kat.bulunduguKat;
  if (kat.katSayisi != null) ozellik.katSayisi = kat.katSayisi;
  const yas = binaYasiOku(m);
  if (yas != null) ozellik.binaYasi = yas;
  const emsal = emsalOku(m);
  if (emsal != null) ozellik.emsalKaks = emsal;
  const istenenKat = katJargonu(m);
  if (istenenKat.length) { if (tip === "TALEP") ozellik.istenenKatlar = istenenKat; else if (ozellik.bulunduguKat == null && istenenKat.includes("0")) ozellik.bulunduguKat = 0; }
  const cepheler = cepheYonleriOku(m);
  if (cepheler.length) ozellik.cepheYonleri = cepheler;
  const jargonNotlari: string[] = [];
  for (const k of JARGON_ALANLI) {
    if (!k.re.test(m)) continue;
    if (k.kayitAlani) kayitAlanlari[k.alan!] = k.deger;
    else if (k.alan && ozellik[k.alan] == null) ozellik[k.alan] = k.deger;
  }
  // Alan karşılığı olmayan jargon kaybolmasın: "Notlar" alanına yazılır
  for (const k of JARGON_NOTLUK) if (k.re.test(m)) jargonNotlari.push(k.not);

  if (Object.keys(ozellik).length) bul("teknik");

  // v3.17 — fiyat jargonu: "15.5 TL" satılıkta 15.500.000, "25" kirada 25.000 (bkz. docs/emlak_jargon.md)
  const kiraMi = /KIRALIK/.test(islemTipi ?? "") || fiyatPeriyodu === "AYLIK";
  const duzelt = (x: number | null) => (x == null ? x : fiyatDuzelt(x, { kira: kiraMi }) ?? x);
  fiyat = duzelt(fiyat); maxFiyat = duzelt(maxFiyat); minFiyat = duzelt(minFiyat);

  // v3.18 — grupta çoğu ilan yalnızca bağlantı olarak paylaşılıyor; adresteki bilgiler eksikleri tamamlar
  if (url) {
    const b = baglantidanOku(url);
    if (b.tip && !tip) { tip = b.tip; bulunan.push("tip"); }
    if (b.mulkTipi && !mulkTipi) { mulkTipi = b.mulkTipi; bulunan.push("mülk tipi"); }
    if (b.islemTipi && !islemTipi) { islemTipi = b.islemTipi; bulunan.push("işlem"); }
    if (b.odaSayisi && !odaSayisi) odaSayisi = b.odaSayisi;
  }

  const aciliyet = /\bacil\b/.test(m) ? "ACIL" : null;
  const eksik: string[] = [];
  if (!tip) eksik.push("portföy mü talep mi");
  if (!mulkTipi) eksik.push("mülk tipi");
  if (!islemTipi) eksik.push("satılık / kiralık");
  if (fiyat == null && maxFiyat == null && m2 == null && minM2 == null && maxM2 == null && !odaSayisi) eksik.push("fiyat veya alan");
  return {
    tur: metinTuru(ham), tip, mulkTipi, aileKodu, islemTipi, fiyat, minFiyat, maxFiyat, fiyatPeriyodu, paraBirimi, m2, minM2, maxM2, m2Esnek, odaSayisi,
    telefon, kisiAdi, portal, portalUrl: url, ilanNo, sirket, ilanSahibiTipi, aciliyet, islemTahmini, ozellik, bulunan, eksik, yeterli: eksik.length === 0,
    jargonNotlari, kayitAlanlari,
  };
}

/** Soru → sorgu filtresi (veritabanı modele gönderilmez; bu filtreyle kod sorgular) */
export interface SoruFiltresi {
  hedef: "PORTFOY" | "TALEP";
  aileler: string[];
  islemler: string[];
  m2Min: number | null;
  m2Max: number | null;
  fiyatMax: number | null;
  fiyatMin: number | null;
  odalar: string[];
  acil: boolean;
  ozellik: Record<string, unknown>;
  anlasilan: string[];
}
export function soruFiltresi(soru: string): SoruFiltresi {
  const m = kucuk(soru);
  const h = hizliAyristir(soru);
  const aileler = [...new Set(AILE_SOZLUK.filter(([re]) => re.test(m)).map(([, a]) => a))];
  const islemler = h.islemTipi ? [h.islemTipi] : [];
  let m2Min: number | null = null, m2Max: number | null = null;
  const mm = m.match(/(\d[\d.,]*)\s*(?:m2|m²|metrekare|metre\s*kare)?\s*(?:ve\s*)?([üu]st[üu]|[üu]zeri|fazla|b[üu]y[üu]k|alt[ıi]|az|k[üu][çc][üu]k)/);
  const mr = m.match(/(\d[\d.,]*)\s*(?:-|–|ile|ila)\s*(\d[\d.,]*)\s*(?:m2|m²|metrekare)/);
  if (mr) { m2Min = sayiOku(mr[1]); m2Max = sayiOku(mr[2]); }
  else if (mm && /m2|m²|metre|\d{3,}/.test(mm[0])) { const n = sayiOku(mm[1]); if (/alt|az|k[üu][çc]/.test(mm[2])) m2Max = n; else m2Min = n; }
  else if (h.m2 != null || h.minM2 != null) m2Min = h.m2 ?? h.minM2;
  if (h.maxM2 != null && m2Max == null) m2Max = h.maxM2;
  const para = paralar(m);
  const fiyatMax = para.find((p) => p.kadar || /alt|ucuz/.test(m))?.deger ?? null;
  const fiyatMin = !fiyatMax && para.length && /[üu]st[üu]|[üu]zeri/.test(m) ? para[0].deger : null;
  const hedef: SoruFiltresi["hedef"] = /talep|m[üu][şs]teri|arayan|alıcı|al[ıi]c[ıi]/.test(m) ? "TALEP" : "PORTFOY";
  const anlasilan = [
    ...aileler.map((a) => "tür"), ...(islemler.length ? ["işlem"] : []), ...(m2Min != null || m2Max != null ? ["alan"] : []), ...(fiyatMax != null || fiyatMin != null ? ["fiyat"] : []),
  ];
  const ozellik: Record<string, unknown> = {};
  for (const k of ["elektrikGucuKw", "aracErisimi", "rampa", "sogukHava", "gidayaUygun", "vinc", "netYukseklikM", "esyaDurumu"]) if (h.ozellik[k] != null) ozellik[k] = k === "aracErisimi" || k === "esyaDurumu" ? [h.ozellik[k]] : h.ozellik[k];
  if (Object.keys(ozellik).length) anlasilan.push("teknik");
  return { hedef, aileler, islemler, m2Min, m2Max, fiyatMax, fiyatMin, odalar: h.odaSayisi ? [h.odaSayisi] : [], acil: /\bacil\b/.test(m), ozellik, anlasilan: [...new Set(anlasilan)] };
}

// ───────── Metinden konum ifadeleri ─────────
const KONUM_DOLGU = new Set(["merkez", "yeni", "sanayi", "cumhuriyet", "ataturk", "istiklal", "yesil", "gunes", "bahce", "liman", "cay", "fatih", "hurriyet", "zafer", "kultur", "dogan", "site", "cadde", "sahil", "koy", "deniz", "ova", "tepe", "bati", "dogu"]);
/** v3.9 — konum sözlüğü indeks başına bir kez kurulur (yorumlayıcı aynı metinde bu işlevi onlarca kez çağırır). */
const SOZLUK_ONBELLEK = new WeakMap<LokasyonIndeks, { n: number; ad: Map<string, { tur: "ILCE" | "ALT" | "ALIAS" | "MAH"; ilceId: number | null }>; mahSayisi: Map<string, number> }>();
function konumSozlugu(ix: LokasyonIndeks) {
  const c = SOZLUK_ONBELLEK.get(ix);
  if (c && c.n === ix.aliaslar.length) return c;
  const ad = new Map<string, { tur: "ILCE" | "ALT" | "ALIAS" | "MAH"; ilceId: number | null }>();
  const koy = (s: string, v: { tur: "ILCE" | "ALT" | "ALIAS" | "MAH"; ilceId: number | null }) => { const k = lokasyonAnahtari(s); if (k.length >= 3 && !ad.has(k)) ad.set(k, v); };
  ix.ilceler.forEach((i) => koy(i.ad, { tur: "ILCE", ilceId: i.id }));
  ix.altBolgeler.forEach((b) => koy(b.ad, { tur: "ALT", ilceId: b.ilceId }));
  ix.aliaslar.forEach((a) => koy(a.alias, { tur: "ALIAS", ilceId: a.ilceId }));
  const mahSayisi = new Map<string, number>();
  ix.mahalleler.forEach((mh) => { const k = lokasyonAnahtari(mh.ad); mahSayisi.set(k, (mahSayisi.get(k) ?? 0) + 1); });
  ix.mahalleler.forEach((mh) => koy(mh.ad, { tur: "MAH", ilceId: mh.ilceId }));
  const v = { n: ix.aliaslar.length, ad, mahSayisi };
  SOZLUK_ONBELLEK.set(ix, v);
  return v;
}

/**
 * Metinde geçen konum adlarını bulur: ilçe, alt bölge, sözlük/referans nokta ve mahalle adları.
 * Tek kelimelik yaygın mahalle adları (Liman, Merkez…) yalnızca aynı ilçe metinde geçiyorsa ya da ardından "mah." geliyorsa alınır.
 * Yan yana bulunan adlar birleştirilir ("Konyaaltı Liman" → çözücü ilçe + mahalle olarak çözer).
 */
export function metindenKonumlar(metin: string, ix: LokasyonIndeks): string[] {
  const kelimeler = metin.replace(/[’']\p{L}+/gu, " ").split(/[^\p{L}\d]+/u).filter(Boolean);
  const anah = kelimeler.map((k) => lokasyonAnahtari(k));
  const { ad, mahSayisi } = konumSozlugu(ix);
  const metinIlceleri = new Set<number>();
  anah.forEach((k) => { const v = ad.get(k); if (v?.tur === "ILCE" && v.ilceId) metinIlceleri.add(v.ilceId); });
  const eslesen: { bas: number; son: number; tur?: string }[] = [];
  for (let i = 0; i < anah.length; ) {
    let bulundu = 0;
    for (let n = Math.min(4, anah.length - i); n >= 1; n--) {
      const k = anah.slice(i, i + n).join(" "), v = ad.get(k);
      if (!v) continue;
      if (v.tur === "MAH" && n === 1) {
        const sonraki = anah[i + 1] ?? "";
        const mahEki = /^(mah|mh|mahalle\p{L}*)$/u.test(sonraki); // v3.12: "mahallesinde / mahallesinden…" ekleri de
        const ilceVar = !!v.ilceId && metinIlceleri.has(v.ilceId);
        // yaygın ad (Liman, Merkez…) ya da birden çok ilçede aynı ad → ilçe metinde yoksa alma
        const bitisik = eslesen.length > 0 && eslesen[eslesen.length - 1].son === i;
        if (!mahEki && !ilceVar && (KONUM_DOLGU.has(k) || (mahSayisi.get(k) ?? 0) > 1 || k.length < 5)) continue;
        if (!mahEki && KONUM_DOLGU.has(k) && !bitisik) continue; // "deniz manzaralı", "sanayi elektriği" konum değildir
        if (!mahEki && !ilceVar && /^(bey|hanim|hn|abi|abla|hoca|usta)$/.test(sonraki)) continue; // v3.10 — "Aydın Bey", "Selçuk Hoca" kişi adıdır
      }
      if (v.tur === "MAH" && n > 1 && KONUM_DOLGU.has(anah[i]) && !(v.ilceId && metinIlceleri.has(v.ilceId))) continue;
      bulundu = n; break;
    }
    if (bulundu) { eslesen.push({ bas: i, son: i + bulundu, tur: ad.get(anah.slice(i, i + bulundu).join(" "))?.tur }); i += bulundu; } else i++;
  }
  // bitişik eşleşmeleri birleştir
  const ifadeler: string[] = [];
  for (let j = 0; j < eslesen.length; j++) {
    let { bas, son } = eslesen[j];
    // v3.12 — "İlçe / alt bölge + mahalle" birleşir ("Muratpaşa Fener", "Lara Güzeloba"); iki mahalle adı yan yana ise ayrı yerdir ("Yenigün Kızıltoprak")
    while (j + 1 < eslesen.length && eslesen[j + 1].bas === son && eslesen[j].tur !== "MAH") son = eslesen[++j].son;
    ifadeler.push(kelimeler.slice(bas, son).join(" "));
  }
  return [...new Set(ifadeler)];
}