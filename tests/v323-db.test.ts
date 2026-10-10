/**
 * Anahtar CRM v3.24 · 10 Ekim 2026
 * v3.23 — VERİTABANLI KANIT (PGlite, depo taklit): GELEN KUTUSU sunucu tarafı.
 *   · dosya künyesi + depo: aynı içerik iki kez yazılmaz; boş / büyük / desteklenmeyen tür reddedilir; depo hatasında satır kalmaz
 *   · ofis ayrımı: bir ofisin dosyası ve atlananları diğerinde görünmez; oturumsuz giriş yalnızca gizli kodun ofisine yazar
 *   · rotalar: /api/gelen (liste, yükle, sil), /api/gelen/al (köprü), /api/gelen/atlanan, /api/gelen/adres
 *   · alan adına gelen e-posta: .eml olarak saklanır; tanınmayan adres / büyük posta geri çevrilir
 *   · zamanlayıcı temizliği: 45 günden eski dosyalar, 1 yıldan eski atlananlar
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { kiracilikIcinde, platformOlarak, istemciyiSarmala, VARSAYILAN_OFIS_ID, VARSAYILAN_KULLANICI_ID, type Baglam } from "../src/lib/kiracilik";
import { gelenKaydet, gelenListe, gelenDosyaSil, gelenAl, gelenKodGetir, gelenPostaIsle, gelenTemizlik, atlananlariGetir, atlananEkle, atlananSil, GelenHatasi, type GelenDepo } from "../src/lib/services/gelen";
import { GELEN_SINIR, gelenKodGecerli } from "../src/lib/ingest/gelen";
import { ofisAc } from "../src/lib/services/ofis";

const ciplak = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL!, max: 1 }) });
const prisma = istemciyiSarmala(ciplak);
(globalThis as any).prisma = ciplak; // rota dosyaları (src/lib/db.ts) aynı bağlantıyı kullansın — PGlite tek bağlantı kabul eder
const A: Baglam = { ofisId: VARSAYILAN_OFIS_ID, kullaniciId: VARSAYILAN_KULLANICI_ID, rol: "PLATFORM_YONETICISI", eposta: "ozgursadikozyurt@gmail.com" };
const icinde = <T,>(b: Baglam, is: () => Promise<T>) => kiracilikIcinde(b, is);

/** Bellekte depo: yüklenen yollar ve içerikler */
function sahteDepo() {
  const dosyalar = new Map<string, Uint8Array>();
  const d: GelenDepo & { dosyalar: Map<string, Uint8Array>; hata: boolean } = {
    dosyalar, hata: false,
    yukle: async (yol, veri) => { if (d.hata) throw new Error("depo kapalı"); dosyalar.set(yol, veri); },
    sil: async (yollar) => { for (const y of yollar) dosyalar.delete(y); },
    baglantilar: async (yollar) => Object.fromEntries(yollar.filter((y) => dosyalar.has(y)).map((y) => [y, "https://depo.ornek/" + y + "?token=t"])),
  };
  return d;
}
const zip = (n = 40, tohum = 1) => { const v = new Uint8Array(n).fill(tohum); v.set([0x50, 0x4b, 3, 4]); return v; };
const metin = (s: string) => new TextEncoder().encode(s);
let B: Baglam, D: Baglam;

test("hazırlık: temiz kutu, ikinci ofis ve bir danışman", async () => {
  await ciplak.gelenDosya.deleteMany({}); await ciplak.gelenAtlanan.deleteMany({});
  const yeni = await icinde(A, () => ofisAc(prisma, { ad: "Gelen Kutusu Deneme Emlak" }));
  const yon = await ciplak.kullanici.create({ data: { ofisId: yeni.id, eposta: "yon@gelen-deneme.com", rol: "OFIS_YONETICISI" } });
  const dan = await ciplak.kullanici.create({ data: { ofisId: yeni.id, eposta: "dan@gelen-deneme.com", rol: "DANISMAN" } });
  B = { ofisId: yeni.id, kullaniciId: yon.id, rol: "OFIS_YONETICISI", eposta: yon.eposta };
  D = { ofisId: yeni.id, kullaniciId: dan.id, rol: "DANISMAN", eposta: dan.eposta };
});

