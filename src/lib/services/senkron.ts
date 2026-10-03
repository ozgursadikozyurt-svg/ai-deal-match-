/**
 * Anahtar CRM v3.13 · 3 Ekim 2026
 * Ekosistem senkron işi — Google Kişiler ve Notion. Planlama saf modüllerde (google/kisiler.ts, notion/plan.ts),
 * bu dosya planı veritabanına uygular, çalışma geçmişini ve çakışmaları yazar.
 *
 * Tetikleyiciler: Supabase pg_cron → POST /api/senkron/calistir (her 15 dk) · ekrandaki "Şimdi senkronize et".
 * Süre bütçesi: iş kaldığı yeri (Google sayfa anahtarı, Notion imleci) saklar; bütçe dolarsa sonraki tetikte devam eder.
 * Kilit: Entegrasyon.kilitBitis — iki iş aynı anda aynı bağlantıyı işlemez.
 */
import type { PrismaClient, Prisma } from "../../generated/prisma/client";
import { googleKisiDonustur, googleSenkronPlani, GOOGLE_ALANLARI, type GoogleDonusum, type GooglePerson, type MevcutKisi } from "../google/kisiler";
import { erisimYenile, gruplar, kisiSayfasi, GoogleHatasi } from "../google/istemci";
import { coz as sifreCoz } from "../guvenlik/sifre";
import { notionIstemcisi, type NotionIstemcisi } from "../notion/istemci";
import { dataSourceId, SENKRON_SIRASI, NOTION_TABLOLARI, type NotionTablo } from "../notion/yapilandirma";
import { kisiTaslagi, portfoyTaslagi, talepTaslagi, kisidenTalep, kayitHazirla, type KisiTaslagi, type KayitTaslagi, type NotionSayfa } from "../notion/donustur";
import { kisiPlani, kayitPlani, kaybolanlar, type MevcutNotionKayit, type MevcutNotionKisi, type HazirKayit } from "../notion/plan";
import { geriYazimDegerleri, geriYazimOzellikleri, geriYazimGerekli, eksikGeriYazimAlanlari } from "../notion/geri-yazim";
import { eslesmeOzetleri } from "../eslestirme/ozet";
import { eslesmeOnizle, type LokasyonBaglami } from "../eslestirme/onizleme";
import { komsulukKur } from "../lokasyon/komsuluk";
import { lokasyonIndeksiYukle } from "../lokasyon/cozumle";
import { kayitOlustur, ttlAyarlari } from "./kayit";
import { varsayilanValidUntil } from "../domain/gecerlilik";
import type { AlanCakismasi } from "../senkron/birlestir";

type Saglayici = "GOOGLE_KISILER" | "NOTION";
type Fetch = typeof fetch;
export interface SenkronSecenek { tetik?: string; tam?: boolean; butceMs?: number; f?: Fetch; simdi?: () => Date }
export interface EntegrasyonAyarlari { otomatik: boolean; aralikDk: number; geriYaz: boolean; googleYaz: boolean; sadeceEtiketler: string[] }
export const VARSAYILAN_AYAR: EntegrasyonAyarlari = { otomatik: true, aralikDk: 15, geriYaz: true, googleYaz: false, sadeceEtiketler: [] };
/** v3.7 — Google'a kaydedilen kişi birkaç dakikada gelsin: Google varsayılanı 5 dk (People API'de anlık bildirim yok; artımlı çekim ucuz) */
export const varsayilanAyar = (s: string): EntegrasyonAyarlari => (s === "GOOGLE_KISILER" ? { ...VARSAYILAN_AYAR, aralikDk: 5 } : VARSAYILAN_AYAR);
const J = (v: unknown) => (v ?? null) as Prisma.InputJsonValue;

// ───────── Ortak ─────────
export async function entegrasyon(prisma: PrismaClient, s: Saglayici) {
  return prisma.entegrasyon.upsert({ where: { saglayici: s }, update: {}, create: { saglayici: s, ayarlar: J(varsayilanAyar(s)) } });
}
export const ayarlarOf = (e: { ayarlar: unknown; saglayici?: string }): EntegrasyonAyarlari => ({ ...varsayilanAyar(e.saglayici ?? ""), ...((e.ayarlar as object) ?? {}) });

