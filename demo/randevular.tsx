/**
 * Anahtar CRM v3.41 · 23 Ekim 2026
 * RANDEVULAR — kayıt detayında gösterim / görüşme kartı: ekle, sonucunu gir (Gerçekleşti / Gelmedi / İptal).
 * Canlıda /api/randevular (src/lib/services/randevu.ts); demoda bu oturumluk örnek liste (kalıcı değil).
 */
import React, { useContext, useEffect, useState } from "react";
import { useKaydedilmemis } from "./kirli";
import { C, Pill } from "./ortak";
import { CANLI } from "./depo";
import { RANDEVU_TURLERI, RANDEVU_TURU_ETIKET, RANDEVU_SONUCLARI, RANDEVU_SONUC_ETIKET } from "../src/lib/domain/islem";

type Tur = (typeof RANDEVU_TURLERI)[number];
type Sonuc = (typeof RANDEVU_SONUCLARI)[number];
export interface Randevu { id: string; tarih: string; tur: Tur; sonuc: Sonuc; talepId?: string | null; portfoyId?: string | null; kisiId?: string | null; not?: string | null }

const DEMO: Randevu[] = [];
async function api<T>(yol: string, init?: { method?: string; json?: unknown }): Promise<T> {
  const r = await CANLI.api!(yol, init);
  const j: any = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j?.mesaj ?? `Sunucu ${r.status}`);
  return j as T;
}
const yerelSaat = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
const yaz = (s: string) => new Date(s).toLocaleString("tr-TR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const TON: Record<Sonuc, string> = { PLANLANDI: "mavi", GERCEKLESTI: "iyi", IPTAL: "notr", GELMEDI: "kotu" };

export function RandevuKarti({ kayitId, talep, kisiId, karsilar }: { kayitId: string; talep: boolean; kisiId?: string | null; karsilar: { id: string; baslik: string }[] }) {
  const { bildir } = useContext(C);
  const canli = CANLI.acik;
  const [liste, setListe] = useState<Randevu[]>(() => (canli ? [] : DEMO.filter((r) => r.talepId === kayitId || r.portfoyId === kayitId)));
  const [acik, setAcik] = useState(false);
  const [hata, setHata] = useState<string>();
  const yarin = new Date(); yarin.setDate(yarin.getDate() + 1); yarin.setHours(11, 0, 0, 0);
  const [tarih, setTarih] = useState(yerelSaat(yarin)), [tur, setTur] = useState<Tur>("GOSTERIM"), [karsi, setKarsi] = useState(""), [not, setNot] = useState("");

  const yukle = async () => { if (canli) try { setListe(await api<Randevu[]>(`/api/randevular?kayitId=${encodeURIComponent(kayitId)}`)); } catch (e: any) { setHata(e.message); } };
  useEffect(() => { void yukle(); }, [kayitId]);
  const calis = async (is: () => Promise<void>, ok: string) => { setHata(undefined); try { await is(); bildir(ok); } catch (e: any) { setHata(e?.message ?? "Bir sorun oluştu"); } };

  // v3.37 — randevu formu doldurulmuşken başka ekrana geçilirse "kaydedelim mi?"
  const birak = useKaydedilmemis(acik && !!(not.trim() || karsi), "Randevu", () => ekle());
  const ekle = async (): Promise<boolean> => { let ok = false; await calis(async () => {
    const r = { tarih: new Date(tarih).toISOString(), tur, sonuc: "PLANLANDI" as Sonuc, talepId: talep ? kayitId : karsi || null, portfoyId: talep ? karsi || null : kayitId, kisiId: kisiId ?? null, not: not.trim() || null };
    if (canli) { await api("/api/randevular", { method: "POST", json: r }); await yukle(); }
    else { const y = { id: "r" + Date.now(), ...r }; DEMO.push(y); setListe((l) => [y, ...l]); }
    birak(); setAcik(false); setNot(""); setKarsi(""); ok = true;
  }, "Randevu eklendi"); return ok; };
  const sonucGir = (r: Randevu, sonuc: Sonuc) => calis(async () => {
    if (canli) { await api(`/api/randevular?id=${r.id}`, { method: "PATCH", json: { sonuc } }); await yukle(); }
    else { r.sonuc = sonuc; setListe((l) => l.map((x) => (x.id === r.id ? { ...x, sonuc } : x))); }
  }, `Sonuç: ${RANDEVU_SONUC_ETIKET[sonuc]}`);

  const sirali = [...liste].sort((a, b) => (a.tarih < b.tarih ? 1 : -1));
  const ad = (id?: string | null) => karsilar.find((k) => k.id === id)?.baslik;
  return <section className="kart yigin" id="randevular">
    <div className="satir-ara"><h3>Randevular ({liste.length})</h3><button className="btn kucuk" onClick={() => { if (acik) birak(); setAcik(!acik); }}>{acik ? "Vazgeç" : "+ Randevu"}</button></div>
    {hata && <p role="alert" className="hata">{hata}</p>}
    {acik && <div className="yigin" style={{ gap: 8 }}>
      <div className="satir sar">
        <input type="datetime-local" aria-label="Randevu tarihi ve saati" value={tarih} onChange={(e) => setTarih(e.target.value)} />
        <select aria-label="Randevu türü" value={tur} onChange={(e) => setTur(e.target.value as Tur)}>{RANDEVU_TURLERI.map((t) => <option key={t} value={t}>{RANDEVU_TURU_ETIKET[t]}</option>)}</select>
      </div>
      {karsilar.length > 0 && <select aria-label={talep ? "Gösterilecek portföy" : "Gelen talep"} value={karsi} onChange={(e) => setKarsi(e.target.value)}>
        <option value="">{talep ? "Hangi portföy? (isteğe bağlı)" : "Hangi talep? (isteğe bağlı)"}</option>
        {karsilar.slice(0, 40).map((k) => <option key={k.id} value={k.id}>{k.baslik}</option>)}
      </select>}
      <input aria-label="Randevu notu" maxLength={1000} value={not} onChange={(e) => setNot(e.target.value)} placeholder="Not (isteğe bağlı)" />
      <div><button className="btn birincil" onClick={() => void ekle()}>Randevuyu kaydet</button></div>
    </div>}
    {sirali.length === 0 && !acik && <p className="ipucu">Henüz randevu yok. Gösterim ya da görüşme ayarlayınca buraya ekleyin; sonucu sonradan girilir.</p>}
    {sirali.map((r) => <div key={r.id} className="satir-ara sar" style={{ borderTop: "1px solid var(--cizgi, #e5e5e5)", paddingTop: 6 }}>
      <div className="yigin" style={{ gap: 2 }}>
        <b>{yaz(r.tarih)} · {RANDEVU_TURU_ETIKET[r.tur]} <Pill ton={TON[r.sonuc]}>{RANDEVU_SONUC_ETIKET[r.sonuc]}</Pill></b>
        {(ad(talep ? r.portfoyId : r.talepId) || r.not) && <span className="ipucu">{[ad(talep ? r.portfoyId : r.talepId), r.not].filter(Boolean).join(" · ")}</span>}
      </div>
      <div className="satir sar">{(["GERCEKLESTI", "GELMEDI", "IPTAL"] as Sonuc[]).filter((s) => s !== r.sonuc).map((s) => <button key={s} className="btn kucuk" onClick={() => sonucGir(r, s)}>{RANDEVU_SONUC_ETIKET[s]}</button>)}</div>
    </div>)}
  </section>;
}
