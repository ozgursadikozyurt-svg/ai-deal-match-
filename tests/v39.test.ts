/**
 * Anahtar CRM v3.13 · 3 Ekim 2026
 * v3.9 — akıllı metin yorumlayıcı (önce anla, sonra ayır), çekirdek düzeltmeleri ve yeni demo ekranları.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { yorumla, konumBul, slugMetni, portalSayfasiMi, baglantilariAc, aiYorumIstemi } from "../src/lib/ai/yorumlayici";
import { hizliAyristir } from "../src/lib/ai/hizli-ayristirici";
import { sohbetiAyristir, onFiltre } from "../src/lib/ingest/whatsapp";
import { GEMINI_RESPONSE_SCHEMA, GEMINI_SISTEM_TALIMATI } from "../src/lib/ai/gemini-cikti-semasi";
import { MARKA } from "../src/lib/marka";
import { SURUM, SURUM_GECMISI } from "../src/lib/surum";
import { INDEKS, coz } from "../demo/lokasyon";
import { ornekVeriyiKur, TTL_VARSAYILAN, bosBaglanti, type DepoDurumu } from "../demo/depo";
import { C, type Ctx } from "../demo/ortak";
import { AkilliKutu } from "../demo/ai-kutusu";
import { VeriGirisi } from "../demo/ice-aktarma";
import { TalepTercihleri } from "../demo/kartlar";
import { Logo } from "../demo/kabuk";
import { Eslesmeler, AnaSayfa } from "../demo/app";
import { ORNEK_PORTAL_SAYFASI, ORNEK_SOHBET } from "../demo/ornek-metinler";
import { ORNEK_TOPLANTI_NOTU } from "../demo/ornek-dosyalar";

const { kayitlar, kisiler } = ornekVeriyiKur();
const durum: DepoDurumu = { veriSurumu: "t", kayitlar, eslesmeNotlari: {}, testler: {}, geriBildirim: "", ayarlar: { ttl: TTL_VARSAYILAN }, ogrenilen: [], adaylar: [], aktifIceAktarma: null, iceAktarmaGecmisi: [], kisiler, islenmisMesajlar: [], dosyaIzleri: {}, baglantilar: { google: bosBaglanti(), notion: bosBaglanti() }, senkronGecmisi: [], cakismalar: [] } as any;
const ciz = (el: React.ReactElement) => renderToStaticMarkup(React.createElement(C.Provider, { value: { d: durum, guncelle: () => {}, kayitKaydet: () => {}, bildir: () => {}, ornekHatalari: [], git: () => {}, sample: null } as Ctx }, el));

test("portal ilan sayfası: etiket–değer satırları tek portföy olur (v3.8'de 15+ kayda bölünüyordu)", () => {
  assert.ok(portalSayfasiMi(ORNEK_PORTAL_SAYFASI));
  const y = yorumla(ORNEK_PORTAL_SAYFASI, INDEKS);
  assert.equal(y.tur, "PORTAL_ILANI");
  assert.equal(y.parcalar.length, 1);
  const p = y.parcalar[0];
  assert.equal(p.h.tip, "PORTFOY"); assert.equal(p.h.mulkTipi, "DEPO_ANTREPO"); assert.equal(p.h.islemTipi, "KIRALIK");
  assert.equal(p.h.fiyat, 35000); assert.equal(p.h.fiyatPeriyodu, "AYLIK"); assert.equal(p.h.m2, 176);
  assert.equal(p.h.ilanSahibiTipi, "MALIK"); assert.equal(p.h.ilanNo, "1000000001");
  assert.equal((p.h.ozellik as any).netYukseklikM, 6); assert.equal((p.h.ozellik as any).binaYasi, 1);
  assert.equal((p.h.ozellik as any).kiraOdemeSekli, "YILLIK_PESIN"); assert.equal((p.h.ozellik as any).depozitoAy, 1);
  assert.match(p.uyarilar.join(" "), /176 m².*135 m²/);
  assert.ok(p.notlar.some((n) => /Teminat senedi/.test(n)));
  const c = coz(p.konumlar);
  assert.equal(c.lokasyonlar[0].etiket, "Muratpaşa / Yeşilova"); assert.equal(c.cozulemeyen.length, 0);
});

test("markdown bağlantılı portal kopyası da aynı sonucu verir; ilan adresi yakalanır", () => {
  const md = ORNEK_PORTAL_SAYFASI.replace("Antalya / Muratpaşa / Yeşilova Mh.", "[Antalya](https://www.sahibinden.com/kiralik/antalya) /[ Muratpaşa](https://www.sahibinden.com/kiralik/antalya-muratpasa) /[ Yeşilova Mh.](https://www.sahibinden.com/kiralik/x)")
    .replace("İlan Detayları", "[İlan Detayları](https://www.sahibinden.com/ilan/emlak-is-yeri-kiralik-depo-1000000001/detay#classified-detail)");
  assert.equal(baglantilariAc(md).adresler.length, 4);
  const y = yorumla(md, INDEKS);
  assert.equal(y.parcalar.length, 1);
  assert.equal(y.parcalar[0].h.portalUrl, "https://www.sahibinden.com/ilan/emlak-is-yeri-kiralik-depo-1000000001/detay");
});

test("WhatsApp sohbet dökümü: çok satırlı mesaj tek kayıt, gürültü atlanır, '2 ayrı talep' iki kayıt, hariç bölge çıkarılır", () => {
  const y = yorumla(ORNEK_SOHBET, INDEKS);
  assert.equal(y.tur, "WHATSAPP_SOHBETI");
  assert.equal(y.parcalar.length, 8);
  assert.deepEqual(y.atlanan.map((a) => a.neden).sort(), ["Silinen mesaj", "Çok kısa"].sort());
  const ikili = y.parcalar.filter((p) => p.altTur === "COKLU_TALEP");
  assert.equal(ikili.length, 2); assert.equal(ikili[0].h.maxFiyat, 45000);
  const haric = y.parcalar.find((p) => p.haricKonumlar.length)!;
  assert.ok(!haric.konumlar.join(" ").toLocaleLowerCase("tr").includes("kepez"));
  const madde = y.parcalar.find((p) => /Barınaklar/.test(p.metin))!;
  assert.equal(madde.h.mulkTipi, "DAIRE"); assert.equal(madde.h.tip, "TALEP"); assert.equal(madde.h.maxFiyat, 80000);
  assert.ok(madde.konumlar.some((k) => /Çağlayan/.test(k)));
  const depo = y.parcalar.find((p) => /Döşemealtı/.test(p.metin))!;
  assert.equal(depo.h.mulkTipi, "DEPO_ANTREPO"); assert.equal(depo.kisiAdi, "Reyhan Ö. (örnek)");
  const emlakci = y.parcalar.find((p) => p.kisiAdi === "Tolga K. (örnek)")!;
  assert.equal(emlakci.h.ilanSahibiTipi, "EMLAKCI");
  const link = y.parcalar.find((p) => p.altTur === "BAGLANTI")!;
  assert.equal(link.h.odaSayisi, "4+1"); assert.equal(link.h.islemTipi, "KIRALIK"); assert.equal(link.h.m2, 250);
});

test("toplu liste, tek kayıt, kişi ve soru ayrımı", () => {
  const t = yorumla(ORNEK_TOPLANTI_NOTU, INDEKS);
  assert.equal(t.tur, "TOPLU_LISTE"); assert.equal(t.parcalar.length, 7); assert.equal(t.tipIpucu, "TALEP");
  const tek = yorumla("🏠 KİRALIK TALEP\n📍 Barınaklar – Fener – Çağlayan\n🔹 2+1 daire\n🔹 Önceliğimiz eşyalı\n🔹 Bütçe: 60.000 – 80.000 TL", INDEKS);
  assert.equal(tek.tur, "TEK_KAYIT"); assert.equal(tek.parcalar.length, 1);
  const plan = yorumla("TALEP : ALTINTAŞ 2+1 ARA KAT DAİRE ARAYIŞIM VARDIR BÜTÇE 5.5 MİLYON\n\nÖDEME PLANI\n2 MİLYON NAKİT\n1.9 MİLYON ARABA TAKASI\nKALAN RAKAM 3-4 AY TAKSİT", INDEKS);
  assert.equal(plan.parcalar.length, 1); assert.equal(plan.parcalar[0].h.maxFiyat, 5500000); assert.match(plan.parcalar[0].notlar.join(" "), /Ödeme planı/);
  const kisi = yorumla("Mert Aksoy 0555 000 07 01", INDEKS);
  assert.equal(kisi.tur, "KISI"); assert.deepEqual(kisi.kisiler, [{ adSoyad: "Mert Aksoy", telefon: "+905550000701", sirket: null }]);
  assert.equal(yorumla("Kepez'de 1000 m² üstü kiralık depo var mı?", INDEKS).tur, "SORU");
  const meslektas = yorumla("Deniz mahallesi, Bahçelievler veya Varlık mahallesinde 1+1 veya 2+1 sıfır daireniz var mı? Bütçe 5.5 -6 Milyon arası.", INDEKS);
  assert.equal(meslektas.tur, "TEK_KAYIT"); assert.equal(meslektas.parcalar[0].h.tip, "TALEP");
});

test("ilan bağlantısı: adresten tür, işlem, oda, bölge okunur", () => {
  const s = slugMetni("https://www.sahibinden.com/ilan/emlak-konut-satilik-konyaalti-arapsuyu-ulucta-4-plus1-230-m2-kombili-dublex-1000000003/detay")!;
  assert.equal(s.kategori, "KONUT"); assert.equal(s.ilanNo, "1000000003"); assert.match(s.metin, /4\+1 230 m2/);
  const y = yorumla("https://www.sahibinden.com/ilan/emlak-arsa-satilik-antalya-aksu-da-degerli-konumda-satilik-tarla-1000000004/detay", INDEKS);
  assert.equal(y.tur, "BAGLANTI"); assert.equal(y.parcalar[0].h.mulkTipi, "TARLA"); assert.ok(y.guven < 0.7);
  assert.match(y.parcalar[0].uyarilar.join(" "), /fiyat yok/);
});

test("konumBul: virgüllü liste ayrı ayrı okunur; iki ilçede olan mahalle satırdaki ilçeye bağlanır", () => {
  assert.deepEqual(konumBul("Güzeloba, Çağlayan, Fener, Şirinyalı", INDEKS), ["Güzeloba", "Fener", "Şirinyalı", "Muratpaşa Çağlayan"]);
  assert.equal(coz(["Muratpaşa Çağlayan"]).lokasyonlar[0].etiket, "Muratpaşa / Çağlayan");
});

test("çekirdek düzeltmeleri: 'Barınaklar' kafe/bar değildir; '<görsel dahil edilmedi>' gürültüdür", () => {
  assert.notEqual(hizliAyristir("Barınaklar 2+1 kiralık daire 60.000 TL").mulkTipi, "CAFE_BAR");
  assert.equal(hizliAyristir("Lara'da devren kiralık kafe 150 m²").mulkTipi, "CAFE_BAR");
  const m = sohbetiAyristir("[9/30/26, 9:13:28 AM] Ali: <görsel dahil edilmedi>\n[9/30/26, 9:14:00 AM] Ali: Lara 3+1 satılık daire 8.000.000 TL", "x.txt");
  const f = onFiltre(m, {});
  assert.equal(f.mesajlar.find((x) => /görsel/.test(x.metin))!.neden, "Medya");
});

test("yapay zekâ istemi: tür kararı, notlar ve hariç konum kuralları yer alır", () => {
  const y = yorumla(ORNEK_PORTAL_SAYFASI, INDEKS);
  const i = aiYorumIstemi(ORNEK_PORTAL_SAYFASI, y, GEMINI_SISTEM_TALIMATI, GEMINI_RESPONSE_SCHEMA);
  for (const s of ["PORTAL_ILANI", "haricKonumlar", "notlar", "tür=PORTAL_ILANI", "İlan No"]) assert.ok(i.includes(s), s);
});

test("ad ve sürüm günlüğü: Anahtar CRM, v3.9 kaydı duruyor", () => {
  assert.equal(MARKA.ad, "Anahtar CRM"); assert.ok(Number(SURUM.split(".")[1]) >= 9); assert.ok(SURUM_GECMISI.some((x) => x.surum === "3.9"));
  assert.match(ciz(React.createElement(Logo)), /Anahtar<span class="logo-vurgu">CRM<\/span>/);
});

test("ekranlar: akıllı kutu, veri girişi (3 sekme), yeni eşleşme kartı, eşleştirme tercihleri; kaldırılanlar yok", () => {
  const ana = ciz(React.createElement(AnaSayfa));
  for (const s of ["Anahtar AI", "Portal ilan sayfası", "WhatsApp sohbeti", 'class="es2 ']) assert.ok(ana.includes(s), s);
  for (const s of ["Bu sürümde test edin", "kayıt önizlemesi", "Anakey"]) assert.ok(!ana.includes(s), s);
  assert.match(ciz(React.createElement(AkilliKutu, { gomulu: true })), /ai-metin-veri/);
  const v = ciz(React.createElement(VeriGirisi, {}));
  assert.ok(!v.includes("Toplu mesaj / toplantı notu") && !v.includes("Tek mesaj yapıştır"));
  const e = ciz(React.createElement(Eslesmeler));
  assert.ok(e.includes("es2-taraf t") && e.includes("es2-taraf p") && !e.includes("Eşleştirme motoru v2"));
  const talep = kayitlar.find((k) => k.veri.tip === "TALEP")!;
  const t = ciz(React.createElement(TalepTercihleri, { k: talep }));
  for (const s of ["Eşleştirme tercihleri", "Bütçeyi biraz aşan da gösterilsin", "Komşu bölgeler de olur"]) assert.ok(t.includes(s), s);
  for (const s of ["Talep DNA", "varsayılan", "±%"]) assert.ok(!t.includes(s), s);
});