/**
 * Anahtar CRM v3.41 · 23 Ekim 2026
 * Rehber parça parça: "Devam et" bir sonraki sayfayı çeker, kaydedilmemiş yerel işi bozmaz; aynı anda ikinci çağrı süren işi bekler.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { SURUM, SURUM_GECMISI } from "../src/lib/surum";
import { CANLI } from "../demo/depo";
import { REHBER, rehberiYukle, rehberTamMi, KISI_PARCA_ADEDI } from "../demo/kisi-parca";

test("sürüm 3.41 kayıtlı", () => { assert.equal(SURUM, "3.41"); assert.equal(SURUM_GECMISI[0].surum, "3.41"); });

test("Devam et: sayfalar sırayla gelir, sonraki null olunca rehber tamam; tekrar çağrı ağa gitmez", async () => {
  const istekler: string[] = [];
  const sayfalar = [{ kisiler: [{ id: "a", adSoyad: "A", x: null }], sonraki: 250 }, { kisiler: [{ id: "b", adSoyad: "B" }], sonraki: null }];
  (CANLI as any).api = async (yol: string) => { istekler.push(yol); const j = sayfalar[istekler.length - 1]; return { ok: true, json: async () => j }; };
  const alinan: any[] = [];
  (CANLI as any).kisileriDegisenleriBirlestir = (d: any, g: any[]) => { alinan.push(...g); return d; };
  Object.assign(REHBER, { sonraki: 0, toplam: 2, yukluyor: null, hata: null });
  const guncelle = (f: any) => f({});
  const p1 = rehberiYukle(guncelle, { sayfa: 1 }), p2 = rehberiYukle(guncelle, { sayfa: 1 });
  assert.equal(p1, p2, "aynı anda ikinci çağrı süren işi bekler");
  await p1;
  assert.equal(REHBER.sonraki, 250); assert.equal(istekler.length, 1);
  assert.ok(istekler[0].includes(`atla=0&al=${KISI_PARCA_ADEDI}`));
  await rehberiYukle(guncelle, { hepsi: true });
  assert.ok(rehberTamMi()); assert.deepEqual(alinan.map((k) => k.id), ["a", "b"]); assert.ok(!("x" in alinan[0]), "null alanlar atılır");
  await rehberiYukle(guncelle, { hepsi: true });
  assert.equal(istekler.length, 2, "tamamsa ağa gidilmez");
});

test("Devam et: sunucu hatasında hata yazılır, durum korunur, yeniden denenebilir", async () => {
  (CANLI as any).api = async () => ({ ok: false, status: 503, json: async () => ({ mesaj: "Sunucu 503" }) });
  (CANLI as any).kisileriDegisenleriBirlestir = (d: any) => d;
  Object.assign(REHBER, { sonraki: 500, toplam: 900, yukluyor: null, hata: null });
  await rehberiYukle((f: any) => f({}), { sayfa: 1 });
  assert.equal(REHBER.sonraki, 500); assert.ok(REHBER.hata); assert.equal(REHBER.yukluyor, null);
});
