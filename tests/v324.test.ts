/**
 * Anahtar CRM v3.24 · 10 Ekim 2026
 * v3.24 — Kaynak seçimi (Emlak grubu · Sahibinden · Portal · Kendi portföyüm) ↔ havuz / ilan sahibi / kanal;
 * Yapıştır incelemesinde süzgeçler + hazırlar önce + eklenenler listede kalır; Gelen Kutusu Veri Girişi sekmesi;
 * eşleşme detayında kişi iletişimi + orijinal metin; üst satır (Geri başlıkla aynı satırda); fotoğraf doğrudan yükleme.
 */
import { test as nodeTest } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import React from "react";
import { kaynakOf, kaynakUygula, KAYNAK_SECIMLERI, type KaynakSecimi } from "../src/lib/domain/kaynak";
import { havuzKatmani } from "../src/lib/eslestirme/havuz";
import { KayitCreateSchema } from "../src/lib/validation/kayit";
import { AkilliKutu } from "../demo/ai-kutusu";
import { EslesmeDetay, VeriGirisi } from "../demo/app";
import { ornekVeriyiKur, bosBaglanti, bosGoogleBaglanti, DEMO_SAHIPLIK, type DepoDurumu } from "../demo/depo";
import { sahiplikNormalize } from "../src/lib/domain/sahiplik";
import { TTL_VARSAYILAN } from "../src/lib/domain/gecerlilik";
import { kaliciHepsiniSil } from "../demo/kalici";
import { useEslesmeler, type Ctx } from "../demo/ortak";
import { gelenDepoKur, demoGelenSifirla } from "../demo/gelen-depo";
import { kutuSifirla } from "../demo/gelen-kutusu";
import { gmailKopruBetigi } from "../src/lib/ingest/gelen";
import { SURUM, SURUM_GECMISI, DOSYA_EKI } from "../src/lib/surum";
import { SADECE_TEST_baglamiSabitle, VARSAYILAN_OFIS_ID, VARSAYILAN_KULLANICI_ID } from "../src/lib/kiracilik";
import { ac } from "./yardimci-arayuz";
SADECE_TEST_baglamiSabitle({ ofisId: VARSAYILAN_OFIS_ID, kullaniciId: VARSAYILAN_KULLANICI_ID, rol: "OFIS_YONETICISI", eposta: "test@anahtar.local" });

const ornek = ornekVeriyiKur();
const durum = (ek: Partial<DepoDurumu> = {}): DepoDurumu => ({ veriSurumu: "t", kayitlar: ornek.kayitlar, eslesmeNotlari: {}, testler: {}, geriBildirim: "", ayarlar: { ttl: TTL_VARSAYILAN, sahiplik: sahiplikNormalize(DEMO_SAHIPLIK) }, ogrenilen: [], adaylar: [], aktifIceAktarma: null, iceAktarmaGecmisi: [], kisiler: ornek.kisiler, islenmisMesajlar: [], dosyaIzleri: {}, baglantilar: { google: bosGoogleBaglanti(), notion: bosBaglanti() }, senkronGecmisi: [], cakismalar: [], ...ek });
const test = (ad: string, f: () => unknown | Promise<unknown>) => nodeTest(ad, async () => { kaliciHepsiniSil(); await f(); });
const ctx = (d0: DepoDurumu, git: (e: any) => void = () => {}) => { const c = { d: d0, guncelle: (f: any) => { c.d = f(c.d); }, kayitKaydet: () => {}, bildir: () => {}, ornekHatalari: [], git, geri: () => {}, geriVar: false, sample: null } as unknown as Ctx; return c; };

