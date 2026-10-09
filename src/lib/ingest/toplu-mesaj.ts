/**
 * Anahtar CRM v3.22.1 · 9 Ekim 2026
 * Tek mesajda birden çok talep / portföy (haftalık talep toplantısı notu, meslektaşın liste mesajı) → ayrı kayıtlar.
 * Yapay zekâsız: satır / madde işareti / numara ile bölünür; "Ad Soyad –" ya da "Ad Soyad:" ile başlayan satırdan
 * kişi alınır; yalnız ad yazan satır, altındaki satırların kişisi olur; aynı satırda "2+1 3,5 milyon / 1+1 3 milyon"
 * gibi iki ayrı istek varsa ikiye bölünür ve konum/işlem ilk parçadan miras alınır.
 */
import { hizliAyristir, metindenKonumlar, type HizliSonuc } from "../ai/hizli-ayristirici";
import type { LokasyonIndeks } from "../lokasyon/cozumle";

export interface MesajParcasi {
  no: number;
  metin: string;
  kisiAdi: string | null;
  telefon: string | null;
  h: HizliSonuc;
  konumlar: string[];
  /** "Antalya geneli / merkez" — il geneli konum */
  ilGeneli: boolean;
  /** Bu parça bir önceki parçadan konum / işlem / tip miras aldı */
  miras: string[];
}

const kucuk = (s: string) => s.toLocaleLowerCase("tr");
const MADDE = /^\s*(?:[-–—•*▪►✅☑️🍀🔹🔸📌]+|\d{1,2}[.)-]|[a-z][.)])\s*/u;
const BASLIK = /(toplant|hafta|talep ?listesi|talepler|portf[öo]yler|g[üu]ndem|tarih\s*:)/;
const IPUCU = /(\d\s*\+\s*\d|\d[\d.,]*\s*(m2|m²|metre|d[öo]n[üu]m|milyon|bin|tl|₺|k\b)|sat[ıi]l[ıi]k|kiral[ıi]k|devren|daire|villa|arsa|tarla|depo|d[üu]kkan|ofis|fabrika|ma[ğg]aza|bina|i[şs]yeri|imalathane|at[öo]lye|otel|m[üu]stakil|rezidans|plaza)/;
/** "Önder S. –", "Nilgün Özçelebi:", "AHMET BEY -" */
const AD_ONEK = /^([\p{Lu}][\p{L}.']*(?:\s+[\p{Lu}][\p{L}.']*){0,3})\s*(?:[–—:-]|\s-\s)\s*/u;
const SADECE_AD = /^([\p{Lu}][\p{L}.']*(?:\s+[\p{L}][\p{L}.']*){0,3})\s*:?$/u;
const ipucuVar = (s: string) => IPUCU.test(kucuk(s));
/** Yeni kayıt başlatan güçlü ipucu: oda, mülk türü ya da işlem (yalnız fiyat yazan satır öncekinin devamıdır) */
const GUCLU = /(\d\s*\+\s*\d|sat[ıi]l[ıi]k|kiral[ıi]k|devren|daire|villa|arsa|tarla|depo|d[üu]kkan|ofis|fabrika|ma[ğg]aza|bina|i[şs]yeri|imalathane|at[öo]lye|otel|m[üu]stakil|rezidans|plaza|antrepo|lojistik)/;
const gucluVar = (s: string) => GUCLU.test(kucuk(s));
const ISLEM = /sat[ıi]l[ıi]k|kiral[ıi]k|devren/;
const MULK = /(\d\s*\+\s*\d|daire|villa|arsa|tarla|depo|d[üu]kkan|ofis|fabrika|ma[ğg]aza|bina|i[şs]yeri|imalathane|at[öo]lye|otel|m[üu]stakil|rezidans|plaza|antrepo|lojistik|\d[\d.,]*\s*(?:m2|m²|tl|₺|dolar|usd|euro|€|milyon|bin))/;

