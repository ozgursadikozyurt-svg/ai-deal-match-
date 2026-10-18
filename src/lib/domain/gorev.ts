/**
 * Anahtar CRM v3.32 · 18 Ekim 2026
 * "Bugün" panosu (görevler) ve İlgilenenler — SAF kurallar: arayüz, sunucu ve testler aynı kodu kullanır (ağ, depo, React yok).
 *
 * Fikir: danışman sisteme eşleşme aramak için değil, önündeki sıcak görevleri eritmek için girer. Görevlerin çoğunu sistem üretir:
 *  • OLAY görevleri (saklanır): bir eşleşmenin takip durumu ya da bir ilgilenenin durumu değişince — Gösterim → ertesi gün "izlenimi sor",
 *    2 gün sonra "geri dönüş al"; Bildirildi → 2 gün sonra "yanıt al" …
 *  • SANAL görevler (her açılışta hesaplanır, saklanmaz): talep süresi 7 günden az, portföyde 30 gündür temas yok, yetki belgesi bitiyor,
 *    %90+ yeni eşleşme. Kullanıcı bir sanal göreve dokununca (tamam / ertele / ilgilenmiyor) görevin "izi" saklanır; aynı görev yeniden çıkmaz.
 *  • Liste bitirilebilir kalır: günlük en çok 15 görev görünür; sanal görevler günlük kotayla (en çok 3 temas, 5 sıcak eşleşme) sızar.
 *
 * Günler yerel gün olarak "YYYY-MM-DD" yazılır (Europe/Istanbul'da tarih kayması olmasın diye UTC'ye çevrilmez).
 * Saklama: görevler ve ilgilenenler ofis ayarları arasında ("gorevler", "ilgilenenler" anahtarları) JSON olarak durur — veritabanı göçü gerekmez.
 */
import { z } from "zod";

// ───────── Günler ─────────
const p2 = (n: number) => String(n).padStart(2, "0");
export const gunYaz = (d: Date): string => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
export const gunOku = (s: string): Date => { const [y, m, g] = s.split("-").map(Number); return new Date(y, m - 1, g, 12, 0, 0); };
export const gunEkle = (s: string, n: number): string => { const d = gunOku(s); d.setDate(d.getDate() + n); return gunYaz(d); };
/** a − b (gün) */
export const gunFarki = (a: string, b: string): number => Math.round((gunOku(a).getTime() - gunOku(b).getTime()) / 86_400_000);
export const gunGecerli = (s: unknown): s is string => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(gunOku(s).getTime());

// ───────── Görev ─────────
export const GOREV_TURLERI = ["ARA", "SUNUM", "GOSTER", "BELGE"] as const;
export type GorevTuru = (typeof GOREV_TURLERI)[number];
export const GOREV_TURU_ETIKET: Record<GorevTuru, string> = { ARA: "Ara", SUNUM: "Sunum gönder", GOSTER: "Yer göster", BELGE: "Belge" };

/** Görevi kim ürettiyse onun adı: davranışı (3 düğmenin yan etkisi) ve önceliği belirler */
export const GOREV_KURALLARI = ["YANIT", "IZLENIM", "GERI_DONUS", "TEKLIF", "EVRAK", "SONRAKI", "SICAK", "TALEP_SURE", "TEMAS", "YETKI", "FIYAT", "ELLE"] as const;
export type GorevKurali = (typeof GOREV_KURALLARI)[number];
export const GOREV_DURUMLARI = ["ACIK", "TAMAM", "KAPALI"] as const;
export type GorevDurumu = (typeof GOREV_DURUMLARI)[number];

