/**
 * Anahtar CRM v3.22 · 9 Ekim 2026
 * Demo — ortak giriş alanları: binlik ayraçlı sayı (1.500.000) ve standart telefon (+90 5XX XXX XX XX).
 */
import React, { useEffect, useState } from "react";
import { telBicimle, telUyarisi } from "../src/lib/iletisim";

/** "1.500.000" / "1500000" / "12,5" → sayı; boş → null; okunamazsa NaN */
export const sayiYap = (s: string) => { if (s.trim() === "") return null; const n = Number(s.replace(/\./g, "").replace(",", ".")); return Number.isFinite(n) ? n : NaN; };
/** Yazılırken binlik nokta: "1500000" → "1.500.000"; ondalık virgül korunur ("12,5") */
export function binlikYaz(ham: string): string {
  const t = ham.replace(/[^\d,]/g, "");
  const [tam, ...ond] = t.split(",");
  const b = tam.replace(/^0+(?=\d)/, "").replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return ond.length ? `${b},${ond.join("").slice(0, 2)}` : b;
}
const goster = (deger: any, binlik: boolean) => deger == null || deger === "" ? "" : typeof deger === "number" ? (binlik ? binlikYaz(String(deger).replace(".", ",")) : String(deger)) : String(deger);

/** Sayı girişi. binlik=true (fiyat, bütçe, m²): yazarken üç hanede bir nokta konur. */
export function SayiGir({ id, deger, onChange, ph, binlik = false, etiket }: { id?: string; deger: any; onChange: (n: number | null) => void; ph?: string; binlik?: boolean; etiket?: string }) {
  const [ham, setHam] = useState(goster(deger, binlik));
  useEffect(() => { if (sayiYap(ham) !== deger && !(deger == null && ham === "")) setHam(goster(deger, binlik)); }, [deger]);
  return <input id={id} aria-label={etiket} inputMode={binlik ? "numeric" : "decimal"} placeholder={ph} value={ham} onChange={(e) => {
    const yazi = binlik ? binlikYaz(e.target.value) : e.target.value;
    setHam(yazi);
    const n = sayiYap(yazi);
    onChange(Number.isNaN(n as number) ? (yazi as any) : n);
  }} />;
}

/** Telefon girişi: 0532…, 532…, +90… nasıl yazılırsa yazılsın "+90 532 111 22 33" olarak biçimlenir; eksikse altında uyarı. */
export function TelGirdisi({ id, deger, onChange, ph = "+90 5XX XXX XX XX", otoOdak = false }: { id?: string; deger: string; onChange: (v: string) => void; ph?: string; otoOdak?: boolean }) {
  const uyari = telUyarisi(deger);
  return <>
    <input id={id} type="tel" inputMode="tel" autoComplete="tel" autoFocus={otoOdak} placeholder={ph} value={telBicimle(deger) || (deger.trim().startsWith("+") ? deger : "")} aria-invalid={!!uyari}
      onChange={(e) => { const v = e.target.value; onChange(/^\s*\+?\s*9?\s*$/.test(v) && v.length < (telBicimle(deger) || "").length ? "" : telBicimle(v) || (v.trim().startsWith("+") ? v.trim() : "")); }} />
    {uyari && <small className="alan-uyari">{uyari}</small>}
  </>;
}