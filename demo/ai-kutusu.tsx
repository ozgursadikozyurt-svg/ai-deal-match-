/**
 * Anahtar CRM v3.22 · 9 Ekim 2026
 * Demo — Akıllı giriş kutusu ("Anahtar AI"). Ana sayfanın en üstünde ve Veri girişi › Yapıştır'da aynı bileşen.
 *   1) Metin önce yorumlanır (src/lib/ai/yorumlayici.ts): portal ilan sayfası, WhatsApp sohbet dökümü, toplu liste,
 *      tek talep / ilan, yalnızca bağlantı, kişi / telefon ya da soru.
 *   2) SORU → metin → filtre (kural tabanlı; anlaşılmazsa yapay zekâ); sorguyu KOD çalıştırır.
 *   3) Kayıt(lar) → kural tabanlı ayrıştırma (ücretsiz) → açıklama + uyarılar + notlar → tek kayıt kartı ya da çoklu liste → Kaydet.
 *   4) "Yapay zekâ yorumlasın": kullanıcı isterse (ya da güven düşükse önerilir) metin yapay zekâya yorumlatılır (1 istek).
 * Aynı metin ikinci kez gelirse yapay zekâ çağrılmaz; havuzda kayıtlı metin / kayıt "Zaten var" olur.
 */
import React, { useEffect, useMemo, useRef, useState } from "react";
import { KayitCreateSchema } from "../src/lib/validation/kayit";
import { AiParseCiktiSchema, GEMINI_RESPONSE_SCHEMA, GEMINI_SISTEM_TALIMATI } from "../src/lib/ai/gemini-cikti-semasi";
import { yorumla, konumBul, aiYorumIstemi, YORUM_ETIKETI, type Yorum, type YorumParca, type YorumKisi } from "../src/lib/ai/yorumlayici";
import { aiYanitiniDogrula } from "../src/lib/ai/yorum-dogrula";
import { tekrarAnahtarlari } from "../src/lib/ingest/tekrar";
import { hizliAyristir, metinTuru, soruFiltresi, metindenKonumlar, type HizliSonuc, type SoruFiltresi } from "../src/lib/ai/hizli-ayristirici";
import { eslesmeOnizle, temelUyum, type OnizlemeSonucu } from "../src/lib/eslestirme/onizleme";
import { havuzKatmani, portfoyEdinmeFirsati } from "../src/lib/eslestirme/havuz";
import { metinParmakIzi } from "../src/lib/ingest/whatsapp";
import { etiket, VERI_KANALI_ETIKET } from "./etiketler";
import { BAGLAM, INDEKS, coz, cozulenToKayitLok, calismaIliOku, ilAdiOf, konumOzeti, type KonumOnerisi } from "./lokasyon";
import { haricBirlestir } from "../src/lib/lokasyon/haric";
import { BUGUN, varsayilanValidUntil, yeniId, kayitliMetinIzleri, kisiRolleriOf, aiAyari, type Kayit, type Veri } from "./depo";
import { useDepo, cx, Pill, IslemPill, Skor, UYGUNLUK, baslikOf, fiyatOf, m2Of, oneCikanlar, lokEtiket, aiJson, telYaz, type Ekran } from "./ortak";
import { hafizaBaslat, useKalici } from "./hafiza";
import { bosFiltre, filtreUygula, type Filtre } from "./filtre";
import { kisiEkle } from "./kisiler";
import { EksikUyarisi, FirsatBandi, HavuzRozeti } from "./motor-ui";
import { mevcutAnahtarlar, topluEkle } from "./toplu-giris";
import { adaylariGuncelle } from "../src/lib/lokasyon/ogrenme";
import { telNormalize } from "./form";
import { ORNEK_TOPLANTI_NOTU } from "./ornek-dosyalar";
import { ORNEK_PORTAL_SAYFASI, ORNEK_SOHBET } from "./ornek-metinler";

/** Çözücü sonucunu filtre konumuna çevir */
export function konumOnerileri(ifadeler: string[]): KonumOnerisi[] {
  const r = coz(ifadeler);
  return r.lokasyonlar.map((l) => ({ anahtar: l.altBolgeId ? `a:${l.altBolgeId}` : l.mahalleId ? `m:${l.mahalleId}` : `i:${l.ilceId}`, etiket: l.etiket, alt: "", tur: (l.altBolgeId ? "ALTBOLGE" : l.mahalleId ? "MAHALLE" : "ILCE") as KonumOnerisi["tur"], lok: { ilId: 7, ilceId: l.ilceId, mahalleId: l.mahalleId, altBolgeId: l.altBolgeId } }));
}

