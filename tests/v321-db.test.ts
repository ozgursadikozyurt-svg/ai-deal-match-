/**
 * Anahtar CRM v3.21.1 · 8 Ekim 2026
 * v3.21 — VERİTABANLI KANIT: çift yönlü Google Kişiler (PGlite + sahte Google, tests/sahte-google.ts).
 * Kuralların her biri bir testtir:
 *   Google'a eklenen Anahtar'a düşer · Anahtar'a elle eklenen Google'a gider · Anahtar'daki düzeltme Google'a yazılır
 *   Anahtar'dan silinen Google'dan SİLİNMEZ ve geri gelmez · Google'da silinen Anahtar'da kalır
 *   toplu içe aktarma kendiliğinden Google'a gitmez · ofisler birbirinin rehberini görmez · bağlanma akışı (OAuth) ofise kilitlidir
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { kiracilikIcinde, platformOlarak, baglamOku, VARSAYILAN_OFIS_ID, VARSAYILAN_KULLANICI_ID, istemciyiSarmala, type Baglam } from "../src/lib/kiracilik";
import { googleSenkronCalistir, tumOfislerdeGoogleSenkron, googleHaricTemizle, cakismaCoz, entegrasyon, ayarlarOf, GOOGLE_SAYFA_BOYU } from "../src/lib/services/senkron";
import { degisiklikUygula, DegisiklikSchema, kisileriGetir } from "../src/lib/services/durum";
import { ofisAc } from "../src/lib/services/ofis";
import { sifrele, durumImzala } from "../src/lib/guvenlik/sifre";
import { sahteGoogle, gk } from "./sahte-google";

process.env.ENTEGRASYON_SIFRE_ANAHTARI = Buffer.alloc(32, 5).toString("base64");
process.env.GOOGLE_CLIENT_ID = "test-istemci"; process.env.GOOGLE_CLIENT_SECRET = "test-gizli";

const ciplak = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL!, max: 1 }) });
const prisma = istemciyiSarmala(ciplak);
(globalThis as any).prisma = ciplak; // rota dosyaları (src/lib/db.ts) aynı bağlantıyı kullansın — PGlite tek bağlantı kabul eder
const A: Baglam = { ofisId: VARSAYILAN_OFIS_ID, kullaniciId: VARSAYILAN_KULLANICI_ID, rol: "PLATFORM_YONETICISI", eposta: "ozgursadikozyurt@gmail.com" };
let B: Baglam;
const icinde = <T,>(b: Baglam, is: () => Promise<T>) => kiracilikIcinde(b, is);
const degistir = (b: Baglam, g: object) => icinde(b, () => degisiklikUygula(prisma, DegisiklikSchema.parse(g)));

/** Ofisi Google'a bağlı duruma getirir (izin ekranından dönülmüş gibi) */
async function bagla(b: Baglam, ek: object = {}) {
  await icinde(b, async () => {
    const e = await entegrasyon(prisma, "GOOGLE_KISILER");
    await prisma.entegrasyon.updateMany({ where: { saglayici: "GOOGLE_KISILER" }, data: { durum: "BAGLI", hesap: "rehber@ornek.com", tokenSifreli: sifrele("1//yenile"), syncToken: null, imlec: null as any, kilitBitis: null, ayarlar: { ...ayarlarOf(e), baglayanKullaniciId: b.kullaniciId, yazmaIzni: true, ...ek } as any } });
  });
}
/** Eşitleme bitene kadar turları sürdürür (arayüzün yaptığı gibi); tur sayısını döner */
async function esitle(b: Baglam, f: typeof fetch, o: object | (() => object) = {}) {
  let tur = 0, son: any;
  do { const ek: any = typeof o === "function" ? o() : { ...o }; if (tur > 0) delete ek.tam; /* arayüz gibi: "tam" yalnızca ilk turda */ son = await icinde(b, () => googleSenkronCalistir(prisma, { f, tetik: "kullanici", ...ek })); tur++; assert.ok(!son.atlandi, String(son.atlandi)); assert.ok(tur < 30, "eşitleme bitmiyor"); } while (son.devamEdecek);
  return { tur, son };
}
const kisi = (b: Baglam, where: object) => icinde(b, () => prisma.kisi.findFirst({ where }));

