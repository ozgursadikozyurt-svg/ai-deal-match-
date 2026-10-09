/**
 * Anahtar CRM v3.22.1 · 9 Ekim 2026
 * v3.22 — "HARİÇ" bölge · bütçesiz talebin skoru · Benim / Ofisim işareti ve süzgeci · portföy kartında küçük fotoğraf ·
 * Eşleşmeler'de yatay skor şeridi.
 */
import { test as nodeTest } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { C, type Ctx } from "../demo/ortak";
import { ornekVeriyiKur, bosBaglanti, bosGoogleBaglanti, DEMO_SAHIPLIK, type DepoDurumu, type Kayit } from "../demo/depo";
import { TTL_VARSAYILAN } from "../src/lib/domain/gecerlilik";
import { Eslesmeler, Liste, AnaSayfa } from "../demo/app";
import { yorumla } from "../src/lib/ai/yorumlayici";
import { INDEKS, BAGLAM, lokEtiket, konumOzeti } from "../demo/lokasyon";
import { satirKur } from "../demo/ai-kutusu";
import { haricDegistir } from "../demo/form";
import { haricBirlestir } from "../src/lib/lokasyon/haric";
import { eslesmeOnizle, FIYATSIZ_CARPAN } from "../src/lib/eslestirme/onizleme";
import { KayitCreateSchema } from "../src/lib/validation/kayit";
import { sahiplikKimligi, sahiplikOf, sahiplikNormalize, telAnahtar } from "../src/lib/domain/sahiplik";
import { SahiplikAyarlari, SahiplikSecici } from "../demo/sahiplik";
import { KapakKucuk } from "../demo/fotograflar";
import { kaliciHepsiniSil, kaliciOku } from "../demo/kalici";
import { SADECE_TEST_baglamiSabitle, VARSAYILAN_OFIS_ID, VARSAYILAN_KULLANICI_ID } from "../src/lib/kiracilik";
import { ac } from "./yardimci-arayuz";
SADECE_TEST_baglamiSabitle({ ofisId: VARSAYILAN_OFIS_ID, kullaniciId: VARSAYILAN_KULLANICI_ID, rol: "OFIS_YONETICISI", eposta: "test@anahtar.local" });

const ornek = ornekVeriyiKur();
const durum = (ek: Partial<DepoDurumu> = {}): DepoDurumu => ({ veriSurumu: "t", kayitlar: ornek.kayitlar, eslesmeNotlari: {}, testler: {}, geriBildirim: "", ayarlar: { ttl: TTL_VARSAYILAN, sahiplik: sahiplikNormalize(DEMO_SAHIPLIK) }, ogrenilen: [], adaylar: [], aktifIceAktarma: null, iceAktarmaGecmisi: [], kisiler: ornek.kisiler, islenmisMesajlar: [], dosyaIzleri: {}, baglantilar: { google: bosGoogleBaglanti(), notion: bosBaglanti() }, senkronGecmisi: [], cakismalar: [], googleBekleyen: [], favoriler: [], ...ek } as DepoDurumu);
const ctx = (d = durum(), ek: Partial<Ctx> = {}): Ctx => ({ d, guncelle: () => {}, kayitKaydet: () => {}, bildir: () => {}, ornekHatalari: [], git: () => {}, geri: () => {}, geriVar: false, sample: null, ...ek } as Ctx);
const ciz = (el: React.ReactElement, c = ctx()) => renderToStaticMarkup(React.createElement(C.Provider, { value: c }, el));
const test = (ad: string, f: () => unknown | Promise<unknown>) => nodeTest(ad, async () => { kaliciHepsiniSil(); await f(); });
const kayit = (oid: string) => ornek.kayitlar.find((k) => k.id === oid)!;
const d0: any = { ayarlar: { ttl: undefined } };
const taslak = (m: string) => { const y = yorumla(m, INDEKS); return satirKur(y.parcalar[0], y, "OTO", d0, new Set(), new Set(), null, () => []); };

