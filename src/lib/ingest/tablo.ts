/**
 * Anahtar CRM v3.23 · 10 Ekim 2026
 * Toplu dosya içe aktarma (Excel / CSV / TXT): portal ilan listeleri, meslektaşın gönderdiği portföy/talep listesi,
 * ofisin haftalık talep tablosu… Başlık satırı nerede olursa olsun bulunur, sütunlar eş anlamlılarla eşlenir,
 * her satır kurala dayalı olarak kayda çevrilir. YAPAY ZEKÂ KULLANILMAZ:
 *   - yapılandırılmış sütunlar (fiyat, m², ilçe, oda…) zaten veridir; yapay zekâ hata ve maliyet ekler,
 *   - serbest metin sütunu (Nitelik, Açıklama) kural tabanlı hızlı ayrıştırıcıdan geçer (src/lib/ai/hizli-ayristirici.ts),
 *   - eksik kalan satırlar "Kontrol gerekli"ye düşer; kullanıcı formda tamamlar.
 * Saf fonksiyonlar: demo ve sunucu (POST /api/ingest/tablo) aynı kodu kullanır.
 */
import { hizliAyristir } from "../ai/hizli-ayristirici";
import { islemKategoriUyumlu, anaKategoriOf } from "../domain/kategori";
import { telE164, cepMi } from "../senkron/birlestir";
import type { KayitCreateInput } from "../validation/kayit";

export type TabloAlan =
  | "tarih" | "anaKategori" | "mulkTuru" | "islem" | "m2" | "fiyat" | "ilkFiyat" | "butceMin" | "butceMax" | "baslik"
  | "il" | "ilce" | "semt" | "mahalle" | "konum" | "oda" | "kat" | "toplamKat" | "binaYasi" | "site" | "kullanim" | "devren" | "esyali"
  | "ilanSahibiTuru" | "ilanSahibi" | "ofis" | "telefon" | "ilanDurumu" | "kaynak" | "url" | "ilanNo" | "aciklama" | "ad" | "yok";

export const ALAN_ETIKET: Record<TabloAlan, string> = {
  tarih: "İlan / kayıt tarihi", anaKategori: "Ana kategori (Konut/Ticari/Arsa)", mulkTuru: "Mülk türü", islem: "Satılık / kiralık", m2: "m²", fiyat: "Fiyat",
  ilkFiyat: "İlk fiyat", butceMin: "Bütçe (en az)", butceMax: "Bütçe (en fazla)", baslik: "Başlık", il: "İl", ilce: "İlçe", semt: "Semt", mahalle: "Mahalle",
  konum: "Konum / bölge (serbest)", oda: "Oda sayısı", kat: "Bulunduğu kat", toplamKat: "Bina kat sayısı", binaYasi: "Bina yaşı", site: "Site içinde",
  kullanim: "Kullanım durumu", devren: "Devren", esyali: "Eşyalı", ilanSahibiTuru: "İlan sahibi türü (sahibi / ofis)", ilanSahibi: "İlan sahibi / danışman",
  ofis: "Ofis / firma", telefon: "Telefon", ilanDurumu: "İlan durumu", kaynak: "Kaynak (portal)", url: "İlan bağlantısı", ilanNo: "İlan no",
  aciklama: "Açıklama / nitelik (serbest metin)", ad: "Müşteri adı", yok: "— Kullanma —",
};

