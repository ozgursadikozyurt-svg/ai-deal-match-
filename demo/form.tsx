/**
 * Anahtar CRM v3.21.2 · 8 Ekim 2026
 * Demo — kayıt formu. Şemadan üretilir; mülk grubuna göre yalnızca anlamlı alanlar,
 * önce "önemli alanlar", gerisi "Tüm alanlar" altında. Bölümler varsayılan kapalı.
 */
import { SayiGir, TelGirdisi, sayiYap } from "./girdi";
import { telStandart, telBicimle, telUyarisi } from "../src/lib/iletisim";
import { talepDnasi } from "../src/lib/eslestirme/talep-dna";
import { EksikUyarisi } from "./motor-ui";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { KayitCreateSchema, MulkOzellikSchema } from "../src/lib/validation/kayit";
import { MULK_OZELLIK_META, alanGruptaMi, KAT_SECENEKLERI, odaListesi, odaYaz, type MulkOzellikAlani } from "../src/lib/domain/teknik-alanlar";
import { anaKategoriOf, islemKategoriUyumlu, MULK_AILELERI, aileOf, benzerAileler } from "../src/lib/domain/kategori";
import { ONEMLI_ALANLAR, TEMEL_EKSTRA } from "../src/lib/domain/form-alanlari";
import { adaylariGuncelle } from "../src/lib/lokasyon/ogrenme";
import { etiket, KRITER_ETIKET, ISLEM_TIPI_ETIKET, ILAN_SAHIBI_ETIKET, VERI_KANALI_ETIKET, MULK_TIPI_META, HAVUZ_ETIKET } from "./etiketler";
import { coz, cozulenToKayitLok, lokEtiket, ilAdiOf, calismaIliOku } from "./lokasyon";
import { BUGUN, varsayilanValidUntil, yeniId, sureUzat, type Kayit, type Veri } from "./depo";
import { useDepo, cx, Bolum, KonumSecici, tarihYaz, telYaz, type Ekran } from "./ortak";
import { konumOgret } from "./konumlar";
import { KisiSecici } from "./kisiler";
import { ttlGun } from "../src/lib/domain/gecerlilik";

type Alan = MulkOzellikAlani;
type Tur = { tur: "sayi" } | { tur: "bool" } | { tur: "metin" } | { tur: "tarih" } | { tur: "enum"; degerler: string[] } | { tur: "coklu"; degerler: string[] };
const SEKIL: Record<string, any> = (MulkOzellikSchema as any)._def.schema.shape;
export function turOf(t: any): Tur {
  for (let i = 0; i < 10; i++) {
    const n = t?._def?.typeName;
    if (n === "ZodOptional" || n === "ZodNullable" || n === "ZodDefault") { t = t._def.innerType; continue; }
    if (n === "ZodEffects") { t = t._def.schema; continue; }
    if (n === "ZodNativeEnum") return { tur: "enum", degerler: Object.values(t._def.values) as string[] };
    if (n === "ZodArray") { const e = turOf(t._def.type); return { tur: "coklu", degerler: e.tur === "enum" ? e.degerler : [] }; }
    if (n === "ZodBoolean") return { tur: "bool" };
    if (n === "ZodString") return { tur: "metin" };
    if (n === "ZodDate") return { tur: "tarih" };
    return { tur: "sayi" };
  }
  return { tur: "metin" };
}
export const alanTuru = (a: Alan) => turOf(SEKIL[a]);
const UST_ETIKET: Record<string, string> = { mulkTipi: "Mülk tipi", islemTipi: "İşlem tipi", fiyat: "Fiyat", minFiyat: "En az bütçe", maxFiyat: "Bütçe (en fazla)", m2: "Alan", netM2: "Net alan", minM2: "En az alan", maxM2: "En fazla alan", lokasyonlar: "Lokasyon", gondeTelefon: "Telefon", gondeAdi: "Ad", anaKategori: "Ana kategori", validUntil: "Geçerlilik", baslik: "Başlık", odaSayisi: "Oda sayısı", alternatifMulkTipleri: "Alternatif mülk tipleri", mesajTarihi: "Mesaj tarihi" };
export const hataEtiketi = (path: (string | number)[]) => path[0] === "ozellik" ? ((MULK_OZELLIK_META as any)[path[1]]?.etiket ?? KRITER_ETIKET[String(path[1])] ?? String(path[1])) : UST_ETIKET[String(path[0])] ?? path.join(".");
/** v3.10: eksik ya da hatalı numara null döner (önceden ham metni döndürüp kaydı doğrulamada takılıyordu). */
export const telNormalize = (s?: string | null): string | null => telStandart(s);
const tarihInput = (v: any) => (v ? new Date(v).toISOString().slice(0, 10) : "");

