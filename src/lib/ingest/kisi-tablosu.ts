/**
 * Anahtar CRM v3.17 · 6 Ekim 2026
 * Kişi tablosu içe aktarma (Google Contacts / Outlook CSV, ofis kişi listesi).
 * Önceden CSV yalnızca ilan tablosu sanılıyordu; kişi dosyalarında yalnız ad ve telefon alınıyordu.
 * Burada e-posta, şirket, not, etiket/rol ve ikinci telefon da ayrıştırılır; telefonlar doğrulanıp uyarıya dönüşür.
 * Büyük dosyalar (7.000+ satır) `paketle()` ile 500'erli bölünür — sunucu tek istekte boğulmasın (504/503).
 */
import { telE164 } from "../senkron/birlestir";

export type KisiSutunu = "ad" | "soyad" | "tamAd" | "telefon" | "telefon2" | "email" | "sirket" | "unvan" | "not" | "etiket" | "yok";

/** Google Contacts (TR ve EN), Outlook ve elle hazırlanmış tabloların başlıkları */
const BASLIKLAR: [KisiSutunu, RegExp][] = [
  ["tamAd", /^(name|ad soyad|ad[ıi] soyad[ıi]|full ?name|display ?name|görünen ad|isim)$/u],
  ["ad", /^(given ?name|first ?name|ad|isim|ön ad)$/u],
  ["soyad", /^(family ?name|last ?name|surname|soyad[ıi]?)$/u],
  ["telefon", /^(phone ?1 ?- ?value|phone ?number|mobile|cep|telefon ?1?|gsm|tel|numara|mobile ?phone)$/u],
  ["telefon2", /^(phone ?2 ?- ?value|telefon ?2|ikinci ?telefon|home ?phone|business ?phone|i[şs] ?telefonu)$/u],
  ["email", /^(e-?mail ?1? ?-? ?(value)?|e-?posta|mail|email ?address)$/u],
  ["sirket", /^(organization ?(1 ?- ?)?name|company|[şs]irket|firma|kurum|ofis)$/u],
  ["unvan", /^(organization ?(1 ?- ?)?title|job ?title|title|unvan|görev|pozisyon)$/u],
  ["not", /^(notes?|not(lar)?|açıklama|aciklama|description)$/u],
  ["etiket", /^(labels?|group ?membership|categories|etiket(ler)?|grup|kategori|rol(ler)?)$/u],
];

const sade = (s: string) => s.trim().toLocaleLowerCase("tr").replace(/\s+/g, " ").replace(/[:*]+$/, "");

/** Başlık satırından sütun eşlemesi çıkarır. */
export function kisiSutunlariniTani(basliklar: string[]): KisiSutunu[] {
  return basliklar.map((b) => BASLIKLAR.find(([, re]) => re.test(sade(b)))?.[0] ?? "yok");
}

/** Dosya kişi listesi mi, ilan listesi mi? (ad + telefon varsa kişi listesi) */
export function kisiTablosuMu(basliklar: string[]): boolean {
  const s = new Set(kisiSutunlariniTani(basliklar));
  const adVar = s.has("tamAd") || s.has("ad") || s.has("soyad");
  const iletisimVar = s.has("telefon") || s.has("telefon2") || s.has("email");
  return adVar && iletisimVar;
}

export interface KisiSatiri {
  satirNo: number;
  adSoyad: string;
  telefon: string | null;
  ikincilTelefon: string | null;
  email: string | null;
  sirket: string | null;
  notlar: string | null;
  etiketler: string[];
  /** Düzeltilemeyen telefonlar (ham hali) ve nedeni */
  uyarilar: string[];
  durum: "HAZIR" | "KONTROL" | "BOS";
}

/** Etiket / grup metnini rol koduna çevirir ("Alıcı", "* myContacts ::: Emlakçı" → ALICI / EMLAKCI) */
export function etiketlerdenRoller(ham: string, roller: readonly (readonly [string, string])[]): string[] {
  const p = ham.split(/[:;,|]+/).map((x) => sade(x)).filter((x) => x && x !== "* mycontacts" && x !== "mycontacts");
  const bulunan = new Set<string>();
  for (const parca of p) for (const [kod, etiket] of roller) if (parca === sade(etiket) || parca === sade(kod)) bulunan.add(kod);
  return [...bulunan];
}

/**
 * Telefonu +90… biçimine çevirir. Çevrilemiyorsa neden döner:
 *  - "905321112233" (12 hane) ve "5321112233" (10 hane) kabul edilir
 *  - 11 haneli "05321112233" başındaki 0 atılır
 *  - Eksik haneli ("905 532 111" gibi) numara kabul edilmez, uyarı verilir
 */
export function telefonCozumle(ham?: string | null): { tel: string | null; uyari: string | null } {
  const s = (ham ?? "").trim();
  if (!s) return { tel: null, uyari: null };
  const ilk = s.split(/[;,/]|\s{2,}/)[0].trim();
  const e164 = telE164(ilk);
  if (e164) return { tel: e164, uyari: null };
  const d = ilk.replace(/\D/g, "");
  if (!d) return { tel: null, uyari: `Telefon okunamadı: "${ilk}"` };
  if (d.length < 10) return { tel: null, uyari: `Eksik numara (${d.length} hane): "${ilk}"` };
  if (d.length > 13) return { tel: null, uyari: `Fazla haneli numara: "${ilk}"` };
  return { tel: null, uyari: `Türkiye biçimine uymuyor (yurt dışı olabilir): "${ilk}"` };
}

/** Bir satırı kişiye çevirir. */
export function kisiSatiriOku(hucreler: string[], sutunlar: KisiSutunu[], satirNo: number, roller: readonly (readonly [string, string])[] = []): KisiSatiri {
  const al = (k: KisiSutunu) => sutunlar.map((s, i) => (s === k ? (hucreler[i] ?? "").trim() : "")).filter(Boolean).join(" ").trim();
  const adSoyad = (al("tamAd") || [al("ad"), al("soyad")].filter(Boolean).join(" ")).trim();
  const t1 = telefonCozumle(al("telefon")), t2 = telefonCozumle(al("telefon2"));
  const uyarilar = [t1.uyari, t2.uyari].filter(Boolean) as string[];
  const email = al("email").split(/[;,\s]+/).filter((x) => x.includes("@"))[0] ?? null;
  const etiketler = etiketlerdenRoller(al("etiket"), roller);
  const telefon = t1.tel ?? t2.tel;
  const ad = adSoyad || telefon || email || "";
  return {
    satirNo, adSoyad: ad, telefon, ikincilTelefon: t1.tel && t2.tel ? t2.tel : null, email,
    sirket: al("sirket") || null,
    notlar: [al("not"), al("unvan") ? `Unvan: ${al("unvan")}` : ""].filter(Boolean).join(" · ") || null,
    etiketler, uyarilar,
    durum: !ad ? "BOS" : uyarilar.length || (!telefon && !email) ? "KONTROL" : "HAZIR",
  };
}

/** Büyük listeyi eşit paketlere böler (varsayılan 500): sunucu tek istekte boğulmasın. */
export function paketle<T>(liste: T[], boyut = 500): T[][] {
  if (boyut < 1) throw new Error("paket boyutu en az 1 olmalı");
  const p: T[][] = [];
  for (let i = 0; i < liste.length; i += boyut) p.push(liste.slice(i, i + boyut));
  return p;
}
export const PAKET_BOYU = 500;
