/**
 * Anahtar CRM v3.23 · 10 Ekim 2026
 * Bağlantı anahtarlarının (Google yenileme anahtarı) veritabanında şifreli saklanması — AES-256-GCM.
 * Anahtar: ENTEGRASYON_SIFRE_ANAHTARI (32 bayt, base64; `openssl rand -base64 32`). v3.21: tanımlı değilse
 * SUPABASE_SERVICE_ROLE_KEY (yoksa DATABASE_URL) üzerinden türetilir — ayrı bir değişken girmek zorunlu değildir.
 * Biçim: "v1:<iv b64>:<etiket b64>:<şifreli b64>"
 */
import { createCipheriv, createDecipheriv, randomBytes, createHmac, createHash, timingSafeEqual } from "node:crypto";

function anahtar(ham = process.env.ENTEGRASYON_SIFRE_ANAHTARI): Buffer {
  if (ham) {
    const k = Buffer.from(ham, "base64");
    if (k.length !== 32) throw new Error("ENTEGRASYON_SIFRE_ANAHTARI 32 bayt (base64) olmalı");
    return k;
  }
  // v3.21 — kurulumu kolaylaştırmak için: ENTEGRASYON_SIFRE_ANAHTARI verilmediyse anahtar, zaten gizli olan
  // sunucu değerlerinden türetilir (ek bir değişken girmek gerekmez). Bu değerler değişirse saklı Google
  // anahtarı çözülemez; kullanıcı "Google ile bağlan"a yeniden basar (veri kaybı olmaz).
  const tohum = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.DATABASE_URL;
  if (!tohum) throw new Error("Şifreleme anahtarı üretilemedi: ENTEGRASYON_SIFRE_ANAHTARI ya da SUPABASE_SERVICE_ROLE_KEY tanımlı olmalı");
  return createHash("sha256").update("anahtarcrm-entegrasyon-v1:" + tohum).digest();
}

export function sifrele(metin: string, ham?: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", anahtar(ham), iv);
  const s = Buffer.concat([c.update(metin, "utf8"), c.final()]);
  return ["v1", iv.toString("base64"), c.getAuthTag().toString("base64"), s.toString("base64")].join(":");
}

export function coz(paket: string, ham?: string): string {
  const [v, iv, etiket, s] = paket.split(":");
  if (v !== "v1" || !iv || !etiket || !s) throw new Error("Şifreli değer biçimi tanınmadı");
  const d = createDecipheriv("aes-256-gcm", anahtar(ham), Buffer.from(iv, "base64"));
  d.setAuthTag(Buffer.from(etiket, "base64"));
  return Buffer.concat([d.update(Buffer.from(s, "base64")), d.final()]).toString("utf8");
}

/** OAuth `state` parametresi: kısa ömürlü, imzalı (CSRF koruması) */
export function durumImzala(veri: Record<string, unknown>, ham?: string, simdi = Date.now()): string {
  const govde = Buffer.from(JSON.stringify({ ...veri, t: simdi })).toString("base64url");
  const imza = createHmac("sha256", anahtar(ham)).update(govde).digest("base64url");
  return `${govde}.${imza}`;
}
export function durumDogrula<T = Record<string, unknown>>(durum: string, ham?: string, maxYasMs = 15 * 60_000, simdi = Date.now()): T {
  const [govde, imza] = durum.split(".");
  if (!govde || !imza) throw new Error("Geçersiz state");
  const beklenen = createHmac("sha256", anahtar(ham)).update(govde).digest();
  const gelen = Buffer.from(imza, "base64url");
  if (gelen.length !== beklenen.length || !timingSafeEqual(gelen, beklenen)) throw new Error("State imzası tutmuyor");
  const v = JSON.parse(Buffer.from(govde, "base64url").toString("utf8"));
  if (typeof v.t !== "number" || simdi - v.t > maxYasMs) throw new Error("State süresi dolmuş");
  return v as T;
}