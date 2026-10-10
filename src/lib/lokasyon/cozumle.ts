/**
 * Anahtar CRM v3.24 · 10 Ekim 2026
 * Serbest metin → yapılandırılmış lokasyon (il / ilçe / mahalle / alt bölge ID'leri).
 * Sıra: alias tablosu → alt bölge → ilçe → mahalle → bulanık eşleşme (yazım hatası).
 * AI lokasyon ID'si UYDURMAZ: Gemini sadece ham ifadeyi çıkarır, çözümleme burada yapılır.
 */
import { lokasyonAnahtari, mesafe, parcala } from "./normalize";

export interface LokasyonIndeks {
  ilId: number;
  ilceler: { id: number; ad: string }[];
  mahalleler: { id: number; ilceId: number; ad: string }[];
  altBolgeler: { id: number; ilceId: number | null; ad: string }[];
  aliaslar: { alias: string; seviye: "IL" | "ILCE" | "MAHALLE" | "ALTBOLGE"; ilceId: number | null; mahalleId: number | null; altBolgeId: number | null; tip?: "YAZIM" | "REFERANS_NOKTA" | "SEMT"; aciklama?: string | null }[];
  /** v3.10 — Türkiye geneli çözüm ortamı (başka il adı geçen ifadeler için); yoksa yalnızca bu il çözülür. Bkz. turkiye.ts */
  turkiye?: import("./turkiye").CokIlOrtami;
  /** v3.11 — aynı adlı mahalle birden çok ilçedeyse ve metinde başka ipucu yoksa önce bu ilçelere bakılır (merkez ilçeler) */
  oncelikliIlceler?: number[];
}

/** v3.11 — çalışma bölgesi: aynı adlı mahallede varsayılan seçim sırası (il kimliği → ilçe adları) */
export const MERKEZ_ILCELER: Record<number, string[]> = { 7: ["Muratpaşa", "Konyaaltı", "Kepez", "Aksu", "Döşemealtı"] };

export interface CozulenLokasyon {
  ilId: number;
  ilceId: number | null;
  mahalleId: number | null;
  altBolgeId: number | null;
  /** "IL" yalnızca cokIlliCozumle'den gelir (başka ilin geneli); tek-il çözücü üretmez */
  seviye: "IL" | "ILCE" | "MAHALLE" | "ALTBOLGE";
  etiket: string;
  kaynakIfade: string;
  guven: number; // 1 = birebir, <1 bulanık
  belirsiz?: { ilceId: number; mahalleId: number; etiket: string }[]; // aynı ad birden fazla ilçede
}

export interface CozumSonucu {
  lokasyonlar: CozulenLokasyon[];
  cozulemeyen: string[];
}

type Aday = Omit<CozulenLokasyon, "kaynakIfade" | "guven">;

function hazirla(ix: LokasyonIndeks) {
  const ilceAd = new Map(ix.ilceler.map((i) => [i.id, i.ad]));
  const tablo = new Map<string, Aday[]>();
  const ekle = (k: string, a: Aday) => {
    const l = tablo.get(k) ?? [];
    if (!l.some((x) => x.ilceId === a.ilceId && x.mahalleId === a.mahalleId && x.altBolgeId === a.altBolgeId)) l.push(a);
    tablo.set(k, l);
  };
  // Öncelik sırası ekleme sırasıdır
  for (const a of ix.aliaslar) {
    const ilceId = a.ilceId ?? (a.mahalleId ? ix.mahalleler.find((m) => m.id === a.mahalleId)?.ilceId ?? null : null);
    const seviye = a.seviye === "IL" ? "ILCE" : a.seviye;
    const etiket = a.mahalleId
      ? `${ilceAd.get(ilceId!)} / ${ix.mahalleler.find((m) => m.id === a.mahalleId)?.ad}`
      : a.altBolgeId ? ix.altBolgeler.find((b) => b.id === a.altBolgeId)?.ad ?? a.alias : ilceAd.get(ilceId!) ?? a.alias;
    const etiketTam = a.tip === "REFERANS_NOKTA" ? `${etiket} (${a.aciklama ?? a.alias + " çevresi"})` : etiket;
    ekle(lokasyonAnahtari(a.alias), { ilId: ix.ilId, ilceId, mahalleId: a.mahalleId, altBolgeId: a.altBolgeId, seviye: seviye as Aday["seviye"], etiket: etiketTam });
  }
  for (const b of ix.altBolgeler)
    ekle(lokasyonAnahtari(b.ad), { ilId: ix.ilId, ilceId: b.ilceId, mahalleId: null, altBolgeId: b.id, seviye: "ALTBOLGE", etiket: b.ad });
  for (const i of ix.ilceler)
    ekle(lokasyonAnahtari(i.ad), { ilId: ix.ilId, ilceId: i.id, mahalleId: null, altBolgeId: null, seviye: "ILCE", etiket: i.ad });
  for (const m of ix.mahalleler)
    ekle(lokasyonAnahtari(m.ad), { ilId: ix.ilId, ilceId: m.ilceId, mahalleId: m.id, altBolgeId: null, seviye: "MAHALLE", etiket: `${ilceAd.get(m.ilceId)} / ${m.ad}` });
  return tablo;
}