export const GorevSchema = z.object({
  id: z.string().min(1).max(80),
  kural: z.enum(GOREV_KURALLARI),
  tur: z.enum(GOREV_TURLERI),
  baslik: z.string().min(1).max(240),
  kisiId: z.string().max(64).nullish(),
  kayitId: z.string().max(64).nullish(),
  /** "talepId~portfoyId" */
  eslesme: z.string().max(140).nullish(),
  /** yerel gün: YYYY-MM-DD */
  vade: z.string().refine(gunGecerli, "vade YYYY-MM-DD olmalı"),
  durum: z.enum(GOREV_DURUMLARI),
  /** tamamlanınca: görüşme notu · ilgilenmiyorsa: neden · ertelenince: "Ulaşılamadı" */
  sonuc: z.string().max(1000).nullish(),
  /** kuralın tekrar üretmemesi için anahtar: "es:<talep>~<portföy>:GOSTERILDI:IZLENIM:2026-10-11" ya da sanal görevlerde "v:…" */
  otoAnahtar: z.string().max(220).nullish(),
  olusturma: z.string().max(40),
  kapanis: z.string().max(40).nullish(),
  /** "Ulaşılamadı" sayısı */
  deneme: z.number().int().min(0).max(99).optional(),
});
export type Gorev = z.output<typeof GorevSchema>;
export const GOREV_SINIRI = 3000;
/** Bozuk ya da eski biçimli satırlar sessizce atılır (ayar JSON'u elle değişmiş olabilir) */
export const gorevlerNormalize = (x: unknown): Gorev[] => {
  if (!Array.isArray(x)) return [];
  const r: Gorev[] = [];
  for (const g of x) { const p = GorevSchema.safeParse(g); if (p.success) r.push(p.data); if (r.length >= GOREV_SINIRI) break; }
  return r;
};

const rastgele = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
export const yeniGorevId = () => "g" + rastgele();
export const yeniIlgilenenId = () => "i" + rastgele();

export interface GorevGirdisi { kural: GorevKurali; tur: GorevTuru; baslik: string; vade: string; kisiId?: string | null; kayitId?: string | null; eslesme?: string | null; otoAnahtar?: string | null; id?: string }
export function gorevUret(g: GorevGirdisi, simdi: Date): Gorev {
  return { id: g.id ?? yeniGorevId(), kural: g.kural, tur: g.tur, baslik: g.baslik, kisiId: g.kisiId ?? null, kayitId: g.kayitId ?? null, eslesme: g.eslesme ?? null, vade: g.vade, durum: "ACIK", otoAnahtar: g.otoAnahtar ?? null, olusturma: simdi.toISOString() };
}

/** Küçük sayı = önce. Aynı gündeki görevlerde sıra: müşteriyle süren takipler → sıcak eşleşme / belge → süre → temas */
const ONCELIK: Record<GorevKurali, number> = { TEKLIF: 0, GERI_DONUS: 1, IZLENIM: 1, YANIT: 1, SONRAKI: 1, FIYAT: 1, ELLE: 1, EVRAK: 1, SICAK: 2, YETKI: 2, TALEP_SURE: 3, TEMAS: 4 };
export const gorevSirala = (a: Gorev, b: Gorev) => a.vade.localeCompare(b.vade) || ONCELIK[a.kural] - ONCELIK[b.kural] || a.olusturma.localeCompare(b.olusturma) || a.id.localeCompare(b.id);

/** Satırın yanındaki kısa vade yazısı: "2 gün gecikti" · "Bugün" · "Yarın" · "5 gün sonra" */
export function vadeYazisi(vade: string, simdi: Date): string {
  const f = gunFarki(vade, gunYaz(simdi));
  return f < -1 ? `${-f} gün gecikti` : f === -1 ? "Dün" : f === 0 ? "Bugün" : f === 1 ? "Yarın" : `${f} gün sonra`;
}

// ───────── Aşama (takip durumu ↔ ilgilenen durumu) ─────────
export const IL_DURUMLARI = ["ILGILENDI", "SUNULDU", "GOSTERILDI", "TEKLIF", "ANLASTI", "VAZGECTI"] as const;
export type IlgiDurumu = (typeof IL_DURUMLARI)[number];
export const IL_ETIKET: Record<IlgiDurumu, string> = { ILGILENDI: "İlgilendi", SUNULDU: "Sunuldu", GOSTERILDI: "Gösterildi", TEKLIF: "Teklif verdi", ANLASTI: "Anlaştı", VAZGECTI: "Vazgeçti" };
/** Eşleşme "Takip" düğmeleri (Yeni · Bildirildi · Görüşüldü · Gösterim · Pazarlık · Kapandı · Koparıldı) → ilgilenen durumu. Yeni → yok. */
export const pipelineAsama = (p?: string | null): IlgiDurumu | null =>
  ({ BILDIRILDI: "SUNULDU", GORUSULDU: "ILGILENDI", GOSTERIM: "GOSTERILDI", PAZARLIK: "TEKLIF", KAPANDI: "ANLASTI", REDDEDILDI: "VAZGECTI" } as Record<string, IlgiDurumu>)[p ?? ""] ?? null;

