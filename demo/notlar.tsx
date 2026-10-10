/**
 * Anahtar CRM v3.24 · 10 Ekim 2026
 * Demo — Talep / portföy içinde görüşme ve not akışı. Tür (görüşme, arama, WhatsApp, gösterim, not), kim ile, ne konuşuldu.
 * Not eklenince bağlı kişinin "son iletişim" tarihi güncellenir. Sunucuda: KayitNot tablosu, /api/kayit/:id/notlar.
 */
import React, { useState } from "react";
import { NOT_TURU, type Kayit, type KayitNotu, type NotTuru } from "./depo";
import { useDepo, cx, tarihYaz } from "./ortak";

const yeniNotId = () => "n" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

export function GorusmeNotlari({ k }: { k: Kayit }) {
  const { d, guncelle, bildir } = useDepo();
  const [tur, setTur] = useState<NotTuru>("GORUSME");
  const [metin, setMetin] = useState("");
  const bagli = (k.veri.kisiler ?? []).map((b) => d.kisiler.find((x) => x.id === b.kisiId)).filter(Boolean) as typeof d.kisiler;
  const [kisiId, setKisiId] = useState<string>(bagli[0]?.id ?? "");
  const notlar = (k.notlar ?? []).slice().sort((a, b) => b.tarih.localeCompare(a.tarih));
  const ekle = () => {
    const n: KayitNotu = { id: yeniNotId(), tarih: new Date().toISOString(), tur, metin: metin.trim(), kisiId: kisiId || null };
    guncelle((x) => ({
      ...x,
      kayitlar: x.kayitlar.map((y) => (y.id === k.id ? { ...y, notlar: [n, ...(y.notlar ?? [])] } : y)),
      kisiler: kisiId && tur !== "NOT" ? x.kisiler.map((y) => (y.id === kisiId ? { ...y, sonIletisim: n.tarih } : y)) : x.kisiler,
    }));
    setMetin(""); bildir("Not eklendi");
  };
  const sil = (id: string) => { guncelle((x) => ({ ...x, kayitlar: x.kayitlar.map((y) => (y.id === k.id ? { ...y, notlar: (y.notlar ?? []).filter((n) => n.id !== id) } : y)) })); bildir("Not silindi"); };
  return <section className="kart">
    <h3>Görüşmeler ve notlar {notlar.length ? <span className="ipucu">({notlar.length})</span> : null}</h3>
    <div className="cip-satir" role="radiogroup" aria-label="Not türü">{(Object.keys(NOT_TURU) as NotTuru[]).map((t) => <button key={t} type="button" role="radio" aria-checked={tur === t} className={cx("cip secilir", tur === t && "on")} onClick={() => setTur(t)}>{NOT_TURU[t]}</button>)}</div>
    <textarea rows={3} aria-label="Not" placeholder={tur === "GORUSME" ? "Ne konuşuldu? Örn: Bütçeyi 9 milyona çıkarabilir, eşi Kepez'i istemiyor." : tur === "GOSTERIM" ? "Gösterim nasıl geçti?" : "Not yazın…"} value={metin} onChange={(e) => setMetin(e.target.value)} />
    <div className="satir sar">
      {bagli.length > 0 && tur !== "NOT" && <label className="satir kucuk-bosluk"><span className="ipucu">Kiminle:</span><select value={kisiId} onChange={(e) => setKisiId(e.target.value)} style={{ width: "auto" }}><option value="">—</option>{bagli.map((x) => <option key={x.id} value={x.id}>{x.adSoyad}</option>)}</select></label>}
      <button className="btn birincil" disabled={metin.trim().length < 2} onClick={ekle}>Notu kaydet</button>
    </div>
    {notlar.length > 0 && <ul className="not-akisi">{notlar.map((n) => <li key={n.id}>
      <span className={"not-tur t-" + n.tur.toLowerCase()}>{NOT_TURU[n.tur]}</span>
      <div style={{ flex: 1 }}><div className="ipucu">{tarihYaz(n.tarih, true)}{n.kisiId ? " · " + (d.kisiler.find((x) => x.id === n.kisiId)?.adSoyad ?? "") : ""}</div><div style={{ whiteSpace: "pre-wrap" }}>{n.metin}</div></div>
      <button className="btn kucuk" aria-label="Notu sil" onClick={() => sil(n.id)}>Sil</button>
    </li>)}</ul>}
  </section>;
}