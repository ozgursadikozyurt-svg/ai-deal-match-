/**
 * Anahtar CRM v3.13 · 3 Ekim 2026
 * Demo — Toplu veri girişi:
 *  • Dosya: Excel (.xlsx) / CSV / TXT portal listesi, meslektaş portföyü, ofisin haftalık talep tablosu; vCard (.vcf) kişi kartları.
 *    Sütunlar otomatik eşlenir (değiştirilebilir), sahibi / emlak ofisi ayrılır, ilanlara geçerlilik verilir (varsayılan 90 gün),
 *    aynı ilan ikinci kez eklenmez. Yapay zekâ kullanılmaz (src/lib/ingest/tablo.ts başındaki gerekçe).
 *  • Toplu mesaj: haftalık toplantı notu gibi tek mesajdaki birden çok talep/portföy ayrı kayıtlara bölünür.
 */
import React, { useMemo, useRef, useState } from "react";
import { dosyaOku, csvOku, type Sayfa } from "../src/lib/ingest/xlsx";
import { dosyaSatirlari, dosyaTuruTahmin, satirDonustur, satirHazirla, ALAN_ETIKET, type DosyaTuru, type TabloAlan, type Eslesme, type HazirSatir } from "../src/lib/ingest/tablo";
import { mesajiBol } from "../src/lib/ingest/toplu-mesaj";
import { vcfOku, type VcfKisi } from "../src/lib/ingest/vcf";
import { telAnahtari } from "../src/lib/senkron/birlestir";
import { anahtarKumesi, tekrarAnahtarlari } from "../src/lib/ingest/tekrar";
import { varsayilanValidUntil } from "../src/lib/domain/gecerlilik";
import { KayitCreateSchema } from "../src/lib/validation/kayit";
import { siralaUygula, SiralaDugmesi, type Siralama } from "./filtre";
import { BUGUN, type Kayit, type Kisi, type DepoDurumu, type Veri } from "./depo";
import { INDEKS, calismaIliOku } from "./lokasyon";
import { useDepo, cx, Pill, IslemPill, baslikOf, fiyatOf, m2Of, lokEtiket } from "./ortak";
import { etiket } from "./etiketler";
import { taslakYap } from "./ai-kutusu";
import { ORNEK_PORTAL_CSV, ORNEK_TALEP_SAYFALARI, ORNEK_TOPLANTI_NOTU, ORNEK_VCF } from "./ornek-dosyalar";

/** v3.8 — mevcut kayıtların tekrar anahtarları (ilan no / bağlantı + kişi+tip+bütçe+konum) — talepler de dahil */
const kayitKisiAdi = (d: DepoDurumu, k: Kayit) => d.kisiler.find((x) => x.id === k.veri.kisiler?.[0]?.kisiId)?.adSoyad ?? k.veri.gondeAdi ?? null;
export const mevcutAnahtarlar = (d: DepoDurumu) => anahtarKumesi(d.kayitlar.map((k) => ({ veri: k.veri as any, kisiAdi: kayitKisiAdi(d, k) })));

const DOSYA_TURU: Record<DosyaTuru, { etiket: string; aciklama: string }> = {
  PORTAL: { etiket: "Portal ilan listesi", aciklama: "Sahibinden / Hepsiemlak / Emlakjet dökümü → Web ilanı havuzu" },
  MESLEKTAS: { etiket: "Meslektaşın portföyü", aciklama: "Bir arkadaşın gönderdiği liste → Partner havuzu" },
  KENDI: { etiket: "Kendi portföyüm", aciklama: "Başka bir yerde tuttuğum portföyler → CRM portföyü" },
  TALEP_LISTESI: { etiket: "Talep listesi", aciklama: "Haftalık talep toplantısı, müşteri listesi → Talepler" },
};
const SAHIP_GRUP = (s: string) => (s === "MALIK" ? "SAHIBI" : s === "EMLAKCI" || s === "PARTNER" ? "OFIS" : "DIGER");
const SAHIP_ETIKET: Record<string, string> = { SAHIBI: "Sahibinden", OFIS: "Emlak ofisi", DIGER: "Banka / firma / müteahhit" };

