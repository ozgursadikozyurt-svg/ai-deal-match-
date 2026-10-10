/**
 * Anahtar CRM v3.24 · 10 Ekim 2026 Anahtar CRM v3.19 — puanlama (eksik veri) ve fırsat önceliği */
import { test } from "node:test";
import { ac } from "./yardimci-arayuz";
import assert from "node:assert/strict";
import { eslesmeOnizle, type OnizlemeKayit } from "../src/lib/eslestirme/onizleme";
import { firsatDegerlendir } from "../src/lib/eslestirme/firsat";
import { BAGLAM, coz } from "../demo/lokasyon";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { C, type Ctx } from "../demo/ortak";
import { ornekVeriyiKur, bosBaglanti, bosGoogleBaglanti, type DepoDurumu } from "../demo/depo";
import { TTL_VARSAYILAN } from "../src/lib/domain/gecerlilik";
import { Eslesmeler } from "../demo/app";
import { Izleme } from "../demo/favori";
import { TopluKoparPenceresi } from "../demo/kopar";

const lok = (ham: string, portfoy: boolean) => coz(ham).lokasyonlar.map((l, i) => ({ ilId: l.ilId, ilceId: l.ilceId, mahalleId: l.mahalleId, altBolgeId: l.altBolgeId, birincil: portfoy && i === 0 }));
const T = (v: Partial<OnizlemeKayit> = {}): OnizlemeKayit => ({ tip: "TALEP", mulkTipi: "DAIRE", islemTipi: "SATILIK", lokasyonlar: lok("Muratpaşa / Fener", false), ...v });
const P = (v: Partial<OnizlemeKayit> = {}): OnizlemeKayit => ({ tip: "PORTFOY", mulkTipi: "DAIRE", islemTipi: "SATILIK", lokasyonlar: lok("Muratpaşa / Fener", true), ...v });
const es = (t: OnizlemeKayit, p: OnizlemeKayit) => eslesmeOnizle(t, p, BAGLAM);

test("v3.19: m², oda ve bütçe bilinmeyen eşleşme yüksek skor / 'Sunulabilir' alamaz", () => {
  const s = es(T(), P());
  assert.ok(s.skor < 70, `skor ${s.skor}`);
  assert.notEqual(s.uygunluk, "SUNULABILIR");
});
test("v3.19: bütçe karşılaştırılamıyorsa en fazla 'Koşullu'", () => {
  const s = es(T({ odaSayisi: "2+1", minM2: 80, maxM2: 120 }), P({ odaSayisi: "2+1", m2: 100 }));
  assert.equal(s.uygunluk, "KOSULLU");
});
test("v3.19: tam veri aynı konumda hâlâ yüksek skor ve 'Sunulabilir'", () => {
  const s = es(T({ odaSayisi: "2+1", minM2: 80, maxM2: 120, maxFiyat: 6_000_000 }), P({ odaSayisi: "2+1", m2: 100, fiyat: 5_000_000 }));
  assert.equal(s.uygunluk, "SUNULABILIR");
  assert.ok(s.skor >= 85, `skor ${s.skor}`);
});
test("v3.19: eksik veri ile tam veri arasında belirgin skor farkı var", () => {
  const eksik = es(T({ maxFiyat: 6_000_000 }), P({ fiyat: 5_000_000 })).skor;
  const tam = es(T({ odaSayisi: "2+1", minM2: 80, maxM2: 120, maxFiyat: 6_000_000 }), P({ odaSayisi: "2+1", m2: 100, fiyat: 5_000_000 })).skor;
  assert.ok(tam - eksik >= 15, `${tam} vs ${eksik}`);
});