const kucuk = (s: string) => s.toLocaleLowerCase("tr").replace(/\u00a0/g, " ").replace(/[^\p{L}\p{N}²/+ ]/gu, " ").replace(/\s+/g, " ").trim();
/** Başlık eş anlamlıları (küçük harf, noktalama yok). Sıra önemli: daha özel olan önce. */
const ES: [TabloAlan, RegExp][] = [
  ["ilanSahibiTuru", /^(ilan sahibi t[üu]r[üu]|kimden|ilan veren tipi|sahip tipi|ilan sahibi tipi)$/],
  ["ilanSahibi", /^(ilan sahibi|dan[ıi][şs]man|ilan veren|yetkili|emlak dan[ıi][şs]man[ıi])$/],
  ["ilkFiyat", /^(ilk fiyat|eski fiyat)$/], ["fiyat", /^(fiyat|sat[ıi][şs] fiyat[ıi]|kira bedeli|kira|tutar|bedel|fiyat tl)$/],
  ["butceMax", /^(max b[üu]t[çc]e|b[üu]t[çc]e max|maks b[üu]t[çc]e|[üu]st b[üu]t[çc]e|b[üu]t[çc]e)$/], ["butceMin", /^(min b[üu]t[çc]e|b[üu]t[çc]e min|alt b[üu]t[çc]e)$/],
  ["tarih", /^(ilan tarihi|tarih|eklenme tarihi|yay[ıi]n tarihi|kay[ıi]t tarihi|date)$/],
  ["anaKategori", /^(m[üu]lk tipi|kategori|emlak tipi|ana kategori)$/], ["mulkTuru", /^(m[üu]lk t[üu]r[üu]|t[üu]r|emlak t[üu]r[üu]|tip|cins|m[üu]lk|gayrimenkul t[üu]r[üu])$/],
  ["islem", /^([iı][şs]lem tipi|[iı][şs]lem|sat[ıi]l[ıi]k kiral[ıi]k|kiral[ıi]k sat[ıi]l[ıi]k|ilan tipi)$/],
  ["m2", /^(m2|m²|metrekare|br[üu]t m2|m2 br[üu]t|alan|br[üu]t|net m2|m2 net)$/],
  ["baslik", /^(ilan ba[şs]l[ıi][ğg][ıi]|ba[şs]l[ıi]k|title)$/], ["il", /^([iı]l|[şs]ehir)$/], ["ilce", /^([iı]l[çc]e)$/], ["semt", /^(semt|b[öo]lge alt)$/],
  ["mahalle", /^(mahalle|mah)$/], ["konum", /^(konum|b[öo]lge|lokasyon|adres|yer|hedef b[öo]lge)$/],
  ["oda", /^(oda say[ıi]s[ıi]|oda|oda b[öo]l[üu]m say[ıi]s[ıi])$/], ["toplamKat", /^(toplam kat say[ıi]s[ıi]|kat say[ıi]s[ıi]|bina kat say[ıi]s[ıi])$/],
  ["kat", /^(bulundu[ğg]u kat|kat|kat[ıi])$/], ["binaYasi", /^(bina ya[şs][ıi]|ya[şs])$/], ["site", /^(site i[çc]erisinde|site i[çc]inde|site)$/],
  ["kullanim", /^(kullan[ıi]m durumu)$/], ["devren", /^(devren mi|devren)$/], ["esyali", /^(e[şs]yal[ıi]|e[şs]ya)$/],
  ["ofis", /^(ofis|emlak ofisi|firma|ma[ğg]aza|[şs]irket)$/], ["telefon", /^(telefon|tel|gsm|cep|cep telefonu|phone)$/],
  ["ilanDurumu", /^(ilan durumu|durum)$/], ["kaynak", /^(ilan kayna[ğg][ıi]|kaynak|portal)$/], ["url", /^(ilan url|url|link|ba[ğg]lant[ıi]|ilan linki)$/],
  ["ilanNo", /^(ilan no|ilan numaras[ıi]|ilan id)$/], ["aciklama", /^(a[çc][ıi]klama|nitelik|notlar|not|detay|[öo]zellikler|ne ar[ıi]yor|talep)$/],
  ["ad", /^([iı]sim soy[iı]s[iı]m|[iı]sim|ad soyad|ad[ıi] soyad[ıi]|m[üu][şs]teri|m[üu][şs]teri ad[ıi])$/],
];
export function baslikAlani(h: string): TabloAlan | null { const k = kucuk(h); return k ? ES.find(([, re]) => re.test(k))?.[0] ?? null : null; }

export interface Eslesme { baslikSatiri: number; sutunlar: TabloAlan[]; basliklar: string[] }

const ISLEM_RE = /^(sat[ıi]l[ıi]k|kiral[ıi]k|devren( sat[ıi]l[ıi]k| kiral[ıi]k)?|kat kar[şs][ıi]l[ıi][ğg][ıi])$/;
/** Başlık satırını ilk 15 satırda arar (Excel'de tablo 3. sütundan başlıyor olabilir); başlıksız sütunu içeriğinden tanır */
export function sutunlariEsle(satirlar: string[][]): Eslesme | null {
  let en: { i: number; n: number } = { i: -1, n: 0 };
  satirlar.slice(0, 15).forEach((s, i) => { const n = s.filter((h) => baslikAlani(h ?? "")).length; if (n > en.n) en = { i, n }; });
  if (en.n < 2) return null;
  const bas = satirlar[en.i];
  const govde = satirlar.slice(en.i + 1, en.i + 60);
  const genislik = Math.max(bas.length, ...govde.map((s) => s.length));
  const kullanilan = new Set<TabloAlan>();
  const sutunlar = Array.from({ length: genislik }, (_, j): TabloAlan => {
    let a = baslikAlani(bas[j] ?? "");
    const degerler = govde.map((s) => kucuk(s[j] ?? "")).filter(Boolean);
    if (!a && degerler.length && degerler.filter((d) => ISLEM_RE.test(d)).length / degerler.length > 0.6) a = "islem";
    // "Mülk tipi" bazen Konut/Ticari (ana kategori), bazen Depo/Daire (tür) taşır → içeriğe bak
    if (a === "anaKategori" && degerler.length && degerler.filter((d) => /^(konut|ticari|arsa|i[şs]yeri|turistik|bina|devre m[üu]lk)$/.test(d)).length / degerler.length < 0.6) a = "mulkTuru";
    if (!a || kullanilan.has(a)) return "yok";
    kullanilan.add(a); return a;
  });
  return { baslikSatiri: en.i, sutunlar, basliklar: Array.from({ length: genislik }, (_, j) => bas[j] ?? "") };
}

