/**
 * Anahtar CRM v3.21.2 · 8 Ekim 2026
 * Demo — Konumlar ekranı: konum öğrenme (tanınmayan ifadeler → öneri → onay → sözlük), öğrenilenler, canlı çözücü.
 * Çekirdek mantık src/lib/lokasyon/ogrenme.ts'te; bu dosya yalnızca ekran.
 */
import React, { useMemo, useState } from "react";
import { adayOnerisi, aliasTipiTahmin, type KonumAdayi } from "../src/lib/lokasyon/ogrenme";
import { lokasyonAnahtari } from "../src/lib/lokasyon/normalize";
import { coz, SEED_ALIASLAR, lokEtiket, INDEKS, calismaIliOku, type Alias, type KonumOnerisi } from "./lokasyon";
import { useDepo, Pill, KonumSecici, cx, aiJson, type Ctx } from "./ortak";
import type { DepoDurumu } from "./depo";

/** İfadeyi sözlüğe ekler (öğrenilen alias) ve adayı onaylandı yapar */
export function konumOgret(guncelle: Ctx["guncelle"], ifadeHam: string, hedef: { ilceId: number | null; mahalleId: number | null; altBolgeId: number | null }, gorunen = ifadeHam) {
  const ifade = lokasyonAnahtari(ifadeHam);
  const tip = aliasTipiTahmin(ifade);
  const alias: Alias = { ilId: calismaIliOku(), alias: ifade, seviye: hedef.mahalleId ? "MAHALLE" : hedef.altBolgeId ? "ALTBOLGE" : "ILCE", ilceId: hedef.ilceId, mahalleId: hedef.mahalleId, altBolgeId: hedef.altBolgeId, tip, aciklama: tip === "REFERANS_NOKTA" ? `${gorunen} çevresi` : null };
  guncelle((d: DepoDurumu) => ({
    ...d,
    ogrenilen: [alias, ...d.ogrenilen.filter((a) => a.alias !== ifade)],
    adaylar: d.adaylar.map((a) => (a.ifade === ifade ? { ...a, durum: "ONAYLANDI" as const } : a)),
  }));
}
const hedefOf = (anahtar: string) => {
  const [t, id] = anahtar.split(":"); const n = Number(id);
  if (t === "m") { const m = INDEKS.mahalleler.find((x) => x.id === n)!; return { ilceId: m.ilceId, mahalleId: n, altBolgeId: null }; }
  if (t === "a") { const b = INDEKS.altBolgeler.find((x) => x.id === n)!; return { ilceId: b.ilceId, mahalleId: null, altBolgeId: n }; }
  return { ilceId: n, mahalleId: null, altBolgeId: null };
};

