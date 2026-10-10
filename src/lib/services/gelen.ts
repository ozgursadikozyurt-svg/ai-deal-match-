/**
 * Anahtar CRM v3.23 · 10 Ekim 2026
 * GELEN KUTUSU — sunucu tarafı. Sunucu dosyayı AÇMAZ: türüne bakar, özetini alır, depoya koyar, künyesini yazar.
 * Ayrıştırma (zip açma, Excel okuma, e-posta eklerini çıkarma, mükerrer denetimi) tarayıcıda yapılır —
 * Cloudflare ücretsiz planda istek başına 10 ms işlemci süresi vardır; 1.000 satırlık bir Excel'i sunucuda okumak 503 üretir.
 *
 * Üç giriş kapısı aynı işlevde (`gelenKaydet`) buluşur:
 *   - ekrandan yükleme            POST /api/gelen            (oturumlu, ofis bağlamı hazır)
 *   - Gmail köprüsü               POST /api/gelen/al         (oturumsuz; ofis gizli koddan bulunur)
 *   - alan adına gelen e-posta    Worker email() işleyicisi  (oturumsuz; ofis alıcı adresinden bulunur)
 */
import type { PrismaClient } from "../../generated/prisma/client";
import { kiracilikIcinde, platformOlarak, ofisBaglami } from "../kiracilik";
import { gelenYukle, gelenSil as depodanSil, gelenBaglantilar, DepoHatasi } from "../depolama/supabase";
import { GELEN_SINIR, GELEN_DOSYA_SINIRI, gelenTurOf, gelenKodGecerli, yeniGelenKod, adrestenKod, baslikCoz, type GelenKanal, type GelenTur, type GelenDosyaKunye } from "../ingest/gelen";

export class GelenHatasi extends Error {
  constructor(public kod: "BOS" | "BUYUK" | "TUR" | "DOLU" | "ADRES", mesaj: string, public durum: number) { super(mesaj); this.name = "GelenHatasi"; }
}
/** Testlerde depo taklit edilir; canlıda Supabase Storage ("gelen" kovası) */
export interface GelenDepo { yukle: (yol: string, veri: Uint8Array) => Promise<void>; sil: (yollar: string[]) => Promise<void>; baglantilar: (yollar: string[]) => Promise<Record<string, string>> }
const CANLI_DEPO: GelenDepo = { yukle: (y, v) => gelenYukle(y, v), sil: (y) => depodanSil(y), baglantilar: (y) => gelenBaglantilar(y) };

const onaltilik = (b: ArrayBuffer) => Array.from(new Uint8Array(b), (x) => x.toString(16).padStart(2, "0")).join("");
const adTemizle = (ad: string) => ad.replace(/[\u0000-\u001f\u007f]/g, "").replace(/^.*[\\/]/, "").trim().slice(0, 180);
const kunye = (d: { id: string; ad: string; tur: string; boyut: number; kanal: string; gonderen: string | null; konu: string | null; createdAt: Date }): GelenDosyaKunye =>
  ({ id: d.id, ad: d.ad, tur: d.tur as GelenTur, boyut: d.boyut, kanal: d.kanal as GelenKanal, gonderen: d.gonderen, konu: d.konu, gelis: d.createdAt.toISOString() });

export interface GelenGirdi { ad?: string | null; veri: Uint8Array; kanal: GelenKanal; gonderen?: string | null; konu?: string | null; icerikTuru?: string | null }

/**
 * Bir ham dosyayı gelen kutusuna koyar (ofis bağlamı içinde çağrılır). Aynı içerik zaten kutudaysa yeniden yazılmaz
 * (köprü aynı postayı iki kez gönderse de, kullanıcı aynı dosyayı hem postalayıp hem yüklese de tek dosya olur).
 */
