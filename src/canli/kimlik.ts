/**
 * Anahtar CRM v3.21.1 · 8 Ekim 2026
 * Canlı API'nin kapısı — İKİ ADIM:
 *   1. kimlikDogrula: Supabase oturum anahtarı (JWT) doğrulanır → e-posta. Veritabanı gerekmez.
 *      Supabase'in yeni projelerdeki asimetrik anahtarları (JWKS) ve eski HS256 sırrı desteklenir.
 *   2. src/canli/oturum.ts → oturumCoz: e-posta `kullanici` tablosunda aranır → ofis + rol.
 *
 * v3.20'de değişen: e-posta izin listesi (IZINLI_EPOSTALAR) buradan kalktı, veritabanına taşındı.
 * Ortam değişkeni yalnızca acil durum anahtarı olarak oturum.ts'te kullanılır.
 */
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";

const jwksOnbellek = new Map<string, ReturnType<typeof createRemoteJWKSet>>();
export interface KimlikEnv { SUPABASE_URL?: string; SUPABASE_JWT_SECRET?: string; IZINLI_EPOSTALAR?: string }

/** Geriye dönük uyumluluk: eski testler ve acil durum anahtarı için ortam listesi denetimi */
export function izinliMi(eposta: string | undefined, liste?: string) {
  const izin = (liste ?? "").split(",").map((x) => x.trim().toLowerCase()).filter(Boolean);
  return !!eposta && izin.includes(eposta.toLowerCase());
}

export async function kimlikDogrula(req: Request, env: KimlikEnv): Promise<{ eposta: string } | { hata: string; durum: number }> {
  const t = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!t) return { hata: "Giriş gerekli", durum: 401 };
  let p: JWTPayload;
  try {
    const alg = (() => { try { return JSON.parse(atob(t.split(".")[0].replace(/-/g, "+").replace(/_/g, "/"))).alg as string; } catch { return ""; } })();
    if (alg === "HS256" && !env.SUPABASE_JWT_SECRET) return { hata: "Oturum anahtarı eski türde (HS256): Cloudflare › Variables and Secrets'a SUPABASE_JWT_SECRET ekleyin (Supabase › Project Settings › JWT Keys › Legacy JWT secret)", durum: 401 };
    if (alg === "HS256") {
      p = (await jwtVerify(t, new TextEncoder().encode(env.SUPABASE_JWT_SECRET!), { audience: "authenticated" })).payload;
    } else {
      const u = (env.SUPABASE_URL ?? "").replace(/\/$/, "");
      if (!u) return { hata: "SUPABASE_URL tanımlı değil", durum: 500 };
      let jwks = jwksOnbellek.get(u);
      if (!jwks) { jwks = createRemoteJWKSet(new URL(`${u}/auth/v1/.well-known/jwks.json`)); jwksOnbellek.set(u, jwks); }
      p = (await jwtVerify(t, jwks, { issuer: `${u}/auth/v1`, audience: "authenticated" })).payload;
    }
  } catch { return { hata: "Oturum geçersiz ya da süresi dolmuş", durum: 401 }; }
  const eposta = String(p.email ?? "");
  if (!eposta) return { hata: "Oturum anahtarında e-posta yok", durum: 401 };
  return { eposta };
}
