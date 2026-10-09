/**
 * Anahtar CRM v3.22.1 · 9 Ekim 2026 (v3.13'ten)
 * Demo veri deposu: örnek veriyi gerçek doğrulama + konum çözücüden geçirerek yükler,
 * kullanıcının değişikliklerini tarayıcıda (localStorage) saklar.
 */
import type { FotoMeta } from "../src/lib/domain/foto";
import { aiAyarNormalize, paylasimNormalize, calismaIliNormalize, type AiAyar, type PaylasimAyar } from "../src/lib/domain/ayarlar";
import { sahiplikNormalize, type SahiplikAyar } from "../src/lib/domain/sahiplik";
import { haricBirlestir } from "../src/lib/lokasyon/haric";
import { kayitlariOnar } from "./onarim";
import { KayitCreateSchema, type KayitCreateData } from "../src/lib/validation/kayit";
import { adaylariGuncelle, type KonumAdayi } from "../src/lib/lokasyon/ogrenme";
import type { WaMesaj, GrupOzeti } from "../src/lib/ingest/whatsapp";
import { ORNEK_PORTFOYLER, ORNEK_TALEPLER, ORNEK_VERI_SURUMU } from "./ornek-veri";
import { coz, cozulenToKayitLok, belirsizKonumOnar, type Alias } from "./lokasyon";
import { TTL_VARSAYILAN as TTLV, ttlNormalize, varsayilanValidUntil as vuDomain, type TtlAyar as TA } from "../src/lib/domain/gecerlilik";
import { metinParmakIzi } from "../src/lib/ingest/whatsapp";

export type Veri = KayitCreateData;
export interface Kayit { id: string; olusturma: string; veri: Veri; notionId?: string | null; notionSnapshot?: Record<string, unknown> | null; notionGeriYazim?: Record<string, unknown> | null; notlar?: KayitNotu[]; /** v3.10 — portföy fotoğraflarının künyesi (ilk = kapak); görüntüler demo/foto.ts deposunda */ fotolar?: FotoMeta[] }
/** v3.7 — talep / portföy görüşme ve not akışı */
export type NotTuru = "GORUSME" | "ARAMA" | "WHATSAPP" | "GOSTERIM" | "NOT";
export interface KayitNotu { id: string; tarih: string; tur: NotTuru; metin: string; kisiId?: string | null }
export const NOT_TURU: Record<NotTuru, string> = { GORUSME: "Görüşme", ARAMA: "Arama", WHATSAPP: "WhatsApp", GOSTERIM: "Gösterim", NOT: "Not" };
export type PipelineDurum = "YENI" | "BILDIRILDI" | "GORUSULDU" | "GOSTERIM" | "PAZARLIK" | "KAPANDI" | "REDDEDILDI";
export interface EslesmeNotu { durum: PipelineDurum; not: string; /** v3.8 — koparma nedeni ve tarihi (durum REDDEDILDI) */ neden?: string; tarih?: string }
export type TtlAyar = TA;
/** v3.4 — Kişiler (Notion "Müşteri-Yatırımcılar-Kişiler" tablosuna göre) */
export interface Kisi {
  id: string; adSoyad: string; telefon: string | null; sirket: string | null; email?: string | null;
  roller: string[]; uzmanlikAileleri: string[]; referans: string | null; notlar: string | null;
  whatsappGruplari: string[]; olusturma: string; sonIletisim: string | null;
  // v3.6 — kaynak ve senkron bağları
  kaynak?: "MANUEL" | "WHATSAPP" | "GOOGLE" | "NOTION"; ikincilTelefon?: string | null; ilanSahibiTipi?: string;
  googleResourceName?: string | null; googleSnapshot?: Record<string, unknown> | null; kaynaktaSilindi?: string | null;
  notionId?: string | null; notionSnapshot?: Record<string, unknown> | null;
  /** v3.21 — çift yönlü Google: sunucudan gelen "Google'a gönderilecek" işareti (rozet) */
  googleBekliyor?: string | null;
  /** v3.21 — arayüzün koyduğu istek: kişi elle eklendi / "Google'a gönder" dendi. Sunucu, Google bağlı ve çift yönlü açıksa işarete çevirir. */
  googleaGonder?: boolean;
}

