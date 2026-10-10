/**
 * Anahtar CRM v3.24 · 10 Ekim 2026 (v3.13'ten)
 * Demo: Google Kişiler (v3.21: çift yönlü) ve Notion senkronu — sunucudaki planlayıcıların AYNISI (google/kisiler.ts, notion/plan.ts)
 * tarayıcı deposuna uygulanır. Dış veri: demo/ornek-entegrasyon.ts (1. tur ilk bağlantı, 2. tur dış değişiklik).
 */
import { googleKisiDonustur, googleSenkronPlani, googleGonderimPlani, GONDERIM_ALANLARI, type MevcutKisi, type HaricListesi, type GonderimAdayi } from "../src/lib/google/kisiler";
import { telAnahtari } from "../src/lib/senkron/birlestir";
import { kisiTaslagi, portfoyTaslagi, talepTaslagi, kisidenTalep, kayitHazirla, kayitAlanlari, type KisiTaslagi, type KayitTaslagi } from "../src/lib/notion/donustur";
import { kisiPlani, kayitPlani, type MevcutNotionKayit, type HazirKayit } from "../src/lib/notion/plan";
import { geriYazimDegerleri, geriYazimGerekli } from "../src/lib/notion/geri-yazim";
import { eslesmeOzetleri, kisaBaslik } from "../src/lib/eslestirme/ozet";
import { SENKRON_SIRASI } from "../src/lib/notion/yapilandirma";
import { BUGUN, varsayilanValidUntil, yeniId, yeniKisiId, type DepoDurumu, type Kisi, type Kayit, type DemoCalisma, type DemoCakisma } from "./depo";
import { INDEKS, BAGLAM } from "./lokasyon";
import { GOOGLE_TUR1, GOOGLE_TUR2, GOOGLE_GRUPLAR, NOTION_TUR1, NOTION_TUR2, NOTION_TUR2_YEREL } from "./ornek-entegrasyon";

const simdiIso = () => new Date(BUGUN.getTime() + (Date.now() % 3_600_000)).toISOString();
const cid = () => "C" + Math.random().toString(36).slice(2, 8);
const eKey = (t: string, p: string) => `${t}~${p}`;
const toplamEslesme = (kayitlar: Kayit[]) => [...eslesmeOzetleri(kayitlar, BAGLAM).entries()].filter(([id]) => kayitlar.find((k) => k.id === id)?.veri.tip === "TALEP").reduce((a, [, o]) => a + o.sayi, 0);

// ───────────────────────────── Google (v3.21 — çift yönlü) ─────────────────────────────
/** Demo: Anahtar'dan silinen kişiler "Google'dan geri gelmesin" listesine yazılır (canlıda sunucu yapar: googleSilinenleriIsaretle). Kişi Google'da DURUR. */
export function demoGoogleSilinenler(d: DepoDurumu, silinen: Kisi[]): DepoDurumu["googleHaric"] {
  if (d.baglantilar?.google.durum !== "BAGLI") return d.googleHaric ?? [];
  const yeni = silinen.filter((k) => k.googleResourceName || telAnahtari(k.telefon)).map((k) => ({ kimlik: k.googleResourceName ?? null, tel: telAnahtari(k.telefon), ad: k.adSoyad, tarih: simdiIso() }));
  return [...yeni, ...(d.googleHaric ?? [])];
}
/** Demo: "Silinenleri yeniden getir" — liste boşalır, rehber baştan okunur (tur sıfırlanır) */
export function demoGoogleHaricTemizle(d: DepoDurumu): DepoDurumu {
  return { ...d, googleHaric: [], baglantilar: { ...d.baglantilar, google: { ...d.baglantilar.google, tur: 0 } } };
}
const gAlan = (k: Kisi) => ({ adSoyad: k.adSoyad, telefon: k.telefon, ikincilTelefon: k.ikincilTelefon ?? null, email: k.email ?? null, sirket: k.sirket, notlar: k.notlar });

