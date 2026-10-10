/**
 * Anahtar CRM v3.22.2 · 10 Ekim 2026
 * TEST YARDIMCISI — bellekte çalışan sahte Google (OAuth token + People API). Gerçek Google'ın davranışının
 * senkron için önemli kısmını taklit eder: sayfalama (pageToken), artımlı çekim (syncToken → yalnızca değişenler,
 * silinenler metadata.deleted ile), kişi oluşturma, tek kişi okuma, etag denetimli güncelleme (updatePersonFields).
 * SİLME isteği gelirse kaydeder — testler "Google'dan hiçbir şey silinmedi" diye bunu denetler.
 */
import type { GooglePerson, GoogleGrup } from "../src/lib/google/kisiler";

export interface Cagri { yontem: string; url: string; govde?: any }
const J = (v: unknown, status = 200) => new Response(JSON.stringify(v), { status });

export function sahteGoogle(baslangic: GooglePerson[] = [], gruplar: GoogleGrup[] = []) {
  const kisiler = new Map<string, GooglePerson>();
  const degisim = new Map<string, number>(); // kişi → son değiştiği sürüm
  const cagrilar: Cagri[] = [];
  let surum = 0, sira = 9000;
  const koy = (p: GooglePerson) => { surum++; p.etag = "etag-" + surum; kisiler.set(p.resourceName, p); degisim.set(p.resourceName, surum); return p; };
  for (const p of baslangic) koy(structuredClone(p));

  const f = (async (girdi: string | URL | Request, init?: RequestInit) => {
    const url = String(girdi), yontem = (init?.method ?? "GET").toUpperCase();
    const govde = typeof init?.body === "string" && init.body.startsWith("{") ? JSON.parse(init.body) : undefined;
    cagrilar.push({ yontem, url, govde });
    const u = new URL(url);
    if (u.hostname === "oauth2.googleapis.com" && u.pathname === "/token") return J({ access_token: "ya29.sahte", expires_in: 3600, refresh_token: "1//sahte-yenileme", scope: "openid email https://www.googleapis.com/auth/contacts", id_token: "x." + Buffer.from(JSON.stringify({ email: "rehber@ornek.com" })).toString("base64url") + ".y" });
    if (u.hostname === "oauth2.googleapis.com" && u.pathname === "/revoke") return J({});
    if (u.pathname === "/v1/contactGroups") return J({ contactGroups: gruplar });
    if (u.pathname === "/v1/people/me/connections") {
      const sync = u.searchParams.get("syncToken");
      const sonra = sync ? Number(sync.split("-")[1]) : 0;
      const hepsi = [...kisiler.values()].filter((p) => (sync ? degisim.get(p.resourceName)! > sonra : !p.metadata?.deleted));
      const bas = Number(u.searchParams.get("pageToken") ?? 0), boy = Number(u.searchParams.get("pageSize") ?? 100);
      const son = bas + boy;
      return J({ connections: hepsi.slice(bas, son).map((p) => structuredClone(p)), ...(son < hepsi.length ? { nextPageToken: String(son) } : { nextSyncToken: "sync-" + surum }) });
    }
    if (u.pathname === "/v1/people:createContact" && yontem === "POST") {
      const ad = govde.names?.[0]?.unstructuredName ?? "";
      return J(structuredClone(koy({ resourceName: "people/c" + sira++, names: [{ displayName: ad, unstructuredName: ad, metadata: { primary: true } }], phoneNumbers: (govde.phoneNumbers ?? []).map((t: any) => ({ ...t, canonicalForm: t.value })), emailAddresses: govde.emailAddresses, organizations: govde.organizations, metadata: { sources: [{ type: "CONTACT", id: "s" + sira }] } })));
    }
    const m = u.pathname.match(/^\/v1\/(people\/[A-Za-z0-9_-]+)(:updateContact)?$/);
    if (m) {
      const p = kisiler.get(m[1]);
      if (yontem === "DELETE") return J({ error: "SILME YASAK" }, 500);
      if (!p || p.metadata?.deleted) return J({ error: { code: 404, status: "NOT_FOUND" } }, 404);
      if (yontem === "GET") return J(structuredClone(p));
      if (yontem === "PATCH" && m[2]) {
        if (govde.etag !== p.etag) return J({ error: { code: 400, status: "FAILED_PRECONDITION" } }, 400);
        const yeni: any = structuredClone(p);
        for (const alan of (u.searchParams.get("updatePersonFields") ?? "").split(",").filter(Boolean)) {
          yeni[alan] = govde[alan];
          if (alan === "names") yeni.names = (govde.names ?? []).map((n: any) => ({ ...n, displayName: n.unstructuredName ?? n.displayName, metadata: { primary: true } }));
          if (alan === "phoneNumbers") yeni.phoneNumbers = (govde.phoneNumbers ?? []).map((t: any) => ({ ...t, canonicalForm: t.value }));
        }
        return J(structuredClone(koy(yeni)));
      }
    }
    return J({ error: "bilinmeyen istek: " + yontem + " " + url }, 500);
  }) as unknown as typeof fetch;

  return {
    f, kisiler, cagrilar,
    /** Telefonda Google'a kişi kaydedildi */
    ekle: (p: GooglePerson) => koy(structuredClone(p)),
    /** Google'da kişi düzenlendi */
    degistir: (rn: string, is: (p: GooglePerson) => void) => { const p = structuredClone(kisiler.get(rn)!); is(p); return koy(p); },
    /** Google'da kişi silindi */
    sil: (rn: string) => koy({ resourceName: rn, metadata: { deleted: true } }),
    telefonlar: (rn: string) => (kisiler.get(rn)?.phoneNumbers ?? []).map((t) => t.value),
    yazmaCagrilari: () => cagrilar.filter((c) => c.yontem !== "GET" && !c.url.includes("/token")),
    silmeCagrilari: () => cagrilar.filter((c) => c.yontem === "DELETE" || /delete/i.test(c.url)),
  };
}

/** Basit Google kişisi */
export const gk = (no: number, ad: string, tel: string | null, ek: Partial<GooglePerson> = {}): GooglePerson => ({
  resourceName: "people/c" + no, names: [{ displayName: ad, metadata: { primary: true } }],
  ...(tel ? { phoneNumbers: [{ value: tel, canonicalForm: tel, type: "mobile", metadata: { primary: true } }] } : {}), ...ek,
});
