/**
 * Anahtar CRM v3.13 · 3 Ekim 2026
 * Google Kişiler (People API) → Anahtar Kişiler. Veritabanısız, saf fonksiyonlar:
 * demo uygulama ve sunucu senkron işi AYNI dönüştürücüyü ve AYNI planlayıcıyı kullanır.
 *
 * Kurallar (v3.6 kararı):
 *  - Telefonu olan her kişi içe alınır: amaç WhatsApp'tan gelen numarayı anında tanımak. Telefonsuz kişi atlanır.
 *  - Eşleştirme sırası: Google kimliği (resourceName) → telefon (son 10 hane) → e-posta. Aynı kişi iki kez oluşmaz.
 *  - Google'daki etiketler (Emlakçılar, Yatırımcılar…) Anahtar rollerine çevrilir; roller yalnızca eklenir, silinmez.
 *  - Alanlar üç yönlü birleştirilir (src/lib/senkron/birlestir.ts): Anahtar'da düzelttiğiniz alan Google'dan ezilmez.
 *  - Google'da silinen kişi Anahtar'da SİLİNMEZ (talep/portföye bağlı olabilir); Google bağı kopar, not düşülür.
 */
import { ucYonluBirlestir, telAnahtari, telE164, type AlanCakismasi } from "../senkron/birlestir";

// ───────── People API tipleri (yalnızca kullandığımız alanlar) ─────────
export interface GooglePerson {
  resourceName: string;
  etag?: string;
  metadata?: { deleted?: boolean };
  names?: { displayName?: string; givenName?: string; familyName?: string; metadata?: { primary?: boolean } }[];
  phoneNumbers?: { value?: string; canonicalForm?: string; type?: string; metadata?: { primary?: boolean } }[];
  emailAddresses?: { value?: string; metadata?: { primary?: boolean } }[];
  organizations?: { name?: string; title?: string }[];
  biographies?: { value?: string }[];
  memberships?: { contactGroupMembership?: { contactGroupResourceName?: string } }[];
}
export interface GoogleGrup { resourceName: string; name?: string; formattedName?: string; groupType?: string }

/** Google etiketi (küçük harf) → Anahtar kişi rolü */
export const ETIKET_ROL: [RegExp, string][] = [
  [/emlak|broker|gayrimenkul|realtor/, "EMLAKCI"],
  [/yat[ıi]r[ıi]mc[ıi]\s*\+\+|vip/, "YATIRIMCI_VIP"],
  [/yat[ıi]r[ıi]mc|investor/, "YATIRIMCI"],
  [/m[üu]teah?h?it|in[şs]aat|contractor/, "MUTEAHHIT"],
  [/al-?sat/, "AL_SAT"],
  [/al[ıi]c[ıi]|buyer/, "ALICI"],
  [/sat[ıi]c[ıi]|seller/, "SATICI"],
  [/kirac[ıi]|tenant/, "KIRACI"],
  [/ev sahibi|m[üu]lk sahibi|kiraya veren|landlord/, "KIRAYA_VEREN"],
  [/i[şs] orta[ğg][ıi]|partner/, "IS_ORTAGI"],
  [/firma|[şs]irket|kurumsal|company/, "FIRMA"],
];
export function etiketRolleri(etiketler: string[]): string[] {
  const r = new Set<string>();
  for (const e of etiketler) {
    const k = e.toLocaleLowerCase("tr");
    const bulunan = ETIKET_ROL.find(([re]) => re.test(k));
    if (bulunan) r.add(bulunan[1]);
  }
  return [...r];
}

/** Karşılaştırılan (senkronlanan) kişi alanları */
export const GOOGLE_ALANLARI = ["adSoyad", "telefon", "ikincilTelefon", "email", "sirket", "notlar"] as const;
export type GoogleAlan = (typeof GOOGLE_ALANLARI)[number];
export type GoogleKisiAlanlari = { [K in GoogleAlan]: string | null };

export interface GoogleDonusum {
  resourceName: string;
  etag: string | null;
  silindi: boolean;
  kisi: (GoogleKisiAlanlari & { roller: string[]; etiketler: string[] }) | null;
  atlamaNedeni: "TELEFONSUZ" | "ADSIZ" | "ETIKET_DISI" | null;
}

const birincil = <T extends { metadata?: { primary?: boolean } }>(l?: T[]) => l?.find((x) => x.metadata?.primary) ?? l?.[0];

export function googleKisiDonustur(p: GooglePerson, grupAdlari: Map<string, string> = new Map(), sadeceEtiketler: string[] = []): GoogleDonusum {
  const temel = { resourceName: p.resourceName, etag: p.etag ?? null };
  if (p.metadata?.deleted) return { ...temel, silindi: true, kisi: null, atlamaNedeni: null };
  const etiketler = (p.memberships ?? []).map((m) => grupAdlari.get(m.contactGroupMembership?.contactGroupResourceName ?? "")).filter((x): x is string => !!x);
  if (sadeceEtiketler.length && !etiketler.some((e) => sadeceEtiketler.includes(e))) return { ...temel, silindi: false, kisi: null, atlamaNedeni: "ETIKET_DISI" };
  const telefonlar = [...new Set((p.phoneNumbers ?? []).slice().sort((a, b) => Number(!!b.metadata?.primary) - Number(!!a.metadata?.primary)).map((t) => telE164(t.canonicalForm ?? t.value)).filter((x): x is string => !!x))];
  if (!telefonlar.length) return { ...temel, silindi: false, kisi: null, atlamaNedeni: "TELEFONSUZ" };
  const n = birincil(p.names);
  const org = p.organizations?.[0];
  const ad = (n?.displayName ?? [n?.givenName, n?.familyName].filter(Boolean).join(" ")).trim() || org?.name?.trim() || "";
  if (ad.length < 2) return { ...temel, silindi: false, kisi: null, atlamaNedeni: "ADSIZ" };
  return {
    ...temel, silindi: false, atlamaNedeni: null,
    kisi: {
      adSoyad: ad,
      telefon: telefonlar[0],
      ikincilTelefon: telefonlar[1] ?? null,
      email: birincil(p.emailAddresses)?.value?.trim().toLowerCase() || null,
      sirket: org?.name?.trim() || null,
      notlar: p.biographies?.[0]?.value?.trim() || null,
      roller: etiketRolleri(etiketler),
      etiketler,
    },
  };
}

