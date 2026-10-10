/**
 * Anahtar CRM v3.23 · 10 Ekim 2026
 * v3.23 — GELEN KUTUSU (onay bekleyenler): dosya türü, e-posta / zip / Excel açma, Revy dökümü eşlemesi, mükerrer denetimi,
 * tarihe göre gruplama, toplu ekle / atla / temizle, Gmail köprüsü betiği; ekran (JSDOM).
 * Yan düzeltmeler: "otoparklı" / "müstakil tapu" şemadan dönmez; arsa "Mülk türü" imardır; başlıkta "devren" → devir bedeli.
 */
import { test as nodeTest } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import React from "react";
import { zipSync, strToU8 } from "fflate";
import { gelenTurOf, tarihGrubu, grupla, ilanAnahtari, metinAnahtari, kisaOzet, baslikCoz, yeniGelenKod, gelenKodGecerli, adrestenKod, gmailKopruBetigi, GELEN_SINIR } from "../src/lib/ingest/gelen";
import { dosyaSatirlari, satirDonustur, satirHazirla, mulkTuruOku } from "../src/lib/ingest/tablo";
import { csvOku } from "../src/lib/ingest/xlsx";
import { hizliAyristir } from "../src/lib/ai/hizli-ayristirici";
import { KayitCreateSchema } from "../src/lib/validation/kayit";
import { gelenDosyayiAc } from "../demo/gelen-oku";
import { hamAdaylar, durumla, adaylariEkle, fiyatlariGuncelle, BEKLEYEN, type GelenAday } from "../demo/gelen-aday";
import { ornekRevyCsv, ornekGelenDosyalar } from "../demo/ornek-gelen";
import { gelenDepo, gelenDepoKur, demoGelenSifirla } from "../demo/gelen-depo";
import { GelenKutusu, GelenKutusuKarti, kutuSifirla, kutuYukle } from "../demo/gelen-kutusu";
import { ornekVeriyiKur, bosBaglanti, bosGoogleBaglanti, DEMO_SAHIPLIK, BUGUN, type DepoDurumu } from "../demo/depo";
import { sahiplikNormalize } from "../src/lib/domain/sahiplik";
import { TTL_VARSAYILAN } from "../src/lib/domain/gecerlilik";
import { INDEKS } from "../demo/lokasyon";
import { kaliciHepsiniSil } from "../demo/kalici";
import type { Ctx } from "../demo/ortak";
import { SURUM, SURUM_GECMISI, DOSYA_EKI } from "../src/lib/surum";
import { OFIS_MODELLERI, SADECE_TEST_baglamiSabitle, VARSAYILAN_OFIS_ID, VARSAYILAN_KULLANICI_ID } from "../src/lib/kiracilik";
import { ac } from "./yardimci-arayuz";
SADECE_TEST_baglamiSabitle({ ofisId: VARSAYILAN_OFIS_ID, kullaniciId: VARSAYILAN_KULLANICI_ID, rol: "OFIS_YONETICISI", eposta: "test@anahtar.local" });

const ornek = ornekVeriyiKur();
const durum = (ek: Partial<DepoDurumu> = {}): DepoDurumu => ({ veriSurumu: "t", kayitlar: ornek.kayitlar, eslesmeNotlari: {}, testler: {}, geriBildirim: "", ayarlar: { ttl: TTL_VARSAYILAN, sahiplik: sahiplikNormalize(DEMO_SAHIPLIK) }, ogrenilen: [], adaylar: [], aktifIceAktarma: null, iceAktarmaGecmisi: [], kisiler: ornek.kisiler, islenmisMesajlar: [], dosyaIzleri: {}, baglantilar: { google: bosGoogleBaglanti(), notion: bosBaglanti() }, senkronGecmisi: [], cakismalar: [], ...ek });
const test = (ad: string, f: () => unknown | Promise<unknown>) => nodeTest(ad, async () => { kaliciHepsiniSil(); await f(); });
const kunye = (id: string, ad: string, gunOnce = 0) => ({ id, ad, tur: gelenTurOf(ad)!, boyut: 1, kanal: "YUKLEME" as const, gelis: new Date(BUGUN.getTime() - gunOnce * 86_400_000).toISOString() });
const SOHBET = `28.09.2026 09:14 - Selim Y.: Konyaaltı Liman'da 2+1 satılık daire, 90 m2, 3. kat, kombili, site içinde havuzlu otoparklı. 5.450.000 TL
28.09.2026 09:20 - Selim Y.: Günaydın
29.09.2026 10:05 - +90 532 555 01 01: Cender otel arkasında 140 m2 köşe dükkan kiralıktır, 10 metre vitrin. Aylık 120.000
29.09.2026 11:10 - Burcu A.: Kepez Yeni Sanayi'de 500 m2 imalathane kiralık, sanayi elektriği var. 65 bin
29.09.2026 11:48 - Nur Emlak: <Medya dahil edilmedi>`;
const waZip = () => zipSync({ "WhatsApp Sohbeti - EMLAK BORSASI.txt": strToU8(SOHBET), "IMG-0001.jpg": new Uint8Array(2000) });
/** Tek ekli, base64 kodlu basit bir e-posta (Gmail'in WhatsApp dışa aktarımında ürettiğine benzer) */
const eml = (ekAd: string, ek: Uint8Array, konu = "=?UTF-8?B?" + Buffer.from("WhatsApp Sohbeti - EMLAK BORSASI ile sohbet").toString("base64") + "?=") =>
  new TextEncoder().encode(["From: Ozgur <ozgur@example.com>", "To: abcdefghijkmnpqrstuv@gelen.example.com", `Subject: ${konu}`, "MIME-Version: 1.0", 'Content-Type: multipart/mixed; boundary="SINIR"', "",
    "--SINIR", "Content-Type: text/plain; charset=utf-8", "", "WhatsApp sohbet gecmisi bu e-postaya eklenmistir.", "",
    "--SINIR", `Content-Type: application/octet-stream; name="${ekAd}"`, "Content-Transfer-Encoding: base64", `Content-Disposition: attachment; filename="${ekAd}"`, "", Buffer.from(ek).toString("base64").replace(/(.{76})/g, "$1\r\n"), "--SINIR--", ""].join("\r\n"));

