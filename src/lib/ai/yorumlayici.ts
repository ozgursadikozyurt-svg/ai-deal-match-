/**
 * Anahtar CRM v3.13 · 3 Ekim 2026
 */
// Akıllı metin yorumlayıcı — yapıştırılan metnin NE olduğunu önce anlar, sonra ayrıştırır.
//
// v3.8'e kadar her satır ayrı kayıt adayı sayılıyordu; bir Sahibinden ilan sayfası 20 "kayıt"a bölünüyordu.
// Artık sıra şöyle:
//   1) Metnin türü: WhatsApp dökümü mü, portal ilan sayfası mı, toplu liste mi, tek talep/ilan mı,
//      yalnızca bağlantı mı, kişi/telefon mu, soru mu?
//   2) Türe özel ayrıştırıcı (etiket–değer çiftleri, mesaj sınırları, satır sınırları…).
//   3) Her parça için hızlı ayrıştırıcı + notlar/uyarılar ("ilanda 176 m², açıklamada 135 m²").
// Yapay zekâ yalnızca kural tabanlı sonucun güveni düşükse ya da kullanıcı isterse çağrılır (bkz. aiYorumIstemi).

import { hizliAyristir, metinTuru, metindenKonumlar, type HizliSonuc } from "./hizli-ayristirici";
import { digerIlTara } from "../lokasyon/turkiye";
import { sohbetiAyristir, onFiltre } from "../ingest/whatsapp";
import { mesajiBol } from "../ingest/toplu-mesaj";
import { lokasyonCozumle, type LokasyonIndeks } from "../lokasyon/cozumle";

export type YorumTuru = "SORU" | "PORTAL_ILANI" | "WHATSAPP_SOHBETI" | "TOPLU_LISTE" | "COKLU_TALEP" | "TEK_KAYIT" | "BAGLANTI" | "KISI" | "BOS";

export interface YorumParca {
  no: number;
  /** Kayda hamMetin olarak yazılacak özgün metin */
  metin: string;
  h: HizliSonuc;
  /** Kayda yazılacak yer ifadeleri (hariç tutulanlar çıkarılmış) */
  konumlar: string[];
  haricKonumlar: string[];
  kisiAdi: string | null;
  telefon: string | null;
  tarih: string | null;
  grup: string | null;
  /** Operasyon notuna yazılacak bilgiler (ödeme şekli, depozito, takas…) */
  notlar: string[];
  /** Kullanıcının bakması gereken çelişkiler / tahminler */
  uyarilar: string[];
  /** Kayda doğrudan yazılacak ek alanlar (portal etiket–değerlerinden) */
  ek: Record<string, unknown>;
  ilGeneli: boolean;
  /** Bu parçanın alt türü (WhatsApp dökümündeki her mesajın kendi türü olur) */
  altTur: YorumTuru;
  /** v3.10 — güven puanı 0–100 (bkz. parcaGuveni) ve puan kaybettiren eksikler */
  guven?: number;
  eksikler?: string[];
}
export interface YorumKisi { adSoyad: string; telefon: string | null; sirket: string | null }
export interface Yorum {
  tur: YorumTuru;
  /** İnsan dilinde tek-iki cümle: "bunu şöyle anladım" */
  aciklama: string;
  /** 0–1: kural tabanlı sonucun güveni; 0.7 altı → yapay zekâya sormak önerilir */
  guven: number;
  parcalar: YorumParca[];
  kisiler: YorumKisi[];
  /** Kayda dönüşmeyen mesajlar (WhatsApp dökümünde): neden → adet */
  atlanan: { neden: string; sayi: number }[];
  /** Listede kişi adıyla başlayan satırlar / "talep toplantısı" başlığı varsa TALEP; yoksa null */
  tipIpucu: "TALEP" | "PORTFOY" | null;
}

const kucuk = (s: string) => s.toLocaleLowerCase("tr");
const TEL = /(?:\+?90[\s-]?)?\(?0?5\d{2}\)?[\s-]?\d{3}[\s-]?\d{2}[\s-]?\d{2}/g;
const URL_RE = /https?:\/\/[^\s)\]>]+/g;
const WA_SATIR = /^[‎‏]?\[?\d{1,2}[./]\d{1,2}[./]\d{2,4},? \d{1,2}:\d{2}/;
const MEDYA = /[‎‏]?<[^<>\n]{0,40}(dahil edilmedi|omitted)>/gi;
const sayi = (s: string | undefined | null): number | null => {
  if (!s) return null;
  const m = s.match(/\d[\d.,]*/);
  if (!m) return null;
  let t = m[0];
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(t)) t = t.replace(/\./g, "").replace(",", ".");
  else t = t.replace(",", ".");
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
};