async function kilitAl(prisma: PrismaClient, s: Saglayici, ms: number): Promise<boolean> {
  const simdi = new Date();
  const r = await prisma.entegrasyon.updateMany({ where: { saglayici: s, OR: [{ kilitBitis: null }, { kilitBitis: { lt: simdi } }] }, data: { kilitBitis: new Date(simdi.getTime() + ms) } });
  return r.count === 1;
}
const kilitBirak = (prisma: PrismaClient, s: Saglayici) => prisma.entegrasyon.update({ where: { saglayici: s }, data: { kilitBitis: null } });

async function cakismalariYaz(prisma: PrismaClient, s: Saglayici, hedefTip: "KISI" | "KAYIT", hedefId: string, cs: AlanCakismasi[]) {
  for (const c of cs) {
    const var_ = await prisma.senkronCakisma.findFirst({ where: { saglayici: s, hedefId, alan: c.alan, durum: "ACIK" } });
    const veri = { onceki: J(c.onceki), yerel: J(c.yerel), uzak: J(c.uzak) };
    if (var_) await prisma.senkronCakisma.update({ where: { id: var_.id }, data: veri });
    else await prisma.senkronCakisma.create({ data: { saglayici: s, hedefTip, hedefId, alan: c.alan, ...veri } });
  }
}

/** Sunucu tarafı konum bağlamı (komşu ilçeler, alt bölge mahalleleri) — eşleşme skoru için */
export async function lokasyonBaglamiYukle(prisma: PrismaClient): Promise<LokasyonBaglami> {
  const [k, a] = await Promise.all([prisma.ilceKomsuluk.findMany(), prisma.altBolgeMahalle.findMany()]);
  const m = new Map<number, Set<number>>();
  for (const x of a) { if (!m.has(x.altBolgeId)) m.set(x.altBolgeId, new Set()); m.get(x.altBolgeId)!.add(x.mahalleId); }
  // v3.11 — mahalle komşuluğu: Antalya mahalleleri (ilçe adı + slug) veritabanı kimliklerine bağlanır
  const mah = await prisma.mahalle.findMany({ where: { ilce: { ilId: 7 } }, select: { id: true, ad: true, slug: true, ilceId: true, ilce: { select: { ad: true } } } });
  const anahtar = new Map(mah.map((x) => [`${x.ilce.ad}|${x.slug}`, x]));
  const adlar = new Map(mah.map((x) => [x.id, x.ad]));
  const komsuluk = komsulukKur((ilce, slug) => { const x = anahtar.get(`${ilce}|${slug}`); return x ? { id: x.id, ilceId: x.ilceId } : null; });
  return { komsuIlceler: new Set(k.flatMap((x) => [`${x.ilceId}-${x.komsuIlceId}`, `${x.komsuIlceId}-${x.ilceId}`])), altBolgeMahalleleri: m, komsuluk, mahalleAdi: (id) => adlar.get(id) };
}
/** DB satırı → eşleştirme motorunun beklediği düz veri (Decimal → number) */
export function kayitVeri(k: any): Record<string, any> {
  const n = (v: any) => (v == null ? null : Number(v));
  return { ...k, fiyat: n(k.fiyat), minFiyat: n(k.minFiyat), maxFiyat: n(k.maxFiyat), lokasyonlar: k.lokasyonlar ?? [], ozellik: k.ozellik ?? undefined };
}

