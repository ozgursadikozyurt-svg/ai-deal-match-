/**
 * Anahtar CRM v3.43 · 25 Ekim 2026
 * Demo — eşleşme kartı, eşleştirme tercihleri (eski "Talep DNA" kartı), kapatılabilir bilgi kutusu.
 */
import React, { useState } from "react";
import { talepDnasi } from "../src/lib/eslestirme/talep-dna";
import { kopmaEtiket } from "../src/lib/eslestirme/kopar";
import { etiket } from "./etiketler";
import { useDepo, Pill, IslemPill, UYGUNLUK, SEVIYE_TON, seviyeBaslik, Gerekceler, baslikOf, fiyatOf, m2Of, lokEtiket, eKey, IlanNoCip, type Eslesme } from "./ortak";
import { SEVIYE_ETIKET } from "../src/lib/eslestirme/onizleme";
import { konumOzeti } from "./lokasyon";
import { useSahiplik, SahiplikRozeti } from "./sahiplik";
import { KapakKucuk } from "./fotograflar";
import { EksikUyarisi } from "./motor-ui";
import { AnahtarDugmesi, favEslesme } from "./favori";
import { KimPill, KoparDugmesi } from "./kopar";
import type { Kayit, PipelineDurum } from "./depo";
import { MULK_OZELLIK_META, istenenKatlarOf, katUyumu, katYaz } from "../src/lib/domain/teknik-alanlar";
import { kalanGun } from "./depo";

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
/** v3.43 — "3 gün önce" / "Bugün": kartta son hareketin tazeliği */
export const gunOnce = (t: string) => {
  const g = Math.floor((Date.now() - new Date(t).getTime()) / 86400000);
  return !Number.isFinite(g) || g < 0 ? "" : g === 0 ? "Bugün" : g === 1 ? "Dün" : g < 30 ? `${g} gün önce` : g < 365 ? `${Math.floor(g / 30)} ay önce` : `${Math.floor(g / 365)} yıl önce`;
};
const kisaTl = (n: number) => (n >= 1_000_000 ? (n / 1_000_000).toLocaleString("tr-TR", { maximumFractionDigits: 1 }) + " mn" : n >= 1000 ? Math.round(n / 1000).toLocaleString("tr-TR") + " bin" : String(n)) + " ₺";

/**
 * v3.27 — HIZLI CEVAP: talepte istenen ama portföyde bilinmeyen evet/hayır özellik (ofis, rampa, TIR girişi…) için
 * küçük "Var / Yok" düğmeleri. Mal sahibini arayıp öğrenince tek dokunuşla portföye yazılır; o portföy tüm taleplerde
 * doğru sıraya oturur. Ayrı satır açmaz, kartın "neden" satırındaki çipin içinde durur.
 */
export function cevaplanabilirler(e: Eslesme) {
  return e.s.kriterler.filter((k) => k.sonuc === "BILINMIYOR" && (MULK_OZELLIK_META as any)[k.anahtar]?.karsilastirma === "bool");
}
export function HizliCevaplar({ e }: { e: Eslesme }) {
  const { d, kayitKaydet, bildir } = useDepo();
  const alanlar = cevaplanabilirler(e);
  if (!alanlar.length) return null;
  const durdur = (ev: React.SyntheticEvent) => ev.stopPropagation();
  const yaz = (ev: React.MouseEvent, anahtar: string, ad: string, deger: boolean) => {
    ev.stopPropagation();
    const p = d.kayitlar.find((x) => x.id === e.p.id) ?? e.p;
    kayitKaydet({ ...p, veri: { ...p.veri, ozellik: { ...((p.veri.ozellik ?? {}) as Record<string, unknown>), [anahtar]: deger } } as any });
    bildir(`${ad}: ${deger ? "var" : "yok"} — portföye kaydedildi`);
  };
  return <>{alanlar.map((k) => <span key={k.anahtar} className="hc" onClick={durdur} onKeyDown={durdur}>
    <span className="hc-ad">{k.etiket}?</span>
    <button type="button" className="hc-b var" aria-label={`${k.etiket}: var`} onClick={(ev) => yaz(ev, k.anahtar, k.etiket, true)}>Var</button>
    <button type="button" className="hc-b yok" aria-label={`${k.etiket}: yok`} onClick={(ev) => yaz(ev, k.anahtar, k.etiket, false)}>Yok</button>
  </span>)}</>;
}

