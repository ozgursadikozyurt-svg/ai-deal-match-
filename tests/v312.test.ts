/**
 * Anahtar CRM v3.13 · 3 Ekim 2026
 * v3.12 — metin ayrıştırma düzeltmeleri (kullanıcının WhatsApp sohbetinden gelen örnekler), içe aktarma kural geçişi, sürüm.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { hizliAyristir, paraNormalize, TALEP_IPUCU } from "../src/lib/ai/hizli-ayristirici";
import { mesajiYorumla, caddeAdiniAyikla } from "../src/lib/ai/yorumlayici";
import { mesajiBol } from "../src/lib/ingest/toplu-mesaj";
import { INDEKS } from "../demo/lokasyon";
import { SURUM, SURUM_GECMISI } from "../src/lib/surum";

const oku = (m: string) => mesajiYorumla(m, INDEKS as any).parcalar;

test("'5.450.000. ₺' (sondaki nokta) fiyat olarak okunur", () => {
  assert.equal(paraNormalize("daire 5.450.000. ₺"), "daire 5.450.000 TL");
  assert.equal(hizliAyristir("3+1 DAIRE 5.450.000. ₺").fiyat, 5450000);
});

test("Döşemealtı Yeniköy / Atatürk Caddesi: cadde mahalle sanılmaz, Yeniköy bulunur, fiyat okunur", () => {
  const [p] = oku("DÖŞEMEALTI YENIKOY MAHALLESINDE ATATURK CADDESI ÜZERİNDE 10 YILLIK AZ OTURULMUS TEMIZ 3+1 ARA KAT DAIRE 5.450.000. ₺");
  assert.equal(p.h.tip, "PORTFOY");
  assert.equal(p.h.fiyat, 5450000);
  assert.equal(p.h.islemTipi, "SATILIK");
  assert.ok(p.konumlar.some((k) => /yenik/i.test(k)) && !p.konumlar.some((k) => /atat/i.test(k)), JSON.stringify(p.konumlar));
});

test("cadde adı ayıklama: mahalle sözcüğünden öncesi korunur, yalnız cadde adı gider", () => {
  assert.equal(caddeAdiniAyikla("Kepez Yeniköy Mahallesi Atatürk Cad. no 5").trim().replace(/\s+/g, " "), "Kepez Yeniköy Mahallesi no 5");
  assert.equal(caddeAdiniAyikla("Muratpaşa Meltem Atatürk Caddesi üzerinde dükkan").trim().replace(/\s+/g, " "), "Muratpaşa Meltem dükkan");
});

test("'satılıktır' / 'SATILIK' yazan ilanlar talep sayılmaz (Meltem arsa hissesi, Demircikara villa)", () => {
  assert.equal(oku("Bahçelievler ve Meltem bölgelerinde, toplam 247 m² büyüklüğünde (47 ayrı parsel) arsa hissesi satılıktır.")[0].h.tip, "PORTFOY");
  assert.equal(oku("Antalya Murat paşa Demircikara da denize 150 m 1400m2 arsası olan kapalı karajı olan iki adet villa SATILIK")[0].h.tip, "PORTFOY");
});

test("talep işareti: zayıf sözcükler ilanda talep yapmaz, gerçek talep yine talep kalır", () => {
  const talep = (m: string) => TALEP_IPUCU.test(m.toLocaleLowerCase("tr"));
  assert.equal(talep("3+1 tadilata ihtiyacı var, 6 katlı binanın 2. katında"), false);
  assert.equal(talep("Pazartesi tapu yapmamız LAZIM"), false);
  assert.equal(talep("10 KATA KADAR MÜSAADELİ"), false);
  assert.equal(talep("Yeni Yılınız kutlu olsun"), false);
  assert.equal(talep("Kültür Yeşilyurt bölgesinde 2+1 eşyasız kiralık daire lazım arkadaşlar"), true);
  assert.equal(talep("Konyaaltı satılık daire arayışımız var bütçe 5.5 max"), true);
  assert.equal(talep("5 milyona kadar 2+1"), true);
  assert.equal(talep("SATILIK DAİRE TALEBİ - 2"), true);
});

test("numaralı ilan listesi: başlık satırı + ayrıntı satırı tek ilan; döviz fiyatı kiralık sanılmaz; selam satırı kayıt değil", () => {
  const metin = "Yeni Yılınız kutlu olsun...\n1. Satılık, Antalya, Kepez, Küçükçuk.\n   1+1 Daire, 50m², 2. kat, 80.000 dolar.\n2. Satılık, Antalya, Konyaaltı, Uncalı.\n   3+1 Daire, 135m², 6. kat, 355.000 dolar.";
  const parca = mesajiBol(metin, INDEKS as any);
  assert.equal(parca.length, 2, parca.map((p) => p.metin).join(" | "));
  for (const p of parca) { assert.equal(p.h.tip, "PORTFOY"); assert.equal(p.h.islemTipi, "SATILIK"); assert.ok(p.h.fiyat && p.h.mulkTipi === "DAIRE"); }
});

test("güven puanı ve sıralama alanları: kural okuması her parçaya güven verir", () => {
  const [p] = oku("Lara'da 3+1 satılık daire 5.450.000 TL 140 m²");
  assert.ok((p.guven ?? 0) >= 70, String(p.guven));
  const [z] = oku("Satılık bir şey var");
  assert.ok((z.guven ?? 0) < 70);
});

test("sürüm 3.12 kayıtlı", () => {
  const k = SURUM_GECMISI.find((x) => x.surum === "3.12");
  assert.ok(k && (k.testEt ?? []).length >= 3);
  assert.ok(Number(SURUM) >= 3.12);
});

import { kuralAdaylari } from "../demo/ice-aktarma";
import { depoYukle } from "../demo/depo";
import { sohbetiAyristir, onFiltre } from "../src/lib/ingest/whatsapp";

test("içe aktarma: yapay zekâ olmadan adaylar hemen çıkar; kullanıcının üç örneği portföy, fiyat ve konumla gelir", () => {
  const sohbet = [
    "[09.12.2026 10:00:00] Ali Emlak: DÖŞEMEALTI YENIKOY MAHALLESINDE ATATURK CADDESI ÜZERİNDE 10 YILLIK AZ OTURULMUS TEMIZ 3+1 ARA KAT DAIRE 5.450.000. ₺",
    "[09.12.2026 10:05:00] Veli Gayrimenkul: Bahçelievler ve Meltem bölgelerinde, toplam 247 m² büyüklüğünde (47 ayrı parsel) arsa hissesi satılıktır.",
    "[09.12.2026 10:09:00] Can Emlak: Antalya Murat paşa Demircikara da denize 150 m 1400m2 arsası olan kapalı karajı olan iki adet villa SATILIK",
    "[09.12.2026 10:10:00] Ece Emlak: Kültür Yeşilyurt bölgesinde 2+1 eşyasız kiralık daire lazım arkadaşlar",
  ].join("\n");
  const r = onFiltre(sohbetiAyristir(sohbet, "grup", "grup"), {});
  const { durum } = depoYukle();
  const a = kuralAdaylari(r.mesajlar, durum, "IA1", []);
  assert.equal(a.length, 4);
  assert.deepEqual(a.map((x) => x.taslak.tip), ["PORTFOY", "PORTFOY", "PORTFOY", "TALEP"]);
  assert.equal((a[0].taslak as any).fiyat, 5450000);
  assert.ok(a.every((x) => x.kaynak === "KURAL" && typeof x.guven === "number"));
  assert.ok((a[0].taslak.lokasyonlar ?? []).length >= 1);
});

test("yan yana iki mahalle adı ayrı yer sayılır (Yenigün Kızıltoprak); alt bölge + mahalle tek yerdir (Lara Güzeloba)", () => {
  const [p] = oku("Kızıltoprak Yenigün mahallesinde 3+1 satılık daire 5.000.000 TL");
  assert.equal(p.konumlar.length, 2, JSON.stringify(p.konumlar));
  const [q] = oku("LARA GÜZELOBA 2+1 kiralık daire 40.000 TL");
  assert.equal(q.konumlar.length, 1, JSON.stringify(q.konumlar));
});