/** Hızlı ayrıştırıcı + (varsa) yapay zekâ kaydı → form taslağı */
export function taslakYap(metin: string, h: HizliSonuc, ai: any | null, haricIfadeler?: string[]): { taslak: any; cozulemeyen: string[] } {
  const tip = ai?.tip ?? h.tip ?? "PORTFOY";
  const talep = tip === "TALEP";
  // v3.22 — "Hurma, Sarısu HARİÇ": hariç denilen yerler aranan bölge olmaz; talepte hariç satırı olarak yazılır ve
  // ilçesi (Konyaaltı) aranan bölge olarak eklenir. Eskiden konum kalmayınca metindeki tüm yer adları yeniden okunup
  // Hurma ARANAN bölge yapılıyordu.
  const haricIf: string[] = (haricIfadeler ?? ai?.haricKonumlar ?? []).filter(Boolean);
  const rh = haricIf.length ? coz(haricIf) : { lokasyonlar: [], cozulemeyen: [] };
  const haricAnahtar = new Set(rh.lokasyonlar.map((l) => `${l.ilceId}|${l.mahalleId}|${l.altBolgeId}`));
  const ifadeler: string[] = ai?.lokasyonIfadeleri?.length ? ai.lokasyonIfadeleri : konumBul(metin, INDEKS).filter((x) => !haricIf.some((hh) => hh.toLocaleLowerCase("tr") === x.toLocaleLowerCase("tr")));
  const r0 = coz(ifadeler);
  const r = { ...r0, lokasyonlar: r0.lokasyonlar.filter((l) => !haricAnahtar.has(`${l.ilceId}|${l.mahalleId}|${l.altBolgeId}`)) };
  const lokasyonlar = (talep && rh.lokasyonlar.length
    ? haricBirlestir(cozulenToKayitLok(r.lokasyonlar, false), cozulenToKayitLok(rh.lokasyonlar, false))
    : cozulenToKayitLok(r.lokasyonlar, !talep)).map(({ etiket, seviye, ...l }: any) => l);
  const ozellik = { ...h.ozellik, ...(ai?.ozellik ?? {}) } as any;
  if (talep && h.m2Esnek) ozellik.esnekKriterler = [...new Set([...(ozellik.esnekKriterler ?? []), "ALAN"])];
  const { lokasyonIfadeleri, kisiAdi, telefon, firma, mesajNo, ozet, ...aiGeri } = ai ?? {};
  const kanal = h.portal ?? (ai || h.telefon || /whatsapp|\d{2}[./]\d{2}[./]\d{2,4}\s+\d{1,2}:\d{2}/i.test(metin) ? "WHATSAPP" : "MANUEL");
  const taslak: any = {
    tip, mulkTipi: h.mulkTipi ?? "DIGER", islemTipi: h.islemTipi ?? "SATILIK", aciliyet: h.aciliyet ?? "NORMAL", paraBirimi: h.paraBirimi,
    ...(talep ? { maxFiyat: h.maxFiyat ?? h.fiyat, minM2: h.minM2 ?? h.m2, maxM2: h.maxM2, m2ToleransYuzde: h.m2Esnek ? 20 : undefined } : { fiyat: h.fiyat, m2: h.m2 ?? h.minM2 }),
    fiyatPeriyodu: h.fiyatPeriyodu ?? "TOPLAM", odaSayisi: h.odaSayisi ?? undefined,
    ...aiGeri, ozellik,
    lokasyonlar, lokasyonHam: [ifadeler.join(", "), haricIf.length && talep ? `${haricIf.join(", ")} hariç` : ""].filter(Boolean).join(" · "),
    gondeAdi: kisiAdi ?? h.kisiAdi ?? null, gondeTelefon: telefon ?? h.telefon, gondeSirket: firma ?? h.sirket,
    ilanSahibiTipi: ai?.ilanSahibiTipi && ai.ilanSahibiTipi !== "BILINMIYOR" ? ai.ilanSahibiTipi : h.ilanSahibiTipi ?? "BILINMIYOR",
    veriKanali: kanal,
    // v3.16 — kaynak otomasyonu: "Kendi portföyüm" yalnızca elle girişte varsayılan. Portal ilanı → dış ilan;
    // WhatsApp / emlakçı kaynaklı ya da sahibi belli olmayan kayıtlar partner havuzuna düşer, kullanıcı isterse formda değiştirir.
    havuz: talep ? "KENDI_PORTFOY" : h.portal ? "DIS_ILAN" : (ai?.ilanSahibiTipi ?? h.ilanSahibiTipi) === "MALIK" ? "KENDI_PORTFOY" : kanal === "MANUEL" ? "KENDI_PORTFOY" : "PARTNER",
    portalUrl: h.portalUrl ?? undefined, portalIlanNo: h.ilanNo ?? undefined,
    hamMetin: metin, baslik: (ozet ? String(ozet) : ozetYaz(h, talep && rh.lokasyonlar.length ? [konumOzeti(lokasyonlar)] : r.lokasyonlar.map((l) => l.etiket), talep)).slice(0, 160),
    // v3.17 — jargon sözlüğünden çıkan kayıt alanları (krediye uygun, takasa açık) ve karşılığı olmayan jargon notları
    ...(h.kayitAlanlari ?? {}),
    ...(h.jargonNotlari?.length ? { operasyonNotu: [aiGeri?.operasyonNotu, ...h.jargonNotlari].filter(Boolean).join(" · ").slice(0, 2000) } : {}),
  };
  for (const k of Object.keys(taslak)) if (taslak[k] === undefined || taslak[k] === null) delete taslak[k];
  return { taslak, cozulemeyen: r.cozulemeyen };
}
function ozetYaz(h: HizliSonuc, konum: string[], talep = false): string {
  const tr = (n: number) => n.toLocaleString("tr-TR");
  const alan = h.minM2 != null && h.maxM2 != null ? `${tr(h.minM2)}–${tr(h.maxM2)} m²` : h.m2 ?? h.minM2 ? `${talep ? "en az " : ""}${tr((h.m2 ?? h.minM2)!)} m²` : null;
  if (talep) return [konum.map((k) => k.split(" (")[0]).join(" / "), alan, h.odaSayisi, h.mulkTipi ? etiket(h.mulkTipi).toLocaleLowerCase("tr") : null, h.islemTipi ? etiket(h.islemTipi).toLocaleLowerCase("tr") : null, "arayan"].filter(Boolean).join(" ");
  return [konum[0]?.split(" (")[0], alan, h.odaSayisi, h.mulkTipi ? etiket(h.mulkTipi) : null, h.islemTipi ? etiket(h.islemTipi).toLocaleLowerCase("tr") : null].filter(Boolean).join(" ") || "Ayrıştırılan kayıt";
}

type TipSecimi = "OTO" | "TALEP" | "PORTFOY";
interface Satir {
  p: YorumParca;
  taslak: any;
  veri: any | null;
  hatalar: string[];
  kontrol: string[];
  cozulemeyen: string[];
  eslesmeler: { k: any; s: any }[];
  tekrar: boolean;
  durum: "HAZIR" | "KONTROL" | "TEKRAR" | "HATALI";
}

