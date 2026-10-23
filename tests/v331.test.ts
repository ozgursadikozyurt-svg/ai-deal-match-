/**
 * Anahtar CRM v3.41 · 23 Ekim 2026
 * v3.31 — WhatsApp sohbeti .html ve .json dışa aktarımlarından içe alma; Kişiler'de hoşgörülü arama
 *   (birkaç harf, sırasız kelimeler, Türkçe harf duyarsız, notlar / görüşme notları, telefon rakamları).
 */
import { test as nodeTest } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import fs from "node:fs";
import { type Ctx } from "../demo/ortak";
import { ornekVeriyiKur, bosBaglanti, bosGoogleBaglanti, DEMO_SAHIPLIK, type DepoDurumu, type Kisi, type Kayit } from "../demo/depo";
import { TTL_VARSAYILAN } from "../src/lib/domain/gecerlilik";
import { sahiplikNormalize } from "../src/lib/domain/sahiplik";
import { Kisiler } from "../demo/kisiler";
import { kaliciHepsiniSil } from "../demo/kalici";
import { sohbetiAyristir, onFiltre, grupAdiOf, htmlMetne } from "../src/lib/ingest/whatsapp";
import { gelenTurOf } from "../src/lib/ingest/gelen";
import { gelenDosyayiAc } from "../demo/gelen-oku";
import { aramaIndeksi, aramaSorgusu, aramaEslesir, aramaNormalize, alintiBul } from "../src/lib/arama";
import { SURUM, SURUM_GECMISI, DOSYA_EKI } from "../src/lib/surum";
import { SADECE_TEST_baglamiSabitle, VARSAYILAN_OFIS_ID, VARSAYILAN_KULLANICI_ID } from "../src/lib/kiracilik";
import { ac } from "./yardimci-arayuz";
SADECE_TEST_baglamiSabitle({ ofisId: VARSAYILAN_OFIS_ID, kullaniciId: VARSAYILAN_KULLANICI_ID, rol: "OFIS_YONETICISI", eposta: "test@anahtar.local" });

const ornek = ornekVeriyiKur();
const durum = (ek: Partial<DepoDurumu> = {}): DepoDurumu => ({ veriSurumu: "t", kayitlar: ornek.kayitlar, eslesmeNotlari: {}, testler: {}, geriBildirim: "", ayarlar: { ttl: TTL_VARSAYILAN, sahiplik: sahiplikNormalize(DEMO_SAHIPLIK) }, ogrenilen: [], adaylar: [], aktifIceAktarma: null, iceAktarmaGecmisi: [], kisiler: ornek.kisiler, islenmisMesajlar: [], dosyaIzleri: {}, baglantilar: { google: bosGoogleBaglanti(), notion: bosBaglanti() }, senkronGecmisi: [], cakismalar: [], googleBekleyen: [], favoriler: [], ...ek } as DepoDurumu);
const ctx = (d = durum()): Ctx => ({ d, guncelle: () => {}, kayitKaydet: () => {}, bildir: () => {}, ornekHatalari: [], git: () => {}, geri: () => {}, geriVar: false, sample: null } as Ctx);
const test = (ad: string, f: () => unknown | Promise<unknown>) => nodeTest(ad, async () => { kaliciHepsiniSil(); await f(); });

test("sürüm 3.31 ve ek belge", () => {
  // v3.32'den sonra en son sürüm değişti; 3.31 kaydı geçmişte durmalı
  assert.ok(SURUM >= "3.31" && !!DOSYA_EKI); assert.ok(SURUM_GECMISI.some((s) => s.surum === "3.31"));
  assert.ok(fs.existsSync("docs/ANAHTAR_CRM_EK_v3.31_15Ekim2026.md"));
});

