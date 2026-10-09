// Anahtar CRM v3.22.1 · 9 Ekim 2026
import fs from "node:fs";
import { ornekVeriyiKur } from "../demo/depo";
const o = ornekVeriyiKur();
// Demo yedeğinin biçimi (disa-aktar.tsx): { surum, tarih, kayitlar, kisiler, eslesmeNotlari, ayarlar }; kimlikler çakışmasın diye önek eklenir
const on = (id: string) => "Y" + id;
const yedek = {
  surum: "3.13", tarih: "2026-10-03",
  kisiler: o.kisiler.map((k) => ({ ...k, id: on(k.id), })),
  kayitlar: o.kayitlar.map((k) => ({ ...k, id: on(k.id), veri: { ...k.veri, kisiler: ((k.veri as any).kisiler ?? []).map((b: any) => ({ ...b, kisiId: on(b.kisiId) })) } })),
  eslesmeNotlari: {}, ayarlar: {},
};
fs.writeFileSync("/tmp/demo-yedek.json", JSON.stringify(yedek));
console.log("yedek:", yedek.kayitlar.length, "kayıt,", yedek.kisiler.length, "kişi");
