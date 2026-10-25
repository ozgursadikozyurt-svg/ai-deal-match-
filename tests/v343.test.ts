/**
 * Anahtar CRM v3.43 · 25 Ekim 2026
 * İzleme ekranında ayrıntılı arama + filtre + sıralama; "Sırala" düğmesi uzun etiket yazmaz;
 * eşleşme kartında kıyas şeridi (istenen → olan + fark); mobil sağlamlaştırma kuralları.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { SURUM_GECMISI } from "../src/lib/surum";
import { C, type Ctx } from "../demo/ortak";
import { ornekVeriyiKur, bosBaglanti, bosGoogleBaglanti, type DepoDurumu } from "../demo/depo";
import { TTL_VARSAYILAN } from "../src/lib/domain/gecerlilik";
import { Izleme } from "../demo/favori";
import { kiyaslar, gunOnce } from "../demo/kartlar";
import { eslesmeSiralama, eslesmeFiltreUygula, bosFiltre } from "../demo/filtre";
import { ac } from "./yardimci-arayuz";

const ornek = ornekVeriyiKur();
const durum = (favoriler: string[] = []): DepoDurumu => ({ veriSurumu: "t", kayitlar: ornek.kayitlar, eslesmeNotlari: {}, testler: {}, geriBildirim: "", ayarlar: { ttl: TTL_VARSAYILAN }, ogrenilen: [], adaylar: [], aktifIceAktarma: null, iceAktarmaGecmisi: [], kisiler: ornek.kisiler, islenmisMesajlar: [], dosyaIzleri: {}, baglantilar: { google: bosGoogleBaglanti(), notion: bosBaglanti() }, senkronGecmisi: [], cakismalar: [], googleBekleyen: [], favoriler } as DepoDurumu);
const ctx = (d: DepoDurumu): Ctx => ({ d, guncelle: () => {}, kayitKaydet: () => {}, bildir: () => {}, ornekHatalari: [], git: () => {}, geri: () => {}, geriVar: false, sample: null } as Ctx);
const cizUI = (el: React.ReactElement, d = durum()) => renderToStaticMarkup(React.createElement(C.Provider, { value: ctx(d) }, el));
const talep = ornek.kayitlar.find((k) => k.veri.tip === "TALEP")!;
const portfoy = ornek.kayitlar.find((k) => k.veri.tip === "PORTFOY")!;

test("sürüm 3.43 kayıtlı", () => { assert.ok(SURUM_GECMISI.some((x) => x.surum === "3.43")); });

test("İzleme: ayrıntılı filtre paneli, arama kutusu ve sıralama düğmesi var", () => {
  const h = cizUI(React.createElement(Izleme), durum(["t:" + talep.id, "p:" + portfoy.id]));
  assert.ok(/class="filtre-paneli"/.test(h), "filtre paneli çizilmeli");
  assert.match(h, /İzlemede ara/);
  assert.match(h, /Filtrele/);
  assert.match(h, /sirala-btn/);
  assert.match(h, /Talepler \(1\)/); assert.match(h, /Portföyler \(1\)/);
});

test("İzleme: boşken filtre paneli yerine yönlendirme çıkar", () => {
  const h = cizUI(React.createElement(Izleme));
  assert.match(h, /Henüz izlemede bir şey yok/);
  assert.ok(!/filtre-paneli/.test(h), "hiç kayıt yokken filtre gösterilmez");
});

test("İzleme: aramaya uymayan kayıt listeden düşer, sayaç 'n / toplam' olur", async () => {
  const a = await ac(React.createElement(Izleme), ctx(durum(["t:" + talep.id, "p:" + portfoy.id])));
  assert.match(a.metin(), /2 izlenen kayıt/);
  await a.yaz(a.q(".fc-ara input"), "zzzxqq-olmayan-kelime");
  assert.match(a.metin(), /0 \/ 2 kayıt/);
  assert.match(a.metin(), /Bu filtreye uyan izlenen kayıt yok/);
  await a.kapat();
});

test("Sırala düğmesi uzun etiket yazmaz; seçenekler menünün içinde", async () => {
  const a = await ac(React.createElement(Izleme), ctx(durum(["t:" + talep.id])));
  const btn = a.q(".sirala-btn")!;
  assert.match(btn.textContent ?? "", /Sırala/);
  assert.ok(!/Kayda giriş|en iyi önce/.test(btn.textContent ?? ""), "düğme seçili sıralamanın adını yazmaz");
  await a.tikla(btn);
  const menu = a.q(".sirala-menu")!;
  assert.match(menu.textContent ?? "", /Kayda giriş/);
  await a.kapat();
});

test("Eşleşme sıralamasında varsayılan 'Uyum (en iyi önce)' ve hepsi menüde", () => {
  const s = eslesmeSiralama();
  assert.equal(s[0].etiket, "Uyum (en iyi önce)");
  assert.deepEqual(s.map((x) => x.alan).sort(), ["butce", "firsat", "fiyat", "giris", "komisyon", "m2", "skor", "sure"]);
});

test("Eşleşme filtresi: mülk türü portföye bakar, arama iki tarafı birden tarar", () => {
  const t = { ...talep.veri, baslik: "Lara ofis arayan müşteri" } as any;
  const p = { ...portfoy.veri, baslik: "Kundu deposu" } as any;
  const f = bosFiltre();
  assert.ok(eslesmeFiltreUygula(t, p, { ...f, ara: "kundu" }), "portföy başlığı aramada bulunur");
  assert.ok(eslesmeFiltreUygula(t, p, { ...f, ara: "lara ofis" }), "talep başlığı da aramada bulunur");
  assert.ok(!eslesmeFiltreUygula(t, p, { ...f, ara: "bulunmayan-kelime" }));
});

test("Kıyas şeridi: bütçe aşımı, alan aralığı ve oda uyumu yazıyla çıkar", () => {
  const e: any = {
    t: { id: "t", veri: { tip: "TALEP", maxFiyat: 10_000_000, minM2: 100, maxM2: 150, odaSayisi: "3+1", ozellik: {} } },
    p: { id: "p", veri: { tip: "PORTFOY", fiyat: 12_000_000, m2: 120, odaSayisi: "3+1", ozellik: {} } },
    s: {}, f: {},
  };
  const k = kiyaslar(e);
  const b = k.find((x) => x.ad === "Bütçe")!;
  assert.equal(b.not, "%20 üstünde"); assert.equal(b.ton, "kotu");
  const al = k.find((x) => x.ad === "Alan")!;
  assert.equal(al.not, "aralıkta"); assert.equal(al.ton, "iyi");
  const o = k.find((x) => x.ad === "Oda")!;
  assert.equal(o.not, "istenen oda"); assert.equal(o.ton, "iyi");
});

test("Kıyas şeridi: bütçe içinde ve alan küçükse doğru ton", () => {
  const e: any = {
    t: { id: "t", veri: { tip: "TALEP", maxFiyat: 10_000_000, minM2: 200, maxM2: 400, ozellik: {} } },
    p: { id: "p", veri: { tip: "PORTFOY", fiyat: 8_000_000, m2: 100, ozellik: {} } },
    s: {}, f: {},
  };
  const k = kiyaslar(e);
  assert.equal(k.find((x) => x.ad === "Bütçe")!.ton, "iyi");
  const al = k.find((x) => x.ad === "Alan")!;
  assert.equal(al.not, "%50 küçük"); assert.equal(al.ton, "kotu");
});

test("Kıyas şeridi: bütçesiz talepte karşılaştırma yapılmaz, uyarı verilir", () => {
  const e: any = { t: { id: "t", veri: { tip: "TALEP", ozellik: {} } }, p: { id: "p", veri: { tip: "PORTFOY", fiyat: 5_000_000, ozellik: {} } }, s: {}, f: {} };
  const b = kiyaslar(e).find((x) => x.ad === "Bütçe")!;
  assert.equal(b.ist, "Bütçe yazılmamış"); assert.equal(b.ton, "uyari");
});

test("gunOnce: bugün / dün / n gün önce", () => {
  const g = (n: number) => gunOnce(new Date(Date.now() - n * 86400000).toISOString());
  assert.equal(g(0), "Bugün"); assert.equal(g(1), "Dün"); assert.equal(g(5), "5 gün önce");
  assert.equal(g(60), "2 ay önce"); assert.equal(g(400), "1 yıl önce");
});

test("Mobil: sayfa yatay kaymasın, dokunma hedefleri büyüsün, kıyas şeridi stilleri var", () => {
  const css = fs.readFileSync("demo/sayfa.html", "utf8");
  assert.match(css, /html,body\{max-width:100%;overflow-x:clip\}/);
  assert.match(css, /\.icerik,main\.sarici\{overflow-x:clip\}/);
  assert.match(css, /@media \(max-width:360px\)/);
  assert.match(css, /\.es2-kiyas\{/);
  assert.match(css, /\.ek-satir\.t-kotu \.ek-not\{/);
  assert.ok(!/\.sirala-et\{[^}]*max-width:3\.9rem/.test(css), "sıralama etiketi artık kırpılmıyor");
});
