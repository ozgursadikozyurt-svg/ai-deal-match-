/**
 * Anahtar CRM v3.41 · 23 Ekim 2026
 * v3.37 — Özgür'ün 21 Ekim istekleri:
 *   1) talepte bütçe yoksa eşleşme puanı ekstra düşmez (portföyde fiyat yoksa ceza kalır)
 *   2) kaydedilmemiş değişiklik varken başka ekrana geçerken "kaydedelim mi?"
 *   3) Kişiler › Mülk sahipleri süzgeci (pasif / arşiv portföyü olan sahipler — tekrar ara)
 *   4) Pasife al / Arşivle ve Eşleşmeyi kopar (açıklamalı) üst satırda
 *   5) ilan numarası formda, detayda fiyatın yanında, kartlarda
 */
import { test as nodeTest } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { eslesmeOnizle, FIYATSIZ_SKOR_TAVANI, type OnizlemeKayit } from "../src/lib/eslestirme/onizleme";
import { BAGLAM, coz, cozulenToKayitLok } from "../demo/lokasyon";
import { ilanNoAyikla, ilanBaglantisi } from "../src/lib/domain/ilan-no";
import { sahipOzetleri, sahipSuzgeciUyar, sahipOzetMetni } from "../src/lib/domain/sahipler";
import { aileOf } from "../src/lib/domain/kategori";
import { farkliMi } from "../demo/kirli";
import { kaliciHepsiniSil } from "../demo/kalici";
import { ornekVeriyiKur } from "../demo/depo";
import { ac } from "./yardimci-arayuz";
import fs from "node:fs";
import { SURUM, SURUM_GECMISI } from "../src/lib/surum";
import { SADECE_TEST_baglamiSabitle, VARSAYILAN_OFIS_ID, VARSAYILAN_KULLANICI_ID } from "../src/lib/kiracilik";
SADECE_TEST_baglamiSabitle({ ofisId: VARSAYILAN_OFIS_ID, kullaniciId: VARSAYILAN_KULLANICI_ID, rol: "OFIS_YONETICISI", eposta: "test@anahtar.local" });

const test = (ad: string, f: () => unknown | Promise<unknown>) => nodeTest(ad, async () => { kaliciHepsiniSil(); try { (globalThis as any).localStorage?.clear?.(); } catch { /* yok */ } await f(); });
const lok = (ham: string, portfoy: boolean) => cozulenToKayitLok(coz(ham).lokasyonlar, portfoy).map(({ etiket, seviye, ...l }: any) => l);
const T = (v: Partial<OnizlemeKayit> = {}): OnizlemeKayit => ({ tip: "TALEP", mulkTipi: "DEPO_ANTREPO", islemTipi: "KIRALIK", fiyatPeriyodu: "AYLIK", lokasyonlar: lok("Kepez", false), minM2: 2000, maxM2: 4000, ...v } as OnizlemeKayit);
const P = (v: Partial<OnizlemeKayit> = {}): OnizlemeKayit => ({ tip: "PORTFOY", mulkTipi: "DEPO_ANTREPO", islemTipi: "KIRALIK", fiyatPeriyodu: "AYLIK", lokasyonlar: lok("Kepez", true), m2: 3000, fiyat: 250_000, ...v } as OnizlemeKayit);

test("sürüm 3.37 ve ek belge", () => {
  const i = SURUM_GECMISI.findIndex((x) => x.surum === "3.37"); // v3.38 öne eklendi
  assert.ok(i >= 0 && SURUM_GECMISI[i + 1].surum === "3.36" && SURUM >= "3.37");
  assert.ok((SURUM_GECMISI[i].testEt ?? []).length >= 4);
  assert.ok(fs.existsSync("docs/ANAHTAR_CRM_EK_v3.37_21Ekim2026.md"));
});

