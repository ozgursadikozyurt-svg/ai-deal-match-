/**
 * Anahtar CRM v3.41 · 23 Ekim 2026
 * İŞLEMLER — kapanan satış / kiralama ve komisyon (yalnızca ofis yöneticisi: islem.yonet).
 * P&L kuralı: "bana kalan" tahsilat ayına yazılır; tahsilat tarihi boşsa "bekleyen" (src/lib/domain/islem.ts).
 * Canlıda /api/islemler; demoda örnek veri (kalıcı değil). Polaris'ten taşınan satırlarda "Polaris" etiketi görünür.
 */
import React, { useContext, useEffect, useMemo, useState } from "react";
import { useKaydedilmemis, useIlkHal } from "./kirli";
import { C, baslikOf } from "./ortak";
import { CANLI } from "./depo";
import { ISLEM_TURLERI, ISLEM_TURU_ETIKET, aylikBanaKalan, turTahmini, type IslemTuru } from "../src/lib/domain/islem";

export interface Islem {
  id: string; tarih: string; tahsilatTarihi: string | null; tur: IslemTuru; baslik: string;
  bedel: number | null; paylasilan: number | null; ofisPayi: number | null; banaKalan: number | null;
  aciklama: string | null; reklam: boolean; talepKaynagi?: string | null; talepId?: string | null; portfoyId?: string | null; kisiId?: string | null; disKaynak?: string | null;
}
const AYLAR = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];
const TL = (n: number | null | undefined) => (n == null ? "—" : `${Math.round(n).toLocaleString("tr-TR")} ₺`);
const bugun = () => new Date().toISOString().slice(0, 10);
const sayiOku = (s: string): number | null => { const t = s.trim().replace(/\./g, "").replace(",", "."); if (!t) return null; const n = Number(t); if (!Number.isFinite(n)) throw new Error(`"${s}" sayı değil`); return n; };

const DEMO: Islem[] = [
  { id: "di1", tarih: "2026-09-12", tahsilatTarihi: "2026-09-12", tur: "KIRALAMA", baslik: "Kepez 1.200 m² depo kiralama (örnek)", bedel: 150000, paylasilan: null, ofisPayi: 30000, banaKalan: 120000, aciklama: "Fatura kesildi", reklam: true, talepKaynagi: "META_REKLAM" },
  { id: "di2", tarih: "2026-10-03", tahsilatTarihi: "2026-10-05", tur: "SATIS", baslik: "Lara dükkan satış (örnek)", bedel: 7500000, paylasilan: 75000, ofisPayi: 37500, banaKalan: 112500, aciklama: null, reklam: false },
  { id: "di3", tarih: "2026-10-15", tahsilatTarihi: null, tur: "KIRALAMA", baslik: "Aksu ofis kiralama — tahsilat bekliyor (örnek)", bedel: 40000, paylasilan: null, ofisPayi: 8000, banaKalan: 32000, aciklama: null, reklam: false },
];

async function api<T>(yol: string, init?: { method?: string; json?: unknown }): Promise<T> {
  const r = await CANLI.api!(yol, init);
  const j: any = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j?.mesaj ?? (j?.alanlar ? j.alanlar.map((a: any) => `${a.alan}: ${a.mesaj}`).join(", ") : `Sunucu ${r.status}`));
  return j as T;
}

type Form = { tarih: string; tahsil: boolean; tahsilatTarihi: string; tur: IslemTuru; turElle: boolean; baslik: string; bedel: string; paylasilan: string; ofisPayi: string; banaKalan: string; aciklama: string; reklam: boolean; talep: string; portfoy: string };
const bosForm = (): Form => ({ tarih: bugun(), tahsil: true, tahsilatTarihi: bugun(), tur: "DIGER", turElle: false, baslik: "", bedel: "", paylasilan: "", ofisPayi: "", banaKalan: "", aciklama: "", reklam: false, talep: "", portfoy: "" });
const formdan = (x: Islem, ad: (id?: string | null) => string): Form => ({ tarih: x.tarih, tahsil: !!x.tahsilatTarihi, tahsilatTarihi: x.tahsilatTarihi ?? bugun(), tur: x.tur, turElle: true, baslik: x.baslik, bedel: x.bedel?.toString() ?? "", paylasilan: x.paylasilan?.toString() ?? "", ofisPayi: x.ofisPayi?.toString() ?? "", banaKalan: x.banaKalan?.toString() ?? "", aciklama: x.aciklama ?? "", reklam: x.reklam, talep: ad(x.talepId), portfoy: ad(x.portfoyId) });

