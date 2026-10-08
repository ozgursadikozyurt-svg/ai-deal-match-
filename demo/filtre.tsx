/**
 * Anahtar CRM v3.21.1 · 8 Ekim 2026
 * Demo — ortak filtre paneli (Talepler, Portföyler, Eşleşmeler, talep içi portföy çekmecesi).
 * Her alan çoklu seçim. Mülk türü seçilince o türe özel filtreler çıkar (ONEMLI_ALANLAR).
 * v3.5 — Kompakt: ekranda tek satır (arama · Acil · Filtrele rozeti) + tek satır kayan aktif çipler.
 * Ayrıntılı filtreler alttan açılan sayfada, akordeon bölümlerle; altta "N sonucu göster".
 */
import { SayiGir } from "./girdi";
import React, { useMemo, useState } from "react";
import { MULK_AILELERI, aileOf, MULK_TIPI_META } from "../src/lib/domain/kategori";
import { MULK_OZELLIK_META, SIRALAMA, odaSayisiAyristir, odaListesi, KAT_SECENEKLERI, katUyumu, katYaz, istenenKatlarOf, type MulkOzellikAlani } from "../src/lib/domain/teknik-alanlar";
import { ONEMLI_ALANLAR } from "../src/lib/domain/form-alanlari";
import { etiket, ISLEM_TIPI_ETIKET, VERI_KANALI_ETIKET } from "./etiketler";
import { BAGLAM, lokEtiket, type KonumOnerisi } from "./lokasyon";
import { kalanGun, type Veri } from "./depo";
import { useDepo, cx, KonumSecici, islemTonu, baslikOf } from "./ortak";
import { alanTuru } from "./form";
import { KISI_ROLLERI } from "./kisiler";

export interface Filtre {
  ara: string;
  aileler: string[];
  islemler: string[];
  konumlar: KonumOnerisi[];
  durumlar: string[];
  kisiler: string[];
  kanallar: string[];
  odalar: string[];
  fiyatMin?: number | null; fiyatMax?: number | null;
  m2Min?: number | null; m2Max?: number | null;
  acil?: boolean;
  /** v3.15 — yalnızca takasa açık kayıtlar */
  takas?: boolean;
  /** v3.16 — kayda bağlı kişilerin rolüne göre (Alıcı, Yatırımcı, Emlakçı…) */
  roller: string[];
  ozellik: Record<string, any>;
}
export const bosFiltre = (x: Partial<Filtre> = {}): Filtre => ({ ara: "", aileler: [], islemler: [], konumlar: [], durumlar: [], kisiler: [], kanallar: [], odalar: [], roller: [], ozellik: {}, ...x });
const ODALAR = ["1+0", "1+1", "2+1", "3+1", "4+1", "5+"];
const DURUMLAR: [string, string][] = [["ACTIVE", "Aktif"], ["PASSIVE", "Pasif"], ["ARSIV", "Arşiv"], ["EXPIRED", "Süresi doldu"]];