// ───────── 1) Kaynak ─────────
test("kaynak: dört seçim kaydın alanlarına yazılır ve aynen geri okunur; şema kabul eder; havuz katmanı seçimle uyumlu", () => {
  const baslangiclar = [
    { havuz: "KENDI_PORTFOY", ilanSahibiTipi: "BILINMIYOR", veriKanali: "MANUEL" },
    { havuz: "PARTNER", ilanSahibiTipi: "EMLAKCI", veriKanali: "WHATSAPP" },
    { havuz: "DIS_ILAN", ilanSahibiTipi: "MALIK", veriKanali: "SAHIBINDEN" },
    { havuz: "KENDI_PORTFOY", ilanSahibiTipi: "PORTAL", veriKanali: "HEPSIEMLAK" },
    { havuz: "KENDI_PORTFOY", ilanSahibiTipi: "FIRMA", veriKanali: "CSV" },
  ];
  const katman: Record<KaynakSecimi, string> = { EMLAK_GRUBU: "PARTNER", SAHIBINDEN: "WEB", PORTAL: "WEB", KENDI: "CRM" };
  for (const tip of ["PORTFOY", "TALEP"] as const) for (const b of baslangiclar) for (const k of KAYNAK_SECIMLERI) {
    const v = kaynakUygula({ tip, mulkTipi: "DUKKAN_MAGAZA", islemTipi: "KIRALIK", fiyat: 50_000, maxFiyat: 50_000, lokasyonlar: [], ...b, ...(tip === "TALEP" ? { havuz: "KENDI_PORTFOY" } : {}) } as any, k);
    assert.equal(kaynakOf(v), k, `${tip} ${JSON.stringify(b)} → ${k}: ${JSON.stringify({ h: v.havuz, s: v.ilanSahibiTipi, k: v.veriKanali })}`);
    assert.ok(KayitCreateSchema.safeParse(v).success, `${tip} ${k} şemadan geçer`);
    if (tip === "PORTFOY") assert.equal(havuzKatmani(v as any), katman[k], `${k} → ${katman[k]} katmanı`);
  }
  // seçimle çelişmeyen bilgi korunur
  assert.equal(kaynakUygula({ tip: "PORTFOY", havuz: "PARTNER", ilanSahibiTipi: "MUTEAHHIT", veriKanali: "WHATSAPP" }, "EMLAK_GRUBU").ilanSahibiTipi, "MUTEAHHIT");
  assert.equal(kaynakUygula({ tip: "PORTFOY", havuz: "DIS_ILAN", ilanSahibiTipi: "EMLAKCI", veriKanali: "EMLAKJET" }, "PORTAL").veriKanali, "EMLAKJET", "portal adı kalır");
  assert.equal(kaynakUygula({ tip: "PORTFOY", havuz: "KENDI_PORTFOY", ilanSahibiTipi: "MALIK", veriKanali: "MANUEL", yetkili: true } as any, "SAHIBINDEN").yetkili, false, "yetki yalnızca kendi portföyde");
  // eski kayıtlar: kanaldan / havuzdan doğru okunur
  assert.equal(kaynakOf({ tip: "PORTFOY", havuz: "KENDI_PORTFOY", ilanSahibiTipi: "MALIK", veriKanali: "SAHIBINDEN" }), "SAHIBINDEN", "Revy satırı (havuz varsayılan) → sahibinden");
  assert.equal(kaynakOf({ tip: "PORTFOY", havuz: "PARTNER", ilanSahibiTipi: "BILINMIYOR", veriKanali: "WHATSAPP" }), "EMLAK_GRUBU");
  assert.equal(kaynakOf({ tip: "TALEP", havuz: "KENDI_PORTFOY", ilanSahibiTipi: "BILINMIYOR", veriKanali: "MANUEL" }), "KENDI");
});

// ───────── 2) Yapıştır incelemesi ─────────
const COKLU = `Kepez Yeni Sanayi'de 500 m2 imalathane kiralık, sanayi elektriği var. 65.000 TL — Burcu 0532 555 01 02
Konyaaltı Liman'da 2+1 satılık daire, 90 m2, 5.450.000 TL — Selim 0532 555 01 03
Muratpaşa Fener'de 140 m2 köşe dükkan kiralık, aylık 120.000 TL — Can 0532 555 01 04
Lara'da satılık arsa — Nur 0532 555 01 05`;