/** [yazı](https://…) biçimli bağlantıları düz yazıya çevirir, adresleri ayrı toplar. */
export function baglantilariAc(metin: string): { metin: string; adresler: string[] } {
  const adresler: string[] = [];
  const duz = metin
    .replace(/\r\n?/g, "\n")
    .replace(/[​‎‏﻿]/g, "")
    .replace(/\[([^\]\n]*)\]\((https?:\/\/[^)\s]+)\)/g, (_, yazi: string, adres: string) => { adresler.push(adres); return yazi; });
  for (const a of duz.match(URL_RE) ?? []) adresler.push(a);
  return { metin: duz, adresler: [...new Set(adresler.map((a) => a.replace(/#.*$/, "")))] };
}

export interface SlugBilgisi { metin: string; kategori: "KONUT" | "ISYERI" | "ARSA" | "BINA" | "TURISTIK" | null; ilanNo: string | null; portal: "SAHIBINDEN" | "HEPSIEMLAK" | "EMLAKJET" }
/** İlan bağlantısının adresindeki sözcükleri okunur metne çevirir: …/emlak-konut-satilik-lara-4-plus1-daire-123/detay → "satilik lara 4+1 daire". */
export function slugMetni(adres: string): SlugBilgisi | null {
  const m = adres.match(/(sahibinden|hepsiemlak|emlakjet)\.com\/(?:ilan\/)?([^?#]+)/i);
  if (!m) return null;
  const portal = m[1].toUpperCase() as SlugBilgisi["portal"];
  let yol = m[2];
  try { yol = decodeURIComponent(yol); } catch { /* bozuk kodlama: olduğu gibi */ }
  yol = yol.replace(/\/detay\/?$/i, "").replace(/\/+$/, "").replace(/\//g, "-");
  const ilanNo = yol.match(/(\d{8,12})(?!.*\d{8,12})/)?.[1] ?? null;
  if (ilanNo) yol = yol.replace(ilanNo, "");
  yol = yol.replace(/^emlak-/, "");
  let kategori: SlugBilgisi["kategori"] = null;
  if (/^konut-/.test(yol)) kategori = "KONUT";
  else if (/^is-yeri-/.test(yol)) kategori = "ISYERI";
  else if (/^arsa-/.test(yol)) kategori = "ARSA";
  else if (/^bina-/.test(yol)) kategori = "BINA";
  else if (/^turistik-tesis-/.test(yol)) kategori = "TURISTIK";
  const metin = yol
    .replace(/^(konut|is-yeri|arsa|bina|turistik-tesis)-/, "")
    .replace(/(\d+)-?plus-?(\d)/g, "$1+$2")
    .replace(/(\d+)-m2\b/g, "$1 m2")
    .replace(/-+/g, " ")
    .trim();
  return metin.length >= 6 ? { metin, kategori, ilanNo, portal } : null;
}

/**
 * Yer ifadelerini bulur. Virgül / tire / "ve" ile ayrılmış listelerde her parçaya ayrı bakar:
 * böylece "Fener, Şirinyalı" tek ifade diye birleşmez ve birden çok ilçede bulunan mahalle adları
 * (Çağlayan, Bahçelievler…) bir yer listesinin içindeyse atlanmaz.
 */
const MERKEZ = ["muratpaşa", "konyaaltı", "kepez", "döşemealtı", "aksu"];
/** v3.12 — "Atatürk Caddesi üzerinde", "Mustafa Kemal Bulvarı" gibi cadde/sokak adlarını konum taramasından çıkarır (mahalle sanılmasın);
 *  "Yeniköy Mahallesinde Atatürk Caddesi" → "Yeniköy Mahallesinde". Önündeki sözcük mahalle / bölge / ilçe eki ise yerinde bırakılır. */
export function caddeAdiniAyikla(satir: string): string {
  return satir.replace(/((?:[\p{L}]+\s+){0,3})((?:cadde(?:si)?|cad\.|sokak|sokağı|sk\.|bulvar[ıi]?|blv\.)(?![\p{L}]))(\s+(?:üzerinde|üstünde|üzeri|cepheli))?/giu, (_t, once: string) => {
    const kelimeler = once.trim().split(/\s+/).filter(Boolean);
    const dur = /^(mahalle\p{L}*|mah\.?|mh\.?|b[öo]lge\p{L}*|il[cç]e\p{L}*|de|da|içinde|icinde)$/iu;
    let son = -1;
    kelimeler.forEach((k, n) => { if (dur.test(k)) son = n; });
    // son "mahalle/bölge" sözcüğüne kadar olan kısım korunur; ondan sonrakiler cadde adıdır
    // mahalle sözcüğü yoksa yalnızca cadde adının kendisi (tek sözcük) çıkarılır: "Muratpaşa Meltem Atatürk Caddesi" → "Muratpaşa Meltem"
    return (son >= 0 ? kelimeler.slice(0, son + 1) : kelimeler.slice(0, Math.max(0, kelimeler.length - 1))).join(" ") + " ";
  });
}

export function konumBul(metin: string, ix: LokasyonIndeks): string[] {
  const bulunan: string[] = [];
  for (const hamSatir of metin.split("\n")) {
    // v3.10 — başka il / ilçe adları (İzmir Bornova, Bodrum'da…) önce ayrılır; kalan metin çalışma ili sözlüğüyle taranır
    // v3.12 — cadde / sokak / bulvar adları mahalle değildir ("Atatürk Caddesi üzerinde" → Atatürk Mahallesi sanılıyordu)
    const dt = digerIlTara(caddeAdiniAyikla(hamSatir), ix);
    bulunan.push(...dt.ifadeler);
    const satir = dt.kalan;
    const parcalar = satir.split(/[,;–—\/()•|]|\s-\s|\s+ve\s+|\s+veya\s+|\s+ya\s+da\s+/i).map((p) => p.trim()).filter(Boolean);
    const satirda: string[] = [], bos: string[] = [];
    for (const p of parcalar) {
      const b = metindenKonumlar(p, ix);
      if (b.length) satirda.push(...b); else bos.push(p);
    }
    // Aynı satırda başka yer adı varsa, tanınmayan kısa parçalar da büyük olasılıkla yer adıdır (Çağlayan, Bahçelievler…)
    if (satirda.length) for (const p of bos) {
      const sade = p.replace(/^[^\p{L}]+|[^\p{L}]+$/gu, "").replace(/\s+(mahallesi\p{L}*|mah\.?|mh\.?|b[öo]lge\p{L}*|taraf\p{L}*|civar\p{L}*)(\s.*)?$/iu, "");
      if (sade.length < 5 || sade.split(/\s+/).length > 2 || /\d/.test(sade)) continue;
      const c = lokasyonCozumle([sade], ix);
      if (!(c.lokasyonlar.length === 1 && !c.cozulemeyen.length && (c.lokasyonlar[0].guven ?? 0) >= 1)) continue;
      // Aynı adlı mahalle birden çok ilçede varsa: satırdaki diğer yerlerin ilçesi, yoksa merkez ilçeler önceliklidir.
      const adaylar = ix.mahalleler.filter((m: any) => kucuk(m.ad) === kucuk(sade));
      if (adaylar.length > 1) {
        const baglam = new Set(lokasyonCozumle(satirda, ix).lokasyonlar.map((l: any) => l.ilceId));
        const ilceAd = (id: number) => ix.ilceler.find((i: any) => i.id === id)?.ad ?? "";
        const sirali = [...adaylar].sort((a: any, b: any) => (Number(baglam.has(b.ilceId)) - Number(baglam.has(a.ilceId))) || (MERKEZ.indexOf(kucuk(ilceAd(a.ilceId))) + 99) % 99 - (MERKEZ.indexOf(kucuk(ilceAd(b.ilceId))) + 99) % 99);
        satirda.push(`${ilceAd(sirali[0].ilceId)} ${sade}`);
      } else satirda.push(sade);
    }
    bulunan.push(...satirda);
  }
  const gorulen = new Set<string>();
  return bulunan.filter((b) => { const k = kucuk(b); if (gorulen.has(k)) return false; gorulen.add(k); return true; });
}

// ─────────────────────────── Portal ilan sayfası ───────────────────────────
const PORTAL_ETIKETLERI = [
  "ilan no", "ilan tarihi", "kategori", "durumu", "türü", "emlak tipi", "m²", "m2", "m² (brüt)", "m² (net)", "brüt m²", "net m²", "brüt / net m²",
  "açık alan m²", "kapalı alan m²", "oda sayısı", "bölüm & oda sayısı", "oda sayısı / bölüm sayısı", "bina yaşı", "bulunduğu kat", "kat sayısı",
  "ısıtma", "ısıtma tipi", "banyo sayısı", "mutfak", "balkon", "asansör", "otopark", "eşyalı", "eşya durumu", "kullanım durumu", "site içerisinde",
  "site adı", "aidat (tl)", "aidat", "krediye uygun", "krediye uygunluk", "tapu durumu", "kimden", "takas", "takaslı", "giriş yüksekliği (m)",
  "giriş yüksekliği", "depozito (tl)", "depozito", "zemin etüdü", "yapının durumu", "yapı tipi", "yapının şekli", "imar durumu", "ada no", "parsel no",
  "pafta no", "kaks (emsal)", "gabari", "m² fiyatı", "kiracılı", "devren", "yıldız sayısı", "yatak sayısı", "oda sayısı (otel)", "görüntülü arama ile gezilebilir",
];
const ETIKET_KUMESI = new Set(PORTAL_ETIKETLERI);
const etiketMi = (s: string) => ETIKET_KUMESI.has(kucuk(s).replace(/\s*:\s*$/, "").trim());

function portalAlanlari(satirlar: string[]): Map<string, string> {
  const kv = new Map<string, string>();
  for (let i = 0; i < satirlar.length; i++) {
    const s = satirlar[i];
    if (etiketMi(s)) {
      const sonraki = satirlar[i + 1];
      if (sonraki != null && !etiketMi(sonraki)) { kv.set(kucuk(s).replace(/\s*:\s*$/, "").trim(), sonraki.trim()); i++; }
      continue;
    }
    // "Etiket: değer" ya da "Etiket<TAB>değer" tek satırda
    const m = s.match(/^([^:\t]{2,32})(?::\s*|\t+)(.+)$/);
    if (m && etiketMi(m[1])) kv.set(kucuk(m[1]).trim(), m[2].trim());
  }
  return kv;
}

/** Portal ilan sayfasından kopyalanmış metin mi? (etiket–değer satırları) */
export function portalSayfasiMi(metin: string): boolean {
  const satirlar = metin.split("\n").map((s) => s.trim()).filter(Boolean);
  const kv = portalAlanlari(satirlar);
  return kv.size >= 4 || (kv.has("ilan no") && kv.size >= 2);
}

const ISITMA: [RegExp, string][] = [[/do[ğg]algaz|kombi/i, "DOGALGAZ_KOMBI"], [/yerden/i, "YERDEN_ISITMA"], [/merkezi/i, "MERKEZI"], [/klima/i, "KLIMA"]];

function portalParcasi(ham: string, duz: string, adresler: string[], ix: LokasyonIndeks): YorumParca {
  const satirlar = duz.split("\n").map((s) => s.trim()).filter(Boolean);
  const kv = portalAlanlari(satirlar);
  const al = (...anahtarlar: string[]) => { for (const a of anahtarlar) { const d = kv.get(a); if (d && !/^(belirtilmemi[şs]|-)$/i.test(d)) return d; } return null; };

  const ilkEtiket = satirlar.findIndex(etiketMi);
  const ust = satirlar.slice(0, ilkEtiket < 0 ? 6 : ilkEtiket);
  const fiyatSatiri = ust.find((s) => /^(?:[₺$€£]\s*\d[\d.,]*|\d[\d.,]*\s*(?:tl|try|₺|usd|\$|eur|euro|€|gbp|£))(?![\p{L}\d])/iu.test(s)) ?? null;
  const kirinti = ust.find((s) => (s.match(/\s\/\s?|\s?\/\s/g) ?? []).length >= 1 && !/\d{3}/.test(s)) ?? null;
  const baslik = ust.find((s) => s !== fiyatSatiri && s !== kirinti && s.length >= 8) ?? "";
  const aciklamaBas = satirlar.findIndex((s) => /^a[çc][ıi]klama$/i.test(s));
  const aciklama = aciklamaBas >= 0 ? satirlar.slice(aciklamaBas + 1).filter((s) => !/^(özellikler|konumu|konumu ve bölge bilgisi|emlak endeksi|ilan detaylar[ıi])$/i.test(s)).join("\n") : "";

  const durum = al("durumu") ?? "";
  const tur = [al("türü"), al("emlak tipi")].filter(Boolean).join(" ");
  const kategori = al("kategori") ?? "";
  const ilanNo = al("ilan no")?.replace(/\D/g, "") || null;
  const kimden = al("kimden") ?? "";

  // Hızlı ayrıştırıcıya etiket satırları yerine anlamlı bir özet verilir.
  const analiz = [baslik, `${durum} ${tur} ${kategori}`.trim(), fiyatSatiri ?? "", ilanNo ? `İlan No: ${ilanNo}` : "", aciklama].filter(Boolean).join("\n");
  const h = hizliAyristir(analiz);
  const ek: Record<string, unknown> = {};
  const ozellik: Record<string, unknown> = { ...h.ozellik };
  const notlar: string[] = [];
  const uyarilar: string[] = [];

  h.tip = "PORTFOY";
  const turH = tur ? hizliAyristir(tur) : null;
  if (turH?.mulkTipi) h.mulkTipi = turH.mulkTipi;
  else if (/arsa/i.test(kategori) && !/TARLA|ZEYTINLIK/.test(h.mulkTipi ?? "")) h.mulkTipi = "ARSA";
  if (/devren/i.test(durum)) h.islemTipi = /sat/i.test(durum) ? "DEVREN_SATILIK" : "DEVREN_KIRALIK";
  else if (/kiral/i.test(durum)) h.islemTipi = /g[üu]nl[üu]k/i.test(durum) ? "GUNLUK_KIRALIK" : "KIRALIK";
  else if (/sat/i.test(durum)) h.islemTipi = "SATILIK";
  h.islemTahmini = !durum && h.islemTahmini;

  const fiyat = sayi(fiyatSatiri);
  if (fiyat != null) {
    h.fiyat = fiyat;
    h.paraBirimi = /usd|\$/i.test(fiyatSatiri!) ? "USD" : /eur|€/i.test(fiyatSatiri!) ? "EUR" : /gbp|£/i.test(fiyatSatiri!) ? "GBP" : "TRY";
  }
  h.fiyatPeriyodu = /KIRALIK/.test(h.islemTipi ?? "") ? (/GUNLUK/.test(h.islemTipi ?? "") ? "GUNLUK" : "AYLIK") : "TOPLAM";

  const brut = sayi(al("m² (brüt)", "brüt m²", "m²", "m2", "kapalı alan m²"));
  const net = sayi(al("m² (net)", "net m²"));
  const metinM2 = [...(baslik + "\n" + aciklama).matchAll(/(\d[\d.]*)\s*(?:m2|m²|metrekare)/gi)].map((m) => sayi(m[1])!).filter((n) => n > 0);
  if (brut != null) {
    h.m2 = brut; h.minM2 = null; h.maxM2 = null;
    const farkli = [...new Set(metinM2)].filter((n) => Math.abs(n - brut) / brut > 0.1 && n !== net);
    if (farkli.length) uyarilar.push(`İlan alanı ${brut.toLocaleString("tr-TR")} m², başlık/açıklamada ${farkli.map((n) => n.toLocaleString("tr-TR")).join(" ve ")} m² yazıyor — hangisi doğru, kontrol edin.`);
  }
  if (net != null) ek.netM2 = net;
  const oda = al("oda sayısı", "bölüm & oda sayısı", "oda sayısı / bölüm sayısı")?.match(/(\d{1,2})\s*\+\s*(\d)/);
  if (oda) h.odaSayisi = `${oda[1]}+${oda[2]}`;

  const yas = al("bina yaşı"); if (yas && sayi(yas) != null) ozellik.binaYasi = sayi(yas);
  const kat = al("bulunduğu kat"); if (kat && /^-?\d+/.test(kat)) ozellik.bulunduguKat = Number(kat.match(/^-?\d+/)![0]);
  const katS = sayi(al("kat sayısı")); if (katS != null) ozellik.katSayisi = katS;
  const banyo = sayi(al("banyo sayısı")); if (banyo != null) ozellik.banyoSayisi = banyo;
  const yuk = sayi(al("giriş yüksekliği (m)", "giriş yüksekliği")); if (yuk != null) ozellik.netYukseklikM = yuk;
  const isi = al("ısıtma", "ısıtma tipi"); const isiKod = isi ? ISITMA.find(([r]) => r.test(isi))?.[1] : null; if (isiKod) ozellik.isinmaTipi = isiKod;
  const esya = al("eşyalı", "eşya durumu"); if (esya) ozellik.esyaDurumu = /^evet|e[şs]yal[ıi]/i.test(esya) ? "ESYALI" : "ESYASIZ";
  const site = al("site içerisinde"); if (site) ozellik.siteIcinde = /^evet/i.test(site);
  const aidat = sayi(al("aidat (tl)", "aidat")); if (aidat != null) ozellik.aidat = aidat;
  const kredi = al("krediye uygun", "krediye uygunluk"); if (kredi) ek.krediyeUygun = /^evet|uygun$/i.test(kredi);
  const ada = al("ada no"), parsel = al("parsel no"); if (ada) ozellik.adaNo = ada; if (parsel) ozellik.parselNo = parsel;

  if (/sahibinden/i.test(kimden)) h.ilanSahibiTipi = "MALIK";
  else if (/emlak/i.test(kimden)) h.ilanSahibiTipi = "EMLAKCI";
  else if (/in[şs]aat|m[üu]teahhit/i.test(kimden)) h.ilanSahibiTipi = "MUTEAHHIT";
  else if (/banka/i.test(kimden)) h.ilanSahibiTipi = "FIRMA";

  h.ilanNo = ilanNo ?? h.ilanNo;
  const ilanAdresi = adresler.find((a) => (ilanNo ? a.includes(ilanNo) : false) && /\/ilan\//.test(a)) ?? adresler.find((a) => /\/ilan\//.test(a)) ?? null;
  if (ilanAdresi) { h.portalUrl = ilanAdresi; h.portal = /hepsiemlak/.test(ilanAdresi) ? "HEPSIEMLAK" : /emlakjet/.test(ilanAdresi) ? "EMLAKJET" : "SAHIBINDEN"; }
  else { h.portalUrl = null; h.portal = h.portal ?? (/hepsiemlak/i.test(duz) ? "HEPSIEMLAK" : /emlakjet/i.test(duz) ? "EMLAKJET" : "SAHIBINDEN"); }
  h.telefon = (aciklama.match(TEL) ?? [])[0] ? h.telefon : null;
  h.kisiAdi = h.telefon ? h.kisiAdi : null;

  // Açıklamadaki koşullar → not
  const a = kucuk(aciklama);
  if (/y[ıi]ll[ıi]k\s*pe[şs]in/.test(a)) { ozellik.kiraOdemeSekli = "YILLIK_PESIN"; notlar.push("Kira yıllık peşin isteniyor" + (/\+\s*kdv?\b/.test(a) ? " (+KDV)" : "")); }
  else if (/\+\s*kdv\b/.test(a)) notlar.push("Fiyata KDV eklenecek");
  const dep = a.match(/(bir|iki|[üu][çc]|\d)\s*(?:ayl[ıi]k\s*)?kira(?:\s*bedeli)?\s*depozito/);
  if (dep) { const ay = ({ bir: 1, iki: 2, "üç": 3, uc: 3 } as Record<string, number>)[dep[1]] ?? Number(dep[1]); if (ay) { ozellik.depozitoAy = ay; notlar.push(`Depozito: ${ay} kira`); } }
  if (/teminat\s*senedi/.test(a)) notlar.push("Teminat senedi alınıyor");
  if (/g[üu]venli[ğk]/.test(a)) { ozellik.guvenlik = true; }
  const kullanim = al("kullanım durumu"); if (kullanim) notlar.push(`Kullanım durumu: ${kullanim}`);
  const tapu = al("tapu durumu"); if (tapu) notlar.push(`Tapu: ${tapu}`);
  const zemin = al("zemin etüdü"); if (zemin && /var/i.test(zemin)) notlar.push("Zemin etüdü var");
  const tarih = al("ilan tarihi"); if (tarih) notlar.push(`İlan tarihi: ${tarih}`);
  if (al("takas", "takaslı") && /^evet/i.test(al("takas", "takaslı")!)) notlar.push("Takasa açık");

  h.ozellik = ozellik as HizliSonuc["ozellik"];
  const konumlar = kirinti ? [kirinti.split("/").map((p) => p.trim()).filter((p) => p && !/^antalya$/i.test(p)).map((p) => p.replace(/\s+(mh|mah)\.?$/i, " Mahallesi")).join(" ")] : konumBul(baslik + "\n" + aciklama, ix);
  h.eksik = []; h.yeterli = true;
  if (!h.mulkTipi) { h.eksik.push("mülk tipi"); h.yeterli = false; }
  if (h.fiyat == null) uyarilar.push("Fiyat satırı bulunamadı — ekleyin.");
  ek.ozet = baslik ? baslik.slice(0, 150) : undefined;
  return { no: 1, metin: ham.trim(), h, konumlar: konumlar.filter(Boolean), haricKonumlar: [], kisiAdi: h.kisiAdi, telefon: h.telefon, tarih: null, grup: null, notlar, uyarilar, ek, ilGeneli: false, altTur: "PORTAL_ILANI" };
}

// ─────────────────────────── Tek mesaj: tek kayıt mı, liste mi? ───────────────────────────
const MADDE = /^\s*(?:[-–—•*▪►✅☑️🍀🔹🔸📌📍🏠🏡💰💵➡️✔️✨🔄🚨‼️]+|\d{1,2}[.)-]|[a-z][.)])\s*/u;
const KISI_ONEKI = /^([\p{Lu}][\p{L}.']*(?:\s+[\p{Lu}][\p{L}.']*){0,3})\s*(?:[–—:]|\s-\s)\s*\S/u;

const ALAN_ADI = /\b(kat|alan[ıi]?|alanlar[ıi]|b[üu]t[çc]e|konum|fiyat|kira|toplam|not|talep|portf[öo]y|[öo]deme|detay|[öo]zellik|adres|b[öo]lge|oda|tip|getirisi|kullan[ıi]m|ileti[şs]im|tel|telefon)\b/i;
interface Capa { guclu: boolean; satir: string; oda: string | null; m2: number | null; fiyat: number | null; tip: string | null; islem: string | null; konumlar: string[]; kisi: boolean; numarali: boolean }

function capalar(metin: string, ix: LokasyonIndeks): Capa[] {
  const sonuc: Capa[] = [];
  for (const ham of metin.split("\n")) {
    const numarali = /^\s*\d{1,2}[.)]\s/.test(ham);
    const s = ham.replace(MADDE, "").trim();
    if (s.length < 6) continue;
    const h = hizliAyristir(s);
    const konumlar = konumBul(s, ix);
    const fiyat = h.fiyat ?? h.maxFiyat ?? null, m2 = h.m2 ?? h.minM2 ?? h.maxM2 ?? null;
    const sayisal = fiyat != null || m2 != null || h.odaSayisi != null;
    const nitel = h.mulkTipi != null || konumlar.length > 0 || (h.islemTipi != null && !h.islemTahmini);
    const alternatif = /takas|olabilir|\bveya\b|ya da|de olur|da olur|getirisi|potansiyel/i.test(s);
    if (sayisal && nitel) sonuc.push({ guclu: !alternatif && (fiyat != null || (konumlar.length > 0 && (h.odaSayisi != null || m2 != null))), satir: s, oda: h.odaSayisi, m2, fiyat, tip: h.aileKodu ?? h.mulkTipi, islem: h.islemTahmini ? null : h.islemTipi, konumlar, kisi: KISI_ONEKI.test(s) && !ALAN_ADI.test(s.match(KISI_ONEKI)![1]) && !hizliAyristir(s.match(KISI_ONEKI)![1]).mulkTipi, numarali });
  }
  return sonuc;
}
const farkli = (a: number | null, b: number | null) => a != null && b != null && Math.abs(a - b) / Math.max(a, b) > 0.2;
function celisir(a: Capa, b: Capa): boolean {
  if (a.oda && b.oda && a.oda !== b.oda) return true;
  if (farkli(a.fiyat, b.fiyat) || farkli(a.m2, b.m2)) return true;
  if (a.tip && b.tip && a.tip !== b.tip) return true;
  if (a.islem && b.islem && a.islem !== b.islem) return true;
  if (a.konumlar.length && b.konumlar.length && !a.konumlar.some((k) => b.konumlar.includes(k))) return true;
  return false;
}

/** Metinde "hariç / dışında" denilen yerleri bulur. */
function haricler(metin: string, ix: LokasyonIndeks): string[] {
  const bulunan: string[] = [];
  for (const m of kucuk(metin).matchAll(/((?:[\p{L}'’]+[\s,]+){1,4})(?:harici|hariç|haricinde|dışında|olmasın)(?![\p{L}])/gu)) bulunan.push(...konumBul(m[1], ix));
  return [...new Set(bulunan)];
}

function genelNotlar(metin: string): string[] {
  const a = kucuk(metin), n: string[] = [];
  if (/ödeme\s*plan[ıi]|taksit|vadeli/.test(a)) n.push("Ödeme planı var: " + (metin.split("\n").filter((s) => /nakit|takas|taksit|vade|kalan/i.test(s)).map((s) => s.trim()).slice(0, 4).join(" · ") || "metne bakın"));
  else if (/takas/.test(a)) n.push("Takas söz konusu");
  if (/fiyat[ıi]?\s*d[üu][şs]t[üu]/.test(a)) n.push("Fiyat düştü");
  if (/ilan\s*d[ıi][şs][ıi]/.test(a)) n.push("İlan dışı portföy isteniyor");
  if (/nakit\s*al[ıi]m|nakit\s*al[ıi]c[ıi]/.test(a)) n.push("Nakit alıcı");
  if (/birlikte\s*satal[ıi]m|ortak\s*sat/.test(a)) n.push("Ortak çalışmaya açık");
  return n;
}

const EMLAKCI_ONEKI = /^emlak\s?dan[ıi][şs]man[ıi]\s+/i;

function parca(metin: string, ix: LokasyonIndeks, altTur: YorumTuru, analizEki = ""): YorumParca {
  // "10 11 mil" → "10 11 milyon"; hashtag satırları analizden çıkar
  const analiz = metin.replace(/(\d)\s*mil\b/gi, "$1 milyon").split("\n").filter((s) => !/^\s*#\S+(\s+#\S+)*\s*$/.test(s)).join("\n");
  const h = hizliAyristir(analizEki ? `${analizEki}\n${analiz}` : analiz);
  const tum = konumBul(analizEki ? `${analizEki}\n${analiz}` : analiz, ix);
  const haric = haricler(metin, ix);
  const haricK = new Set(haric.map(kucuk));
  const uyarilar: string[] = [], notlar = genelNotlar(metin);
  const a = kucuk(analiz);
  if (haric.length) uyarilar.push(`Hariç tutulan bölge: ${haric.join(", ")} — konumlara eklenmedi.`);
  if (!h.tip) { h.tip = "PORTFOY"; if (!analizEki) uyarilar.push("Talep mi ilan mı yazmıyor; ilan (portföy) olarak okundu."); }
  if (!h.mulkTipi && /ticari\s*(m[üu]lk|gayrimenkul)|i[şs]\s?yeri|vitrin/.test(a)) h.mulkTipi = "DUKKAN_MAGAZA";
  // Kiracılı satılık: "kira getirisi 100.000" satış fiyatı değildir
  if (h.tip === "PORTFOY" && /sat[ıi]l[ıi]k/.test(a) && /kira\s*getirisi|kirac[ıi]l[ıi]/.test(a)) {
    const kira = a.match(/kira\s*getirisi[^\d]{0,20}(\d[\d.,]*)\s*(bin|milyon)?/);
    const kiraTutar = kira ? (sayi(kira[1]) ?? 0) * (kira[2] === "bin" ? 1e3 : kira[2] === "milyon" ? 1e6 : 1) : null;
    h.islemTipi = "SATILIK"; h.fiyatPeriyodu = "TOPLAM"; h.islemTahmini = false;
    h.ozellik = { ...h.ozellik, kiracili: true, ...(kiraTutar ? { mevcutKiraGeliri: kiraTutar } : {}) };
    if (kiraTutar && h.fiyat === kiraTutar) { h.fiyat = null; uyarilar.push(`Satış fiyatı yazmıyor; ${kiraTutar.toLocaleString("tr-TR")} TL aylık kira getirisi olarak kaydedildi.`); }
  }
  // "3 milyondan 2.500.000 TL'ye düştü" → güncel fiyat ikincisi
  const dusus = analiz.match(/(\d[\d.,]*\s*(?:milyon|bin)?)\s*(?:tl|₺)?\s*['’]?\s*d[ae]n\s+(.{0,60})/i);
  if (dusus && /d[üu][şs]t[üu]|indi/i.test(analiz) && h.tip === "PORTFOY") {
    const yeni = hizliAyristir(dusus[2]).fiyat;
    if (yeni != null && yeni !== h.fiyat) { notlar.push(`Eski fiyat: ${dusus[1].trim()}`); h.fiyat = yeni; }
  }
  if (h.islemTahmini) uyarilar.push(`Satılık / kiralık yazmıyor; fiyat düzeyinden tahmin edildi.`);
  const odalar = [...new Set([...a.matchAll(/(?<!\d)(\d{1,2})\s*\+\s*(\d)(?!\d)/g)].map((m) => `${m[1]}+${m[2]}`))];
  if (odalar.length > 1 && h.tip === "TALEP" && !/takas/.test(a)) uyarilar.push(`Birden çok oda seçeneği var (${odalar.join(" / ")}); ilki yazıldı.`);
  return { no: 1, metin: metin.trim(), h, konumlar: tum.filter((k) => !haricK.has(kucuk(k))), haricKonumlar: haric, kisiAdi: h.kisiAdi, telefon: h.telefon, tarih: null, grup: null, notlar, uyarilar, ek: {}, ilGeneli: /antalya\s*(geneli|genelinde|merkez|i[çc]i)|her yer/i.test(metin), altTur };
}

const TALEP_ISARETI = /(n[ıiuü]z)\s+var\s*m[ıi]|d[öo]n[üu][şs]|arkada[şs]lar|aray[ıi][şs][ıi]m|m[üu][şs]terim|talep\b|aran[ıi]yor/;

interface TekSonuc { tur: YorumTuru; parcalar: YorumParca[]; kisiler: YorumKisi[]; aciklama: string; guven: number; tipIpucu: Yorum["tipIpucu"] }

function tekMesaj(ham: string, ix: LokasyonIndeks): TekSonuc {
  const { metin: duz, adresler } = baglantilariAc(ham.replace(MEDYA, " "));
  const govde = duz.replace(URL_RE, " ").replace(/[ \t]+/g, " ").trim();
  const bos = { kisiler: [] as YorumKisi[], tipIpucu: null as Yorum["tipIpucu"] };

  // 1) Portal ilan sayfası
  if (portalSayfasiMi(duz)) {
    const p = portalParcasi(ham, duz, adresler, ix);
    const ad = p.h.portal === "HEPSIEMLAK" ? "Hepsiemlak" : p.h.portal === "EMLAKJET" ? "Emlakjet" : "Sahibinden";
    return { ...bos, tur: "PORTAL_ILANI", parcalar: [p], guven: p.h.mulkTipi && p.h.fiyat != null ? 0.95 : 0.7, aciklama: `Bu bir ${ad} ilan sayfası. Kategori, Türü, m², Bina Yaşı gibi satırları ayrı kayıt değil, tek ilanın alanları olarak okudum → 1 portföy.` };
  }

  // 2) Yalnızca bağlantı(lar)
  const sluglar = adresler.map((a) => ({ a, s: slugMetni(a) })).filter((x) => x.s);
  const govdeH = govde.length >= 6 ? hizliAyristir(govde) : null;
  const govdeBos = !govdeH || (!govdeH.mulkTipi && !govdeH.odaSayisi && govdeH.fiyat == null && govdeH.maxFiyat == null && govdeH.m2 == null && govdeH.minM2 == null);
  if (sluglar.length && (govdeBos || sluglar.length > 1)) {
    const parcalar = sluglar.map(({ a, s }, i) => {
      const p = parca(sluglar.length === 1 ? ham : a, ix, "BAGLANTI", s!.metin);
      p.no = i + 1; p.h.tip = "PORTFOY"; p.h.portal = s!.portal; p.h.portalUrl = a; p.h.ilanNo = s!.ilanNo ?? p.h.ilanNo;
      p.h.ilanSahibiTipi = p.h.ilanSahibiTipi ?? "PORTAL";
      if (s!.kategori === "ARSA" && !/TARLA|ZEYTINLIK|BAG_BAHCE/.test(p.h.mulkTipi ?? "")) p.h.mulkTipi = "ARSA";
      if (s!.kategori === "KONUT" && !p.h.mulkTipi) p.h.mulkTipi = "DAIRE";
      if (s!.kategori === "ISYERI" && !p.h.mulkTipi) { p.h.mulkTipi = "DUKKAN_MAGAZA"; p.uyarilar.push("İş yeri türü bağlantıda yazmıyor; dükkân olarak okundu."); }
      p.uyarilar = p.uyarilar.filter((u) => !/Talep mi ilan mı/.test(u));
      if (p.h.fiyat == null) p.uyarilar.push("Bağlantıda fiyat yok — ilanı açıp fiyatı ekleyin.");
      p.ek.ozet = s!.metin.replace(/\b(satilik|kiralik|sahibinden|emlak|antalya)\b/gi, " ").replace(/\s+/g, " ").trim().replace(/(^|\s)\p{L}/gu, (c) => c.toLocaleUpperCase("tr")).slice(0, 110) + (p.h.islemTipi === "KIRALIK" ? " · kiralık" : p.h.islemTipi === "SATILIK" ? " · satılık" : "");
      return p;
    });
    return { ...bos, tur: "BAGLANTI", parcalar, guven: 0.6, aciklama: `${sluglar.length > 1 ? sluglar.length + " ilan bağlantısı" : "Yalnızca ilan bağlantısı"} var. İlan sayfasını açamıyorum; bağlantı adresindeki sözcüklerden (tür, işlem, oda, bölge) okudum.` };
  }
  const slugEki = sluglar.length === 1 ? sluglar[0].s!.metin : "";

  // 3) Kişi / telefon
  const satirlar = govde.split("\n").map((s) => s.trim()).filter(Boolean);
  const kisiSatirlari = satirlar.filter((s) => { TEL.lastIndex = 0; if (!TEL.test(s)) return false; const h = hizliAyristir(s); return !h.mulkTipi && !h.odaSayisi && h.fiyat == null && h.maxFiyat == null && h.m2 == null && h.minM2 == null; });
  if (kisiSatirlari.length && kisiSatirlari.length === satirlar.filter((s) => s.length > 3).length && !slugEki) {
    const kisiler = kisiSatirlari.map((s) => {
      TEL.lastIndex = 0;
      const t = s.match(TEL)![0];
      const h = hizliAyristir(s);
      const ad = s.replace(t, " ").replace(/\b(tel|telefon|gsm|cep|no|numara(s[ıi])?|yeni ki[şs]i|ki[şs]i|kaydet|ekle)\b\s*:?/gi, " ").replace(/[,:;–—-]+/g, " ").replace(/\s+/g, " ").trim();
      return { adSoyad: ad || "Yeni kişi", telefon: h.telefon, sirket: h.sirket && h.sirket !== ad ? h.sirket : null };
    });
    return { ...bos, kisiler, tur: "KISI", parcalar: [], guven: 0.9, aciklama: `Mülk bilgisi yok, telefon var → ${kisiler.length > 1 ? kisiler.length + " kişi" : "yeni kişi"} olarak okudum.` };
  }

  // 4) "2 ayrı talep": aynı özellikler, her bölge için ayrı kayıt
  const ayri = kucuk(govde).match(/\b(\d|iki|[üu][çc]|d[öo]rt)\s*ayr[ıi]\s*(talep|ilan|portf[öo]y)/);
  if (ayri) {
    const adet = ({ iki: 2, "üç": 3, uc: 3, "dört": 4, dort: 4 } as Record<string, number>)[ayri[1]] ?? Number(ayri[1]);
    const taban = parca(govde, ix, "COKLU_TALEP", slugEki);
    if (taban.konumlar.length === adet) {
      const parcalar = taban.konumlar.map((k, i) => ({ ...taban, h: { ...taban.h }, no: i + 1, konumlar: [k], uyarilar: [...taban.uyarilar], notlar: [...taban.notlar] }));
      return { ...bos, tur: "COKLU_TALEP", parcalar, guven: 0.8, aciklama: `Mesajda “${ayri[0]}” deniyor ve ${adet} bölge sayılıyor → aynı özelliklerle her bölge için ayrı ${taban.h.tip === "TALEP" ? "talep" : "kayıt"} açtım.` };
    }
  }

  // 5) Liste mi, tek kayıt mı? — satırlar birbiriyle ÇELİŞİYORSA (farklı oda/fiyat/tür/bölge) ayrı kayıtlardır.
  const c = capalar(govde, ix);
  const guclu = c.filter((x) => x.guclu);
  const celiski = guclu.length >= 2 && guclu.some((a, i) => guclu.slice(i + 1).some((b) => celisir(a, b)));
  const yapisal = c.filter((x) => x.kisi || x.numarali).length >= 2;
  if (c.length >= 2 && (celiski || yapisal)) {
    const liste = mesajiBol(govde, ix);
    if (liste.length >= 2) {
      const basliktaTalep = /talep\s*(toplant|listesi)|talepler\b/i.test(govde), basliktaPortfoy = /portf[öo]y\s*listesi|portf[öo]yler\b|ilanlar[ıi]m[ıi]z/i.test(govde);
      const kisili = liste.filter((l) => l.kisiAdi).length >= liste.length / 2;
      const parcalar = liste.map((l, i) => {
        const p = parca(l.metin, ix, "TOPLU_LISTE");
        p.h = l.h; p.no = i + 1; p.kisiAdi = l.kisiAdi ?? null; p.telefon = l.telefon ?? null; p.ilGeneli = l.ilGeneli;
        p.konumlar = (konumBul(l.metin, ix).length ? konumBul(l.metin, ix) : l.konumlar).filter((k: string) => !p.haricKonumlar.map(kucuk).includes(kucuk(k)));
        p.uyarilar = p.uyarilar.filter((u) => !/Talep mi ilan mı/.test(u));
        if (l.miras.length) p.uyarilar.push(`Önceki satırdan alındı: ${l.miras.join(", ")}`);
        return p;
      });
      return { kisiler: [], tur: "TOPLU_LISTE", parcalar, guven: 0.8, tipIpucu: basliktaTalep ? "TALEP" : basliktaPortfoy ? "PORTFOY" : kisili ? "TALEP" : null, aciklama: `Satırlar birbirinden farklı mülk, bütçe ya da kişi anlatıyor → ${parcalar.length} ayrı kayıt${kisili ? "; satır başındaki adları kişi olarak aldım" : ""}.` };
    }
  }

  // 6) Tek kayıt
  const p = parca(slugEki ? duz : govde, ix, "TEK_KAYIT", slugEki);
  if (slugEki) { p.metin = ham.trim(); p.h.portalUrl = sluglar[0].a; p.h.portal = sluglar[0].s!.portal; p.h.ilanNo = sluglar[0].s!.ilanNo ?? p.h.ilanNo; p.h.tip = "PORTFOY"; p.uyarilar = p.uyarilar.filter((u) => !/Talep mi ilan mı/.test(u)); }
  const cokSatir = satirlar.length > 1;
  const ne = p.h.tip === "TALEP" ? "talep" : "ilan";
  return { ...bos, tur: "TEK_KAYIT", parcalar: [p], guven: p.h.yeterli && p.konumlar.length ? 0.85 : p.h.eksik.length <= 1 ? 0.65 : 0.45, aciklama: cokSatir ? `Tek bir ${ne}: satırların hepsi aynı kaydın ayrıntısı (tek mülk, tek ${p.h.tip === "TALEP" ? "bütçe" : "fiyat"}).` : `Tek bir ${ne} olarak okudum.` };
}

/** Ana giriş: yapıştırılan metni yorumlar. */
/** v3.12 — tek bir WhatsApp mesajını (çok ilanlı olabilir) kurallarla parçalara ayırır; içe aktarmada ilk geçiş. */
export function mesajiYorumla(metin: string, ix: LokasyonIndeks): { parcalar: YorumParca[]; tipIpucu: Yorum["tipIpucu"]; tur: YorumTuru } {
  const t = tekMesaj(metin, ix);
  for (const p of t.parcalar) { const g = parcaGuveni(p); p.guven = g.puan; p.eksikler = g.eksikler; }
  return { parcalar: t.parcalar, tipIpucu: t.tipIpucu, tur: t.tur };
}

export function yorumla(hamMetin: string, ix: LokasyonIndeks): Yorum {
  const ham = hamMetin.replace(/\r\n?/g, "\n").trim();
  if (!ham) return { tur: "BOS", aciklama: "", guven: 0, parcalar: [], kisiler: [], atlanan: [], tipIpucu: null };
  const satirlar = ham.split("\n");

  // WhatsApp sohbet dökümü
  if (satirlar.filter((s) => WA_SATIR.test(s)).length >= 2 || (WA_SATIR.test(satirlar[0]) && /\]\s.+?:\s|\s-\s.+?:\s/.test(satirlar[0]))) {
    const mesajlar = sohbetiAyristir(ham, "Yapıştırılan sohbet", "Yapıştırılan sohbet").map((m) => ({ ...m, metin: m.metin.replace(MEDYA, " ").trim() }));
    const { mesajlar: suzulmus } = onFiltre(mesajlar.filter((m) => m.metin), {});
    const neden = new Map<string, number>();
    const bosMedya = mesajlar.filter((m) => !m.metin).length;
    if (bosMedya) neden.set("Medya", bosMedya);
    const parcalar: YorumParca[] = [], kisiler: YorumKisi[] = [];
    let kayitliMesaj = 0;
    for (const m of suzulmus) {
      if (m.durum !== "ADAY") {
        // Ön filtre yalnızca bağlantı içeren mesajı "emlak içeriği yok" sayabilir; ilan bağlantısıysa kurtar.
        const kurtar = m.durum === "GURULTU" && (m.metin.match(URL_RE) ?? []).some((a) => slugMetni(a));
        if (!kurtar) { const n = m.durum === "TEKRAR" ? "Aynı mesajın tekrarı" : m.neden ?? "Diğer"; neden.set(n, (neden.get(n) ?? 0) + 1); continue; }
      }
      const t = tekMesaj(m.metin, ix);
      if (!t.parcalar.length) { neden.set("Emlak içeriği yok", (neden.get("Emlak içeriği yok") ?? 0) + 1); continue; }
      kayitliMesaj++;
      const ben = /^siz$|^you$/i.test(m.gonderen);
      const adGibi = !m.telefon && !ben && /\p{L}{2}/u.test(m.gonderen);
      for (const p of t.parcalar) {
        p.tarih = m.tarih; p.grup = m.grup;
        p.telefon = p.telefon ?? m.telefon ?? null;
        if (adGibi && EMLAKCI_ONEKI.test(m.gonderen) && (!p.h.ilanSahibiTipi || p.h.ilanSahibiTipi === "PORTAL")) p.h.ilanSahibiTipi = "EMLAKCI";
        p.kisiAdi = p.kisiAdi ?? (adGibi ? m.gonderen.replace(EMLAKCI_ONEKI, "").trim() : null);
        if (ben) p.notlar.push("Kendi mesajınız");
        p.no = parcalar.length + 1;
        parcalar.push(p);
      }
    }
    const atlanan = [...neden].map(([n, s]) => ({ neden: n, sayi: s })).sort((a, b) => b.sayi - a.sayi);
    const atl = atlanan.reduce((a, b) => a + b.sayi, 0);
    return guvenleriIsle({ tur: "WHATSAPP_SOHBETI", parcalar, kisiler, atlanan, tipIpucu: null, guven: 0.8, aciklama: `WhatsApp sohbet dökümü: ${mesajlar.length} mesajın ${kayitliMesaj} tanesinde ilan ya da talep var → ${parcalar.length} kayıt.${atl ? ` ${atl} mesaj (selamlaşma, silinen, medya, sistem) atlandı.` : ""} Çok satırlı mesajlar tek kayıt olarak okundu.` });
  }

  // Soru (havuzda arama)
  const tekSatir = satirlar.filter((s) => s.trim()).length === 1;
  if (tekSatir && metinTuru(ham) === "SORU" && !TALEP_ISARETI.test(kucuk(ham))) return { tur: "SORU", aciklama: "Soru olarak okudum → havuzda aradım.", guven: 0.9, parcalar: [], kisiler: [], atlanan: [], tipIpucu: null };

  const t = tekMesaj(ham, ix);
  return guvenleriIsle({ tur: t.tur, aciklama: t.aciklama, guven: t.guven, parcalar: t.parcalar, kisiler: t.kisiler, atlanan: [], tipIpucu: t.tipIpucu });
}

// ───────────────────────────── Güven kuralı (v3.10) ─────────────────────────────
/** Bu yüzdenin altındaki sonuçta "emin değilim" uyarısı belirginleşir ve yapay zekâ önerilir. Ayarlar › Yapay zekâ'dan değiştirilebilir. */
export const GUVEN_ESIGI = 70;
/**
 * Bir kaydın güven puanı (0–100) — ayrıştırmanın ne kadarının metinden kesin okunduğunu ölçer:
 *   mülk tipi 20 · talep/portföy 10 · işlem 15 (fiyat düzeyinden tahminse 5) · fiyat ya da bütçe 20 · konum 20 · alan ya da oda 15
 *   her "kontrol edin" uyarısı −5 (en çok −15). Yalnızca bağlantıdan okunan kayıt en çok 60 alır.
 */
export function parcaGuveni(p: YorumParca): { puan: number; eksikler: string[] } {
  const h = p.h, eksik: string[] = [];
  let puan = 0;
  if (h.mulkTipi) puan += 20; else eksik.push("mülk tipi");
  if (!p.uyarilar.some((u) => /Talep mi ilan mı/.test(u))) puan += 10; else eksik.push("talep mi ilan mı");
  if (h.islemTipi && !h.islemTahmini) puan += 15; else if (h.islemTipi) { puan += 5; eksik.push("satılık / kiralık (tahmin)"); } else eksik.push("satılık / kiralık");
  if ((h.fiyat ?? h.maxFiyat ?? h.minFiyat) != null) puan += 20; else eksik.push(h.tip === "TALEP" ? "bütçe" : "fiyat");
  if (p.konumlar.length || p.ilGeneli) puan += 20; else eksik.push("konum");
  if ((h.m2 ?? h.minM2 ?? h.maxM2) != null || h.odaSayisi) puan += 15; else eksik.push("alan ya da oda");
  const diger = p.uyarilar.filter((u) => !/Talep mi ilan mı|tahmin edildi|fiyat yok/i.test(u)).length;
  puan -= Math.min(15, diger * 5);
  if (p.altTur === "BAGLANTI") puan = Math.min(puan, 60);
  return { puan: Math.max(0, Math.min(100, puan)), eksikler: eksik };
}
/** Yorumun güveni: kayıtların ortalama puanı (0–1). Kişi ve soru için tür güveni kullanılır. */
function guvenleriIsle(y: Yorum): Yorum {
  if (!y.parcalar.length) return y;
  for (const p of y.parcalar) { const g = parcaGuveni(p); p.guven = g.puan; p.eksikler = g.eksikler; }
  const ort = y.parcalar.reduce((a, p) => a + (p.guven ?? 0), 0) / y.parcalar.length;
  return { ...y, guven: Math.round(ort) / 100 };
}

export const YORUM_ETIKETI: Record<YorumTuru, string> = {
  SORU: "Soru", PORTAL_ILANI: "Portal ilanı", WHATSAPP_SOHBETI: "WhatsApp sohbeti", TOPLU_LISTE: "Toplu liste", COKLU_TALEP: "Çoklu talep",
  TEK_KAYIT: "Tek kayıt", BAGLANTI: "İlan bağlantısı", KISI: "Kişi", BOS: "",
};

/**
 * Yapay zekâya gönderilecek yorumlama istemi. Kural tabanlı yorumun güveni düşükse ya da kullanıcı "yapay zekâya sor" derse kullanılır.
 * Çıktı: { tur, aciklama, kayitlar: [GeminiKayit + notlar[] + haricKonumlar[]], kisiler: [] }
 */
export function aiYorumIstemi(metin: string, kuralYorumu: Yorum, alanKurallari: string, sema: unknown): string {
  return `${alanKurallari}

EK GÖREV — ÖNCE ANLA, SONRA AYIR
Aşağıdaki metni bir emlak danışmanı uygulamasına yapıştırdı. Önce metnin NE olduğuna karar ver:
- PORTAL_ILANI: bir ilan sayfasından kopyalanmış (İlan No, Kategori, Türü, m²… etiket–değer satırları). TEK kayıttır; satırları ayrı kayıt yapma.
- TEK_KAYIT: bir ilan ya da bir talep; çok satırlı olsa da tek mülk / tek bütçe anlatıyor.
- TOPLU_LISTE: birbirinden bağımsız birden çok talep/ilan (toplantı notu, liste). Her biri ayrı kayıt.
- COKLU_TALEP: aynı özellikler birden çok bölge için ayrı ayrı isteniyor ("2 ayrı talep").
- WHATSAPP_SOHBETI: tarih-saatli sohbet dökümü; her mesajı ayrı değerlendir, selamlaşma/medya/silinen mesajları atla.
- KISI: yalnızca kişi adı / telefon; mülk yok. kayitlar boş, kisiler dolu.
- BAGLANTI: yalnızca ilan bağlantısı; adresteki sözcüklerden okunabileni çıkar.
Kurallar:
- Aynı kaydın ayrıntı satırlarını (ödeme planı, depozito, özellik listesi) AYRI kayıt yapma; "notlar" dizisine kısa cümleler olarak yaz.
- Metinde çelişen değer varsa (ör. ilanda 176 m², açıklamada 135 m²) yapılandırılmış alandakini yaz, çelişkiyi "notlar"a "KONTROL: …" diye ekle.
- "X hariç / X dışında" denilen yerleri lokasyonIfadeleri'ne KOYMA; "haricKonumlar" dizisine yaz.
- "aciklama": Türkçe, en fazla 2 cümle, kullanıcıya "bunu şöyle anladım" de.
Kural tabanlı ön okuma (yanlış olabilir, düzelt): tür=${kuralYorumu.tur}, ${kuralYorumu.parcalar.length} kayıt.

ÇIKTI: Yalnızca şu biçimde TEK bir JSON nesnesi:
{"tur":"PORTAL_ILANI|TEK_KAYIT|TOPLU_LISTE|COKLU_TALEP|WHATSAPP_SOHBETI|KISI|BAGLANTI","aciklama":"…","sinif":"PORTFOY|TALEP|HER_IKISI|GURULTU","kayitlar":[ŞEMADAKİ kayıt + "notlar":["…"] + "haricKonumlar":["…"]],"kisiler":[{"adSoyad":"…","telefon":"…","sirket":null}]}
Kayıt alanları için ŞEMA (enum alanlarında yalnızca listelenen değerler):
${JSON.stringify((sema as any)?.properties?.kayitlar?.items ?? sema)}

METİN:
${metin.slice(0, 12000)}`;
}