/** Konum eşleşmesi: seçilen ilçe / mahalle / alt bölge ile kaydın konumlarından biri örtüşüyor mu */
function konumTutar(v: Veri, secim: KonumOnerisi[]): boolean {
  return secim.some((s) => v.lokasyonlar.some((l) => {
    if (s.lok.mahalleId) return l.mahalleId === s.lok.mahalleId || (!!l.altBolgeId && !!BAGLAM.altBolgeMahalleleri.get(l.altBolgeId)?.has(s.lok.mahalleId)) || (!l.mahalleId && !l.altBolgeId && l.ilceId === s.lok.ilceId);
    if (s.lok.altBolgeId) return l.altBolgeId === s.lok.altBolgeId || (!!l.mahalleId && !!BAGLAM.altBolgeMahalleleri.get(s.lok.altBolgeId)?.has(l.mahalleId));
    return l.ilceId === s.lok.ilceId;
  }));
}
export function filtreUygula(v: Veri, f: Filtre, kisiAd?: (id: string) => string, kisiRol?: (id: string) => string[]): boolean {
  const o = (v.ozellik ?? {}) as any, talep = v.tip === "TALEP";
  if (f.ara) {
    const q = f.ara.toLocaleLowerCase("tr");
    const kisi = (v.kisiler ?? []).map((b) => kisiAd?.(b.kisiId) ?? "").join(" ");
    if (!`${baslikOf(v)} ${etiket(v.mulkTipi)} ${v.lokasyonlar.map(lokEtiket).join(" ")} ${v.gondeAdi ?? ""} ${kisi} ${v.hamMetin ?? ""} ${v.kayitGrubu ?? ""}`.toLocaleLowerCase("tr").includes(q)) return false;
  }
  if (f.aileler.length) { const tipler = [v.mulkTipi, ...(v.alternatifMulkTipleri ?? [])]; if (!tipler.some((t) => f.aileler.includes(aileOf(t as any).kod))) return false; }
  if (f.islemler.length && ![v.islemTipi, ...(v.alternatifIslemTipleri ?? [])].some((i) => f.islemler.includes(i))) return false;
  if (f.konumlar.length && !konumTutar(v, f.konumlar)) return false;
  if (f.durumlar.length) { const d = (kalanGun(v) ?? 1) <= 0 && v.durum === "ACTIVE" ? "EXPIRED" : v.durum; if (!f.durumlar.includes(d)) return false; }
  if (f.kisiler.length && !(v.kisiler ?? []).some((b) => f.kisiler.includes(b.kisiId))) return false;
  if (f.kanallar.length && !f.kanallar.includes(v.veriKanali)) return false;
  if (f.acil && !(v.aciliyet === "ACIL" || v.aciliyet === "YUKSEK")) return false;
  if (f.takas && v.takasaAcik !== true) return false; // v3.15
  // v3.16 — kayda bağlı kişilerin rolü (kişi kartındaki roller; kayıttaki bağ rolü değil)
  if ((f.roller ?? []).length && !(v.kisiler ?? []).some((b) => (kisiRol?.(b.kisiId) ?? []).some((r) => f.roller.includes(r)))) return false;
  const fiyat = talep ? v.maxFiyat : v.fiyat;
  if (f.fiyatMin != null && !(fiyat != null && fiyat >= f.fiyatMin)) return false;
  if (f.fiyatMax != null && !(talep ? (v.minFiyat ?? 0) <= f.fiyatMax : fiyat != null && fiyat <= f.fiyatMax)) return false;
  if (f.m2Min != null || f.m2Max != null) {
    const lo = talep ? v.minM2 ?? v.maxM2 : v.m2 ?? o.kapaliAlanM2 ?? o.arsaAlanM2, hi = talep ? v.maxM2 ?? v.minM2 : lo;
    if (lo == null) return false;
    if (f.m2Min != null && (hi ?? lo) < f.m2Min) return false;
    if (f.m2Max != null && lo > f.m2Max) return false;
  }
  if (f.odalar.length) {
    const rl = odaListesi(v.odaSayisi); if (!rl.length) return false; // v3.19: talep birden çok oda isteyebilir
    if (!f.odalar.some((x) => rl.some((r) => (x === "5+" ? r.oda >= 5 : odaSayisiAyristir(x)!.oda === r.oda)))) return false;
  }
  for (const [a, fv] of Object.entries(f.ozellik)) {
    if (fv == null || fv === "" || (Array.isArray(fv) && !fv.length)) continue;
    const m = MULK_OZELLIK_META[a as MulkOzellikAlani] as any, t = alanTuru(a as MulkOzellikAlani), vv = o[a];
    if (a === "istenenKatlar") { // v3.15: talepte istenen katlardan biri tutuyorsa; portföyde katı seçilenlerden birine uyuyorsa
      const fk = fv as string[];
      const uyar = talep ? istenenKatlarOf(o).some((x) => fk.includes(x)) : katUyumu(fk, o.bulunduguKat, o.katSayisi) === "SAGLANDI";
      if (!uyar) return false; continue;
    }
    if (t.tur === "bool") { if (vv !== true) return false; continue; }
    if (t.tur === "enum") {
      if (m.karsilastirma === "sirali") { const s = (SIRALAMA as any)[a] as string[]; if (!vv || s.indexOf(vv) < Math.min(...(fv as string[]).map((x) => s.indexOf(x)))) return false; }
      else if (!(fv as string[]).includes(vv)) return false;
      continue;
    }
    if (t.tur === "coklu") { if (!(vv ?? []).some((x: string) => (fv as string[]).includes(x))) return false; continue; }
    if (t.tur === "sayi") { if (vv == null || (m.karsilastirma === "max" ? vv > fv : vv < fv)) return false; }
  }
  return true;
}
export const aktifFiltreSayisi = (f: Filtre) => f.aileler.length + f.islemler.length + f.konumlar.length + f.durumlar.length + f.kisiler.length + f.kanallar.length + f.odalar.length + (f.fiyatMin != null ? 1 : 0) + (f.fiyatMax != null ? 1 : 0) + (f.m2Min != null ? 1 : 0) + (f.m2Max != null ? 1 : 0) + (f.acil ? 1 : 0) + (f.takas ? 1 : 0) + (f.roller ?? []).length + Object.values(f.ozellik).filter((v) => v != null && v !== "" && !(Array.isArray(v) && !v.length)).length;

