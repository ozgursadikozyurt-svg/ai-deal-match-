/**
 * Anahtar CRM v3.21.1 · 8 Ekim 2026
 * v3.16 — her ekranda geri, kişi rolüne göre filtre, eşleşmelerde işlem tipi, kaynak otomasyonu, geri sayımın kayıt gününden başlaması.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { JSDOM } from "jsdom";
import { C, type Ctx } from "../demo/ortak";
import { ornekVeriyiKur, bosBaglanti, bosGoogleBaglanti, type DepoDurumu, type Veri } from "../demo/depo";
import { filtreUygula, bosFiltre } from "../demo/filtre";
import { Eslesmeler, Liste } from "../demo/app";
import { taslakYap } from "../demo/ai-kutusu";
import { hizliAyristir } from "../src/lib/ai/hizli-ayristirici";
import { SADECE_TEST_baglamiSabitle, VARSAYILAN_OFIS_ID, VARSAYILAN_KULLANICI_ID } from "../src/lib/kiracilik";
// v3.20 — çok ofisli: testler varsayılan ofisin bağlamında çalışır (göçte açılan Özyurtlar Gayrimenkul)
SADECE_TEST_baglamiSabitle({ ofisId: VARSAYILAN_OFIS_ID, kullaniciId: VARSAYILAN_KULLANICI_ID, rol: "OFIS_YONETICISI", eposta: "test@anahtar.local" });


const { kayitlar, kisiler } = ornekVeriyiKur();
const d: DepoDurumu = { ...(ornekVeriyiKur() as any), veriSurumu: "t", kayitlar, kisiler, testler: {}, geriBildirim: "", ayarlar: { ttl: {} as any }, ogrenilen: [], adaylar: [], aktifIceAktarma: null, iceAktarmaGecmisi: [], islenmisMesajlar: [], dosyaIzleri: {}, baglantilar: { google: bosGoogleBaglanti(), notion: bosBaglanti() }, senkronGecmisi: [], cakismalar: [], eslesmeNotlari: {} } as DepoDurumu;
const ctx = (ek: Partial<Ctx> = {}): Ctx => ({ d, guncelle: () => {}, kayitKaydet: () => {}, bildir: () => {}, ornekHatalari: [], git: () => {}, geri: () => {}, geriVar: false, sample: null, ...ek }) as Ctx;
const ciz = (el: React.ReactElement, c = ctx()) => renderToStaticMarkup(React.createElement(C.Provider, { value: c }, el));

test("kişi rolü filtresi: kayda bağlı kişinin rolüne göre süzer", () => {
  const rolu = (id: string) => kisiler.find((k) => k.id === id)?.roller ?? [];
  const emlakci = kayitlar.find((k) => (k.veri.kisiler ?? []).some((b) => rolu(b.kisiId).includes("EMLAKCI")))!;
  assert.ok(emlakci, "örnek veride emlakçı bağlı bir kayıt olmalı");
  assert.equal(filtreUygula(emlakci.veri, bosFiltre({ roller: ["EMLAKCI"] }), undefined, rolu), true);
  assert.equal(filtreUygula(emlakci.veri, bosFiltre({ roller: ["MUTEAHHIT"] }), undefined, rolu), false);
  assert.equal(filtreUygula(emlakci.veri, bosFiltre(), undefined, rolu), true, "rol seçilmemişse süzmez");
});

test("eşleşmeler ekranı: işlem tipi hızlı filtresi var, 'Filtre neye uygulansın' ve 'Kişi' bölümü kaldırıldı", () => {
  const h = ciz(React.createElement(Eslesmeler));
  for (const x of ["Satılık", "Kiralık", "Devren"]) assert.ok(h.includes(x), x);
  assert.ok(!h.includes("Filtre neye uygulansın"));
  assert.ok(!h.includes("Portföy tarafı"));
});

test("listelerde 'Listeyi paylaş' düğmesi var", () => {
  assert.match(ciz(React.createElement(Liste, { tip: "TALEP" })), /Listeyi paylaş/);
});

test("genel geri düğmesi: geçmiş varsa görünür, yoksa görünmez", async () => {
  const dom = new JSDOM("<div id=k></div>", { pretendToBeVisual: true });
  (globalThis as any).window = dom.window; (globalThis as any).document = dom.window.document; (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  const { createRoot } = await import("react-dom/client"); const { act } = await import("react");
  const { Uygulama } = await import("../demo/app");
  const kok = createRoot(dom.window.document.getElementById("k")!);
  await act(async () => kok.render(React.createElement(Uygulama)));
  const metin = () => dom.window.document.getElementById("k")!.textContent ?? "";
  assert.ok(!metin().includes("← Geri"), "Ana Sayfa'da geçmiş yok");
  const dugme = [...dom.window.document.querySelectorAll("button")].find((b) => (b.textContent ?? "").trim() === "Talepler")!;
  await act(async () => dugme.click());
  assert.ok(metin().includes("← Geri"), "başka ekrana geçince geri çıkar");
  const geri = [...dom.window.document.querySelectorAll("button")].find((b) => (b.textContent ?? "").includes("← Geri"))!;
  await act(async () => geri.click());
  assert.ok(!metin().includes("← Geri"), "geri basınca Ana Sayfa'ya döner");
  await act(async () => kok.unmount());
});

test("kaynak otomasyonu: WhatsApp portföyü 'Kendi portföyüm' olmaz; elle giriş ve malik olur", () => {
  const wa = "Lara'da 2+1 satılık daire 5.500.000 TL 0555 111 22 33";
  const t1 = taslakYap(wa, hizliAyristir(wa), null).taslak;
  assert.equal(t1.tip === "PORTFOY" ? t1.havuz : "PARTNER", "PARTNER", "telefonlu (WhatsApp) portföy partner havuzuna düşer");
  const elle = "Lara'da 2+1 satılık daire 5.500.000 TL";
  const t2 = taslakYap(elle, hizliAyristir(elle), null).taslak;
  assert.equal(t2.havuz, "KENDI_PORTFOY", "elle girişte kendi portföyü");
  const malik = taslakYap(wa, { ...hizliAyristir(wa), ilanSahibiTipi: "MALIK" } as any, null).taslak;
  assert.equal(malik.havuz, "KENDI_PORTFOY", "sahibinden olduğu belliyse kendi portföyü");
});
