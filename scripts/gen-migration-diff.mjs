// Anahtar CRM v3.22.1 · 9 Ekim 2026
// Önceki şema → güncel şema arasındaki ARTIMLI migration SQL'ini üretir (WASM schema-engine; binary gerekmez).
// Kullanım: DIRECT_URL=... node scripts/gen-migration-diff.mjs <eski-schema.prisma> prisma/migrations/<ad>/migration.sql [ek.sql]
import fs from "node:fs";
import { SchemaEngine } from "@prisma/schema-engine-wasm";
import { PrismaPg } from "@prisma/adapter-pg";
import { bindMigrationAwareSqlAdapterFactory } from "@prisma/driver-adapter-utils";

const [eskiYol, hedef, ekYol] = process.argv.slice(2);
const eski = fs.readFileSync(eskiYol, "utf8");
const yeni = fs.readFileSync("prisma/schema.prisma", "utf8");
const factory = bindMigrationAwareSqlAdapterFactory(new PrismaPg({ connectionString: process.env.DIRECT_URL }));
const engine = await SchemaEngine.new({ datamodels: [["schema.prisma", yeni]] }, () => {}, factory);
const res = await engine.diff({
  from: { tag: "schemaDatamodel", files: [{ path: "schema.prisma", content: eski }] },
  to: { tag: "schemaDatamodel", files: [{ path: "schema.prisma", content: yeni }] },
  script: true, exitCode: null, filters: { externalTables: [], externalEnums: [] },
});
const ek = ekYol && fs.existsSync(ekYol) ? "\n" + fs.readFileSync(ekYol, "utf8") : "";
fs.mkdirSync(hedef.substring(0, hedef.lastIndexOf("/")), { recursive: true });
fs.writeFileSync(hedef, res.stdout + ek);
console.log("migration →", hedef, (res.stdout + ek).length, "karakter");
process.exit(0);