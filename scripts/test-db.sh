#!/usr/bin/env bash
# Anahtar CRM v3.13 · 3 Ekim 2026
# Temiz bir PGlite (bellek-içi Postgres) başlatır, migration + seed uygular, testleri koşar.
set -e
PORT=${PGPORT:-55432}
[ -f /tmp/pglite.pid ] && kill "$(cat /tmp/pglite.pid)" 2>/dev/null || true; sleep 1
PGPORT=$PORT node scripts/pglite-server.mjs > /tmp/pglite.log 2>&1 &
echo $! > /tmp/pglite.pid
for i in $(seq 1 30); do grep -q "hazır" /tmp/pglite.log 2>/dev/null && break; sleep 0.5; done; sleep 0.5
export DATABASE_URL=postgresql://postgres@127.0.0.1:$PORT/postgres DIRECT_URL=postgresql://postgres@127.0.0.1:$PORT/postgres PG_POOL_MAX=1
node -e "const {Client}=require('pg');const fs=require('fs');(async()=>{const c=new Client({connectionString:process.env.DIRECT_URL});await c.connect();for(const d of fs.readdirSync('prisma/migrations').filter(x=>!x.endsWith('.toml')).sort())await c.query(fs.readFileSync('prisma/migrations/'+d+'/migration.sql','utf8'));await c.end();console.log('✔ migration uygulandı')})()"
sed -i 's#new PrismaPg({ connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL! })#new PrismaPg({ connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL!, max: Number(process.env.PG_POOL_MAX ?? 5) })#' prisma/seed/index.ts
npx tsx prisma/seed/index.ts
npx tsx prisma/seed/index.ts | sed 's/^/[2. çalıştırma — idempotent] /'
[ -n "$SADECE_HAZIRLA" ] && exit 0
npx tsx --test --test-concurrency=1 tests/asama2.test.ts tests/v32-demo.test.ts tests/v33.test.ts tests/v33-db.test.ts tests/v34.test.ts tests/v35.test.ts tests/v36.test.ts tests/v36-db.test.ts tests/v37.test.ts tests/v37-ui.test.ts tests/v37-db.test.ts tests/v38.test.ts tests/v38-db.test.ts tests/v39.test.ts tests/v39-db.test.ts tests/v310.test.ts tests/v310-db.test.ts tests/v311.test.ts tests/v311-db.test.ts tests/v312.test.ts tests/v315.test.ts tests/v315-db.test.ts tests/v316.test.ts tests/v317.test.ts tests/v318.test.ts