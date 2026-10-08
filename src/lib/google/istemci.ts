/**
 * Anahtar CRM v3.21.1 · 8 Ekim 2026 (v3.13'ten)
 * Google OAuth 2.0 + People API istemcisi (bağımlılıksız, fetch ile). Yalnızca sunucuda çalışır.
 *
 * v3.21 — çift yönlü: kişi okuma, oluşturma ve güncelleme. Bu dosyada Google'dan kişi SİLEN bir çağrı yoktur
 * ve eklenmemelidir (kural: Anahtar'dan silinen kişi Google'da kalır) — tests/v321.test.ts denetler.
 *
 * Ortam değişkenleri (platform için BİR KEZ): GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET. UYGULAMA_URL isteğe bağlıdır;
 * yoksa adres isteğin geldiği alan adından alınır (ör. https://anahtarcrm.<hesap>.workers.dev).
 * Yönlendirme adresi (Google Cloud Console → Credentials → Authorized redirect URIs):
 *   <UYGULAMA ADRESİ>/api/entegrasyon/google/geri-donus
 * ÖNEMLİ: OAuth izin ekranı "Testing" durumunda kalırsa Google yenileme anahtarını 7 günde iptal eder ve senkron durur.
 * Kişisel kullanım için "In production"a alın (doğrulama gerekmez; ilk girişte "doğrulanmamış uygulama" uyarısı çıkar).
 */
import type { GooglePerson, GoogleGrup } from "./kisiler";

export const KAPSAM_OKU = "https://www.googleapis.com/auth/contacts.readonly";
export const KAPSAM_YAZ = "https://www.googleapis.com/auth/contacts"; // v3.21: varsayılan (çift yönlü) — tek izin ekranı
export const PERSON_FIELDS = "names,phoneNumbers,emailAddresses,organizations,biographies,memberships,metadata";

/**
 * Google uçlarının tabanı. Canlıda her zaman Google'ın kendi adresleridir. Yalnızca yerel uçtan uca sınamada
 * (scripts/canli-google-testi.ts: gerçek Worker + sahte Google) ortam değişkeniyle yerel bir sunucuya çevrilir.
 */
const OAUTH = () => (process.env.GOOGLE_OAUTH_TABANI || "https://oauth2.googleapis.com").replace(/\/$/, "");
const PEOPLE = () => (process.env.GOOGLE_PEOPLE_TABANI || "https://people.googleapis.com").replace(/\/$/, "");

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

/** Uygulamanın dış adresi: UYGULAMA_URL tanımlıysa o, değilse isteğin geldiği alan adı */
export function uygulamaAdresi(req?: Request): string {
  const ortam = (process.env.UYGULAMA_URL ?? "").replace(/\/$/, "");
  if (ortam) return ortam;
  return req ? new URL(req.url).origin : "";
}
export function yonlendirmeAdresi(uygulamaUrl = process.env.UYGULAMA_URL ?? "") {
  return uygulamaUrl.replace(/\/$/, "") + "/api/entegrasyon/google/geri-donus";
}
/** Verilen izin metninde (token yanıtındaki `scope`) kişi yazma izni var mı? ("contacts.readonly" yazma sayılmaz) */
export const yazmaIzniVar = (scope?: string | null): boolean => (scope ?? "").split(/\s+/).includes(KAPSAM_YAZ);

export function yetkiAdresi(p: { clientId: string; redirectUri: string; state: string; yazma?: boolean }) {
  const q = new URLSearchParams({
    client_id: p.clientId, redirect_uri: p.redirectUri, response_type: "code",
    scope: ["openid", "email", p.yazma === false ? KAPSAM_OKU : KAPSAM_YAZ].join(" "), // v3.21: varsayılan çift yönlü
    access_type: "offline", prompt: "consent", include_granted_scopes: "true", state: p.state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${q}`;
}

export interface Tokenlar { access_token: string; expires_in: number; refresh_token?: string; scope?: string; id_token?: string }
const tokenIstek = (f: Fetch, govde: Record<string, string>) =>
  istek(f, `${OAUTH()}/token`, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(govde).toString() }) as Promise<Tokenlar>;

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
export function kisiSayfasi(f: Fetch, erisim: string, p: { sayfaToken?: string | null; syncToken?: string | null; sayfaBoyu?: number }): Promise<BaglantiSayfasi> {
  const q = new URLSearchParams({ personFields: PERSON_FIELDS, pageSize: String(p.sayfaBoyu ?? 1000), requestSyncToken: "true" });
  if (p.sayfaToken) q.set("pageToken", p.sayfaToken);
  if (p.syncToken) q.set("syncToken", p.syncToken);
  return istek(f, `${PEOPLE()}/v1/people/me/connections?${q}`, { headers: { authorization: `Bearer ${erisim}` } });
}

export async function gruplar(f: Fetch, erisim: string): Promise<GoogleGrup[]> {
  const r = await istek(f, `${PEOPLE()}/v1/contactGroups?pageSize=1000&groupFields=name,groupType`, { headers: { authorization: `Bearer ${erisim}` } });
  return (r?.contactGroups ?? []) as GoogleGrup[];
}

const kisiYolu = (resourceName: string) => {
  if (!/^people\/[A-Za-z0-9_-]+$/.test(resourceName)) throw new GoogleHatasi("Geçersiz Google kişi kimliği", 400);
  return `${PEOPLE()}/v1/${resourceName}`;
};
const yazBasliklari = (erisim: string) => ({ authorization: `Bearer ${erisim}`, "content-type": "application/json" });

/** Anahtar'da oluşan kişiyi Google Kişiler'e ekler (KAPSAM_YAZ gerekir) */
export function kisiOlustur(f: Fetch, erisim: string, govde: Partial<GooglePerson>): Promise<GooglePerson> {
  return istek(f, `${PEOPLE()}/v1/people:createContact?personFields=${PERSON_FIELDS}`, { method: "POST", headers: yazBasliklari(erisim), body: JSON.stringify(govde) });
}
/** Tek kişinin güncel hâli (güncellemeden hemen önce okunur: etag + Google'daki diğer telefon / e-postalar). Kişi Google'da yoksa null. */
export async function kisiGetir(f: Fetch, erisim: string, resourceName: string): Promise<GooglePerson | null> {
  try { return await istek(f, `${kisiYolu(resourceName)}?personFields=${PERSON_FIELDS}`, { headers: { authorization: `Bearer ${erisim}` } }); }
  catch (x) { if (x instanceof GoogleHatasi && x.durum === 404) return null; throw x; }
}
/** Var olan Google kişisinde yalnızca maskedeki alanları değiştirir (people:updateContact). Gövde: google/kisiler.ts › googleGuncellemeGovdesi */
export function kisiGuncelle(f: Fetch, erisim: string, resourceName: string, govde: Partial<GooglePerson>, maske: string[]): Promise<GooglePerson> {
  return istek(f, `${kisiYolu(resourceName)}:updateContact?updatePersonFields=${maske.join(",")}&personFields=${PERSON_FIELDS}`, { method: "PATCH", headers: yazBasliklari(erisim), body: JSON.stringify(govde) });
}
/** Bağlantı kaldırılırken Google tarafındaki izni de geri alır (en iyi çaba; hata bağlantıyı kaldırmayı engellemez) */
export async function izniGeriAl(f: Fetch, yenilemeAnahtari: string): Promise<boolean> {
  try { const r = await f(`${OAUTH()}/revoke?token=${encodeURIComponent(yenilemeAnahtari)}`, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" } }); return r.ok; }
  catch { return false; }
}
