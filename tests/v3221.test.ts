/**
 * Anahtar CRM v3.22.2 · 10 Ekim 2026
 * v3.22.1 — canlı eşleşme denetiminde bulunan hatalar: satış talebinde yanlış "Aylık" periyot (fiyat "bilinmiyor"),
 * tireli "Hurma-Sarısu-Liman hariç", "Site içi olmayan", çekirdek bilgisi bilinmeyen eşleşmenin "Sunulabilir" görünmesi;
 * Benim kayıtların fırsat önceliği; reddedilen kaydın yeniden denenmesi ve sunucuya ulaşmamış yeni kaydın yedeklenmesi.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { eslesmeOnizle, etkinPeriyot } from "../src/lib/eslestirme/onizleme";
import { firsatDegerlendir } from "../src/lib/eslestirme/firsat";
import { yorumla } from "../src/lib/ai/yorumlayici";
import { hizliAyristir } from "../src/lib/ai/hizli-ayristirici";
import { INDEKS, BAGLAM, lokEtiket } from "../demo/lokasyon";
import { periyotOnerisi } from "../demo/form";
import { kayitOnar } from "../demo/onarim";
import { kaydediciKur, RED_YENIDEN_MS } from "../demo/canli-kaydet";
import { ornekVeriyiKur, type DepoDurumu } from "../demo/depo";
import { TTL_VARSAYILAN } from "../src/lib/domain/gecerlilik";

const L = (mahalleId: number) => [{ ilId: 7, ilceId: 104, mahalleId, birincil: true }];
// Kullanıcının ekran görüntüsündeki çift (9 Ekim): talep ≤ 12 M, 3+1, ≥ 140 m², bina ≤ 12 yaş — form "Aylık" bırakmış
const TALEP: any = { tip: "TALEP", mulkTipi: "DAIRE", islemTipi: "SATILIK", fiyatPeriyodu: "AYLIK", maxFiyat: 12_000_000, minM2: 140, odaSayisi: "3+1", lokasyonlar: [{ ilId: 7, ilceId: 104 }], ozellik: { binaYasi: 12 } };
const PORTFOY: any = { tip: "PORTFOY", mulkTipi: "DAIRE", islemTipi: "SATILIK", fiyatPeriyodu: "TOPLAM", fiyat: 11_750_000, m2: 170, odaSayisi: "3+1", lokasyonlar: L(584), ozellik: { binaYasi: 8 } };
const REAL = "Talep Satılık ‼️\nKonyaaltı bölgesi ( Hurma-Sarısu-Liman hariç)\nSite içi olmayan\nYüksek kat olmayan binalarda\nGeniş bir 2+1 ( En az 90 m2 )\nBütçe - 7.5 M";

test("satış talebinde 'Aylık' kalmış periyot: 11.750.000 ≤ 12.000.000 artık 'uygun' (eskiden 'bilinmiyor' ve ~60 puan)", () => {
  const s = eslesmeOnizle(TALEP, PORTFOY, BAGLAM);
  const f = s.kriterler.find((k) => k.anahtar === "fiyat")!;
  assert.equal(f.sonuc, "SAGLANDI"); assert.equal(f.portfoy, "11.750.000");
  assert.equal(s.uygunluk, "SUNULABILIR"); assert.ok(s.skor >= 95, String(s.skor));
  assert.equal(etkinPeriyot({ islemTipi: "SATILIK", fiyatPeriyodu: "AYLIK" }), "TOPLAM");
  assert.equal(etkinPeriyot({ islemTipi: "KIRALIK", fiyatPeriyodu: "YILLIK" }), "YILLIK");
});
test("kirada aylık ↔ yıllık çevrilir; çevrilemeyen (günlük ↔ aylık) yine 'bilinmiyor' ve Koşullu", () => {
  const t: any = { ...TALEP, islemTipi: "KIRALIK", fiyatPeriyodu: "AYLIK", maxFiyat: 50_000 };
  const yillik = eslesmeOnizle(t, { ...PORTFOY, islemTipi: "KIRALIK", fiyatPeriyodu: "YILLIK", fiyat: 540_000 }, BAGLAM);
  assert.equal(yillik.kriterler.find((k) => k.anahtar === "fiyat")!.sonuc, "SAGLANDI", "540 bin yıllık = 45 bin aylık");
  assert.match(yillik.kriterler.find((k) => k.anahtar === "fiyat")!.portfoy, /yıllık · 45\.000 aylık/);
  const pahali = eslesmeOnizle(t, { ...PORTFOY, islemTipi: "KIRALIK", fiyatPeriyodu: "YILLIK", fiyat: 900_000 }, BAGLAM);
  assert.equal(pahali.kriterler.find((k) => k.anahtar === "fiyat")!.sonuc, "SAGLANMADI");
  const gunluk = eslesmeOnizle(t, { ...PORTFOY, islemTipi: "KIRALIK", fiyatPeriyodu: "GUNLUK", fiyat: 2_000 }, BAGLAM);
  assert.equal(gunluk.kriterler.find((k) => k.anahtar === "fiyat")!.sonuc, "BILINMIYOR"); assert.equal(gunluk.uygunluk, "KOSULLU");
});
test("form: işlem değişince periyot uyar (satış → Toplam, kira → Aylık, yıllık seçilmişse korunur)", () => {
  assert.equal(periyotOnerisi("SATILIK", "AYLIK"), "TOPLAM");
  assert.equal(periyotOnerisi("DEVREN_SATILIK", "AYLIK"), "TOPLAM");
  assert.equal(periyotOnerisi("KIRALIK", "TOPLAM"), "AYLIK");
  assert.equal(periyotOnerisi("KIRALIK", "YILLIK"), "YILLIK");
  assert.equal(periyotOnerisi("GUNLUK_KIRALIK", "AYLIK"), "GUNLUK");
});
test("gerçek mesaj: '( Hurma-Sarısu-Liman hariç)' üçü de hariç, Konyaaltı aranır; 'Site içi olmayan' = istemiyor", () => {
  const p = yorumla(REAL, INDEKS).parcalar[0];
  assert.deepEqual(p.haricKonumlar.map((x) => x.toLocaleLowerCase("tr")), ["hurma", "sarısu", "liman"]);
  assert.deepEqual(p.konumlar, ["Konyaaltı"]);
  assert.equal(p.h.ozellik.siteIcinde, false);
  assert.equal(hizliAyristir("site içinde 3+1 daire arıyorum").ozellik.siteIcinde, true);
  assert.equal(hizliAyristir("havuz istemiyor, 2+1").ozellik.havuz, false);
  assert.equal(hizliAyristir("asansörsüz bina olmasın").ozellik.asansor, false);
});
test("site istemeyen talep: site içindeki portföy Koşullu (engel değil); site belirtmeyen portföy etkilenmez", () => {
  const t: any = { ...TALEP, fiyatPeriyodu: "TOPLAM", ozellik: { siteIcinde: false } };
  const site = eslesmeOnizle(t, { ...PORTFOY, ozellik: { siteIcinde: true } }, BAGLAM);
  assert.equal(site.uygunluk, "KOSULLU"); assert.equal(site.kriterler.find((k) => k.anahtar === "siteIcinde")!.sonuc, "SAGLANMADI");
  assert.equal(eslesmeOnizle(t, PORTFOY, BAGLAM).kriterler.some((k) => k.anahtar === "siteIcinde"), false);
});
test("çekirdek bilgisi (oda / m²) portföyde yoksa 'Sunulabilir' denmez (canlı denetimde 10 çift bundan Sunulabilir'di)", () => {
  const s = eslesmeOnizle({ ...TALEP, fiyatPeriyodu: "TOPLAM" }, { ...PORTFOY, odaSayisi: null }, BAGLAM);
  assert.equal(s.kriterler.find((k) => k.anahtar === "odaSayisi")!.sonuc, "BILINMIYOR");
  assert.equal(s.uygunluk, "KOSULLU");
});
test("açılış onarımı: eski 'hariç' talep, 'site içi olmayan' ve satışta 'Aylık' düzelir; kanıt yoksa dokunulmaz", () => {
  const eski = { tip: "TALEP", mulkTipi: "DAIRE", islemTipi: "SATILIK", fiyatPeriyodu: "AYLIK", maxFiyat: 7_500_000, hamMetin: REAL, baslik: "Hurma, Sarısu 2+1 en az 90 m² daire — satılık talebi",
    lokasyonlar: [{ ilId: 7, ilceId: 104, mahalleId: 584, birincil: false }, { ilId: 7, ilceId: 104, mahalleId: 588, birincil: false }], ozellik: { siteIcinde: true } };
  const r = kayitOnar(eski);
  assert.deepEqual(r.degisti, ["periyot", "haric", "siteIcinde"]);
  assert.deepEqual(r.veri.lokasyonlar.map(lokEtiket), ["Konyaaltı", "Konyaaltı / Hurma hariç", "Konyaaltı / Sarısu hariç", "Konyaaltı / Liman hariç"]);
  assert.equal(r.veri.baslik, "Konyaaltı (Hurma, Sarısu, Liman hariç) 2+1 en az 90 m² daire — satılık talebi");
  assert.equal(r.veri.ozellik.siteIcinde, false); assert.equal(r.veri.fiyatPeriyodu, "TOPLAM");
  assert.deepEqual(kayitOnar(r.veri).degisti, [], "ikinci kez onarılmaz");
  assert.deepEqual(kayitOnar({ ...eski, hamMetin: "Konyaaltı 2+1 site içinde", fiyatPeriyodu: "TOPLAM" }).degisti, []);
  for (const k of ornekVeriyiKur().kayitlar) assert.deepEqual(kayitOnar(k.veri).degisti, [], k.id);
});
test("fırsat: ★ Benim olan taraf varsa Öncelikli (emlakçı görünse de); ◆ Ofisim taraf doğrudan sayılır", () => {
  const o = { islemTipi: "SATILIK", fiyat: 8_000_000, butce: 8_500_000 };
  assert.equal(firsatDegerlendir("MUSTERI", "EMLAKCI", o).kademe, "NORMAL");
  const b = firsatDegerlendir("MUSTERI", "EMLAKCI", { ...o, portfoySahip: "BENIM" });
  assert.equal(b.kademe, "ONCELIKLI"); assert.match(b.aciklama, /Benim portföyüm — iki taraftan komisyon/);
  assert.equal(firsatDegerlendir("EMLAKCI", "EMLAKCI", { ...o, talepSahip: "BENIM" }).kademe, "ONCELIKLI");
  assert.equal(firsatDegerlendir("EMLAKCI", "EMLAKCI", { ...o, portfoySahip: "OFIS" }).kademe, "NORMAL");
  assert.equal(firsatDegerlendir("MUSTERI", "EMLAKCI", { ...o, portfoySahip: "OFIS" }).kademe, "ONCELIKLI");
  assert.ok(b.tahminiKomisyon! > firsatDegerlendir("MUSTERI", "EMLAKCI", o).tahminiKomisyon!, "benim tarafımın komisyonu paylaşılmaz");
});

// ───── kayıt kuyruğu ─────
const durum = (ek: Partial<DepoDurumu> = {}): DepoDurumu => ({ veriSurumu: "t", kayitlar: [], eslesmeNotlari: {}, testler: {}, geriBildirim: "", ayarlar: { ttl: TTL_VARSAYILAN }, ogrenilen: [], adaylar: [], aktifIceAktarma: null, iceAktarmaGecmisi: [], kisiler: [], islenmisMesajlar: [], dosyaIzleri: {}, baglantilar: {} as any, senkronGecmisi: [], cakismalar: [], googleBekleyen: [], ...ek } as DepoDurumu);
const kayit = (id: string, baslik: string) => ({ id, olusturma: "2026-10-09T10:00:00Z", veri: { tip: "TALEP", mulkTipi: "DAIRE", islemTipi: "SATILIK", baslik, lokasyonlar: [] } as any });

test("reddedilen kayıt içeriği değişmese de 60 sn sonra (ya da hemen() ile) yeniden gönderilir; kabul edilince sunucuda sayılır", async () => {
  let saat = 0, red = true; const giden: string[] = [];
  const api = async (_y: string, i: any) => { const ks = (i?.json?.kayitlar ?? []) as any[]; giden.push(...ks.map((k) => k.id)); return new Response(JSON.stringify({ hatalar: red ? ks.map((k) => ({ id: k.id, mesaj: "column isaret does not exist" })) : [] })); };
  const k = kaydediciKur({ api, baslangic: durum(), durum: () => {}, bekleMs: 1, simdi: () => saat });
  const d = durum({ kayitlar: [kayit("T1", "Yeni talep")] });
  k.kuyrugaAl(d); await k.hemen();
  assert.equal(k.hataOf("T1"), "column isaret does not exist"); assert.equal(k.sunucudaMi("T1"), false);
  const once = giden.length;
  saat = 10_000; k.kuyrugaAl(d); await new Promise((r) => setTimeout(r, 20));
  assert.equal(giden.length, once, "60 sn dolmadan aynı içerik yeniden gönderilmez");
  red = false; saat = RED_YENIDEN_MS + 1; k.kuyrugaAl(d); await new Promise((r) => setTimeout(r, 20));
  assert.ok(giden.length > once, "süre dolunca yeniden gönderildi"); assert.equal(k.sunucudaMi("T1"), true); assert.equal(k.hataOf("T1"), undefined);
  // hemen() süreyi beklemeden dener
  red = true; const d2 = durum({ kayitlar: [kayit("T1", "Yeni talep"), kayit("T2", "İkinci")] });
  k.kuyrugaAl(d2); await k.hemen(); assert.equal(k.sunucudaMi("T2"), false);
  red = false; const n = giden.length; await k.hemen(); assert.ok(giden.length > n); assert.equal(k.sunucudaMi("T2"), true);
});
test("sunucuya ulaşmamış yeni kayıt tarayıcıda yedeklenir; sayfa yenilenince geri gelir, sunucuda varsa yedek atılır", async () => {
  const bellek = new Map<string, string>();
  (globalThis as any).localStorage = { getItem: (a: string) => bellek.get(a) ?? null, setItem: (a: string, v: string) => bellek.set(a, v), removeItem: (a: string) => bellek.delete(a) };
  try {
    const api = async () => { throw new Error("ağ yok"); };
    const k = kaydediciKur({ api: api as any, baslangic: durum({ kayitlar: [kayit("ESKI", "Sunucuda olan")] }), durum: () => {}, bekleMs: 1, yenidenMs: 60_000, yedekAnahtari: "y" });
    k.kuyrugaAl(durum({ kayitlar: [kayit("YENI", "Henüz gitmedi"), kayit("ESKI", "Sunucuda olan (düzenlendi)")] }));
    const y = JSON.parse(bellek.get("y")!);
    assert.deepEqual(y.kayitlar.map((x: any) => x.id), ["YENI"], "yalnızca yeni kayıt yedeklenir (düzenleme başka cihazın üstüne yazılmasın)");
    const k2 = kaydediciKur({ api: api as any, baslangic: durum({ kayitlar: [kayit("ESKI", "Sunucuda olan")] }), durum: () => {}, yedekAnahtari: "y" });
    const geri = k2.yedektenGeriAl(durum({ kayitlar: [kayit("ESKI", "Sunucuda olan")] }));
    assert.deepEqual(geri.kayitlar.map((x) => x.id), ["YENI", "ESKI"]);
    const k3 = kaydediciKur({ api: api as any, baslangic: durum(), durum: () => {}, yedekAnahtari: "y" });
    const zaten = durum({ kayitlar: [kayit("YENI", "Sunucuya başka cihazdan gitmiş")] });
    assert.equal(k3.yedektenGeriAl(zaten), zaten); assert.equal(bellek.has("y"), false, "sunucuda varsa yedek silinir");
  } finally { delete (globalThis as any).localStorage; }
});
