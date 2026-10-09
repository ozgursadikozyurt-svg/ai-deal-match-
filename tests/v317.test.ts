/**
 * Anahtar CRM v3.22 · 9 Ekim 2026
 * v3.17 — jargon sözlüğü (docs/emlak_jargon.md), eksik veri cezası, kişi tablosu içe aktarma (paketli).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { hizliAyristir } from "../src/lib/ai/hizli-ayristirici";
import { katOku, katJargonu, binaYasiOku, emsalOku, bosluklukBinlik, JARGON_ALANLI, JARGON_NOTLUK } from "../src/lib/ai/jargon";
import { eslesmeOnizle, eksikVeriUyarilari, type OnizlemeKayit } from "../src/lib/eslestirme/onizleme";
import { kisiTablosuMu, kisiSutunlariniTani, kisiSatiriOku, telefonCozumle, etiketlerdenRoller, paketle } from "../src/lib/ingest/kisi-tablosu";
import { SISTEM_ROLLERI } from "../src/lib/domain/roller";
import { BAGLAM } from "../demo/lokasyon";
import { SADECE_TEST_baglamiSabitle, VARSAYILAN_OFIS_ID, VARSAYILAN_KULLANICI_ID } from "../src/lib/kiracilik";
// v3.20 — çok ofisli: testler varsayılan ofisin bağlamında çalışır (göçte açılan Özyurtlar Gayrimenkul)
SADECE_TEST_baglamiSabitle({ ofisId: VARSAYILAN_OFIS_ID, kullaniciId: VARSAYILAN_KULLANICI_ID, rol: "OFIS_YONETICISI", eposta: "test@anahtar.local" });


test("fiyat jargonu: M/MTL, satılıkta küçük sayı, kirada bin, boşluklu binlik", () => {
  const f = (m: string) => hizliAyristir(m).fiyat;
  assert.equal(f("Lara'da satılık 3+1 daire 17 MTL"), 17_000_000);
  assert.equal(f("Konyaaltı satılık daire 15.5 TL"), 15_500_000);
  assert.equal(f("Satılık villa 13500 000"), 13_500_000);
  assert.equal(f("Kiralık dükkan 7.500"), 7_500);
  assert.equal(f("8/9 katta 2+1 daire satılık 5.7 M TL"), 5_700_000);
  // telefon numarası fiyat sanılmaz, boşlukları birleştirilmez
  assert.equal(bosluklukBinlik("Ali 0532 111 22 33"), "Ali 0532 111 22 33");
  assert.equal(bosluklukBinlik("13500 000"), "13.500.000");
});

test("kat jargonu: X/Y, katta, yüksek giriş, son kat, bodrum", () => {
  assert.deepEqual(katOku("8/9 katta 2+1"), { bulunduguKat: 8, katSayisi: 9 });
  assert.deepEqual(katOku("12/6 daire"), { bulunduguKat: 6, katSayisi: 12 });
  assert.deepEqual(katOku("3. kat daire"), { bulunduguKat: 3 });
  assert.deepEqual(katOku("5 katlı bina"), { katSayisi: 5 });
  assert.deepEqual(katJargonu("arakat daire"), ["ARA"]);
  assert.deepEqual(katJargonu("katta 2+1"), ["ARA"]);
  assert.deepEqual(katJargonu("yüksek giriş dükkan"), ["0"]);
  assert.deepEqual(katJargonu("son kat çatı"), ["SON"]);
  assert.deepEqual(katJargonu("bodrum kat depo"), ["-1"]);
});

test("bina yaşı ve emsal: SIFIR = 0, '15 yıllık' = 15, '0.70 emsal'", () => {
  assert.equal(binaYasiOku("sıfır bina 2+1"), 0);
  assert.equal(binaYasiOku("SIFIR".toLocaleLowerCase("tr")), 0);
  assert.equal(binaYasiOku("15 yıllık bina"), 15);
  assert.equal(binaYasiOku("8 yaşında"), 8);
  assert.equal(emsalOku("0.70 emsal tarla"), 0.7);
  assert.equal(emsalOku("emsal 0,35"), 0.35);
});

test("anahtar kelimeler alana, karşılığı olmayan jargon nota yazılır", () => {
  const h = hizliAyristir("Vatandaşlığa uygun ebeveyn banyolu havuzlu kapalı otopark full krediye uygun takaslı 2+1 satılık 9 MTL");
  assert.equal(h.ozellik.ebeveynBanyosu, true);
  assert.equal(h.ozellik.havuz, true);
  assert.equal(h.ozellik.otoparkDurumu, true);
  assert.equal(h.kayitAlanlari.krediyeUygun, true);
  assert.equal(h.kayitAlanlari.takasaAcik, true);
  assert.ok(h.jargonNotlari.some((n) => /Yabancıya satışa/.test(n)), h.jargonNotlari.join("|"));
  const k = hizliAyristir("Kapalı portföy, paylaşıma açık, kentsel dönüşümlük 3+1 satılık 6 MTL");
  assert.equal(k.jargonNotlari.length, 3, k.jargonNotlari.join("|"));
});

test("sözlük dosyası koddaki kurallarla birlikte güncellenmiş", () => {
  const md = fs.readFileSync("docs/emlak_jargon.md", "utf8");
  assert.ok(md.includes("src/lib/ai/jargon.ts"), "sözlük koda işaret etmeli");
  for (const x of ["17 MTL", "SIFIR", "ebeveyn banyolu", "yüksek giriş", "takaslı", "0.70 emsal"]) assert.ok(md.includes(x), x);
  assert.ok(JARGON_ALANLI.length >= 10 && JARGON_NOTLUK.length >= 10);
});

const T: OnizlemeKayit = { tip: "TALEP", mulkTipi: "DAIRE", islemTipi: "SATILIK", lokasyonlar: [] };
const P: OnizlemeKayit = { tip: "PORTFOY", mulkTipi: "DAIRE", islemTipi: "SATILIK", lokasyonlar: [] };

test("eksik veri cezası: yalnız ilçe + fiyatla %90 skor çıkmaz, uyarı verilir", () => {
  const ilce = [{ ilId: 7, ilceId: 1, mahalleId: null, altBolgeId: null, birincil: false }];
  const zayif = eslesmeOnizle({ ...T, maxFiyat: 6_000_000, lokasyonlar: ilce }, { ...P, fiyat: 5_800_000, lokasyonlar: ilce }, BAGLAM);
  assert.ok(zayif.veriEksikleri.length >= 3, zayif.veriEksikleri.join("|"));
  assert.ok(zayif.skor < 90, `eksik veriyle skor ${zayif.skor} olmamalı`);
  const zengin = eslesmeOnizle(
    { ...T, maxFiyat: 6_000_000, minM2: 100, odaSayisi: "2+1", lokasyonlar: [{ ilId: 7, ilceId: 1, mahalleId: 5, altBolgeId: null, birincil: false }], ozellik: { istenenKatlar: ["ARA"], asansor: true } },
    { ...P, fiyat: 5_800_000, m2: 110, odaSayisi: "2+1", lokasyonlar: [{ ilId: 7, ilceId: 1, mahalleId: 5, altBolgeId: null, birincil: true }], ozellik: { bulunduguKat: 3, katSayisi: 6, asansor: true, binaYasi: 5 } },
    BAGLAM);
  assert.deepEqual(zengin.veriEksikleri, [], "alanlar doluyken uyarı olmamalı");
  assert.ok(zengin.skor > zayif.skor, `${zengin.skor} > ${zayif.skor}`);
  assert.ok(eksikVeriUyarilari(T, P).some((x) => /m²/.test(x)));
});

test("kişi tablosu: Google Contacts CSV başlıkları tanınır, alanlar ayrışır", () => {
  const bas = ["Name", "Given Name", "Family Name", "Organization 1 - Name", "Organization 1 - Title", "E-mail 1 - Value", "Phone 1 - Value", "Phone 2 - Value", "Notes", "Labels"];
  assert.ok(kisiTablosuMu(bas));
  assert.ok(!kisiTablosuMu(["İlçe", "Fiyat", "m2", "Oda"]));
  const sut = kisiSutunlariniTani(bas);
  const k = kisiSatiriOku(["Ali Rıza Vural", "Ali Rıza", "Vural", "Vural Emlak", "Danışman", "ali@ornek.com", "0532 111 22 33", "+90 242 000 00 00", "Lara'da villa arıyor", "* myContacts ::: Emlakçı"], sut, 2, SISTEM_ROLLERI);
  assert.equal(k.adSoyad, "Ali Rıza Vural");
  assert.equal(k.telefon, "+905321112233");
  assert.equal(k.ikincilTelefon, "+902420000000");
  assert.equal(k.email, "ali@ornek.com");
  assert.equal(k.sirket, "Vural Emlak");
  assert.match(k.notlar!, /Lara'da villa arıyor · Unvan: Danışman/);
  assert.deepEqual(k.etiketler, ["EMLAKCI"]);
  assert.equal(k.durum, "HAZIR");
});

test("telefon doğrulama: eksik / fazla haneli numara uyarı verir, kişi yine de eklenir", () => {
  assert.equal(telefonCozumle("0532 111 22 33").tel, "+905321112233");
  assert.equal(telefonCozumle("905321112233").tel, "+905321112233");
  assert.equal(telefonCozumle("5321112233").tel, "+905321112233");
  const eksik = telefonCozumle("905 532 111");
  assert.equal(eksik.tel, null); assert.match(eksik.uyari!, /Eksik numara/);
  assert.equal(telefonCozumle("+49 170 1234567").tel, "+491701234567", "yurt dışı numara olduğu gibi saklanır");
  assert.match(telefonCozumle("12345678901234567").uyari!, /Fazla haneli/);
  const sut = kisiSutunlariniTani(["Name", "Phone 1 - Value"]);
  const k = kisiSatiriOku(["Veli", "905 532 111"], sut, 3);
  assert.equal(k.durum, "KONTROL"); assert.equal(k.telefon, null); assert.equal(k.adSoyad, "Veli");
  assert.deepEqual(etiketlerdenRoller("Alıcı; Yatırımcı", SISTEM_ROLLERI), ["ALICI", "YATIRIMCI"]);
});

test("paketleme: 7.000 kişi 500'erli 14 pakete bölünür", () => {
  const p = paketle(Array.from({ length: 7000 }, (_, i) => i), 500);
  assert.equal(p.length, 14);
  assert.equal(p[0].length, 500);
  assert.equal(p.flat().length, 7000);
  assert.equal(paketle([1, 2, 3], 500).length, 1);
  assert.equal(paketle([], 500).length, 0);
});
