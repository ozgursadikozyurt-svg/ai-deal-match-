/**
 * Anahtar CRM v3.21.1 · 8 Ekim 2026
 * WhatsApp "Sohbeti dışa aktar" (.txt) ayrıştırıcı + ön filtre + tekrar ayıklama.
 * Yapay zekâya gitmeden ÖNCE çalışır: gürültüyü ve aynı ilanın başka gruplardaki kopyalarını ayıklar,
 * böylece AI maliyeti ve kullanıcının onaylayacağı kayıt sayısı düşer.
 * Desteklenen satır biçimleri:
 *   Android TR : "14.09.2026 09:15 - Havva Erçelik: mesaj"
 *   iOS        : "[14.09.2026 09:15:23] Havva Erçelik: mesaj"
 *   İngilizce  : "9/14/26, 9:15 AM - Name: msg"  |  "14/09/2026, 09:15 - Name: msg"
 * Birden çok satıra yayılan mesajlar birleştirilir.
 */

export type MesajDurumu = "ADAY" | "GURULTU" | "TEKRAR" | "ONCEKI"; // ONCEKI (v3.4): daha önce yapay zekâya gönderilmiş
export interface WaMesaj {
  id: string;
  grup: string;
  dosya: string;
  tarih: string | null; // ISO
  gonderen: string;
  telefon: string | null; // gönderen numara ise ya da metinde cep numarası geçiyorsa (+905xxxxxxxxx)
  metin: string;
  durum: MesajDurumu;
  neden?: string; // gürültü / tekrar nedeni
  kopyalar: { grup: string; tarih: string | null }[]; // aynı metnin başka yerlerde paylaşılması
}
export interface GrupOzeti { grup: string; dosya: string; toplam: number; aday: number; gurultu: number; tekrar: number; onceki: number; ilk: string | null; son: string | null }

const SATIR = [
  // [14.09.2026 09:15:23] Ad: metin
  /^‎?\[(\d{1,2})[./](\d{1,2})[./](\d{2,4}),? (\d{1,2}):(\d{2})(?::\d{2})?(?:\s?([AP]M))?\]\s(.+?):\s([\s\S]*)$/,
  // 14.09.2026 09:15 - Ad: metin   |   9/14/26, 9:15 AM - Ad: metin
  /^‎?(\d{1,2})[./](\d{1,2})[./](\d{2,4}),? (\d{1,2}):(\d{2})(?:\s?([AP]M))? - (.+?):\s([\s\S]*)$/,
];
/** v3.18 — Markdown (.md) dışa aktarımı: tarih "## 1 Haziran 2026" başlığında, satırlar "[9:42] **Ad:** metin" biçiminde */
const MD_BASLIK = /^#{1,3}\s*(\d{1,2})\s+([\p{L}]+)\s+(\d{4})\s*$/u;
const MD_SATIR = /^\[(\d{1,2}):(\d{2})(?::\d{2})?\]\s*\*\*(.+?):?\*\*:?\s*([\s\S]*)$/u;
const AYLAR = ["ocak", "şubat", "mart", "nisan", "mayıs", "haziran", "temmuz", "ağustos", "eylül", "ekim", "kasım", "aralık"];
const SISTEM = [
  /^‎?\[?(\d{1,2})[./](\d{1,2})[./](\d{2,4}),? (\d{1,2}):(\d{2})(?::\d{2})?(?:\s?[AP]M)?\]?( -)? [^:]+$/,
];
const GURULTU_KALIP: [RegExp, string][] = [
  [/^<?\s*([^<>\n]{0,30}dahil edilmedi|media omitted|image omitted|video omitted)\s*>?$/i, "Medya"],
  [/(bu mesaj silindi|this message was deleted|bu mesajı sildiniz|you deleted this message)/i, "Silinen mesaj"],
  [/uçtan uca şifrelidir|end-to-end encrypted/i, "Sistem"],
  [/^(günaydın|iyi (akşamlar|geceler|günler|çalışmalar)|hayırlı (cumalar|işler|olsun)|teşekkür(ler| ederim)|sağ ?ol|tamam|ok|👍+|🙏+|amin|allah razı olsun|geçmiş olsun|başınız sağ ?olsun|tebrikler)[.!\s]*$/i, "Selamlaşma"],
  [/^\S+\.(vcf|pdf|jpg|jpeg|png|mp4|opus)\s*\((dosya ekli|file attached)\)$/i, "Dosya eki"],
];
const EMLAK = /(\d+\s*(m2|m²|metre|mt|dönüm|donum)|\d\s*\+\s*\d|kiralık|kiralik|satılık|satilik|devren|devir|arıyor|ariyor|aranıyor|araniyor|arayan|talep|portföy|portfoy|müşteri|musteri|daire|villa|rezidans|depo|dükkan|dukkan|mağaza|ofis|büro|fabrika|imalathane|atölye|arsa|tarla|otel|pansiyon|bina|işyeri|isyeri|kira|milyon|\d+\s*(bin|tl|₺|usd|\$|eur|€)|m2)/i;

