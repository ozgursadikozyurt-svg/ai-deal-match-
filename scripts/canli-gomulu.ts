/**
 * Anahtar CRM v3.22.2 · 10 Ekim 2026
 * Canlı (Cloudflare) paketine gömülecek veriyi üretir: migration SQL'leri + yalnız Antalya konum verisi.
 * Çıktı: src/canli/gomulu.generated.ts  (npm run canli:build içinde otomatik çalışır)
 */
import fs from "node:fs";
import path from "node:path";
const kok = path.join(__dirname, "..");
const migDir = path.join(kok, "prisma/migrations");
const MIGRASYONLAR = fs.readdirSync(migDir).filter((d) => fs.existsSync(path.join(migDir, d, "migration.sql"))).sort().map((ad) => ({ ad, sql: fs.readFileSync(path.join(migDir, ad, "migration.sql"), "utf8") }));
const oku = (f: string) => JSON.parse(fs.readFileSync(path.join(kok, "prisma/seed/data", f), "utf8"));
const iller = oku("iller.json").filter((i: any) => i.plaka === "07");
const ilceler = oku("ilceler.json").filter((i: any) => i.ilId === iller[0].id);
const ids = new Set(ilceler.map((i: any) => i.id));
const mahalleler = oku("mahalleler.json").filter((m: any) => ids.has(m[0]));
const govde = `// OTOMATİK ÜRETİLDİ — scripts/canli-gomulu.ts. Elle düzenlemeyin.\nimport type { Migrasyon } from "../lib/kurulum/migrate";\nimport type { LokasyonVerisi } from "../lib/kurulum/seed";\nexport const MIGRASYONLAR: Migrasyon[] = ${JSON.stringify(MIGRASYONLAR)};\nexport const ANTALYA_VERI: LokasyonVerisi = ${JSON.stringify({ iller, ilceler, mahalleler })};\n`;
fs.writeFileSync(path.join(kok, "src/canli/gomulu.generated.ts"), govde);
console.log(`✔ gömülü veri: ${MIGRASYONLAR.length} migration, ${ilceler.length} ilçe, ${mahalleler.length} mahalle/köy (${Math.round(govde.length / 1024)} KB)`);