const cache = new WeakMap<LokasyonIndeks, Map<string, Aday[]>>();

export function lokasyonCozumle(metin: string | string[], ix: LokasyonIndeks): CozumSonucu {
  const tablo = cache.get(ix) ?? hazirla(ix);
  cache.set(ix, tablo);
  // Parçalar + her parçadan sonra gelen ayraç ("/" hiyerarşi bildirir: "Aksu / Kundu")
  const parcalar: string[] = [];
  const slashSonra: boolean[] = [];
  for (const m of Array.isArray(metin) ? metin : [metin]) {
    const bol = m.split(/(\/)/);
    bol.forEach((b, i) => {
      if (b === "/") return;
      const ps = parcala(b);
      ps.forEach((p, j) => { parcalar.push(p); slashSonra.push(j === ps.length - 1 && bol[i + 1] === "/"); });
    });
  }
  const parcaNo: number[] = []; // sonuc[i] hangi parçadan geldi
  const sonuc: CozulenLokasyon[] = [];
  const cozulemeyen: string[] = [];

  // Bir parçayı soldan sağa tüketir: "konyaalti hurma" → ["konyaalti", "hurma"]; dolgu kelimeler atılır.
  const DOLGU = new Set(["olur", "olabilir", "civari", "civarinda", "civarlari", "cevresi", "cevre", "cevresinde", "yakini", "yakinlari", "yakininda", "tarafi", "taraflari", "bolge", "ici", "icinde", "tercih", "tercihen", "uzeri", "de", "da", "hatta", "yani", "yaninda", "karsisi", "karsisinda", "arkasi", "arkasinda", "onu", "bolgesi", "mevkii", "tarafinda"]);
  type Bulgu = { adaylar: Aday[]; ifade: string; guven: number };
  function bul(p: string): Bulgu[] | null {
    const tam = tablo.get(p);
    if (tam) return [{ adaylar: tam, ifade: p, guven: 1 }];
    const kel = p.split(" ").filter((k) => !DOLGU.has(k));
    if (!kel.length) return [];
    if (kel.join(" ") !== p) { const t2 = tablo.get(kel.join(" ")); if (t2) return [{ adaylar: t2, ifade: kel.join(" "), guven: 1 }]; }
    const out: (Bulgu & { bas: number; son: number })[] = [];
    let i = 0, kaldi = false;
    while (i < kel.length) {
      let n = kel.length - i;
      for (; n >= 1; n--) { const alt = kel.slice(i, i + n).join(" "); if (tablo.has(alt)) { out.push({ adaylar: tablo.get(alt)!, ifade: alt, guven: 1, bas: i, son: i + n }); break; } }
      if (n >= 1) { i += n; continue; }
      // bulanık: kalan kelime grubu için uzunluğa göre tolerans ("murtpasa")
      const kalan = kel.slice(i).join(" ");
      const tol = kalan.length >= 8 ? 2 : kalan.length >= 5 ? 1 : 0;
      let enIyi: { k: string; d: number } | null = null;
      if (tol > 0) for (const k of tablo.keys()) {
        if (Math.abs(k.length - kalan.length) > tol) continue;
        const d = mesafe(kalan, k);
        if (d <= tol && (!enIyi || d < enIyi.d)) enIyi = { k, d };
      }
      if (enIyi) { out.push({ adaylar: tablo.get(enIyi.k)!, ifade: enIyi.k, guven: 1 - enIyi.d * 0.15, bas: i, son: kel.length }); break; }
      kaldi = true; i++; // bu kelime tanınmadı; devam et (sonra kuyruk olarak değerlendirilir)
    }
    // Çapa = ilçe ya da alt bölge. Çapadan sonra gelen kısım tam tanınmadıysa ("kepez yeni sanayi" → "yeni" + ?),
    // tek kelimelik mahalle parçalarına bölüp tahmin yürütme: çapadan sonraki kuyruğun tamamı "tanınmadı" olur.
    const capalar = out.filter((b) => b.adaylar[0].seviye === "ILCE" || b.adaylar[0].seviye === "ALTBOLGE");
    const capaSon = capalar.length ? Math.max(...capalar.map((b) => b.son)) : 0;
    const ilceCapa = new Set(capalar.filter((b) => b.adaylar[0].seviye === "ILCE").map((b) => b.adaylar[0].ilceId));
    const kuyruk = out.filter((b) => b.bas >= capaSon);
    const tutarsiz = (b: (typeof out)[number]) => b.adaylar[0].seviye === "MAHALLE" && ilceCapa.size > 0 && !b.adaylar.some((a) => a.seviye === "MAHALLE" && ilceCapa.has(a.ilceId));
    const kuyrukSupheli = kaldi || kuyruk.some(tutarsiz);
    if (!capalar.length) {
      if (out.length === 1 && !kaldi) return out;
      // Çapasız ve bölünmüş/eksik ifade ("yeni sanayi") → tahmin yok
      if (out.length === 0 || kaldi || out.every((b) => b.adaylar[0].seviye === "MAHALLE" && !b.ifade.includes(" "))) return null;
      return out.length > 1 ? null : out;
    }
    const sonuc: Bulgu[] = out.filter((b) => b.bas < capaSon);
    if (kuyrukSupheli && capaSon < kel.length) {
      if (kuyruk.every((b) => b.adaylar[0].seviye === "MAHALLE" && (!b.ifade.includes(" ") || tutarsiz(b)))) { cozulemeyen.push(kel.slice(capaSon).join(" ")); return sonuc; }
    }
    for (const b of kuyruk) {
      if (b.adaylar[0].seviye !== "MAHALLE" || !ilceCapa.size) { sonuc.push(b); continue; }
      const uyan = b.adaylar.filter((a) => a.seviye === "MAHALLE" && ilceCapa.has(a.ilceId));
      if (uyan.length) sonuc.push({ ...b, adaylar: uyan });
      else cozulemeyen.push(b.ifade);
    }
    return sonuc;
  }

  for (const [pi, p] of parcalar.entries()) {
    const bulgular = bul(p);
    if (!bulgular) { cozulemeyen.push(p.split(" ").filter((k) => !DOLGU.has(k)).join(" ") || p); continue; }
    for (const { adaylar, ifade, guven } of bulgular) {
    if (!adaylar?.length) { cozulemeyen.push(p); continue; }
    const [ilk] = adaylar;
    const ayniSeviyeli = adaylar.filter((a) => a.seviye === ilk.seviye);
    const kayit: CozulenLokasyon = { ...ilk, kaynakIfade: ifade, guven };
    if (ilk.seviye === "MAHALLE" && ayniSeviyeli.length > 1)
      kayit.belirsiz = ayniSeviyeli.map((a) => ({ ilceId: a.ilceId!, mahalleId: a.mahalleId!, etiket: a.etiket }));
    sonuc.push(kayit); parcaNo.push(pi);
    }
  }

  // 1) Belirsiz mahalle + aynı metinde ilçe varsa belirsizliği o ilçeyle çöz ("Kepez, Atatürk")
  const ilceIdleri = new Set(sonuc.filter((s) => s.seviye === "ILCE").map((s) => s.ilceId));
  for (const s of sonuc) {
    if (!s.belirsiz) continue;
    const secim = s.belirsiz.find((b) => ilceIdleri.has(b.ilceId));
    if (secim) { s.ilceId = secim.ilceId; s.mahalleId = secim.mahalleId; s.etiket = secim.etiket; delete s.belirsiz; }
  }
  // 1b) v3.11 — hâlâ belirsizse aynı metindeki diğer konumların ilçesine bak: "Fener, Çağlayan" → Muratpaşa / Çağlayan
  //     (v3.10'da ilk bulunan seçiliyordu: Manavgat / Çağlayan). Tek aday kalırsa belirsizlik kalkar.
  const baglamIlce = new Set(sonuc.filter((s) => !s.belirsiz && s.ilceId).map((s) => s.ilceId));
  for (const s of sonuc) {
    if (!s.belirsiz) continue;
    const uyan = s.belirsiz.filter((b) => baglamIlce.has(b.ilceId));
    if (uyan.length === 1) { const [secim] = uyan; s.ilceId = secim.ilceId; s.mahalleId = secim.mahalleId; s.etiket = secim.etiket; delete s.belirsiz; continue; }
    // 1c) İpucu yok: merkez ilçelerdeki adayı varsay; belirsizlik işareti kalır (ekranda "hangi ilçe?" sorulur)
    const sira = ix.oncelikliIlceler ?? [];
    const secim = (uyan.length ? uyan : s.belirsiz).map((b) => ({ b, n: sira.indexOf(b.ilceId) })).filter((x) => x.n >= 0).sort((a, c) => a.n - c.n)[0]?.b;
    if (secim) { s.ilceId = secim.ilceId; s.mahalleId = secim.mahalleId; s.etiket = secim.etiket; }
  }
  // 2) Hiyerarşi birleştirme — sadece BİTİŞİK ilçe→mahalle (veya ilçe→o ilçenin alt bölgesi) çifti ("Kepez / Altıntaş", "Aksu Pınarlı çevresi").
  //    Listede uzakta geçen ilçe korunur ("Muratpaşa … Fener" → ikisi ayrı kalır: tüm ilçe + mahalle).
  const birlesik = sonuc.filter((s, i) => {
    if (s.seviye !== "ILCE") return true;
    const bitisik = [i + 1, i - 1].some((j) => {
      const o = sonuc[j];
      if (!o || o.ilceId !== s.ilceId || o.belirsiz) return false;
      if (o.seviye === "MAHALLE") return true;
      // Alt bölge yalnızca aynı parçada ("Aksu Kundu") ya da "/" ile ayrılmışsa ("Aksu / Kundu") ilçeyi yutar;
      // virgüllü listede ("Murtpaşa, Lara") ilçe ayrı kalır.
      if (o.seviye === "ALTBOLGE") return parcaNo[j] === parcaNo[i] || (j === i + 1 && slashSonra[parcaNo[i]]);
      return false;
    });
    return !bitisik;
  });
  // tekrarları at
  const tekil = birlesik.filter((s, i, a) => a.findIndex((o) => o.ilceId === s.ilceId && o.mahalleId === s.mahalleId && o.altBolgeId === s.altBolgeId) === i);
  return { lokasyonlar: tekil, cozulemeyen };
}

