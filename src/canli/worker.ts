/**
 * Anahtar CRM v3.42 · 23 Ekim 2026 (v3.20'den)
 * AŞAMA 7 — Cloudflare Worker girişi. Tek proje: arayüz (statik dosyalar, ASSETS) + /api (sunucu kodu) + zamanlanmış işler.
 *  - /api/yapilandirma, /api/saglik → açık (giriş ekranının ihtiyacı / sağlık kontrolü)
 *  - /api/davet/kabul → giriş şart, ofis şart değil (kişi henüz bir ofiste değil)
 *  - /api/kayit-ol → v3.26: aynı kapı; ek olarak ACIK_KAYIT=1 olmalı (davetsiz yeni ofis + 14 gün Pro deneme)
 *  - diğer /api/* → üç kapı: (1) oturum anahtarı doğrulanır (2) e-posta bir ofis kullanıcısına
 *    çözülür (3) istek o ofisin bağlamında çalışır; ofise ait her sorgu ofisId ile süzülür.
 *  - /api/entegrasyon/google/geri-donus → v3.21: Google izin ekranından dönüş. Oturum başlığı OLMAZ
 *    (tarayıcıyı Google yönlendirir); kimliği imzalı `state` taşır ve rota kendisi doğrular.
 *  - Zamanlayıcı: platform bağlamında çalışır (tüm ofisler) — her gün 03:00 (TR 06:00) uyanık
 *    tutma + süresi dolanları pasife alma; pazar 04:00 haftalık yedek; v3.22.2: her gün 05:00 UTC (TR 08:00)
 *    Google Kişiler eşitlemesi (Google'ı bağlı ofisler, her biri kendi bağlamında; v3.21'de 15 dakikada birdi)
 *  - v3.23 — GELEN KUTUSU: /api/gelen/al oturumsuzdur (Gmail köprüsü); kimlik, isteğin taşıdığı gizli ofis kodudur ve rota
 *    kendisi doğrular. `email` işleyicisi alan adına gelen postayı aynı kutuya koyar (Cloudflare Email Routing → bu Worker).
 *    İkisi de dosyayı açmadan saklar; ayrıştırma tarayıcıdadır (ücretsiz planda 10 ms işlemci sınırı).
 *  - v3.29 — VERİTABANI YOLU: Hyperdrive bağlıysa (wrangler.jsonc › hyperdrive, bağlama adı HYPERDRIVE) sorgular onun bağlantı
 *    havuzundan geçer; bağlı değilse eskisi gibi DATABASE_URL (Supavisor). Hyperdrive kendi hatasını verirse (SQLSTATE 58000,
 *    günlük sorgu sınırı, havuz) bu Worker örneği 10 dakika doğrudan bağlantıya döner — uygulama durmaz.
 */
import { ROTALAR } from "./rotalar.generated";
import { kimlikDogrula, izinliMi } from "./kimlik";
import { oturumCoz } from "./oturum";
import { davetBaglamiIcinde } from "./davet-baglam";
import { istekIcinde, prisma } from "../lib/db";
import { kiracilikIcinde, platformOlarak, KiracilikHatasi } from "../lib/kiracilik";
import { YetkiHatasi } from "../lib/guvenlik/yetki";
import { tamYedek, yedegiDepola } from "../lib/services/yedek";
import { tumOfislerdeGoogleSenkron } from "../lib/services/senkron";
import { gelenPostaIsle, gelenTemizlik, type GelenPosta } from "../lib/services/gelen";
import { veritabaniAdresi, hyperdriveHatasiniIsle } from "./veritabani";
import { uzakAdres, araciBasliklari, gecitHatasiMi, IC_ZAMANLAYICI, IC_EPOSTA } from "./uzak";

