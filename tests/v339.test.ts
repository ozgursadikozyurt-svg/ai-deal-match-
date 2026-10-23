/**
 * Anahtar CRM v3.41 · 23 Ekim 2026
 * v3.39 — telefon: sabit ekran (yakınlaştırma ve yana kayma yok), Eşleşmeler başlığı ekranı taşırmaz, uyum süzgeci sürüklenen çubuk.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import React from "react";
import { SkorSecici } from "../demo/hizli-filtre";
import { SURUM, SURUM_GECMISI } from "../src/lib/surum";
import { ac } from "./yardimci-arayuz";

test("sürüm 3.39 ve ek belge", () => {
  assert.ok(SURUM_GECMISI.some((k) => k.surum === "3.39")); assert.ok(SURUM_GECMISI.some((k) => k.surum === "3.38")); void SURUM;
  assert.ok(fs.existsSync("docs/ANAHTAR_CRM_EK_v3.39_21Ekim2026.md"));
});

test("sabit ekran: viewport yakınlaştırmayı kapatır; sayfa yana taşmaz; telefonda yalnızca kaydırma", () => {
  for (const f of ["scripts/demo-build.ts", "scripts/canli-arayuz.ts"]) assert.match(fs.readFileSync(f, "utf8"), /maximum-scale=1,user-scalable=no/, f);
  const css = fs.readFileSync("demo/sayfa.html", "utf8");
  assert.match(css, /html,body\{overflow-x:clip/);
  assert.match(css, /touch-action:pan-x pan-y/);
  assert.match(css, /\.es-baslik\{flex-wrap:wrap/);
});

test("uyum süzgeci: sürüklenen çubuk 1 = Tümü, 2–5 = en az n/5", async () => {
  let deger = 3;
  const a = await ac(React.createElement(() => { const [d, setD] = React.useState(3); deger = d; return React.createElement(SkorSecici, { deger: d, set: setD, sayi: 7 }); }));
  await a.tikla(a.q(".skor-hs .hs-btn"));
  const r = a.q(".skor-aralik input[type=range]") as HTMLInputElement;
  assert.equal(r.value, "3"); assert.equal(r.min, "1"); assert.equal(r.max, "5");
  await a.yaz(r, "5"); assert.equal(deger, 5);
  await a.yaz(a.q(".skor-aralik input[type=range]"), "1"); assert.equal(deger, 0, "1 → Tümü");
  assert.match(a.q(".skor-serit-deger")!.textContent ?? "", /Tümü/);
  await a.kapat();
});
