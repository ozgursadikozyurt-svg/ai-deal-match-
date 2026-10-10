/**
 * Anahtar CRM v3.22.2 · 10 Ekim 2026
 * v3.6 — veritabanısız testler: üç yönlü birleştirme, Google Kişiler dönüştürücü + planlayıcı, Notion dönüştürücü
 * (gerçek alan adlarıyla) + planlayıcı, geri yazım, şifreleme, Notion istemcisi hız sınırı / 429 tekrarı.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { ucYonluBirlestir, telE164, telAnahtari } from "../src/lib/senkron/birlestir";
import { googleKisiDonustur, googleSenkronPlani, etiketRolleri, type MevcutKisi } from "../src/lib/google/kisiler";
import { kisiTaslagi, portfoyTaslagi, talepTaslagi, kisidenTalep, kayitHazirla } from "../src/lib/notion/donustur";
import { kisiPlani, kayitPlani, type MevcutNotionKayit } from "../src/lib/notion/plan";
import { geriYazimDegerleri, geriYazimOzellikleri, geriYazimGerekli, eksikGeriYazimAlanlari, alanRaporu } from "../src/lib/notion/geri-yazim";
import { NOTION_TABLOLARI } from "../src/lib/notion/yapilandirma";
import { notionIstemcisi } from "../src/lib/notion/istemci";
import { sifrele, coz, durumImzala, durumDogrula } from "../src/lib/guvenlik/sifre";
import { eslesmeOzetleri } from "../src/lib/eslestirme/ozet";
import { NOTION_TUR1, NOTION_TUR2, GOOGLE_TUR1, GOOGLE_TUR2, GOOGLE_GRUPLAR, NK, NP, NT } from "../demo/ornek-entegrasyon";
import { ornekVeriyiKur } from "../demo/depo";
import { INDEKS, BAGLAM } from "../demo/lokasyon";
import { SADECE_TEST_baglamiSabitle, VARSAYILAN_OFIS_ID, VARSAYILAN_KULLANICI_ID } from "../src/lib/kiracilik";
// v3.20 — çok ofisli: testler varsayılan ofisin bağlamında çalışır (göçte açılan Özyurtlar Gayrimenkul)
SADECE_TEST_baglamiSabitle({ ofisId: VARSAYILAN_OFIS_ID, kullaniciId: VARSAYILAN_KULLANICI_ID, rol: "OFIS_YONETICISI", eposta: "test@anahtar.local" });


test("Üç yönlü birleştirme: yerel düzeltme korunur, yalnız dışarıda değişen alınır, ikisi değişirse çakışma", () => {
  const onceki = { fiyat: 300000, baslik: "Depo", m2: 4000 };
  const r = ucYonluBirlestir({ fiyat: 290000, baslik: "Depo", m2: 4000 }, { fiyat: 300000, baslik: "Depo 4000", m2: 4000 }, onceki, ["fiyat", "baslik", "m2"]);
  assert.deepEqual(r.degisiklik, { baslik: "Depo 4000" }); // fiyat Anahtar'da düzeltilmiş, Notion'da değişmemiş → korunur
  assert.equal(r.cakismalar.length, 0);
  const c = ucYonluBirlestir({ fiyat: 290000 }, { fiyat: 320000 }, { fiyat: 300000 }, ["fiyat"]);
  assert.deepEqual(c.cakismalar, [{ alan: "fiyat", onceki: 300000, yerel: 290000, uzak: 320000 }]);
  // İlk bağlama: boş alan dolar, dolu ve farklı alan çakışma
  const i = ucYonluBirlestir<any>({ sirket: null, adSoyad: "Selin A." }, { sirket: "Örnek", adSoyad: "Selin Aksoy" }, null, ["sirket", "adSoyad"]);
  assert.deepEqual(i.degisiklik, { sirket: "Örnek" });
  assert.equal(i.cakismalar[0].alan, "adSoyad");
});

test("Telefon: cep + sabit hat +90'a çevrilir, karşılaştırma son 10 haneyle", () => {
  assert.equal(telE164("0555 000 03 01"), "+905550000301");
  assert.equal(telE164("0242 000 00 11"), "+902420000011");
  assert.equal(telE164("+44 20 7946 0958"), "+442079460958");
  assert.equal(telE164("12345"), null);
  assert.equal(telAnahtari("+90 555 000 01 02"), telAnahtari("05550000102"));
});

test("Google: etiket → rol, telefonsuz atlanır, aynı telefonlu ikinci kayıt birleşir, mevcut kişiye telefonla bağlanır", () => {
  assert.deepEqual(etiketRolleri(["Emlakçılar", "Aile"]), ["EMLAKCI"]);
  assert.deepEqual(etiketRolleri(["Müteahhitler"]), ["MUTEAHHIT"]);
  const grup = new Map(GOOGLE_GRUPLAR.map((g) => [g.resourceName, g.formattedName!]));
  const d = GOOGLE_TUR1.map((p) => googleKisiDonustur(p, grup));
  assert.equal(d.find((x) => x.resourceName === "people/c105")!.atlamaNedeni, "TELEFONSUZ");
  assert.equal(d.find((x) => x.resourceName === "people/c107")!.kisi!.telefon, "+902420000011");
  const { kisiler } = ornekVeriyiKur();
  const mevcut: MevcutKisi[] = kisiler.map((k) => ({ id: k.id, adSoyad: k.adSoyad, telefon: k.telefon, ikincilTelefon: null, email: null, sirket: k.sirket, notlar: k.notlar, roller: k.roller, googleResourceName: null, googleSnapshot: null }));
  const p = googleSenkronPlani(mevcut, d);
  assert.equal(p.ozet.atlanan, 1);
  assert.equal(p.ozet.birlesen, 1, "c106 aynı telefonla c102'ye katılır");
  assert.equal(p.ozet.baglanan, 1, "Selin telefonla mevcut kişiye bağlanır");
  assert.equal(p.ozet.yeni, 4);
  const selin = p.guncelle[0];
  assert.ok(selin.cakismalar.some((c) => c.alan === "adSoyad"), "ad farklı → çakışma, yerel ad korunur");
  assert.ok(!selin.cakismalar.some((c) => c.alan === "telefon"));
  // 2. tur: artımlı — şirket güncellenir, silinen kişinin bağı kopar, kişi silinmez
  const sonrasi: MevcutKisi[] = [...mevcut, ...p.ekle.map((e, i) => ({ id: "G" + i, ...e.alanlar, roller: e.roller, googleResourceName: e.resourceName, googleSnapshot: e.snapshot }))];
  const p2 = googleSenkronPlani(sonrasi, GOOGLE_TUR2.map((x) => googleKisiDonustur(x, grup)));
  assert.equal(p2.ozet.guncellenen, 1);
  assert.equal(p2.guncelle[0].degisiklik.sirket, "Usta Yatırım (örnek)");
  assert.deepEqual(p2.bagiKopar.map((x) => x.resourceName), ["people/c103"]);
  assert.equal(p2.ozet.yeni, 1);
});

test("Notion dönüştürücü: gerçek alan adları, adsız başlık alanı, 'Proje' ve rol eşlemesi, kişiden talep türetme", () => {
  const k = kisiTaslagi(NOTION_TUR1.KISI[1])!;
  assert.equal(k.alanlar.telefon, "+905550000102");
  assert.deepEqual(k.roller, ["EMLAKCI"]);
  assert.deepEqual(k.uzmanlikAileleri, ["DEPO", "URETIM"]);
  const hakan = kisiTaslagi(NOTION_TUR1.KISI[0])!;
  const t = kisidenTalep(hakan, hakan.sonDuzenleme)!;
  assert.equal(t.girdi.mulkTipi, "DEPO_ANTREPO");
  assert.equal(t.notionId, NK.HAKAN + "#talep");
  assert.equal(kisidenTalep(kisiTaslagi(NOTION_TUR1.KISI[3])!, ""), null, "bağlı talebi olan kişiden talep türetilmez");
  const lara = talepTaslagi(NOTION_TUR1.TALEP[0]);
  assert.equal(lara.girdi.baslik, "Elif Hn. Lara dükkan"); // başlık alanının adı "" (boş)
  assert.equal(lara.girdi.aciliyet, "YUKSEK");
  assert.equal(lara.girdi.fiyatPeriyodu, "AYLIK");
  const bos = talepTaslagi(NOTION_TUR1.TALEP[1]);
  assert.ok(bos.kontrol.some((x) => /Mülk tipi/.test(x)));
  const topalli = portfoyTaslagi(NOTION_TUR1.PORTFOY[2]);
  assert.equal(topalli.girdi.durum, "ARSIV");
  const kepez = portfoyTaslagi(NOTION_TUR1.PORTFOY[1]);
  assert.deepEqual(kepez.kisiBaglari, [{ notionId: NK.MURAT, rol: "SAHIP" }]);
  const h = kayitHazirla(kepez, INDEKS, (id) => (id === NK.MURAT ? "K99" : undefined));
  assert.ok(h.veri, h.hatalar.join("; "));
  assert.equal(h.veri!.ozellik?.ruhsatDurumu, "RUHSATLI");
  assert.equal(h.veri!.kisiler[0].kisiId, "K99");
  // "Murtpaşa" yazım hatası alias ile çözülür
  const m = kayitHazirla({ ...kepez, bolgeler: ["Murtpaşa"] }, INDEKS, () => undefined);
  assert.equal(m.cozulemeyen.length, 0);
});

test("Notion planlayıcı: benzer kayıt ikinci kopya olmadan bağlanır, 2. turda yerel düzeltme + Notion değişikliği çakışır, çöpe atılan arşivlenir", () => {
  const { kayitlar } = ornekVeriyiKur();
  const mevcut = (): MevcutNotionKayit[] => kayitlar.map((k) => ({ id: k.id, tip: k.veri.tip, notionId: (k as any).notionId ?? null, notionSnapshot: (k as any).notionSnapshot ?? null, veri: k.veri, ilceler: k.veri.lokasyonlar.map((l) => l.ilceId!).filter(Boolean) }));
  const hazir = NOTION_TUR1.PORTFOY.map((s) => { const t = portfoyTaslagi(s); return { taslak: t, ...kayitHazirla(t, INDEKS, () => undefined) }; });
  const p = kayitPlani(mevcut(), hazir);
  assert.equal(p.ozet.baglanan, 1, "Hacıaliler deposu demo P1'e bağlanır");
  assert.equal(p.guncelle[0].id, "P1");
  assert.equal(p.ozet.yeni, 2);
  // Bağla, sonra yerelde fiyatı düzelt, Notion'da da değişsin
  const p1 = kayitlar.find((k) => k.id === "P1")!;
  Object.assign(p1, { notionId: NP.HACIALILER, notionSnapshot: p.guncelle[0].snapshot });
  p1.veri = { ...p1.veri, fiyat: 290000 } as any;
  const hazir2 = NOTION_TUR2.PORTFOY.map((s) => { const t = portfoyTaslagi(s); return { taslak: t, ...kayitHazirla(t, INDEKS, () => undefined) }; });
  const p2 = kayitPlani(mevcut(), hazir2);
  const g = p2.guncelle.find((x) => x.id === "P1")!;
  assert.deepEqual(g.cakismalar.map((c) => [c.alan, c.yerel, c.uzak]), [["fiyat", 290000, 320000]]);
  assert.equal(p2.ozet.arsivlenen, 0, "Topallı henüz Anahtar'a bağlı değil (bu testte eklenmedi)");
  // Talep → portföy ilişkisi eşleşme takibine aktarılır
  const tp = kayitPlani([], [{ taslak: { ...talepTaslagi(NOTION_TUR1.TALEP[0]), notionEslesmeleri: [NP.KEPEZ] }, ...kayitHazirla(talepTaslagi(NOTION_TUR1.TALEP[0]), INDEKS, () => undefined) }]);
  assert.deepEqual(tp.notionEslesmeleri, [[NT.LARA, NP.KEPEZ]]);
  // Kişi planı: Selin telefonla demo kişisine bağlanır
  const { kisiler } = ornekVeriyiKur();
  const kp = kisiPlani(kisiler.map((k) => ({ ...k, ilanSahibiTipi: "BILINMIYOR", notionId: null, notionSnapshot: null })), NOTION_TUR1.KISI.map((s) => kisiTaslagi(s)!));
  assert.equal(kp.guncelle.length, 1);
  assert.deepEqual(kp.guncelle[0].yeniUzmanlik, ["DEPO", "URETIM"]);
  assert.equal(kp.ekle.length, 3);
});

test("Geri yazım: yalnızca uygulamanın beş alanı, değer aynıysa istek yok; eksik alanlar eklenir; alan raporu", () => {
  const { kayitlar } = ornekVeriyiKur();
  const oz = eslesmeOzetleri(kayitlar, BAGLAM);
  const t = [...oz.entries()].find(([, o]) => o.sayi > 0)!;
  const d = geriYazimDegerleri(t[1], "https://ornek.app/kayit/" + t[0]);
  const props = geriYazimOzellikleri(d, new Date("2026-09-30T12:00:00Z"));
  assert.deepEqual(Object.keys(props).sort(), ["En İyi Eşleşme", "Eşleşme Sayısı", "Eşleşme Skoru", "Son Senkron", "Uygulama Linki"].sort());
  assert.equal(geriYazimGerekli(d, d), false);
  assert.equal(geriYazimGerekli(null, d), true);
  assert.deepEqual(Object.keys(eksikGeriYazimAlanlari(["Name", "Eşleşme Skoru"])).length, 4);
  const sema = Object.fromEntries(Object.entries(NOTION_TUR1.TALEP[0].properties).map(([k, v]) => [k, { type: v.type }]));
  const r = alanRaporu(NOTION_TABLOLARI.TALEP.alan as any, sema, {});
  assert.ok(r.eslesen.every((x) => x.var), "örnek talep sayfası gerçek şemanın tüm alanlarını taşır");
});

test("Şifreleme ve OAuth state: gidiş-dönüş, kurcalanmış imza ve süresi dolmuş state reddedilir", () => {
  const anahtar = Buffer.alloc(32, 7).toString("base64");
  const s = sifrele("1//yenileme-anahtari", anahtar);
  assert.notEqual(s, "1//yenileme-anahtari");
  assert.equal(coz(s, anahtar), "1//yenileme-anahtari");
  const st = durumImzala({ yazma: false }, anahtar, 1000);
  assert.equal(durumDogrula<{ yazma: boolean }>(st, anahtar, 60_000, 2000).yazma, false);
  assert.throws(() => durumDogrula(st.replace(/.$/, (c) => (c === "A" ? "B" : "A")), anahtar, 60_000, 2000));
  assert.throws(() => durumDogrula(st, anahtar, 60_000, 1000 + 61_000), /süresi/);
});

test("Notion istemcisi: 2025-09-03 sürümü, data source sorgusu, 429'da Retry-After kadar bekleyip tekrar dener", async () => {
  const istekler: { url: string; init: any }[] = [];
  let n = 0;
  const sahte = (async (url: string, init: any) => {
    istekler.push({ url, init });
    if (n++ === 0) return new Response(JSON.stringify({ code: "rate_limited" }), { status: 429, headers: { "retry-after": "0" } });
    return new Response(JSON.stringify({ results: NOTION_TUR1.TALEP, has_more: false, next_cursor: null }), { status: 200 });
  }) as unknown as typeof fetch;
  const c = notionIstemcisi("secret_test", sahte, 0);
  const r = await c.sorgula(NOTION_TABLOLARI.TALEP.dataSourceId, { sonra: "2026-09-29T00:00:00.000Z" });
  assert.equal(r.results.length, 2);
  assert.equal(istekler.length, 2);
  assert.match(istekler[1].url, /\/v1\/data_sources\/3735ac62-c709-8076-b6e8-000bb0823469\/query$/);
  assert.equal(istekler[1].init.headers["notion-version"], "2025-09-03");
  assert.equal(JSON.parse(istekler[1].init.body).filter.last_edited_time.on_or_after, "2026-09-29T00:00:00.000Z");
});