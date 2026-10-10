/**
 * Anahtar CRM v3.22.2 · 10 Ekim 2026
 * v3.7 — toplu veri girişi (xlsx/csv okuyucu, başlık bulma, sütun eşleme, satır dönüşümü), toplu mesaj bölücü,
 * vCard, sıralama, arama/WhatsApp bağlantıları, ilan geçerliliği (DIS_ILAN 90 gün). Veritabanısız.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { xlsxOku, csvOku, excelTarih } from "../src/lib/ingest/xlsx";
import { sutunlariEsle, dosyaSatirlari, dosyaTuruTahmin, satirDonustur, satirHazirla, paraOku, katOku, yasOku, ilanNoOku, baslikHarf, type AktarimSecenek } from "../src/lib/ingest/tablo";
import { mesajiBol } from "../src/lib/ingest/toplu-mesaj";
import { vcfOku } from "../src/lib/ingest/vcf";
import { sirala } from "../src/lib/siralama";
import { whatsappLinki, aramaLinki, selamMetni } from "../src/lib/iletisim";
import { ttlNormalize, TTL_VARSAYILAN } from "../src/lib/domain/gecerlilik";
import { INDEKS } from "../demo/lokasyon";
import { ORNEK_PORTAL_CSV, ORNEK_TALEP_SAYFALARI, ORNEK_TOPLANTI_NOTU, ORNEK_VCF } from "../demo/ornek-dosyalar";
import { SADECE_TEST_baglamiSabitle, VARSAYILAN_OFIS_ID, VARSAYILAN_KULLANICI_ID } from "../src/lib/kiracilik";
// v3.20 — çok ofisli: testler varsayılan ofisin bağlamında çalışır (göçte açılan Özyurtlar Gayrimenkul)
SADECE_TEST_baglamiSabitle({ ofisId: VARSAYILAN_OFIS_ID, kullaniciId: VARSAYILAN_KULLANICI_ID, rol: "OFIS_YONETICISI", eposta: "test@anahtar.local" });


const BUGUN = new Date(2026, 9, 1, 12);
const sec = (o: Partial<AktarimSecenek> = {}): AktarimSecenek => ({ tip: "PORTFOY", dosyaTuru: "PORTAL", varsayilanSahip: "EMLAKCI", ilanGun: 90, varsayilanIslem: "SATILIK", bugun: BUGUN, ...o });

test("xlsx: sayfalar, paylaşılan metin, tarih biçimli hücre, sütun ofseti", () => {
  const sf = xlsxOku(new Uint8Array(fs.readFileSync("tests/fixtures/v37_ornek.xlsx")));
  assert.deepEqual(sf.map((s) => s.ad), ["1.HAFTA", "3. HAFTA", "Portal"]);
  assert.equal(sf[0].satirlar[1][0], "ALİ VURAL");
  assert.equal(sf[1].satirlar[0][4], "İSİM-SOYİSİM");
  assert.equal(sf[2].satirlar[1][0], "29.09.2026");
  assert.equal(excelTarih(46294), "29.09.2026");
});

test("csv: ayraç otomatik (;), tırnaklı alan", () => {
  const s = csvOku('a;b;c\n1;"x;y";3\n');
  assert.deepEqual(s.satirlar[1], ["1", "x;y", "3"]);
  assert.equal(csvOku("ad,fiyat\nX,5").satirlar[1][1], "5");
});

test("başlık satırı ve sütunlar: haftalık tabloda 3. sayfa E sütunundan başlıyor, başlıksız işlem sütunu içerikten", () => {
  const b = dosyaSatirlari(ORNEK_TALEP_SAYFALARI);
  assert.equal(b.length, 3);
  assert.deepEqual(b[0].eslesme.sutunlar, ["ad", "konum", "aciklama", "butceMax", "islem"]);
  assert.equal(b[1].eslesme.sutunlar[4], "ad");
  assert.deepEqual(dosyaTuruTahmin(b[0].eslesme), { tip: "TALEP", dosyaTuru: "TALEP_LISTESI" });
  const p = sutunlariEsle(csvOku(ORNEK_PORTAL_CSV).satirlar)!;
  assert.equal(dosyaTuruTahmin(p).dosyaTuru, "PORTAL");
  for (const a of ["tarih", "anaKategori", "mulkTuru", "islem", "m2", "fiyat", "ilce", "mahalle", "oda", "ilanSahibiTuru", "ilanSahibi", "ofis", "kaynak", "url"]) assert.ok(p.sutunlar.includes(a as any), a);
});

test("değer okuyucular: para, şüpheli bütçe, kat, bina yaşı, ilan no, büyük harf ad", () => {
  assert.equal(paraOku("3.500.000 TL").deger, 3_500_000);
  assert.equal(paraOku("9750000").deger, 9_750_000);
  assert.equal(paraOku("5,5 milyon").deger, 5_500_000);
  assert.equal(paraOku("20.000.0000 TL").supheli, true);
  assert.equal(paraOku("BÜTÇE DEĞERİNDE").deger, null);
  assert.equal(paraOku("8.000.000 TL NAKİT").not, "Nakit");
  assert.equal(katOku("4. Kat"), 4); assert.equal(katOku("Yüksek Giriş"), 0); assert.equal(katOku("Kot 2"), -2); assert.equal(katOku("Müstakil"), null);
  assert.equal(yasOku("26-30"), 28); assert.equal(yasOku("0"), 0);
  assert.equal(ilanNoOku("https://www.emlakjet.com/ilan/muratpasa-31-19915896"), "19915896");
  assert.equal(ilanNoOku("https://sahibinden.com/1342746857"), "1342746857");
  assert.equal(baslikHarf("ÖZÜM GÜNDEMİR"), "Özüm Gündemir");
});

test("portal satırı → portföy: sahibi/ofis ayrımı, kişi yalnız ofis için, web havuzu, 90 gün geçerlilik (v3.16: kayıt gününden), fiyat düşüşü notu", () => {
  const sf = xlsxOku(new Uint8Array(fs.readFileSync("tests/fixtures/v37_ornek.xlsx")));
  const [b] = dosyaSatirlari(sf, ["Portal"]);
  const [ofis, sahibi, eski] = b.satirlar.map((r) => satirHazirla(satirDonustur(r.hucreler, b.eslesme, sec(), r.no), INDEKS));
  assert.equal(ofis.durum, "HAZIR", ofis.kontrol.join());
  assert.equal(ofis.veri!.mulkTipi, "DAIRE"); assert.equal(ofis.veri!.islemTipi, "SATILIK");
  assert.equal(ofis.veri!.havuz, "DIS_ILAN"); assert.equal(ofis.veri!.ilanSahibiTipi, "EMLAKCI"); assert.equal(ofis.veri!.veriKanali, "EMLAKJET");
  assert.equal(ofis.veri!.portalIlanNo, "19915896");
  assert.equal(ofis.kisi?.adSoyad, "Ayşe Yılmaz"); assert.equal(ofis.kisi?.sirket, "Örnek Gayrimenkul");
  assert.match(ofis.veri!.operasyonNotu ?? "", /Fiyat düştü/);
  assert.equal((ofis.veri!.ozellik as any).bulunduguKat, 4); assert.equal((ofis.veri!.ozellik as any).binaYasi, 28);
  // v3.16 — geri sayım ilanın yayın tarihinden değil, kaydın sisteme girdiği günden (BUGUN) başlar
  assert.equal(Math.round((ofis.veri!.validUntil!.getTime() - BUGUN.getTime()) / 86_400_000), 90);
  assert.equal(ofis.veri!.lokasyonlar[0].ilceId != null, true);
  // daire için "devren" anlamsız → satılık kalır; dükkanda devren satılık
  assert.equal(sahibi.veri!.mulkTipi, "DUKKAN_MAGAZA"); assert.equal(sahibi.veri!.islemTipi, "DEVREN_SATILIK");
  assert.equal(sahibi.veri!.ilanSahibiTipi, "MALIK"); assert.equal(sahibi.kisi, null, "bireysel ilan sahibi kişi kartı olarak açılmaz");
  assert.equal(sahibi.veri!.portalIlanNo, "1342746857");
  // v3.16 — eski ilan artık süresi dolmuş sayılmaz: uyarı verilir ama süre bugünden başlar
  assert.equal(eski.veri!.durum, "ACTIVE");
  assert.ok(eski.kontrol.some((k) => /90 günden eski/.test(k)));
  assert.equal(Math.round((eski.veri!.validUntil!.getTime() - BUGUN.getTime()) / 86_400_000), 90);
  // meslektaş dosyası → partner havuzu
  const m = satirHazirla(satirDonustur(b.satirlar[0].hucreler, b.eslesme, sec({ dosyaTuru: "MESLEKTAS" }), 2), INDEKS);
  assert.equal(m.veri!.havuz, "PARTNER"); assert.equal(m.veri!.ilanSahibiTipi, "PARTNER");
});

test("talep tablosu → talepler: tip metinden, il geneli, 'geneli' eki, şüpheli bütçe kontrol, kiralıkta aylık", () => {
  const b = dosyaSatirlari(ORNEK_TALEP_SAYFALARI);
  const o = sec({ tip: "TALEP", dosyaTuru: "TALEP_LISTESI" });
  const s = b.flatMap((x) => x.satirlar.map((r) => satirHazirla(satirDonustur(r.hucreler, x.eslesme, o, r.no), INDEKS)));
  const fener = s.find((x) => x.girdi.lokasyonHam === "FENER")!;
  assert.equal(fener.veri!.mulkTipi, "DAIRE"); assert.equal(fener.veri!.odaSayisi, "2+1"); assert.equal(fener.kisi?.adSoyad, "Ali Vural"); assert.equal(fener.kisi?.rol, "MUSTERI");
  const arsa = s.find((x) => x.veri?.mulkTipi === "ARSA" && x.ilGeneli)!;
  assert.ok(arsa.kontrol.some((k) => /şüpheli/.test(k)));
  assert.equal(arsa.veri!.lokasyonlar[0].ilceId, null, "Antalya geneli → il düzeyi");
  const lara = s.find((x) => x.kisi?.adSoyad === "Zeynep Şahin")!;
  assert.equal(lara.veri!.islemTipi, "KIRALIK"); assert.equal(lara.veri!.fiyatPeriyodu, "AYLIK"); assert.equal(lara.veri!.maxFiyat, 50_000);
  assert.ok(lara.veri!.lokasyonlar.length >= 1, "Lara geneli → Lara");
  const fabrika = s.find((x) => x.veri?.mulkTipi === "FABRIKA_URETIM_TESISI")!;
  assert.equal(fabrika.veri!.maxM2, 2000, "'2000 m2 ye kadar' → en fazla");
  assert.ok(s.every((x) => x.veri), s.flatMap((x) => x.hatalar).join());
});

test("toplu mesaj: kişi öneki, yalnız ad satırı, devam satırı, aynı satırda iki istek ve miras", () => {
  const p = mesajiBol(ORNEK_TOPLANTI_NOTU, INDEKS);
  assert.equal(p.length, 7);
  assert.equal(p[0].kisiAdi, "Ali V."); assert.equal(p[0].h.odaSayisi, "2+1");
  assert.equal(p[1].ilGeneli, true); assert.equal(p[1].h.mulkTipi, "ARSA");
  assert.equal(p[3].h.odaSayisi, "1+1"); assert.deepEqual(p[3].konumlar, p[2].konumlar); assert.ok(p[3].miras.includes("konum"));
  assert.match(p[4].metin, /nakiti var/, "fiyat yalnız satır öncekinin devamı");
  assert.equal(p[5].kisiAdi, "Kemal Duru"); assert.equal(p[5].h.mulkTipi, "DEPO_ANTREPO"); assert.equal(p[6].kisiAdi, "Kemal Duru");
});

test("vCard: FN, N, ORG, birden çok kart, telefon +90", () => {
  const k = vcfOku(ORNEK_VCF);
  assert.equal(k.length, 2);
  assert.equal(k[0].adSoyad, "Klimacı Emrah Bey"); assert.equal(k[0].telefonlar[0], "+905550000401");
  assert.equal(k[1].sirket, "Tan İnşaat"); assert.equal(k[1].telefonlar[0], "+905550000402");
});

test("sıralama: artan/azalan, boş değerler sonda, metin Türkçe", () => {
  const l = [{ f: 5 }, { f: null }, { f: 9 }, { f: 1 }];
  const s = [{ alan: "f", etiket: "F", deger: (x: any) => x.f, varsayilanYon: "azalan" as const }];
  assert.deepEqual(sirala(l, { alan: "f", yon: "azalan" }, s).map((x) => x.f), [9, 5, 1, null]);
  assert.deepEqual(sirala(l, { alan: "f", yon: "artan" }, s).map((x) => x.f), [1, 5, 9, null]);
  const a = [{ ad: "Şule" }, { ad: "Çağrı" }, { ad: "Zeki" }, { ad: "Ali" }];
  assert.deepEqual(sirala(a, { alan: "ad", yon: "artan" }, [{ alan: "ad", etiket: "Ad", deger: (x) => x.ad, varsayilanYon: "artan" }]).map((x) => x.ad), ["Ali", "Çağrı", "Şule", "Zeki"]);
});

test("ara / WhatsApp bağlantısı", () => {
  assert.equal(aramaLinki("+90 532 111 22 33"), "tel:+905321112233");
  assert.equal(whatsappLinki("0532 111 22 33"), "https://wa.me/905321112233");
  assert.equal(whatsappLinki("+905321112233", selamMetni("Önder Sağlam")), "https://wa.me/905321112233?text=Merhaba%20%C3%96nder%2C");
  assert.equal(whatsappLinki(null), null);
});

test("geçerlilik: eski ayarda DIS_ILAN yoksa 90 gün varsayılır", () => {
  assert.equal(TTL_VARSAYILAN.DIS_ILAN, 90);
  const { DIS_ILAN: _, ...eski } = TTL_VARSAYILAN;
  assert.equal(ttlNormalize(eski).DIS_ILAN, 90);
});