/** Kişileri ve kayıtları tek seferde ekler (döngüde ayrı ayrı güncelleme mükerrer kişi açar) */
export function topluEkle(x: DepoDurumu, girdiler: { veri: Veri; kisi?: { adSoyad: string; telefon: string | null; sirket: string | null; roller: string[]; rol: string } | null }[]) {
  const kisiler = x.kisiler.slice();
  const taban = Date.now().toString(36).slice(-4).toUpperCase();
  let n = 0;
  const kisiBul = (g: NonNullable<(typeof girdiler)[number]["kisi"]>) => {
    const t = telAnahtari(g.telefon);
    const ad = g.adSoyad.toLocaleLowerCase("tr");
    let k = (t && kisiler.find((y) => telAnahtari(y.telefon) === t)) || kisiler.find((y) => y.adSoyad.toLocaleLowerCase("tr") === ad && (!g.sirket || !y.sirket || y.sirket === g.sirket));
    if (!k) {
      k = { id: `K${taban}${(n++).toString(36).toUpperCase().padStart(3, "0")}`, adSoyad: g.adSoyad, telefon: g.telefon, sirket: g.sirket, roller: g.roller, uzmanlikAileleri: [], referans: null, notlar: "Toplu içe aktarmadan", whatsappGruplari: [], olusturma: new Date().toISOString(), sonIletisim: null, kaynak: "MANUEL" } as Kisi;
      kisiler.unshift(k);
    } else if (g.roller.some((r) => !k!.roller.includes(r))) { const kk = k; const i = kisiler.indexOf(kk); kisiler[i] = { ...kk, roller: [...new Set([...kk.roller, ...g.roller])] }; k = kisiler[i]; }
    return k.id;
  };
  const yeniKisiSayisi0 = kisiler.length;
  const kayitlar: Kayit[] = girdiler.map((g, i) => {
    const kisiBag = g.kisi ? [{ kisiId: kisiBul(g.kisi), rol: g.kisi.rol }] : [];
    const v = { ...g.veri, kisiler: [...(g.veri.kisiler ?? []), ...kisiBag].slice(0, 10) } as Veri;
    if (!v.validUntil) (v as any).validUntil = varsayilanValidUntil(v.tip, v.islemTipi, (v as any).aciliyet, BUGUN, x.ayarlar.ttl);
    return { id: `${v.tip === "PORTFOY" ? "P" : "T"}${taban}${i.toString(36).toUpperCase().padStart(3, "0")}`, olusturma: new Date().toISOString(), veri: v };
  });
  return { d: { ...x, kisiler, kayitlar: [...kayitlar, ...x.kayitlar] }, eklenen: kayitlar.length, yeniKisi: kisiler.length - yeniKisiSayisi0 };
}

