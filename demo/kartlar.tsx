/**
 * Anahtar CRM v3.13 · 3 Ekim 2026
 * Demo — eşleşme kartı, eşleştirme tercihleri (eski "Talep DNA" kartı), kapatılabilir bilgi kutusu.
 */
import React, { useState } from "react";
import { talepDnasi } from "../src/lib/eslestirme/talep-dna";
import { kopmaEtiket } from "../src/lib/eslestirme/kopar";
import { etiket } from "./etiketler";
import { useDepo, Pill, IslemPill, UYGUNLUK, baslikOf, fiyatOf, m2Of, lokEtiket, eKey, type Eslesme } from "./ortak";
import { EksikUyarisi } from "./motor-ui";
import { AnahtarDugmesi, favEslesme } from "./favori";
import { KimPill, KoparDugmesi } from "./kopar";
import type { Kayit, PipelineDurum } from "./depo";

export const PIPELINE: [PipelineDurum, string][] = [["YENI", "Yeni"], ["BILDIRILDI", "Bildirildi"], ["GORUSULDU", "Görüşüldü"], ["GOSTERIM", "Gösterim"], ["PAZARLIK", "Pazarlık"], ["KAPANDI", "Kapandı"], ["REDDEDILDI", "Koparıldı"]];

const KAPALI_ANAHTAR = "anahtar-crm-kapali";
function kapalilar(): string[] { try { return JSON.parse(localStorage.getItem(KAPALI_ANAHTAR) ?? "[]"); } catch { return []; } }

/** Kapatılabilir bilgi kutusu: × ile gizlenir, bu tarayıcıda bir daha çıkmaz. */
export function Bilgi({ id, ton = "bilgi", children }: { id: string; ton?: "bilgi" | "ipucu"; children: any }) {
  const [gizli, setGizli] = useState(() => kapalilar().includes(id));
  if (gizli) return null;
  return (
    <div className={(ton === "bilgi" ? "bilgi-kutu" : "ipucu-kutu") + " kapanir"}>
      <div>{children}</div>
      <button className="x-btn" aria-label="Bu bilgiyi gizle" onClick={() => { setGizli(true); try { localStorage.setItem(KAPALI_ANAHTAR, JSON.stringify([...new Set([...kapalilar(), id])])); } catch { /* saklanamazsa yalnızca bu oturumda gizli kalır */ } }}>×</button>
    </div>
  );
}

/** Ana sayfadaki "Google ile bağlanın" daveti — × ile kapatılabilir. */
export function Kapanir({ id, children }: { id: string; children: any }) {
  const [gizli, setGizli] = useState(() => kapalilar().includes(id));
  if (gizli) return null;
  return (
    <div className="kapanir-sar">
      {children}
      <button className="x-btn" aria-label="Gizle" onClick={() => { setGizli(true); try { localStorage.setItem(KAPALI_ANAHTAR, JSON.stringify([...new Set([...kapalilar(), id])])); } catch { /* yoksay */ } }}>×</button>
    </div>
  );
}

/** v3.19 — fırsat rozeti: mülk sahibi ↔ müşteri "Öncelikli", emlakçı ↔ emlakçı "Düşük" */
export function FirsatRozeti({ f, komisyon = false }: { f: Eslesme["f"]; komisyon?: boolean }) {
  return <span className={"pill firsat firsat-" + f.kademe.toLowerCase()} title={f.aciklama + (f.tahminiKomisyon != null ? ` · tahmini komisyon ≈ ${f.tahminiKomisyon.toLocaleString("tr-TR")} TL` : "")}>
    <i aria-hidden="true" />{f.etiket} fırsat{komisyon && f.tahminiKomisyon != null ? <small> · ≈ {kisaTl(f.tahminiKomisyon)}</small> : null}
  </span>;
}
const kisaTl = (n: number) => (n >= 1_000_000 ? (n / 1_000_000).toLocaleString("tr-TR", { maximumFractionDigits: 1 }) + " mn" : n >= 1000 ? Math.round(n / 1000).toLocaleString("tr-TR") + " bin" : String(n)) + " ₺";