test("fırsat: mülk sahibi ↔ doğrudan müşteri öncelikli; emlakçı ↔ emlakçı düşük", () => {
  const o = firsatDegerlendir("MUSTERI", "SAHIP", { islemTipi: "SATILIK", fiyat: 5_000_000 });
  const n = firsatDegerlendir("MUSTERI", "EMLAKCI", { islemTipi: "SATILIK", fiyat: 5_000_000 });
  const d = firsatDegerlendir("EMLAKCI", "EMLAKCI", { islemTipi: "SATILIK", fiyat: 5_000_000 });
  assert.deepEqual([o.kademe, n.kademe, d.kademe], ["ONCELIKLI", "NORMAL", "DUSUK"]);
  assert.ok(o.sira > n.sira && n.sira > d.sira);
  assert.equal(o.tahminiKomisyon, 200_000);
  assert.equal(n.tahminiKomisyon, 150_000);
  assert.equal(d.tahminiKomisyon, 100_000);
});
test("fırsat: küçük kiralıkta emlakçı↔emlakçı komisyonu çok düşük, fiyat yoksa null", () => {
  assert.equal(firsatDegerlendir("EMLAKCI", "EMLAKCI", { islemTipi: "KIRALIK", fiyat: 20_000 }).tahminiKomisyon, 20_000);
  assert.equal(firsatDegerlendir("MUSTERI", "WEB_SAHIBI", { islemTipi: "SATILIK" }).tahminiKomisyon, null);
  assert.equal(firsatDegerlendir("MUSTERI", "WEB_OFIS", { islemTipi: "SATILIK" }).kademe, "NORMAL");
});

import { anahtarKumesi, tekrarAnahtarlari, zatenVar, tekrarNedeni, type TekrarVeri } from "../src/lib/ingest/tekrar";
const lk = [{ ilceId: 7, mahalleId: 70 }];
const V = (v: Partial<TekrarVeri> = {}): TekrarVeri => ({ tip: "TALEP", mulkTipi: "DAIRE", islemTipi: "SATILIK", odaSayisi: "2+1", maxFiyat: 5_000_000, lokasyonlar: lk, ...v });

test("mükerrer: fiyat birkaç bin TL farklı olsa da aynı kişi + aynı özellik 'zaten var'", () => {
  const k = anahtarKumesi([{ veri: V(), kisiAdi: "Ali Yılmaz" }]);
  assert.ok(zatenVar(k, V({ maxFiyat: 5_050_000 }), "Ali Yılmaz"));
  assert.ok(zatenVar(k, V({ maxFiyat: 4_950_000 }), "ali yılmaz"));
  assert.ok(!zatenVar(k, V({ maxFiyat: 6_500_000 }), "Ali Yılmaz"), "çok farklı bütçe başka talep");
  assert.ok(!zatenVar(k, V({ odaSayisi: "3+1" }), "Ali Yılmaz"));
});
test("mükerrer: kişi adı farklı yazılsa bile aynı telefon yakalanır; farklı telefon + farklı ad yakalanmaz", () => {
  const k = anahtarKumesi([{ veri: V({ gondeTelefon: "0532 111 22 33" }), kisiAdi: "Ali Yılmaz" }]);
  assert.ok(zatenVar(k, V({ gondeTelefon: "+90 532 111 22 33" }), "A. Yılmaz"));
  assert.ok(!zatenVar(k, V({ gondeTelefon: "0555 999 88 77" }), "Veli Kaya"));
});
test("mükerrer: portal ilan no en güçlü kanıt ve nedeni okunur", () => {
  const k = anahtarKumesi([{ veri: V({ tip: "PORTFOY", portalIlanNo: "1317953785" }), kisiAdi: null }]);
  const iz = tekrarAnahtarlari(V({ tip: "PORTFOY", portalIlanNo: "1317953785", maxFiyat: 1 }), null).find((x) => k.has(x))!;
  assert.match(tekrarNedeni(iz), /portal ilanı/);
});