function AdaySatiri({ a }: { a: KonumAdayi }) {
  const { guncelle, bildir, sample } = useDepo();
  const [secAcik, setSecAcik] = useState(false);
  const [ai, setAi] = useState<{ durum: "yok" | "soruluyor" | "bitti" | "hata"; metin?: string; oneri?: KonumOnerisi }>({ durum: "yok" });
  const o = adayOnerisi(a);
  const onayla = (h: { ilceId: number | null; mahalleId: number | null; altBolgeId: number | null }, etiket: string) => { konumOgret(guncelle, a.ifade, h, a.gorunen); bildir(`Öğrenildi: “${a.gorunen}” → ${etiket}`); };
  async function aiSor() {
    if (!sample) return;
    setAi({ durum: "soruluyor" });
    try {
      const r = await aiJson(sample, `Antalya'da gayrimenkul mesajlarında geçen "${a.gorunen}" ifadesi hangi ilçe ve mahalleye denk gelir? Örnek kullanım: "${a.ornekMetin ?? ""}". Bilmiyorsan uydurma, "emin_degilim": true döndür. Yalnızca JSON: {"ilce":"...","mahalle":"... veya null","aciklama":"en fazla 1 cümle","emin_degilim":false}`, { modelTier: "default" });
      if (r?.emin_degilim || !r?.ilce) { setAi({ durum: "bitti", metin: "Yapay zekâ emin değil. Konumu siz seçin." }); return; }
      const aday = coz(`${r.ilce}${r.mahalle ? " " + r.mahalle : ""}`).lokasyonlar.at(-1);
      if (!aday) { setAi({ durum: "bitti", metin: `Önerdiği yer (${r.ilce}${r.mahalle ? " / " + r.mahalle : ""}) listede bulunamadı.` }); return; }
      setAi({ durum: "bitti", metin: r.aciklama, oneri: { anahtar: aday.mahalleId ? `m:${aday.mahalleId}` : aday.altBolgeId ? `a:${aday.altBolgeId}` : `i:${aday.ilceId}`, etiket: aday.etiket, alt: "Yapay zekâ önerisi", tur: "MAHALLE", lok: { ilId: 7, ilceId: aday.ilceId, mahalleId: aday.mahalleId, altBolgeId: aday.altBolgeId } } });
    } catch (e: any) { setAi({ durum: "hata", metin: e?.code === "not_granted" ? "Yapay zekâya izin verilmedi." : "Yapay zekâ yanıt veremedi." }); }
  }
  return <div className="kart aday">
    <div className="satir-ara"><div><b>“{a.gorunen}”</b> <span className="ipucu">{a.gorulme} kez görüldü</span></div>
      <Pill ton={aliasTipiTahmin(a.ifade) === "REFERANS_NOKTA" ? "mavi" : "notr"}>{aliasTipiTahmin(a.ifade) === "REFERANS_NOKTA" ? "Referans nokta" : "Yer adı / yazım"}</Pill></div>
    {a.ornekMetin && <p className="ipucu alinti">“{a.ornekMetin}”</p>}
    {o ? <div className={cx("oneri-kutu", o.guclu && "guclu")}>
      <span>{o.guclu ? "Güçlü öneri" : "Olası"}: <b>{o.etiket}</b> — {o.sayi} kayıtta birlikte geçti (%{Math.round(o.oran * 100)})</span>
      <button className="btn kucuk birincil" onClick={() => onayla(hedefOf(o.anahtar), o.etiket)}>Onayla</button>
    </div> : <p className="ipucu">Henüz birlikte geçtiği bir konum yok.</p>}
    {ai.durum !== "yok" && <div className="bilgi-kutu">{ai.durum === "soruluyor" ? "Yapay zekâya soruluyor…" : ai.metin}{ai.oneri && <> <b>{ai.oneri.etiket}</b> <button className="btn kucuk" onClick={() => onayla(ai.oneri!.lok, ai.oneri!.etiket)}>Bunu onayla</button></>}</div>}
    <div className="satir sar">
      <button className="btn kucuk" onClick={() => setSecAcik(!secAcik)}>Yerini ben seçeyim</button>
      {sample && <button className="btn kucuk" onClick={aiSor} disabled={ai.durum === "soruluyor"}>Yapay zekâya sor</button>}
      <button className="btn kucuk" onClick={() => { guncelle((d) => ({ ...d, adaylar: d.adaylar.map((x) => (x.ifade === a.ifade ? { ...x, durum: "REDDEDILDI" as const } : x)) })); bildir("Yok sayıldı"); }}>Yok say</button>
    </div>
    {secAcik && <KonumSecici otoOdak placeholder={`“${a.gorunen}” nereye yakın? Mahalle / bölge yazın`} onSec={(s) => onayla(s.lok, s.etiket)} />}
  </div>;
}