// ───────────────────────────── Dosya ─────────────────────────────
export function DosyaAktarma() {
  const { d, guncelle, bildir, git } = useDepo();
  const [dosya, setDosya] = useState<{ ad: string; sayfalar: Sayfa[] } | null>(null);
  const [vcf, setVcf] = useState<{ ad: string; kisiler: VcfKisi[] } | null>(null);
  const [hata, setHata] = useState<string | null>(null);
  const [esOzel, setEsOzel] = useState<Record<string, TabloAlan[]>>({});
  const [tur, setTur] = useState<DosyaTuru | null>(null);
  const [varsayilanSahip, setVarsayilanSahip] = useState<"MALIK" | "EMLAKCI" | "PARTNER">("EMLAKCI");
  const [varsayilanIslem, setVarsayilanIslem] = useState<"SATILIK" | "KIRALIK">("SATILIK");
  const [ilanGun, setIlanGun] = useState<number>(d.ayarlar.ttl.DIS_ILAN ?? 90);
  const [sahipF, setSahipF] = useState<"HEPSI" | "SAHIBI" | "OFIS" | "DIGER">("HEPSI");
  const [durumF, setDurumF] = useState<"HEPSI" | "HAZIR" | "KONTROL" | "TEKRAR" | "HATALI">("HEPSI");
  const [secim, setSecim] = useState<Set<string>>(new Set());
  const [eklenen, setEklenen] = useState<Set<string>>(new Set());
  const [goster, setGoster] = useState(40);
  const [sr, setSr] = useState<Siralama>({ alan: "satir", yon: "artan" });
  const [rapor, setRapor] = useState<string | null>(null);
  const girdi = useRef<HTMLInputElement>(null);

  const yukle = async (f: File) => {
    setHata(null); setRapor(null); setEsOzel({}); setTur(null); setSecim(new Set()); setEklenen(new Set()); setVcf(null); setDosya(null);
    try {
      const veri = new Uint8Array(await f.arrayBuffer());
      if (/\.vcf$/i.test(f.name)) { setVcf({ ad: f.name, kisiler: vcfOku(new TextDecoder().decode(veri)) }); return; }
      const sf = dosyaOku(f.name, veri);
      if (!dosyaSatirlari(sf).length) throw new Error("Başlık satırı bulunamadı. İlk satırlarda 'Fiyat', 'm2', 'İlçe', 'Bütçe', 'İsim' gibi sütun başlıkları olmalı.");
      setDosya({ ad: f.name, sayfalar: sf });
    } catch (e: any) { setHata(e?.message ?? String(e)); }
  };

  const bloklar = useMemo(() => (dosya ? dosyaSatirlari(dosya.sayfalar).map((b) => ({ ...b, eslesme: { ...b.eslesme, sutunlar: esOzel[b.sayfa] ?? b.eslesme.sutunlar } as Eslesme })) : []), [dosya, esOzel]);
  const tahmin = bloklar[0] ? dosyaTuruTahmin(bloklar[0].eslesme) : null;
  const dt: DosyaTuru = tur ?? tahmin?.dosyaTuru ?? "PORTAL";
  const tip = dt === "TALEP_LISTESI" ? "TALEP" : "PORTFOY";
  const sahipSutunu = bloklar.some((b) => b.eslesme.sutunlar.includes("ilanSahibiTuru"));

  const satirlar = useMemo(() => {
    if (!dosya) return [] as (HazirSatir & { key: string; sayfa: string; durumX: string; grup: string })[];
    const varolan = mevcutAnahtarlar(d);
    const gorulen = new Set<string>();
    return bloklar.flatMap((b) => b.satirlar.map((r) => {
      const s = satirHazirla(satirDonustur(r.hucreler, b.eslesme, { tip, dosyaTuru: dt, varsayilanSahip, ilanGun, varsayilanIslem, bugun: BUGUN, dosyaAdi: dosya.ad }, r.no), INDEKS);
      let durumX: string = s.durum === "BOS" ? "BOS" : !s.veri ? "HATALI" : s.durum;
      const anah = s.veri ? tekrarAnahtarlari(s.veri as any, s.kisi?.adSoyad ?? s.girdi.gondeAdi) : [];
      if (anah.some((a) => varolan.has(a) || gorulen.has(a))) durumX = "TEKRAR";
      anah.forEach((a) => gorulen.add(a));
      return { ...s, key: `${b.sayfa}#${r.no}`, sayfa: b.sayfa, durumX, grup: SAHIP_GRUP(s.sahipTuru) };
    })).filter((s) => s.durumX !== "BOS");
  }, [bloklar, dt, varsayilanSahip, ilanGun, varsayilanIslem, d.kayitlar.length]);

  const sahipSay = (g: string) => satirlar.filter((s) => g === "HEPSI" || s.grup === g).length;
  const s1 = satirlar.filter((s) => (sahipF === "HEPSI" || s.grup === sahipF) && !eklenen.has(s.key));
  const durumSay = (x: string) => s1.filter((s) => x === "HEPSI" || s.durumX === x).length;
  const secenek = [
    { alan: "satir", etiket: "Dosyadaki sıra", deger: (s: (typeof satirlar)[number]) => s.satirNo, varsayilanYon: "artan" as const },
    { alan: "fiyat", etiket: tip === "TALEP" ? "Bütçe" : "Fiyat", deger: (s: (typeof satirlar)[number]) => s.girdi.fiyat ?? s.girdi.maxFiyat ?? null, varsayilanYon: "azalan" as const },
    { alan: "m2", etiket: "m²", deger: (s: (typeof satirlar)[number]) => s.girdi.m2 ?? s.girdi.minM2 ?? s.girdi.maxM2 ?? null, varsayilanYon: "azalan" as const },
    { alan: "tarih", etiket: "İlan tarihi", deger: (s: (typeof satirlar)[number]) => (s.girdi.mesajTarihi ? new Date(s.girdi.mesajTarihi as any).getTime() : null), varsayilanYon: "azalan" as const },
  ];
  const gorunen = siralaUygula(s1.filter((s) => durumF === "HEPSI" || s.durumX === durumF), sr, secenek);
  const eklenebilir = (s: (typeof satirlar)[number]) => !!s.veri && s.durumX !== "TEKRAR";

  const ekle = (keys: string[]) => {
    const sec = satirlar.filter((s) => keys.includes(s.key) && eklenebilir(s));
    if (!sec.length) return;
    let r: any;
    guncelle((x) => { r = topluEkle(x, sec.map((s) => ({ veri: s.veri as Veri, kisi: s.kisi }))); return r.d; });
    setEklenen((e) => new Set([...e, ...sec.map((s) => s.key)])); setSecim(new Set());
    const m = `${sec.length} kayıt eklendi${r?.yeniKisi ? `, ${r.yeniKisi} yeni kişi` : ""}. Eşleşmeler hemen hesaplandı.`;
    setRapor(m); bildir(m);
  };
  const vcfEkle = () => {
    if (!vcf) return;
    let yeni = 0, birlesen = 0;
    guncelle((x) => {
      const kisiler = x.kisiler.slice();
      vcf.kisiler.forEach((v, i) => {
        const t = telAnahtari(v.telefonlar[0]);
        const k = t ? kisiler.find((y) => telAnahtari(y.telefon) === t) : undefined;
        if (k) { birlesen++; return; }
        yeni++;
        kisiler.unshift({ id: `KV${Date.now().toString(36).slice(-4).toUpperCase()}${i}`, adSoyad: v.adSoyad || v.telefonlar[0], telefon: v.telefonlar[0] ?? null, ikincilTelefon: v.telefonlar[1] ?? null, email: v.email, sirket: v.sirket, roller: [], uzmanlikAileleri: [], referans: null, notlar: v.not, whatsappGruplari: [], olusturma: new Date().toISOString(), sonIletisim: null, kaynak: "MANUEL" } as Kisi);
      });
      return { ...x, kisiler };
    });
    bildir(`${yeni} kişi eklendi${birlesen ? `, ${birlesen} kişi zaten vardı` : ""}`); setVcf(null);
  };

  return <div className="yigin">
    <div className="kart yigin kucuk-bosluk">
      <p className="ipucu" style={{ margin: 0 }}>Excel, CSV, TXT ya da vCard (.vcf) — sütunları ben tanırım, siz onaylarsınız.</p>
      <div className="satir sar">
        <button className="btn birincil" onClick={() => girdi.current?.click()}>Dosya seç</button>
        <input ref={girdi} type="file" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) yukle(f); e.target.value = ""; }} />
        <button className="btn kucuk" onClick={() => { setTur(null); setRapor(null); setEklenen(new Set()); setSecim(new Set()); setEsOzel({}); setVcf(null); setDosya({ ad: "ornek-portal-listesi.csv", sayfalar: [csvOku(ORNEK_PORTAL_CSV, "Portal")] }); }}>Örnek: portal listesi</button>
        <button className="btn kucuk" onClick={() => { setTur(null); setRapor(null); setEklenen(new Set()); setSecim(new Set()); setEsOzel({}); setVcf(null); setDosya({ ad: "ornek-ofis-talepler.xlsx", sayfalar: ORNEK_TALEP_SAYFALARI }); }}>Örnek: haftalık talep tablosu</button>
        <button className="btn kucuk" onClick={() => { setDosya(null); setVcf({ ad: "ornek.vcf", kisiler: vcfOku(ORNEK_VCF) }); }}>Örnek: kişi kartı (.vcf)</button>
      </div>
      {hata && <div className="uyari-kutu">{hata}</div>}
    </div>

    {vcf && <section className="kart yigin kucuk-bosluk">
      <h3>{vcf.ad} — {vcf.kisiler.length} kişi</h3>
      {vcf.kisiler.map((k, i) => <div key={i} className="satir-ara"><span><b>{k.adSoyad}</b>{k.sirket ? <span className="ipucu"> · {k.sirket}</span> : null}</span><span className="tel">{k.telefonlar.join(", ")}</span></div>)}
      <div className="satir"><button className="btn birincil" onClick={vcfEkle}>Kişilere ekle</button><span className="ipucu">Aynı numara varsa ikinci kez eklenmez.</span></div>
    </section>}

    {dosya && <>
      <section className="kart yigin kucuk-bosluk">
        <div className="satir-ara"><h3 style={{ margin: 0 }}>{dosya.ad}</h3><span className="ipucu">{bloklar.length} sayfa · {satirlar.length} satır</span></div>
        <div className="alan"><label htmlFor="dt">Bu dosya ne?</label>
          <select id="dt" value={dt} onChange={(e) => { setTur(e.target.value as DosyaTuru); setSecim(new Set()); }}>{(Object.keys(DOSYA_TURU) as DosyaTuru[]).map((k) => <option key={k} value={k}>{DOSYA_TURU[k].etiket}{tahmin?.dosyaTuru === k ? " (tahmin)" : ""}</option>)}</select>
          <span className="ipucu">{DOSYA_TURU[dt].aciklama}</span></div>
        <div className="alanlar">
          {tip === "PORTFOY" && !sahipSutunu && <div className="alan"><label htmlFor="vs">İlanlar kimin?</label><select id="vs" value={varsayilanSahip} onChange={(e) => setVarsayilanSahip(e.target.value as any)}><option value="MALIK">Hepsi mülk sahibinden</option><option value="EMLAKCI">Hepsi emlak ofisinden</option><option value="PARTNER">Meslektaş / partner</option></select></div>}
          {tip === "PORTFOY" && (dt === "PORTAL" || dt === "MESLEKTAS") && <div className="alan"><label htmlFor="ig">Geçerlilik (gün)</label><input id="ig" type="number" min={7} max={365} value={ilanGun} onChange={(e) => setIlanGun(Math.max(1, Number(e.target.value) || 90))} /><span className="ipucu">İlan tarihinden itibaren; süresi dolan ilan pasife düşer</span></div>}
          {!bloklar.some((b) => b.eslesme.sutunlar.includes("islem")) && <div className="alan"><label htmlFor="vi">İşlem belirtilmemişse</label><select id="vi" value={varsayilanIslem} onChange={(e) => setVarsayilanIslem(e.target.value as any)}><option value="SATILIK">Satılık</option><option value="KIRALIK">Kiralık</option></select></div>}
        </div>
        <details><summary>Sütun eşleme ({bloklar.reduce((a, b) => a + b.eslesme.sutunlar.filter((x) => x !== "yok").length, 0)} sütun tanındı)</summary>
          {bloklar.map((b) => <div key={b.sayfa} className="sutun-esleme">
            {bloklar.length > 1 && <div className="ipucu">Sayfa: <b>{b.sayfa}</b> · başlık {b.eslesme.baslikSatiri + 1}. satırda</div>}
            {b.eslesme.basliklar.map((h, j) => (h || b.eslesme.sutunlar[j] !== "yok") && <label key={j} className="satir-ara"><span>{h || <i>(başlıksız sütun {j + 1})</i>}</span>
              <select value={b.eslesme.sutunlar[j]} style={{ width: "auto", maxWidth: "60%" }} onChange={(e) => { const yeni = b.eslesme.sutunlar.slice(); yeni[j] = e.target.value as TabloAlan; setEsOzel({ ...esOzel, [b.sayfa]: yeni }); }}>{(Object.keys(ALAN_ETIKET) as TabloAlan[]).map((a) => <option key={a} value={a}>{ALAN_ETIKET[a]}</option>)}</select></label>)}
          </div>)}
        </details>
      </section>

      {rapor && <div className="basari-kutu satir-ara"><span>{rapor}</span><button className="btn kucuk" onClick={() => git({ ad: "eslesmeler" } as any)}>Eşleşmelere git</button></div>}

      {tip === "PORTFOY" && <div className="filtre">{(["HEPSI", "SAHIBI", "OFIS", "DIGER"] as const).filter((g) => g === "HEPSI" || sahipSay(g)).map((g) => <button key={g} className={cx("fb", sahipF === g && "on")} onClick={() => { setSahipF(g); setSecim(new Set()); }}>{g === "HEPSI" ? "Tümü" : SAHIP_ETIKET[g]} ({sahipSay(g)})</button>)}</div>}
      <div className="fc">
        <div className="filtre" style={{ flex: 1 }}>{(["HEPSI", "HAZIR", "KONTROL", "TEKRAR", "HATALI"] as const).filter((x) => x === "HEPSI" || durumSay(x)).map((x) => <button key={x} className={cx("fb", durumF === x && "on")} onClick={() => setDurumF(x)}>{{ HEPSI: "Tümü", HAZIR: "Hazır", KONTROL: "Kontrol gerekli", TEKRAR: "Zaten var", HATALI: "Hatalı" }[x]} ({durumSay(x)})</button>)}</div>
        <SiralaDugmesi secenekler={secenek} s={sr} set={setSr} />
      </div>
      <div className="toplu-cubuk">
        <label className="onay-satir"><input type="checkbox" checked={gorunen.filter(eklenebilir).length > 0 && gorunen.filter(eklenebilir).every((s) => secim.has(s.key))} onChange={(e) => setSecim(e.target.checked ? new Set(gorunen.filter(eklenebilir).map((s) => s.key)) : new Set())} /> Tümünü seç ({gorunen.filter(eklenebilir).length})</label>
        <button className="btn kucuk" onClick={() => setSecim(new Set(s1.filter((s) => s.durumX === "HAZIR").map((s) => s.key)))}>Hazır olanları seç ({durumSay("HAZIR")})</button>
        <button className="btn birincil" disabled={!secim.size} onClick={() => ekle([...secim])}>Seçilenleri ekle ({secim.size})</button>
      </div>
      {gorunen.slice(0, goster).map((s) => <div key={s.key} className={cx("kart aday", secim.has(s.key) && "secili")}>
        <div className="satir-ara">
          <label className="onay-satir">{eklenebilir(s) && <input type="checkbox" aria-label="Seç" checked={secim.has(s.key)} onChange={(e) => setSecim((x) => { const n = new Set(x); e.target.checked ? n.add(s.key) : n.delete(s.key); return n; })} />}
            <span className="ipucu">{bloklar.length > 1 ? `${s.sayfa} · ` : ""}satır {s.satirNo}</span></label>
          <Pill ton={s.durumX === "HAZIR" ? "iyi" : s.durumX === "KONTROL" ? "uyari" : "kotu"}>{{ HAZIR: "Hazır", KONTROL: "Kontrol gerekli", TEKRAR: "Zaten var", HATALI: "Hatalı" }[s.durumX]}</Pill>
        </div>
        <div className="pill-satir"><Pill ton={tip === "TALEP" ? "mavi" : "yesil"}>{etiket(s.girdi.mulkTipi)}</Pill><IslemPill islem={s.girdi.islemTipi} />{tip === "PORTFOY" && <Pill>{SAHIP_ETIKET[s.grup]}</Pill>}{s.girdi.veriKanali && s.girdi.veriKanali !== "CSV" && <Pill>{etiket(s.girdi.veriKanali)}</Pill>}</div>
        <div className="kk-baslik">{baslikOf(s.girdi as any)}</div>
        <div className="kk-alt">{s.veri?.lokasyonlar.length ? s.veri.lokasyonlar.map((l) => lokEtiket(l as any)).join(" · ") : s.girdi.lokasyonHam ?? "Konum yok"} · {fiyatOf(s.girdi as any)}{m2Of(s.girdi as any) ? " · " + m2Of(s.girdi as any) : ""}{s.kisi ? ` · ${s.kisi.adSoyad}${s.kisi.sirket ? " (" + s.kisi.sirket + ")" : ""}` : ""}</div>
        {(s.kontrol.length > 0 || s.hatalar.length > 0) && <div className="ipucu uyari-metin">{[...s.kontrol, ...s.hatalar].join(" · ")}</div>}
        {s.durumX === "TEKRAR" && <div className="ipucu">{tip === "TALEP" ? "Bu talep zaten kayıtlı (aynı kişi, mülk, bütçe ve konum)" : "Bu ilan zaten kayıtlı (aynı ilan no / bağlantı ya da aynı sahip, fiyat ve konum)"} — eklenmez.</div>}
        {s.veri && s.durumX === "KONTROL" && <div className="satir"><button className="btn kucuk" onClick={() => { setEklenen((e) => new Set([...e, s.key])); git({ ad: "form", tip, taslak: { ...s.veri, kisiler: s.veri!.kisiler } as any }); }}>Formda düzelt ve kaydet</button></div>}
      </div>)}
      {gorunen.length > goster && <button className="btn" onClick={() => setGoster(goster + 60)}>Daha fazla göster ({gorunen.length - goster})</button>}
      {!gorunen.length && <p className="bos">Bu seçimde satır yok.</p>}
    </>}
  </div>;
}

