/**
 * Anahtar CRM v3.13 · 3 Ekim 2026
 * Demo uygulamasını tek HTML dosyası olarak derler ve SURUMLER.md'yi üretir.
 * Çalıştır: npm run demo
 * Çıktılar:
 *   dist/anahtar-crm-demo_<DOSYA_EKI>.html   → çift tıklayıp tarayıcıda açılır (tam belge)
 *   dist/artifact.html                      → Claude'da yayınlanan sayfa içeriği (iskeletsiz)
 *   SURUMLER.md                             → değişiklik günlüğü (src/lib/surum.ts'ten)
 */
import { build } from "esbuild";
import fs from "node:fs";
import path from "node:path";
import { gzipSync } from "node:zlib";
import { SURUM, TARIH, DOSYA_EKI, SURUM_GECMISI } from "../src/lib/surum";

async function main() {
const kok = path.resolve(__dirname, "..");
// Demo lokasyon indeksi (Antalya kesiti) yoksa seed verisinden üret
const demoVeri = path.join(kok, "demo/antalya-veri.json");
if (!fs.existsSync(demoVeri)) {
  const ilceler = JSON.parse(fs.readFileSync(path.join(kok, "prisma/seed/data/ilceler.json"), "utf8")).filter((i: { ilId: number }) => i.ilId === 7);
  const ids = new Set(ilceler.map((i: { id: number }) => i.id));
  const mahalleler = JSON.parse(fs.readFileSync(path.join(kok, "prisma/seed/data/mahalleler.json"), "utf8")).filter((m: [number]) => ids.has(m[0]));
  fs.writeFileSync(demoVeri, JSON.stringify({ ilceler, mahalleler }));
}
// v3.10 — Türkiye geneli: 81 il + 973 ilçe açık, Antalya dışı ~72 bin mahalle/köy gzip+base64 (tarayıcıda ilk ihtiyaçta açılır)
const trVeri = path.join(kok, "demo/turkiye-veri.json");
if (!fs.existsSync(trVeri)) {
  const iller = JSON.parse(fs.readFileSync(path.join(kok, "prisma/seed/data/iller.json"), "utf8")) as { id: number; ad: string }[];
  const ilceler = JSON.parse(fs.readFileSync(path.join(kok, "prisma/seed/data/ilceler.json"), "utf8")) as { id: number; ilId: number; ad: string }[];
  const mah = JSON.parse(fs.readFileSync(path.join(kok, "prisma/seed/data/mahalleler.json"), "utf8")) as [number, string][];
  const antalya = new Set(ilceler.filter((i) => i.ilId === 7).map((i) => i.id));
  const grup = new Map<number, string[]>();
  for (const m of mah) if (!antalya.has(m[0])) grup.set(m[0], [...(grup.get(m[0]) ?? []), m[1]]);
  const paket = gzipSync(Buffer.from(JSON.stringify([...grup].map(([id, adlar]) => [id, adlar.join("|")]))), { level: 9 }).toString("base64");
  fs.writeFileSync(trVeri, JSON.stringify({ iller: iller.map((i) => [i.id, i.ad]), ilceler: ilceler.map((i) => [i.id, i.ilId, i.ad]), mahGz: paket }));
}
const r = await build({
  entryPoints: [path.join(kok, "demo/app.tsx")], bundle: true, format: "iife", platform: "browser",
  // v3.4: boşluk küçültme kapalı — "a<b" gibi dizilimler yayın doğrulayıcısında etiket sanılıyordu (a < b olarak yazılır)
  minifyIdentifiers: true, minifySyntax: true, minifyWhitespace: false,
  jsx: "automatic", define: { "process.env.NODE_ENV": '"production"' }, write: false, logLevel: "warning", legalComments: "none",
});
const js = r.outputFiles[0].text.replace(/<\/script/gi, "<\\/script");
const sablon = fs.readFileSync(path.join(kok, "demo/sayfa.html"), "utf8").replaceAll("__SURUM__", SURUM).replaceAll("__TARIH__", TARIH);
const icerik = sablon.replace("/*UYGULAMA*/", () => js);
fs.mkdirSync(path.join(kok, "dist"), { recursive: true });
fs.writeFileSync(path.join(kok, "dist/artifact.html"), icerik);
const tam = `<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>${icerik}</body></html>`;
const hedef = path.join(kok, `dist/anahtar-crm-demo_${DOSYA_EKI}.html`);
fs.writeFileSync(hedef, tam);

const md = [
  "# Anahtar CRM — Sürüm günlüğü",
  "",
  "> v3.9 itibarıyla uygulamanın adı Anahtar CRM (önceki adlar: Anakey, Anahtar.ai).",
  "",
  "> Bu dosya `src/lib/surum.ts`'ten otomatik üretilir (`npm run demo`). Elle düzenlemeyin.",
  "> Dağıtılan dosyaların adı `ad_v<sürüm>_<gün><Ay><yıl>` biçimindedir (örn. `schema_v3.2_30Eylul2026.prisma`).",
  "",
  ...SURUM_GECMISI.flatMap((s) => [
    `## v${s.surum} · ${s.tarih} — ${s.baslik}`, "",
    ...s.degisenler.map((d) => `- ${d}`), "",
    ...(s.testEt?.length ? ["**Demo'da test edilecekler**", "", ...s.testEt.map((t) => `- [ ] ${t}`), ""] : []),
  ]),
].join("\n");
fs.writeFileSync(path.join(kok, "SURUMLER.md"), md);
console.log(`✔ ${path.relative(kok, hedef)} (${(tam.length / 1024).toFixed(0)} KB) · SURUMLER.md · v${SURUM} ${TARIH}`);
}
main().catch((e) => { console.error(e); process.exit(1); });