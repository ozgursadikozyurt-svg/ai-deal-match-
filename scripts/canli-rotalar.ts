/**
 * Anahtar CRM v3.23 · 10 Ekim 2026
 * src/app/api/** /route.ts dosyalarından Cloudflare Worker yönlendirme tablosu üretir → src/canli/rotalar.generated.ts
 * ([id] gibi köşeli parantezli klasörler parametre olur; sabit yollar parametreli olanlardan önce denenir).
 */
import fs from "node:fs";
import path from "node:path";
const kok = path.join(__dirname, "..", "src/app/api");
const bul = (d: string): string[] => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? bul(path.join(d, e.name)) : e.name === "route.ts" ? [path.join(d, e.name)] : []));
const rotalar = bul(kok).map((f) => {
  const yol = "/api/" + path.relative(kok, path.dirname(f)).split(path.sep).join("/");
  const params: string[] = [];
  const desen = "^" + yol.replace(/\[(\w+)\]/g, (_, p) => { params.push(p); return "([^/]+)"; }) + "/?$";
  return { yol, desen, params, imp: "../app/api/" + path.relative(kok, f).split(path.sep).join("/").replace(/\.ts$/, "") };
}).sort((a, b) => a.params.length - b.params.length || b.yol.length - a.yol.length);
const govde = `// OTOMATİK ÜRETİLDİ — scripts/canli-rotalar.ts. Elle düzenlemeyin.\n${rotalar.map((r, i) => `import * as r${i} from "${r.imp}";`).join("\n")}\nexport const ROTALAR: { yol: string; desen: RegExp; params: string[]; mod: Record<string, any> }[] = [\n${rotalar.map((r, i) => `  { yol: ${JSON.stringify(r.yol)}, desen: new RegExp(${JSON.stringify(r.desen)}), params: ${JSON.stringify(r.params)}, mod: r${i} },`).join("\n")}\n];\n`;
fs.writeFileSync(path.join(__dirname, "..", "src/canli/rotalar.generated.ts"), govde);
console.log(`✔ ${rotalar.length} API rotası`);