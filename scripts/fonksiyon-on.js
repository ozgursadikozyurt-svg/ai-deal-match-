// Anahtar CRM — Supabase Edge Function paketi (otomatik üretilir: npm run fonksiyon:paketle). Elle düzenlemeyin.
// Ön hazırlık (scripts/fonksiyon-on.js): Supabase çalışma ortamı Node'un bazı genellerini sağlamaz ya da kısıtlar.
import { createRequire as __cr } from "node:module"; const require = __cr(import.meta.url);
import { Buffer as __Buffer } from "node:buffer"; import __process from "node:process"; import { setImmediate as __si, clearImmediate as __ci } from "node:timers";
globalThis.Buffer ??= __Buffer; globalThis.global ??= globalThis; globalThis.setImmediate ??= __si; globalThis.clearImmediate ??= __ci;
{
  // process: ortam değişkenlerine YAZILAMAZ (Deno.env.set → NotSupported) ve bazı alanlar (pid, version…) yok.
  // Yazılabilir bir env kopyası ve eksik alanlar için varsayılan taşıyan bir vekil kullanılır.
  const p = globalThis.process ?? __process;
  const v = { pid: 1, ppid: 0, version: "v22.0.0", versions: { node: "22.0.0" }, platform: "linux", arch: "x64", argv: [], execArgv: [], cwd: () => "/", title: "deno" };
  let env = {};
  try { Object.assign(env, globalThis.Deno?.env?.toObject?.() ?? {}); } catch { /* yok */ }
  try { for (const [k, x] of Object.entries(p.env ?? {})) if (typeof x === "string" && !(k in env)) env[k] = x; } catch { /* yok */ }
  globalThis.process = new Proxy(p, {
    get(t, k) {
      if (k === "env") return env;
      let x; try { x = Reflect.get(t, k); } catch { x = undefined; }
      if (x == null && k in v) return v[k];
      return typeof x === "function" ? x.bind(t) : x;
    },
    set(t, k, x) { if (k === "env") { env = x; return true; } try { Reflect.set(t, k, x); } catch { /* salt okunur */ } return true; },
  });
}
