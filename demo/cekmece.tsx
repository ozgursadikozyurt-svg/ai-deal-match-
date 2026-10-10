/**
 * Anahtar CRM v3.24 · 10 Ekim 2026
 * Demo — kayıt detayının altındaki açılır çekmece: talebin içinden çıkmadan uygun portföyleri
 * (portföyün içindeyken uygun talepleri) filtreleyip incelemek ve eşleşmeye almak için.
 */
import React, { useMemo, useState } from "react";
import { eslesmeOnizle, temelUyum } from "../src/lib/eslestirme/onizleme";
import { aileOf, benzerAileler } from "../src/lib/domain/kategori";
import { etiket } from "./etiketler";
import { BAGLAM, INDEKS } from "./lokasyon";
import type { Kayit, PipelineDurum } from "./depo";
import { useDepo, cx, Pill, IslemPill, UYGUNLUK, Skor, baslikOf, fiyatOf, m2Of, oneCikanlar, lokEtiket, enumYaz, eKey, telYaz } from "./ortak";
import { KimPill, KoparDugmesi } from "./kopar";
import { FiltrePaneli, bosFiltre, filtreUygula, SiralaDugmesi, kayitSiralama, siralaUygula, type Filtre, type Siralama } from "./filtre";
import { HAVUZ_KATMANLARI, havuzKatmani } from "../src/lib/eslestirme/havuz";
import { portalLinkleri } from "../src/lib/portal/arama-linkleri";
import { Kopyala } from "./ortak";

function baslangicFiltresi(k: Kayit): Filtre {
  const v = k.veri;
  const aileler = [...new Set([v.mulkTipi, ...(v.alternatifMulkTipleri ?? [])].map((t) => aileOf(t as any).kod))];
  const konumlar = v.tip === "TALEP" ? v.lokasyonlar.filter((l) => l.ilceId).map((l) => {
    const ad = l.altBolgeId ? INDEKS.altBolgeler.find((b) => b.id === l.altBolgeId)?.ad : l.mahalleId ? INDEKS.mahalleler.find((m) => m.id === l.mahalleId)?.ad : INDEKS.ilceler.find((i) => i.id === l.ilceId)?.ad;
    return { anahtar: l.altBolgeId ? `a:${l.altBolgeId}` : l.mahalleId ? `m:${l.mahalleId}` : `i:${l.ilceId}`, etiket: ad ?? lokEtiket(l), alt: "", tur: "ILCE" as const, lok: { ilId: l.ilId ?? 7, ilceId: l.ilceId ?? null, mahalleId: l.mahalleId ?? null, altBolgeId: l.altBolgeId ?? null } };
  }) : [];
  return bosFiltre({ aileler, islemler: [v.islemTipi], konumlar, durumlar: ["ACTIVE"] });
}

