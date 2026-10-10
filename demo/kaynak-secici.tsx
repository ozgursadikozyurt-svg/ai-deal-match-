/**
 * Anahtar CRM v3.24 · 10 Ekim 2026
 * Kaynak seçici — Emlak grubu · Sahibinden · Portal · Kendi portföyüm. Yapay zekâ / kurallar tahmin eder, kullanıcı değiştirir.
 * Seçim kaydın havuz / ilan sahibi / kanal alanlarına yazılır (src/lib/domain/kaynak.ts).
 *  - kucuk: liste kartlarında açılır menü (yer kaplamaz)
 *  - normal: tek kayıt kartında ve formda dört düğme
 */
import React from "react";
import { KAYNAK_SECIMLERI, KAYNAK_SECIM_ETIKET, KAYNAK_SECIM_ACIKLAMA, type KaynakSecimi } from "../src/lib/domain/kaynak";

export function KaynakSecici({ deger, degis, kucuk = false, id }: { deger: KaynakSecimi; degis: (k: KaynakSecimi) => void; kucuk?: boolean; id?: string }) {
  if (kucuk) return <label className="kaynak-sec" onClick={(e) => e.stopPropagation()}>
    <span>Kaynak</span>
    <select id={id} aria-label="Kaynak" value={deger} onChange={(e) => degis(e.target.value as KaynakSecimi)}>
      {KAYNAK_SECIMLERI.map((k) => <option key={k} value={k}>{KAYNAK_SECIM_ETIKET[k]}</option>)}
    </select>
  </label>;
  return <div className="kaynak-dugmeler" role="radiogroup" aria-label="Kaynak">
    {KAYNAK_SECIMLERI.map((k) => <button key={k} type="button" role="radio" aria-checked={deger === k} title={KAYNAK_SECIM_ACIKLAMA[k]} className={"cip secilir" + (deger === k ? " on" : "")} onClick={() => degis(k)}>{KAYNAK_SECIM_ETIKET[k]}</button>)}
  </div>;
}