// ───────── 1) Saf yardımcılar ─────────
test("dosya türü: uzantıdan; uzantı yoksa içerikten; desteklenmeyen tür null", () => {
  assert.equal(gelenTurOf("ads-2026-10-10.xlsx"), "xlsx");
  assert.equal(gelenTurOf("WhatsApp Sohbeti - GRUP.zip"), "zip");
  assert.equal(gelenTurOf("_chat.txt"), "txt"); assert.equal(gelenTurOf("sohbet.md"), "txt"); assert.equal(gelenTurOf("liste.csv"), "csv");
  assert.equal(gelenTurOf("IMG-123.jpg"), null); assert.equal(gelenTurOf("brosur.pdf"), null); assert.equal(gelenTurOf("kisi.vcf"), null);
  assert.equal(gelenTurOf(null, new Uint8Array([0x50, 0x4b, 3, 4, 0, 0])), "zip", "adı yoksa zip imzası");
  assert.equal(gelenTurOf("", new TextEncoder().encode("Received: from x\r\nFrom: a@b.c\r\nSubject: s\r\n\r\ngovde")), "eml");
  assert.equal(gelenTurOf(null, null, "message/rfc822"), "eml");
  assert.equal(gelenTurOf(null, new TextEncoder().encode("28.09.2026 09:14 - Selim: merhaba")), "txt");
  assert.equal(GELEN_SINIR, 15 * 1024 * 1024);
});

test("tarihe göre gruplama: Bugün / Dün / gün gün (14 gün) / ay ay / tarihsiz; yeni üstte", () => {
  const bugun = new Date(2026, 9, 10, 12);
  const g = (y: number, a: number, d: number) => tarihGrubu(new Date(y, a - 1, d, 9).toISOString(), bugun);
  assert.equal(g(2026, 10, 10).etiket, "Bugün · 10 Ekim Cumartesi");
  assert.equal(g(2026, 10, 9).etiket, "Dün · 9 Ekim Cuma");
  assert.equal(g(2026, 10, 5).etiket, "5 Ekim Pazartesi");
  assert.equal(g(2026, 9, 27).etiket, "27 Eylül Pazar", "13 gün önce hâlâ gün gün");
  assert.equal(g(2026, 9, 26).etiket, "Eylül 2026", "14 gün ve öncesi ay ay");
  assert.equal(g(2026, 9, 3).anahtar, g(2026, 9, 26).anahtar, "aynı ayın eski günleri tek grupta");
  assert.equal(tarihGrubu(null, bugun).etiket, "Tarihsiz");
  assert.equal(tarihGrubu("saçma", bugun).etiket, "Tarihsiz");
  const sirali = grupla([{ t: "2026-08-01" }, { t: null }, { t: "2026-10-10" }, { t: "2026-10-09" }, { t: "2026-10-10" }], (o) => tarihGrubu(o.t, bugun));
  assert.deepEqual(sirali.map((x) => [x.grup.etiket, x.ogeler.length]), [["Bugün · 10 Ekim Cumartesi", 2], ["Dün · 9 Ekim Cuma", 1], ["Ağustos 2026", 1], ["Tarihsiz", 1]]);
});

test("anahtarlar: ilan no kalıcıdır (yarınki dökümde aynı), içerik özeti kararlıdır; kod ve adres", () => {
  assert.equal(ilanAnahtari("1344109418", "https://sahibinden.com/1344109418"), "i:1344109418");
  assert.equal(ilanAnahtari(null, "https://www.emlakjet.com/ilan/ornek-ofis?x=1"), ilanAnahtari(null, "http://emlakjet.com/ilan/ornek-ofis/"), "bağlantı biçimi fark etmez");
  assert.equal(ilanAnahtari(null, null), null);
  assert.equal(metinAnahtari("w", "Lara'da 3+1 KİRALIK daire!"), metinAnahtari("w", "lara da 3+1 kiralık   daire"), "noktalama / büyük-küçük harf fark etmez");
  assert.notEqual(metinAnahtari("w", "a b c", 0), metinAnahtari("w", "a b c", 1), "aynı mesajdaki ikinci ilan ayrı anahtar");
  assert.equal(kisaOzet("x"), kisaOzet("x")); assert.notEqual(kisaOzet("x"), kisaOzet("y"));
  const kod = yeniGelenKod();
  assert.match(kod, /^[a-z2-9]{20}$/); assert.ok(gelenKodGecerli(kod)); assert.notEqual(kod, yeniGelenKod());
  assert.equal(gelenKodGecerli("kisa"), false); assert.equal(gelenKodGecerli("ABCDEFGHIJKMNPQRSTUV"), false); assert.equal(gelenKodGecerli(null), false);
  assert.equal(adrestenKod(`${kod}@gelen.anahtarcrm.com`), kod);
  assert.equal(adrestenKod(`Gelen+${kod.toUpperCase()}@Anahtarcrm.com`), kod, "gelen+kod@ ve büyük harf");
  assert.equal(adrestenKod("info@anahtarcrm.com"), null);
  assert.equal(baslikCoz("=?UTF-8?B?" + Buffer.from("Revy dökümü – Çarşı").toString("base64") + "?="), "Revy dökümü – Çarşı");
  assert.equal(baslikCoz("=?utf-8?Q?WhatsApp_Sohbeti_-_EML=C3=84K?= ek"), "WhatsApp Sohbeti - EMLÄK ek");
  assert.equal(baslikCoz("Düz konu"), "Düz konu"); assert.equal(baslikCoz(null), "");
});