export interface Env {
  ASSETS: { fetch: (r: Request) => Promise<Response> };
  DATABASE_URL: string; DIRECT_URL?: string; SUPABASE_URL: string; SUPABASE_ANON_KEY: string;
  SUPABASE_JWT_SECRET?: string; SUPABASE_SERVICE_ROLE_KEY?: string; IZINLI_EPOSTALAR: string;
  CRON_SECRET?: string; ACIK_KAYIT?: string;
  /** v3.29 — Cloudflare Hyperdrive bağlaması (önbellek kapalı; bkz. docs/HYPERDRIVE_KURULUMU_v3.29_14Ekim2026.md) */
  HYPERDRIVE?: { connectionString: string };
  [k: string]: unknown;
}
/** v3.26 — Cloudflare değişkeni ACIK_KAYIT=1 → giriş ekranında "Ücretsiz dene" ve /api/kayit-ol açılır */
export const acikKayit = (env: Env) => env.ACIK_KAYIT === "1" || env.ACIK_KAYIT === "true";
const ortamiYukle = (env: Env) => { for (const [k, v] of Object.entries(env)) if (typeof v === "string") (globalThis as any).process.env[k] = v; };
const json = (v: unknown, status = 200) => Response.json(v, { status, headers: { "cache-control": "no-store" } });

/** Hata → yanıt: ofis bağlamı / yetki hataları kullanıcıya anlaşılır biçimde döner */
const hataYaniti = (e: unknown) => {
  if (hyperdriveHatasiniIsle(e)) return json({ hata: "SUNUCU", mesaj: "Veritabanı bağlantısı koptu (Hyperdrive) — yeniden deneyin" }, 503);
  if (e instanceof YetkiHatasi) return json({ hata: "YETKI", mesaj: e.message }, 403);
  if (e instanceof KiracilikHatasi) { console.error("Kiracılık hatası:", e.message); return json({ hata: "KIRACILIK", mesaj: "Bu istek bir ofis bağlamı gerektiriyor" }, 500); }
  return json({ hata: "SUNUCU", mesaj: String((e as Error)?.message ?? e).slice(0, 400) }, 500);
};

export async function apiIsle(req: Request, env: Env): Promise<Response> {
  const url = new URL(req.url);
  if (url.pathname === "/api/yapilandirma") return json({ supabaseUrl: env.SUPABASE_URL, supabaseAnonKey: env.SUPABASE_ANON_KEY, acikKayit: acikKayit(env) });

  const rota = (() => {
    for (const r of ROTALAR) {
      const m = url.pathname.match(r.desen);
      if (m) return { r, m };
    }
    return null;
  })();
  if (!rota) return json({ hata: "BULUNAMADI" }, 404);
  const isle = rota.r.mod[req.method] as ((r: Request, c: { params: Promise<Record<string, string>> }) => Promise<Response>) | undefined;
  if (typeof isle !== "function") return json({ hata: "YONTEM" }, 405);
  const params = Promise.resolve(Object.fromEntries((rota.r.params as string[]).map((p, i) => [p, decodeURIComponent(rota.m[i + 1])])));

  // 1) Açık kapılar: sağlık kontrolü ve zamanlayıcı (CRON_SECRET) → platform bağlamı
  const cron = !!env.CRON_SECRET && req.headers.get("authorization") === `Bearer ${env.CRON_SECRET}`;
  if (url.pathname === "/api/saglik" || cron) {
    return istekIcinde(veritabaniAdresi(env), () => platformOlarak(() => isle(req, { params })).catch(hataYaniti));
  }

  // 1b) v3.21 — Google'dan dönüş: oturum başlığı yoktur. Rota imzalı state'i doğrular, kullanıcıyı veritabanından
  //     yeniden denetler ve işi yalnızca o ofisin bağlamında yapar (src/app/api/entegrasyon/google/geri-donus/route.ts).
  if (url.pathname === "/api/entegrasyon/google/geri-donus") {
    return istekIcinde(veritabaniAdresi(env), () => isle(req, { params }).catch(hataYaniti));
  }

  // 1c) v3.23 — Gelen kutusu köprüsü: oturum başlığı yoktur. Rota, istekteki gizli ofis kodunu doğrular ve dosyayı yalnızca
  //     o ofisin bağlamında, onay bekleyenlere koyar (src/app/api/gelen/al/route.ts → services/gelen.ts › gelenAl).
  if (url.pathname === "/api/gelen/al") {
    return istekIcinde(veritabaniAdresi(env), () => isle(req, { params }).catch(hataYaniti));
  }

  // 2) Oturum anahtarı (JWT) → e-posta
  const k = await kimlikDogrula(req, env);
  if ("hata" in k) return json({ hata: "KIMLIK", mesaj: k.hata }, k.durum);

  // 3a) v3.20 — Kurulum (migration uygulama): kullanıcı tablosu henüz yokken de çalışmalı (tavuk-yumurta).
  //     Yalnızca acil durum listesindeki (IZINLI_EPOSTALAR) e-postalar, platform bağlamında.
  if (url.pathname === "/api/kurulum") {
    if (!izinliMi(k.eposta, env.IZINLI_EPOSTALAR)) return json({ hata: "YETKI", mesaj: "Kurulum yalnızca platform yöneticisi içindir" }, 403);
    return istekIcinde(veritabaniAdresi(env), () => platformOlarak(() => isle(req, { params })).catch(hataYaniti));
  }

  // 3) Davet kabul: giriş yeter, ofis gerekmez (kişi henüz bir ofiste değil)
  if (url.pathname === "/api/davet/kabul") {
    return istekIcinde(veritabaniAdresi(env), () => davetBaglamiIcinde(k.eposta, () => isle(req, { params })).catch(hataYaniti));
  }

  // 3b) v3.26 — Açık kayıt: davetsiz gelen danışman kendi ofisini açar. Giriş yeter, ofis gerekmez. ACIK_KAYIT=1 değilse kapalı.
  if (url.pathname === "/api/kayit-ol") {
    if (!acikKayit(env)) return json({ hata: "KAPALI", mesaj: "Yeni ofis kaydı şu an kapalı. Davet bağlantısıyla katılabilirsiniz." }, 403);
    return istekIcinde(veritabaniAdresi(env), () => davetBaglamiIcinde(k.eposta, () => isle(req, { params })).catch(hataYaniti));
  }

  // 4) E-posta → ofis + rol; istek o ofisin bağlamında çalışır
  return istekIcinde(veritabaniAdresi(env), async () => {
    const o = await oturumCoz(prisma, k.eposta, env);
    if ("hata" in o) return json({ hata: o.kod, mesaj: o.hata }, o.durum);
    return kiracilikIcinde(o.baglam, () => isle(req, { params })).catch(hataYaniti);
  });
}

