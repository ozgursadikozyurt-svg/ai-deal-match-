/**
 * Anahtar CRM v3.40 · 23 Ekim 2026
 * v3.33 — eşleştirme puanı: şartı bilinmeyen alta iner, kat uymuyorsa liste sonu, kW = kVA = kwa, ilan metninden güç;
 * bina yaşı "7-8 yaşına kadar" → 8; Eşleşmeler'de mülk türü / işlem süzgeci portföye uygulanır.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { eslesmeOnizle, metindenGuc, SART_BILINMEYEN_SKOR_TAVANI, KAT_UYMUYOR_SKOR_TAVANI, type OnizlemeKayit, type LokasyonBaglami } from "../src/lib/eslestirme/onizleme";
import { binaYasiOku } from "../src/lib/ai/jargon";
import { hizliAyristir } from "../src/lib/ai/hizli-ayristirici";
import { kvaToKw } from "../src/lib/domain/teknik-alanlar";
import { SURUM, SURUM_GECMISI } from "../src/lib/surum";

const B: LokasyonBaglami = { komsuIlceler: new Set(), altBolgeMahalleleri: new Map() };
const lok = [{ ilId: 7, ilceId: 100, mahalleId: 5000, birincil: true }];
const depoTalep = (ek: Partial<OnizlemeKayit> = {}): OnizlemeKayit => ({ tip: "TALEP", mulkTipi: "DEPO_ANTREPO", islemTipi: "KIRALIK", minM2: 1000, maxFiyat: 200_000, fiyatPeriyodu: "AYLIK", lokasyonlar: lok, ozellik: { kritikKriterler: ["ELEKTRIK"], elektrikGucuKw: 50 }, ...ek });
const depo = (ek: Partial<OnizlemeKayit> = {}, oz: Record<string, unknown> = {}): OnizlemeKayit => ({ tip: "PORTFOY", mulkTipi: "DEPO_ANTREPO", islemTipi: "KIRALIK", m2: 1100, fiyat: 195_000, fiyatPeriyodu: "AYLIK", lokasyonlar: lok, baslik: "DEEPOYA VE HAVALİMANINA ÇOK YAKIN 1100M2 KİRALIK DEPO", ozellik: oz, ...ek });

test("sürüm 3.33", () => { assert.ok(SURUM >= "3.33"); assert.ok(SURUM_GECMISI.some((x) => x.surum === "3.33")); assert.ok(fs.existsSync("docs/ANAHTAR_CRM_EK_v3.33_19Ekim2026.md")); });

test("şart elektrik bilinmiyor: Koşullu ve en fazla 74 (eskiden 83–84); doğrulanmış depo üstte", () => {
  const bilinmeyen = eslesmeOnizle(depoTalep(), depo(), B);
  assert.equal(bilinmeyen.uygunluk, "KOSULLU");
  assert.ok(bilinmeyen.skor <= SART_BILINMEYEN_SKOR_TAVANI, `skor ${bilinmeyen.skor}`);
  assert.equal(bilinmeyen.kriterler.find((k) => k.anahtar === "elektrikGucuKw")?.sonuc, "BILINMIYOR");
  const dogrulanmis = eslesmeOnizle(depoTalep(), depo({}, { elektrikGucuKw: 60 }), B);
  assert.ok(dogrulanmis.skor >= 85, `doğrulanmış ${dogrulanmis.skor}`);
  assert.ok(dogrulanmis.skor - bilinmeyen.skor >= 10);
  const yetersiz = eslesmeOnizle(depoTalep(), depo({}, { elektrikGucuKw: 30 }), B);
  assert.equal(yetersiz.uygunluk, "UYGUN_DEGIL");
});
test("şartsız bilinmeyen (ör. kullanım) şartı bilinmeyenden önde kalır", () => {
  const sartsiz = eslesmeOnizle(depoTalep({ ozellik: { elektrikGucuKw: 50 } }), depo(), B);
  const sartli = eslesmeOnizle(depoTalep(), depo(), B);
  assert.ok(sartsiz.skor > sartli.skor, `${sartsiz.skor} > ${sartli.skor}`);
});
test("kW = kVA = kwa: portföyde kVA ya da trafo kVA'sı ya da ilan metni ('60 KVA') elektrik gücü sayılır", () => {
  assert.equal(eslesmeOnizle(depoTalep(), depo({}, { elektrikGucuKva: 60 }), B).kriterler.find((k) => k.anahtar === "elektrikGucuKw")?.sonuc, "SAGLANDI");
  assert.equal(eslesmeOnizle(depoTalep(), depo({}, { trafoGucuKva: 160 }), B).kriterler.find((k) => k.anahtar === "elektrikGucuKw")?.sonuc, "SAGLANDI");
  const metin = eslesmeOnizle(depoTalep(), depo({ baslik: "Kiralık depo 1100 m2 60 KVA elektrik" }), B);
  const sat = metin.kriterler.find((k) => k.anahtar === "elektrikGucuKw")!;
  assert.equal(sat.sonuc, "SAGLANDI"); assert.match(sat.portfoy, /ilan metninden/);
  // talep "50 kwa" trafo alanına düşmüşse de aynı satırda karşılaştırılır (çift satır yok)
  const t2 = eslesmeOnizle(depoTalep({ ozellik: { kritikKriterler: ["ELEKTRIK"], trafoGucuKva: 50 } }), depo({}, { elektrikGucuKw: 60 }), B);
  assert.equal(t2.kriterler.filter((k) => /Elektrik|Trafo/.test(k.etiket)).length, 1);
  assert.equal(metindenGuc({ baslik: "40 kwa enerji" }), 40); assert.equal(metindenGuc({ baslik: "1000 m2 depo" }), null);
  assert.equal(kvaToKw(400), 400);
  assert.equal(hizliAyristir("Kiralık depo talebi 1000 m2 40 kwa enerji Aksu").ozellik?.elektrikGucuKw, 40);
  assert.equal(hizliAyristir("Kiralık depo 1000 m2 60 KVA Aksu").ozellik?.elektrikGucuKw, 60);
});
test("kat uymuyor ('katta' talebine giriş / son kat): elenmez, en fazla 60 — tutan daire önde", () => {
  const t: OnizlemeKayit = { tip: "TALEP", mulkTipi: "DAIRE", islemTipi: "SATILIK", maxFiyat: 5_800_000, odaSayisi: "3+1", lokasyonlar: lok, ozellik: { istenenKatlar: ["ARA"], asansor: true } };
  const p = (kat: number): OnizlemeKayit => ({ tip: "PORTFOY", mulkTipi: "DAIRE", islemTipi: "SATILIK", fiyat: 5_200_000, m2: 150, odaSayisi: "3+1", lokasyonlar: lok, ozellik: { bulunduguKat: kat, katSayisi: 11, asansor: true } });
  const giris = eslesmeOnizle(t, p(0), B), son = eslesmeOnizle(t, p(11), B), ara = eslesmeOnizle(t, p(4), B);
  assert.notEqual(giris.uygunluk, "UYGUN_DEGIL");
  assert.ok(giris.skor <= KAT_UYMUYOR_SKOR_TAVANI && son.skor <= KAT_UYMUYOR_SKOR_TAVANI, `${giris.skor} ${son.skor}`);
  assert.ok(ara.skor >= 85, `ara kat ${ara.skor}`);
});
test("bina yaşı: 'sıfırdan 7-8 yaşına kadar' → 8; 'sıfır bina' → 0; 'en fazla 10 yaş' → 10", () => {
  assert.equal(binaYasiOku("3+1 asansörlü , yeni bina sıfırdan 7-8 yaşına kadar , kepez"), 8);
  assert.equal(binaYasiOku("sıfır bina"), 0); assert.equal(binaYasiOku("en fazla 10 yaş"), 10); assert.equal(binaYasiOku("15 yıllık"), 15);
});
test("Eşleşmeler: mülk türü ve işlem süzgeci portföyün kendi tipine uygulanır", () => {
  const s = fs.readFileSync("demo/app.tsx", "utf8");
  assert.match(s, /f\.aileler\.length && !f\.aileler\.includes\(aileOf\(e\.p\.veri\.mulkTipi as any\)\.kod\)/);
  assert.match(s, /aileler: \[\], islemler: \[\]/);
});
