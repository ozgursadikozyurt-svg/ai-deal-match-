/**
 * Anahtar CRM v3.33 · 19 Ekim 2026
 * VERİTABANI YOLU — Cloudflare Hyperdrive bağlıysa (wrangler.jsonc › hyperdrive, bağlama adı HYPERDRIVE) sorgular onun bağlantı
 * havuzundan geçer; bağlı değilse eskisi gibi DATABASE_URL (Supabase Supavisor). Hyperdrive kendi hatasını verirse (SQLSTATE 58000,
 * günlük sorgu sınırı — ücretsiz planda 100.000 / gün —, havuz dolu, köken bağlantısı reddedildi) bu Worker örneği 10 dakika doğrudan
 * bağlantıya döner: uygulama durmaz, arayüzün yeniden denemesi doğrudan yoldan geçer.
 * Ağır bağımlılığı yoktur (testte worker.ts'i yüklemeden sınanır).
 */
export interface VeritabaniOrtami { DATABASE_URL: string; HYPERDRIVE?: { connectionString: string } }
/** v3.29 — Hyperdrive'a özgü hatalar (Cloudflare: eşlenmeyen hatalar SQLSTATE 58000 ile döner) */
export const HYPERDRIVE_HATASI = /hyperdrive|failed to acquire a connection|server connection attempt failed/i;
const HYPERDRIVE_ARA_MS = 10 * 60_000;
let hyperdriveArada = 0;
/** İsteğin veritabanı adresi: Hyperdrive bağlı ve aradaysa değil → onun bağlantı dizesi; değilse DATABASE_URL */
export const veritabaniAdresi = (env: VeritabaniOrtami, simdi = Date.now()): string =>
  env.HYPERDRIVE?.connectionString && simdi >= hyperdriveArada ? env.HYPERDRIVE.connectionString : env.DATABASE_URL;
/** Hyperdrive hatası görülünce bu örnek 10 dakika doğrudan bağlantı kullanır (test için dışa açık) */
export function hyperdriveHatasiniIsle(e: unknown, simdi = Date.now()): boolean {
  const x = e as any, m = `${x?.message ?? e} ${x?.cause?.message ?? ""}`;
  if (!(x?.code === "58000" || x?.cause?.code === "58000" || HYPERDRIVE_HATASI.test(m))) return false;
  hyperdriveArada = simdi + HYPERDRIVE_ARA_MS;
  console.error("Hyperdrive hatası — 10 dakika doğrudan bağlantı:", m.slice(0, 300));
  return true;
}
export const hyperdriveyiSifirla = () => { hyperdriveArada = 0; };