/** Zamanlanmış işler (tüm ofisler, platform bağlamı). v3.42 — Supabase fonksiyonu da aynı işlevi çağırır (src/canli/fonksiyon.ts). */
export async function zamanlanmisIs(cron: string, env: Env): Promise<void> {
  await istekIcinde(veritabaniAdresi(env), () => platformOlarak(async () => {
    if (cron.startsWith("0 3")) {
      // Supabase Free 7 gün işlem görmeyen projeyi durdurur → günlük küçük sorgu + REST isteği
      await prisma.$queryRawUnsafe("SELECT 1");
      await fetch(`${env.SUPABASE_URL.replace(/\/$/, "")}/rest/v1/`, { headers: { apikey: env.SUPABASE_ANON_KEY } }).catch(() => {});
      await prisma.kayit.updateMany({ where: { durum: "ACTIVE", validUntil: { lt: new Date() } }, data: { durum: "EXPIRED", durumTarihi: new Date() } }); // v3.38
      // v3.23 — gelen kutusu: 45 günden eski ham dosyalar ve 1 yıldan eski "atlandı" anahtarları
      await gelenTemizlik(prisma).catch((e) => console.error("Gelen kutusu temizliği:", e));
    } else if (cron.startsWith("0 4")) {
      await yedegiDepola(JSON.stringify(await tamYedek(prisma)), env);
    } else {
      // v3.21 — Google Kişiler: en uzun süredir eşitlenmeyen ofisler önce; her ofis kendi bağlamında (günde bir, artımlı)
      if (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) await tumOfislerdeGoogleSenkron(prisma, { enFazla: 5, butceMs: 12_000 });
    }
  }));
}

/** Gelen e-postayı işler (yerelde). v3.42 — fonksiyon da bunu kullanır. */
export async function epostaIsle(message: GelenPosta, env: Env): Promise<void> {
  try { await istekIcinde(veritabaniAdresi(env), () => gelenPostaIsle(prisma, message)); }
  catch (e) { hyperdriveHatasiniIsle(e); console.error("Gelen e-posta kaydedilemedi:", e); message.setReject("Temporary failure, please retry"); }
}

const yerelApi = async (req: Request, env: Env) => {
  try { return await apiIsle(req, env); } catch (e) { hyperdriveHatasiniIsle(e); return json({ hata: "SUNUCU", mesaj: String((e as Error)?.message ?? e).slice(0, 400) }, 500); }
};

