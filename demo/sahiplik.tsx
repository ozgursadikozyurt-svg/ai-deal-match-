/**
 * Anahtar CRM v3.22.1 · 9 Ekim 2026
 * Demo — "Benim / Ofisim" işareti: kart rozeti, kayıt detayındaki seçici, hızlı süzgeç ve Ayarlar kartı.
 * Kural src/lib/domain/sahiplik.ts'de (saf fonksiyon). Burada yalnızca arayüz ve depo bağlantısı var.
 */
import React, { useMemo, useState } from "react";
import { sahiplikKimligi, sahiplikOf, sahiplikUyar, kimlikBosMu, telAnahtar, adAnahtar, SahiplikAyarSchema, type Sahiplik, type SahiplikAyar, type SahiplikIsareti, type SahiplikKimligi, type SahiplikSonucu, type SahiplikSuzgeci } from "../src/lib/domain/sahiplik";
import { CANLI, paylasimAyari, sahiplikAyari, type DepoDurumu, type Kayit, type Veri } from "./depo";
import { useDepo, cx, telYaz } from "./ortak";
import { telNormalize } from "./form";

const kimlikOnbellek = new WeakMap<object, SahiplikKimligi>();
/** Durumdan kimlik kümesi (ayar nesnesi değişmedikçe yeniden kurulmaz) */
export function kimlikOf(d: DepoDurumu): SahiplikKimligi {
  const anahtar = (d.ayarlar.sahiplik ?? d.ayarlar) as object;
  const k = kimlikOnbellek.get(anahtar);
  const ofisAdi = CANLI.acik ? CANLI.oturum?.bilgi?.ofis?.ad : undefined;
  if (k && (k as any).__imza === d.ayarlar.paylasim && (k as any).__ofis === ofisAdi) return k;
  const yeni = sahiplikKimligi(sahiplikAyari(d), paylasimAyari(d), ofisAdi ? [ofisAdi] : []);
  Object.assign(yeni, { __imza: d.ayarlar.paylasim, __ofis: ofisAdi });
  kimlikOnbellek.set(anahtar, yeni);
  return yeni;
}

/** Kaydın sahipliği: elle işaret → telefon → ad / firma (bağlı kişiler dahil) */
const cozucuOnbellek = new WeakMap<object, { k: SahiplikKimligi; f: (v: Veri) => SahiplikSonucu }>();
export function sahiplikCozucu(d: DepoDurumu): (v: Veri) => SahiplikSonucu {
  const k = kimlikOf(d);
  const o = cozucuOnbellek.get(d.kisiler);
  if (o && o.k === k) return o.f;
  const kisi = new Map(d.kisiler.map((x) => [x.id, x]));
  const f = (v: Veri) => sahiplikOf(v as any, (v.kisiler ?? []).map((b) => kisi.get(b.kisiId)).filter(Boolean) as any[], k);
  cozucuOnbellek.set(d.kisiler, { k, f });
  return f;
}
/** Bileşen içinde: kişi listesi ve ayar değişmedikçe aynı fonksiyon döner (her kartta yeniden kurulmaz) */
export function useSahiplik(): (v: Veri) => SahiplikSonucu {
  const { d } = useDepo();
  return sahiplikCozucu(d);
}

/** Kart rozeti: "Benim" (vurgulu) · "Ofisim" (mavi) */
export function SahiplikRozeti({ s }: { s: Sahiplik | null }) {
  if (!s) return null;
  return <span className={cx("sahip-rozet", s === "BENIM" ? "benim" : "ofis")} title={s === "BENIM" ? "Benim talebim / portföyüm" : "Ofisimin kaydı"}>{s === "BENIM" ? "★ Benim" : "◆ Ofisim"}</span>;
}

