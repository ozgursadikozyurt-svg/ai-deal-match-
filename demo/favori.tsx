/**
 * Anahtar CRM v3.43 · 25 Ekim 2026
 * Anahtar CRM v3.19 — Anahtar (favori) işareti ve İzleme ekranı.
 * Talep, portföy ve eşleşme kartlarında 🔑 ile işaretlenen kayıtlar "İzleme" ekranında toplanır.
 * Saklama: DepoDurumu.favoriler (canlıda `arayuz` Ayar kaydı — veritabanı değişikliği gerekmez).
 */
import React, { useMemo, useState } from "react";
import { useKalici } from "./kalici";
import { useDepo, useEslesmeler, cx, eKey, baslikOf, fiyatOf, m2Of, lokEtiket, Pill, IslemPill } from "./ortak";
import { EslesmeKarti } from "./kartlar";
import { KimPill } from "./kopar";
import { Ikon } from "./kabuk";
import { FiltrePaneli, bosFiltre, filtreUygula, eslesmeFiltreUygula, eslesmeSiralama, kayitSiralama, siralaUygula, aktifFiltreSayisi, SiralaDugmesi, type Filtre, type Siralama } from "./filtre";
import { useSahiplik } from "./sahiplik";
import type { Kayit, Veri } from "./depo";

export const favTalep = (id: string) => "t:" + id;
export const favPortfoy = (id: string) => "p:" + id;
export const favEslesme = (tid: string, pid: string) => "e:" + eKey(tid, pid);

export function useFavori(anahtar: string): [boolean, () => void] {
  const { d, guncelle, bildir } = useDepo();
  const acik = (d.favoriler ?? []).includes(anahtar);
  const degis = () => {
    guncelle((dd) => { const l = dd.favoriler ?? []; return { ...dd, favoriler: l.includes(anahtar) ? l.filter((x) => x !== anahtar) : [...l, anahtar] }; });
    bildir(acik ? "İzlemeden çıkarıldı" : "İzlemeye alındı (anahtar)");
  };
  return [acik, degis];
}

