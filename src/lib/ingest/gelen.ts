/**
 * Anahtar CRM v3.23 · 10 Ekim 2026
 * GELEN KUTUSU — saf yardımcılar (ağ, veritabanı ve arayüz yok; sunucu, tarayıcı ve testler aynı kodu kullanır).
 *
 * Akış: dosya (WhatsApp .zip / .txt, Revy .xlsx, ya da bunları taşıyan e-posta) ham hâliyle saklanır →
 * tarayıcıda açılır → her satır / mesaj bir "aday" olur → mükerrerler ayıklanır → kalanlar ONAY BEKLER.
 * Kullanıcı ekler ya da atlar; atlananın anahtarı hatırlanır (aynı ilan yarınki dökümde yeniden sorulmaz).
 */

export type GelenTur = "eml" | "zip" | "txt" | "xlsx" | "csv";
export const GELEN_TURLER: readonly GelenTur[] = ["eml", "zip", "txt", "xlsx", "csv"];
/** Tek dosya sınırı. WhatsApp "medya olmadan" dökümü ve portal Excel'i bunun çok altındadır; medyalı döküm bilerek reddedilir. */
export const GELEN_SINIR = 15 * 1024 * 1024;
/** Bir ofisin gelen kutusunda aynı anda durabilecek ham dosya sayısı (depo dolmasın; temizleyince yer açılır) */
export const GELEN_DOSYA_SINIRI = 200;
export type GelenKanal = "EPOSTA" | "KOPRU" | "YUKLEME";
export const GELEN_KANAL_ETIKET: Record<GelenKanal, string> = { EPOSTA: "E-posta", KOPRU: "E-posta (Gmail)", YUKLEME: "Elle yüklendi" };

export interface GelenDosyaKunye {
  id: string; ad: string; tur: GelenTur; boyut: number; kanal: GelenKanal;
  gonderen?: string | null; konu?: string | null;
  /** Dosyanın gelen kutusuna düştüğü an (ISO) */
  gelis: string;
}

// ───────── Dosya türü ─────────
const ZIP = [0x50, 0x4b, 0x03, 0x04];
/**
 * Dosya adından, olmazsa içeriğin ilk baytlarından tür. `null` = desteklenmiyor (fotoğraf, PDF, ses…).
 * .xlsx de bir zip'tir; adı yoksa "zip" denir ve tarayıcı içine bakıp tabloyu tanır.
 */