// ───── 1) Bütçesiz talep ─────
test("depo talebi '2.000–4.000 m², bütçe yok' (v3.38: Benim / Bütçe m²'ye göre): fiyatlı uygun depo 5/5 alır; 'Eksik: talepte bütçe yok' yazmaz", () => {
  const s = eslesmeOnizle(T({ butceSerbest: true }), P(), BAGLAM);
  const butceli = eslesmeOnizle(T({ maxFiyat: 300_000 }), P(), BAGLAM);
  assert.ok(s.skor >= 85 && s.seviye === 5, `${s.skor} ${s.seviye} ${s.gerekceler.join(" | ")}`);
  assert.ok(Math.abs(s.skor - butceli.skor) <= 3, `bütçesiz ${s.skor} ~ bütçeli ${butceli.skor}`);
  assert.ok(!s.veriEksikleri.some((x) => /bütçe/.test(x)), s.veriEksikleri.join(","));
  assert.ok(s.gerekceler.some((g) => /bütçe yok — puanı düşürmez/.test(g)));
});
test("portföyde fiyat yoksa ceza aynen: bütçesiz talepte de en fazla 79 ve 'Portföyde fiyat yok'", () => {
  const s = eslesmeOnizle(T({ butceSerbest: true }), P({ fiyat: null }), BAGLAM);
  assert.ok(s.skor <= FIYATSIZ_SKOR_TAVANI && s.seviye <= 4, String(s.skor));
  assert.ok(s.gerekceler.some((g) => /Portföyde fiyat yok/.test(g)));
  assert.ok(s.veriEksikleri.includes("Portföyde fiyat yazılı değil"));
});

// ───── 2) İlan no ─────
test("ilan no: numara, kısa adres ve tam ilan adresinden numara çıkar; bağlantı sahibinden.com/<no>", () => {
  assert.deepEqual(ilanNoAyikla("1346793126"), { no: "1346793126", url: null });
  assert.deepEqual(ilanNoAyikla("https://sahibinden.com/1346793126"), { no: "1346793126", url: "https://sahibinden.com/1346793126" });
  assert.equal(ilanNoAyikla("sahibinden.com/1346793126").url, "https://sahibinden.com/1346793126");
  assert.equal(ilanNoAyikla("https://www.sahibinden.com/ilan/emlak-is-yeri-kiralik-depo-1000000001/detay?x=12345678").no, "1000000001");
  assert.equal(ilanNoAyikla("ORNEK-1188").no, "ORNEK-1188");
  assert.deepEqual(ilanNoAyikla(""), { no: null, url: null });
  assert.equal(ilanBaglantisi({ portalIlanNo: "1346793126" }), "https://sahibinden.com/1346793126");
  assert.equal(ilanBaglantisi({ portalIlanNo: "1346793126", portalUrl: "https://www.sahibinden.com/ilan/x-1346793126/detay" }), "https://www.sahibinden.com/ilan/x-1346793126/detay");
  assert.equal(ilanBaglantisi({ portalIlanNo: "12345678", veriKanali: "EMLAKJET" }), null, "emlakjet numarasından adres uydurulmaz");
});

// ───── 3) Mülk sahipleri ─────
test("sahip özeti: portföye 'Mülk sahibi' bağlı kişi + rolü Kiraya veren olan tanıdık; pasif portföy 'tekrar ara'da", () => {
  const kayitlar = [
    { id: "P1", veri: { tip: "PORTFOY", mulkTipi: "DEPO_ANTREPO", durum: "PASSIVE", kisiler: [{ kisiId: "K1", rol: "SAHIP" }] } },
    { id: "P2", veri: { tip: "PORTFOY", mulkTipi: "IMALATHANE", durum: "ACTIVE", kisiler: [{ kisiId: "K1", rol: "SAHIP" }, { kisiId: "K3", rol: "EMLAKCI" }] } },
    { id: "T1", veri: { tip: "TALEP", mulkTipi: "DEPO_ANTREPO", durum: "ACTIVE", kisiler: [{ kisiId: "K4", rol: "MUSTERI" }] } },
  ];
  const kisiler = [
    { id: "K1", roller: [] }, { id: "K2", roller: ["KIRAYA_VEREN"], uzmanlikAileleri: ["DEPO"] },
    { id: "K3", roller: ["EMLAKCI"] }, { id: "K4", roller: ["KIRACI"] },
  ];
  const m = sahipOzetleri(kayitlar, kisiler, (t) => aileOf(t as any).kod, { "T1~P1": { durum: "GOSTERIM" } });
  assert.deepEqual([...m.keys()].sort(), ["K1", "K2"], "emlakçı ve kiracı sahip sayılmaz");
  const k1 = m.get("K1")!;
  assert.equal(k1.kapanmis, 1); assert.equal(k1.aktif, 1); assert.equal(k1.sunulan, 1);
  assert.deepEqual(k1.aileler.sort(), ["DEPO", "URETIM"]);
  assert.ok(sahipSuzgeciUyar(k1, "KAPANMIS", ["DEPO"]));
  assert.ok(!sahipSuzgeciUyar(m.get("K2"), "KAPANMIS", []));
  assert.ok(sahipSuzgeciUyar(m.get("K2"), "PORTFOYSUZ", ["DEPO"]), "portföyü kayıtlı olmayan tanıdık depo sahibi");
  assert.ok(!sahipSuzgeciUyar(undefined, "HEPSI", []));
  assert.ok(sahipSuzgeciUyar(undefined, "", []));
  assert.match(sahipOzetMetni(k1, (x) => x), /2 portföy \(1 pasif\/arşiv\) · 1 sunum/);
});

