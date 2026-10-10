/**
 * Anahtar CRM v3.22.2 · 10 Ekim 2026
 * Fotoğraf (Supabase Storage) ve zamanlanmış işler (günlük uyanık tutma, haftalık yedek + 12'li saklama) sınaması.
 * Hazırlık: node scripts/sahte-depo.mjs &  ·  .dev.vars: SUPABASE_URL=http://127.0.0.1:9001, SUPABASE_SERVICE_ROLE_KEY=svc-test  ·  npx wrangler dev --port 8799 --local --test-scheduled
 */
import { SignJWT } from "jose";
const T = "http://localhost:8799", D = "http://127.0.0.1:9001";
const SIR = new TextEncoder().encode("test-gizli-anahtar-en-az-32-karakter-olmali-123");
let g = 0, k = 0; const tamam = (a: string, ok: boolean, d = "") => { ok ? g++ : k++; console.log(`${ok ? "✔" : "✘"} ${a}${d ? " — " + d : ""}`); };
(async () => {
  const jt = await new SignJWT({ email: "ozgur@test.com" }).setProtectedHeader({ alg: "HS256" }).setAudience("authenticated").setExpirationTime("1h").sign(SIR);
  const api = (yol: string, i: { method?: string; json?: unknown; form?: FormData } = {}) => fetch(T + yol, { method: i.method ?? (i.json !== undefined || i.form ? "POST" : "GET"), headers: { authorization: `Bearer ${jt}`, ...(i.json !== undefined ? { "content-type": "application/json" } : {}) }, body: i.form ?? (i.json !== undefined ? JSON.stringify(i.json) : undefined) });
  const durum = async () => (await (await api("/api/durum")).json()) as any;
  const portfoy = (await durum()).kayitlar.find((x: any) => x.veri.tip === "PORTFOY");
  const talep = (await durum()).kayitlar.find((x: any) => x.veri.tip === "TALEP");
  if (!portfoy) throw new Error("önce canli-uctan-uca.ts ile veri yükleyin");

  // — fotoğraf —
  const jpeg = new Uint8Array(2000).fill(7); jpeg[0] = 255; jpeg[1] = 216;
  const yukle = async (id: string, ad = "a.jpg", tur = "image/jpeg", boyut = jpeg) => { const f = new FormData(); f.append("dosya", new File([boyut], ad, { type: tur })); f.append("en", "800"); f.append("boy", "600"); return api(`/api/kayit/${id}/fotolar`, { form: f }); };
  const r1 = await yukle(portfoy.id); const j1: any = await r1.json();
  tamam("fotoğraf yüklenir (201, künye + imzalı bağlantı)", r1.status === 201 && !!j1.id && typeof j1.url === "string" && j1.url.startsWith(D), `${r1.status} ${j1.url?.slice(0, 60)}`);
  const ind = await fetch(j1.url); tamam("imzalı bağlantıdan dosya iner (aynı bayt sayısı)", ind.ok && (await ind.arrayBuffer()).byteLength === 2000);
  const d1 = await durum(); const fp = d1.kayitlar.find((x: any) => x.id === portfoy.id);
  tamam("durum köprüsü fotoğraf künyesini taşır (arayüz yenilenince fotoğraf görünür)", (fp.fotolar ?? []).some((f: any) => f.id === j1.id && f.en === 800), JSON.stringify(fp.fotolar?.[0]));
  const liste: any = await (await api(`/api/kayit/${portfoy.id}/fotolar`)).json();
  tamam("fotoğraf listesi imzalı bağlantılarla gelir", Array.isArray(liste) && liste.length === 1 && !!liste[0].url);
  tamam("talebe fotoğraf eklenemez (422)", (await yukle(talep.id)).status === 422);
  tamam("PDF türü reddedilir (422)", (await yukle(portfoy.id, "a.pdf", "application/pdf")).status === 422);
  tamam("küçültülmemiş (1,5 MB üstü) dosya reddedilir (422)", (await yukle(portfoy.id, "b.jpg", "image/jpeg", new Uint8Array(1_600_000))).status === 422);
  for (let i = 0; i < 7; i++) await yukle(portfoy.id, `f${i}.jpg`);
  tamam("9. fotoğraf reddedilir (en fazla 8)", (await yukle(portfoy.id, "dokuz.jpg")).status === 422);
  const sil = await api(`/api/kayit/${portfoy.id}/fotolar?fotoId=${j1.id}`, { method: "DELETE" });
  const depo: any = await (await fetch(D + "/__gunluk")).json();
  tamam("fotoğraf silinir; depodan da kalkar", sil.ok && !depo.dosyalar.some(([a]: [string]) => a.includes(j1.id)) && depo.dosyalar.filter(([a]: [string]) => a.startsWith("portfoy/")).length === 7, `depoda ${depo.dosyalar.filter(([a]: [string]) => a.startsWith("portfoy/")).length} dosya`);

  // — zamanlanmış işler —
  for (let i = 1; i <= 13; i++) await fetch(`${D}/__ekle?a=${encodeURIComponent(`yedekler/anahtarcrm-yedek-2026-01-${String(i).padStart(2, "0")}.json`)}`);
  const gun = await fetch(T + "/cdn-cgi/handler/scheduled?cron=0+3+*+*+*"); await new Promise((r) => setTimeout(r, 1500));
  tamam("günlük iş (uyanık tutma) çalışır", gun.ok, `${gun.status}`);
  const hafta = await fetch(T + "/cdn-cgi/handler/scheduled?cron=0+4+*+*+0"); await new Promise((r) => setTimeout(r, 4000));
  const d2: any = await (await fetch(D + "/__gunluk")).json();
  const yedekler = d2.dosyalar.filter(([a]: [string]) => a.startsWith("yedekler/anahtarcrm-yedek-"));
  tamam("haftalık yedek özel kovaya yazıldı (bugünün tarihiyle)", hafta.ok && yedekler.some(([a, b]: [string, number]) => a.includes(new Date().toISOString().slice(0, 10)) && b > 1000), `${yedekler.length} yedek dosyası`);
  tamam("en fazla 12 yedek tutulur (eskiler silinir)", yedekler.length === 12, `${yedekler.length}`);
  tamam("en eski yedekler silindi, yeni olan kaldı", !yedekler.some(([a]: [string]) => a.includes("2026-01-01") || a.includes("2026-01-02")) && yedekler.some(([a]: [string]) => a.includes("2026-01-13")));
  console.log(`\n${g} geçti, ${k} kaldı`); process.exit(k ? 1 : 0);
})().catch((e) => { console.error("BETİK HATASI:", e); process.exit(2); });