/**
 * v3.43 — KIYAS ŞERİDİ: kartın asıl sorusu "bu mülk bu talebe ne kadar uyuyor?". Eskiden bütçe ile fiyat,
 * istenen m² ile mülkün m²'si iki ayrı blokta duruyordu; farkı kullanıcı kafadan hesaplıyordu. Artık
 * belirleyici ölçütler (bütçe · alan · oda · kat) yan yana ve farkı yazılı olarak gösterilir.
 */
const yuzde = (a: number, b: number) => Math.round(Math.abs((a - b) / b) * 100);
interface Kiyas { ad: string; ist: string; var: string; not?: string; ton?: "iyi" | "uyari" | "kotu" }
export function kiyaslar(e: Eslesme): Kiyas[] {
  const t = e.t.veri as any, p = e.p.veri as any, l: Kiyas[] = [];
  const to = (t.ozellik ?? {}) as any, po = (p.ozellik ?? {}) as any;
  // Bütçe ↔ fiyat
  const fiyat = p.fiyat ?? null, enAz = t.minFiyat ?? null, enCok = t.maxFiyat ?? null;
  if (fiyat != null) {
    const ist = enCok != null ? (enAz != null && enAz !== enCok ? `${kisaTl(enAz)} – ${kisaTl(enCok)}` : `≤ ${kisaTl(enCok)}`) : "Bütçe yazılmamış";
    const k: Kiyas = { ad: "Bütçe", ist, var: kisaTl(fiyat) };
    if (enCok == null) { k.not = "karşılaştırılamıyor"; k.ton = "uyari"; }
    else if (fiyat <= enCok) { k.not = "bütçe içinde"; k.ton = "iyi"; }
    else { const y = yuzde(fiyat, enCok); k.not = `%${y} üstünde`; k.ton = y <= 10 ? "uyari" : "kotu"; }
    l.push(k);
  }
  // İstenen alan ↔ mülkün alanı
  const m2 = p.m2 ?? po.kapaliAlanM2 ?? po.arsaAlanM2 ?? null;
  const aAz = t.minM2 ?? null, aCok = t.maxM2 ?? null;
  if (m2 != null && (aAz != null || aCok != null)) {
    const n = (x: number) => x.toLocaleString("tr-TR");
    const k: Kiyas = { ad: "Alan", ist: `${aAz != null ? n(aAz) : "…"}–${aCok != null ? n(aCok) : "…"} m²`, var: `${n(m2)} m²` };
    if (aAz != null && m2 < aAz) { const y = yuzde(m2, aAz); k.not = `%${y} küçük`; k.ton = y <= 15 ? "uyari" : "kotu"; }
    else if (aCok != null && m2 > aCok) { const y = yuzde(m2, aCok); k.not = `%${y} büyük`; k.ton = y <= 25 ? "uyari" : "kotu"; }
    else { k.not = "aralıkta"; k.ton = "iyi"; }
    l.push(k);
  }
  // Oda (konut) — talep birden çok oda isteyebilir
  if (t.odaSayisi && p.odaSayisi) {
    const istenen = String(t.odaSayisi).split(/[,/]/).map((x: string) => x.trim()).filter(Boolean);
    const tutar = istenen.includes(String(p.odaSayisi).trim());
    l.push({ ad: "Oda", ist: istenen.join(" / "), var: String(p.odaSayisi), not: tutar ? "istenen oda" : "farklı", ton: tutar ? "iyi" : "uyari" });
  }
  // Kat (talepte istenen katlar varsa)
  const istKat = istenenKatlarOf(to);
  if (istKat.length && po.bulunduguKat) {
    const sonuc = katUyumu(istKat, po.bulunduguKat, po.katSayisi);
    l.push({ ad: "Kat", ist: katYaz(istKat), var: katYaz([po.bulunduguKat]), not: sonuc === "SAGLANDI" ? "istenen kat" : sonuc === "BILINMIYOR" ? "belirsiz" : "istenen kat değil", ton: sonuc === "SAGLANDI" ? "iyi" : sonuc === "BILINMIYOR" ? "uyari" : "kotu" });
  }
  return l;
}
function KiyasSeridi({ e }: { e: Eslesme }) {
  const l = kiyaslar(e);
  if (!l.length) return null;
  return <div className="es2-kiyas" aria-label="Talep ile portföyün karşılaştırması">
    {l.map((k) => <div key={k.ad} className={"ek-satir" + (k.ton ? " t-" + k.ton : "")}>
      <span className="ek-ad">{k.ad}</span>
      <span className="ek-ist" title="Müşterinin istediği">{k.ist}</span>
      <span className="ek-ok" aria-hidden="true">→</span>
      <span className="ek-var" title="Portföyde olan">{k.var}</span>
      {k.not && <span className="ek-not">{k.not}</span>}
    </div>)}
  </div>;
}

