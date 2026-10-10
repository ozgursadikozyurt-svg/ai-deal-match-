/**
 * Anahtar CRM v3.23 · 10 Ekim 2026
 * Kod dosyalarının en üstündeki sürüm satırını src/lib/surum.ts'teki sürüme günceller (yoksa ekler).
 * Çalıştır: npm run surum:damgala   (her sürüm sonunda, npm run demo'dan önce)
 * Migration dosyalarına dokunmaz — onlar oluşturuldukları sürümde kalır.
 */
import fs from "node:fs";
import path from "node:path";
import { SURUM, TARIH } from "../src/lib/surum";

const kok = path.resolve(__dirname, "..");
const SATIR = `Anahtar CRM v${SURUM} · ${TARIH}`; // v3.9: ad Anahtar CRM
const DESEN = /(?:Anahtar\.ai|Anakey|Anahtar CRM) v\d+\.\d+(\.\d+)? · \d{1,2} [A-Za-zÇĞİÖŞÜçğıöşü]+ \d{4}/;
const KLASORLER = ["src", "demo", "scripts", "tests", "prisma"];
const ATLA = [/src[\\/]generated/, /node_modules/, /prisma[\\/]migrations/, /prisma[\\/]seed[\\/]data/];
let n = 0;
function yuru(d: string) {
  for (const g of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, g.name);
    if (ATLA.some((r) => r.test(p))) continue;
    if (g.isDirectory()) { yuru(p); continue; }
    if (!/\.(ts|tsx|mjs|prisma|sql|sh)$/.test(g.name)) continue;
    let s = fs.readFileSync(p, "utf8");
    const eski = s;
    if (DESEN.test(s.slice(0, 400))) s = s.replace(DESEN, SATIR);
    else if (/\.(ts|tsx|mjs)$/.test(g.name) && s.startsWith("/**")) s = s.replace("/**", `/**\n * ${SATIR}`);
    else if (/\.(ts|tsx|mjs|prisma)$/.test(g.name)) s = `// ${SATIR}\n` + s;
    else if (g.name.endsWith(".sql")) s = `-- ${SATIR}\n` + s;
    else if (g.name.endsWith(".sh")) s = s.startsWith("#!") ? s.replace(/^(#!.*\n)/, `$1# ${SATIR}\n`) : `# ${SATIR}\n` + s;
    if (s !== eski) { fs.writeFileSync(p, s); n++; }
  }
}
KLASORLER.forEach((k) => fs.existsSync(path.join(kok, k)) && yuru(path.join(kok, k)));
console.log(`✔ ${n} dosyanın sürüm satırı güncellendi → ${SATIR}`);