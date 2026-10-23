/**
 * Anahtar CRM v3.41 · 23 Ekim 2026
 * Demo — Eşleşmeler ekranının kompakt hızlı süzgeçleri.
 *
 * Eskiden İşlem (Tümü/Satılık/Kiralık/Devren), Uygunluk ve "Fırsat önceliği" kartı üç ayrı satır + büyük bir kart
 * olarak ekranın yarısını kaplıyordu. Şimdi:
 *  - HizliSecici : tek satıra sığan, dokununca açılan küçük seçici (İşlem · Fırsat)
 *  - HizliMenu   : "⋯" menüsü (Seç / toplu kopar)
 *  - SkorSecici  : v3.22 — seçici satırındaki dar "Skor" düğmesi; dokununca satırın üstünde yatay şerit açılır
 *                  (v3.21.2'deki sağ kenar çekmecesi telefonda kartların ve süzgeçlerin üstüne biniyordu)
 */
import React, { useState } from "react";
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
 * v3.22 — skor süzgeci: seçici satırında dar bir "Skor" düğmesi; dokununca aynı satırın üstünde YATAY bir şerit
 * olarak sağa doğru açılır (kaydırıcı + hazır eşikler + sonuç sayısı). Listeyi ve diğer süzgeçleri örtmez,
 * satırın yüksekliğini değiştirmez. Kapatmak: ✕, Esc ya da şeridin dışına dokunmak.
 * (v3.21.2'deki sağ kenar çekmecesi telefonda kartların ve süzgeçlerin üstüne biniyordu.)
 */
/** v3.36 — skor yerine uyum seviyesi (1–5): "en az 4/5" gibi. v3.39: sürüklenen kaydırıcı (telefonda tek denetim) + geniş ekranda hazır düğmeler. */
export const SKOR_HAZIR = [2, 3, 4, 5] as const;
const SEVIYE_KISA: Record<number, string> = { 2: "Zayıf+", 3: "Sorulacak+", 4: "Güçlü+", 5: "Sunulabilir" };
export function SkorSecici({ deger, set, sayi }: { deger: number; set: (n: number) => void; sayi: number }) {
  const [acik, setAcik] = useState(false);
  return <div className={cx("hs skor-hs", acik && "acik")}>
    <button type="button" className={cx("hs-btn", deger > 0 && "on")} aria-expanded={acik} aria-controls="skor-serit" onClick={() => setAcik(!acik)}>
      <small>Uyum</small><b>{deger > 0 ? `≥ ${deger}/5` : "Tümü"}</b>
    </button>
    {acik && <>
      <div className="sirala-perde" onClick={() => setAcik(false)} />
      <div className="skor-serit" id="skor-serit" role="group" aria-label="Uyum seviyesi süzgeci" onKeyDown={(e) => { if (e.key === "Escape") setAcik(false); }}>
        <b className="skor-serit-deger">{deger > 0 ? `≥ ${deger}/5` : "Tümü"}</b>
        {/* v3.39 — sürüklenen çubuk: 1 = Tümü, 2–5 = en az n/5 (telefonda düğmeler sığmıyordu) */}
        <label className="skor-aralik">
          <input type="range" min={1} max={5} step={1} value={deger || 1} aria-label="En az uyum seviyesi" aria-valuetext={deger ? `en az ${deger}/5` : "Tümü"} onChange={(e) => { const n = Number(e.target.value); set(n <= 1 ? 0 : n); }} />
          <span className="skor-aralik-cizgi" aria-hidden="true">{[1, 2, 3, 4, 5].map((n) => <span key={n} className={cx((deger || 1) === n && "on")}>{n === 1 ? "Tümü" : n}</span>)}</span>
        </label>
        <div className="skor-hazir">{SKOR_HAZIR.map((n) => <button key={n} type="button" className={cx(deger === n && "on")} title={SEVIYE_KISA[n]} onClick={() => set(deger === n ? 0 : n)}>{n}/5</button>)}</div>
        <small className="skor-say">{sayi}</small>
        <button type="button" className="skor-kapat" aria-label="Uyum süzgecini kapat" onClick={() => setAcik(false)}>✕</button>
      </div>
    </>}
  </div>;
}