/** Bir yorum parçasını kayıt taslağına çevirir ve şemadan geçirir. */
export function satirKur(p: YorumParca, y: Yorum, secim: TipSecimi, d: any, izler: Set<string>, kayitliMetinler: Set<string>, aiKayit: any | null, eslesmeBul: (v: any) => { k: any; s: any }[]): Satir {
  const h = { ...p.h };
  h.tip = secim !== "OTO" ? secim : aiKayit?.tip ?? (p.altTur === "TOPLU_LISTE" && y.tipIpucu ? y.tipIpucu : h.tip);
  const ai = aiKayit ? { ...aiKayit, tip: h.tip } : { lokasyonIfadeleri: p.konumlar, ...p.ek, ozellik: h.ozellik };
  const { taslak, cozulemeyen } = taslakYap(p.metin, h, ai, p.haricKonumlar);
  const talep = taslak.tip === "TALEP";
  if (talep) { taslak.maxFiyat ??= taslak.fiyat; taslak.minM2 ??= taslak.m2; delete taslak.fiyat; delete taslak.m2; }
  else { taslak.fiyat ??= taslak.maxFiyat; taslak.m2 ??= taslak.minM2; delete taslak.maxFiyat; delete taslak.minM2; delete taslak.maxM2; delete taslak.m2ToleransYuzde; }
  if (!taslak.lokasyonlar?.length && p.ilGeneli) taslak.lokasyonlar = [{ ilId: calismaIliOku(), ilceId: null, mahalleId: null, altBolgeId: null, birincil: !talep }];
  taslak.hamMetin = p.metin.slice(0, 19000);
  taslak.veriKanali = p.grup ? "WHATSAPP" : h.portal ?? (p.altTur !== "TOPLU_LISTE" && (p.telefon || h.telefon) ? "WHATSAPP" : "MANUEL");
  if (p.grup) taslak.kayitGrubu = p.grup; else if (p.altTur === "TOPLU_LISTE") taslak.kayitGrubu = "Toplu mesaj"; // v3.7 ile aynı etiket
  if (p.tarih) taslak.mesajTarihi = p.tarih;
  if (p.kisiAdi) taslak.gondeAdi = p.kisiAdi; else if (!aiKayit) delete taslak.gondeAdi;
  if (p.telefon) taslak.gondeTelefon = p.telefon;
  if (h.ilanSahibiTipi) taslak.ilanSahibiTipi = h.ilanSahibiTipi;
  if (p.notlar.length) taslak.operasyonNotu = p.notlar.join("\n").slice(0, 4000);
  if (talep) { taslak.havuz = "KENDI_PORTFOY"; delete taslak.portalUrl; delete taslak.portalIlanNo; }
  if (!p.ek.ozet && !aiKayit?.ozet) taslak.baslik = baslikKur(taslak).slice(0, 160) || taslak.baslik;
  for (const k of Object.keys(taslak)) if (taslak[k] === undefined || taslak[k] === null) delete taslak[k];

  const sonuc = KayitCreateSchema.safeParse({ ...taslak, validUntil: varsayilanValidUntil(taslak.tip, taslak.islemTipi, taslak.aciliyet, BUGUN, d.ayarlar.ttl) });
  const veri = sonuc.success ? sonuc.data : null;
  const kontrol: string[] = [];
  if (!h.mulkTipi && !aiKayit?.mulkTipi) kontrol.push("Mülk tipi yok");
  if (!taslak.lokasyonlar?.length) kontrol.push("Konum yok");
  if ((talep ? !taslak.maxFiyat && !taslak.minM2 && !taslak.odaSayisi : !taslak.fiyat) && !p.uyarilar.some((u) => /fiyat/i.test(u))) kontrol.push(talep ? "Bütçe / m² / oda yok" : "Fiyat yok");
  if (cozulemeyen.length) kontrol.push("Tanınmayan yer: " + cozulemeyen.join(", "));
  const tekrar = !!veri && (tekrarAnahtarlari(veri, p.kisiAdi).some((iz: string) => izler.has(iz)) || kayitliMetinler.has(metinParmakIzi(p.metin)));
  return {
    p, taslak, veri, cozulemeyen, kontrol, tekrar,
    hatalar: sonuc.success ? [] : sonuc.error.issues.slice(0, 4).map((i: any) => `${i.path.join(".")}: ${i.message}`),
    eslesmeler: veri && !tekrar ? eslesmeBul(veri) : [],
    durum: !veri ? "HATALI" : tekrar ? "TEKRAR" : kontrol.length || p.uyarilar.length ? "KONTROL" : "HAZIR",
  };
}

/** Kısa, okunur başlık: "Kızıltoprak, Yenigün 3+1 daire — satılık talebi" / "Altıntaş 1+1 daire, satılık". */
function baslikKur(t: any): string {
  const yerler = (t.lokasyonlar ?? []).some((l: any) => l.haric) ? [konumOzeti(t.lokasyonlar)] : [...new Set((t.lokasyonlar ?? []).map((l: any) => String(lokEtiket(l)).split(" / ").pop()))].slice(0, 3) as string[];
  const tr = (n: number) => n.toLocaleString("tr-TR");
  const tip = t.mulkTipi && t.mulkTipi !== "DIGER" ? String(etiket(t.mulkTipi)).toLocaleLowerCase("tr") : "";
  const islem = t.islemTipi ? String(etiket(t.islemTipi)).toLocaleLowerCase("tr") : "";
  if (t.tip === "TALEP") {
    const alan = t.minM2 != null && t.maxM2 != null ? `${tr(t.minM2)}–${tr(t.maxM2)} m²` : t.minM2 != null ? `en az ${tr(t.minM2)} m²` : "";
    return [yerler.join(", "), t.odaSayisi, alan, tip || "mülk"].filter(Boolean).join(" ") + (islem ? ` — ${islem} talebi` : " talebi");
  }
  return [yerler[0], t.odaSayisi, t.m2 != null ? `${tr(t.m2)} m²` : "", tip].filter(Boolean).join(" ") + (islem ? `, ${islem}` : "");
}

const DURUM = { HAZIR: ["iyi", "Hazır"], KONTROL: ["uyari", "Kontrol edin"], TEKRAR: ["notr", "Zaten var"], HATALI: ["kotu", "Eksik"] } as const;
const ORNEKLER = (toplantiNotu: string): [string, string][] => [
  ["Soru sor", "Kepez'de 1000 m² üstü kiralık depo var mı?"],
  ["Portal ilan sayfası", ORNEK_PORTAL_SAYFASI],
  ["WhatsApp sohbeti", ORNEK_SOHBET],
  ["Toplantı notu", toplantiNotu],
  ["Tek talep", "ACİL: Üretim için Kepez'de 800-1200 m² kiralık imalathane arıyoruz, 90 bine kadar. — Can Ö. 0544 222 33 44"],
  ["Yeni kişi", "Mert Aksoy 0555 000 07 01"],
];

