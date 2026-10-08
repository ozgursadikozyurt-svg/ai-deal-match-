/**
 * Anahtar CRM v3.21 · 8 Ekim 2026 (v3.13'ten)
 * Google Kişiler (People API) ⇄ Anahtar Kişiler. Veritabanısız, saf fonksiyonlar:
 * demo uygulama ve sunucu senkron işi AYNI dönüştürücüyü ve AYNI planlayıcıları kullanır.
 *
 * v3.21 — ÇİFT YÖNLÜ. Kuralların tamamı (tek bakışta):
 *   Google'a kişi eklendi            → Anahtar'a düşer (telefonu varsa)
 *   Google'da kişi değişti           → Anahtar'da güncellenir (üç yönlü birleştirme)
 *   Google'da kişi silindi           → Anahtar'da SİLİNMEZ; bağı kopar, not düşülür
 *   Anahtar'a elle kişi eklendi      → Google'a eklenir ("gönderilecek" işaretli kişi; toplu içe aktarma kendiliğinden gitmez)
 *   Anahtar'da kişi düzeltildi       → Google'da güncellenir (ad, telefonlar, e-posta, şirket; notlar gitmez)
 *   Bağlanma anındaki eski farklar   → GİTMEZ (yalnızca bağlandıktan sonra Anahtar'da yapılan düzeltme gönderilir)
 *   Anahtar'da alan boşaltıldı       → Google'da SİLİNMEZ (boş değer gönderilmez)
 *   Anahtar'dan kişi silindi         → Google'dan SİLİNMEZ; "silinenler" listesine girer, bir sonraki eşitlemede geri gelmez
 * Bu dosyada ve istemcide (istemci.ts) Google'dan kişi silen hiçbir çağrı yoktur — tests/v321.test.ts denetler.
 *
 * Çekme kuralları (v3.6 kararı):
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
  metadata?: { deleted?: boolean; sources?: { type?: string; id?: string; etag?: string }[] };
  names?: { displayName?: string; givenName?: string; familyName?: string; unstructuredName?: string; metadata?: { primary?: boolean } }[];
  phoneNumbers?: { value?: string; canonicalForm?: string; type?: string; formattedType?: string; metadata?: { primary?: boolean } }[];
  emailAddresses?: { value?: string; type?: string; displayName?: string; formattedType?: string; metadata?: { primary?: boolean } }[];
  organizations?: { name?: string; title?: string; department?: string; type?: string; formattedType?: string; metadata?: { primary?: boolean } }[];
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
  /** v3.21 — Anahtar'dan silindiği için yeniden eklenmeyenler */
  haricTutulan: { resourceName: string; ad: string }[];
  ozet: { gelen: number; yeni: number; guncellenen: number; baglanan: number; degismeyen: number; cakisma: number; silinen: number; atlanan: number; birlesen: number; haric: number };
}

/** v3.21 — Anahtar'dan silinmiş kişiler: Google kimliği ve / veya telefon anahtarı (son 10 hane) */
export interface HaricListesi { kimlikler: ReadonlySet<string>; telefonlar: ReadonlySet<string> }
export const BOS_HARIC: HaricListesi = { kimlikler: new Set(), telefonlar: new Set() };

