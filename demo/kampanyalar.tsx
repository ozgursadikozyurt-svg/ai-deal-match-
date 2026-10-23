/**
 * Anahtar CRM v3.41 · 23 Ekim 2026
 * KAMPANYALAR — Yönetim'de kampanya listesi + elle aylık harcama; kayıt formunda kampanya seçimi için ad listesi.
 * Basit bağ: kayıt kampanyaya `ilkKaynakDetay` = kampanya adı ile bağlanır (servis: src/lib/services/kampanya.ts). Ad değişmez, kampanya "kapatılır".
 * Canlıda /api/kampanyalar; demoda örnek veri (kalıcı değil).
 */
import React, { useContext, useEffect, useState } from "react";
import { C } from "./ortak";
import { CANLI } from "./depo";
import { KAMPANYA_KANALLARI, KANAL_ETIKETI, kayitBasinaMaliyet } from "../src/lib/services/kampanya-ortak";

type Kanal = (typeof KAMPANYA_KANALLARI)[number];
interface Kampanya { id: string; kanal: Kanal; ad: string; butce?: number | null; aktif?: boolean; kayitSayisi?: number; toplamHarcama?: number; kayitBasinaMaliyet?: number | null; harcamalar?: { ay: string; tutar: number }[] }

const buAy = () => new Date().toISOString().slice(0, 7);
const TL = (n: number) => `${Math.round(n).toLocaleString("tr-TR")} ₺`;

const DEMO: Kampanya[] = [
  { id: "dk1", kanal: "META_REKLAM", ad: "Meta – Yatırımlık arsa Ekim (örnek)", butce: 30000, aktif: true, kayitSayisi: 7, toplamHarcama: 12600, kayitBasinaMaliyet: 1800, harcamalar: [{ ay: buAy(), tutar: 12600 }] },
  { id: "dk2", kanal: "GOOGLE_REKLAM", ad: "Google – Kiralık depo Antalya (örnek)", butce: 20000, aktif: true, kayitSayisi: 0, toplamHarcama: 0, kayitBasinaMaliyet: null, harcamalar: [] },
];

async function api<T>(yol: string, init?: { method?: string; json?: unknown }): Promise<T> {
  const r = await CANLI.api!(yol, init);
  const j: any = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j?.mesaj ?? `Sunucu ${r.status}`);
  return j as T;
}

/** Forma "Kampanya / liste" önerileri: açık kampanya adları. Canlıda bir kez çekilir. */
let onbellek: { ad: string; kanal: Kanal }[] | null = null;
export function useKampanyaAdlari(): { ad: string; kanal: Kanal }[] {
  const [l, setL] = useState(() => onbellek ?? (CANLI.acik ? [] : DEMO.filter((k) => k.aktif !== false).map((k) => ({ ad: k.ad, kanal: k.kanal }))));
  useEffect(() => {
    if (!CANLI.acik || onbellek) return;
    api<Kampanya[]>("/api/kampanyalar").then((r) => { onbellek = r.map((k) => ({ ad: k.ad, kanal: k.kanal })); setL(onbellek); }).catch(() => {});
  }, []);
  return l;
}
const onbellekSifirla = () => { onbellek = null; };

