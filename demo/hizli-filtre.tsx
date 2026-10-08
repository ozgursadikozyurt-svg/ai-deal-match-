/**
 * Anahtar CRM v3.21.2 · 8 Ekim 2026
 * Demo — Eşleşmeler ekranının kompakt hızlı süzgeçleri.
 *
 * Eskiden İşlem (Tümü/Satılık/Kiralık/Devren), Uygunluk ve "Fırsat önceliği" kartı üç ayrı satır + büyük bir kart
 * olarak ekranın yarısını kaplıyordu. Şimdi:
 *  - HizliSecici : tek satıra sığan, dokununca açılan küçük seçici (İşlem · Fırsat)
 *  - HizliMenu   : "⋯" menüsü (Seç / toplu kopar)
 *  - SkorYanBar  : ekranın sağ kenarında duran ince tutamak; dokunun ya da sola kaydırın, dikey skor çubuğu açılır
 */
import React, { useRef, useState } from "react";
import { cx } from "./ortak";

export interface HizliSecenek<T extends string> { k: T; l: string; n?: number; alt?: string; nokta?: string }

/** Kapalıyken "ETİKET / seçili değer (adet)" gösteren, dokununca açılan küçük seçici. */
export function HizliSecici<T extends string>({ ad, deger, bos, secenekler, set, hiza = "sol", gosterim }: {
  ad: string; deger: T; /** "süzgeç yok" değeri; seçiliyse düğme vurgulanmaz */ bos: T;
  secenekler: HizliSecenek<T>[]; set: (k: T) => void; hiza?: "sol" | "sag"; /** düğmedeki metni elle belirler (ör. "2 seçili") */ gosterim?: string;
}) {
  const [acik, setAcik] = useState(false);
  const sec = secenekler.find((x) => x.k === deger) ?? secenekler[0];
  const dolu = gosterim != null || deger !== bos;
  return <div className={cx("hs", hiza === "sag" && "sag")}>
    <button type="button" className={cx("hs-btn", dolu && "on")} aria-haspopup="menu" aria-expanded={acik} onClick={() => setAcik(!acik)}>
      <small>{ad}</small>
      <b>{gosterim ?? sec.l}{gosterim == null && sec.n != null ? <i> {sec.n}</i> : null}</b>
    </button>
    {acik && <>
      <div className="sirala-perde" onClick={() => setAcik(false)} />
      <div className="hs-menu" role="menu" aria-label={ad}>
        {secenekler.map((x) => <button type="button" key={x.k || "tumu"} role="menuitemradio" aria-checked={x.k === deger && gosterim == null} className={cx("hs-oge", x.k === deger && gosterim == null && "on")} onClick={() => { set(x.k); setAcik(false); }}>
          {x.nokta && <span className={cx("hs-nokta", x.nokta)} aria-hidden="true" />}
          <span className="hs-metin"><b>{x.l}</b>{x.alt && <small>{x.alt}</small>}</span>
          {x.n != null && <span className="hs-n">{x.n}</span>}
          <span className="hs-tik" aria-hidden="true">{x.k === deger && gosterim == null ? "✓" : ""}</span>
        </button>)}
      </div>
    </>}
  </div>;
}

export interface HizliMenuOge { l: string; alt?: string; tehlike?: boolean; pasif?: boolean; tikla: () => void }
/** "⋯" düğmesi: az kullanılan işlemleri (Seç, toplu kopar…) ekranda yer kaplamadan tutar. */
export function HizliMenu({ ad, ogeler }: { ad: string; ogeler: HizliMenuOge[] }) {
  const [acik, setAcik] = useState(false);
  return <div className="hs dar sag">
    <button type="button" className="hs-btn ikon" aria-label={ad} title={ad} aria-haspopup="menu" aria-expanded={acik} onClick={() => setAcik(!acik)}>⋯</button>
    {acik && <>
      <div className="sirala-perde" onClick={() => setAcik(false)} />
      <div className="hs-menu" role="menu" aria-label={ad}>
        {ogeler.map((o) => <button type="button" key={o.l} role="menuitem" disabled={o.pasif} className={cx("hs-oge", o.tehlike && "tehlike")} onClick={() => { setAcik(false); o.tikla(); }}>
          <span className="hs-metin"><b>{o.l}</b>{o.alt && <small>{o.alt}</small>}</span>
        </button>)}
      </div>
    </>}
  </div>;
}

