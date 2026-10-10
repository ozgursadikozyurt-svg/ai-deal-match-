/**
 * Anahtar CRM v3.22.2 · 10 Ekim 2026
 * AŞAMA 2 uçtan uca doğrulama — gerçek Notion CRM kayıtlarıyla.
 * Çalıştır: DATABASE_URL=... npx tsx --test tests/asama2.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { KayitCreateSchema, KayitListeQuery, KayitUpdateSchema, MulkOzellikSchema } from "../src/lib/validation/kayit";
import { kayitGuncelle, kayitListele, kayitOlustur } from "../src/lib/services/kayit";
import { lokasyonCozumle, lokasyonIndeksiYukle } from "../src/lib/lokasyon/cozumle";
import { GEMINI_RESPONSE_SCHEMA, AiParseCiktiSchema } from "../src/lib/ai/gemini-cikti-semasi";
import { NOTION_MULK_TIPI } from "../src/lib/notion/eslestirme";
import { SADECE_TEST_baglamiSabitle, VARSAYILAN_OFIS_ID, VARSAYILAN_KULLANICI_ID, istemciyiSarmala } from "../src/lib/kiracilik";
// v3.20 — çok ofisli: testler varsayılan ofisin bağlamında çalışır (göçte açılan Özyurtlar Gayrimenkul)
SADECE_TEST_baglamiSabitle({ ofisId: VARSAYILAN_OFIS_ID, kullaniciId: VARSAYILAN_KULLANICI_ID, rol: "OFIS_YONETICISI", eposta: "test@anahtar.local" });


const prisma = istemciyiSarmala(new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL!, max: Number(process.env.PG_POOL_MAX ?? 10) }) }));

test("lokasyon veri seti: 81 il / 973 ilçe / Antalya 19 ilçe", async () => {
  assert.equal(await prisma.il.count(), 81);
  assert.equal(await prisma.ilce.count(), 973);
  assert.equal(await prisma.ilce.count({ where: { ilId: 7 } }), 19);
  assert.ok((await prisma.mahalle.count()) > 70_000);
});

test("Notion 'Bölge' seçeneklerinin tamamı çözülür", async () => {
  const ix = await lokasyonIndeksiYukle(prisma, 7);
  const notionBolgeler = ["Konyaaltı", "Kepez", "Altınova", "Murtpaşa", "Lara", "Altıntaş", "Aksu", "Fener", "Kundu", "Kızıltoprak", "Hurma", "Yenigöl", "Menderes", "Atatürk Mh.", "Çağlayan", "Topallı", "Şirinyalı", "Yeşilbahçe", "Muratpaşa", "Zerdalilik", "Düden Mh.", "Yenigün", "Gençlik", "Döşemealtı"];
  const r = lokasyonCozumle(notionBolgeler, ix);
  assert.deepEqual(r.cozulemeyen, [], `çözülemeyen: ${r.cozulemeyen}`);
  const murt = r.lokasyonlar.find((l) => l.kaynakIfade === "murtpasa");
  assert.equal(murt?.seviye, "ILCE", "Muratpaşa ilçesi, listedeki Muratpaşa mahalleleri yüzünden düşmemeli");
  assert.equal(r.lokasyonlar.find((l) => l.kaynakIfade === "lara")?.seviye, "ALTBOLGE");
});

test("serbest metin: talep bölge listesi + hiyerarşi birleştirme + yazım hatası", async () => {
  const ix = await lokasyonIndeksiYukle(prisma, 7);
  const a = lokasyonCozumle("Aksu, Yenigöl / Altınova olur", ix);
  assert.equal(a.lokasyonlar.length, 3);
  const b = lokasyonCozumle("Kepez / Altınova Sinan Mahallesi", ix);
  assert.equal(b.lokasyonlar.length, 1, "ilçe+mahalle tek satıra birleşmeli");
  assert.equal(b.lokasyonlar[0].seviye, "MAHALLE");
  const c = lokasyonCozumle("Hacıalilerde", ix); // ek almış
  assert.equal(c.lokasyonlar[0]?.etiket, "Aksu / Hacıaliler");
  const d = lokasyonCozumle("Konyalti", ix); // yazım hatası
  assert.equal(d.lokasyonlar[0]?.seviye, "ILCE");
  assert.ok(d.lokasyonlar[0].guven < 1);
  const e = lokasyonCozumle("Atatürk", ix); // Aksu ve Kepez'de var → belirsiz
  assert.ok(e.lokasyonlar[0].belirsiz && e.lokasyonlar[0].belirsiz.length === 2);
  const f = lokasyonCozumle("Kepez, Atatürk", ix); // ilçe verilince belirsizlik çözülür
  assert.equal(f.lokasyonlar.length, 1);
  assert.equal(f.lokasyonlar[0].etiket, "Kepez / Atatürk");
});

async function lok(metin: string) {
  const ix = await lokasyonIndeksiYukle(prisma, 7);
  return lokasyonCozumle(metin, ix).lokasyonlar.map((l, i) => ({ ilId: l.ilId, ilceId: l.ilceId, mahalleId: l.mahalleId, altBolgeId: l.altBolgeId, birincil: i === 0 }));
}

let portfoyId = "";
test("PORTFÖY: 'Hacıaliler 4000m2 Depo 400KWA' (Notion) standart kolonlara yazılır", async () => {
  const k = KayitCreateSchema.parse({
    tip: "PORTFOY", mulkTipi: "DEPO_ANTREPO", islemTipi: "KIRALIK", veriKanali: "NOTION", ilanSahibiTipi: "MALIK",
    fiyat: 300000, fiyatPeriyodu: "AYLIK", m2: 4000, baslik: "Hacıaliler 4000m2 Depo 400KWA",
    lokasyonlar: await lok("Hacıaliler"),
    hamMetin: "4000 m2 Kapalı 2000 m2 Açık alan\n400 kw elektirik gücü , yanlar panel ve\nÜzeri trapez saç\nKira Yıllık isteniyor",
    ozellik: { kapaliAlanM2: 4000, acikAlanM2: 2000, elektrikGucuKw: 400, elektrikGucuHam: "400 kw", duvarTipi: "SANDVIC_PANEL", catiTipi: "TRAPEZ_SAC", kiraOdemeSekli: "YILLIK_PESIN", kullanimAmaclari: ["DEPOLAMA", "URETIM"] },
  });
  assert.equal(k.anaKategori, "ISYERI");
  const r = await kayitOlustur(prisma, k);
  portfoyId = r.id;
  assert.equal(r.ozellik?.elektrikGucuKw, 400);
  assert.equal(r.lokasyonlar[0].birincil, true);
});

test("PORTFÖY: '8000 M2 400 kwa depo Aksu Kundu Rampalı' — kVA→kW normalizasyonu ve bayrak türetme", async () => {
  const k = KayitCreateSchema.parse({
    tip: "PORTFOY", mulkTipi: "DEPO_ANTREPO", islemTipi: "KIRALIK", fiyat: 710000, fiyatPeriyodu: "AYLIK", m2: 8000,
    lokasyonlar: await lok("Kundu"),
    ozellik: { kapaliAlanM2: 8000, arsaAlanM2: 11000, makasAltiYukseklikM: 6, kapiSayisi: 4, rampaSayisi: 2, elektrikGucuKva: 400, trafoGucuKva: 400, ofis: true, wc: true, duvarTipi: "SANDVIC_PANEL", catiTipi: "SANDVIC_PANEL", aracErisimi: "TIR" },
  });
  const r = await kayitOlustur(prisma, k);
  assert.equal(r.ozellik?.elektrikGucuKw, 320); // 400 kVA × 0.8
  assert.equal(r.ozellik?.rampa, true);
  assert.equal(r.ozellik?.trafo, true);
});

test("TALEP: '1000 üzeri 50-60 kW kazan üretim tesisi' — Talep DNA (kritik/esnek/eksik)", async () => {
  const k = KayitCreateSchema.parse({
    tip: "TALEP", mulkTipi: "FABRIKA_URETIM_TESISI", alternatifMulkTipleri: ["DEPO_ANTREPO"], islemTipi: "KIRALIK",
    aciliyet: "YUKSEK", maxFiyat: 120000, fiyatPeriyodu: "AYLIK", minM2: 1000, m2ToleransYuzde: 20, musteriKaynagi: "ILAN",
    // Orijinal mesaj: "Aksu Pınarlı çevresi ve Yenigöl Altınova Cihadiye" → Aksu+Pınarlı bitişik = tek satır (Aksu/Pınarlı)
    lokasyonlar: await lok("Aksu Pınarlı çevresi, Yenigöl, Altınova, Cihadiye"),
    ozellik: { elektrikGucuKw: 50, kullanimAmaclari: ["URETIM"], kritikKriterler: ["ELEKTRIK", "ALAN"], esnekKriterler: ["LOKASYON"], eksikBilgiler: ["RUHSAT", "ARAC_ERISIMI", "YUKSEKLIK"] },
  });
  const r = await kayitOlustur(prisma, k);
  assert.equal(r.lokasyonlar.length, 4);
  assert.deepEqual(r.ozellik?.kritikKriterler, ["ELEKTRIK", "ALAN"]);
});

test("TALEP: Lara dükkan (ana cadde, otopark) — TICARI alanlar", async () => {
  const k = KayitCreateSchema.parse({
    tip: "TALEP", mulkTipi: "DUKKAN_MAGAZA", islemTipi: "SATILIK", maxFiyat: 70_000_000, minM2: 400,
    lokasyonlar: await lok("Lara"), musteriKaynagi: "SAHA",
    ozellik: { anaCaddeUzeri: true, otoparkDurumu: "ACIK", kritikKriterler: ["OTOPARK", "CEPHE_VITRIN"] },
  });
  await kayitOlustur(prisma, k);
});

test("teknik filtre: min 300 kW + TIR erişimi → sadece Kundu deposu", async () => {
  const f = KayitListeQuery.parse({ tip: "PORTFOY", minElektrikKw: "300", aracErisimi: "KAMYON" });
  const r = await kayitListele(prisma, f);
  assert.equal(r.toplam, 1);
  assert.equal(r.kayitlar[0].ozellik?.kapaliAlanM2, 8000);
});

test("alt bölge filtresi: altBolge=Lara, mahalle üzerinden de bulur", async () => {
  const lara = await prisma.altBolge.findFirstOrThrow({ where: { slug: "lara" } });
  const r = await kayitListele(prisma, KayitListeQuery.parse({ tip: "TALEP", altBolgeId: String(lara.id) }));
  assert.equal(r.toplam, 1);
});

test("doğrulama: enum dışı değer, tanımsız alan ve tutarsız kategori reddedilir", () => {
  assert.throws(() => MulkOzellikSchema.parse({ aracErisimi: "UÇAK" }));
  assert.throws(() => MulkOzellikSchema.parse({ tavanCokYuksek: true }), /Unrecognized/);
  assert.throws(() => KayitCreateSchema.parse({ tip: "PORTFOY", mulkTipi: "DAIRE", islemTipi: "DEVREN_SATILIK" }), /uyumsuz/);
  assert.throws(() => KayitCreateSchema.parse({ tip: "PORTFOY", mulkTipi: "DEPO_ANTREPO", islemTipi: "KIRALIK", ozellik: { kritikKriterler: ["ELEKTRIK"] } }), /sadece TALEP/);
});

test("PATCH: değişen her alan audit_log'a düşer", async () => {
  const r = await kayitGuncelle(prisma, portfoyId, KayitUpdateSchema.parse({ fiyat: 280000, ozellik: { sanayiElektrigi: true, yanginSistemi: true } }));
  assert.equal(r.degisenAlanSayisi, 3);
  assert.equal(await prisma.auditLog.count({ where: { kayitId: portfoyId } }), 3);
});

test("duplicate: aynı ham metin ikinci kez eklenemez (P2002)", async () => {
  const k = KayitCreateSchema.parse({ tip: "PORTFOY", mulkTipi: "DEPO_ANTREPO", islemTipi: "KIRALIK", hamMetin: "4000 m2 Kapalı 2000 m2 Açık alan\n400 kw elektirik gücü , yanlar panel ve\nÜzeri trapez saç\nKira Yıllık isteniyor" });
  await assert.rejects(kayitOlustur(prisma, k), (e: { code?: string; message?: string }) => {
    assert.equal(e.code, "P2002", String(e.message).slice(-400));
    return true;
  });
});

test("Gemini şeması: enum kısıtlı, lokasyon ID'si yok, örnek çıktı Zod'dan geçer", () => {
  const kayit = GEMINI_RESPONSE_SCHEMA.properties!.kayitlar.items!;
  assert.ok(kayit.properties!.mulkTipi.enum!.includes("SOGUK_HAVA_DEPOSU"));
  assert.ok(kayit.properties!.ozellik.properties!.aracErisimi.enum!.includes("TIR"));
  assert.equal(kayit.properties!.ilceId, undefined);
  const ornek = AiParseCiktiSchema.parse({
    sinif: "TALEP",
    kayitlar: [{ tip: "TALEP", mulkTipi: "DEPO_ANTREPO", islemTipi: "KIRALIK", minM2: 1000, maxM2: 1500, maxFiyat: 120000, fiyatPeriyodu: "AYLIK", lokasyonIfadeleri: ["Aksu", "Yenigöl", "Altınova"], ozellik: { elektrikGucuKw: 50, kullanimAmaclari: ["URETIM"], kritikKriterler: ["ELEKTRIK"], eksikBilgiler: ["RUHSAT"] } }],
  });
  assert.equal(ornek.kayitlar[0].ozellik.elektrikGucuKw, 50);
});

test("Notion Mülk Tipi seçeneklerinin tamamı eşlenmiş", () => {
  for (const s of ["Depo", "Dükkan", "Arsa", "Daire", "Ofis", "Ofis - Apt", "Plaza Katı", "Villa", "Ofis-Apt.D", "Fabrika", "Restoran"]) assert.ok(NOTION_MULK_TIPI[s], s);
});

test("DB CHECK kuralları: sahipsiz özellik, ters aralık, saçma yükseklik reddedilir", async () => {
  // Not: PGlite soket sunucusu hata sonrası Prisma bağlantısını düşürebildiği için ayrı pg istemcisi kullanılır
  // v3.6: pglite-socket 0.2.x aynı anda tek bağlantı kabul ediyor → önce Prisma bağlantısını bırak (sonraki sorguda kendiliğinden açılır)
  await prisma.$disconnect();
  const { Client } = await import("pg");
  const c = new Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();
  const red = async (sql: string, kural: string) =>
    assert.rejects(c.query(sql), (e: { code?: string; constraint?: string }) => e.code === "23514" && e.constraint === kural);
  await red(`insert into mulk_ozellik(id,"updatedAt") values('x1',now())`, "mulk_ozellik_tek_sahip_chk");
  await red(`insert into kayit(id,tip,"anaKategori","mulkTipi","islemTipi","validUntil",fingerprint,"updatedAt","minM2","maxM2") values('k1','TALEP','ISYERI','DEPO_ANTREPO','KIRALIK',now(),'fp-x',now(),2000,1000)`, "kayit_m2_aralik_chk");
  const { rows } = await c.query(`select id from kayit where tip='PORTFOY' limit 1`);
  await red(`insert into mulk_ozellik(id,"kayitId","updatedAt","netYukseklikM") values('x2','${rows[0].id}_yok',now(),500)`, "mulk_ozellik_deger_chk");
  await c.end();
});

test.after(() => prisma.$disconnect());