interface AsamaKurali { gun: number; kural: GorevKurali; tur: GorevTuru; baslik: string }
/** "Gösterim yapıldı → ertesi gün izlenimi sor, 2 gün sonra geri dönüş al" gibi kurallar — tek tablo */
export const ASAMA_GOREVLERI: Record<IlgiDurumu, AsamaKurali[]> = {
  ILGILENDI: [],
  SUNULDU: [{ gun: 2, kural: "YANIT", tur: "ARA", baslik: "Sunuma yanıt al" }],
  GOSTERILDI: [{ gun: 1, kural: "IZLENIM", tur: "ARA", baslik: "Gösterim izlenimini sor" }, { gun: 2, kural: "GERI_DONUS", tur: "ARA", baslik: "Geri dönüş al" }],
  TEKLIF: [{ gun: 1, kural: "TEKLIF", tur: "ARA", baslik: "Pazarlığın son durumunu sor" }],
  ANLASTI: [{ gun: 2, kural: "EVRAK", tur: "BELGE", baslik: "Kapora ve evrakları tamamla" }],
  VAZGECTI: [],
};

export interface AsamaGirdisi {
  /** "es:<talep>~<portföy>" (takip düğmesi) ya da "il:<ilgilenenId>" (ilgilenen satırı): bu önekle başlayan açık görevler aşama değişince kapanır */
  onek: string;
  yeni: IlgiDurumu | null;
  kisiId?: string | null; kayitId?: string | null; eslesme?: string | null;
  simdi: Date; gorevler: Gorev[]; yeniId?: () => string;
}
/**
 * Bir aşama değişti: o öneke ait ESKİ aşamanın açık görevleri kapanır ("Aşama ilerledi"), yeni aşamanın görevleri eklenir.
 * Yeni aşamanın aynı günkü görevi zaten açıksa ikinci kez eklenmez.
 */
export function asamaDegisti(g: AsamaGirdisi): Gorev[] {
  const bugun = gunYaz(g.simdi), iso = g.simdi.toISOString(), id = g.yeniId ?? yeniGorevId;
  const yeniAnahtar = (k: AsamaKurali) => `${g.onek}:${g.yeni}:${k.kural}:${bugun}`;
  const kurallar = g.yeni ? ASAMA_GOREVLERI[g.yeni] : [];
  const korunacak = new Set(kurallar.map(yeniAnahtar));
  let liste = g.gorevler.map((x) => x.durum === "ACIK" && x.otoAnahtar?.startsWith(g.onek + ":") && !korunacak.has(x.otoAnahtar) ? { ...x, durum: "KAPALI" as const, sonuc: "Aşama değişti", kapanis: iso } : x);
  for (const k of kurallar) {
    const anahtar = yeniAnahtar(k);
    if (liste.some((x) => x.otoAnahtar === anahtar && x.durum === "ACIK")) continue;
    liste = [...liste, gorevUret({ id: id(), kural: k.kural, tur: k.tur, baslik: k.baslik, vade: gunEkle(bugun, k.gun), kisiId: g.kisiId, kayitId: g.kayitId, eslesme: g.eslesme, otoAnahtar: anahtar }, g.simdi)];
  }
  return gorevleriTemizle(liste, g.simdi);
}