const ARAC = /(araba|otomobil|\baraç\b|\barac\b|\d{4}\s*model|\bkm\b|motosiklet|forklift satılık|jant|lastik|telefon satılık|koltuk takımı|beyaz eşya)/i;
const MULK = /(\d+\s*(m2|m²|metre|dönüm|donum)|\d\s*\+\s*\d|daire|villa|depo|dükkan|dukkan|ofis|fabrika|arsa|tarla|otel|bina|işyeri|isyeri|imalathane|atölye)/i;

export function telNormalize(s?: string | null): string | null {
  if (!s) return null;
  const d = s.replace(/\D/g, "");
  if (d.length === 10 && d[0] === "5") return "+90" + d;
  if (d.length === 11 && d.startsWith("05")) return "+9" + d;
  if (d.length === 12 && d.startsWith("905")) return "+" + d;
  return null;
}
const METIN_TEL = /(?:\+?90[\s-]?)?0?\s?5\d{2}[\s-]?\d{3}[\s-]?\d{2}[\s-]?\d{2}/;

function tarihYap(g: string, a: string, y: string, s: string, d: string, ampm: string | undefined, ayOnce: boolean): string | null {
  let gun = Number(g), ay = Number(a), yil = Number(y), saat = Number(s);
  if (ayOnce) [gun, ay] = [ay, gun];
  if (yil < 100) yil += 2000;
  if (ampm === "PM" && saat < 12) saat += 12;
  if (ampm === "AM" && saat === 12) saat = 0;
  if (ay < 1 || ay > 12 || gun < 1 || gun > 31) return null;
  return new Date(yil, ay - 1, gun, saat, Number(d)).toISOString();
}

/** Dosya adından grup adı: "WhatsApp Sohbeti - EMLAK BORSASI.txt" → "EMLAK BORSASI" */
export function grupAdiOf(dosya: string): string {
  const ad = dosya.replace(/\.(txt|zip)$/i, "").replace(/^.*[\\/]/, "");
  const m = ad.match(/(?:WhatsApp (?:Sohbeti|Chat)(?: with)?\s*-?\s*)(.+)$/i);
  return (m ? m[1] : ad).replace(/^_chat$/i, "WhatsApp grubu").trim() || "WhatsApp grubu";
}

export const metinParmakIzi = (m: string) => m.toLocaleLowerCase("tr").replace(/[^\p{L}\p{N}]+/gu, "").slice(0, 400);