const NEDEN: Record<string, string> = { ISARET: "elle işaretlendi", TELEFON: "telefondan tanındı", AD: "addan tanındı", FIRMA: "firma adından tanındı" };
/** Kayıt detayında: kimin kaydı? (Otomatik · Benim · Ofisim · Başkasının) */
export function SahiplikSecici({ k }: { k: Kayit }) {
  const { d, kayitKaydet, bildir, git } = useDepo();
  const coz = useSahiplik();
  const v = k.veri;
  const oto = coz({ ...v, isaret: null } as Veri);
  const sonuc = coz(v);
  const isaretle = (x: SahiplikIsareti | null) => { const { isaret: _i, ...yalin } = v; kayitKaydet({ ...k, veri: (x == null ? yalin : { ...yalin, isaret: x }) as Veri }); bildir(x == null ? "Sahiplik otomatiğe döndü" : x === "DIS" ? "Başkasının kaydı olarak işaretlendi" : x === "BENIM" ? "Benim olarak işaretlendi" : "Ofisim olarak işaretlendi"); };
  const bos = kimlikBosMu(kimlikOf(d));
  const SEC: [SahiplikIsareti | null, string][] = [[null, `Otomatik${oto.tur ? ` (${oto.tur === "BENIM" ? "Benim" : "Ofisim"})` : ""}`], ["BENIM", "★ Benim"], ["OFIS", "◆ Ofisim"], ["DIS", "Başkası"]];
  return <div className="sahip-secici" role="group" aria-label="Kimin kaydı">
    <span className="ipucu">Kimin?</span>
    <div className="sahip-seg">{SEC.map(([x, l]) => <button key={String(x)} type="button" className={cx((v.isaret ?? null) === x && "on")} onClick={() => isaretle(x)}>{l}</button>)}</div>
    <small className="ipucu">{sonuc.tur ? `${sonuc.tur === "BENIM" ? "Benim" : "Ofisim"} · ${NEDEN[sonuc.neden ?? ""] ?? ""}` : v.isaret === "DIS" ? "Başkasının (elle)" : "Benim / ofisim değil"}{bos && !v.isaret ? <> · <button type="button" className="link-btn" onClick={() => git({ ad: "ayarlar" })}>telefonlarınızı tanıtın</button></> : null}</small>
  </div>;
}

/** Talepler / Portföyler: tek satır hızlı süzgeç (Tümü · Benim · Ofisim · Diğer) */
export function SahiplikCipleri({ deger, set, sayilar }: { deger: SahiplikSuzgeci | null; set: (x: SahiplikSuzgeci | null) => void; sayilar: Record<SahiplikSuzgeci | "TUMU", number> }) {
  const S: [SahiplikSuzgeci | null, string, number][] = [[null, "Tümü", sayilar.TUMU], ["BENIM", "★ Benim", sayilar.BENIM], ["OFISIM", "◆ Ofisim", sayilar.OFISIM], ["DIS", "Diğer", sayilar.DIS]];
  return <div className="filtre filtre-ince sahip-cipler" role="group" aria-label="Kimin kayıtları">
    {S.map(([k, l, n]) => <button key={String(k)} type="button" className={cx("fb", deger === k && "on")} aria-pressed={deger === k} onClick={() => set(k)}>{l} ({n})</button>)}
  </div>;
}
export const sahiplikSay = <T,>(xs: T[], s: (x: T) => Sahiplik | null): Record<SahiplikSuzgeci | "TUMU", number> => {
  const r = { TUMU: xs.length, BENIM: 0, OFISIM: 0, DIS: 0 };
  for (const x of xs) { const t = s(x); if (t === "BENIM") r.BENIM++; if (t) r.OFISIM++; else r.DIS++; }
  return r;
};
export { sahiplikUyar };

