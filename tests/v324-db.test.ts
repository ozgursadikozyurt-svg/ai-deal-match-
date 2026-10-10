/**
 * Anahtar CRM v3.24 · 10 Ekim 2026
 * v3.24 — veritabanlı: fotoğraf DOĞRUDAN yükleme. Sunucu yalnızca künyeyi yazar ve tek kullanımlık yükleme bağlantısı verir;
 * dosya baytları Worker'dan geçmez (Cloudflare ücretsiz plan 10 ms işlemci → 503). Depo taklit edilir.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { SADECE_TEST_baglamiSabitle, VARSAYILAN_OFIS_ID, VARSAYILAN_KULLANICI_ID, istemciyiSarmala } from "../src/lib/kiracilik";
SADECE_TEST_baglamiSabitle({ ofisId: VARSAYILAN_OFIS_ID, kullaniciId: VARSAYILAN_KULLANICI_ID, rol: "OFIS_YONETICISI", eposta: "test@anahtar.local" });

const prisma = istemciyiSarmala(new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL!, max: 1 }) }));
(globalThis as any).prisma = prisma;
const json = async (r: Response) => ({ durum: r.status, veri: (await r.json()) as any });

test("fotoğraf doğrudan yükleme: JSON künye → satır + yükleme bağlantısı; dosya sunucuya gelmez; denetimler aynı", async () => {
  const { POST, DELETE } = await import("../src/app/api/kayit/[id]/fotolar/route");
  const portfoy = await prisma.kayit.findFirstOrThrow({ where: { tip: "PORTFOY" } });
  const talep = await prisma.kayit.findFirstOrThrow({ where: { tip: "TALEP" } });
  const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
  const kunye = (ek: Record<string, unknown> = {}) => ({ ad: "salon.jpg", en: 1600, boy: 1200, boyut: 420_000, tur: "image/jpeg", ...ek });
  const iste = (id: string, govde = kunye()) => POST(new Request("http://x", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(govde) }), ctx(id)).then(json);
  await prisma.kayitFoto.deleteMany({ where: { kayitId: portfoy.id } });

  process.env.SUPABASE_URL = "https://proje.supabase.co"; process.env.SUPABASE_SERVICE_ROLE_KEY = "gizli"; process.env.SUPABASE_ANON_KEY = "acik-anahtar";
  const asil = globalThis.fetch; const cagri: string[] = [];
  globalThis.fetch = (async (url: any, init: any) => {
    const u = String(url); cagri.push(`${init?.method} ${u.split("/storage/v1/")[1]}`);
    if (u.includes("/object/upload/sign/")) return new Response(JSON.stringify({ url: `/object/upload/sign/${u.split("/object/upload/sign/")[1]}?token=tek-kullanim` }), { status: 200 });
    return new Response("{}", { status: 200 });
  }) as any;
  try {
    assert.equal((await iste(talep.id)).durum, 422, "talebe fotoğraf eklenmez");
    assert.equal((await iste(portfoy.id, kunye({ tur: "application/pdf" }))).durum, 422);
    assert.equal((await iste(portfoy.id, kunye({ boyut: 3_000_000 }))).durum, 422, "küçültülmemiş dosya");
    const a = await iste(portfoy.id);
    assert.equal(a.durum, 201); assert.equal(a.veri.ad, "salon"); assert.equal(a.veri.sira, 0); assert.equal(a.veri.apikey, "acik-anahtar");
    assert.match(a.veri.yukle, new RegExp(`^https://proje\\.supabase\\.co/storage/v1/object/upload/sign/portfoy/${VARSAYILAN_OFIS_ID}/${portfoy.id}/${a.veri.id}\\.jpg\\?token=tek-kullanim$`));
    assert.deepEqual(cagri, [`POST object/upload/sign/portfoy/${VARSAYILAN_OFIS_ID}/${portfoy.id}/${a.veri.id}.jpg`], "sunucu dosya yüklemedi, yalnızca bağlantı istedi");
    const satir = await prisma.kayitFoto.findUniqueOrThrow({ where: { id: a.veri.id } });
    assert.equal(satir.depoYolu, `${VARSAYILAN_OFIS_ID}/${portfoy.id}/${a.veri.id}.jpg`); assert.equal(satir.boyut, 420_000); assert.equal(satir.ofisId, VARSAYILAN_OFIS_ID);
    assert.equal((await iste(portfoy.id)).veri.sira, 1);
    // tarayıcıdan yükleme olmazsa istemci yarım künyeyi siler
    assert.equal((await json(await DELETE(new Request(`http://x/?fotoId=${a.veri.id}`, { method: "DELETE" }), ctx(portfoy.id)))).veri.silindi, true);
    // depo bağlantı veremezse satır yazılmaz
    globalThis.fetch = (async () => new Response("bucket yok", { status: 400 })) as any;
    const once = await prisma.kayitFoto.count({ where: { kayitId: portfoy.id } });
    assert.equal((await iste(portfoy.id)).durum, 502);
    assert.equal(await prisma.kayitFoto.count({ where: { kayitId: portfoy.id } }), once);
    await prisma.kayitFoto.deleteMany({ where: { kayitId: portfoy.id } });
  } finally { globalThis.fetch = asil; delete process.env.SUPABASE_URL; delete process.env.SUPABASE_SERVICE_ROLE_KEY; delete process.env.SUPABASE_ANON_KEY; }
});

test.after(() => prisma.$disconnect());