/** Tek bir dışa aktarım dosyasını mesajlara böler (durum henüz atanmamış) */
export function sohbetiAyristir(icerik: string, dosya: string, grup = grupAdiOf(dosya)): Omit<WaMesaj, "durum" | "kopyalar">[] {
  const satirlar = icerik.replace(/\r\n?/g, "\n").split("\n");
  // v3.18 — Markdown dışa aktarımı ayrı biçimde: "## 1 Haziran 2026" + "[9:42] **Ad:** metin"
  if (satirlar.filter((l) => MD_SATIR.test(l)).length >= 3) return mdSohbetiAyristir(satirlar, dosya, grup);
  // Tarih biçimi: ay/gün mü gün.ay mı? İlk 200 satırda ilk sayı 12'yi geçiyorsa gün önce.
  let ayOnce = false;
  const ornek = satirlar.slice(0, 400).map((l) => l.match(/^‎?\[?(\d{1,2})\/(\d{1,2})\/\d{2,4}/)).filter(Boolean) as RegExpMatchArray[];
  if (ornek.length && ornek.some((m) => Number(m[2]) > 12) && !ornek.some((m) => Number(m[1]) > 12)) ayOnce = true;
  const out: Omit<WaMesaj, "durum" | "kopyalar">[] = [];
  let son: (typeof out)[number] | null = null;
  let n = 0;
  for (const ham of satirlar) {
    const l = ham.replace(/[‎‏‪-‮]/g, "");
    let m: RegExpMatchArray | null = null;
    for (const r of SATIR) { m = l.match(r); if (m) break; }
    if (m) {
      const [, g, a, y, s, d, ampm, gonderen, metin] = m;
      son = { id: `${grup}#${++n}`, grup, dosya, tarih: tarihYap(g, a, y, s, d, ampm, ayOnce), gonderen: gonderen.trim(), telefon: telNormalize(gonderen), metin: metin.trim() };
      out.push(son);
    } else if (SISTEM.some((r) => r.test(l))) {
      son = null; // "X gruba katıldı" vb.
    } else if (son && l.trim()) {
      son.metin += "\n" + l.trimEnd();
    }
  }
  for (const x of out) if (!x.telefon) { const t = x.metin.match(METIN_TEL); if (t) x.telefon = telNormalize(t[0]); }
  return out;
}

/** v3.18 — Markdown biçimli WhatsApp dışa aktarımı (tarih başlıkları + "[saat] **gönderen:** metin") */
function mdSohbetiAyristir(satirlar: string[], dosya: string, grup: string): Omit<WaMesaj, "durum" | "kopyalar">[] {
  const out: Omit<WaMesaj, "durum" | "kopyalar">[] = [];
  let son: (typeof out)[number] | null = null;
  let gun: { g: number; a: number; y: number } | null = null;
  let n = 0;
  for (const ham of satirlar) {
    const l = ham.replace(/[‎‏‪-‮]/g, "").trimEnd();
    const b = l.match(MD_BASLIK);
    if (b) {
      const ay = AYLAR.indexOf(b[2].toLocaleLowerCase("tr"));
      if (ay >= 0) { gun = { g: Number(b[1]), a: ay + 1, y: Number(b[3]) }; son = null; }
      continue;
    }
    const m = l.match(MD_SATIR);
    if (m && gun) {
      const gonderen = m[3].replace(/^@/, "").trim();
      son = { id: `${grup}#${++n}`, grup, dosya, tarih: new Date(gun.y, gun.a - 1, gun.g, Number(m[1]), Number(m[2])).toISOString(),
        gonderen, telefon: telNormalize(gonderen), metin: (m[4] ?? "").trim() };
      out.push(son!);
      continue;
    }
    if (/^(#|---|Dışa aktarma)/.test(l)) { son = null; continue; }
    if (son && l.trim()) son.metin += "\n" + l;
  }
  for (const x of out) if (!x.telefon) { const t = x.metin.match(METIN_TEL); if (t) x.telefon = telNormalize(t[0]); }
  return out;
}

export interface OnFiltreSecenek {
  sonGun?: number | null;
  bugun?: Date;
  /** v3.4 — daha önce yapay zekâya gönderilmiş mesajların parmak izleri: tekrar gönderilmez */
  oncedenIslenmis?: Set<string>;
  /** v3.4 — havuzdaki kayıtların ham metin parmak izleri: zaten kayıtlı ilan tekrar ayrıştırılmaz */
  kayitliMetinler?: Set<string>;
}
/** Birden çok dosyanın mesajlarını birleştirir: gürültüyü işaretler, aynı ilanın kopyalarını tekrar sayar. */
export function onFiltre(mesajlar: Omit<WaMesaj, "durum" | "kopyalar">[], s: OnFiltreSecenek = {}): { mesajlar: WaMesaj[]; gruplar: GrupOzeti[] } {
  const sinir = s.sonGun ? (s.bugun ?? new Date()).getTime() - s.sonGun * 86_400_000 : null;
  const ilk = new Map<string, WaMesaj>();
  const sonuc: WaMesaj[] = [];
  const sirali = [...mesajlar].sort((a, b) => (a.tarih ?? "").localeCompare(b.tarih ?? ""));
  for (const m of sirali) {
    const w: WaMesaj = { ...m, durum: "ADAY", kopyalar: [] };
    const g = GURULTU_KALIP.find(([r]) => r.test(m.metin.trim()));
    if (g) { w.durum = "GURULTU"; w.neden = g[1]; }
    else if (sinir && m.tarih && new Date(m.tarih).getTime() < sinir) { w.durum = "GURULTU"; w.neden = `${s.sonGun} günden eski`; }
    else if (m.metin.length < 25 && !/\d/.test(m.metin)) { w.durum = "GURULTU"; w.neden = "Çok kısa"; }
    else if (!EMLAK.test(m.metin)) { w.durum = "GURULTU"; w.neden = "Emlak içeriği yok"; }
    else if (ARAC.test(m.metin) && !MULK.test(m.metin)) { w.durum = "GURULTU"; w.neden = "Araç / eşya satışı"; }
    if (w.durum === "ADAY") {
      const pi = metinParmakIzi(m.metin);
      if (s.oncedenIslenmis?.has(pi)) { w.durum = "ONCEKI"; w.neden = "Daha önce işlendi"; }
      else if (s.kayitliMetinler?.has(pi)) { w.durum = "ONCEKI"; w.neden = "Havuzda zaten kayıtlı"; }
    }
    if (w.durum === "ADAY") {
      const pi = metinParmakIzi(m.metin);
      const onceki = ilk.get(pi);
      if (onceki) { w.durum = "TEKRAR"; w.neden = `Aynı mesaj: ${onceki.grup}`; onceki.kopyalar.push({ grup: m.grup, tarih: m.tarih }); }
      else ilk.set(pi, w);
    }
    sonuc.push(w);
  }
  const gruplar = new Map<string, GrupOzeti>();
  for (const m of sonuc) {
    const o = gruplar.get(m.grup) ?? { grup: m.grup, dosya: m.dosya, toplam: 0, aday: 0, gurultu: 0, tekrar: 0, onceki: 0, ilk: null, son: null };
    o.toplam++; if (m.durum === "ADAY") o.aday++; else if (m.durum === "GURULTU") o.gurultu++; else if (m.durum === "ONCEKI") o.onceki++; else o.tekrar++;
    if (m.tarih) { if (!o.ilk || m.tarih < o.ilk) o.ilk = m.tarih; if (!o.son || m.tarih > o.son) o.son = m.tarih; }
    gruplar.set(m.grup, o);
  }
  return { mesajlar: sonuc, gruplar: [...gruplar.values()] };
}

/** Yapay zekâya toplu gönderim için numaralı paket metni: "[#3] 14.09.2026 09:15 · Havva: …" */
export function paketMetni(mesajlar: WaMesaj[], baslangic = 1): string {
  return mesajlar.map((m, i) => `[#${baslangic + i}] ${m.tarih ? new Date(m.tarih).toLocaleString("tr-TR", { dateStyle: "short", timeStyle: "short" }) : ""} · ${m.gonderen}:\n${m.metin}`).join("\n\n");
}

/** v3.4 — Dosya içeriğinin parmak izi (FNV-1a 32 bit, boşluk farkları yok sayılır): aynı dosya ikinci kez yüklenirse uyarı */
export function dosyaParmakIzi(icerik: string): string {
  const t = icerik.replace(/\r\n?/g, "\n").replace(/[\u200e\u200f]/g, "").trim();
  let h = 0x811c9dc5;
  for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16).padStart(8, "0") + ":" + t.length;
}