export function demoGoogleSenkron(d: DepoDurumu, tetik: string): { d: DepoDurumu; calisma: DemoCalisma } {
  const b = d.baglantilar.google;
  const tur = b.tur + 1;
  // v3.7: telefonda Google'a kaydedilen kişiler (benzetim) her çekimde gelir. v3.21: tam okuma (tur 1) silinenleri de yeniden değerlendirir.
  const kisilerG = [...(tur === 1 ? GOOGLE_TUR1 : tur === 2 ? GOOGLE_TUR2 : []), ...(d.googleBekleyen ?? [])];
  const grupAdi = new Map(GOOGLE_GRUPLAR.map((g) => [g.resourceName, g.formattedName!]));
  const donusum = kisilerG.map((p) => googleKisiDonustur(p, grupAdi, b.ayar.sadeceEtiketler));
  const mevcut: MevcutKisi[] = d.kisiler.map((k) => ({ id: k.id, ...gAlan(k), roller: k.roller, googleResourceName: k.googleResourceName ?? null, googleSnapshot: (k.googleSnapshot as any) ?? null }));
  // ───── 1) ÇEK: Google → Anahtar (Anahtar'dan silinmiş kişiler geri gelmez) ─────
  const haric: HaricListesi = { kimlikler: new Set((d.googleHaric ?? []).map((h) => h.kimlik).filter((x): x is string => !!x)), telefonlar: new Set((d.googleHaric ?? []).map((h) => h.tel).filter((x): x is string => !!x)) };
  const plan = googleSenkronPlani(mevcut, donusum, haric);
  let kisiler = d.kisiler.slice();
  const cakismalar: DemoCakisma[] = [];
  for (const x of plan.guncelle) {
    kisiler = kisiler.map((k) => (k.id !== x.id ? k : { ...k, ...(x.degisiklik as any), roller: [...new Set([...k.roller, ...x.yeniRoller])], googleResourceName: x.resourceName, googleSnapshot: x.snapshot, kaynaktaSilindi: null }));
    const k = kisiler.find((y) => y.id === x.id)!;
    x.cakismalar.forEach((c) => cakismalar.push({ id: cid(), saglayici: "GOOGLE_KISILER", hedefTip: "KISI", hedefId: x.id, baslik: k.adSoyad, ...c }));
  }
  for (const x of plan.bagiKopar) kisiler = kisiler.map((k) => (k.id !== x.id ? k : { ...k, googleResourceName: null, googleSnapshot: null, googleBekliyor: null, googleaGonder: false, kaynaktaSilindi: BUGUN.toISOString(), notlar: [k.notlar, `Google Kişiler'den silindi (${BUGUN.toLocaleDateString("tr-TR")})`].filter(Boolean).join("\n") }));
  const yeni: Kisi[] = plan.ekle.map((x) => ({ id: yeniKisiId(), ...x.alanlar, adSoyad: x.alanlar.adSoyad!, roller: x.roller, uzmanlikAileleri: [], referans: null, whatsappGruplari: [], olusturma: BUGUN.toISOString(), sonIletisim: null, kaynak: "GOOGLE", googleResourceName: x.resourceName, googleSnapshot: x.snapshot }));
  kisiler = [...yeni, ...kisiler];

  // ───── 2) GÖNDER: Anahtar → Google (yalnızca "gönderilecek" işaretli kişiler; Google'dan hiçbir şey silinmez) ─────
  const ozet: Record<string, number> = { ...plan.ozet, gonderilenYeni: 0, gonderilenGuncel: 0 };
  let giden = d.googleGiden ?? [];
  if (b.ayar.googleYaz) {
    const cakismali = new Set([...cakismalar, ...d.cakismalar].filter((c) => c.saglayici === "GOOGLE_KISILER").map((c) => c.hedefId));
    const gp = googleGonderimPlani(kisiler.map((k): GonderimAdayi => ({ id: k.id, ...gAlan(k), googleResourceName: k.googleResourceName ?? null, googleSnapshot: (k.googleSnapshot as any) ?? null, googleBekliyor: k.googleBekliyor ?? (k.googleaGonder ? simdiIso() : null), kaynaktaSilindi: k.kaynaktaSilindi ?? null })), { cakismali, sinir: 200, olusturma: !b.ayar.sadeceEtiketler.length });
    const olustur = new Map(gp.olustur.map((x) => [x.id, x])), guncelle = new Map(gp.guncelle.map((x) => [x.id, x])), temizle = new Set(gp.temizle);
    const yeniGiden: NonNullable<DepoDurumu["googleGiden"]> = [];
    kisiler = kisiler.map((k) => {
      const o = olustur.get(k.id), g = guncelle.get(k.id);
      if (o) { yeniGiden.push({ ad: k.adSoyad, telefon: o.alanlar.telefon, islem: "EKLENDI", tarih: simdiIso() }); ozet.gonderilenYeni++; return { ...k, googleResourceName: "people/anahtar-" + k.id, googleSnapshot: { adSoyad: o.alanlar.adSoyad, telefon: o.alanlar.telefon, ikincilTelefon: o.alanlar.ikincilTelefon ?? null, email: o.alanlar.email ?? null, sirket: o.alanlar.sirket ?? null, notlar: null }, googleBekliyor: null, googleaGonder: false }; }
      if (g) { yeniGiden.push({ ad: k.adSoyad, telefon: k.telefon, islem: "GUNCELLENDI", alanlar: Object.keys(g.degisen), tarih: simdiIso() }); ozet.gonderilenGuncel++; return { ...k, googleSnapshot: { ...g.onceki, ...g.degisen }, googleBekliyor: null, googleaGonder: false }; }
      if (temizle.has(k.id)) return { ...k, googleBekliyor: null, googleaGonder: false };
      return k;
    });
    giden = [...yeniGiden, ...giden].slice(0, 60);
  }
  const atlanan = plan.atlanan.map((a) => ({ ad: kisilerG.find((p) => p.resourceName === a.resourceName)?.names?.[0]?.displayName ?? a.resourceName, neden: a.neden }));
  const calisma: DemoCalisma = { id: cid(), saglayici: "GOOGLE_KISILER", tarih: simdiIso(), tetik, ozet, kontrol: [], yeniEslesme: 0, geriYazim: [], atlanan };
  return {
    d: { ...d, googleBekleyen: [], googleGiden: giden, kisiler, cakismalar: [...cakismalar, ...d.cakismalar], senkronGecmisi: [calisma, ...d.senkronGecmisi].slice(0, 30), baglantilar: { ...d.baglantilar, google: { ...b, tur, sonSenkron: calisma.tarih } } },
    calisma,
  };
}

