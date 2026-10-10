/**
 * Anahtar CRM v3.22.2 · 10 Ekim 2026
 * v3.22.2 — Kişiler ekranı donması (7.800 kişi) ve Cloudflare ücretsiz plan CPU 503'leri:
 *   liste parça parça çizilir · kayıt sayıları tek geçişte · ada göre sıralama aynı sonucu daha hızlı verir · imza önbelleği ·
 *   açılışta eşitleme YOK · kişiler yalnızca değişince ve yalnızca değişenler yenilenir (artımlı birleştirme).
 */
import { test as nodeTest } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { C, type Ctx } from "../demo/ortak";
import { ornekVeriyiKur, bosBaglanti, bosGoogleBaglanti, DEMO_SAHIPLIK, CANLI, type DepoDurumu, type Kisi } from "../demo/depo";
import { TTL_VARSAYILAN } from "../src/lib/domain/gecerlilik";
import { sahiplikNormalize } from "../src/lib/domain/sahiplik";
import { Kisiler } from "../demo/kisiler";
import { kaliciHepsiniSil } from "../demo/kalici";
import { sirala } from "../src/lib/siralama";
import { imzaAl, kisiImzasi, planla } from "../demo/canli-esle";
import { kaydediciKur } from "../demo/canli-kaydet";
import { degistiMi, googleOtomatik, kisileriYenile } from "../demo/google-baglanti";
import { SADECE_TEST_baglamiSabitle, VARSAYILAN_OFIS_ID, VARSAYILAN_KULLANICI_ID } from "../src/lib/kiracilik";
import { ac } from "./yardimci-arayuz";
SADECE_TEST_baglamiSabitle({ ofisId: VARSAYILAN_OFIS_ID, kullaniciId: VARSAYILAN_KULLANICI_ID, rol: "OFIS_YONETICISI", eposta: "test@anahtar.local" });

const ornek = ornekVeriyiKur();
const durum = (ek: Partial<DepoDurumu> = {}): DepoDurumu => ({ veriSurumu: "t", kayitlar: ornek.kayitlar, eslesmeNotlari: {}, testler: {}, geriBildirim: "", ayarlar: { ttl: TTL_VARSAYILAN, sahiplik: sahiplikNormalize(DEMO_SAHIPLIK) }, ogrenilen: [], adaylar: [], aktifIceAktarma: null, iceAktarmaGecmisi: [], kisiler: ornek.kisiler, islenmisMesajlar: [], dosyaIzleri: {}, baglantilar: { google: bosGoogleBaglanti(), notion: bosBaglanti() }, senkronGecmisi: [], cakismalar: [], googleBekleyen: [], favoriler: [], ...ek } as DepoDurumu);
const ctx = (d = durum(), ek: Partial<Ctx> = {}): Ctx => ({ d, guncelle: () => {}, kayitKaydet: () => {}, bildir: () => {}, ornekHatalari: [], git: () => {}, geri: () => {}, geriVar: false, sample: null, ...ek } as Ctx);
const test = (ad: string, f: () => unknown | Promise<unknown>) => nodeTest(ad, async () => { kaliciHepsiniSil(); await f(); });

/** n kişilik büyük rehber (ilk kişiler örnek verideki gerçek kişiler) */
const buyukRehber = (n: number): Kisi[] => Array.from({ length: n }, (_, i) => ({ ...ornek.kisiler[0], id: "BK" + i, adSoyad: `Rehber Kişi ${String(i).padStart(5, "0")}`, telefon: "+90533" + String(1000000 + i), ikincilTelefon: null, email: null, sirket: i % 7 === 0 ? "Deneme Yapı" : null, roller: [], whatsappGruplari: [], googleResourceName: null } as Kisi));