/**
 * v3.42 — ARACI: /api/* isteğini Supabase fonksiyonuna iletir (bkz. src/canli/uzak.ts). Fonksiyon yoksa / açılamadıysa yerelde işler.
 * Burada yapılan iş: başlık kopyalama + gövdeyi iletme (~1 ms). Ücretsiz planın 10 ms sınırı aşılmaz.
 */
async function aracilikEt(req: Request, env: Env): Promise<Response> {
  const url = new URL(req.url);
  const uzak = uzakAdres(env);
  if (!uzak || url.pathname === "/api/yapilandirma") return yerelApi(req, env);
  const govde = req.method === "GET" || req.method === "HEAD" ? undefined : await req.arrayBuffer();
  let r: Response | null = null;
  try {
    r = await fetch(uzak + url.pathname.replace(/^\/api/, "") + url.search, { method: req.method, headers: araciBasliklari(env, req.url, req.headers), body: govde, redirect: "manual" });
  } catch (e) { console.error("Supabase fonksiyonuna ulaşılamadı, yerelde işleniyor:", e); }
  if (r && !(await gecitHatasiMi(r))) {
    const h = new Headers(r.headers); h.delete("content-encoding"); h.delete("content-length");
    return new Response(r.body, { status: r.status, statusText: r.statusText, headers: h });
  }
  if (r) console.error("Supabase fonksiyonu hata verdi (", r.status, "), yerelde işleniyor");
  return yerelApi(new Request(req.url, { method: req.method, headers: req.headers, body: govde }), env);
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    ortamiYukle(env);
    if (new URL(req.url).pathname.startsWith("/api/")) return aracilikEt(req, env);
    return env.ASSETS.fetch(req);
  },
  /**
   * v3.23 — Alan adına gelen e-posta (Cloudflare Email Routing › "Send to a Worker"). İşin tamamı services/gelen.ts › gelenPostaIsle'dedir:
   * posta açılmadan (.eml) ofisin gelen kutusuna konur. v3.42 — Supabase fonksiyonuna iletilir; ulaşılamazsa yerelde.
   */
  async email(message: GelenPosta, env: Env): Promise<void> {
    ortamiYukle(env);
    const uzak = uzakAdres(env);
    if (uzak) {
      try {
        const veri = message.raw instanceof Uint8Array ? message.raw : new Uint8Array(await new Response(message.raw).arrayBuffer());
        const h = araciBasliklari(env, "https://eposta.local/api" + IC_EPOSTA, { "content-type": "message/rfc822", "x-eposta-from": message.from, "x-eposta-to": message.to, "x-eposta-subject": message.headers.get("subject") ?? "" });
        const r = await fetch(uzak + IC_EPOSTA, { method: "POST", headers: h, body: veri as unknown as BodyInit });
        if (!(await gecitHatasiMi(r))) {
          const j: any = await r.json().catch(() => ({}));
          if (j?.red) message.setReject(String(j.red));
          else if (!r.ok) message.setReject("Temporary failure, please retry");
          return;
        }
        return epostaIsle({ ...message, raw: veri, headers: message.headers, setReject: (n: string) => message.setReject(n) }, env);
      } catch (e) { console.error("E-posta fonksiyona iletilemedi:", e); }
    }
    return epostaIsle(message, env);
  },
  async scheduled(ev: { cron: string }, env: Env, ctx: { waitUntil: (p: Promise<unknown>) => void }) {
    ortamiYukle(env);
    const uzak = uzakAdres(env);
    ctx.waitUntil((async () => {
      if (uzak) {
        try {
          const r = await fetch(uzak + IC_ZAMANLAYICI, { method: "POST", headers: araciBasliklari(env, "https://zamanlayici.local/api" + IC_ZAMANLAYICI, { "content-type": "application/json" }), body: JSON.stringify({ cron: ev.cron }) });
          if (!(await gecitHatasiMi(r))) { if (!r.ok) console.error("Zamanlanmış iş (fonksiyon):", r.status, await r.text().catch(() => "")); return; }
        } catch (e) { console.error("Zamanlayıcı fonksiyona iletilemedi:", e); }
      }
      await zamanlanmisIs(ev.cron, env);
    })());
  },
};
