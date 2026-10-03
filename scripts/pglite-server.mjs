// Anahtar CRM v3.13 · 3 Ekim 2026
// Yerel test için bellek-içi Postgres (PGlite) — gerçek Supabase gerekmeden şema/seed doğrulaması
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
const db = await PGlite.create();
const server = new PGLiteSocketServer({ db, port: Number(process.env.PGPORT ?? 55432), host: "127.0.0.1" });
await server.start();
console.log("PGlite hazır :" + (process.env.PGPORT ?? 55432));