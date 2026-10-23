/**
 * Anahtar CRM v3.40 · 23 Ekim 2026 — eşleştirme, kullanıcı geri bildirimiyle yeniden ayarlandı (34 "yanlış / fiyat", 11 "sunuldu"):
 * ilçe sınırı ve konum tavanı, konutta oda öldürücü, aynı kişi, birim kira, kapalı alan tutarlılığı, Koşullu ≤ 84, bütçe aralığı;
 * kaydetme: küçük parçalar, geçici bağlantı hatasında yeniden deneme, konum ön denetimi.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { eslesmeOnizle, temelUyum, ayniKisi, MODEL, KONUM_SKOR_TAVANI, KOSULLU_SKOR_TAVANI, KIRA_BIRIM_ALT, type OnizlemeKayit } from "../src/lib/eslestirme/onizleme";
import { talepDnasi } from "../src/lib/eslestirme/talep-dna";
import { butceAltSiniri, hizliAyristir } from "../src/lib/ai/hizli-ayristirici";
import { geciciyseTekrarla, geciciBaglantiHatasi, konumKimlikleri } from "../src/lib/services/durum";
import { planla, imzaAl, KAYIT_PARCA, KISI_PARCA } from "../demo/canli-esle";
import { coz, BAGLAM } from "../demo/lokasyon";
import { SURUM, SURUM_GECMISI } from "../src/lib/surum";

const L = (ad: string, birincil = false) => { const l = coz(ad).lokasyonlar[0]; return { ilId: 7, ilceId: l.ilceId ?? null, mahalleId: l.mahalleId ?? null, altBolgeId: l.altBolgeId ?? null, birincil }; };
const talep = (x: Partial<OnizlemeKayit>): OnizlemeKayit => ({ tip: "TALEP", mulkTipi: "DAIRE", islemTipi: "SATILIK", odaSayisi: "2+1", maxFiyat: 5_000_000, lokasyonlar: [L("Güzeloba")], ...x });
const portfoy = (x: Partial<OnizlemeKayit>): OnizlemeKayit => ({ tip: "PORTFOY", mulkTipi: "DAIRE", islemTipi: "SATILIK", odaSayisi: "2+1", m2: 90, fiyat: 4_500_000, lokasyonlar: [L("Güzeloba", true)], ...x });
const s = (t: OnizlemeKayit, p: OnizlemeKayit) => eslesmeOnizle(t, p, BAGLAM);

test("sürüm 3.28 kaydı", () => {
  const i = SURUM_GECMISI.findIndex((k) => k.surum === "3.28"); // sonraki sürümler öne eklenir
  assert.ok(i >= 0 && SURUM >= "3.28"); assert.equal(SURUM_GECMISI[i + 1].surum, "3.27");
  assert.ok((SURUM_GECMISI[i].testEt ?? []).length >= 5);
});

test("konum: aynı mahalle Sunulabilir; komşu / yakın en fazla Koşullu ve tavanlı; başka ilçede komşu olmayan bölge dışı", () => {
  const ayni = s(talep({}), portfoy({}));
  assert.equal(ayni.uygunluk, "SUNULABILIR"); assert.equal(ayni.lokasyonKademe, "AYNI_MAHALLE"); assert.ok(ayni.skor >= 85);
  // Fener ↔ Çağlayan: aynı ilçe, sınır komşusu
  const komsu = s(talep({ lokasyonlar: [L("Fener")] }), portfoy({ lokasyonlar: [L("Çağlayan", true)] }));
  assert.equal(komsu.lokasyonKademe, "KOMSU_MAHALLE"); assert.equal(komsu.lokasyonOrani, MODEL.lok.komsu); assert.equal(komsu.uygunluk, "KOSULLU");
  assert.ok(komsu.skor <= KONUM_SKOR_TAVANI.KOMSU_MAHALLE!);
  // Fener ↔ Güzeloba: aynı ilçe, 1,4 km — "yanlış" işaretlenmişti
  const yakin = s(talep({ lokasyonlar: [L("Fener")] }), portfoy({ lokasyonlar: [L("Güzeloba", true)] }));
  assert.equal(yakin.lokasyonKademe, "YAKIN"); assert.equal(yakin.uygunluk, "KOSULLU"); assert.ok(yakin.skor <= KONUM_SKOR_TAVANI.YAKIN!);
  // Güzeloba (Muratpaşa) ↔ Altıntaş (Aksu): 500 m ama başka ilçe ve komşu değil → bölge dışı
  const ilceDisi = s(talep({}), portfoy({ lokasyonlar: [L("Altıntaş", true)] }));
  assert.equal(ilceDisi.lokasyonKademe, "DISINDA"); assert.equal(ilceDisi.uygunluk, "UYGUN_DEGIL"); assert.match(ilceDisi.lokasyonAciklama, /başka ilçe/);
  // "bölge esnek" denmişse uzak olarak gelir
  const esnek = s(talep({ ozellik: { esnekKriterler: ["LOKASYON"] } as any }), portfoy({ lokasyonlar: [L("Altıntaş", true)] }));
  assert.equal(esnek.lokasyonKademe, "UZAK"); assert.notEqual(esnek.uygunluk, "UYGUN_DEGIL");
  // Meltem (Muratpaşa) ↔ Arapsuyu (Konyaaltı): başka ilçede sınır komşusu → komşudan düşük, Koşullu
  const kIlceDisi = s(talep({ lokasyonlar: [L("Meltem")] }), portfoy({ lokasyonlar: [L("Arapsuyu", true)] }));
  assert.equal(kIlceDisi.lokasyonOrani, MODEL.lok.komsuIlceDisi); assert.match(kIlceDisi.lokasyonAciklama, /başka ilçe/); assert.ok(kIlceDisi.skor <= KONUM_SKOR_TAVANI.KOMSU_MAHALLE! - 8);
});

test("konum: yalnızca ilçe isteyen talebe başka ilçeden yalnız sınır komşusu gelir; ilçe + mahalle sayan talepte ilçe geneli mahalleden aşağıda", () => {
  // "Konyaaltı" talebine Muratpaşa Yıldız (1,3 km) — "yanlış" işaretlenmişti
  const t = talep({ lokasyonlar: [L("Konyaaltı")] });
  assert.equal(s(t, portfoy({ lokasyonlar: [L("Yıldız, Muratpaşa", true)] })).uygunluk, "UYGUN_DEGIL");
  // "Muratpaşa" talebine Konyaaltı Arapsuyu (ilçeye sınır komşusu) → Koşullu
  const k = s(talep({ lokasyonlar: [L("Muratpaşa")] }), portfoy({ lokasyonlar: [L("Arapsuyu", true)] }));
  assert.equal(k.lokasyonOrani, MODEL.lok.ilceKomsu); assert.equal(k.uygunluk, "KOSULLU");
  // talep: Muratpaşa + Güzeloba → Meltem "ilçe geneli" (0,85, sunulabilir olabilir), Güzeloba tam
  const ig = talep({ lokasyonlar: [L("Muratpaşa"), L("Güzeloba")] });
  const meltem = s(ig, portfoy({ lokasyonlar: [L("Meltem", true)] })), guzeloba = s(ig, portfoy({}));
  assert.equal(meltem.lokasyonKademe, "ILCE_GENEL"); assert.equal(meltem.lokasyonOrani, MODEL.lok.ilceGenel);
  assert.equal(guzeloba.lokasyonKademe, "AYNI_MAHALLE"); assert.ok(guzeloba.skor > meltem.skor);
});

test("konut: oda sayısı öldürücü — eksik oda elenir (v3.29: fazla oda bütçe içindeyse sunulur, bkz. v329); 'oda esnek' denirse engel olmaz", () => {
  assert.ok(talepDnasi(talep({}) as any).kritik.some((k) => k.kriter === "ODA_SAYISI"));
  const eksik = s(talep({}), portfoy({ odaSayisi: "1+1" }));
  assert.equal(eksik.uygunluk, "UYGUN_DEGIL"); assert.ok(eksik.kritikEngeller.includes("Oda sayısı"));
  assert.notEqual(s(talep({}), portfoy({ odaSayisi: "4+1" })).uygunluk, "UYGUN_DEGIL");
  assert.notEqual(s(talep({ ozellik: { esnekKriterler: ["ODA_SAYISI"] } as any }), portfoy({ odaSayisi: "1+1" })).uygunluk, "UYGUN_DEGIL");
});

test("konut: talepte m² yoksa (oda varsa) Alan 'istenmedi' — ekranda kırmızı %40 görünmez", () => {
  const r = s(talep({}), portfoy({}));
  assert.equal(r.matris.bilesenler.find((b) => b.kod === "ALAN")!.puan, null);
  const depo = s(talep({ mulkTipi: "DEPO_ANTREPO", islemTipi: "KIRALIK", odaSayisi: null, maxFiyat: 150_000 }), portfoy({ mulkTipi: "DEPO_ANTREPO", islemTipi: "KIRALIK", odaSayisi: null, m2: 1000, fiyat: 120_000 }));
  assert.notEqual(depo.matris.bilesenler.find((b) => b.kod === "ALAN")!.puan, null, "depoda m² hâlâ çekirdek");
});

test("aynı kişinin talebi ve portföyü eşleşmez (kişi bağı ya da telefon)", () => {
  const t = talep({ kisiler: [{ kisiId: "K1" }] }), p = portfoy({ kisiler: [{ kisiId: "K1" }] });
  assert.equal(ayniKisi(t, p), true); assert.equal(temelUyum(t, p), false);
  assert.ok(s(t, p).kritikEngeller.some((e) => /Aynı kişi/.test(e)));
  assert.equal(ayniKisi(talep({ gondeTelefon: "+90 530 457 32 56" }), portfoy({ gondeTelefon: "05304573256" })), true);
  assert.equal(ayniKisi(talep({ kisiler: [{ kisiId: "K1" }] }), portfoy({ kisiler: [{ kisiId: "K2" }] })), false);
  assert.equal(temelUyum(talep({}), portfoy({})), true, "kişi bilgisi yoksa engel yok");
});

test("kirada m² başına akla yatkın olmayan düşük fiyat (oda / birim fiyatı): bilinmiyor + uyarı + Koşullu", () => {
  const t = talep({ mulkTipi: "DEPO_ANTREPO", islemTipi: "KIRALIK", fiyatPeriyodu: "AYLIK", odaSayisi: null, minM2: 1000, maxFiyat: 150_000, lokasyonlar: [L("Ulus, Kepez")] });
  const r = s(t, portfoy({ mulkTipi: "DEPO_ANTREPO", islemTipi: "KIRALIK", fiyatPeriyodu: "AYLIK", odaSayisi: null, m2: 1000, fiyat: 1200, lokasyonlar: [L("Ulus, Kepez", true)] }));
  assert.equal(KIRA_BIRIM_ALT, 10);
  assert.equal(r.kriterler.find((k) => k.anahtar === "fiyat")!.sonuc, "BILINMIYOR");
  assert.ok(r.uyarilar.some((u) => /m² başına çok düşük/.test(u))); assert.equal(r.uygunluk, "KOSULLU");
  const normal = s(t, portfoy({ mulkTipi: "DEPO_ANTREPO", islemTipi: "KIRALIK", fiyatPeriyodu: "AYLIK", odaSayisi: null, m2: 1000, fiyat: 25_000, lokasyonlar: [L("Ulus, Kepez", true)] }));
  assert.ok(!normal.uyarilar.some((u) => /çok düşük/.test(u)), "25 TL/m² geçerli");
});

test("kapalı alan: talebin alt m²'siyle aynıysa ikinci satır açılmaz; ayrı kapalı alan toleransla karşılaştırılır", () => {
  const t = talep({ mulkTipi: "DEPO_ANTREPO", islemTipi: "KIRALIK", fiyatPeriyodu: "AYLIK", odaSayisi: null, minM2: 1000, maxM2: 1500, maxFiyat: 150_000, lokasyonlar: [L("Ulus, Kepez")], ozellik: { kapaliAlanM2: 1000 } as any });
  const p = (o: any = {}) => portfoy({ mulkTipi: "DEPO_ANTREPO", islemTipi: "KIRALIK", fiyatPeriyodu: "AYLIK", odaSayisi: null, m2: 900, fiyat: 125_000, lokasyonlar: [L("Ulus, Kepez", true)], ozellik: o });
  const r = s(t, p());
  assert.equal(r.kriterler.find((k) => k.anahtar === "m2")!.sonuc, "SAGLANDI");
  assert.equal(r.kriterler.find((k) => k.anahtar === "kapaliAlanM2"), undefined, "ekran görüntüsündeki çelişki: Alan uygun · Kapalı alan uymuyor");
  const ayri = s(t, p({ kapaliAlanM2: 920 })).kriterler.find((k) => k.anahtar === "kapaliAlanM2")!;
  assert.equal(ayri.sonuc, "SAGLANDI"); assert.equal(ayri.puan, 0.75); assert.match(ayri.etiket, /±%10/);
  assert.equal(s(t, p({ kapaliAlanM2: 700 })).kriterler.find((k) => k.anahtar === "kapaliAlanM2")!.sonuc, "SAGLANMADI");
});

test("Koşullu en fazla 84: 85 ve üstü yalnızca sorulmadan sunulabilir eşleşmede", () => {
  // v3.29 — fazla oda artık bütçe içindeyse sunulur; Koşullu örneği: bütçesiz talepte fazla oda
  const r = s(talep({ odaSayisi: "2+1", maxFiyat: null }), portfoy({ odaSayisi: "3+1" }));
  assert.equal(r.uygunluk, "KOSULLU"); assert.ok(r.skor <= 84);
  assert.equal(KOSULLU_SKOR_TAVANI, 84);
});

test("bütçe aralığının alt sınırı okunur ('6.500-7 milyon', '6 ila 7.500.000', '40-45 bin'); '15 mil' 15 milyondur", () => {
  assert.equal(butceAltSiniri("bütçemiz 6.500-7 milyon", 7e6), 6_500_000);
  assert.equal(butceAltSiniri("6 ila 7.500.000 kadar", 7.5e6), 6_000_000);
  assert.equal(butceAltSiniri("bütçe 40-45 bin tl", 45_000), 40_000);
  assert.equal(butceAltSiniri("8.000.000–9.000.000 tl", 9e6), 8_000_000);
  assert.equal(butceAltSiniri("2.000-3.000 m2 depo bütçe 200 bin", 200_000), null, "alan aralığı bütçe değildir");
  assert.equal(butceAltSiniri("1 - 30.000 tl", 30_000), null, "anlamsız alt sınır alınmaz");
  const h = hizliAyristir("☘️SATILIK TALEP☘️ Şirinyalı 2+1 ara katta Bütçemiz 6.500-7 milyon");
  assert.equal(h.minFiyat, 6_500_000); assert.equal(h.maxFiyat, 7_000_000);
  assert.equal(hizliAyristir("TALEP KUŞKAVAĞI ASANSÖR ŞART BÜTÇE 15 mil 3+1 satılık daire").maxFiyat, 15_000_000);
});

test("kaydetme: kayıtlar 4'erli (v3.36; eskiden 10), kişiler 100'erli parçalarla gider (uzun istek Cloudflare'de kesiliyordu)", () => {
  assert.equal(KAYIT_PARCA, 4); assert.equal(KISI_PARCA, 100);
  const kayit = (i: number) => ({ id: "P" + i, olusturma: "2026-10-14T00:00:00Z", veri: { tip: "PORTFOY" } as any, notlar: [] });
  const kisi = (i: number) => ({ id: "K" + i, adSoyad: "Kişi " + i } as any);
  const bos: any = { kayitlar: [], kisiler: [], eslesmeNotlari: {}, ayarlar: { ttl: {} }, testler: {}, geriBildirim: "", ogrenilen: [], adaylar: [], iceAktarmaGecmisi: [], islenmisMesajlar: [], dosyaIzleri: {}, favoriler: [] };
  const once = imzaAl(bos);
  const p = planla(once, { ...bos, kayitlar: Array.from({ length: 25 }, (_, i) => kayit(i)), kisiler: Array.from({ length: 250 }, (_, i) => kisi(i)) });
  const kayitParca = p.parcalar.filter((x: any) => x.kayitlar), kisiParca = p.parcalar.filter((x: any) => x.kisiler);
  assert.deepEqual(kayitParca.map((x: any) => x.kayitlar.length), [4, 4, 4, 4, 4, 4, 1]);
  assert.deepEqual(kisiParca.map((x: any) => x.kisiler.length), [100, 100, 50]);
  assert.ok(p.parcalar.indexOf(kisiParca[2]) < p.parcalar.indexOf(kayitParca[0]), "kişiler kayıtlardan önce yazılır");
});

test("sunucu: geçici bağlantı hatasında bir kez yeniden dener; başka hatayı tekrar etmez; tanınmayan konum anlaşılır mesajla reddedilir", async () => {
  assert.equal(geciciBaglantiHatasi(new Error("Connection terminated unexpectedly")), true);
  assert.equal(geciciBaglantiHatasi(new Error("Foreign key constraint violated")), false);
  let n = 0;
  assert.equal(await geciciyseTekrarla(async () => { if (n++ === 0) throw new Error("Connection terminated unexpectedly"); return "tamam"; }), "tamam"); assert.equal(n, 2);
  let m = 0;
  await assert.rejects(geciciyseTekrarla(async () => { m++; throw new Error("Foreign key constraint violated"); })); assert.equal(m, 1);
  const sahte: any = { ilce: { findMany: async () => [{ id: 108 }] }, mahalle: { findMany: async () => [{ id: 840 }] }, altBolge: { findMany: async () => [] } };
  const denetle = await konumKimlikleri(sahte, [{ veri: { lokasyonlar: [{ ilceId: 108, mahalleId: 840 }, { ilceId: 2001 }] } }]);
  assert.equal(denetle([{ ilceId: 108, mahalleId: 840 }]), null);
  assert.match(denetle([{ ilceId: 2001 }])!, /Konum tanınmıyor \(ilçe #2001\)/);
  let sorgu = 0; const sayan: any = { ilce: { findMany: async () => { sorgu++; return []; } }, mahalle: { findMany: async () => [] }, altBolge: { findMany: async () => [] } };
  assert.equal((await konumKimlikleri(sayan, [{ veri: { lokasyonlar: [] } }]))([]), null); assert.equal(sorgu, 0, "konum yoksa sorgu yok");
});