// ───────────────────────────── Notion ─────────────────────────────
export function demoNotionSenkron(d0: DepoDurumu, tetik: string, yerelOrnek = true): { d: DepoDurumu; calisma: DemoCalisma } {
  let d = d0;
  const b = d.baglantilar.notion;
  const tur = b.tur + 1;
  const kaynak = tur === 1 ? NOTION_TUR1 : tur === 2 ? NOTION_TUR2 : { KISI: [], PORTFOY: [], TALEP: [] };
  // Çakışma örneği: 2. turdan önce Anahtar'da Hacıaliler fiyatı düzeltilmiş olsun
  if (tur === 2 && yerelOrnek) d = { ...d, kayitlar: d.kayitlar.map((k) => (k.notionId === NOTION_TUR2_YEREL.notionId ? { ...k, veri: { ...k.veri, [NOTION_TUR2_YEREL.alan]: NOTION_TUR2_YEREL.deger } as any } : k)) };
  const oncekiEslesme = toplamEslesme(d.kayitlar);
  const ozet: Record<string, number> = { yeni: 0, guncellenen: 0, baglanan: 0, degismeyen: 0, cakisma: 0, kontrol: 0, hatali: 0, arsivlenen: 0, kisiYeni: 0, kisiGuncellenen: 0, notionEslesmesi: 0, geriYazilan: 0 };
  const kontrol: DemoCalisma["kontrol"] = [];
  const cakismalar: DemoCakisma[] = [];
  let kisiler = d.kisiler.slice(), kayitlar = d.kayitlar.slice(), notlar = { ...d.eslesmeNotlari };
  const turetilen: KayitTaslagi[] = [];

  for (const t of SENKRON_SIRASI) {
    const sayfalar = kaynak[t];
    if (t === "KISI") {
      const taslaklar = sayfalar.map(kisiTaslagi).filter((x): x is KisiTaslagi => !!x);
      const p = kisiPlani(kisiler.map((k) => ({ id: k.id, adSoyad: k.adSoyad, telefon: k.telefon, notlar: k.notlar, referans: k.referans, roller: k.roller, uzmanlikAileleri: k.uzmanlikAileleri, ilanSahibiTipi: k.ilanSahibiTipi ?? "BILINMIYOR", notionId: k.notionId ?? null, notionSnapshot: k.notionSnapshot ?? null })), taslaklar);
      for (const x of p.ekle) { kisiler.unshift({ id: yeniKisiId(), ...x.taslak.alanlar, sirket: null, roller: x.taslak.roller, uzmanlikAileleri: x.taslak.uzmanlikAileleri, ilanSahibiTipi: x.taslak.ilanSahibiTipi ?? "BILINMIYOR", whatsappGruplari: [], olusturma: BUGUN.toISOString(), sonIletisim: null, kaynak: "NOTION", notionId: x.taslak.notionId, notionSnapshot: x.taslak.alanlar }); ozet.kisiYeni++; }
      for (const x of p.guncelle) {
        kisiler = kisiler.map((k) => (k.id !== x.id ? k : { ...k, ...(x.degisiklik as any), roller: [...new Set([...k.roller, ...x.yeniRoller])], uzmanlikAileleri: [...new Set([...k.uzmanlikAileleri, ...x.yeniUzmanlik])], ...(x.ilanSahibiTipi ? { ilanSahibiTipi: x.ilanSahibiTipi } : {}), notionId: x.taslak.notionId, notionSnapshot: x.snapshot }));
        if (Object.keys(x.degisiklik).length || x.yeniRoller.length) ozet.kisiGuncellenen++;
        const ad = kisiler.find((k) => k.id === x.id)!.adSoyad;
        x.cakismalar.forEach((c) => cakismalar.push({ id: cid(), saglayici: "NOTION", hedefTip: "KISI", hedefId: x.id, baslik: ad, ...c }));
      }
      for (const k of taslaklar) { const tt = kisidenTalep(k, k.sonDuzenleme); if (tt) turetilen.push(tt); }
      continue;
    }
    const kisiMap = new Map(kisiler.filter((k) => k.notionId).map((k) => [k.notionId!, k.id]));
    const taslaklar = [...sayfalar.map(t === "PORTFOY" ? portfoyTaslagi : talepTaslagi), ...(t === "TALEP" ? turetilen : [])];
    const hazir: HazirKayit[] = taslaklar.map((tt) => ({ taslak: tt, ...kayitHazirla(tt, INDEKS, (id) => kisiMap.get(id), varsayilanValidUntil(tt.tablo, tt.girdi.islemTipi as string, tt.girdi.aciliyet as string, BUGUN, d.ayarlar.ttl)) }));
    const mevcut: MevcutNotionKayit[] = kayitlar.filter((k) => k.veri.tip === t).map((k) => ({ id: k.id, tip: t, notionId: k.notionId ?? null, notionSnapshot: k.notionSnapshot ?? null, veri: k.veri, ilceler: k.veri.lokasyonlar.map((l) => l.ilceId!).filter(Boolean) }));
    const p = kayitPlani(mevcut, hazir);
    for (const x of p.ekle) {
      const id = yeniId(t);
      kayitlar.unshift({ id, olusturma: x.taslak.olusturma, veri: x.veri, notionId: x.taslak.notionId, notionSnapshot: { ...kayitAlanlari(x.veri), __tablo: t, __duzenleme: x.taslak.sonDuzenleme } });
      ozet.yeni++;
      if (x.kontrol.length) { ozet.kontrol++; kontrol.push({ id, baslik: kisaBaslik(x.veri) || "(başlıksız)", nedenler: x.kontrol }); }
    }
    for (const x of p.guncelle) {
      kayitlar = kayitlar.map((k) => {
        if (k.id !== x.id) return k;
        const v: any = { ...k.veri, ...x.degisiklik };
        if ("lokasyonHam" in x.degisiklik || x.baglandi && !k.veri.lokasyonlar.length) v.lokasyonlar = x.veri.lokasyonlar;
        const varolan = new Set((k.veri.kisiler ?? []).map((b) => b.kisiId));
        v.kisiler = [...(k.veri.kisiler ?? []), ...x.veri.kisiler.filter((b) => !varolan.has(b.kisiId))];
        return { ...k, veri: v, notionId: x.taslak.notionId, notionSnapshot: x.snapshot };
      });
      x.cakismalar.forEach((c) => cakismalar.push({ id: cid(), saglayici: "NOTION", hedefTip: "KAYIT", hedefId: x.id, baslik: kisaBaslik(x.veri), ...c }));
    }
    for (const x of p.arsivle) kayitlar = kayitlar.map((k) => (k.id === x.id ? { ...k, veri: { ...k.veri, durum: "ARSIV" } as any } : k));
    for (const [tn, pn] of p.notionEslesmeleri) {
      const tk = kayitlar.find((k) => k.notionId === tn), pk = kayitlar.find((k) => k.notionId === pn);
      if (tk && pk && !notlar[eKey(tk.id, pk.id)]) { notlar[eKey(tk.id, pk.id)] = { durum: "BILDIRILDI", not: "Notion'da ilişkilendirilmişti" }; ozet.notionEslesmesi++; }
    }
    for (const a of ["guncellenen", "baglanan", "degismeyen", "cakisma", "hatali", "arsivlenen"] as const) ozet[a] += p.ozet[a];
    p.hatali.forEach((h) => kontrol.push({ id: null, baslik: h.baslik, nedenler: ["Şemaya uymadı, eklenmedi: " + h.hatalar.join("; ")] }));
  }

  // Geri yazım (Notion'a yalnız uygulamanın beş alanı)
  const geriYazim: DemoCalisma["geriYazim"] = [];
  if (b.ayar.geriYaz) {
    const oz = eslesmeOzetleri(kayitlar, BAGLAM);
    kayitlar = kayitlar.map((k) => {
      if (!k.notionId || k.notionId.includes("#") || k.veri.durum !== "ACTIVE") return k;
      const deger = geriYazimDegerleri(oz.get(k.id), `https://anahtar.app/kayit/${k.id}`);
      if (!geriYazimGerekli(k.notionGeriYazim, deger)) return k;
      geriYazim.push({ id: k.id, baslik: kisaBaslik(k.veri), deger });
      return { ...k, notionGeriYazim: deger };
    });
    ozet.geriYazilan = geriYazim.length;
  }
  const calisma: DemoCalisma = { id: cid(), saglayici: "NOTION", tarih: simdiIso(), tetik, ozet, kontrol, yeniEslesme: Math.max(0, toplamEslesme(kayitlar) - oncekiEslesme), geriYazim, atlanan: [] };
  return {
    d: { ...d, kisiler, kayitlar, eslesmeNotlari: notlar, cakismalar: [...cakismalar, ...d.cakismalar], senkronGecmisi: [calisma, ...d.senkronGecmisi].slice(0, 30), baglantilar: { ...d.baglantilar, notion: { ...b, tur, sonSenkron: calisma.tarih } } },
    calisma,
  };
}