// ───────── Mülk tipi seçici: önce aile, sonra ayrıntı; talepte birden fazla tip ─────────
function MulkTipiSecici({ f, set, talep }: { f: any; set: (k: string, v: any) => void; talep: boolean }) {
  const aile = aileOf(f.mulkTipi);
  const alt: string[] = f.alternatifMulkTipleri ?? [];
  const benzer = benzerAileler(aile.kod);
  // v3.10 — talepte birden çok mülk seçilebilir (ör. Dükkan + Daire). İlk seçilen ana tiptir; diğerleri alternatifMulkTipleri'ne yazılır.
  const secili: string[] = [f.mulkTipi, ...alt.filter((t) => t !== f.mulkTipi)];
  const yaz = (liste: string[]) => { const tekil = [...new Set(liste)].slice(0, 6); set("mulkTipi", tekil[0]); set("alternatifMulkTipleri", tekil.slice(1)); };
  const seciliAileler = MULK_AILELERI.filter((a) => (a.tipler as string[]).some((t) => secili.includes(t)));
  const aileDegis = (a: (typeof MULK_AILELERI)[number]) => {
    if (!talep) { if (a.kod !== aile.kod) { set("mulkTipi", a.tipler[0]); set("alternatifMulkTipleri", []); } return; }
    const icinde = secili.filter((t) => (a.tipler as string[]).includes(t));
    if (!icinde.length) return yaz([...secili, a.tipler[0]]);
    const kalan = secili.filter((t) => !(a.tipler as string[]).includes(t));
    if (kalan.length) yaz(kalan); // son kalan aile kaldırılamaz
  };
  const tipDegis = (t: string) => {
    if (!talep) { set("mulkTipi", t); set("alternatifMulkTipleri", alt.filter((x) => x !== t)); return; }
    if (!secili.includes(t)) return yaz([...secili, t]);
    if (secili.length > 1) yaz(secili.filter((x) => x !== t));
  };
  const ayrintiAileleri = talep ? seciliAileler : [aile];
  return <div className="tip-secici">
    <div className="alan-etiket">{talep ? <>Aradığı mülk <span className="ipucu">(birden çok seçilebilir: Dükkan + Daire gibi)</span></> : "Mülk"}</div>
    <div className="aile-izgara">{MULK_AILELERI.map((a) => { const on = talep ? seciliAileler.includes(a) : a.kod === aile.kod; return <button type="button" key={a.kod} aria-pressed={on} className={cx("aile", on && "on")} onClick={() => aileDegis(a)}>{talep && on && <span className="aile-tik" aria-hidden="true">✓ </span>}{a.etiket}</button>; })}</div>
    {talep && secili.length > 1 && <div className="cip-satir secili-tipler">{secili.map((t, i) => <span key={t} className="cip buyuk">{MULK_TIPI_META[t as keyof typeof MULK_TIPI_META].etiket}{i === 0 ? <small>ana</small> : <button type="button" className="birincil-sec" onClick={() => yaz([t, ...secili.filter((x) => x !== t)])}>ana yap</button>}<button type="button" className="sil" aria-label="Kaldır" onClick={() => tipDegis(t)}>×</button></span>)}</div>}
    {ayrintiAileleri.some((a) => a.tipler.length > 1) && <><div className="alan-etiket">Ayrıntı <span className="ipucu">(isteğe bağlı)</span></div>
      <div className="cip-satir">{ayrintiAileleri.flatMap((a) => a.tipler.length > 1 ? a.tipler : []).map((t) => <button type="button" key={t} className={cx("cip secilir", (talep ? secili.includes(t) : f.mulkTipi === t) && "on")} onClick={() => tipDegis(t)}>{MULK_TIPI_META[t].etiket}</button>)}</div></>}
    {talep && benzer.length > 0 && <div className="alt-tipler">
      <div className="alan-etiket">Benzer tipler <span className="ipucu">(eklerseniz doğrudan aranır)</span></div>
      <div className="cip-satir">
        {benzer.flatMap((b) => b.aile.tipler.slice(0, 3).map((t) => <button type="button" key={t} title={b.aciklama} className={cx("cip secilir benzer", secili.includes(t) && "on")} onClick={() => tipDegis(t)}>{MULK_TIPI_META[t].etiket} <small>benzer</small></button>))}
      </div>
      <p className="ipucu">Seçmeseniz de eşleştirme {benzer.map((b) => b.aile.etiket).join(", ")} portföylerini “benzer tip” olarak (koşullu) gösterir.</p>
    </div>}
  </div>;
}