/**
 * Eşleşme kartı (v3.19 sadeleştirildi): üstte skor + uygunluk + fırsat; işlem (Satılık/Kiralık) ve mülk tipi bir kez yazılır.
 * Taraflarda yalnızca kim olduğu (rol), başlık, konum ve fiyat görünür. "Web ilanı" gibi katman etiketleri kim etiketinde zaten var.
 */
export function EslesmeKarti({ e, sec }: { e: Eslesme; sec?: { acik: boolean; degis: () => void } }) {
  const { git, d } = useDepo();
  const not = d.eslesmeNotlari[eKey(e.t.id, e.p.id)];
  const u = UYGUNLUK[e.s.uygunluk as keyof typeof UYGUNLUK];
  const kopuk = not?.durum === "REDDEDILDI";
  const ac = () => git({ ad: "eslesme", tid: e.t.id, pid: e.p.id });
  const konum = (v: any) => (v.lokasyonlar ?? []).slice(0, 2).map(lokEtiket).map((s: string) => s.split(" / ").pop()).join(", ") + ((v.lokasyonlar ?? []).length > 2 ? ` +${v.lokasyonlar.length - 2}` : "");
  const Taraf = ({ k, ad }: { k: any; ad: "Talep" | "Portföy" }) => (
    <div className={"es2-taraf " + (ad === "Talep" ? "t" : "p")}>
      <div className="es2-et"><span>{ad}</span><KimPill v={k.veri} />{ad === "Portföy" && e.s.tipUyumu.oran < 0.9 && <span className="benzer-rozet">benzer tip</span>}</div>
      <div className="es2-bas">
        <b>{baslikOf(k.veri)}</b>
        <span className="es2-rakam">{fiyatOf(k.veri)}</span>
      </div>
      <div className="es2-alt">
        {konum(k.veri) && <span>{konum(k.veri)}</span>}
        {m2Of(k.veri) && <span>{m2Of(k.veri)}</span>}
      </div>
    </div>
  );
  const engel = e.s.kritikEngeller.length ? e.s.kritikEngeller.join(", ") : null;
  const sorulacak = !engel ? [...e.s.bilinmeyenKritikler, ...e.s.talepEksikleri.map((x: string) => x + " (müşteriye)")] : [];
  const eksik = (e.s.veriEksikleri ?? []) as string[];
  return (
    <div className={"es2 s-" + u.ton + (kopuk ? " soluk" : "") + (sec?.acik ? " secili" : "")} role="button" tabIndex={0} onClick={sec ? sec.degis : ac} onKeyDown={(ev: any) => { if (ev.key === "Enter") (sec ? sec.degis : ac)(); }}>
      <div className="es2-ust">
        {sec && <input type="checkbox" className="es2-sec" checked={sec.acik} aria-label="Eşleşmeyi seç" onClick={(ev) => ev.stopPropagation()} onChange={sec.degis} />}
        <div className={"es2-skor s-" + u.ton}><b>{e.s.skor}</b><small>puan</small></div>
        <div className="es2-durum">
          <div className="es2-satir1">
            <span className={"es2-uygun s-" + u.ton}>{u.e}</span>
            <FirsatRozeti f={e.f} komisyon />
          </div>
          <div className="pill-satir">
            <IslemPill islem={e.p.veri.islemTipi} /><Pill>{etiket(e.p.veri.mulkTipi)}</Pill>
            {not && not.durum !== "YENI" && !kopuk && <Pill ton="mavi">{PIPELINE.find((x: any) => x[0] === not.durum)?.[1]}</Pill>}
            {not?.not && <Pill>Not var</Pill>}
            {kopuk && <Pill ton="kotu">{kopmaEtiket(not?.neden)}</Pill>}
          </div>
        </div>
        <div className="es-aksiyon"><AnahtarDugmesi anahtar={favEslesme(e.t.id, e.p.id)} />{!sec && <KoparDugmesi tid={e.t.id} pid={e.p.id} kucuk />}</div>
      </div>
      <Taraf k={e.t} ad="Talep" />
      <div className="es2-bag" aria-hidden="true"><span /></div>
      <Taraf k={e.p} ad="Portföy" />
      <div className="es2-neden">
        <span className="es2-n">{String(e.s.lokasyonAciklama).replace(/\s*\([+−-]?\d+\)/, "")}</span>
        {engel && <span className="es2-n kotu">Engel: {engel}</span>}
        {sorulacak.length > 0 && <span className="es2-n uyari">Sorulacak: {sorulacak.slice(0, 3).join(", ")}{sorulacak.length > 3 ? ` +${sorulacak.length - 3}` : ""}</span>}
        {/* v3.19 — eksik bilgi puanı düşürür; hangi bilgi eksik, kısaca */}
        {eksik.length > 0 && <span className="es2-n uyari" title="Bu bilgiler tamamlanınca puan netleşir">Eksik: {eksik.slice(0, 3).join(", ")}{eksik.length > 3 ? ` +${eksik.length - 3}` : ""}</span>}
      </div>
    </div>
  );
}