/** WhatsApp gruplarına atılacak talep metni */
function talepMesaji(k: Kayit): string {
  const v = k.veri;
  return [`🔎 TALEP: ${etiket(v.mulkTipi)} · ${etiket(v.islemTipi)}`, v.lokasyonlar.length ? `📍 ${v.lokasyonlar.map(lokEtiket).join(", ")}` : null, (v.minM2 || v.maxM2) ? `📐 ${m2Of(v)}` : null, v.maxFiyat ? `💰 ${fiyatOf(v)}` : null, oneCikanlar(v).length ? `⚙️ ${oneCikanlar(v).join(", ")}` : null, "Uygun portföyü olan meslektaşlar yazabilir, ortak çalışırız."].filter(Boolean).join("\n");
}
export function EslesmeCekmecesi({ k }: { k: Kayit }) {
  const { d, guncelle, git, bildir } = useDepo();
  const talep = k.veri.tip === "TALEP";
  const [acik, setAcik] = useState(false);
  const [f, setF] = useState<Filtre>(() => baslangicFiltresi(k));
  const [sadeceUygun, setSadeceUygun] = useState(true);
  const [genis, setGenis] = useState<string | null>(null);
  const karsi = d.kayitlar.filter((x) => x.veri.tip === (talep ? "PORTFOY" : "TALEP"));
  const kisiAd = (id: string) => d.kisiler.find((x) => x.id === id)?.adSoyad ?? "";
  const [sr, setSr] = useState<Siralama>({ alan: "skor", yon: "azalan" });
  const secenek = [{ alan: "skor", etiket: "Skor", deger: (r: any) => (r.uyum ? r.s.skor : -1), varsayilanYon: "azalan" as const }, ...kayitSiralama(talep ? "PORTFOY" : "TALEP").map((o) => ({ ...o, deger: (r: any) => o.deger(r.x) }))];
  const satirlar0 = useMemo(() => karsi.filter((x) => filtreUygula(x.veri, f, kisiAd)).map((x) => {
    const t = talep ? k : x, p = talep ? x : k;
    const uyum = temelUyum(t.veri as any, p.veri as any);
    return { x, t, p, uyum, s: eslesmeOnizle(t.veri as any, p.veri as any, BAGLAM) };
  }).filter((r) => !sadeceUygun || (r.uyum && r.s.uygunluk !== "UYGUN_DEGIL")).sort((a, b) => Number(b.uyum) - Number(a.uyum) || b.s.skor - a.s.skor), [karsi, f, sadeceUygun, k]);
  const [kopukGoster, setKopukGoster] = useState(false);
  const kopuk = (r: { t: Kayit; p: Kayit }) => d.eslesmeNotlari[eKey(r.t.id, r.p.id)]?.durum === "REDDEDILDI";
  const kopukSayi = satirlar0.filter(kopuk).length;
  const satirlar = siralaUygula(satirlar0.filter((r) => kopukGoster || !kopuk(r)), sr, secenek);
  const uygunSayi = karsi.filter((x) => x.veri.durum === "ACTIVE").filter((x) => { const t = talep ? k : x, p = talep ? x : k; return temelUyum(t.veri as any, p.veri as any) && eslesmeOnizle(t.veri as any, p.veri as any, BAGLAM).uygunluk !== "UYGUN_DEGIL"; }).length;
  const takipte = (tid: string, pid: string) => { const n = d.eslesmeNotlari[eKey(tid, pid)]; return !!n && n.durum !== "YENI" && n.durum !== "REDDEDILDI"; };
  const takipDegis = (tid: string, pid: string, v: boolean) => {
    guncelle((dd) => ({ ...dd, eslesmeNotlari: { ...dd.eslesmeNotlari, [eKey(tid, pid)]: { durum: (v ? "BILDIRILDI" : "YENI") as PipelineDurum, not: dd.eslesmeNotlari[eKey(tid, pid)]?.not ?? "" } } }));
    bildir(v ? "Eşleşmeye alındı (Bildirildi)" : "Eşleşmeden çıkarıldı");
  };
  return <>
    <div className="cekmece-tutamak"><button className="btn birincil genis-btn" onClick={() => setAcik(true)}>{talep ? "Uygun portföyleri incele" : "Uygun talepleri incele"} ({uygunSayi})</button></div>
    {acik && <div className="cekmece-perde" onClick={() => setAcik(false)}>
      <div className="cekmece" role="dialog" aria-label={talep ? "Uygun portföyler" : "Uygun talepler"} onClick={(e) => e.stopPropagation()}>
        <div className="cekmece-bas">
          <div><div className="ust-etiket">{talep ? "Bu talep için portföyler" : "Bu portföy için talepler"}</div><b>{baslikOf(k.veri)}</b></div>
          <button className="btn kucuk" onClick={() => setAcik(false)}>Kapat</button>
        </div>
        <FiltrePaneli f={f} set={setF} ogeler={karsi.map((x) => x.veri)} gizle={["kanal"]} yerTutucu={talep ? "Portföylerde ara…" : "Taleplerde ara…"} sirala={<SiralaDugmesi secenekler={secenek} s={sr} set={setSr} />} />
        <div className="satir sar"><label className="onay-satir"><input type="checkbox" checked={sadeceUygun} onChange={(e) => setSadeceUygun(e.target.checked)} /> Yalnızca uygun olanlar</label><span className="ipucu">{satirlar.length} sonuç</span>
          {kopukSayi > 0 && <label className="onay-satir"><input type="checkbox" checked={kopukGoster} onChange={(e) => setKopukGoster(e.target.checked)} /> Koparılanları göster ({kopukSayi})</label>}
          {talep && benzerAileler(aileOf(k.veri.mulkTipi as any).kod).length > 0 && <button className="btn kucuk" onClick={() => setF({ ...f, aileler: [...new Set([...f.aileler, ...benzerAileler(aileOf(k.veri.mulkTipi as any).kod).map((b) => b.aile.kod)])] })}>Benzer tipleri de göster</button>}
        </div>
        <div className="cekmece-liste">
          {(talep ? HAVUZ_KATMANLARI : [null]).map((kat) => { const grup = satirlar.filter((r) => !kat || havuzKatmani(r.x.veri as any) === kat.kod); if (!grup.length) return null; return <React.Fragment key={kat?.kod ?? "hepsi"}>
          {kat && <div className="havuz-baslik"><span className={"pill havuz-" + kat.kod.toLowerCase()}>{kat.sira}· {kat.etiket}</span><span className="ipucu">{kat.aciklama} · {grup.length}</span></div>}
          {grup.map(({ x, t, p, uyum, s }) => { const ac = genis === x.id; const tk = takipte(t.id, p.id); const u = UYGUNLUK[s.uygunluk]; return <div key={x.id} className={cx("kart cekmece-satir", tk && "takipte")}>
            <div className="cs-bas">
              <label className="eslesme-kutu" title="Eşleşmeye al"><input type="checkbox" checked={tk} onChange={(e) => takipDegis(t.id, p.id, e.target.checked)} /><span>Eşleştir</span></label>
              <Skor s={uyum ? s.skor : 0} u={uyum ? s.uygunluk : "UYGUN_DEGIL"} />
              <button className="cs-govde" onClick={() => setGenis(ac ? null : x.id)} aria-expanded={ac}>
                <div className="pill-satir"><Pill ton={uyum ? u.ton : "kotu"}>{uyum ? u.e : "Tip uyumsuz"}</Pill><Pill>{etiket(x.veri.mulkTipi)}</Pill><IslemPill islem={x.veri.islemTipi} />{s.tipUyumu.oran < 0.9 && uyum && <Pill ton="uyari">benzer tip</Pill>}</div>
                <div className="kk-baslik">{baslikOf(x.veri)}</div>
                <div className="pill-satir"><KimPill v={x.veri} /></div>
                <div className="kk-alt">{x.veri.lokasyonlar.map(lokEtiket).join(" · ")} · {fiyatOf(x.veri)}{m2Of(x.veri) ? " · " + m2Of(x.veri) : ""}</div>
                <div className="kk-alt">{s.lokasyonAciklama}{s.kritikEngeller.length ? ` · Engel: ${s.kritikEngeller.join(", ")}` : ""}</div>
              </button>
              <KoparDugmesi tid={t.id} pid={p.id} kucuk />
            </div>
            {ac && <div className="cs-detay">
              {oneCikanlar(x.veri).length > 0 && <div className="cip-satir">{oneCikanlar(x.veri).map((c) => <span key={c} className="cip">{c}</span>)}</div>}
              {s.kriterler.length > 0 && <div className="tablo-sar"><table><thead><tr><th>Kriter</th><th>İstenen</th><th>{talep ? "Portföyde" : "Portföyde (bu kayıt)"}</th><th>Sonuç</th></tr></thead>
                <tbody>{s.kriterler.map((c) => <tr key={c.anahtar} className={"r-" + c.sonuc}><td>{c.etiket}{c.kritik && <span className="kritik-rozet">şart</span>}</td><td>{enumYaz(c.talep)}</td><td>{enumYaz(c.portfoy)}</td><td className="sonuc">{c.sonuc === "SAGLANDI" ? "✓" : c.sonuc === "SAGLANMADI" ? "✗" : "?"}</td></tr>)}</tbody></table></div>}
              {x.veri.hamMetin && <div className="wa-balon"><div className="wa-metin">{x.veri.hamMetin}</div></div>}
              <div className="kk-alt">{(x.veri.kisiler ?? []).map((b) => d.kisiler.find((y) => y.id === b.kisiId)).filter(Boolean).map((y) => `${y!.adSoyad}${y!.telefon ? " · " + telYaz(y!.telefon) : ""}`).join(" / ")}</div>
              <div className="satir sar"><button className="btn kucuk" onClick={() => git({ ad: "eslesme", tid: t.id, pid: p.id })}>Eşleşme ayrıntısı</button><button className="btn kucuk" onClick={() => git({ ad: "detay", id: x.id })}>{talep ? "Portföye git" : "Talebe git"}</button></div>
            </div>}
          </div>; })}
          </React.Fragment>; })}
          {talep && !satirlar.some((r) => r.uyum && r.s.uygunluk === "SUNULABILIR") && <div className="kart havuz-son">
            <div className="havuz-baslik"><span className="pill">5· Havuzda yoksa</span><span className="ipucu">Yeni portföy fırsatı</span></div>
            <div className="portal-linkleri">{portalLinkleri({ aileKodu: aileOf(k.veri.mulkTipi as any).kod, islemTipi: k.veri.islemTipi, ilceler: [...new Set(k.veri.lokasyonlar.map((l) => INDEKS.ilceler.find((i) => i.id === l.ilceId)?.ad).filter(Boolean) as string[])], maxFiyat: k.veri.maxFiyat, minFiyat: k.veri.minFiyat }).slice(0, 3).map((l) => <a key={l.url} className={"portal-link pl-" + l.portal} href={l.url} target="_blank" rel="noreferrer"><b>{l.portal}</b><span>{l.etiket}</span></a>)}</div>
            <div className="satir sar"><Kopyala metin={talepMesaji(k)} etiketi="Gruplara talep mesajını kopyala" /></div>
          </div>}
          {!satirlar.length && <p className="bos">Bu filtrede sonuç yok. Filtreleri gevşetin ya da “Yalnızca uygun olanlar”ı kapatın.</p>}
        </div>
      </div>
    </div>}
  </>;
}