// ───────── Lokasyon: yazdıkça öneri + serbest metin çözme + tanınmayanı öğretme ─────────
function LokasyonDuzenle({ lok, setLok, portfoy }: { lok: Veri["lokasyonlar"]; setLok: (l: Veri["lokasyonlar"]) => void; portfoy: boolean }) {
  const { guncelle, bildir } = useDepo();
  const [metin, setMetin] = useState("");
  const [cozulemedi, setCozulemedi] = useState<string[]>([]);
  const ekle = (yeni: Veri["lokasyonlar"]) => {
    const hepsi = [...lok];
    for (const l of yeni) if (!hepsi.some((x) => x.ilId === l.ilId && x.ilceId === l.ilceId && x.mahalleId === l.mahalleId && x.altBolgeId === l.altBolgeId)) hepsi.push(l);
    if (portfoy && hepsi.length && !hepsi.some((x) => x.birincil)) hepsi[0] = { ...hepsi[0], birincil: true };
    setLok(hepsi);
  };
  const metniCoz = (m: string) => {
    const r = coz(m);
    ekle(cozulenToKayitLok(r.lokasyonlar, false).map(({ etiket, seviye, ...l }) => l));
    setCozulemedi(r.cozulemeyen);
    if (r.cozulemeyen.length) guncelle((d) => ({ ...d, adaylar: adaylariGuncelle(d.adaylar, r.cozulemeyen, r.lokasyonlar, m) }));
    else setMetin("");
  };
  return <div className="lokasyon-ed">
    <div className="cip-satir">
      {lok.map((l, i) => <span key={i} className="cip buyuk">{lokEtiket(l)}{portfoy && lok.length > 1 && <button type="button" className={cx("birincil-sec", l.birincil && "on")} onClick={() => setLok(lok.map((x, j) => ({ ...x, birincil: j === i })))}>{l.birincil ? "birincil" : "birincil yap"}</button>}<button type="button" className="sil" aria-label="Kaldır" onClick={() => setLok(lok.filter((_, j) => j !== i))}>×</button></span>)}
      {!lok.length && <span className="ipucu">{portfoy ? "Mülkün konumu" : `Aranan bölgeler (boş = ${ilAdiOf(calismaIliOku())} geneli)`}</span>}
    </div>
    <KonumSecici id="lok-ara" placeholder={portfoy ? "Konum yazın: Hurma, Gençlik, Kundu…" : "Bölge yazın ve listeden seçin: Konyaaltı, Lara, Işıklar…"} onSec={(o) => ekle([{ ...o.lok, birincil: false }])} onEnterMetin={metniCoz} />
    <p className="ipucu">Başka il için il ya da ilçe adıyla yazın: “İzmir Bornova”, “Bodrum”, “Maslak”.</p>
    <details className="ic-detay"><summary>Mesajdaki bölge listesini yapıştır</summary>
      <div className="satir"><input id="lok-metin" placeholder="Aksu Pınarlı çevresi, Yenigöl / Altınova olur…" value={metin} onChange={(e) => setMetin(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); metniCoz(metin); } }} /><button type="button" className="btn" onClick={() => metniCoz(metin)} disabled={!metin.trim()}>Çöz ve ekle</button></div>
    </details>
    {cozulemedi.map((c) => <div key={c} className="uyari-kutu ogret">
      <span>“{c}” tanınmadı ve Konum öğrenme listesine eklendi. Nereye yakın olduğunu seçerseniz sistem bunu öğrenir:</span>
      <KonumSecici placeholder={`“${c}” → mahalle / bölge`} onSec={(o) => { konumOgret(guncelle, c, o.lok); ekle([{ ...o.lok, birincil: false }]); setCozulemedi((x) => x.filter((y) => y !== c)); bildir(`Öğrenildi: “${c}” → ${o.etiket}`); }} />
    </div>)}
  </div>;
}

