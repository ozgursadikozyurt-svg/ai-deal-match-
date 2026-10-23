/**
 * Anahtar CRM v3.42 · 23 Ekim 2026 — Dikkat şeridi (Ana Sayfa en üstü): süresi dolan / 5 gün / 14 gün, Dolanlara +30 ve Geri al
 */
import { test as nodeTest } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import fs from "node:fs";
import { AnaSayfa } from "../demo/app";
import { ornekVeriyiKur, bosBaglanti, bosGoogleBaglanti, DEMO_SAHIPLIK, BUGUN, kalanGun, type DepoDurumu, type Kayit } from "../demo/depo";
import { sahiplikNormalize } from "../src/lib/domain/sahiplik";
import { TTL_VARSAYILAN } from "../src/lib/domain/gecerlilik";
import { kaliciHepsiniSil } from "../demo/kalici";
import { ac } from "./yardimci-arayuz";
import { SADECE_TEST_baglamiSabitle, VARSAYILAN_OFIS_ID, VARSAYILAN_KULLANICI_ID } from "../src/lib/kiracilik";
import { SURUM, SURUM_GECMISI } from "../src/lib/surum";

SADECE_TEST_baglamiSabitle({ ofisId: VARSAYILAN_OFIS_ID, kullaniciId: VARSAYILAN_KULLANICI_ID, rol: "OFIS_YONETICISI", eposta: "test@anahtar.local" });
const ornek = ornekVeriyiKur();
const gun = (g: number) => new Date(BUGUN.getTime() + g * 86_400_000);
const durum = (kayitlar: Kayit[], ek: Partial<DepoDurumu> = {}): DepoDurumu => ({ veriSurumu: "t", kayitlar, eslesmeNotlari: {}, testler: {}, geriBildirim: "", ayarlar: { ttl: TTL_VARSAYILAN, sahiplik: sahiplikNormalize(DEMO_SAHIPLIK) }, ogrenilen: [], adaylar: [], aktifIceAktarma: null, iceAktarmaGecmisi: [], kisiler: ornek.kisiler, islenmisMesajlar: [], dosyaIzleri: {}, baglantilar: { google: bosGoogleBaglanti(), notion: bosBaglanti() }, senkronGecmisi: [], cakismalar: [], gorevler: [], ilgilenenler: [], ...ek });
const ctx = (d0: DepoDurumu) => { const c: any = { d: d0, guncelle: (f: any) => { c.d = f(c.d); }, kayitKaydet: () => {}, bildir: () => {}, ornekHatalari: [], git: () => {}, geri: () => {}, geriVar: false, sample: null }; return c; };
const test = (ad: string, f: () => unknown | Promise<unknown>) => nodeTest(ad, async () => { kaliciHepsiniSil(); await f(); });
const kayitlar = () => ornek.kayitlar.map((k, i) => ({ ...k, veri: { ...k.veri, durum: (i < 2 ? "EXPIRED" : "ACTIVE") as any, validUntil: i < 2 ? gun(-3) : i === 2 ? gun(4) : gun(200) } }));

test("sürüm 3.30 ve fikir raporu", () => { assert.ok(SURUM >= "3.30"); assert.ok(SURUM_GECMISI.some((x) => x.surum === "3.30")); /* v3.31'den beri en üstte değil */ assert.ok(fs.existsSync("docs/ANAHTAR_CRM_FIKIR_RAPORU_v3.30_14Ekim2026.md")); });

test("Dikkat şeridi en üstte: selamlamanın hemen ardından, Benim kartından önce; dolan + 5 gün sayıları", async () => {
  const e = await ac(React.createElement(AnaSayfa), ctx(durum(kayitlar())));
  const kok = e.q(".yigin")!;
  const cocuklar = [...kok.children];
  assert.ok(cocuklar.findIndex((x) => x.classList.contains("dikkat")) < cocuklar.findIndex((x) => x.classList.contains("benim-kisayol")));
  assert.ok(e.q(".dikkat.kotu"));
  assert.match(e.q(".dikkat")!.textContent!, /2 kaydın süresi doldu/);
  assert.match(e.q(".dikkat")!.textContent!, /1 kayıt 5 gün içinde bitiyor/);
  await e.kapat();
});

test("Dolanlara +30 → kayıtlar açılır; Geri al → eski tarih ve durum", async () => {
  const c = ctx(durum(kayitlar()));
  const e = await ac(React.createElement(AnaSayfa), c);
  await e.tikla(e.dugme("Dolanlara +30 gün"));
  assert.equal(c.d.kayitlar[0].veri.durum, "ACTIVE"); assert.equal(kalanGun(c.d.kayitlar[0].veri), 30);
  assert.equal(kalanGun(c.d.kayitlar[2].veri), 4, "dolmayanlara dokunulmaz");
  await e.tikla(e.dugme("Geri al"));
  assert.equal(c.d.kayitlar[0].veri.durum, "EXPIRED"); assert.equal(kalanGun(c.d.kayitlar[0].veri), -3);
  await e.kapat();
});

test("uyarı yoksa şerit görünmez", async () => {
  const e = await ac(React.createElement(AnaSayfa), ctx(durum(ornek.kayitlar.map((k) => ({ ...k, veri: { ...k.veri, durum: "ACTIVE" as any, validUntil: gun(200) } })))));
  assert.equal(e.q(".dikkat"), null);
  await e.kapat();
});
