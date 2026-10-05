/**
 * Anahtar CRM v3.15 · 5 Ekim 2026
 * Canlı — sağ üstteki kayıt göstergesi. "Kaydedildi ✓" yalnızca bir kayıt işleminden sonra 3 saniye görünür, sonra kendiliğinden kaybolur
 * (önceden ekranda kalıyordu). "Kaydedilecek… / Kaydediliyor…" ve hata mesajları ise çözülene kadar kalır.
 */
import React, { useEffect, useRef, useState } from "react";
import type { KaydetDurumu } from "./canli-kaydet";

export const KAYDEDILDI_SURE_MS = 3000;

export function KaydetGostergesi({ s, sureMs = KAYDEDILDI_SURE_MS }: { s: KaydetDurumu; sureMs?: number }) {
  const [ac, setAc] = useState(false);
  const [goster, setGoster] = useState(false); // açılışta "kayıtlı" göstergesi çıkmaz; yalnızca bir kayıt işleminden sonra
  const gorulen = useRef(false);               // bu oturumda kayıt etkinliği (bekliyor / kaydediliyor / hata) oldu mu
  useEffect(() => {
    if (s.ad !== "kayitli") { gorulen.current = true; setGoster(true); return; }
    if (!gorulen.current) return;
    setGoster(true);
    const t = setTimeout(() => setGoster(false), sureMs);
    return () => clearTimeout(t);
  }, [s.ad, sureMs]);
  if (s.ad === "kayitli" && !goster) return null;
  const ton = s.ad === "kayitli" ? "iyi" : s.ad === "hata" ? "kotu" : "uyari";
  const metin = s.ad === "kayitli" ? "Kaydedildi ✓" : s.ad === "bekliyor" ? "Kaydedilecek…" : s.ad === "kaydediliyor" ? "Kaydediliyor…" : (s.mesaj ?? "Kaydedilemedi");
  return <div style={{ position: "fixed", top: "calc(env(safe-area-inset-top, 0px) + 8px)", right: 10, zIndex: 60, maxWidth: "80vw" }}>
    <button className={"pill p-" + ton} style={{ border: 0, cursor: s.hatalar.length ? "pointer" : "default" }} onClick={() => s.hatalar.length && setAc(!ac)} aria-live="polite">{metin}</button>
    {ac && s.hatalar.length > 0 && <div className="kart" style={{ marginTop: 6, maxHeight: "50vh", overflow: "auto", fontSize: 13 }}>
      <b>Sunucunun kabul etmediği kayıtlar</b>
      <ul>{s.hatalar.slice(0, 12).map((h) => <li key={h.id}><b>{h.id}:</b> {h.mesaj}</li>)}</ul>
      {s.hatalar.length > 12 && <p className="ipucu">… ve {s.hatalar.length - 12} tane daha</p>}
    </div>}
  </div>;
}
