/**
 * Anahtar CRM v3.21.2 · 8 Ekim 2026
 * Canlı hattın uçtan uca sınaması: çalışan Worker (wrangler dev) + yerel Postgres (PGlite) karşısında
 *   giriş kapısı → kurulum durumu → demo verisini GERÇEK kaydetme kuyruğuyla yazma → geri okuma karşılaştırması → değişiklik/silme → hata yolları.
 * Hazırlık:  SADECE_HAZIRLA=1 LOKASYON_KAPSAM=07 ./scripts/test-db.sh   ve   npx wrangler dev --port 8799 --local  (.dev.vars: SUPABASE_JWT_SECRET, IZINLI_EPOSTALAR=ozgur@test.com)
 * Çalıştır:  npx tsx scripts/canli-uctan-uca.ts
 */
import { SignJWT } from "jose";
import { Client } from "pg";
import { ornekVeriyiKur, type DepoDurumu } from "../demo/depo";
import { sunucudanDurum, planla, imzaAl } from "../demo/canli-esle";
import { kaydediciKur, type KaydetDurumu } from "../demo/canli-kaydet";
import { yedegiBirlestir } from "../demo/canli-ayar";
import { MIGRASYONLAR } from "../src/canli/gomulu.generated";

const TABAN = process.env.CANLI_URL ?? "http://localhost:8799";
const SIR = new TextEncoder().encode("test-gizli-anahtar-en-az-32-karakter-olmali-123");
let gecen = 0, kalan = 0;
const tamam = (ad: string, ok: boolean, ayrinti = "") => { ok ? gecen++ : kalan++; console.log(`${ok ? "✔" : "✘"} ${ad}${ayrinti ? " — " + ayrinti : ""}`); };
const jwt = (eposta: string) => new SignJWT({ email: eposta }).setProtectedHeader({ alg: "HS256" }).setAudience("authenticated").setExpirationTime("1h").sign(SIR);

