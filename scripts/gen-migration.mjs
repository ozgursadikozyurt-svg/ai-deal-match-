// Anahtar CRM v3.22.2 · 10 Ekim 2026
// Prisma schema-engine (WASM) ile boş DB → şema SQL migration'ı üretir (binary engine gerektirmez)
import fs from "node:fs";
import { SchemaEngine } from "@prisma/schema-engine-wasm";
import { PrismaPg } from "@prisma/adapter-pg";
import { bindMigrationAwareSqlAdapterFactory } from "@prisma/driver-adapter-utils";

const schema = fs.readFileSync("prisma/schema.prisma", "utf8");
const factory = bindMigrationAwareSqlAdapterFactory(new PrismaPg({ connectionString: process.env.DIRECT_URL }));
const out = [];
const engine = await SchemaEngine.new({ datamodels: [["schema.prisma", schema]] }, (msg) => out.push(msg), factory);
const res = await engine.diff({
  from: { tag: "empty" },
  to: { tag: "schemaDatamodel", files: [{ path: "schema.prisma", content: schema }] },
  script: true, exitCode: null, filters: { externalTables: [], externalEnums: [] },
});
const file = process.argv[2];
const EK = fs.existsSync("prisma/sql/constraints.sql") ? "\n" + fs.readFileSync("prisma/sql/constraints.sql", "utf8") : "";
const sql = res.stdout + EK;
fs.mkdirSync(file.substring(0, file.lastIndexOf("/")), { recursive: true });
fs.writeFileSync(file, sql);
console.log("migration →", file, sql.length, "karakter");