/** 🔑 düğmesi: dolu = izlemede. Kartların içinde tıklama kart açılışını tetiklemez. */
export function AnahtarDugmesi({ anahtar, kucuk = true, etiket = false }: { anahtar: string; kucuk?: boolean; etiket?: boolean }) {
  const [acik, degis] = useFavori(anahtar);
  return <button type="button" className={cx("anahtar-btn", acik && "on", kucuk && "kucuk")} aria-pressed={acik} title={acik ? "İzlemeden çıkar" : "İzlemeye al (anahtar)"} aria-label={acik ? "İzlemeden çıkar" : "İzlemeye al"} onClick={(e) => { e.stopPropagation(); degis(); }}>
    <svg width={kucuk ? 18 : 20} height={kucuk ? 18 : 20} viewBox="0 0 24 24" fill={acik ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 2l-9.6 9.6M15.5 7.5l3 3L22 7l-3-3" /><circle cx="7.5" cy="15.5" r="5.5" /></svg>
    {etiket && <span>{acik ? "İzlemede" : "İzlemeye al"}</span>}
  </button>;
}

type Sekme = "TUMU" | "TALEP" | "PORTFOY" | "ESLESME";

/**
 * İzleme ekranı: anahtarlanan talep, portföy ve eşleşmeler tek yerde.
 * v3.43 — diğer listelerdeki ayrıntılı arama + filtre paneli ve sıralama buraya da eklendi.
 * Filtre taleplere / portföylere doğrudan, eşleşmelere Eşleşmeler ekranındaki kuralla uygulanır.
 */
export function Izleme() {
  const { d, git } = useDepo();
  const hepsi = useEslesmeler(true);
  const [sekme, setSekme] = useKalici<Sekme>("izleme.sekme", "TUMU"); // v3.21.2 — karttan Geri dönünce seçili sekme korunur
  const [f, setF] = useKalici<Filtre>("izleme.f", bosFiltre());
  const [sr, setSr] = useKalici<Siralama>("izleme.sr", { alan: "giris", yon: "azalan" });   // talep / portföy listeleri
  const [esr, setEsr] = useKalici<Siralama>("izleme.esr", { alan: "skor", yon: "azalan" }); // eşleşme listesi
  const sahipCoz = useSahiplik();
  const fav = d.favoriler ?? [];
  const kayit = (id: string) => d.kayitlar.find((k) => k.id === id);
  const kisiAd = (id: string) => d.kisiler.find((k) => k.id === id)?.adSoyad ?? "";
  const kisiRol = (id: string) => d.kisiler.find((k) => k.id === id)?.roller ?? [];
  const sahipTur = (v: Veri) => sahipCoz(v).tur;

  const tumTalepler = fav.filter((x) => x.startsWith("t:")).map((x) => kayit(x.slice(2))).filter(Boolean) as Kayit[];
  const tumPortfoyler = fav.filter((x) => x.startsWith("p:")).map((x) => kayit(x.slice(2))).filter(Boolean) as Kayit[];
  const tumEslesmeler = useMemo(() => fav.filter((x) => x.startsWith("e:")).map((x) => { const [tid, pid] = x.slice(2).split("~"); return { x, tid, pid, e: hepsi.find((h) => h.t.id === tid && h.p.id === pid) }; }), [fav, hepsi]);
  const toplam = tumTalepler.length + tumPortfoyler.length + tumEslesmeler.length;

  // Filtre + sıralama
  const kayitSecenek = useMemo(() => kayitSiralama(), []);
  const esSecenek = useMemo(() => eslesmeSiralama(), []);
  const suz = (l: Kayit[]) => siralaUygula(l.filter((k) => filtreUygula(k.veri, f, kisiAd, kisiRol, sahipTur)), sr, kayitSecenek);
  const talepler = suz(tumTalepler);
  const portfoyler = suz(tumPortfoyler);
  const eslesmeler = useMemo(() => {
    // Kaydı silinmiş / pasifleşmiş eşleşmeler ("artık yok" satırı) her zaman kalsın — kullanıcı izlemeden çıkarabilsin
    const gecen = tumEslesmeler.filter((o) => !o.e || eslesmeFiltreUygula(o.e.t.veri, o.e.p.veri, f, kisiAd, kisiRol, sahipTur));
    const varOlan = siralaUygula(gecen.filter((o) => o.e).map((o) => o.e!), esr, esSecenek);
    const sira = new Map(varOlan.map((e, i) => [eKey(e.t.id, e.p.id), i]));
    return [...gecen].sort((a, b) => (sira.get(eKey(a.tid, a.pid)) ?? 1e9) - (sira.get(eKey(b.tid, b.pid)) ?? 1e9));
  }, [tumEslesmeler, f, esr, esSecenek, d.kisiler]);

  const say: Record<Sekme, number> = { TUMU: talepler.length + portfoyler.length + eslesmeler.length, TALEP: talepler.length, PORTFOY: portfoyler.length, ESLESME: eslesmeler.length };
  const favKey = (k: Kayit) => (k.veri.tip === "TALEP" ? favTalep(k.id) : favPortfoy(k.id));
  const Kart = ({ k }: { k: Kayit }) => {
    const v = k.veri;
    return <div className="kart-sar"><button className={cx("kart kayit-kart", v.durum !== "ACTIVE" && "soluk")} onClick={() => git({ ad: "detay", id: k.id })}>
      <div className="pill-satir"><Pill ton={v.tip === "TALEP" ? "mavi" : "yesil"}>{v.tip === "TALEP" ? "Talep" : "Portföy"}</Pill><IslemPill islem={v.islemTipi} /><KimPill v={v} adli={false} />{v.durum !== "ACTIVE" && <Pill>Pasif</Pill>}</div>
      <div className="kk-govde"><div className="kk-sol"><div className="kk-baslik">{baslikOf(v)}</div><div className="kk-alt">{v.lokasyonlar.map(lokEtiket).join(" · ") || "Konum yok"}</div></div><div className="kk-sag"><b>{fiyatOf(v)}</b><span>{m2Of(v)}</span></div></div>
    </button><div className="kart-anahtar"><AnahtarDugmesi anahtar={favKey(k)} /></div></div>;
  };
  const goster = (s: Sekme) => sekme === "TUMU" || sekme === s;
  // Filtre panelindeki sayımlar ve türe özel süzgeçler izlemedeki kayıtlardan çıkar
  const ogeler = useMemo(() => [...new Map([
    ...tumTalepler.map((k) => [k.id, k.veri] as [string, Veri]),
    ...tumPortfoyler.map((k) => [k.id, k.veri] as [string, Veri]),
    ...tumEslesmeler.flatMap((o) => o.e ? [[o.e.t.id, o.e.t.veri], [o.e.p.id, o.e.p.veri]] as [string, Veri][] : []),
  ]).values()], [tumTalepler, tumPortfoyler, tumEslesmeler]);

  if (!toplam) return <div className="yigin">
    <div className="satir-ara"><h2>İzleme</h2><span className="ipucu">Anahtar 🔑 ile işaretlediğiniz kayıtlar</span></div>
    <div className="kart bos-izleme"><Ikon ad="anahtar" boyut={32} /><p><b>Henüz izlemede bir şey yok.</b></p><p className="ipucu">Talep, portföy ya da eşleşme kartındaki anahtar simgesine dokunun; burada toplanır.</p></div>
  </div>;

  return <div className="yigin">
    <div className="satir-ara"><h2>İzleme</h2><span className="ipucu">{say.TUMU === toplam ? `${toplam} izlenen kayıt` : `${say.TUMU} / ${toplam} kayıt`}</span></div>
    <FiltrePaneli f={f} set={setF} ogeler={ogeler} yerTutucu="İzlemede ara: başlık, bölge, kişi…"
      sonucEtiketi={`${say.TUMU} sonucu göster`}
      sirala={<SiralaDugmesi secenekler={(sekme === "ESLESME" ? esSecenek : kayitSecenek) as any} s={sekme === "ESLESME" ? esr : sr} set={(x) => (sekme === "ESLESME" ? setEsr(x) : setSr(x))} />} />
    <div className="filtre">{([["TUMU", "Tümü"], ["TALEP", "Talepler"], ["PORTFOY", "Portföyler"], ["ESLESME", "Eşleşmeler"]] as const).map(([k, l]) => <button key={k} className={cx("fb", sekme === k && "on")} onClick={() => setSekme(k)}>{l} ({say[k]})</button>)}</div>
    {goster("TALEP") && talepler.length > 0 && <><h3 className="izleme-baslik">Talepler</h3>{talepler.map((k) => <Kart key={k.id} k={k} />)}</>}
    {goster("PORTFOY") && portfoyler.length > 0 && <><h3 className="izleme-baslik">Portföyler</h3>{portfoyler.map((k) => <Kart key={k.id} k={k} />)}</>}
    {goster("ESLESME") && eslesmeler.length > 0 && <><h3 className="izleme-baslik">Eşleşmeler</h3>{eslesmeler.map(({ x, e }) => e ? <EslesmeKarti key={x} e={e} /> : <div key={x} className="kart soluk"><div className="satir-ara"><span>Bu eşleşme artık yok (kayıtlardan biri pasif ya da silinmiş).</span><AnahtarDugmesi anahtar={x} /></div></div>)}</>}
    {!say[sekme] && <p className="bos">{aktifFiltreSayisi(f) || f.ara ? "Bu filtreye uyan izlenen kayıt yok." : "Bu sekmede izlenen kayıt yok."}</p>}
  </div>;
}
