/**
 * Anahtar CRM v3.42 · 23 Ekim 2026 — Benim süresiz, süresi yaklaşanlar (+30), gelen kutusu gün süzgeci, kart yanında paylaşım seçimi,
 * açıklama, kartta kişi tekrarı, Görevler ekranı, açık kayıt (kayıt ol) şeması
 */
import { test as nodeTest } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import React from "react";
import { AnaSayfa, Liste, Detay } from "../demo/app";
import { SuresiYaklasanlar, sureListesi } from "../demo/sure";
import { GorevlerEkrani } from "../demo/gorevler";
import { ornekVeriyiKur, bosBaglanti, bosGoogleBaglanti, DEMO_SAHIPLIK, BUGUN, benimSuresiz, kalanGun, sureUzat, type DepoDurumu, type Kayit } from "../demo/depo";
import { sahiplikNormalize } from "../src/lib/domain/sahiplik";
import { TTL_VARSAYILAN, SURESIZ_TARIH, suresizMi } from "../src/lib/domain/gecerlilik";
import { KayitCreateSchema } from "../src/lib/validation/kayit";
import { KayitOlSchema } from "../src/lib/services/ofis";
import { kaliciHepsiniSil } from "../demo/kalici";
import { type Ctx } from "../demo/ortak";
import { ac } from "./yardimci-arayuz";
import { SADECE_TEST_baglamiSabitle, VARSAYILAN_OFIS_ID, VARSAYILAN_KULLANICI_ID } from "../src/lib/kiracilik";
import { elleGorevEkle } from "../demo/bugun-eylem";
import { gunYaz, gunEkle } from "../src/lib/domain/gorev";
import { SURUM, SURUM_GECMISI, DOSYA_EKI } from "../src/lib/surum";

SADECE_TEST_baglamiSabitle({ ofisId: VARSAYILAN_OFIS_ID, kullaniciId: VARSAYILAN_KULLANICI_ID, rol: "OFIS_YONETICISI", eposta: "test@anahtar.local" });
const ornek = ornekVeriyiKur();
const durum = (ek: Partial<DepoDurumu> = {}): DepoDurumu => ({ veriSurumu: "t", kayitlar: ornek.kayitlar, eslesmeNotlari: {}, testler: {}, geriBildirim: "", ayarlar: { ttl: TTL_VARSAYILAN, sahiplik: sahiplikNormalize(DEMO_SAHIPLIK) }, ogrenilen: [], adaylar: [], aktifIceAktarma: null, iceAktarmaGecmisi: [], kisiler: ornek.kisiler, islenmisMesajlar: [], dosyaIzleri: {}, baglantilar: { google: bosGoogleBaglanti(), notion: bosBaglanti() }, senkronGecmisi: [], cakismalar: [], gorevler: [], ilgilenenler: [], ...ek });
const test = (ad: string, f: () => unknown | Promise<unknown>) => nodeTest(ad, async () => { kaliciHepsiniSil(); await f(); });
const ctx = (d0: DepoDurumu, git: (e: any) => void = () => {}) => { const c: Ctx & { d: DepoDurumu } = { d: d0, guncelle: (f: any) => { c.d = f(c.d); }, kayitKaydet: (k: Kayit) => { c.d = { ...c.d, kayitlar: c.d.kayitlar.map((y) => (y.id === k.id ? k : y)) }; }, bildir: () => {}, ornekHatalari: [], git, geri: () => {}, geriVar: false, sample: null } as any; return c; };
const gunSonra = (g: number) => new Date(BUGUN.getTime() + g * 86_400_000);
const kayitla = (i: number, gun: number, ek: any = {}): Kayit => { const k = ornek.kayitlar[i]; return { ...k, veri: { ...k.veri, durum: "ACTIVE", validUntil: gunSonra(gun), ...ek } }; };

test("sürüm 3.26: günlük kaydı, belgeler ve göç", () => {
  const k = SURUM_GECMISI.find((x) => x.surum === "3.26")!; assert.ok(k); assert.ok((k.testEt ?? []).length >= 5);
  for (const f of ["docs/ANAHTAR_CRM_EK_v3.26_12Ekim2026.md", "docs/ANAHTAR_CRM_DEVIR_v3.26_12Ekim2026.md", "docs/ANAHTAR_CRM_SPRINT_PLANI_v3.26_12Ekim2026.md"]) assert.ok(fs.existsSync(f), f);
  assert.match(fs.readFileSync("prisma/migrations/20261012100000_v326_kayit_aciklama/migration.sql", "utf8"), /ADD COLUMN "aciklama"/);
});