// ───────── İlgilenenler ─────────
export const IlgilenenSchema = z.object({
  id: z.string().min(1).max(80),
  /** ilgilenilen / gösterilen talep ya da portföy */
  kayitId: z.string().min(1).max(64),
  /** rehberden kişi */
  kisiId: z.string().min(1).max(64),
  durum: z.enum(IL_DURUMLARI),
  /** son durum değişikliği (ISO) */
  tarih: z.string().max(40),
  not: z.string().max(1000).nullish(),
  /** takip düğmesinden doğduysa "talep~portföy" */
  eslesme: z.string().max(140).nullish(),
  olusturma: z.string().max(40),
});
export type Ilgilenen = z.output<typeof IlgilenenSchema>;
export const ILGILENEN_SINIRI = 10000;
export const ilgilenenlerNormalize = (x: unknown): Ilgilenen[] => {
  if (!Array.isArray(x)) return [];
  const r: Ilgilenen[] = [];
  for (const g of x) { const p = IlgilenenSchema.safeParse(g); if (p.success) r.push(p.data); if (r.length >= ILGILENEN_SINIRI) break; }
  return r;
};
export const ilgilenenleriOf = (l: Ilgilenen[] | undefined, kayitId: string) => (l ?? []).filter((x) => x.kayitId === kayitId).sort((a, b) => b.tarih.localeCompare(a.tarih));
export const kisininIlgileri = (l: Ilgilenen[] | undefined, kisiId: string) => (l ?? []).filter((x) => x.kisiId === kisiId).sort((a, b) => b.tarih.localeCompare(a.tarih));
/** "2 gösterildi · 1 ilgilendi" (kapalı bölüm başlığında) */
export function ilgilenenOzet(l: Ilgilenen[]): string {
  const sayi = new Map<IlgiDurumu, number>();
  for (const x of l) sayi.set(x.durum, (sayi.get(x.durum) ?? 0) + 1);
  return IL_DURUMLARI.filter((d) => sayi.has(d)).map((d) => `${sayi.get(d)} ${IL_ETIKET[d].toLocaleLowerCase("tr")}`).join(" · ");
}
export interface IlgilenenGirdisi { kayitId: string; kisiId: string; durum: IlgiDurumu; not?: string | null; eslesme?: string | null }
/** (kayıt, kişi) çifti için ekler ya da günceller. Durum değişmediyse tarih de değişmez. */
export function ilgilenenUygula(l: Ilgilenen[], g: IlgilenenGirdisi, simdi: Date, yeniId: () => string = yeniIlgilenenId): Ilgilenen[] {
  const iso = simdi.toISOString();
  const var_ = l.find((x) => x.kayitId === g.kayitId && x.kisiId === g.kisiId);
  if (!var_) return [{ id: yeniId(), kayitId: g.kayitId, kisiId: g.kisiId, durum: g.durum, tarih: iso, not: g.not ?? null, eslesme: g.eslesme ?? null, olusturma: iso }, ...l];
  if (var_.durum === g.durum && (g.not == null || g.not === var_.not)) return l;
  return l.map((x) => (x === var_ ? { ...x, durum: g.durum, tarih: var_.durum === g.durum ? x.tarih : iso, ...(g.not != null ? { not: g.not } : {}), ...(g.eslesme ? { eslesme: g.eslesme } : {}) } : x));
}

// ───────── Eşleşme takip durumu değişince ─────────
export interface EslesmeDurumGirdisi {
  tid: string; pid: string; yeni: string;
  /** müşteri tarafı: talebin birincil kişisi (rehberde yoksa null: görev yine üretilir, ilgilenen satırı üretilmez) */
  talepKisiId?: string | null;
  simdi: Date; gorevler: Gorev[]; ilgilenenler: Ilgilenen[]; yeniId?: () => string;
}
/** Takip düğmesine (Bildirildi, Gösterim, Pazarlık…) basılınca: eski aşamanın görevleri kapanır, yenisinin görevleri açılır, ilgilenen satırı güncellenir. */
export function eslesmeDurumuDegisti(g: EslesmeDurumGirdisi): { gorevler: Gorev[]; ilgilenenler: Ilgilenen[] } {
  const anahtar = `${g.tid}~${g.pid}`, asama = pipelineAsama(g.yeni);
  const gorevler = asamaDegisti({ onek: "es:" + anahtar, yeni: asama, kisiId: g.talepKisiId, kayitId: g.pid, eslesme: anahtar, simdi: g.simdi, gorevler: g.gorevler, yeniId: g.yeniId });
  const ilgilenenler = asama && g.talepKisiId ? ilgilenenUygula(g.ilgilenenler, { kayitId: g.pid, kisiId: g.talepKisiId, durum: asama, eslesme: anahtar }, g.simdi) : g.ilgilenenler;
  return { gorevler, ilgilenenler };
}

