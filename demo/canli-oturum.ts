/**
 * Anahtar CRM v3.23 · 10 Ekim 2026
 * Canlı — Supabase girişi (e-posta ile tek kullanımlık bağlantı / kod). Ek kütüphane yok: Supabase Auth (GoTrue) REST uçları doğrudan çağrılır.
 * Oturum bu tarayıcıda (localStorage) tutulur; erişim anahtarı süresi dolmadan yenilenir. Yeni kayıt açılmaz (create_user: false);
 * sunucu ayrıca e-postayı IZINLI_EPOSTALAR listesiyle denetler.
 */
export interface Oturum { access: string; refresh: string; bitis: number; eposta?: string }
export interface Yapilandirma { supabaseUrl: string; supabaseAnonKey: string }
const ANAHTAR = "anahtarcrm-oturum";

const jwtEposta = (t: string): string | undefined => { try { return JSON.parse(atob(t.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))).email; } catch { return undefined; } };
const hataMetni = async (r: Response) => { const j: any = await r.json().catch(() => ({})); return j?.msg ?? j?.error_description ?? j?.message ?? j?.error ?? `Hata ${r.status}`; };

export class OturumYoneticisi {
  private o: Oturum | null = null;
  constructor(private cfg: Yapilandirma, private depo: Pick<Storage, "getItem" | "setItem" | "removeItem"> = localStorage, private f: typeof fetch = fetch.bind(globalThis)) {
    try { this.o = JSON.parse(depo.getItem(ANAHTAR) ?? "null"); } catch { this.o = null; }
  }
  get eposta() { return this.o?.eposta; }
  var() { return !!this.o; }
  private kaydet(o: Oturum | null) { this.o = o; try { o ? this.depo.setItem(ANAHTAR, JSON.stringify(o)) : this.depo.removeItem(ANAHTAR); } catch { /* gizli pencere */ } }
  private yanittan(j: any): Oturum { return { access: j.access_token, refresh: j.refresh_token, bitis: Date.now() + (Number(j.expires_in) || 3600) * 1000, eposta: j.user?.email ?? jwtEposta(j.access_token) }; }

  /** Giriş bağlantısına tıklanınca adres `#access_token=…` ile gelir: oturumu alır, adresi temizler. Hata varsa metnini döndürür. */
  hashtanAl(hash: string): { tamam: boolean; hata?: string } {
    const p = new URLSearchParams(hash.replace(/^#/, ""));
    if (p.get("error_description") || p.get("error")) return { tamam: false, hata: (p.get("error_description") ?? p.get("error"))!.replace(/\+/g, " ") };
    const a = p.get("access_token"), r = p.get("refresh_token");
    if (!a || !r) return { tamam: false };
    this.kaydet({ access: a, refresh: r, bitis: Date.now() + (Number(p.get("expires_in")) || 3600) * 1000, eposta: jwtEposta(a) });
    return { tamam: true };
  }
  async baglantiIste(eposta: string, yonlendir: string, yeniHesap = false) {
    const r = await this.f(`${this.cfg.supabaseUrl}/auth/v1/otp?redirect_to=${encodeURIComponent(yonlendir)}`, { method: "POST", headers: { apikey: this.cfg.supabaseAnonKey, "content-type": "application/json" }, body: JSON.stringify({ email: eposta.trim(), create_user: yeniHesap }) }); // v3.20: yalnızca davet bağlantısıyla gelen yeni hesap açabilir; asıl kapı sunucudaki kullanici tablosu
    if (!r.ok) throw new Error(await hataMetni(r));
  }
  async kodDogrula(eposta: string, kod: string) {
    const r = await this.f(`${this.cfg.supabaseUrl}/auth/v1/verify`, { method: "POST", headers: { apikey: this.cfg.supabaseAnonKey, "content-type": "application/json" }, body: JSON.stringify({ type: "email", email: eposta.trim(), token: kod.trim() }) });
    if (!r.ok) throw new Error(await hataMetni(r));
    this.kaydet(this.yanittan(await r.json()));
  }
  async yenile(): Promise<boolean> {
    if (!this.o?.refresh) return false;
    const r = await this.f(`${this.cfg.supabaseUrl}/auth/v1/token?grant_type=refresh_token`, { method: "POST", headers: { apikey: this.cfg.supabaseAnonKey, "content-type": "application/json" }, body: JSON.stringify({ refresh_token: this.o.refresh }) });
    if (!r.ok) { if (r.status === 400 || r.status === 401 || r.status === 403) this.kaydet(null); return false; }
    this.kaydet(this.yanittan(await r.json())); return true;
  }
  cikis() { this.kaydet(null); }

  /** Oturum anahtarıyla sunucu isteği. Anahtarın süresi bitmek üzereyse yenilenir; 401'de bir kez yenileyip tekrar dener. */
  async api(yol: string, init: { method?: string; json?: unknown; form?: FormData } = {}): Promise<Response> {
    if (this.o && this.o.bitis - Date.now() < 60_000) await this.yenile();
    const gonder = () => this.f(yol, { method: init.method ?? (init.json !== undefined || init.form ? "POST" : "GET"), headers: { ...(this.o ? { authorization: `Bearer ${this.o.access}` } : {}), ...(init.json !== undefined ? { "content-type": "application/json" } : {}) }, body: init.form ?? (init.json !== undefined ? JSON.stringify(init.json) : undefined) });
    let r = await gonder();
    if (r.status === 401 && (await this.yenile())) r = await gonder();
    return r;
  }
}
