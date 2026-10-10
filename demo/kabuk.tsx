/**
 * Anahtar CRM v3.22.2 · 10 Ekim 2026
 * Demo — uygulama kabuğu: logo, simgeler, gezinme (masaüstünde sol menü, telefonda alt çubuk + menü sayfası).
 */
import React from "react";
import { MARKA } from "../src/lib/marka";

/** v3.9 logo işareti (Anahtar CRM): lacivert karo içinde pirinç anahtar; halkasında turkuaz yapay zekâ kıvılcımı. */
export function LogoIsaret({ boyut = 34 }: { boyut?: number }) {
  return (
    <svg className="logo-isaret" width={boyut} height={boyut} viewBox="0 0 40 40" aria-hidden="true">
      <rect width="40" height="40" rx="11" fill="var(--logo-zemin)" />
      <circle cx="20" cy="13.5" r="7.2" fill="none" stroke="var(--logo-a)" strokeWidth="2.6" />
      <path d="M20 9.3c.4 2.3 1.9 3.8 4.2 4.2-2.3.4-3.800 1.900-4.200 4.200-.4-2.300-1.900-3.800-4.200-4.200 2.300-.4 3.800-1.900 4.200-4.200Z" fill="var(--logo-c)" />
      <path d="M20 20.7V33M20 26.500h4.600M20 31h3.200" stroke="var(--logo-a)" strokeWidth="2.6" strokeLinecap="round" fill="none" />
    </svg>
  );
}
export function Logo({ alt = true }: { alt?: boolean }) {
  return (
    <div className="logo-kilit">
      <LogoIsaret />
      <div>
        <div className="logo-ad">Anahtar<span className="logo-vurgu">CRM</span></div>
        {alt && <div className="logo-alt">Her talebe doğru mülk</div>}
      </div>
    </div>
  );
}

const YOL: Record<string, string> = {
  anahtar: "M21 2l-9.6 9.6M15.5 7.5l3 3L22 7l-3-3M7.5 10a5.5 5.5 0 1 0 0 11a5.5 5.5 0 0 0 0-11z",
  ana: "M4 11.5 12 5l8 6.5V19a1 1 0 0 1-1 1h-4.5v-5h-5v5H5a1 1 0 0 1-1-1z",
  talep: "M10.5 4a6.5 6.5 0 1 1 0 13 6.5 6.5 0 0 1 0-13zm4.8 11.3L20 20",
  portfoy: "M4 20V8l6-3v15M10 20V5l10 4v11M4 20h16M13 12h4M13 15.5h4",
  eslesme: "M9 14.5 14.5 9M7.6 11.4 6 13a3.5 3.5 0 0 0 5 5l1.6-1.6M16.4 12.6 18 11a3.5 3.5 0 0 0-5-5l-1.6 1.6",
  kisi: "M9 11a3.2 3.2 0 1 0 0-6.4A3.2 3.2 0 0 0 9 11zm-5.5 8.5c.4-3.2 2.6-5 5.5-5s5.1 1.8 5.5 5M16 5.2a3 3 0 0 1 0 5.6M18.2 14.6c1.4.7 2.2 2.3 2.4 4.4",
  baglanti: "M20 12a8 8 0 0 1-13.7 5.6M4 12a8 8 0 0 1 13.7-5.6M17.7 3.5v3h-3M6.3 20.5v-3h3",
  veri: "M12 15V4m0 0-4 4m4-4 4 4M5 15v4a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-4",
  konum: "M12 21s-6.5-6.1-6.5-11a6.5 6.5 0 0 1 13 0C18.5 14.9 12 21 12 21zm0-8.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z",
  ayar: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm7.4-3a7.4 7.4 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a7.5 7.5 0 0 0-2-1.2L14.5 3h-5l-.4 2.6a7.5 7.5 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6a7.4 7.4 0 0 0 0 2.4l-2 1.6 2 3.4 2.4-1a7.5 7.5 0 0 0 2 1.2l.4 2.6h5l.4-2.6a7.5 7.5 0 0 0 2-1.2l2.4 1 2-3.4-2-1.6c.1-.4.1-.8.1-1.2z",
  menu: "M4 7h16M4 12h16M4 17h16",
  kapat: "M6 6l12 12M18 6 6 18",
};
export function Ikon({ ad, boyut = 20 }: { ad: keyof typeof YOL | string; boyut?: number }) {
  return <svg width={boyut} height={boyut} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={YOL[ad] ?? ""} /></svg>;
}

export interface NavOge { k: string; etiket: string; ikon: string; git: () => void; rozet?: number; alt?: boolean }
/** Masaüstü sol menü */
export function SolMenu({ ogeler, aktif, durum, surum }: { ogeler: NavOge[]; aktif: string; durum: React.ReactNode; surum: React.ReactNode }) {
  return <aside className="sol-menu" aria-label="Bölümler">
    <Logo />
    <nav>{ogeler.map((o, i) => <React.Fragment key={o.k}>{o.alt && !ogeler[i - 1]?.alt && <div className="menu-ayrac" />}
      <button className={"menu-oge" + (aktif === o.k ? " on" : "")} aria-current={aktif === o.k ? "page" : undefined} onClick={o.git}><Ikon ad={o.ikon} /><span>{o.etiket}</span>{!!o.rozet && <b className="menu-rozet">{o.rozet}</b>}</button></React.Fragment>)}</nav>
    <div className="menu-ayak">{durum}{surum}</div>
  </aside>;
}
/** Telefon alt çubuğu (ilk 5 öğe) */
export function AltCubuk({ ogeler, aktif }: { ogeler: NavOge[]; aktif: string }) {
  return <nav className="alt-cubuk" aria-label="Bölümler">{ogeler.map((o) => <button key={o.k} className={aktif === o.k ? "on" : ""} aria-current={aktif === o.k ? "page" : undefined} onClick={o.git}><span className="ac-ikon"><Ikon ad={o.ikon} boyut={22} />{!!o.rozet && <b className="menu-rozet">{o.rozet}</b>}</span><small>{o.etiket}</small></button>)}</nav>;
}