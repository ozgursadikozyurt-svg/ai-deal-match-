/**
 * Anahtar CRM v3.45 · 27 Ekim 2026
 * Sohbetten içe aktarılan kayıt Emlak grubu olarak işaretlenir; mesaj benden geldiyse Kendi portföyüm.
 * Kural tek yerde (src/lib/domain/sohbet-kaynagi.ts) ve üç içe aktarma yolu da aynı sonucu verir.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { SURUM_GECMISI } from "../src/lib/surum";
import { kimlikKur, benimMesajim, sohbetKaynagi, sohbetKaynagiUygula, son10 } from "../src/lib/domain/sohbet-kaynagi";
import { kaynakOf } from "../src/lib/domain/kaynak";
import { tahminIlkKaynak } from "../src/lib/domain/ilk-kaynak";

const imza = { adSoyad: "Özgür Özyurt", telefon: "0530 936 54 27" };
const kimlik = kimlikKur(imza);
const portfoy = { tip: "PORTFOY", veriKanali: "WHATSAPP", havuz: "KENDI_PORTFOY", ilanSahibiTipi: "BILINMIYOR" };
const talep = { tip: "TALEP", veriKanali: "WHATSAPP", havuz: "KENDI_PORTFOY", ilanSahibiTipi: "BILINMIYOR" };

test("sürüm 3.45 kayıtlı", () => { assert.ok(SURUM_GECMISI.some((x) => x.surum === "3.45")); });

test("telefon eşleşmesi biçimden bağımsız", () => {
  assert.equal(son10("0530 936 54 27"), "5309365427");
  assert.equal(son10("+90 530 936 54 27"), "5309365427");
  assert.equal(son10("905309365427"), "5309365427");
  assert.equal(son10("1234"), "");
});

test("kendi mesajım: dışa aktarma yazarı, telefon ya da tam ad ile tanınır", () => {
  for (const g of [{ gonderen: "Siz" }, { gonderen: "You" }, { gonderen: "Ben" }]) assert.ok(benimMesajim(g, kimlik), JSON.stringify(g));
  assert.ok(benimMesajim({ gonderen: "+90 530 936 54 27" }, kimlik), "yazar alanı telefonsa");
  assert.ok(benimMesajim({ gonderen: "Bilinmeyen", telefon: "05309365427" }, kimlik), "telefon alanı");
  assert.ok(benimMesajim({ gonderen: "özgür özyurt" }, kimlik), "ad (büyük/küçük harf farketmez)");
});

test("başkasının mesajı benim sayılmaz; yalnızca ilk ad yetmez", () => {
  assert.ok(!benimMesajim({ gonderen: "Erkan Ateş", telefon: "+905551112233" }, kimlik));
  assert.ok(!benimMesajim({ gonderen: "Özgür" }, kimlik), "sadece ilk ad eşleşmemeli — gruptaki başka Özgür'ü kendim sanmayayım");
  assert.ok(!benimMesajim({ gonderen: "Bilinmeyen" }, kimlik));
});

test("sohbetten gelen talep ve portföy Emlak grubu olur", () => {
  for (const v of [portfoy, talep]) {
    // düzeltme öncesi davranış: kayıt "Kendi portföyüm" görünüyordu
    assert.equal(kaynakOf(v), "KENDI");
    const k = sohbetKaynagiUygula(v, { gonderen: "Erkan Ateş", telefon: "+905551112233" }, kimlik);
    assert.equal(k.kaynak, "EMLAK_GRUBU");
    assert.equal(k.benim, false);
    assert.equal(kaynakOf(k.taslak), "EMLAK_GRUBU", `${v.tip} emlak grubu olmalı`);
  }
});

test("kendi mesajımdan gelen kayıt Kendi portföyüm kalır", () => {
  const k = sohbetKaynagiUygula(portfoy, { gonderen: "Siz" }, kimlik);
  assert.equal(k.kaynak, "KENDI");
  assert.ok(k.benim);
  assert.equal(kaynakOf(k.taslak), "KENDI");
  // telefonumdan tanınan mesaj da aynı
  assert.equal(sohbetKaynagi(portfoy, { gonderen: "Bilinmeyen", telefon: "0530 936 54 27" }, kimlik), "KENDI");
});

test("grupta paylaşılan 'sahibinden' ilanı yine Emlak grubu; ilan sahibi bilgisi korunur", () => {
  const v = { ...portfoy, ilanSahibiTipi: "MALIK" };
  const k = sohbetKaynagiUygula(v, { gonderen: "Erkan Ateş" }, kimlik);
  assert.equal(k.kaynak, "EMLAK_GRUBU");
  assert.equal((k.taslak as any).ilanSahibiTipi, "MALIK", "ilan sahibinin malik olduğu bilgisi silinmemeli");
});

test("portal ilanına dokunulmaz (web ilanı emlak grubu değildir)", () => {
  assert.equal(sohbetKaynagi({ ...portfoy, portalUrl: "https://www.sahibinden.com/ilan/123" }, { gonderen: "Erkan" }, kimlik), null);
  assert.equal(sohbetKaynagi({ tip: "PORTFOY", veriKanali: "SAHIBINDEN", havuz: "DIS_ILAN" }, { gonderen: "Erkan" }, kimlik), null);
});

test("ilk kaynak (değiştirilemez alan) sohbet kayıtlarında EMLAK_GRUBU kalır", () => {
  // kaynak seçimi havuzu değiştirir; ilk kaynak yine emlak grubu olmalı
  const k = sohbetKaynagiUygula(portfoy, { gonderen: "Erkan Ateş" }, kimlik);
  assert.equal(tahminIlkKaynak(k.taslak as any), "EMLAK_GRUBU");
});

test("ayarsız kimlik kimseyi 'ben' saymaz (yazar alanı dışında)", () => {
  const bos = kimlikKur(null);
  assert.ok(!benimMesajim({ gonderen: "Erkan", telefon: "+905551112233" }, bos));
  assert.ok(benimMesajim({ gonderen: "Siz" }, bos), "dışa aktarmanın kendi yazarı her zaman tanınır");
});

test("üç içe aktarma yolu da ortak kuralı çağırıyor", () => {
  const yapistir = fs.readFileSync("demo/ai-kutusu.tsx", "utf8");
  const dosya = fs.readFileSync("demo/ice-aktarma.tsx", "utf8");
  assert.ok(yapistir.includes("sohbetKaynagiUygula"), "yapıştırılan metin yolu");
  assert.ok(dosya.includes("sohbetKaynagiUygula"), "sohbet dosyası yolu");
  // eski, yola göre değişen kural geri gelmesin
  assert.ok(!dosya.includes('taslak.havuz = ben ? "KENDI_PORTFOY" : "PARTNER"'), "eski yerel kural kaldırılmalı");
});

// ───────── Arayüz tazelemesi ─────────

test("tasarım belirteçleri ve erişilebilirlik kuralları tanımlı", () => {
  const css = fs.readFileSync("demo/sayfa.html", "utf8");
  for (const t of ["--g1:", "--g2:", "--g3:", "--r-kucuk:", "--cizgi-ince:", "--gecis:"]) assert.ok(css.includes(t), t + " belirteci yok");
  assert.match(css, /:focus-visible\{[^}]*outline:2px solid var\(--acc\)/, "odak halkası yok");
  assert.match(css, /@media \(prefers-reduced-motion:reduce\)/, "hareket azaltma kuralı yok");
  assert.match(css, /\.btn,\.fb,\.sekmeler button\{min-height:40px\}/, "telefon dokunma hedefi kuralı yok");
});

test("İşlemler: rakam şeridi altı kutunun yerini aldı", () => {
  const css = fs.readFileSync("demo/sayfa.html", "utf8");
  const ekran = fs.readFileSync("demo/islemler.tsx", "utf8");
  assert.ok(css.includes(".rakam-serit") && css.includes(".rakam.kahraman"), "şerit stili yok");
  assert.ok(ekran.includes('className="rakam kahraman"'), "kahraman hücre yok");
  assert.ok(!css.includes(".ozet-kutular") && !ekran.includes('className="ozet-kutular"'), "eski kutu düzeni kaldırılmalı");
  // koyu bantlar kalktı: başlık ve toplam artık lacivert zemin değil
  assert.ok(!/\.islem-tablo th\{[^}]*background:var\(--lacivert\)/.test(css), "tablo başlığı hâlâ koyu bant");
  assert.ok(!/\.islem-tablo tfoot td\{[^}]*background:var\(--lacivert\)/.test(css), "TOTAL satırı hâlâ koyu bant");
});

test("aylık grafik yılın tamamını gösterir", () => {
  const ekran = fs.readFileSync("demo/islemler.tsx", "utf8");
  assert.ok(ekran.includes("aylar.map((v, i)"), "12 ayın tamamı çizilmeli (kesilmiş dizi değil)");
  assert.ok(ekran.includes('className="gc-iz"'), "boş ayların soluk izi yok");
});