test("Gmail köprüsü betiği: adres ve anahtar gömülü, geçerli JavaScript, yalnızca +anahtar adresine gelen ekleri yollar", () => {
  const b = gmailKopruBetigi("https://anahtarcrm.ornek.workers.dev/api/gelen/al", "abcdefghijkmnpqrstuv");
  assert.ok(b.includes('var ADRES = "https://anahtarcrm.ornek.workers.dev/api/gelen/al";'));
  assert.ok(b.includes('var ANAHTAR = "abcdefghijkmnpqrstuv";'));
  assert.doesNotThrow(() => new Function(b), "sözdizimi geçerli");
  assert.match(b, /function kur\(\)/); assert.match(b, /everyMinutes\(10\)/);
  assert.match(b, /replace\("@", "\+anahtar@"\)/, "kullanıcının kendi adresinin +anahtar takma adı");
  assert.match(b, /yapilan\.indexOf\(no\)/, "işlenen posta ikinci kez gitmez (posta kimliğiyle; konuşma etiketiyle değil)");
  assert.match(b, /"x-anahtar": ANAHTAR/);
  assert.ok(!/GmailApp\.(sendEmail|moveToTrash|markRead)|deleteThread|\.reply\(/.test(b), "betik posta göndermez / silmez");
  // sahte ortamda çalıştır: 2 ekten yalnızca desteklenen tür gider; başarılıysa etiketlenir, 500'de etiketlenmez
  const calistir = (durumKodu: number) => {
    const giden: any[] = []; let etiketlendi = 0, arsivlendi = 0, yedeklendi = 0, tasindi = 0;
    const ek = (ad: string) => ({ getName: () => ad, getBytes: () => [1, 2, 3], copyBlob: () => ({}) });
    const konusma = { getMessages: () => [{ getAttachments: () => [ek("WhatsApp Sohbeti - A.zip"), ek("foto.jpg")], getId: () => "m1", getFrom: () => "Özgür <o@gmail.com>", getSubject: () => "Sohbet" }], addLabel: () => { etiketlendi++; }, moveToArchive: () => { arsivlendi++; } };
    const dosya = { getName: () => "Revy 10 Ekim.xlsx", getBlob: () => ({ getBytes: () => [9] }), moveTo: () => { tasindi++; } };
    let verildi = false, bellek: string | null = null;
    const klasor: any = { getFoldersByName: () => ({ hasNext: () => true, next: () => klasor }), createFile: () => { yedeklendi++; }, getFiles: () => ({ hasNext: () => !verildi, next: () => { verildi = true; return dosya; } }) };
    const ortam = { Session: { getEffectiveUser: () => ({ getEmail: () => "ozgur@gmail.com" }) }, Logger: { log: () => {} },
      GmailApp: { getUserLabelByName: () => ({}), createLabel: () => ({}), search: (q: string) => { giden.push({ q }); return [konusma]; } },
      UrlFetchApp: { fetch: (u: string, o: any) => { giden.push({ u, o }); return { getResponseCode: () => durumKodu, getContentText: () => "" }; } },
      DriveApp: { getFoldersByName: () => ({ hasNext: () => true, next: () => klasor }) },
      PropertiesService: { getScriptProperties: () => ({ getProperty: () => bellek, setProperty: (_k: string, v: string) => { bellek = v; } }) },
      ScriptApp: { getProjectTriggers: () => [], newTrigger: () => ({ timeBased: () => ({ everyMinutes: () => ({ create: () => {} }) }) }) } };
    new Function(...Object.keys(ortam), b + "\nanahtarCrmGonder(); anahtarCrmGonder();")(...Object.values(ortam));
    return { giden, etiketlendi, arsivlendi, yedeklendi, tasindi };
  };
  const ok = calistir(201);
  assert.match(ok.giden[0].q, /^to:\(ozgur\+anahtar@gmail\.com\) has:attachment newer_than:14d$/);
  assert.equal(ok.giden.length, 4, "arama×2 + .zip (.jpg atlandı; ikinci çalışmada tekrar gitmez) + Drive klasöründeki xlsx");
  assert.ok(ok.arsivlendi >= 1, "işlenen posta gelen kutusundan kalkar, AnahtarCRM etiketinde durur");
  assert.equal(ok.yedeklendi, 1, "ek Drive 'İşlendi' klasörüne yedeklenir"); assert.equal(ok.tasindi, 1, "Drive'a bırakılan dosya İşlendi'ye taşınır");
  assert.equal(calistir(503).arsivlendi, 0, "geçici hatada posta kutuda kalır"); assert.equal(calistir(503).tasindi, 0);
  assert.equal(ok.giden[1].o.headers["x-dosya-adi"], encodeURIComponent("WhatsApp Sohbeti - A.zip"));
  assert.equal(ok.giden[1].o.headers["x-gonderen"], encodeURIComponent("Özgür <o@gmail.com>"), "Türkçe karakter başlıkta URL-kodlu");
  assert.ok(ok.etiketlendi >= 1);
  assert.equal(calistir(503).etiketlendi, 0, "geçici hata: etiketlenmez, 10 dk sonra yeniden denenir");
  assert.ok(calistir(415).etiketlendi >= 1, "kalıcı ret: bir daha denenmez");
});

// ───────── 2) Yan düzeltmeler (Revy dökümünde görülen hatalar) ─────────
test("jargon: 'otoparklı' ve 'müstakil tapu' artık şemadan geçer (eskiden otoparkDurumu=true / tapuTipi=MUSTAKIL ile reddediliyordu)", () => {
  assert.equal(hizliAyristir("Sahibinden 3+1 havuzlu otoparklı daire 7.200.000").ozellik.otoparkDurumu, "ACIK");
  assert.equal(hizliAyristir("Kapalı otoparklı sitede 2+1 satılık 5 MTL").ozellik.otoparkDurumu, "KAPALI");
  assert.equal(hizliAyristir("Konyaaltı'nda müstakil tapulu satılık arsa 12 milyon").ozellik.tapuTipi, "MUSTAKIL_PARSEL");
  for (const m of ["Sahibinden Siteler mahallesi 3+1 havuzlu otoparklı daire", "Konyaaltı'nda müstakil tapulu satılık arsa"]) {
    const h = hizliAyristir(m);
    const p = KayitCreateSchema.safeParse({ tip: "PORTFOY", mulkTipi: h.mulkTipi ?? "DAIRE", islemTipi: "SATILIK", fiyat: 1_000_000, lokasyonlar: [], ozellik: h.ozellik });
    assert.ok(p.success, m + " → " + (p.success ? "" : JSON.stringify(p.error.issues)));
  }
});

test("portal 'Mülk türü' birebir karşılanır; arsada tür İMARDIR (villa / konut arsası arsa kalır)", () => {
  assert.deepEqual(mulkTuruOku("Spor Tesisi ", "Ticari"), { mulkTipi: "SPOR_TESISI", tahmin: false });
  assert.equal(mulkTuruOku("Pazar Yeri ", "Ticari").mulkTipi, "PAZAR_YERI");
  assert.equal(mulkTuruOku("Apartman Dairesi", "Ticari").mulkTipi, "OFIS_APARTMAN_DAIRESI");
  assert.equal(mulkTuruOku("Dükkan & Mağaza", "Ticari").mulkTipi, "DUKKAN_MAGAZA");
  assert.equal(mulkTuruOku("Plaza Katı & Ofisi", "Ticari").mulkTipi, "PLAZA_KATI_OFIS");
  assert.equal(mulkTuruOku("Yazlık", "Konut").mulkTipi, "YAZLIK");
  assert.deepEqual(mulkTuruOku("Villa", "Arsa"), { mulkTipi: "ARSA", tahmin: false, imar: "KONUT" }, "villa imarlı ARSA (eskiden VILLA)");
  assert.deepEqual(mulkTuruOku("Konut", "Arsa"), { mulkTipi: "ARSA", tahmin: false, imar: "KONUT" }, "eskiden DAIRE");
  assert.equal(mulkTuruOku("Ticari Konut", "Arsa").imar, "TICARI_KONUT");
  assert.equal(mulkTuruOku("Ticari", "Arsa").imar, "TICARI");
  assert.equal(mulkTuruOku("Tarla", "Arsa").mulkTipi, "TARLA"); assert.equal(mulkTuruOku("Bağ", "Arsa").mulkTipi, "BAG_BAHCE");
  assert.equal(mulkTuruOku("", "Arsa", "Lara'da 3+1 villa manzaralı parsel").mulkTipi, "ARSA", "arsada başlıktaki 'villa' türü değiştirmez");
  // Türü yazılmamış ticari ilan: başlıktaki işletme adı
  assert.deepEqual(mulkTuruOku("", "Ticari", "SAHİBİNDEN DEVREN KİRALIK ŞARKÜTERİ"), { mulkTipi: "DUKKAN_MAGAZA", tahmin: true });
  assert.equal(mulkTuruOku("", "Ticari", "ACİLLL DEVREN KİRALIK FAAL OTO YIKAMA").mulkTipi, "OTO_YIKAMA");
  assert.equal(mulkTuruOku("", "Ticari", "Antalya'nın göbeğinde harika bir yer").mulkTipi, null, "ipucu yoksa uydurulmaz");
  assert.equal(mulkTuruOku("", "Ticari", "Merkezde 2+1 daire yüksek giriş").mulkTipi, "OFIS_APARTMAN_DAIRESI", "sütun Ticari: başlıktaki 'daire' konut yapmaz");
});

const revySatir = (h: string[]) => {
  const b = dosyaSatirlari([csvOku(ornekRevyCsv().split("\n")[0] + "\n" + h.join(";"), "x")])[0];
  return satirHazirla(satirDonustur(b.satirlar[0].hucreler, b.eslesme, { tip: "PORTFOY", dosyaTuru: "PORTAL", varsayilanSahip: "EMLAKCI", ilanGun: 90, varsayilanIslem: "SATILIK", bugun: new Date(2026, 9, 10), dosyaAdi: "ads.xlsx" }, 2), INDEKS as any);
};
const R = (ana: string, tur: string, islem: string, m2: string, fiyat: string, baslik: string, devren = "Hayır", no = "1344109418") =>
  ["05.10.2026", ana, tur, islem, m2, fiyat, "", "", baslik, "Antalya", "Muratpaşa", "Meltem", "Güvenlik Mah", "", "", "", "", "Hayır", "", "", devren, "Hayır", "Mülk Sahibi", "Şeref E.", "", "5", "Aktif", "Sahibinden.com", "https://sahibinden.com/" + no];

test("Revy dökümü: 29 sütun tanınır; başlıkta 'devren' → devir bedeli (Devren Satılık, toplam); kira / satış fiyatı akıl denetimi", () => {
  const b = dosyaSatirlari([csvOku(ornekRevyCsv(), "x")])[0];
  for (const a of ["tarih", "anaKategori", "mulkTuru", "islem", "m2", "fiyat", "ilkFiyat", "baslik", "ilce", "semt", "mahalle", "oda", "kat", "devren", "ilanSahibiTuru", "ilanSahibi", "ilanDurumu", "kaynak", "url"]) assert.ok(b.eslesme.sutunlar.includes(a as any), a);
  // "Devren mi: Hayır" yazsa da başlık devren diyor ve 36 m²'ye 580.000 TL kira olmaz → devir bedeli
  const d1 = revySatir(R("Ticari", "", "Kiralık", "36", "580000", "15.000 KİRA DEVREN SAHİBİNDEN KİRALIK BUTİK"));
  assert.equal(d1.girdi.islemTipi, "DEVREN_SATILIK"); assert.equal(d1.girdi.fiyatPeriyodu, "TOPLAM"); assert.equal(d1.girdi.fiyat, 580000);
  assert.equal(d1.girdi.mulkTipi, "DUKKAN_MAGAZA"); assert.match(d1.girdi.operasyonNotu ?? "", /devir bedeli sayıldı/);
  assert.ok(d1.veri, "şemadan geçer"); assert.equal(d1.girdi.ilanSahibiTipi, "MALIK"); assert.equal(d1.girdi.portalIlanNo, "1344109418"); assert.equal(d1.girdi.veriKanali, "SAHIBINDEN");
  // küçük tutar: gerçekten aylık kiradır
  const d2 = revySatir(R("Ticari", "Dükkan & Mağaza", "Kiralık", "80", "45000", "Devren kiralık dükkan"));
  assert.equal(d2.girdi.islemTipi, "DEVREN_KIRALIK"); assert.equal(d2.girdi.fiyatPeriyodu, "AYLIK");
  // büyük alan + orta tutar: belli değil → kontrol
  const d3 = revySatir(R("Ticari", "Depo & Antrepo", "Kiralık", "1500", "400000", "Devren kiralık depo"));
  assert.equal(d3.girdi.islemTipi, "DEVREN_KIRALIK"); assert.ok(d3.kontrol.some((k) => /aylık kira mı devir bedeli mi/.test(k)));
  assert.equal(revySatir(R("Ticari", "", "Satılık", "25", "450000", "Devren Satılık Su Bayi")).girdi.islemTipi, "DEVREN_SATILIK");
  assert.equal(revySatir(R("Konut", "Daire", "Kiralık", "90", "30000", "Devren kiralık yazısı geçen daire")).girdi.islemTipi, "KIRALIK", "konutta devren olmaz");
  // akıl denetimi
  assert.ok(revySatir(R("Ticari", "Restoran & Lokanta", "Kiralık", "400", "11000000", "Belediye Caddesinde Restoran")).kontrol.some((k) => /Aylık kira için çok yüksek/.test(k)));
  assert.ok(revySatir(R("Ticari", "", "Kiralık", "30", "600000", "GETİRİSİ YÜKSEK ERKEK KUAFÖRÜ")).kontrol.some((k) => /m² başına çok yüksek \(20\.000 TL\/m²\)/.test(k)));
  assert.ok(revySatir(R("Ticari", "Dükkan & Mağaza", "Kiralık", "40", "1200", "Kiralık dükkan")).kontrol.some((k) => /Kira çok düşük/.test(k)));
  assert.ok(revySatir(R("Konut", "Daire", "Satılık", "120", "85000", "Satılık daire")).kontrol.some((k) => /Satış fiyatı çok düşük/.test(k)));
  const temiz = revySatir(R("Ticari", "Dükkan & Mağaza", "Kiralık", "600", "275000", "12. cadde üzeri köşe dükkan"));
  assert.deepEqual(temiz.kontrol, [], "600 m² dükkana 275.000 TL kira olağan: uyarı yok"); assert.equal(temiz.durum, "HAZIR");
  // arsa: imar özelliği yazılır
  const arsa = revySatir(R("Arsa", "Ticari", "Satılık", "1450", "38500000", "Lara'da ticari imarlı köşe parsel"));
  assert.equal(arsa.girdi.mulkTipi, "ARSA"); assert.equal((arsa.veri as any).ozellik.imarDurumu, "TICARI");
});

// ───────── 3) Dosya açma ─────────
test("dosya açma: WhatsApp .zip (medya atlanır), e-posta → ek → zip → sohbet, adı .zip olan Excel, gövdeye yapıştırılmış ilan", async () => {
  const z = await gelenDosyayiAc("WhatsApp Sohbeti - EMLAK BORSASI.zip", "zip", waZip());
  assert.deepEqual(z.uyarilar, []); assert.equal(z.parcalar.length, 1);
  assert.equal(z.parcalar[0].tur, "SOHBET"); assert.equal((z.parcalar[0] as any).grup, "EMLAK BORSASI");
  // iOS dökümü: zip içinde _chat.txt → grup adı zip adından
  const ios = await gelenDosyayiAc("WhatsApp Chat - Antalya Ticari.zip", "zip", zipSync({ "_chat.txt": strToU8("[28.09.2026 09:14:00] Ali: Lara'da 3+1 kiralık daire 45.000 TL") }));
  assert.equal((ios.parcalar[0] as any).grup, "Antalya Ticari");
  const e = await gelenDosyayiAc("posta.eml", "eml", eml("WhatsApp Sohbeti - EMLAK BORSASI.zip", waZip()));
  assert.deepEqual(e.uyarilar, []); assert.equal(e.parcalar.length, 1); assert.equal(e.parcalar[0].tur, "SOHBET");
  assert.match((e.parcalar[0] as any).icerik, /Cender otel arkasında/, "Türkçe karakterler bozulmadan");
  const tablo = await gelenDosyayiAc("ads.csv", "csv", new TextEncoder().encode(ornekRevyCsv()));
  assert.equal(tablo.parcalar[0].tur, "TABLO"); assert.ok((tablo.parcalar[0] as any).sayfalar[0].satirlar.length > 15);
  const xlsx = new Uint8Array(fs.readFileSync("tests/fixtures/v37_ornek.xlsx"));
  assert.equal((await gelenDosyayiAc("liste.xlsx", "xlsx", xlsx)).parcalar[0].tur, "TABLO");
  assert.equal((await gelenDosyayiAc("ek", "zip", xlsx)).parcalar[0].tur, "TABLO", "uzantısız / .zip adlı Excel içeriğinden tanınır");
  assert.equal((await gelenDosyayiAc("posta.eml", "eml", eml("liste.xlsx", xlsx))).parcalar[0].tur, "TABLO", "e-posta ekindeki Excel");
  const bos = await gelenDosyayiAc("foto.zip", "zip", zipSync({ "IMG-1.jpg": new Uint8Array(10) }));
  assert.equal(bos.parcalar.length, 0); assert.match(bos.uyarilar[0], /okunacak sohbet \/ tablo yok \(1 medya/);
  const govde = new TextEncoder().encode("From: a@b.c\r\nSubject: ilan\r\nContent-Type: text/plain; charset=utf-8\r\n\r\nSahibinden Lara'da 140 m2 kiralık dükkan, aylık 85.000 TL. Tel 0532 555 01 01\r\n");
  const g = await gelenDosyayiAc("ilan.eml", "eml", govde);
  assert.equal(g.parcalar.length, 1); assert.match((g.parcalar[0] as any).icerik, /140 m2 kiralık dükkan/);
  assert.match((await gelenDosyayiAc("bozuk.zip", "zip", new Uint8Array([1, 2, 3]))).uyarilar[0], /Dosya açılamadı/);
});

// ───────── 4) Adaylar ve mükerrer denetimi ─────────
const revyAdaylari = async (d: DepoDurumu, id = "r1", gunOnce = 0) => hamAdaylar((await gelenDosyayiAc("ads.csv", "csv", new TextEncoder().encode(ornekRevyCsv()))).parcalar, kunye(id, "ads.csv", gunOnce), d);

test("mükerrer denetimi: aynı ilan iki portalda → tek; havuzdaki ilanın fiyatı değişmişse 'Fiyatı değişti'; eklenen kendiliğinden düşer", async () => {
  let d = durum();
  const ham = await revyAdaylari(d);
  assert.equal(ham.length, 19);
  assert.ok(ham.every((a) => a.kaynak === "REVY" && /^(i|u):/.test(a.key)), "portal ilanında anahtar ilan no / bağlantı");
  assert.deepEqual([...new Set(ham.map((a) => a.altKaynak))].sort(), ["Emlakjet", "Hepsiemlak", "sahibinden.com"]);
  let r = durumla(ham, d, new Set());
  assert.equal(r.sayim.kopya, 1, "Eski Sanayi ofisi hem sahibinden hem emlakjet'te: biri mükerrer");
  const kopya = r.adaylar.find((a) => a.durum === "TEKRAR")!;
  assert.match(kopya.tekrarNedeni!, /sahibinden\.com kaynağında da var/);
  assert.equal(r.sayim.degisti, 1);
  const degisen = r.adaylar.find((a) => a.durum === "DEGISTI")!;
  assert.deepEqual(degisen.degisim, { eski: 36_000_000, yeni: 31_500_000 }); assert.equal(degisen.mevcutId, "P8");
  assert.equal(r.sayim.bekleyen, 18); assert.equal(r.sayim.hazir + r.sayim.kontrol + r.sayim.hatali + r.sayim.degisti, 18);
  assert.equal(r.sayim.hatali, 0, "örnek dökümde şemadan dönen satır yok");
  // devren kuaför: devir bedeli; eksik sıfırlı kira: kontrol
  const kuafor = r.adaylar.find((a) => /KUAFÖR/.test(String(a.taslak.baslik)))!;
  assert.equal(kuafor.taslak.islemTipi, "DEVREN_SATILIK"); assert.equal(kuafor.ana, "TICARI"); assert.equal(kuafor.sahip, "SAHIBI");
  assert.ok(r.adaylar.find((a) => a.taslak.fiyat === 2500)!.nedenler.some((n) => /Kira çok düşük/.test(n)));
  assert.equal(r.adaylar.find((a) => /villa/i.test(String(a.taslak.baslik)))!.ana, "KONUT");
  assert.equal(r.adaylar.find((a) => /köşe parsel/.test(String(a.taslak.baslik)))!.ana, "ARSA");
  // ekle → havuzda; yeniden durumla → "zaten var"
  const hazir = r.adaylar.filter((a) => a.durum === "HAZIR");
  const e = adaylariEkle(d, hazir);
  assert.equal(e.eklenen, hazir.length); assert.equal(e.d.kayitlar.length, d.kayitlar.length + hazir.length);
  assert.ok(e.d.kayitlar.slice(0, hazir.length).every((k) => k.veri.havuz === "DIS_ILAN" && k.veri.ilanSahibiTipi === "MALIK" && k.veri.validUntil), "sahibinden ilan → dış ilan havuzu, süreli");
  assert.equal(e.yeniKisi, 0, "mülk sahibinin adı kişi kartı olarak açılmaz (KVKK)");
  d = e.d;
  r = durumla(ham, d, new Set());
  assert.equal(r.sayim.hazir, 0); assert.equal(r.sayim.zatenVar, hazir.length + 1, "+1: Emlakjet'teki kopya artık havuzdaki ofisle aynı");
  // fiyat güncelle → not düşülür, artık "zaten var"
  const f = fiyatlariGuncelle(d, r.adaylar);
  assert.equal(f.guncellenen, 1);
  const p8 = f.d.kayitlar.find((k) => k.id === "P8")!;
  assert.equal(p8.veri.fiyat, 31_500_000); assert.match(p8.notlar![0].metin, /36\.000\.000 → 31\.500\.000 TL \(sahibinden\.com\)/);
  assert.equal(durumla(ham, f.d, new Set()).sayim.degisti, 0);
});

test("atlananlar hatırlanır: ertesi günün dökümünde aynı ilan yeniden sorulmaz; iki dökümde güncel olan (yeni fiyat) kalır", async () => {
  const d = durum();
  const dun = await revyAdaylari(d, "dun", 1);
  const r1 = durumla(dun, d, new Set());
  const atlanan = new Set(r1.adaylar.filter((a) => BEKLEYEN.has(a.durum) && a.ana === "KONUT").map((a) => a.key));
  assert.ok(atlanan.size >= 3);
  // bugünün dökümü: aynı ilanlar + bir ilanın fiyatı düşmüş
  const bugunCsv = ornekRevyCsv().replace(";65000;", ";60000;");
  const bugun = hamAdaylar((await gelenDosyayiAc("ads2.csv", "csv", new TextEncoder().encode(bugunCsv))).parcalar, kunye("bugun", "ads2.csv", 0), d);
  const r2 = durumla([...bugun, ...dun], d, atlanan); // yeni dosya önce
  assert.equal(r2.sayim.atlanan, atlanan.size * 2, "atlanan konutlar iki dökümde de gösterilmez");
  assert.ok(r2.adaylar.every((a) => !(BEKLEYEN.has(a.durum) && a.ana === "KONUT")));
  assert.equal(r2.sayim.bekleyen, r1.sayim.bekleyen - atlanan.size, "ikinci döküm bekleyen sayısını artırmaz");
  const dukkan = r2.adaylar.find((a) => /Işıklar Caddesinde köşe dükkan/.test(String(a.taslak.baslik)) && BEKLEYEN.has(a.durum))!;
  assert.equal(dukkan.taslak.fiyat, 60000, "güncel dökümdeki fiyat"); assert.equal(dukkan.dosyaId, "bugun");
});

test("WhatsApp: gürültü elenir, kurallarla okunur, gönderen kişiye bağlanır; aynı sohbet hem e-postayla hem yüklemeyle gelirse tek sayılır", async () => {
  let d = durum();
  const zip = hamAdaylar((await gelenDosyayiAc("WhatsApp Sohbeti - EMLAK BORSASI.zip", "zip", waZip())).parcalar, kunye("z", "WhatsApp Sohbeti - EMLAK BORSASI.zip"), d);
  assert.equal(zip.length, 3, "3 ilan mesajı; 'Günaydın' ve medya satırı aday olmaz");
  assert.ok(zip.every((a) => a.kaynak === "WHATSAPP" && a.altKaynak === "EMLAK BORSASI" && a.key.startsWith("w:")));
  assert.ok(zip.every((a) => a.veri), "otoparklı ilan dahil hepsi şemadan geçer: " + zip.map((a) => a.hatalar.join(",")).join("|"));
  assert.deepEqual(zip.map((a) => a.tarih?.slice(0, 10)).sort(), ["2026-09-28", "2026-09-29", "2026-09-29"]);
  const posta = hamAdaylar((await gelenDosyayiAc("posta.eml", "eml", eml("WhatsApp Sohbeti - EMLAK BORSASI.zip", waZip()))).parcalar, kunye("e", "posta.eml"), d);
  const r = durumla([...posta, ...zip], d, new Set());
  assert.equal(r.sayim.bekleyen, 3); assert.equal(r.sayim.kopya, 3, "ikinci kopya sayılmaz");
  const e = adaylariEkle(d, r.adaylar.filter((a) => BEKLEYEN.has(a.durum)));
  assert.equal(e.eklenen, 3); assert.ok(e.yeniKisi >= 2);
  const selim = e.d.kisiler.find((k) => k.adSoyad === "Selim Y.");
  const numara = e.d.kisiler.find((k) => k.telefon === "+905325550101")!;
  assert.ok(selim && numara); assert.deepEqual(numara.whatsappGruplari, ["EMLAK BORSASI"], "grup kişinin kartına yazılır");
  const dukkan = e.d.kayitlar.find((k) => /Cender otel/.test(k.veri.hamMetin ?? ""))!;
  assert.equal(dukkan.veri.veriKanali, "WHATSAPP"); assert.equal(dukkan.veri.kayitGrubu, "EMLAK BORSASI"); assert.equal(dukkan.veri.kisiler?.[0]?.kisiId, numara.id);
  d = e.d;
  assert.equal(durumla([...posta, ...zip], d, new Set()).sayim.bekleyen, 0, "eklenenler havuzdaki ham metinden tanınır");
});

// ───────── 5) Ekran ─────────
test("demo deposu: örnek dosyalarla başlar; yükle (aynı içerik ikinci kez eklenmez), sil, atla / unut", async () => {
  demoGelenSifirla(); gelenDepoKur(null);
  const depo = gelenDepo();
  const l = await depo.listele();
  assert.equal(l.dosyalar.length, ornekGelenDosyalar().length); assert.ok(l.dosyalar[0].gelis >= l.dosyalar[1].gelis, "yeni önce");
  const f = new File([waZip() as BlobPart], "WhatsApp Sohbeti - YENİ.zip");
  assert.equal((await depo.yukle(f)).yeni, true); assert.equal((await depo.yukle(f)).yeni, false);
  await assert.rejects(() => depo.yukle(new File([new Uint8Array(5)], "foto.jpg")), /türü okunmuyor/);
  const yeni = (await depo.listele()).dosyalar.find((x) => /YENİ/.test(x.ad))!;
  assert.deepEqual([...(await depo.icerik(yeni)).slice(0, 2)], [0x50, 0x4b]);
  await depo.atla(["i:1", "i:2"]); await depo.atla(["i:2", "w:x"]); assert.deepEqual((await depo.atlananlar()).sort(), ["i:1", "i:2", "w:x"]);
  await depo.atlananUnut(["i:1"]); assert.deepEqual((await depo.atlananlar()).sort(), ["i:2", "w:x"]);
  await depo.atlananUnut(); assert.deepEqual(await depo.atlananlar(), []);
  await depo.sil([yeni.id]); assert.equal((await depo.listele()).dosyalar.length, ornekGelenDosyalar().length);
  await depo.sil(null); assert.equal((await depo.listele()).dosyalar.length, 0);
  demoGelenSifirla();
});

test("ekran: özet, tarih grupları, kaynak / tür süzgeci, grup 'Hazırları ekle', 'Atla' + 'Geri al', 'Tümünü temizle'", async () => {
  demoGelenSifirla(); gelenDepoKur(null); kutuSifirla();
  let d = durum();
  const mesajlar: string[] = [];
  const c: Ctx = { d, guncelle: (f) => { d = f(d); c.d = d; }, kayitKaydet: () => {}, bildir: (m) => { mesajlar.push(m); }, ornekHatalari: [], git: () => {}, geri: () => {}, geriVar: false, sample: null } as Ctx;
  await kutuYukle(d);
  const yeniden = async () => { await e.kapat(); e = await ac(React.createElement(GelenKutusu), c); };
  let e = await ac(React.createElement(GelenKutusu), c);
  const sayi = (n: number) => Number(e.qa(".gk-sayi b")[n].textContent!.replace(/\D/g, ""));
  const ilk = sayi(0);
  assert.ok(ilk >= 25, "örnek döküm + iki örnek sohbet: " + ilk);
  assert.equal(sayi(0), sayi(1) + sayi(2) + sayi(3), "bekleyen = hazır + kontrol + fiyatı değişti");
  assert.match(e.metin(), /kutu içinde mükerrer/);
  const gruplar = e.qa(".gk-grup-ad b").map((x) => x.textContent);
  assert.match(gruplar[0]!, /^Bugün · /); assert.match(gruplar[1]!, /^Dün · /);
  assert.ok(gruplar.some((g) => /^(Ağustos|Temmuz|Eylül) 2026$/.test(g!)), "eski ilanlar ay grubunda: " + gruplar.join("|"));
  assert.equal(e.qa(".gk-grup.acik").length, 2, "ilk iki grup açık, diğerleri kapalı (yığılma)");
  // süzgeç: yalnızca ticari
  await e.tikla(e.dugme(/^Ticari \(/));
  assert.match(e.metin(), /Süzgeçte \d+ kayıt/);
  assert.ok(e.qa(".gk-kart").length > 0 && !/Fener'de 3\+1 site içi daire/.test(e.metin()), "konut ilanı süzüldü");
  await e.tikla(e.dugme("Süzgeci kaldır"));
  await e.tikla(e.dugme(/^WhatsApp \(/));
  assert.ok(e.qa(".gk-kart").every((k) => /EMLAK|SANAYİ/.test(k.textContent ?? "")), "yalnızca WhatsApp grupları");
  await e.tikla(e.dugme("Süzgeci kaldır"));
  // grup: hazırları ekle
  const kayitOnce = d.kayitlar.length;
  const grupDugme = e.dugme(/^Hazırları ekle \(/)!; const n = Number(grupDugme.textContent!.match(/\((\d+)\)/)![1]);
  await e.tikla(grupDugme); await yeniden();
  assert.equal(d.kayitlar.length, kayitOnce + n); assert.equal(sayi(0), ilk - n, "eklenenler bekleyenden düştü");
  // atla + geri al
  await e.tikla(e.dugme("Atla")); assert.equal(sayi(0), ilk - n - 1); assert.match(e.metin(), /1 kayıt atlandı/);
  assert.equal((await gelenDepo().atlananlar()).length, 1, "atlanan kalıcı yazıldı");
  await e.tikla(e.dugme("Geri al")); assert.equal(sayi(0), ilk - n); assert.equal((await gelenDepo().atlananlar()).length, 0);
  // tümünü temizle
  await e.tikla(e.dugme("Tümünü temizle…"));
  assert.match(e.metin(), new RegExp(`Onay bekleyen ${ilk - n} kayıt atlanır ve 3 dosya silinir`));
  await e.tikla(e.dugme("Evet, tümünü temizle"));
  assert.match(e.metin(), /Gelen kutusu boş/); assert.equal((await gelenDepo().listele()).dosyalar.length, 0);
  assert.equal((await gelenDepo().atlananlar()).length, ilk - n, "temizlenenler hatırlanır: aynı ilan yeniden gelirse sorulmaz");
  assert.equal(d.kayitlar.length, kayitOnce + n, "havuza eklenenlere dokunulmadı");
  await e.kapat(); demoGelenSifirla(); kutuSifirla();
});

test("Ana Sayfa kartı ve bekleyeni kalmayan dosyanın kendiliğinden kaldırılması", async () => {
  demoGelenSifirla(false); gelenDepoKur(null); kutuSifirla();
  let d = durum();
  const depo = gelenDepo();
  await depo.yukle(new File([waZip() as BlobPart], "WhatsApp Sohbeti - EMLAK BORSASI.zip"));
  await kutuYukle(d);
  const c = (dd: DepoDurumu): Ctx => ({ d: dd, guncelle: () => {}, kayitKaydet: () => {}, bildir: () => {}, ornekHatalari: [], git: () => {}, geri: () => {}, geriVar: false, sample: null } as Ctx);
  let e = await ac(React.createElement(GelenKutusuKarti), c(d));
  assert.match(e.metin(), /Gelen kutusunda 3 kayıt onayınızı bekliyor/); await e.kapat();
  // hepsini ekle → kutu yeniden yüklenince dosya kalkar
  const ham = hamAdaylar((await gelenDosyayiAc("WhatsApp Sohbeti - EMLAK BORSASI.zip", "zip", waZip())).parcalar, kunye("x", "x.zip"), d);
  d = adaylariEkle(d, durumla(ham, d, new Set()).adaylar as GelenAday[]).d;
  await kutuYukle(d);
  assert.equal((await depo.listele()).dosyalar.length, 0, "bekleyeni kalmayan dosya kutudan kaldırıldı");
  e = await ac(React.createElement(GelenKutusuKarti), c(d));
  assert.equal(e.metin(), "", "bekleyen yoksa Ana Sayfa kartı görünmez"); await e.kapat();
  // açılamayan dosya kaldırılmaz, uyarısıyla görünür
  await depo.yukle(new File([zipSync({ "IMG-1.jpg": new Uint8Array(10) }) as BlobPart], "yalnizca-foto.zip"));
  await kutuYukle(d);
  assert.equal((await depo.listele()).dosyalar.length, 1);
  demoGelenSifirla(); kutuSifirla();
});

// ───────── 6) Sürüm, belgeler, kurallar ─────────
test("sürüm 3.23: günlük kaydı, belgeler, tenancy kaydı, zamanlayıcı ve e-posta işleyicisi", () => {
  assert.equal(SURUM, "3.23"); assert.equal(SURUM_GECMISI[0].surum, "3.23"); assert.match(SURUM_GECMISI[0].baslik, /Gelen kutusu/i);
  for (const f of [`docs/ANAHTAR_CRM_EK_${DOSYA_EKI}.md`, `docs/ANAHTAR_CRM_DEVIR_${DOSYA_EKI}.md`, `docs/GELEN_KUTUSU_KURULUMU_${DOSYA_EKI}.md`]) assert.ok(fs.existsSync(f), f);
  assert.ok(OFIS_MODELLERI.has("gelenDosya") && OFIS_MODELLERI.has("gelenAtlanan"), "yeni tablolar ofis süzgecinden geçer");
  const mig = fs.readFileSync("prisma/migrations/20261010100000_v323_gelen_kutusu/migration.sql", "utf8");
  assert.match(mig, /ALTER TABLE "gelen_dosya" ENABLE ROW LEVEL SECURITY/); assert.match(mig, /ALTER TABLE "gelen_atlanan" ENABLE ROW LEVEL SECURITY/);
  assert.ok(!/DROP |DELETE FROM|TRUNCATE|ALTER COLUMN/i.test(mig), "göç yalnızca ekleme yapar");
  const worker = fs.readFileSync("src/canli/worker.ts", "utf8");
  assert.match(worker, /async email\(/, "Email Routing işleyicisi"); assert.match(worker, /url\.pathname === "\/api\/gelen\/al"/, "köprü yolu oturumsuz");
  assert.match(worker, /gelenTemizlik\(prisma\)/, "günlük zamanlayıcı eski dosyaları siler");
  // Sunucu dosyayı AÇMAZ (Cloudflare ücretsiz plan: 10 ms işlemci): servis ve rotalar zip / Excel / MIME kodu içermez
  for (const f of ["src/lib/services/gelen.ts", "src/app/api/gelen/route.ts", "src/app/api/gelen/al/route.ts", "src/canli/worker.ts"])
    assert.ok(!/fflate|postal-mime|xlsxOku|dosyaOku|sohbetiAyristir|unzipSync/.test(fs.readFileSync(f, "utf8")), f + " dosyayı ayrıştırmamalı");
  const jargon = fs.readFileSync("docs/emlak_jargon.md", "utf8");
  assert.match(jargon, /`kapalı otopark` \| Otopark \| Kapalı/);
});