import { hizliAyristir } from "../src/lib/ai/hizli-ayristirici";
import { odaListesi } from "../src/lib/domain/teknik-alanlar";
import { SADECE_TEST_baglamiSabitle, VARSAYILAN_OFIS_ID, VARSAYILAN_KULLANICI_ID } from "../src/lib/kiracilik";
// v3.20 — çok ofisli: testler varsayılan ofisin bağlamında çalışır (göçte açılan Özyurtlar Gayrimenkul)
SADECE_TEST_baglamiSabitle({ ofisId: VARSAYILAN_OFIS_ID, kullaniciId: VARSAYILAN_KULLANICI_ID, rol: "OFIS_YONETICISI", eposta: "test@anahtar.local" });

test("oda çoklu seçim: metinden okuma, ayrıştırma ve puanlama (en iyi seçenek)", () => {
  assert.equal(hizliAyristir("Fener'de 2+1 veya 3+1 daire arıyorum 5 milyon").odaSayisi, "2+1, 3+1");
  assert.deepEqual(odaListesi("2+1, 3+1").map((x) => x.oda), [2, 3]);
  const t = T({ odaSayisi: "2+1, 3+1", minM2: 80, maxM2: 120, maxFiyat: 6_000_000 });
  const p3 = es(t, P({ odaSayisi: "3+1", m2: 100, fiyat: 5_000_000 })), p4 = es(t, P({ odaSayisi: "4+1", m2: 100, fiyat: 5_000_000 }));
  assert.equal(p3.kriterler.find((k) => k.anahtar === "odaSayisi")!.puan, 1, "3+1 seçeneklerden biri → tam puan");
  assert.ok(p3.skor > p4.skor);
});

test("ara kat: portföy 'ara kat' yazmasa da kat/kat sayısından hesaplanır; tutmuyorsa puan düşer", () => {
  const t = T({ odaSayisi: "2+1", minM2: 80, maxM2: 120, maxFiyat: 6_000_000, ozellik: { istenenKatlar: ["ARA"] } });
  const k = (kat: number, ks: number | undefined) => es(t, P({ odaSayisi: "2+1", m2: 100, fiyat: 5_000_000, ozellik: { bulunduguKat: kat, ...(ks ? { katSayisi: ks } : {}) } }));
  const ara = k(4, 9), son = k(9, 9), zemin = k(0, 9), bilinmeyen = k(4, undefined);
  const satir = (s: ReturnType<typeof k>) => s.kriterler.find((x) => x.anahtar === "istenenKatlar")!;
  assert.equal(satir(ara).sonuc, "SAGLANDI");
  assert.match(satir(ara).portfoy, /4\/9 · ara kat/);
  assert.equal(satir(son).sonuc, "SAGLANMADI");
  assert.equal(satir(zemin).sonuc, "SAGLANMADI");
  assert.equal(satir(bilinmeyen).sonuc, "BILINMIYOR");
  assert.ok(ara.skor > son.skor && ara.skor >= bilinmeyen.skor);
});

test("eksik veri uyarısı: oda sayısı yalnızca konutta istenir (arsa/depo için 'oda sayısı yok' denmez)", () => {
  const arsa = es(T({ mulkTipi: "ARSA" as any, minM2: 800, maxM2: 1200, maxFiyat: 6_000_000 }), P({ mulkTipi: "ARSA" as any, m2: 1000, fiyat: 5_000_000 }));
  assert.ok(!arsa.veriEksikleri.some((x) => /oda/.test(x)), arsa.veriEksikleri.join());
  const daire = es(T({ maxFiyat: 6_000_000 }), P({ fiyat: 5_000_000 }));
  assert.ok(daire.veriEksikleri.some((x) => /oda/.test(x)));
});