(async () => {
  const t = await jwt("ozgur@test.com"), yabanci = await jwt("baskasi@test.com");
  const api = (yol: string, init: { method?: string; json?: unknown; form?: FormData; token?: string } = {}) =>
    fetch(TABAN + yol, { method: init.method ?? (init.json !== undefined || init.form ? "POST" : "GET"), headers: { authorization: `Bearer ${init.token ?? t}`, ...(init.json !== undefined ? { "content-type": "application/json" } : {}) }, body: init.form ?? (init.json !== undefined ? JSON.stringify(init.json) : undefined) });

  // 1) kapı
  tamam("girişsiz /api/durum → 401", (await fetch(TABAN + "/api/durum")).status === 401);
  tamam("izinsiz e-posta → 403", (await api("/api/durum", { token: yabanci })).status === 403);
  tamam("bozuk anahtar → 401", (await api("/api/durum", { token: t.slice(0, -3) + "abc" })).status === 401);
  const cfg: any = await (await fetch(TABAN + "/api/yapilandirma")).json();
  tamam("/api/yapilandirma açık (giriş ekranı için)", !!cfg.supabaseUrl && !!cfg.supabaseAnonKey);
  tamam("/api/saglik veritabanı ayakta", (await (await fetch(TABAN + "/api/saglik")).json() as any).vt === true);

  // 2) kurulum durumu (canlı veritabanında migration kayıtları önceden işlendi; burada aynısı taklit edilir)
  const pg = new Client({ connectionString: "postgresql://postgres:pg@127.0.0.1:5432/crm" }); await pg.connect();
  await pg.query(`CREATE TABLE IF NOT EXISTS "_anahtarcrm_migrasyon" ("ad" text PRIMARY KEY, "tarih" timestamptz NOT NULL DEFAULT now())`);
  for (const m of MIGRASYONLAR) await pg.query(`INSERT INTO "_anahtarcrm_migrasyon"(ad) VALUES ($1) ON CONFLICT DO NOTHING`, [m.ad]);
  await pg.end(); // PGlite aynı anda tek bağlantı kabul eder (gerçek Supabase'de bu sınır yok)
  const kur: any = await (await api("/api/kurulum")).json();
  tamam("kurulum: hazır (migration kayıtlı, 917 mahalle, kimlikler uyumlu)", kur.hazir === true, JSON.stringify({ bekleyen: kur.migrasyon?.bekleyen?.length, mahalle: kur.mahalle, uyum: kur.konumKimlikUyumu }));

  // 3) boş durum
  const bos = await (await api("/api/durum")).json() as any;
  tamam("boş veritabanı: 0 kayıt, 0 kişi, varsayılan ayarlar", bos.kayitlar.length === 0 && bos.kisiler.length === 0 && !!bos.ayarlar.ttl && !!bos.ayarlar.ai);
  const acilis = sunucudanDurum(bos);

  // 4) demo verisini gerçek kaydetme kuyruğuyla yaz
  const ornek = ornekVeriyiKur();
  const hedef: DepoDurumu = { ...acilis, kayitlar: ornek.kayitlar, kisiler: ornek.kisiler, adaylar: ornek.adaylar,
    eslesmeNotlari: { [`${ornek.kayitlar.find((k) => k.veri.tip === "TALEP")!.id}~${ornek.kayitlar.find((k) => k.veri.tip === "PORTFOY")!.id}`]: { durum: "REDDEDILDI", not: "Fiyat yüksek", neden: "FIYAT", tarih: new Date().toISOString() } },
    ayarlar: { ...acilis.ayarlar, ai: { ...(acilis.ayarlar.ai as any), esik: 70 } }, geriBildirim: "deneme notu", ogrenilen: [] };
  let son: KaydetDurumu = { ad: "kayitli", hatalar: [] };
  const k = kaydediciKur({ api: (y, i) => api(y, i as any), baslangic: acilis, durum: (s) => (son = s), bekleMs: 20 });
  k.kuyrugaAl(hedef); await k.hemen();
  tamam("kaydetme kuyruğu: 'kayitli' ve hata yok", son.ad === "kayitli" && son.hatalar.length === 0, `${hedef.kayitlar.length} kayıt, ${hedef.kisiler.length} kişi · ${son.ad} · hata ${son.hatalar.length}`);
  tamam("kaydettikten sonra bekleyen iş yok", !k.bekliyorMu());

  // 5) geri oku ve karşılaştır
  const s2 = await (await api("/api/durum")).json() as any;
  tamam("sayılar tutuyor (kayıt, kişi)", s2.kayitlar.length === hedef.kayitlar.length && s2.kisiler.length === hedef.kisiler.length, `sunucu: ${s2.kayitlar.length}/${s2.kisiler.length}`);
  const geri = sunucudanDurum(s2);
  const fark: string[] = [];
  const norm = (v: any) => JSON.stringify(v instanceof Date ? v.toISOString() : v);
  for (const y of hedef.kayitlar) {
    const g = geri.kayitlar.find((x) => x.id === y.id); if (!g) { fark.push(`${y.id}: yok`); continue; }
    for (const a of ["tip", "mulkTipi", "islemTipi", "anaKategori", "fiyat", "minFiyat", "maxFiyat", "m2", "minM2", "maxM2", "odaSayisi", "lokasyonHam", "durum", "aciliyet", "hamMetin", "gondeAdi", "gondeTelefon"]) {
      const a1 = (y.veri as any)[a] ?? null, b1 = (g.veri as any)[a] ?? null;
      if (norm(a1) !== norm(b1) && !(Number(a1) === Number(b1) && a1 != null)) fark.push(`${y.id}.${a}: ${norm(a1)} ≠ ${norm(b1)}`);
    }
    if (new Date((y.veri as any).validUntil).getTime() !== new Date((g.veri as any).validUntil).getTime()) fark.push(`${y.id}.validUntil`);
    const l1 = JSON.stringify(((y.veri as any).lokasyonlar ?? []).map((l: any) => [l.ilceId ?? null, l.mahalleId ?? null, l.altBolgeId ?? null, !!l.birincil]));
    const l2 = JSON.stringify(((g.veri as any).lokasyonlar ?? []).map((l: any) => [l.ilceId ?? null, l.mahalleId ?? null, l.altBolgeId ?? null, !!l.birincil]));
    if (l1 !== l2) fark.push(`${y.id}.lokasyonlar: ${l1} ≠ ${l2}`);
    const o1 = Object.entries(((y.veri as any).ozellik ?? {})).filter(([, v]) => v != null && !(Array.isArray(v) && !v.length)), o2 = (g.veri as any).ozellik ?? {};
    for (const [a, v] of o1) if (norm(v) !== norm(o2[a]) && !(Number(v) === Number(o2[a]))) fark.push(`${y.id}.ozellik.${a}: ${norm(v)} ≠ ${norm(o2[a])}`);
    const kb1 = ((y.veri as any).kisiler ?? []).map((b: any) => `${b.kisiId}:${b.rol}`).sort().join(), kb2 = ((g.veri as any).kisiler ?? []).map((b: any) => `${b.kisiId}:${b.rol}`).sort().join();
    if (kb1 !== kb2) fark.push(`${y.id}.kisiler: ${kb1} ≠ ${kb2}`);
  }
  tamam(`yaz-oku turu kayıpsız (${hedef.kayitlar.length} kayıt: alanlar, konumlar, teknik özellikler, kişi bağları)`, fark.length === 0, fark.slice(0, 4).join(" | "));
  const kisiFark = hedef.kisiler.filter((x) => { const g = geri.kisiler.find((y) => y.id === x.id); return !g || g.adSoyad !== x.adSoyad || (g.telefon ?? null) !== (x.telefon ?? null) || JSON.stringify([...(g.roller ?? [])].sort()) !== JSON.stringify([...(x.roller ?? [])].sort()); });
  tamam("kişiler kayıpsız (ad, telefon, roller)", kisiFark.length === 0, kisiFark.slice(0, 3).map((x) => x.id).join());
  tamam("eşleşme notu (koparma) durdu", Object.values(geri.eslesmeNotlari).some((n) => n.durum === "REDDEDILDI" && n.not === "Fiyat yüksek" && n.neden === "FIYAT"));
  tamam("ayar (yapay zekâ eşiği) durdu", (geri.ayarlar.ai as any)?.esik === 70);
  tamam("arayüz durumu (geri bildirim notu) durdu", geri.geriBildirim === "deneme notu");

  // 6) yeniden yükleme sonrası ilk kaydetme boş olmalı (gereksiz yazma yok)
  tamam("yüklemeden hemen sonra fark yok (gereksiz kayıt göndermez)", planla(imzaAl(geri), geri).bos);

  // 7) değişiklik + silme + yeni not
  const k2 = kaydediciKur({ api: (y, i) => api(y, i as any), baslangic: geri, durum: (s) => (son = s), bekleMs: 20 });
  const ilk = geri.kayitlar[0], silinecek = geri.kayitlar[1];
  const degisen: DepoDurumu = { ...geri, kayitlar: geri.kayitlar.filter((x) => x.id !== silinecek.id).map((x) => x.id === ilk.id ? { ...x, veri: { ...x.veri, baslik: "DEĞİŞTİ", operasyonNotu: "yeni not" } as any, notlar: [{ id: "N1", tarih: new Date().toISOString(), tur: "ARAMA", metin: "Müşteriyi aradım" }] } : x) };
  k2.kuyrugaAl(degisen); await k2.hemen();
  const s3 = sunucudanDurum(await (await api("/api/durum")).json() as any);
  tamam("değişiklik sunucuda (başlık, not)", s3.kayitlar.find((x) => x.id === ilk.id)?.veri.baslik === "DEĞİŞTİ" && (s3.kayitlar.find((x) => x.id === ilk.id)?.notlar ?? []).some((n) => n.metin === "Müşteriyi aradım"));
  tamam("silinen kayıt sunucudan gitti", !s3.kayitlar.some((x) => x.id === silinecek.id) && s3.kayitlar.length === geri.kayitlar.length - 1);

  // 8) hata yolu: sunucunun reddedeceği kayıt → 'hata' + listede; diğerleri yine kaydedilir
  const kotu: DepoDurumu = { ...s3, kayitlar: [{ id: "KOTU1", olusturma: new Date().toISOString(), veri: { tip: "PORTFOY", mulkTipi: "DAIRE" } as any, notlar: [] }, ...s3.kayitlar] };
  const k3 = kaydediciKur({ api: (y, i) => api(y, i as any), baslangic: s3, durum: (s) => (son = s), bekleMs: 20 });
  k3.kuyrugaAl(kotu); await k3.hemen();
  tamam("geçersiz kayıt: 'hata' gösterilir, nedeni listelenir", son.ad === "hata" && son.hatalar.some((h) => h.id === "KOTU1"), son.hatalar[0]?.mesaj?.slice(0, 80));
  tamam("geçersiz kayıt sunucuya yazılmadı", !(sunucudanDurum(await (await api("/api/durum")).json() as any)).kayitlar.some((x) => x.id === "KOTU1"));

  // 9) ağ hatası: kuyruk kaybetmez, 'hata' der
  const k4 = kaydediciKur({ api: async () => { throw new Error("ağ yok"); }, baslangic: s3, durum: (s) => (son = s), bekleMs: 10, yenidenMs: 60_000 });
  k4.kuyrugaAl({ ...s3, geriBildirim: "ağ testi" }); await k4.hemen();
  tamam("ağ koparsa: 'hata' + bekleyen iş korunur", son.ad === "hata" && k4.bekliyorMu());

  // 10) yedekten yükleme birleştirme (demo yedeği → canlı): mevcutlara dokunmaz, tekrar yükleme zarar vermez
  const yedek = { kayitlar: ornek.kayitlar, kisiler: ornek.kisiler, eslesmeNotlari: {} };
  const b1 = yedegiBirlestir({ kayitlar: [], kisiler: [], eslesmeNotlari: {} }, yedek);
  tamam("yedekten yükleme: tüm örnek kayıtlar ve kişiler alınır", b1.ozet.kayit === ornek.kayitlar.length && b1.ozet.kisi === ornek.kisiler.length && b1.ozet.atlanan === 0, JSON.stringify(b1.ozet));
  const b2 = yedegiBirlestir({ kayitlar: b1.kayitlar as any, kisiler: b1.kisiler as any, eslesmeNotlari: {} }, yedek);
  tamam("aynı yedeği tekrar yüklemek hiçbir şey eklemez", b2.ozet.kayit === 0 && b2.ozet.kisi === 0);
  // aynı kişiler, farklı kimliklerle (ör. canlıda elle eklenmiş kişiler): telefonla eşlenir, kayıtların kişi bağı mevcut kişiye çevrilir
  const farkliKimlik = { kisiler: ornek.kisiler.map((k) => ({ ...k, id: "Z" + k.id })), kayitlar: ornek.kayitlar.map((k) => ({ ...k, id: "Z" + k.id, veri: { ...k.veri, kisiler: ((k.veri as any).kisiler ?? []).map((b: any) => ({ ...b, kisiId: "Z" + b.kisiId })) } })), eslesmeNotlari: {} };
  const b3 = yedegiBirlestir({ kayitlar: b1.kayitlar as any, kisiler: b1.kisiler as any, eslesmeNotlari: {} }, farkliKimlik);
  const telefonlu = ornek.kisiler.filter((k) => k.telefon).length;
  tamam("aynı telefonlu kişi yeniden açılmaz, mevcut kişiyle eşlenir; kayıtlar yine eklenir", b3.ozet.kisi === ornek.kisiler.length - telefonlu && b3.ozet.eslenen === telefonlu && b3.ozet.kayit === ornek.kayitlar.length, JSON.stringify(b3.ozet));
  tamam("eşlenen kişilerin kayıt bağları mevcut kişiye çevrildi (sahipsiz bağ yok)", b3.kayitlar.every((k: any) => (k.veri.kisiler ?? []).every((bg: any) => b1.kisiler.some((q: any) => q.id === bg.kisiId) || b3.kisiler.some((q: any) => q.id === bg.kisiId))));

  // 11) yapay zekâ ucu (anahtar tanımlı değil) ve fotoğraf ucu (Supabase Storage yok) — çökmeden, anlaşılır hata vermeli
  const ai = await api("/api/ai/json", { json: { istem: "merhaba" } }); const aij: any = await ai.json();
  tamam("yapay zekâ: anahtar yoksa anlaşılır hata (503 ANAHTAR_YOK)", ai.status === 503 && aij.hata === "ANAHTAR_YOK", `${ai.status} ${aij.hata}`);
  const fotoKayit = s3.kayitlar.find((x) => x.veri.tip === "PORTFOY")!;
  const form = new FormData(); form.append("dosya", new File([new Uint8Array([255, 216, 255, 224, 0, 16, 74, 70])], "a.jpg", { type: "image/jpeg" })); form.append("en", "10"); form.append("boy", "10");
  const fr = await api(`/api/kayit/${fotoKayit.id}/fotolar`, { form }); const frj: any = await fr.json().catch(() => ({}));
  tamam("fotoğraf: depo erişilemezse çökmez, kayıt temizlenir", fr.status >= 400 && fr.status < 600 && !!frj.hata, `${fr.status} ${frj.hata}`);
  tamam("fotoğraf: başarısız yüklemeden künye kalmadı", ((await (await api("/api/durum")).json() as any).kayitlar.find((x: any) => x.id === fotoKayit.id)?.fotolar ?? []).length === 0);

  console.log(`\n${gecen} geçti, ${kalan} kaldı`); process.exit(kalan ? 1 : 0);
})().catch((e) => { console.error("BETİK HATASI:", e); process.exit(2); });