function CokluCip({ secenekler, secili, degis, ton }: { secenekler: [string, string, number?][]; secili: string[]; degis: (x: string[]) => void; ton?: (k: string) => string }) {
  return <div className="cip-satir">{secenekler.map(([k, l, n]) => { const on = secili.includes(k); return <button type="button" key={k} className={cx("cip secilir", on && "on", on && ton && "t-" + ton(k))} onClick={() => degis(on ? secili.filter((x) => x !== k) : [...secili, k])}>{l}{n != null && <small> {n}</small>}</button>; })}</div>;
}
const sayiYap = (s: string) => (s.trim() === "" ? null : Number(s.replace(/\./g, "").replace(",", ".")) || null);

/**
 * @param ogeler sayım için (çiplerin yanındaki adetler)
 * @param gizle gösterilmeyecek bölümler
 */
export interface EkBolum { k: string; baslik: string; ozet: string; icerik: React.ReactNode; aktif: number }
export function FiltrePaneli({ f, set, ogeler, gizle = [], yerTutucu = "Ara: başlık, bölge, kişi, mesaj…", acikBaslat = false, ek = [], sonucEtiketi, sirala }: { f: Filtre; set: (f: Filtre) => void; ogeler: Veri[]; gizle?: string[]; yerTutucu?: string; acikBaslat?: boolean; ek?: EkBolum[]; sonucEtiketi?: string; sirala?: React.ReactNode }) {
  const { d } = useDepo();
  const [acik, setAcik] = useState(acikBaslat);
  const [acikBolum, setAcikBolum] = useState<string | null>("aile");
  const [kisiQ, setKisiQ] = useState("");
  const sayi = (fn: (v: Veri) => boolean) => ogeler.filter(fn).length;
  const aileSec = MULK_AILELERI.filter((a) => ogeler.some((v) => aileOf(v.mulkTipi as any).kod === a.kod) || f.aileler.includes(a.kod));
  const islemSec = Object.keys(ISLEM_TIPI_ETIKET).filter((i) => ogeler.some((v) => v.islemTipi === i) || f.islemler.includes(i));
  const kanalSec = Object.keys(VERI_KANALI_ETIKET).filter((k) => ogeler.some((v) => v.veriKanali === k));
  // Türe özel filtreler: seçilen ailelerin hepsi aynı mülk grubundaysa
  const gruplar = [...new Set(f.aileler.map((a) => MULK_TIPI_META[MULK_AILELERI.find((x) => x.kod === a)!.tipler[0]].grup))];
  const turAlanlari = gruplar.length === 1 ? ONEMLI_ALANLAR[gruplar[0]].filter((a) => a !== "bulunduguKat") : [];
  const konutVar = f.aileler.some((a) => a === "DAIRE" || a === "MUSTAKIL" || a === "DEVRE_MULK") || (!f.aileler.length && ogeler.some((v) => v.odaSayisi));
  const n = aktifFiltreSayisi(f) + ek.reduce((a, b) => a + b.aktif, 0);
  const setO = (a: string, v: any) => set({ ...f, ozellik: { ...f.ozellik, [a]: v } });
  const kisiAd = (id: string) => d.kisiler.find((k) => k.id === id)?.adSoyad ?? id;

  // Aktif filtre çipleri (kaldırılabilir)
  const cipler: { etiket: string; kaldir: () => void }[] = [
    ...f.aileler.map((a) => ({ etiket: MULK_AILELERI.find((x) => x.kod === a)?.etiket ?? a, kaldir: () => set({ ...f, aileler: f.aileler.filter((x) => x !== a) }) })),
    ...f.islemler.map((a) => ({ etiket: etiket(a), kaldir: () => set({ ...f, islemler: f.islemler.filter((x) => x !== a) }) })),
    ...f.konumlar.map((k) => ({ etiket: k.etiket, kaldir: () => set({ ...f, konumlar: f.konumlar.filter((x) => x.anahtar !== k.anahtar) }) })),
    ...f.odalar.map((a) => ({ etiket: a, kaldir: () => set({ ...f, odalar: f.odalar.filter((x) => x !== a) }) })),
    ...f.durumlar.map((a) => ({ etiket: DURUMLAR.find((x) => x[0] === a)?.[1] ?? a, kaldir: () => set({ ...f, durumlar: f.durumlar.filter((x) => x !== a) }) })),
    ...f.kisiler.map((a) => ({ etiket: kisiAd(a), kaldir: () => set({ ...f, kisiler: f.kisiler.filter((x) => x !== a) }) })),
    ...f.kanallar.map((a) => ({ etiket: (VERI_KANALI_ETIKET as any)[a], kaldir: () => set({ ...f, kanallar: f.kanallar.filter((x) => x !== a) }) })),
    ...(f.fiyatMin != null ? [{ etiket: `≥ ${f.fiyatMin.toLocaleString("tr-TR")} TL`, kaldir: () => set({ ...f, fiyatMin: null }) }] : []),
    ...(f.fiyatMax != null ? [{ etiket: `≤ ${f.fiyatMax.toLocaleString("tr-TR")} TL`, kaldir: () => set({ ...f, fiyatMax: null }) }] : []),
    ...(f.m2Min != null ? [{ etiket: `≥ ${f.m2Min} m²`, kaldir: () => set({ ...f, m2Min: null }) }] : []),
    ...(f.m2Max != null ? [{ etiket: `≤ ${f.m2Max} m²`, kaldir: () => set({ ...f, m2Max: null }) }] : []),
    ...(f.acil ? [{ etiket: "Acil", kaldir: () => set({ ...f, acil: false }) }] : []),
    ...(f.takas ? [{ etiket: "Takasa açık", kaldir: () => set({ ...f, takas: false }) }] : []),
    ...(f.roller ?? []).map((r) => ({ etiket: `Rol: ${KISI_ROLLERI.find(([k]) => k === r)?.[1] ?? r}`, kaldir: () => set({ ...f, roller: f.roller.filter((x) => x !== r) }) })),
    ...Object.entries(f.ozellik).filter(([, v]) => v != null && v !== "" && !(Array.isArray(v) && !v.length)).map(([a, v]) => ({ etiket: `${(MULK_OZELLIK_META as any)[a]?.etiket}${v === true ? "" : ": " + (Array.isArray(v) ? (a === "istenenKatlar" ? katYaz(v) : v.map(etiket).join("/")) : typeof v === "number" ? (((MULK_OZELLIK_META as any)[a]?.karsilastirma === "max") ? "≤ " : "≥ ") + v : etiket(v))}`, kaldir: () => setO(a, null) })),
  ];

  const kisiRol = (id: string) => d.kisiler.find((k) => k.id === id)?.roller ?? [];
  const sonucSayisi = ogeler.filter((v) => filtreUygula(v, f, kisiAd, kisiRol)).length;
  const aileOzet = f.aileler.length ? MULK_AILELERI.filter((a) => f.aileler.includes(a.kod)).map((a) => a.etiket.split(" /")[0]).join(", ") : "Tüm mülkler";
  const aralikOzet = (a?: number | null, b?: number | null, birim = "") => a == null && b == null ? "Tümü" : `${a != null ? a.toLocaleString("tr-TR") : "…"} – ${b != null ? b.toLocaleString("tr-TR") : "…"}${birim}`;
  const turSayisi = Object.values(f.ozellik).filter((v) => v != null && v !== "" && !(Array.isArray(v) && !v.length)).length;
  const bolumler: { k: string; baslik: string; ozet: string; icerik: React.ReactNode }[] = [
    ...ek,
    ...(!gizle.includes("aile") ? [{ k: "aile", baslik: "Mülk türü", ozet: aileOzet, icerik: <CokluCip secenekler={aileSec.map((a) => [a.kod, a.etiket, sayi((v) => aileOf(v.mulkTipi as any).kod === a.kod)])} secili={f.aileler} degis={(x) => set({ ...f, aileler: x, ozellik: {} })} /> }] : []),
    ...(!gizle.includes("islem") ? [{ k: "islem", baslik: "İşlem", ozet: f.islemler.length ? f.islemler.map(etiket).join(", ") : "Tümü", icerik: <CokluCip secenekler={islemSec.map((i) => [i, etiket(i), sayi((v) => v.islemTipi === i)])} secili={f.islemler} degis={(x) => set({ ...f, islemler: x })} ton={islemTonu} /> }] : []),
    ...(!gizle.includes("takas") ? [{ k: "takas", baslik: "Takas", ozet: f.takas ? "Takasa açık" : "Tümü", icerik: <CokluCip secenekler={[["EVET", "Takasa açık", sayi((v) => v.takasaAcik === true)]]} secili={f.takas ? ["EVET"] : []} degis={(x) => set({ ...f, takas: x.includes("EVET") })} /> }] : []),
    ...(!gizle.includes("konum") ? [{ k: "konum", baslik: "Konum / mahalle", ozet: f.konumlar.length ? f.konumlar.map((k) => k.etiket.split(" (")[0]).join(", ") : "Tümü", icerik: <div className="yigin kucuk-bosluk">
      <KonumSecici placeholder="İlçe, mahalle, bölge ekle…" onSec={(o) => { if (!f.konumlar.some((x) => x.anahtar === o.anahtar)) set({ ...f, konumlar: [...f.konumlar, o] }); }} />
      {f.konumlar.length > 0 && <div className="cip-satir">{f.konumlar.map((k) => <button type="button" key={k.anahtar} className="cip aktif" onClick={() => set({ ...f, konumlar: f.konumlar.filter((x) => x.anahtar !== k.anahtar) })}>{k.etiket} ×</button>)}</div>}
    </div> }] : []),
    ...(!gizle.includes("fiyat") ? [{ k: "fiyat", baslik: "Fiyat (TL)", ozet: aralikOzet(f.fiyatMin, f.fiyatMax), icerik: <div className="aralik"><SayiGir binlik ph="en az" etiket="en az" deger={f.fiyatMin} onChange={(n) => set({ ...f, fiyatMin: typeof n === "number" && n > 0 ? n : null })} /><span>–</span><SayiGir binlik ph="en fazla" etiket="en fazla" deger={f.fiyatMax} onChange={(n) => set({ ...f, fiyatMax: typeof n === "number" && n > 0 ? n : null })} /></div> }] : []),
    ...(!gizle.includes("m2") ? [{ k: "m2", baslik: "Alan (m²)", ozet: aralikOzet(f.m2Min, f.m2Max, " m²"), icerik: <div className="aralik"><SayiGir binlik ph="en az" etiket="en az" deger={f.m2Min} onChange={(n) => set({ ...f, m2Min: typeof n === "number" && n > 0 ? n : null })} /><span>–</span><SayiGir binlik ph="en fazla" etiket="en fazla" deger={f.m2Max} onChange={(n) => set({ ...f, m2Max: typeof n === "number" && n > 0 ? n : null })} /></div> }] : []),
    ...(konutVar && !gizle.includes("oda") ? [{ k: "oda", baslik: "Oda", ozet: f.odalar.join(", ") || "Tümü", icerik: <CokluCip secenekler={ODALAR.map((o) => [o, o])} secili={f.odalar} degis={(x) => set({ ...f, odalar: x })} /> }] : []),
    ...(turAlanlari.length ? [{ k: "tur", baslik: `${MULK_AILELERI.filter((a) => f.aileler.includes(a.kod)).map((a) => a.etiket.split(" /")[0]).join(", ")} özellikleri`, ozet: turSayisi ? `${turSayisi} seçili` : "Tümü", icerik: <div className="fp-tur">
      <div className="alanlar">{turAlanlari.filter((a) => alanTuru(a).tur !== "bool").map((a) => {
        const m = MULK_OZELLIK_META[a] as any, t = alanTuru(a), v = f.ozellik[a];
        if (a === "istenenKatlar") return <div key={a} className="alan genis"><label>Kat (birden fazla seçilebilir)</label><CokluCip secenekler={KAT_SECENEKLERI.map(([k, l]) => [k, l])} secili={v ?? []} degis={(x) => setO(a, x)} /></div>;
        if (t.tur === "enum" || t.tur === "coklu") return <div key={a} className="alan genis"><label>{m.etiket}{m.karsilastirma === "sirali" ? " (en az)" : ""}</label><CokluCip secenekler={t.degerler.filter((x) => x !== "YOK").map((x) => [x, etiket(x)])} secili={v ?? []} degis={(x) => setO(a, x)} /></div>;
        if (t.tur === "sayi") return <div key={a} className="alan"><label>{m.etiket}{m.birim ? ` (${m.birim})` : ""} · {m.karsilastirma === "max" ? "en fazla" : "en az"}</label><input inputMode="decimal" value={v ?? ""} onChange={(e) => setO(a, sayiYap(e.target.value))} /></div>;
        return null;
      })}</div>
      {turAlanlari.some((a) => alanTuru(a).tur === "bool") && <div className="alan-etiket">Olsun</div>}
      <div className="cip-satir">{turAlanlari.filter((a) => alanTuru(a).tur === "bool").map((a) => <button type="button" key={a} className={cx("cip secilir", f.ozellik[a] && "on")} onClick={() => setO(a, f.ozellik[a] ? null : true)}>{f.ozellik[a] ? "✓ " : ""}{(MULK_OZELLIK_META as any)[a].etiket}</button>)}</div>
    </div> }] : []),
    ...(!gizle.includes("durum") ? [{ k: "durum", baslik: "Durum", ozet: f.durumlar.map((a) => DURUMLAR.find((x) => x[0] === a)?.[1]).join(", ") || "Tümü", icerik: <CokluCip secenekler={DURUMLAR.map(([k, l]) => [k, l])} secili={f.durumlar} degis={(x) => set({ ...f, durumlar: x })} /> }] : []),
    ...(!gizle.includes("rol") ? [{ k: "rol", baslik: "Kişi rolü", ozet: (f.roller ?? []).map((r) => KISI_ROLLERI.find(([k]) => k === r)?.[1] ?? r).join(", ") || "Tümü", icerik: <CokluCip secenekler={KISI_ROLLERI.map(([k, l]) => [k, l])} secili={f.roller ?? []} degis={(x) => set({ ...f, roller: x })} /> }] : []),
    ...(!gizle.includes("kisi") ? [{ k: "kisi", baslik: "Kişi", ozet: f.kisiler.map(kisiAd).join(", ") || "Tümü", icerik: <div className="yigin kucuk-bosluk">
      <input placeholder="Kişi ara…" value={kisiQ} onChange={(e) => setKisiQ(e.target.value)} />
      {kisiQ.trim().length >= 2 && <div className="cip-satir">{d.kisiler.filter((k) => `${k.adSoyad} ${k.telefon ?? ""} ${k.sirket ?? ""}`.toLocaleLowerCase("tr").includes(kisiQ.toLocaleLowerCase("tr"))).slice(0, 8).map((k) => <button type="button" key={k.id} className="cip secilir" onClick={() => { if (!f.kisiler.includes(k.id)) set({ ...f, kisiler: [...f.kisiler, k.id] }); setKisiQ(""); }}>{k.adSoyad}</button>)}</div>}
    </div> }] : []),
    ...(!gizle.includes("kanal") && kanalSec.length > 1 ? [{ k: "kanal", baslik: "Kaynak", ozet: f.kanallar.map((a) => (VERI_KANALI_ETIKET as any)[a]).join(", ") || "Tümü", icerik: <CokluCip secenekler={kanalSec.map((k) => [k, (VERI_KANALI_ETIKET as any)[k]])} secili={f.kanallar} degis={(x) => set({ ...f, kanallar: x })} /> }] : []),
  ];

  return <div className="filtre-paneli">
    <div className="fc">
      <div className="fc-ara"><span aria-hidden="true">⌕</span><input type="search" aria-label="Ara" placeholder={yerTutucu} value={f.ara} onChange={(e) => set({ ...f, ara: e.target.value })} /></div>
      {!gizle.includes("acil") && <button type="button" className={cx("fc-hizli", f.acil && "on")} onClick={() => set({ ...f, acil: !f.acil })} aria-pressed={!!f.acil}>Acil</button>}
      <button type="button" className={cx("fc-btn", n > 0 && "on")} onClick={() => setAcik(true)} aria-haspopup="dialog">Filtrele{n ? <span className="fc-rozet">{n}</span> : null}</button>
      {sirala}
    </div>
    {cipler.length > 0 && <div className="aktif-filtreler">{cipler.map((c, i) => <button type="button" key={i} className="cip aktif" onClick={c.kaldir}>{c.etiket} <span aria-hidden="true">×</span></button>)}<button type="button" className="fc-temizle" onClick={() => set(bosFiltre({ ara: f.ara }))}>Temizle</button></div>}
    {acik && <div className="fs-perde" onClick={() => setAcik(false)}>
      <div className="fs-sayfa" role="dialog" aria-label="Filtreler" onClick={(e) => e.stopPropagation()}>
        <div className="fs-bas"><b>Filtreler</b><button type="button" className="btn kucuk" onClick={() => setAcik(false)}>Kapat</button></div>
        <div className="fs-govde">
          {bolumler.map((b) => <div key={b.k} className={cx("fs-bolum", acikBolum === b.k && "acik")}>
            <button type="button" className="fs-satir" onClick={() => setAcikBolum(acikBolum === b.k ? null : b.k)} aria-expanded={acikBolum === b.k}>
              <span className="fs-ad">{b.baslik}</span><span className={cx("fs-ozet", b.ozet !== "Tümü" && b.ozet !== "Tüm mülkler" && "dolu")}>{b.ozet}</span><span className="fs-ok" aria-hidden="true">›</span>
            </button>
            {acikBolum === b.k && <div className="fs-icerik">{b.icerik}</div>}
          </div>)}
          {!f.aileler.length && !gizle.includes("aile") && <p className="ipucu fs-not">Mülk türü seçince ona özel filtreler (yükseklik, araç erişimi, cephe…) eklenir.</p>}
        </div>
        <div className="fs-ayak"><button type="button" className="btn" onClick={() => set(bosFiltre({ ara: f.ara }))}>Temizle</button><button type="button" className="btn birincil genis-btn" onClick={() => setAcik(false)}>{sonucEtiketi ?? `${sonucSayisi} sonucu göster`}</button></div>
      </div>
    </div>}
  </div>;
}