// ───────── Teknik alanlar: önce önemli olanlar; evet/hayır özellikleri tek satır çip ─────────
function BoolCip({ a, v, talep, onChange }: { a: Alan; v: boolean | null | undefined; talep: boolean; onChange: (x: boolean | null) => void }) {
  const m = MULK_OZELLIK_META[a];
  const sonraki = v == null ? true : v ? false : null;
  const durum = v == null ? "" : v ? (talep ? "istiyor" : "var") : (talep ? "istemiyor" : "yok");
  return <button type="button" className={cx("bool-cip", v === true && "evet", v === false && "hayir")} onClick={() => onChange(sonraki)} aria-label={`${m.etiket}: ${durum || "belirtilmedi"}`}>
    <span className="isaret" aria-hidden="true">{v === true ? "✓" : v === false ? "✕" : "+"}</span>{m.etiket}{durum && <small>{durum}</small>}
  </button>;
}
function TeknikAlanlar({ f, setO, talep }: { f: any; setO: (k: string, v: any) => void; talep: boolean }) {
  const grup = MULK_TIPI_META[f.mulkTipi as keyof typeof MULK_TIPI_META]?.grup ?? "DIGER";
  const [tumu, setTumu] = useState(false);
  const [kva, setKva] = useState<boolean>(f.ozellik.elektrikGucuKw == null && f.ozellik.elektrikGucuKva != null);
  const tum = (Object.keys(MULK_OZELLIK_META) as Alan[]).filter((a) => alanGruptaMi(a, grup) && (MULK_OZELLIK_META[a] as any).formda !== false && !["kritikKriterler", "esnekKriterler", "eksikBilgiler"].includes(a) && (talep ? a !== "bulunduguKat" : a !== "istenenKatlar"));
  const onemli = ONEMLI_ALANLAR[grup].filter((a) => tum.includes(a));
  const diger = tum.filter((a) => !onemli.includes(a));
  const dolu = (a: Alan) => f.ozellik[a] != null && !(Array.isArray(f.ozellik[a]) && !f.ozellik[a].length);
  const girdi = (a: Alan) => {
    const m = MULK_OZELLIK_META[a] as any, t = alanTuru(a), v = f.ozellik[a], idx = "oz-" + a;
    const ek = talep ? (m.karsilastirma === "min" || m.karsilastirma === "sirali" ? " · en az" : m.karsilastirma === "max" ? " · en fazla" : "") : "";
    if (a === "istenenKatlar") return <div key={a} className="alan genis"><label>İstenen kat(lar) · birden fazla seçilebilir</label><div className="cip-satir">{KAT_SECENEKLERI.map(([k, l]) => { const on = ((v as string[] | undefined) ?? []).includes(k); return <button type="button" key={k} className={cx("cip secilir", on && "on")} onClick={() => setO(a, on ? (v as string[]).filter((y) => y !== k) : [...((v as string[] | undefined) ?? []), k])}>{l}</button>; })}</div></div>;
    if (a === "elektrikGucuKw") return <div key={a} className="alan"><label htmlFor={idx}>Elektrik gücü{ek}</label>
      <div className="birimli"><SayiGir id={idx} deger={kva ? f.ozellik.elektrikGucuKva : v} onChange={(x) => { if (kva) { setO("elektrikGucuKva", x); setO("elektrikGucuKw", null); } else { setO("elektrikGucuKw", x); setO("elektrikGucuKva", null); } }} />
        <div className="uc mini">{(["kW", "kVA"] as const).map((b) => <button type="button" key={b} className={cx((b === "kVA") === kva && "on")} onClick={() => setKva(b === "kVA")}>{b}</button>)}</div></div>
      {kva && <small className="ipucu">kVA × 0,8 = kW olarak kaydedilir</small>}</div>;
    const lbl = <label htmlFor={idx}>{m.etiket}{m.birim ? ` (${m.birim})` : ""}{ek}</label>;
    if (t.tur === "enum") return <div key={a} className="alan">{lbl}<select id={idx} value={v ?? ""} onChange={(e) => setO(a, e.target.value || null)}><option value="">{talep ? "Fark etmez" : "—"}</option>{t.degerler.map((x) => <option key={x} value={x}>{etiket(x)}</option>)}</select></div>;
    if (t.tur === "coklu") return <div key={a} className="alan genis">{lbl}<div className="cip-satir">{t.degerler.map((x) => { const on = (v ?? []).includes(x); return <button type="button" key={x} className={cx("cip secilir", on && "on")} onClick={() => setO(a, on ? v.filter((y: string) => y !== x) : [...(v ?? []), x])}>{etiket(x)}</button>; })}</div></div>;
    if (t.tur === "tarih") return <div key={a} className="alan">{lbl}<input id={idx} type="date" value={tarihInput(v)} onChange={(e) => setO(a, e.target.value ? new Date(e.target.value + "T12:00:00").toISOString() : null)} /></div>;
    if (t.tur === "metin") return <div key={a} className="alan">{lbl}<input id={idx} value={v ?? ""} onChange={(e) => setO(a, e.target.value || null)} /></div>;
    return <div key={a} className="alan">{lbl}<SayiGir id={idx} deger={v} onChange={(x) => setO(a, x)} /></div>;
  };
  const cizim = (liste: Alan[]) => {
    const deger = liste.filter((a) => alanTuru(a).tur !== "bool"), bool = liste.filter((a) => alanTuru(a).tur === "bool");
    return <>{deger.length > 0 && <div className="alanlar">{deger.map(girdi)}</div>}
      {bool.length > 0 && <div className="cip-satir bool-satir">{bool.map((a) => <BoolCip key={a} a={a} v={f.ozellik[a]} talep={talep} onChange={(x) => setO(a, x)} />)}</div>}</>;
  };
  const gruplu = useMemo(() => { const m = new Map<string, Alan[]>(); for (const a of diger) { const g = MULK_OZELLIK_META[a].grup; m.set(g, [...(m.get(g) ?? []), a]); } return [...m.entries()]; }, [f.mulkTipi]);
  return <div className="teknik">
    <p className="ipucu">{etiket(f.mulkTipi)} için en çok kullanılan alanlar. Özelliklere dokundukça değişir: {talep ? "✓ istiyor → ✕ istemiyor → boş (fark etmez)" : "✓ var → ✕ yok → boş (bilinmiyor)"}.</p>
    {cizim(onemli)}
    {diger.length > 0 && <button type="button" className="btn kucuk" onClick={() => setTumu(!tumu)}>{tumu ? "Diğer alanları gizle" : `Tüm alanlar (${diger.length} alan daha${diger.filter(dolu).length ? `, ${diger.filter(dolu).length} dolu` : ""})`}</button>}
    {tumu && gruplu.map(([g, a]) => <div key={g} className="tgrup"><div className="ust-etiket">{g}</div>{cizim(a)}</div>)}
  </div>;
}

const TUM_KRITERLER = Object.keys(KRITER_ETIKET).filter((k) => !["MULK_TIPI", "ISLEM_TIPI"].includes(k));
const ODA_SECENEK = ["1+0", "1+1", "2+1", "3+1", "4+1", "5+1", "6+1"];
const KAYIT_ROL_VARSAYILAN = (tip: string, sahip: string) => (sahip === "EMLAKCI" ? "EMLAKCI" : tip === "PORTFOY" ? "SAHIP" : "MUSTERI");