/** DB'den indeks yükler (il başına ~1–3 bin satır; sunucu belleğinde önbelleklenir) */
const dbCache = new Map<number, { t: number; ix: LokasyonIndeks }>();
export async function lokasyonIndeksiYukle(
  prisma: import("../../generated/prisma/client").PrismaClient,
  ilId = 7,
  ttlMs = 10 * 60_000,
): Promise<LokasyonIndeks> {
  const c = dbCache.get(ilId);
  if (c && Date.now() - c.t < ttlMs) return c.ix;
  const [ilceler, mahalleler, altBolgeler, aliaslar] = await Promise.all([
    prisma.ilce.findMany({ where: { ilId }, select: { id: true, ad: true } }),
    prisma.mahalle.findMany({ where: { ilce: { ilId } }, select: { id: true, ilceId: true, ad: true } }),
    prisma.altBolge.findMany({ where: { ilId }, select: { id: true, ilceId: true, ad: true } }),
    prisma.lokasyonAlias.findMany({ where: { ilId, onaylandi: true }, select: { alias: true, seviye: true, ilceId: true, mahalleId: true, altBolgeId: true, tip: true, aciklama: true } }),
  ]);
  const merkez = MERKEZ_ILCELER[ilId] ?? [];
  const ix: LokasyonIndeks = { ilId, ilceler, mahalleler, altBolgeler, aliaslar, oncelikliIlceler: merkez.map((ad) => ilceler.find((i) => i.ad === ad)?.id).filter((x): x is number => x != null) };
  dbCache.set(ilId, { t: Date.now(), ix });
  return ix;
}

/** Öğrenilen/onaylanan alias sonrası sunucu önbelleğini boşalt */
export function lokasyonIndeksiniYenile(ilId = 7) { dbCache.delete(ilId); }