// ───────── Planlayıcı ─────────
export interface MevcutKisi extends GoogleKisiAlanlari {
  id: string;
  roller: string[];
  googleResourceName: string | null;
  googleSnapshot: Partial<GoogleKisiAlanlari> | null;
}
export interface GooglePlani {
  ekle: { gecici: string; resourceName: string; etag: string | null; alanlar: GoogleKisiAlanlari; roller: string[]; snapshot: GoogleKisiAlanlari }[];
  guncelle: { id: string; resourceName: string; etag: string | null; degisiklik: Partial<GoogleKisiAlanlari>; yeniRoller: string[]; snapshot: Partial<GoogleKisiAlanlari>; baglandi: boolean; cakismalar: AlanCakismasi[] }[];
  bagiKopar: { id: string; resourceName: string }[];
  atlanan: { resourceName: string; neden: string }[];
  ozet: { gelen: number; yeni: number; guncellenen: number; baglanan: number; degismeyen: number; cakisma: number; silinen: number; atlanan: number; birlesen: number };
}

export function googleSenkronPlani(mevcut: MevcutKisi[], gelen: GoogleDonusum[]): GooglePlani {
  const plan: GooglePlani = { ekle: [], guncelle: [], bagiKopar: [], atlanan: [], ozet: { gelen: gelen.length, yeni: 0, guncellenen: 0, baglanan: 0, degismeyen: 0, cakisma: 0, silinen: 0, atlanan: 0, birlesen: 0 } };
  const byRes = new Map<string, MevcutKisi>(), byTel = new Map<string, MevcutKisi>(), byMail = new Map<string, MevcutKisi>();
  const indeksle = (k: MevcutKisi) => {
    if (k.googleResourceName) byRes.set(k.googleResourceName, k);
    for (const t of [k.telefon, k.ikincilTelefon]) { const a = telAnahtari(t); if (a && !byTel.has(a)) byTel.set(a, k); }
    if (k.email) byMail.set(k.email.toLowerCase(), k);
  };
  mevcut.forEach(indeksle);
  const eklenenTel = new Map<string, GooglePlani["ekle"][number]>();
  const dokunulan = new Set<string>();

  for (const g of gelen) {
    if (g.silindi) {
      const k = byRes.get(g.resourceName);
      if (k) { plan.bagiKopar.push({ id: k.id, resourceName: g.resourceName }); plan.ozet.silinen++; }
      continue;
    }
    if (!g.kisi) { plan.atlanan.push({ resourceName: g.resourceName, neden: g.atlamaNedeni ?? "?" }); plan.ozet.atlanan++; continue; }
    const { roller, etiketler: _e, ...alanlar } = g.kisi;
    const tel = telAnahtari(alanlar.telefon);
    const k = byRes.get(g.resourceName) ?? (tel ? byTel.get(tel) : undefined) ?? (alanlar.email ? byMail.get(alanlar.email) : undefined);
    if (!k) {
      // Aynı turda aynı telefonla ikinci Google kaydı → ilkine katılır (Google'daki mükerrer kişi)
      const once = tel ? eklenenTel.get(tel) : undefined;
      if (once) { once.roller = [...new Set([...once.roller, ...roller])]; plan.ozet.birlesen++; continue; }
      const e = { gecici: "g:" + g.resourceName, resourceName: g.resourceName, etag: g.etag, alanlar, roller, snapshot: alanlar };
      plan.ekle.push(e); plan.ozet.yeni++;
      if (tel) eklenenTel.set(tel, e);
      continue;
    }
    if (dokunulan.has(k.id)) { plan.ozet.birlesen++; continue; }
    dokunulan.add(k.id);
    const baglandi = k.googleResourceName !== g.resourceName;
    const b = ucYonluBirlestir<GoogleKisiAlanlari>(k, alanlar, baglandi ? null : k.googleSnapshot, [...GOOGLE_ALANLARI]);
    // İlk bağlamada telefon farkı çakışma sayılmaz (zaten telefonla eşleşti; biçim farkıdır)
    const cakismalar = b.cakismalar.filter((c) => !(c.alan === "telefon" && telAnahtari(c.yerel as string) === telAnahtari(c.uzak as string)));
    const yeniRoller = roller.filter((r) => !k.roller.includes(r));
    const degisti = Object.keys(b.degisiklik).length > 0 || yeniRoller.length > 0;
    plan.guncelle.push({ id: k.id, resourceName: g.resourceName, etag: g.etag, degisiklik: b.degisiklik, yeniRoller, snapshot: b.yeniSnapshot, baglandi, cakismalar });
    if (baglandi) plan.ozet.baglanan++;
    else if (degisti) plan.ozet.guncellenen++;
    else plan.ozet.degismeyen++;
    plan.ozet.cakisma += cakismalar.length;
  }
  return plan;
}

export const ATLAMA_ETIKET: Record<string, string> = { TELEFONSUZ: "Telefonu yok", ADSIZ: "Adı yok", ETIKET_DISI: "Seçili etiketlerde değil" };