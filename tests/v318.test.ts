/**
 * Anahtar CRM v3.18 · 6 Ekim 2026
 * v3.18 — genişletilmiş jargon, portal bağlantısından okuma, WhatsApp gürültü temizliği, .md sohbet dosyası,
 * dosya içe aktarma ekranında işlem filtresi ve satır işlemleri.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { hizliAyristir } from "../src/lib/ai/hizli-ayristirici";
import { baglantidanOku, whatsappGurultusuTemizle, cepheYonleriOku, JARGON_ALANLI, JARGON_NOTLUK } from "../src/lib/ai/jargon";
import { sohbetiAyristir, onFiltre } from "../src/lib/ingest/whatsapp";
import { C, type Ctx } from "../demo/ortak";
import { ornekVeriyiKur, bosBaglanti, bosGoogleBaglanti, type DepoDurumu } from "../demo/depo";
import { DosyaAktarma } from "../demo/toplu-giris";

test("yeni jargon kuralları: eşya, güvenlik, ısınma, balkon, imar, cephe", () => {
  const h = hizliAyristir("Konyaaltı 3+1 satılık daire 8 MTL eşyalı güvenlikli site doğalgaz kombi balkonlu güney cepheli");
  assert.equal(h.ozellik.esyaDurumu, "ESYALI");
  assert.equal(h.ozellik.guvenlik, true);
  assert.equal(h.ozellik.isinmaTipi, "DOGALGAZ_KOMBI");
  assert.equal(h.ozellik.balkon, true);
  assert.deepEqual(h.ozellik.cepheYonleri, ["GUNEY"]);
  assert.equal(hizliAyristir("eşyasız kiralık daire 25 bin").ozellik.esyaDurumu, "ESYASIZ");
  assert.equal(hizliAyristir("satılık tarla imarlı 3 MTL").ozellik.imarDurumu, "KONUT");
  assert.deepEqual(cepheYonleriOku("doğu batı cepheli daire"), ["DOGU", "BATI"]);
  assert.deepEqual(cepheYonleriOku("güney tarafında okul var"), [], "cephe kelimesi yoksa yön okunmaz");
  const n = hizliAyristir("Satılık daire 5 MTL tapusu sorunsuz, yatırımlık, kira getirisi var, tramvaya yakın");
  assert.equal(n.jargonNotlari.length, 3, n.jargonNotlari.join("|"));
  assert.ok(JARGON_ALANLI.length >= 22 && JARGON_NOTLUK.length >= 20);
});

test("portal bağlantısı: adresten mülk tipi, işlem ve oda sayısı okunur", () => {
  const b = baglantidanOku("https://www.sahibinden.com/ilan/emlak-konut-satilik-arapsuyu-gursu-da-4-plus1-bahcedubleksi-1317953785/detay");
  assert.deepEqual(b, { tip: "PORTFOY", islemTipi: "SATILIK", mulkTipi: "DAIRE", odaSayisi: "4+1", ilanNo: "1317953785" });
  const k = baglantidanOku("https://www.sahibinden.com/ilan/emlak-is-yeri-kiralik-eski-lara-yolunda-deniz-manzarali-4-plus1-dubleks-1308892956/detay");
  assert.equal(k.islemTipi, "KIRALIK"); assert.equal(k.mulkTipi, "DUKKAN_MAGAZA");
  assert.deepEqual(baglantidanOku("https://ornek.com/bir-sayfa"), {}, "portal dışı bağlantı okunmaz");
  // yalnızca bağlantıdan ibaret mesaj da artık çözülür
  const h = hizliAyristir("https://www.sahibinden.com/ilan/emlak-konut-satilik-haci-gebizli-2de-yenilenmis-3-plus1-1295468259/detay");
  assert.equal(h.tip, "PORTFOY"); assert.equal(h.mulkTipi, "DAIRE"); assert.equal(h.islemTipi, "SATILIK"); assert.equal(h.odaSayisi, "3+1");
});

test("WhatsApp gürültüsü metinden ayıklanır", () => {
  const t = whatsappGurultusuTemizle("[Görsel] Altıntaşta site içinde 2+1 iskanlı 4500.000\n__@fufunda kişisinin güvenlik kodu değişti. Daha fazla bilgi edinmek için dokunun.__\n> _Göksel: Görsel_");
  assert.ok(!/Görsel|güvenlik kodu/.test(t), t);
  assert.match(t, /Altıntaşta site içinde 2\+1 iskanlı/);
});

test(".md biçimli WhatsApp dışa aktarımı okunur (tarih başlığı + [saat] **gönderen:**)", () => {
  const md = ["# WhatsApp Sohbetini Dışa Aktarma: TEST GRUBU", "", "## 1 Haziran 2026", "",
    "[9:42] **@realtyramazan:** TALEP: FEVZİ ÇAKMAK 3+1 KATTA BÜTÇE 4 MİLYON TL",
    "[10:10] **Rahim Ateş Gayrimenkul:** SATILIK ARSA 4250 M2 BUCAK", "2.000.000 TL",
    "", "## 2 Haziran 2026", "", "[11:00] **Veli Emlak:** Kiralık dükkan Lara 25 bin"].join("\n");
  const m = sohbetiAyristir(md, "test_chat.md");
  assert.equal(m.length, 3);
  assert.equal(m[0].gonderen, "realtyramazan");
  assert.match(String(m[0].tarih), /^2026-06-01/);
  assert.match(m[1].metin, /4250 M2 BUCAK\n2\.000\.000 TL/, "alt satırlar aynı mesaja eklenir");
  assert.match(String(m[2].tarih), /^2026-06-02/, "ikinci gün başlığı");
  const f = onFiltre(m, { sonGun: null });
  assert.ok(f.mesajlar.filter((x) => x.durum === "ADAY").length >= 2);
});

test("gerçek .md dışa aktarımı: mesajlar, tarihler ve aday ayrımı", { skip: !fs.existsSync("/mnt/user-data/uploads/1791279292288_chat.md") }, () => {
  const m = sohbetiAyristir(fs.readFileSync("/mnt/user-data/uploads/1791279292288_chat.md", "utf8"), "1791279292288_chat.md");
  assert.ok(m.length > 2000, `${m.length} mesaj`);
  assert.ok(m.every((x) => x.tarih && x.gonderen));
  const f = onFiltre(m, { sonGun: null });
  assert.ok(f.mesajlar.filter((x) => x.durum === "ADAY").length > 500);
});

test("dosya içe aktarma ekranı: işlem filtresi ve satır işlemleri (Düzenle / Ekle / Atla / yapay zekâ)", () => {
  const d: DepoDurumu = { ...(ornekVeriyiKur() as any), veriSurumu: "t", testler: {}, geriBildirim: "", ayarlar: { ttl: {} as any }, ogrenilen: [], adaylar: [], aktifIceAktarma: null, iceAktarmaGecmisi: [], islenmisMesajlar: [], dosyaIzleri: {}, baglantilar: { google: bosGoogleBaglanti(), notion: bosBaglanti() }, senkronGecmisi: [], cakismalar: [], eslesmeNotlari: {} } as DepoDurumu;
  const h = renderToStaticMarkup(React.createElement(C.Provider, { value: { d, guncelle: () => {}, kayitKaydet: () => {}, bildir: () => {}, ornekHatalari: [], git: () => {}, geri: () => {}, geriVar: false, sample: null } as Ctx }, React.createElement(DosyaAktarma)));
  assert.match(h, /Excel, CSV, TXT ya da vCard/);
});