// ───────────────────────────── GOOGLE KİŞİLER ─────────────────────────────
export async function googleSenkronCalistir(prisma: PrismaClient, o: SenkronSecenek = {}) {
  const f = o.f ?? fetch, butce = o.butceMs ?? 45_000, bas = Date.now();
  const e = await entegrasyon(prisma, "GOOGLE_KISILER");
  if (e.durum !== "BAGLI" || !e.tokenSifreli) return { atlandi: "Google Kişiler bağlı değil" };
  if (!(await kilitAl(prisma, "GOOGLE_KISILER", butce + 15_000))) return { atlandi: "Başka bir senkron sürüyor" };
  const calisma = await prisma.senkronCalisma.create({ data: { saglayici: "GOOGLE_KISILER", tetik: o.tetik ?? "zamanlayici" } });
  try {
    const ayar = ayarlarOf(e);
    const tok = await erisimYenile(f, { refreshToken: sifreCoz(e.tokenSifreli), clientId: process.env.GOOGLE_CLIENT_ID!, clientSecret: process.env.GOOGLE_CLIENT_SECRET! });
    const grupAdi = new Map((await gruplar(f, tok.access_token)).map((g) => [g.resourceName, g.formattedName ?? g.name ?? ""]));
    let syncToken = o.tam ? null : e.syncToken;
    let sayfa = ((e.imlec as any)?.sayfa as string | null) ?? null;
    const kisiler: GooglePerson[] = [];
    let yeniSync: string | null = null, bitti = false;
    while (Date.now() - bas < butce) {
      let r;
      try { r = await kisiSayfasi(f, tok.access_token, { sayfaToken: sayfa, syncToken }); }
      catch (x) { if (x instanceof GoogleHatasi && x.neden === "SYNC_TOKEN_DOLDU" && syncToken) { syncToken = null; sayfa = null; kisiler.length = 0; continue; } throw x; }
      kisiler.push(...(r.connections ?? []));
      sayfa = r.nextPageToken ?? null;
      if (!sayfa) { yeniSync = r.nextSyncToken ?? null; bitti = true; break; }
    }
    const donusum: GoogleDonusum[] = kisiler.map((p) => googleKisiDonustur(p, grupAdi, ayar.sadeceEtiketler));
    const mevcut = (await prisma.kisi.findMany()).map((k): MevcutKisi => ({ id: k.id, adSoyad: k.adSoyad, telefon: k.telefon, ikincilTelefon: k.ikincilTelefon, email: k.email, sirket: k.sirket, notlar: k.notlar, roller: k.roller, googleResourceName: k.googleResourceName, googleSnapshot: k.googleSnapshot as any }));
    const plan = googleSenkronPlani(mevcut, donusum);

    for (const x of plan.ekle) {
      try { await prisma.kisi.create({ data: { ...(x.alanlar as any), roller: x.roller as any, kaynak: "GOOGLE", googleResourceName: x.resourceName, googleEtag: x.etag, googleSnapshot: J(x.snapshot) } }); }
      catch (err: any) { if (err?.code !== "P2002") throw err; plan.ozet.yeni--; plan.ozet.birlesen++; } // aynı anda başka kanaldan eklendiyse
    }
    for (const x of plan.guncelle) {
      const k = mevcut.find((m) => m.id === x.id)!;
      await prisma.kisi.update({ where: { id: x.id }, data: { ...(x.degisiklik as any), roller: [...new Set([...k.roller, ...x.yeniRoller])] as any, googleResourceName: x.resourceName, googleEtag: x.etag, googleSnapshot: J(x.snapshot), kaynaktaSilindi: null } });
      await cakismalariYaz(prisma, "GOOGLE_KISILER", "KISI", x.id, x.cakismalar);
    }
    for (const x of plan.bagiKopar) {
      const k = await prisma.kisi.findUnique({ where: { id: x.id } });
      await prisma.kisi.update({ where: { id: x.id }, data: { googleResourceName: null, googleSnapshot: J(null), kaynaktaSilindi: new Date(), notlar: [k?.notlar, `Google Kişiler'den silindi (${new Date().toLocaleDateString("tr-TR")})`].filter(Boolean).join("\n") } });
    }
    await prisma.entegrasyon.update({ where: { saglayici: "GOOGLE_KISILER" }, data: { syncToken: bitti ? yeniSync : syncToken, imlec: J(bitti ? null : { sayfa }), sonSenkron: new Date(), sonHata: null } });
    await prisma.senkronCalisma.update({ where: { id: calisma.id }, data: { bitis: new Date(), durum: plan.ozet.cakisma ? "CAKISMA" : "BASARILI", yeni: plan.ozet.yeni, guncellenen: plan.ozet.guncellenen, baglanan: plan.ozet.baglanan, cakisma: plan.ozet.cakisma, atlanan: plan.ozet.atlanan, silinen: plan.ozet.silinen, devamEdecek: !bitti, ozet: J(plan.ozet) } });
    return { calismaId: calisma.id, ozet: plan.ozet, devamEdecek: !bitti };
  } catch (x: any) {
    const yeniden = x instanceof GoogleHatasi && x.neden === "YENIDEN_YETKI";
    await prisma.entegrasyon.update({ where: { saglayici: "GOOGLE_KISILER" }, data: { sonHata: String(x?.message ?? x), ...(yeniden ? { durum: "YENIDEN_YETKI" } : {}) } });
    await prisma.senkronCalisma.update({ where: { id: calisma.id }, data: { bitis: new Date(), durum: "HATA", hata: String(x?.message ?? x).slice(0, 1000) } });
    throw x;
  } finally { await kilitBirak(prisma, "GOOGLE_KISILER"); }
}

