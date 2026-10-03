// Anahtar CRM v3.14 · 3 Ekim 2026
// Prisma 7 istemcisi — Supabase pooler (6543) üzerinden pg adapter ile.
// Node (testler, komut satırı): tek örnek. Cloudflare Workers: her istek kendi istemcisini kullanır
// (Workers bir isteğin açtığı bağlantıyı başka istekte kullanmaya izin vermez) → `istekIcinde` ile sarılır.
import { AsyncLocalStorage } from "node:async_hooks";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "#prisma-istemci"; // package.json "imports": workerd → prisma-worker, diğer → prisma

export const yeniIstemci = (url = process.env.DATABASE_URL!, max?: number) => new PrismaClient({ adapter: new PrismaPg({ connectionString: url, ...(max ? { max } : {}) }) });

const baglam = new AsyncLocalStorage<{ prisma: PrismaClient }>();
const g = globalThis as unknown as { prisma?: PrismaClient };
const tekil = () => (g.prisma ??= yeniIstemci());

/** İstek boyunca kullanılacak istemciyi kurar, iş bitince bağlantıyı kapatır (Workers) */
export async function istekIcinde<T>(url: string, is: () => Promise<T>): Promise<T> {
  const prisma = yeniIstemci(url, 1);
  try { return await baglam.run({ prisma }, is); } finally { prisma.$disconnect().catch(() => {}); }
}

export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_, ad) { const p = baglam.getStore()?.prisma ?? tekil(); const v = (p as any)[ad]; return typeof v === "function" ? v.bind(p) : v; },
});