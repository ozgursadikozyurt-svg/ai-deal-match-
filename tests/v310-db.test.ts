/**
 * Anahtar CRM v3.22.2 · 10 Ekim 2026
 * v3.10 — veritabanlı: kayit_foto tablosu ve fotoğraf rotası (depo taklit edilir), Türkiye geneli konum çözümü,
 * diğer illerin başlangıç alt bölgeleri, ayarlar rotası (ai / paylasim / calismaIli).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { SADECE_TEST_baglamiSabitle, VARSAYILAN_OFIS_ID, VARSAYILAN_KULLANICI_ID, istemciyiSarmala } from "../src/lib/kiracilik";
// v3.20 — çok ofisli: testler varsayılan ofisin bağlamında çalışır (göçte açılan Özyurtlar Gayrimenkul)
SADECE_TEST_baglamiSabitle({ ofisId: VARSAYILAN_OFIS_ID, kullaniciId: VARSAYILAN_KULLANICI_ID, rol: "OFIS_YONETICISI", eposta: "test@anahtar.local" });


const prisma = istemciyiSarmala(new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL!, max: 1 }) }));
(globalThis as any).prisma = prisma;
const json = async (r: Response) => ({ durum: r.status, veri: (await r.json()) as any });

test("Türkiye geneli: 81 il yüklü, başlangıç alt bölgeleri var, /api/lokasyon/coz başka ili çözer", async () => {
  assert.equal(await prisma.il.count(), 81);
  const taksim = await prisma.altBolge.findFirst({ where: { ad: "Taksim" }, include: { ilce: true } });
  assert.equal(taksim?.ilId, 34); assert.equal(taksim?.ilce?.ad, "Beyoğlu"); assert.equal(taksim?.dogrulandi, false);
  assert.equal(await prisma.altBolge.count({ where: { ad: "Levent", ilId: 34 } }), 0, "Levent resmî mahalle; alt bölge eklenmez");
  const { POST } = await import("../src/app/api/lokasyon/coz/route");
  const cagir = (metin: string, ilId?: number) => POST(new Request("http://x", { method: "POST", body: JSON.stringify({ metin, ...(ilId ? { ilId } : {}) }) })).then(json);
  const izmir = await cagir("İzmir Bornova");
  assert.equal(izmir.veri.lokasyonlar[0].ilId, 35); assert.equal(izmir.veri.lokasyonlar[0].etiket, "Bornova · İzmir");
  const mahalle = await cagir("İstanbul Kadıköy Caferağa");
  assert.equal(mahalle.veri.lokasyonlar[0].seviye, "MAHALLE"); assert.equal(mahalle.veri.lokasyonlar[0].ilId, 34);
  const yerel = await cagir("Kepez, Lara");
  assert.deepEqual(yerel.veri.lokasyonlar.map((l: any) => l.etiket), ["Kepez", "Lara"]);
  assert.equal((await cagir("Bornova", 35)).veri.lokasyonlar[0].ilId, 35, "çalışma ili parametresi");
});

test("yorumla: başka ildeki talep o ilin kimliğiyle çözülür", async () => {
  const { POST } = await import("../src/app/api/ai/yorumla/route");
  const { veri } = await json(await POST(new Request("http://x", { method: "POST", body: JSON.stringify({ metin: "İzmir Bornova'da kiralık dükkan arıyorum 150 m2 bütçe ₺60.000" }) })));
  assert.equal(veri.parcalar[0].lokasyonlar[0].ilId, 35);
  assert.equal(veri.parcalar[0].h.maxFiyat, 60000);
  assert.equal(veri.esik, 70); assert.equal(veri.aiOnerilir, false);
});

test("ayarlar: ai / paylasim / calismaIli kaydedilir ve geri okunur; anahtar yanıtta yok", async () => {
  const { GET, PUT } = await import("../src/app/api/ayarlar/route");
  const ilk = await json(await GET());
  assert.equal(ilk.veri.ai.saglayici, "GEMINI"); assert.equal(ilk.veri.paylasim.adSoyad, "Özgür Özyurt"); assert.equal(ilk.veri.calismaIli, 7);
  assert.equal(typeof ilk.veri.aiAnahtarVar, "boolean");
  const yaz = await json(await PUT(new Request("http://x", { method: "PUT", body: JSON.stringify({ ai: { saglayici: "GROQ", model: "llama-3.3-70b-versatile", tabanUrl: "https://api.groq.com/openai/v1", esik: 60, otomatik: true }, paylasim: { adSoyad: "Deneme Kişi", telefon: "0532 000 00 00", unvan: "Danışman", firma: "Örnek" } }) })));
  assert.equal(yaz.durum, 200);
  const son = await json(await GET());
  assert.equal(son.veri.ai.saglayici, "GROQ"); assert.equal(son.veri.ai.esik, 60); assert.equal(son.veri.paylasim.firma, "Örnek");
  assert.ok(!JSON.stringify(son.veri).includes("API_KEY"));
  assert.equal((await json(await PUT(new Request("http://x", { method: "PUT", body: JSON.stringify({ ai: { esik: 5 } }) })))).durum, 422);
  await prisma.ayar.deleteMany({ where: { anahtar: { in: ["ai", "paylasim"] } } });
});

test("fotoğraflar: depo kapalıyken 503; açıkken yükle → listele → sırala → sil (depo taklit)", async () => {
  const { GET, POST, PATCH, DELETE } = await import("../src/app/api/kayit/[id]/fotolar/route");
  const portfoy = await prisma.kayit.findFirstOrThrow({ where: { tip: "PORTFOY" } });
  const talep = await prisma.kayit.findFirstOrThrow({ where: { tip: "TALEP" } });
  const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
  const form = (ad = "salon.jpg", tur = "image/jpeg", boyut = 2000) => { const f = new FormData(); f.set("dosya", new File([new Uint8Array(boyut)], ad, { type: tur })); f.set("en", "1600"); f.set("boy", "1200"); return f; };
  const yukle = (id: string, f = form()) => POST(new Request("http://x", { method: "POST", body: f }), ctx(id)).then(json);

  delete process.env.SUPABASE_URL; delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  const kapali = await yukle(portfoy.id);
  assert.equal(kapali.durum, 503); assert.equal(kapali.veri.hata, "DEPO_KAPALI");
  assert.equal(await prisma.kayitFoto.count({ where: { kayitId: portfoy.id } }), 0, "yükleme başarısızsa satır kalmaz");

  process.env.SUPABASE_URL = "https://proje.supabase.co"; process.env.SUPABASE_SERVICE_ROLE_KEY = "gizli";
  const asil = globalThis.fetch; const depo: string[] = [];
  globalThis.fetch = (async (url: any, init: any) => {
    const u = String(url);
    if (!u.startsWith("https://proje.supabase.co/storage/v1/")) throw new Error("beklenmeyen çağrı " + u);
    if (u.includes("/object/sign/")) return new Response(JSON.stringify(JSON.parse(init.body).paths.map((p: string) => ({ path: p, signedURL: `/object/sign/portfoy/${p}?token=t` }))), { status: 200 });
    depo.push(`${init.method} ${u.split("/storage/v1/")[1]}`);
    return new Response("{}", { status: 200 });
  }) as any;
  try {
    assert.equal((await yukle(talep.id)).durum, 422, "talebe fotoğraf eklenmez");
    assert.equal((await yukle(portfoy.id, form("belge.pdf", "application/pdf"))).durum, 422);
    const a = await yukle(portfoy.id), b = await yukle(portfoy.id, form("mutfak.jpg"));
    assert.equal(a.durum, 201); assert.equal(a.veri.sira, 0); assert.equal(b.veri.sira, 1); assert.equal(b.veri.ad, "mutfak");
    assert.match(a.veri.url, /^https:\/\/proje\.supabase\.co\/storage\/v1\/object\/sign\/portfoy\//);
    assert.equal(a.veri.depoYolu, undefined, "depo yolu istemciye verilmez");
    assert.equal(depo[0], `POST object/portfoy/${VARSAYILAN_OFIS_ID}/${portfoy.id}/${a.veri.id}.jpg`);
    const liste = await json(await GET(new Request("http://x"), ctx(portfoy.id)));
    assert.deepEqual(liste.veri.map((f: any) => f.ad), ["salon", "mutfak"]);
    const sira = await json(await PATCH(new Request("http://x", { method: "PATCH", body: JSON.stringify({ sira: [b.veri.id, a.veri.id] }) }), ctx(portfoy.id)));
    assert.equal(sira.durum, 200);
    assert.equal((await json(await PATCH(new Request("http://x", { method: "PATCH", body: JSON.stringify({ sira: [b.veri.id] }) }), ctx(portfoy.id)))).durum, 422);
    assert.equal((await json(await GET(new Request("http://x"), ctx(portfoy.id)))).veri[0].ad, "mutfak", "kapak değişti");
    const sil = await json(await DELETE(new Request(`http://x/?fotoId=${b.veri.id}`, { method: "DELETE" }), ctx(portfoy.id)));
    assert.equal(sil.veri.silindi, true);
    const kalan = await prisma.kayitFoto.findMany({ where: { kayitId: portfoy.id } });
    assert.equal(kalan.length, 1); assert.equal(kalan[0].sira, 0);
    assert.ok(depo.some((d) => d === "DELETE object/portfoy"));
    for (let i = 0; i < 7; i++) assert.equal((await yukle(portfoy.id)).durum, 201);
    const dokuzuncu = await yukle(portfoy.id);
    assert.equal(dokuzuncu.durum, 422); assert.match(dokuzuncu.veri.mesaj, /en fazla 8/);
    await prisma.kayitFoto.deleteMany({ where: { kayitId: portfoy.id } });
  } finally { globalThis.fetch = asil; delete process.env.SUPABASE_URL; delete process.env.SUPABASE_SERVICE_ROLE_KEY; }
});

test.after(() => prisma.$disconnect());