// ───────────────────────────── NOTION ─────────────────────────────
/** Bir tablodan (artımlı ya da tam) sayfaları süre bütçesi içinde çeker */
async function sayfalariCek(n: NotionIstemcisi, t: NotionTablo, im: { sonra?: string | null; imlec?: string | null }, tam: boolean, bitisZamani: number) {
  const sayfalar: NotionSayfa[] = [];
  let imlec = im.imlec ?? null, enSon = im.sonra ?? null, bitti = false;
  const sonra = tam ? null : im.sonra ? new Date(new Date(im.sonra).getTime() - 120_000).toISOString() : null; // Notion dakikaya yuvarlar → 2 dk geri
  while (Date.now() < bitisZamani) {
    const r = await n.sorgula(dataSourceId(t), { imlec, sonra });
    sayfalar.push(...r.results);
    for (const s of r.results) if (!enSon || s.last_edited_time > enSon) enSon = s.last_edited_time;
    if (!r.has_more) { bitti = true; imlec = null; break; }
    imlec = r.next_cursor;
  }
  return { sayfalar, bitti, imlec, enSon };
}

export async function notionSenkronCalistir(prisma: PrismaClient, o: SenkronSecenek & { token?: string; uygulamaUrl?: string } = {}) {
  const butce = o.butceMs ?? 45_000, bas = Date.now(), simdi = o.simdi?.() ?? new Date();
  const e = await entegrasyon(prisma, "NOTION");
  const token = o.token ?? process.env.NOTION_TOKEN;
  if (e.durum !== "BAGLI" || !token) return { atlandi: "Notion bağlı değil" };
  if (!(await kilitAl(prisma, "NOTION", butce + 15_000))) return { atlandi: "Başka bir senkron sürüyor" };
  const calisma = await prisma.senkronCalisma.create({ data: { saglayici: "NOTION", tetik: o.tetik ?? "zamanlayici" } });
  const n = notionIstemcisi(token, o.f ?? fetch);
  const imlec: any = { ...((e.imlec as object) ?? {}) };
  const ayar = ayarlarOf(e);
  // Günde bir tam tarama: Notion'da silinen sayfaları yakalamak için
  const tam = o.tam || !imlec.tamTarama || simdi.getTime() - new Date(imlec.tamTarama).getTime() > 86_400_000;
  const ozet = { yeni: 0, guncellenen: 0, baglanan: 0, degismeyen: 0, cakisma: 0, kontrol: 0, hatali: 0, arsivlenen: 0, geriYazilan: 0, notionEslesmesi: 0, kisiYeni: 0, kisiGuncellenen: 0 };
  const kontrolListesi: { notionId: string; baslik: string; nedenler: string[] }[] = [];
  const hataListesi: { notionId: string; baslik: string; hatalar: string[] }[] = [];
  let devam = false;
  try {
    const ix = await lokasyonIndeksiYukle(prisma);
    const ttl = await ttlAyarlari(prisma);
    const turetilenTalepler: KayitTaslagi[] = [];
    const tumGorulen: Record<string, Set<string>> = {};
    const notionEslesmeleri: [string, string][] = [];
    for (const t of SENKRON_SIRASI) {
      const c = await sayfalariCek(n, t, imlec[t] ?? {}, tam, bas + butce * 0.7);
      if (!c.bitti) devam = true;
      imlec[t] = { sonra: c.bitti ? c.enSon : (imlec[t]?.sonra ?? null), imlec: c.imlec };
      if (tam && c.bitti) tumGorulen[t] = new Set(c.sayfalar.map((s) => s.id));

      if (t === "KISI") {
        const taslaklar = c.sayfalar.map(kisiTaslagi).filter((x): x is KisiTaslagi => !!x);
        const mevcut = (await prisma.kisi.findMany()).map((k): MevcutNotionKisi => ({ id: k.id, adSoyad: k.adSoyad, telefon: k.telefon, notlar: k.notlar, referans: k.referans, roller: k.roller, uzmanlikAileleri: k.uzmanlikAileleri, ilanSahibiTipi: k.ilanSahibiTipi, notionId: k.notionId, notionSnapshot: k.notionSnapshot as any }));
        const p = kisiPlani(mevcut, taslaklar);
        for (const x of p.ekle) {
          const a = x.taslak.alanlar;
          try { await prisma.kisi.create({ data: { ...a, roller: x.taslak.roller as any, uzmanlikAileleri: x.taslak.uzmanlikAileleri, ilanSahibiTipi: (x.taslak.ilanSahibiTipi ?? "BILINMIYOR") as any, kaynak: "NOTION", notionId: x.taslak.notionId, notionSnapshot: J(a) } }); ozet.kisiYeni++; }
          catch (err: any) { if (err?.code !== "P2002") throw err; }
        }
        for (const x of p.guncelle) {
          const k = mevcut.find((m) => m.id === x.id)!;
          await prisma.kisi.update({ where: { id: x.id }, data: { ...(x.degisiklik as any), roller: [...new Set([...k.roller, ...x.yeniRoller])] as any, uzmanlikAileleri: [...new Set([...k.uzmanlikAileleri, ...x.yeniUzmanlik])], ...(x.ilanSahibiTipi ? { ilanSahibiTipi: x.ilanSahibiTipi as any } : {}), notionId: x.taslak.notionId, notionSnapshot: J(x.snapshot) } });
          await cakismalariYaz(prisma, "NOTION", "KISI", x.id, x.cakismalar);
          if (Object.keys(x.degisiklik).length || x.yeniRoller.length) ozet.kisiGuncellenen++;
          ozet.cakisma += x.cakismalar.length;
        }
        for (const k of taslaklar) { const tt = kisidenTalep(k, k.sonDuzenleme); if (tt) turetilenTalepler.push(tt); }
        continue;
      }

      const kisiMap = new Map((await prisma.kisi.findMany({ where: { notionId: { not: null } }, select: { id: true, notionId: true } })).map((k) => [k.notionId!, k.id]));
      const taslaklar = [...c.sayfalar.map(t === "PORTFOY" ? portfoyTaslagi : talepTaslagi), ...(t === "TALEP" ? turetilenTalepler : [])];
      const hazir: HazirKayit[] = taslaklar.map((tt) => ({ taslak: tt, ...kayitHazirla(tt, ix, (id) => kisiMap.get(id), varsayilanValidUntil(tt.tablo, tt.girdi.islemTipi as string, tt.girdi.aciliyet as string, simdi, ttl)) }));
      const mevcutRows = await prisma.kayit.findMany({ where: { tip: t }, include: { lokasyonlar: true, ozellik: true } });
      const mevcut: MevcutNotionKayit[] = mevcutRows.map((k) => ({ id: k.id, tip: t, notionId: k.notionId, notionSnapshot: k.notionSnapshot as any, veri: kayitVeri(k), ilceler: k.lokasyonlar.map((l) => l.ilceId).filter((x): x is number => x != null) }));
      const p = kayitPlani(mevcut, hazir);
      for (const x of p.ekle) {
        try {
          const k = await kayitOlustur(prisma, x.veri);
          await prisma.kayit.update({ where: { id: k.id }, data: { notionId: x.taslak.notionId, notionSonSync: simdi, notionSnapshot: J({ ...Object.fromEntries(Object.entries(x.veri).filter(([a]) => a !== "lokasyonlar" && a !== "kisiler" && a !== "ozellik")), __tablo: x.taslak.tablo, __duzenleme: x.taslak.sonDuzenleme }) } });
          ozet.yeni++;
          if (x.kontrol.length) { ozet.kontrol++; kontrolListesi.push({ notionId: x.taslak.notionId, baslik: String(x.veri.baslik ?? ""), nedenler: x.kontrol }); }
        } catch (err: any) {
          if (err?.code !== "P2002") throw err;
          hataListesi.push({ notionId: x.taslak.notionId, baslik: String(x.veri.baslik ?? ""), hatalar: ["Aynı metinli kayıt zaten var (WhatsApp'tan gelmiş olabilir)"] });
        }
      }
      for (const x of p.guncelle) {
        const d: any = { ...x.degisiklik };
        if ("lokasyonHam" in d) {
          await prisma.kayitLokasyon.deleteMany({ where: { kayitId: x.id } });
          d.lokasyonlar = { create: x.veri.lokasyonlar.map((l, sira) => ({ ...l, sira })) };
        }
        await prisma.kayit.update({ where: { id: x.id }, data: { ...d, notionId: x.taslak.notionId, notionSonSync: simdi, notionSnapshot: J(x.snapshot) } });
        for (const b of x.veri.kisiler) await prisma.kayitKisi.upsert({ where: { kayitId_kisiId_rol: { kayitId: x.id, kisiId: b.kisiId, rol: b.rol as any } }, update: {}, create: { kayitId: x.id, kisiId: b.kisiId, rol: b.rol as any } });
        await cakismalariYaz(prisma, "NOTION", "KAYIT", x.id, x.cakismalar);
      }
      for (const x of [...p.arsivle, ...(tam && tumGorulen[t] ? kaybolanlar(mevcut, t, tumGorulen[t]) : [])])
        await prisma.kayit.update({ where: { id: x.id }, data: { durum: "ARSIV", arsivNotu: "Notion'da silindi / çöpe atıldı" } });
      notionEslesmeleri.push(...p.notionEslesmeleri);
      ozet.guncellenen += p.ozet.guncellenen; ozet.baglanan += p.ozet.baglanan; ozet.degismeyen += p.ozet.degismeyen; ozet.cakisma += p.ozet.cakisma; ozet.hatali += p.ozet.hatali; ozet.arsivlenen += p.ozet.arsivlenen;
      hataListesi.push(...p.hatali);
    }

    // Notion'da talebe elle bağlanmış portföyler → eşleşme takibine "Bildirildi"
    if (notionEslesmeleri.length) {
      const b = await lokasyonBaglamiYukle(prisma);
      for (const [tn, pn] of notionEslesmeleri) {
        const [tk, pk] = await Promise.all([prisma.kayit.findUnique({ where: { notionId: tn }, include: { lokasyonlar: true, ozellik: true } }), prisma.kayit.findUnique({ where: { notionId: pn }, include: { lokasyonlar: true, ozellik: true } })]);
        if (!tk || !pk) continue;
        const s = eslesmeOnizle(kayitVeri(tk) as any, kayitVeri(pk) as any, b);
        await prisma.match.upsert({ where: { talepId_portfoyId: { talepId: tk.id, portfoyId: pk.id } }, update: {}, create: { talepId: tk.id, portfoyId: pk.id, matematikSkor: s.skor, finalSkor: s.skor, uygunluk: s.uygunluk, durum: "BILDIRILDI", operasyonNotu: "Notion'da ilişkilendirilmişti" } });
        ozet.notionEslesmesi++;
      }
    }

    // Geri yazım: eşleşme skoru, sayısı, en iyi eşleşme, uygulama linki
    if (ayar.geriYaz && Date.now() - bas < butce) {
      if (!imlec.alanlarHazir) {
        for (const t of ["PORTFOY", "TALEP"] as const) {
          const sema = await n.semaGetir(dataSourceId(t));
          const eksik = eksikGeriYazimAlanlari(Object.keys(sema.properties));
          if (Object.keys(eksik).length) await n.alanEkle(dataSourceId(t), eksik);
        }
        imlec.alanlarHazir = true;
      }
      const tum = await prisma.kayit.findMany({ where: { durum: "ACTIVE" }, include: { lokasyonlar: true, ozellik: true } });
      const oz = eslesmeOzetleri(tum.map((k) => ({ id: k.id, veri: kayitVeri(k) })), await lokasyonBaglamiYukle(prisma));
      const url = (o.uygulamaUrl ?? process.env.UYGULAMA_URL ?? "").replace(/\/$/, "");
      for (const k of tum) {
        if (!k.notionId || k.notionId.includes("#")) continue;
        if (Date.now() - bas > butce) { devam = true; break; }
        const d = geriYazimDegerleri(oz.get(k.id), url ? `${url}/kayit/${k.id}` : null);
        if (!geriYazimGerekli(k.notionGeriYazim, d)) continue;
        try {
          const s = await n.sayfaGuncelle(k.notionId, geriYazimOzellikleri(d, simdi));
          await prisma.kayit.update({ where: { id: k.id }, data: { notionGeriYazim: J(d), notionSonSync: new Date(s.last_edited_time ?? simdi) } });
          ozet.geriYazilan++;
        } catch (err: any) {
          await prisma.notionSyncLog.create({ data: { kayitId: k.id, notionId: k.notionId, yon: "anahtar_to_notion", durum: "HATA", hata: String(err?.message ?? err).slice(0, 500) } });
        }
      }
    }
    if (tam && !devam) imlec.tamTarama = simdi.toISOString();
    await prisma.entegrasyon.update({ where: { saglayici: "NOTION" }, data: { imlec: J(imlec), sonSenkron: new Date(), sonHata: null } });
    await prisma.senkronCalisma.update({ where: { id: calisma.id }, data: { bitis: new Date(), durum: ozet.cakisma ? "CAKISMA" : "BASARILI", yeni: ozet.yeni, guncellenen: ozet.guncellenen, baglanan: ozet.baglanan, cakisma: ozet.cakisma, atlanan: ozet.hatali, silinen: ozet.arsivlenen, geriYazilan: ozet.geriYazilan, devamEdecek: devam, ozet: J({ ...ozet, kontrolListesi: kontrolListesi.slice(0, 50), hataListesi: hataListesi.slice(0, 50) }) } });
    return { calismaId: calisma.id, ozet, kontrolListesi, hataListesi, devamEdecek: devam };
  } catch (x: any) {
    await prisma.entegrasyon.update({ where: { saglayici: "NOTION" }, data: { sonHata: String(x?.message ?? x), imlec: J(imlec) } });
    await prisma.senkronCalisma.update({ where: { id: calisma.id }, data: { bitis: new Date(), durum: "HATA", hata: String(x?.message ?? x).slice(0, 1000) } });
    throw x;
  } finally { await kilitBirak(prisma, "NOTION"); }
}