export function IslemlerEkrani() {
  const { d, bildir } = useContext(C);
  const canli = CANLI.acik;
  const [liste, setListe] = useState<Islem[]>(canli ? [] : DEMO);
  const [yukleniyor, setYukleniyor] = useState(canli);
  const [hata, setHata] = useState<string>();
  const [yil, setYil] = useState(new Date().getFullYear());
  const [ara, setAra] = useState("");
  const [duzen, setDuzen] = useState<{ id?: string; f: Form } | null>(null);
  const [silOnay, setSilOnay] = useState(false);

  const kayitlar = d.kayitlar ?? [];
  const adIle = useMemo(() => new Map(kayitlar.map((k: any) => [baslikOf(k.veri), k.id])), [kayitlar]);
  const ad = (id?: string | null) => (id ? (kayitlar.find((k: any) => k.id === id) ? baslikOf(kayitlar.find((k: any) => k.id === id)!.veri) : "") : "");

  const yukle = async () => { if (!canli) return; try { setListe(await api<Islem[]>("/api/islemler")); setHata(undefined); } catch (e: any) { setHata(e.message); } finally { setYukleniyor(false); } };
  useEffect(() => { void yukle(); }, []);

  const yillar = useMemo(() => [...new Set([new Date().getFullYear(), ...liste.map((x) => Number(x.tarih.slice(0, 4)))])].sort((a, b) => b - a), [liste]);
  const ozet = aylikBanaKalan(liste, yil);
  const buAy = new Date().getMonth();
  const gorunen = liste.filter((x) => (x.tahsilatTarihi ?? x.tarih).startsWith(String(yil)) || (!x.tahsilatTarihi && x.tarih.startsWith(String(yil))))
    .filter((x) => !ara.trim() || `${x.baslik} ${x.aciklama ?? ""}`.toLocaleLowerCase("tr-TR").includes(ara.toLocaleLowerCase("tr-TR")))
    .sort((a, b) => (a.tarih < b.tarih ? 1 : -1));

  // v3.37 — açık formda değişiklik varken başka ekrana geçilirse "kaydedelim mi?"
  const ilkHal = useIlkHal(duzen?.f ?? null);
  const birak = useKaydedilmemis(!!duzen && ilkHal.degisti, "İşlem", () => kaydet());
  const kapatForm = () => { birak(); ilkHal.sifirla(); setDuzen(null); };
  const kaydet = async (): Promise<boolean> => {
    if (!duzen) return true;
    setHata(undefined);
    try {
      const f = duzen.f;
      if (f.baslik.trim().length < 2) throw new Error("Başlık yazın");
      const govde = {
        tarih: f.tarih, tahsilatTarihi: f.tahsil ? f.tahsilatTarihi || f.tarih : null, tur: f.tur, baslik: f.baslik.trim(),
        bedel: sayiOku(f.bedel), paylasilan: sayiOku(f.paylasilan), ofisPayi: sayiOku(f.ofisPayi), banaKalan: sayiOku(f.banaKalan),
        aciklama: f.aciklama.trim() || null, reklam: f.reklam, talepKaynagi: f.reklam ? "REKLAM" : null,
        talepId: f.talep ? adIle.get(f.talep) ?? null : null, portfoyId: f.portfoy ? adIle.get(f.portfoy) ?? null : null,
      };
      if (canli) { await api(duzen.id ? `/api/islemler?id=${duzen.id}` : "/api/islemler", { method: duzen.id ? "PATCH" : "POST", json: govde }); await yukle(); }
      else setListe((l) => duzen.id ? l.map((x) => (x.id === duzen.id ? { ...x, ...govde } as Islem : x)) : [{ id: "di" + Date.now(), ...govde } as Islem, ...l]);
      bildir(duzen.id ? "İşlem güncellendi" : "İşlem eklendi");
      kapatForm();
      return true;
    } catch (e: any) { setHata(e?.message ?? "Kaydedilemedi"); return false; }
  };
  const sil = async () => {
    if (!duzen?.id) return;
    try {
      if (canli) { await api(`/api/islemler?id=${duzen.id}`, { method: "DELETE" }); await yukle(); } else setListe((l) => l.filter((x) => x.id !== duzen.id));
      bildir("İşlem silindi"); kapatForm(); setSilOnay(false);
    } catch (e: any) { setHata(e.message); }
  };
  const setF = (k: keyof Form, v: any) => setDuzen((x) => x && { ...x, f: { ...x.f, [k]: v, ...(k === "baslik" && !x.f.turElle ? { tur: turTahmini(v) } : {}), ...(k === "tarih" && !x.id ? { tahsilatTarihi: v } : {}) } });

  return <div className="yigin">
    <div className="satir-ara sar"><h2>İşlemler</h2><button className="btn birincil" onClick={() => { ilkHal.sifirla(); setDuzen({ f: bosForm() }); setSilOnay(false); }}>+ Yeni işlem</button></div>
    <p className="ipucu">Kapanan satış ve kiralamalar ile komisyonu. "Bana kalan" tahsilat ayına yazılır; tahsilatı girilmeyen işlem "bekleyen"de durur. Bu ekranı yalnızca ofis yöneticisi görür. Polaris'teki P&amp;L bu kayıtlardan okuyacak.</p>
    {hata && <p role="alert" className="hata">{hata}</p>}

    {duzen && <section className="kart yigin" aria-label="İşlem formu" onPointerDownCapture={ilkHal.dokun} onKeyDownCapture={ilkHal.dokun} onFocusCapture={ilkHal.dokun}>
      <h3>{duzen.id ? "İşlemi düzenle" : "Yeni işlem"}</h3>
      <div className="alanlar">
        <div className="alan genis"><label htmlFor="i-baslik">Başlık</label><input id="i-baslik" maxLength={300} value={duzen.f.baslik} onChange={(e) => setF("baslik", e.target.value)} placeholder="Ör. Kepez 1.200 m² depo kiralama — Ahmet Bey" /></div>
        <div className="alan"><label htmlFor="i-tarih">İşlem tarihi</label><input id="i-tarih" type="date" value={duzen.f.tarih} onChange={(e) => setF("tarih", e.target.value)} /></div>
        <div className="alan"><label htmlFor="i-tur">Tür</label><select id="i-tur" value={duzen.f.tur} onChange={(e) => setDuzen((x) => x && { ...x, f: { ...x.f, tur: e.target.value as IslemTuru, turElle: true } })}>{ISLEM_TURLERI.map((t) => <option key={t} value={t}>{ISLEM_TURU_ETIKET[t]}</option>)}</select></div>
        <div className="alan"><label htmlFor="i-bedel">Bedel (satış / kira) ₺</label><input id="i-bedel" inputMode="decimal" value={duzen.f.bedel} onChange={(e) => setF("bedel", e.target.value)} /></div>
        <div className="alan"><label htmlFor="i-bana">Bana kalan (net komisyon) ₺</label><input id="i-bana" inputMode="decimal" value={duzen.f.banaKalan} onChange={(e) => setF("banaKalan", e.target.value)} /></div>
        <div className="alan"><label htmlFor="i-ofis">Ofis payı ₺</label><input id="i-ofis" inputMode="decimal" value={duzen.f.ofisPayi} onChange={(e) => setF("ofisPayi", e.target.value)} /></div>
        <div className="alan"><label htmlFor="i-pay">Paylaşılan ₺</label><input id="i-pay" inputMode="decimal" value={duzen.f.paylasilan} onChange={(e) => setF("paylasilan", e.target.value)} /></div>
        <div className="alan genis"><label className="satir" style={{ gap: 6 }}><input type="checkbox" checked={duzen.f.tahsil} onChange={(e) => setF("tahsil", e.target.checked)} /> Komisyon tahsil edildi</label>
          {duzen.f.tahsil ? <input type="date" aria-label="Tahsilat tarihi" value={duzen.f.tahsilatTarihi} onChange={(e) => setF("tahsilatTarihi", e.target.value)} /> : <span className="ipucu">Bekleyen olarak görünür; P&amp;L'e tahsil edildiği ay girer.</span>}</div>
        <div className="alan genis"><label className="satir" style={{ gap: 6 }}><input type="checkbox" checked={duzen.f.reklam} onChange={(e) => setF("reklam", e.target.checked)} /> Reklamdan gelen işlem</label></div>
        <div className="alan"><label htmlFor="i-talep">Talep <small className="ipucu">· isteğe bağlı</small></label><input id="i-talep" list="i-talepler" value={duzen.f.talep} onChange={(e) => setF("talep", e.target.value)} placeholder="Talep başlığından seçin" /></div>
        <div className="alan"><label htmlFor="i-portfoy">Portföy <small className="ipucu">· isteğe bağlı</small></label><input id="i-portfoy" list="i-portfoyler" value={duzen.f.portfoy} onChange={(e) => setF("portfoy", e.target.value)} placeholder="Portföy başlığından seçin" /></div>
        <datalist id="i-talepler">{kayitlar.filter((k: any) => k.veri.tip === "TALEP").slice(0, 400).map((k: any) => <option key={k.id} value={baslikOf(k.veri)} />)}</datalist>
        <datalist id="i-portfoyler">{kayitlar.filter((k: any) => k.veri.tip === "PORTFOY").slice(0, 400).map((k: any) => <option key={k.id} value={baslikOf(k.veri)} />)}</datalist>
        <div className="alan genis"><label htmlFor="i-acik">Açıklama</label><textarea id="i-acik" rows={2} maxLength={2000} value={duzen.f.aciklama} onChange={(e) => setF("aciklama", e.target.value)} placeholder="Ör. KDV'li fatura kesildi" /></div>
      </div>
      <div className="satir sar">
        <button className="btn birincil" onClick={() => void kaydet()}>Kaydet</button>
        <button className="btn" onClick={kapatForm}>Vazgeç</button>
        {duzen.id && (!silOnay ? <button className="btn" onClick={() => setSilOnay(true)}>Sil…</button> : <><span>Emin misiniz?</span><button className="btn tehlike" onClick={sil}>Evet, sil</button></>)}
      </div>
    </section>}

    <div className="satir sar">{yillar.map((y) => <button key={y} className={"btn kucuk" + (y === yil ? " birincil" : "")} aria-pressed={y === yil} onClick={() => setYil(y)}>{y}</button>)}</div>
    <div className="izgara">
      <div><span>{yil} bana kalan (tahsil edilen)</span><b>{TL(ozet.toplam)}</b></div>
      {yil === new Date().getFullYear() && <div><span>Bu ay</span><b>{TL(ozet.aylar[buAy])}</b></div>}
      <div><span>Bekleyen (tahsil edilmedi)</span><b>{TL(ozet.bekleyen)}</b></div>
      <div><span>İşlem sayısı ({yil})</span><b>{liste.filter((x) => x.tarih.startsWith(String(yil))).length}</b></div>
    </div>
    <section className="kart">
      <h3>Aylara göre bana kalan · {yil}</h3>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(84px, 1fr))", gap: 6 }}>
        {ozet.aylar.map((t, i) => <div key={i} style={{ background: i === buAy && yil === new Date().getFullYear() ? "var(--vurgu-bg, #eef5f3)" : "transparent", borderRadius: 8, padding: "4px 6px" }}><small className="ipucu">{AYLAR[i]}</small><div><b>{t ? Math.round(t).toLocaleString("tr-TR") : "—"}</b></div></div>)}
      </div>
    </section>

    <input type="search" aria-label="İşlem ara" value={ara} onChange={(e) => setAra(e.target.value)} placeholder="Başlık ya da açıklama ara" />
    {yukleniyor && <p className="ipucu">Yükleniyor…</p>}
    {!yukleniyor && gorunen.length === 0 && <p className="bos">{yil} için işlem yok.</p>}
    {gorunen.map((x) => <button key={x.id} type="button" className="kart" style={{ textAlign: "left", display: "flex", flexDirection: "column", gap: 2, width: "100%" }} onClick={() => { ilkHal.sifirla(); setDuzen({ id: x.id, f: formdan(x, ad) }); setSilOnay(false); window.scrollTo({ top: 0, behavior: "smooth" }); }}>
      <div className="satir-ara"><span className="ipucu">{new Date(x.tarih + "T12:00:00").toLocaleDateString("tr-TR")} · {ISLEM_TURU_ETIKET[x.tur]}{x.reklam ? " · Reklam" : ""}{x.disKaynak === "POLARIS" ? " · Polaris" : ""}{!x.tahsilatTarihi ? " · tahsilat bekliyor" : x.tahsilatTarihi !== x.tarih ? ` · tahsilat ${new Date(x.tahsilatTarihi + "T12:00:00").toLocaleDateString("tr-TR")}` : ""}</span><b>{TL(x.banaKalan)}</b></div>
      <b>{x.baslik}</b>
      {(x.bedel || x.ofisPayi || x.paylasilan || x.aciklama) && <span className="ipucu">{[x.bedel ? `Bedel ${TL(x.bedel)}` : "", x.ofisPayi ? `Ofis ${TL(x.ofisPayi)}` : "", x.paylasilan ? `Paylaşılan ${TL(x.paylasilan)}` : "", x.aciklama ?? ""].filter(Boolean).join(" · ")}</span>}
    </button>)}
  </div>;
}
