/**
 * Anahtar CRM v3.32 · 18 Ekim 2026
 * Demo — eşleşmeyi kopar / geri al, ve kartlardaki "kim" etiketi (emlakçı mı, doğrudan müşteri mi, web ilanı mı).
 */
import React, { useState } from "react";
import { KOPMA_NEDENLERI, kopmaEtiket, type KopmaNedeni } from "../src/lib/eslestirme/kopar";
import { kimOf } from "../src/lib/domain/kim";
import { useDepo, cx, eKey, Pill, tarihYaz } from "./ortak";
import type { PipelineDurum, Veri } from "./depo";
import { eslesmeDurumunuUygula } from "./bugun-eylem";

export function KimPill({ v, adli = true }: { v: Veri; adli?: boolean }) {
  const { d } = useDepo();
  const k = kimOf(v as any, d.kisiler);
  return <span className={cx("pill kim", "p-" + k.ton)} title={k.ad ? `${k.etiket}: ${k.ad}` : k.etiket}>{k.etiket}{adli && k.ad ? <b> · {k.ad.length > 28 ? k.ad.slice(0, 27) + "…" : k.ad}</b> : null}</span>;
}

export const koparildiMi = (n?: { durum: PipelineDurum } | null) => n?.durum === "REDDEDILDI";

/** "Eşleşmeyi kopar" düğmesi + neden penceresi. Koparılmışsa "Geri al". */
export function KoparDugmesi({ tid, pid, kucuk = false, sonra }: { tid: string; pid: string; kucuk?: boolean; sonra?: () => void }) {
  const { d, guncelle, bildir } = useDepo();
  const [acik, setAcik] = useState(false);
  const [neden, setNeden] = useState<KopmaNedeni>("YANLIS");
  const [not, setNot] = useState("");
  const anahtar = eKey(tid, pid);
  const n = d.eslesmeNotlari[anahtar];
  const yaz = (x: any) => { const { durum, ...ek } = x; guncelle((dd) => eslesmeDurumunuUygula(dd, tid, pid, durum ?? dd.eslesmeNotlari[anahtar]?.durum ?? "YENI", ek)); };
  if (koparildiMi(n)) return <div className="satir sar" onClick={(e) => e.stopPropagation()}>
    {!kucuk && <span className="ipucu">Koparıldı{n?.tarih ? ` (${tarihYaz(n.tarih)})` : ""}: {kopmaEtiket(n?.neden)}</span>}
    <button type="button" className="btn kucuk" onClick={() => { yaz({ durum: "YENI", neden: undefined, tarih: undefined }); bildir("Eşleşme geri alındı"); }}>Geri al</button>
  </div>;
  return <>
    <button type="button" className={cx("btn kucuk kopar-btn", kucuk && "ikon")} title="Eşleşmeyi kopar" aria-label="Eşleşmeyi kopar" onClick={(e) => { e.stopPropagation(); setAcik(true); }}>{kucuk ? "✕" : "Eşleşmeyi kopar"}</button>
    {acik && <div className="perde" onClick={(e) => { e.stopPropagation(); setAcik(false); }}>
      <div className="panel kopar-panel" role="dialog" aria-label="Eşleşmeyi kopar" onClick={(e) => e.stopPropagation()}>
        <h3>Eşleşmeyi kopar</h3>
        <p className="ipucu">Bu talep ile portföy bir daha ana ekranda, eşleşme listesinde ve çekmecede çıkmaz. Eşleşmeler → Koparılanlar'dan geri alabilirsiniz.</p>
        <div className="yigin kucuk-bosluk" role="radiogroup">{KOPMA_NEDENLERI.map(([k, l]) => <label key={k} className="onay-satir"><input type="radio" name="neden" checked={neden === k} onChange={() => setNeden(k)} /> {l}</label>)}</div>
        <textarea rows={2} placeholder="Not (isteğe bağlı): ör. müşteri cepheyi beğenmedi" value={not} onChange={(e) => setNot(e.target.value)} />
        <div className="satir"><button type="button" className="btn birincil" onClick={() => { yaz({ durum: "REDDEDILDI", neden, tarih: new Date().toISOString(), ...(not.trim() ? { not: [n?.not, not.trim()].filter(Boolean).join("\n") } : {}) }); setAcik(false); bildir("Eşleşme koparıldı — artık gösterilmeyecek"); sonra?.(); }}>Kopar</button><button type="button" className="btn" onClick={() => setAcik(false)}>Vazgeç</button></div>
      </div>
    </div>}
  </>;
}
/**
 * v3.19 — Toplu işlem: seçilen (ya da listedeki tüm) eşleşmeleri tek seferde kopar ya da geri al.
 * Tek bir `guncelle` ile yazılır; her eşleşmeye aynı neden ve tarih işlenir.
 */
export function TopluKoparPenceresi({ ciftler, geriAl = false, onKapat, onBitti }: { ciftler: { tid: string; pid: string }[]; geriAl?: boolean; onKapat: () => void; onBitti: () => void }) {
  const { guncelle, bildir } = useDepo();
  const [neden, setNeden] = useState<KopmaNedeni>("YANLIS");
  const [not, setNot] = useState("");
  const uygula = () => {
    const simdi = new Date().toISOString();
    guncelle((dd) => ciftler.reduce((acc, { tid, pid }) => {
      const onceki = acc.eslesmeNotlari[eKey(tid, pid)];
      return geriAl
        ? eslesmeDurumunuUygula(acc, tid, pid, "YENI", { neden: undefined, tarih: undefined })
        : eslesmeDurumunuUygula(acc, tid, pid, "REDDEDILDI", { neden, tarih: simdi, ...(not.trim() ? { not: [onceki?.not, not.trim()].filter(Boolean).join("\n") } : {}) });
    }, dd));
    bildir(geriAl ? `${ciftler.length} eşleşme geri alındı` : `${ciftler.length} eşleşme koparıldı`);
    onBitti();
  };
  return <div className="perde" onClick={onKapat}>
    <div className="panel kopar-panel" role="dialog" aria-label={geriAl ? "Eşleşmeleri geri al" : "Eşleşmeleri kopar"} onClick={(e) => e.stopPropagation()}>
      <h3>{geriAl ? `${ciftler.length} eşleşmeyi geri al` : `${ciftler.length} eşleşmeyi kopar`}</h3>
      <p className="ipucu">{geriAl ? "Seçilen eşleşmeler yeniden listelere döner." : "Bu çiftler bir daha ana ekranda, eşleşme listesinde ve çekmecede çıkmaz. Eşleşmeler → Koparılan'dan geri alabilirsiniz."}</p>
      {!geriAl && <>
        <div className="yigin kucuk-bosluk" role="radiogroup">{KOPMA_NEDENLERI.map(([k, l]) => <label key={k} className="onay-satir"><input type="radio" name="toplu-neden" checked={neden === k} onChange={() => setNeden(k)} /> {l}</label>)}</div>
        <textarea rows={2} placeholder="Not (isteğe bağlı) — her eşleşmenin notuna eklenir" value={not} onChange={(e) => setNot(e.target.value)} />
      </>}
      <div className="satir"><button type="button" className={cx("btn", geriAl ? "birincil" : "tehlike")} onClick={uygula} disabled={!ciftler.length}>{geriAl ? "Geri al" : "Koparmayı onayla"}</button><button type="button" className="btn" onClick={onKapat}>Vazgeç</button></div>
    </div>
  </div>;
}