// ───── 1) HARİÇ ─────
test("örnek veri şemadan ve konum çözücüden hatasız geçer (yeni T14, T15, P14, P15 dahil)", () => {
  assert.deepEqual(ornek.hatalar, []);
  for (const o of ["T14", "T15", "P14", "P15"]) assert.ok(kayit(o), o);
});
test("haricBirlestir: mahalle hariçse ilçesi aranan bölge olur; ilçe zaten varsa eklenmez; hariçle aynı aranan çıkar", () => {
  const K = 104, HURMA = { ilId: 7, ilceId: K, mahalleId: 584, altBolgeId: null, birincil: false }, SARISU = { ilId: 7, ilceId: K, mahalleId: 588, altBolgeId: null, birincil: false };
  const r = haricBirlestir([], [HURMA, SARISU]);
  assert.deepEqual(r.map((l) => [l.ilceId, l.mahalleId, !!l.haric]), [[K, null, false], [K, 584, true], [K, 588, true]]);
  type L = { ilId: number; ilceId: number | null; mahalleId: number | null; altBolgeId: number | null; birincil: boolean };
  const lara: L = { ilId: 7, ilceId: 108, mahalleId: null, altBolgeId: 1, birincil: false }, mp: L = { ilId: 7, ilceId: 108, mahalleId: null, altBolgeId: null, birincil: false };
  assert.equal(haricBirlestir([mp], [lara]).filter((l) => !l.haric).length, 1, "Muratpaşa varken ikinci kez eklenmez");
  const kepez: L = { ilId: 7, ilceId: 103, mahalleId: null, altBolgeId: null, birincil: false };
  assert.deepEqual(haricBirlestir([kepez, mp], [kepez]).map((l) => [l.ilceId, !!l.haric]), [[108, false], [103, true]], "Kepez hariç → aranandan çıkar");
});
test("'Hurma, Sarısu HARİÇ' mesajı: Konyaaltı aranır, Hurma ve Sarısu hariç satırı olur; başlık bunu söyler", () => {
  const s = taslak("Hurma, Sarısu HARİÇ 2+1 en az 90 m2 satılık daire arıyorum müşterim var bütçe 7.500.000");
  assert.deepEqual(s.hatalar, []);
  assert.deepEqual(s.veri!.lokasyonlar.map(lokEtiket), ["Konyaaltı", "Konyaaltı / Hurma hariç", "Konyaaltı / Sarısu hariç"]);
  assert.match(s.veri!.baslik ?? "", /^Konyaaltı \(Hurma, Sarısu hariç\) 2\+1/);
  // "Konyaaltında … dışında" ve "Lara hariç Muratpaşa" da aynı kuralla
  assert.deepEqual(taslak("Konyaaltında Hurma ve Sarısu dışında 3+1 kiralık daire aranıyor 30 bin").veri!.lokasyonlar.filter((l: any) => l.haric).length, 2);
  const lara = taslak("Lara hariç Muratpaşa'da kiralık dükkan arıyorum 50 bin").veri!;
  assert.deepEqual(lara.lokasyonlar.map(lokEtiket), ["Muratpaşa", "Lara hariç"]);
});
test("eşleştirme: hariç bölgedeki portföy kesin elenir (bölge esnek olsa da); ilçenin geri kalanı gelir", () => {
  const t = kayit("T14").veri;
  const hurma = eslesmeOnizle(t as any, kayit("P11").veri as any, BAGLAM);
  assert.equal(hurma.uygunluk, "UYGUN_DEGIL"); assert.ok(hurma.kritikEngeller.includes("Hariç tutulan bölge")); assert.match(hurma.lokasyonAciklama, /hariç/);
  const esnek = eslesmeOnizle({ ...t, ozellik: { esnekKriterler: ["LOKASYON"] } } as any, kayit("P11").veri as any, BAGLAM);
  assert.equal(esnek.uygunluk, "UYGUN_DEGIL", "bölge esnek denmiş olsa da hariç hariçtir");
  const liman = eslesmeOnizle(t as any, kayit("P14").veri as any, BAGLAM);
  assert.notEqual(liman.uygunluk, "UYGUN_DEGIL"); assert.ok(liman.skor >= 80, String(liman.skor));
});
test("kayıt şeması: hariç yalnızca true olarak yazılır; eski kayıtlarda alan oluşmaz", () => {
  const v = KayitCreateSchema.parse({ tip: "TALEP", mulkTipi: "DAIRE", islemTipi: "SATILIK", lokasyonlar: [{ ilId: 7, ilceId: 104 }, { ilId: 7, ilceId: 104, mahalleId: 584, haric: true }] });
  assert.equal(v.lokasyonlar[1].haric, true); assert.ok(!("haric" in v.lokasyonlar[0]));
  assert.ok(!KayitCreateSchema.safeParse({ tip: "TALEP", mulkTipi: "DAIRE", islemTipi: "SATILIK", lokasyonlar: [{ ilId: 7, ilceId: 104, haric: false }] }).success, "false yazılmaz (alan hiç olmamalı)");
});
test("form: bir konumu 'hariç tut' → ilçesi aranana eklenir; 'dahil et' geri alır; özet tek satır", () => {
  const lok: any[] = [{ ilId: 7, ilceId: 104, mahalleId: 584, altBolgeId: null, birincil: false }];
  const h = haricDegistir(lok, 0);
  assert.deepEqual(h.map(lokEtiket), ["Konyaaltı", "Konyaaltı / Hurma hariç"]);
  assert.equal(konumOzeti(h), "Konyaaltı (Hurma hariç)");
  assert.deepEqual(haricDegistir(h, 1).map(lokEtiket), ["Konyaaltı", "Konyaaltı / Hurma"]);
});

