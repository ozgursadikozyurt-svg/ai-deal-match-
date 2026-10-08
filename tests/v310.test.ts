/**
 * Anahtar CRM v3.21.1 · 8 Ekim 2026
 * v3.10 — para simgeleri, güven kuralı, telefon standardı, çoklu mülk tipi, Türkiye geneli konum,
 * yapay zekâ ayarları + sağlayıcı istemcisi, portföy föyü (metin + PDF), fotoğraf kuralları ve depo istemcisi.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { hizliAyristir, paraNormalize } from "../src/lib/ai/hizli-ayristirici";
import { yorumla, konumBul, parcaGuveni, GUVEN_ESIGI } from "../src/lib/ai/yorumlayici";
import { telStandart, telBicimle, telUyarisi } from "../src/lib/iletisim";
import { temelUyum, eslesmeOnizle } from "../src/lib/eslestirme/onizleme";
import { AI_SAGLAYICILAR, AI_VARSAYILAN, aiAyarNormalize, aiSaglayiciSec, paylasimNormalize, calismaIliNormalize } from "../src/lib/domain/ayarlar";
import { aiJsonIste, jsonCikar, AiHatasi } from "../src/lib/ai/saglayici";
import { aiYanitiniDogrula } from "../src/lib/ai/yorum-dogrula";
import { foyMetni, foyDosyaAdi, iletisimiGizle, pdfOlustur, type FoyIcerik } from "../src/lib/paylasim/foy";
import { fotoBoyutu, fotoDenetle, fotoYolu, FOTO_SINIR } from "../src/lib/domain/foto";
import { depoAyari, dosyaYukle, imzaliBaglantilar, dosyalariSil, DepoHatasi } from "../src/lib/depolama/supabase";
import { cokIlliCozumle, metindekiIller } from "../src/lib/lokasyon/turkiye";
import { TURKIYE_ALT_BOLGELER } from "../prisma/seed/turkiye-alt-bolgeler";
import { SURUM, SURUM_GECMISI } from "../src/lib/surum";
import { INDEKS, BAGLAM, coz, lokEtiket, konumOner, ILLER, ilIndeksi, ogrenilenleriYukle, calismaIliOku } from "../demo/lokasyon";
import { ornekVeriyiKur, TTL_VARSAYILAN, bosBaglanti, aiAyari, paylasimAyari, calismaIli, type DepoDurumu } from "../demo/depo";
import { C, type Ctx } from "../demo/ortak";
import { SayiGir, TelGirdisi, binlikYaz, sayiYap } from "../demo/girdi";
import { AiAyarlari, PaylasimAyarlari, CalismaIliAyari } from "../demo/ayarlar-ek";
import { AkilliKutu } from "../demo/ai-kutusu";
import { Fotograflar } from "../demo/fotograflar";
import { SADECE_TEST_baglamiSabitle, VARSAYILAN_OFIS_ID, VARSAYILAN_KULLANICI_ID } from "../src/lib/kiracilik";
// v3.20 — çok ofisli: testler varsayılan ofisin bağlamında çalışır (göçte açılan Özyurtlar Gayrimenkul)
SADECE_TEST_baglamiSabitle({ ofisId: VARSAYILAN_OFIS_ID, kullaniciId: VARSAYILAN_KULLANICI_ID, rol: "OFIS_YONETICISI", eposta: "test@anahtar.local" });


const { kayitlar, kisiler } = ornekVeriyiKur();
const durum = { veriSurumu: "t", kayitlar, eslesmeNotlari: {}, testler: {}, geriBildirim: "", ayarlar: { ttl: TTL_VARSAYILAN }, ogrenilen: [], adaylar: [], aktifIceAktarma: null, iceAktarmaGecmisi: [], kisiler, islenmisMesajlar: [], baglantilar: { google: bosBaglanti(), notion: bosBaglanti() }, senkronGecmisi: [], cakismalar: [] } as unknown as DepoDurumu;
const ciz = (el: React.ReactElement, d: DepoDurumu = durum) => renderToStaticMarkup(React.createElement(C.Provider, { value: { d, guncelle: () => {}, kayitKaydet: () => {}, bildir: () => {}, ornekHatalari: [], git: () => {}, geri: () => {}, geriVar: false, sample: null } as Ctx }, el));
const etiketler = (m: string) => coz(konumBul(m, INDEKS)).lokasyonlar.map((l) => lokEtiket(l));

test("para simgeleri: ₺, $, €, '.-TL' ve '8.5M TL' okunur (v3.9'da ₺ fiyatı kaçırıyordu)", () => {
  assert.equal(paraNormalize("₺8.500.000"), "8.500.000 TL");
  const a = hizliAyristir("Lara'da satılık 3+1 daire arıyorum bütçe ₺8.500.000");
  assert.equal(a.maxFiyat, 8_500_000); assert.equal(a.paraBirimi, "TRY");
  const b = hizliAyristir("Satılık dükkan 120 m2 Muratpaşa $250.000");
  assert.equal(b.fiyat, 250_000); assert.equal(b.paraBirimi, "USD");
  assert.equal(hizliAyristir("Satılık daire 3+1 Fener 3.250.000.-TL").fiyat, 3_250_000);
  assert.equal(hizliAyristir("Satılık villa Konyaaltı 8.5M TL").fiyat, 8_500_000);
  assert.equal(hizliAyristir("Satılık daire Kepez 95.000 €").paraBirimi, "EUR");
});

test("güven kuralı: eksik alan puan düşürür; eşik %70'in altı 'emin değilim' olur", () => {
  assert.equal(GUVEN_ESIGI, 70);
  const tam = yorumla("Konyaaltı Liman'da satılık 3+1 daire 120 m2 6.500.000 TL", INDEKS);
  assert.ok(tam.guven * 100 >= 90, `tam metin güveni ${tam.guven}`);
  assert.equal(tam.parcalar[0].guven, Math.round(tam.guven * 100));
  const belirsiz = yorumla("iyi bir yer lazım acil", INDEKS);
  assert.ok(belirsiz.guven * 100 < GUVEN_ESIGI, `belirsiz metin güveni ${belirsiz.guven}`);
  const g = parcaGuveni(belirsiz.parcalar[0]);
  assert.ok(g.eksikler.includes("mülk tipi") && g.eksikler.includes("konum"), g.eksikler.join());
  const yarim = yorumla("Lara'da daire arıyorum", INDEKS); // fiyat ve alan yok, işlem tahmin
  assert.ok(yarim.guven * 100 < 70 && yarim.guven * 100 >= 40, String(yarim.guven));
});

test("telefon standardı: her yazım +90 5XX XXX XX XX olur; eksik numara açık uyarı verir", () => {
  for (const ham of ["0532 111 22 33", "532 111 22 33", "+90 (532) 111-22-33", "905321112233", "0 532 1112233"]) assert.equal(telStandart(ham), "+905321112233", ham);
  assert.equal(telBicimle("05321112233"), "+90 532 111 22 33");
  assert.equal(telStandart("0532 111 22"), null);
  assert.equal(telBicimle("+90 532 111 2"), "+90 532 111 2", "yarım yazılmış numara yeniden biçimlenince bozulmaz");
  assert.equal(telBicimle(telBicimle(telBicimle("0532 1"))), "+90 532 1");
  assert.match(telUyarisi("0532 111 22")!, /2 hane daha/);
  assert.equal(telUyarisi(""), null); assert.equal(telUyarisi("0532 111 22 33"), null);
  assert.equal(telStandart("+49 151 23456789"), "+4915123456789");
  const html = renderToStaticMarkup(React.createElement(TelGirdisi, { deger: "0532 111 2", onChange: () => {} }));
  assert.ok(html.includes("alan-uyari") && html.includes('aria-invalid="true"'));
});

test("fiyat girişi: binlik nokta (1.500.000) yazılır ve sayıya geri çevrilir", () => {
  assert.equal(binlikYaz("1500000"), "1.500.000"); assert.equal(binlikYaz("12500,5"), "12.500,5");
  assert.equal(sayiYap("1.500.000"), 1_500_000); assert.equal(sayiYap(""), null);
  assert.ok(renderToStaticMarkup(React.createElement(SayiGir, { deger: 8500000, onChange: () => {}, binlik: true })).includes('value="8.500.000"'));
});

test("çoklu mülk tipi: 'Daire + Dükkan' arayan talep her iki tipteki portföyle eşleşir", () => {
  const lok = [{ ilId: 7, ilceId: INDEKS.ilceler[0].id, birincil: true }];
  const talep: any = { tip: "TALEP", mulkTipi: "DAIRE", alternatifMulkTipleri: ["DUKKAN_MAGAZA"], islemTipi: "SATILIK", lokasyonlar: lok, ozellik: {} };
  const p = (mulkTipi: string): any => ({ tip: "PORTFOY", mulkTipi, islemTipi: "SATILIK", lokasyonlar: lok, ozellik: {} });
  assert.equal(temelUyum(talep, p("DAIRE")), true); assert.equal(temelUyum(talep, p("DUKKAN_MAGAZA")), true);
  assert.equal(temelUyum(talep, p("DEPO_ANTREPO")), false);
  assert.equal(temelUyum({ ...talep, alternatifMulkTipleri: [] }, p("DUKKAN_MAGAZA")), false);
});

test("Türkiye geneli: başka il ve ilçeler tanınır, çalışma ili eskisi gibi çözülür", () => {
  assert.equal(ILLER.length, 81);
  assert.deepEqual(etiketler("İzmir Bornova'da kiralık dükkan arıyorum 150 m2"), ["Bornova · İzmir"]);
  assert.deepEqual(etiketler("Bodrum'da satılık villa, Yalıkavak olabilir"), ["Bodrum / Yalıkavak · Muğla"]);
  assert.deepEqual(etiketler("Ankara Çankaya Kızılay, Muğla Fethiye ve Antalya Kaş'ta arsa bakıyoruz"), ["Çankaya / Kızılay · Ankara", "Fethiye · Muğla", "Kaş"]);
  assert.deepEqual(etiketler("Muratpaşa Fener mahallesi 2+1 kiralık"), ["Muratpaşa / Fener"]);
  assert.deepEqual(etiketler("Çeşme'de yazlık, Alaçatı tercih"), ["Çeşme / Alaçatı · İzmir"]);
  const l = coz("İstanbul Beşiktaş Levent").lokasyonlar[0];
  assert.equal(l.ilId, 34); assert.equal(l.seviye, "MAHALLE"); assert.ok(l.mahalleId! >= 100000);
  const il = coz("Trabzon").lokasyonlar[0];
  assert.equal(il.seviye, "IL"); assert.equal(il.ilId, 61); assert.equal(lokEtiket(il), "Trabzon (il geneli)");
});

test("Türkiye geneli: kişi adı, 'İstanbul'dan gelen' ve 'Burdur yolu' konum sayılmaz", () => {
  assert.deepEqual(etiketler("Müşterim İstanbul'dan geliyor, Lara'da 3+1 daire arıyor"), ["Lara"]);
  assert.deepEqual(etiketler("Aydın Bey için Konyaaltı Liman'da daire"), ["Konyaaltı / Liman"]);
  assert.deepEqual(etiketler("Selçuk Bey Kepez'de dükkan arıyor"), ["Kepez"]);
  assert.deepEqual(etiketler("Burdur yolu üzeri depo 2000 m2 Döşemealtı"), ["Döşemealtı"]);
  assert.deepEqual(etiketler("Aydın'da Kuşadası satılık arsa"), ["Kuşadası · Aydın"]);
});

test("Türkiye geneli: öneri listesi, alt bölge başlangıç seti ve eşleştirmede il sınırı", () => {
  assert.equal(konumOner("born")[0].alt, "İlçe · İzmir");
  assert.ok(konumOner("izmir kazım").some((o) => o.etiket === "Kazımdirik" && o.alt.includes("Bornova")));
  assert.equal(konumOner("lara")[0].etiket, "Lara", "çalışma ili önce gelir");
  assert.ok(TURKIYE_ALT_BOLGELER.length >= 70);
  const ist = ilIndeksi(34)!;
  assert.ok(ist.altBolgeler.some((b) => b.ad === "Taksim"));
  assert.deepEqual(etiketler("İstanbul Levent'te ofis, Taksim de olur"), ["Beşiktaş / Levent · İstanbul", "Taksim · İstanbul"], "bilinen semt ilçesi yazılmadan tanınır");
  assert.ok(!ist.altBolgeler.some((b) => b.ad === "Levent"), "aynı adlı resmî mahalle varsa alt bölge eklenmez");
  for (const [ilAd, ilce] of TURKIYE_ALT_BOLGELER) {
    const id = ILLER.find((i) => i.ad === ilAd)?.id; assert.ok(id, ilAd);
    if (ilce) assert.ok(ilIndeksi(id!)!.ilceler.some((i) => i.ad === ilce), `${ilAd}/${ilce}`);
  }
  const bornova = coz("İzmir Bornova").lokasyonlar[0], izmir = coz("İzmir").lokasyonlar[0];
  const k = (tip: string, lok: any): any => ({ tip, mulkTipi: "DAIRE", islemTipi: "SATILIK", lokasyonlar: [{ ...lok, birincil: true }], ozellik: {}, fiyat: 5e6, maxFiyat: 6e6, m2: 100 });
  const antalyaP = k("PORTFOY", { ilId: 7, ilceId: INDEKS.ilceler[0].id }), izmirP = k("PORTFOY", { ilId: 35, ilceId: bornova.ilceId });
  assert.match(JSON.stringify(eslesmeOnizle(k("TALEP", izmir), antalyaP, BAGLAM)), /Talep edilen ilin dışında/);
  assert.doesNotMatch(JSON.stringify(eslesmeOnizle(k("TALEP", izmir), izmirP, BAGLAM)), /ilin dışında/);
  assert.deepEqual(metindekiIller("İzmir Bornova ve Bodrum", INDEKS.turkiye!.ozet, 7).sort(), [35, 48]);
  assert.equal(cokIlliCozumle("Kepez", { ...INDEKS, turkiye: undefined }).lokasyonlar[0].etiket, "Kepez");
});

test("çalışma ili değişince il yazılmayan konumlar o ilde çözülür", () => {
  ogrenilenleriYukle([], 35);
  try {
    assert.equal(calismaIliOku(), 35);
    const r = coz("Bornova Kazımdirik");
    assert.equal(r.lokasyonlar[0].ilId, 35); assert.equal(lokEtiket(r.lokasyonlar[0]), "Bornova / Kazımdirik");
    assert.equal(lokEtiket(coz("Antalya Kepez").lokasyonlar[0]), "Kepez · Antalya");
  } finally { ogrenilenleriYukle([], 7); }
});

test("ayarlar: yapay zekâ varsayılanı ücretsiz Gemini Flash-Lite; imza varsayılanı Özgür Özyurt", () => {
  assert.equal(AI_VARSAYILAN.saglayici, "GEMINI"); assert.equal(AI_VARSAYILAN.esik, 70); assert.equal(AI_VARSAYILAN.otomatik, false);
  assert.match(AI_VARSAYILAN.tabanUrl, /generativelanguage\.googleapis\.com/);
  const groq = aiSaglayiciSec(AI_VARSAYILAN, "GROQ");
  assert.equal(groq.tabanUrl, AI_SAGLAYICILAR.GROQ.tabanUrl); assert.equal(groq.esik, 70);
  assert.deepEqual(aiAyarNormalize({ esik: 5 }), AI_VARSAYILAN, "geçersiz ayar varsayılana döner");
  assert.deepEqual(paylasimNormalize(undefined), { adSoyad: "Özgür Özyurt", telefon: "0530 936 54 27", unvan: "Gayrimenkul Danışmanı", firma: "" });
  assert.equal(calismaIliNormalize(99), 7); assert.equal(calismaIliNormalize(34), 34);
  assert.equal(aiAyari(durum).saglayici, "GEMINI"); assert.equal(paylasimAyari(durum).adSoyad, "Özgür Özyurt"); assert.equal(calismaIli(durum), 7);
  assert.ok(!JSON.stringify(AI_SAGLAYICILAR).match(/sk-|AIza/), "kodda API anahtarı olmaz");
});

test("yapay zekâ istemcisi: OpenAI uyumlu çağrı, hata kodları, JSON ayıklama", async () => {
  let giden: any;
  const getir = (yanit: { status: number; govde: string }) => async (url: string, init: any) => { giden = { url, init }; return { ok: yanit.status < 300, status: yanit.status, text: async () => yanit.govde }; };
  const tamam = JSON.stringify({ choices: [{ message: { content: '```json\n{"tur":"TEK_KAYIT","kayitlar":[]}\n```' } }] });
  const c: any = await aiJsonIste(AI_VARSAYILAN, "gizli", "merhaba", { getir: getir({ status: 200, govde: tamam }), sistem: "sistem" });
  assert.equal(c.tur, "TEK_KAYIT");
  assert.equal(giden.url, AI_VARSAYILAN.tabanUrl + "/chat/completions");
  assert.equal(giden.init.headers.authorization, "Bearer gizli");
  const govde = JSON.parse(giden.init.body);
  assert.equal(govde.model, AI_VARSAYILAN.model); assert.equal(govde.messages.length, 2); assert.deepEqual(govde.response_format, { type: "json_object" });
  const kod = async (p: Promise<unknown>) => { try { await p; return "yok"; } catch (e) { return e instanceof AiHatasi ? e.kod : "baska"; } };
  assert.equal(await kod(aiJsonIste(AI_VARSAYILAN, undefined, "x")), "ANAHTAR_YOK");
  assert.equal(await kod(aiJsonIste({ ...AI_VARSAYILAN, model: "" }, "k", "x")), "AYAR_EKSIK");
  assert.equal(await kod(aiJsonIste(AI_VARSAYILAN, "k", "x", { getir: getir({ status: 429, govde: "limit" }) })), "SINIR");
  assert.equal(await kod(aiJsonIste(AI_VARSAYILAN, "k", "x", { getir: getir({ status: 401, govde: "no" }) })), "YETKI");
  assert.equal(await kod(aiJsonIste(AI_VARSAYILAN, "k", "x", { getir: getir({ status: 200, govde: JSON.stringify({ choices: [{ message: { content: "merhaba" } }] }) }) })), "JSON");
  assert.deepEqual(jsonCikar('Açıklama: {"a":1} son'), { a: 1 });
  const y = aiYanitiniDogrula({ tur: "TEK_KAYIT", aciklama: "ok", kayitlar: [{ sacma: true }], kisiler: [] });
  assert.equal(y.kayitlar.length, 0); assert.equal(y.atilan, 1);
});

const FOY: FoyIcerik = { baslik: "Cadde üstü köşe dükkan", islem: "Satılık", tip: "Dükkan / Mağaza", konum: "Muratpaşa / Şirinyalı, Antalya", fiyat: "8.000.000 TL", ozellikler: [["Alan", "120 m²"], ["Kat", "Zemin"]], aciklama: "Köşe konum.", imza: paylasimNormalize(undefined) };

test("portföy föyü: metinde imza var, mülk sahibinin iletişimi yok; dosya adı sade", () => {
  assert.equal(iletisimiGizle("Sahibi Hasan 0532 111 22 33 arayın, ofis 0242 111 22 33, a@b.com https://x.com/ilan"), "Sahibi Hasan arayın, ofis ,");
  assert.equal(iletisimiGizle("120 m2, 8.000.000 TL, 2015 yapımı"), "120 m2, 8.000.000 TL, 2015 yapımı", "fiyat ve ölçüler silinmez");
  const m = foyMetni(FOY);
  assert.ok(m.startsWith("*SATILIK DÜKKAN / MAĞAZA*")); assert.ok(m.includes("*ÖZGÜR ÖZYURT*")); assert.ok(m.includes("📞 0530 936 54 27"));
  assert.ok(m.includes("▫️ Alan: 120 m²") && m.includes("💰 8.000.000 TL"));
  assert.ok(!foyMetni({ ...FOY, fiyat: "" }).includes("💰"));
  assert.equal(foyDosyaAdi(FOY, "pdf"), "cadde-ustu-kose-dukkan.pdf");
});

test("PDF yazıcısı: geçerli yapı, sayfa sayısı ve çapraz başvuru tablosu doğru", () => {
  const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4, 0xff, 0xd9]);
  const pdf = pdfOlustur([{ jpeg, en: 1240, boy: 1754 }, { jpeg, en: 1600, boy: 1200 }], "Köşe dükkan");
  const metin = Buffer.from(pdf).toString("latin1");
  assert.ok(metin.startsWith("%PDF-1.4")); assert.ok(metin.trimEnd().endsWith("%%EOF"));
  assert.match(metin, /\/Count 2/); assert.equal((metin.match(/\/Filter \/DCTDecode/g) ?? []).length, 2);
  assert.match(metin, /\/Title \(K\?\?e d\?kkan\)|\/Title \(K.{1,4}e d.{1,2}kkan\)/);
  const xref = Number(metin.match(/startxref\n(\d+)/)![1]);
  assert.equal(metin.slice(xref, xref + 4), "xref");
  const ofsetler = [...metin.slice(xref).matchAll(/(\d{10}) 00000 n /g)].map((m) => Number(m[1]));
  assert.equal(ofsetler.length, 9);
  ofsetler.forEach((o, i) => assert.equal(metin.slice(o, o + `${i + 1} 0 obj`.length), `${i + 1} 0 obj`, `nesne ${i + 1}`));
  assert.throws(() => pdfOlustur([]));
});

test("fotoğraf kuralları: küçültme ölçüsü, tür / boyut / adet denetimi, depo yolu", () => {
  assert.deepEqual(fotoBoyutu(4000, 3000), { en: 1600, boy: 1200 }); assert.deepEqual(fotoBoyutu(3000, 4000), { en: 1200, boy: 1600 });
  assert.deepEqual(fotoBoyutu(800, 600), { en: 800, boy: 600 }, "küçük fotoğraf büyütülmez");
  assert.equal(fotoDenetle({ tur: "image/jpeg", boyut: 300_000 }, 0), null);
  assert.match(fotoDenetle({ tur: "image/jpeg", boyut: 300_000 }, FOTO_SINIR)!, /en fazla 8/);
  assert.match(fotoDenetle({ tur: "application/pdf", boyut: 300_000 }, 0)!, /JPG/);
  assert.match(fotoDenetle({ tur: "image/jpeg", boyut: 5_000_000 }, 0)!, /küçültülmeden/);
  // v3.20: yol ofis klasörüyle başlar
  assert.equal(fotoYolu("o1", "k1", "f1"), "o1/k1/f1.jpg"); assert.equal(fotoYolu("o1", "k1", "f1", "image/webp"), "o1/k1/f1.webp");
});

test("dosya deposu (Supabase Storage): yükleme, imzalı bağlantı, silme çağrıları; ayar yoksa kapalı", async () => {
  assert.throws(() => depoAyari({}), (e: unknown) => e instanceof DepoHatasi && e.kod === "AYAR_YOK");
  const a = depoAyari({ SUPABASE_URL: "https://proje.supabase.co/", SUPABASE_SERVICE_ROLE_KEY: "gizli" });
  assert.equal(a.kova, "portfoy");
  const cagri: any[] = [];
  const getir: any = async (url: string, init: any) => { cagri.push({ url, init }); return new Response(url.includes("/sign/") ? JSON.stringify([{ path: "k1/f1.jpg", signedURL: "/object/sign/portfoy/k1/f1.jpg?token=t" }]) : "{}", { status: 200 }); };
  await dosyaYukle("k1/f1.jpg", new Uint8Array([1, 2, 3]), "image/jpeg", getir, a);
  assert.equal(cagri[0].url, "https://proje.supabase.co/storage/v1/object/portfoy/k1/f1.jpg");
  assert.equal(cagri[0].init.method, "POST"); assert.equal(cagri[0].init.headers.authorization, "Bearer gizli"); assert.equal(cagri[0].init.headers["content-type"], "image/jpeg");
  const b = await imzaliBaglantilar(["k1/f1.jpg"], 600, getir, a);
  assert.equal(b["k1/f1.jpg"], "https://proje.supabase.co/storage/v1/object/sign/portfoy/k1/f1.jpg?token=t");
  assert.deepEqual(JSON.parse(cagri[1].init.body), { expiresIn: 600, paths: ["k1/f1.jpg"] });
  await dosyalariSil(["k1/f1.jpg"], getir, a);
  assert.equal(cagri[2].init.method, "DELETE"); assert.deepEqual(JSON.parse(cagri[2].init.body), { prefixes: ["k1/f1.jpg"] });
  const hatali: any = async () => new Response("yok", { status: 404 });
  await assert.rejects(dosyaYukle("x", new Uint8Array([1]), "image/jpeg", hatali, a), (e: unknown) => e instanceof DepoHatasi && e.durum === 404);
});

test("ekranlar: Ayarlar'da yapay zekâ / imza / çalışma ili; AI kutusunda 'Gönder'; portföyde Fotoğraflar", () => {
  const ai = ciz(React.createElement(AiAyarlari));
  for (const s of ["Yapay zekâ", "Google Gemini", "Groq", "Güven eşiği: %70", "AI_API_KEY", "Bağlantıyı dene"]) assert.ok(ai.includes(s), s);
  assert.ok(!ai.includes('type="password"'), "anahtar ekrandan girilmez");
  const imza = ciz(React.createElement(PaylasimAyarlari));
  assert.ok(imza.includes('value="Özgür Özyurt"') && imza.includes("+90 530 936 54 27"));
  const il = ciz(React.createElement(CalismaIliAyari));
  assert.ok(il.includes("Çalışma ili") && il.includes(">Antalya</option>") && il.includes(">İstanbul</option>"));
  const kutu = ciz(React.createElement(AkilliKutu, {} as any));
  assert.ok(kutu.includes("ai-eylem") && kutu.includes(">Gönder<")); assert.ok(!kutu.includes("okut"));
  const portfoy = kayitlar.find((k) => k.veri.tip === "PORTFOY")!;
  const foto = ciz(React.createElement(Fotograflar, { k: portfoy }));
  assert.ok(foto.includes("Fotoğraflar") && foto.includes("+ Fotoğraf ekle") && foto.includes('accept="image/*"'));
  assert.ok(ciz(React.createElement(Fotograflar, { k: { ...portfoy, fotolar: [{ id: "f1", ad: "a", en: 1600, boy: 1200, boyut: 300000 }, { id: "f2", ad: "b", en: 1600, boy: 1200, boyut: 300000 }] } })).includes("(2/8)"));
});

test("sürüm 3.10: günlükte ve test listesinde", () => {
  // v3.11'den itibaren güncel sürüm testi tests/v311.test.ts'te; burada 3.10 kaydının günlükte durduğu doğrulanır
  const k = SURUM_GECMISI.findIndex((x) => x.surum === "3.10");
  assert.ok(k >= 0 && parseFloat(SURUM) >= 3.1); assert.ok((SURUM_GECMISI[k].testEt ?? []).length >= 8);
  assert.equal(SURUM_GECMISI[k + 1].surum, "3.9");
});