// ───── WhatsApp HTML ─────
const msj = (tur: string, yon: string, ic: string) => `\n      <div class="message ${yon}" data-type="${tur}">\n${ic}\n      </div>\n`;
const HTML = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>EMLAKÇILAR GRUBU ANTALYA  - Sohbet Dışa Aktarımı</title><style>.message{}</style></head><body>
<h1>EMLAKÇILAR GRUBU ANTALYA </h1><div class="meta"><div>Toplam Mesaj: 7</div></div><div class="messages">`
  + msj("chat", "received", `<div class="author">+905302900023</div>\n<div class="body">🌺SATILIK 🌺ACİL\nKonyaaltı Liman mahallesi\nGeniş 110 m2 2+1 &amp; havuzlu</div>\n<div class="timestamp">15.09.2026 15:26:50</div>`)
  + msj("image", "received", `<div class="author">+905302900023</div>\n<div style="color:#999">Medya dahil edilmedi<div class="media-meta">900×1600 • 274 KB</div></div>\n<div class="timestamp">15.09.2026 15:26:51</div>`)
  + msj("image", "received", `<div class="caption">Satılık\nKepez Ekpa site\n2+1 90m2\n5 400 000</div>\n<div class="timestamp">18.09.2026 10:18:02</div>`)
  + msj("chat", "received", `<div class="author">Canan Gören</div>\n<div class="quoted"><div class="author">+905302900023</div><div style="font-size:0.9em">🌺SATILIK 🌺ACİL\nKonyaaltı Liman</div></div>\n<div class="body">Fiyatı</div>\n<div class="timestamp">16.09.2026 17:40:04</div>`)
  + msj("revoked", "received", `<div class="author">expertinvest</div>\n<div class="timestamp">17.09.2026 16:39:45</div>`)
  + msj("call_log", "received", `<div class="author">X</div>\n<div class="timestamp">17.09.2026 16:40:00</div>`)
  + msj("chat", "sent", `<div class="body"><a href="https://ornek.com/ilan/1">https://ornek.com/ilan/1</a>\n*ACİL SATILIK* Altıntaş 1+1 60 M2 dükkan 320 M2 kiracılı 33 MİLYON TL</div>\n<div class="timestamp">21.09.2026 16:51:42</div>`)
  + msj("location", "received", `<div class="author">+905013578661</div>\n<div class="location">📍 <a href="https://www.google.com/maps?q=38.32,31.15">/9j/4AAQSkZJRg</a></div>\n<div class="timestamp">11.10.2026 13:26:07</div>`)
  + `</div><script>(function(){ /* lazy */ })();</script></body></html>`;

test("WhatsApp HTML: grup adı başlıktan, yazar / metin / açıklama / zaman okunur; sistem mesajı atlanır; alıntı yanıta karışmaz", () => {
  const m = sohbetiAyristir(HTML, "0361943b-EMLAK_ILAR_GRUBU.html");
  assert.equal(m.length, 7, "call_log atlanır");
  assert.ok(m.every((x) => x.grup === "EMLAKÇILAR GRUBU ANTALYA"));
  assert.equal(m[0].gonderen, "+905302900023"); assert.equal(m[0].telefon, "+905302900023");
  assert.match(m[0].metin, /Geniş 110 m2 2\+1 & havuzlu/, "&amp; çözülür, satırlar korunur");
  assert.equal(new Date(m[0].tarih!).getDate(), 15); assert.equal(new Date(m[0].tarih!).getMinutes(), 26);
  assert.equal(m[1].metin, "<Medya dahil edilmedi>");
  assert.equal(m[2].gonderen, "+905302900023", "yazarı yazılmayan art arda mesaj önceki yazara bağlanır"); assert.match(m[2].metin, /Kepez Ekpa site/);
  assert.equal(m[3].gonderen, "Canan Gören"); assert.equal(m[3].metin, "Fiyatı", "alıntılanan mesaj yanıtın metni değildir");
  assert.equal(m[4].metin, "Bu mesaj silindi");
  assert.equal(m[5].gonderen, "Ben"); assert.match(m[5].metin, /^https:\/\/ornek\.com\/ilan\/1\n\*ACİL SATILIK\*/);
  assert.equal(m[6].metin, "📍 Konum: https://www.google.com/maps?q=38.32,31.15", "base64 küçük resim alınmaz");
});
test("WhatsApp HTML: ön filtre medya / silinen / kısa mesajları ayıklar, ilanlar aday kalır", () => {
  const r = onFiltre(sohbetiAyristir(HTML, "x.html"));
  const aday = r.mesajlar.filter((x) => x.durum === "ADAY").map((x) => x.metin.slice(0, 12));
  assert.equal(aday.length, 3, JSON.stringify(aday));
  assert.equal(r.gruplar[0].grup, "EMLAKÇILAR GRUBU ANTALYA");
  assert.equal(r.mesajlar.find((x) => x.metin.startsWith("<Medya"))!.neden, "Medya");
  assert.equal(r.mesajlar.find((x) => x.metin === "Bu mesaj silindi")!.neden, "Silinen mesaj");
});
test("Başka biçimli HTML: düz metne çevrilip satır satır (.txt gibi) okunur", () => {
  const m = sohbetiAyristir("<html><body><p>14.09.2026 09:15 - Havva: Kiralık depo 500 m2 Kepez</p><p>14.09.2026 09:20 - Ali: Satılık 3+1 daire</p></body></html>", "sohbet.html");
  assert.equal(m.length, 2); assert.equal(m[0].gonderen, "Havva"); assert.match(m[0].metin, /Kiralık depo/);
  assert.equal(htmlMetne("a&lt;b&#39;c&#x41;<br>d"), "a<b'cA\nd");
});