export function KampanyaYonetimi() {
  const { bildir } = useContext(C);
  const canli = CANLI.acik;
  const [liste, setListe] = useState<Kampanya[]>(canli ? [] : DEMO);
  const [yukleniyor, setYukleniyor] = useState(canli);
  const [hata, setHata] = useState<string>();
  const [kanal, setKanal] = useState<Kanal>("META_REKLAM"), [ad, setAd] = useState(""), [butce, setButce] = useState("");
  const [acik, setAcik] = useState<string>();
  const [ay, setAy] = useState(buAy()), [tutar, setTutar] = useState("");

  const yukle = async () => {
    if (!canli) return;
    try { setListe(await api<Kampanya[]>("/api/kampanyalar")); setHata(undefined); } catch (e: any) { setHata(e.message); } finally { setYukleniyor(false); }
  };
  useEffect(() => { void yukle(); }, []);
  const calis = async (is: () => Promise<void>, ok?: string) => { setHata(undefined); try { await is(); if (ok) bildir(ok); } catch (e: any) { setHata(e?.message ?? "Bir sorun oluştu"); } };

  const ekle = () => calis(async () => {
    const a = ad.trim(); if (a.length < 2) throw new Error("Kampanya adı en az 2 harf olmalı");
    const b = butce.trim() ? Number(butce.replace(/\./g, "").replace(",", ".")) : null;
    if (b != null && !Number.isFinite(b)) throw new Error("Bütçe sayı olmalı");
    if (canli) { await api("/api/kampanyalar", { method: "POST", json: { kanal, ad: a, butce: b } }); onbellekSifirla(); await yukle(); }
    else { if (liste.some((k) => k.ad === a)) throw new Error("Bu adla bir kampanya zaten var"); setListe((l) => [{ id: "dk" + Date.now(), kanal, ad: a, butce: b, aktif: true, kayitSayisi: 0, toplamHarcama: 0, kayitBasinaMaliyet: null, harcamalar: [] }, ...l]); }
    setAd(""); setButce("");
  }, "Kampanya eklendi — kayıt açarken “Kampanya / liste” alanından seçilir");

  const durumDegis = (k: Kampanya) => calis(async () => {
    if (canli) { await api(`/api/kampanyalar?id=${k.id}`, { method: "PATCH", json: { aktif: !k.aktif } }); onbellekSifirla(); await yukle(); }
    else setListe((l) => l.map((x) => (x.id === k.id ? { ...x, aktif: !x.aktif } : x)));
  }, k.aktif ? "Kampanya kapatıldı (geçmiş kayıtlar kalır)" : "Kampanya yeniden açıldı");

  const harcamaKaydet = (k: Kampanya) => calis(async () => {
    const t = tutar.trim() ? Number(tutar.replace(/\./g, "").replace(",", ".")) : 0;
    if (!Number.isFinite(t) || t < 0) throw new Error("Tutar sayı olmalı");
    if (canli) { await api(`/api/kampanyalar?id=${k.id}`, { method: "PUT", json: { ay, tutar: t || null } }); await yukle(); }
    else setListe((l) => l.map((x) => {
      if (x.id !== k.id) return x;
      const h = [...(x.harcamalar ?? []).filter((y) => y.ay !== ay), ...(t ? [{ ay, tutar: t }] : [])].sort((a, b) => (a.ay < b.ay ? 1 : -1));
      const toplam = h.reduce((s, y) => s + y.tutar, 0);
      return { ...x, harcamalar: h, toplamHarcama: toplam, kayitBasinaMaliyet: kayitBasinaMaliyet(toplam, x.kayitSayisi ?? 0) };
    }));
    setTutar("");
  }, "Harcama kaydedildi");

  return <section className="kart yigin" id="yon-kampanya">
    <h3>Reklam kampanyaları</h3>
    <p className="ipucu">Meta ve Google panelinden ay sonunda harcamayı buraya girin; kayıt sayısı ve kayıt başına maliyet buradan görünür. Kampanya adı sonradan değişmez; bitince “Kapat” deyin (geçmiş kayıtlar ve harcama kalır). Asistan kampanya adlarını seçebilir ama bütçe ve harcamayı göremez.</p>
    {hata && <p role="alert" className="hata">{hata}</p>}
    <div className="satir sar">
      <select aria-label="Kampanya kanalı" value={kanal} onChange={(e) => setKanal(e.target.value as Kanal)}>{KAMPANYA_KANALLARI.map((k) => <option key={k} value={k}>{KANAL_ETIKETI[k]}</option>)}</select>
      <input aria-label="Kampanya adı" value={ad} maxLength={120} onChange={(e) => setAd(e.target.value)} placeholder="Ör. Meta – Kiralık depo Kasım" />
      <input aria-label="Bütçe (₺, isteğe bağlı)" inputMode="decimal" value={butce} onChange={(e) => setButce(e.target.value)} placeholder="Bütçe ₺ (isteğe bağlı)" style={{ maxWidth: 170 }} />
      <button className="btn birincil" onClick={ekle}>Kampanya ekle</button>
    </div>
    {yukleniyor && <p className="ipucu">Yükleniyor…</p>}
    {!yukleniyor && liste.length === 0 && <p className="ipucu">Henüz kampanya yok. İlk reklamınızı ekleyin; eski kayıtlardaki reklam adları otomatik kampanya olarak açılmış olur.</p>}
    {liste.map((k) => <div key={k.id} style={{ borderBottom: "1px solid var(--cizgi, #e5e5e5)", padding: "8px 0", opacity: k.aktif === false ? 0.6 : 1 }}>
      <div className="satir-ara sar">
        <div className="yigin" style={{ gap: 2 }}>
          <b>{k.ad}{k.aktif === false ? " · kapalı" : ""}</b>
          <span className="ipucu">{KANAL_ETIKETI[k.kanal]} · {k.kayitSayisi ?? 0} kayıt · harcama {TL(k.toplamHarcama ?? 0)}{k.kayitBasinaMaliyet != null ? ` · kayıt başı ${TL(k.kayitBasinaMaliyet)}` : ""}{k.butce ? ` · bütçe ${TL(k.butce)}` : ""}</span>
        </div>
        <div className="satir sar">
          <button className="btn kucuk" aria-expanded={acik === k.id} onClick={() => setAcik(acik === k.id ? undefined : k.id)}>Aylık harcama</button>
          <button className="btn kucuk" onClick={() => durumDegis(k)}>{k.aktif === false ? "Yeniden aç" : "Kapat"}</button>
        </div>
      </div>
      {acik === k.id && <div className="yigin" style={{ marginTop: 6 }}>
        <div className="satir sar">
          <input type="month" aria-label="Ay" value={ay} onChange={(e) => setAy(e.target.value)} />
          <input aria-label="Harcama (₺)" inputMode="decimal" value={tutar} onChange={(e) => setTutar(e.target.value)} placeholder="Harcama ₺ (boş = sil)" style={{ maxWidth: 190 }} />
          <button className="btn kucuk birincil" onClick={() => harcamaKaydet(k)}>Kaydet</button>
        </div>
        {(k.harcamalar ?? []).length === 0 ? <span className="ipucu">Bu kampanya için harcama girilmedi.</span> : <span className="ipucu">{(k.harcamalar ?? []).map((h) => `${h.ay}: ${TL(h.tutar)}`).join(" · ")}</span>}
      </div>}
    </div>)}
  </section>;
}