// ───── 4) Form karşılaştırma ─────
test("farkliMi: boş metin ≡ null ≡ yok; tarih ve dizi sırası korunur", () => {
  assert.equal(farkliMi({ a: "", b: null, c: [] }, {}), false);
  assert.equal(farkliMi({ a: "x" }, { a: "x", b: undefined }), false);
  assert.equal(farkliMi({ t: new Date("2026-10-21T00:00:00Z") }, { t: "2026-10-21T00:00:00.000Z" }), false);
  assert.equal(farkliMi({ a: "x" }, { a: "y" }), true);
  assert.equal(farkliMi({ l: [1, 2] }, { l: [2, 1] }), true);
});

// ───── 5) Arayüz: kaydedilmemiş değişiklik, üst düğmeler, ilan no ─────
async function uygulama() {
  const { Uygulama } = await import("../demo/app");
  const a = await ac(React.createElement(Uygulama));
  const menu = (ad: string) => a.tikla(a.qa(".sol-menu .menu-oge").find((b) => (b.textContent ?? "").startsWith(ad)));
  const odakla = (e: Element | null) => a.act(async () => { e!.dispatchEvent(new a.dom.window.FocusEvent("focusin", { bubbles: true })); });
  return { a, menu, odakla };
}
async function p1Detayi(a: Awaited<ReturnType<typeof uygulama>>["a"], menu: (ad: string) => Promise<void>) {
  await menu("Portföyler");
  const kart = a.qa(".kayit-kart").find((k) => /Hacıaliler 4000/.test(k.textContent ?? ""));
  assert.ok(kart, "P1 kartı listede");
  return kart!;
}

test("ilan no: P1 kartında 'İlan 1346793126'; detayda fiyatın yanında sahibinden bağlantısı; formda alan var", async () => {
  const { a, menu } = await uygulama();
  const kart = await p1Detayi(a, menu);
  assert.match(kart.textContent ?? "", /İlan 1346793126/);
  await a.tikla(kart);
  const izgara = a.q(".izgara")!;
  const etiketler = [...izgara.querySelectorAll(":scope > div > span")].map((x) => x.textContent);
  assert.equal(etiketler.indexOf("İlan no"), etiketler.indexOf("Fiyat") + 1, `fiyattan hemen sonra: ${etiketler.join(",")}`);
  assert.equal((a.q(".d-ilan-no a.ilan-no") as HTMLAnchorElement).href, "https://sahibinden.com/1346793126");
  await a.tikla(a.dugme("Düzenle"));
  assert.equal((a.q("#f-ilan-no") as HTMLInputElement).value, "1346793126");
  await a.kapat();
});

test("Pasife al / Arşivle detayın üst satırında (altta tekrar yok); pasife alınca 'Tekrar aktifleştir' üstte", async () => {
  const { a, menu } = await uygulama();
  await a.tikla(await p1Detayi(a, menu));
  const ust = a.q(".detay-ust")!;
  assert.ok(ust.querySelector("#d-pasif") && ust.querySelector("#d-arsiv"), "üst satırda");
  assert.equal(a.qa("button").filter((b) => b.textContent === "Pasife al").length, 1, "tek düğme");
  await a.tikla(ust.querySelector("#d-pasif"));
  assert.ok(a.q(".detay-ust #d-aktif"), "Tekrar aktifleştir üstte");
  await a.tikla(a.q(".detay-ust #d-aktif"));
  await a.kapat();
});

test("Eşleşme detayı: 'Eşleşmeyi kopar' en üstte; pencerede açıklama alanı var", async () => {
  const { a, menu } = await uygulama();
  await menu("Eşleşmeler");
  await a.tikla(a.q(".es2"));
  const ust = a.q(".detay-ust.es-ust")!;
  assert.ok(ust, "üst satır");
  assert.equal(a.q("main")!.querySelector(".detay-ust"), ust, "ekrandaki ilk satır");
  await a.tikla(ust.querySelector(".kopar-btn"));
  assert.ok(a.q(".kopar-panel textarea[id^=kopar-aciklama]"), "açıklama alanı");
  assert.match(a.q(".kopar-panel")!.textContent ?? "", /Açıklama/);
  await a.kapat();
});