/**
 * Eşleşme kartı (v3.19 sadeleştirildi): üstte skor + uygunluk + fırsat; işlem (Satılık/Kiralık) ve mülk tipi bir kez yazılır.
 * Taraflarda yalnızca kim olduğu (rol), başlık, konum ve fiyat görünür. "Web ilanı" gibi katman etiketleri kim etiketinde zaten var.
 */
export function EslesmeKarti({ e, sec }: { e: Eslesme; sec?: { acik: boolean; degis: () => void } }) {
  const { git, d } = useDepo();
  const not = d.eslesmeNotlari[eKey(e.t.id, e.p.id)];
  const u = UYGUNLUK[e.s.uygunluk as keyof typeof UYGUNLUK];
  const kopuk = not?.durum === "REDDEDILDI";
  const sahip = useSahiplik(); // v3.22 — ★ Benim / ◆ Ofisim
  const ac = () => git({ ad: "eslesme", tid: e.t.id, pid: e.p.id });
  const konum = (v: any) => konumOzeti(v.lokasyonlar ?? [], 2); // v3.22: "Konyaaltı (Hurma, Sarısu hariç)"
  const Taraf = ({ k, ad }: { k: any; ad: "Talep" | "Portföy" }) => {
    const talep = ad === "Talep";
    // v3.43 — talebin kalan süresi ve aciliyeti kartta görünür: sırayı belirleyen asıl şey çoğu zaman bu
    const gun = talep ? kalanGun(k.veri) : null;
    const acil = talep && (k.veri.aciliyet === "ACIL" || k.veri.aciliyet === "YUKSEK");
    return (
      <div className={"es2-taraf " + (talep ? "t" : "p")}>
        <div className="es2-et">
          <span>{ad}</span><i className="es2-et-alt">{talep ? "müşteri istiyor" : "önerilen mülk"}</i>
          <SahiplikRozeti s={sahip(k.veri).tur} /><KimPill v={k.veri} />
          {acil && <Pill ton="kotu">{etiket(k.veri.aciliyet)}</Pill>}
          {!talep && e.s.tipUyumu.oran < 0.9 && <span className="benzer-rozet">benzer tip</span>}
        </div>
        <div className={"es2-bas" + (!talep && (k.fotolar?.length ?? 0) > 0 ? " fotolu" : "")}>
          {!talep && <KapakKucuk k={k} boyut={52} />}
          <b>{baslikOf(k.veri)}</b>
          <span className="es2-rakam">{fiyatOf(k.veri)}</span>
        </div>
        <div className="es2-alt">
          {konum(k.veri) && <span>{konum(k.veri)}</span>}
          {m2Of(k.veri) && <span>{m2Of(k.veri)}</span>}
          {gun != null && gun <= 21 && <span className={"es2-sure" + (gun <= 3 ? " acil" : "")}>{gun <= 0 ? "Süresi doldu" : `${gun} gün kaldı`}</span>}
          <IlanNoCip v={k.veri} />
        </div>
      </div>
    );
  };
  const engel = e.s.kritikEngeller.length ? e.s.kritikEngeller.join(", ") : null;
  // v3.27 — Var / Yok ile cevaplanabilenler düğme olarak çıkar, metin listesinde tekrar yazılmaz
  const dugmeli = new Set(cevaplanabilirler(e).map((k) => k.etiket));
  const sorulacak = !engel ? [...e.s.bilinmeyenKritikler.filter((x: string) => !dugmeli.has(x)), ...e.s.talepEksikleri.map((x: string) => x + " (müşteriye)")] : [];
  const eksik = (e.s.veriEksikleri ?? []) as string[];
  return (
    <div className={"es2 s-" + u.ton + (kopuk ? " soluk" : "") + (sec?.acik ? " secili" : "")} role="button" tabIndex={0} onClick={sec ? sec.degis : ac} onKeyDown={(ev: any) => { if (ev.key === "Enter") (sec ? sec.degis : ac)(); }}>
      <div className="es2-ust">
        {sec && <input type="checkbox" className="es2-sec" checked={sec.acik} aria-label="Eşleşmeyi seç" onClick={(ev) => ev.stopPropagation()} onChange={sec.degis} />}
        <div className={"es2-skor s-" + SEVIYE_TON[e.s.seviye]} title={seviyeBaslik(e.s.seviye)}><b>{e.s.seviye}</b><small>/5</small></div>
        <div className="es2-durum">
          <div className="es2-satir1">
            <span className={"es2-uygun s-" + SEVIYE_TON[e.s.seviye]}>{SEVIYE_ETIKET[e.s.seviye]}</span>
            <FirsatRozeti f={e.f} komisyon />
          </div>
          <div className="pill-satir">
            <IslemPill islem={e.p.veri.islemTipi} /><Pill>{etiket(e.p.veri.mulkTipi)}</Pill>
            {not && not.durum !== "YENI" && !kopuk && <Pill ton="mavi">{PIPELINE.find((x: any) => x[0] === not.durum)?.[1]}</Pill>}
            {not?.tarih && <Pill><span title={"Son hareket: " + new Date(not.tarih).toLocaleString("tr-TR", { dateStyle: "medium" })}>{gunOnce(not.tarih)}</span></Pill>}
            {e.s.guven?.seviye === "DUSUK" && <Pill ton="uyari"><span title={e.s.guven.aciklama}>Az veri · {e.s.guven.olculen}/{e.s.guven.toplam}</span></Pill>}
            {(e.kopyalar?.length ?? 0) > 0 && <Pill><span title="Aynı ilan başka kaynaktan da girilmiş">+{e.kopyalar!.length} aynı ilan</span></Pill>}
            {kopuk && <Pill ton="kotu">{kopmaEtiket(not?.neden)}</Pill>}
          </div>
        </div>
        <div className="es-aksiyon"><AnahtarDugmesi anahtar={favEslesme(e.t.id, e.p.id)} />{!sec && <KoparDugmesi tid={e.t.id} pid={e.p.id} kucuk />}</div>
      </div>
      <Taraf k={e.t} ad="Talep" />
      <div className="es2-bag" aria-hidden="true"><span /></div>
      <Taraf k={e.p} ad="Portföy" />
      <KiyasSeridi e={e} />
      <div className="es2-neden">
        <span className="es2-n">{String(e.s.lokasyonAciklama).replace(/\s*\([+−-]?\d+\)/, "")}</span>
        {/* v3.36 — seviyeyi en çok düşüren neden (konum zaten yukarıda yazıyor) */}
        {!engel && e.s.seviye < 5 && (() => { const n = (e.s.gerekceler ?? []).find((x: string) => x !== e.s.lokasyonAciklama && !(e.s.uyarilar ?? []).includes(x)); return n ? <span className="es2-n">Neden {e.s.seviye}/5: {n}</span> : null; })()}
        {engel && <span className="es2-n kotu">Engel: {engel}</span>}
        {(e.s.uyarilar ?? []).map((x: string) => <span key={x} className="es2-n uyari">Kontrol: {x}</span>)}
        {/* v3.43 — "Not var" yerine notun kendisi: kartı açmadan nerede kalındığı görünsün */}
        {not?.not && <span className="es2-n not" title={not.not}>Not: {not.not.length > 90 ? not.not.slice(0, 90) + "…" : not.not}</span>}
        {!engel && <HizliCevaplar e={e} />}
        {sorulacak.length > 0 && <span className="es2-n uyari">Sorulacak: {sorulacak.slice(0, 3).join(", ")}{sorulacak.length > 3 ? ` +${sorulacak.length - 3}` : ""}</span>}
        {/* v3.19 — eksik bilgi puanı düşürür; hangi bilgi eksik, kısaca */}
        {eksik.length > 0 && <span className="es2-n uyari" title="Bu bilgiler tamamlanınca puan netleşir">Eksik bilgi: {eksik.slice(0, 3).join(" · ")}{eksik.length > 3 ? ` · +${eksik.length - 3} bilgi daha` : ""}</span>}
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