/**
 * Anahtar CRM v3.23 · 10 Ekim 2026
 * v3.4 — veritabanısız testler: geçerlilik süresi (satılık/kiralık), tekrar yükleme koruması,
 * portal arama bağlantıları, kayıt ↔ kişi doğrulaması, demo filtreleri.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { ttlGun, ttlNormalize, TTL_VARSAYILAN } from "../src/lib/domain/gecerlilik";
import { sohbetiAyristir, onFiltre, dosyaParmakIzi, metinParmakIzi } from "../src/lib/ingest/whatsapp";
import { portalLinkleri } from "../src/lib/portal/arama-linkleri";
import { KayitCreateSchema } from "../src/lib/validation/kayit";
import { ORNEK_SOHBETLER } from "../demo/ornek-sohbetler";
import { ornekVeriyiKur } from "../demo/depo";
import { SADECE_TEST_baglamiSabitle, VARSAYILAN_OFIS_ID, VARSAYILAN_KULLANICI_ID } from "../src/lib/kiracilik";
// v3.20 — çok ofisli: testler varsayılan ofisin bağlamında çalışır (göçte açılan Özyurtlar Gayrimenkul)
SADECE_TEST_baglamiSabitle({ ofisId: VARSAYILAN_OFIS_ID, kullaniciId: VARSAYILAN_KULLANICI_ID, rol: "OFIS_YONETICISI", eposta: "test@anahtar.local" });


test("Geçerlilik: kiralık kısa, satılık uzun; acil talep üst sınırı; eski ayar biçimi çevrilir", () => {
  assert.equal(ttlGun("PORTFOY", "SATILIK", null), 90);
  assert.equal(ttlGun("PORTFOY", "KIRALIK", null), 45);
  assert.equal(ttlGun("TALEP", "DEVREN_KIRALIK", null), 30);
  assert.equal(ttlGun("TALEP", "SATILIK", "ACIL"), 30);
  assert.deepEqual(ttlNormalize({ PORTFOY: 120, TALEP: 50, TALEP_ACIL: 20 }), { ...TTL_VARSAYILAN, PORTFOY_SATILIK: 120, TALEP_SATILIK: 50, TALEP_ACIL: 20 });
});

test("Tekrar yükleme: aynı dosyanın parmak izi aynı; işlenmiş mesajlar ve kayıtlı ilanlar ONCEKI olur", () => {
  const s = ORNEK_SOHBETLER[0];
  assert.equal(dosyaParmakIzi(s.icerik), dosyaParmakIzi(s.icerik.replace(/\n/g, "\r\n")));
  const m = sohbetiAyristir(s.icerik, s.dosya);
  const ilk = onFiltre(m);
  const aday = ilk.mesajlar.filter((x) => x.durum === "ADAY");
  const ikinci = onFiltre(m, { oncedenIslenmis: new Set(aday.slice(0, 3).map((x) => metinParmakIzi(x.metin))), kayitliMetinler: new Set([metinParmakIzi(aday[3].metin)]) });
  assert.equal(ikinci.mesajlar.filter((x) => x.durum === "ONCEKI").length, 4);
  assert.equal(ikinci.gruplar[0].onceki, 4);
});

test("Portal bağlantıları: gözlenen adres kalıpları", () => {
  const l = portalLinkleri({ aileKodu: "DUKKAN", islemTipi: "KIRALIK", ilceler: ["Muratpaşa"], maxFiyat: 160000 });
  assert.equal(l.find((x) => x.portal === "Sahibinden")!.url, "https://www.sahibinden.com/kiralik-is-yeri-dukkan-magaza/antalya-muratpasa?price_max=160000");
  assert.equal(l.find((x) => x.portal === "Emlakjet")!.url, "https://www.emlakjet.com/kiralik-isyeri/antalya-muratpasa");
  assert.equal(l.find((x) => x.portal === "Hepsiemlak")!.url, "https://www.hepsiemlak.com/muratpasa-kiralik/dukkan-magaza");
});

test("Kayıt birden fazla kişiye rolle bağlanabilir; geçersiz rol reddedilir", () => {
  const ok = KayitCreateSchema.safeParse({ tip: "PORTFOY", mulkTipi: "DAIRE", islemTipi: "SATILIK", kisiler: [{ kisiId: "K1", rol: "SAHIP" }, { kisiId: "K2", rol: "EMLAKCI" }] });
  assert.ok(ok.success);
  assert.equal(KayitCreateSchema.safeParse({ tip: "PORTFOY", mulkTipi: "DAIRE", islemTipi: "SATILIK", kisiler: [{ kisiId: "K1", rol: "PATRON" }] }).success, false);
});

test("Demo örnek veri: gönderenler Kişiler'e telefonla tekil eklenir ve kayda bağlanır", () => {
  const { kayitlar, kisiler } = ornekVeriyiKur();
  assert.ok(kisiler.length >= 20);
  assert.equal(new Set(kisiler.map((k) => k.telefon)).size, kisiler.length);
  assert.ok(kayitlar.every((k) => (k.veri.kisiler ?? []).length === 1));
  const emlakci = kayitlar.find((k) => k.id === "P2")!;
  assert.equal(emlakci.veri.kisiler[0].rol, "EMLAKCI");
});