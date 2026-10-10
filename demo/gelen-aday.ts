/**
 * Anahtar CRM v3.23 · 10 Ekim 2026
 * Gelen kutusu — dosya parçalarından ADAY çıkarır ve havuzla karşılaştırır (mükerrer denetimi).
 *
 * İki adım bilerek ayrıdır:
 *   1) hamAdaylar(...)  — dosyadan bir kez çıkar (pahalı: tablo satırları / WhatsApp mesajları kurallarla okunur). Havuzdan bağımsızdır.
 *   2) durumla(...)     — her çizimde çalışır (ucuz): atlananlar düşülür, havuzdaki kayıtla aynı olan "zaten var" olur,
 *                         fiyatı değişen ilan ayrılır, kutu içindeki kopyalar (aynı ilan iki portalda / iki dökümde) teke iner.
 * Böylece bir kayıt eklendiği anda — ya da formdan düzenlenip kaydedildiğinde — bekleyenlerden kendiliğinden düşer.
 * Yapay zekâ kullanılmaz; emin olunamayan kayıt "Kontrol gerekli" olur.
 */
import { dosyaSatirlari, dosyaTuruTahmin, satirDonustur, satirHazirla } from "../src/lib/ingest/tablo";
import { tekrarAnahtarlari, tekrarNedeni } from "../src/lib/ingest/tekrar";
import { sohbetiAyristir, onFiltre, metinParmakIzi, type WaMesaj } from "../src/lib/ingest/whatsapp";
import { ilanAnahtari, metinAnahtari, type GelenDosyaKunye } from "../src/lib/ingest/gelen";
import { KayitCreateSchema } from "../src/lib/validation/kayit";
import { MULK_TIPI_META } from "../src/lib/domain/kategori";
/** Portal adı — "Sahibinden" tek başına "mülk sahibinden" ile karışıyordu */
const PORTAL_ETIKET: Record<string, string> = { SAHIBINDEN: "sahibinden.com", HEPSIEMLAK: "Hepsiemlak", EMLAKJET: "Emlakjet" };
import { INDEKS } from "./lokasyon";
import { BUGUN, varsayilanValidUntil, kayitliMetinIzleri, kisiRolleriOf, type DepoDurumu, type Kayit, type Veri, type KayitNotu } from "./depo";
import { kuralAdaylari } from "./ice-aktarma";
import { mevcutAnahtarlar, topluEkle } from "./toplu-giris";
import type { GelenParca } from "./gelen-oku";

export type GelenKaynak = "REVY" | "WHATSAPP" | "TABLO";
export const GELEN_KAYNAK_ETIKET: Record<GelenKaynak, string> = { REVY: "Revy / portal", WHATSAPP: "WhatsApp", TABLO: "Excel listesi" };
export type GelenDurum = "HAZIR" | "KONTROL" | "DEGISTI" | "HATALI" | "TEKRAR";
export const GELEN_DURUM_ETIKET: Record<GelenDurum, string> = { HAZIR: "Hazır", KONTROL: "Kontrol gerekli", DEGISTI: "Fiyatı değişti", HATALI: "Eksik / hatalı", TEKRAR: "Zaten var" };
export type AnaTur = "TICARI" | "KONUT" | "ARSA";
export const ANA_TUR_ETIKET: Record<AnaTur, string> = { TICARI: "Ticari", KONUT: "Konut", ARSA: "Arsa" };
type KisiGirdi = { adSoyad: string; telefon: string | null; sirket: string | null; roller: string[]; rol: string };

