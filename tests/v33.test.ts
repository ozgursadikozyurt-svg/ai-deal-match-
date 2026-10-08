/**
 * Anahtar CRM v3.21.1 · 8 Ekim 2026
 * v3.3 — veritabanısız testler: WhatsApp ayrıştırıcı + ön filtre, mülk tipi benzerliği, konut eşleştirmesi,
 * konum öğrenme, alan-grup tutarlılığı.  Çalıştır: npx tsx --test tests/v33.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { sohbetiAyristir, onFiltre, grupAdiOf } from "../src/lib/ingest/whatsapp";
import { tipBenzerligi } from "../src/lib/domain/kategori";
import { MULK_OZELLIK_META, alanGruptaMi, odaSayisiAyristir, type MulkOzellikAlani } from "../src/lib/domain/teknik-alanlar";
import { ONEMLI_ALANLAR } from "../src/lib/domain/form-alanlari";
import { adaylariGuncelle, adayOnerisi } from "../src/lib/lokasyon/ogrenme";
import { eslesmeOnizle, temelUyum } from "../src/lib/eslestirme/onizleme";
import { AiParseCiktiSchema } from "../src/lib/ai/gemini-cikti-semasi";
import { coz, BAGLAM } from "../demo/lokasyon";
import { ornekVeriyiKur } from "../demo/depo";
import { ORNEK_SOHBETLER, hazirAiSonucu } from "../demo/ornek-sohbetler";
import { SADECE_TEST_baglamiSabitle, VARSAYILAN_OFIS_ID, VARSAYILAN_KULLANICI_ID } from "../src/lib/kiracilik";
// v3.20 — çok ofisli: testler varsayılan ofisin bağlamında çalışır (göçte açılan Özyurtlar Gayrimenkul)
SADECE_TEST_baglamiSabitle({ ofisId: VARSAYILAN_OFIS_ID, kullaniciId: VARSAYILAN_KULLANICI_ID, rol: "OFIS_YONETICISI", eposta: "test@anahtar.local" });


test("WhatsApp: Android + iOS biçimi, çok satırlı mesaj, sistem satırı, gönderen numarası", () => {
  const a = sohbetiAyristir("14.09.2026 09:12 - Ahmet gruba katıldı\n14.09.2026 09:15 - Havva: Muratpaşa 3+1 120m²\nasansörlü. 6M TL\n14.09.2026 09:16 - +90 530 457 32 56: 400 m2 depo kiralık", "WhatsApp Sohbeti - EMLAK BORSASI.txt");
  assert.equal(a.length, 2);
  assert.equal(a[0].metin, "Muratpaşa 3+1 120m²\nasansörlü. 6M TL");
  assert.equal(a[1].telefon, "+905304573256");
  assert.equal(a[0].grup, "EMLAK BORSASI");
  const b = sohbetiAyristir("[29.09.2026 08:41:55] Levent: OSB'de 3000 m2 fabrika satılık", "_chat.txt", "SANAYİ");
  assert.equal(b.length, 1);
  assert.equal(new Date(b[0].tarih!).getDate(), 29);
  assert.equal(grupAdiOf("WhatsApp Chat with Emlakçılar.txt"), "Emlakçılar");
});

test("WhatsApp: ön filtre gürültüyü, eski mesajı ve gruplar arası kopyayı ayıklar", () => {
  const m = ORNEK_SOHBETLER.flatMap((s) => sohbetiAyristir(s.icerik, s.dosya));
  const r = onFiltre(m);
  const say = (d: string) => r.mesajlar.filter((x) => x.durum === d).length;
  assert.equal(say("ADAY"), 10);
  assert.equal(say("TEKRAR"), 1); // imalathane ilanı iki grupta
  assert.ok(r.mesajlar.find((x) => x.metin.includes("araba satılık"))?.durum === "GURULTU");
  const eski = onFiltre(m, { sonGun: 1, bugun: new Date(2026, 8, 30, 12) });
  assert.ok(eski.mesajlar.filter((x) => x.durum === "ADAY").length < 10);
});

test("Örnek sohbetlerin hazır yapay zekâ çıktıları şemadan geçer", () => {
  const kayitlar = ORNEK_SOHBETLER.flatMap((s) => sohbetiAyristir(s.icerik, s.dosya)).flatMap((m) => hazirAiSonucu(m.metin));
  assert.ok(kayitlar.length >= 10);
  const p = AiParseCiktiSchema.safeParse({ sinif: "HER_IKISI", kayitlar });
  assert.ok(p.success, p.success ? "" : JSON.stringify(p.error.issues.slice(0, 3)));
});

test("Mülk tipi benzerliği: aynı aile, benzer aile, alakasız", () => {
  assert.equal(tipBenzerligi("DEPO_ANTREPO", "DEPO_ANTREPO").oran, 1);
  assert.equal(tipBenzerligi("IMALATHANE", "ATOLYE").oran, 0.9);
  assert.equal(tipBenzerligi("DEPO_ANTREPO", "FABRIKA_URETIM_TESISI").oran, 0.6);
  assert.equal(tipBenzerligi("DAIRE", "DEPO_ANTREPO").oran, 0);
});

test("Her teknik alanın grubu tanımlı; konut formunda endüstriyel alan yok", () => {
  for (const [a, m] of Object.entries(MULK_OZELLIK_META)) assert.ok(m.gruplar.length > 0, a);
  const konut = (Object.keys(MULK_OZELLIK_META) as MulkOzellikAlani[]).filter((a) => alanGruptaMi(a, "KONUT"));
  for (const yok of ["trafo", "sanayiElektrigi", "vinc", "rampa", "makasAltiYukseklikM", "elektrikGucuKw"]) assert.ok(!konut.includes(yok as MulkOzellikAlani), yok);
  for (const [g, liste] of Object.entries(ONEMLI_ALANLAR)) for (const a of liste) assert.ok(alanGruptaMi(a, g as any), `${g}: ${a}`);
});

test("Konut eşleştirmesi: oda sayısı ve krediye uygunluk karşılaştırılır", () => {
  assert.deepEqual(odaSayisiAyristir("3+1"), { oda: 3, salon: 1 });
  const { kayitlar } = ornekVeriyiKur();
  const k = (id: string) => kayitlar.find((x) => x.id === id)!.veri as any;
  const s = eslesmeOnizle(k("T9"), k("P11"), BAGLAM);
  assert.equal(s.kriterler.find((x) => x.anahtar === "odaSayisi")?.sonuc, "SAGLANDI");
  assert.equal(s.kriterler.find((x) => x.anahtar === "krediyeUygun")?.sonuc, "SAGLANDI");
  assert.equal(s.uygunluk, "SUNULABILIR");
  assert.equal(temelUyum(k("T9"), k("P2")), false); // daire talebi ↔ depo
  assert.equal(temelUyum(k("T12"), k("P7")), true); // imalathane talebi ↔ atölye (aynı aile)
});

test("Konum öğrenme: tekrar eden birlikte geçiş güçlü öneriye dönüşür; referans nokta çözülür", () => {
  let a = adaylariGuncelle([], [], [], undefined);
  for (let i = 0; i < 3; i++) { const r = coz("Kepez, Yeni Sanayi civarı"); a = adaylariGuncelle(a, r.cozulemeyen, r.lokasyonlar, "örnek"); }
  const o = adayOnerisi(a.find((x) => x.ifade === "yeni sanayi")!);
  assert.equal(o?.etiket, "Kepez");
  assert.equal(o?.guclu, true);
  assert.match(coz("Cender otel arkası").lokasyonlar[0].etiket, /Gençlik/);
});