// ───────────────────────────── v3.7 Sıralama ─────────────────────────────
import { sirala as siralaUygula, yonEtiket, type Siralama, type SiralamaSecenegi, type Yon } from "../src/lib/siralama";
export { siralaUygula, type Siralama };
import type { Kayit, Kisi } from "./depo";

/** Filtre çubuğundaki "Sırala" düğmesi: alan seçilir, yön (büyükten küçüğe / küçükten büyüğe) değiştirilir */
export function SiralaDugmesi<T>({ secenekler, s, set }: { secenekler: SiralamaSecenegi<T>[]; s: Siralama; set: (s: Siralama) => void }) {
  const [acik, setAcik] = useState(false);
  const sec = secenekler.find((x) => x.alan === s.alan) ?? secenekler[0];
  return <div className="sirala">
    <button type="button" className="fc-btn sirala-btn" onClick={() => setAcik(!acik)} aria-haspopup="menu" aria-expanded={acik} title={`Sıralama: ${sec.etiket}, ${yonEtiket(sec.alan, s.yon)}`}>
      <span aria-hidden="true">{s.yon === "azalan" ? "↓" : "↑"}</span> <span className="sirala-et">{sec.etiket}</span>
    </button>
    {acik && <><div className="sirala-perde" onClick={() => setAcik(false)} />
      <div className="sirala-menu" role="menu">
        <div className="sirala-baslik">Sırala</div>
        {secenekler.map((x) => <button type="button" key={x.alan} role="menuitemradio" aria-checked={x.alan === s.alan} className={cx("sirala-oge", x.alan === s.alan && "on")} onClick={() => set(x.alan === s.alan ? s : { alan: x.alan, yon: x.varsayilanYon })}>{x.etiket}{x.alan === s.alan && <span aria-hidden="true">✓</span>}</button>)}
        <div className="uc sirala-yon">{(["azalan", "artan"] as Yon[]).map((y) => <button type="button" key={y} className={cx(s.yon === y && "on")} onClick={() => { set({ ...s, yon: y }); setAcik(false); }}>{y === "azalan" ? "↓ " : "↑ "}{yonEtiket(sec.alan, y)}</button>)}</div>
      </div></>}
  </div>;
}

