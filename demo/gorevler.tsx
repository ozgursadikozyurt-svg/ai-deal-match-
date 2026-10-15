/**
 * Anahtar CRM v3.31 · 15 Ekim 2026
 * Görevler ekranı (menünün en sonunda): Bugün panosunun tamamı — sınırsız. Geciken · Bugün · Bu hafta · Sonra · Tamamlananlar,
 * türe göre süzgeç (Ara · Sunum · Yer göster · Belge). Satırlar panodakiyle aynı (üç düğme).
 */
import React, { useMemo, useState } from "react";
import { useDepo, cx, useEslesmeler, tarihYaz } from "./ortak";
import { simdi as simdiOf } from "./depo";
import { useSahiplik } from "./sahiplik";
import { GorevSatiri, GorevEkleFormu } from "./bugun";
import { bugunGorevleri } from "./bugun-eylem";
import { GOREV_TURLERI, GOREV_TURU_ETIKET, gorevSirala, gunEkle, gunYaz, type Gorev } from "../src/lib/domain/gorev";

export function GorevlerEkrani() {
  const { d } = useDepo();
  const es = useEslesmeler();
  const sahip = useSahiplik();
  const simdi = simdiOf(), bugun = gunYaz(simdi), hafta = gunEkle(bugun, 7);
  const [tur, setTur] = useState<"" | Gorev["tur"]>("");
  const [ekle, setEkle] = useState(false);
  const hepsi = useMemo(() => bugunGorevleri(d, es, (k) => !!sahip(k.veri).tur, simdi), [d.gorevler, d.ilgilenenler, d.kayitlar, d.kisiler, d.eslesmeNotlari, es, sahip, bugun]);
  const uy = (g: Gorev) => !tur || g.tur === tur;
  const acik = hepsi.filter((g) => g.durum === "ACIK" && uy(g)).sort(gorevSirala);
  const gruplar: [string, Gorev[], boolean][] = [
    ["Geciken", acik.filter((g) => g.vade < bugun), true],
    ["Bugün", acik.filter((g) => g.vade === bugun), true],
    ["Bu hafta", acik.filter((g) => g.vade > bugun && g.vade <= hafta), true],
    ["Sonra", acik.filter((g) => g.vade > hafta), false],
  ];
  const biten = hepsi.filter((g) => g.durum !== "ACIK" && uy(g)).sort((a, b) => (b.kapanis ?? "").localeCompare(a.kapanis ?? ""));
  const say = (t: Gorev["tur"]) => hepsi.filter((g) => g.durum === "ACIK" && g.tur === t).length;
  return <div className="yigin">
    <div className="satir-ara"><h2>Görevler</h2><button type="button" className="btn birincil" onClick={() => setEkle(!ekle)}>+ Görev</button></div>
    {ekle && <GorevEkleFormu simdi={simdi} kapat={() => setEkle(false)} />}
    <div className="cip-satir" role="group" aria-label="Görev türü">
      <button type="button" className={cx("cip secilir", !tur && "on")} aria-pressed={!tur} onClick={() => setTur("")}>Hepsi ({hepsi.filter((g) => g.durum === "ACIK").length})</button>
      {GOREV_TURLERI.map((t) => say(t) > 0 && <button key={t} type="button" className={cx("cip secilir", tur === t && "on")} aria-pressed={tur === t} onClick={() => setTur(t)}>{GOREV_TURU_ETIKET[t]} ({say(t)})</button>)}
    </div>
    <p className="ipucu">Ana Sayfa'daki Bugün panosu bunun ilk 15'ini gösterir. Görevleri sistem üretir (takip durumu, süre, temas, fiyat düşüşü); + Görev ile kendiniz de ekleyebilirsiniz.</p>
    {gruplar.map(([baslik, l, acikMi]) => l.length > 0 && <details key={baslik} className="kart bolum gorev-grup" open={acikMi}>
      <summary><span className="bolum-baslik">{baslik} ({l.length})</span></summary>
      <ul className="gorev-liste">{l.map((g) => <GorevSatiri key={g.id} g={g} simdi={simdi} />)}</ul>
    </details>)}
    {!acik.length && <p className="bos">Açık görev yok — hepsi tamam.</p>}
    {biten.length > 0 && <details className="kart bolum"><summary><span className="bolum-baslik">Tamamlananlar ({biten.length})</span><span className="bolum-ozet">son 60 gün</span></summary>
      <ul className="gorev-liste">{biten.map((g) => <li key={g.id} className="gorev-hafta"><span className="gorev-ad"><b>{g.baslik}</b><small className="ipucu">{g.durum === "TAMAM" ? "✓ Tamam" : "Kapandı"}{g.sonuc ? " · " + g.sonuc : ""} · {tarihYaz(g.kapanis)}</small></span></li>)}</ul>
    </details>}
  </div>;
}
