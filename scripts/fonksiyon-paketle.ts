/**
 * Anahtar CRM v3.42 · 23 Ekim 2026
 * Supabase Edge Function paketi: src/canli/fonksiyon.ts → supabase/functions/api/index.js (tek dosya, Deno).
 * Prisma'nın Deno istemcisi (src/generated/prisma-deno, sorgu derleyicisi base64 gömülü) "#prisma-istemci" → deno koşuluyla seçilir.
 * Node yerleşik modülleri "node:" önekiyle dışarıda bırakılır (Deno bunları kendisi sağlar).
 */
import { build, type Plugin } from "esbuild";
import { builtinModules } from "node:module";
import fs from "node:fs";

const yerlesik = new Set(builtinModules.flatMap((m) => [m, `node:${m}`]));
const nodeOneki: Plugin = {
  name: "node-oneki",
  setup(b) {
    b.onResolve({ filter: /.*/ }, (a) => {
      if (!yerlesik.has(a.path)) return undefined;
      return { path: a.path.startsWith("node:") ? a.path : `node:${a.path}`, external: true };
    });
  },
};

async function paketle() {
const cikti = "supabase/functions/api/index.js";
fs.mkdirSync("supabase/functions/api", { recursive: true });
const r = await build({
  entryPoints: ["src/canli/fonksiyon.ts"],
  outfile: cikti,
  bundle: true,
  format: "esm",
  platform: "node",
  target: "es2022",
  conditions: ["deno"],
  plugins: [nodeOneki],
  minify: process.env.KUCULTME !== "0",
  legalComments: "none",
  metafile: true,
  banner: { js: `// Anahtar CRM — Supabase Edge Function paketi (otomatik üretilir: npm run fonksiyon:paketle). Elle düzenlemeyin.\nimport { createRequire as __cr } from "node:module"; const require = __cr(import.meta.url);\n// Supabase çalışma ortamında Node genelleri tanımlı değil (Buffer, process, global, setImmediate): paket kendisi tanımlar\nimport { Buffer as __Buffer } from "node:buffer"; import __process from "node:process"; import { setImmediate as __si, clearImmediate as __ci } from "node:timers";\nglobalThis.Buffer ??= __Buffer; globalThis.process ??= __process; globalThis.global ??= globalThis; globalThis.setImmediate ??= __si; globalThis.clearImmediate ??= __ci;` },
  define: { "process.env.NODE_ENV": '"production"' },
  logLevel: "warning",
});
fs.writeFileSync("supabase/functions/api/deno.json", JSON.stringify({ compilerOptions: { lib: ["deno.ns", "dom"] } }, null, 2) + "\n");
const boyut = fs.statSync(cikti).size;
console.log(`✔ ${cikti} — ${(boyut / 1024 / 1024).toFixed(2)} MB`);
if (boyut > 18 * 1024 * 1024) { console.error("Paket Supabase sınırına (20 MB) çok yakın"); process.exit(1); }
void r;
}
paketle().catch((e) => { console.error(e); process.exit(1); });
