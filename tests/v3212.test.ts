/**
 * Anahtar CRM v3.21.2 · 8 Ekim 2026
 * v3.21.2 — Eşleşmeler: tahmini komisyon toplamı kalktı · filtre/konum karta girip Geri dönünce korunur ·
 * kompakt süzgeçler + yandan açılan skor çubuğu · Konumlar, Bağlantılar, Yönetim Ayarlar içinde.
 */
import { test as nodeTest } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { C, type Ctx } from "../demo/ortak";
import { ornekVeriyiKur, bosBaglanti, bosGoogleBaglanti, type DepoDurumu } from "../demo/depo";
import { TTL_VARSAYILAN } from "../src/lib/domain/gecerlilik";
import { Eslesmeler, Liste, Uygulama } from "../demo/app";
import { Kisiler } from "../demo/kisiler";
import { Izleme } from "../demo/favori";
import { bosFiltre } from "../demo/filtre";
import { kaliciHepsiniSil, kaliciOku, kaliciSil } from "../demo/kalici";
import { SADECE_TEST_baglamiSabitle, VARSAYILAN_OFIS_ID, VARSAYILAN_KULLANICI_ID } from "../src/lib/kiracilik";
import { ac } from "./yardimci-arayuz";
SADECE_TEST_baglamiSabitle({ ofisId: VARSAYILAN_OFIS_ID, kullaniciId: VARSAYILAN_KULLANICI_ID, rol: "OFIS_YONETICISI", eposta: "test@anahtar.local" });

const ornek = ornekVeriyiKur();
const durum = (favoriler: string[] = []): DepoDurumu => ({ veriSurumu: "t", kayitlar: ornek.kayitlar, eslesmeNotlari: {}, testler: {}, geriBildirim: "", ayarlar: { ttl: TTL_VARSAYILAN }, ogrenilen: [], adaylar: [], aktifIceAktarma: null, iceAktarmaGecmisi: [], kisiler: ornek.kisiler, islenmisMesajlar: [], dosyaIzleri: {}, baglantilar: { google: bosGoogleBaglanti(), notion: bosBaglanti() }, senkronGecmisi: [], cakismalar: [], googleBekleyen: [], favoriler } as DepoDurumu);
const ctx = (d = durum()): Ctx => ({ d, guncelle: () => {}, kayitKaydet: () => {}, bildir: () => {}, ornekHatalari: [], git: () => {}, geri: () => {}, geriVar: false, sample: null } as Ctx);
const ciz = (el: React.ReactElement) => renderToStaticMarkup(React.createElement(C.Provider, { value: ctx() }, el));

// Her testten önce saklanan ekran durumu temizlenir (hook yerine sarmalayıcı: testler birbirinin süzgecini görmesin)
const test = (ad: string, f: () => unknown | Promise<unknown>) => nodeTest(ad, async () => { kaliciHepsiniSil(); await f(); });

// ───── 1) komisyon toplamı ─────
test("Eşleşmeler: 'tahmini komisyon ≈ …' toplam satırı ve eski Fırsat önceliği kartı kalktı; kart başına komisyon durur", () => {
  const h = ciz(React.createElement(Eslesmeler));
  assert.ok(!/komisyon\s*≈\s*[\d.,]+\s*₺/i.test(h), "toplam komisyon yazısı yok");
  assert.ok(!/öncelikli eşleşme/i.test(h), "eski 'N öncelikli eşleşme · …' özet satırı yok");
  assert.ok(!h.includes("firsat-kart"), "büyük fırsat kartı yok");
  assert.match(h, /pill firsat/, "kartlarda fırsat rozeti durur");
  assert.match(h, /≈\s*[\d.,]+\s*(bin |milyon )?₺/, "kartlarda kişi başı komisyon durur");
});

