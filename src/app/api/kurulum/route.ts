// Anahtar CRM v3.23 · 10 Ekim 2026
// GET  /api/kurulum → veritabanı hazır mı? (bekleyen migration, konum verisi yüklü mü)
// POST /api/kurulum → bekleyen migration'ları uygular + Antalya konum verisini yükler (idempotent; tekrar basılabilir)
// Komut satırı gerekmez: canlı uygulamada ilk açılışta "Kurulumu tamamla" düğmesi bunu çağırır.
import { prisma } from "@/lib/db";
import { hata, ok } from "@/lib/http/yanit";
import { migrasyonDurumu, migrasyonlariUygula } from "@/lib/kurulum/migrate";
import { lokasyonSeed, antalyaSeed, sayaclariDuzelt, kimlikUyumu } from "@/lib/kurulum/seed";
import { MIGRASYONLAR, ANTALYA_VERI } from "@/canli/gomulu.generated";

const url = () => process.env.DIRECT_URL || process.env.DATABASE_URL!;
async function durum() {
  const m = await migrasyonDurumu(url(), MIGRASYONLAR);
  const mahalle = m.bekleyen.length === MIGRASYONLAR.length ? 0 : await prisma.mahalle.count({ where: { ilce: { ilId: ANTALYA_VERI.iller[0].id } } });
  const uyum = mahalle ? await kimlikUyumu(prisma, ANTALYA_VERI) : false;
  return { migrasyon: m, mahalle, konumKimlikUyumu: uyum, hazir: m.bekleyen.length === 0 && mahalle >= ANTALYA_VERI.mahalleler.length && uyum };
}
export async function GET() { try { return ok(await durum()); } catch (e) { return hata(e); } }
export async function POST() {
  try {
    const log: string[] = [];
    await migrasyonlariUygula(url(), MIGRASYONLAR, (m) => log.push(m));
    await lokasyonSeed(prisma, ANTALYA_VERI, (m) => log.push(m), true);
    await antalyaSeed(prisma, (m) => log.push(m), true);
    await sayaclariDuzelt(prisma);
    // Durum Prisma bağlantısıyla hesaplanır (ikinci bir bağlantı açılmaz — Supabase Free bağlantı sayısı da korunur)
    const mahalle = await prisma.mahalle.count({ where: { ilce: { ilId: ANTALYA_VERI.iller[0].id } } });
    const uyum = await kimlikUyumu(prisma, ANTALYA_VERI);
    return ok({ migrasyon: { uygulanan: MIGRASYONLAR.map((m) => m.ad), bekleyen: [] }, mahalle, konumKimlikUyumu: uyum, hazir: mahalle >= ANTALYA_VERI.mahalleler.length && uyum, log });
  } catch (e) { return hata(e); }
}