/**
 * Sağ kenarda duran, gizlenen skor çubuğu.
 * Kapalıyken yalnızca ince bir tutamak görünür ("Skor" ya da seçiliyken "Skor ≥ 70" ve vurgulu renk).
 * Açmak: tutamağa dokunun ya da sola kaydırın · kapatmak: dışına dokunun, sağa kaydırın ya da tutamağa yine dokunun.
 * Çubuk dikeydir: parmak sağ kenarda kalır; üstte 100, altta 0; 5'er puan adım.
 */
export function SkorYanBar({ deger, set, sayi }: { deger: number; set: (n: number) => void; sayi: number }) {
  const [acik, setAcik] = useState(false);
  const iz = useRef<HTMLDivElement>(null);
  const basili = useRef(false);
  const dokunma = useRef<{ x: number; y: number } | null>(null);
  const yazY = (clientY: number) => {
    const r = iz.current?.getBoundingClientRect();
    if (!r || r.height <= 0) return;
    const t = 1 - (clientY - r.top) / r.height; // üst = 100
    set(Math.round(Math.max(0, Math.min(1, t)) * 20) * 5);
  };
  const tus = (e: React.KeyboardEvent) => {
    const adim = e.key === "ArrowUp" || e.key === "ArrowRight" ? 5 : e.key === "ArrowDown" || e.key === "ArrowLeft" ? -5 : e.key === "Home" ? -100 : e.key === "End" ? 100 : 0;
    if (!adim) return;
    e.preventDefault(); set(Math.max(0, Math.min(100, deger + adim)));
  };
  return <>
    {acik && <button type="button" className="skor-perde" aria-label="Skor çubuğunu kapat" onClick={() => setAcik(false)} />}
    <aside className={cx("skor-cekmece", acik && "acik", deger > 0 && "dolu")} aria-label="Skor filtresi"
      onTouchStart={(e) => { const t = e.touches[0]; dokunma.current = { x: t.clientX, y: t.clientY }; }}
      onTouchEnd={(e) => {
        const b = dokunma.current, t = e.changedTouches[0]; dokunma.current = null;
        if (!b || !t) return;
        const dx = t.clientX - b.x, dy = t.clientY - b.y;
        if (Math.abs(dx) > 36 && Math.abs(dx) > Math.abs(dy) * 1.4) setAcik(dx < 0); // sola kaydır = aç, sağa = kapat
      }}>
      <button type="button" className="skor-tutac" aria-expanded={acik} aria-controls="skor-govde" title="Skor filtresi" onClick={() => setAcik(!acik)}>
        <span className="skor-ok" aria-hidden="true">{acik ? "›" : "‹"}</span>
        <span className="skor-et">{deger > 0 ? `Skor ≥ ${deger}` : "Skor"}</span>
      </button>
      <div className="skor-govde" id="skor-govde">
        <b className="skor-deger">{deger > 0 ? `≥ ${deger}` : "Tümü"}</b>
        <div ref={iz} className="skor-iz" role="slider" aria-orientation="vertical" aria-label="En az skor" aria-valuemin={0} aria-valuemax={100} aria-valuenow={deger} tabIndex={acik ? 0 : -1}
          onKeyDown={tus}
          onPointerDown={(e) => { basili.current = true; try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* eski tarayıcı */ } yazY(e.clientY); }}
          onPointerMove={(e) => { if (basili.current) yazY(e.clientY); }}
          onPointerUp={() => { basili.current = false; }} onPointerCancel={() => { basili.current = false; }}>
          <div className="skor-dolgu" style={{ height: `calc((100% - 22px) * ${deger / 100} + 11px)` }} />
          <div className="skor-top" style={{ bottom: `calc((100% - 22px) * ${deger / 100})` }} />
        </div>
        <small className="skor-say">{sayi} eşleşme</small>
        <button type="button" className="skor-sifirla" disabled={!deger} tabIndex={acik ? 0 : -1} onClick={() => set(0)}>Sıfırla</button>
      </div>
    </aside>
  </>;
}
