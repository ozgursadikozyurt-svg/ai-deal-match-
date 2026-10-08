/**
 * Anahtar CRM v3.21.1 · 8 Ekim 2026
 * Canlıda komut satırı olmadan veritabanı kurulumu: uygulamaya gömülü migration SQL'leri sırayla, her biri kendi
 * işleminde (transaction) uygulanır; uygulananlar `_anahtarcrm_migrasyon` tablosunda tutulur. Komut satırından
 * `prisma migrate deploy` ile kurulmuş bir veritabanı da tanınır (`_prisma_migrations`), aynı migration iki kez çalışmaz.
 */
import { Client } from "pg";

export interface Migrasyon { ad: string; sql: string }

export async function migrasyonDurumu(baglanti: string, liste: Migrasyon[]) {
  const c = new Client({ connectionString: baglanti });
  await c.connect();
  try {
    await c.query(`CREATE TABLE IF NOT EXISTS "_anahtarcrm_migrasyon" ("ad" text PRIMARY KEY, "tarih" timestamptz NOT NULL DEFAULT now())`);
    await c.query(`ALTER TABLE "_anahtarcrm_migrasyon" ENABLE ROW LEVEL SECURITY`); // herkese açık REST'ten erişilemesin
    const biz = (await c.query(`SELECT ad FROM "_anahtarcrm_migrasyon"`)).rows.map((r) => r.ad as string);
    const prismaTablo = (await c.query(`SELECT to_regclass('public._prisma_migrations') IS NOT NULL AS var`)).rows[0]?.var;
    const prismaAd = prismaTablo ? (await c.query(`SELECT migration_name FROM "_prisma_migrations" WHERE finished_at IS NOT NULL`)).rows.map((r) => r.migration_name as string) : [];
    const uygulanan = new Set([...biz, ...prismaAd]);
    return { uygulanan: liste.filter((m) => uygulanan.has(m.ad)).map((m) => m.ad), bekleyen: liste.filter((m) => !uygulanan.has(m.ad)).map((m) => m.ad) };
  } finally { await c.end(); }
}

export async function migrasyonlariUygula(baglanti: string, liste: Migrasyon[], log: (m: string) => void = () => {}) {
  const { bekleyen } = await migrasyonDurumu(baglanti, liste);
  const c = new Client({ connectionString: baglanti });
  await c.connect();
  try {
    for (const ad of bekleyen) {
      const m = liste.find((x) => x.ad === ad)!;
      await c.query("BEGIN");
      try {
        await c.query(m.sql);
        await c.query(`INSERT INTO "_anahtarcrm_migrasyon" (ad) VALUES ($1)`, [ad]);
        await c.query("COMMIT");
        log(`✔ ${ad}`);
      } catch (e: any) { await c.query("ROLLBACK"); throw new Error(`${ad}: ${e?.message ?? e}`); }
    }
    return bekleyen;
  } finally { await c.end(); }
}