export function mesajiBol(metin: string, ix: LokasyonIndeks): MesajParcasi[] {
  const satirlar = metin.replace(/\r/g, "").split("\n").map((s) => s.trim());
  const ham: { metin: string; kisi: string | null }[] = [];
  let aktifKisi: string | null = null;
  for (let s of satirlar) {
    if (!s) { aktifKisi = null; continue; }
    s = s.replace(MADDE, "").trim(); if (!s) continue;
    if (!ipucuVar(s) && BASLIK.test(kucuk(s)) && s.length < 80) continue; // "HAFTALIK TALEP TOPLANTISI – 1. HAFTA"
    const sadeceAd = s.match(SADECE_AD);
    if (sadeceAd && !ipucuVar(s) && s.split(/\s+/).length <= 4) { aktifKisi = sadeceAd[1].trim(); continue; }
    let kisi = aktifKisi;
    const on = s.match(AD_ONEK);
    if (on && !ipucuVar(on[1]) && on[1].split(/\s+/).length <= 4) { kisi = on[1].replace(/\s+(bey|hanım|hn|hanim)\.?$/i, (x) => x).trim(); s = s.slice(on[0].length); }
    if (!gucluVar(s) && ham.length && (kisi === ham[ham.length - 1].kisi || !on)) { ham[ham.length - 1].metin += " " + s; continue; } // önceki maddenin devamı
    // v3.12 — "1. Satılık, Antalya, Kepez, Küçükçuk." + alt satırda "1+1 Daire, 50m², 80.000 dolar" aynı ilanın iki satırıdır (başlık satırı mülk bilgisi taşımaz)
    const onceki = ham[ham.length - 1];
    if (onceki && kisi === onceki.kisi && ISLEM.test(kucuk(onceki.metin)) && !MULK.test(kucuk(onceki.metin)) && !ISLEM.test(kucuk(s))) { onceki.metin += " " + s; continue; }
    if (!ham.length && !ipucuVar(s) && !gucluVar(s)) continue; // "Yeni Yılınız kutlu olsun…" gibi selam satırı kayıt değildir
    ham.push({ metin: s, kisi });
  }
  // Aynı satırda birden çok istek: " / " ya da " ; " ile ayrılmış, her parçada oda veya fiyat ipucu varsa böl
  const out: MesajParcasi[] = [];
  for (const r of ham) {
    const parcalar = r.metin.split(/\s+\/\s+|\s*;\s*|\s+ayr[ıi]ca\s+/i).map((x) => x.trim()).filter(Boolean);
    const bolunur = parcalar.length > 1 && parcalar.every((p) => /\d\s*\+\s*\d|\d[\d.,]*\s*(milyon|bin|tl|m2|m²|d[öo]n[üu]m)/i.test(p));
    const liste = bolunur ? parcalar : [r.metin];
    const ilk = hizliAyristir(liste[0]);
    const ilkKonum = metindenKonumlar(r.metin, ix);
    liste.forEach((p, i) => {
      const h = hizliAyristir(p);
      const miras: string[] = [];
      if (i > 0) {
        if (!h.islemTipi && ilk.islemTipi) { h.islemTipi = ilk.islemTipi; miras.push("işlem"); }
        if (!h.mulkTipi && ilk.mulkTipi) { h.mulkTipi = ilk.mulkTipi; miras.push("mülk tipi"); }
      }
      const kendi = metindenKonumlar(p, ix);
      if (i > 0 && !kendi.length && ilkKonum.length) miras.push("konum");
      out.push({ no: out.length + 1, metin: p, kisiAdi: h.kisiAdi ?? r.kisi, telefon: h.telefon, h, konumlar: kendi.length ? kendi : ilkKonum, ilGeneli: /antalya\s*(geneli|genelinde|merkez|i[çc]i)|her yer/i.test(r.metin), miras });
    });
  }
  return out;
}

/** AI kutusu için: yapıştırılan metin birden çok kayıt mı içeriyor? */
export const cokluKayitMi = (metin: string, ix: LokasyonIndeks) => metin.split("\n").filter((s) => s.trim()).length >= 2 && mesajiBol(metin, ix).length >= 2;