// ───────── Üç düğme ve diğer değişiklikler (saf indirgeyiciler) ─────────
/** Sanal görev ("v-…") ilk dokunuşta kalıcı kayda dönüşür; saklı görev yerinde güncellenir */
function yerineKoy(l: Gorev[], g: Gorev, yeni: Partial<Gorev>, simdi: Date, yeniId: () => string): Gorev[] {
  const var_ = l.some((x) => x.id === g.id);
  if (var_) return l.map((x) => (x.id === g.id ? { ...x, ...yeni } : x));
  return [...l, { ...g, id: g.id.startsWith("v-") ? yeniId() : g.id, olusturma: simdi.toISOString(), ...yeni }];
}
/** Tamam (görüşüldü) ya da kapalı (ilgilenmiyor) */
export function gorevKapat(l: Gorev[], g: Gorev, durum: "TAMAM" | "KAPALI", sonuc: string | null, simdi: Date, yeniId: () => string = yeniGorevId): Gorev[] {
  return gorevleriTemizle(yerineKoy(l, g, { durum, sonuc: sonuc?.trim() || null, kapanis: simdi.toISOString() }, simdi, yeniId), simdi);
}
/** "Ulaşılamadı" → yarına; ya da seçilen güne ertele */
export function gorevErtele(l: Gorev[], g: Gorev, vade: string, simdi: Date, opt: { ulasilamadi?: boolean } = {}, yeniId: () => string = yeniGorevId): Gorev[] {
  return yerineKoy(l, g, { vade, durum: "ACIK", sonuc: opt.ulasilamadi ? "Ulaşılamadı" : g.sonuc ?? null, deneme: (g.deneme ?? 0) + (opt.ulasilamadi ? 1 : 0), kapanis: null }, simdi, yeniId);
}
/** Elle ya da "Sonraki iletişim" ile görev ekle */
export function gorevEkle(l: Gorev[], g: GorevGirdisi, simdi: Date): Gorev[] {
  return gorevleriTemizle([...l, gorevUret(g, simdi)], simdi);
}
/** Kapanalı N günden fazla olan satırlar atılır (liste şişmesin). Açık görevler asla atılmaz. */
export function gorevleriTemizle(l: Gorev[], simdi: Date, gun = 60): Gorev[] {
  const esik = simdi.getTime() - gun * 86_400_000;
  const temiz = l.filter((x) => x.durum === "ACIK" || !x.kapanis || new Date(x.kapanis).getTime() >= esik);
  return temiz.length === l.length ? l : temiz;
}
/** Hızlı vade seçenekleri: Yarın · 3 gün · 1 hafta · 1 ay */
export const SONRAKI_SECENEKLER: readonly { gun: number; etiket: string }[] = [{ gun: 1, etiket: "Yarın" }, { gun: 3, etiket: "3 gün" }, { gun: 7, etiket: "1 hafta" }, { gun: 30, etiket: "1 ay" }];

// ───────── Sanal görevler ─────────
export interface SanalKayit {
  id: string; tip: "TALEP" | "PORTFOY"; olusturma: string; baslik: string;
  validUntil?: string | null; yetkili?: boolean; yetkiBitis?: string | null;
  /** kayıttaki son görüşme / not (ISO) */
  sonNot?: string | null;
  /** aranacak kişi: talepte müşteri, portföyde mülk sahibi */
  kisiId?: string | null;
}
export interface SanalEslesme { tid: string; pid: string; skor: number; baslik: string; talepKisiId?: string | null }
export interface SanalGirdi { simdi: Date; kayitlar: SanalKayit[]; eslesmeler: SanalEslesme[]; gorevler: Gorev[]; ilgilenenler: Ilgilenen[] }
export const SANAL_ESIKLER = { talepSureGun: 7, temasGun: 30, yetkiGun: 10, sicakSkor: 90, kotaTemas: 3, kotaSicak: 5 } as const;