// ───── arayüz (sunucu tarafında çizim) ─────
const ornek = ornekVeriyiKur();
const durum = (favoriler: string[] = []): DepoDurumu => ({ veriSurumu: "t", kayitlar: ornek.kayitlar, eslesmeNotlari: {}, testler: {}, geriBildirim: "", ayarlar: { ttl: TTL_VARSAYILAN }, ogrenilen: [], adaylar: [], aktifIceAktarma: null, iceAktarmaGecmisi: [], kisiler: ornek.kisiler, islenmisMesajlar: [], dosyaIzleri: {}, baglantilar: { google: bosGoogleBaglanti(), notion: bosBaglanti() }, senkronGecmisi: [], cakismalar: [], googleBekleyen: [], favoriler } as DepoDurumu);
const cizUI = (el: React.ReactElement, d = durum()) => renderToStaticMarkup(React.createElement(C.Provider, { value: { d, guncelle: () => {}, kayitKaydet: () => {}, bildir: () => {}, ornekHatalari: [], git: () => {}, geri: () => {}, geriVar: false, sample: null } as Ctx }, el));

test("eşleşmeler ekranı: fırsat seçici + kademe filtresi + toplu kopar menüsü; kartlarda fırsat rozeti ve anahtar", async () => {
  const h = cizUI(React.createElement(Eslesmeler));
  assert.match(h, /<small>Fırsat<\/small>/); // v3.22: dört seçici tek satıra sığsın diye kısa ad
  assert.match(h, /pill firsat/); assert.match(h, /anahtar-btn/);
  // v3.21.2 — kademeler ve toplu işlemler artık açılır menülerde
  const a = await ac(React.createElement(Eslesmeler), { d: durum(), guncelle: () => {}, kayitKaydet: () => {}, bildir: () => {}, ornekHatalari: [], git: () => {}, geri: () => {}, geriVar: false, sample: null } as Ctx);
  await a.tikla(a.qa(".hs-satir .hs-btn")[1]);
  const kademeler = a.qa(".hs-menu .hs-oge").map((x) => x.textContent ?? "").join("|");
  assert.match(kademeler, /Öncelikli/); assert.match(kademeler, /Normal/); assert.match(kademeler, /Düşük/);
  assert.ok(a.qa(".hs-menu .hs-oge .hs-n").length >= 4, "her kademenin adedi görünür");
  await a.tikla(a.qa(".hs-satir .hs-btn")[1]); // kapat
  await a.tikla(a.q(".hs-btn.ikon"));
  assert.match(a.metin(), /Listedekilerin tümünü kopar \(\d+\)/);
  await a.tikla(a.dugme("Seç"));
  assert.ok(a.q(".toplu-bar"), "Seç modunda toplu işlem çubuğu açılır"); assert.match(a.metin(), /Seçilenleri kopar \(0\)/);
  await a.kapat();
});
test("izleme ekranı: boşken yönlendirir; anahtarlı talep / portföy listelenir", () => {
  assert.match(cizUI(React.createElement(Izleme)), /Henüz izlemede bir şey yok/);
  const t = ornek.kayitlar.find((k) => k.veri.tip === "TALEP")!, p = ornek.kayitlar.find((k) => k.veri.tip === "PORTFOY")!;
  const h = cizUI(React.createElement(Izleme), durum(["t:" + t.id, "p:" + p.id]));
  assert.match(h, /Talepler \(1\)/); assert.match(h, /Portföyler \(1\)/); assert.match(h, /aria-pressed="true"/);
});
test("toplu kopar penceresi: sayı, neden seçenekleri; geri alma modunda neden sorulmaz", () => {
  const c = [{ tid: "a", pid: "b" }, { tid: "c", pid: "d" }];
  const h = cizUI(React.createElement(TopluKoparPenceresi, { ciftler: c, onKapat: () => {}, onBitti: () => {} }));
  assert.match(h, /2 eşleşmeyi kopar/); assert.match(h, /type="radio"/); assert.match(h, /Koparmayı onayla/);
  const g = cizUI(React.createElement(TopluKoparPenceresi, { ciftler: c, geriAl: true, onKapat: () => {}, onBitti: () => {} }));
  assert.match(g, /2 eşleşmeyi geri al/); assert.ok(!/type="radio"/.test(g));
});