test("kaydedilmemiş değişiklik: formdan menüye geçerken sorulur — Vazgeç formda bırakır, Kaydetmeden çık bırakır, Kaydet ve devam et kaydeder", async () => {
  const { a, menu, odakla } = await uygulama();
  await a.tikla(await p1Detayi(a, menu));
  await a.tikla(a.dugme("Düzenle"));
  const baslik = a.q("#f-baslik");
  // değişiklik yokken soru çıkmaz
  await odakla(baslik);
  await menu("Kişiler");
  assert.ok(!a.q(".kaydet-sor"), "değişiklik yokken sorulmaz");
  assert.match(a.q("main")!.textContent ?? "", /Kişiler/);
  // tekrar forma gir, başlığı değiştir
  await a.tikla(await p1Detayi(a, menu));
  await a.tikla(a.dugme("Düzenle"));
  await odakla(a.q("#f-baslik"));
  await a.yaz(a.q("#f-baslik"), "Hacıaliler 4000 m² depo — yeni başlık");
  await menu("Kişiler");
  assert.ok(a.q(".kaydet-sor"), "soru penceresi açıldı");
  assert.match(a.q(".kaydet-sor")!.textContent ?? "", /Kayıt düzenleme/);
  await a.tikla(a.dugme("Vazgeç"));
  assert.ok(!a.q(".kaydet-sor") && a.q("#f-baslik"), "Vazgeç: formda kalındı");
  assert.equal((a.q("#f-baslik") as HTMLInputElement).value, "Hacıaliler 4000 m² depo — yeni başlık", "yazılan kaybolmadı");
  // telefonun geri tuşu da sorar
  await a.act(async () => { a.dom.window.dispatchEvent(new a.dom.window.PopStateEvent("popstate")); });
  assert.ok(a.q(".kaydet-sor"), "geri tuşunda da soru");
  await a.tikla(a.dugme("Vazgeç"));
  // Kaydet ve devam et
  await menu("Kişiler");
  await a.tikla(a.dugme("Kaydet ve devam et"));
  assert.ok(!a.q(".kaydet-sor"));
  assert.match(a.q("main")!.textContent ?? "", /Kişiler/, "hedef ekrana geçildi");
  await menu("Portföyler");
  assert.ok(a.qa(".kayit-kart").some((k) => /yeni başlık/.test(k.textContent ?? "")), "değişiklik kaydedildi");
  // Kaydetmeden çık
  await a.tikla(a.qa(".kayit-kart").find((k) => /yeni başlık/.test(k.textContent ?? "")));
  await a.tikla(a.dugme("Düzenle"));
  await odakla(a.q("#f-baslik"));
  await a.yaz(a.q("#f-baslik"), "kaydedilmeyecek başlık");
  await menu("Eşleşmeler");
  await a.tikla(a.dugme("Kaydetmeden çık"));
  await menu("Portföyler");
  assert.ok(!a.qa(".kayit-kart").some((k) => /kaydedilmeyecek/.test(k.textContent ?? "")), "kaydedilmedi");
  await a.kapat();
});

test("Kişiler › 'Tekrar aranacak sahipler': pasife alınan depo portföyünün sahibi listelenir, kartta sahip özeti", async () => {
  const { a, menu } = await uygulama();
  await a.tikla(await p1Detayi(a, menu));
  await a.tikla(a.q(".detay-ust #d-pasif"));
  await menu("Kişiler");
  await a.tikla(a.q("#sahip-tekrar-ara"));
  const kartlar = a.qa(".kisi-kart");
  assert.ok(kartlar.length >= 1, "en az bir sahip");
  assert.ok(kartlar.every((k) => /pasif\/arşiv/.test(k.querySelector(".sahip-ozet")?.textContent ?? "")), kartlar.map((k) => k.textContent).join(" || "));
  assert.ok(kartlar.some((k) => /Mehmet K\./.test(k.textContent ?? "") && /Depo \/ Lojistik/.test(k.textContent ?? "")));
  assert.ok(a.q(".aktif-filtreler")!.textContent!.includes("Pasif / arşiv"), "süzgeç çipi görünür");
  await a.kapat();
});

test("örnek veri hâlâ hatasız (P1 ilan no ile)", () => {
  const o = ornekVeriyiKur();
  assert.equal(o.hatalar.length, 0, JSON.stringify(o.hatalar));
  assert.equal((o.kayitlar.find((k) => k.id === "P1")!.veri as any).portalIlanNo, "1346793126");
});
