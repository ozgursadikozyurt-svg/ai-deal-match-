// Anahtar CRM v3.21.2 · 8 Ekim 2026
// Prisma 7 istemcisi — Supabase pooler (6543) üzerinden pg adapter ile.
// Node (testler, komut satırı): tek örnek. Cloudflare Workers: her istek kendi istemcisini kullanır
// (Workers bir isteğin açtığı bağlantıyı başka istekte kullanmaya izin vermez) → `istekIcinde` ile sarılır.
//
// v3.20 — ÇOK OFİSLİ: aşağıdaki `prisma` nesnesi src/lib/kiracilik.ts'ten geçer. Ofise ait her tabloda
// sorgulara ofisId süzgeci, oluşturmalara ofisId değeri KENDİLİĞİNDEN eklenir. Ofis bağlamı yoksa
// (kiracilikIcinde / platformOlarak çağrılmadıysa) sorgu hata verir — sessiz sızıntı olmaz.
// Ham SQL ($queryRaw*) bu süzgeçten geçmez; ofise ait tabloda ham SQL kullanılmaz (tests/v320-db.test.ts denetler).
import { AsyncLocalStorage } from "node:async_hooks";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "#prisma-istemci"; // package.json "imports": workerd → prisma-worker, diğer → prisma
import { istemciyiSarmala } from "./kiracilik";

export const yeniIstemci = (url = process.env.DATABASE_URL!, max?: number) => new PrismaClient({ adapter: new PrismaPg({ connectionString: url, ...(max ? { max } : {}) }) });

const baglam = new AsyncLocalStorage<{ prisma: PrismaClient }>();
const g = globalThis as unknown as { prisma?: PrismaClient };
const tekil = () => (g.prisma ??= yeniIstemci());

/** İstek boyunca kullanılacak istemciyi kurar, iş bitince bağlantıyı kapatır (Workers) */
export async function istekIcinde<T>(url: string, is: () => Promise<T>): Promise<T> {
  const prisma = yeniIstemci(url, 1);
  try { return await baglam.run({ prisma }, is); } finally { prisma.$disconnect().catch(() => {}); }
}

/** Ofis süzgeci uygulanmış istemciler önbellekte tutulur (her istekte yeni vekil kurmamak için) */
const sarmaOnbellek = new WeakMap<PrismaClient, PrismaClient>();
const sarmala = (p: PrismaClient): PrismaClient => {
  let s = sarmaOnbellek.get(p);
  if (!s) { s = istemciyiSarmala(p); sarmaOnbellek.set(p, s); }
  return s;
};

/**
 * Uygulamanın her yerinde kullanılan istemci. ÖNEMLİ: ofis süzgeci buradan geçer.
 * Süzgeçsiz (çıplak) istemci gerekiyorsa `yeniIstemci()` kullanılır — yalnızca seed, test hazırlığı
 * ve göç (migration) betikleri için.
 */
export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_, ad) { const p = sarmala(baglam.getStore()?.prisma ?? tekil()); const v = (p as any)[ad]; return typeof v === "function" ? v.bind(p) : v; },
});