export async function gelenKaydet(prisma: PrismaClient, g: GelenGirdi, depo: GelenDepo = CANLI_DEPO): Promise<{ dosya: GelenDosyaKunye; yeni: boolean }> {
  if (!g.veri.byteLength) throw new GelenHatasi("BOS", "Dosya boş", 422);
  if (g.veri.byteLength > GELEN_SINIR) throw new GelenHatasi("BUYUK", `Dosya ${Math.round(GELEN_SINIR / 1048576)} MB'tan büyük. WhatsApp'ta “Medya olmadan” dışa aktarın.`, 413);
  const tur = gelenTurOf(g.ad, g.veri.subarray(0, 512), g.icerikTuru);
  if (!tur) throw new GelenHatasi("TUR", "Bu dosya türü okunmuyor. Desteklenenler: .zip, .txt, .xlsx, .csv, .eml", 415);
  const ozet = onaltilik(await crypto.subtle.digest("SHA-256", g.veri as BufferSource));
  const var_ = await prisma.gelenDosya.findFirst({ where: { ozet } });
  if (var_) return { dosya: kunye(var_), yeni: false };
  if ((await prisma.gelenDosya.count()) >= GELEN_DOSYA_SINIRI) throw new GelenHatasi("DOLU", `Gelen kutusunda ${GELEN_DOSYA_SINIRI} dosya var. Önce bekleyenleri ekleyin ya da temizleyin.`, 409);
  const ad = adTemizle(g.ad || "") || `dosya.${tur}`;
  const satir = await prisma.gelenDosya.create({ data: { ad, tur, boyut: g.veri.byteLength, ozet, kanal: g.kanal, gonderen: g.gonderen?.slice(0, 200) || null, konu: g.konu?.slice(0, 300) || null, depoYolu: "" } });
  const depoYolu = `${ofisBaglami().ofisId}/${satir.createdAt.toISOString().slice(0, 7)}/${satir.id}.${tur}`;
  try { await depo.yukle(depoYolu, g.veri); }
  catch (e) { await prisma.gelenDosya.delete({ where: { id: satir.id } }).catch(() => {}); throw e; }
  await prisma.gelenDosya.update({ where: { id: satir.id }, data: { depoYolu } });
  return { dosya: kunye(satir), yeni: true };
}

/** Kutudaki dosyalar (yeni → eski) ve her biri için 1 saat geçerli indirme bağlantısı */
export async function gelenListe(prisma: PrismaClient, depo: GelenDepo = CANLI_DEPO): Promise<{ dosyalar: (GelenDosyaKunye & { url: string | null })[]; depo: boolean }> {
  const satirlar = await prisma.gelenDosya.findMany({ orderBy: { createdAt: "desc" }, take: GELEN_DOSYA_SINIRI });
  let url: Record<string, string> = {}, depoAcik = true;
  try { url = await depo.baglantilar(satirlar.map((s) => s.depoYolu).filter(Boolean)); }
  catch (e) { if (e instanceof DepoHatasi && e.kod === "AYAR_YOK") depoAcik = false; else if (satirlar.length) console.error("Gelen kutusu: bağlantı imzalanamadı", e); }
  return { dosyalar: satirlar.map((s) => ({ ...kunye(s), url: url[s.depoYolu] ?? null })), depo: depoAcik };
}

/** Dosyaları siler (künye + depo). `ids` verilmezse kutunun tamamı. Depodan silinemeyen dosya künyeyi geri getirmez (zamanlayıcı temizler). */
export async function gelenDosyaSil(prisma: PrismaClient, ids: string[] | null, depo: GelenDepo = CANLI_DEPO): Promise<number> {
  const satirlar = await prisma.gelenDosya.findMany({ where: ids ? { id: { in: ids } } : {}, select: { id: true, depoYolu: true } });
  if (!satirlar.length) return 0;
  await prisma.gelenDosya.deleteMany({ where: { id: { in: satirlar.map((s) => s.id) } } });
  await depo.sil(satirlar.map((s) => s.depoYolu).filter(Boolean)).catch((e) => console.error("Gelen kutusu: depodan silinemedi", e));
  return satirlar.length;
}

