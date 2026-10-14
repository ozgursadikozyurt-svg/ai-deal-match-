// Anahtar CRM v3.29 · 14 Ekim 2026
// Yerel test için bellek-içi Postgres (PGlite) — gerçek Supabase gerekmeden şema/seed doğrulaması
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
const db = await PGlite.create();
// v3.28 — maxConnections: varsayılan 1; testler hazırlıkta ikinci istemci açınca ilk bağlantı "Connection terminated unexpectedly" ile düşüyordu (44 test)
const server = new PGLiteSocketServer({ db, port: Number(process.env.PGPORT ?? 55432), host: "127.0.0.1", maxConnections: 20 });
await server.start();
console.log("PGlite hazır :" + (process.env.PGPORT ?? 55432));