const gunDen = (iso?: string | null) => (iso ? gunYaz(new Date(iso)) : null);
/** Kayıtla son temas: oluşturma · son not · tamamlanan görev · ilgilenen güncellemesi */
export function sonTemasGunu(k: SanalKayit, gorevler: Gorev[], ilgilenenler: Ilgilenen[]): string {
  const adaylar = [gunDen(k.olusturma), gunDen(k.sonNot), ...gorevler.filter((g) => g.kayitId === k.id && g.durum === "TAMAM").map((g) => gunDen(g.kapanis)), ...ilgilenenler.filter((i) => i.kayitId === k.id).map((i) => gunDen(i.tarih))].filter((x): x is string => !!x);
  return adaylar.sort().at(-1) ?? gunYaz(new Date(k.olusturma));
}
/** Sanal görevler: deterministik kimlik "v-<otoAnahtar>". Saklı görev aynı otoAnahtarla varsa (yapılmış, ertelenmiş, kapatılmış) sanalı gizler. */
export function sanalGorevler(g: SanalGirdi): Gorev[] {
  const bugun = gunYaz(g.simdi), iso = g.simdi.toISOString();
  const varOlan = new Set(g.gorevler.map((x) => x.otoAnahtar).filter(Boolean) as string[]);
  const bugunDokunulan = (kural: GorevKurali) => g.gorevler.filter((x) => x.kural === kural && x.otoAnahtar?.startsWith("v:") && gunDen(x.olusturma) === bugun).length;
  const cikti: Gorev[] = [];
  const ekle = (otoAnahtar: string, x: Omit<GorevGirdisi, "otoAnahtar" | "id" | "vade">) => { if (!varOlan.has(otoAnahtar)) cikti.push({ ...gorevUret({ ...x, otoAnahtar, id: "v-" + otoAnahtar, vade: bugun }, g.simdi), olusturma: iso }); };

  const temas: { k: SanalKayit; son: string }[] = [];
  for (const k of g.kayitlar) {
    if (k.tip === "TALEP" && k.validUntil) {
      const kalan = Math.ceil((new Date(k.validUntil).getTime() - g.simdi.getTime()) / 86_400_000);
      if (kalan <= SANAL_ESIKLER.talepSureGun) ekle(`v:TALEP_SURE:${k.id}:${gunDen(k.validUntil)}`, { kural: "TALEP_SURE", tur: "ARA", baslik: kalan <= 0 ? "Talebin süresi bugün doluyor — hâlâ arıyor mu?" : `Talebin süresi ${kalan} gün içinde doluyor — hâlâ arıyor mu?`, kisiId: k.kisiId, kayitId: k.id });
    }
    if (k.tip === "PORTFOY") {
      if (k.yetkili && k.yetkiBitis) {
        const kalan = gunFarki(gunDen(k.yetkiBitis)!, bugun);
        if (kalan <= SANAL_ESIKLER.yetkiGun && kalan >= -7) ekle(`v:YETKI:${k.id}:${gunDen(k.yetkiBitis)}`, { kural: "YETKI", tur: "BELGE", baslik: kalan < 0 ? `Yetki belgesinin süresi ${-kalan} gün önce bitti — yenile` : kalan === 0 ? "Yetki belgesi bugün bitiyor — yenile" : `Yetki belgesi ${kalan} gün içinde bitiyor — yenile`, kisiId: k.kisiId, kayitId: k.id });
      }
      const son = sonTemasGunu(k, g.gorevler, g.ilgilenenler);
      if (gunFarki(bugun, son) >= SANAL_ESIKLER.temasGun) temas.push({ k, son });
    }
  }
  // Temas: en uzun süredir aranmayan önce; günlük kota dolunca durur ("bugünü sıfırladım" hissi — liste bitmeyen bir yığın olmasın)
  temas.sort((a, b) => a.son.localeCompare(b.son));
  const temasHak = Math.max(0, SANAL_ESIKLER.kotaTemas - bugunDokunulan("TEMAS") - cikti.filter((x) => x.kural === "TEMAS").length);
  for (const { k, son } of temas.slice(0, temasHak)) ekle(`v:TEMAS:${k.id}:${son}`, { kural: "TEMAS", tur: "ARA", baslik: `${gunFarki(bugun, son)} gündür temas yok — mal sahibini ara, fiyatı teyit et`, kisiId: k.kisiId, kayitId: k.id });

  const sicakHak = Math.max(0, SANAL_ESIKLER.kotaSicak - bugunDokunulan("SICAK"));
  for (const e of [...g.eslesmeler].filter((x) => x.skor >= SANAL_ESIKLER.sicakSkor).sort((a, b) => b.skor - a.skor).slice(0, sicakHak))
    ekle(`v:SICAK:${e.tid}~${e.pid}`, { kural: "SICAK", tur: "SUNUM", baslik: `Sıcak eşleşme (%${Math.round(e.skor)}) — sunumu gönder`, kisiId: e.talepKisiId, kayitId: e.pid, eslesme: `${e.tid}~${e.pid}` });
  return cikti;
}
/** Kayıtlı + sanal görevler (sanalı, saklı izi olanlar elenmiş) */
export const gorevleriBirlestir = (saklanan: Gorev[], sanal: Gorev[]): Gorev[] => [...saklanan, ...sanal];