export function googleSenkronPlani(mevcut: MevcutKisi[], gelen: GoogleDonusum[], haric: HaricListesi = BOS_HARIC): GooglePlani {
  const plan: GooglePlani = { ekle: [], guncelle: [], bagiKopar: [], atlanan: [], haricTutulan: [], ozet: { gelen: gelen.length, yeni: 0, guncellenen: 0, baglanan: 0, degismeyen: 0, cakisma: 0, silinen: 0, atlanan: 0, birlesen: 0, haric: 0 } };
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
      // v3.21 — Anahtar'dan silinmiş kişi Google'da duruyor: yeniden eklenmez (kullanıcı onu Anahtar'da istemedi).
      // Aynı telefonla Anahtar'a yeniden eklenmişse yukarıda zaten eşleşir ve bağlanır.
      if (haric.kimlikler.has(g.resourceName) || (tel && haric.telefonlar.has(tel))) {
        plan.haricTutulan.push({ resourceName: g.resourceName, ad: alanlar.adSoyad ?? "" }); plan.ozet.haric++; continue;
      }
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

// ═════════════════════════ v3.21 — ANAHTAR → GOOGLE (gönderim) ═════════════════════════
/**
 * Google'a GÖNDERİLEN alanlar. `notlar` bilerek yoktur: Anahtar'daki notlar iş notudur (görüşme, pazarlık),
 * ayrıca senkron kendi satırlarını ekler; telefon rehberine taşınmaz. Notlar yalnızca Google → Anahtar yönünde okunur.
 */
export const GONDERIM_ALANLARI = ["adSoyad", "telefon", "ikincilTelefon", "email", "sirket"] as const;
export type GonderimAlani = (typeof GONDERIM_ALANLARI)[number];
export type GonderimDegerleri = Partial<Record<GonderimAlani, string>>;

export interface GonderimAdayi extends GoogleKisiAlanlari {
  id: string;
  googleResourceName: string | null;
  googleSnapshot: Partial<GoogleKisiAlanlari> | null;
  /**
   * "Google'a gönderilecek" işareti. Bağlı olmayan kişide: Google'a eklenecek (elle eklendi / "Google'a gönder" dendi).
   * Bağlı kişide: Anahtar'da düzeltildi, değişiklik Google'a yazılacak. Senkronun kendi yazdıkları bu işareti KOYMAZ;
   * böylece Google'dan gelen bir değişiklik geri Google'a gönderilmez ve bağlanma anındaki eski farklar toplu hâlde gitmez.
   */
  googleBekliyor: Date | string | null;
  /** Google'da silinmiş kişi yeniden oluşturulmaz */
  kaynaktaSilindi: Date | string | null;
}
export interface GonderimPlani {
  olustur: { id: string; alanlar: GonderimDegerleri & { adSoyad: string; telefon: string } }[];
  guncelle: { id: string; resourceName: string; degisen: GonderimDegerleri; onceki: Partial<GoogleKisiAlanlari> }[];
  /** İşaretli ama gönderilecek bir şeyi olmayan kişiler (işaret kaldırılır): fark yok, telefonu yok, Google'da silinmiş… */
  temizle: string[];
  /** Sınır yüzünden bu tura sığmayan iş sayısı (sonraki turda gider) */
  kalan: number;
}
const bosMu = (v: unknown) => v == null || String(v).trim() === "";
const ayniDeger = (alan: GonderimAlani, a: unknown, b: unknown) => {
  if (bosMu(a) && bosMu(b)) return true;
  if (alan === "telefon" || alan === "ikincilTelefon") return telAnahtari(a as string) === telAnahtari(b as string) && !!telAnahtari(a as string);
  if (alan === "email") return String(a ?? "").trim().toLowerCase() === String(b ?? "").trim().toLowerCase();
  return String(a ?? "").trim().replace(/\s+/g, " ") === String(b ?? "").trim().replace(/\s+/g, " ");
};
/** Anahtar'daki bir düzenleme Google'a gidecek bir alanı değiştirdi mi? (sunucu, kişi kaydedilirken işaret koymak için kullanır) */
export function gonderimAlaniDegisti(onceki: Partial<GoogleKisiAlanlari>, yeni: Partial<GoogleKisiAlanlari>): boolean {
  return GONDERIM_ALANLARI.some((a) => !bosMu(yeni[a]) && !ayniDeger(a, yeni[a], onceki[a]));
}

/**
 * Anahtar'daki "gönderilecek" işaretli kişilerden Google'a ne yazılacağını çıkarır. Saf fonksiyon.
 *  - olustur: Google'a bağlı olmayan, telefonu ve adı olan kişi (Google'da silinmiş kişi yeniden oluşturulmaz)
 *  - guncelle: Google'a bağlı kişide son eşitlemedeki değerden FARKLI ve BOŞ OLMAYAN alanlar
 *    (boşaltılan alan gönderilmez → Google'da bilgi silinmez; açık çakışması olan kişi bekler → önce kullanıcı seçer)
 */
export function googleGonderimPlani(kisiler: GonderimAdayi[], o: { cakismali?: ReadonlySet<string>; sinir?: number; olusturma?: boolean } = {}): GonderimPlani {
  const sinir = o.sinir ?? 20;
  const plan: GonderimPlani = { olustur: [], guncelle: [], temizle: [], kalan: 0 };
  const yer = () => plan.olustur.length + plan.guncelle.length < sinir;
  for (const k of kisiler) {
    if (!k.googleBekliyor) continue;
    if (k.googleResourceName) {
      if (o.cakismali?.has(k.id)) continue; // çakışma çözülünce gider
      const snap = k.googleSnapshot ?? {};
      const degisen: GonderimDegerleri = {};
      for (const a of GONDERIM_ALANLARI) {
        const yerel = k[a];
        if (bosMu(yerel) || ayniDeger(a, yerel, snap[a])) continue;
        degisen[a] = a === "telefon" || a === "ikincilTelefon" ? (telE164(yerel) ?? String(yerel).trim()) : String(yerel).trim();
      }
      if (!Object.keys(degisen).length) { plan.temizle.push(k.id); continue; }
      if (yer()) plan.guncelle.push({ id: k.id, resourceName: k.googleResourceName, degisen, onceki: snap }); else plan.kalan++;
      continue;
    }
    if (o.olusturma === false) continue; // etiket süzgeci açık: işaret durur, süzgeç kalkınca gider
    const tel = telE164(k.telefon);
    if (k.kaynaktaSilindi || !tel || (k.adSoyad ?? "").trim().length < 2) { plan.temizle.push(k.id); continue; }
    const alanlar: GonderimPlani["olustur"][number]["alanlar"] = { adSoyad: k.adSoyad!.trim(), telefon: tel };
    const t2 = telE164(k.ikincilTelefon); if (t2 && t2 !== tel) alanlar.ikincilTelefon = t2;
    if (!bosMu(k.email)) alanlar.email = k.email!.trim().toLowerCase();
    if (!bosMu(k.sirket)) alanlar.sirket = k.sirket!.trim();
    if (yer()) plan.olustur.push({ id: k.id, alanlar }); else plan.kalan++;
  }
  return plan;
}

/** Yeni Google kişisinin gövdesi (people:createContact) */
export function googleOlusturmaGovdesi(a: GonderimDegerleri): Partial<GooglePerson> {
  return {
    names: [{ unstructuredName: a.adSoyad }],
    phoneNumbers: [a.telefon, a.ikincilTelefon].filter((x): x is string => !!x).map((value, i) => ({ value, type: i === 0 ? "mobile" : "other" })),
    ...(a.email ? { emailAddresses: [{ value: a.email }] } : {}),
    ...(a.sirket ? { organizations: [{ name: a.sirket }] } : {}),
  };
}

/**
 * Var olan Google kişisi için güncelleme gövdesi (people:updateContact). Google'daki kişinin GÜNCEL hâli alınır,
 * yalnızca değişen alan yerinde düzeltilir; kişinin Google'daki diğer telefonları / e-postaları / unvanı korunur.
 * Hiçbir öğe silinmez: eski değer bulunursa yenisiyle değişir, bulunamazsa yenisi listeye eklenir.
 */
export function googleGuncellemeGovdesi(guncel: GooglePerson, degisen: GonderimDegerleri, onceki: Partial<GoogleKisiAlanlari> = {}): { govde: Partial<GooglePerson>; maske: string[] } {
  const govde: Partial<GooglePerson> = { etag: guncel.etag, ...(guncel.metadata?.sources ? { metadata: { sources: guncel.metadata.sources } } : {}) };
  const maske: string[] = [];
  if (degisen.adSoyad) { govde.names = [{ unstructuredName: degisen.adSoyad }]; maske.push("names"); }
  if (degisen.telefon || degisen.ikincilTelefon) {
    const liste = (guncel.phoneNumbers ?? []).map((t) => ({ value: t.value, ...(t.type ? { type: t.type } : {}) }));
    let degisti = false;
    for (const a of ["telefon", "ikincilTelefon"] as const) {
      const yeni = degisen[a]; if (!yeni) continue;
      const anahtar = telAnahtari(yeni);
      if (liste.some((t) => telAnahtari(t.value) === anahtar)) continue; // Google'da zaten var
      const eski = telAnahtari(onceki[a]);
      const i = eski ? liste.findIndex((t) => telAnahtari(t.value) === eski) : -1;
      if (i >= 0) liste[i] = { ...liste[i], value: yeni }; else liste.push({ value: yeni, type: a === "telefon" ? "mobile" : "other" });
      degisti = true;
    }
    if (degisti) { govde.phoneNumbers = liste; maske.push("phoneNumbers"); }
  }
  if (degisen.email) {
    const liste = (guncel.emailAddresses ?? []).map((e) => ({ value: e.value, ...(e.type ? { type: e.type } : {}) }));
    if (!liste.some((e) => (e.value ?? "").toLowerCase() === degisen.email)) {
      const i = onceki.email ? liste.findIndex((e) => (e.value ?? "").toLowerCase() === onceki.email!.toLowerCase()) : -1;
      if (i >= 0) liste[i] = { ...liste[i], value: degisen.email }; else liste.unshift({ value: degisen.email });
      govde.emailAddresses = liste; maske.push("emailAddresses");
    }
  }
  if (degisen.sirket) {
    const liste = (guncel.organizations ?? []).map((x) => ({ ...(x.name ? { name: x.name } : {}), ...(x.title ? { title: x.title } : {}), ...(x.department ? { department: x.department } : {}), ...(x.type ? { type: x.type } : {}) }));
    if (liste.length) liste[0] = { ...liste[0], name: degisen.sirket }; else liste.push({ name: degisen.sirket });
    govde.organizations = liste; maske.push("organizations");
  }
  return { govde, maske };
}