// ───────── Atlananlar ─────────
const ANAHTAR_RE = /^[a-z]:[\p{L}\p{N}#._:-]{1,120}$/u;
export async function atlananlariGetir(prisma: PrismaClient): Promise<string[]> {
  return (await prisma.gelenAtlanan.findMany({ select: { anahtar: true }, orderBy: { createdAt: "desc" }, take: 50_000 })).map((a) => a.anahtar);
}
export async function atlananEkle(prisma: PrismaClient, anahtarlar: string[]): Promise<number> {
  const temiz = [...new Set(anahtarlar.filter((a) => typeof a === "string" && ANAHTAR_RE.test(a)))];
  if (!temiz.length) return 0;
  return (await prisma.gelenAtlanan.createMany({ data: temiz.map((anahtar) => ({ anahtar })), skipDuplicates: true })).count;
}
/** `anahtarlar` verilirse yalnızca onlar (geri al), verilmezse hepsi ("atlananları geri getir") */
export async function atlananSil(prisma: PrismaClient, anahtarlar?: string[]): Promise<number> {
  return (await prisma.gelenAtlanan.deleteMany({ where: anahtarlar ? { anahtar: { in: anahtarlar } } : {} })).count;
}

// ───────── Adres / köprü anahtarı ─────────
/** Ofisin gizli gelen kutusu kodu; yoksa üretir. `yenile` eski adresi ve köprü anahtarını geçersiz kılar. */
export async function gelenKodGetir(prisma: PrismaClient, yenile = false): Promise<string> {
  const { ofisId } = ofisBaglami();
  const o = await prisma.ofis.findFirst({ where: { id: ofisId }, select: { gelenKod: true } });
  if (o?.gelenKod && !yenile) return o.gelenKod;
  const kod = yeniGelenKod();
  await prisma.ofis.update({ where: { id: ofisId }, data: { gelenKod: kod } });
  return kod;
}

/**
 * Oturumsuz giriş (Gmail köprüsü, e-posta): gizli koddan ofisi bulur ve dosyayı O ofisin bağlamında kaydeder.
 * Kod yanlışsa hiçbir şey yazılmaz. Platform bağlamı yalnızca ofisi bulmak için kullanılır.
 */
export async function gelenAl(prisma: PrismaClient, kod: string | null | undefined, g: GelenGirdi, depo: GelenDepo = CANLI_DEPO) {
  if (!gelenKodGecerli(kod)) throw new GelenHatasi("ADRES", "Anahtar geçersiz", 401);
  const ofis = await platformOlarak(() => prisma.ofis.findFirst({ where: { gelenKod: kod }, select: { id: true, durum: true } }));
  if (!ofis || ofis.durum === "ASKIDA") throw new GelenHatasi("ADRES", "Anahtar geçersiz", 401);
  return kiracilikIcinde({ ofisId: ofis.id, kullaniciId: "gelen-kutusu", rol: "DANISMAN", eposta: "" }, () => gelenKaydet(prisma, g, depo));
}

/** Cloudflare Email Routing'in Worker'a verdiği ileti (ForwardableEmailMessage) — yalnızca kullandığımız kısım */
export interface GelenPosta { from: string; to: string; raw: ReadableStream<Uint8Array> | Uint8Array; rawSize: number; headers: { get(ad: string): string | null }; setReject(neden: string): void }
/**
 * Alan adına gelen e-posta. Alıcı adresinin yerel kısmı ofisin gizli kodudur (<kod>@alanadi ya da gelen+<kod>@alanadi).
 * Posta HAM hâliyle (.eml) gelen kutusuna konur; eklerini tarayıcı çıkarır. Tanınmayan adres, çok büyük posta ve kalıcı hatalar
 * geri çevrilir: gönderen "teslim edilemedi" yanıtı alır, posta sessizce kaybolmaz.
 */
export async function gelenPostaIsle(prisma: PrismaClient, m: GelenPosta, depo: GelenDepo = CANLI_DEPO): Promise<"kaydedildi" | "reddedildi"> {
  const kod = adrestenKod(m.to);
  if (!kod) { m.setReject("Unknown recipient"); return "reddedildi"; }
  if (m.rawSize > GELEN_SINIR) { m.setReject("Message too large (15 MB max). Export WhatsApp chats without media."); return "reddedildi"; }
  try {
    const veri = m.raw instanceof Uint8Array ? m.raw : new Uint8Array(await new Response(m.raw).arrayBuffer());
    const konu = baslikCoz(m.headers.get("subject")).slice(0, 200);
    const ad = `${konu.replace(/[\\/:*?"<>|]+/g, " ").trim().slice(0, 80) || "e-posta"}.eml`;
    await gelenAl(prisma, kod, { ad, veri, kanal: "EPOSTA", gonderen: m.from, konu, icerikTuru: "message/rfc822" }, depo);
    return "kaydedildi";
  } catch (e) {
    if (e instanceof GelenHatasi) { m.setReject(e.kod === "ADRES" ? "Unknown recipient" : e.message.slice(0, 200)); return "reddedildi"; }
    throw e;
  }
}

/**
 * Zamanlayıcı (platform bağlamı): 45 günden eski ham dosyalar ve 1 yıldan eski "atlandı" anahtarları silinir.
 * Bekleyen kayıt, dosyası silinince kutudan düşer; 45 gün bakılmamış bir dökümün ilanları zaten bayatlamıştır.
 */
export async function gelenTemizlik(prisma: PrismaClient, simdi = new Date(), depo: GelenDepo = CANLI_DEPO) {
  const eski = await prisma.gelenDosya.findMany({ where: { createdAt: { lt: new Date(simdi.getTime() - 45 * 86_400_000) } }, select: { id: true, depoYolu: true }, take: 500 });
  if (eski.length) {
    await prisma.gelenDosya.deleteMany({ where: { id: { in: eski.map((e) => e.id) } } });
    await depo.sil(eski.map((e) => e.depoYolu).filter(Boolean)).catch((e) => console.error("Gelen kutusu temizliği: depodan silinemedi", e));
  }
  const atlanan = await prisma.gelenAtlanan.deleteMany({ where: { createdAt: { lt: new Date(simdi.getTime() - 365 * 86_400_000) } } });
  return { dosya: eski.length, atlanan: atlanan.count };
}