// ───────────────────────────── Toplu mesaj ─────────────────────────────
export function TopluMesaj({ baslangic = "" }: { baslangic?: string }) {
  const { d, guncelle, bildir, git } = useDepo();
  const [metin, setMetin] = useState(baslangic);
  const [tip, setTip] = useState<"TALEP" | "PORTFOY" | "OTO">("TALEP");
  const [secim, setSecim] = useState<Set<number>>(new Set());
  const [bitti, setBitti] = useState<string | null>(null);
  const parcalar = useMemo(() => (metin.trim() ? mesajiBol(metin, INDEKS) : []), [metin]);
  const varolan = useMemo(() => mevcutAnahtarlar(d), [d.kayitlar, d.kisiler]);
  const adaylar = useMemo(() => parcalar.map((p) => {
    const ek = p.miras.includes("konum") ? " " + p.konumlar.join(" ") : "";
    const { taslak } = taslakYap(p.metin + ek, p.h, null);
    const t = tip === "OTO" ? (p.h.tip ?? "TALEP") : tip;
    taslak.tip = t;
    if (t === "TALEP") { taslak.maxFiyat ??= taslak.fiyat; taslak.minM2 ??= taslak.m2; delete taslak.fiyat; delete taslak.m2; } else { taslak.fiyat ??= taslak.maxFiyat; delete taslak.maxFiyat; delete taslak.minM2; delete taslak.maxM2; }
    if (!taslak.lokasyonlar?.length && p.ilGeneli) taslak.lokasyonlar = [{ ilId: calismaIliOku(), ilceId: null, mahalleId: null, altBolgeId: null, birincil: t === "PORTFOY" }];
    taslak.hamMetin = p.metin; taslak.veriKanali = "MANUEL"; taslak.gondeAdi = p.kisiAdi; taslak.kayitGrubu = "Toplu mesaj";
    const r = KayitCreateSchema.safeParse(taslak);
    const kontrol: string[] = [];
    if (!p.h.mulkTipi) kontrol.push("Mülk tipi yok");
    if (!taslak.lokasyonlar?.length) kontrol.push("Konum yok");
    if (t === "TALEP" ? !taslak.maxFiyat && !taslak.minM2 && !taslak.odaSayisi : !taslak.fiyat && !taslak.m2) kontrol.push(t === "TALEP" ? "Bütçe/m²/oda yok" : "Fiyat/m² yok");
    const tekrar = r.success && tekrarAnahtarlari(r.data as any, p.kisiAdi).some((a) => varolan.has(a));
    return { p, veri: r.success && !tekrar ? (r.data as Veri) : null, tekrar, kontrol, hatalar: r.success ? [] : r.error.issues.map((i) => i.message) };
  }), [parcalar, tip, varolan]);
  const ekle = () => {
    const sec = adaylar.filter((a, i) => secim.has(i) && a.veri);
    let r: any;
    guncelle((x) => { r = topluEkle(x, sec.map((a) => ({ veri: a.veri!, kisi: a.p.kisiAdi ? { adSoyad: a.p.kisiAdi, telefon: a.p.telefon, sirket: null, roller: [a.veri!.tip === "TALEP" ? (/KIRALIK/.test(a.veri!.islemTipi) ? "KIRACI" : "ALICI") : "SATICI"], rol: a.veri!.tip === "TALEP" ? "MUSTERI" : "SAHIP" } : null }))); return r.d; });
    const m = `${sec.length} kayıt eklendi${r?.yeniKisi ? `, ${r.yeniKisi} yeni kişi` : ""}`;
    setBitti(m); bildir(m); setSecim(new Set()); setMetin("");
  };
  return <div className="yigin">
    <div className="kart yigin kucuk-bosluk">
      <p className="ipucu" style={{ margin: 0 }}>Haftalık talep toplantısının notunu ya da birden çok ilan içeren mesajı tek seferde yapıştırın: her madde ayrı kayıt olur, "Ad Soyad –" ile başlayan satırdan kişi alınır. Yapay zekâ kullanılmaz.</p>
      <textarea rows={8} aria-label="Toplu mesaj" placeholder={"Ali V. – Fener 2+1 asansör şart, satılık\nSeda K.: Altıntaş 2+1 3,5 milyon / 1+1 3 milyon\n1) Kepez'de 1500 m² kiralık depo…"} value={metin} onChange={(e) => { setMetin(e.target.value); setSecim(new Set()); setBitti(null); }} />
      <div className="satir sar">
        <div className="uc">{([["TALEP", "Hepsi talep"], ["PORTFOY", "Hepsi portföy"], ["OTO", "Metinden anla"]] as const).map(([k, l]) => <button key={k} className={cx(tip === k && "on")} onClick={() => setTip(k)}>{l}</button>)}</div>
        <button className="btn kucuk" onClick={() => { setMetin(ORNEK_TOPLANTI_NOTU); setSecim(new Set()); setBitti(null); }}>Örnek toplantı notu</button>
      </div>
    </div>
    {bitti && <div className="basari-kutu satir-ara"><span>{bitti}</span><button className="btn kucuk" onClick={() => git({ ad: "liste", tip: "TALEP" })}>Taleplere git</button></div>}
    {adaylar.length > 0 && <>
      <div className="toplu-cubuk">
        <span className="ipucu"><b>{adaylar.length}</b> ayrı kayıt bulundu</span>
        <label className="onay-satir"><input type="checkbox" checked={adaylar.some((a) => a.veri) && adaylar.every((a, i) => !a.veri || secim.has(i))} onChange={(e) => setSecim(e.target.checked ? new Set(adaylar.map((a, i) => (a.veri ? i : -1)).filter((i) => i >= 0)) : new Set())} /> Tümünü seç</label>
        <button className="btn birincil" disabled={!secim.size} onClick={ekle}>Seçilenleri ekle ({secim.size})</button>
      </div>
      {adaylar.map((a, i) => <div key={i} className={cx("kart aday", secim.has(i) && "secili")}>
        <div className="satir-ara"><label className="onay-satir">{a.veri && <input type="checkbox" aria-label="Seç" checked={secim.has(i)} onChange={(e) => setSecim((x) => { const n = new Set(x); e.target.checked ? n.add(i) : n.delete(i); return n; })} />}<b>{i + 1}.</b> {a.p.kisiAdi ?? <span className="ipucu">kişi yok</span>}</label>
          <Pill ton={a.tekrar ? "notr" : !a.veri ? "kotu" : a.kontrol.length ? "uyari" : "iyi"}>{a.tekrar ? "Zaten var" : !a.veri ? "Hatalı" : a.kontrol.length ? "Kontrol gerekli" : "Hazır"}</Pill></div>
        {a.tekrar && <div className="ipucu">Bu kayıt daha önce eklenmiş (aynı kişi, mülk, bütçe ve konum) — tekrar eklenmez.</div>}
        {a.veri && <><div className="pill-satir"><Pill ton={a.veri.tip === "TALEP" ? "mavi" : "yesil"}>{etiket(a.veri.mulkTipi)}</Pill><IslemPill islem={a.veri.islemTipi} />{a.p.miras.length > 0 && <Pill>önceki satırdan: {a.p.miras.join(", ")}</Pill>}</div>
          <div className="kk-alt">{a.veri.lokasyonlar.map((l) => lokEtiket(l as any)).join(" · ") || "Konum yok"} · {fiyatOf(a.veri)}{m2Of(a.veri) ? " · " + m2Of(a.veri) : ""}{a.veri.odaSayisi ? " · " + a.veri.odaSayisi : ""}</div></>}
        <div className="ipucu">“{a.p.metin}”</div>
        {(a.kontrol.length > 0 || a.hatalar.length > 0) && <div className="ipucu uyari-metin">{[...a.kontrol, ...a.hatalar].join(" · ")}</div>}
        {a.veri && a.kontrol.length > 0 && <button className="btn kucuk" onClick={() => git({ ad: "form", tip: a.veri!.tip, taslak: a.veri as any })}>Formda tamamla</button>}
      </div>)}
    </>}
  </div>;
}