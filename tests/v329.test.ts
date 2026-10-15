/**
 * Anahtar CRM v3.31 · 15 Ekim 2026 — fazla oda bütçe içindeyse sunulur; "asansör / havuz şart" öldürücü; Barınaklar Bulvarı
 * (cadde / bulvar alt bölgesi şerittir); veritabanı yolu (Hyperdrive + yerleşim); Vercel otomatik yayını kapalı.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { eslesmeOnizle, MODEL, KONUM_SKOR_TAVANI, KOSULLU_SKOR_TAVANI, type OnizlemeKayit } from "../src/lib/eslestirme/onizleme";
import { talepDnasi } from "../src/lib/eslestirme/talep-dna";
import { hizliAyristir } from "../src/lib/ai/hizli-ayristirici";
import { MulkOzellikSchema } from "../src/lib/validation/kayit";
import { TeknikAlan } from "../src/generated/prisma/enums";
import { veritabaniAdresi, hyperdriveHatasiniIsle, hyperdriveyiSifirla } from "../src/canli/veritabani";
import { ANTALYA_ALT_BOLGELER } from "../prisma/seed/antalya";
import { coz, BAGLAM } from "../demo/lokasyon";
import { SURUM, SURUM_GECMISI } from "../src/lib/surum";

const L = (ad: string, birincil = false) => { const l = coz(ad).lokasyonlar[0]; return { ilId: 7, ilceId: l.ilceId ?? null, mahalleId: l.mahalleId ?? null, altBolgeId: l.altBolgeId ?? null, birincil }; };
const talep = (x: Partial<OnizlemeKayit>): OnizlemeKayit => ({ tip: "TALEP", mulkTipi: "DAIRE", islemTipi: "SATILIK", odaSayisi: "3+1", maxFiyat: 8_000_000, lokasyonlar: [L("Güzeloba")], ...x });
const portfoy = (x: Partial<OnizlemeKayit>): OnizlemeKayit => ({ tip: "PORTFOY", mulkTipi: "DAIRE", islemTipi: "SATILIK", odaSayisi: "3+1", m2: 140, fiyat: 7_500_000, lokasyonlar: [L("Güzeloba", true)], ...x });
const s = (t: OnizlemeKayit, p: OnizlemeKayit) => eslesmeOnizle(t, p, BAGLAM);

test("sürüm 3.29 kaydı", () => {
  const k = SURUM_GECMISI.find((x) => x.surum === "3.29")!; // v3.30'dan beri en üstte değil
  assert.ok(k); assert.equal(SURUM_GECMISI[SURUM_GECMISI.indexOf(k) + 1].surum, "3.28");
  assert.ok((k.testEt ?? []).length >= 4);
});

test("oda: 3+1 talebe bütçe içindeki 4+1 / 5+1 Sunulabilir ama tam 3+1'in altında; eksik oda elenir", () => {
  const tam = s(talep({}), portfoy({})), bir = s(talep({}), portfoy({ odaSayisi: "4+1" })), iki = s(talep({}), portfoy({ odaSayisi: "5+1" }));
  assert.deepEqual([tam.uygunluk, bir.uygunluk, iki.uygunluk], ["SUNULABILIR", "SUNULABILIR", "SUNULABILIR"]);
  assert.ok(tam.skor > bir.skor && bir.skor > iki.skor && iki.skor >= 85, `${tam.skor} > ${bir.skor} > ${iki.skor}`);
  assert.equal(iki.kriterler.find((k) => k.anahtar === "odaSayisi")!.puan, MODEL.oda.fazla2);
  assert.match(iki.kriterler.find((k) => k.anahtar === "odaSayisi")!.portfoy, /2 oda fazla/);
  assert.equal(s(talep({}), portfoy({ odaSayisi: "2+1" })).uygunluk, "UYGUN_DEGIL");
  // bütçe aşılıyorsa fazla oda kurtarmaz
  assert.equal(s(talep({}), portfoy({ odaSayisi: "5+1", fiyat: 9_500_000 })).uygunluk, "UYGUN_DEGIL");
});

test("oda: fazla oda, fiyat ya da bütçe bilinmiyorsa Koşullu + not", () => {
  const fiyatsiz = s(talep({}), portfoy({ odaSayisi: "5+1", fiyat: null }));
  assert.equal(fiyatsiz.uygunluk, "KOSULLU"); assert.ok(fiyatsiz.uyarilar.some((u) => /2 oda fazla — bütçe/.test(u)));
  const butcesiz = s(talep({ maxFiyat: null }), portfoy({ odaSayisi: "4+1" }));
  assert.equal(butcesiz.uygunluk, "KOSULLU"); assert.ok(butcesiz.skor <= KOSULLU_SKOR_TAVANI);
  // tam oda + bütçesiz talepte bu not çıkmaz
  assert.ok(!s(talep({ maxFiyat: null }), portfoy({})).uyarilar.some((u) => /oda fazla/.test(u)));
});

test("asansör / havuz şart: yeni kriterler; yok → elenir, bilinmiyor → Koşullu, var → Sunulabilir", () => {
  assert.ok(Object.values(TeknikAlan).includes("ASANSOR" as any) && Object.values(TeknikAlan).includes("HAVUZ" as any));
  assert.deepEqual(MulkOzellikSchema.parse({ kritikKriterler: ["ASANSOR", "HAVUZ"] }).kritikKriterler, ["ASANSOR", "HAVUZ"]);
  const t = talep({ ozellik: { kritikKriterler: ["ASANSOR"] } as any }); // alan boş bırakılmış: "şart" → istiyor sayılır
  assert.ok(talepDnasi(t as any).kritik.some((k) => k.kriter === "ASANSOR" && k.etiket === "Asansör"));
  const yok = s(t, portfoy({ ozellik: { asansor: false } as any }));
  assert.equal(yok.uygunluk, "UYGUN_DEGIL"); assert.ok(yok.kritikEngeller.includes("Asansör"));
  const bilinmiyor = s(t, portfoy({}));
  assert.equal(bilinmiyor.uygunluk, "KOSULLU"); assert.ok(bilinmiyor.bilinmeyenKritikler.includes("Asansör"));
  assert.equal(s(t, portfoy({ ozellik: { asansor: true } as any })).uygunluk, "SUNULABILIR");
  // şart değilse (yalnızca "asansörlü") asansörsüz portföy elenmez
  assert.notEqual(s(talep({ ozellik: { asansor: true } as any }), portfoy({ ozellik: { asansor: false } as any })).uygunluk, "UYGUN_DEGIL");
  const havuz = s(talep({ ozellik: { havuz: true, kritikKriterler: ["HAVUZ"] } as any }), portfoy({ ozellik: { havuz: false } as any }));
  assert.equal(havuz.uygunluk, "UYGUN_DEGIL");
});

test("hızlı ayrıştırıcı: 'asansör şart', 'mutlaka havuzlu' → şart; yalnızca 'asansörlü' şart değil", () => {
  const oz = (m: string) => (hizliAyristir(m).ozellik ?? {}) as any;
  assert.deepEqual(oz("TALEP Fener 2+1 asansör şart, satılık, 5 milyon").kritikKriterler, ["ASANSOR"]);
  assert.deepEqual(oz("Işıklar 2+1 satılık talep ASANSÖR ŞART 2. kat ve üstü bütçe 18 milyon").kritikKriterler, ["ASANSOR"]);
  assert.deepEqual(oz("Lara 3+1 kiralık daire arıyorum, mutlaka havuzlu site, 50 bin TL").kritikKriterler, ["HAVUZ"]);
  const sartsiz = oz("TALEP Fener 2+1 asansörlü satılık 5 milyon");
  assert.equal(sartsiz.asansor, true); assert.equal(sartsiz.kritikKriterler, undefined);
  assert.equal(oz("TALEP Fener 2+1 asansörsüz olabilir satılık 5 milyon").kritikKriterler, undefined);
});

test("Barınaklar Bulvarı: Çağlayan + Güzeloba; cadde / bulvar alt bölgesinde yalnız mahallede olmak Koşullu", () => {
  const bb = ANTALYA_ALT_BOLGELER.find((a) => a.slug === "barinaklar-bulvari")!;
  assert.deepEqual(bb.mahalleler.map(([, m]) => m).sort(), ["caglayan", "guzeloba"]); assert.equal(bb.dogrulandi, true);
  const bbId = ANTALYA_ALT_BOLGELER.indexOf(bb) + 1;
  assert.ok(BAGLAM.aksAltBolgeler!.has(bbId)); assert.ok(!BAGLAM.aksAltBolgeler!.has(1), "Lara bir semt, aks değil");
  const t = talep({ odaSayisi: "2+1", lokasyonlar: coz("Fener, Barınaklar Bulvarı").lokasyonlar.map((l) => ({ ilId: 7, ilceId: l.ilceId ?? null, mahalleId: l.mahalleId ?? null, altBolgeId: l.altBolgeId ?? null, birincil: false })) });
  // Güzeloba'daki daire (bulvarı belirtmemiş): Koşullu, en fazla 80 — "Fener, Barınaklar" talebine üç Güzeloba dairesi "yanlış" işaretlenmişti
  const mahallede = s(t, portfoy({ odaSayisi: "2+1" }));
  assert.equal(mahallede.lokasyonKademe, "AKS_MAHALLE"); assert.equal(mahallede.uygunluk, "KOSULLU");
  assert.ok(mahallede.skor <= KONUM_SKOR_TAVANI.AKS_MAHALLE!); assert.match(mahallede.lokasyonAciklama, /yakınlığını sorun/);
  // portföy bulvarı kendisi belirtmiş → tam uyum
  const bulvarda = s(t, portfoy({ odaSayisi: "2+1", lokasyonlar: [{ ...L("Güzeloba", true), altBolgeId: bbId }] }));
  assert.equal(bulvarda.lokasyonKademe, "ALT_BOLGE"); assert.equal(bulvarda.uygunluk, "SUNULABILIR");
  // ilan metni bulvarı anıyorsa ("Barınaklar Bulvarı'na 2 dk") tam uyum
  const metinde = s(t, portfoy({ odaSayisi: "2+1", baslik: "Güzeloba'da Barınaklar Bulvarı'na yürüme mesafesinde 2+1" }));
  assert.equal(metinde.lokasyonKademe, "ALT_BOLGE"); assert.equal(metinde.uygunluk, "SUNULABILIR"); assert.match(metinde.lokasyonAciklama, /ilan metninde/);
  // semt alt bölgesi (Lara) eskisi gibi: mahallede olmak yeter
  assert.equal(s(talep({ lokasyonlar: [L("Lara")] }), portfoy({})).lokasyonKademe, "ALT_BOLGE");
});

test("veritabanı yolu: Hyperdrive bağlıysa o, Hyperdrive hatasında 10 dakika doğrudan bağlantı", () => {
  hyperdriveyiSifirla();
  const env = { DATABASE_URL: "postgres://dogrudan", HYPERDRIVE: { connectionString: "postgres://hyperdrive" } };
  assert.equal(veritabaniAdresi({ DATABASE_URL: "postgres://dogrudan" }), "postgres://dogrudan");
  assert.equal(veritabaniAdresi(env, 1_000), "postgres://hyperdrive");
  assert.equal(hyperdriveHatasiniIsle(new Error("Unique constraint failed on fiyat 58000"), 1_000), false, "sıradan hata (içinde 58000 geçse de) yolu değiştirmez");
  assert.equal(veritabaniAdresi(env, 1_000), "postgres://hyperdrive");
  assert.equal(hyperdriveHatasiniIsle(Object.assign(new Error("Failed to acquire a connection from the pool."), { code: "58000" }), 1_000), true);
  assert.equal(veritabaniAdresi(env, 1_000 + 60_000), "postgres://dogrudan");
  assert.equal(veritabaniAdresi(env, 1_000 + 10 * 60_000), "postgres://hyperdrive");
  hyperdriveyiSifirla();
  const w = fs.readFileSync("src/canli/worker.ts", "utf8");
  assert.ok(!/istekIcinde\(env\.DATABASE_URL/.test(w), "tüm işleyiciler veritabaniAdresi üzerinden");

});

test("şema ve yayın: enum göçü, Vercel otomatik yayını kapalı", () => {
  const g = fs.readFileSync("prisma/migrations/20261014100000_v329_asansor_havuz/migration.sql", "utf8");
  assert.match(g, /ADD VALUE IF NOT EXISTS 'ASANSOR'/); assert.match(g, /ADD VALUE IF NOT EXISTS 'HAVUZ'/);
  assert.match(fs.readFileSync("prisma/schema.prisma", "utf8"), /KREDI\n[^}]*ASANSOR\n\s*HAVUZ\n\}/);
  assert.deepEqual(JSON.parse(fs.readFileSync("vercel.json", "utf8")), { git: { deploymentEnabled: false } });
});
