/**
 * Anahtar CRM v3.13 · 3 Ekim 2026
 * Google OAuth 2.0 + People API istemcisi (bağımlılıksız, fetch ile). Yalnızca sunucuda çalışır.
 *
 * Ortam değişkenleri: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, UYGULAMA_URL (örn. https://anahtar.vercel.app)
 * Yönlendirme adresi (Google Cloud Console → Credentials → Authorized redirect URIs):
 *   <UYGULAMA_URL>/api/entegrasyon/google/geri-donus
 * ÖNEMLİ: OAuth izin ekranı "Testing" durumunda kalırsa Google yenileme anahtarını 7 günde iptal eder ve senkron durur.
 * Kişisel kullanım için "In production"a alın (doğrulama gerekmez; ilk girişte "doğrulanmamış uygulama" uyarısı çıkar).
 */
import type { GooglePerson, GoogleGrup } from "./kisiler";

export const KAPSAM_OKU = "https://www.googleapis.com/auth/contacts.readonly";
export const KAPSAM_YAZ = "https://www.googleapis.com/auth/contacts"; // yalnızca "Anahtar'daki yeni kişileri Google'a ekle" açıksa
export const PERSON_FIELDS = "names,phoneNumbers,emailAddresses,organizations,biographies,memberships,metadata";

export class GoogleHatasi extends Error {
  constructor(mesaj: string, public durum: number, public neden: "YENIDEN_YETKI" | "SYNC_TOKEN_DOLDU" | "KOTA" | "DIGER" = "DIGER") { super(mesaj); }
}

type Fetch = typeof fetch;
const bekle = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function istek(f: Fetch, url: string, init: RequestInit, deneme = 0): Promise<any> {
  const r = await f(url, init);
  if (r.ok) return r.status === 204 ? null : r.json();
  const govde = await r.text();
  if (/EXPIRED_SYNC_TOKEN/.test(govde) || r.status === 410) throw new GoogleHatasi("Senkron anahtarının süresi doldu; tam senkron gerekli", r.status, "SYNC_TOKEN_DOLDU");
  if (r.status === 401 || /invalid_grant/.test(govde)) throw new GoogleHatasi("Google erişimi geri alınmış ya da süresi dolmuş; hesabı yeniden bağlayın", r.status, "YENIDEN_YETKI");
  if ((r.status === 429 || r.status >= 500) && deneme < 3) { await bekle(800 * 2 ** deneme); return istek(f, url, init, deneme + 1); }
  throw new GoogleHatasi(`Google ${r.status}: ${govde.slice(0, 300)}`, r.status, r.status === 429 ? "KOTA" : "DIGER");
}

export function yonlendirmeAdresi(uygulamaUrl = process.env.UYGULAMA_URL ?? "") {
  return uygulamaUrl.replace(/\/$/, "") + "/api/entegrasyon/google/geri-donus";
}

export function yetkiAdresi(p: { clientId: string; redirectUri: string; state: string; yazma?: boolean }) {
  const q = new URLSearchParams({
    client_id: p.clientId, redirect_uri: p.redirectUri, response_type: "code",
    scope: ["openid", "email", p.yazma ? KAPSAM_YAZ : KAPSAM_OKU].join(" "),
    access_type: "offline", prompt: "consent", include_granted_scopes: "true", state: p.state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${q}`;
}

export interface Tokenlar { access_token: string; expires_in: number; refresh_token?: string; scope?: string; id_token?: string }
const tokenIstek = (f: Fetch, govde: Record<string, string>) =>
  istek(f, "https://oauth2.googleapis.com/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(govde).toString() }) as Promise<Tokenlar>;

export const kodTakasEt = (f: Fetch, p: { code: string; clientId: string; clientSecret: string; redirectUri: string }) =>
  tokenIstek(f, { code: p.code, client_id: p.clientId, client_secret: p.clientSecret, redirect_uri: p.redirectUri, grant_type: "authorization_code" });
export const erisimYenile = (f: Fetch, p: { refreshToken: string; clientId: string; clientSecret: string }) =>
  tokenIstek(f, { refresh_token: p.refreshToken, client_id: p.clientId, client_secret: p.clientSecret, grant_type: "refresh_token" });

/** id_token içindeki e-posta (token doğrudan Google'dan TLS ile geldiği için imza doğrulaması gerekmez) */
export function idTokenEposta(idToken?: string): string | null {
  try { return JSON.parse(Buffer.from(idToken!.split(".")[1], "base64url").toString()).email ?? null; } catch { return null; }
}

export interface BaglantiSayfasi { connections?: GooglePerson[]; nextPageToken?: string; nextSyncToken?: string; totalPeople?: number }
/** Kişileri sayfa sayfa getirir. syncToken verilirse yalnızca değişenler (silinenler metadata.deleted ile) gelir. */
export function kisiSayfasi(f: Fetch, erisim: string, p: { sayfaToken?: string | null; syncToken?: string | null }): Promise<BaglantiSayfasi> {
  const q = new URLSearchParams({ personFields: PERSON_FIELDS, pageSize: "1000", requestSyncToken: "true" });
  if (p.sayfaToken) q.set("pageToken", p.sayfaToken);
  if (p.syncToken) q.set("syncToken", p.syncToken);
  return istek(f, `https://people.googleapis.com/v1/people/me/connections?${q}`, { headers: { authorization: `Bearer ${erisim}` } });
}

export async function gruplar(f: Fetch, erisim: string): Promise<GoogleGrup[]> {
  const r = await istek(f, "https://people.googleapis.com/v1/contactGroups?pageSize=1000&groupFields=name,groupType", { headers: { authorization: `Bearer ${erisim}` } });
  return (r?.contactGroups ?? []) as GoogleGrup[];
}

/** İsteğe bağlı geri yazma: Anahtar'da oluşan kişiyi Google Kişiler'e ekler (KAPSAM_YAZ gerekir) */
export function kisiOlustur(f: Fetch, erisim: string, k: { adSoyad: string; telefon?: string | null; email?: string | null; sirket?: string | null }): Promise<GooglePerson> {
  const govde = {
    names: [{ unstructuredName: k.adSoyad }],
    ...(k.telefon ? { phoneNumbers: [{ value: k.telefon }] } : {}),
    ...(k.email ? { emailAddresses: [{ value: k.email }] } : {}),
    ...(k.sirket ? { organizations: [{ name: k.sirket }] } : {}),
  };
  return istek(f, `https://people.googleapis.com/v1/people:createContact?personFields=${PERSON_FIELDS}`, { method: "POST", headers: { authorization: `Bearer ${erisim}`, "content-type": "application/json" }, body: JSON.stringify(govde) });
}