export function Konumlar() {
  const { d, guncelle, bildir } = useDepo();
  const [metin, setMetin] = useState("Cender otel arkası, Kepez Yeni Sanayi, Konyaaltı Hurma, havalimanı yakını, Murtpaşa");
  const r = useMemo(() => coz(metin), [metin, d.ogrenilen]);
  const bekleyen = d.adaylar.filter((a) => a.durum === "BEKLIYOR").sort((a, b) => (adayOnerisi(b)?.guclu ? 1 : 0) - (adayOnerisi(a)?.guclu ? 1 : 0) || b.gorulme - a.gorulme);
  const referanslar = SEED_ALIASLAR.filter((a) => a.tip === "REFERANS_NOKTA");
  const SEV: Record<string, string> = { IL: "İl", ILCE: "İlçe", MAHALLE: "Mahalle", ALTBOLGE: "Alt bölge" };
  return <div className="yigin">
    <h2>Konumlar</h2>

    <section>
      <div className="bolum-bas"><h3>Öğrenme bekleyenler ({bekleyen.length})</h3></div>
      {bekleyen.map((a) => <AdaySatiri key={a.ifade} a={a} />)}
      {!bekleyen.length && <p className="bos">Bekleyen ifade yok. WhatsApp içe aktarma ya da formda “tanınmadı” çıkan ifadeler buraya düşer.</p>}
    </section>

    <section className="kart">
      <h3>Konum çözücü</h3>
      <p className="ipucu">Mesajdaki bölge ifadelerini yazın, sistemin nasıl anladığını görün.</p>
      <textarea id="t-lok" rows={2} value={metin} onChange={(e) => setMetin(e.target.value)} />
      <div className="yigin kucuk-bosluk">
        {r.lokasyonlar.map((l, i) => <div key={i} className="lok-sonuc"><Pill ton={l.seviye === "ALTBOLGE" ? "uyari" : "iyi"}>{SEV[l.seviye]}</Pill><b>{l.etiket}</b><span className="ipucu">“{l.kaynakIfade}”{l.guven < 1 ? ` · yazım farkı, güven ${l.guven.toFixed(2)}` : ""}{l.belirsiz ? ` · belirsiz: ${l.belirsiz.map((b) => b.etiket).join(" | ")}` : ""}</span></div>)}
        {r.cozulemeyen.map((c) => <div key={c} className="lok-sonuc"><Pill ton="kotu">Tanınmadı</Pill><b>{c}</b><button className="btn kucuk" onClick={() => { guncelle((dd) => ({ ...dd, adaylar: dd.adaylar.some((a) => a.ifade === c) ? dd.adaylar : [...dd.adaylar, { ifade: c, gorunen: c, gorulme: 1, birlikteGecis: {}, durum: "BEKLIYOR", sonGorulme: new Date().toISOString(), ornekMetin: metin }] })); bildir("Öğrenme listesine eklendi"); }}>Öğrenme listesine ekle</button></div>)}
      </div>
    </section>

    <section className="kart">
      <h3>Öğrettikleriniz ({d.ogrenilen.length})</h3>
      {d.ogrenilen.map((a) => <div key={a.alias} className="lok-sonuc"><Pill ton={a.tip === "REFERANS_NOKTA" ? "mavi" : "notr"}>{a.tip === "REFERANS_NOKTA" ? "Referans" : "Yazım"}</Pill><b>{a.alias}</b><span>→ {lokEtiket(a)}</span>
        <button className="btn kucuk" onClick={() => { guncelle((dd) => ({ ...dd, ogrenilen: dd.ogrenilen.filter((x) => x.alias !== a.alias), adaylar: dd.adaylar.map((x) => (x.ifade === a.alias ? { ...x, durum: "BEKLIYOR" as const } : x)) })); bildir("Sözlükten çıkarıldı"); }}>Kaldır</button></div>)}
      {!d.ogrenilen.length && <p className="bos">Henüz öğrettiğiniz bir ifade yok.</p>}
      <details><summary>Hazır sözlük: {SEED_ALIASLAR.length} ifade ({referanslar.length} referans nokta)</summary>
        <div className="yigin kucuk-bosluk">{SEED_ALIASLAR.map((a) => <div key={a.alias} className="lok-sonuc"><Pill ton={a.tip === "REFERANS_NOKTA" ? "mavi" : "notr"}>{a.tip === "REFERANS_NOKTA" ? "Referans" : a.seviye === "ALTBOLGE" ? "Alt bölge" : "Yazım"}</Pill><b>{a.alias}</b><span>→ {lokEtiket(a)}</span></div>)}</div>
      </details>
    </section>
  </div>;
}