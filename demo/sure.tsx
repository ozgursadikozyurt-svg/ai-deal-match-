/**
 * Anahtar CRM v3.31 · 15 Ekim 2026
 * Süre işleri: kartta "+30 gün" (süresi 5 gün ve altı kalanlarda), Ana Sayfa'da kısa "Süresi yaklaşanlar" özeti ve
 * ayrı "Süresi yaklaşanlar" ekranı (başında Toplu +30). ★ Benim kayıtlar süresizdir, bu listelere girmez.
 * Ayrıca kart açıklaması (kısaca, açılır kapanır).
 */
import React, { useState } from "react";
import { useDepo, cx, tarihYaz } from "./ortak";
import { kalanGun, sureUzat, type Kayit } from "./depo";
import { KayitKart } from "./app";

const UZAT = 30;
/** Süre listesine giren kayıt: açık (ya da süresi dolmuş) ve kalan gün eşiğin altında */
export const sureListesi = (kayitlar: Kayit[], esik: number) => kayitlar
  .filter((k) => (k.veri.durum === "ACTIVE" || k.veri.durum === "EXPIRED") && (() => { const g = kalanGun(k.veri); return g != null && g <= esik; })())
  .sort((a, b) => (kalanGun(a.veri) ?? 0) - (kalanGun(b.veri) ?? 0));

/** Tek kayıt: +30 gün */
export function UzatDugmesi({ k }: { k: Kayit }) {
  const { kayitKaydet, bildir } = useDepo();
  return <button type="button" className="btn kucuk uzat-btn" onClick={(e) => { e.stopPropagation(); const v = sureUzat(k.veri, UZAT); kayitKaydet({ ...k, veri: v }); bildir(`+${UZAT} gün — ${tarihYaz(v.validUntil)} tarihine kadar`); }}>+{UZAT} gün</button>;
}

/** Kartta açıklama: iki satır, dokununca tamamı */
export function Aciklama({ metin }: { metin: string }) {
  const [acik, setAcik] = useState(false);
  return <button type="button" className={cx("kart-aciklama", acik && "acik")} aria-expanded={acik} onClick={(e) => { e.stopPropagation(); setAcik(!acik); }} title={acik ? "Kısalt" : "Açıklamanın tamamı"}>
    <span>{metin}</span>{metin.length > 90 && <small>{acik ? "▴ kısalt" : "▾ devamı"}</small>}
  </button>;
}

/** Ana Sayfa: uzun liste yerine tek satır özet */
export function SureOzeti() {
  const { d, git } = useDepo();
  const liste = sureListesi(d.kayitlar, 14);
  if (!liste.length) return null;
  const dolan = liste.filter((k) => (kalanGun(k.veri) ?? 1) <= 0).length, bes = liste.filter((k) => (kalanGun(k.veri) ?? 99) <= 5).length;
  return <button type="button" className="kart sure-ozet" onClick={() => git({ ad: "suresi" })}>
    <span><b>Süresi yaklaşanlar ({liste.length})</b><br /><small className="ipucu">{[dolan && `${dolan} süresi doldu`, bes - dolan > 0 && `${bes - dolan} kaydın 5 günden az süresi var`, "14 gün içinde"].filter(Boolean).join(" · ")}</small></span>
    <span className="btn kucuk">Listeyi aç · Toplu +30</span>
  </button>;
}


/**
 * v3.30 — Dikkat şeridi: Ana Sayfa'nın en üstünde (selamlamanın hemen altında). Süresi dolan kayıtlar eşleşmeden düşer;
 * en alttaki özet gözden kaçıyordu. Kırmızı = doldu, sarı = 5 gün içinde, gri = 14 gün içinde. "Dolanlara +30" tek dokunuşla,
 * "Geri al" ile aynı oturumda eski tarihlerine döner. Uyarı yoksa hiç görünmez.
 */