// Bu dosya başka test dosyalarından sonra da çalışabilmeli: önce varsayılan ofisin Google izlerini temizle
test("hazırlık: temiz başlangıç ve ikinci ofis", async () => {
  await ciplak.senkronHaric.deleteMany({});
  await ciplak.senkronCakisma.deleteMany({ where: { saglayici: "GOOGLE_KISILER" } });
  await ciplak.kisi.updateMany({ where: { googleResourceName: { not: null } }, data: { googleResourceName: null, googleSnapshot: null as any, googleBekliyor: null } });
  const yeni = await icinde(A, () => ofisAc(prisma, { ad: "Rehber Deneme Emlak", sehir: "Antalya" }));
  const k = await ciplak.kullanici.create({ data: { ofisId: yeni.id, eposta: "rehber-b@deneme.com", rol: "OFIS_YONETICISI" } });
  B = { ofisId: yeni.id, kullaniciId: k.id, rol: "OFIS_YONETICISI", eposta: k.eposta };
});

const G = sahteGoogle([
  ...Array.from({ length: 450 }, (_, i) => gk(1000 + i, `Rehber Kişi ${i}`, `+90533${String(1000000 + i)}`)),
  gk(2001, "Telefonsuz Tanıdık", null),
]);

test("ilk içe aktarma büyük rehberde SAYFA SAYFA ilerler: yarıda kalır, kaldığı yerden sürer, tek geçmiş satırı büyür", async () => {
  await bagla(B);
  // Her tura en çok 3 dış istek (anahtar + etiketler + 1 sayfa) → Workers'ın çağrı sınırı benzetimi
  const { tur } = await esitle(B, G.f, () => ({ sayac: { n: 0, sinir: 3 } }));
  assert.equal(tur, Math.ceil(451 / GOOGLE_SAYFA_BOYU), "451 kişi sayfa sayfa, her turda bir sayfa");
  assert.equal(await icinde(B, () => prisma.kisi.count({ where: { googleResourceName: { not: null } } })), 450, "telefonu olan 450 kişi geldi; telefonsuz alınmadı");
  const calismalar = await icinde(B, () => prisma.senkronCalisma.findMany({ where: { saglayici: "GOOGLE_KISILER" } }));
  assert.equal(calismalar.length, 1, "üç tur tek geçmiş satırında toplandı");
  assert.equal(calismalar[0].yeni, 450); assert.equal(calismalar[0].atlanan, 1); assert.equal(calismalar[0].devamEdecek, false);
  const e = await icinde(B, () => entegrasyon(prisma, "GOOGLE_KISILER"));
  assert.ok(e.syncToken?.startsWith("sync-"), "bitince artımlı anahtar saklanır"); assert.equal((e.imlec as any)?.sayfa, undefined);
  const biri = await kisi(B, { googleResourceName: "people/c1000" });
  assert.equal(biri!.sahipKullaniciId, B.kullaniciId, "içe aktarılan kişinin sahibi bağlantıyı kuran kullanıcı");
  assert.equal(biri!.kaynak, "GOOGLE");
});

test("GOOGLE → ANAHTAR: telefonda Google'a kaydedilen kişi bir sonraki eşitlemede Anahtar'a düşer", async () => {
  G.ekle(gk(3001, "Yeni Müşteri Kemal", "+905441112233"));
  const { son } = await esitle(B, G.f);
  assert.equal(son.ozet.yeni, 1); assert.equal(son.ozet.gelen, 1, "artımlı: yalnızca değişen kişi istendi");
  assert.equal((await kisi(B, { telefon: "+905441112233" }))!.adSoyad, "Yeni Müşteri Kemal");
});