// ───── 1) Kişiler ekranı: parça parça çizim ─────
test("Kişiler: 1.500 kişilik rehberde yalnızca ilk 60 kart çizilir; sayaç tüm sayıyı gösterir; 'Daha fazla göster' 60 kart ekler", async () => {
  const a = await ac(React.createElement(Kisiler), ctx(durum({ kisiler: buyukRehber(1500) })));
  assert.equal(a.qa(".kisi-kart").length, 60, "ilk parça");
  assert.match(a.metin(), /1500 kişi/);
  const dahaFazla = a.dugme(/^Daha fazla göster/);
  assert.ok(dahaFazla, "devam düğmesi var"); assert.match(dahaFazla!.textContent ?? "", /1440 kişi daha/);
  await a.tikla(dahaFazla); assert.equal(a.qa(".kisi-kart").length, 120);
  await a.kapat();
});
test("Kişiler: küçük rehberde (60 ve altı) devam düğmesi çıkmaz, hepsi çizilir", async () => {
  const a = await ac(React.createElement(Kisiler), ctx(durum({ kisiler: buyukRehber(40) })));
  assert.equal(a.qa(".kisi-kart").length, 40); assert.equal(a.dugme(/^Daha fazla göster/), undefined); await a.kapat();
});
test("Kişiler: arama 1.500 kişiyi süzer; açık parça sayısı süzgeç değişince başa döner; aranan kişi parçanın dışında kalmaz", async () => {
  const a = await ac(React.createElement(Kisiler), ctx(durum({ kisiler: buyukRehber(1500) })));
  await a.tikla(a.dugme(/^Daha fazla göster/)); assert.equal(a.qa(".kisi-kart").length, 120);
  await a.yaz(a.q('input[type="search"]'), "01234");
  assert.match(a.metin(), /1 kişi/); assert.equal(a.qa(".kisi-kart").length, 1); assert.match(a.metin(), /Rehber Kişi 01234/);
  await a.yaz(a.q('input[type="search"]'), "");
  assert.equal(a.qa(".kisi-kart").length, 60, "süzgeç kalkınca liste ilk parçadan başlar");
  await a.kapat();
});
test("Kişiler: kartlardaki talep / portföy sayıları tek geçişli tabloyla bulunur (eski kişi × kayıt taramasıyla aynı sonuç)", async () => {
  const d = durum();
  const a = await ac(React.createElement(Kisiler), ctx(d));
  for (const k of d.kisiler) {
    const ky = d.kayitlar.filter((x) => (x.veri.kisiler ?? []).some((b) => b.kisiId === k.id));
    const t = ky.filter((x) => x.veri.tip === "TALEP").length, p = ky.filter((x) => x.veri.tip === "PORTFOY").length;
    const kart = a.qa(".kisi-kart").find((e) => e.textContent?.includes(k.adSoyad));
    if (!kart) continue; // 60'tan fazla örnek kişi varsa ilk parça dışında
    assert.equal(/(\d+) talep/.exec(kart.textContent ?? "")?.[1] ?? "0", String(t), k.adSoyad + " talep");
    assert.equal(/(\d+) portföy/.exec(kart.textContent ?? "")?.[1] ?? "0", String(p), k.adSoyad + " portföy");
  }
  await a.kapat();
});

// ───── 2) Sıralama: aynı sonuç, ortak karşılaştırıcı ─────
test("Ada göre sıralama Türkçe sırayı korur (eski localeCompare ile birebir aynı) ve 7.800 kişiyi hızlı sıralar", () => {
  const adlar = ["Çağlar", "Cem", "İbrahim", "Ilgaz", "Şule", "Sema", "Ömer", "Oya", "Ürün", "Umut", "Ğ", "Gül", "ali", "Ali", "Ayşe"];
  const sec = [{ alan: "ad", etiket: "Ad", deger: (s: string) => s, varsayilanYon: "artan" as const }];
  assert.deepEqual(sirala(adlar, { alan: "ad", yon: "artan" }, sec), [...adlar].sort((a, b) => a.localeCompare(b, "tr")));
  const cok = Array.from({ length: 7800 }, (_, i) => `${["Çelik", "Şahin", "İnan", "Öztürk", "Yılmaz", "Aksoy"][i % 6]} ${(i * 7919) % 10007}`);
  const bas = performance.now(); sirala(cok, { alan: "ad", yon: "artan" }, sec);
  assert.ok(performance.now() - bas < 1500, "7.800 kişilik ada göre sıralama 1,5 sn'nin altında (eski yöntem telefonlarda saniyelerce sürüyordu)");
});