export function DikkatSeridi({ ek }: { ek?: React.ReactNode }) {
  const { d, guncelle, bildir, git } = useDepo();
  const [geri, setGeri] = useState<Map<string, Kayit["veri"]> | null>(null);
  const liste = sureListesi(d.kayitlar, 14);
  const dolan = liste.filter((k) => (kalanGun(k.veri) ?? 1) <= 0);
  const bes = liste.filter((k) => { const g = kalanGun(k.veri) ?? 99; return g > 0 && g <= 5; });
  const ondort = liste.length - dolan.length - bes.length;
  if (!liste.length && !ek && !geri) return null;
  const dolanlaraUzat = () => {
    const eski = new Map(dolan.map((k) => [k.id, k.veri]));
    guncelle((x) => ({ ...x, kayitlar: x.kayitlar.map((k) => (eski.has(k.id) ? { ...k, veri: sureUzat(k.veri, UZAT) } : k)) }));
    setGeri(eski); bildir(`${eski.size} kaydın süresi ${UZAT} gün uzatıldı — eşleşmeye geri döndüler`);
  };
  const geriAl = () => {
    const eski = geri!; setGeri(null);
    guncelle((x) => ({ ...x, kayitlar: x.kayitlar.map((k) => (eski.has(k.id) ? { ...k, veri: eski.get(k.id)! } : k)) }));
    bildir("Uzatma geri alındı");
  };
  return <section className={cx("kart dikkat", dolan.length ? "kotu" : bes.length ? "uyari" : "notr")} aria-label="Dikkat">
    <div className="dikkat-ust">
      <b>{dolan.length ? "Süresi dolan kayıtlar eşleşmeden düştü" : liste.length ? "Süresi yaklaşan kayıtlar var" : "Dikkat"}</b>
      {liste.length > 0 && <button type="button" className="btn kucuk" onClick={() => git({ ad: "suresi" })}>Gözden geçir</button>}
    </div>
    <div className="dikkat-cipler">
      {dolan.length > 0 && <button type="button" className="dikkat-cip kotu" onClick={() => git({ ad: "suresi" })}><b>{dolan.length}</b> kaydın süresi doldu</button>}
      {bes.length > 0 && <button type="button" className="dikkat-cip uyari" onClick={() => git({ ad: "suresi" })}><b>{bes.length}</b> kayıt 5 gün içinde bitiyor</button>}
      {ondort > 0 && <button type="button" className="dikkat-cip" onClick={() => git({ ad: "suresi" })}><b>{ondort}</b> kayıt 14 gün içinde bitiyor</button>}
      {ek}
    </div>
    {(dolan.length > 0 || geri) && <div className="satir sar">
      {dolan.length > 0 && <button type="button" className="btn kucuk birincil" onClick={dolanlaraUzat}>Dolanlara +{UZAT} gün ({dolan.length})</button>}
      {geri && <button type="button" className="btn kucuk" onClick={geriAl}>Geri al ({geri.size})</button>}
    </div>}
  </section>;
}

const ESIKLER: [number, string][] = [[5, "5 gün"], [14, "14 gün"], [30, "30 gün"]];

export function SuresiYaklasanlar() {
  const { d, guncelle, bildir } = useDepo();
  const [esik, setEsik] = useState(14);
  const [tip, setTip] = useState<"" | "TALEP" | "PORTFOY">("");
  const [secili, setSecili] = useState<Set<string>>(() => new Set());
  const liste = sureListesi(d.kayitlar, esik).filter((k) => !tip || k.veri.tip === tip);
  const hedef = secili.size ? liste.filter((k) => secili.has(k.id)) : liste;
  const topluUzat = () => {
    const idler = new Set(hedef.map((k) => k.id));
    guncelle((x) => ({ ...x, kayitlar: x.kayitlar.map((k) => (idler.has(k.id) ? { ...k, veri: sureUzat(k.veri, UZAT) } : k)) }));
    bildir(`${idler.size} kaydın süresi ${UZAT} gün uzatıldı`); setSecili(new Set());
  };
  return <div className="yigin">
    <div className="satir-ara"><h2>Süresi yaklaşanlar</h2></div>
    {liste.length > 0 && <div className="kart toplu-uzat">
      <button type="button" className="btn birincil" onClick={topluUzat}>{secili.size ? `Seçilen ${hedef.length} kayda +${UZAT} gün` : `Tümüne +${UZAT} gün (${liste.length})`}</button>
      <span className="ipucu">{secili.size ? <button type="button" className="link-btn" onClick={() => setSecili(new Set())}>Seçimi kaldır</button> : "Yalnızca bazılarını uzatmak için kartların solundaki + ile seçin."}</span>
    </div>}
    <div className="cip-satir" role="group" aria-label="Kalan süre">
      {ESIKLER.map(([g, l]) => <button key={g} type="button" className={cx("cip secilir", esik === g && "on")} aria-pressed={esik === g} onClick={() => setEsik(g)}>{l} içinde</button>)}
      <span className="cip-ayrac" />
      {([["", "Hepsi"], ["TALEP", "Talepler"], ["PORTFOY", "Portföyler"]] as const).map(([t, l]) => <button key={t} type="button" className={cx("cip secilir", tip === t && "on")} aria-pressed={tip === t} onClick={() => setTip(t)}>{l}</button>)}
    </div>
    <p className="ipucu">★ Benim kayıtlar süresizdir, bu listede görünmez. Süresi dolan kayıtlar da burada; +{UZAT} gün bugünden başlatır.</p>
    {liste.map((k) => <KayitKart key={k.id} k={k} uzat sec={{ on: secili.has(k.id), degis: () => { const y = new Set(secili); y.has(k.id) ? y.delete(k.id) : y.add(k.id); setSecili(y); } }} />)}
    {!liste.length && <p className="bos">{esik} gün içinde süresi dolacak kayıt yok.</p>}
  </div>;
}
