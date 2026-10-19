/**
 * Anahtar CRM v3.35 · 19 Ekim 2026
 * v3.35 — veritabanısız: işlem türü tahmini, aylık bana kalan (tahsilat ayı), Polaris dönüşümü, yetkiler, şema / migration, arayüz bağlantıları.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { turTahmini, aylikBanaKalan, polarisDonustur, gunOrtasi } from "../src/lib/domain/islem";
import { yetkiVar } from "../src/lib/guvenlik/yetki";
import { OFIS_MODELLERI } from "../src/lib/kiracilik";
import { IslemSchema } from "../src/lib/services/islem";
import { RandevuSchema } from "../src/lib/services/randevu";
import { KayitCreateSchema } from "../src/lib/validation/kayit";
import { SURUM, SURUM_GECMISI } from "../src/lib/surum";

test("işlem türü başlıktan: satış / kiralama / diğer (Polaris kuralı)", () => {
  assert.equal(turTahmini("Dükkan Satış  Şarampol"), "SATIS");
  assert.equal(turTahmini("SATIŞ Daire Işıklar"), "SATIS");
  assert.equal(turTahmini("Lego Kiralık  İrfan"), "KIRALAMA");
  assert.equal(turTahmini("Kiralama Devrilik Antepia"), "KIRALAMA");
  assert.equal(turTahmini("Danışmanlık ücreti"), "DIGER");
  assert.equal(turTahmini(null), "DIGER");
});

test("aylık bana kalan: tahsilat ayına yazılır, tahsilatsız 'bekleyen', başka yıl sayılmaz", () => {
  const o = aylikBanaKalan([
    { tahsilatTarihi: "2026-01-15", banaKalan: 75000 },
    { tahsilatTarihi: "2026-01-30T12:00:00.000Z", banaKalan: "70000" },
    { tahsilatTarihi: new Date("2026-05-22T12:00:00Z"), banaKalan: 40000 },
    { tahsilatTarihi: null, banaKalan: 32000 },
    { tahsilatTarihi: "2025-12-30", banaKalan: 160000 },
    { tahsilatTarihi: "2026-03-01", banaKalan: null },
  ], 2026);
  assert.equal(o.aylar[0], 145000); assert.equal(o.aylar[4], 40000); assert.equal(o.toplam, 185000); assert.equal(o.bekleyen, 32000);
});

test("Polaris satırı → Anahtar işlemi: tahsilat = işlem tarihi (gün ortası), reklam → REKLAM, silinmiş / tarihsiz atlanır", () => {
  const x = polarisDonustur({ tarih: "2026-05-22", ay: 5, liste: "Kiralama Devrilik Antepia Mustafa", banaKalan: 40000, fiyat: null, paylasimli: 50000, ofise: 10000, aciklama: "KDVLİ FATURA KESİLDİ", reklam: null }, "e14")!;
  assert.equal(x.tarih, "2026-05-22T12:00:00.000Z"); assert.equal(x.tahsilatTarihi, x.tarih);
  assert.equal(x.tur, "KIRALAMA"); assert.equal(x.banaKalan, 40000); assert.equal(x.paylasilan, 50000); assert.equal(x.ofisPayi, 10000); assert.equal(x.bedel, null);
  assert.equal(x.reklam, false); assert.equal(x.talepKaynagi, null); assert.equal(x.disKaynak, "POLARIS"); assert.equal(x.disKimlik, "e14");
  const r = polarisDonustur({ tarih: "2025-12-30", liste: "Dükkan Satış", banaKalan: 160000, reklam: "EVET" }, "2025-47")!;
  assert.equal(r.reklam, true); assert.equal(r.talepKaynagi, "REKLAM"); assert.equal(r.tur, "SATIS");
  assert.equal(polarisDonustur({ tarih: "2024-03-01", liste: "Kira", aciklama: 15000 as any }, "s")!.aciklama, "15000", "Excel'den gelen sayı açıklama metne çevrilir");
  assert.equal(polarisDonustur({ tarih: "2026-01-01", silindi: true }, "x"), null);
  assert.equal(polarisDonustur({ tarih: null, liste: "a" }, "y"), null);
  assert.equal(gunOrtasi("2026-10-19"), "2026-10-19T12:00:00.000Z");
});

test("yetki: işlemi yalnızca ofis yöneticisi görür; randevuyu asistan da açar", () => {
  assert.ok(yetkiVar("OFIS_YONETICISI", "islem.yonet"));
  assert.ok(!yetkiVar("DANISMAN", "islem.yonet"));
  assert.ok(!yetkiVar("ASISTAN", "islem.yonet"));
  assert.ok(yetkiVar("ASISTAN", "kayit.yaz"));
  assert.ok(OFIS_MODELLERI.has("randevu") && OFIS_MODELLERI.has("islem"));
});

test("doğrulama: işlem, randevu ve portföyün yetki belgesi alanları", () => {
  assert.equal(IslemSchema.parse({ tarih: "2026-10-19", baslik: "Kepez depo kiralama", banaKalan: 120000 }).tur, "DIGER");
  assert.throws(() => IslemSchema.parse({ tarih: "19.10.2026", baslik: "x x" }));
  assert.throws(() => IslemSchema.parse({ tarih: "2026-10-19", baslik: "x" }));
  assert.equal(RandevuSchema.parse({ tarih: "2026-10-20T08:00:00Z", talepId: "T1" }).sonuc, "PLANLANDI");
  assert.throws(() => RandevuSchema.parse({ tarih: "2026-10-20", sonuc: "OLDU" }));
  const k: any = KayitCreateSchema.parse({ tip: "PORTFOY", mulkTipi: "DEPO_ANTREPO", islemTipi: "KIRALIK", fiyat: 100000, fiyatPeriyodu: "AYLIK", yetkili: true, yetkiBelgeNo: " 2026/145 ", tasinmazNo: "123456789" });
  assert.equal(k.yetkiBelgeNo, "2026/145"); assert.equal(k.tasinmazNo, "123456789");
});

test("şema ve migration: randevu, islem tabloları; kayit'a iki sütun; yalnızca ekleme, RLS açık", () => {
  const m = readFileSync("prisma/migrations/20261019180000_v335_yetki_randevu_islem/migration.sql", "utf8");
  assert.match(m, /ADD COLUMN "yetkiBelgeNo"/); assert.match(m, /ADD COLUMN "tasinmazNo"/);
  assert.match(m, /ALTER TABLE "randevu" ENABLE ROW LEVEL SECURITY/); assert.match(m, /ALTER TABLE "islem" ENABLE ROW LEVEL SECURITY/);
  assert.ok(!/DROP |DELETE FROM|TRUNCATE/i.test(m));
  const s = readFileSync("prisma/schema.prisma", "utf8");
  assert.match(s, /model Islem \{[\s\S]*@@unique\(\[ofisId, disKaynak, disKimlik\]\)/);
});

test("arayüz: formda açılıp kapanan Yetki belgesi bölümü, detayda randevu kartı, Ayarlar'da İşlemler", () => {
  const f = readFileSync("demo/form.tsx", "utf8");
  assert.match(f, /<details className="alan genis yetki-bolum"/); assert.match(f, /f-tasinmaz/); assert.match(f, /f-yetki-no/);
  const a = readFileSync("demo/app.tsx", "utf8");
  assert.match(a, /<RandevuKarti /); assert.match(a, /yetkiAktif\("islem\.yonet"\)/); assert.match(a, /ekran\.ad === "islemler" && <IslemlerEkrani \/>/);
});

test("sürüm 3.35", () => {
  const i = SURUM_GECMISI.findIndex((k) => k.surum === "3.35"); // v3.36 öne eklendi
  assert.ok(SURUM >= "3.35" && i >= 0); assert.equal(SURUM_GECMISI[i + 1].surum, "3.34");
  assert.ok((SURUM_GECMISI[i].testEt ?? []).length >= 3);
  assert.ok(existsSync("docs/ANAHTAR_CRM_EK_v3.35_19Ekim2026.md"));
});
