/**
 * Anahtar CRM v3.41 · 23 Ekim 2026
 * v3.32 — veritabanısız: ilk kaynak tahmini ve kilidi, ilk yanıt, asistan rolünün yetkileri ve görünürlük süzgeci.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { ilkKaynakKarari, ilkYanitKarari, tahminIlkKaynak, yanitDakika, ILK_KAYNAKLAR, ILK_KAYNAK_ETIKET, KAYNAK_GRUBU } from "../src/lib/domain/ilk-kaynak";
import { YETKILER, ROL_ETIKETLERI, yetkiVar } from "../src/lib/guvenlik/yetki";
import { gorunurlukSuzgeci, cagriyiDonustur } from "../src/lib/kiracilik";
import { KayitCreateSchema } from "../src/lib/validation/kayit";
import { readFileSync } from "node:fs";

const S = new Date("2026-10-18T09:00:00Z");

test("ilk kaynak: her kodun etiketi ve rapor grubu var", () => {
  for (const k of ILK_KAYNAKLAR) { assert.ok(ILK_KAYNAK_ETIKET[k], k); assert.ok(KAYNAK_GRUBU[k], k); }
  assert.equal(KAYNAK_GRUBU.META_REKLAM, "REKLAM"); assert.equal(KAYNAK_GRUBU.FSBO_ARAMA, "TELEFON");
});

test("ilk kaynak tahmini: müşteri kaynağı → kanal → havuz; emin değilse boş", () => {
  assert.equal(tahminIlkKaynak({ musteriKaynagi: "REKLAM" }), "REKLAM");
  assert.equal(tahminIlkKaynak({ musteriKaynagi: "REFERANS" }), "REFERANS");
  assert.equal(tahminIlkKaynak({ musteriKaynagi: "WHATSAPP_GRUBU" }), "EMLAK_GRUBU");
  assert.equal(tahminIlkKaynak({ havuz: "DIS_ILAN", ilanSahibiTipi: "MALIK" }), "SAHIBINDEN");
  assert.equal(tahminIlkKaynak({ veriKanali: "HEPSIEMLAK", ilanSahibiTipi: "EMLAKCI" }), "PORTAL");
  assert.equal(tahminIlkKaynak({ veriKanali: "WHATSAPP", ilanSahibiTipi: "EMLAKCI" }), "EMLAK_GRUBU");
  assert.equal(tahminIlkKaynak({ veriKanali: "MANUEL", ilanSahibiTipi: "MALIK", havuz: "KENDI_PORTFOY" }), null, "kendi müşterim: tahmin yok, bir kez doldurulur");
});

test("ilk kaynak kilidi: yeni kayıtta seçim ya da tahmin + zaman; istemcinin gönderdiği zaman yok sayılır", () => {
  const y = ilkKaynakKarari(null, { ilkKaynak: "META_REKLAM", ilkKaynakDetay: " Meta – Depo Ekim ", ilkKaynakTarihi: new Date("2020-01-01") }, false, S);
  assert.deepEqual(y.yaz, { ilkKaynak: "META_REKLAM", ilkKaynakDetay: "Meta – Depo Ekim", ilkKaynakTarihi: S });
  const t = ilkKaynakKarari(null, { musteriKaynagi: "REFERANS" }, false, S, new Date("2026-10-10T08:00:00Z"));
  assert.equal(t.yaz.ilkKaynak, "REFERANS"); assert.equal(t.yaz.ilkKaynakTarihi?.toISOString(), "2026-10-10T08:00:00.000Z", "içe aktarmada oluşturma anı");
  const ileri = ilkKaynakKarari(null, {}, false, S, new Date("2030-01-01"));
  assert.equal(ileri.yaz.ilkKaynakTarihi, S, "gelecek tarih kabul edilmez");
});

test("ilk kaynak kilidi: doluysa asistan / danışman değiştiremez (uyarı), boşsa bir kez doldurur, yönetici değiştirir ve kayda geçer", () => {
  const eski = { ilkKaynak: "GOOGLE_REKLAM", ilkKaynakDetay: null, ilkKaynakTarihi: new Date("2026-10-01") };
  const red = ilkKaynakKarari(eski, { ilkKaynak: "REFERANS" }, false, S);
  assert.equal(red.yaz.ilkKaynak, "GOOGLE_REKLAM"); assert.ok(red.uyari); assert.deepEqual(red.degisiklikler, []);
  const silme = ilkKaynakKarari(eski, { ilkKaynak: null }, false, S);
  assert.equal(silme.yaz.ilkKaynak, "GOOGLE_REKLAM", "boşaltılarak da değiştirilemez"); assert.ok(silme.uyari);
  const ayni = ilkKaynakKarari(eski, { ilkKaynak: "GOOGLE_REKLAM", ilkKaynakDetay: null }, false, S);
  assert.equal(ayni.uyari, undefined, "aynı değer uyarı vermez");
  const yok = ilkKaynakKarari(eski, {}, false, S);
  assert.equal(yok.yaz.ilkKaynak, "GOOGLE_REKLAM", "alan gönderilmediyse dokunulmaz"); assert.equal(yok.uyari, undefined);
  const bozuk = ilkKaynakKarari(eski, { ilkKaynak: "UYDURMA" }, false, S);
  assert.equal(bozuk.yaz.ilkKaynak, "GOOGLE_REKLAM"); assert.equal(bozuk.uyari, undefined, "geçersiz kod gönderilmemiş sayılır");
  const ilkDoldurma = ilkKaynakKarari({ ilkKaynak: null, ilkKaynakDetay: null, ilkKaynakTarihi: null }, { ilkKaynak: "FSBO_ARAMA", ilkKaynakDetay: "Aksu listesi" }, false, S);
  assert.deepEqual(ilkDoldurma.yaz, { ilkKaynak: "FSBO_ARAMA", ilkKaynakDetay: "Aksu listesi", ilkKaynakTarihi: S }); assert.equal(ilkDoldurma.uyari, undefined);
  const yonetici = ilkKaynakKarari(eski, { ilkKaynak: "META_REKLAM" }, true, S);
  assert.equal(yonetici.yaz.ilkKaynak, "META_REKLAM"); assert.deepEqual(yonetici.degisiklikler, [{ alan: "ilkKaynak", eski: "GOOGLE_REKLAM", yeni: "META_REKLAM" }]);
  assert.equal(yonetici.yaz.ilkKaynakTarihi?.toISOString(), eski.ilkKaynakTarihi.toISOString(), "zaman yöneticide de değişmez");
});

test("ilk yanıt: ilk temas notunda bir kez yazılır, NOT türü sayılmaz; süre dakika", () => {
  assert.equal(ilkYanitKarari(null, ["NOT"], S), null);
  assert.equal(ilkYanitKarari(null, ["NOT", "ARAMA"], S), S);
  const once = new Date("2026-10-17T10:00:00Z");
  assert.equal(ilkYanitKarari(once, ["WHATSAPP"], S), once);
  assert.equal(yanitDakika("2026-10-18T09:00:00Z", "2026-10-18T09:12:30Z"), 13);
  assert.equal(yanitDakika(null, S), null);
});

test("doğrulama: ilk kaynak alanları şemada; geçersiz kod reddedilir", () => {
  const temel = { tip: "TALEP", mulkTipi: "DEPO_ANTREPO", islemTipi: "KIRALIK" };
  assert.ok(KayitCreateSchema.safeParse({ ...temel, ilkKaynak: "META_REKLAM", ilkKaynakDetay: "x" }).success);
  assert.ok(!KayitCreateSchema.safeParse({ ...temel, ilkKaynak: "UYDURMA" }).success);
});

test("asistan rolü: günlük işi yapar; silemez, dışa aktaramaz, ayar ve ilk kaynak değiştiremez", () => {
  assert.equal(ROL_ETIKETLERI.ASISTAN, "Asistan");
  for (const y of ["kayit.oku", "kayit.yaz", "kisi.yaz", "eslesme.yaz", "ai.kullan", "foto.yukle"] as const) assert.ok(yetkiVar("ASISTAN", y), y);
  for (const y of ["kayit.sil", "kayit.disaAktar", "ofis.ayarlar", "ofis.kullanicilar", "kaynak.duzelt", "ofis.disaAktar"] as const) assert.ok(!yetkiVar("ASISTAN", y), y);
  assert.ok(yetkiVar("DANISMAN", "kayit.sil") && yetkiVar("DANISMAN", "kayit.disaAktar"), "danışmanın eski yetkileri korunur");
  assert.ok(!yetkiVar("DANISMAN", "kaynak.duzelt"), "ilk kaynağı danışman da değiştiremez");
  assert.ok(yetkiVar("OFIS_YONETICISI", "kaynak.duzelt") && yetkiVar("PLATFORM_YONETICISI", "kaynak.duzelt"));
  assert.ok(YETKILER.ASISTAN.length < YETKILER.DANISMAN.length);
});

test("görünürlük: asistan ofis ortak + kendi + yardım ettiği kişinin özel kayıtlarını görür; atanmamışsa danışman gibi", () => {
  const b = { ofisId: "o1", kullaniciId: "asist", rol: "ASISTAN" as const, eposta: "a@x", yardimEdilenId: "ozgur" };
  assert.deepEqual(gorunurlukSuzgeci(b, "kisi"), { OR: [{ gorunurluk: "OFIS" }, { sahipKullaniciId: { in: ["asist", "ozgur"] } }] });
  assert.deepEqual(gorunurlukSuzgeci({ ...b, yardimEdilenId: null }, "kayit"), { OR: [{ gorunurluk: "OFIS" }, { sahipKullaniciId: "asist" }] });
  assert.equal(gorunurlukSuzgeci(b, "match"), undefined);
  const d = cagriyiDonustur("kisi", "findMany", {}, b);
  assert.deepEqual(d.args.where, { AND: [{ ofisId: "o1" }, { OR: [{ gorunurluk: "OFIS" }, { sahipKullaniciId: { in: ["asist", "ozgur"] } }] }] });
});

test("migration v3.32: rol, yardım bağı, ilk kaynak sütunları ve geriye dönük doldurma tahmin kuralıyla aynı", () => {
  const sql = readFileSync("prisma/migrations/20261018100000_v332_asistan_ilk_kaynak/migration.sql", "utf8");
  assert.match(sql, /ADD VALUE IF NOT EXISTS 'ASISTAN'/);
  for (const c of ["yardimEdilenId", "ilkKaynak", "ilkKaynakDetay", "ilkKaynakTarihi", "ilkYanit"]) assert.ok(sql.includes(`"${c}"`), c);
  for (const k of ["REKLAM", "REFERANS", "SAHA", "EMLAK_GRUBU", "SAHIBINDEN", "PORTAL", "DIGER"]) assert.ok(sql.includes(`'${k}'`), k);
  assert.ok(!/DROP|DELETE FROM/i.test(sql), "yalnızca ekleme ve doldurma");
});

test("arayüz: asistan kilitli ilk kaynağı yalnızca görür; yönetici seçiciyi görür; detayda ilk yanıt süresi", async () => {
  const React = (await import("react")).default;
  const { ac } = await import("./yardimci-arayuz");
  const { IlkKaynakAlani, IlkKaynakSatirlari } = await import("../demo/ilk-kaynak");
  const { DEMO_YONETIM } = await import("../demo/yonetim");
  const eski = DEMO_YONETIM.rol;
  const f = { tip: "TALEP", ilkKaynak: "META_REKLAM", ilkKaynakDetay: "Meta – Depo Ekim" };
  try {
    DEMO_YONETIM.rol = "ASISTAN";
    let u = await ac(React.createElement(IlkKaynakAlani, { f, set: () => {}, kayitliDeger: { ilkKaynak: "META_REKLAM", ilkKaynakTarihi: "2026-10-18T09:00:00Z" } }));
    assert.ok(u.metin().includes("🔒")); assert.ok(u.metin().includes("Meta reklamı")); assert.equal(u.q("#f-ilk-kaynak"), null, "asistanda seçici yok");
    await u.kapat();
    u = await ac(React.createElement(IlkKaynakAlani, { f: { tip: "TALEP" }, set: () => {}, kayitliDeger: undefined }));
    assert.ok(u.q("#f-ilk-kaynak"), "yeni kayıtta asistan da seçer"); await u.kapat();
    DEMO_YONETIM.rol = "PLATFORM_YONETICISI";
    u = await ac(React.createElement(IlkKaynakAlani, { f, set: () => {}, kayitliDeger: { ilkKaynak: "META_REKLAM" } }));
    assert.ok(u.q("#f-ilk-kaynak"), "yönetici düzeltebilir"); assert.ok(u.metin().includes("düzeltme kayda geçer")); await u.kapat();
    u = await ac(React.createElement("div", { className: "izgara" }, React.createElement(IlkKaynakSatirlari, { v: { ilkKaynak: "META_REKLAM", ilkKaynakTarihi: "2026-10-18T09:00:00Z", ilkYanit: "2026-10-18T09:12:00Z" } })));
    assert.ok(u.metin().includes("12 dk")); await u.kapat();
  } finally { DEMO_YONETIM.rol = eski; }
});

test("sürüm 3.32 ve ek belge", async () => {
  const { SURUM, SURUM_GECMISI } = await import("../src/lib/surum");
  assert.ok(SURUM >= "3.32"); const k332 = SURUM_GECMISI.find((x) => x.surum === "3.32")!; assert.ok((k332.testEt ?? []).length >= 3); /* v3.33den beri en üstte değil */
  assert.ok(readFileSync("docs/ANAHTAR_CRM_EK_v3.32_18Ekim2026.md", "utf8").includes("kaynak.duzelt"));
});
