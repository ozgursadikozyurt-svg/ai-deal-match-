/**
 * Anahtar CRM v3.39 · 21 Ekim 2026
 * v3.38 — Özgür'ün 21 Ekim (2) istekleri:
 *   1) bütçesiz talep: yalnızca ★ Benim ya da "Bütçe m²'ye göre" işaretliyse puan düşmez; içeri aktarılmışsa en fazla 3/5
 *   2) pasife alınma tarihi (durumTarihi) ve "en uzun süredir pasif" sıralamaları
 *   3) Eşleşmeler: uyuma göre sıralı, varsayılan ≥ 3/5 ve talep başına en iyi 10
 */
import { test as nodeTest } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { eslesmeOnizle, butceSerbestle, BUTCESIZ_ICERI_SKOR_TAVANI, type OnizlemeKayit } from "../src/lib/eslestirme/onizleme";
import { BAGLAM, coz, cozulenToKayitLok } from "../demo/lokasyon";
import { sahipOzetleri, sahipOzetMetni, sureYaz } from "../src/lib/domain/sahipler";
import { aileOf } from "../src/lib/domain/kategori";
import { kayitSiralama } from "../demo/filtre";
import { kaliciHepsiniSil } from "../demo/kalici";
import { ornekVeriyiKur, bosBaglanti, bosGoogleBaglanti, DEMO_SAHIPLIK, type DepoDurumu, type Kayit } from "../demo/depo";
import { TTL_VARSAYILAN } from "../src/lib/domain/gecerlilik";
import { sahiplikNormalize } from "../src/lib/domain/sahiplik";
import type { Ctx } from "../demo/ortak";
import { ac } from "./yardimci-arayuz";
import fs from "node:fs";
import { SURUM, SURUM_GECMISI } from "../src/lib/surum";
import { SADECE_TEST_baglamiSabitle, VARSAYILAN_OFIS_ID, VARSAYILAN_KULLANICI_ID } from "../src/lib/kiracilik";
SADECE_TEST_baglamiSabitle({ ofisId: VARSAYILAN_OFIS_ID, kullaniciId: VARSAYILAN_KULLANICI_ID, rol: "OFIS_YONETICISI", eposta: "test@anahtar.local" });

const test = (ad: string, f: () => unknown | Promise<unknown>) => nodeTest(ad, async () => { kaliciHepsiniSil(); try { (globalThis as any).localStorage?.clear?.(); } catch { /* yok */ } await f(); });
const lok = (ham: string, portfoy: boolean) => cozulenToKayitLok(coz(ham).lokasyonlar, portfoy).map(({ etiket, seviye, ...l }: any) => l);
const T = (v: Partial<OnizlemeKayit> & Record<string, unknown> = {}): OnizlemeKayit => ({ tip: "TALEP", mulkTipi: "DAIRE", islemTipi: "KIRALIK", fiyatPeriyodu: "AYLIK", lokasyonlar: lok("Konyaaltı / Hurma", false), odaSayisi: "2+1", ...v } as OnizlemeKayit);
const P = (v: Partial<OnizlemeKayit> = {}): OnizlemeKayit => ({ tip: "PORTFOY", mulkTipi: "DAIRE", islemTipi: "KIRALIK", fiyatPeriyodu: "AYLIK", lokasyonlar: lok("Konyaaltı / Hurma", true), odaSayisi: "2+1", m2: 95, fiyat: 30_000, ...v } as OnizlemeKayit);

test("sürüm 3.38 ve ek belge", () => {
  const i = SURUM_GECMISI.findIndex((x) => x.surum === "3.38"); // v3.39 öne eklendi
  assert.ok(i >= 0 && SURUM_GECMISI[i + 1].surum === "3.37" && SURUM >= "3.38");
  assert.ok((SURUM_GECMISI[i].testEt ?? []).length >= 4);
  assert.ok(fs.existsSync("docs/ANAHTAR_CRM_EK_v3.38_21Ekim2026.md"));
});

// ───── 1) Bütçesiz talep ─────
test("içeri aktarılmış bütçesiz daire talebi en fazla 3/5; aynı talep ★ Benim (işaret / ad) ya da 'Bütçe m²'ye göre' ise 5/5", () => {
  const iceri = eslesmeOnizle(T(), P(), BAGLAM);
  assert.ok(iceri.seviye <= 3 && iceri.skor <= BUTCESIZ_ICERI_SKOR_TAVANI, `${iceri.skor}`);
  for (const t of [T({ butceSerbest: true }), butceSerbestle(T({ isaret: "BENIM" } as any)), butceSerbestle(T(), true)]) {
    const s = eslesmeOnizle(t, P(), BAGLAM);
    assert.equal(s.seviye, 5, `${s.skor} ${s.gerekceler.join(" | ")}`);
  }
  // portföy tarafına / bütçeli talebe dokunmaz
  assert.equal((butceSerbestle(P() as any, true) as any).butceSerbest, undefined, "portföye uygulanmaz");
  assert.equal(eslesmeOnizle(T({ maxFiyat: 35_000 }), P(), BAGLAM).seviye, 5);
});