// ───── 2) filtreler ekran sökülünce korunur ─────
test("Eşleşmeler: karta girip Geri dönünce uygunluk, fırsat, skor süzgeçleri ve çipleri korunur; Temizle hepsini sıfırlar", async () => {
  let a = await ac(React.createElement(Eslesmeler), ctx());
  await a.tikla(a.dugme(/^Sunulabilir \(/));
  for (let i = 0; i < 4; i++) await a.tus(a.q(".skor-iz"), "ArrowUp");                  // skor ≥ 20
  await a.tikla(a.qa(".hs-btn")[1]);                                                    // Fırsat seçicisi
  await a.tikla(a.qa(".hs-menu .hs-oge").find((x) => /^Öncelikli/.test(x.textContent ?? "")));
  assert.deepEqual([kaliciOku("eslesmeler.u"), kaliciOku("eslesmeler.skor"), kaliciOku("eslesmeler.fk")], ["SUNULABILIR", 20, "ONCELIKLI"]);
  await a.kapat();                                                                      // ekran sökülür (karta girildi)

  a = await ac(React.createElement(Eslesmeler), ctx());                                  // Geri: ekran yeniden çizilir
  assert.ok(a.dugme(/^Sunulabilir \(/)!.className.includes("on"), "Sunulabilir seçili kaldı");
  assert.match(a.q(".skor-tutac")!.textContent ?? "", /Skor ≥ 20/);
  assert.ok(a.q(".skor-cekmece")!.className.includes("dolu"));
  const cipler = a.qa(".aktif-filtreler .cip").map((x) => x.textContent ?? "");
  assert.ok(cipler.some((x) => x.includes("Skor ≥ 20")) && cipler.some((x) => x.includes("Fırsat: Öncelikli")), cipler.join("|"));
  await a.tikla(a.q(".fc-temizle"));
  assert.equal(kaliciOku("eslesmeler.skor"), 0); assert.equal(kaliciOku("eslesmeler.fk"), "");
  assert.equal(a.qa(".aktif-filtreler .cip").length, 0, "Temizle: çipler gitti");
  await a.kapat();
});
test("Talepler ve Portföyler listeleri filtreyi ayrı ayrı korur; hazır filtreyle gelince eskisi karışmaz", async () => {
  let a = await ac(React.createElement(Liste, { tip: "TALEP" }), ctx());
  await a.tikla(a.q(".fc-hizli"));                                                       // Acil
  assert.ok(a.q(".fc-hizli")!.className.includes("on")); await a.kapat();
  a = await ac(React.createElement(Liste, { tip: "TALEP" }), ctx());
  assert.ok(a.q(".fc-hizli")!.className.includes("on"), "Talepler: Acil korundu"); await a.kapat();
  a = await ac(React.createElement(Liste, { tip: "PORTFOY" }), ctx());
  assert.ok(!a.q(".fc-hizli")!.className.includes("on"), "Portföyler ayrı tutulur"); await a.kapat();
  // Ana Sayfa / yapay zekâ kutusu hazır filtreyle açarsa (git → kaliciSil) eski süzgeç yerine o gelir
  kaliciSil("liste.TALEP.");
  a = await ac(React.createElement(Liste, { tip: "TALEP", baslangic: bosFiltre({ durumlar: ["ACTIVE"], acil: false }) }), ctx());
  assert.ok(!a.q(".fc-hizli")!.className.includes("on")); await a.kapat();
});
test("Kişiler: arama metni ve İzleme: seçili sekme korunur", async () => {
  let a = await ac(React.createElement(Kisiler), ctx());
  await a.yaz(a.q('input[type="search"]'), "ali");
  await a.kapat();
  a = await ac(React.createElement(Kisiler), ctx());
  assert.equal((a.q('input[type="search"]') as HTMLInputElement).value, "ali"); await a.kapat();
  const t = ornek.kayitlar.find((k) => k.veri.tip === "TALEP")!, p = ornek.kayitlar.find((k) => k.veri.tip === "PORTFOY")!;
  a = await ac(React.createElement(Izleme), ctx(durum(["t:" + t.id, "p:" + p.id])));
  await a.tikla(a.dugme(/^Portföyler/)); await a.kapat();
  a = await ac(React.createElement(Izleme), ctx(durum(["t:" + t.id, "p:" + p.id])));
  assert.ok(a.dugme(/^Portföyler/)!.className.includes("on"), "İzleme: Portföyler sekmesi korundu"); await a.kapat();
});

// ───── 3) kompakt süzgeçler + yan çubuk ─────
test("Eşleşmeler: İşlem · Fırsat · ⋯ tek satırda; eski üç satır ve büyük kart yok", () => {
  const h = ciz(React.createElement(Eslesmeler));
  assert.equal((h.match(/class="hs-satir"/g) ?? []).length, 1);
  assert.equal((h.match(/class="hs-btn/g) ?? []).length, 3, "İşlem, Fırsat, ⋯");
  assert.ok(!/Tümü \(\d+\)/.test(h), "eski 'Tümü (n) · Satılık (n)' çip satırı kalktı");
  assert.match(h, /filtre filtre-ince/);
});
test("Skor çubuğu: kapalıyken yalnızca tutamak; dokununca açılır, çubuk ve tuşlarla ayarlanır, Sıfırla temizler", async () => {
  const a = await ac(React.createElement(Eslesmeler), ctx());
  const cekmece = a.q(".skor-cekmece")!;
  assert.ok(!cekmece.className.includes("acik")); assert.equal(a.q(".skor-tutac")!.getAttribute("aria-expanded"), "false");
  assert.match(a.q(".skor-tutac")!.textContent ?? "", /Skor/);
  await a.tikla(a.q(".skor-tutac"));
  assert.ok(a.q(".skor-cekmece")!.className.includes("acik")); assert.ok(a.q(".skor-perde"), "dışına dokununca kapanır");
  const iz = a.q(".skor-iz")!;
  await a.tus(iz, "End"); assert.equal(iz.getAttribute("aria-valuenow"), "100");
  await a.tus(iz, "ArrowDown"); await a.tus(iz, "ArrowDown"); assert.equal(iz.getAttribute("aria-valuenow"), "90");
  assert.ok(a.q(".skor-cekmece")!.className.includes("dolu")); assert.match(a.q(".skor-tutac")!.textContent ?? "", /Skor ≥ 90/);
  const sayi = (a.q(".skor-say")!.textContent ?? "");
  assert.match(sayi, /\d+ eşleşme/);
  await a.tikla(a.q(".skor-sifirla")); assert.equal(iz.getAttribute("aria-valuenow"), "0");
  await a.tikla(a.q(".skor-perde")); assert.ok(!a.q(".skor-cekmece")!.className.includes("acik"));
  await a.kapat();
});
test("Skor filtresi listeyi gerçekten süzer (yüksek skor → daha az kart)", async () => {
  const a = await ac(React.createElement(Eslesmeler), ctx());
  await a.tikla(a.dugme(/^Koşullu \(/)); const once = a.qa(".es2").length;
  await a.tus(a.q(".skor-iz"), "End");                                                  // ≥ 100
  assert.ok(a.qa(".es2").length < once || once === 0, `${a.qa(".es2").length} < ${once}`);
  await a.kapat();
});

// ───── 4) Ayarlar altına taşınan ekranlar + Geri'de konum ─────
test("Ana menüde Konumlar / Bağlantılar / Yönetim yok; Ayarlar'ın içinde üçü de var ve Ayarlar menüde vurgulu kalır", async () => {
  const a = await ac(React.createElement(Uygulama));
  const navEtiket = a.qa(".sol-menu .menu-oge, .alt-cubuk button").map((b) => (b.textContent ?? "").replace(/\d+$/, "").trim());
  for (const x of ["Konumlar", "Bağlantılar", "Yönetim"]) assert.ok(!navEtiket.includes(x), `menüde ${x} olmamalı: ${navEtiket.join("|")}`);
  for (const x of ["Ana Sayfa", "Talepler", "Portföyler", "Eşleşmeler", "İzleme", "Kişiler", "Veri Girişi", "Ayarlar"]) assert.ok(navEtiket.includes(x), `menüde ${x} olmalı`);
  await a.tikla(a.qa(".sol-menu .menu-oge").find((b) => (b.textContent ?? "").startsWith("Ayarlar")));
  const gecis = a.qa(".ayar-gecis-oge").map((b) => b.querySelector("b")!.textContent);
  assert.deepEqual(gecis, ["Konumlar", "Bağlantılar", "Yönetim"]);
  for (const [ad, aranan] of [["Konumlar", /Konum/], ["Bağlantılar", /Google/], ["Yönetim", /Kullanıcı|Ofis/]] as const) {
    await a.tikla(a.qa(".ayar-gecis-oge").find((b) => b.querySelector("b")!.textContent === ad));
    assert.match(a.q("main")!.textContent ?? "", aranan, ad + " ekranı açıldı");
    assert.equal(a.q(".sol-menu .menu-oge[aria-current=page]")?.textContent?.startsWith("Ayarlar"), true, ad + ": Ayarlar vurgulu");
    await a.tikla(a.dugme("← Geri"));
    assert.equal(a.qa(".ayar-gecis-oge").length, 3, ad + ": Geri → Ayarlar");
  }
  await a.kapat();
});
test("Eşleşme kartına girip Geri dönünce: süzgeçler ve kaydırma konumu aynen geri gelir", async () => {
  const a = await ac(React.createElement(Uygulama));
  await a.tikla(a.qa(".sol-menu .menu-oge").find((b) => (b.textContent ?? "").startsWith("Eşleşmeler")));
  await a.tikla(a.dugme(/^Koşullu \(/));
  await a.tus(a.q(".skor-iz"), "ArrowUp");                                              // skor ≥ 5
  a.kaydirmaDegeri(1234);                                                               // kullanıcı listede aşağı inmiş
  await a.tikla(a.q(".es2"));                                                           // karta gir
  assert.ok(!a.q(".skor-iz"), "eşleşme detayındayız");
  a.kaydirmaDegeri(0);
  await a.tikla(a.dugme("← Geri"));
  assert.ok(a.dugme(/^Koşullu \(/)!.className.includes("on"), "Koşullu süzgeci duruyor");
  assert.equal(a.q(".skor-iz")!.getAttribute("aria-valuenow"), "5", "skor süzgeci duruyor");
  assert.equal(a.kaydirmalar[a.kaydirmalar.length - 1], 1234, `kaydırma 1234'e döndü: ${a.kaydirmalar.join(",")}`);
  await a.kapat();
});