/** Çakışma çözümü: Anahtar'daki kalsın ya da dış kaynaktakini al */
/** v3.7 — toplu çakışma çözümü (seçilenler ya da tümü) */
export function demoCakismalariCoz(d: DepoDurumu, ids: string[], secim: "YEREL" | "UZAK"): DepoDurumu {
  return ids.reduce((x, id) => demoCakismaCoz(x, id, secim), d);
}
/** v3.7 demo — "telefonda Google'a kişi kaydettim": sonraki çekimde (canlıda en geç 5 dk) Kişiler'e gelir */
// v3.21: numaralar örnek rehberdeki kişilerle çakışmayacak aralığa alındı (eskiden ilk kişi "Kemal Usta" ile aynı numaraya denk gelip yeni kişi yerine birleşiyordu)
const ORNEK_YENI = [["Deniz Akar", "+905550000411", "Emlakçılar"], ["Cem Yalın", "+905550000421", "Yatırımcılar"], ["Ece Toprak", "+905550000431", null], ["Mert Aydın", "+905550000441", "Emlakçılar"]] as const;
export function demoGoogleKisiKaydet(d: DepoDurumu): { d: DepoDurumu; ad: string } {
  const i = (d.googleBekleyen?.length ?? 0) + d.kisiler.filter((k) => /^people\/yeni/.test(k.googleResourceName ?? "")).length;
  const [ad, tel, etiket] = ORNEK_YENI[i % ORNEK_YENI.length];
  const grup = GOOGLE_GRUPLAR.find((g) => g.formattedName === etiket);
  const p = { resourceName: `people/yeni${i + 1}`, etag: "e1", names: [{ displayName: i >= ORNEK_YENI.length ? `${ad} ${i + 1}` : ad }], phoneNumbers: [{ value: tel.slice(0, -1) + String((i + 1) % 10) }], ...(grup ? { memberships: [{ contactGroupMembership: { contactGroupResourceName: grup.resourceName } }] } : {}) };
  return { d: { ...d, googleBekleyen: [...(d.googleBekleyen ?? []), p] }, ad: p.names[0].displayName };
}
export function demoCakismaCoz(d: DepoDurumu, id: string, secim: "YEREL" | "UZAK"): DepoDurumu {
  const c = d.cakismalar.find((x) => x.id === id);
  if (!c) return d;
  const kalan = d.cakismalar.filter((x) => x.id !== id);
  // v3.21 — çift yönlü: "Anahtar'daki kalsın" denen Google kişi alanı bir sonraki eşitlemede Google'a yazılır
  if (secim === "YEREL") return { ...d, cakismalar: kalan, kisiler: c.saglayici === "GOOGLE_KISILER" && c.hedefTip === "KISI" && (GONDERIM_ALANLARI as readonly string[]).includes(c.alan) ? d.kisiler.map((k) => (k.id === c.hedefId && k.googleResourceName ? { ...k, googleBekliyor: simdiIso() } : k)) : d.kisiler };
  if (c.hedefTip === "KISI") return { ...d, cakismalar: kalan, kisiler: d.kisiler.map((k) => (k.id === c.hedefId ? { ...k, [c.alan]: c.uzak } : k)) };
  return { ...d, cakismalar: kalan, kayitlar: d.kayitlar.map((k) => (k.id === c.hedefId ? { ...k, veri: { ...k.veri, [c.alan]: c.uzak } as any } : k)) };
}

export const ALAN_ETIKET: Record<string, string> = {
  adSoyad: "Ad soyad", telefon: "Telefon", ikincilTelefon: "2. telefon", email: "E-posta", sirket: "Şirket", notlar: "Notlar", referans: "Referans",
  baslik: "Başlık", mulkTipi: "Mülk tipi", alternatifMulkTipleri: "Alternatif tipler", islemTipi: "İşlem", fiyat: "Fiyat", minFiyat: "Bütçe (alt)", maxFiyat: "Bütçe (üst)",
  fiyatPeriyodu: "Fiyat dönemi", m2: "Alan (m²)", minM2: "En az m²", maxM2: "En çok m²", odaSayisi: "Oda", lokasyonHam: "Bölge", aciliyet: "Aciliyet", durum: "Durum",
  musteriKaynagi: "Müşteri kaynağı", hamMetin: "Açıklama", operasyonNotu: "Notlar", gondeTelefon: "Telefon",
};