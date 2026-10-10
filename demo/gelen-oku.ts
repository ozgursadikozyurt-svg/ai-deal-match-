/**
 * Anahtar CRM v3.24 · 10 Ekim 2026
 * Gelen kutusu — HAM dosyayı tarayıcıda açar: e-posta (.eml) → ekler, .zip → içindeki sohbet / tablo dosyaları,
 * .txt → WhatsApp sohbeti (ya da başlıklı liste), .xlsx / .csv → tablo. Sonuç "parça" listesidir; adaylar demo/gelen-aday.ts'te çıkar.
 * Sunucu dosyayı açmaz (Cloudflare ücretsiz plan: 10 ms işlemci); bu dosya o işi kullanıcının cihazında yapar.
 */
import PostalMime from "postal-mime";
import { unzipSync, strFromU8 } from "fflate";
import { dosyaOku, csvOku, type Sayfa } from "../src/lib/ingest/xlsx";
import { dosyaSatirlari } from "../src/lib/ingest/tablo";
import { grupAdiOf, sohbetiAyristir } from "../src/lib/ingest/whatsapp";
import { gelenTurOf, type GelenTur } from "../src/lib/ingest/gelen";

export type GelenParca =
  | { tur: "SOHBET"; dosya: string; grup: string; icerik: string }
  | { tur: "TABLO"; dosya: string; sayfalar: Sayfa[] };
export interface AcilanDosya { parcalar: GelenParca[]; uyarilar: string[] }

const OKUNUR = /\.(txt|md|xlsx|csv|tsv)$/i;
/** Açılmış hâli bu boyutu geçen tek dosya okunmaz (zip bombası / yanlışlıkla eklenmiş dev dosya) */
const ACIK_SINIR = 60 * 1024 * 1024;
const metinCoz = (v: Uint8Array) => new TextDecoder("utf-8").decode(v).replace(/^﻿/, "");

/** Düz metin: WhatsApp dökümüyse sohbet; değilse ve başlık satırı tanınıyorsa tablo; ikisi de değilse tek mesaj sayılır */
function metniAc(ad: string, icerik: string, grup = grupAdiOf(ad)): GelenParca {
  if (sohbetiAyristir(icerik, ad, grup).length) return { tur: "SOHBET", dosya: ad, grup, icerik };
  const sayfa = csvOku(icerik, ad.replace(/\.[^.]+$/, ""));
  if (dosyaSatirlari([sayfa]).length) return { tur: "TABLO", dosya: ad, sayfalar: [sayfa] };
  return { tur: "SOHBET", dosya: ad, grup, icerik };
}

export async function gelenDosyayiAc(ad: string, tur: GelenTur, veri: Uint8Array, derinlik = 0): Promise<AcilanDosya> {
  const parcalar: GelenParca[] = [], uyarilar: string[] = [];
  try {
    if (tur === "txt") parcalar.push(metniAc(ad, metinCoz(veri)));
    else if (tur === "xlsx" || tur === "csv") parcalar.push({ tur: "TABLO", dosya: ad, sayfalar: dosyaOku(tur === "xlsx" && !/\.xlsx$/i.test(ad) ? ad + ".xlsx" : ad, veri) });
    else if (tur === "zip") {
      let excel = false, atlanan = 0;
      const z = unzipSync(veri, { filter: (f) => { if (f.name === "xl/workbook.xml") excel = true; const al = (OKUNUR.test(f.name) || f.name.startsWith("xl/") || f.name === "[Content_Types].xml") && f.originalSize <= ACIK_SINIR; if (!al && !f.name.endsWith("/")) atlanan++; return al; } });
      if (excel) parcalar.push({ tur: "TABLO", dosya: ad, sayfalar: dosyaOku(ad.replace(/\.zip$/i, "") + ".xlsx", veri) }); // adı .zip olan Excel
      else {
        for (const [ic, bayt] of Object.entries(z)) {
          if (/\.(txt|md)$/i.test(ic)) parcalar.push(metniAc(`${ad} › ${ic}`, strFromU8(bayt).replace(/^﻿/, ""), grupAdiOf(/_chat\.txt$/i.test(ic) ? ad : ic)));
          else if (/\.(xlsx|csv|tsv)$/i.test(ic)) parcalar.push({ tur: "TABLO", dosya: `${ad} › ${ic}`, sayfalar: dosyaOku(ic, bayt) });
        }
        if (!parcalar.length) uyarilar.push(atlanan ? `Zip içinde okunacak sohbet / tablo yok (${atlanan} medya dosyası atlandı)` : "Zip boş");
      }
    } else if (tur === "eml") {
      if (derinlik > 1) return { parcalar, uyarilar: ["İç içe e-posta okunmadı"] };
      const posta = await PostalMime.parse(veri);
      const konu = (posta.subject ?? "").trim();
      let okunmayan = 0;
      for (const ek of posta.attachments ?? []) {
        const bayt = typeof ek.content === "string" ? new TextEncoder().encode(ek.content) : new Uint8Array(ek.content as ArrayBuffer);
        const ekAd = ek.filename || "ek";
        const ekTur = gelenTurOf(ek.filename, bayt.subarray(0, 512), ek.mimeType);
        if (!ekTur || (ek.disposition === "inline" && !ek.filename)) { okunmayan++; continue; }
        const ic = await gelenDosyayiAc(ekAd, ekTur, bayt, derinlik + 1);
        parcalar.push(...ic.parcalar); uyarilar.push(...ic.uyarilar);
      }
      // Eki olmayan posta: gövdeye yapıştırılmış ilan / sohbet metni okunur
      const govde = (posta.text ?? "").trim();
      if (!parcalar.length && govde.length >= 30) parcalar.push(metniAc(`${konu || ad} (e-posta metni)`, govde, konu || "E-posta"));
      if (!parcalar.length) uyarilar.push(okunmayan ? `E-postada okunacak ek yok (${okunmayan} ek desteklenmeyen türde)` : "E-postada ek ya da metin yok");
    }
  } catch (e: any) { uyarilar.push(`Dosya açılamadı: ${String(e?.message ?? e).slice(0, 160)}`); }
  return { parcalar, uyarilar };
}