// ───── 3) İmza önbelleği ─────
test("imzaAl: değişmeyen kişi nesnesi için imza yeniden hesaplanmaz; değişen / yeni nesne yeni imza alır; dönen tablolar paylaşılmaz", () => {
  const d = durum({ kisiler: buyukRehber(300) });
  const i1 = imzaAl(d), i2 = imzaAl(d);
  assert.deepEqual([...i1.kisi], [...i2.kisi]);
  assert.notEqual(i1.kisi, i2.kisi, "her çağrı kendi tablosunu döner (kayıt kuyruğu tabloyu değiştirir)");
  i1.kisi.set("BK0", "bozuk"); assert.notEqual(imzaAl(d).kisi.get("BK0"), "bozuk", "önbellek dışarıdan bozulamaz");
  const eski = d.kisiler[5]; const yeni = { ...eski, adSoyad: "Değişti" };
  assert.equal(kisiImzasi(eski), kisiImzasi(eski)); assert.notEqual(kisiImzasi(yeni), kisiImzasi(eski));
  const d2 = { ...d, kisiler: d.kisiler.map((k) => (k === eski ? yeni : k)) };
  const p = planla(imzaAl(d), d2);
  assert.equal(p.bos, false); assert.equal((p.parcalar[0].kisiler as any[]).length, 1, "yalnızca değişen kişi sunucuya gider");
});

// ───── 4) Artımlı kişi birleştirme ─────
function kaydedici(d: DepoDurumu) {
  const g = { ad: "kayitli" } as any;
  return kaydediciKur({ api: async () => new Response("{}"), baslangic: d, durum: (s) => { g.ad = s.ad; }, bekleMs: 1 });
}
test("kisileriDegisenleriBirlestir: yalnızca gelen kişiler güncellenir / eklenir; gelmeyen kişi silinmiş sayılmaz; listenin geri kalanı aynı nesne kalır", () => {
  const d = durum({ kisiler: buyukRehber(200) });
  const k = kaydedici(d);
  const guncel = { ...d.kisiler[10], adSoyad: "Google'da düzeltilmiş" }, yeniKisi = { ...d.kisiler[0], id: "YENI1", adSoyad: "Telefondan eklenen", telefon: "+905321110000" } as Kisi;
  const y = k.kisileriDegisenleriBirlestir(d, [guncel, yeniKisi]);
  assert.equal(y.kisiler.length, 201); assert.equal(y.kisiler[10].adSoyad, "Google'da düzeltilmiş"); assert.equal(y.kisiler.at(-1)!.id, "YENI1");
  assert.equal(y.kisiler[11], d.kisiler[11], "dokunulmayan kişi aynı nesne (arayüz gereksiz yeniden çizmez)");
  assert.equal(k.kisileriDegisenleriBirlestir(y, []), y, "değişen yoksa durum aynen döner");
  // gelenler sunucuda sayılır: kayıt kuyruğu onları yeniden yazmaya kalkmaz
  assert.equal(planla(imzaAl(y), y).bos, true);
});
test("kisileriDegisenleriBirlestir: kaydedilmemiş yerel düzenleme korunur; yerelde silinmiş ama silmesi gitmemiş kişi geri gelmez", () => {
  const d = durum({ kisiler: buyukRehber(50) });
  const k = kaydedici(d);
  const duzenlenmis = { ...d.kisiler[3], adSoyad: "Ben düzelttim" };
  const yerel = { ...d, kisiler: d.kisiler.filter((x) => x.id !== "BK7").map((x) => (x.id === "BK3" ? duzenlenmis : x)) };
  const y = k.kisileriDegisenleriBirlestir(yerel, [{ ...d.kisiler[3], adSoyad: "Sunucudaki farklı ad" }, d.kisiler[7]]);
  assert.equal(y.kisiler.find((x) => x.id === "BK3")!.adSoyad, "Ben düzelttim", "yerel düzenleme ezilmez");
  assert.equal(y.kisiler.some((x) => x.id === "BK7"), false, "yerelde silinen geri gelmez");
  const p = planla(imzaAl(durum({ kisiler: d.kisiler })), y); // sunucudaki imzayla karşılaştırınca düzenleme ve silme hâlâ gönderilecek
  assert.ok(p.parcalar.length > 0);
});