test("ANAHTAR → GOOGLE: elle eklenen kişi Google'a eklenir; toplu içe aktarılan (işaretsiz) kişi GİTMEZ", async () => {
  const once = G.kisiler.size;
  await degistir(B, { kisiler: [
    { id: "KELLE1", adSoyad: "Elle Eklenen Ayşe", telefon: "+905321110001", email: "ayse@ornek.com", sirket: "Ayşe İnşaat", notlar: "Pazarlıkta zor", googleaGonder: true },
    { id: "KTOPLU1", adSoyad: "Toplu Gelen 1", telefon: "+905321110002" },
    { id: "KTOPLU2", adSoyad: "Toplu Gelen 2", telefon: "+905321110003" },
  ] });
  assert.ok((await kisi(B, { id: "KELLE1" }))!.googleBekliyor, "elle eklenen kişi 'Google'a gönderilecek' diye işaretlendi");
  assert.equal((await kisi(B, { id: "KTOPLU1" }))!.googleBekliyor, null);
  const { son } = await esitle(B, G.f);
  assert.equal(son.ozet.gonderilenYeni, 1);
  assert.equal(G.kisiler.size, once + 1, "Google'a tam 1 kişi eklendi");
  const ayse = (await kisi(B, { id: "KELLE1" }))!;
  assert.ok(ayse.googleResourceName, "kişi artık Google'a bağlı"); assert.equal(ayse.googleBekliyor, null);
  const g = G.kisiler.get(ayse.googleResourceName!)!;
  assert.equal(g.names![0].displayName, "Elle Eklenen Ayşe"); assert.equal(g.phoneNumbers![0].value, "+905321110001");
  assert.equal(g.emailAddresses![0].value, "ayse@ornek.com"); assert.equal(g.organizations![0].name, "Ayşe İnşaat");
  assert.equal((g as any).biographies, undefined, "Anahtar'daki notlar Google'a taşınmaz");
  // Yankı yok: bizim eklediğimiz kişi Google'dan "değişmiş" diye geri gelince hiçbir şey yeniden yazılmaz
  const yazma = G.yazmaCagrilari().length;
  const { son: son2 } = await esitle(B, G.f);
  assert.equal(son2.ozet.yeni + son2.ozet.guncellenen + son2.ozet.gonderilenYeni + son2.ozet.gonderilenGuncel + son2.ozet.cakisma, 0);
  assert.equal(G.yazmaCagrilari().length, yazma);
  assert.equal(await icinde(B, () => prisma.kisi.count({ where: { telefon: "+905321110001" } })), 1, "kişi çoğalmadı");
});

test("ANAHTAR → GOOGLE: düzeltme Google'a yazılır; Google'daki diğer telefon korunur; boşaltılan alan Google'da SİLİNMEZ", async () => {
  // Google'da kişinin iki telefonu ve unvanı var
  G.ekle(gk(3100, "Murat Usta", "+905350001111", { phoneNumbers: [{ value: "+905350001111", canonicalForm: "+905350001111", type: "mobile", metadata: { primary: true } }, { value: "+902422223344", canonicalForm: "+902422223344", type: "work" }], organizations: [{ name: "Usta Yapı", title: "Kurucu" }], emailAddresses: [{ value: "murat@usta.com" }] }));
  await esitle(B, G.f);
  const m = (await kisi(B, { googleResourceName: "people/c3100" }))!;
  assert.equal(m.ikincilTelefon, "+902422223344");
  // Anahtar'da: ad ve cep düzeltildi, şirket BOŞALTILDI, not eklendi
  await degistir(B, { kisiler: [{ id: m.id, adSoyad: "Murat Usta (Yapı)", telefon: "+905350009999", ikincilTelefon: m.ikincilTelefon, email: m.email, sirket: null, notlar: "Cuma aranacak", roller: m.roller }] });
  assert.ok((await kisi(B, { id: m.id }))!.googleBekliyor, "bağlı kişideki düzeltme işaretlendi");
  const { son } = await esitle(B, G.f);
  assert.equal(son.ozet.gonderilenGuncel, 1);
  const g = G.kisiler.get("people/c3100")!;
  assert.equal(g.names![0].displayName, "Murat Usta (Yapı)");
  assert.deepEqual(G.telefonlar("people/c3100"), ["+905350009999", "+902422223344"], "cep yerinde değişti, iş telefonu korundu");
  assert.equal(g.phoneNumbers![1].type, "work");
  assert.deepEqual(g.organizations, [{ name: "Usta Yapı", title: "Kurucu" }], "Anahtar'da boşaltılan şirket Google'da silinmedi");
  assert.equal(g.emailAddresses![0].value, "murat@usta.com");
  assert.equal((await kisi(B, { id: m.id }))!.googleBekliyor, null);
  // Yalnızca not / rol değişirse Google'a istek gitmez
  const yazma = G.yazmaCagrilari().length;
  await degistir(B, { kisiler: [{ id: m.id, adSoyad: "Murat Usta (Yapı)", telefon: "+905350009999", ikincilTelefon: m.ikincilTelefon, email: m.email, sirket: null, notlar: "Cuma aranacak, sonra pazartesi", roller: ["MUTEAHHIT"] }] });
  assert.equal((await kisi(B, { id: m.id }))!.googleBekliyor, null);
  await esitle(B, G.f);
  assert.equal(G.yazmaCagrilari().length, yazma);
});