export function gelenTurOf(ad: string | null | undefined, bas?: Uint8Array | null, icerikTuru?: string | null): GelenTur | null {
  const u = (ad ?? "").toLowerCase().match(/\.([a-z0-9]{2,5})$/)?.[1];
  if (u === "xlsx" || u === "zip" || u === "csv" || u === "eml") return u;
  if (u === "txt" || u === "md" || u === "tsv") return u === "tsv" ? "csv" : "txt";
  if (u) return null; // .jpg, .pdf, .opus, .vcf …
  const t = (icerikTuru ?? "").toLowerCase();
  if (/message\/rfc822/.test(t)) return "eml";
  if (/spreadsheetml/.test(t)) return "xlsx";
  if (/zip/.test(t)) return "zip";
  if (/csv/.test(t)) return "csv";
  if (bas && bas.length >= 4 && ZIP.every((b, i) => bas[i] === b)) return "zip";
  if (bas && bas.length) {
    const ilk = new TextDecoder().decode(bas.subarray(0, 400));
    if (/^(Received|Return-Path|Delivered-To|From|MIME-Version|Date|Message-ID|ARC-[A-Za-z-]+|DKIM-Signature|X-[A-Za-z-]+):/im.test(ilk.slice(0, 200)) && /\r?\n[A-Za-z-]+:/.test(ilk)) return "eml";
    if (/^text\//.test(t) || !t) return "txt";
  }
  return null;
}

// ───────── Kalıcı anahtar (atlananların hatırlanması, kutu içi mükerrer) ─────────
function fnv(s: string, tohum: number): string {
  let h = tohum >>> 0;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(36);
}
/** Kısa ve kararlı özet (iki bağımsız 32 bitlik karma: 20.000 anahtarda çakışma olasılığı yok sayılır) */
export const kisaOzet = (s: string) => fnv(s, 0x811c9dc5) + fnv(s, 0x1b873593);
/** Portal ilanı: ilan no (yoksa bağlantı). Aynı ilan her gün yeniden gelir; anahtar hep aynıdır. */
export const ilanAnahtari = (ilanNo?: string | null, url?: string | null) =>
  ilanNo ? "i:" + ilanNo : url ? "u:" + kisaOzet(url.replace(/^https?:\/\/(www\.)?/, "").replace(/[?#].*$/, "").replace(/\/$/, "")) : null;
/** Tablo satırı (ilan no'suz) ve WhatsApp mesajı: içeriğin özeti */
export const metinAnahtari = (onEk: "s" | "w", metin: string, sira = 0) => `${onEk}:${kisaOzet(metin.toLocaleLowerCase("tr").replace(/[^\p{L}\p{N}]+/gu, ""))}${sira ? "#" + sira : ""}`;

// ───────── Tarihe göre gruplama ─────────
export interface TarihGrubu { anahtar: string; etiket: string; sira: number }
const GUN = 86_400_000;
const gunBasi = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
const AYLAR = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
const GUNLER = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"];
/**
 * Bir tarihi okunur gruba koyar: son 14 gün GÜN GÜN ("Bugün · 10 Ekim Cumartesi", "Dün · …", "8 Ekim Perşembe"),
 * daha eskiler AY AY ("Eylül 2026"), tarihi olmayanlar "Tarihsiz". `sira` büyük olan üstte gösterilir (yeni → eski).
 */
export function tarihGrubu(tarih: string | Date | null | undefined, bugun: Date): TarihGrubu {
  const d = tarih ? new Date(tarih) : null;
  if (!d || Number.isNaN(d.getTime())) return { anahtar: "yok", etiket: "Tarihsiz", sira: -1 };
  const fark = Math.round((gunBasi(bugun) - gunBasi(d)) / GUN);
  const gunYaz = `${d.getDate()} ${AYLAR[d.getMonth()]} ${GUNLER[d.getDay()]}`;
  if (fark < 14) return { anahtar: "g:" + gunBasi(d), etiket: `${fark === 0 ? "Bugün · " : fark === 1 ? "Dün · " : ""}${gunYaz}`, sira: gunBasi(d) }; // ileri tarihli de kendi gününde
  const ay = new Date(d.getFullYear(), d.getMonth(), 1).getTime();
  return { anahtar: "a:" + ay, etiket: `${AYLAR[d.getMonth()]} ${d.getFullYear()}`, sira: ay };
}

/** Öğeleri gruplar; gruplar `sira`ya göre (büyük üstte), grup içi verilen sırayla kalır */
export function grupla<T>(ogeler: T[], grupOf: (o: T) => TarihGrubu): { grup: TarihGrubu; ogeler: T[] }[] {
  const m = new Map<string, { grup: TarihGrubu; ogeler: T[] }>();
  for (const o of ogeler) { const g = grupOf(o); const v = m.get(g.anahtar); if (v) v.ogeler.push(o); else m.set(g.anahtar, { grup: g, ogeler: [o] }); }
  return [...m.values()].sort((a, b) => b.grup.sira - a.grup.sira || a.grup.etiket.localeCompare(b.grup.etiket, "tr"));
}

// ───────── E-posta başlığı ─────────
/** RFC 2047 ("=?UTF-8?B?…?=", "=?utf-8?Q?…?=") başlık çözücü — konu satırı için */
export function baslikCoz(ham: string | null | undefined): string {
  if (!ham) return "";
  return ham.replace(/=\?([^?]+)\?([BbQq])\?([^?]*)\?=(\s+(?==\?))?/g, (_, kume: string, tur: string, veri: string) => {
    try {
      const bayt = tur.toUpperCase() === "B"
        ? Uint8Array.from(atob(veri), (c) => c.charCodeAt(0))
        : Uint8Array.from(veri.replace(/_/g, " ").replace(/=([0-9A-Fa-f]{2})/g, (_x, h) => String.fromCharCode(parseInt(h, 16))), (c) => c.charCodeAt(0));
      return new TextDecoder(kume.toLowerCase()).decode(bayt);
    } catch { return veri; }
  }).replace(/\s+/g, " ").trim();
}

// ───────── Gelen kutusu adresi / köprü anahtarı ─────────
const KOD_ALFABE = "abcdefghijkmnpqrstuvwxyz23456789"; // karışan harfler (l, o, 0, 1) yok; e-posta adresinde küçük harf
/** 20 karakter ≈ 100 bit: tahmin edilemez; e-posta adresinin yerel kısmı olarak da geçerli */
export function yeniGelenKod(rastgele: (n: number) => Uint8Array = (n) => crypto.getRandomValues(new Uint8Array(n))): string {
  return Array.from(rastgele(20), (b) => KOD_ALFABE[b % KOD_ALFABE.length]).join("");
}
export const gelenKodGecerli = (k: unknown): k is string => typeof k === "string" && /^[a-z2-9]{16,40}$/.test(k);
/** "kod@alan", "gelen+kod@alan", "KOD@ALAN" → kod */
export const adrestenKod = (alici: string | null | undefined) => { const y = String(alici ?? "").trim().toLowerCase().split("@")[0].replace(/^.*\+/, ""); return gelenKodGecerli(y) ? y : null; };

/**
 * Gmail köprüsü — kullanıcının kendi Google hesabında çalışan küçük betik (script.google.com).
 * Kullanıcı dosyayı KENDİ Gmail adresinin "+anahtar" takma adına yollar (ornek+anahtar@gmail.com); betik 10 dakikada bir
 * o postaların eklerini Anahtar CRM'e iletir ve postayı "AnahtarCRM" etiketiyle işaretler (ikinci kez gitmesin).
 * Alan adı gerektirmez, ücretsizdir. Alan adı bağlanınca (GELEN_ALAN_ADI) doğrudan adrese geçilir, betik kapatılır.
 */
export function gmailKopruBetigi(adres: string, kod: string): string {
  return `// Anahtar CRM — Gmail + Drive köprüsü. Bu kodu DEĞİŞTİRMEDEN yapıştırın; önce "kur" işlevini bir kez çalıştırın.
var ADRES = ${JSON.stringify(adres)};
var ANAHTAR = ${JSON.stringify(kod)};
var ETIKET = "AnahtarCRM";
var KLASOR = "AnahtarCRM Gelen";
var TURLER = /\\.(zip|txt|xlsx|csv)$/i;

function kur() {
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === "anahtarCrmGonder") ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger("anahtarCrmGonder").timeBased().everyMinutes(10).create();
  klasor(KLASOR, null);
  anahtarCrmGonder();
  Logger.log("Kuruldu. Dosyaları şu adrese gönderin: " + hedefAdres() + " — ya da Drive'daki '" + KLASOR + "' klasörüne bırakın.");
}

function hedefAdres() { return Session.getEffectiveUser().getEmail().replace("@", "+anahtar@"); }

function klasor(ad, ust) {
  var it = ust ? ust.getFoldersByName(ad) : DriveApp.getFoldersByName(ad);
  return it.hasNext() ? it.next() : (ust ? ust.createFolder(ad) : DriveApp.createFolder(ad));
}

// 0 = alındı, 1 = geçici sorun (yeniden denenir), 2 = kalıcı ret
function gonder(bayt, ad, gonderen, konu) {
  var yanit = UrlFetchApp.fetch(ADRES, {
    method: "post", contentType: "application/octet-stream", payload: bayt, muteHttpExceptions: true,
    headers: { "x-anahtar": ANAHTAR, "x-dosya-adi": encodeURIComponent(ad), "x-gonderen": encodeURIComponent(gonderen), "x-konu": encodeURIComponent(konu) }
  });
  var kod = yanit.getResponseCode();
  if (kod >= 500 || kod === 429) return 1;
  if (kod >= 300) { Logger.log(ad + " alınmadı: " + yanit.getContentText()); return 2; }
  return 0;
}

function islenenler() { try { return JSON.parse(PropertiesService.getScriptProperties().getProperty("islenen") || "[]"); } catch (e) { return []; } }

function anahtarCrmGonder() {
  var etiket = GmailApp.getUserLabelByName(ETIKET) || GmailApp.createLabel(ETIKET);
  var islendi = null, yapilan = islenenler();
  // 1) Postayla gelenler: +anahtar adresine gelen ekler → CRM. Her posta tek tek izlenir (Gmail aynı konulu postaları tek konuşmada toplar);
  //    işlenen konuşma etiketlenir ve gelen kutusundan kalkar (posta silinmez, etiketin altında durur).
  var konusmalar = GmailApp.search("to:(" + hedefAdres() + ") has:attachment newer_than:14d", 0, 30);
  Logger.log("Bulunan konuşma: " + konusmalar.length);
  konusmalar.forEach(function (konusma) {
    var tamam = true;
    konusma.getMessages().forEach(function (posta) {
      var no = posta.getId();
      if (yapilan.indexOf(no) >= 0) return;
      var bekleyen = false;
      posta.getAttachments({ includeInlineImages: false }).forEach(function (ek) {
        if (!TURLER.test(ek.getName())) return;
        var sonuc = gonder(ek.getBytes(), ek.getName(), posta.getFrom(), posta.getSubject());
        if (sonuc === 1) { bekleyen = true; return; }
        Logger.log("Gönderildi: " + ek.getName());
        try { islendi = islendi || klasor("İşlendi", klasor(KLASOR, null)); islendi.createFile(ek.copyBlob()); } catch (e) { Logger.log("Drive'a yedeklenemedi: " + e); }
      });
      if (bekleyen) tamam = false; else yapilan.push(no);
    });
    if (tamam) { konusma.addLabel(etiket); konusma.moveToArchive(); }
  });
  PropertiesService.getScriptProperties().setProperty("islenen", JSON.stringify(yapilan.slice(-150)));
  // 2) Drive klasörüne bırakılanlar → CRM; işlenen dosya 'İşlendi' alt klasörüne taşınır
  var ana = klasor(KLASOR, null);
  var dosyalar = ana.getFiles(), sayac = 0;
  while (dosyalar.hasNext() && sayac++ < 20) {
    var dosya = dosyalar.next();
    if (!TURLER.test(dosya.getName())) continue;
    if (gonder(dosya.getBlob().getBytes(), dosya.getName(), "Drive", KLASOR) === 1) continue;
    islendi = islendi || klasor("İşlendi", ana);
    dosya.moveTo(islendi);
  }
}
`;
}