test("yapıştır: süzgeçler (durum · tür · işlem), hazırlar önce, 'Hazır olanların tümünü ekle' sonrası kalanlar listede kalır", async () => {
  const c = ctx(durum());
  let e = await ac(React.createElement(AkilliKutu, { gomulu: true, baslangic: COKLU }), c);
  await e.tikla(e.dugme("Gönder"));
  const t = e.metin();
  assert.match(t, /Gözden geçir ve onayla/);
  for (const d of ["Hepsi (", "Hazır (", "Kontrol gerekli (", "Şemaya uymayan (", "Eklenen / atlanan (", "Portföyler", "Talepler", "Satılık + kiralık", "Satılık", "Kiralık", "Tümünü seç", "Seçilenleri ekle (0)", "Seçilenleri atla"]) assert.ok(e.dugme(d), "düğme: " + d);
  const satirlar = e.qa(".coklu-satir");
  assert.ok(satirlar.length >= 3, "çoklu sonuç: " + satirlar.length);
  const durumlar = satirlar.map((s) => (s.className.match(/d-(\w+)/) ?? [])[1]);
  const ilkDiger = durumlar.findIndex((x) => x !== "hazir");
  assert.ok(durumlar[0] === "hazir" && durumlar.slice(Math.max(ilkDiger, 0)).every((x) => x !== "hazir"), "hazırlar en üstte: " + durumlar.join(","));
  // işlem süzgeci
  await e.tikla(e.dugme(/^Kiralık$/));
  assert.ok(e.qa(".coklu-satir").every((s) => /Kiralık/i.test(s.textContent ?? "")), "yalnızca kiralık");
  await e.tikla(e.dugme("Satılık + kiralık"));
  // her satırda kaynak menüsü; tümüne kaynak
  assert.equal(e.qa(".coklu-satir .kaynak-sec select").length, e.qa(".coklu-satir").filter((s) => !s.classList.contains("soluk")).length);
  const hepsi = e.q('select[aria-label="Hepsinin kaynağı"]') as HTMLSelectElement;
  await e.act(async () => { hepsi.value = "KENDI"; const k = Object.keys(hepsi).find((x) => x.startsWith("__reactProps$"))!; (hepsi as any)[k].onChange({ target: hepsi }); });
  assert.ok(e.qa(".coklu-satir .kaynak-sec select").every((s) => (s as HTMLSelectElement).value === "KENDI"), "hepsi Kendi portföyüm");
  // hazırları ekle → eklenenler "Eklenen / atlanan"a geçer, kalanlar listede
  const hazirD = e.dugme(/^Hazır olanların tümünü ekle \(/)!; const n = Number(hazirD.textContent!.match(/\((\d+)\)/)![1]);
  assert.ok(n >= 1);
  const once = c.d.kayitlar.length;
  await e.tikla(hazirD);
  assert.equal(c.d.kayitlar.length, once + n);
  assert.ok(c.d.kayitlar.slice(0, n).every((k) => kaynakOf(k.veri) === "KENDI"), "seçilen kaynakla eklendi");
  await e.kapat(); e = await ac(React.createElement(AkilliKutu, { gomulu: true, donus: true }), c); // havuz değişti → yeniden çiz (seçimler bellekte)
  const kalan = satirlar.length - n;
  if (kalan > 0) {
    assert.match(e.metin(), /Gözden geçir ve onayla/, "kalan kayıtlar kaybolmadı");
    assert.equal(Number(e.dugme(/^Eklenen \/ atlanan \(/)!.textContent!.match(/\((\d+)\)/)![1]), n);
  }
  await e.kapat();
});

// ───────── 3) Gelen kutusu Veri Girişi sekmesi ─────────
test("Veri Girişi: dört sekme; Gelen kutusu sekmesi gelen kutusunu başlıksız açar", async () => {
  demoGelenSifirla(); gelenDepoKur(null); kutuSifirla();
  const c = ctx(durum());
  const e = await ac(React.createElement(VeriGirisi as React.FC<{ alt?: string }>, { alt: "gelen" }), c);
  const sekmeler = e.qa('[role="tab"]').map((b) => b.textContent!.replace(/\d+/g, "").trim());
  assert.deepEqual(sekmeler, ["Yapıştır", "Dosya yükle", "Gelen kutusu", "Elle gir"]);
  assert.equal(e.q('[role="tab"][aria-selected="true"]')!.textContent!.startsWith("Gelen kutusu"), true);
  assert.ok(e.dugme("E-posta kurulumu"), "gelen kutusu araçları");
  assert.ok(!e.qa("h2").some((h) => h.textContent === "Gelen kutusu"), "ikinci başlık yok");
  await e.kapat(); demoGelenSifirla(); kutuSifirla();
  const app = fs.readFileSync("demo/app.tsx", "utf8");
  assert.ok(!/k: "gelen", etiket: "Gelen Kutusu"/.test(app), "ayrı menü öğesi kalktı");
  assert.match(app, /ekran\.ad === "gelen" && <VeriGirisi key="gelen" alt="gelen" \/>/, "eski bağlantılar sekmeye düşer");
});

// ───────── 4) Eşleşme detayı ─────────
test("eşleşme detayı: kişiler Ara / WhatsApp düğmeleriyle; talepte orijinal metin kısaca", async () => {
  const kayitlar = ornek.kayitlar.map((k) => (k.veri.tip === "TALEP" ? { ...k, veri: { ...k.veri, hamMetin: "Müşterim için Kepez'de kiralık depo arıyorum, en az 800 m², tır girişi şart. Bütçe 90 bin. Acil dönüş rica ederim, teşekkürler. ".repeat(3) } } : k));
  const c = ctx(durum({ kayitlar }));
  function Sar() { const es = useEslesmeler(); const e = es.find((x) => (x.t.veri.kisiler ?? []).length || x.t.veri.gondeTelefon) ?? es[0]; return e ? React.createElement(EslesmeDetay, { tid: e.t.id, pid: e.p.id }) : null; }
  const e = await ac(React.createElement(Sar), c);
  const taraflar = e.qa(".taraf");
  assert.equal(taraflar.length, 2);
  assert.ok(e.qa(".taraf a.ilt.wa").length >= 1, "WhatsApp bağlantısı");
  assert.ok(e.qa(".taraf a.ilt.ara").every((a) => a.getAttribute("href")!.startsWith("tel:")), "Ara bağlantısı");
  assert.ok(!e.qa(".taraf").some((t) => t.tagName === "BUTTON"), "kart artık tek düğme değil (bağlantılar geçerli HTML)");
  const ham = taraflar[0].querySelector(".taraf-ham-metin")!;
  assert.ok(ham && ham.classList.contains("kisa"), "talepte orijinal metin, kısaltılmış");
  assert.ok(!taraflar[1].querySelector(".taraf-ham"), "portföyde gösterilmez");
  await e.tikla(e.dugme("Tamamını göster")); assert.ok(!taraflar[0].querySelector(".taraf-ham-metin")!.classList.contains("kisa"));
  await e.kapat();
});

// ───────── 5) Kurallar: üst satır, fotoğraf, sürüm ─────────
test("üst satır: Geri başlık satırına biner; formda tek geri (Vazgeç) başlıkla aynı satırda", () => {
  const html = fs.readFileSync("demo/sayfa.html", "utf8");
  assert.match(html, /main\.sarici>\.genel-geri\{[^}]*margin:0 0 calc\(-1 \* var\(--geri-y\)\)/);
  assert.match(html, /main\.sarici>\.genel-geri\+\*>:first-child:not\(\.kart\)\{padding-left:var\(--geri-g\)/);
  const app = fs.readFileSync("demo/app.tsx", "utf8");
  assert.match(app, /ctx\.geriVar && ekran\.ad !== "form" &&/);
  assert.match(fs.readFileSync("demo/form.tsx", "utf8"), /<div className="bas-satir"><button className="btn kucuk geri" onClick=\{vazgec\}>← Vazgeç<\/button>/);
});

test("fotoğraf: istemci önce doğrudan yükler (dosya Worker'dan geçmez), olmazsa eski yol; 503 bir kez yinelenir", () => {
  const f = fs.readFileSync("demo/foto.ts", "utf8");
  assert.match(f, /json: \{ ad, en, boy, boyut: blob\.size, tur: "image\/jpeg" \}/);
  assert.match(f, /fetch\(j0\.yukle, \{ method: "PUT", body: blob/);
  assert.match(f, /method: "DELETE" \}\)\.catch/, "yarım künye silinir");
  assert.match(f, /r\.status === 503 \|\| r\.status === 502/);
  const rota = fs.readFileSync("src/app/api/kayit/[id]/fotolar/route.ts", "utf8");
  assert.match(rota, /includes\("application\/json"\)/); assert.match(rota, /yuklemeBaglantisi\(depoYolu\)/);
});

test("Gmail köprüsü: posta kimliğiyle izler (aynı konulu yeni posta da işlenir), arşivler, Drive klasöründen alır", () => {
  const b = gmailKopruBetigi("https://x.workers.dev/api/gelen/al", "abcdefghijkmnpqrstuv");
  assert.match(b, /PropertiesService/); assert.match(b, /moveToArchive\(\)/); assert.match(b, /DriveApp\.getFoldersByName/);
  assert.ok(!/-label:" \+ ETIKET/.test(b), "konuşma etiketiyle dışlama yok");
});

test("sürüm 3.24: günlük kaydı ve belgeler", () => {
  assert.equal(SURUM, "3.24"); assert.equal(SURUM_GECMISI[0].surum, "3.24"); assert.equal(SURUM_GECMISI[1].surum, "3.23");
  assert.match(SURUM_GECMISI[0].baslik, /Gelen Kutusu Veri Girişi/); assert.ok((SURUM_GECMISI[0].testEt ?? []).length >= 4);
  for (const f of [`docs/ANAHTAR_CRM_EK_${DOSYA_EKI}.md`, `docs/ANAHTAR_CRM_DEVIR_${DOSYA_EKI}.md`, `docs/GELEN_KUTUSU_KURULUMU_${DOSYA_EKI}.md`]) assert.ok(fs.existsSync(f), f);
  assert.equal(fs.readdirSync("prisma/migrations").filter((x) => x.startsWith("202610102")).length, 0, "veritabanı değişikliği yok");
});
