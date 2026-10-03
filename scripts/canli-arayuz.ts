/**
 * Anahtar CRM v3.14 · 3 Ekim 2026
 * Canlı arayüzü derler → dist/canli/ (Cloudflare statik dosyaları): index.html (arayüz + stil + uygulama kodu), manifest, ikonlar.
 * Demo ile aynı ekranlar; fark: demo/canli.tsx giriş noktası (giriş, sunucudan durum, kaydetme kuyruğu).
 * Çalıştır: npm run canli:arayuz   (npm run canli:build içinde otomatik)
 */
import { build } from "esbuild";
import fs from "node:fs";
import path from "node:path";
import { SURUM, TARIH } from "../src/lib/surum";

async function main() {
  const kok = path.resolve(__dirname, "..");
  // Demo konum dizini girdileri (Antalya kesiti, Türkiye geneli) yoksa seed verisinden üret — demo-build.ts ile aynı kurallar
  const rb = (f: string) => JSON.parse(fs.readFileSync(path.join(kok, "prisma/seed/data", f), "utf8"));
  const antalya = path.join(kok, "demo/antalya-veri.json");
  if (!fs.existsSync(antalya)) {
    const ilceler = rb("ilceler.json").filter((i: { ilId: number }) => i.ilId === 7);
    const ids = new Set(ilceler.map((i: { id: number }) => i.id));
    fs.writeFileSync(antalya, JSON.stringify({ ilceler, mahalleler: rb("mahalleler.json").filter((m: [number]) => ids.has(m[0])) }));
  }
  const tr = path.join(kok, "demo/turkiye-veri.json");
  if (!fs.existsSync(tr)) {
    const { gzipSync } = await import("node:zlib");
    const iller = rb("iller.json"), ilceler = rb("ilceler.json"), mah = rb("mahalleler.json");
    const ant = new Set(ilceler.filter((i: { ilId: number }) => i.ilId === 7).map((i: { id: number }) => i.id));
    const grup = new Map<number, string[]>();
    for (const m of mah) if (!ant.has(m[0])) grup.set(m[0], [...(grup.get(m[0]) ?? []), m[1]]);
    const paket = gzipSync(Buffer.from(JSON.stringify([...grup].map(([id, adlar]) => [id, adlar.join("|")]))), { level: 9 }).toString("base64");
    fs.writeFileSync(tr, JSON.stringify({ iller: iller.map((i: any) => [i.id, i.ad]), ilceler: ilceler.map((i: any) => [i.id, i.ilId, i.ad]), mahGz: paket }));
  }

  const r = await build({
    entryPoints: [path.join(kok, "demo/canli.tsx")], bundle: true, format: "iife", platform: "browser",
    minifyIdentifiers: true, minifySyntax: true, minifyWhitespace: false,
    jsx: "automatic", define: { "process.env.NODE_ENV": '"production"' }, write: false, logLevel: "warning", legalComments: "none",
  });
  const js = r.outputFiles[0].text.replace(/<\/script/gi, "<\\/script");
  const sablon = fs.readFileSync(path.join(kok, "demo/sayfa.html"), "utf8").replaceAll("__SURUM__", SURUM).replaceAll("__TARIH__", TARIH)
    .replace('<div id="kok"></div>', '<div id="kok" data-canli="1"></div>')
    .replace("Bu demo için JavaScript gereklidir.", "Anahtar CRM için JavaScript gereklidir.");
  const icerik = sablon.replace("/*UYGULAMA*/", () => js);
  const belge = `<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="theme-color" content="#14213D"><meta name="apple-mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-title" content="Anahtar CRM"><link rel="manifest" href="/manifest.webmanifest"><link rel="apple-touch-icon" href="/ikon-180.png"></head><body>${icerik}</body></html>`;
  const cikti = path.join(kok, "dist/canli");
  fs.rmSync(cikti, { recursive: true, force: true }); fs.mkdirSync(cikti, { recursive: true });
  fs.writeFileSync(path.join(cikti, "index.html"), belge);
  for (const f of fs.readdirSync(path.join(kok, "public"))) fs.copyFileSync(path.join(kok, "public", f), path.join(cikti, f));
  console.log(`✔ dist/canli/index.html (${(belge.length / 1024).toFixed(0)} KB) · v${SURUM} ${TARIH}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