/** İçe aktarma işinden çıkan tek kayıt adayı */
export type AdayDurum = "HAZIR" | "KONTROL" | "HATALI" | "EKLENDI" | "ATLANDI";
export interface IceAktarmaAdayi {
  id: string;
  mesajId: string;
  durum: AdayDurum;
  nedenler: string[];
  taslak: Partial<Veri> & { tip: "PORTFOY" | "TALEP" };
  cozulemeyen: string[];
  hatalar: string[];
  benzerKayitId?: string;
  /** v3.12 — okuma güveni 0–100 ve puan kaybettiren eksikler; kaynak: kurallar mı yapay zekâ mı okudu */
  guven?: number;
  eksikler?: string[];
  kaynak?: "KURAL" | "AI";
}
export interface IceAktarma {
  id: string;
  baslangic: string;
  dosyalar: string[];
  gruplar: GrupOzeti[];
  mesajlar: WaMesaj[];
  adaylar: IceAktarmaAdayi[];
  asama: "ONFILTRE" | "AYRISTIRILIYOR" | "INCELEME" | "BITTI";
  islenenPaket: number;
  toplamPaket: number;
}
export interface IceAktarmaOzeti { id: string; tarih: string; dosyalar: string[]; mesaj: number; aday: number; eklenen: number; kontrol: number }

export interface DepoDurumu {
  veriSurumu: string;
  kayitlar: Kayit[];
  eslesmeNotlari: Record<string, EslesmeNotu>;
  testler: Record<string, boolean>;
  geriBildirim: string;
  /** v3.10: ai (sağlayıcı, eşik…), paylasim (föy imzası), calismaIli — eski kayıtlarda yoksa varsayılan okunur (ayarOf) */
  ayarlar: { ttl: TtlAyar; ai?: AiAyar; paylasim?: PaylasimAyar; calismaIli?: number; /** v3.22 — Benim ve ofisim */ sahiplik?: SahiplikAyar };
  ogrenilen: Alias[];
  adaylar: KonumAdayi[];
  aktifIceAktarma: IceAktarma | null;
  iceAktarmaGecmisi: IceAktarmaOzeti[];
  kisiler: Kisi[];
  /** v3.4 — yapay zekâya gönderilmiş mesajların parmak izleri (tekrar gönderilmez) */
  islenmisMesajlar: string[];
  /** v3.4 — yüklenmiş dosyaların parmak izi → ad, tarih */
  dosyaIzleri: Record<string, { ad: string; tarih: string }>;
  /** v3.6 — Google Kişiler + Notion bağlantıları (demo: örnek dış veriyle) */
  baglantilar: { google: DemoBaglanti; notion: DemoBaglanti };
  senkronGecmisi: DemoCalisma[];
  cakismalar: DemoCakisma[];
  /** v3.7 demo — telefonda Google'a kaydedilmiş, sonraki çekimde gelecek kişiler */
  googleBekleyen?: import("../src/lib/google/kisiler").GooglePerson[];
  /** v3.15 — Ayarlar › Kişi rolleri: özel roller + sistem rollerinin yeniden adlandırılmış etiketleri (canlıda Ayar tablosu, demoda tarayıcı) */
  roller?: import("../src/lib/domain/roller").RolTanim[];
  /** v3.19 — anahtar (favori) işaretleri: "t:<talepId>", "p:<portföyId>", "e:<talepId>~<portföyId>" */
  favoriler?: string[];
  /** v3.21 demo — Anahtar'dan silindiği için Google'dan geri gelmeyecek kişiler (canlıda senkron_haric tablosu). Kişi Google'da DURUR. */
  googleHaric?: { kimlik: string | null; tel: string | null; ad: string; tarih: string }[];
  /** v3.21 demo — Anahtar'dan Google'a yazılanların günlüğü (canlıda Google rehberinin kendisi) */
  googleGiden?: { ad: string; telefon: string | null; islem: "EKLENDI" | "GUNCELLENDI"; alanlar?: string[]; tarih: string }[];
  /** v3.21 canlı — sunucudan okunan Google bağlantı özeti (arayüz durumunda saklanmaz) */
  googleCanli?: GoogleCanliDurum | null;
}
/** v3.21 — GET /api/entegrasyon yanıtındaki Google satırı */
export interface GoogleCanliDurum {
  hazir: boolean; yetkili: boolean; durum: "BAGLI_DEGIL" | "BAGLI" | "HATA" | "YENIDEN_YETKI"; hesap: string | null; sonSenkron: string | null; sonHata: string | null;
  bagliKisi: number; bekleyen: number; haric: number; devamEdiyor: boolean; acikCakisma: number;
  ayarlar: { otomatik: boolean; aralikDk: number; googleYaz: boolean; sadeceEtiketler: string[]; yazmaIzni?: boolean };
}
export interface DemoBaglanti { durum: "BAGLI_DEGIL" | "BAGLI"; hesap: string | null; tur: number; sonSenkron: string | null; ayar: { otomatik: boolean; aralikDk: number; geriYaz: boolean; googleYaz: boolean; sadeceEtiketler: string[] } }
export interface DemoCalisma { id: string; saglayici: "GOOGLE_KISILER" | "NOTION"; tarih: string; tetik: string; ozet: Record<string, number>; kontrol: { id: string | null; baslik: string; nedenler: string[] }[]; yeniEslesme: number; geriYazim: { id: string; baslik: string; deger: Record<string, unknown> }[]; atlanan: { ad: string; neden: string }[] }
export interface DemoCakisma { id: string; saglayici: "GOOGLE_KISILER" | "NOTION"; hedefTip: "KISI" | "KAYIT"; hedefId: string; baslik: string; alan: string; onceki: unknown; yerel: unknown; uzak: unknown }
export const bosBaglanti = (): DemoBaglanti => ({ durum: "BAGLI_DEGIL", hesap: null, tur: 0, sonSenkron: null, ayar: { otomatik: true, aralikDk: 15, geriYaz: true, googleYaz: false, sadeceEtiketler: [] } });
/** v3.21: Google varsayılanı çift yönlü (googleYaz açık) */
export const bosGoogleBaglanti = (): DemoBaglanti => { const b = bosBaglanti(); b.ayar.aralikDk = 5; b.ayar.googleYaz = true; return b; };

