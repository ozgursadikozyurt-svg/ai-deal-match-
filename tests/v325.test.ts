/**
 * Anahtar CRM v3.40 · 23 Ekim 2026 — Bugün panosu, İlgilenenler, kompakt form
 */
import { test as nodeTest } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { AnaSayfa, EslesmeDetay, Detay } from "../demo/app";
import { ornekVeriyiKur, bosBaglanti, bosGoogleBaglanti, DEMO_SAHIPLIK, BUGUN, type DepoDurumu } from "../demo/depo";
import { sahiplikNormalize } from "../src/lib/domain/sahiplik";
import { TTL_VARSAYILAN } from "../src/lib/domain/gecerlilik";
import { kaliciHepsiniSil } from "../demo/kalici";
import { type Ctx } from "../demo/ortak";
import { ac } from "./yardimci-arayuz";
import { SADECE_TEST_baglamiSabitle, VARSAYILAN_OFIS_ID, VARSAYILAN_KULLANICI_ID } from "../src/lib/kiracilik";
import { gunYaz, gunEkle, gorevlerNormalize, ilgilenenlerNormalize, bugunGorunumu, gorevEkle, vadeYazisi, takvimBaglantisi } from "../src/lib/domain/gorev";
import { eslesmeDurumunuUygula, gorevUlasilamadi, gorevGorusuldu, gorevIlgilenmiyor, ilgilenenKaydet, ilgilenenSil, fiyatDususuIsle, elleGorevEkle, sonrakiIletisimEkle } from "../demo/bugun-eylem";
import fs from "node:fs";
import { SURUM, SURUM_GECMISI, DOSYA_EKI } from "../src/lib/surum";

SADECE_TEST_baglamiSabitle({ ofisId: VARSAYILAN_OFIS_ID, kullaniciId: VARSAYILAN_KULLANICI_ID, rol: "OFIS_YONETICISI", eposta: "test@anahtar.local" });

const ornek = ornekVeriyiKur();
const durum = (ek: Partial<DepoDurumu> = {}): DepoDurumu => ({ veriSurumu: "t", kayitlar: ornek.kayitlar, eslesmeNotlari: {}, testler: {}, geriBildirim: "", ayarlar: { ttl: TTL_VARSAYILAN, sahiplik: sahiplikNormalize(DEMO_SAHIPLIK) }, ogrenilen: [], adaylar: [], aktifIceAktarma: null, iceAktarmaGecmisi: [], kisiler: ornek.kisiler, islenmisMesajlar: [], dosyaIzleri: {}, baglantilar: { google: bosGoogleBaglanti(), notion: bosBaglanti() }, senkronGecmisi: [], cakismalar: [], ...ek });
const test = (ad: string, f: () => unknown | Promise<unknown>) => nodeTest(ad, async () => { kaliciHepsiniSil(); await f(); });
const ctx = (d0: DepoDurumu, git: (e: any) => void = () => {}) => { const c = { d: d0, guncelle: (f: any) => { c.d = f(c.d); }, kayitKaydet: () => {}, bildir: () => {}, ornekHatalari: [], git, geri: () => {}, geriVar: false, sample: null } as unknown as Ctx; return c; };

const bugun = gunYaz(BUGUN);
const talep = () => ornek.kayitlar.find((k) => k.veri.tip === "TALEP")!;
const portfoy = () => ornek.kayitlar.find((k) => k.veri.tip === "PORTFOY")!;


test("takip (v3.40): Gösterim / Koparıldı kendiliğinden görev AÇMAZ; durum kaydedilir", () => {
  let d = durum();
  d = eslesmeDurumunuUygula(d, talep().id, portfoy().id, "GOSTERIM", {}, BUGUN);
  assert.equal(d.eslesmeNotlari[`${talep().id}~${portfoy().id}`].durum, "GOSTERIM");
  assert.equal((d.gorevler ?? []).filter((g) => g.durum === "ACIK").length, 0, "görev yalnızca sorulup onaylanınca açılır");
  d = eslesmeDurumunuUygula(d, talep().id, portfoy().id, "REDDEDILDI", { neden: "YANLIS" }, BUGUN);
  assert.equal((d.gorevler ?? []).filter((g) => g.durum === "ACIK" && g.eslesme).length, 0);
});

test("üç düğme: Ulaşılamadı → yarın; Görüşüldü → not + yeni vade; İlgilenmiyor → kapanır", () => {
  let d = elleGorevEkle(durum(), { baslik: "Ara", vade: bugun, kisiId: ornek.kisiler[0].id }, BUGUN);
  const g = d.gorevler![0];
  d = gorevUlasilamadi(d, g, BUGUN);
  assert.equal(d.gorevler![0].vade, gunEkle(bugun, 1));
  assert.equal(d.gorevler![0].deneme, 1);
  d = gorevGorusuldu(d, d.gorevler![0], { not: "Bütçe 9M", sonraki: 7 }, BUGUN);
  assert.equal(d.gorevler![0].durum, "TAMAM");
  assert.ok(d.gorevler!.some((x) => x.durum === "ACIK" && x.vade === gunEkle(bugun, 7)));
  let d2 = elleGorevEkle(durum(), { baslik: "Ara 2", vade: bugun }, BUGUN);
  d2 = gorevIlgilenmiyor(d2, d2.gorevler![0], "DIGER", "Diğer", BUGUN);
  assert.notEqual(d2.gorevler![0].durum, "ACIK");
});