export interface HamAday {
  /** Kalıcı anahtar: portal ilanında ilan no, diğerlerinde içerik özeti. "Atla" bununla hatırlanır. */
  key: string;
  dosyaId: string; dosyaAd: string; gelis: string;
  kaynak: GelenKaynak;
  /** Portal adı (Sahibinden…) ya da WhatsApp grubu */
  altKaynak: string;
  /** İlan / mesaj tarihi (ISO); yoksa null */
  tarih: string | null;
  taslak: Partial<Veri> & { tip: "PORTFOY" | "TALEP" };
  veri: Veri | null;
  kisi: KisiGirdi | null;
  temel: "HAZIR" | "KONTROL" | "HATALI";
  nedenler: string[]; bilgi: string[]; hatalar: string[];
  /** Orijinal mesaj / satır (kullanıcı "Orijinali göster" deyince) */
  ham: string;
  /** Havuzla ve kutunun kendi içinde mükerrer karşılaştırması (src/lib/ingest/tekrar.ts) */
  anahtarlar: string[];
  metinIzi: string | null;
  ana: AnaTur;
  /** Portföyde ilan kimden: mülk sahibi mi, emlak ofisi mi */
  sahip: "SAHIBI" | "OFIS" | "DIGER" | null;
  guven?: number;
}
export interface GelenAday extends HamAday {
  durum: GelenDurum;
  /** TEKRAR / DEGISTI: havuzdaki karşılığı */
  mevcutId?: string;
  degisim?: { eski: number; yeni: number };
  tekrarNedeni?: string;
}

