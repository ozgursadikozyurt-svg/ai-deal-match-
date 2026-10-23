/**
 * Anahtar CRM v3.41 · 23 Ekim 2026 — eşleştirme kalitesi: tip ailesi (otomatik / seçmeli), satışta bütçe tabanı,
 * yıllık girilmiş kira, güven göstergesi, tip çelişkisi, mükerrer ilan; içe aktarmada yıllık kira okuma.
 * Senaryolar 13 Ekim 2026 canlı veri incelemesinden (62 talep × 410 portföy) alındı.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { eslesmeOnizle, temelUyum, kiraPeriyotSuphesi, KIRA_BIRIM_UST, BILINMEYEN_ISTEK_SKOR_TAVANI, type OnizlemeKayit, type LokasyonBaglami } from "../src/lib/eslestirme/onizleme";
import { tipBenzerligi, tipGecerli } from "../src/lib/domain/kategori";
import { tipCeliskisi } from "../src/lib/domain/tip-celiskisi";
import { yillikKiraIfadesi, kirayiAyligaCevir } from "../src/lib/domain/kira-periyot";
import { KayitCreateSchema } from "../src/lib/validation/kayit";
import { portfoyImzasi, mukerrerleriTopla } from "../src/lib/eslestirme/mukerrer";
import { hizliAyristir } from "../src/lib/ai/hizli-ayristirici";
import { dosyaSatirlari, satirDonustur, satirHazirla } from "../src/lib/ingest/tablo";
import { csvOku } from "../src/lib/ingest/xlsx";
import { ornekRevyCsv } from "../demo/ornek-gelen";
import { INDEKS } from "../demo/lokasyon";
import { SURUM_GECMISI } from "../src/lib/surum";

const B: LokasyonBaglami = { komsuIlceler: new Set(), altBolgeMahalleleri: new Map() };
const MURATPASA = [{ ilId: 7, ilceId: 108, birincil: true }];
const KEPEZ = [{ ilId: 7, ilceId: 103, birincil: true }];
const talep = (x: Partial<OnizlemeKayit>): OnizlemeKayit => ({ tip: "TALEP", mulkTipi: "DAIRE", islemTipi: "SATILIK", lokasyonlar: MURATPASA, ...x });
const portfoy = (x: Partial<OnizlemeKayit>): OnizlemeKayit => ({ tip: "PORTFOY", mulkTipi: "DAIRE", islemTipi: "SATILIK", lokasyonlar: MURATPASA, ...x });

test("sürüm 3.27 kaydı", () => {
  const i = SURUM_GECMISI.findIndex((k) => k.surum === "3.27"); // v3.28 öne eklenir
  assert.ok(i >= 0 && (SURUM_GECMISI[i].testEt ?? []).length >= 5); assert.equal(SURUM_GECMISI[i + 1].surum, "3.26");
});

test("tip ailesi: Daire ↔ Ofis kendiliğinden eşleşmez; Depo ↔ Üretim eşleşir; talep alternatif seçerse Daire de gelir", () => {
  assert.equal(tipBenzerligi("BURO_OFIS", "DAIRE").oran, 0.4);
  assert.equal(tipBenzerligi("BURO_OFIS", "DAIRE").otomatik, false);
  assert.equal(tipGecerli(tipBenzerligi("DEPO_ANTREPO", "FABRIKA_URETIM_TESISI")), true);
  const ofisTalebi = talep({ mulkTipi: "BURO_OFIS", minM2: 50, maxM2: 55, maxFiyat: 9_000_000 });
  const daire = portfoy({ m2: 50, fiyat: 4_600_000, odaSayisi: "1+1" });
  assert.equal(temelUyum(ofisTalebi, daire), false, "ofis talebine daire listeye girmez");
  const s = eslesmeOnizle(ofisTalebi, daire, B);
  assert.equal(s.uygunluk, "UYGUN_DEGIL"); assert.ok(s.kritikEngeller.includes("Mülk tipi uymuyor"));
  assert.equal(temelUyum({ ...ofisTalebi, alternatifMulkTipleri: ["DAIRE"] }, daire), true, "talep daireyi de kabul ediyorsa gelir");
  assert.equal(temelUyum(talep({ mulkTipi: "DEPO_ANTREPO", islemTipi: "KIRALIK" }), portfoy({ mulkTipi: "IMALATHANE", islemTipi: "KIRALIK" })), true);
});

test("satışta bütçenin %30'unun altı elenir; kirada elenmez", () => {
  const t = talep({ mulkTipi: "ARSA", maxFiyat: 35_000_000 });
  const ucuz = eslesmeOnizle(t, portfoy({ mulkTipi: "ARSA", m2: 500, fiyat: 3_500_000 }), B);
  assert.equal(ucuz.uygunluk, "UYGUN_DEGIL");
  assert.match(ucuz.kriterler.find((k) => k.anahtar === "fiyat")!.portfoy, /farklı segment/);
  assert.notEqual(eslesmeOnizle(t, portfoy({ mulkTipi: "ARSA", m2: 3000, fiyat: 27_000_000 }), B).uygunluk, "UYGUN_DEGIL");
  // kira: 200 bin bütçeli depo talebine 500 m² / 50 bin depo meşru aday
  const kira = eslesmeOnizle(talep({ mulkTipi: "DEPO_ANTREPO", islemTipi: "KIRALIK", maxFiyat: 200_000, lokasyonlar: KEPEZ }), portfoy({ mulkTipi: "DEPO_ANTREPO", islemTipi: "KIRALIK", fiyatPeriyodu: "AYLIK", m2: 500, fiyat: 50_000, lokasyonlar: KEPEZ }), B);
  assert.notEqual(kira.uygunluk, "UYGUN_DEGIL");
});

test("yıllık girilmiş depo kirası: 12'ye bölünür, uyarılır, eşleşme kaçmaz", () => {
  const p = portfoy({ mulkTipi: "DEPO_ANTREPO", islemTipi: "KIRALIK", fiyatPeriyodu: "AYLIK", m2: 1000, fiyat: 1_300_000, lokasyonlar: KEPEZ });
  assert.equal(kiraPeriyotSuphesi(p as any), 1300);
  assert.equal(kiraPeriyotSuphesi({ ...p, fiyat: 150_000 } as any), null, "1000 m² / 150 bin akla yatkın");
  assert.equal(kiraPeriyotSuphesi({ ...p, fiyatPeriyodu: "YILLIK" } as any), null);
  assert.equal(kiraPeriyotSuphesi({ ...p, mulkTipi: "DAIRE", m2: 100, fiyat: 90_000 } as any), null, "konutta eşik yok");
  assert.equal(KIRA_BIRIM_UST.SANAYI, 600);
  const t = talep({ mulkTipi: "DEPO_ANTREPO", islemTipi: "KIRALIK", fiyatPeriyodu: "AYLIK", minM2: 1000, maxM2: 1500, maxFiyat: 150_000, lokasyonlar: KEPEZ });
  const s = eslesmeOnizle(t, p, B);
  assert.notEqual(s.uygunluk, "UYGUN_DEGIL", "eskiden 'bütçe aşımı' ile eleniyordu");
  assert.equal(s.kriterler.find((k) => k.anahtar === "fiyat")!.sonuc, "SAGLANDI");
  assert.ok(s.uyarilar.some((u) => /yıllık girilmiş olabilir/.test(u)));
  assert.equal(s.uygunluk, "KOSULLU", "uyarılı eşleşme en fazla Koşullu");
});

test("güven göstergesi: az kriterli eşleşme DÜŞÜK ve Sunulabilir olamaz; dolu eşleşme YÜKSEK", () => {
  const az = eslesmeOnizle(talep({ maxFiyat: 7_000_000 }), portfoy({ fiyat: 6_500_000, m2: 120, odaSayisi: "3+1" }), B);
  assert.equal(az.guven.seviye, "DUSUK"); assert.notEqual(az.uygunluk, "SUNULABILIR"); assert.match(az.guven.aciklama, /kriterden/);
  const dolu = eslesmeOnizle(
    talep({ mulkTipi: "DEPO_ANTREPO", islemTipi: "KIRALIK", fiyatPeriyodu: "AYLIK", minM2: 1000, maxM2: 1500, maxFiyat: 150_000, lokasyonlar: KEPEZ, ozellik: { elektrikGucuKw: 40, netYukseklikM: 7, rampa: true } }),
    portfoy({ mulkTipi: "DEPO_ANTREPO", islemTipi: "KIRALIK", fiyatPeriyodu: "AYLIK", m2: 1100, fiyat: 140_000, lokasyonlar: KEPEZ, ozellik: { elektrikGucuKw: 60, netYukseklikM: 8, rampa: true } }), B);
  assert.equal(dolu.guven.seviye, "YUKSEK", dolu.guven.aciklama); assert.equal(dolu.uygunluk, "SUNULABILIR");
});

test("tip çelişkisi: 'SATILIK ARSA' yazan Ofis talebi uyarılır; kendi tipini söyleyen kayıt uyarılmaz", () => {
  assert.deepEqual(tipCeliskisi({ mulkTipi: "BURO_OFIS", hamMetin: "〰️TALEP 〰️ ——ALTINTAŞ—— —SATILIK ARSA— 30-35 milyon" }), { kelime: "arsa", aile: "ARSA" });
  assert.equal(tipCeliskisi({ mulkTipi: "BURO_OFIS", hamMetin: "SATILIK OFİS TALEBİ Şirinyalı 1+1 50 m²" }), null);
  assert.equal(tipCeliskisi({ mulkTipi: "DAIRE", hamMetin: "ofis olarak kullanılacak 2+1" }), null);
  assert.equal(tipCeliskisi({ mulkTipi: "DEPO_ANTREPO", hamMetin: "4000 m² depo, 10.000 m² arsa da olabilir" }), null);
  assert.equal(tipCeliskisi({ mulkTipi: "DUKKAN_MAGAZA", hamMetin: "Waffle dükkânı açmaya uygun" }), null, "Türkçe harf sınırı");
  assert.equal(tipCeliskisi({ mulkTipi: "DAIRE" }), null);
  const s = eslesmeOnizle(talep({ mulkTipi: "BURO_OFIS", maxFiyat: 35_000_000, hamMetin: "—SATILIK ARSA— Altıntaş" }), portfoy({ mulkTipi: "BURO_OFIS", m2: 200, fiyat: 30_000_000 }), B);
  assert.ok(s.uyarilar.some((u) => /"arsa"/.test(u))); assert.equal(s.guven.seviye, "DUSUK"); assert.notEqual(s.uygunluk, "SUNULABILIR");
});

test("mükerrer ilan: aynı tip/işlem/m²/fiyat/oda/mahalle tek satır; eksik veride gruplanmaz", () => {
  const v = { mulkTipi: "DAIRE", islemTipi: "SATILIK", m2: 140, fiyat: 9_100_000, odaSayisi: "3+1", lokasyonlar: [{ mahalleId: 568, ilceId: 104, birincil: true }] };
  assert.ok(portfoyImzasi(v)); assert.equal(portfoyImzasi({ ...v, fiyat: null }), null); assert.equal(portfoyImzasi({ ...v, lokasyonlar: [] }), null);
  const e = (tid: string, pid: string, veri: any) => ({ t: { id: tid }, p: { id: pid, veri } });
  const r = mukerrerleriTopla([e("T1", "P1", v), e("T1", "P2", { ...v }), e("T2", "P2", v), e("T1", "P3", { ...v, fiyat: 9_200_000 })]);
  assert.deepEqual(r.map((x) => `${x.t.id}-${x.p.id}`), ["T1-P1", "T2-P2", "T1-P3"]);
  assert.deepEqual(r[0].kopyalar!.map((x) => x.id), ["P2"]);
});

test("içe aktarma: 'yıllık kira' okunur (ifade, WhatsApp mesajı, Revy satırı); yaş ve aidat kira sayılmaz", () => {
  for (const m of ["YENİGÖL MAH. 1000 M2 DEPO YILLIK KİRA 1.000.000", "kirası yıllık 1.300.000", "1.300.000 TL/yıl", "Yıllık 1.2 milyon", "yıllık kirası 900 bin"]) assert.ok(yillikKiraIfadesi(m), m);
  for (const m of ["15 yıllık bina", "yıllık aidat 12.000", "aylık 85.000 TL", "KİRA BEDELİ YILLIK PEŞİN +kdv", "kira yıllık peşin ödenir", "yıllık peşin ödeme", ""]) assert.equal(yillikKiraIfadesi(m), false, m);
  const w = hizliAyristir("Kiralık depo Yenigöl 1000 m2 yıllık kira 1.000.000 TL");
  assert.equal(w.fiyatPeriyodu, "YILLIK");
  assert.equal(hizliAyristir("Kiralık depo Yenigöl 1000 m2 aylık 120.000 TL").fiyatPeriyodu, "AYLIK");
  const R = (fiyat: string, baslik: string) => ["05.10.2026", "Ticari", "Depo & Antrepo", "Kiralık", "1000", fiyat, "", "", baslik, "Antalya", "Kepez", "", "Yenigöl Mah", "", "", "", "", "Hayır", "", "", "Hayır", "Hayır", "Mülk Sahibi", "Ali V.", "", "5", "Aktif", "Sahibinden.com", "https://sahibinden.com/1344109419"];
  const satir = (h: string[]) => { const b = dosyaSatirlari([csvOku(ornekRevyCsv().split("\n")[0] + "\n" + h.join(";"), "x")])[0]; return satirHazirla(satirDonustur(b.satirlar[0].hucreler, b.eslesme, { tip: "PORTFOY", dosyaTuru: "PORTAL", varsayilanSahip: "EMLAKCI", ilanGun: 90, varsayilanIslem: "SATILIK", bugun: new Date(2026, 9, 13), dosyaAdi: "ads.xlsx" }, 2), INDEKS as any); };
  const y = satir(R("1000000", "YENİGÖL MAH. 1000 M2 DEPO YILLIK KİRA 1.000.000"));
  assert.equal(y.girdi.fiyatPeriyodu, "YILLIK"); assert.ok(y.kontrol.some((k) => /aylığa çevrildi/.test(k)));
  // kayda AYLIK girer: 1.000.000 / 12; yıllık tutar notta, ödeme şekli yıllık peşin
  assert.equal(y.veri!.fiyatPeriyodu, "AYLIK"); assert.equal(Number(y.veri!.fiyat), 83_333);
  assert.match(String(y.veri!.operasyonNotu), /Kira yıllık isteniyor: 1\.000\.000 TL\/yıl/);
  const s = satir(R("1300000", "Yenigöl Mah - Hava Alanı Yakınında - 1.000 m2 Depo"));
  assert.equal(s.girdi.fiyatPeriyodu, "AYLIK"); assert.ok(s.kontrol.some((k) => /yıllık kira olabilir/.test(k)), s.kontrol.join(" | "));
  const n = satir(R("120000", "Yenigöl 1000 m2 depo"));
  assert.equal(n.girdi.fiyatPeriyodu, "AYLIK"); assert.ok(!n.kontrol.some((k) => /yıllık/.test(k)));
});

test("kira her zaman AYLIK saklanır: yıllık girilen 12'ye bölünür (talep bütçesi dahil), not ve ödeme şekli eklenir; satış dokunulmaz", () => {
  const p = kirayiAyligaCevir({ islemTipi: "KIRALIK", fiyatPeriyodu: "YILLIK", fiyat: 1_200_000, operasyonNotu: null as string | null, ozellik: {} as any });
  assert.equal(p.fiyatPeriyodu, "AYLIK"); assert.equal(p.fiyat, 100_000); assert.equal(p.ozellik.kiraOdemeSekli, "YILLIK_PESIN");
  assert.match(p.operasyonNotu!, /1\.200\.000 TL\/yıl \(aylık ≈ 100\.000 TL\)/);
  assert.deepEqual(kirayiAyligaCevir(p), p, "ikinci geçişte değişmez");
  const t = kirayiAyligaCevir({ islemTipi: "KIRALIK", fiyatPeriyodu: "YILLIK", minFiyat: 600_000, maxFiyat: 1_800_000 });
  assert.equal(t.minFiyat, 50_000); assert.equal(t.maxFiyat, 150_000);
  assert.equal(kirayiAyligaCevir({ islemTipi: "KIRALIK", fiyatPeriyodu: "TOPLAM", fiyat: 50_000 }).fiyatPeriyodu, "AYLIK");
  assert.equal(kirayiAyligaCevir({ islemTipi: "SATILIK", fiyatPeriyodu: "YILLIK", fiyat: 9_000_000 }).fiyat, 9_000_000);
  // tüm girişler (form, içe aktarma, API) şemadan geçer
  const k = KayitCreateSchema.parse({ tip: "PORTFOY", mulkTipi: "DEPO_ANTREPO", islemTipi: "KIRALIK", fiyatPeriyodu: "YILLIK", fiyat: 1_300_000, m2: 1000, lokasyonlar: [{ ilId: 7, ilceId: 103 }] });
  assert.equal(k.fiyatPeriyodu, "AYLIK"); assert.equal(Number(k.fiyat), 108_333); assert.match(String(k.operasyonNotu), /yıllık isteniyor/);
});

test("istenen ama bilinmeyen özellik: eleme yok, skor 85'i geçmez ve Koşullu; bilinen 'yok' daha aşağıda; doğrulanmış olan üstte", () => {
  const t = talep({ mulkTipi: "DEPO_ANTREPO", islemTipi: "KIRALIK", fiyatPeriyodu: "AYLIK", minM2: 1000, maxM2: 1500, maxFiyat: 150_000, lokasyonlar: KEPEZ, ozellik: { ofis: true, kapaliAlanM2: 1000 } as any });
  const depo = (ofis?: boolean) => portfoy({ mulkTipi: "DEPO_ANTREPO", islemTipi: "KIRALIK", fiyatPeriyodu: "AYLIK", m2: 1100, fiyat: 120_000, lokasyonlar: KEPEZ, ozellik: ofis == null ? {} : ({ ofis } as any) });
  const var_ = eslesmeOnizle(t, depo(true), B), bilinmiyor = eslesmeOnizle(t, depo(), B), yok = eslesmeOnizle(t, depo(false), B);
  assert.notEqual(bilinmiyor.uygunluk, "UYGUN_DEGIL"); assert.equal(bilinmiyor.uygunluk, "KOSULLU");
  assert.ok(bilinmiyor.skor <= BILINMEYEN_ISTEK_SKOR_TAVANI);
  assert.ok(var_.skor > bilinmiyor.skor && bilinmiyor.skor > yok.skor, `${var_.skor} > ${bilinmiyor.skor} > ${yok.skor}`);
  // v3.28 — talepteki kapalı alan alt m² ile aynıysa ayrı satır açılmaz (çift sayım)
  assert.equal(var_.kriterler.find((k) => k.anahtar === "kapaliAlanM2"), undefined);
  // talep yalnızca kapalı alan verdiyse depoda kapalı alan girilmemişse ilanın m²'si sayılır
  const yalnizKapali = eslesmeOnizle(talep({ mulkTipi: "DEPO_ANTREPO", islemTipi: "KIRALIK", fiyatPeriyodu: "AYLIK", maxFiyat: 150_000, lokasyonlar: KEPEZ, ozellik: { kapaliAlanM2: 1000 } as any }), depo(true), B);
  const ka = yalnizKapali.kriterler.find((k) => k.anahtar === "kapaliAlanM2")!;
  assert.equal(ka.sonuc, "SAGLANDI"); assert.match(ka.portfoy, /ilan m²'si/);
});

test("Var / Yok hızlı cevap: eşleşme kartında bilinmeyen evet/hayır özellik için iki küçük düğme; basınca portföye yazılır", async () => {
  const React = (await import("react")).default;
  const { ac } = await import("./yardimci-arayuz");
  const { EslesmeKarti, cevaplanabilirler } = await import("../demo/kartlar");
  const { ornekVeriyiKur, bosBaglanti, bosGoogleBaglanti, DEMO_SAHIPLIK } = await import("../demo/depo");
  const { BAGLAM } = await import("../demo/lokasyon");
  const { TTL_VARSAYILAN } = await import("../src/lib/domain/gecerlilik");
  const { sahiplikNormalize } = await import("../src/lib/domain/sahiplik");
  const { SADECE_TEST_baglamiSabitle, VARSAYILAN_OFIS_ID, VARSAYILAN_KULLANICI_ID } = await import("../src/lib/kiracilik");
  SADECE_TEST_baglamiSabitle({ ofisId: VARSAYILAN_OFIS_ID, kullaniciId: VARSAYILAN_KULLANICI_ID, rol: "OFIS_YONETICISI", eposta: "test@anahtar.local" });
  const ornek = ornekVeriyiKur();
  const t = ornek.kayitlar.find((x) => x.id === "T2")!, p = ornek.kayitlar.find((x) => x.id === "P1")!;
  const s = eslesmeOnizle(t.veri as any, p.veri as any, BAGLAM);
  const e = { t, p, s, f: { kademe: "NORMAL", etiket: "Normal", aciklama: "", sira: 1, tahminiKomisyon: null, dogrudanTaraf: 1 } } as any;
  const alanlar = cevaplanabilirler(e).map((k) => k.anahtar);
  assert.ok(alanlar.includes("rampa"), alanlar.join(","));
  const bildirimler: string[] = [];
  const c: any = { d: { kayitlar: ornek.kayitlar, kisiler: ornek.kisiler, eslesmeNotlari: {}, ayarlar: { ttl: TTL_VARSAYILAN, sahiplik: sahiplikNormalize(DEMO_SAHIPLIK) }, baglantilar: { google: bosGoogleBaglanti(), notion: bosBaglanti() }, favoriler: [] },
    guncelle: (f: any) => { c.d = f(c.d); }, kayitKaydet: (k: any) => { c.d = { ...c.d, kayitlar: c.d.kayitlar.map((y: any) => (y.id === k.id ? k : y)) }; }, bildir: (m: string) => bildirimler.push(m), git: () => { throw new Error("kart açılmamalı"); }, geri: () => {}, geriVar: false, ornekHatalari: [] };
  const ekran = await ac(React.createElement(EslesmeKarti, { e }), c);
  assert.equal(ekran.qa(".hc").length, alanlar.length, "her bilinmeyen evet/hayır özellik için tek çip");
  assert.doesNotMatch(ekran.q(".es2-neden")!.textContent ?? "", /Sorulacak:[^·]*Yükleme rampası/, "düğmeli olan metinde tekrar yazılmaz");
  await ekran.tikla(ekran.q('[aria-label="Yükleme rampası: var"]'));
  assert.equal((c.d.kayitlar.find((x: any) => x.id === "P1").veri.ozellik as any).rampa, true);
  assert.match(bildirimler[0], /Yükleme rampası: var — portföye kaydedildi/);
  await ekran.kapat();
  // cevaptan sonra aynı eşleşmede o özellik artık bilinmiyor değil
  const s2 = eslesmeOnizle(t.veri as any, c.d.kayitlar.find((x: any) => x.id === "P1").veri, BAGLAM);
  assert.equal(s2.kriterler.find((k) => k.anahtar === "rampa")!.sonuc, "SAGLANDI");
});