test("ANAHTAR'DAN SİLİNEN: Google'dan SİLİNMEZ, bir sonraki eşitlemede ve tam eşitlemede GERİ GELMEZ; istenirse geri getirilir", async () => {
  const hedef = (await kisi(B, { googleResourceName: "people/c1005" }))!;
  const telsiz = (await kisi(B, { id: "KTOPLU2" }))!; // Google'a bağlı olmayan kişi
  await degistir(B, { kisiSil: [hedef.id, telsiz.id] });
  assert.equal(await kisi(B, { id: hedef.id }), null);
  assert.ok(G.kisiler.get("people/c1005") && !G.kisiler.get("people/c1005")!.metadata?.deleted, "kişi Google'da duruyor");
  assert.equal(G.silmeCagrilari().length, 0, "Google'a hiçbir silme isteği gitmedi");
  assert.equal(await icinde(B, () => prisma.senkronHaric.count()), 2);
  // Google'da o kişi sonradan düzenlense bile geri gelmez
  G.degistir("people/c1005", (p) => { p.organizations = [{ name: "Sonradan Eklendi" }]; });
  const { son } = await esitle(B, G.f);
  assert.equal(son.ozet.haric, 1); assert.equal(son.ozet.yeni, 0);
  assert.equal(await kisi(B, { googleResourceName: "people/c1005" }), null);
  // Tam eşitleme (Google'daki herkes yeniden okunur) de geri getirmez
  const tam = await esitle(B, G.f, { tam: true });
  assert.equal(await kisi(B, { googleResourceName: "people/c1005" }), null);
  assert.equal(tam.son.ozet.yeni, 0, "tam eşitleme kopya da açmadı");
  // "Silinenleri yeniden getir"
  assert.deepEqual(await icinde(B, () => googleHaricTemizle(prisma)), { temizlenen: 2 });
  await esitle(B, G.f);
  assert.equal((await kisi(B, { googleResourceName: "people/c1005" }))!.sirket, "Sonradan Eklendi");
  assert.equal(G.silmeCagrilari().length, 0);
});