test("Benim süresiz: işaret konur, süresi dolan açılır, pasif/arşive dokunulmaz; kalan gün yok, +30 değiştirmez", () => {
  const d = durum({ kayitlar: [kayitla(0, 3), kayitla(1, -2, { durum: "EXPIRED" }), kayitla(2, 3, { durum: "ARSIV" }), kayitla(3, 3)] });
  const benim = new Set([d.kayitlar[0].id, d.kayitlar[1].id, d.kayitlar[2].id]);
  const y = benimSuresiz(d, (v) => benim.has(d.kayitlar.find((k) => k.veri === v)?.id ?? ""));
  assert.ok(suresizMi(y.kayitlar[0].veri.validUntil)); assert.equal(kalanGun(y.kayitlar[0].veri), null);
  assert.equal(y.kayitlar[1].veri.durum, "ACTIVE"); assert.ok(suresizMi(y.kayitlar[1].veri.validUntil));
  assert.ok(!suresizMi(y.kayitlar[2].veri.validUntil), "arşive dokunulmaz");
  assert.ok(!suresizMi(y.kayitlar[3].veri.validUntil), "Benim olmayan aynı kalır");
  assert.equal(benimSuresiz(y, () => false), y, "değişiklik yoksa aynı nesne");
  assert.deepEqual(sureUzat(y.kayitlar[0].veri, 30).validUntil, SURESIZ_TARIH);
  assert.ok(KayitCreateSchema.safeParse({ ...y.kayitlar[0].veri }).success, "şema süresiz tarihi kabul eder");
});

test("süre listesi: eşik içi + süresi dolan; süresiz ve pasif dışarıda; kalana göre sıralı", () => {
  const l = [kayitla(0, 20), kayitla(1, 4), kayitla(2, -1, { durum: "EXPIRED" }), kayitla(3, 2, { validUntil: SURESIZ_TARIH }), kayitla(4, 1, { durum: "PASSIVE" })];
  assert.deepEqual(sureListesi(l, 14).map((k) => k.id), [l[2].id, l[1].id]);
  assert.equal(sureListesi(l, 30).length, 3);
});

test("Ana Sayfa: uzun 'Süresi yaklaşanlar' listesi yok, tek satır özet; ekranda Toplu +30 tümünü uzatır", async () => {
  const kayitlar = [kayitla(0, 3), kayitla(1, 4), kayitla(2, 10), ...ornek.kayitlar.slice(3).map((k) => ({ ...k, veri: { ...k.veri, validUntil: gunSonra(200) } }))];
  let git: any = null;
  const c = ctx(durum({ kayitlar }), (e) => (git = e));
  let e = await ac(React.createElement(AnaSayfa), c);
  // v3.30: özet en alttan en üste — Dikkat şeridi
  const oz = e.q(".dikkat")!; assert.ok(oz); assert.match(oz.textContent!, /2 kayıt 5 gün içinde bitiyor/); assert.match(oz.textContent!, /1 kayıt 14 gün içinde bitiyor/);
  await e.tikla(e.dugme("Gözden geçir")); assert.deepEqual(git, { ad: "suresi" });
  await e.kapat();
  e = await ac(React.createElement(SuresiYaklasanlar), c);
  assert.equal(e.qa(".kayit-kart").length, 3);
  assert.equal(e.qa(".uzat-btn").length, 3, "listede her kartta +30");
  await e.tikla(e.dugme("Tümüne +30 gün"));
  for (const k of c.d.kayitlar.slice(0, 3)) assert.ok((kalanGun(k.veri) ?? 0) >= 33);
  await e.kapat();
});

test("liste kartı: +30 yalnızca 5 gün ve altında; detayda +60/+90 yok", async () => {
  const kayitlar = [kayitla(0, 3), kayitla(1, 20)].map((k) => ({ ...k, veri: { ...k.veri, tip: "PORTFOY" as const } }));
  const c = ctx(durum({ kayitlar }));
  const e = await ac(React.createElement(Liste, { tip: "PORTFOY", baslangic: undefined } as any), c);
  assert.equal(e.qa(".uzat-btn").length, 1);
  await e.tikla(e.q(".uzat-btn")); assert.equal(kalanGun(c.d.kayitlar[0].veri), 33);
  await e.kapat();
  const e2 = await ac(React.createElement(Detay, { id: kayitlar[1].id } as any), ctx(durum({ kayitlar })));
  assert.ok(e2.dugme("+30 gün")); assert.ok(!e2.dugme("+60 gün")); assert.ok(!e2.dugme("+90 gün"));
  await e2.kapat();
});

