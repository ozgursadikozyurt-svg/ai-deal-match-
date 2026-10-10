/**
 * Anahtar CRM v3.22.2 · 10 Ekim 2026
 * v3.15 — çoklu kat, takasa açık, dinamik roller, kişiler toplu işlemler, kayıt göstergesi, geri dönüş hafızası.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { JSDOM } from "jsdom";
import { eslesmeOnizle, TAKAS_BONUS, type OnizlemeKayit } from "../src/lib/eslestirme/onizleme";
import { katUyumu, katYaz, istenenKatlarOf } from "../src/lib/domain/teknik-alanlar";
import { rolListesi, rolKoduUret, rolNormalize, SISTEM_ROLLERI } from "../src/lib/domain/roller";
import { KayitCreateSchema } from "../src/lib/validation/kayit";
import { BAGLAM } from "../demo/lokasyon";
import { C, type Ctx } from "../demo/ortak";
import { ornekVeriyiKur, bosBaglanti, bosGoogleBaglanti, type DepoDurumu } from "../demo/depo";
import { Kisiler, rolleriUygula, KISI_ROLLERI } from "../demo/kisiler";
import { RolYonetimi } from "../demo/roller";
import { EslesmeKarti } from "../demo/kartlar";
import { filtreUygula, bosFiltre } from "../demo/filtre";
import { KaydetGostergesi } from "../demo/canli-gosterge";
import { sunucudanDurum, imzaAl, planla } from "../demo/canli-esle";
import { hafizaBaslat, useKalici } from "../demo/hafiza";
import { SADECE_TEST_baglamiSabitle, VARSAYILAN_OFIS_ID, VARSAYILAN_KULLANICI_ID } from "../src/lib/kiracilik";
// v3.20 — çok ofisli: testler varsayılan ofisin bağlamında çalışır (göçte açılan Özyurtlar Gayrimenkul)
SADECE_TEST_baglamiSabitle({ ofisId: VARSAYILAN_OFIS_ID, kullaniciId: VARSAYILAN_KULLANICI_ID, rol: "OFIS_YONETICISI", eposta: "test@anahtar.local" });


const es = (t: OnizlemeKayit, p: OnizlemeKayit) => eslesmeOnizle(t, p, BAGLAM);
const T: OnizlemeKayit = { tip: "TALEP", mulkTipi: "DAIRE", islemTipi: "SATILIK", lokasyonlar: [] };
const P: OnizlemeKayit = { tip: "PORTFOY", mulkTipi: "DAIRE", islemTipi: "SATILIK", lokasyonlar: [] };

test("kat uyumu: sayı, ara kat, son kat, bilinmeyen", () => {
  assert.equal(katUyumu(["0", "3"], 3), "SAGLANDI");
  assert.equal(katUyumu(["0", "3"], 5), "SAGLANMADI");
  assert.equal(katUyumu(["ARA"], 3, 6), "SAGLANDI");
  assert.equal(katUyumu(["ARA"], 6, 6), "SAGLANMADI");
  assert.equal(katUyumu(["ARA"], 0, 6), "SAGLANMADI");
  assert.equal(katUyumu(["SON"], 6, 6), "SAGLANDI");
  assert.equal(katUyumu(["ARA"], 3, null), "BILINMIYOR");
  assert.equal(katUyumu(["3"], null), "BILINMIYOR");
  assert.equal(katUyumu([], 4), "SAGLANDI");
  assert.equal(katYaz(["0", "3", "ARA"]), "Giriş / Zemin, 3. kat, Ara kat");
  assert.deepEqual(istenenKatlarOf({ bulunduguKat: 2 }), ["2"]); // eski tek değerli talep
  assert.deepEqual(istenenKatlarOf({ istenenKatlar: ["0", "ARA"], bulunduguKat: 2 }), ["0", "ARA"]);
});

test("eşleştirme: talep birden çok kata uygunsa biri tutunca karşılanır; hiçbiri tutmazsa karşılanmaz", () => {
  const t = { ...T, ozellik: { istenenKatlar: ["0", "3", "ARA"] } };
  const kat = (s: ReturnType<typeof es>) => s.kriterler.find((x) => x.anahtar === "istenenKatlar")!;
  assert.equal(kat(es(t, { ...P, ozellik: { bulunduguKat: 3 } })).sonuc, "SAGLANDI");
  assert.equal(kat(es(t, { ...P, ozellik: { bulunduguKat: 0 } })).sonuc, "SAGLANDI");
  assert.equal(kat(es(t, { ...P, ozellik: { bulunduguKat: 2, katSayisi: 5 } })).sonuc, "SAGLANDI"); // ara kat
  assert.equal(kat(es(t, { ...P, ozellik: { bulunduguKat: 5, katSayisi: 5 } })).sonuc, "SAGLANMADI");
  assert.equal(kat(es(t, { ...P, ozellik: {} })).sonuc, "BILINMIYOR");
  // eski tek değerli talep katı da okunur
  assert.equal(es({ ...T, ozellik: { bulunduguKat: 4 } }, { ...P, ozellik: { bulunduguKat: 4 } }).kriterler.find((x) => x.anahtar === "istenenKatlar")!.sonuc, "SAGLANDI");
});

test("eşleştirme: takas bonusu yalnızca iki taraf da açıksa; uygunluğu bozmaz; tavan 100", () => {
  // v3.17 — eksik veri cezası bonusu yutmasın diye alanları dolu kayıtlar kullanılır
  const T2: OnizlemeKayit = { ...T, maxFiyat: 6_000_000, minM2: 100, odaSayisi: "2+1", ozellik: { asansor: true }, lokasyonlar: [{ ilId: 7, ilceId: 1, mahalleId: 5, altBolgeId: null, birincil: false }] };
  const P2: OnizlemeKayit = { ...P, fiyat: 5_800_000, m2: 110, odaSayisi: "2+1", ozellik: { asansor: true, binaYasi: 5 }, lokasyonlar: [{ ilId: 7, ilceId: 1, mahalleId: 5, altBolgeId: null, birincil: true }] };
  const a = es(T2, P2), b = es({ ...T2, takasaAcik: true }, { ...P2, takasaAcik: true }), c = es({ ...T2, takasaAcik: true }, P2), d = es(T2, { ...P2, takasaAcik: true });
  assert.equal(c.skor, a.skor); assert.equal(d.skor, a.skor);
  assert.equal(b.skor, Math.min(100, a.skor + TAKAS_BONUS));
  assert.ok(b.kriterler.some((x) => x.anahtar === "takasaAcik" && x.sonuc === "SAGLANDI"));
  assert.equal(b.uygunluk, a.uygunluk);
  const kotu = es({ ...T2, takasaAcik: true, maxFiyat: 1_000_000 }, { ...P2, takasaAcik: true, fiyat: 9_000_000 });
  assert.notEqual(kotu.uygunluk, "SUNULABILIR");
});

test("doğrulama: istenenKatlar ve takasaAcik kabul edilir; geçersiz kat reddedilir", () => {
  const taban = { tip: "TALEP", mulkTipi: "DAIRE", islemTipi: "SATILIK", maxFiyat: 5_000_000, lokasyonlar: [{ ilId: 7, ilceId: null, mahalleId: null, altBolgeId: null, birincil: false }] } as any;
  const ok = KayitCreateSchema.safeParse({ ...taban, takasaAcik: true, ozellik: { istenenKatlar: ["0", "3", "ARA"] } });
  assert.ok(ok.success, ok.success ? "" : JSON.stringify(ok.error.issues));
  assert.equal((ok as any).data.takasaAcik, true);
  assert.ok(!KayitCreateSchema.safeParse({ ...taban, ozellik: { istenenKatlar: ["ÜST"] } }).success);
});

test("roller: 11 sistem rolü, özel rol ekleme, yeniden adlandırma, kod üretimi, bozuk kayıtlar atılır", () => {
  assert.equal(SISTEM_ROLLERI.length, 11);
  assert.deepEqual(SISTEM_ROLLERI.map(([, l]) => l), ["Alıcı", "Satıcı", "Kiracı", "Kiraya veren", "Yatırımcı", "Yatırımcı ++", "Al-sat", "Emlakçı", "Müteahhit", "Firma", "İş ortağı"]);
  const l = rolListesi([{ kod: "BANKA_PERSONELI", etiket: "Banka personeli" }, { kod: "ALICI", etiket: "Müşteri (alıcı)" }]);
  assert.equal(l.length, 12); assert.equal(l[0][1], "Müşteri (alıcı)"); assert.equal(l[11][0], "BANKA_PERSONELI");
  assert.equal(rolKoduUret("Çağrı Merkezi İşçisi", []), "CAGRI_MERKEZI_ISCISI");
  assert.equal(rolKoduUret("Alıcı", ["ALICI"]), "ALICI_2");
  assert.deepEqual(rolNormalize([{ kod: "x", etiket: "a" }, { kod: "OK_ROL", etiket: "Tamam" }, { kod: "OK_ROL", etiket: "Yine" }, 5]), [{ kod: "OK_ROL", etiket: "Tamam" }]);
});

const { kayitlar, kisiler } = ornekVeriyiKur();
const dur = (x: Partial<DepoDurumu> = {}): DepoDurumu => ({ ...(ornekVeriyiKur() as any), veriSurumu: "t", kayitlar, kisiler, testler: {}, geriBildirim: "", ayarlar: { ttl: {} as any }, ogrenilen: [], adaylar: [], aktifIceAktarma: null, iceAktarmaGecmisi: [], islenmisMesajlar: [], dosyaIzleri: {}, baglantilar: { google: bosGoogleBaglanti(), notion: bosBaglanti() }, senkronGecmisi: [], cakismalar: [], eslesmeNotlari: {}, ...x }) as DepoDurumu;
const ciz = (el: React.ReactElement, d: DepoDurumu) => renderToStaticMarkup(React.createElement(C.Provider, { value: { d, guncelle: () => {}, kayitKaydet: () => {}, bildir: () => {}, ornekHatalari: [], git: () => {}, geri: () => {}, geriVar: false, sample: null } as Ctx }, el));

test("kişiler ekranı: onay kutusu, hızlı düzenleme, toplu sil; filtreler tek 'Filtrele' menüsünde (v3.16)", () => {
  rolleriUygula([{ kod: "BANKA_PERSONELI", etiket: "Banka personeli" }]);
  const h = ciz(React.createElement(Kisiler), dur({ roller: [{ kod: "BANKA_PERSONELI", etiket: "Banka personeli" }] }));
  // v3.19: onay kutuları yalnızca "Seç" modunda çıkar; açılışta tek ince araç satırı vardır
  assert.ok(!/type="checkbox"/.test(h), "seçim modu kapalıyken onay kutusu yok"); assert.match(h, /hızlı düzenle/);
  assert.match(h, /Filtrele/, "tek filtre düğmesi");
  assert.match(h, /class="kisi-arac"/); assert.match(h, />Seç</);
  // v3.16: çip satırları artık kapalı menünün içinde — ekran açılışta sade
  assert.ok(!h.includes("Telefonu olmayanlar"), "filtre seçenekleri kapalı menüde durmalı");
  assert.equal(KISI_ROLLERI.length, 12);
  rolleriUygula([]); assert.equal(KISI_ROLLERI.length, 11);
});

test("kişiler: 'Filtrele' açılınca rol, kaynak, kayıt ve telefon seçenekleri gelir (v3.16)", async () => {
  rolleriUygula([{ kod: "BANKA_PERSONELI", etiket: "Banka personeli" }]);
  const dom = new JSDOM("<div id=k></div>", { pretendToBeVisual: true });
  (globalThis as any).window = dom.window; (globalThis as any).document = dom.window.document; (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  const { createRoot } = await import("react-dom/client"); const { act } = await import("react");
  const kok = createRoot(dom.window.document.getElementById("k")!);
  const d2 = dur({ roller: [{ kod: "BANKA_PERSONELI", etiket: "Banka personeli" }] });
  await act(async () => kok.render(React.createElement(C.Provider, { value: { d: d2, guncelle: () => {}, kayitKaydet: () => {}, bildir: () => {}, ornekHatalari: [], git: () => {}, geri: () => {}, geriVar: false, sample: null } as Ctx }, React.createElement(Kisiler))));
  const dugme = [...dom.window.document.querySelectorAll("button")].find((b) => (b.textContent ?? "").trim().startsWith("Filtrele"))!;
  await act(async () => dugme.click());
  const t = dom.window.document.getElementById("k")!.textContent!;
  for (const x of ["Banka personeli", "Alıcı", "Yatırımcı ++", "Talebi olanlar", "Telefonu olmayanlar"]) assert.ok(t.includes(x), x);
  await act(async () => kok.unmount());
  rolleriUygula([]);
});

test("ayarlar: rol yönetimi bileşeni çizilir", () => {
  const h = ciz(React.createElement(RolYonetimi), dur());
  assert.match(h, /Yeni rol ekle/); assert.match(h, /sistem rolü/);
});

test("eşleşme kartı (v3.19): işlem tipi ve mülk tipi kartta bir kez; numaralı katman etiketi yok; fırsat rozeti var", () => {
  const t = kayitlar.find((k) => k.veri.tip === "TALEP")!, p = kayitlar.find((k) => k.veri.tip === "PORTFOY")!;
  const e: any = { t, p, s: eslesmeOnizle(t.veri as any, p.veri as any, BAGLAM), f: { kademe: "NORMAL", etiket: "Normal", aciklama: "x", sira: 2, tahminiKomisyon: 100000, dogrudanTaraf: 1 } };
  const h = ciz(React.createElement(EslesmeKarti, { e }), dur());
  const et = [...h.matchAll(/class="es2-et">(.*?)<\/div>/gs)].map((m) => m[1]);
  assert.equal(et.length, 2, "talep ve portföy tarafı");
  assert.equal([...h.matchAll(/class="pill p-[^"]*">(Satılık|Kiralık|Devren[^<]*)<\/span>/g)].length, 1, "Satılık/Kiralık yalnızca bir kez");
  assert.ok(!/\d· (Web ilanı|Yetkili|CRM|Partner)/.test(h), "numaralı katman etiketi kaldırıldı");
  assert.match(h, /firsat-normal/); assert.match(h, /anahtar-btn/);
});

test("liste filtresi: takasa açık ve çoklu kat", () => {
  const f = bosFiltre({ takas: true });
  assert.equal(filtreUygula({ ...kayitlar[0].veri, takasaAcik: true } as any, f), true);
  assert.equal(filtreUygula({ ...kayitlar[0].veri, takasaAcik: null } as any, f), false);
  const fk = bosFiltre({ ozellik: { istenenKatlar: ["0", "ARA"] } });
  const por = (kat: number, ks: number) => ({ ...kayitlar.find((k) => k.veri.tip === "PORTFOY")!.veri, ozellik: { bulunduguKat: kat, katSayisi: ks } }) as any;
  assert.equal(filtreUygula(por(0, 5), fk), true); assert.equal(filtreUygula(por(3, 5), fk), true); assert.equal(filtreUygula(por(5, 5), fk), false);
  const tal = (k: string[]) => ({ ...kayitlar.find((x) => x.veri.tip === "TALEP")!.veri, ozellik: { istenenKatlar: k } }) as any;
  assert.equal(filtreUygula(tal(["3", "0"]), fk), true); assert.equal(filtreUygula(tal(["4"]), fk), false);
});

test("canlı eşleme: takasaAcik, istenenKatlar ve özel roller gidiş-dönüşte korunur", () => {
  const d = sunucudanDurum({ kayitlar: [], kisiler: [], eslesmeNotlari: {}, ayarlar: { roller: [{ kod: "X_ROL", etiket: "X rol" }, { kod: "kötü", etiket: "?" }] }, arayuz: {} });
  assert.deepEqual(d.roller, [{ kod: "X_ROL", etiket: "X rol" }]);
  const once = imzaAl(d);
  const sonra = planla(once, { ...d, roller: [...(d.roller ?? []), { kod: "Y_ROL", etiket: "Y rol" }] });
  assert.equal((sonra.parcalar[0] as any).ayarlar.roller.length, 2);
});

test("kayıt göstergesi: açılışta görünmez; kayıttan sonra 3 sn (burada 150 ms) görünüp kaybolur; hata kalır", async () => {
  const dom = new JSDOM("<div id=k></div>", { pretendToBeVisual: true });
  (globalThis as any).window = dom.window; (globalThis as any).document = dom.window.document; (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  const { createRoot } = await import("react-dom/client"); const { act } = await import("react");
  const kok = createRoot(dom.window.document.getElementById("k")!);
  const goster = async (ad: any, mesaj?: string) => act(async () => { kok.render(React.createElement(KaydetGostergesi, { s: { ad, hatalar: [], mesaj }, sureMs: 150 })); });
  const metin = () => dom.window.document.getElementById("k")!.textContent;
  await goster("kayitli"); assert.equal(metin(), "", "açılışta 'Kaydedildi' görünmemeli");
  await goster("bekliyor"); assert.match(metin()!, /Kaydedilecek/);
  await goster("kaydediliyor"); assert.match(metin()!, /Kaydediliyor/);
  await goster("kayitli"); assert.match(metin()!, /Kaydedildi ✓/);
  await act(async () => { await new Promise((r) => setTimeout(r, 260)); }); assert.equal(metin(), "", "3 sn sonra kaybolmalı");
  await goster("hata", "Kaydedilemedi: ağ"); await act(async () => { await new Promise((r) => setTimeout(r, 260)); }); assert.match(metin()!, /Kaydedilemedi/, "hata kendiliğinden kapanmamalı");
  await act(async () => kok.unmount());
});

test("ekran hafızası: geri dönüşte durum korunur, menüden girişte sıfırlanır", async () => {
  const dom = new JSDOM("<div id=k></div>", { pretendToBeVisual: true });
  (globalThis as any).window = dom.window; (globalThis as any).document = dom.window.document; (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  const { createRoot } = await import("react-dom/client"); const { act } = await import("react");
  let set: any;
  const Ekran = ({ donus }: { donus?: boolean }) => { hafizaBaslat("vg.", donus); const [v, s] = useKalici("vg.deneme", 0); set = s; return React.createElement("b", null, String(v)); };
  const el = () => dom.window.document.getElementById("k")!.textContent;
  let kok = createRoot(dom.window.document.getElementById("k")!);
  await act(async () => kok.render(React.createElement(Ekran, {}))); await act(async () => set(7)); assert.equal(el(), "7");
  await act(async () => kok.unmount());
  kok = createRoot(dom.window.document.getElementById("k")!);
  await act(async () => kok.render(React.createElement(Ekran, { donus: true }))); assert.equal(el(), "7", "geri dönüşte korunmalı");
  await act(async () => kok.unmount());
  kok = createRoot(dom.window.document.getElementById("k")!);
  await act(async () => kok.render(React.createElement(Ekran, {}))); assert.equal(el(), "0", "menüden girişte sıfırlanmalı");
  await act(async () => kok.unmount());
});