// ───── WhatsApp JSON ─────
test("WhatsApp JSON: { chat.name, messages[] } — esnek alan adları, saniye / gg.aa.yyyy zaman, @c.us numarası, fromMe → Ben", () => {
  const j = JSON.stringify({ chat: { name: "SANAYİ EMLAK" }, messages: [
    { author: "905335923008@c.us", timestamp: 1757946938, body: "Satılık 3+1 daire Konyaaltı 150 m2 8 milyon" },
    { fromMe: true, time: "15.09.2026 15:26:50", type: "image", caption: "Kiralık depo 500 m2" },
    { type: "revoked", sender: { name: "Veli" }, date: "2026-09-16T10:00:00" },
    { type: "call_log" }, { type: "image" },
  ] });
  const m = sohbetiAyristir(j, "sohbet.json");
  assert.equal(m.length, 4);
  assert.ok(m.every((x) => x.grup === "SANAYİ EMLAK"));
  assert.equal(m[0].gonderen, "+905335923008"); assert.equal(m[0].telefon, "+905335923008"); assert.equal(m[0].tarih, new Date(1757946938000).toISOString());
  assert.equal(m[1].gonderen, "Ben"); assert.equal(m[1].metin, "Kiralık depo 500 m2"); assert.equal(new Date(m[1].tarih!).getHours(), 15);
  assert.equal(m[2].gonderen, "Veli"); assert.equal(m[2].metin, "Bu mesaj silindi");
  assert.equal(m[3].metin, "<Medya dahil edilmedi>");
});
test("WhatsApp JSON: kök dizi ve Telegram tarzı parçalı metin; JSON olmayan '[' ile başlayan metin .txt gibi okunur", () => {
  const m = sohbetiAyristir(JSON.stringify([{ from: "Ayşe", date: "2026-10-01T09:00:00", text: ["Kiralık ", { type: "bold", text: "dükkan" }, " 120 m2"] }]), "a.json", "Grup");
  assert.equal(m.length, 1); assert.equal(m[0].metin, "Kiralık dükkan 120 m2"); assert.equal(m[0].grup, "Grup");
  const t = sohbetiAyristir("[14.09.2026 09:15:23] Havva Erçelik: Satılık arsa 2 dönüm", "_chat.txt", "G");
  assert.equal(t.length, 1); assert.equal(t[0].gonderen, "Havva Erçelik");
});
test("Dosya türü: .html / .htm / .json gelen kutusunda metin olarak kabul edilir; grup adı uzantısız", () => {
  for (const ad of ["a.html", "b.HTM", "c.json"]) assert.equal(gelenTurOf(ad), "txt", ad);
  assert.equal(gelenTurOf("foto.jpg"), null);
  assert.equal(grupAdiOf("WhatsApp Sohbeti - EMLAK BORSASI.html"), "EMLAK BORSASI");
  assert.equal(grupAdiOf("WhatsApp Chat - SANAYI.json"), "SANAYI");
});
test("Gelen kutusu: .html dosyası SOHBET parçası olarak açılır (grup adı dosya başlığından)", async () => {
  const r = await gelenDosyayiAc("grup.html", "txt", new TextEncoder().encode(HTML));
  assert.equal(r.parcalar.length, 1); assert.equal(r.parcalar[0].tur, "SOHBET");
  const p = r.parcalar[0] as any;
  assert.equal(sohbetiAyristir(p.icerik, p.dosya, p.grup)[0].grup, "EMLAKÇILAR GRUBU ANTALYA");
});
test("Veri girişi WhatsApp ekranı .html / .json dosyalarını kabul ediyor (düğme metni ve süzgeç)", () => {
  const s = fs.readFileSync("demo/ice-aktarma.tsx", "utf8");
  assert.match(s, /Dosya seç \(\.txt \/ \.md \/ \.html \/ \.json \/ \.zip\)/);
  assert.match(s, /\/\\\.\(txt\|md\|zip\|html\?\|json\)\$\/i\.test\(x\.name\)/);
});