// ───────── Değer okuyucular ─────────
/** "3.500.000 TL" → 3500000 · "9750000" → 9750000 · "5,5 milyon" → 5500000 · "20.000.0000" → şüpheli */
export function paraOku(ham: string): { deger: number | null; supheli: boolean; not: string | null } {
  const s = (ham ?? "").trim();
  if (!s) return { deger: null, supheli: false, not: null };
  const k = kucuk(s);
  if (/b[üu]t[çc]e de[ğg]erinde|g[öo]r[üu][şs][üu]l[üu]r|belirtilmemi|pazarl[ıi]k/.test(k) && !/\d/.test(k)) return { deger: null, supheli: false, not: s };
  const h = hizliAyristir(s.includes(" ") || /[a-zçğıöşü]/i.test(s) ? s : s + " TL");
  const m = s.match(/\d[\d.,\s]*/)?.[0].trim() ?? "";
  const gruplar = m.split(".");
  const supheli = gruplar.length > 1 && gruplar.slice(1).some((g) => g.replace(/\D/g, "").length !== 3);
  let deger = h.maxFiyat ?? h.fiyat ?? null;
  if (deger == null && /^\d+([.,]\d+)?$/.test(m.replace(/\s/g, ""))) deger = Number(m.replace(/\s/g, "").replace(",", "."));
  if (deger == null && m) deger = Number(m.replace(/\D/g, "")) || null;
  return { deger, supheli, not: /nakit/.test(k) ? "Nakit" : null };
}
const sayiOku = (s?: string) => { const m = (s ?? "").replace(/\./g, "").replace(",", ".").match(/\d+(\.\d+)?/); return m ? Number(m[0]) : null; };
export function katOku(s?: string): number | null {
  const k = kucuk(s ?? "");
  if (!k || /m[üu]stakil|villa/.test(k)) return null;
  if (/giri[şs]|zemin|bah[çc]e|y[üu]ksek giri/.test(k)) return 0;
  if (/kot|bodrum/.test(k)) return -(sayiOku(k) ?? 1);
  if (/[çc]at[ıi]|en [üu]st/.test(k)) return null;
  const n = sayiOku(k); return n != null && n <= 150 ? Math.round(n) : null;
}
export function yasOku(s?: string): number | null {
  const m = (s ?? "").match(/(\d+)\s*[-–]\s*(\d+)/); if (m) return Math.round((+m[1] + +m[2]) / 2);
  const n = sayiOku(s); return n != null && n <= 300 ? Math.round(n) : null;
}
const evet = (s?: string) => { const k = kucuk(s ?? ""); return /^(evet|var|1|true|e)$/.test(k) ? true : /^(hay[ıi]r|yok|0|false|h)$/.test(k) ? false : null; };
export function tarihOku(s?: string): Date | null {
  const m = (s ?? "").match(/(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})/); if (m) { const y = +m[3] < 100 ? 2000 + +m[3] : +m[3]; const d = new Date(y, +m[2] - 1, +m[1], 12); return isNaN(+d) ? null : d; }
  const iso = (s ?? "").match(/^(\d{4})-(\d{2})-(\d{2})/); return iso ? new Date(+iso[1], +iso[2] - 1, +iso[3], 12) : null;
}

const TUR_EK: Record<string, string> = { bina: "KOMPLE_BINA", "komple bina": "KOMPLE_BINA", konut: "DAIRE", "toplu konut": "DAIRE", "ticari konut": "DAIRE", "residence": "REZIDANS", "rezidans": "REZIDANS", arsa: "ARSA", "i̇mar arsa": "ARSA" };
/**
 * v3.23 — Portal dökümlerindeki (Revy · Sahibinden · Hepsiemlak · Emlakjet) "Mülk türü" sütunu kategori adıdır: birebir karşılanır,
 * serbest metin ayrıştırıcısına bırakılmaz ("Spor Tesisi" → daire, "Pazar Yeri" → diğer çıkıyordu). Anahtarlar `kucuk()` biçimindedir.
 */