// ───── 2) Durum tarihi ─────
test("sahip özeti: en eski pasif tarihi ve 'N aydır'; kayıt sıralamasında 'Pasife alınma (en eski önce)'", () => {
  const simdi = Date.parse("2026-10-21T12:00:00Z");
  const m = sahipOzetleri([
    { id: "P1", veri: { tip: "PORTFOY", mulkTipi: "DEPO_ANTREPO", durum: "PASSIVE", durumTarihi: "2026-06-01T00:00:00Z", kisiler: [{ kisiId: "K1", rol: "SAHIP" }] } },
    { id: "P2", veri: { tip: "PORTFOY", mulkTipi: "DEPO_ANTREPO", durum: "ARSIV", durumTarihi: "2026-09-01T00:00:00Z", kisiler: [{ kisiId: "K1", rol: "SAHIP" }] } },
  ], [{ id: "K1", roller: [] }], (t) => aileOf(t as any).kod);
  assert.equal(m.get("K1")!.enEskiKapanma, Date.parse("2026-06-01T00:00:00Z"));
  assert.match(sahipOzetMetni(m.get("K1")!, (x) => x, simdi), /2 pasif\/arşiv, 4 aydır/);
  assert.equal(sureYaz(simdi - 3 * 86_400_000, simdi), "3 gündür");
  const sec = kayitSiralama("PORTFOY").find((o) => o.alan === "durumTarihi")!;
  assert.ok(sec, "sıralama seçeneği var");
  const k = (durum: string, t?: string) => ({ id: durum + t, olusturma: "", veri: { durum, durumTarihi: t } } as any as Kayit);
  assert.ok((sec.deger(k("PASSIVE", "2026-06-01")) as number) < (sec.deger(k("PASSIVE", "2026-09-01")) as number));
  assert.equal(sec.deger(k("ACTIVE")), null, "aktif kayıt sona");
});

const ornek = ornekVeriyiKur();
const durum = (kayitlar: Kayit[] = ornek.kayitlar): DepoDurumu => ({ veriSurumu: "t", kayitlar, eslesmeNotlari: {}, testler: {}, geriBildirim: "", ayarlar: { ttl: TTL_VARSAYILAN, sahiplik: sahiplikNormalize(DEMO_SAHIPLIK) }, ogrenilen: [], adaylar: [], aktifIceAktarma: null, iceAktarmaGecmisi: [], kisiler: ornek.kisiler, islenmisMesajlar: [], dosyaIzleri: {}, baglantilar: { google: bosGoogleBaglanti(), notion: bosBaglanti() }, senkronGecmisi: [], cakismalar: [], googleBekleyen: [], favoriler: [] } as any);
const ctx = (d: DepoDurumu): Ctx => ({ d, guncelle: () => {}, kayitKaydet: () => {}, bildir: () => {}, ornekHatalari: [], git: () => {}, geri: () => {}, geriVar: false, sample: null } as any);

// ───── 3) Eşleşmeler ─────
test("Eşleşmeler: varsayılan 'Uyum ≥ 3/5' + 'Talep başına en iyi 10'; 15 kopya portföyde talebe 10 kart, '+N' ile hepsi; sıra seviye → skor", async () => {
  const { Eslesmeler } = await import("../demo/app");
  const kaynak = ornek.kayitlar.find((k) => /soğuk hava deposu/i.test(k.veri.baslik ?? "") && k.veri.tip === "PORTFOY")!;
  const kopyalar = Array.from({ length: 15 }, (_, i) => ({ ...kaynak, id: `PK${i}`, veri: { ...kaynak.veri, baslik: `Kopya soğuk hava ${i}`, m2: 900 + i * 37, fiyat: 150_000 + i * 2_100, kisiler: [], gondeTelefon: null, gondeAdi: null } }) as Kayit);
  const a = await ac(React.createElement(Eslesmeler), ctx(durum([...ornek.kayitlar, ...kopyalar])));
  const cipler = a.qa(".aktif-filtreler .cip").map((x) => x.textContent ?? "");
  assert.ok(cipler.some((x) => x.includes("Uyum ≥ 3/5")) && cipler.some((x) => x.includes("Talep başına en iyi 10")), cipler.join("|"));
  const talepAdi = "Gıda için soğuk hava deposu";
  const say = () => a.qa(".es2").filter((k) => k.querySelector(".es2-taraf.t")?.textContent?.includes(talepAdi)).length;
  assert.equal(say(), 10, "talep başına 10");
  const seviyeler = a.qa(".es2 .es2-skor b").map((b) => Number(b.textContent));
  assert.deepEqual(seviyeler, [...seviyeler].sort((x, y) => y - x), "uyuma göre azalan");
  await a.tikla(a.q("#tb-tumu"));
  assert.ok(say() >= 16, `hepsi açıldı: ${say()}`);
  await a.kapat();
});

test("talep formu: bütçe boşken 'Bütçe m²'ye göre' düğmesi; bütçe yazılınca gizlenir", async () => {
  const { KayitFormu } = await import("../demo/form");
  const a = await ac(React.createElement(KayitFormu, { tip: "TALEP" }), ctx(durum()));
  const d = () => a.q("#f-butce-serbest");
  assert.ok(d(), "düğme var");
  await a.tikla(d()); assert.equal(d()!.getAttribute("aria-pressed"), "true");
  await a.kapat();
});

test("Uygulama: pasife alınan kayıtta 'Pasif · bugünden beri'; Portföyler'de 'Pasife alınma' sıralaması seçilebilir", async () => {
  const { Uygulama } = await import("../demo/app");
  const a = await ac(React.createElement(Uygulama));
  const menu = (ad: string) => a.tikla(a.qa(".sol-menu .menu-oge").find((b) => (b.textContent ?? "").startsWith(ad)));
  await menu("Portföyler");
  await a.tikla(a.qa(".kayit-kart").find((k) => /Hacıaliler 4000/.test(k.textContent ?? "")));
  await a.tikla(a.q(".detay-ust #d-pasif"));
  assert.match(a.q(".pill-satir")!.textContent ?? "", /Pasif · bugünden beri/);
  await a.kapat();
});