export function KayitFormu({ tip, id, taslak, adayId, geri }: { tip: "TALEP" | "PORTFOY"; id?: string; taslak?: Partial<Veri>; adayId?: string; geri?: Ekran }) {
  const { d, kayitKaydet, git, bildir, guncelle } = useDepo();
  const mevcut = id ? d.kayitlar.find((k) => k.id === id) : undefined;
  const talep = tip === "TALEP";
  const [f, setF] = useState<any>(() => {
    const kaynak: any = mevcut?.veri ?? taslak ?? {};
    return { tip, mulkTipi: talep ? "DEPO_ANTREPO" : "DEPO_ANTREPO", islemTipi: "KIRALIK", aciliyet: "NORMAL", paraBirimi: "TRY", fiyatPeriyodu: "AYLIK", ilanSahibiTipi: "BILINMIYOR", veriKanali: "MANUEL", havuz: "KENDI_PORTFOY", lokasyonlar: [], alternatifMulkTipleri: [], ...kaynak, ozellik: { ...(kaynak.ozellik ?? {}) } };
  });
  const [hatalar, setHatalar] = useState<{ yer: string; mesaj: string }[]>([]);
  const [kisiAcik, setKisiAcik] = useState(false);
  const ust = useRef<HTMLDivElement>(null);
  const set = (k: string, v: any) => setF((x: any) => ({ ...x, [k]: v }));
  const setO = (k: string, v: any) => setF((x: any) => ({ ...x, ozellik: { ...x.ozellik, [k]: v } }));
  const grup = MULK_TIPI_META[f.mulkTipi as keyof typeof MULK_TIPI_META]?.grup ?? "DIGER";
  const ekstra = TEMEL_EKSTRA[grup] ?? [];
  const ana = anaKategoriOf(f.mulkTipi);
  const islemler = Object.keys(ISLEM_TIPI_ETIKET).filter((i) => islemKategoriUyumlu(ana, i as any));
  useEffect(() => { if (!islemler.includes(f.islemTipi)) set("islemTipi", islemler[0]); }, [f.mulkTipi]);
  const vu = f.validUntil ? new Date(f.validUntil) : varsayilanValidUntil(tip, f.islemTipi, f.aciliyet, BUGUN, d.ayarlar.ttl);
  const dna = (x: string) => (f.ozellik.kritikKriterler ?? []).includes(x) ? "kritik" : (f.ozellik.esnekKriterler ?? []).includes(x) ? "esnek" : (f.ozellik.eksikBilgiler ?? []).includes(x) ? "eksik" : "";
  const dnaDon = (x: string) => {
    const s = dna(x), sonraki = s === "" ? "kritik" : s === "kritik" ? "esnek" : s === "esnek" ? "eksik" : "";
    const cik = (l?: string[]) => (l ?? []).filter((y) => y !== x);
    setF((v: any) => ({ ...v, ozellik: { ...v.ozellik, kritikKriterler: sonraki === "kritik" ? [...cik(v.ozellik.kritikKriterler), x] : cik(v.ozellik.kritikKriterler), esnekKriterler: sonraki === "esnek" ? [...cik(v.ozellik.esnekKriterler), x] : cik(v.ozellik.esnekKriterler), eksikBilgiler: sonraki === "eksik" ? [...cik(v.ozellik.eksikBilgiler), x] : cik(v.ozellik.eksikBilgiler) } }));
  };
  const doluSayisi = Object.entries(f.ozellik).filter(([k, v]) => !["kritikKriterler", "esnekKriterler", "eksikBilgiler"].includes(k) && v != null && !(Array.isArray(v) && !v.length)).length;
  const dnaOzet = [(f.ozellik.kritikKriterler ?? []).length && `${f.ozellik.kritikKriterler.length} şart`, (f.ozellik.esnekKriterler ?? []).length && `${f.ozellik.esnekKriterler.length} esnek`, (f.ozellik.eksikBilgiler ?? []).length && `${f.ozellik.eksikBilgiler.length} sorulacak`].filter(Boolean).join(" · ");

  function kaydet() {
    const o: Record<string, any> = {};
    for (const [k, v] of Object.entries(f.ozellik ?? {})) if (v !== null && v !== undefined && v !== "" && k in SEKIL) o[k] = v;
    if (!talep) { delete o.kritikKriterler; delete o.esnekKriterler; delete o.eksikBilgiler; }
    // v3.10: eksik telefon kaydı kilitlemesin — kullanıcı Kişiler bölümündeki alandan düzeltir
    const telSorunu = telUyarisi(f.gondeTelefon);
    if (telSorunu) { setHatalar([{ yer: "Telefon", mesaj: `${telSorunu}. Aşağıdaki “Kişiler” bölümünde düzeltin ya da alanı boşaltın.` }]); setKisiAcik(true); ust.current?.scrollIntoView({ behavior: "smooth" }); return; }
    const tel = telNormalize(f.gondeTelefon);
    const temiz: any = { ...f, gondeTelefon: tel && /^\+90\d{10}$/.test(tel) ? tel : null, ozellik: o, validUntil: vu };
    // Birincil kişi → eski alanlar (listelerde ve dışa aktarımda kullanılıyor)
    const bir = (f.kisiler ?? [])[0] && d.kisiler.find((k) => k.id === f.kisiler[0].kisiId);
    if (bir) { temiz.gondeAdi = bir.adSoyad; temiz.gondeTelefon = bir.telefon; temiz.gondeSirket = bir.sirket ?? temiz.gondeSirket; }
    for (const k of ["fiyat", "minFiyat", "maxFiyat", "m2", "netM2", "minM2", "maxM2"]) if (temiz[k] === "") temiz[k] = null;
    if (!ekstra.includes("krediyeUygun" as never)) delete temiz.krediyeUygun;
    temiz.alternatifMulkTipleri = (temiz.alternatifMulkTipleri ?? []).filter((t: string) => t !== temiz.mulkTipi).slice(0, 5);
    delete temiz.anaKategori; // her zaman mülk tipinden türetilir
    const p = KayitCreateSchema.safeParse(temiz);
    if (!p.success) { setHatalar(p.error.issues.map((i) => ({ yer: hataEtiketi(i.path as any), mesaj: i.message }))); ust.current?.scrollIntoView({ behavior: "smooth" }); return; }
    const kayit: Kayit = { id: mevcut?.id ?? yeniId(tip), olusturma: mevcut?.olusturma ?? BUGUN.toISOString(), veri: p.data };
    kayitKaydet(kayit);
    if (adayId) {
      guncelle((dd) => (dd.aktifIceAktarma ? { ...dd, aktifIceAktarma: { ...dd.aktifIceAktarma, adaylar: dd.aktifIceAktarma.adaylar.map((a) => (a.id === adayId ? { ...a, durum: "EKLENDI" as const } : a)) } } : dd));
      bildir("Havuza eklendi"); git({ ad: "veri", alt: "wa", donus: true }); return;
    }
    bildir("Kaydedildi — doğrulamadan geçti"); git(geri ? { ...geri, donus: true } : { ad: "detay", id: kayit.id });
  }
  // v3.15: form bir içe aktarma / veri girişi ekranından açıldıysa (geri) oraya, değilse eskisi gibi döner
  const vazgec = () => (geri ? git({ ...geri, donus: true }) : adayId ? git({ ad: "veri", alt: "wa", donus: true }) : mevcut ? git({ ad: "detay", id: mevcut.id }) : git({ ad: "liste", tip }));

  return <div className="yigin" ref={ust}>
    <button className="btn kucuk geri" onClick={vazgec}>← Vazgeç</button>
    <h2>{mevcut ? "Kaydı düzenle" : taslak ? "Yapay zekânın çıkardığı kaydı kontrol edin" : talep ? "Yeni talep" : "Yeni portföy"}</h2>
    {hatalar.length > 0 && <div className="hata-kutu" role="alert"><b>Kaydedilmedi — {hatalar.length} sorun var:</b><ul>{hatalar.map((h, i) => <li key={i}><b>{h.yer}:</b> {h.mesaj}</li>)}</ul></div>}

    <Bolum baslik="Temel bilgiler" acik>
      <MulkTipiSecici f={f} set={set} talep={talep} />
      <div className="alanlar">
        <div className="alan"><label htmlFor="f-islem">İşlem</label><select id="f-islem" value={f.islemTipi} onChange={(e) => set("islemTipi", e.target.value)}>{islemler.map((i) => <option key={i} value={i}>{(ISLEM_TIPI_ETIKET as any)[i]}</option>)}</select></div>
        {talep && <div className="alan"><label htmlFor="f-acil">Aciliyet</label><select id="f-acil" value={f.aciliyet} onChange={(e) => set("aciliyet", e.target.value)}>{["DUSUK", "NORMAL", "YUKSEK", "ACIL"].map((x) => <option key={x} value={x}>{etiket(x)}</option>)}</select></div>}
        {ekstra.includes("odaSayisi") && (() => {
          // v3.19 — talepte çoklu seçim ("2+1, 3+1"); portföyde tek seçim
          const secili = odaListesi(f.odaSayisi).map((x) => x.etiket);
          const digerler = secili.filter((x) => !ODA_SECENEK.includes(x));
          const yaz = (l: string[]) => set("odaSayisi", l.length ? odaYaz(l) : null);
          const tikla = (o: string) => talep ? yaz(secili.includes(o) ? secili.filter((x) => x !== o) : [...secili, o]) : set("odaSayisi", f.odaSayisi === o ? null : o);
          return <div className="alan genis"><label>Oda sayısı{talep ? " · birden çok seçebilirsiniz" : ""}</label><div className="cip-satir">{ODA_SECENEK.map((o) => <button type="button" key={o} aria-pressed={secili.includes(o)} className={cx("cip secilir", secili.includes(o) && "on")} onClick={() => tikla(o)}>{o}</button>)}<input id="f-oda" aria-label="Diğer oda sayısı" className="kisa-girdi" placeholder="diğer: 2+2, 7+1…" key={digerler.join()} defaultValue={digerler.join(", ")} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); (e.target as HTMLInputElement).blur(); } }} onBlur={(e) => { const dig = odaListesi(e.target.value).map((x) => x.etiket); yaz(talep ? [...secili.filter((x) => ODA_SECENEK.includes(x)), ...dig] : dig.slice(0, 1)); }} /></div></div>;
        })()}
        {talep ? <>
          <div className="alan"><label htmlFor="f-maxf">Bütçe (en fazla)</label><SayiGir binlik id="f-maxf" deger={f.maxFiyat} onChange={(x) => set("maxFiyat", x)} /></div>
          <div className="alan"><label htmlFor="f-minm2">En az alan (m²)</label><SayiGir binlik id="f-minm2" deger={f.minM2} onChange={(x) => set("minM2", x)} /></div>
          <div className="alan"><label htmlFor="f-maxm2">En fazla alan (m²)</label><SayiGir binlik id="f-maxm2" deger={f.maxM2} onChange={(x) => set("maxM2", x)} /></div>
        </> : <>
          <div className="alan"><label htmlFor="f-fiyat">Fiyat</label><SayiGir binlik id="f-fiyat" deger={f.fiyat} onChange={(x) => set("fiyat", x)} /></div>
          <div className="alan"><label htmlFor="f-m2">{ekstra.includes("netM2") ? "Brüt alan (m²)" : "Alan (m²)"}</label><SayiGir binlik id="f-m2" deger={f.m2} onChange={(x) => set("m2", x)} /></div>
          {ekstra.includes("netM2") && <div className="alan"><label htmlFor="f-net">Net alan (m²)</label><SayiGir binlik id="f-net" deger={f.netM2} onChange={(x) => set("netM2", x)} /></div>}
        </>}
        <div className="alan"><label htmlFor="f-para">Para birimi</label><select id="f-para" value={f.paraBirimi} onChange={(e) => set("paraBirimi", e.target.value)}>{["TRY", "USD", "EUR", "GBP"].map((x) => <option key={x} value={x}>{etiket(x)}</option>)}</select></div>
        <div className="alan"><label htmlFor="f-per">Fiyat periyodu</label><select id="f-per" value={f.fiyatPeriyodu} onChange={(e) => set("fiyatPeriyodu", e.target.value)}>{["TOPLAM", "AYLIK", "YILLIK", "GUNLUK"].map((x) => <option key={x} value={x}>{etiket(x)}</option>)}</select></div>
        <div className="alan"><label htmlFor="f-sahip">İlan sahibi</label><select id="f-sahip" value={f.ilanSahibiTipi} onChange={(e) => set("ilanSahibiTipi", e.target.value)}>{Object.entries(ILAN_SAHIBI_ETIKET).map(([k, e]) => <option key={k} value={k}>{e}</option>)}</select></div>
        {!talep && <div className="alan"><label htmlFor="f-havuz">Havuz</label><select id="f-havuz" value={f.havuz} onChange={(e) => set("havuz", e.target.value)}>{Object.entries(HAVUZ_ETIKET).map(([k, e]) => <option key={k} value={k}>{e}</option>)}</select></div>}
        {!talep && f.havuz === "KENDI_PORTFOY" && <div className="alan"><label htmlFor="f-yetki">Yetki belgesi</label><div className="satir"><button type="button" id="f-yetki" className={cx("bool-cip", f.yetkili && "evet")} onClick={() => set("yetkili", !f.yetkili)}><span className="isaret">{f.yetkili ? "✓" : "+"}</span>Yetkili portföy</button>{f.yetkili && <input type="date" aria-label="Yetki bitiş" value={f.yetkiBitis ? new Date(f.yetkiBitis).toISOString().slice(0, 10) : ""} onChange={(e) => set("yetkiBitis", e.target.value ? new Date(e.target.value + "T12:00:00") : null)} />}</div></div>}
        <div className="alan genis"><label htmlFor="f-baslik">Başlık</label><input id="f-baslik" maxLength={160} value={f.baslik ?? ""} onChange={(e) => set("baslik", e.target.value)} placeholder="Kısa, tek satır" /></div>
      </div>
      {ekstra.includes("krediyeUygun") && <div className="cip-satir bool-satir"><button type="button" className={cx("bool-cip", f.krediyeUygun === true && "evet", f.krediyeUygun === false && "hayir")} onClick={() => set("krediyeUygun", f.krediyeUygun == null ? true : f.krediyeUygun ? false : null)}><span className="isaret">{f.krediyeUygun === true ? "✓" : f.krediyeUygun === false ? "✕" : "+"}</span>Krediye uygun</button></div>}
      <div className="cip-satir bool-satir"><button type="button" className={cx("bool-cip", f.takasaAcik === true && "evet", f.takasaAcik === false && "hayir")} onClick={() => set("takasaAcik", f.takasaAcik == null ? true : f.takasaAcik ? false : null)}><span className="isaret">{f.takasaAcik === true ? "✓" : f.takasaAcik === false ? "✕" : "+"}</span>Takasa açık</button></div>
    </Bolum>

    <Bolum baslik="Lokasyon" acik ozet={f.lokasyonlar.length ? `${f.lokasyonlar.length} konum` : undefined}><LokasyonDuzenle lok={f.lokasyonlar} setLok={(l) => set("lokasyonlar", l)} portfoy={!talep} /></Bolum>
    <Bolum baslik="Teknik özellikler" ozet={doluSayisi ? `${doluSayisi} alan dolu` : "boş"}><TeknikAlanlar f={f} setO={setO} talep={talep} /></Bolum>


    {talep && <Bolum baslik="Olmazsa olmazlar" acik={!!talepDnasi({ lokasyonlar: [], ...f }).uyari} ozet={talepDnasi({ lokasyonlar: [], ...f }).uyari ? "⚠ kritik bilgi eksik" : dnaOzet || "belirtilmedi"}>
      <EksikUyarisi v={f} telefon={f.gondeTelefon} />
      <p className="ipucu">Müşterinin ısrarcı olduğu ölçütlere dokunun.</p>
      <div className="cip-satir">{TUM_KRITERLER.map((x) => { const s = dna(x); return <button type="button" key={x} className={cx("cip secilir", s === "kritik" && "c-kotu", s === "esnek" && "c-uyari", s === "eksik" && "c-eksik")} onClick={() => dnaDon(x)}>{KRITER_ETIKET[x]}{s ? ` · ${s === "kritik" ? "şart" : s === "esnek" ? "esnek" : "sorulacak"}` : ""}</button>; })}</div>
    </Bolum>}

    <Bolum key={kisiAcik ? "k1" : "k0"} baslik="Kişiler" acik={kisiAcik || (!!taslak && !(f.kisiler ?? []).length)} ozet={(f.kisiler ?? []).map((b: any) => d.kisiler.find((k) => k.id === b.kisiId)?.adSoyad).filter(Boolean).join(", ") || "kişi seçilmedi"}>
      <KisiSecici secili={f.kisiler ?? []} degis={(b) => set("kisiler", b)} varsayilanRol={KAYIT_ROL_VARSAYILAN(tip, f.ilanSahibiTipi)} oneri={{ ad: f.gondeAdi, telefon: f.gondeTelefon, sirket: f.gondeSirket }} />
      <p className="ipucu">Birden fazla kişi seçebilirsiniz (ör. mülk sahibi + getiren emlakçı). Listede yoksa “+ yeni kişi” ile hemen eklenir ve Kişiler'e kaydedilir.</p>
      {!(f.kisiler ?? []).length && <div className="alanlar gonderen">
        <div className="alan"><label htmlFor="f-gad">İletişim adı <span className="ipucu">(kişi bağlamadan)</span></label><input id="f-gad" value={f.gondeAdi ?? ""} onChange={(e) => set("gondeAdi", e.target.value || null)} placeholder="Ad soyad / firma" /></div>
        <div className="alan"><label htmlFor="f-gtel">Telefon</label><TelGirdisi id="f-gtel" deger={f.gondeTelefon ?? ""} onChange={(v) => set("gondeTelefon", v || null)} /></div>
      </div>}
    </Bolum>

    <Bolum baslik="Geçerlilik" ozet={`${tarihYaz(vu)}'e kadar`}>
      <div className="satir sar">
        <input id="f-gecerlilik" type="date" style={{ maxWidth: "12rem" }} value={tarihInput(vu)} onChange={(e) => set("validUntil", e.target.value ? new Date(e.target.value + "T12:00:00").toISOString() : null)} />
        {[30, 60, 90].map((g) => <button type="button" key={g} className="btn kucuk" onClick={() => set("validUntil", sureUzat({ ...f, validUntil: vu } as Veri, g).validUntil)}>+{g} gün</button>)}
      </div>
      <p className="ipucu">Bu kayıt için varsayılan: {ttlGun(tip, f.islemTipi, f.aciliyet, d.ayarlar.ttl)} gün ({etiket(f.islemTipi)}{talep && f.aciliyet === "ACIL" ? ", acil" : ""}). Süreler Ayarlar'dan değiştirilebilir.</p>
    </Bolum>

    <Bolum baslik="Kaynak ve orijinal mesaj" ozet={[etiket(f.veriKanali === "WHATSAPP" ? "WhatsApp" : (VERI_KANALI_ETIKET as any)[f.veriKanali]), f.kayitGrubu, f.mesajTarihi && tarihYaz(f.mesajTarihi, true)].filter(Boolean).join(" · ")}>
      <div className="alanlar">
        <div className="alan"><label htmlFor="f-kanal">Geldiği kanal</label><select id="f-kanal" value={f.veriKanali} onChange={(e) => set("veriKanali", e.target.value)}>{Object.entries(VERI_KANALI_ETIKET).map(([k, e]) => <option key={k} value={k}>{e}</option>)}</select></div>
        <div className="alan"><label htmlFor="f-grup">Grup / kaynak adı</label><input id="f-grup" value={f.kayitGrubu ?? ""} onChange={(e) => set("kayitGrubu", e.target.value || null)} placeholder="EMLAK BORSASI" /></div>
        <div className="alan"><label htmlFor="f-mtarih">Mesaj tarihi</label><input id="f-mtarih" type="datetime-local" value={f.mesajTarihi ? new Date(new Date(f.mesajTarihi).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : ""} onChange={(e) => set("mesajTarihi", e.target.value ? new Date(e.target.value).toISOString() : null)} /></div>
      </div>
      {f.kaynakDosya && <p className="ipucu">Dosya: {f.kaynakDosya}</p>}
      <label className="alan-etiket" htmlFor="f-ham">Orijinal mesaj / not</label>
      <textarea id="f-ham" rows={4} value={f.hamMetin ?? ""} onChange={(e) => set("hamMetin", e.target.value)} placeholder="WhatsApp mesajı veya ilan metni" />
    </Bolum>

    <div className="satir yapiskan"><button className="btn birincil genis-btn" onClick={kaydet}>{adayId ? "Kaydet ve havuza ekle" : "Kaydet"}</button></div>
  </div>;
}