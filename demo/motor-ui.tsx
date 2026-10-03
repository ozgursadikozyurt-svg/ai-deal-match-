/**
 * Anahtar CRM v3.13 · 3 Ekim 2026
 * Demo — eşleştirme motoru v2 görselleri: Talep DNA kartı, eksik bilgi uyarısı + müşteriye soru mesajı,
 * Anahtar Uyum Matrisi dökümü, havuz katmanı rozeti, portföy edinme fırsatı bandı.
 */
import React from "react";
import { talepDnasi } from "../src/lib/eslestirme/talep-dna";
import { katmanOf, havuzKatmani, type HavuzKatmani } from "../src/lib/eslestirme/havuz";
import type { OnizlemeSonucu } from "../src/lib/eslestirme/onizleme";
import { etiket } from "./etiketler";
import type { Veri } from "./depo";
import { Pill, Kopyala, cx } from "./ortak";

const KAYNAK_ETIKET = { TALEP: "müşteri dedi", AMAC: "kullanım amacı gereği", VARSAYILAN: "varsayılan" } as const;

/** Eksik bilgi uyarısı (talep formunda, detayda, AI kutusunda aynı) */
export function EksikUyarisi({ v, telefon }: { v: Partial<Veri>; telefon?: string | null }) {
  if (v.tip !== "TALEP" || !v.mulkTipi) return null;
  const dna = talepDnasi({ lokasyonlar: [], ...(v as any) });
  if (!dna.eksik.length) return null;
  const wa = telefon ? `https://wa.me/${telefon.replace(/\D/g, "")}?text=${encodeURIComponent(dna.soruMesaji ?? "")}` : null;
  return <div className={cx("eksik-kutu", dna.uyari ? "kritik" : "")}>
    <div className="eksik-bas"><b>{dna.uyari ? `Doğru eşleşme için ${dna.eksik.filter((e) => e.oldurucu).length} kritik bilgi eksik` : `Eşleştirmeyi güçlendirecek ${dna.eksik.length} bilgi eksik`}</b></div>
    <ul>{dna.eksik.slice(0, 6).map((e) => <li key={e.kriter}>{e.oldurucu && <span className="kritik-rozet">kritik</span>} {e.soru}</li>)}</ul>
    <div className="satir sar">{dna.soruMesaji && <Kopyala metin={dna.soruMesaji} etiketi="Soru mesajını kopyala" />}{wa && <a className="btn kucuk" href={wa} target="_blank" rel="noreferrer">WhatsApp'ta sor</a>}</div>
  </div>;
}

/** Uyum dökümü (Anahtar Uyum Matrisi) — bileşen başına puan çubuğu. v3.9: ağırlık sayıları ve formül açıklaması ekranda gösterilmez. */
export function MatrisDokumu({ s }: { s: OnizlemeSonucu }) {
  return <section className="kart">
    <h3>Uyum dökümü</h3>
    <div className="matris">{s.matris.bilesenler.map((b) => <div key={b.kod} className={cx("matris-satir", b.puan == null && "soluk")}>
      <span className="m-ad">{b.etiket}</span>
      <span className="m-cubuk"><span className={b.puan == null ? "" : b.puan >= 0.9 ? "m-iyi" : b.puan >= 0.5 ? "m-uyari" : "m-kotu"} style={{ width: `${(b.puan ?? 0) * 100}%` }} /></span>
      <span className="m-deger">{b.puan == null ? "istenmedi" : `${Math.round(b.puan * 100)}%`}</span>
    </div>)}</div>
  </section>;
}

export function HavuzRozeti({ v }: { v: Partial<Veri> }) {
  const k = havuzKatmani(v as any), m = katmanOf(k);
  return <span className={"pill havuz-" + k.toLowerCase()} title={m.aciklama}>{m.sira}· {m.etiket}</span>;
}
export const katmanSirasi = (v: Partial<Veri>) => katmanOf(havuzKatmani(v as any)).sira;
export type { HavuzKatmani };

export function FirsatBandi({ sayi, onGoster }: { sayi: number; onGoster?: () => void }) {
  return <div className="firsat-bandi" role="alert">
    <span className="firsat-ikon" aria-hidden="true">🔥</span>
    <div><b>PORTFÖY EDİNME FIRSATI</b><div>Bu ilan <b>{sayi} aktif talebinizle</b> %80 üzeri eşleşiyor. Malik ile iletişim kurulması önerilir.</div></div>
    {onGoster && <button className="btn kucuk" onClick={onGoster}>Talepleri gör</button>}
  </div>;
}