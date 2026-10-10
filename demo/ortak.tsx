/**
 * Anahtar CRM v3.22.2 · 10 Ekim 2026
 * Demo — ekranların ortak parçaları: depo bağlamı, küçük bileşenler, eşleşme hesabı, konum öneri kutusu.
 */
import React, { createContext, useContext, useMemo, useRef, useState } from "react";
import { eslesmeOnizle, temelUyum, type OnizlemeSonucu, type Uygunluk } from "../src/lib/eslestirme/onizleme";
import { firsatDegerlendir, type FirsatSonuc } from "../src/lib/eslestirme/firsat";
import { kimOf } from "../src/lib/domain/kim";
import { etiket, tl } from "./etiketler";
import { BAGLAM, konumOner, lokEtiket, type KonumOnerisi } from "./lokasyon";
import { kalanGun, type DepoDurumu, type Kayit, type Veri, type OrnekHata } from "./depo";
import { sahiplikCozucu } from "./sahiplik";

// ───────── Bağlam ─────────
/** donus: bir formdan "Vazgeç / Kaydet" ile geri dönülüyor — içe aktarma / veri girişi ekranları yüklü dosya ve seçimlerini korur (demo/hafiza.ts) */
export type Ekran = (
  | { ad: "ana" } | { ad: "liste"; tip: "TALEP" | "PORTFOY"; filtre?: any } | { ad: "detay"; id: string }
  | { ad: "form"; tip: "TALEP" | "PORTFOY"; id?: string; taslak?: Partial<Veri>; adayId?: string; geri?: Ekran }
  | { ad: "eslesmeler" } | { ad: "eslesme"; tid: string; pid: string } | { ad: "izleme" }
  | { ad: "veri"; alt?: "metin" | "dosya" | "mesaj" | "wa" | "el"; metin?: string } | { ad: "konumlar" } | { ad: "kisiler" } | { ad: "kisi"; id: string } | { ad: "ayarlar" } | { ad: "baglantilar" } | { ad: "yonetim" }
) & { donus?: boolean };
export interface Ctx {
  d: DepoDurumu;
  guncelle: (f: (d: DepoDurumu) => DepoDurumu) => void;
  kayitKaydet: (k: Kayit) => void;
  bildir: (m: string) => void;
  ornekHatalari: OrnekHata[];
  git: (s: Ekran) => void;
  /** v3.16 — bir önceki ekrana dön (geçmiş boşsa Ana Sayfa) */
  geri: () => void;
  /** v3.16 — geçmişte dönülebilecek ekran var mı (Ana Sayfa'da gizlenir) */
  geriVar: boolean;
  sample: any | null | undefined; // yapay zekâ (undefined = henüz bilinmiyor, null = yok)
}
export const C = createContext<Ctx>(null as any);
export const useDepo = () => useContext(C);

// ───────── Küçük parçalar ─────────
export const cx = (...a: (string | false | undefined | null)[]) => a.filter(Boolean).join(" ");
export function Pill({ ton = "notr", children }: { ton?: string; children: React.ReactNode }) { return <span className={"pill p-" + ton}>{children}</span>; }
/** v3.4 — işlem tipine göre ayırt edilebilir renk: satılık turuncu, kiralık yeşil-mavi, devren mor */
export const islemTonu = (islem?: string | null) => !islem ? "notr" : islem === "SATILIK" ? "satilik" : /KIRALIK/.test(islem) && !/DEVREN/.test(islem) ? "kiralik" : /DEVREN/.test(islem) ? "devren" : "notr";
export function IslemPill({ islem }: { islem?: string | null }) { return <span className={"pill p-" + islemTonu(islem)}>{etiket(islem)}</span>; }

/**
 * v3.4 — Yapay zekâdan JSON al. Bazı görünümlerde `sample.json` yok ("n.json is not a function" hatası):
 * o durumda düz metin istenir ve yanıttaki JSON ayıklanır.
 */