test("ilgilenenler: kaydet/güncelle/sil; durum değişince görev; normalize bozuk satırı atar", () => {
  let d = durum();
  const kisi = ornek.kisiler[0].id, k = portfoy().id;
  d = ilgilenenKaydet(d, { kayitId: k, kisiId: kisi, durum: "GOSTERILDI" }, BUGUN);
  assert.equal(d.ilgilenenler!.length, 1);
  assert.equal(d.gorevler!.filter((g) => g.durum === "ACIK").length, 0, "v3.40 — ilgilenen durumu görev üretmez");
  d = ilgilenenKaydet(d, { kayitId: k, kisiId: kisi, durum: "TEKLIF" }, BUGUN);
  assert.equal(d.ilgilenenler!.length, 1);
  d = ilgilenenSil(d, d.ilgilenenler![0].id, BUGUN);
  assert.equal(d.ilgilenenler!.length, 0);
  assert.deepEqual(ilgilenenlerNormalize([{ bozuk: 1 }, null]), []);
  assert.deepEqual(gorevlerNormalize("x"), []);
});

test("fiyat düşünce önceden ilgilenenler için 'tekrar ara'", () => {
  let d = durum();
  const p = ornek.kayitlar.find((k) => k.veri.tip === "PORTFOY" && typeof k.veri.fiyat === "number")!;
  d = ilgilenenKaydet(d, { kayitId: p.id, kisiId: ornek.kisiler[0].id, durum: "GOSTERILDI" }, BUGUN);
  const yeni = { ...p, veri: { ...p.veri, fiyat: (p.veri.fiyat as number) - 100_000 } };
  const s = fiyatDususuIsle(d, p, yeni, BUGUN);
  assert.ok((s.gorevler ?? []).length > (d.gorevler ?? []).length);
  assert.equal(fiyatDususuIsle(d, p, { ...p, veri: { ...p.veri, fiyat: (p.veri.fiyat as number) + 1 } }, BUGUN), d, "artışta görev yok");
});

test("pano: Ana Sayfa üst cümlesi yok; Benim ve ofisim kartında Bugün panosu; günlük liste 15'i aşmaz", async () => {
  const c = ctx(durum({ gorevler: [], ilgilenenler: [] }));
  const e = await ac(React.createElement(AnaSayfa), c);
  assert.doesNotMatch(e.metin(), /seni bekliyor/);
  const kart = e.q(".benim-kisayol")!;
  assert.ok(kart.querySelector(".bugun"), "pano kartın içinde");
  assert.ok(e.qa(".gorev").length <= 15);
  await e.kapat();
});

test("pano: görev satırında üç düğme; Ulaşılamadı yarına atar", async () => {
  let d = elleGorevEkle(durum({ gorevler: [], ilgilenenler: [] }), { baslik: "Ahmet'i ara", vade: gunEkle(bugun, -1), kisiId: ornek.kisiler[0].id }, BUGUN);
  const c = ctx(d);
  const e = await ac(React.createElement(AnaSayfa), c);
  const satir = e.qa(".gorev").find((x) => /Ahmet'i ara/.test(x.textContent ?? ""))!;
  assert.ok(satir, "görev görünür");
  for (const t of ["Ulaşılamadı", "Görüşüldü", "İlgilenmiyor"]) assert.ok([...satir.querySelectorAll("button")].some((b) => b.textContent === t), t);
  await e.tikla([...satir.querySelectorAll("button")].find((b) => b.textContent === "Ulaşılamadı"));
  assert.equal(c.d.gorevler!.find((g) => g.baslik === "Ahmet'i ara")!.vade, gunEkle(bugun, 1));
  await e.kapat();
});

test("eşleşme detayı: Görüşüldü'ye basınca 'Bunu göreve alalım mı?' sorulur ve seçim görev olur", async () => {
  const c = ctx(durum({ gorevler: [], ilgilenenler: [] }));
  const e = await ac(React.createElement(EslesmeDetay, { tid: talep().id, pid: portfoy().id } as any), c);
  await e.tikla(e.dugme("Görüşüldü"));
  assert.match(e.metin(), /Bunu göreve alalım mı\?/);
  assert.equal(c.d.gorevler!.length, 0, "onaylanmadan görev açılmaz");
  await e.tikla(e.dugme("3 gün"));
  assert.ok(c.d.gorevler!.some((g) => g.durum === "ACIK" && g.vade === gunEkle(bugun, 3) && g.kural === "SONRAKI"));
  await e.kapat();
});

test("detay: İlgilenenler bölümü kapalı gelir, başlıkta sayı var", async () => {
  const k = portfoy();
  let d = ilgilenenKaydet(durum({ gorevler: [], ilgilenenler: [] }), { kayitId: k.id, kisiId: ornek.kisiler[0].id, durum: "SUNULDU" }, BUGUN);
  const e = await ac(React.createElement(Detay, { id: k.id } as any), ctx(d));
  const b = e.qa("details.bolum").find((x) => /İlgilenenler \(1\)/.test(x.textContent ?? ""))!;
  assert.ok(b, "bölüm var");
  assert.equal((b as HTMLDetailsElement).open, false);
  await e.kapat();
});

test("vade yazısı ve takvim bağlantısı", () => {
  assert.match(vadeYazisi(bugun, BUGUN), /Bugün/);
  assert.match(takvimBaglantisi({ baslik: "Ara", vade: bugun }), /calendar\.google\.com/);
});
