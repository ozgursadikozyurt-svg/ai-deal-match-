/**
 * Anahtar CRM v3.22.2 · 10 Ekim 2026
 * v3.2 — veritabanı gerektirmeyen testler: konum çözücü düzeltmeleri, eşleştirme önizlemesi, demo örnek verisi.
 * Çalıştır: npx tsx --test tests/v32-demo.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { coz, BAGLAM } from "../demo/lokasyon";
import { ornekVeriyiKur } from "../demo/depo";
import { eslesmeOnizle, temelUyum } from "../src/lib/eslestirme/onizleme";
import { SADECE_TEST_baglamiSabitle, VARSAYILAN_OFIS_ID, VARSAYILAN_KULLANICI_ID } from "../src/lib/kiracilik";
// v3.20 — çok ofisli: testler varsayılan ofisin bağlamında çalışır (göçte açılan Özyurtlar Gayrimenkul)
SADECE_TEST_baglamiSabitle({ ofisId: VARSAYILAN_OFIS_ID, kullaniciId: VARSAYILAN_KULLANICI_ID, rol: "OFIS_YONETICISI", eposta: "test@anahtar.local" });


const etiketler = (s: string) => coz(s).lokasyonlar.map((l) => l.etiket);

test("konum: ayraçsız 'ilçe mahalle' birlikte çözülür", () => {
  assert.deepEqual(etiketler("Konyaaltı Hurma"), ["Konyaaltı / Hurma"]);
  assert.deepEqual(etiketler("Aksu Pınarlı çevresi"), ["Aksu / Pınarlı"]);
  assert.deepEqual(etiketler("Manavgat Side"), ["Manavgat / Side"]);
});

test("konum: yanlış ilçedeki mahalleye tahmin yürütülmez", () => {
  const a = coz("Kepez Sanayi");
  assert.deepEqual(a.lokasyonlar.map((l) => l.etiket), ["Kepez"]);
  assert.deepEqual(a.cozulemeyen, ["sanayi"]);
  const b = coz("Yeni Sanayi");
  assert.equal(b.lokasyonlar.length, 0);
  assert.deepEqual(b.cozulemeyen, ["yeni sanayi"]);
});

test("konum: 'ilçe / alt bölge' tek satıra iner", () => {
  assert.deepEqual(etiketler("Aksu / Kundu"), ["Kundu"]);
});

test("örnek veri: kayıtların tamamı şemadan ve konum çözücüden geçer", () => {
  const { kayitlar, hatalar } = ornekVeriyiKur();
  assert.deepEqual(hatalar, []);
  assert.ok(kayitlar.length >= 18);
});

test("eşleştirme önizlemesi: beklenen sonuçlar", () => {
  const { kayitlar } = ornekVeriyiKur();
  const k = (id: string) => kayitlar.find((x) => x.id === id)!.veri as any;
  const s = (t: string, p: string) => eslesmeOnizle(k(t), k(p), BAGLAM);
  assert.equal(s("T2", "P2").uygunluk, "SUNULABILIR"); // TIR + rampa + 320 kW
  assert.equal(s("T2", "P1").uygunluk, "KOSULLU"); // TIR/rampa bilinmiyor
  assert.equal(s("T2", "P7").uygunluk, "UYGUN_DEGIL"); // kamyonet < TIR
  assert.equal(s("T1", "P1").uygunluk, "UYGUN_DEGIL"); // bütçe aşımı (varsayılan kritik)
  assert.equal(s("T6", "P5").lokasyonPuani, 10); // Gençlik mahallesi Işıklar alt bölgesinde
  assert.equal(s("T8", "P9").lokasyonPuani, 20);
  assert.equal(temelUyum(k("T3"), k("P2")), false); // dükkan talebi ↔ depo
});