test("dosya kaydı: künye + depo yolu; aynı içerik ikinci kez yazılmaz; boş / büyük / desteklenmeyen tür reddedilir; depo hatasında satır kalmaz", async () => {
  const depo = sahteDepo();
  const r = await icinde(A, () => gelenKaydet(prisma, { ad: "C:\\Belgeler\\WhatsApp Sohbeti - EMLAK BORSASI.zip", veri: zip(), kanal: "YUKLEME" }, depo));
  assert.equal(r.yeni, true); assert.equal(r.dosya.tur, "zip"); assert.equal(r.dosya.ad, "WhatsApp Sohbeti - EMLAK BORSASI.zip", "yol atılır, ad kalır");
  const satir = await ciplak.gelenDosya.findUniqueOrThrow({ where: { id: r.dosya.id } });
  assert.equal(satir.ofisId, A.ofisId); assert.match(satir.ozet, /^[0-9a-f]{64}$/);
  assert.match(satir.depoYolu, new RegExp(`^${A.ofisId}/\\d{4}-\\d{2}/${satir.id}\\.zip$`), "depo yolu ofis klasöründe");
  assert.ok(depo.dosyalar.has(satir.depoYolu));
  const tekrar = await icinde(A, () => gelenKaydet(prisma, { ad: "başka-ad.zip", veri: zip(), kanal: "KOPRU" }, depo));
  assert.equal(tekrar.yeni, false); assert.equal(tekrar.dosya.id, r.dosya.id); assert.equal(depo.dosyalar.size, 1);
  const red = async (g: Parameters<typeof gelenKaydet>[1], kod: string, durum: number) => { await assert.rejects(() => icinde(A, () => gelenKaydet(prisma, g, depo)), (e: any) => e instanceof GelenHatasi && e.kod === kod && e.durum === durum); };
  await red({ ad: "bos.txt", veri: new Uint8Array(0), kanal: "YUKLEME" }, "BOS", 422);
  await red({ ad: "foto.jpg", veri: new Uint8Array(10), kanal: "YUKLEME" }, "TUR", 415);
  await red({ ad: "dev.zip", veri: new Uint8Array(GELEN_SINIR + 1), kanal: "YUKLEME" }, "BUYUK", 413);
  depo.hata = true;
  await assert.rejects(() => icinde(A, () => gelenKaydet(prisma, { ad: "x.txt", veri: metin("28.09.2026 09:14 - A: merhaba"), kanal: "YUKLEME" }, depo)), /depo kapalı/);
  depo.hata = false;
  assert.equal(await ciplak.gelenDosya.count(), 1, "depoya yazılamayan dosyanın künyesi kalmaz");
  const l = await icinde(A, () => gelenListe(prisma, depo));
  assert.equal(l.dosyalar.length, 1); assert.match(l.dosyalar[0].url!, /^https:\/\/depo\.ornek\//); assert.equal(l.depo, true);
});

test("OFİS AYRIMI: dosya ve atlananlar ofise özeldir; oturumsuz giriş yalnızca gizli kodun ofisine yazar", async () => {
  const depo = sahteDepo();
  const kodA = await icinde(A, () => gelenKodGetir(prisma)), kodB = await icinde(B, () => gelenKodGetir(prisma));
  assert.ok(gelenKodGecerli(kodA) && gelenKodGecerli(kodB)); assert.notEqual(kodA, kodB);
  assert.equal(await icinde(A, () => gelenKodGetir(prisma)), kodA, "kod kalıcıdır");
  // köprü: B'nin koduyla gelen dosya B'ye yazılır
  const b1 = await gelenAl(prisma, kodB, { ad: "ads-2026-10-10.xlsx", veri: zip(60, 7), kanal: "KOPRU", gonderen: "yon@gelen-deneme.com", konu: "Revy" }, depo);
  assert.equal(b1.yeni, true);
  assert.equal((await ciplak.gelenDosya.findUniqueOrThrow({ where: { id: b1.dosya.id } })).ofisId, B.ofisId);
  assert.equal((await icinde(A, () => gelenListe(prisma, depo))).dosyalar.some((x) => x.id === b1.dosya.id), false, "A, B'nin dosyasını görmez");
  assert.equal((await icinde(B, () => gelenListe(prisma, depo))).dosyalar.length, 1);
  assert.equal((await icinde(D, () => gelenListe(prisma, depo))).dosyalar.length, 1, "aynı ofisin danışmanı görür");
  // A, B'nin dosyasını silemez
  assert.equal(await icinde(A, () => gelenDosyaSil(prisma, [b1.dosya.id], depo)), 0);
  assert.equal(await ciplak.gelenDosya.count({ where: { id: b1.dosya.id } }), 1);
  // aynı içerik A'ya da gelebilir: özet ofis başına tekildir
  const a2 = await gelenAl(prisma, kodA, { ad: "ads-2026-10-10.xlsx", veri: zip(60, 7), kanal: "KOPRU" }, depo);
  assert.equal(a2.yeni, true); assert.notEqual(a2.dosya.id, b1.dosya.id);
  // yanlış / biçimsiz / boş kod: hiçbir şey yazılmaz
  const once = await ciplak.gelenDosya.count();
  for (const k of ["abcdefghijkmnpqrstuv", "kisa", "", null, kodA.toUpperCase(), "' OR 1=1 --"]) await assert.rejects(() => gelenAl(prisma, k as any, { ad: "x.zip", veri: zip(50, 9), kanal: "KOPRU" }, depo), (e: any) => e instanceof GelenHatasi && e.kod === "ADRES" && e.durum === 401, String(k));
  assert.equal(await ciplak.gelenDosya.count(), once);
  // askıdaki ofis kabul etmez
  await ciplak.ofis.update({ where: { id: B.ofisId }, data: { durum: "ASKIDA" } });
  await assert.rejects(() => gelenAl(prisma, kodB, { ad: "y.zip", veri: zip(50, 3), kanal: "KOPRU" }, depo), /Anahtar geçersiz/);
  await ciplak.ofis.update({ where: { id: B.ofisId }, data: { durum: "AKTIF" } });
  // kod yenilenince eskisi çalışmaz
  const yeniKod = await icinde(B, () => gelenKodGetir(prisma, true));
  assert.notEqual(yeniKod, kodB);
  await assert.rejects(() => gelenAl(prisma, kodB, { ad: "z.zip", veri: zip(50, 4), kanal: "KOPRU" }, depo), /Anahtar geçersiz/);
  assert.equal((await gelenAl(prisma, yeniKod, { ad: "z.zip", veri: zip(50, 4), kanal: "KOPRU" }, depo)).yeni, true);
  // atlananlar
  assert.equal(await icinde(A, () => atlananEkle(prisma, ["i:1344109418", "w:abc123#1", "i:1344109418", "geçersiz anahtar", ""])), 2, "tekrar ve biçimsiz anahtar yazılmaz");
  assert.equal(await icinde(A, () => atlananEkle(prisma, ["i:1344109418", "u:xyz"])), 1, "var olan yeniden yazılmaz");
  await icinde(B, () => atlananEkle(prisma, ["i:1344109418", "i:777"]));
  assert.deepEqual((await icinde(A, () => atlananlariGetir(prisma))).sort(), ["i:1344109418", "u:xyz", "w:abc123#1"]);
  assert.deepEqual((await icinde(B, () => atlananlariGetir(prisma))).sort(), ["i:1344109418", "i:777"]);
  assert.equal(await icinde(A, () => atlananSil(prisma, ["u:xyz", "i:777"])), 1, "A, B'nin anahtarını silemez");
  assert.equal(await icinde(A, () => atlananSil(prisma)), 2);
  assert.equal((await icinde(B, () => atlananlariGetir(prisma))).length, 2, "B'ninkiler duruyor");
});

test("ROTALAR: yükle → listele → sil; köprü (/api/gelen/al) başlıklarla; atlanan; adres (danışman yenileyemez)", async () => {
  const kutu = await import("../src/app/api/gelen/route");
  const al = (await import("../src/app/api/gelen/al/route")).POST;
  const atlanan = await import("../src/app/api/gelen/atlanan/route");
  const adres = await import("../src/app/api/gelen/adres/route");
  const indir = (await import("../src/app/api/gelen/[id]/dosya/route")).GET;
  const kok = "https://anahtarcrm.ornek.workers.dev";
  const json = async (r: Response) => ({ durum: r.status, veri: (await r.json()) as any });
  await ciplak.gelenDosya.deleteMany({}); await ciplak.gelenAtlanan.deleteMany({});

  // depo kapalı: 503, satır kalmaz
  const form = (ad: string, veri: Uint8Array) => { const f = new FormData(); f.set("dosya", new File([veri as BlobPart], ad)); return new Request(kok + "/api/gelen", { method: "POST", body: f }); };
  delete process.env.SUPABASE_URL; delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  const kapali = await json(await icinde(A, () => kutu.POST(form("a.zip", zip(30, 2)))));
  assert.equal(kapali.durum, 503); assert.equal(kapali.veri.hata, "DEPO_KAPALI"); assert.equal(await ciplak.gelenDosya.count(), 0);

  process.env.SUPABASE_URL = "https://proje.supabase.co"; process.env.SUPABASE_SERVICE_ROLE_KEY = "gizli";
  const asil = globalThis.fetch; const cagri: string[] = []; const icerik = new Map<string, Uint8Array>(); let kovaVar = false;
  globalThis.fetch = (async (url: any, init: any = {}) => {
    const u = String(url);
    if (!u.startsWith("https://proje.supabase.co/storage/v1/")) throw new Error("beklenmeyen çağrı " + u);
    const yol = decodeURIComponent(u.split("/storage/v1/")[1]);
    assert.equal(init.headers.authorization, "Bearer gizli");
    cagri.push(`${init.method ?? "GET"} ${yol}`);
    if (yol === "bucket") { kovaVar = true; assert.equal(JSON.parse(init.body).public, false, "kova özel"); return new Response("{}", { status: 200 }); }
    if (yol.startsWith("object/sign/gelen")) return new Response(JSON.stringify(JSON.parse(init.body).paths.map((p: string) => ({ path: p, signedURL: `/object/sign/gelen/${p}?token=t` }))), { status: 200 });
    if (init.method === "POST" && yol.startsWith("object/gelen/")) { if (!kovaVar) return new Response(JSON.stringify({ statusCode: "404", error: "Bucket not found", message: "Bucket not found" }), { status: 400 }); icerik.set(yol.slice("object/gelen/".length), new Uint8Array(init.body)); return new Response("{}", { status: 200 }); }
    if ((init.method ?? "GET") === "GET" && yol.startsWith("object/gelen/")) { const v = icerik.get(yol.slice("object/gelen/".length)); return v ? new Response(v as BodyInit, { status: 200 }) : new Response("{}", { status: 404 }); }
    if (init.method === "DELETE" && yol === "object/gelen") { for (const p of JSON.parse(init.body).prefixes) icerik.delete(p); return new Response("[]", { status: 200 }); }
    return new Response("{}", { status: 404 });
  }) as any;
  try {
    // 1) ekrandan yükleme — kova ilk kullanımda kendiliğinden oluşur
    const y = await json(await icinde(A, () => kutu.POST(form("ads-2026-10-10.xlsx", zip(80, 5)))));
    assert.equal(y.durum, 201); assert.equal(y.veri.yeni, true); assert.equal(y.veri.dosya.tur, "xlsx"); assert.equal(y.veri.dosya.kanal, "YUKLEME");
    assert.deepEqual(cagri.slice(0, 3).map((c) => c.replace(/gelen\/.*$/, "gelen/…")), ["POST object/gelen/…", "POST bucket", "POST object/gelen/…"], "kova yoksa oluşturulup yeniden denenir");
    assert.equal(icerik.size, 1);
    assert.equal((await json(await icinde(A, () => kutu.POST(form("ayni.xlsx", zip(80, 5)))))).durum, 200, "aynı içerik: 200, yeni değil");
    assert.equal((await json(await icinde(A, () => kutu.POST(form("foto.png", new Uint8Array(20)))))).durum, 415);
    assert.equal((await json(await icinde(A, () => kutu.POST(new Request(kok + "/api/gelen", { method: "POST", body: new FormData() }))))).durum, 422);

    // 2) köprü: başlıklar URL-kodlu, Türkçe ad ve gönderen bozulmaz
    const kod = await icinde(A, () => gelenKodGetir(prisma));
    const kopru = (anahtar: string | null, ad: string, veri: Uint8Array, ek: Record<string, string> = {}) => al(new Request(kok + "/api/gelen/al", { method: "POST", body: veri as BodyInit, headers: { ...(anahtar ? { "x-anahtar": anahtar } : {}), "x-dosya-adi": encodeURIComponent(ad), "x-gonderen": encodeURIComponent("Özgür Özyurt <ozgur@gmail.com>"), "x-konu": encodeURIComponent("WhatsApp Sohbeti - ANTALYA TİCARİ ile sohbet"), "content-type": "application/octet-stream", ...ek } }));
    const k1 = await json(await kopru(kod, "WhatsApp Sohbeti - ANTALYA TİCARİ.zip", zip(90, 6)));
    assert.equal(k1.durum, 201); assert.equal(k1.veri.yeni, true);
    const satir = await ciplak.gelenDosya.findUniqueOrThrow({ where: { id: k1.veri.id } });
    assert.equal(satir.ofisId, A.ofisId); assert.equal(satir.ad, "WhatsApp Sohbeti - ANTALYA TİCARİ.zip"); assert.equal(satir.kanal, "KOPRU");
    assert.equal(satir.gonderen, "Özgür Özyurt <ozgur@gmail.com>"); assert.equal(satir.konu, "WhatsApp Sohbeti - ANTALYA TİCARİ ile sohbet");
    assert.equal((await json(await kopru(kod, "WhatsApp Sohbeti - ANTALYA TİCARİ.zip", zip(90, 6)))).durum, 200, "köprü aynı eki iki kez yollarsa");
    assert.equal((await json(await kopru(null, "x.zip", zip(40, 8)))).durum, 401, "anahtarsız");
    assert.equal((await json(await kopru("abcdefghijkmnpqrstuv", "x.zip", zip(40, 8)))).durum, 401, "yanlış anahtar");
    assert.equal((await json(await kopru(kod, "resim.jpg", new Uint8Array(40)))).durum, 415);
    assert.equal((await json(await kopru(kod, "dev.zip", zip(40, 8), { "content-length": String(GELEN_SINIR + 5) }))).durum, 413, "büyük gövde okunmadan reddedilir");
    assert.equal((await json(await al(new Request(kok + `/api/gelen/al?anahtar=${kod}`, { method: "POST", body: metin("28.09.2026 09:14 - Ali: Lara'da 3+1 kiralık daire 45.000 TL") as BodyInit, headers: { "x-dosya-adi": "sohbet.txt" } })))).durum, 201, "anahtar adres satırında da olabilir");

    // 3) liste + indirme + silme
    const l = await json(await icinde(A, () => kutu.GET()));
    assert.equal(l.veri.dosyalar.length, 3); assert.ok(l.veri.dosyalar.every((x: any) => /^https:\/\/proje\.supabase\.co\/storage\/v1\/object\/sign\/gelen\//.test(x.url)), "süreli indirme bağlantısı");
    assert.ok(!JSON.stringify(l.veri).includes("depoYolu") && !JSON.stringify(l.veri).includes("ozet"), "iç alanlar dışarı verilmez");
    const ind = await icinde(A, () => indir(new Request(kok), { params: Promise.resolve({ id: k1.veri.id }) }));
    assert.equal(ind.status, 200); assert.deepEqual([...new Uint8Array(await ind.arrayBuffer()).slice(0, 4)], [0x50, 0x4b, 3, 4], "sunucu üzerinden indirme: içerik aynen");
    assert.equal((await icinde(B, () => indir(new Request(kok), { params: Promise.resolve({ id: k1.veri.id }) }))).status, 404, "başka ofis indiremez");
    assert.equal((await json(await icinde(A, () => kutu.DELETE(new Request(kok + "/api/gelen", { method: "DELETE" }))))).durum, 422);
    assert.equal((await json(await icinde(B, () => kutu.DELETE(new Request(kok + `/api/gelen?id=${k1.veri.id}`, { method: "DELETE" }))))).veri.silinen, 0);
    assert.equal((await json(await icinde(A, () => kutu.DELETE(new Request(kok + `/api/gelen?id=${k1.veri.id},yok`, { method: "DELETE" }))))).veri.silinen, 1);
    assert.equal(icerik.size, 2, "depodan da silindi");
    assert.equal((await json(await icinde(A, () => kutu.DELETE(new Request(kok + "/api/gelen?hepsi=1", { method: "DELETE" }))))).veri.silinen, 2);
    assert.equal(icerik.size, 0); assert.equal(await ciplak.gelenDosya.count({ where: { ofisId: A.ofisId } }), 0);

    // 4) atlananlar
    const g = (y: string, govde?: unknown) => new Request(kok + "/api/gelen/atlanan", { method: y, ...(govde ? { body: JSON.stringify(govde) } : {}) });
    assert.equal((await json(await icinde(A, () => atlanan.POST(g("POST", { anahtarlar: ["i:1", "i:2", "w:q#1"] }))))).veri.eklenen, 3);
    assert.equal((await json(await icinde(A, () => atlanan.POST(g("POST", { anahtarlar: [] }))))).durum, 422);
    assert.equal((await json(await icinde(A, () => atlanan.GET()))).veri.anahtarlar.length, 3);
    assert.equal((await json(await icinde(A, () => atlanan.DELETE(g("DELETE", { anahtarlar: ["i:1"] }))))).veri.silinen, 1);
    assert.equal((await json(await icinde(A, () => atlanan.DELETE(g("DELETE"))))).veri.silinen, 2);

    // 5) adres
    delete process.env.GELEN_ALAN_ADI;
    const ad1 = await json(await icinde(D, () => adres.GET(new Request(kok + "/api/gelen/adres"))));
    assert.equal(ad1.durum, 200); assert.equal(ad1.veri.eposta, null, "alan adı yokken e-posta adresi verilmez"); assert.equal(ad1.veri.kopru, kok + "/api/gelen/al"); assert.ok(gelenKodGecerli(ad1.veri.kod));
    assert.equal((await json(await icinde(D, () => adres.POST(new Request(kok + "/api/gelen/adres", { method: "POST" }))))).durum, 403, "danışman anahtarı yenileyemez");
    process.env.GELEN_ALAN_ADI = "@Gelen.AnahtarCRM.com";
    const ad2 = await json(await icinde(B, () => adres.POST(new Request(kok + "/api/gelen/adres", { method: "POST" }))));
    assert.equal(ad2.durum, 200); assert.notEqual(ad2.veri.kod, ad1.veri.kod); assert.equal(ad2.veri.eposta, `${ad2.veri.kod}@gelen.anahtarcrm.com`);
    delete process.env.GELEN_ALAN_ADI;
  } finally { globalThis.fetch = asil; }
});

test("ALAN ADINA GELEN E-POSTA: .eml olarak saklanır; tanınmayan adres, büyük posta ve desteklenmeyen içerik geri çevrilir", async () => {
  const depo = sahteDepo();
  const kod = await icinde(B, () => gelenKodGetir(prisma));
  const ham = metin(["From: Yon <yon@gelen-deneme.com>", `To: ${kod}@gelen.anahtarcrm.com`, "Subject: =?UTF-8?B?" + Buffer.from("WhatsApp Sohbeti - EMLAK BORSASI ile sohbet").toString("base64") + "?=", "MIME-Version: 1.0", "Content-Type: text/plain; charset=utf-8", "", "Lara'da 140 m2 kiralik dukkan 85.000 TL"].join("\r\n"));
  const posta = (to: string, veri = ham, boyut = veri.length) => { const m = { from: "yon@gelen-deneme.com", to, raw: new Response(veri as BodyInit).body!, rawSize: boyut, headers: new Headers({ subject: "=?UTF-8?B?" + Buffer.from("WhatsApp Sohbeti - EMLAK BORSASI ile sohbet").toString("base64") + "?=" }), red: null as string | null, setReject(n: string) { m.red = n; } }; return m; };
  const once = await ciplak.gelenDosya.count({ where: { ofisId: B.ofisId } });
  const m1 = posta(`${kod}@gelen.anahtarcrm.com`);
  assert.equal(await gelenPostaIsle(prisma, m1, depo), "kaydedildi"); assert.equal(m1.red, null);
  const satir = await ciplak.gelenDosya.findFirstOrThrow({ where: { ofisId: B.ofisId, kanal: "EPOSTA" } });
  assert.equal(satir.tur, "eml"); assert.equal(satir.ad, "WhatsApp Sohbeti - EMLAK BORSASI ile sohbet.eml"); assert.equal(satir.konu, "WhatsApp Sohbeti - EMLAK BORSASI ile sohbet"); assert.equal(satir.gonderen, "yon@gelen-deneme.com");
  assert.deepEqual([...depo.dosyalar.get(satir.depoYolu)!], [...ham], "posta ham hâliyle saklanır (sunucu açmaz)");
  const m2 = posta(`GELEN+${kod.toUpperCase()}@anahtarcrm.com`);
  assert.equal(await gelenPostaIsle(prisma, m2, depo), "kaydedildi", "gelen+KOD@ biçimi; aynı posta yeniden gelirse hata vermez");
  assert.equal(await ciplak.gelenDosya.count({ where: { ofisId: B.ofisId } }), once + 1, "aynı posta ikinci kez yazılmaz");
  for (const [m, neden] of [[posta("info@anahtarcrm.com"), /Unknown recipient/], [posta("abcdefghijkmnpqrstuv@anahtarcrm.com"), /Unknown recipient/], [posta(`${kod}@anahtarcrm.com`, ham, GELEN_SINIR + 1), /too large/]] as const) {
    assert.equal(await gelenPostaIsle(prisma, m, depo), "reddedildi"); assert.match(m.red!, neden);
  }
  assert.equal(await ciplak.gelenDosya.count({ where: { ofisId: B.ofisId } }), once + 1);
});

test("ZAMANLAYICI TEMİZLİĞİ: 45 günden eski dosyalar ve 1 yıldan eski atlananlar silinir; yeniler kalır", async () => {
  const depo = sahteDepo();
  await ciplak.gelenDosya.deleteMany({}); await ciplak.gelenAtlanan.deleteMany({});
  const yeni = await icinde(A, () => gelenKaydet(prisma, { ad: "yeni.zip", veri: zip(40, 11), kanal: "YUKLEME" }, depo));
  const eski = await icinde(B, () => gelenKaydet(prisma, { ad: "eski.zip", veri: zip(40, 12), kanal: "YUKLEME" }, depo));
  await ciplak.gelenDosya.update({ where: { id: eski.dosya.id }, data: { createdAt: new Date(Date.now() - 50 * 86_400_000) } });
  await icinde(A, () => atlananEkle(prisma, ["i:yeni", "i:eski"]));
  await ciplak.gelenAtlanan.updateMany({ where: { anahtar: "i:eski" }, data: { createdAt: new Date(Date.now() - 400 * 86_400_000) } });
  assert.deepEqual(await platformOlarak(() => gelenTemizlik(prisma, new Date(), depo)), { dosya: 1, atlanan: 1 });
  assert.deepEqual((await ciplak.gelenDosya.findMany({ select: { id: true } })).map((x) => x.id), [yeni.dosya.id]);
  assert.equal(depo.dosyalar.size, 1, "eski dosya depodan da silindi");
  assert.deepEqual(await icinde(A, () => atlananlariGetir(prisma)), ["i:yeni"]);
  await ciplak.gelenDosya.deleteMany({}); await ciplak.gelenAtlanan.deleteMany({});
});