const PORTAL_TUR: Record<string, string> = {
  daire: "DAIRE", "müstakil ev": "MUSTAKIL_EV", villa: "VILLA", "çiftlik evi": "CIFTLIK_EVI", "köşk konak": "KOSK_KONAK", "yalı": "YALI", "yalı dairesi": "YALI",
  "yazlık": "YAZLIK", "prefabrik ev": "PREFABRIK_EV", kooperatif: "KOOPERATIF",
  "apartman dairesi": "OFIS_APARTMAN_DAIRESI", "atölye": "ATOLYE", avm: "AVM", "büfe": "BUFE_KANTIN", kantin: "BUFE_KANTIN", "büro ofis": "BURO_OFIS", "çiftlik": "CIFTLIK",
  "depo antrepo": "DEPO_ANTREPO", "düğün salonu": "DUGUN_SALONU", "dükkan mağaza": "DUKKAN_MAGAZA", "enerji santrali": "ENERJI_SANTRALI",
  "fabrika üretim tesisi": "FABRIKA_URETIM_TESISI", "garaj park yeri": "OTOPARK_GARAJ", "otopark garaj": "OTOPARK_GARAJ", "imalathane": "IMALATHANE",
  "iş hanı katı ofisi": "IS_HANI_KATI", "kafe bar": "CAFE_BAR", "kıraathane": "CAFE_BAR", "kır kahvaltı bahçesi": "KIR_KAHVALTI_BAHCESI", "maden ocağı": "MADEN_OCAGI",
  "oto yıkama kuaför": "OTO_YIKAMA", "pastane fırın tatlıcı": "PASTANE_FIRIN", "pazar yeri": "PAZAR_YERI", plaza: "PLAZA", "plaza katı ofisi": "PLAZA_KATI_OFIS", "plaza katı": "PLAZA_KATI_OFIS",
  "restoran lokanta": "RESTORAN_LOKANTA", "rezidans katı ofisi": "REZIDANS_KATI_OFIS", "sağlık merkezi": "SAGLIK_MERKEZI_KLINIK", "sinema konferans salonu": "SINEMA_KONFERANS",
  "spa hamam sauna": "SPA_HAMAM", "spor tesisi": "SPOR_TESISI", yurt: "YURT", "akaryakıt istasyonu": "AKARYAKIT_ISTASYONU", "soğuk hava deposu": "SOGUK_HAVA_DEPOSU",
  otel: "OTEL", "apart otel": "APART_OTEL", "butik otel": "BUTIK_OTEL", motel: "MOTEL", pansiyon: "PANSIYON", "kamp yeri": "KAMP_ALANI", "tatil köyü": "TATIL_KOYU", "devre mülk": "DEVRE_MULK",
};
/** Arsa kategorisinde "Mülk türü" sütunu İMAR durumudur ("Konut", "Villa", "Ticari"): mülk tipi arsa kalır, imar ayrıca yazılır */
const ARSA_TUR: Record<string, string> = { tarla: "TARLA", "bağ": "BAG_BAHCE", "bahçe": "BAG_BAHCE", "bağ bahçe": "BAG_BAHCE", zeytinlik: "ZEYTINLIK" };
const ARSA_IMAR: [RegExp, string][] = [
  [/^ticari konut|^konut ticari/, "TICARI_KONUT"], [/^(konut|toplu konut|villa)/, "KONUT"], [/^ticari/, "TICARI"], [/sanayi/, "SANAYI"], [/depo/, "DEPO_ANTREPO"],
  [/turizm konut/, "TURIZM_KONUT"], [/turizm ticari/, "TURIZM_TICARI"], [/turizm/, "TURIZM"], [/^tarla/, "TARLA"], [/^ba[ğg]|^bah[çc]e/, "BAG_BAHCE"], [/zeytin/, "ZEYTINLIK"],
  [/sera/, "SERA"], [/e[ğg]itim/, "EGITIM"], [/sa[ğg]l[ıi]k/, "SAGLIK"], [/enerji/, "ENERJI"], [/[öo]zel kullan/, "OZEL_KULLANIM"], [/sit alan/, "SIT_ALANI"],
];
/** Türü yazılmamış ticari ilanın başlığındaki işletme adı ("devren kuaför", "butik", "tekel bayi") → iş yeri tipi */
const ISLETME: [RegExp, string][] = [
  [/oto y[ıi]kama/, "OTO_YIKAMA"], [/pastane|f[ıi]r[ıi]n|tatl[ıi]c[ıi]|b[öo]rek/, "PASTANE_FIRIN"], [/klinik|muayene|poliklinik|di[şs] hekim/, "SAGLIK_MERKEZI_KLINIK"],
  [/spor salon|pilates|fitness|hal[ıi] ?saha/, "SPOR_TESISI"], [/sauna|masaj|(^| )spa( |$)|hamam/, "SPA_HAMAM"], [/b[üu]fe|kantin/, "BUFE_KANTIN"], [/kre[şs]|ana ?okul/, "KRES"], [/d[üu][ğg][üu]n salon/, "DUGUN_SALONU"],
  [/butik|[şs]ark[üu]teri|kuaf[öo]r|berber|g[üu]zellik (merkez|salon)|k[ıi]rtasiye|market|tekel|bakkal|manav|kasap|eczane|[çc]i[ğg] ?k[öo]fte|d[öo]ner|kuru ?temizleme|[çc]ama[şs][ıi]rhane|terzi|bayi|acente|ma[ğg]aza|d[üu]kk[aâ]n|i[şs] ?yeri|i[şs]letme/, "DUKKAN_MAGAZA"],
];
const KONUT_TIPLERI = new Set(["DAIRE", "REZIDANS", "MUSTAKIL_EV", "VILLA", "CIFTLIK_EVI", "KOSK_KONAK", "YALI", "YAZLIK", "PREFABRIK_EV", "KOOPERATIF"]);
export function mulkTuruOku(tur?: string, ana?: string, metin?: string): { mulkTipi: string | null; tahmin: boolean; imar?: string | null } {
  const k = kucuk(tur ?? ""), a = kucuk(ana ?? "");
  // v3.23 — Arsa: "Mülk türü" imardır. Eskiden "Arsa / Villa" villa, "Arsa / Konut" daire oluyor, arsa ilanı konut talebiyle eşleşiyordu.
  if (a === "arsa") return { mulkTipi: ARSA_TUR[k] ?? "ARSA", tahmin: false, imar: ARSA_IMAR.find(([re]) => re.test(k))?.[1] ?? null };
  const ticari = /ticari|i[şs] ?yeri/.test(a);
  if (k) { const t = PORTAL_TUR[k] ?? TUR_EK[k] ?? hizliAyristir(tur!).mulkTipi; if (t) return { mulkTipi: t, tahmin: false }; }
  const h = metin ? hizliAyristir(metin) : null;
  if (h?.mulkTipi) {
    const konut = KONUT_TIPLERI.has(h.mulkTipi);
    // Sütun "Ticari" diyorsa başlıktan konut tipi, "Konut" diyorsa başlıktan iş yeri tipi çıkarılmaz (sütun daha güvenilir)
    if (!(ticari && konut) && !(a === "konut" && !konut)) return { mulkTipi: h.mulkTipi, tahmin: true };
    if (ticari && h.mulkTipi === "DAIRE") return { mulkTipi: "OFIS_APARTMAN_DAIRESI", tahmin: true };
  }
  if (ticari && metin) { const t = ISLETME.find(([re]) => re.test(kucuk(metin)))?.[1]; if (t) return { mulkTipi: t, tahmin: true }; }
  if (h?.odaSayisi || a === "konut") return { mulkTipi: "DAIRE", tahmin: true };
  return { mulkTipi: null, tahmin: true };
}
const SAHIP_TURU: [RegExp, string][] = [[/emlak|ofis|kurumsal|galeri|dan[ıi][şs]man/, "EMLAKCI"], [/sahib|malik|bireysel/, "MALIK"], [/banka|firma|[şs]irket/, "FIRMA"], [/in[şs]aat|m[üu]teahhit|proje/, "MUTEAHHIT"]];
export const sahipTuruOku = (s?: string) => { const k = kucuk(s ?? ""); return k ? SAHIP_TURU.find(([re]) => re.test(k))?.[1] ?? null : null; };
const KAYNAK: [RegExp, string][] = [[/sahibinden|shbd/, "SAHIBINDEN"], [/hepsi ?emlak/, "HEPSIEMLAK"], [/emlakjet/, "EMLAKJET"]];
export const kaynakOku = (s?: string) => { const k = kucuk(s ?? ""); return KAYNAK.find(([re]) => re.test(k))?.[1] ?? null; };
/** İlan bağlantısının sonundaki sayı ilan numarasıdır (sahibinden …/1342746857, emlakjet …-19915896) */
export const ilanNoOku = (url?: string) => (url ?? "").match(/(\d{6,})(?:\/detay)?\/?(?:[?#].*)?$/)?.[1] ?? null;
const MERKEZ = /^(antalya( geneli| genelinde| merkez| i[çc]i)?|genel|merkez|her yer|fark etmez)$/;

// ───────── Satır → kayıt taslağı ─────────
export type DosyaTuru = "PORTAL" | "MESLEKTAS" | "KENDI" | "TALEP_LISTESI";
export interface AktarimSecenek {
  tip: "PORTFOY" | "TALEP";
  dosyaTuru: DosyaTuru;
  /** Dosyada "ilan sahibi türü" sütunu yoksa hepsine uygulanır */
  varsayilanSahip: "MALIK" | "EMLAKCI" | "PARTNER";
  /** İlan geçerliliği (gün) — tarih sütunundan itibaren; tarih yoksa bugünden */
  ilanGun: number;
  varsayilanIslem: "SATILIK" | "KIRALIK";
  bugun: Date;
  dosyaAdi?: string;
}
export interface SatirSonucu {
  satirNo: number;
  durum: "HAZIR" | "KONTROL" | "BOS";
  girdi: Omit<KayitCreateInput, "lokasyonlar" | "kisiler">;
  /** Konum çözücüye verilecek parçalar ("Muratpaşa / Altındağ", "Fener", "Çağlayan") */
  konumlar: string[];
  ilGeneli: boolean;
  kisi: { adSoyad: string; telefon: string | null; sirket: string | null; roller: string[]; rol: "SAHIP" | "MUSTERI" | "EMLAKCI" } | null;
  sahipTuru: string;
  anahtar: string | null;
  kontrol: string[];
}

export function satirDonustur(s: string[], e: Eslesme, o: AktarimSecenek, satirNo: number): SatirSonucu {
  const v = {} as Partial<Record<TabloAlan, string>>;
  e.sutunlar.forEach((a, j) => { if (a !== "yok" && (s[j] ?? "").trim()) v[a] = (s[j] ?? "").replace(/\u00a0/g, " ").trim(); });
  const kontrol: string[] = [];
  const doluSayisi = Object.keys(v).length;
  const metin = [v.baslik, v.aciklama, v.mulkTuru].filter(Boolean).join(" · ");
  const h = metin ? hizliAyristir(metin) : null;
  const tip = o.tip;

  // Mülk tipi
  const mt = mulkTuruOku(v.mulkTuru, v.anaKategori, metin);
  if (!mt.mulkTipi) kontrol.push("Mülk tipi bulunamadı");
  else if (mt.tahmin && e.sutunlar.includes("mulkTuru")) kontrol.push("Mülk tipi metinden tahmin edildi");
  // İşlem
  const isK = kucuk(v.islem ?? "");
  let islem = /kat kar/.test(isK) ? "KAT_KARSILIGI" : /kiral/.test(isK) ? "KIRALIK" : /sat/.test(isK) ? "SATILIK" : h?.islemTipi ?? null;
  if (!islem) { islem = o.varsayilanIslem; if (!v.islem) kontrol.push(`İşlem belirtilmemiş (${o.varsayilanIslem === "SATILIK" ? "satılık" : "kiralık"} varsayıldı)`); }
  const ticari = /ticari|i[şs] ?yeri/.test(kucuk(v.anaKategori ?? "")) || /DUKKAN|OFIS|BURO|PLAZA|DEPO|FABRIKA|IMALAT|RESTORAN|CAFE/.test(mt.mulkTipi ?? "");
  // v3.23 — Devren: portal dökümünde "Devren mi" sütunu çoğu devren ilanda "Hayır" yazıyor; başlıktaki "devren / devir" daha güvenilir.
  const devren = ticari && (evet(v.devren) === true || /devren|devir/.test(kucuk(v.baslik ?? "")));
  let devirBedeli = false, devrenBelirsiz = false;
  if (devren && (mt.mulkTipi ? islemKategoriUyumlu(anaKategoriOf(mt.mulkTipi as any), "DEVREN_SATILIK" as any) : true) && (islem === "KIRALIK" || islem === "SATILIK")) {
    const f = paraOku(v.fiyat ?? "").deger, alan = sayiOku(v.m2);
    // "Devren kiralık" ilanında yazan tutar çoğunlukla aylık kira değil DEVİR BEDELİdir (36 m² butik 580.000 TL). Devir bedeli = toplam → Devren Satılık.
    if (islem === "KIRALIK" && f != null && f >= 150_000) { if (!alan || f / alan >= 1500) { islem = "DEVREN_SATILIK"; devirBedeli = true; } else { islem = "DEVREN_KIRALIK"; devrenBelirsiz = true; } }
    else islem = islem === "KIRALIK" ? "DEVREN_KIRALIK" : "DEVREN_SATILIK";
  }
  const kira = /KIRALIK/.test(islem);

  // Fiyat / bütçe
  const fiyat = paraOku(v.fiyat ?? ""), ilk = paraOku(v.ilkFiyat ?? ""), bMax = paraOku(v.butceMax ?? ""), bMin = paraOku(v.butceMin ?? "");
  for (const [p, ad] of [[fiyat, "Fiyat"], [bMax, "Bütçe"]] as const) if (p.supheli) kontrol.push(`${ad} biçimi şüpheli ("${ad === "Fiyat" ? v.fiyat : v.butceMax}") — kontrol edin`);
  const ozelSartlar: string[] = [];
  if (bMax.not && bMax.deger == null) ozelSartlar.push(bMax.not.slice(0, 60));
  if (bMax.not === "Nakit" || fiyat.not === "Nakit") ozelSartlar.push("Nakit");

  // Alan / oda
  const m2 = sayiOku(v.m2) ?? h?.m2 ?? h?.minM2 ?? h?.maxM2 ?? null;
  const kadar = /kadar|en fazla|max/.test(kucuk(v.aciklama ?? ""));
  const oda = (v.oda && /\d/.test(v.oda) ? v.oda.replace(/\s/g, "") : null) ?? h?.odaSayisi ?? null;

  // Konum
  const konumlar: string[] = [];
  const ilce = v.ilce?.trim(); const mah = v.mahalle?.replace(/\s+(mah(allesi)?\.?|mh\.?)$/i, "").trim();
  if (mah && ilce) konumlar.push(`${ilce} / ${mah}`); else if (ilce) konumlar.push(ilce);
  if (!mah && v.semt) konumlar.push(ilce ? `${ilce} / ${v.semt}` : v.semt);
  let ilGeneli = false;
  if (v.konum) for (const p of v.konum.split(/[,;/]|\sve\s|\sveya\s|\sya da\s/i).map((x) => x.trim().replace(/\s+(GENEL[İI]|GENEL[İI]NDE|geneli|genelinde)$/u, "").trim()).filter(Boolean)) {
    if (MERKEZ.test(kucuk(p)) || /antalya( geneli| merkez)/i.test(v.konum)) ilGeneli = true; else konumlar.push(p);
  }
  if (!konumlar.length && !ilGeneli) kontrol.push("Konum yok");

  // Sahip / kişi
  const sahipTuru = sahipTuruOku(v.ilanSahibiTuru) ?? (tip === "PORTFOY" ? o.varsayilanSahip : "MALIK");
  const tel = telE164(v.telefon);
  let kisi: SatirSonucu["kisi"] = null;
  if (tip === "TALEP" && v.ad) kisi = { adSoyad: baslikHarf(v.ad), telefon: tel, sirket: null, roller: [kira ? "KIRACI" : "ALICI"], rol: "MUSTERI" };
  else if (tip === "PORTFOY" && (v.ilanSahibi || v.ofis) && sahipTuru !== "MALIK")
    kisi = { adSoyad: baslikHarf(v.ilanSahibi ?? v.ofis!), telefon: tel, sirket: v.ofis ? v.ofis.trim() : null, roller: [sahipTuru === "MUTEAHHIT" ? "MUTEAHHIT" : sahipTuru === "FIRMA" ? "FIRMA" : "EMLAKCI"], rol: sahipTuru === "EMLAKCI" || sahipTuru === "PARTNER" ? "EMLAKCI" : "SAHIP" };
  // Bireysel ilan sahibinin adı kişi kartı olarak açılmaz (KVKK); yalnız kayıtta gönderen adı olarak durur

  // Özellikler
  const ozellik: Record<string, unknown> = { ...(h?.ozellik ?? {}) };
  const kat = katOku(v.kat), topKat = sayiOku(v.toplamKat), yas = yasOku(v.binaYasi);
  if (kat != null) ozellik.bulunduguKat = kat;
  if (topKat != null && topKat <= 150) ozellik.katSayisi = Math.round(topKat);
  if (yas != null) ozellik.binaYasi = yas;
  if (evet(v.site)) ozellik.siteIcinde = true;
  const es = evet(v.esyali); if (es != null) ozellik.esyaDurumu = es ? "ESYALI" : "ESYASIZ";
  if (/kirac/.test(kucuk(v.kullanim ?? ""))) ozelSartlar.push("Kiracılı");
  if (mt.imar) ozellik.imarDurumu = mt.imar;
  delete ozellik.kritikKriterler; delete ozellik.esnekKriterler;
  if (tip === "PORTFOY") { delete (ozellik as any).kullanimAmaclari; }

  const kaynak = kaynakOku(v.kaynak) ?? kaynakOku(v.url);
  const url = v.url ? (/^https?:\/\//i.test(v.url) ? v.url : "https://" + v.url) : null;
  const ilanNo = v.ilanNo ?? ilanNoOku(url ?? "");
  const tarih = tarihOku(v.tarih);
  const dosyadanIlan = tip === "PORTFOY" && (o.dosyaTuru === "PORTAL" || o.dosyaTuru === "MESLEKTAS");
  // v3.16 — geri sayım ilanın yayın tarihinden değil, kaydın sisteme girdiği günden başlar (o.bugun).
  // İlanın kendi tarihi yalnızca "eski ilan" uyarısı için kullanılır.
  const validUntil = tip === "PORTFOY" && dosyadanIlan ? new Date(o.bugun.getTime() + o.ilanGun * 86_400_000) : undefined;
  if (validUntil && tarih && o.bugun.getTime() - tarih.getTime() > o.ilanGun * 86_400_000) kontrol.push(`İlan ${o.ilanGun} günden eski (${v.tarih}) — süre yine de bugünden başlar`);
  if (v.ilanDurumu && !/aktif|yay[ıi]nda/.test(kucuk(v.ilanDurumu))) kontrol.push(`İlan durumu: ${v.ilanDurumu}`);
  const notlar: string[] = [];
  if (ilk.deger && fiyat.deger && ilk.deger > fiyat.deger) notlar.push(`Fiyat düştü: ${ilk.deger.toLocaleString("tr-TR")} → ${fiyat.deger.toLocaleString("tr-TR")}`);
  if (devirBedeli) notlar.push("İlanda “devren kiralık”: yazan tutar devir bedeli sayıldı — aylık kira ayrıca sorulmalı");
  if (devrenBelirsiz) kontrol.push("Devren: tutar aylık kira mı devir bedeli mi belli değil — kontrol edin");
  // v3.23 — veri kalitesi: portallarda eksik / fazla sıfırla girilmiş fiyatlar ("kiralık 1.200 TL", "kiralık 8.000.000 TL") sessizce havuza girmesin
  if (tip === "PORTFOY" && fiyat.deger != null && !devrenBelirsiz) {
    const yaz = fiyat.deger.toLocaleString("tr-TR");
    if (kira && fiyat.deger >= 1_000_000) kontrol.push(`Aylık kira için çok yüksek (${yaz} TL) — satış ya da devir bedeli olabilir`);
    else if (kira && ticari && m2 && fiyat.deger / m2 >= 5_000) kontrol.push(`Aylık kira m² başına çok yüksek (${Math.round(fiyat.deger / m2).toLocaleString("tr-TR")} TL/m²) — devir bedeli olabilir`);
    else if (kira && fiyat.deger < 5_000) kontrol.push(`Kira çok düşük (${yaz} TL) — eksik sıfır olabilir`);
    else if (!kira && islem !== "DEVREN_SATILIK" && fiyat.deger < 100_000) kontrol.push(`Satış fiyatı çok düşük (${yaz} TL) — eksik sıfır olabilir`);
    else if (islem === "DEVREN_SATILIK" && fiyat.deger < 10_000) kontrol.push(`Devir bedeli çok düşük (${yaz} TL) — kontrol edin`);
  }

  const girdi: SatirSonucu["girdi"] = {
    tip, mulkTipi: (mt.mulkTipi ?? "DIGER") as any, islemTipi: islem as any,
    ...(tip === "PORTFOY"
      ? { fiyat: fiyat.deger, m2, fiyatPeriyodu: kira ? "AYLIK" : "TOPLAM" }
      : { maxFiyat: bMax.deger ?? fiyat.deger, minFiyat: bMin.deger, fiyatPeriyodu: kira ? "AYLIK" : "TOPLAM", ...(m2 ? (kadar ? { maxM2: m2 } : { minM2: m2 }) : {}) }),
    odaSayisi: oda,
    durum: validUntil && validUntil < o.bugun ? "EXPIRED" : "ACTIVE",
    baslik: (v.baslik ?? (tip === "TALEP" && v.ad ? `${baslikHarf(v.ad)} — ${(v.aciklama ?? "").slice(0, 60)}` : null))?.slice(0, 160) ?? null,
    hamMetin: [v.aciklama, v.baslik && v.aciklama ? null : null].filter(Boolean).join("\n") || null,
    operasyonNotu: notlar.join(" · ") || null,
    lokasyonHam: [...konumlar, ...(ilGeneli ? ["Antalya geneli"] : [])].join(", ").slice(0, 200) || null,
    veriKanali: (kaynak ?? "CSV") as any,
    ilanSahibiTipi: (o.dosyaTuru === "MESLEKTAS" && sahipTuru === "EMLAKCI" ? "PARTNER" : sahipTuru) as any,
    havuz: tip === "PORTFOY" ? (o.dosyaTuru === "PORTAL" ? "DIS_ILAN" : o.dosyaTuru === "MESLEKTAS" ? "PARTNER" : "KENDI_PORTFOY") : "KENDI_PORTFOY",
    gondeAdi: (v.ilanSahibi ?? v.ad ?? null)?.slice(0, 120) ?? null, gondeSirket: v.ofis?.slice(0, 120) ?? null, gondeTelefon: cepMi(tel) ? tel : null,
    portalUrl: url, portalIlanNo: ilanNo, portalIlanSahibi: v.ofis ?? v.ilanSahibi ?? null,
    kaynakDosya: o.dosyaAdi ?? null, mesajTarihi: tarih,
    ozelSartlar: [...new Set(ozelSartlar)].filter((x) => x.length >= 2).slice(0, 10),
    ...(validUntil ? { validUntil } : {}),
    ...(Object.keys(ozellik).length ? { ozellik: ozellik as any } : {}),
  };
  if (tip === "PORTFOY" && !fiyat.deger && !m2) kontrol.push("Fiyat ve m² yok");
  if (tip === "TALEP" && !girdi.maxFiyat && !m2 && !oda) kontrol.push("Bütçe, m² ve oda yok");
  const bos = doluSayisi < 2;
  return { satirNo, durum: bos ? "BOS" : kontrol.length ? "KONTROL" : "HAZIR", girdi, konumlar, ilGeneli, kisi, sahipTuru, anahtar: ilanNo ?? url, kontrol };
}

/** "ÖNDER SAĞLAM" → "Önder Sağlam" */
export function baslikHarf(s: string): string {
  const t = s.replace(/\s+/g, " ").trim();
  return t === t.toLocaleUpperCase("tr") ? t.toLocaleLowerCase("tr").replace(/(^|\s|-)(\p{L})/gu, (_, a, b) => a + b.toLocaleUpperCase("tr")) : t;
}

/** Dosyanın büyük olasılıkla ne olduğu (kullanıcı değiştirebilir) */
export function dosyaTuruTahmin(e: Eslesme): { tip: "PORTFOY" | "TALEP"; dosyaTuru: DosyaTuru } {
  const s = new Set(e.sutunlar);
  if (s.has("butceMax") || s.has("butceMin") || (s.has("ad") && !s.has("fiyat"))) return { tip: "TALEP", dosyaTuru: "TALEP_LISTESI" };
  if (s.has("url") || s.has("kaynak") || s.has("ilanSahibiTuru")) return { tip: "PORTFOY", dosyaTuru: "PORTAL" };
  return { tip: "PORTFOY", dosyaTuru: "MESLEKTAS" };
}

/** Bir dosyadaki tüm sayfaları sırayla dolaşır; her sayfanın kendi başlık satırı bulunur (haftalık sekmeler) */
export function dosyaSatirlari(sayfalar: { ad: string; satirlar: string[][] }[], secili?: string[]) {
  const sonuc: { sayfa: string; eslesme: Eslesme; satirlar: { no: number; hucreler: string[] }[] }[] = [];
  for (const sf of sayfalar) {
    if (secili && !secili.includes(sf.ad)) continue;
    const e = sutunlariEsle(sf.satirlar); if (!e) continue;
    sonuc.push({ sayfa: sf.ad, eslesme: e, satirlar: sf.satirlar.slice(e.baslikSatiri + 1).map((h, i) => ({ no: e.baslikSatiri + 2 + i, hucreler: h })).filter((r) => r.hucreler.some((x) => (x ?? "").trim())) });
  }
  return sonuc;
}

// ───────── Konum çözümü + şema doğrulaması ─────────
import { lokasyonCozumle, type LokasyonIndeks } from "../lokasyon/cozumle";
import { KayitCreateSchema, type KayitCreateData } from "../validation/kayit";
export interface HazirSatir extends SatirSonucu { veri: KayitCreateData | null; hatalar: string[]; cozulemeyen: string[] }
export function satirHazirla(r: SatirSonucu, ix: LokasyonIndeks, kisiler: { kisiId: string; rol: string }[] = []): HazirSatir {
  const c = r.konumlar.length ? lokasyonCozumle(r.konumlar, ix) : { lokasyonlar: [], cozulemeyen: [] as string[] };
  const lok = c.lokasyonlar.map((l, i) => ({ ilId: ix.ilId, ilceId: l.ilceId ?? null, mahalleId: l.mahalleId ?? null, altBolgeId: l.altBolgeId ?? null, birincil: r.girdi.tip === "PORTFOY" && i === 0 }));
  if (!lok.length && r.ilGeneli) lok.push({ ilId: ix.ilId, ilceId: null, mahalleId: null, altBolgeId: null, birincil: r.girdi.tip === "PORTFOY" });
  const kontrol = [...r.kontrol];
  if (c.cozulemeyen.length) kontrol.push(`Tanınmayan konum: ${c.cozulemeyen.join(", ")}`);
  const p = KayitCreateSchema.safeParse({ ...r.girdi, lokasyonlar: lok.slice(0, 15), kisiler });
  if (!p.success) return { ...r, kontrol, veri: null, hatalar: p.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`), cozulemeyen: c.cozulemeyen };
  return { ...r, kontrol, durum: r.durum === "BOS" ? "BOS" : kontrol.length ? "KONTROL" : "HAZIR", veri: p.data, hatalar: [], cozulemeyen: c.cozulemeyen };
}