test("GOOGLE'DA SİLİNEN: Anahtar'da kalır, bağı kopar, yeniden Google'a gönderilmez", async () => {
  const k = (await kisi(B, { googleResourceName: "people/c1010" }))!;
  G.sil("people/c1010");
  await esitle(B, G.f);
  const sonra = (await kisi(B, { id: k.id }))!;
  assert.equal(sonra.googleResourceName, null); assert.ok(sonra.kaynaktaSilindi); assert.match(sonra.notlar ?? "", /Google Kişiler'den silindi/);
  // Kullanıcı "Google'a gönder" dese bile Google'da silinmiş kişi yeniden oluşturulmaz
  const once = G.kisiler.size;
  await degistir(B, { kisiler: [{ id: k.id, adSoyad: sonra.adSoyad, telefon: sonra.telefon, googleaGonder: true }] });
  await esitle(B, G.f);
  assert.equal(G.kisiler.size, once); assert.equal((await kisi(B, { id: k.id }))!.googleBekliyor, null);
});

test("ÇAKIŞMA: aynı alan iki tarafta farklı değişirse Anahtar'daki korunur, Google'a yazılmaz; 'Anahtar'daki kalsın' denince Google'a gider", async () => {
  const k = (await kisi(B, { googleResourceName: "people/c1020" }))!;
  await degistir(B, { kisiler: [{ id: k.id, adSoyad: "Anahtar'da Düzeltilen Ad", telefon: k.telefon }] });
  G.degistir("people/c1020", (p) => { p.names = [{ displayName: "Google'da Düzeltilen Ad", metadata: { primary: true } }]; });
  const { son } = await esitle(B, G.f);
  assert.equal(son.ozet.cakisma, 1); assert.equal(son.ozet.gonderilenGuncel, 0);
  assert.equal(G.kisiler.get("people/c1020")!.names![0].displayName, "Google'da Düzeltilen Ad", "çakışma çözülmeden Google ezilmez");
  assert.equal((await kisi(B, { id: k.id }))!.adSoyad, "Anahtar'da Düzeltilen Ad");
  const c = await icinde(B, () => prisma.senkronCakisma.findFirstOrThrow({ where: { hedefId: k.id, durum: "ACIK" } }));
  await icinde(B, () => cakismaCoz(prisma, c.id, "YEREL"));
  await esitle(B, G.f);
  assert.equal(G.kisiler.get("people/c1020")!.names![0].displayName, "Anahtar'da Düzeltilen Ad");
});

test("ÇİFT YÖNLÜ KAPALIYSA ya da Google yazma izni vermediyse Anahtar → Google hiçbir şey gitmez (çekme sürer)", async () => {
  for (const ek of [{ googleYaz: false }, { googleYaz: true, yazmaIzni: false }]) {
    await icinde(B, async () => { const e = await entegrasyon(prisma, "GOOGLE_KISILER"); await prisma.entegrasyon.updateMany({ where: { saglayici: "GOOGLE_KISILER" }, data: { ayarlar: { ...ayarlarOf(e), ...ek } as any } }); });
    const yazma = G.yazmaCagrilari().length;
    const id = "KKAPALI" + (ek.yazmaIzni === false ? "2" : "1");
    await degistir(B, { kisiler: [{ id, adSoyad: "Gitmemesi Gereken", telefon: "+90532111009" + (ek.yazmaIzni === false ? "2" : "1"), googleaGonder: true }] });
    assert.equal((await kisi(B, { id }))!.googleBekliyor, null, "kapalıyken işaret konmaz");
    G.ekle(gk(3200 + (ek.yazmaIzni === false ? 2 : 1), "Kapalıyken Gelen", "+90544999000" + (ek.yazmaIzni === false ? "2" : "1")));
    const { son } = await esitle(B, G.f);
    assert.equal(son.ozet.yeni, 1, "çekme çalışıyor"); assert.equal(G.yazmaCagrilari().length, yazma);
  }
  await icinde(B, async () => { const e = await entegrasyon(prisma, "GOOGLE_KISILER"); await prisma.entegrasyon.updateMany({ where: { saglayici: "GOOGLE_KISILER" }, data: { ayarlar: { ...ayarlarOf(e), googleYaz: true, yazmaIzni: true } as any } }); });
});

test("ÇOK OFİS: zamanlayıcı her ofisi kendi rehberiyle eşitler; ofisler birbirinin kişisini görmez; aynı telefon iki ofiste ayrı durur", async () => {
  const GA = sahteGoogle([gk(1, "A Ofisinin Müşterisi", "+905300000001"), gk(2, "Ortak Tanıdık", "+905441112233")]);
  await bagla(A);
  await ciplak.entegrasyon.updateMany({ where: { saglayici: "GOOGLE_KISILER" }, data: { sonSenkron: null } });
  // İki ofisin Google hesabı farklı: istek hangi ofisin bağlamında yapıldıysa o ofisin rehberi yanıt verir
  const rehber = new Map<string, typeof fetch>([[A.ofisId, GA.f], [B.ofisId, G.f]]);
  const izleyen = (async (u: any, i: any) => { const b = baglamOku(); assert.ok(b && b !== "platform", "Google isteği ofis bağlamında yapılmalı"); return rehber.get((b as Baglam).ofisId)!(u, i); }) as unknown as typeof fetch;
  const sonuc = await platformOlarak(() => tumOfislerdeGoogleSenkron(prisma, { f: izleyen }));
  assert.equal(sonuc.length, 2);
  assert.ok(sonuc.every((s) => !(s.sonuc as any).hata), JSON.stringify(sonuc));
  assert.ok(await kisi(A, { googleResourceName: "people/c1" }), "A ofisi kendi rehberini aldı");
  assert.equal(await kisi(B, { adSoyad: "A Ofisinin Müşterisi" }), null, "B ofisi A'nın kişisini görmez");
  assert.equal(await kisi(A, { googleResourceName: "people/c1000" }), null, "A ofisi B'nin rehberini almadı");
  assert.equal(await ciplak.kisi.count({ where: { telefon: "+905441112233" } }), 2, "aynı telefon iki ofiste ayrı kişi");
  // Zamanı gelmeyen ofis atlanır
  const ikinci = await platformOlarak(() => tumOfislerdeGoogleSenkron(prisma, { f: izleyen }));
  assert.ok(ikinci.every((s) => (s.sonuc as any).atlandi === "Zamanı gelmedi"));
});

test("BAĞLANMA AKIŞI: 'Google ile bağlan' adresi ofise imzalıdır; dönüş imzasız / kurcalanmış / yetkisiz ise bağlanmaz", async () => {
  const baglan = (await import("../src/app/api/entegrasyon/google/baglan/route")).POST;
  const donus = (await import("../src/app/api/entegrasyon/google/geri-donus/route")).GET;
  const kopar = (await import("../src/app/api/entegrasyon/google/kopar/route")).POST;
  const durum = (await import("../src/app/api/entegrasyon/route")).GET;
  const kok = "https://anahtarcrm.ornek.workers.dev";
  // Yeni bir ofis: hiç bağlanmamış
  const yeni = await icinde(A, () => ofisAc(prisma, { ad: "Bağlanma Deneme Emlak" }));
  const yon = await ciplak.kullanici.create({ data: { ofisId: yeni.id, eposta: "yon@baglanma.com", rol: "OFIS_YONETICISI" } });
  const dan = await ciplak.kullanici.create({ data: { ofisId: yeni.id, eposta: "dan@baglanma.com", rol: "DANISMAN" } });
  const Y: Baglam = { ofisId: yeni.id, kullaniciId: yon.id, rol: "OFIS_YONETICISI", eposta: yon.eposta };
  const D: Baglam = { ofisId: yeni.id, kullaniciId: dan.id, rol: "DANISMAN", eposta: dan.eposta };

  assert.equal((await icinde(D, () => baglan(new Request(kok + "/api/entegrasyon/google/baglan", { method: "POST" })))).status, 403, "danışman bağlantı kuramaz");
  const r = await icinde(Y, () => baglan(new Request(kok + "/api/entegrasyon/google/baglan", { method: "POST" })));
  assert.equal(r.status, 200);
  const adres = new URL(((await r.json()) as any).url);
  assert.equal(adres.origin + adres.pathname, "https://accounts.google.com/o/oauth2/v2/auth");
  assert.equal(adres.searchParams.get("redirect_uri"), kok + "/api/entegrasyon/google/geri-donus", "yönlendirme adresi isteğin alan adından üretilir");
  assert.ok(adres.searchParams.get("scope")!.split(" ").includes("https://www.googleapis.com/auth/contacts"), "tek izin: kişileri görme + düzenleme");
  assert.equal(adres.searchParams.get("access_type"), "offline");
  const state = adres.searchParams.get("state")!;

  // Dönüş: oturumsuz çağrılır (bağlam YOK) — gerçek fetch yerine sahte Google
  const asil = globalThis.fetch; const GS = sahteGoogle();
  globalThis.fetch = GS.f;
  try {
    const git = async (q: string) => (await donus(new Request(`${kok}/api/entegrasyon/google/geri-donus?${q}`))).headers.get("location");
    assert.equal(await git("code=abc&state=" + encodeURIComponent(state.slice(0, -2) + "xx")), kok + "/?google=hata", "kurcalanmış imza reddedilir");
    assert.equal(await git("code=abc"), kok + "/?google=hata", "state yoksa reddedilir");
    assert.equal(await git("error=access_denied&state=" + encodeURIComponent(state)), kok + "/?google=iptal");
    const eski = durumImzala({ ofisId: Y.ofisId, kullaniciId: Y.kullaniciId, eposta: Y.eposta }, undefined, Date.now() - 16 * 60_000);
    assert.equal(await git("code=abc&state=" + encodeURIComponent(eski)), kok + "/?google=hata", "15 dakikadan eski state reddedilir");
    const danState = durumImzala({ ofisId: D.ofisId, kullaniciId: D.kullaniciId, eposta: D.eposta });
    assert.equal(await git("code=abc&state=" + encodeURIComponent(danState)), kok + "/?google=yetki", "imza geçerli olsa da yetkisiz kullanıcı bağlayamaz");
    const baskaOfis = durumImzala({ ofisId: B.ofisId, kullaniciId: Y.kullaniciId, eposta: Y.eposta });
    assert.equal(await git("code=abc&state=" + encodeURIComponent(baskaOfis)), kok + "/?google=yetki", "kullanıcı başka ofis adına bağlayamaz");
    assert.equal((await icinde(Y, () => entegrasyon(prisma, "GOOGLE_KISILER"))).durum, "BAGLI_DEGIL");
    assert.equal(await git("code=abc&state=" + encodeURIComponent(state)), kok + "/?google=ok");
    const e = await icinde(Y, () => entegrasyon(prisma, "GOOGLE_KISILER"));
    assert.equal(e.durum, "BAGLI"); assert.equal(e.hesap, "rehber@ornek.com");
    assert.notEqual(e.tokenSifreli, "1//sahte-yenileme", "yenileme anahtarı şifreli saklanır");
    assert.equal(ayarlarOf(e).baglayanKullaniciId, Y.kullaniciId); assert.equal(ayarlarOf(e).yazmaIzni, true); assert.equal(ayarlarOf(e).googleYaz, true, "çift yönlü varsayılan açık");
    const gorunen = ((await (await icinde(D, () => durum())).json()) as any[])[0];
    assert.equal(gorunen.durum, "BAGLI"); assert.equal(gorunen.yetkili, false); assert.equal(gorunen.tokenSifreli, undefined, "gizli anahtar arayüze dönmez");
    assert.equal(gorunen.ayarlar.baglayanKullaniciId, undefined);
    assert.equal(JSON.stringify(gorunen).includes("NOTION"), false, "Notion gizli");
    // Bağlantıyı kaldır: Google'daki izin de geri alınır, kişilere dokunulmaz
    assert.equal((await icinde(D, () => kopar())).status, 403);
    const kr = (await (await icinde(Y, () => kopar())).json()) as any;
    assert.equal(kr.kopti, true); assert.equal(kr.izinKalkti, true);
    assert.ok(GS.cagrilar.some((c) => c.url.includes("/revoke")));
    assert.equal((await icinde(Y, () => entegrasyon(prisma, "GOOGLE_KISILER"))).tokenSifreli, null);
  } finally { globalThis.fetch = asil; }
});

test("arayüz köprüsü: kişi listesi 'Google'a bağlı' ve 'gönderilecek' bilgisini taşır; yalnızca kişiler ucu çalışır", async () => {
  await degistir(B, { kisiler: [{ id: "KBEKLE1", adSoyad: "Sırada Bekleyen", telefon: "+905321119999", googleaGonder: true }] });
  const liste = await icinde(B, () => kisileriGetir(prisma));
  assert.ok(liste.find((k) => k.id === "KBEKLE1")!.googleBekliyor);
  assert.ok(liste.some((k) => k.googleResourceName === "people/c1000"));
  const { GET } = await import("../src/app/api/durum/route");
  const j = (await (await icinde(B, () => GET(new Request("http://x/api/durum?yalniz=kisiler")))).json()) as any;
  assert.deepEqual(Object.keys(j), ["kisiler"]); assert.equal(j.kisiler.length, liste.length);
  // Bağlantı kaldırılınca bekleyen işaretler temizlenir (sonradan başka hesaba bağlanınca toplu gönderim olmasın)
  const asil = globalThis.fetch; globalThis.fetch = sahteGoogle().f;
  try { await icinde(B, async () => { await (await import("../src/app/api/entegrasyon/google/kopar/route")).POST(); }); } finally { globalThis.fetch = asil; }
  assert.equal(await icinde(B, () => prisma.kisi.count({ where: { googleBekliyor: { not: null } } })), 0);
  assert.equal(await icinde(B, () => prisma.kisi.count({ where: { googleResourceName: "people/c1000" } })), 1, "kişiler Anahtar'da kalır");
  assert.equal(G.silmeCagrilari().length, 0, "tüm testler boyunca Google'dan hiçbir kişi silinmedi");
});
