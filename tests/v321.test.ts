/**
 * Anahtar CRM v3.22.1 · 9 Ekim 2026
 * v3.21 — veritabanısız testler: çift yönlü Google planlayıcıları (çekme + gönderme + silinenler), güncelleme gövdesi,
 * "Google'dan silme yok" güvencesi, bağlanma adresi, şifreleme anahtarı, arayüz (Notion gizli, kurallar görünür),
 * canlı kayıt kuyruğunun sunucudan gelen kişilerle birleşmesi, demo benzetimi.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { googleKisiDonustur, googleSenkronPlani, googleGonderimPlani, googleGuncellemeGovdesi, googleOlusturmaGovdesi, gonderimAlaniDegisti, GONDERIM_ALANLARI, type MevcutKisi, type GonderimAdayi, type GooglePerson } from "../src/lib/google/kisiler";
import { yetkiAdresi, yazmaIzniVar, uygulamaAdresi, kisiGetir, kisiGuncelle, KAPSAM_YAZ } from "../src/lib/google/istemci";
import { sifrele, coz, durumImzala, durumDogrula } from "../src/lib/guvenlik/sifre";
import { OZELLIKLER, notionAcik } from "../src/lib/ozellikler";
import { varsayilanAyar } from "../src/lib/services/senkron";
import { ornekVeriyiKur, bosBaglanti, bosGoogleBaglanti, type DepoDurumu, type Kisi } from "../demo/depo";
import { C, type Ctx } from "../demo/ortak";
import { Baglantilar, SenkronDurumu, GOOGLE_KURALLARI } from "../demo/baglantilar";
import { Kisiler, kisileriSil, kisiEkle, duzeltmeIsareti, googleBekliyorMu } from "../demo/kisiler";
import { AnaSayfa } from "../demo/app";
import { demoGoogleSenkron, demoGoogleHaricTemizle, demoCakismaCoz } from "../demo/senkron-demo";
import { kaydediciKur } from "../demo/canli-kaydet";
import { planla, imzaAl } from "../demo/canli-esle";
import { TTL_VARSAYILAN } from "../src/lib/domain/gecerlilik";
import { gk } from "./sahte-google";

const mk = (id: string, ad: string, tel: string | null, ek: Partial<MevcutKisi> = {}): MevcutKisi => ({ id, adSoyad: ad, telefon: tel, ikincilTelefon: null, email: null, sirket: null, notlar: null, roller: [], googleResourceName: null, googleSnapshot: null, ...ek });
const aday = (k: Partial<GonderimAdayi> & { id: string }): GonderimAdayi => ({ adSoyad: "Ad Soyad", telefon: "+905321112233", ikincilTelefon: null, email: null, sirket: null, notlar: null, googleResourceName: null, googleSnapshot: null, googleBekliyor: null, kaynaktaSilindi: null, ...k });

test("çekme: Anahtar'dan silinmiş kişi (Google kimliği ya da telefonu listede) yeniden eklenmez; aynı telefonla yeniden eklenmişse bağlanır", () => {
  const gelen = [gk(1, "Silinmiş Biri", "+905301110001"), gk(2, "Telefonla Silinmiş", "0530 111 00 02"), gk(3, "Normal Yeni", "+905301110003")].map((p) => googleKisiDonustur(p));
  const haric = { kimlikler: new Set(["people/c1"]), telefonlar: new Set(["5301110002"]) };
  const p = googleSenkronPlani([], gelen, haric);
  assert.deepEqual(p.ekle.map((x) => x.resourceName), ["people/c3"]);
  assert.equal(p.ozet.haric, 2); assert.equal(p.ozet.yeni, 1);
  assert.deepEqual(p.haricTutulan.map((x) => x.ad), ["Silinmiş Biri", "Telefonla Silinmiş"]);
  // Kullanıcı kişiyi Anahtar'a yeniden eklediyse: listede olsa da mevcut kişiyle eşleşir ve bağlanır
  const p2 = googleSenkronPlani([mk("K1", "Telefonla Silinmiş", "+905301110002")], gelen, haric);
  assert.equal(p2.guncelle[0].id, "K1"); assert.equal(p2.guncelle[0].baglandi, true); assert.equal(p2.ozet.haric, 1);
  // Liste verilmezse eski davranış (v3.6 testleri) değişmez
  assert.equal(googleSenkronPlani([], gelen).ozet.yeni, 3);
});

test("gönderme planı: yalnızca işaretli kişiler; yeni kişi telefonlu olmalı; Google'da silinmiş kişi yeniden oluşturulmaz", () => {
  const p = googleGonderimPlani([
    aday({ id: "isaretsiz" }),
    aday({ id: "yeni", googleBekliyor: new Date(), adSoyad: " Ayşe Yılmaz ", telefon: "0532 111 22 33", ikincilTelefon: "0242 111 22 33", email: "AYSE@Ornek.com", sirket: "Yılmaz Yapı", notlar: "özel not" }),
    aday({ id: "telsiz", googleBekliyor: new Date(), telefon: null }),
    aday({ id: "silinmis", googleBekliyor: new Date(), kaynaktaSilindi: new Date() }),
  ]);
  assert.deepEqual(p.olustur.map((x) => x.id), ["yeni"]);
  assert.deepEqual(p.olustur[0].alanlar, { adSoyad: "Ayşe Yılmaz", telefon: "+905321112233", ikincilTelefon: "+902421112233", email: "ayse@ornek.com", sirket: "Yılmaz Yapı" });
  assert.deepEqual(p.temizle.sort(), ["silinmis", "telsiz"], "gönderilemeyecek kişinin işareti kaldırılır");
  const g = googleOlusturmaGovdesi(p.olustur[0].alanlar);
  assert.equal(g.names![0].unstructuredName, "Ayşe Yılmaz"); assert.equal(g.phoneNumbers!.length, 2);
  assert.equal(JSON.stringify(g).includes("özel not"), false, "notlar Google'a gitmez");
  assert.equal((GONDERIM_ALANLARI as readonly string[]).includes("notlar"), false);
});

test("gönderme planı: bağlı kişide yalnızca DEĞİŞEN ve BOŞ OLMAYAN alan gider; çakışmalı kişi bekler; sınır aşılırsa kalan sayılır", () => {
  const snap = { adSoyad: "Murat Usta", telefon: "+905350001111", ikincilTelefon: null, email: "murat@usta.com", sirket: "Usta Yapı", notlar: null };
  const bagli = (id: string, ek: Partial<GonderimAdayi>) => aday({ id, ...snap, googleResourceName: "people/c" + id, googleSnapshot: snap, googleBekliyor: new Date(), ...ek });
  const p = googleGonderimPlani([
    bagli("1", { adSoyad: "Murat Usta (Yapı)", sirket: null, notlar: "yeni not" }),   // ad değişti, şirket boşaltıldı, not eklendi
    bagli("2", { telefon: "0535 000 11 11" }),                                         // yalnız yazım farkı → fark yok
    bagli("3", { email: "yeni@usta.com" }),
    bagli("4", { adSoyad: "Çakışmalı" }),
  ], { cakismali: new Set(["4"]) });
  assert.deepEqual(p.guncelle.map((x) => [x.id, x.degisen]), [["1", { adSoyad: "Murat Usta (Yapı)" }], ["3", { email: "yeni@usta.com" }]]);
  assert.deepEqual(p.temizle, ["2"]);
  assert.equal(p.guncelle.some((x) => x.id === "4"), false, "çakışma çözülmeden Google'a yazılmaz");
  const sinirli = googleGonderimPlani(Array.from({ length: 30 }, (_, i) => aday({ id: "y" + i, googleBekliyor: new Date(), telefon: "+90532111" + String(1000 + i) })), { sinir: 20 });
  assert.equal(sinirli.olustur.length, 20); assert.equal(sinirli.kalan, 10);
  // Etiket süzgeci açıkken yeni kişi oluşturulmaz (Google'da görmediğimiz kişilerin kopyası açılmasın), işaret durur
  assert.equal(googleGonderimPlani([aday({ id: "y", googleBekliyor: new Date() })], { olusturma: false }).olustur.length, 0);
  assert.equal(gonderimAlaniDegisti(snap, { ...snap, telefon: "0535 000 11 11" }), false);
  assert.equal(gonderimAlaniDegisti(snap, { ...snap, sirket: null }), false, "alanı boşaltmak gönderim gerektirmez");
  assert.equal(gonderimAlaniDegisti(snap, { ...snap, sirket: "Usta İnşaat" }), true);
});

test("güncelleme gövdesi: eski değer yerinde değişir, Google'daki diğer telefon / e-posta / unvan korunur, hiçbir öğe silinmez", () => {
  const guncel: GooglePerson = { resourceName: "people/c9", etag: "E1", metadata: { sources: [{ type: "CONTACT", id: "9", etag: "#x" }] },
    names: [{ displayName: "Murat Usta", givenName: "Murat", familyName: "Usta" }],
    phoneNumbers: [{ value: "0535 000 11 11", canonicalForm: "+905350001111", type: "mobile" }, { value: "+902422223344", type: "work" }],
    emailAddresses: [{ value: "murat@usta.com", type: "work" }, { value: "ozel@usta.com" }], organizations: [{ name: "Usta Yapı", title: "Kurucu" }] };
  const onceki = { telefon: "+905350001111", email: "murat@usta.com" };
  const { govde, maske } = googleGuncellemeGovdesi(guncel, { adSoyad: "Murat Usta (Yapı)", telefon: "+905350009999", email: "yeni@usta.com", sirket: "Usta İnşaat" }, onceki);
  assert.deepEqual(maske, ["names", "phoneNumbers", "emailAddresses", "organizations"]);
  assert.equal(govde.etag, "E1"); assert.deepEqual(govde.metadata, { sources: guncel.metadata!.sources }, "Google'ın istediği kaynak / etag bilgisi gövdede");
  assert.deepEqual(govde.phoneNumbers, [{ value: "+905350009999", type: "mobile" }, { value: "+902422223344", type: "work" }]);
  assert.deepEqual(govde.emailAddresses, [{ value: "yeni@usta.com", type: "work" }, { value: "ozel@usta.com" }]);
  assert.deepEqual(govde.organizations, [{ name: "Usta İnşaat", title: "Kurucu" }]);
  // Eski değer Google'da bulunamazsa yenisi EKLENİR (bir şey silinmez); zaten varsa dokunulmaz
  const ekle = googleGuncellemeGovdesi(guncel, { ikincilTelefon: "+905440001122" }, {});
  assert.equal(ekle.govde.phoneNumbers!.length, 3);
  assert.deepEqual(googleGuncellemeGovdesi(guncel, { telefon: "+902422223344" }, onceki).maske, [], "numara Google'da zaten var → istek gerekmez");
});

test("GÜVENCE: uygulama kodunda Google'dan kişi silen hiçbir çağrı yok", () => {
  for (const f of ["src/lib/google/istemci.ts", "src/lib/google/kisiler.ts", "src/lib/services/senkron.ts"]) {
    const s = fs.readFileSync(f, "utf8").replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, ""); // yorumlar hariç
    assert.equal(/deleteContact|batchDeleteContacts|deleteContactPhoto/.test(s), false, f + ": People API silme ucu");
    if (f !== "src/lib/services/senkron.ts") assert.equal(/method:\s*["']DELETE["']/.test(s), false, f + ": DELETE isteği");
  }
});

test("Google istemcisi: tek kişi okuma (yoksa null), maskeli güncelleme; geçersiz kimlik reddedilir", async () => {
  const cagri: { url: string; init?: RequestInit }[] = [];
  const f = (async (url: string, init?: RequestInit) => { cagri.push({ url, init }); return url.includes("c404") ? new Response("{}", { status: 404 }) : new Response(JSON.stringify({ resourceName: "people/c1", etag: "E2" })); }) as unknown as typeof fetch;
  assert.equal(await kisiGetir(f, "tok", "people/c404"), null);
  assert.equal((await kisiGetir(f, "tok", "people/c1"))!.etag, "E2");
  await kisiGuncelle(f, "tok", "people/c1", { etag: "E2", names: [{ unstructuredName: "X" }] }, ["names"]);
  const son = cagri.at(-1)!;
  assert.match(son.url, /people\/c1:updateContact\?updatePersonFields=names&/); assert.equal(son.init!.method, "PATCH");
  await assert.rejects(() => kisiGetir(f, "tok", "people/../../v1/otherContacts"), /Geçersiz/);
});

test("bağlanma adresi: varsayılan tek izin kişileri görme + düzenleme; yazma izni denetimi; adres isteğin alan adından", () => {
  const u = new URL(yetkiAdresi({ clientId: "c", redirectUri: "https://x/api/entegrasyon/google/geri-donus", state: "s" }));
  assert.ok(u.searchParams.get("scope")!.split(" ").includes(KAPSAM_YAZ));
  assert.equal(u.searchParams.get("prompt"), "consent"); assert.equal(u.searchParams.get("access_type"), "offline");
  assert.equal(yazmaIzniVar("openid email https://www.googleapis.com/auth/contacts"), true);
  assert.equal(yazmaIzniVar("openid email https://www.googleapis.com/auth/contacts.readonly"), false, "salt okunur izin yazma sayılmaz");
  const eski = process.env.UYGULAMA_URL; delete process.env.UYGULAMA_URL;
  assert.equal(uygulamaAdresi(new Request("https://anahtarcrm.ornek.workers.dev/api/x?y=1")), "https://anahtarcrm.ornek.workers.dev");
  process.env.UYGULAMA_URL = "https://crm.ornek.com/"; assert.equal(uygulamaAdresi(new Request("https://baska/api/x")), "https://crm.ornek.com");
  if (eski === undefined) delete process.env.UYGULAMA_URL; else process.env.UYGULAMA_URL = eski;
  assert.equal(varsayilanAyar("GOOGLE_KISILER").googleYaz, true, "çift yönlü varsayılan açık");
});

test("şifreleme anahtarı: ENTEGRASYON_SIFRE_ANAHTARI yoksa sunucu sırrından türetilir (ek değişken girmek gerekmez)", () => {
  const e = { a: process.env.ENTEGRASYON_SIFRE_ANAHTARI, s: process.env.SUPABASE_SERVICE_ROLE_KEY, d: process.env.DATABASE_URL };
  delete process.env.ENTEGRASYON_SIFRE_ANAHTARI; process.env.SUPABASE_SERVICE_ROLE_KEY = "svc-gizli-1";
  const p = sifrele("1//yenileme");
  assert.equal(coz(p), "1//yenileme");
  const st = durumImzala({ ofisId: "o1" }); assert.equal(durumDogrula<{ ofisId: string }>(st).ofisId, "o1");
  process.env.SUPABASE_SERVICE_ROLE_KEY = "svc-gizli-2";
  assert.throws(() => coz(p), "sır değişirse eski anahtar çözülmez (kullanıcı yeniden bağlanır)");
  assert.throws(() => durumDogrula(st));
  delete process.env.SUPABASE_SERVICE_ROLE_KEY; delete process.env.DATABASE_URL;
  assert.throws(() => sifrele("x"), /Şifreleme anahtarı üretilemedi/);
  for (const [k, v] of [["ENTEGRASYON_SIFRE_ANAHTARI", e.a], ["SUPABASE_SERVICE_ROLE_KEY", e.s], ["DATABASE_URL", e.d]] as const) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
});

// ───────── arayüz ─────────
const ornek = ornekVeriyiKur();
const durum = (x: Partial<DepoDurumu> = {}): DepoDurumu => ({ veriSurumu: "t", kayitlar: ornek.kayitlar, eslesmeNotlari: {}, testler: {}, geriBildirim: "", ayarlar: { ttl: TTL_VARSAYILAN }, ogrenilen: [], adaylar: [], aktifIceAktarma: null, iceAktarmaGecmisi: [], kisiler: ornek.kisiler, islenmisMesajlar: [], dosyaIzleri: {}, baglantilar: { google: bosGoogleBaglanti(), notion: bosBaglanti() }, senkronGecmisi: [], cakismalar: [], googleHaric: [], googleGiden: [], ...x });
const ciz = (el: React.ReactElement, d: DepoDurumu) => { const ctx: Ctx = { d, guncelle: () => {}, kayitKaydet: () => {}, bildir: () => {}, ornekHatalari: [], git: () => {}, geri: () => {}, geriVar: false, sample: null }; return renderToStaticMarkup(React.createElement(C.Provider, { value: ctx }, el)); };
const bagli = (d: DepoDurumu) => demoGoogleSenkron({ ...d, baglantilar: { ...d.baglantilar, google: { ...d.baglantilar.google, durum: "BAGLI", hesap: "ozgur@ornek.com" } } }, "ilk").d;

test("Notion gizli: Bağlantılar, ana sayfa, durum göstergesi ve Kişiler ekranında Notion geçmez; Google kuralları ve tek düğme görünür", () => {
  assert.equal(OZELLIKLER.notion, false); assert.equal(notionAcik(), false);
  const b = ciz(React.createElement(Baglantilar), durum());
  assert.equal(/Notion/.test(b), false, "Bağlantılar'da Notion yok");
  assert.match(b, /Google ile bağlan/);
  for (const [ne, sonuc] of GOOGLE_KURALLARI) { assert.ok(b.includes(ne.replace(/'/g, "&#x27;")), ne); assert.ok(b.includes(sonuc.replace(/'/g, "&#x27;")), sonuc); }
  assert.match(b, /Google&#x27;dan SİLİNMEZ/);
  const ana = ciz(React.createElement(AnaSayfa), durum());
  assert.equal(/Notion/.test(ana), false, "ana sayfada Notion daveti yok"); assert.match(ana, /Google ile bağlanın/);
  assert.equal(/Notion/.test(ciz(React.createElement(SenkronDurumu), durum())), false);
  assert.equal(/Notion/.test(ciz(React.createElement(Kisiler), bagli(durum()))), false);
  // Notion'dan kalma çakışma / geçmiş satırı olsa bile gösterilmez
  const eski = durum({ cakismalar: [{ id: "c1", saglayici: "NOTION", hedefTip: "KAYIT", hedefId: "x", baslik: "Eski", alan: "fiyat", onceki: 1, yerel: 2, uzak: 3 }] });
  assert.equal(/Çakışmalar/.test(ciz(React.createElement(Baglantilar), eski)), false);
  // Sunucu: Notion otomatik eşitlemede atlanır, bağlanma ucu kapalı, durum ucunda listelenmez
  assert.match(fs.readFileSync("src/lib/services/senkron.ts", "utf8"), /ad === "notion" && !notionAcik\(\)/);
  assert.match(fs.readFileSync("src/app/api/entegrasyon/notion/baglan/route.ts", "utf8"), /!notionAcik\(\)/);
});

test("demo benzetimi: elle eklenen kişi Google'a gider, toplu eklenen gitmez; silinen Google'da kalır ve geri gelmez; düzeltme gider", () => {
  let d = bagli(durum());
  const g0 = d.kisiler.filter((k) => k.googleResourceName).length;
  assert.ok(g0 >= 4);
  const guncelle = (f: (x: DepoDurumu) => DepoDurumu) => { d = f(d); };
  const elleId = kisiEkle(guncelle, d, { elle: true, adSoyad: "Elle Eklenen", telefon: "0532 444 55 66" });
  const otoId = kisiEkle(guncelle, d, { adSoyad: "Otomatik Eklenen", telefon: "0532 444 55 67", grup: "Antalya Emlak" });
  assert.equal(googleBekliyorMu(d.kisiler.find((k) => k.id === elleId)!), true);
  assert.equal(googleBekliyorMu(d.kisiler.find((k) => k.id === otoId)!), false, "WhatsApp'tan / toplu gelen kişi işaretlenmez");
  // Google'dan gelen bir kişiyi düzelt
  const burak = d.kisiler.find((k) => k.googleResourceName === "people/c104")!;
  d = { ...d, kisiler: d.kisiler.map((k) => (k.id === burak.id ? duzeltmeIsareti(d, k, { ...k, adSoyad: "Burak Demir" }) : k)) };
  // Google'dan gelen bir kişiyi sil
  const yapi = d.kisiler.find((k) => k.googleResourceName === "people/c107")!;
  d = kisileriSil(d, new Set([yapi.id]));
  assert.deepEqual(d.googleHaric!.map((h) => h.kimlik), ["people/c107"]);
  const r = demoGoogleSenkron(d, "kullanici"); d = r.d;
  assert.equal(r.calisma.ozet.gonderilenYeni, 1); assert.equal(r.calisma.ozet.gonderilenGuncel, 1);
  assert.deepEqual(d.googleGiden!.map((x) => [x.ad, x.islem]).sort(), [["Burak Demir", "GUNCELLENDI"], ["Elle Eklenen", "EKLENDI"]]);
  assert.ok(d.kisiler.find((k) => k.id === elleId)!.googleResourceName);
  assert.equal(d.kisiler.find((k) => k.id === otoId)!.googleResourceName ?? null, null);
  // Rehber baştan okunsa (tam eşitleme) bile silinen kişi geri gelmez; liste temizlenince gelir
  const tam = demoGoogleSenkron({ ...d, baglantilar: { ...d.baglantilar, google: { ...d.baglantilar.google, tur: 0 } } }, "kullanici");
  assert.equal(tam.d.kisiler.some((k) => k.googleResourceName === "people/c107"), false); assert.equal(tam.calisma.ozet.haric, 1);
  const geri = demoGoogleSenkron(demoGoogleHaricTemizle(d), "kullanici").d;
  assert.equal(geri.kisiler.some((k) => k.googleResourceName === "people/c107"), true);
  // Çift yönlü kapalıyken hiçbir şey gitmez
  let k = { ...d, baglantilar: { ...d.baglantilar, google: { ...d.baglantilar.google, ayar: { ...d.baglantilar.google.ayar, googleYaz: false } } } };
  kisiEkle((f) => { k = f(k); }, k, { elle: true, adSoyad: "Kapalıyken", telefon: "0532 444 55 68" });
  assert.equal(demoGoogleSenkron(k, "kullanici").calisma.ozet.gonderilenYeni, 0);
  // Çakışmada "Anahtar'daki kalsın" → Google'a yazılmak üzere işaretlenir
  const cd = bagli(durum());
  const c = cd.cakismalar.find((x) => x.saglayici === "GOOGLE_KISILER" && x.alan === "adSoyad")!;
  assert.ok(c, "örnek veride Selin'in adı iki tarafta farklı → çakışma");
  assert.ok(demoCakismaCoz(cd, c.id, "YEREL").kisiler.find((x) => x.id === c.hedefId)!.googleBekliyor);
});

test("canlı kayıt kuyruğu: sunucudan gelen kişiler yeniden yazılmaz / silinmez; kaydedilmemiş yerel iş korunur", async () => {
  const kisi = (id: string, ad: string, ek: Partial<Kisi> = {}): Kisi => ({ id, adSoyad: ad, telefon: null, sirket: null, roller: [], uzmanlikAileleri: [], referans: null, notlar: null, whatsappGruplari: [], olusturma: "2026-10-01T00:00:00Z", sonIletisim: null, ...ek });
  const bas = durum({ kisiler: [kisi("A", "Ayşe"), kisi("B", "Burak"), kisi("C", "Cem")], kayitlar: [] });
  const kur = () => { const yazilan: any[] = []; return { yazilan, k: kaydediciKur({ api: async (_y, i) => { yazilan.push(i?.json); return new Response("{}"); }, baslangic: bas, durum: () => {}, bekleMs: 5 }) }; };
  // Yerelde: B düzenlendi (kaydedilmedi), C silindi (silme gitmedi), D yeni eklendi (kaydedilmedi)
  const yerel = { ...bas, kisiler: [kisi("A", "Ayşe"), kisi("B", "Burak (yerel düzeltme)"), kisi("D", "Deniz (yeni)", { googleaGonder: true })] };
  // Sunucuda: Google eşitlemesi A'yı güncelledi + bağladı, G'yi ekledi; B ve C eski hâlinde duruyor
  const sunucu = [kisi("A", "Ayşe Yılmaz", { googleResourceName: "people/c1" }), kisi("B", "Burak"), kisi("C", "Cem"), kisi("G", "Google'dan Gelen", { googleResourceName: "people/c2", kaynak: "GOOGLE" })];
  const { k, yazilan } = kur();
  const y = k.kisileriBirlestir(yerel, sunucu);
  assert.deepEqual(Object.fromEntries(y.kisiler.map((x) => [x.id, x.adSoyad])), { A: "Ayşe Yılmaz", B: "Burak (yerel düzeltme)", G: "Google'dan Gelen", D: "Deniz (yeni)" }, "C geri gelmedi, B'nin yerel düzeltmesi korundu");
  assert.equal(y.kisiler.find((x) => x.id === "A")!.googleResourceName, "people/c1");
  // Bir sonraki kayıt: yalnızca yerel iş gider — B (düzeltme), D (yeni, Google'a gönder işaretiyle), C (silme). A ve G'ye dokunulmaz.
  k.kuyrugaAl(y); await k.hemen();
  const kisiler = yazilan.flatMap((p) => p?.kisiler ?? []), silinen = yazilan.flatMap((p) => p?.kisiSil ?? []);
  assert.deepEqual(kisiler.map((x: any) => x.id).sort(), ["B", "D"]);
  assert.equal(kisiler.find((x: any) => x.id === "D").googleaGonder, true);
  assert.deepEqual(silinen, ["C"]);
  // Yerel iş yokken: sunucudan gelen değişiklikler için HİÇBİR şey yazılmaz (yankı yok, yanlış silme yok)
  const iki = kur();
  const temiz = iki.k.kisileriBirlestir(bas, sunucu);
  iki.k.kuyrugaAl(temiz); await iki.k.hemen();
  assert.deepEqual(iki.yazilan, []);
  assert.equal(planla(imzaAl(bas), temiz).bos, false, "birleştirme olmasaydı kuyruk bunları sunucuya yeniden yazardı");
});
