/**
 * Anahtar CRM v3.43 · 25 Ekim 2026
 * Görevler ekranı — SADE (v3.40). Yalnızca sizin eklediğiniz hatırlatıcılar ve "Bunu göreve alalım mı?" ile onayladığınız takipler.
 * Sistem kendiliğinden görev üretmez. Geciken · Bugün · Sonra, altta Tamamlananlar (kapalı). Satırlar Bugün panosundakiyle aynı.
 */
import React, { useMemo, useState } from "react";
import { useDepo, tarihYaz } from "./ortak";
import { simdi as simdiOf } from "./depo";
import { GorevSatiri, GorevEkleFormu } from "./bugun";
import { bugunGorevleri } from "./bugun-eylem";
import { gorevSirala, gunYaz, type Gorev } from "../src/lib/domain/gorev";

export function GorevlerEkrani() {
  const { d } = useDepo();
  const simdi = simdiOf(), bugun = gunYaz(simdi);
  const [ekle, setEkle] = useState(false);
  const hepsi = useMemo(() => bugunGorevleri(d), [d.gorevler, d.kayitlar]);
  const acik = hepsi.filter((g) => g.durum === "ACIK").sort(gorevSirala);
  const gruplar: [string, Gorev[], boolean][] = [
    ["Geciken", acik.filter((g) => g.vade < bugun), true],
    ["Bugün", acik.filter((g) => g.vade === bugun), true],
    ["Sonra", acik.filter((g) => g.vade > bugun), true],
  ];
  const biten = hepsi.filter((g) => g.durum !== "ACIK").sort((a, b) => (b.kapanis ?? "").localeCompare(a.kapanis ?? ""));
  return <div className="yigin">
    <div className="satir-ara"><h2>Görevler</h2><button type="button" className="btn birincil" onClick={() => setEkle(!ekle)}>+ Görev</button></div>
    {ekle && <GorevEkleFormu simdi={simdi} kapat={() => setEkle(false)} />}
    {gruplar.map(([baslik, l, acikMi]) => l.length > 0 && <details key={baslik} className="kart bolum gorev-grup" open={acikMi}>
      <summary><span className="bolum-baslik">{baslik} ({l.length})</span></summary>
      <ul className="gorev-liste">{l.map((g) => <GorevSatiri key={g.id} g={g} simdi={simdi} />)}</ul>
    </details>)}
    {!acik.length && <p className="bos">Açık görev yok.</p>}
    {biten.length > 0 && <details className="kart bolum"><summary><span className="bolum-baslik">Tamamlananlar ({biten.length})</span></summary>
      <ul className="gorev-liste">{biten.map((g) => <li key={g.id} className="gorev-hafta"><span className="gorev-ad"><b>{g.baslik}</b><small className="ipucu">{g.durum === "TAMAM" ? "✓ Tamam" : "Kapandı"}{g.sonuc ? " · " + g.sonuc : ""} · {tarihYaz(g.kapanis)}</small></span></li>)}</ul>
    </details>}
  </div>;
}