export function AkilliKutu({ gomulu = false, baslangic = "", donus }: { gomulu?: boolean; baslangic?: string; donus?: boolean }) {
  const { d, sample, git, kayitKaydet, guncelle, bildir } = useDepo();
  const HK = gomulu ? "vg.ak." : "ana.ak."; // v3.15: forma gidip "Vazgeç" ile dönülünce yorumlanan metin ve sonuçlar yerinde kalır
  hafizaBaslat(HK, donus);
  const GERI: Ekran = gomulu ? { ad: "veri", alt: "metin" } : { ad: "ana" };
  const [metin, setMetin] = useKalici(HK + "metin", baslangic);
  const [islenen, setIslenen] = useKalici(HK + "islenen", "");
  const [yorum, setYorum] = useKalici(HK + "yorum", null as Yorum | null);
  const [ai, setAi] = useKalici(HK + "ai", null as { kayitlar: any[]; aciklama: string; tur: string } | null);
  const [soru, setSoru] = useKalici(HK + "soru", null as any);
  const [secim, setSecim] = useKalici(HK + "secim", "OTO" as TipSecimi);
  const [secili, setSecili] = useKalici(HK + "secili", new Set<number>());
  const [acik, setAcik] = useKalici(HK + "acik", null as number | null);
  const [yukleniyor, setYukleniyor] = useState(false);
  const [aiCalisiyor, setAiCalisiyor] = useState(false);
  const [hata, setHata] = useState(null as string | null);
  const [basari, setBasari] = useKalici(HK + "basari", null as { metin: string; talep: number; portfoy: number } | null);
  const [eklenenKisi, setEklenenKisi] = useKalici(HK + "eklenenKisi", false);
  const onbellek = useRef(new Map<string, any>());
  const otoBekleyen = useRef(false);

  const aktif = useMemo(() => d.kayitlar.filter((k: any) => k.veri.durum === "ACTIVE"), [d.kayitlar]);
  const izler = useMemo(() => mevcutAnahtarlar(d), [d.kayitlar, d.kisiler]);
  const kayitliMetinler = useMemo(() => kayitliMetinIzleri(d.kayitlar), [d.kayitlar]);
  const kisiAd = (id: string) => d.kisiler.find((k: any) => k.id === id)?.adSoyad ?? "";
  const eslesmeBul = (v: any): { k: any; s: any }[] =>
    aktif.filter((k: any) => k.veri.tip !== v.tip).map((k: any) => {
      const t = v.tip === "TALEP" ? v : k.veri, p = v.tip === "TALEP" ? k.veri : v;
      return temelUyum(t, p) ? { k, s: eslesmeOnizle(t, p, BAGLAM) } : null;
    }).filter((x: any): x is { k: any; s: any } => !!x && x.s.uygunluk !== "UYGUN_DEGIL").sort((a: any, b: any) => b.s.skor - a.s.skor);

  const satirlar: Satir[] = useMemo(() => {
    if (!yorum) return [];
    if (ai) return ai.kayitlar.map((k, i) => {
      const kaynak = String(k.kaynakMetin || (ai.kayitlar.length === 1 ? islenen : k.ozet || islenen)).trim();
      const h = hizliAyristir(kaynak);
      const notlar = (k.notlar ?? []).filter((n: string) => !/^KONTROL/i.test(n));
      const uyarilar = (k.notlar ?? []).filter((n: string) => /^KONTROL/i.test(n)).map((n: string) => n.replace(/^KONTROL\s*:?\s*/i, ""));
      if ((k.haricKonumlar ?? []).length) uyarilar.push(`Hariç tutulan bölge: ${k.haricKonumlar.join(", ")}`);
      const p: YorumParca = { no: i + 1, metin: kaynak, h, konumlar: k.lokasyonIfadeleri ?? [], haricKonumlar: k.haricKonumlar ?? [], kisiAdi: k.kisiAdi ?? null, telefon: telNormalize(k.telefon) || h.telefon || null, tarih: null, grup: null, notlar, uyarilar, ek: {}, ilGeneli: false, altTur: yorum.tur };
      const { notlar: _n, haricKonumlar: _h, kaynakMetin: _k, telefon: _t, ...temiz } = k;
      return satirKur(p, yorum, secim, d, izler, kayitliMetinler, temiz, eslesmeBul);
    });
    return yorum.parcalar.map((p) => satirKur(p, yorum, secim, d, izler, kayitliMetinler, null, eslesmeBul));
  }, [yorum, ai, secim, izler, kayitliMetinler, aktif]);

  function temizle() { setYorum(null); setAi(null); setSoru(null); setHata(null); setSecili(new Set()); setAcik(null); setEklenenKisi(false); }

  async function calistir(m = metin) {
    const t = m.trim();
    if (!t) return;
    temizle(); setBasari(null); setYukleniyor(true); setSecim("OTO"); setIslenen(t);
    try {
      const y = yorumla(t, INDEKS);
      if (y.tur === "SORU") setSoru(await soruCevapla(t));
      else {
        setYorum(y);
        otoBekleyen.current = aiAyari(d).otomatik && y.parcalar.length === 1 && Math.round(y.guven * 100) < aiAyari(d).esik;
        // Çoklu sonuçta hazır olanlar seçili gelsin
        const on = y.parcalar.map((p) => satirKur(p, y, "OTO", d, izler, kayitliMetinler, null, () => []));
        setSecili(new Set(on.map((s, i) => (s.durum === "HAZIR" || s.durum === "KONTROL") && s.veri ? i : -1).filter((i) => i >= 0)));
      }
    } catch (e: any) {
      setHata("Metin okunamadı: " + (e?.message ?? e));
    } finally { setYukleniyor(false); }
  }

  async function soruCevapla(s: string) {
    let f = soruFiltresi(s), konumlar = konumOnerileri(konumBul(s, INDEKS)), yontem = "KURAL";
    if (!f.anlasilan.length && !konumlar.length && sample) {
      const c = await aiJson(sample, `Bir emlak uygulamasında kullanıcı şu soruyu sordu: "${s}".
Yalnızca şu JSON'u döndür: {"hedef":"PORTFOY|TALEP","aileler":["DEPO|URETIM|DUKKAN|YEME_ICME|OFIS|DAIRE|MUSTAKIL|ARSA|TURIZM"],"islemler":["SATILIK|KIRALIK|DEVREN_KIRALIK"],"konumlar":["ilçe/mahalle adı"],"m2Min":null,"m2Max":null,"fiyatMin":null,"fiyatMax":null,"odalar":[]}`, { modelTier: "default" });
      f = { ...f, ...c, ozellik: {}, anlasilan: ["yapay zekâ"] };
      if (Array.isArray(c?.konumlar)) konumlar = konumOnerileri(c.konumlar);
      yontem = "AI";
    }
    const filtre = bosFiltre({ aileler: f.aileler, islemler: f.islemler, konumlar, durumlar: ["ACTIVE"], odalar: f.odalar, m2Min: f.m2Min, m2Max: f.m2Max, fiyatMin: f.fiyatMin, fiyatMax: f.fiyatMax, acil: f.acil, ozellik: f.ozellik });
    const sonuc = d.kayitlar.filter((k: any) => k.veri.tip === f.hedef && filtreUygula(k.veri, filtre, kisiAd));
    const ozet = [konumlar.map((k: any) => k.etiket.split(" (")[0]).join(", "), f.m2Min != null ? `${f.m2Min.toLocaleString("tr-TR")} m² üstü` : null, f.m2Max != null ? `${f.m2Max.toLocaleString("tr-TR")} m² altı` : null, (f.odalar ?? []).join("/"), (f.islemler ?? []).map((i: string) => etiket(i).toLocaleLowerCase("tr")).join("/"), (f.aileler ?? []).map((a: string) => a.toLocaleLowerCase("tr").replace("_", " ")).join("/"), f.fiyatMax != null ? `≤ ${f.fiyatMax.toLocaleString("tr-TR")} TL` : null].filter(Boolean);
    return { filtre, hedef: f.hedef, sonuc, yontem, ozet: `${ozet.join(" · ") || "Tüm kayıtlar"} → ${sonuc.length} ${f.hedef === "PORTFOY" ? "portföy" : "talep"}` };
  }

  async function aiyaSor() {
    if (!sample || !yorum) return;
    setHata(null); setAiCalisiyor(true);
    try {
      const anahtar = metinParmakIzi(islenen);
      let c = onbellek.current.get(anahtar);
      if (!c) { c = await aiJson(sample, aiYorumIstemi(islenen, yorum, GEMINI_SISTEM_TALIMATI, GEMINI_RESPONSE_SCHEMA) + `\nHer kayda "kaynakMetin" alanı ekle: o kaydın çıkarıldığı özgün metin parçası (aynen, en fazla 600 karakter).`, { modelTier: "default" }); onbellek.current.set(anahtar, c); }
      const dogru = aiYanitiniDogrula(c);
      const gecerli = dogru.kayitlar;
      const kisiler: YorumKisi[] = dogru.kisiler.map((k) => ({ ...k, telefon: telNormalize(k.telefon) }));
      if (!gecerli.length && !kisiler.length) { setHata("Yapay zekâ bu metinden kayıt çıkaramadı; kural tabanlı okuma duruyor."); return; }
      const tur = (YORUM_ETIKETI as any)[c?.tur] ? c.tur : yorum.tur;
      setYorum({ ...yorum, tur, kisiler: gecerli.length ? yorum.kisiler : kisiler });
      setAi({ kayitlar: gecerli, aciklama: String(c?.aciklama || "Yapay zekâ metni yeniden okudu."), tur });
      setSecili(new Set(gecerli.map((_, i) => i)));
    } catch (e: any) {
      setHata(e?.code === "not_granted" ? "Yapay zekâya izin verilmedi; kural tabanlı okuma duruyor." : "Yapay zekâ yanıt veremedi: " + (e?.message ?? e?.code ?? e));
    } finally { setAiCalisiyor(false); }
  }

  useEffect(() => { if (otoBekleyen.current && yorum && !ai && sample && !aiCalisiyor) { otoBekleyen.current = false; void aiyaSor(); } }, [yorum]);

  function kisiBilgisi(v: any, p: YorumParca) {
    const ad = p.kisiAdi || v.gondeAdi || v.gondeSirket;
    if (!ad && !v.gondeTelefon) return null;
    const r = kisiRolleriOf(v.tip, v.ilanSahibiTipi, v.islemTipi);
    return { adSoyad: ad || telYaz(v.gondeTelefon) || "Yeni kişi", telefon: v.gondeTelefon ?? null, sirket: v.gondeSirket ?? null, roller: r.roller, rol: r.kayitRol };
  }

  /** Tanınmayan yer ifadeleri Konumlar › öğrenme adaylarına düşer (WhatsApp içe aktarmadaki davranışla aynı). */
  function konumOgren(kaydedilen: Satir[]) {
    const eksik = kaydedilen.filter((s) => s.cozulemeyen.length);
    if (!eksik.length) return;
    guncelle((x: any) => ({ ...x, adaylar: eksik.reduce((a, s) => adaylariGuncelle(a, s.cozulemeyen, coz(String(s.taslak.lokasyonHam ?? "").split(", ").filter(Boolean)).lokasyonlar, s.p.metin, s.p.tarih ? new Date(s.p.tarih) : BUGUN), x.adaylar) }));
  }

  function tekKaydet(s: Satir) {
    if (!s.veri) return;
    const v = { ...s.veri };
    const k = kisiBilgisi(v, s.p);
    if (k) { const id = kisiEkle(guncelle, d, { adSoyad: k.adSoyad, telefon: k.telefon, sirket: k.sirket, roller: k.roller, grup: s.p.grup }); v.kisiler = [{ kisiId: id, rol: k.rol }]; }
    const kayit = { id: yeniId(v.tip), olusturma: BUGUN.toISOString(), veri: v };
    kayitKaydet(kayit);
    konumOgren([s]);
    bildir(`${v.tip === "TALEP" ? "Talep" : "Portföy"} kaydedildi · ${s.eslesmeler.length} eşleşme`);
    temizle(); setMetin("");
    git({ ad: "detay", id: kayit.id });
  }

  function topluKaydet() {
    const secilen = satirlar.filter((s, i) => secili.has(i) && s.veri && !s.tekrar);
    if (!secilen.length) return;
    let sonuc: any;
    guncelle((eski: any) => (sonuc = topluEkle(eski, secilen.map((s) => ({ veri: s.veri, kisi: kisiBilgisi(s.veri, s.p) }))), sonuc.d));
    konumOgren(secilen);
    const talep = secilen.filter((s) => s.veri.tip === "TALEP").length;
    const m = `${secilen.length} kayıt eklendi${sonuc?.yeniKisi ? `, ${sonuc.yeniKisi} yeni kişi` : ""}`;
    setBasari({ metin: m, talep, portfoy: secilen.length - talep });
    bildir(m); temizle(); setMetin("");
  }

  function kisileriEkle() {
    if (!yorum) return;
    for (const k of yorum.kisiler) kisiEkle(guncelle, d, { adSoyad: k.adSoyad, telefon: k.telefon, sirket: k.sirket, roller: [] });
    bildir(`${yorum.kisiler.length} kişi eklendi`);
    setEklenenKisi(true);
  }

  const kayitliKayit = (s: Satir) => d.kayitlar.find((k: Kayit) => (k.veri.hamMetin && metinParmakIzi(k.veri.hamMetin) === metinParmakIzi(s.p.metin)) || (s.veri?.portalIlanNo && k.veri.portalIlanNo === s.veri.portalIlanNo)) ?? null;
  const tek = satirlar.length === 1 ? satirlar[0] : null;
  const firsat = tek?.veri && tek.veri.tip === "PORTFOY" && havuzKatmani(tek.veri) === "WEB" ? portfoyEdinmeFirsati(tek.eslesmeler.map((e) => e.s.skor)) : null;
  const sayim = { HAZIR: 0, KONTROL: 0, TEKRAR: 0, HATALI: 0 } as Record<string, number>;
  for (const s of satirlar) sayim[s.durum]++;
  const secilebilir = satirlar.map((s, i) => (s.veri && !s.tekrar ? i : -1)).filter((i) => i >= 0);
  const uzun = metin.length > 80 || metin.includes("\n");
  const aiUygun = !!sample && !!yorum && islenen.length <= 12000;
  const esik = aiAyari(d).esik;
  const guvenYuzde = yorum ? Math.round(yorum.guven * 100) : 100;
  const eminDegil = !!yorum && !ai && yorum.tur !== "KISI" && guvenYuzde < esik;
  const eksikler = yorum && !ai ? [...new Set(yorum.parcalar.flatMap((p) => ((p.guven ?? 100) < esik ? p.eksikler ?? [] : [])))].slice(0, 5) : [];
  const [genis, setGenis] = useState(false);
  const satirSayisi = Math.min(metin.split("\n").length + Math.floor(metin.length / 60), 40);
  const ornekler = ORNEKLER(ORNEK_TOPLANTI_NOTU);

  const Rozet = ({ s }: { s: Satir }) => <Pill ton={DURUM[s.durum][0]}>{DURUM[s.durum][1]}</Pill>;
  const Ozellikler = ({ s }: { s: Satir }) => {
    const v = s.veri ?? s.taslak;
    const kim = v.gondeSirket ?? v.gondeAdi ?? (v.ilanSahibiTipi === "MALIK" ? "Mülk sahibi" : null);
    const satir: [string, any][] = [
      ["Konum", (s.veri?.lokasyonlar ?? []).map(lokEtiket).join(" · ") || (s.p.ilGeneli ? `${ilAdiOf(calismaIliOku())} geneli` : null)],
      [v.tip === "TALEP" ? "Bütçe" : "Fiyat", s.veri && (v.fiyat ?? v.maxFiyat) != null ? fiyatOf(s.veri) : null],
      ["Alan", s.veri ? m2Of(s.veri) || null : null],
      ["Oda", v.odaSayisi ?? null],
      ["Kimden", kim ? <span>{kim}{v.gondeTelefon ? <><br /><span className="tel">{telYaz(v.gondeTelefon)}</span></> : null}</span> : v.gondeTelefon ? <span className="tel">{telYaz(v.gondeTelefon)}</span> : null],
      ["Kaynak", ((VERI_KANALI_ETIKET as Record<string, string>)[v.veriKanali] ?? v.veriKanali) + (v.portalIlanNo ? ` · İlan ${v.portalIlanNo}` : "") + (s.p.grup && s.p.tarih ? ` · ${new Date(s.p.tarih).toLocaleDateString("tr-TR")}` : "")],
    ];
    return <dl className="oz-alanlar">{satir.filter(([, x]) => x != null && x !== "").map(([e, x]) => <div key={e}><dt>{e}</dt><dd>{x}</dd></div>)}</dl>;
  };

  return (
    <section className={"ai-kutu" + (gomulu ? " gomulu" : "")} aria-label="Akıllı giriş">
      <div className="ai-cerceve">
        <div className="ai-ust">
          <span className="ai-isaret" aria-hidden="true">✦</span>
          <b>Anahtar AI</b>
          <span className="ipucu">İlan, sohbet, liste, telefon ya da soru — yapıştırın, gerisini ben ayırırım</span>
        </div>
        <div className="ai-giris">
          <textarea id={gomulu ? "ai-metin-veri" : "ai-metin"} className={genis ? "genis" : ""} rows={genis ? 14 : yorum || soru ? Math.min(3, Math.max(1, satirSayisi)) : Math.min(gomulu ? 9 : 6, Math.max(gomulu ? 4 : 2, satirSayisi))} value={metin}
            placeholder={gomulu ? "Portal ilan sayfası, WhatsApp mesajı ya da sohbet dökümü, toplantı notu, telefon numarası…" : "İlan, mesaj, liste, telefon ya da soru yazın / yapıştırın…"}
            onChange={(e: any) => setMetin(e.target.value)}
            onKeyDown={(e: any) => { if (e.key === "Enter" && !e.shiftKey && !metin.includes("\n") && !gomulu) { e.preventDefault(); calistir(); } }} />
          <div className="ai-eylem">
            {metin.length > 0 && <button type="button" className="ai-ikon" aria-label="Metni temizle" title="Temizle" onClick={() => { setMetin(""); temizle(); setGenis(false); }}>×</button>}
            {satirSayisi > 3 && <button type="button" className="ai-ikon" aria-label={genis ? "Metin kutusunu küçült" : "Metin kutusunu büyüt"} title={genis ? "Küçült" : "Büyüt"} onClick={() => setGenis(!genis)}>{genis ? "▴" : "▾"}</button>}
            <span className="ai-sayac">{metin.length > 200 ? `${metin.length.toLocaleString("tr-TR")} karakter` : ""}</span>
            <button className="ai-git" disabled={!metin.trim() || yukleniyor} onClick={() => calistir()} aria-label="Yorumla">{yukleniyor ? "…" : "Gönder"}</button>
          </div>
        </div>
        <div className="ai-alt">
          <div className="ai-oneriler">
            <span className="ai-ornek-et">Örnek:</span>
            {ornekler.map(([ad, m]) => <button key={ad} className="ai-oneri" onClick={() => { setMetin(m); calistir(m); }}>{ad}</button>)}
          </div>
        </div>
      </div>

      {hata && <div className="hata-kutu">{hata}</div>}
      {basari && (
        <div className="basari-kutu satir-ara">
          <span>{basari.metin}</span>
          <span className="satir sar">
            {basari.talep > 0 && <button className="btn kucuk" onClick={() => git({ ad: "liste", tip: "TALEP" })}>Talepler</button>}
            {basari.portfoy > 0 && <button className="btn kucuk" onClick={() => git({ ad: "liste", tip: "PORTFOY" })}>Portföyler</button>}
            <button className="btn kucuk" onClick={() => git({ ad: "eslesmeler" })}>Eşleşmeler</button>
          </span>
        </div>
      )}

      {soru && (
        <div className="ai-sonuc">
          <div className="satir-ara">
            <div><div className="ust-etiket">Arama</div><b>{soru.ozet}</b></div>
            <button className="x-btn" aria-label="Kapat" onClick={() => setSoru(null)}>×</button>
          </div>
          <div className="yigin kucuk-bosluk">
            {soru.sonuc.slice(0, 6).map((k: any) => (
              <button key={k.id} className="kart ai-satir" onClick={() => git({ ad: "detay", id: k.id })}>
                <div className="pill-satir"><Pill>{etiket(k.veri.mulkTipi)}</Pill><IslemPill islem={k.veri.islemTipi} />{k.veri.tip === "PORTFOY" && <HavuzRozeti v={k.veri} />}</div>
                <div className="kk-baslik">{baslikOf(k.veri)}</div>
                <div className="kk-alt">{k.veri.lokasyonlar.map(lokEtiket).join(" · ")} · {fiyatOf(k.veri)}{m2Of(k.veri) ? " · " + m2Of(k.veri) : ""}</div>
              </button>
            ))}
          </div>
          {!soru.sonuc.length && <p className="bos">Havuzda bu ölçütlerde kayıt yok.</p>}
          {soru.sonuc.length > 0 && <div className="satir sar"><button className="btn kucuk" onClick={() => git({ ad: "liste", tip: soru.hedef, filtre: soru.filtre })}>Listede aç{soru.sonuc.length > 6 ? ` (${soru.sonuc.length})` : ""}</button></div>}
        </div>
      )}

      {yorum && (
        <div className={"anla" + (eminDegil ? " emin-degil" : "")}>
          <div className="anla-bas">
            <span className="anla-tur">{YORUM_ETIKETI[yorum.tur]}</span>
            <span className={"yontem " + (ai ? "y-ai" : "y-kural")}>{ai ? "Yapay zekâ yorumladı" : "Kurallarla okundu · ücretsiz"}</span>
            {!ai && yorum.tur !== "KISI" && <span className={"guven " + (eminDegil ? "dusuk" : "iyi")} title={`Güven: kayıtların ortalama doluluk puanı. Eşik %${esik} (Ayarlar › Yapay zekâ)`}>Güven %{guvenYuzde}</span>}
            <button className="x-btn" aria-label="Kapat" onClick={temizle}>×</button>
          </div>
          <p className="anla-metin">{ai ? ai.aciklama : yorum.aciklama}</p>
          {yorum.atlanan.length > 0 && !ai && <div className="cip-satir">{yorum.atlanan.map((a) => <span key={a.neden} className="cip">{a.neden} <small>{a.sayi}</small></span>)}</div>}
          {eminDegil && (
            <div className="emin-uyari" role="alert">
              <b>Bu okumadan emin değilim</b>
              <span>Güven %{guvenYuzde}, eşik %{esik}.{eksikler.length ? ` Okuyamadıklarım: ${eksikler.join(", ")}.` : ""} {aiUygun ? "Kaydetmeden önce yapay zekâya yorumlatın ya da “Düzenle” ile elle tamamlayın." : "Kaydetmeden önce “Düzenle” ile kontrol edin."}</span>
              {aiUygun && <button className="btn birincil" disabled={aiCalisiyor} onClick={aiyaSor}>{aiCalisiyor ? "Yorumluyor…" : "Yapay zekâ yorumlasın"}</button>}
            </div>
          )}
          {aiUygun && !ai && !eminDegil && (
            <div className="anla-ai">
              <span>Sonuç doğru değilse:</span>
              <button className="btn kucuk" disabled={aiCalisiyor} onClick={aiyaSor}>{aiCalisiyor ? "Yorumluyor…" : "Yapay zekâ yorumlasın"}</button>
            </div>
          )}
          {ai && <div className="anla-ai"><span>Kural tabanlı okumaya dönmek için</span><button className="btn kucuk" onClick={() => { setAi(null); setSecili(new Set(yorum.parcalar.map((_, i) => i))); }}>Geri al</button></div>}
        </div>
      )}

      {yorum && yorum.kisiler.length > 0 && (
        <div className="kart yigin kucuk-bosluk">
          {yorum.kisiler.map((k, i) => {
            const var_ = k.telefon && d.kisiler.find((x: any) => x.telefon === k.telefon);
            return (
              <div key={i} className="kisi-oz">
                <span className="avatar kucuk">{k.adSoyad.slice(0, 1).toLocaleUpperCase("tr")}</span>
                <span><b>{k.adSoyad}</b>{k.sirket ? ` · ${k.sirket}` : ""}<br /><span className="tel">{k.telefon ? telYaz(k.telefon) : "telefon yok"}</span></span>
                {var_ ? <Pill>Kayıtlı: {var_.adSoyad}</Pill> : <Pill ton="iyi">Yeni</Pill>}
              </div>
            );
          })}
          <div className="satir sar">
            <button className="btn birincil" disabled={eklenenKisi} onClick={kisileriEkle}>{eklenenKisi ? "Eklendi" : yorum.kisiler.length > 1 ? `Kişilere ekle (${yorum.kisiler.length})` : "Kişilere ekle"}</button>
            {eklenenKisi && <button className="btn" onClick={() => git({ ad: "kisiler" })}>Kişilere git</button>}
          </div>
        </div>
      )}

      {tek && (
        <div className="yigin">
          {firsat?.var && <FirsatBandi sayi={firsat.sayi} />}
          <div className="kart kayit-oz">
            <div className="satir-ara">
              <div className="pill-satir">
                <div className="uc mini" role="group" aria-label="Kayıt türü">
                  {(["TALEP", "PORTFOY"] as const).map((t) => <button key={t} className={tek.taslak.tip === t ? "on" : ""} onClick={() => setSecim(t)}>{t === "TALEP" ? "Talep" : "Portföy"}</button>)}
                </div>
                <Pill>{etiket(tek.taslak.mulkTipi)}</Pill>
                <IslemPill islem={tek.taslak.islemTipi} />
                {tek.taslak.aciliyet === "ACIL" && <Pill ton="kotu">Acil</Pill>}
              </div>
              {tek.tekrar && (kayitliKayit(tek) ? <button className="btn kucuk" onClick={() => git({ ad: "detay", id: kayitliKayit(tek)!.id })}>Zaten kayıtlı · kayda git</button> : <Pill>Zaten kayıtlı</Pill>)}
            </div>
            <h3 className="oz-baslik">{tek.veri ? baslikOf(tek.veri) : tek.taslak.baslik}</h3>
            <Ozellikler s={tek} />
            {tek.veri && oneCikanlar(tek.veri).length > 0 && <div className="cip-satir">{oneCikanlar(tek.veri).map((c: string) => <span key={c} className="cip">{c}</span>)}</div>}
            {tek.p.notlar.length > 0 && <ul className="oz-notlar">{tek.p.notlar.map((n) => <li key={n}>{n}</li>)}</ul>}
            {(tek.p.uyarilar.length > 0 || tek.kontrol.length > 0) && <ul className="oz-uyari">{[...tek.p.uyarilar, ...tek.kontrol].map((u) => <li key={u}>{u}</li>)}</ul>}
            {tek.hatalar.length > 0 && <div className="hata-kutu">Kayda dönüşmesi için düzeltilmeli: {tek.hatalar.join("; ")}</div>}
            {tek.veri?.tip === "TALEP" && <EksikUyarisi v={tek.veri} telefon={tek.veri.gondeTelefon} />}
            {tek.veri && !tek.tekrar && (
              <button className="oz-eslesme" onClick={() => setAcik(acik === 0 ? null : 0)} disabled={!tek.eslesmeler.length}>
                <b>{tek.eslesmeler.length}</b>
                <span>{tek.eslesmeler.length ? `${tek.taslak.tip === "TALEP" ? "portföyle" : "taleple"} eşleşecek · en iyi %${tek.eslesmeler[0].s.skor}` : `Şu an eşleşen ${tek.taslak.tip === "TALEP" ? "portföy" : "talep"} yok`}</span>
                {tek.eslesmeler.length > 0 && <i aria-hidden="true">{acik === 0 ? "▴" : "▾"}</i>}
              </button>
            )}
            {acik === 0 && (
              <div className="yigin kucuk-bosluk">
                {tek.eslesmeler.slice(0, 8).map(({ k, s }) => (
                  <button key={k.id} className="ai-es" onClick={() => git({ ad: "detay", id: k.id })}>
                    <Skor s={s.skor} u={s.uygunluk} />
                    <span><b>{baslikOf(k.veri)}</b><small>{(UYGUNLUK as Record<string, { e: string }>)[s.uygunluk].e}{s.kritikEngeller.length ? "" : s.bilinmeyenKritikler.length ? ` · sorulacak: ${s.bilinmeyenKritikler.slice(0, 2).join(", ")}` : ""}</small></span>
                  </button>
                ))}
              </div>
            )}
            <div className="satir sar oz-eylem">
              <button className="btn birincil genis-btn" disabled={!tek.veri || tek.tekrar} onClick={() => tekKaydet(tek)}>{tek.taslak.tip === "TALEP" ? "Talebi kaydet" : "Portföyü kaydet"}</button>
              <button className="btn" onClick={() => git({ ad: "form", tip: tek.taslak.tip, taslak: tek.veri ?? tek.taslak, geri: GERI })}>Düzenle</button>
            </div>
          </div>
        </div>
      )}

      {satirlar.length > 1 && (
        <div className="yigin">
          <div className="toplu-cubuk coklu">
            <div className="coklu-sayim">
              <b>{satirlar.length} kayıt</b>
              {sayim.HAZIR > 0 && <Pill ton="iyi">{sayim.HAZIR} hazır</Pill>}
              {sayim.KONTROL > 0 && <Pill ton="uyari">{sayim.KONTROL} kontrol</Pill>}
              {sayim.TEKRAR > 0 && <Pill>{sayim.TEKRAR} zaten var</Pill>}
              {sayim.HATALI > 0 && <Pill ton="kotu">{sayim.HATALI} eksik</Pill>}
            </div>
            <div className="uc mini" role="group" aria-label="Kayıt türü">
              {([["OTO", "Metinden anla"], ["TALEP", "Hepsi talep"], ["PORTFOY", "Hepsi portföy"]] as const).map(([k, e]) => <button key={k} className={secim === k ? "on" : ""} onClick={() => setSecim(k)}>{e}</button>)}
            </div>
            <div className="coklu-eylem">
              <label className="onay-satir"><input type="checkbox" checked={secilebilir.length > 0 && secilebilir.every((i) => secili.has(i))} onChange={(e: any) => setSecili(e.target.checked ? new Set(secilebilir) : new Set())} /> Tümü</label>
              <button className="btn birincil" disabled={!secilebilir.some((i) => secili.has(i))} onClick={topluKaydet}>Seçilenleri kaydet ({secilebilir.filter((i) => secili.has(i)).length})</button>
            </div>
          </div>
          {satirlar.map((s, i) => {
            const v = s.veri ?? s.taslak;
            return (
              <div key={i} className={"kart coklu-satir d-" + s.durum.toLowerCase() + (secili.has(i) && s.veri && !s.tekrar ? " secili" : "")}>
                <div className="cs-ust">
                  <label className="onay-satir">
                    <input type="checkbox" aria-label="Seç" disabled={!s.veri || s.tekrar} checked={secili.has(i) && !!s.veri && !s.tekrar} onChange={(e: any) => setSecili((o: Set<number>) => { const n = new Set(o); e.target.checked ? n.add(i) : n.delete(i); return n; })} />
                    <span className={"tip-et " + (v.tip === "TALEP" ? "t" : "p")}>{v.tip === "TALEP" ? "Talep" : "Portföy"}</span>
                  </label>
                  <span className="cs-kim">{s.p.kisiAdi ?? (s.p.telefon ? telYaz(s.p.telefon) : "")}</span>
                  {(s.p.guven ?? 100) < esik && !ai && <span className="guven dusuk">%{s.p.guven}</span>}
                  <Rozet s={s} />
                </div>
                <div className="cs-baslik">{s.veri ? baslikOf(s.veri) : s.taslak.baslik}</div>
                <div className="cs-meta">
                  <IslemPill islem={v.islemTipi} />
                  <span>{(s.veri?.lokasyonlar ?? []).map(lokEtiket).join(" · ") || (s.p.ilGeneli ? `${ilAdiOf(calismaIliOku())} geneli` : "Konum yok")}</span>
                  {s.veri && (v.fiyat ?? v.maxFiyat) != null && <b>{fiyatOf(s.veri)}</b>}
                  {s.veri && m2Of(s.veri) && <span>{m2Of(s.veri)}</span>}
                  {s.eslesmeler.length > 0 && <span className="cs-es">{s.eslesmeler.length} eşleşme · %{s.eslesmeler[0].s.skor}</span>}
                </div>
                {(s.p.uyarilar.length > 0 || s.kontrol.length > 0 || s.hatalar.length > 0) && <div className="cs-uyari">{[...s.p.uyarilar, ...s.kontrol, ...s.hatalar].join(" · ")}</div>}
                {s.p.notlar.length > 0 && <div className="cs-not">{s.p.notlar.join(" · ")}</div>}
                <div className="cs-alt">
                  <button className="link-btn" onClick={() => setAcik(acik === i ? null : i)}>{acik === i ? "Metni gizle" : "Metni göster"}</button>
                  <button className="link-btn" onClick={() => git({ ad: "form", tip: v.tip, taslak: s.veri ?? s.taslak, geri: GERI })}>Düzenle</button>
                </div>
                {acik === i && <pre className="ham cs-ham">{s.p.metin}</pre>}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

/** Geriye dönük ad (v3.5–v3.8) */
export const AiKutusu = AkilliKutu;