// ───── Arama ─────
test("Arama: birkaç harf, sırasız kelimeler, Türkçe harf duyarsız; telefon boşluk / +90 / 0 farkı yok; sayı notta da aranır", () => {
  const ix = aramaIndeksi(["Özgür Şahin Yılmaz", "Kırdar İnşaat", "Kepez sanayide 2000 m2 depo arıyor; eşi Ayşe"], ["+905324123456"]);
  const e = (q: string) => aramaEslesir(ix, aramaSorgusu(q));
  for (const q of ["ozg", "şah yıl", "YIL", "kirdar", "İNŞ", "insaat", "depo kepez", "kepez özgür", "ayse", "532", "0532 412", "+90 532 412 34 56", "05324123456", "412 34", "2000", ""]) assert.ok(e(q), q);
  for (const q of ["xyz", "özgür 999", "0533"]) assert.ok(!e(q), q);
  assert.equal(aramaNormalize("İSTANBUL Işık ĞÜŞÇÖ"), "istanbul isik gusco");
  assert.equal(alintiBul("Müşteri Kepez sanayide 2000 m2 depo arıyor, bütçe 80 bin TL, acil dönüş bekliyor", aramaSorgusu("depo"), 40), "…2000 m2 depo arıyor, bütçe 80 bin TL,…");
});

const kisi = (id: string, adSoyad: string, ek: Partial<Kisi> = {}): Kisi => ({ ...ornek.kisiler[0], id, adSoyad, telefon: null, ikincilTelefon: null, email: null, sirket: null, referans: null, notlar: null, roller: [], whatsappGruplari: [], googleResourceName: null, ...ek } as Kisi);
const rehber = [
  kisi("A1", "Mehmet Öztürk", { telefon: "+905321112233", notlar: "Kepez'de 2000 m2 depo arıyor, bütçe 80 bin" }),
  kisi("A2", "Mehmet Çelik", { telefon: "+905339998877", sirket: "Çelik Yapı" }),
  kisi("A3", "Ayşe Kılıç", { telefon: "+905441234567", whatsappGruplari: ["SANAYİ EMLAK"] }),
  kisi("A4", "Hasan Şen", { telefon: "+905557654321" }),
];
const gorusmeliKayit = { ...ornek.kayitlar[0], id: "KY-T", notlar: [{ id: "n1", tarih: "2026-10-10T10:00:00.000Z", tur: "GORUSME", metin: "Otel yatırımı için Belek'te arsa bakıyor", kisiId: "A4" }] } as Kayit;

test("Kişiler ekranı: 'meh dep' notunda depo geçen Mehmet'i bulur ve kartta 📝 alıntı gösterir", async () => {
  const a = await ac(React.createElement(Kisiler), ctx(durum({ kisiler: rehber, kayitlar: [gorusmeliKayit] })));
  const kutu = a.q('input[type="search"]');
  await a.yaz(kutu, "meh dep");
  assert.equal(a.qa(".kisi-kart").length, 1); assert.match(a.metin(), /Mehmet Öztürk/);
  assert.match(a.q(".kk-alinti")?.textContent ?? "", /📝.*depo arıyor/);
  await a.yaz(kutu, "ozturk"); assert.match(a.metin(), /Mehmet Öztürk/); assert.equal(a.qa(".kisi-kart").length, 1);
  await a.yaz(kutu, "celik"); assert.match(a.metin(), /Mehmet Çelik/); assert.equal(a.qa(".kisi-kart").length, 1);
  await a.yaz(kutu, "me"); assert.equal(a.qa(".kisi-kart").length, 2, "iki harf yeter");
  await a.kapat();
});
test("Kişiler ekranı: telefon parçası boşluklu / 0'lı yazılabilir; WhatsApp grubu ve görüşme notunda arama", async () => {
  const a = await ac(React.createElement(Kisiler), ctx(durum({ kisiler: rehber, kayitlar: [gorusmeliKayit] })));
  const kutu = a.q('input[type="search"]');
  await a.yaz(kutu, "0544 123"); assert.equal(a.qa(".kisi-kart").length, 1); assert.match(a.metin(), /Ayşe Kılıç/);
  await a.yaz(kutu, "54321"); assert.equal(a.qa(".kisi-kart").length, 1); assert.match(a.metin(), /Hasan Şen/);
  await a.yaz(kutu, "sanayi"); assert.match(a.metin(), /Ayşe Kılıç/); assert.equal(a.qa(".kisi-kart").length, 1);
  await a.yaz(kutu, "belek otel"); assert.equal(a.qa(".kisi-kart").length, 1); assert.match(a.metin(), /Hasan Şen/);
  assert.match(a.q(".kk-alinti")?.textContent ?? "", /Belek/);
  await a.yaz(kutu, "zzz"); assert.equal(a.qa(".kisi-kart").length, 0); assert.match(a.metin(), /Eşleşen kişi yok/);
  await a.kapat();
});
