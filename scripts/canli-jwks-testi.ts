/**
 * Anahtar CRM v3.21.2 · 8 Ekim 2026
 * Supabase'in yeni (asimetrik, ES256 / JWKS) oturum anahtarlarıyla giriş kapısı sınaması. Sahte depo sunucusu JWKS yayınlar.
 */
import { SignJWT, generateKeyPair, exportJWK } from "jose";
import { kimlikDogrula } from "../src/canli/kimlik";
const T = "http://localhost:8799", D = "http://127.0.0.1:9001";
let g = 0, k = 0; const tamam = (a: string, ok: boolean, d = "") => { ok ? g++ : k++; console.log(`${ok ? "✔" : "✘"} ${a}${d ? " — " + d : ""}`); };
(async () => {
  const dogru = await generateKeyPair("ES256"), yabanci = await generateKeyPair("ES256");
  await fetch(D + "/__jwks", { method: "POST", body: JSON.stringify({ keys: [{ ...(await exportJWK(dogru.publicKey)), kid: "k1", alg: "ES256", use: "sig" }] }) });
  const imza = (anahtar: any, { eposta = "ozgur@test.com", iss = D + "/auth/v1", aud = "authenticated", sure = "1h", kid = "k1" } = {}) =>
    new SignJWT({ email: eposta }).setProtectedHeader({ alg: "ES256", kid }).setIssuer(iss).setAudience(aud).setExpirationTime(sure).sign(anahtar);
  const durum = async (t: string) => (await fetch(T + "/api/saglik")).ok ? (await fetch(T + "/api/durum", { headers: { authorization: `Bearer ${t}` } })).status : 0;
  tamam("ES256 + JWKS: geçerli oturum, izinli e-posta → 200", (await durum(await imza(dogru.privateKey))) === 200);
  tamam("ES256: izinsiz e-posta → 403", (await durum(await imza(dogru.privateKey, { eposta: "baskasi@test.com" }))) === 403);
  tamam("ES256: başka anahtarla imzalı sahte oturum → 401", (await durum(await imza(yabanci.privateKey))) === 401);
  tamam("ES256: yanlış yayıncı (issuer) → 401", (await durum(await imza(dogru.privateKey, { iss: "https://baska.supabase.co/auth/v1" }))) === 401);
  tamam("ES256: yanlış hedef kitle (aud) → 401", (await durum(await imza(dogru.privateKey, { aud: "anon" }))) === 401);
  tamam("ES256: süresi dolmuş oturum → 401", (await durum(await imza(dogru.privateKey, { sure: "-10s" }))) === 401);
  tamam("ES256: bilinmeyen kid → 401", (await durum(await imza(dogru.privateKey, { kid: "yok" }))) === 401);
  // eski tür (HS256) oturum anahtarı: sır tanımlı değilse ne yapılacağı söylenir; tanımlıysa doğrulanır
  const hs = await new SignJWT({ email: "ozgur@test.com" }).setProtectedHeader({ alg: "HS256" }).setAudience("authenticated").setExpirationTime("1h").sign(new TextEncoder().encode("x".repeat(40)));
  const req = new Request("http://x/api/durum", { headers: { authorization: `Bearer ${hs}` } });
  const a: any = await kimlikDogrula(req, { SUPABASE_URL: D, IZINLI_EPOSTALAR: "ozgur@test.com" });
  tamam("HS256 oturum + sır yok: 401 ve ne yapılacağı yazılı", a.durum === 401 && /SUPABASE_JWT_SECRET/.test(a.hata));
  const b: any = await kimlikDogrula(req, { SUPABASE_URL: D, IZINLI_EPOSTALAR: "ozgur@test.com", SUPABASE_JWT_SECRET: "x".repeat(40) });
  tamam("HS256 oturum + doğru sır → kabul", b.eposta === "ozgur@test.com");
  const c: any = await kimlikDogrula(req, { SUPABASE_URL: D, IZINLI_EPOSTALAR: "ozgur@test.com", SUPABASE_JWT_SECRET: "y".repeat(40) });
  tamam("HS256 oturum + yanlış sır → 401", c.durum === 401);
  console.log(`\n${g} geçti, ${k} kaldı`); process.exit(k ? 1 : 0);
})().catch((e) => { console.error("BETİK HATASI:", e); process.exit(2); });