test("paylaşım: kartların yanında tek tek seçim; seçilen sayısı paylaşım metnine girer", async () => {
  const c = ctx(durum());
  const e = await ac(React.createElement(Liste, { tip: "PORTFOY" } as any), c);
  assert.equal(e.qa(".kart-sec").length, 0);
  await e.tikla(e.dugme("Paylaş"));
  const sec = e.qa(".kart-sec"); assert.ok(sec.length >= 2);
  await e.tikla(sec[0]); await e.tikla(e.qa(".kart-sec")[1]);
  assert.match(e.metin(), /Metni kopyala \(2\)/);
  assert.equal(e.qa(".kart-sar.secili").length, 2);
  await e.kapat();
});

test("açıklama: şemada, kartta kısaca (açılır), detayda tamamı", async () => {
  const uzun = "Ana cadde cepheli, 6 m vitrin. Sahibi kiracılı satışa açık. ".repeat(4);
  const kayitlar = [kayitla(0, 100, { aciklama: uzun })];
  assert.ok(KayitCreateSchema.safeParse(kayitlar[0].veri).success);
  const c = ctx(durum({ kayitlar }));
  const e = await ac(React.createElement(Liste, { tip: kayitlar[0].veri.tip } as any), c);
  const a = e.q(".kart-aciklama")!; assert.ok(a); assert.equal(a.getAttribute("aria-expanded"), "false");
  await e.tikla(a); assert.equal(e.q(".kart-aciklama")!.getAttribute("aria-expanded"), "true");
  await e.kapat();
  const e2 = await ac(React.createElement(Detay, { id: kayitlar[0].id } as any), c);
  assert.equal(e2.q(".d-aciklama")!.textContent, uzun);
  await e2.kapat();
});

test("kart: kaynak etiketindeki kişi alt satırda tekrar yazılmaz", async () => {
  const k = ornek.kayitlar.find((x) => x.veri.tip === "PORTFOY" && (x.veri.kisiler ?? []).length)!;
  const c = ctx(durum({ kayitlar: [k] }));
  const e = await ac(React.createElement(Liste, { tip: "PORTFOY" } as any), c);
  const ad = c.d.kisiler.find((x) => x.id === k.veri.kisiler![0].kisiId)!.adSoyad;
  const sayi = (e.q(".kayit-kart")!.textContent!.split(ad).length - 1);
  assert.equal(sayi, 1, "kişi adı kartta bir kez: " + e.q(".kayit-kart")!.textContent);
  await e.kapat();
});

test("Görevler ekranı: tüm açık görevler gruplu (15 sınırı yok), türe göre süzülür", async () => {
  let d = durum();
  for (let i = 0; i < 20; i++) d = elleGorevEkle(d, { baslik: "Ara " + i, vade: gunEkle(gunYaz(BUGUN), i % 3 === 0 ? -1 : 0) }, BUGUN);
  const e = await ac(React.createElement(GorevlerEkrani), ctx(d));
  assert.match(e.metin(), /Geciken \(\d+\)/); assert.match(e.metin(), /Bugün \(\d+\)/);
  assert.ok(e.qa(".gorev").length >= 20);
  await e.kapat();
});

test("menü: Görevler en sonda", () => {
  const app = fs.readFileSync("demo/app.tsx", "utf8");
  const nav = app.slice(app.indexOf("const nav: NavOge[] = ["), app.indexOf("];", app.indexOf("const nav: NavOge[] = [")));
  assert.match(nav.trim().split("\n").filter((x) => x.includes("{ k:")).at(-1)!, /k: "gorevler"/);
});

test("gelen kutusu: 7 / 15 / 30 gün süzgeci", () => {
  const s = fs.readFileSync("demo/gelen-kutusu.tsx", "utf8");
  assert.match(s, /\[7, "Son 7 gün"\], \[15, "Son 15 gün"\], \[30, "Son 30 gün"\]/);
});

test("açık kayıt şeması: onay şart, ofis ve ad zorunlu", () => {
  assert.ok(KayitOlSchema.safeParse({ ofisAd: "Lara Emlak", adSoyad: "Ayşe Y.", onay: true }).success);
  assert.ok(!KayitOlSchema.safeParse({ ofisAd: "Lara Emlak", adSoyad: "Ayşe Y.", onay: false }).success);
  assert.ok(!KayitOlSchema.safeParse({ ofisAd: "L", adSoyad: "Ayşe Y.", onay: true }).success);
});
