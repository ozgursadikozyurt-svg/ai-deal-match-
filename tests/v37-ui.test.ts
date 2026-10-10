/**
 * Anahtar CRM v3.23 · 10 Ekim 2026
 * v3.7 — demo ekranlarının sunucu tarafında hatasız çizildiğini doğrular (tarayıcısız duman testi):
 * listeler + sıralama düğmesi, kayıt detayı + görüşme notları + ara/WhatsApp, kişiler, bağlantılar, toplu veri girişi.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { C, type Ctx } from "../demo/ortak";
import { ornekVeriyiKur, bosBaglanti, bosGoogleBaglanti, type DepoDurumu } from "../demo/depo";
import { TTL_VARSAYILAN } from "../src/lib/domain/gecerlilik";
import { Liste, Detay, Eslesmeler } from "../demo/app";
import { Kisiler, KisiKarti } from "../demo/kisiler";
import { Baglantilar } from "../demo/baglantilar";
import { VeriGirisi } from "../demo/ice-aktarma";
import { TopluMesaj } from "../demo/toplu-giris";
import { ORNEK_TOPLANTI_NOTU } from "../demo/ornek-dosyalar";
import { SADECE_TEST_baglamiSabitle, VARSAYILAN_OFIS_ID, VARSAYILAN_KULLANICI_ID } from "../src/lib/kiracilik";
// v3.20 — çok ofisli: testler varsayılan ofisin bağlamında çalışır (göçte açılan Özyurtlar Gayrimenkul)
SADECE_TEST_baglamiSabitle({ ofisId: VARSAYILAN_OFIS_ID, kullaniciId: VARSAYILAN_KULLANICI_ID, rol: "OFIS_YONETICISI", eposta: "test@anahtar.local" });


const { kayitlar, kisiler } = ornekVeriyiKur();
const d: DepoDurumu = { veriSurumu: "t", kayitlar: kayitlar.map((k, i) => (i === 0 ? { ...k, notlar: [{ id: "n1", tarih: "2026-09-30T10:00:00Z", tur: "GORUSME", metin: "Bütçeyi artırabilir", kisiId: k.veri.kisiler?.[0]?.kisiId ?? null }] } : k)), eslesmeNotlari: {}, testler: {}, geriBildirim: "", ayarlar: { ttl: TTL_VARSAYILAN }, ogrenilen: [], adaylar: [], aktifIceAktarma: null, iceAktarmaGecmisi: [], kisiler, islenmisMesajlar: [], dosyaIzleri: {}, baglantilar: { google: bosGoogleBaglanti(), notion: bosBaglanti() }, senkronGecmisi: [], cakismalar: [] };
const ctx: Ctx = { d, guncelle: () => {}, kayitKaydet: () => {}, bildir: () => {}, ornekHatalari: [], git: () => {}, geri: () => {}, geriVar: false, sample: null };
const ciz = (el: React.ReactElement) => renderToStaticMarkup(React.createElement(C.Provider, { value: ctx }, el));

test("listeler: sıralama düğmesi var", () => {
  for (const tip of ["TALEP", "PORTFOY"] as const) assert.match(ciz(React.createElement(Liste, { tip })), /sirala-btn/);
  assert.match(ciz(React.createElement(Eslesmeler)), /Fırsat önceliği/); // v3.19: varsayılan sıralama
});
test("detay: görüşme notları ve not akışı", () => {
  const h = ciz(React.createElement(Detay, { id: kayitlar[0].id }));
  assert.match(h, /Görüşmeler ve notlar/); assert.match(h, /Bütçeyi artırabilir/);
});
test("kişiler: ara + WhatsApp bağlantıları, sıralama", () => {
  const h = ciz(React.createElement(Kisiler));
  assert.match(h, /href="tel:\+90/); assert.match(h, /href="https:\/\/wa\.me\/90/); assert.match(h, /sirala-btn/);
  const k = kisiler.find((x) => x.telefon)!;
  assert.match(ciz(React.createElement(KisiKarti, { id: k.id })), /WhatsApp/);
});
test("bağlantılar ve veri girişi sekmeleri çizilir", () => {
  assert.match(ciz(React.createElement(Baglantilar)), /Bağlantılar/);
  const v = ciz(React.createElement(VeriGirisi, {}));
  for (const s of ["Yapıştır", "Dosya yükle", "Elle gir", "Anahtar AI"]) assert.ok(v.includes(s), s); // v3.9: üç sekme; ilk sekme akıllı giriş
  const dsy = ciz(React.createElement(VeriGirisi as any, { alt: "dosya" }));
  for (const s of ["Excel · CSV · vCard", "WhatsApp sohbet dosyası", "Örnek: portal listesi"]) assert.ok(dsy.includes(s), s);
});
test("toplu mesaj: örnek toplantı notu 7 ayrı kayıt", () => {
  const h = ciz(React.createElement(TopluMesaj, { baslangic: ORNEK_TOPLANTI_NOTU }));
  assert.match(h, /<b>7<\/b> ayrı kayıt bulundu/);
});