export async function aiJson(sample: any, istem: string, secenek: Record<string, unknown> = {}): Promise<any> {
  if (!sample) throw { code: "yok", message: "Yapay zekâ bu görünümde yok" };
  if (typeof sample.json === "function") return sample.json(istem, secenek);
  const cagir = typeof sample === "function" ? sample : typeof sample.text === "function" ? sample.text : null;
  if (!cagir) throw { code: "yok", message: "Yapay zekâ arayüzü tanınmadı" };
  const r = await cagir(istem + "\n\nYanıtın yalnızca geçerli JSON olsun.", secenek);
  const metin: string = typeof r === "string" ? r : r?.text ?? "";
  const temiz = metin.replace(/```(?:json)?/gi, "").trim();
  const bas = temiz.search(/[\[{]/), son = Math.max(temiz.lastIndexOf("}"), temiz.lastIndexOf("]"));
  if (bas < 0 || son < bas) throw { code: "parse", message: "Yanıtta JSON bulunamadı", text: metin };
  try { return JSON.parse(temiz.slice(bas, son + 1)); } catch { throw { code: "parse", message: "Yanıttaki JSON okunamadı", text: metin }; }
}
export const UYGUNLUK: Record<Uygunluk, { e: string; ton: string }> = { SUNULABILIR: { e: "Sunulabilir", ton: "iyi" }, KOSULLU: { e: "Koşullu", ton: "uyari" }, UYGUN_DEGIL: { e: "Uygun değil", ton: "kotu" } };
export function Skor({ s, u }: { s: number; u: Uygunluk }) { return <div className={"skor s-" + UYGUNLUK[u].ton}><b>{s}</b><small>/100</small></div>; }
export function TTL({ v }: { v: Veri }) {
  const g = kalanGun(v); if (g == null) return null;
  if (g <= 0) return <Pill ton="kotu">Süresi doldu</Pill>;
  return <Pill ton={g <= 7 ? "kotu" : g <= 14 ? "uyari" : "notr"}>{g} gün</Pill>;
}
export const telYaz = (t?: string | null) => (t ?? "").replace(/^\+90(\d{3})(\d{3})(\d{2})(\d{2})$/, "+90 $1 $2 $3 $4");
export const tarihYaz = (t?: string | Date | null, saat = false) => t ? new Date(t).toLocaleString("tr-TR", saat ? { dateStyle: "medium", timeStyle: "short" } : { dateStyle: "medium" }) : "—";
/** v3.10 — mülk tipi etiketi; talepte birden çok tip varsa "Dükkan / Mağaza +1" */
export const tipYaz = (v: Partial<Veri>) => `${etiket(v.mulkTipi)}${(v.alternatifMulkTipleri ?? []).length ? ` +${v.alternatifMulkTipleri!.length}` : ""}`;
export const baslikOf = (v: Partial<Veri>) => v.baslik || `${etiket(v.mulkTipi)}${v.odaSayisi ? " " + v.odaSayisi : ""} · ${etiket(v.islemTipi)}`;
const para = (n: number, pb?: string, per?: string) => (pb && pb !== "TRY" ? n.toLocaleString("tr-TR") + " " + etiket(pb) + (per === "AYLIK" ? " / ay" : "") : tl(n, per));
export const fiyatOf = (v: Partial<Veri>) => v.tip === "TALEP"
  ? (v.maxFiyat != null ? "≤ " + para(v.maxFiyat, v.paraBirimi, v.fiyatPeriyodu) : "Bütçe yok")
  : (v.fiyat != null ? para(v.fiyat, v.paraBirimi, v.fiyatPeriyodu) : "Fiyat yok");
export const m2Of = (v: Partial<Veri>) => v.tip === "TALEP" ? (v.minM2 || v.maxM2 ? `${v.minM2?.toLocaleString("tr-TR") ?? "…"}–${v.maxM2?.toLocaleString("tr-TR") ?? "…"} m²` : "") : v.m2 ? v.m2.toLocaleString("tr-TR") + " m²" : "";
export function oneCikanlar(v: Partial<Veri>): string[] {
  const o = (v.ozellik ?? {}) as any, r: string[] = [];
  if (v.odaSayisi) r.push(v.odaSayisi);
  if (o.elektrikGucuKw) r.push(`${o.elektrikGucuKw} kW`);
  if (o.aracErisimi) r.push(etiket(o.aracErisimi) + (v.tip === "TALEP" ? "+" : ""));
  if (o.rampaSayisi) r.push(`Rampa ×${o.rampaSayisi}`); else if (o.rampa) r.push("Rampa");
  if (o.makasAltiYukseklikM) r.push(`Makas ${o.makasAltiYukseklikM} m`); else if (o.netYukseklikM) r.push(`Yükseklik ${o.netYukseklikM} m`);
  if (o.vincKapasitesiTon) r.push(`Vinç ${o.vincKapasitesiTon} t`);
  if (o.sogukHavaM2) r.push(`Soğuk ${o.sogukHavaM2} m²`); else if (o.sogukHava) r.push("Soğuk hava");
  if (o.vitrin) r.push("Vitrin"); if (o.anaCaddeUzeri) r.push("Ana cadde");
  if (o.siteIcinde) r.push("Site"); if (o.havuz) r.push("Havuz"); if (o.esyaDurumu) r.push(etiket(o.esyaDurumu));
  if (v.krediyeUygun) r.push("Krediye uygun");
  if (o.otelOdaSayisi) r.push(`${o.otelOdaSayisi} oda`);
  if (o.imarDurumu) r.push("İmar: " + etiket(o.imarDurumu));
  if (o.ruhsatDurumu) r.push(etiket(o.ruhsatDurumu));
  return r.slice(0, 6);
}
export const enumYaz = (s: string) => s.replace(/\b[A-Z][A-Z_]{2,}\b/g, (x) => (x === "TIR" ? x : etiket(x)));
export function Kopyala({ metin, etiketi = "Kopyala" }: { metin: string; etiketi?: string }) {
  const [ok, setOk] = useState(false);
  return <button className="btn kucuk" onClick={() => { navigator.clipboard?.writeText(metin).then(() => { setOk(true); setTimeout(() => setOk(false), 1500); }).catch(() => {}); }}>{ok ? "Kopyalandı" : etiketi}</button>;
}
/** Açılır-kapanır bölüm (varsayılan kapalı; özet satırı kapalıyken de bilgi verir) */
export function Bolum({ baslik, ozet, acik = false, children, id }: { baslik: string; ozet?: React.ReactNode; acik?: boolean; children: React.ReactNode; id?: string }) {
  return <details className="kart bolum" open={acik} id={id}><summary><span className="bolum-baslik">{baslik}</span>{ozet ? <span className="bolum-ozet">{ozet}</span> : null}</summary><div className="bolum-ic">{children}</div></details>;
}

// ───────── Eşleşme hesabı ─────────
/** f: v3.19 fırsat önceliği — kim ↔ kim (mülk sahibi/müşteri öncelikli, emlakçı↔emlakçı ikinci planda) */
export interface Eslesme { t: Kayit; p: Kayit; s: OnizlemeSonucu; f: FirsatSonuc }
/** v3.8: koparılan eşleşmeler (durum REDDEDILDI) varsayılan olarak hariç; Eşleşmeler ekranı ve eşleşme detayı dahil eder */
export function useEslesmeler(koparilanDahil = false): Eslesme[] {
  const { d } = useDepo();
  const tum = useMemo(() => {
    const aktif = d.kayitlar.filter((k) => k.veri.durum === "ACTIVE");
    const T = aktif.filter((k) => k.veri.tip === "TALEP"), P = aktif.filter((k) => k.veri.tip === "PORTFOY");
    const r: Eslesme[] = [];
    const kimler = new Map<string, ReturnType<typeof kimOf>>();
    const kim = (k: Kayit) => { let x = kimler.get(k.id); if (!x) { x = kimOf(k.veri as any, d.kisiler); kimler.set(k.id, x); } return x; };
    // v3.22.1 — ★ Benim / ◆ Ofisim olan taraf fırsat önceliğine girer (src/lib/eslestirme/firsat.ts)
    const sc = sahiplikCozucu(d), sahipler = new Map<string, "BENIM" | "OFIS" | null>();
    const sahip = (k: Kayit) => { if (!sahipler.has(k.id)) sahipler.set(k.id, sc(k.veri).tur); return sahipler.get(k.id)!; };
    for (const t of T) for (const p of P) if (temelUyum(t.veri as any, p.veri as any)) {
      const f = firsatDegerlendir(kim(t).tur, kim(p).tur, { islemTipi: String(p.veri.islemTipi), fiyat: p.veri.fiyat ?? null, butce: t.veri.maxFiyat ?? null, talepSahip: sahip(t), portfoySahip: sahip(p) });
      r.push({ t, p, s: eslesmeOnizle(t.veri as any, p.veri as any, BAGLAM), f });
    }
    const sira: Record<Uygunluk, number> = { SUNULABILIR: 0, KOSULLU: 1, UYGUN_DEGIL: 2 };
    // v3.19 — önce uygunluk, sonra fırsat kademesi (sahibinden ↔ müşteri önde), sonra skor
    return r.sort((a, b) => sira[a.s.uygunluk] - sira[b.s.uygunluk] || b.f.sira - a.f.sira || b.s.skor - a.s.skor);
  }, [d.kayitlar, d.kisiler, d.ogrenilen, d.ayarlar.sahiplik, d.ayarlar.paylasim]);
  return useMemo(() => (koparilanDahil ? tum : tum.filter((e) => d.eslesmeNotlari[`${e.t.id}~${e.p.id}`]?.durum !== "REDDEDILDI")), [tum, d.eslesmeNotlari, koparilanDahil]);
}
export const eKey = (tid: string, pid: string) => `${tid}~${pid}`;

// ───────── Konum öneri kutusu (yazdıkça öneri) ─────────
const TUR_ETIKET: Record<KonumOnerisi["tur"], string> = { IL: "İl", ILCE: "İlçe", MAHALLE: "Mahalle", ALTBOLGE: "Alt bölge", REFERANS: "Referans", YAZIM: "Yazım" };
export function KonumSecici({ onSec, placeholder = "Konum yazın: Hurma, Işıklar, Kundu…", id, otoOdak = false, onEnterMetin }: { onSec: (o: KonumOnerisi) => void; placeholder?: string; id?: string; otoOdak?: boolean; onEnterMetin?: (metin: string) => void }) {
  const [q, setQ] = useState("");
  const [aktif, setAktif] = useState(0);
  const [acik, setAcik] = useState(false);
  const liste = useMemo(() => konumOner(q, 8), [q]);
  const kutu = useRef<HTMLInputElement>(null);
  const sec = (o: KonumOnerisi) => { onSec(o); setQ(""); setAcik(false); setAktif(0); kutu.current?.focus(); };
  return <div className="konum-secici">
    <input ref={kutu} id={id} autoFocus={otoOdak} role="combobox" aria-expanded={acik && liste.length > 0} aria-autocomplete="list" placeholder={placeholder} value={q} autoComplete="off"
      onChange={(e) => { setQ(e.target.value); setAcik(true); setAktif(0); }} onFocus={() => setAcik(true)} onBlur={() => setTimeout(() => setAcik(false), 150)}
      onKeyDown={(e) => {
        if (e.key === "ArrowDown") { e.preventDefault(); setAktif((a) => Math.min(a + 1, liste.length - 1)); }
        else if (e.key === "ArrowUp") { e.preventDefault(); setAktif((a) => Math.max(a - 1, 0)); }
        else if (e.key === "Enter") { e.preventDefault(); if (liste[aktif] && acik) sec(liste[aktif]); else if (onEnterMetin && q.trim()) { onEnterMetin(q); setQ(""); } }
        else if (e.key === "Escape") setAcik(false);
      }} />
    {acik && liste.length > 0 && <ul className="oneri-liste" role="listbox">
      {liste.map((o, i) => <li key={o.anahtar} role="option" aria-selected={i === aktif} className={cx(i === aktif && "on")} onMouseDown={(e) => { e.preventDefault(); sec(o); }} onMouseEnter={() => setAktif(i)}>
        <b>{o.etiket}</b><span>{o.alt}</span><small className={"tur t-" + o.tur}>{TUR_ETIKET[o.tur]}</small></li>)}
    </ul>}
    {acik && q.trim().length >= 2 && !liste.length && <div className="oneri-bos">Eşleşen yer yok{onEnterMetin ? " — Enter'a basarsanız ifade 'Konum öğrenme' listesine eklenir" : ""}.</div>}
  </div>;
}
export { lokEtiket };