/**
 * v3.14 — Canlı ortam: sayfa `<div id="kok" data-canli="1">` ile açılır (dist/canli/index.html). Canlıda durum sunucudan gelir,
 * değişiklikler sunucuya yazılır (demo/canli*.ts); demoda localStorage kullanılır.
 */
export const CANLI_ORTAM = typeof document !== "undefined" && !!document.getElementById("kok")?.dataset.canli;
/** v3.20 — /api/oturum yanıtı: kim, hangi ofis, hangi rol, hangi plan ve yetkiler */
export interface OturumBilgi {
  kullanici: { id: string; eposta: string; rol: string; rolEtiketi: string };
  ofis: { id: string; ad: string; durum: string } | null;
  plan: { kod: string; denemeBitis: string | null; denemeAktif: boolean };
  sinirlar: { etiket: string; fotoBasinaKayit: number; kullanici: number; gunlukAi: number; entegrasyon: boolean; paylasimFoyu: boolean };
  yetkiler: string[];
}
export const CANLI: {
  acik: boolean; yuklu: DepoDurumu | null; kaydet: ((d: DepoDurumu) => void) | null; hemen: (() => Promise<void>) | null;
  sample: { json: (istem: string, secenek?: Record<string, unknown>) => Promise<unknown> } | null;
  api: ((yol: string, init?: { method?: string; json?: unknown; form?: FormData }) => Promise<Response>) | null;
  oturum: { eposta?: string; cikis: () => void; bilgi?: OturumBilgi } | null;
  /** v3.21 — Google eşitlemesinden sonra sunucudaki kişi listesini arayüz durumuyla birleştirir (kaydedilmemiş yerel değişiklik korunur) */
  kisileriBirlestir: ((d: DepoDurumu, sunucu: Kisi[]) => DepoDurumu) | null;
  /** v3.21 — Google izin ekranından dönüşte adresteki sonuç (?google=ok | iptal | hata | yetki | yenileme-anahtari-yok) */
  googleDonus: string | null;
  /** v3.22.1 — kayıt sunucuya yazıldı mı / son reddedilme nedeni (fotoğraf yükleme hatasını anlaşılır göstermek için) */
  sunucudaMi?: ((id: string) => boolean) | null;
  kayitHatasi?: ((id: string) => string | undefined) | null;
} = { acik: CANLI_ORTAM, yuklu: null, kaydet: null, hemen: null, sample: null, api: null, oturum: null, kisileriBirlestir: null, googleDonus: null };