// ───── 2) Bütçesiz talep ─────
test("bütçesiz talep: fiyat ölçülemediği için skor ×0,75 (≤ 69, Koşullu); aynı talep bütçeyle 100", () => {
  const p = kayit("P14").veri as any;
  const tam = eslesmeOnizle({ ...(kayit("T15").veri as any), maxFiyat: 9_000_000 }, p, BAGLAM);
  const butcesiz = eslesmeOnizle(kayit("T15").veri as any, p, BAGLAM);
  assert.equal(tam.skor, 100);
  assert.ok(butcesiz.skor <= 69 && butcesiz.skor >= 55, String(butcesiz.skor)); assert.equal(butcesiz.uygunluk, "KOSULLU");
  assert.ok(butcesiz.veriEksikleri.includes("talepte bütçe yok"));
  // çarpan sırayı korur: m²'si de eksik talep daha aşağıda
  const m2siz = eslesmeOnizle({ ...(kayit("T15").veri as any), minM2: null }, p, BAGLAM);
  assert.ok(m2siz.skor < butcesiz.skor, `${m2siz.skor} < ${butcesiz.skor}`);
  // portföyde fiyat yoksa da aynı kural
  assert.ok(eslesmeOnizle({ ...(kayit("T15").veri as any), maxFiyat: 9_000_000 }, { ...p, fiyat: null }, BAGLAM).skor <= 69);
  assert.equal(FIYATSIZ_CARPAN, 0.75);
});
test("örnek veride bütçesiz hiçbir eşleşme 70'e ulaşmaz", () => {
  const talepler = ornek.kayitlar.filter((k) => k.veri.tip === "TALEP" && k.veri.maxFiyat == null);
  assert.ok(talepler.length >= 1);
  for (const t of talepler) for (const p of ornek.kayitlar.filter((k) => k.veri.tip === "PORTFOY")) {
    const s = eslesmeOnizle(t.veri as any, p.veri as any, BAGLAM);
    assert.ok(s.skor < 70, `${t.id}~${p.id}: ${s.skor}`);
  }
});