const ACIL_SIRA: Record<string, number> = { ACIL: 3, YUKSEK: 2, NORMAL: 1, DUSUK: 0 };
const tarihNo = (x?: unknown) => (x ? new Date(x as any).getTime() || null : null);
export function kayitSiralama(tip?: "TALEP" | "PORTFOY"): SiralamaSecenegi<Kayit>[] {
  const l: SiralamaSecenegi<Kayit>[] = [
    { alan: "giris", etiket: "Kayda giriş", deger: (k) => tarihNo(k.olusturma), varsayilanYon: "azalan" },
    { alan: "fiyat", etiket: tip === "TALEP" ? "Bütçe" : "Fiyat", deger: (k) => k.veri.fiyat ?? k.veri.maxFiyat ?? k.veri.minFiyat ?? null, varsayilanYon: "azalan" },
    { alan: "m2", etiket: "m²", deger: (k) => k.veri.m2 ?? k.veri.maxM2 ?? k.veri.minM2 ?? null, varsayilanYon: "azalan" },
    { alan: "sure", etiket: "Kalan süre", deger: (k) => tarihNo(k.veri.validUntil), varsayilanYon: "artan" },
    { alan: "tarih", etiket: "İlan / mesaj tarihi", deger: (k) => tarihNo(k.veri.mesajTarihi), varsayilanYon: "azalan" },
  ];
  if (tip !== "PORTFOY") l.push({ alan: "aciliyet", etiket: "Aciliyet", deger: (k) => (k.veri.tip === "TALEP" ? ACIL_SIRA[k.veri.aciliyet ?? "NORMAL"] : null), varsayilanYon: "azalan" });
  l.push({ alan: "baslik", etiket: "Başlık", deger: (k) => k.veri.baslik ?? null, varsayilanYon: "artan" });
  return l;
}
export function kisiSiralama(kayitSayisi: (id: string) => number): SiralamaSecenegi<Kisi>[] {
  return [
    { alan: "ad", etiket: "Ad", deger: (k) => k.adSoyad, varsayilanYon: "artan" },
    { alan: "giris", etiket: "Eklenme", deger: (k) => tarihNo(k.olusturma), varsayilanYon: "azalan" },
    { alan: "kayit", etiket: "Kayıt sayısı", deger: (k) => kayitSayisi(k.id), varsayilanYon: "azalan" },
    { alan: "iletisim", etiket: "Son iletişim", deger: (k) => tarihNo(k.sonIletisim), varsayilanYon: "azalan" },
  ];
}