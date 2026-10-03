/**
 * Anahtar CRM v3.13 · 3 Ekim 2026
 * v3.11 — veritabanlı: sunucu konum bağlamı mahalle komşuluğunu veritabanı kimlikleriyle kurar.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { lokasyonBaglamiYukle } from "../src/lib/services/senkron";
import { lokasyonIndeksiYukle, lokasyonCozumle } from "../src/lib/lokasyon/cozumle";
import { eslesmeOnizle } from "../src/lib/eslestirme/onizleme";

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL!, max: 1 }) });

test("lokasyonBaglamiYukle: komşuluk veritabanı kimlikleriyle çalışır (Fener ↔ Çağlayan komşu, Meltem ↔ Arapsuyu ilçe aşırı komşu)", async () => {
  const b = await lokasyonBaglamiYukle(prisma);
  const id = async (ilce: string, slug: string) => (await prisma.mahalle.findFirstOrThrow({ where: { slug, ilce: { ad: ilce, ilId: 7 } } })).id;
  const [fener, caglayan, doguyaka, meltem, arapsuyu] = await Promise.all([id("Muratpaşa", "fener"), id("Muratpaşa", "caglayan"), id("Muratpaşa", "doguyaka"), id("Muratpaşa", "meltem"), id("Konyaaltı", "arapsuyu")]);
  assert.equal(b.komsuluk!.mahalle(fener, caglayan)?.komsu, true);
  assert.equal(b.komsuluk!.mahalle(meltem, arapsuyu)?.komsu, true);
  assert.ok(b.komsuluk!.mahalle(fener, doguyaka)!.mesafeM > 3500);
  assert.equal(b.mahalleAdi!(fener), "Fener");
  const muratpasa = (await prisma.ilce.findFirstOrThrow({ where: { ad: "Muratpaşa", ilId: 7 } })).id;
  const l = (mahalleId: number, birincil = false) => [{ ilId: 7, ilceId: muratpasa, mahalleId, birincil }];
  const s = eslesmeOnizle({ tip: "TALEP", mulkTipi: "DAIRE", islemTipi: "SATILIK", odaSayisi: "2+1", maxFiyat: 10_000_000, lokasyonlar: l(fener) }, { tip: "PORTFOY", mulkTipi: "DAIRE", islemTipi: "SATILIK", odaSayisi: "3+1", fiyat: 5_650_000, lokasyonlar: l(doguyaka, true) }, b);
  assert.equal(s.uygunluk, "UYGUN_DEGIL");
});

test("sunucu konum çözücüsü: 'Fener, Çağlayan' → ikisi de Muratpaşa (merkez ilçe önceliği veritabanı indeksinde de var)", async () => {
  const ix = await lokasyonIndeksiYukle(prisma, 7);
  assert.equal(ix.oncelikliIlceler?.length, 5);
  assert.deepEqual(lokasyonCozumle("Fener, Çağlayan", ix).lokasyonlar.map((x) => x.etiket), ["Muratpaşa / Fener", "Muratpaşa / Çağlayan"]);
});