export const BUGUN = CANLI_ORTAM ? new Date() : new Date(2026, 8, 30, 12, 0, 0); // demo "bugün" sabit (süre hesapları değişmesin); canlıda gerçek tarih
const GUN = 86_400_000;
export const TTL_VARSAYILAN: TtlAyar = TTLV;
/** Satılık / kiralık ayrı (v3.4) — kurallar src/lib/domain/gecerlilik.ts */
export function varsayilanValidUntil(tip: "PORTFOY" | "TALEP", islem: string | undefined, aciliyet: string | undefined, simdi: Date, ttl: TtlAyar = TTL_VARSAYILAN): Date {
  return vuDomain(tip, islem, aciliyet, simdi, ttl);
}
export const kalanGun = (v: Veri) => (v.validUntil ? Math.ceil((new Date(v.validUntil).getTime() - BUGUN.getTime()) / GUN) : null);
/** Süreyi uzat: süresi dolmuşsa bugünden, değilse mevcut bitişten itibaren */
export function sureUzat(v: Veri, gun: number): Veri {
  const taban = Math.max(BUGUN.getTime(), v.validUntil ? new Date(v.validUntil).getTime() : 0);
  return { ...v, validUntil: new Date(taban + gun * GUN), durum: v.durum === "EXPIRED" ? "ACTIVE" : v.durum };
}

export interface OrnekHata { oid: string; hatalar: string[] }

const ROL_ETIKET_SAHIP: Record<string, string> = { MALIK: "SAHIP", EMLAKCI: "EMLAKCI", MUTEAHHIT: "SAHIP", FIRMA: "SAHIP", PARTNER: "ARACI", PORTAL: "DIGER", BILINMIYOR: "SAHIP" };
/** Kaydın gönderen bilgisinden kişi rolleri (kişi kartı) ve kayıttaki rol */
export function kisiRolleriOf(tip: string, ilanSahibi: string, islem: string): { roller: string[]; kayitRol: string } {
  const kira = /KIRALIK/.test(islem);
  if (ilanSahibi === "EMLAKCI") return { roller: ["EMLAKCI"], kayitRol: "EMLAKCI" };
  if (ilanSahibi === "PARTNER") return { roller: ["IS_ORTAGI"], kayitRol: "ARACI" };
  if (ilanSahibi === "MUTEAHHIT") return { roller: ["MUTEAHHIT"], kayitRol: tip === "PORTFOY" ? "SAHIP" : "MUSTERI" };
  if (tip === "PORTFOY") return { roller: [kira ? "KIRAYA_VEREN" : "SATICI", ...(ilanSahibi === "FIRMA" ? ["FIRMA"] : [])], kayitRol: ROL_ETIKET_SAHIP[ilanSahibi] ?? "SAHIP" };
  return { roller: [kira ? "KIRACI" : "ALICI", ...(ilanSahibi === "FIRMA" ? ["FIRMA"] : [])], kayitRol: "MUSTERI" };
}
// v3.21: sayaç eklendi — Google'dan aynı anda gelen kişiler aynı milisaniyede üretildiğinde kimlik çakışabiliyordu (1/90 olasılık; çakışınca biri silinince öbürü de gidiyordu)
let kisiSayaci = 0;
export const yeniKisiId = () => "K" + Date.now().toString(36).slice(-5).toUpperCase() + Math.floor(Math.random() * 90 + 10) + (kisiSayaci++ % 1296).toString(36).toUpperCase().padStart(2, "0");