// ───────── Fiyat düştü ─────────
/** Portföyün fiyatı düştü: önceden ilgilenen herkes (anlaşanlar hariç) için "tekrar ara" görevi. Fiyat başına bir kez. */
export function fiyatDustu(g: { kayitId: string; baslik: string; eski: number; yeni: number; ilgilenenler: Ilgilenen[]; gorevler: Gorev[]; simdi: Date; yeniId?: () => string }): Gorev[] {
  if (!(g.yeni < g.eski)) return g.gorevler;
  const bugun = gunYaz(g.simdi), id = g.yeniId ?? yeniGorevId;
  let liste = g.gorevler;
  const tl = (n: number) => n.toLocaleString("tr-TR");
  for (const i of ilgilenenleriOf(g.ilgilenenler, g.kayitId)) {
    if (i.durum === "ANLASTI") continue;
    const anahtar = `fiyat:${g.kayitId}:${i.kisiId}:${g.yeni}`;
    if (liste.some((x) => x.otoAnahtar === anahtar)) continue;
    liste = [...liste, gorevUret({ id: id(), kural: "FIYAT", tur: "ARA", baslik: `Fiyat düştü (${tl(g.eski)} → ${tl(g.yeni)}) — tekrar ara`, kisiId: i.kisiId, kayitId: g.kayitId, otoAnahtar: anahtar, vade: bugun }, g.simdi)];
  }
  return liste;
}

// ───────── Bugün görünümü ─────────
export interface BugunGorunumu {
  geciken: Gorev[]; bugun: Gorev[]; buHafta: Gorev[]; sonra: number;
  /** bugün kapanan görev sayısı (ilerleme çubuğu) */
  tamamBugun: number;
  /** ekranda görünen: geciken + bugün, en çok `limit` */
  gorunen: Gorev[]; gizlenen: number;
}
export function bugunGorunumu(liste: Gorev[], simdi: Date, limit = 15): BugunGorunumu {
  const bugun = gunYaz(simdi), hafta = gunEkle(bugun, 7);
  const acik = liste.filter((g) => g.durum === "ACIK").sort(gorevSirala);
  const geciken = acik.filter((g) => g.vade < bugun), buGun = acik.filter((g) => g.vade === bugun), buHafta = acik.filter((g) => g.vade > bugun && g.vade <= hafta);
  const sonra = acik.filter((g) => g.vade > hafta).length;
  const tamamBugun = liste.filter((g) => g.durum !== "ACIK" && gunDen(g.kapanis) === bugun).length;
  const hepsi = [...geciken, ...buGun];
  return { geciken, bugun: buGun, buHafta, sonra, tamamBugun, gorunen: hepsi.slice(0, limit), gizlenen: Math.max(0, hepsi.length - limit) };
}

// ───────── Takvim ─────────
/** Google Takvim'de hazır dolu "tüm gün" etkinlik (OAuth gerekmez; telefonda Takvim uygulaması açılır) */
export function takvimBaglantisi(g: { baslik: string; vade: string; aciklama?: string }): string {
  const t = (s: string) => s.replace(/-/g, "");
  const q = new URLSearchParams({ action: "TEMPLATE", text: g.baslik, dates: `${t(g.vade)}/${t(gunEkle(g.vade, 1))}`, ...(g.aciklama ? { details: g.aciklama } : {}) });
  return `https://calendar.google.com/calendar/render?${q.toString()}`;
}