// ───── 5) Eşitleme tetikleyicileri ─────
test("degistiMi: yalnızca sunucudaki kişi listesini değiştiren özetler arayüzü yenilettirir", () => {
  assert.equal(degistiMi({ yeni: 0, guncellenen: 0, baglanan: 0, degismeyen: 120, atlanan: 3 }), false, "değişiklik yok → hiçbir şey indirilmez");
  for (const a of ["yeni", "guncellenen", "baglanan", "silinen", "birlesen", "cakisma", "gonderilenYeni", "gonderilenGuncel"]) assert.equal(degistiMi({ [a]: 1 }), true, a);
});
test("googleOtomatik: uygulama açılınca YALNIZCA bağlantı durumu okunur; eşitleme (POST /api/senkron/calistir) hiç başlatılmaz, 5 dakikalık zamanlayıcı yoktur", async () => {
  const eski = { acik: CANLI.acik, api: CANLI.api }; const cagrilar: string[] = [];
  CANLI.acik = true;
  CANLI.api = (async (yol: string, init?: any) => { cagrilar.push((init?.method ?? "GET") + " " + yol); return new Response(JSON.stringify(yol.startsWith("/api/entegrasyon") ? [{ saglayici: "GOOGLE_KISILER", durum: "BAGLI", yetkili: true, hazir: true, sonSenkron: "2000-01-01T00:00:00Z", calismalar: [], ayarlar: {} }] : {}), { status: 200 }); }) as any;
  const sayac = { n: 0 }; const temizle = googleOtomatik(() => { sayac.n++; });
  await new Promise((r) => setTimeout(r, 50));
  temizle();
  assert.ok(cagrilar.includes("GET /api/entegrasyon"), "durum okunur");
  assert.ok(!cagrilar.some((c) => c.includes("/api/senkron/calistir")), "eşitleme başlatılmaz (son eşitleme 26 yıl önce olsa bile)");
  Object.assign(CANLI, eski);
});
test("kisileriYenile: zaman biliniyorsa ?sonra= ile yalnızca değişenler istenir ve birleştirilir; bilinmiyorsa tam liste", async () => {
  const eski = { api: CANLI.api, zaman: CANLI.kisiZamani, bir: CANLI.kisileriBirlestir, art: CANLI.kisileriDegisenleriBirlestir }; const istekler: string[] = [];
  const k = kaydedici(durum());
  CANLI.kisileriBirlestir = k.kisileriBirlestir as any; CANLI.kisileriDegisenleriBirlestir = k.kisileriDegisenleriBirlestir as any;
  CANLI.api = (async (yol: string) => { istekler.push(yol); return new Response(JSON.stringify({ kisiler: [], zaman: "2026-10-10T08:00:00.000Z", artimli: yol.includes("sonra=") }), { status: 200 }); }) as any;
  CANLI.kisiZamani = null; await kisileriYenile(() => {});
  assert.equal(istekler[0], "/api/durum?yalniz=kisiler", "ilk yenileme tam");
  assert.equal(CANLI.kisiZamani, "2026-10-10T08:00:00.000Z", "zaman saklanır");
  await kisileriYenile(() => {});
  assert.match(istekler[1], /sonra=2026-10-10T08%3A00%3A00\.000Z/, "ikincisi artımlı");
  await kisileriYenile(() => {}, { tam: true });
  assert.equal(istekler[2], "/api/durum?yalniz=kisiler", "tam: true her şeyi ister");
  CANLI.api = eski.api; CANLI.kisiZamani = eski.zaman; CANLI.kisileriBirlestir = eski.bir; CANLI.kisileriDegisenleriBirlestir = eski.art;
});