const ESNEKLIK: [string, string, string][] = [
  ["FIYAT", "Bütçeyi biraz aşan da gösterilsin", "Bütçe"],
  ["ALAN", "Biraz küçük / büyük de olur", "Alan"],
  ["LOKASYON", "Komşu bölgeler de olur", "Bölge"],
];

/** Talep detayındaki "Eşleştirme tercihleri" — eski Talep DNA kartının sade hali. Formül ve "varsayılan" etiketleri gösterilmez. */
export function TalepTercihleri({ k }: { k: Kayit }) {
  const { kayitKaydet } = useDepo();
  const v = k.veri;
  const dna = talepDnasi(v as any);
  const esnek: string[] = v.ozellik?.esnekKriterler ?? [];
  const sartlar = dna.kritik.filter((x: any) => x.kaynak !== "VARSAYILAN");
  const degis = (kod: string) => {
    const yeni = esnek.includes(kod) ? esnek.filter((x) => x !== kod) : [...esnek, kod];
    kayitKaydet({ ...k, veri: { ...v, ozellik: { ...(v.ozellik ?? {}), esnekKriterler: yeni, kritikKriterler: (v.ozellik?.kritikKriterler ?? []).filter((x: string) => !yeni.includes(x)) } as any } });
  };
  return (
    <section className="kart tercih-kart">
      <div className="satir-ara">
        <h3>Eşleştirme tercihleri</h3>
        <div className="pill-satir">
          {dna.aciliyet !== "NORMAL" && <Pill ton={dna.aciliyet === "DUSUK" ? "notr" : "kotu"}>{etiket(dna.aciliyet)}</Pill>}
          {dna.profiller.map((p: any) => <Pill key={p.kod} ton="mavi">{p.etiket}</Pill>)}
        </div>
      </div>
      {sartlar.length > 0 && (
        <div className="tercih-satir">
          <span className="tercih-et">Olmazsa olmaz</span>
          <div className="cip-satir">{sartlar.map((x: any) => <span key={x.kriter} className="cip c-kotu">{x.etiket}{x.deger ? `: ${x.deger}` : ""}</span>)}</div>
        </div>
      )}
      <div className="tercih-satir">
        <span className="tercih-et">Müşteri nerede esnek?</span>
        <div className="anahtarlar">
          {ESNEKLIK.map(([kod, etiket]) => (
            <label key={kod} className={"anahtar" + (esnek.includes(kod) ? " on" : "")}>
              <input type="checkbox" checked={esnek.includes(kod)} onChange={() => degis(kod)} />
              <span className="anahtar-iz" aria-hidden="true" />
              <span>{etiket}</span>
            </label>
          ))}
        </div>
      </div>
      <EksikUyarisi v={v} telefon={v.gondeTelefon} />
    </section>
  );
}