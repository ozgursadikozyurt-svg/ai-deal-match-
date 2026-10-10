/**
 * Anahtar CRM v3.24 · 10 Ekim 2026
 * Demo — Ayarlar → Verilerimi dışa aktar: talepler, portföyler, kişiler, eşleşme takibi, görüşme notları (CSV, Excel'de açılır)
 * ve tam yedek (JSON). Canlıda aynı içerik /api/disa-aktar'dan iner. Arşiv ya da başka bir CRM'e taşıma için.
 */
import React, { useEffect, useState } from "react";
import { csvYaz, kayitSutunlari, kisiSutunlari, eslesmeSutunlari, notSutunlari } from "../src/lib/disa-aktar";
import { useDepo, baslikOf, lokEtiket, eKey } from "./ortak";
import { NOT_TURU, CANLI } from "./depo";
import { SURUM } from "../src/lib/surum";

type Indirici = { save: (r: { filename: string; data: string }) => Promise<unknown> } | null;

export function DisaAktar() {
  const { d, bildir } = useDepo();
  const [dl, setDl] = useState<Indirici | undefined>(undefined);
  useEffect(() => { const c = (window as any).claude; if (!c?.use) { setDl(null); return; } c.use("downloads").then((x: Indirici) => setDl(x)).catch(() => setDl(null)); }, []);
  const tarih = new Date().toISOString().slice(0, 10);
  const kisiAdi = (id: string) => d.kisiler.find((k) => k.id === id)?.adSoyad ?? id;
  const kayitAdi = (id: string) => { const k = d.kayitlar.find((x) => x.id === id); return k ? baslikOf(k.veri) : id; };
  const uret = (t: string): [string, string] => {
    if (t === "talepler" || t === "portfoyler") return [`anahtar-crm-${t}-${tarih}.csv`, csvYaz(d.kayitlar.filter((k) => k.veri.tip === (t === "talepler" ? "TALEP" : "PORTFOY")), kayitSutunlari(kisiAdi, (l) => lokEtiket(l)))];
    if (t === "kisiler") return [`anahtar-crm-kisiler-${tarih}.csv`, csvYaz(d.kisiler as any[], kisiSutunlari)];
    if (t === "eslesmeler") return [`anahtar-crm-eslesmeler-${tarih}.csv`, csvYaz(Object.entries(d.eslesmeNotlari).map(([a, n]) => { const [tid, pid] = a.split("~"); return { talepId: tid, talep: kayitAdi(tid), portfoyId: pid, portfoy: kayitAdi(pid), durum: n.durum, neden: n.neden, not: n.not, tarih: n.tarih }; }), eslesmeSutunlari)];
    if (t === "notlar") return [`anahtar-crm-notlar-${tarih}.csv`, csvYaz(d.kayitlar.flatMap((k) => (k.notlar ?? []).map((n) => ({ kayitId: k.id, kayit: baslikOf(k.veri), tarih: n.tarih, tur: NOT_TURU[n.tur], kisi: n.kisiId ? kisiAdi(n.kisiId) : "", metin: n.metin }))), notSutunlari)];
    return [`anahtar-crm-yedek-${tarih}.json`, JSON.stringify({ surum: SURUM, tarih, kayitlar: d.kayitlar, kisiler: d.kisiler, eslesmeNotlari: d.eslesmeNotlari, ayarlar: d.ayarlar }, null, 1)];
  };
  const indir = async (t: string) => {
    const [filename, data] = uret(t);
    if (CANLI.acik) { // canlı: normal tarayıcı indirmesi (CSV'ye Excel için BOM eklenir)
      const blob = new Blob([filename.endsWith(".csv") ? "\ufeff" + data : data], { type: filename.endsWith(".csv") ? "text/csv;charset=utf-8" : "application/json" });
      const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = filename; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      bildir(`${filename} indirildi`); return;
    }
    if (dl) { try { await dl.save({ filename, data }); bildir(`${filename} hazır`); return; } catch (e: any) { if (e?.code === "declined") return; } }
    try { await navigator.clipboard.writeText(data); bildir("İndirme bu görünümde kapalı — veriyi panoya kopyaladım; Excel'e yapıştırabilirsiniz"); } catch { bildir("İndirme ve kopyalama bu görünümde kullanılamıyor"); }
  };
  const sayi: Record<string, number> = { talepler: d.kayitlar.filter((k) => k.veri.tip === "TALEP").length, portfoyler: d.kayitlar.filter((k) => k.veri.tip === "PORTFOY").length, kisiler: d.kisiler.length, eslesmeler: Object.keys(d.eslesmeNotlari).length, notlar: d.kayitlar.reduce((a, k) => a + (k.notlar?.length ?? 0), 0) };
  return <section className="kart yigin kucuk-bosluk">
    <h3>Verilerimi dışa aktar</h3>
    <div className="cip-satir">
      {([["talepler", "Talepler"], ["portfoyler", "Portföyler"], ["kisiler", "Kişiler"], ["eslesmeler", "Eşleşme takibi"], ["notlar", "Görüşme notları"]] as const).map(([k, l]) => <button key={k} className="btn kucuk" onClick={() => indir(k)}>{l} (CSV · {sayi[k]})</button>)}
      <button className="btn kucuk birincil" onClick={() => indir("yedek")}>Tam yedek (JSON)</button>
    </div>
    {dl === null && !CANLI.acik && <div className="ipucu">Bu görünümde dosya indirme kapalı; düğmeler içeriği panoya kopyalar.</div>}
  </section>;
}