export function ornekVeriyiKur(): { kayitlar: Kayit[]; hatalar: OrnekHata[]; adaylar: KonumAdayi[]; kisiler: Kisi[] } {
  const kisiler: Kisi[] = [];
  const kayitlar: Kayit[] = [];
  const hatalar: OrnekHata[] = [];
  let adaylar: KonumAdayi[] = [];
  for (const o of [...ORNEK_PORTFOYLER, ...ORNEK_TALEPLER]) {
    const { oid, gunOnce, haricHam, ...girdi } = o;
    const r = coz(girdi.lokasyonHam ?? "");
    const lok0 = cozulenToKayitLok(r.lokasyonlar, girdi.tip === "PORTFOY").map(({ etiket, seviye, ...l }) => l);
    // v3.22 — "Hurma, Sarısu HARİÇ": hariç satırları
    const lok = haricHam ? haricBirlestir(lok0, cozulenToKayitLok(coz(haricHam).lokasyonlar, false).map(({ etiket, seviye, ...l }) => l)) : lok0;
    const olusturma = new Date(BUGUN.getTime() - gunOnce * GUN);
    const whatsapp = girdi.veriKanali === "WHATSAPP" || !!girdi.kayitGrubu;
    // Gönderen → Kişiler (telefonla tekil)
    let bag: { kisiId: string; rol: string }[] = [];
    if (girdi.gondeAdi || girdi.gondeTelefon) {
      const r = kisiRolleriOf(girdi.tip, girdi.ilanSahibiTipi ?? "BILINMIYOR", girdi.islemTipi);
      let k = kisiler.find((x) => x.telefon && x.telefon === girdi.gondeTelefon);
      if (!k) { k = { id: "K" + (kisiler.length + 1), adSoyad: girdi.gondeAdi ?? girdi.gondeTelefon!, telefon: girdi.gondeTelefon ?? null, sirket: girdi.gondeSirket ?? null, roller: [], uzmanlikAileleri: [], referans: null, notlar: null, whatsappGruplari: [], olusturma: olusturma.toISOString(), sonIletisim: olusturma.toISOString() }; kisiler.push(k); }
      k.roller = [...new Set([...k.roller, ...r.roller])];
      if (girdi.kayitGrubu && !k.whatsappGruplari.includes(girdi.kayitGrubu)) k.whatsappGruplari.push(girdi.kayitGrubu);
      bag = [{ kisiId: k.id, rol: r.kayitRol }];
    }
    const p = KayitCreateSchema.safeParse({
      ...girdi, kisiler: bag, lokasyonlar: lok, validUntil: varsayilanValidUntil(girdi.tip, girdi.islemTipi, girdi.aciliyet, olusturma),
      ...(whatsapp ? { veriKanali: "WHATSAPP", mesajTarihi: new Date(olusturma.getTime() - 3 * 3_600_000 + (oid.charCodeAt(1) % 7) * 600_000), kaynakDosya: girdi.kayitGrubu ? `WhatsApp Sohbeti - ${girdi.kayitGrubu}.txt` : undefined } : {}),
    });
    if (!p.success) { hatalar.push({ oid, hatalar: p.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`) }); continue; }
    // Tanınmayan konum ifadeleri konum öğrenme adaylarına düşer (ör. "Yeni Sanayi civarı")
    if (r.cozulemeyen.length) adaylar = adaylariGuncelle(adaylar, r.cozulemeyen, r.lokasyonlar, girdi.hamMetin ?? girdi.lokasyonHam ?? undefined, olusturma);
    kayitlar.push({ id: oid, olusturma: olusturma.toISOString(), veri: p.data });
  }
  return { kayitlar, hatalar, adaylar, kisiler };
}

const ANAHTAR = "anahtar-ai-demo";

/** v3.22 — demoda ofis örneği: "Özyurtlar Gayrimenkul" adıyla gelen kayıtlar "Ofisim" sayılır (canlıda boş başlar) */
export const DEMO_SAHIPLIK = { ofisAdlar: ["Özyurtlar Gayrimenkul"] };
const ayarlariOku = (a: any): DepoDurumu["ayarlar"] => ({ ttl: ttlNormalize(a?.ttl), ai: aiAyarNormalize(a?.ai), paylasim: paylasimNormalize(a?.paylasim), calismaIli: calismaIliNormalize(a?.calismaIli), sahiplik: sahiplikNormalize(a?.sahiplik ?? DEMO_SAHIPLIK) });
/** Ayarları varsayılanlarıyla okur (testlerde ve eski kayıtlarda alanlar eksik olabilir) */
export const aiAyari = (d: DepoDurumu): AiAyar => aiAyarNormalize(d.ayarlar.ai);
export const paylasimAyari = (d: DepoDurumu): PaylasimAyar => paylasimNormalize(d.ayarlar.paylasim);
export const calismaIli = (d: DepoDurumu): number => calismaIliNormalize(d.ayarlar.calismaIli);
export const sahiplikAyari = (d: DepoDurumu): SahiplikAyar => sahiplikNormalize(d.ayarlar.sahiplik);

function bosDurum(): { durum: DepoDurumu; hatalar: OrnekHata[] } {
  const { kayitlar, hatalar, adaylar, kisiler } = ornekVeriyiKur();
  return { durum: { veriSurumu: ORNEK_VERI_SURUMU, kayitlar, eslesmeNotlari: {}, testler: {}, geriBildirim: "", ayarlar: { ttl: TTL_VARSAYILAN, sahiplik: sahiplikNormalize(DEMO_SAHIPLIK) }, ogrenilen: [], adaylar, aktifIceAktarma: null, iceAktarmaGecmisi: [], kisiler, islenmisMesajlar: [], dosyaIzleri: {}, baglantilar: { google: bosGoogleBaglanti(), notion: bosBaglanti() }, senkronGecmisi: [], cakismalar: [], googleHaric: [], googleGiden: [] }, hatalar };
}

export function depoYukle(): { durum: DepoDurumu; hatalar: OrnekHata[]; yenilendi: boolean } {
  if (CANLI.acik && CANLI.yuklu) return { durum: CANLI.yuklu, hatalar: [], yenilendi: false };
  const { durum: bos, hatalar } = bosDurum();
  try {
    const ham = localStorage.getItem(ANAHTAR);
    if (!ham) return { durum: bos, hatalar, yenilendi: false };
    const d = JSON.parse(ham) as Partial<DepoDurumu>;
    // Örnek veri yapısı değiştiyse kayıtları yenile; test notları, ayarlar ve öğrenilen konumlar korunur
    if (d.veriSurumu !== ORNEK_VERI_SURUMU)
      return { durum: { ...bos, testler: d.testler ?? {}, geriBildirim: d.geriBildirim ?? "", ayarlar: ayarlariOku(d.ayarlar), ogrenilen: d.ogrenilen ?? [], roller: d.roller ?? [] }, hatalar, yenilendi: true };
    // v3.11 — v3.10'da yanlış ilçeye yazılmış aynı adlı mahalleleri onar ("Fener, Çağlayan" → Muratpaşa / Çağlayan)
    if (Array.isArray(d.kayitlar)) d.kayitlar = d.kayitlar.map((k) => { const r = belirsizKonumOnar((k.veri?.lokasyonlar ?? []) as any[]); return r.degisti ? { ...k, veri: { ...k.veri, lokasyonlar: r.lokasyonlar } } : k; }) as typeof d.kayitlar;
    // v3.22.1 — satışta yanlış "Aylık" periyot, eski "hariç" talepler, "site içi olmayan" (demo/onarim.ts)
    if (Array.isArray(d.kayitlar)) d.kayitlar = kayitlariOnar(d.kayitlar as Kayit[]).kayitlar;
    return { durum: { ...bos, ...d, ayarlar: ayarlariOku(d.ayarlar) } as DepoDurumu, hatalar, yenilendi: false };
  } catch {
    return { durum: bos, hatalar, yenilendi: false };
  }
}

export function depoKaydet(d: DepoDurumu) {
  if (CANLI.acik) { CANLI.kaydet?.(d); return; }
  try { localStorage.setItem(ANAHTAR, JSON.stringify(d)); } catch { /* gizli pencere / kota — oturum içinde çalışmaya devam */ }
}

export const yeniId = (tip: "PORTFOY" | "TALEP") => (tip === "PORTFOY" ? "P" : "T") + Date.now().toString(36).slice(-5).toUpperCase() + Math.floor(Math.random() * 90 + 10);

/** Havuzdaki kayıtların ham metin parmak izleri (içe aktarmada zaten kayıtlı ilanı yeniden ayrıştırmamak için) */
export const kayitliMetinIzleri = (kayitlar: Kayit[]) => new Set(kayitlar.map((k) => k.veri.hamMetin).filter(Boolean).map((m) => metinParmakIzi(m!)));