/** Ayarlar › "Benim ve ofisim": telefon ya da kişi adıyla kendi kayıtlarınızı ve ofis ekibinizi tanıtın */
export function SahiplikAyarlari() {
  const { d, guncelle, bildir } = useDepo();
  const a = sahiplikAyari(d);
  const imza = paylasimAyari(d);
  const coz = useSahiplik();
  const sayi = useMemo(() => { let b = 0, o = 0; for (const k of d.kayitlar) { const t = coz(k.veri).tur; if (t === "BENIM") b++; else if (t === "OFIS") o++; } return { b, o }; }, [d.kayitlar, coz]);
  const yaz = (y: SahiplikAyar) => { guncelle((x) => ({ ...x, ayarlar: { ...x.ayarlar, sahiplik: SahiplikAyarSchema.parse(y) } })); };
  return <section className="kart yigin kucuk-bosluk" id="ayar-sahiplik">
    <h3>Benim ve ofisim</h3>
    <p className="ipucu">WhatsApp gruplarından gelen kendi ilanlarınız ve ofis arkadaşlarınızın kayıtları buradaki telefon ve adlardan tanınır; kartlarda <b>★ Benim</b> / <b>◆ Ofisim</b> görünür, listelerde tek dokunuşla süzülür. İmzanızdaki ad ve telefon ({imza.adSoyad}{imza.telefon ? ` · ${imza.telefon}` : ""}) kendiliğinden sayılır.</p>
    <p><b>{sayi.b}</b> kayıt sizin · <b>{sayi.o}</b> kayıt ofisinizin</p>
    <KimlikListesi baslik="Benim" aciklama="Başka telefonlarınız, takma adınız" tel={a.benimTelefonlar} ad={a.benimAdlar} degis={(tel, ad) => yaz({ ...a, benimTelefonlar: tel, benimAdlar: ad })} bildir={bildir} />
    <KimlikListesi baslik="Ofisim" aciklama="Ofis / firma adı, ofis arkadaşlarınızın telefonları ve adları" tel={a.ofisTelefonlar} ad={a.ofisAdlar} degis={(tel, ad) => yaz({ ...a, ofisTelefonlar: tel, ofisAdlar: ad })} bildir={bildir} />
  </section>;
}

function KimlikListesi({ baslik, aciklama, tel, ad, degis, bildir }: { baslik: string; aciklama: string; tel: string[]; ad: string[]; degis: (tel: string[], ad: string[]) => void; bildir: (m: string) => void }) {
  const { d } = useDepo();
  const [q, setQ] = useState("");
  const kimlik = `sh-${baslik === "Benim" ? "benim" : "ofis"}`;
  const telMi = telAnahtar(q) != null && /^[\d\s+()-]+$/.test(q.trim());
  const oneriler = !telMi && q.trim().length >= 2 ? d.kisiler.filter((k) => adAnahtar(k.adSoyad).includes(adAnahtar(q)) || adAnahtar(k.sirket).includes(adAnahtar(q))).slice(0, 5) : [];
  const ekle = (yeniTel: (string | null | undefined)[], yeniAd: (string | null | undefined)[]) => {
    const t = [...new Set([...tel, ...yeniTel.map((x) => (x ? telNormalize(x) || x : null)).filter((x): x is string => !!x)])];
    const n = [...new Set([...ad, ...yeniAd.map((x) => x?.trim()).filter((x): x is string => !!x)])];
    degis(t, n); setQ(""); bildir(`${baslik} listesine eklendi`);
  };
  return <div className="sahip-liste">
    <div className="ust-etiket">{baslik}</div>
    <div className="ipucu">{aciklama}</div>
    <div className="cip-satir">
      {tel.map((x) => <span key={"t" + x} className="cip">{telYaz(x) || x}<button type="button" className="sil" aria-label="Kaldır" onClick={() => degis(tel.filter((y) => y !== x), ad)}>×</button></span>)}
      {ad.map((x) => <span key={"a" + x} className="cip">{x}<button type="button" className="sil" aria-label="Kaldır" onClick={() => degis(tel, ad.filter((y) => y !== x))}>×</button></span>)}
    </div>
    <div className="satir">
      <input id={kimlik} placeholder="Telefon, ad ya da firma yazın…" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && q.trim()) { e.preventDefault(); telMi ? ekle([q], []) : ekle([], [q]); } }} />
      <button type="button" className="btn" disabled={!q.trim()} onClick={() => (telMi ? ekle([q], []) : ekle([], [q]))}>{telMi ? "Telefonu ekle" : "Adı ekle"}</button>
    </div>
    {oneriler.length > 0 && <div className="yigin kucuk-bosluk">{oneriler.map((k) => <button key={k.id} type="button" className="kisi-satir" onClick={() => ekle([k.telefon, k.ikincilTelefon], [k.adSoyad])}>
      <span className="avatar kucuk">{k.adSoyad[0]?.toLocaleUpperCase("tr")}</span><span><b>{k.adSoyad}</b>{k.sirket ? <span className="ipucu"> · {k.sirket}</span> : null}<br /><span className="tel">{telYaz(k.telefon)}</span> <small className="ipucu">Kişiden ekle (ad + telefon)</small></span>
    </button>)}</div>}
  </div>;
}