/** Notion bağlantısını doğrular: üç tablo erişilebilir mi, beklenen alanlar var mı (bağlantı raporu) */
export async function notionBaglantiRaporu(token: string, f: Fetch = fetch) {
  const { alanRaporu } = await import("../notion/geri-yazim");
  const n = notionIstemcisi(token, f);
  const tablolar = [];
  for (const t of SENKRON_SIRASI) {
    try {
      const s = await n.semaGetir(dataSourceId(t));
      tablolar.push({ tablo: t, ad: NOTION_TABLOLARI[t].ad, erisim: true, ...alanRaporu(NOTION_TABLOLARI[t].alan as any, s.properties, NOTION_TABLOLARI[t].okunmayan as any) });
    } catch (x: any) { tablolar.push({ tablo: t, ad: NOTION_TABLOLARI[t].ad, erisim: false, hata: String(x?.message ?? x) }); }
  }
  return { tamam: tablolar.every((t) => t.erisim), tablolar };
}

// ───────── Hepsi + çakışma çözümü ─────────
export async function senkronCalistir(prisma: PrismaClient, o: SenkronSecenek & { kaynak?: "google" | "notion" | "hepsi" } = {}) {
  const sonuc: Record<string, unknown> = {};
  const otomatik = (o.tetik ?? "zamanlayici") === "zamanlayici";
  for (const [ad, s, fn] of [["google", "GOOGLE_KISILER", googleSenkronCalistir], ["notion", "NOTION", notionSenkronCalistir]] as const) {
    if (o.kaynak && o.kaynak !== "hepsi" && o.kaynak !== ad) continue;
    const e = await entegrasyon(prisma, s);
    const a = ayarlarOf(e);
    if (otomatik && (!a.otomatik || (e.sonSenkron && Date.now() - e.sonSenkron.getTime() < a.aralikDk * 60_000 - 30_000))) { sonuc[ad] = { atlandi: "Zamanı gelmedi" }; continue; }
    try { sonuc[ad] = await (fn as any)(prisma, { ...o, butceMs: o.butceMs ?? 25_000 }); }
    catch (x: any) { sonuc[ad] = { hata: String(x?.message ?? x) }; }
  }
  return sonuc;
}

export async function cakismaCoz(prisma: PrismaClient, id: string, secim: "YEREL" | "UZAK") {
  const c = await prisma.senkronCakisma.findUniqueOrThrow({ where: { id } });
  if (c.durum !== "ACIK") return c;
  if (secim === "UZAK") {
    if (c.hedefTip === "KISI") await prisma.kisi.update({ where: { id: c.hedefId }, data: { [c.alan]: c.uzak as any } });
    else await prisma.kayit.update({ where: { id: c.hedefId }, data: { [c.alan]: c.uzak as any } });
  }
  return prisma.senkronCakisma.update({ where: { id }, data: { durum: secim === "UZAK" ? "UZAK_SECILDI" : "YEREL_SECILDI", cozuldu: new Date() } });
}