const anaOf = (mulkTipi?: string | null): AnaTur => { const a = (MULK_TIPI_META as any)[mulkTipi ?? ""]?.ana; return a === "KONUT" || a === "DEVRE_MULK" ? "KONUT" : a === "ARSA" ? "ARSA" : "TICARI"; };
const sahipOf = (tip: string, s?: string | null): HamAday["sahip"] => (tip !== "PORTFOY" ? null : s === "MALIK" ? "SAHIBI" : s === "EMLAKCI" || s === "PARTNER" ? "OFIS" : "DIGER");
const iso = (t: unknown): string | null => { if (!t) return null; const d = new Date(t as any); return Number.isNaN(d.getTime()) ? null : d.toISOString(); };
const urlAnahtari = (u?: string | null) => (u ? u.replace(/^https?:\/\/(www\.)?/, "").replace(/[?#].*$/, "").replace(/\/$/, "") : null);

// ───────── 1) Dosyadan ham adaylar ─────────
function tabloAdaylari(p: Extract<GelenParca, { tur: "TABLO" }>, dosya: GelenDosyaKunye, d: DepoDurumu): HamAday[] {
  const cikti: HamAday[] = [];
  for (const b of dosyaSatirlari(p.sayfalar)) {
    const { tip, dosyaTuru } = dosyaTuruTahmin(b.eslesme);
    const s0 = new Set(b.eslesme.sutunlar);
    const portal = s0.has("url") && (s0.has("kaynak") || s0.has("ilanSahibiTuru")); // Revy ve benzeri portal dökümü
    for (const r of b.satirlar) {
      const r0 = satirDonustur(r.hucreler, b.eslesme, { tip, dosyaTuru, varsayilanSahip: "EMLAKCI", ilanGun: d.ayarlar.ttl.DIS_ILAN ?? 90, varsayilanIslem: "SATILIK", bugun: BUGUN, dosyaAdi: p.dosya }, r.no);
      const s = satirHazirla(r0, INDEKS as any);
      if (s.durum === "BOS") continue;
      // "İlan N günden eski" bir bilgidir (süre zaten bugünden başlar): kaydı tek başına "Kontrol gerekli" yapmaz
      const bilgi = s.kontrol.filter((k) => /günden eski/.test(k)), nedenler = s.kontrol.filter((k) => !/günden eski/.test(k));
      const veri = s.veri as Veri | null;
      const ham = r.hucreler.map((c, j) => { const v = (c ?? "").replace(/\s+/g, " ").trim(); const h = (b.eslesme.basliklar[j] ?? "").trim(); return v ? (h ? `${h}: ${v}` : v) : ""; }).filter(Boolean).join("\n");
      cikti.push({
        key: ilanAnahtari(s.girdi.portalIlanNo, s.girdi.portalUrl) ?? metinAnahtari("s", r.hucreler.join("|")),
        dosyaId: dosya.id, dosyaAd: dosya.ad, gelis: dosya.gelis,
        kaynak: portal ? "REVY" : "TABLO",
        altKaynak: portal ? PORTAL_ETIKET[s.girdi.veriKanali as string] ?? "Diğer portal" : (p.sayfalar.length > 1 ? `${dosya.ad} › ${b.sayfa}` : dosya.ad),
        tarih: iso(s.girdi.mesajTarihi),
        taslak: (veri ?? s.girdi) as any, veri, kisi: s.kisi,
        temel: !veri ? "HATALI" : nedenler.length ? "KONTROL" : "HAZIR",
        nedenler, bilgi, hatalar: s.hatalar, ham,
        anahtarlar: veri ? tekrarAnahtarlari(veri as any, s.kisi?.adSoyad ?? s.girdi.gondeAdi) : [],
        metinIzi: null, ana: anaOf(s.girdi.mulkTipi as string), sahip: sahipOf(tip, s.girdi.ilanSahibiTipi as string),
      });
    }
  }
  return cikti;
}

function sohbetAdaylari(parcalar: Extract<GelenParca, { tur: "SOHBET" }>[], dosya: GelenDosyaKunye, d: DepoDurumu): HamAday[] {
  const tum = parcalar.flatMap((k) => {
    const m = sohbetiAyristir(k.icerik, k.dosya, k.grup);
    // Biçimsiz düz metin (e-posta gövdesine yapıştırılmış ilan) → tek mesaj
    return m.length ? m : [{ id: `${k.grup}#1`, grup: k.grup, dosya: k.dosya, tarih: dosya.gelis, gonderen: dosya.gonderen || "E-posta", telefon: null, metin: k.icerik.trim() }];
  });
  if (!tum.length) return [];
  const r = onFiltre(tum, { bugun: BUGUN, oncedenIslenmis: new Set(d.islenmisMesajlar) });
  const mesaj = new Map<string, WaMesaj>(r.mesajlar.map((m) => [m.id, m]));
  // Havuz boş verilir: "zaten var" kararı burada değil durumla()'da, güncel havuza göre verilir
  const adaylar = kuralAdaylari(r.mesajlar, { ...d, kayitlar: [], kisiler: [] }, "GK" + dosya.id, []);
  const sira = new Map<string, number>();
  return adaylar.map((a): HamAday => {
    const m = mesaj.get(a.mesajId);
    const n = sira.get(a.mesajId) ?? 0; sira.set(a.mesajId, n + 1);
    const t = a.taslak as any;
    const p = KayitCreateSchema.safeParse({ ...t, validUntil: varsayilanValidUntil(t.tip, t.islemTipi, t.aciliyet, BUGUN, d.ayarlar.ttl) });
    const veri = p.success ? (p.data as Veri) : null;
    const roller = veri && (veri.gondeAdi || veri.gondeTelefon) ? kisiRolleriOf(veri.tip, veri.ilanSahibiTipi, veri.islemTipi) : null;
    const metin = String(t.hamMetin ?? m?.metin ?? "");
    return {
      key: metinAnahtari("w", metin, n),
      dosyaId: dosya.id, dosyaAd: dosya.ad, gelis: dosya.gelis,
      kaynak: "WHATSAPP", altKaynak: m?.grup ?? "WhatsApp", tarih: m?.tarih ?? null,
      taslak: (veri ?? t) as any, veri,
      kisi: veri && roller ? { adSoyad: veri.gondeAdi ?? veri.gondeTelefon!, telefon: veri.gondeTelefon ?? null, sirket: veri.gondeSirket ?? null, roller: roller.roller, rol: roller.kayitRol } : null,
      temel: !veri || a.durum === "HATALI" ? "HATALI" : a.durum === "HAZIR" ? "HAZIR" : "KONTROL",
      nedenler: a.nedenler, bilgi: [], hatalar: p.success ? a.hatalar : p.error.issues.slice(0, 4).map((i) => `${i.path.join(".")}: ${i.message}`),
      ham: [m ? `${m.gonderen}${m.telefon && !m.gonderen.includes(m.telefon.slice(-4)) ? " · " + m.telefon : ""}` : "", m?.metin ?? metin].filter(Boolean).join("\n"),
      anahtarlar: veri ? tekrarAnahtarlari(veri as any, veri.gondeAdi) : [],
      metinIzi: metin ? metinParmakIzi(metin) : null,
      ana: anaOf(t.mulkTipi), sahip: sahipOf(t.tip, t.ilanSahibiTipi), guven: a.guven,
    };
  });
}

/** Bir dosyanın (açılmış parçalarının) tüm adayları. Tablo ve sohbet parçaları aynı dosyada birlikte olabilir (e-posta ekleri). */
export function hamAdaylar(parcalar: GelenParca[], dosya: GelenDosyaKunye, d: DepoDurumu): HamAday[] {
  const tablolar = parcalar.filter((p): p is Extract<GelenParca, { tur: "TABLO" }> => p.tur === "TABLO");
  const sohbetler = parcalar.filter((p): p is Extract<GelenParca, { tur: "SOHBET" }> => p.tur === "SOHBET");
  return [...tablolar.flatMap((p) => tabloAdaylari(p, dosya, d)), ...(sohbetler.length ? sohbetAdaylari(sohbetler, dosya, d) : [])];
}

// ───────── 2) Havuzla karşılaştırma ─────────
export interface GelenSayim { bekleyen: number; hazir: number; kontrol: number; degisti: number; hatali: number; zatenVar: number; kopya: number; atlanan: number }
export const BEKLEYEN: ReadonlySet<GelenDurum> = new Set(["HAZIR", "KONTROL", "DEGISTI", "HATALI"]);

/**
 * @param ham     tüm dosyaların ham adayları — YENİ DOSYA ÖNCE sıralı verilmeli (aynı ilan iki dökümde varsa güncel olan kalır)
 * @param atlanan "atla / temizle" denmiş anahtarlar
 * Dönen listede TEKRAR durumundakiler de vardır (ekranda "Zaten var" süzgeciyle görülebilsin); onay bekleyenler BEKLEYEN kümesindekilerdir.
 */
export function durumla(ham: HamAday[], d: DepoDurumu, atlanan: ReadonlySet<string>): { adaylar: GelenAday[]; sayim: GelenSayim } {
  const havuz = mevcutAnahtarlar(d);
  const metinler = kayitliMetinIzleri(d.kayitlar);
  const ilanIx = new Map<string, Kayit>(), urlIx = new Map<string, Kayit>();
  for (const k of d.kayitlar) { if (k.veri.portalIlanNo) ilanIx.set(String(k.veri.portalIlanNo), k); const u = urlAnahtari(k.veri.portalUrl); if (u) urlIx.set(u, k); }
  const sayim: GelenSayim = { bekleyen: 0, hazir: 0, kontrol: 0, degisti: 0, hatali: 0, zatenVar: 0, kopya: 0, atlanan: 0 };
  const gorulenKey = new Set<string>(), gorulen = new Map<string, string>();
  const adaylar: GelenAday[] = [];
  for (const a of ham) {
    if (atlanan.has(a.key)) { sayim.atlanan++; continue; }
    if (gorulenKey.has(a.key)) { sayim.kopya++; continue; } // aynı ilan önceki dökümde de vardı: güncel olan zaten alındı
    gorulenKey.add(a.key);
    const v = a.veri as any;
    // a) Aynı portal ilanı havuzda: fiyat aynıysa "zaten var", değiştiyse "fiyatı değişti"
    const mevcut = v ? ilanIx.get(String(v.portalIlanNo ?? "")) ?? urlIx.get(urlAnahtari(v.portalUrl) ?? "") : undefined;
    if (mevcut) {
      const eski = mevcut.veri.fiyat, yeni = v.fiyat;
      if (eski != null && yeni != null && Math.abs(Number(eski) - Number(yeni)) >= 1) { adaylar.push({ ...a, durum: "DEGISTI", mevcutId: mevcut.id, degisim: { eski: Number(eski), yeni: Number(yeni) } }); sayim.degisti++; sayim.bekleyen++; }
      else { adaylar.push({ ...a, durum: "TEKRAR", mevcutId: mevcut.id, tekrarNedeni: "Aynı portal ilanı havuzda" }); sayim.zatenVar++; }
      continue;
    }
    // b) Havuzda aynı kişi + aynı özellikler ya da aynı mesaj metni
    const esit = a.anahtarlar.find((x) => havuz.has(x));
    if (esit || (a.metinIzi && metinler.has(a.metinIzi))) { adaylar.push({ ...a, durum: "TEKRAR", tekrarNedeni: esit ? tekrarNedeni(esit) + " — havuzda" : "Aynı mesaj havuzda kayıtlı" }); sayim.zatenVar++; continue; }
    // c) Kutunun içinde kopya: aynı ilan başka portalda / başka grupta da paylaşılmış
    const ic = a.anahtarlar.find((x) => gorulen.has(x));
    if (ic) { adaylar.push({ ...a, durum: "TEKRAR", tekrarNedeni: `${tekrarNedeni(ic)} — ${gorulen.get(ic)} kaynağında da var` }); sayim.kopya++; continue; }
    for (const x of a.anahtarlar) gorulen.set(x, a.altKaynak);
    adaylar.push({ ...a, durum: a.temel });
    sayim.bekleyen++;
    if (a.temel === "HAZIR") sayim.hazir++; else if (a.temel === "KONTROL") sayim.kontrol++; else sayim.hatali++;
  }
  return { adaylar, sayim };
}

// ───────── 3) İşlemler ─────────
/** Seçilen adayları havuza ekler: kişiler tek seferde bağlanır (telefonla / adla tekil), WhatsApp grubu kişinin kartına yazılır */
export function adaylariEkle(d: DepoDurumu, adaylar: GelenAday[]): { d: DepoDurumu; eklenen: number; yeniKisi: number } {
  const sec = adaylar.filter((a) => a.veri && (a.durum === "HAZIR" || a.durum === "KONTROL"));
  if (!sec.length) return { d, eklenen: 0, yeniKisi: 0 };
  const r = topluEkle(d, sec.map((a) => ({ veri: a.veri as Veri, kisi: a.kisi })));
  const grupOf = new Map<string, string>();
  for (const a of sec) if (a.kaynak === "WHATSAPP" && a.kisi?.telefon) grupOf.set(a.kisi.telefon, a.altKaynak);
  const kisiler = grupOf.size ? r.d.kisiler.map((k) => { const g = k.telefon ? grupOf.get(k.telefon) : undefined; return g && !k.whatsappGruplari.includes(g) ? { ...k, whatsappGruplari: [...k.whatsappGruplari, g] } : k; }) : r.d.kisiler;
  return { d: { ...r.d, kisiler }, eklenen: r.eklenen, yeniKisi: r.yeniKisi };
}

/** "Fiyatı değişti": havuzdaki kaydın fiyatı güncellenir, eski → yeni fiyat kaydın notlarına düşülür */
export function fiyatlariGuncelle(d: DepoDurumu, adaylar: GelenAday[]): { d: DepoDurumu; guncellenen: number } {
  const is = new Map(adaylar.filter((a) => a.durum === "DEGISTI" && a.mevcutId && a.degisim).map((a) => [a.mevcutId!, a]));
  if (!is.size) return { d, guncellenen: 0 };
  const tr = (n: number) => n.toLocaleString("tr-TR");
  const kayitlar = d.kayitlar.map((k) => {
    const a = is.get(k.id); if (!a) return k;
    const not: KayitNotu = { id: "N" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), tarih: new Date().toISOString(), tur: "NOT", metin: `İlan fiyatı değişti: ${tr(a.degisim!.eski)} → ${tr(a.degisim!.yeni)} TL (${a.altKaynak})` };
    return { ...k, veri: { ...k.veri, fiyat: a.degisim!.yeni }, notlar: [not, ...(k.notlar ?? [])] };
  });
  return { d: { ...d, kayitlar }, guncellenen: is.size };
}