// ───── 3) Benim / Ofisim ─────
test("sahiplik: imzadaki telefon → Benim; ofis firma adı → Ofisim; elle işaret her şeyin önünde", () => {
  const k = sahiplikKimligi(sahiplikNormalize(DEMO_SAHIPLIK), { adSoyad: "Özgür Özyurt", telefon: "0530 936 54 27", firma: "" });
  assert.equal(telAnahtar("0530 936 54 27"), telAnahtar("+905309365427"));
  assert.deepEqual(sahiplikOf(kayit("P14").veri as any, [], k), { tur: "BENIM", neden: "TELEFON" });
  assert.deepEqual(sahiplikOf(kayit("P15").veri as any, [], k), { tur: "OFIS", neden: "FIRMA" });
  assert.equal(sahiplikOf(kayit("P11").veri as any, [], k).tur, null);
  assert.deepEqual(sahiplikOf({ ...(kayit("P14").veri as any), isaret: "DIS" }, [], k), { tur: null, neden: "ISARET" });
  assert.equal(sahiplikOf({ ...(kayit("P11").veri as any), isaret: "BENIM" }, [], k).tur, "BENIM");
  // bağlı kişinin telefonu da sayılır; ad tam kelime olarak geçmeli ("Özgür" tek başına yetmez)
  assert.equal(sahiplikOf({ gondeAdi: "Kim" }, [{ telefon: "+90 530 936 54 27" }], k).tur, "BENIM");
  assert.equal(sahiplikOf({ gondeAdi: "Özgür Bey" }, [], k).tur, null);
  assert.equal(sahiplikOf({ gondeAdi: "Özgür Özyurt Emlak" }, [], k).tur, "BENIM");
  // ofis ekibinin telefonu
  const k2 = sahiplikKimligi(sahiplikNormalize({ ofisTelefonlar: ["+905550000111"] }), null);
  assert.deepEqual(sahiplikOf(kayit("P11").veri as any, [], k2), { tur: "OFIS", neden: "TELEFON" });
});
test("Portföyler: ★ Benim / ◆ Ofisim çipleri listeyi süzer; kartlarda rozet görünür", async () => {
  const a = await ac(React.createElement(Liste, { tip: "PORTFOY" }), ctx());
  assert.ok(a.q(".sahip-cipler"));
  const toplam = a.qa(".kayit-kart").length;
  assert.ok(a.qa(".sahip-rozet.benim").length >= 1 && a.qa(".sahip-rozet.ofis").length >= 1);
  await a.tikla(a.dugme(/^★ Benim \(/));
  const benim = a.qa(".kayit-kart");
  assert.ok(benim.length >= 1 && benim.length < toplam); assert.ok(benim.every((k) => k.querySelector(".sahip-rozet.benim")));
  assert.equal((kaliciOku("liste.PORTFOY.f") as any).sahiplik, "BENIM", "süzgeç korunur");
  assert.ok(a.qa(".aktif-filtreler .cip").some((c) => /Benim/.test(c.textContent ?? "")), "aktif süzgeç çipi");
  await a.tikla(a.dugme(/^◆ Ofisim \(/));
  assert.ok(a.qa(".kayit-kart").length > benim.length, "Ofisim = benim + ofisin");
  await a.tikla(a.dugme(/^Diğer \(/));
  assert.ok(a.qa(".kayit-kart").every((k) => !k.querySelector(".sahip-rozet")));
  await a.kapat();
});
test("Ana Sayfa: Benim ve ofisim kısayolları sayıları gösterir ve hazır süzgeçle listeye götürür", async () => {
  const gidilen: any[] = [];
  const a = await ac(React.createElement(AnaSayfa), ctx(durum(), { git: (e: any) => gidilen.push(e) }));
  const ogeler = a.qa(".benim-kisayol .bk-oge");
  assert.equal(ogeler.length, 4);
  await a.tikla(ogeler[1]);                                                                // Portföyüm
  assert.equal(gidilen[0].ad, "liste"); assert.equal(gidilen[0].tip, "PORTFOY"); assert.equal(gidilen[0].filtre.sahiplik, "BENIM");
  assert.match(ogeler[1].textContent ?? "", /^1Portföyüm/);
  await a.kapat();
});
test("Eşleşmeler: 'Kimin' seçicisi — Benim / Ofisim / Portföyüm / Talebim", async () => {
  const a = await ac(React.createElement(Eslesmeler), ctx());
  await a.tikla(a.dugme(/^Uygun \(/)); const once = a.qa(".es2").length;
  await a.tikla(a.qa(".hs-satir .hs-btn")[2]);
  await a.tikla(a.qa(".hs-menu .hs-oge").find((x) => /^Portföyüm/.test(x.textContent ?? "")));
  const sonra = a.qa(".es2");
  assert.ok(sonra.length >= 1 && sonra.length < once, `${sonra.length} / ${once}`);
  assert.ok(sonra.every((k) => k.querySelector(".es2-taraf.p .sahip-rozet.benim")), "her kartta portföy benim");
  assert.equal(kaliciOku("eslesmeler.kimin"), "BENIM_PORTFOY");
  assert.ok(a.qa(".aktif-filtreler .cip").some((c) => /Portföyüm/.test(c.textContent ?? "")));
  await a.kapat();
});
test("kayıt detayı: Kimin? seçicisi elle işaret koyar ve 'Otomatik'e döner", async () => {
  const kayitlar: Kayit[] = [];
  const k = kayit("P11");
  const a = await ac(React.createElement(SahiplikSecici, { k }), ctx(durum(), { kayitKaydet: (x: Kayit) => kayitlar.push(x) }));
  assert.match(a.metin(), /Benim \/ ofisim değil/);
  await a.tikla(a.dugme("★ Benim")); assert.equal(kayitlar[0].veri.isaret, "BENIM");
  await a.kapat();
  const b = await ac(React.createElement(SahiplikSecici, { k: { ...k, veri: { ...k.veri, isaret: "BENIM" } } as Kayit }), ctx(durum(), { kayitKaydet: (x: Kayit) => kayitlar.push(x) }));
  assert.match(b.metin(), /elle işaretlendi/);
  await b.tikla(b.dugme("Otomatik")); assert.ok(!("isaret" in kayitlar[1].veri), "işaret kalktı");
  await b.kapat();
});
test("Ayarlar › Benim ve ofisim: telefon yazınca listeye girer; kişi adından ad + telefon eklenir", async () => {
  let d = durum();
  const guncelle = (f: (x: DepoDurumu) => DepoDurumu) => { d = f(d); };
  const a = await ac(React.createElement(SahiplikAyarlari), ctx(d, { guncelle } as any));
  assert.match(a.metin(), /1 kayıt sizin · 1 kayıt ofisinizin/);
  await a.yaz(a.q("#sh-benim"), "0532 111 22 33");
  await a.tikla(a.dugme("Telefonu ekle"));
  assert.deepEqual(d.ayarlar.sahiplik!.benimTelefonlar, ["+905321112233"]);
  await a.kapat();
  const b = await ac(React.createElement(SahiplikAyarlari), ctx(d, { guncelle } as any));
  await b.yaz(b.q("#sh-ofis"), "Ayşe");
  await b.tikla(b.qa(".sahip-liste .kisi-satir")[0]);
  assert.ok(d.ayarlar.sahiplik!.ofisTelefonlar.includes("+905550000111")); assert.ok(d.ayarlar.sahiplik!.ofisAdlar.some((x) => /Ayşe/.test(x)));
  await b.kapat();
});

// ───── 4) Portföy kartında küçük fotoğraf ─────
test("fotoğrafı olan portföy kartında tek küçük kapak (adet rozetli); fotoğrafsızda hiç yer kaplamaz", () => {
  const p = kayit("P14");
  const fotolu = { ...p, fotolar: [{ id: "f1", ad: "a.jpg", en: 800, boy: 600, boyut: 1000 }, { id: "f2", ad: "b.jpg", en: 800, boy: 600, boyut: 1000 }] } as Kayit;
  const h = ciz(React.createElement(KapakKucuk, { k: fotolu }));
  assert.match(h, /class="kapak-kucuk"/); assert.match(h, /kapak-say">2</);
  assert.equal(ciz(React.createElement(KapakKucuk, { k: p })), "");
  const liste = ciz(React.createElement(Liste, { tip: "PORTFOY" }), ctx(durum({ kayitlar: ornek.kayitlar.map((k) => (k.id === "P14" ? fotolu : k)) })));
  assert.equal((liste.match(/class="kapak-kucuk"/g) ?? []).length, 1);
  assert.match(liste, /kk-govde fotolu/);
  assert.ok(!/▣ \d+ foto/.test(liste), "eski '▣ N foto' rozeti yerine kapak");
});
