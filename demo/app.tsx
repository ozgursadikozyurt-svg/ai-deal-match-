/**
 * Anahtar CRM v3.37 · 21 Ekim 2026
 * Demo uygulaması — gerçek uygulamanın kurallarını (doğrulama, konum çözücü + öğrenme, teknik alanlar,
 * eşleştirme önizlemesi, WhatsApp içe aktarma, Gemini şeması) tarayıcıda örnek veriyle çalıştırır.
 * Derleme: npm run demo  →  dist/anahtar-ai-demo_<sürüm>.html
 * Dosyalar: ortak.tsx (ortak parçalar) · form.tsx · ice-aktarma.tsx · konumlar.tsx · bu dosya (ekranlar + kabuk)
 */
import { IlkKaynakSatirlari } from "./ilk-kaynak";
import { RandevuKarti } from "./randevular";
import { IslemlerEkrani } from "./islemler";
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Yonetim, yonetimGorunur, yetkiAktif, aktifRolEtiketi } from "./yonetim";
import { createRoot } from "react-dom/client";
import { MULK_OZELLIK_META, SIRALAMA, katYaz } from "../src/lib/domain/teknik-alanlar";
import { MULK_AILELERI, aileOf } from "../src/lib/domain/kategori";
import { type Uygunluk, SEVIYE_ETIKET, SEVIYE_ACIKLAMA } from "../src/lib/eslestirme/onizleme";
import { SURUM, TARIH, SURUM_GECMISI } from "../src/lib/surum";
import { etiket, KRITER_ETIKET, ILAN_SAHIBI_ETIKET, VERI_KANALI_ETIKET, HAVUZ_ETIKET } from "./etiketler";
import { ILCELER, INDEKS, ogrenilenleriYukle } from "./lokasyon";
import { CANLI, depoYukle, depoKaydet, calismaIli, kalanGun, sureUzat, ornekVeriyiKur, type DepoDurumu, type Kayit, type Veri, type PipelineDurum } from "./depo";
import { tipCeliskisi } from "../src/lib/domain/tip-celiskisi";
import { kiraPeriyotSuphesi } from "../src/lib/eslestirme/onizleme";
import { C, useDepo, tipYaz, cx, Pill, IslemPill, UYGUNLUK, Skor, Gerekceler, TTL, baslikOf, fiyatOf, m2Of, oneCikanlar, Kopyala, IlanNoCip, useEslesmeler, eKey, enumYaz, telYaz, tarihYaz, lokEtiket, type Ctx, type Ekran, type Eslesme } from "./ortak";
import { KayitFormu } from "./form";
import { VeriGirisi } from "./ice-aktarma";
import { Konumlar } from "./konumlar";
import { GorusmeNotlari } from "./notlar";
import { DikkatSeridi, SuresiYaklasanlar, UzatDugmesi, Aciklama } from "./sure";
import { GorevlerEkrani } from "./gorevler";
import { kimOf } from "../src/lib/domain/kim";
import { suresizMi, UZAT_ESIK_GUN } from "../src/lib/domain/gecerlilik";
import { benimSuresiz } from "./depo";
import { sahiplikCozucu } from "./sahiplik";
import { BugunPanosu, SonrakiIletisimSorusu, EslesmeGorevleri } from "./bugun";
import { eslesmeDurumunuUygula, fiyatDususuIsle } from "./bugun-eylem";
import { IlgilenenlerBolumu } from "./ilgilenenler";
import { DisaAktar } from "./disa-aktar";
import { FirsatRozeti } from "./kartlar";
import { KimPill, KoparDugmesi, TopluKoparPenceresi } from "./kopar";
import { FIRSAT_KADEME_ETIKET, type FirsatKademe } from "../src/lib/eslestirme/firsat";
import { AnahtarDugmesi, Izleme, favTalep, favPortfoy, favEslesme } from "./favori";
import { kopmaEtiket } from "../src/lib/eslestirme/kopar";
import { IletisimDugmeleri } from "./kisiler";
import { selamMetni } from "../src/lib/iletisim";
import { FiltrePaneli, bosFiltre, filtreUygula, SiralaDugmesi, kayitSiralama, siralaUygula, type Filtre, type Siralama } from "./filtre";
import { useKalici, kaliciSil } from "./kalici";
import { HizliSecici, HizliMenu, SkorSecici } from "./hizli-filtre";
import { Kisiler, KisiKarti, KisiSecici, KAYIT_ROLLERI, rolleriUygula } from "./kisiler";
import { RolYonetimi } from "./roller";
import { EslesmeCekmecesi } from "./cekmece";
import { TTL_ETIKET, ttlGun, type TtlAyar } from "../src/lib/domain/gecerlilik";
import { portalLinkleri } from "../src/lib/portal/arama-linkleri";
import { MatrisDokumu, HavuzRozeti, katmanSirasi, FirsatBandi } from "./motor-ui";
import { EslesmeKarti, TalepTercihleri, Kapanir, PIPELINE, HizliCevaplar, cevaplanabilirler } from "./kartlar";
import { havuzKatmani, portfoyEdinmeFirsati } from "../src/lib/eslestirme/havuz";
import { AkilliKutu } from "./ai-kutusu";
import { Baglantilar, SenkronDurumu } from "./baglantilar";
import { notionAcik } from "../src/lib/ozellikler";
import { googleOtomatik } from "./google-baglanti";
import { Logo, LogoIsaret, Ikon, SolMenu, AltCubuk, type NavOge } from "./kabuk";
import { MARKA } from "../src/lib/marka";
import { bosBaglanti, bosGoogleBaglanti } from "./depo";
import { AiAyarlari, PaylasimAyarlari, CalismaIliAyari } from "./ayarlar-ek";
import { CanliAyarKarti } from "./canli-ayar";
import { Fotograflar } from "./fotograflar";
import { PortfoyPaylas } from "./paylas";
import { useSahiplik, SahiplikCipleri, SahiplikRozeti, SahiplikSecici, SahiplikAyarlari, sahiplikSay } from "./sahiplik";
import { KapakKucuk } from "./fotograflar";
import { GelenKutusuKarti, useGelenRozet, kutuOzetYukle } from "./gelen-kutusu";
import { TopluKaynakSecici } from "./kaynak-secici";
import { kaynakUygula } from "../src/lib/domain/kaynak";
import { bekleyenVarMi, bekleyenler, hepsiniKaydet, hepsiniBirak, tarayiciUyarisiKur, useKaydedilmemis } from "./kirli";

type Alan = keyof typeof MULK_OZELLIK_META;

// ───────────────────────────── Ana Sayfa ─────────────────────────────
function AnaSayfa({ donus }: { donus?: boolean } = {}) {
  const { d, git } = useDepo();
  const es = useEslesmeler();
  const aktif = d.kayitlar.filter((k) => k.veri.durum === "ACTIVE");
  const yaklasan = aktif.filter((k) => { const g = kalanGun(k.veri); return g != null && g <= 14; }).sort((a, b) => (kalanGun(a.veri) ?? 0) - (kalanGun(b.veri) ?? 0));
  const acil = aktif.filter((k) => k.veri.tip === "TALEP" && (k.veri.aciliyet === "ACIL" || k.veri.aciliyet === "YUKSEK"));
  const sunulabilir = es.filter((e) => e.s.uygunluk === "SUNULABILIR");
  const bag = d.baglantilar ?? { google: bosBaglanti(), notion: bosBaglanti() };
  // v3.22 — Benim / Ofisim kısayolları: kendi talep ve portföylerine tek dokunuşla
  const sahip = useSahiplik();
  const benimSay = (tip: "TALEP" | "PORTFOY", s: "BENIM" | "OFIS") => aktif.filter((k) => k.veri.tip === tip && sahip(k.veri).tur === s).length;
  const kisayol = (tip: "TALEP" | "PORTFOY", s: "BENIM" | "OFISIM") => git({ ad: "liste", tip, filtre: bosFiltre({ durumlar: ["ACTIVE"], sahiplik: s }) });
  const cakismaSay = (d.cakismalar ?? []).filter((c) => notionAcik() || c.saglayici !== "NOTION").length;
  const [acilHepsi, setAcilHepsi] = useState(false);
  const benimToplam = benimSay("TALEP", "BENIM") + benimSay("PORTFOY", "BENIM"), ofisToplam = benimSay("TALEP", "OFIS") + benimSay("PORTFOY", "OFIS");
  return <div className="yigin">
    <div className="karsilama"><h1>{(() => { const h = new Date().getHours(); return h < 11 ? "Günaydın" : h < 18 ? "İyi günler" : "İyi akşamlar"; })()} Özgür</h1></div>
    {/* v3.30 — gözden kaçmasın: süre ve eşitleme uyarıları en üstte */}
    <DikkatSeridi ek={cakismaSay > 0 ? <button type="button" className="dikkat-cip uyari" onClick={() => git({ ad: "baglantilar" })}><b>{cakismaSay}</b> eşitleme çakışması</button> : undefined} />
    {/* v3.36 — Özgür (19 Eki 2026): Benim ve ofisim / Bugün, Anahtar AI kutusunun altında */}
    <AkilliKutu donus={donus} />
    <section className="kart benim-kisayol" aria-label="Benim ve ofisim">
      <div className="satir-ara"><h3>★ Benim ve ofisim</h3><button className="btn kucuk" onClick={() => git({ ad: "ayarlar" })}>{benimToplam + ofisToplam ? "Ayarla" : "Tanıt"}</button></div>
      {benimToplam + ofisToplam > 0 ? <div className="bk-izgara">
        <button type="button" className="bk-oge benim" onClick={() => kisayol("TALEP", "BENIM")}><b>{benimSay("TALEP", "BENIM")}</b><span>Talebim</span></button>
        <button type="button" className="bk-oge benim" onClick={() => kisayol("PORTFOY", "BENIM")}><b>{benimSay("PORTFOY", "BENIM")}</b><span>Portföyüm</span></button>
        <button type="button" className="bk-oge ofis" onClick={() => kisayol("TALEP", "OFISIM")}><b>{benimSay("TALEP", "BENIM") + benimSay("TALEP", "OFIS")}</b><span>Ofisin talepleri</span></button>
        <button type="button" className="bk-oge ofis" onClick={() => kisayol("PORTFOY", "OFISIM")}><b>{benimSay("PORTFOY", "BENIM") + benimSay("PORTFOY", "OFIS")}</b><span>Ofisin portföyleri</span></button>
      </div> : <p className="ipucu">Telefonunuzu ve ofis arkadaşlarınızı Ayarlar › “Benim ve ofisim”de tanıtın; kendi ilanlarınız WhatsApp gruplarından gelse de ★ Benim olarak ayrılır.</p>}
      <BugunPanosu es={es} sahip={sahip} />
    </section>
    {/* v3.21 — Notion gizli (src/lib/ozellikler.ts): davet yalnızca Google içindir. Canlıda: Google bu kurulumda açıksa ve kullanıcı bağlayabiliyorsa. */}
    {(() => {
      const notionEksik = notionAcik() && bag.notion.durum !== "BAGLI", googleEksik = bag.google.durum !== "BAGLI" && (!CANLI.acik || (!!d.googleCanli?.hazir && !!d.googleCanli?.yetkili));
      if (!notionEksik && !googleEksik) return null;
      return <Kapanir id={notionAcik() ? "baglan-davet" : "baglan-davet-google"}><button className="kart baglan-davet" onClick={() => git({ ad: "baglantilar" })}>
        <span className="bd-logolar">{notionAcik() && <span className="bk-logo notion">N</span>}<span className="bk-logo google">G</span></span>
        <span><b>{notionEksik && googleEksik ? "Notion ve Google Kişiler'i bağlayın" : notionEksik ? "Notion'u da bağlayın" : "Google ile bağlanın"}</b><br /><small>{notionAcik() ? "Mevcut talep, portföy ve kişileriniz tek seferde gelsin, hemen eşleştirmeye girsin." : "Telefon rehberiniz ile Anahtar CRM çift yönlü eşitlensin: telefona kaydettiğiniz kişi buraya düşsün, burada eklediğiniz telefona gitsin."}</small></span>
        <Ikon ad="baglanti" /></button></Kapanir>;
    })()}
    <GelenKutusuKarti />
    <div className="istat">
      {([[aktif.filter((k) => k.veri.tip === "TALEP").length, "Aktif talep", () => git({ ad: "liste", tip: "TALEP" })], [aktif.filter((k) => k.veri.tip === "PORTFOY").length, "Aktif portföy", () => git({ ad: "liste", tip: "PORTFOY" })], [sunulabilir.length, "Sunulabilir eşleşme", () => git({ ad: "eslesmeler" })], [yaklasan.length, "14 gün içinde süresi dolacak", () => git({ ad: "suresi" })]] as const).map(([n, l, f]) =>
        <button key={l} className="istat-kutu" onClick={f}><b>{n}</b><span>{l}</span></button>)}
    </div>

    <section>
      <div className="bolum-bas"><h3>En güçlü eşleşmeler</h3><button className="btn kucuk" onClick={() => git({ ad: "eslesmeler" })}>Tümü</button></div>
      {sunulabilir.slice(0, 3).map((e) => <EslesmeKarti key={eKey(e.t.id, e.p.id)} e={e} />)}
      {!sunulabilir.length && <p className="bos">Şu an sunulabilir eşleşme yok.</p>}
    </section>

    {acil.length > 0 && <section>
      <div className="bolum-bas"><h3>Acil talepler ({acil.length})</h3>{acil.length > 3 && <button className="btn kucuk" onClick={() => setAcilHepsi(!acilHepsi)}>{acilHepsi ? "Daralt" : "Tümü"}</button>}</div>
      {(acilHepsi ? acil : acil.slice(0, 3)).map((k) => <KayitKart key={k.id} k={k} />)}
    </section>}

  </div>;
}

// ───────────────────────────── Liste ─────────────────────────────
export function KayitKart({ k, sec, uzat }: { k: Kayit; sec?: { on: boolean; degis: () => void }; uzat?: boolean }) {
  const { git, d } = useDepo();
  const v = k.veri;
  const sahip = useSahiplik()(v).tur;
  // v3.26 — kaynak etiketindeki kişi (ör. "Emlakçı · Ayşegül emlak") alt satırda tekrar yazılmaz
  const kimAd = sade(kimOf(v as any, d.kisiler).ad);
  const kisiAdlari = (v.kisiler ?? []).map((b) => d.kisiler.find((x) => x.id === b.kisiId)?.adSoyad).filter((a): a is string => !!a && !(kimAd && kimAd.includes(sade(a))));
  const kalan = kalanGun(v);
  const uzatGoster = uzat ?? (kalan != null && kalan <= UZAT_ESIK_GUN && (v.durum === "ACTIVE" || v.durum === "EXPIRED"));
  return <div className={cx("kart-sar", sec && "secmeli", sec?.on && "secili")}>{sec && <button type="button" className="kart-sec" aria-pressed={sec.on} aria-label={sec.on ? "Paylaşımdan çıkar" : "Paylaşıma ekle"} onClick={sec.degis}>{sec.on ? "✓" : "+"}</button>}<button className={cx("kart kayit-kart", v.durum !== "ACTIVE" && "soluk", sahip === "BENIM" && "benim", sahip === "OFIS" && "ofisim")} onClick={() => git({ ad: "detay", id: k.id })}>
    <div className="pill-satir">
      <Pill ton={v.tip === "TALEP" ? "mavi" : "yesil"}>{tipYaz(v)}</Pill>
      <IslemPill islem={v.islemTipi} />
      {v.tip === "TALEP" && (v.aciliyet === "ACIL" || v.aciliyet === "YUKSEK") && <Pill ton="kotu">{etiket(v.aciliyet)}</Pill>}
      {v.durum !== "ACTIVE" && <Pill>{etiket(v.durum)}</Pill>}
      <TTL v={v} />
    </div>
    <div className="pill-satir"><SahiplikRozeti s={sahip} /><KimPill v={v} /></div>
    <div className={cx("kk-govde", (k.fotolar?.length ?? 0) > 0 && "fotolu")}>
      {/* v3.22 — yüklü fotoğraf varsa kapak, tek küçük görsel olarak (eski "▣ N foto" rozeti yerine) */}
      <KapakKucuk k={k} />
      <div className="kk-sol">
        <div className="kk-baslik">{baslikOf(v)}</div>
        <div className="kk-alt">{v.lokasyonlar.map(lokEtiket).join(" · ") || "Konum yok"}</div>
        {kisiAdlari.length > 0 && <div className="kk-alt">{kisiAdlari.join(", ")}</div>}
        {oneCikanlar(v).length > 0 && <div className="cip-satir">{oneCikanlar(v).map((c) => <span key={c} className="cip">{c}</span>)}</div>}
      </div>
      <div className="kk-sag"><b>{fiyatOf(v)}</b><span>{m2Of(v)}</span><IlanNoCip v={v} /></div>
    </div>
  </button><div className="kart-anahtar"><AnahtarDugmesi anahtar={v.tip === "TALEP" ? favTalep(k.id) : favPortfoy(k.id)} /></div>
    {(v.aciklama || uzatGoster) && <div className="kart-ek">{v.aciklama ? <Aciklama metin={v.aciklama} /> : <span />}{uzatGoster && <UzatDugmesi k={k} />}</div>}
  </div>;
}
const sade = (x?: string | null) => (x ?? "").toLocaleLowerCase("tr").replace(/[^0-9a-zçğıöşü]/g, "");

/** v3.16 — Talep / portföy listesini metin olarak paylaşma: istenenler seçilir, hazır metin kopyalanır ya da WhatsApp'a verilir.
 *  Kişi adı ve telefonu varsayılan olarak çıkmaz (müşteri bilgisi yanlışlıkla paylaşılmasın). */
function ListePaylas({ tip, kayitlar, secili, setSecili }: { tip: "TALEP" | "PORTFOY"; kayitlar: Kayit[]; secili: Set<string>; setSecili: (s: Set<string>) => void }) {
  const { d } = useDepo();
  const [iletisim, setIletisim] = useState(false);
  const sec = kayitlar.filter((k) => secili.has(k.id));
  const satir = (k: Kayit) => {
    const v = k.veri;
    const konum = v.lokasyonlar.map(lokEtiket).filter(Boolean).join(", ");
    const kisi = iletisim ? (v.kisiler ?? []).map((b) => d.kisiler.find((x) => x.id === b.kisiId)).filter(Boolean).map((x) => `${x!.adSoyad}${x!.telefon ? " " + telYaz(x!.telefon) : ""}`).join(" / ") : "";
    return ["• " + baslikOf(v), konum, fiyatOf(v), m2Of(v), v.odaSayisi, kisi].filter(Boolean).join(" · ");
  };
  const metin = [`${tip === "TALEP" ? "Talepler" : "Portföyler"} (${sec.length})`, ...sec.map(satir)].join("\n");
  return <section className="kart yigin kucuk-bosluk">
    <div className="satir sar">
      <button className="btn kucuk" onClick={() => setSecili(secili.size === kayitlar.length ? new Set() : new Set(kayitlar.map((k) => k.id)))}>{secili.size === kayitlar.length ? "Seçimi kaldır" : "Tümünü seç"}</button>
      <label className="onay-satir"><input type="checkbox" checked={iletisim} onChange={(e) => setIletisim(e.target.checked)} /> Kişi adı ve telefonu da eklensin</label>
      <Kopyala metin={metin} etiketi={`Metni kopyala (${sec.length})`} />
      <a className={cx("btn kucuk", !sec.length && "pasif")} aria-disabled={!sec.length} href={`https://wa.me/?text=${encodeURIComponent(metin)}`} target="_blank" rel="noreferrer">WhatsApp'ta paylaş</a>
    </div>
    <p className="ipucu">Aşağıdaki kartların solundaki <b>+</b> ile tek tek seçin{sec.length ? ` — ${sec.length} seçili` : ""}.</p>
    {sec.length > 0 && <details><summary className="ipucu">Metni gör</summary><textarea readOnly rows={Math.min(12, sec.length + 2)} aria-label="Paylaşılacak metin" value={metin} /></details>}
  </section>;
}

function Liste({ tip, baslangic }: { tip: "TALEP" | "PORTFOY"; baslangic?: Filtre }) {
  const { d, git, guncelle, bildir } = useDepo();
  const [duzeltMod, setDuzeltMod] = useState(false); // v3.36 — toplu kaynak düzeltme (WhatsApp'tan yanlış "Kendi portföyüm" gelenler)
  const [duzeltSecili, setDuzeltSecili] = useState<Set<string>>(() => new Set());
  // v3.21.2 — filtre ve sıralama ekran sökülse de korunur (karta girip Geri deyince liste aynı süzgeçle açılır)
  const [f, setF] = useKalici<Filtre>(`liste.${tip}.f`, () => baslangic ?? bosFiltre({ durumlar: ["ACTIVE"] }));
  const hepsi = d.kayitlar.filter((k) => k.veri.tip === tip);
  const kisiAd = (id: string) => d.kisiler.find((k) => k.id === id)?.adSoyad ?? "";
  const kisiRol = (id: string) => d.kisiler.find((k) => k.id === id)?.roller ?? [];
  const [sr, setSr] = useKalici<Siralama>(`liste.${tip}.sr`, { alan: "giris", yon: "azalan" });
  const [paylasAcik, setPaylasAcik] = useState(false); // v3.16 — seçili/tüm kayıtları metin olarak paylaş
  const [paylasSecili, setPaylasSecili] = useState<Set<string>>(() => new Set()); // v3.26 — kartların yanında tek tek seçim
  const secenek = kayitSiralama(tip);
  const sahip = useSahiplik();
  const sahipTur = (v: Veri) => sahip(v).tur;
  const liste = siralaUygula(hepsi.filter((k) => filtreUygula(k.veri, f, kisiAd, kisiRol, sahipTur)), sr, secenek);
  // v3.22 — Benim · Ofisim · Diğer: süzgecin geri kalanı uygulanmış sayılar
  const sahipSayilari = sahiplikSay(hepsi.filter((k) => filtreUygula(k.veri, { ...f, sahiplik: null }, kisiAd, kisiRol)), (k) => sahipTur(k.veri));
  return <div className="yigin">
    <div className="satir-ara"><h2>{tip === "TALEP" ? "Talepler" : "Portföyler"}</h2><button className="btn birincil liste-yeni" onClick={() => git({ ad: "form", tip })}>+ Yeni {tip === "TALEP" ? "talep" : "portföy"}</button></div>
    <FiltrePaneli f={f} set={setF} ogeler={hepsi.map((k) => k.veri)} sirala={<SiralaDugmesi secenekler={secenek} s={sr} set={setSr} />} />
    <SahiplikCipleri deger={f.sahiplik ?? null} set={(x) => setF({ ...f, sahiplik: x })} sayilar={sahipSayilari} />
    <div className="satir-ara"><div className="ipucu">{liste.length} / {hepsi.length} kayıt</div>
      <span className="satir">
        {tip === "PORTFOY" && liste.length > 0 && <button className="btn kucuk" onClick={() => { setDuzeltMod(!duzeltMod); setPaylasAcik(false); setDuzeltSecili(new Set()); }}>{duzeltMod ? "Toplu düzeltmeyi kapat" : "Toplu düzelt"}</button>}
        {liste.length > 0 && <button className="btn kucuk" onClick={() => { setPaylasAcik(!paylasAcik); setDuzeltMod(false); }}>{paylasAcik ? "Paylaşımı kapat" : "Paylaş"}</button>}</span></div>
    {paylasAcik && liste.length > 0 && <ListePaylas tip={tip} kayitlar={liste} secili={paylasSecili} setSecili={setPaylasSecili} />}
    {duzeltMod && <div className="toplu-cubuk">
      <label className="onay-satir"><input type="checkbox" checked={liste.length > 0 && liste.every((k) => duzeltSecili.has(k.id))} onChange={(e) => setDuzeltSecili(e.target.checked ? new Set(liste.map((k) => k.id)) : new Set())} /> Listedekilerin tümü ({liste.length})</label>
      <TopluKaynakSecici sayi={duzeltSecili.size} uygula={(s) => { const n = duzeltSecili.size; guncelle((x) => ({ ...x, kayitlar: x.kayitlar.map((k) => (duzeltSecili.has(k.id) ? { ...k, veri: kaynakUygula(k.veri as any, s) } : k)) })); setDuzeltSecili(new Set()); bildir(`${n} portföyün kaynağı değişti — eşleşmeler yeniden hesaplandı`); }} />
    </div>}
    {liste.map((k) => <KayitKart key={k.id} k={k} sec={duzeltMod ? { on: duzeltSecili.has(k.id), degis: () => { const y = new Set(duzeltSecili); y.has(k.id) ? y.delete(k.id) : y.add(k.id); setDuzeltSecili(y); } } : paylasAcik ? { on: paylasSecili.has(k.id), degis: () => { const y = new Set(paylasSecili); y.has(k.id) ? y.delete(k.id) : y.add(k.id); setPaylasSecili(y); } } : undefined} />)}
    {!liste.length && <p className="bos">Bu filtrede kayıt yok.</p>}
  </div>;
}

// ───────────────────────────── Detay ─────────────────────────────
const GRUP_SIRASI = ["Alan", "Konut", "Yükseklik & Erişim", "Enerji", "Yangın & Güvenlik", "Hukuki", "İklim & Gıda", "Yapı", "Sosyal alanlar", "Cephe & Trafik", "Konum avantajı", "Kullanım", "Turizm", "Kira & Devir"];
function degerYaz(alan: Alan, v: unknown, talep: boolean): string {
  const m = MULK_OZELLIK_META[alan] as any;
  if (alan === "istenenKatlar") return katYaz(v as string[]); // v3.15
  if (v instanceof Date || (typeof v === "string" && /^\d{4}-\d\d-\d\dT/.test(v))) return new Date(v as string).toLocaleDateString("tr-TR");
  let s = etiket(v);
  if (m.birim && typeof v === "number") s += " " + m.birim;
  if (talep && typeof v === "number") s = (m.karsilastirma === "max" ? "en fazla " : m.karsilastirma === "min" ? "en az " : "") + s;
  if (talep && m.karsilastirma === "sirali") s = "en az " + s;
  if (talep && v === true) s = "İstiyor";
  return s;
}
function Detay({ id }: { id: string }) {
  const { d, kayitKaydet, git, bildir } = useDepo();
  const k = d.kayitlar.find((x) => x.id === id);
  const es = useEslesmeler();
  const [hamAcik, setHamAcik] = useState(true);
  const [tarihAcik, setTarihAcik] = useState(false);
  const [kisiDuzen, setKisiDuzen] = useState(false);
  const [paylasAcik, setPaylasAcik] = useState(false);
  if (!k) return <p className="bos">Kayıt bulunamadı.</p>;
  const v = k.veri, o = (v.ozellik ?? {}) as Record<string, any>, talep = v.tip === "TALEP";
  const benim = es.filter((e) => (talep ? e.t.id : e.p.id) === id).sort((a, b) => (talep ? katmanSirasi(a.p.veri) - katmanSirasi(b.p.veri) : 0) || 0);
  const firsat = !talep && havuzKatmani(v as any) === "WEB" ? portfoyEdinmeFirsati(benim.map((e) => e.s.skor)) : null;
  const gruplar = GRUP_SIRASI.map((g) => [g, (Object.keys(MULK_OZELLIK_META) as Alan[]).filter((a) => (MULK_OZELLIK_META[a] as any).grup === g && o[a] != null && !(Array.isArray(o[a]) && !o[a].length))] as const).filter(([, a]) => a.length);
  const durumYap = (durum: Veri["durum"]) => { kayitKaydet({ ...k, veri: { ...v, durum } }); bildir(etiket(durum) + " yapıldı"); };
  const uzat = (gun: number) => { const y = sureUzat(v, gun); kayitKaydet({ ...k, veri: y }); bildir(`Geçerlilik ${tarihYaz(y.validUntil)} tarihine uzatıldı`); };
  const kanal = v.veriKanali === "WHATSAPP" ? "WhatsApp" : (VERI_KANALI_ETIKET as any)[v.veriKanali];
  const celiski = tipCeliskisi(v as any); // v3.27 — metin başka tip diyor ("SATILIK ARSA" yazıyor, tip Ofis)
  const yillikSuphe = !talep ? kiraPeriyotSuphesi(v as any) : null; // v3.27 — "aylık" kira birim olarak akla yatkın değil
  return <div className="yigin">
    {/* v3.13 — üst satır: solda geri, sağda Düzenle + (portföyde) Portföy paylaş. Önceden paylaş düğmesi başlığın altındaydı, üst sağ boştu. */}
    {/* v3.37 — Pasife al / Arşivle / Tekrar aktifleştir üst satırda (eskiden sayfanın en altındaydı) */}
    <div className="detay-ust">
      <div className="satir sar">
        <AnahtarDugmesi anahtar={talep ? favTalep(k.id) : favPortfoy(k.id)} kucuk={false} etiket />
        <button className="btn kucuk" onClick={() => git({ ad: "form", tip: v.tip, id: k.id })}>Düzenle</button>
        {!talep && <button className="btn kucuk birincil" id="portfoy-paylas" onClick={() => setPaylasAcik(true)}>Portföy paylaş</button>}
        {v.durum === "ACTIVE" ? <><button className="btn kucuk" id="d-pasif" onClick={() => durumYap("PASSIVE")}>Pasife al</button><button className="btn kucuk" id="d-arsiv" onClick={() => durumYap("ARSIV")}>Arşivle</button></>
          : <button className="btn kucuk" id="d-aktif" onClick={() => durumYap("ACTIVE")}>Tekrar aktifleştir</button>}
      </div>
    </div>
    {(celiski || yillikSuphe != null) && <section className="kart">
      {celiski && <div className="uyari-satir">Kontrol: metinde "{celiski.kelime}" yazıyor ama mülk tipi {tipYaz(v)}. Tip yanlışsa eşleşmeler de yanlış çıkar — Düzenle'den düzeltin.</div>}
      {yillikSuphe != null && <div className="uyari-satir">Kontrol: aylık kira m² başına {yillikSuphe.toLocaleString("tr-TR")} TL görünüyor — fiyat yıllık girilmiş olabilir. Eşleştirmede 12'ye bölünerek karşılaştırılıyor; doğruysa Düzenle'den periyodu "Yıllık" yapın.</div>}
    </section>}
    <section className="kart">
      <div className="pill-satir">
        <Pill ton={talep ? "mavi" : "yesil"}>{talep ? "Talep" : "Portföy"}</Pill><Pill>{tipYaz(v)}</Pill><IslemPill islem={v.islemTipi} />
        {talep && v.aciliyet !== "NORMAL" && <Pill ton={v.aciliyet === "DUSUK" ? "notr" : "kotu"}>{etiket(v.aciliyet)}</Pill>}
        {v.durum !== "ACTIVE" && <Pill>{etiket(v.durum)}</Pill>}<TTL v={v} />
      </div>
      <h2 className="d-baslik">{baslikOf(v)}</h2>
      {v.aciklama && <p className="d-aciklama">{v.aciklama}</p>}
      <SahiplikSecici k={k} />
      <div className="izgara">
        <div><span>{talep ? "Bütçe" : "Fiyat"}</span><b>{fiyatOf(v)}</b></div>
        {/* v3.37 — ilan numarası fiyatın yanında; dokununca portalda açılır, numara kopyalanır */}
        {v.portalIlanNo && <div className="d-ilan-no"><span>İlan no</span><b><IlanNoCip v={v} baglanti /><Kopyala metin={String(v.portalIlanNo)} /></b></div>}
        <div><span>Alan</span><b>{m2Of(v) || "—"}</b></div>
        <div><span>Ana kategori</span><b>{etiket(v.anaKategori)}</b></div>
        <div><span>İlan sahibi</span><b>{(ILAN_SAHIBI_ETIKET as any)[v.ilanSahibiTipi]}</b></div>
        {!talep && <div><span>Havuz akışı</span><b><HavuzRozeti v={v} /></b></div>}
        {!talep && (v.yetkili || v.yetkiBelgeNo || v.tasinmazNo) && <div><span>Yetki</span><b>{v.yetkili ? "Yetki belgeli" : "Belge bilgisi var"}{v.yetkiBitis ? ` · ${tarihYaz(v.yetkiBitis)}'e kadar` : ""}{v.yetkiBelgeNo ? ` · No ${v.yetkiBelgeNo}` : ""}{v.tasinmazNo ? ` · Taşınmaz ${v.tasinmazNo}` : ""}</b></div>}
        {v.alternatifMulkTipleri?.length ? <div><span>Alternatif tipler</span><b>{etiket(v.alternatifMulkTipleri)}</b></div> : null}
        {v.odaSayisi && <div><span>Oda</span><b>{v.odaSayisi}</b></div>}
        {v.netM2 != null && <div><span>Net alan</span><b>{v.netM2.toLocaleString("tr-TR")} m²</b></div>}
        {v.krediyeUygun != null && <div><span>Krediye uygun</span><b>{v.krediyeUygun ? (talep ? "İstiyor" : "Evet") : "Hayır"}</b></div>}
        {v.takasaAcik != null && <div><span>Takasa açık</span><b>{v.takasaAcik ? "Evet" : "Hayır"}</b></div>}
        <div><span>Kayda giriş</span><b>{tarihYaz(k.olusturma)}</b></div>
      </div>
      <div className="gecerlilik">
        {suresizMi(v.validUntil) ? <div><span className="ipucu">Geçerlilik</span> <b>Süresiz</b> <span className="ipucu">— ★ Benim kayıtlar siz pasife alana ya da arşivleyene kadar açık kalır</span></div> : <>
        <div><span className="ipucu">Geçerlilik</span> <b>{tarihYaz(v.validUntil)}</b> <TTL v={v} /></div>
        <div className="satir sar"><button className="btn kucuk" onClick={() => uzat(30)}>+30 gün</button>
          <button className="btn kucuk" onClick={() => setTarihAcik(!tarihAcik)}>Tarih seç</button>
          {tarihAcik && <input type="date" id="d-gecerlilik" style={{ maxWidth: "11rem" }} defaultValue={v.validUntil ? new Date(v.validUntil).toISOString().slice(0, 10) : ""} onChange={(e) => { if (e.target.value) { kayitKaydet({ ...k, veri: { ...v, validUntil: new Date(e.target.value + "T12:00:00"), durum: v.durum === "EXPIRED" ? "ACTIVE" : v.durum } }); bildir("Geçerlilik güncellendi"); } }} />}
        </div></>}
      </div>
    </section>

    <section className="kart">
      <h3>Lokasyon{v.lokasyonlar.length > 1 ? "lar" : ""}</h3>
      <div className="cip-satir">{v.lokasyonlar.map((l, i) => <span key={i} className="cip buyuk">{lokEtiket(l)} <small>{l.altBolgeId ? "alt bölge" : l.mahalleId ? "mahalle" : l.ilceId ? "ilçe" : "il"}{l.birincil ? " · birincil" : ""}</small></span>)}{!v.lokasyonlar.length && <span className="bos">Konum yok</span>}</div>
      {v.lokasyonHam && <p className="ipucu">Mesajdaki ifade: “{v.lokasyonHam}”</p>}
    </section>

    {!talep && <Fotograflar k={k} />}
    {paylasAcik && <PortfoyPaylas k={k} kapat={() => setPaylasAcik(false)} teknik={gruplar.flatMap(([, alanlar]) => alanlar.map((a) => [(MULK_OZELLIK_META[a] as any).etiket as string, degerYaz(a, o[a], false)] as [string, string])).filter(([, x]) => x && x.length <= 40)} />}

    {firsat?.var && <FirsatBandi sayi={firsat.sayi} />}
    <section className="kart">
      <div className="satir-ara"><h3>Kişiler</h3><button className="btn kucuk" onClick={() => setKisiDuzen(!kisiDuzen)}>{kisiDuzen ? "Tamam" : "Kişi ekle / değiştir"}</button></div>
      {kisiDuzen ? <KisiSecici secili={v.kisiler ?? []} degis={(b) => { kayitKaydet({ ...k, veri: { ...v, kisiler: b as any } }); }} varsayilanRol={talep ? "MUSTERI" : "SAHIP"} oneri={{ ad: v.gondeAdi, telefon: v.gondeTelefon, sirket: v.gondeSirket }} />
        : (v.kisiler ?? []).length ? <div className="yigin kucuk-bosluk">{(v.kisiler ?? []).map((b) => { const ki = d.kisiler.find((x) => x.id === b.kisiId); return ki ? <div key={b.kisiId + b.rol} className="kisi-satir-sar"><button className="kisi-satir" onClick={() => git({ ad: "kisi", id: ki.id })}><span className="avatar kucuk">{ki.adSoyad[0]?.toLocaleUpperCase("tr")}</span><span><b>{ki.adSoyad}</b> <small className="ipucu">{KAYIT_ROLLERI.find((r) => r[0] === b.rol)?.[1]}</small><br /><span className="tel">{telYaz(ki.telefon)}</span>{ki.sirket ? <span className="ipucu"> · {ki.sirket}</span> : null}</span></button><IletisimDugmeleri tel={ki.telefon} ad={ki.adSoyad} mesaj={selamMetni(ki.adSoyad, `${baslikOf(v)} ${talep ? "talebinizle" : "mülkünüzle"} ilgili yazıyorum.`)} kucuk /></div> : null; })}</div>
        : <p className="ipucu">Kişi bağlı değil.{v.gondeAdi || v.gondeTelefon ? ` Mesajı gönderen: ${v.gondeAdi ?? ""} ${telYaz(v.gondeTelefon)}` : ""}</p>}
    </section>

    <IlgilenenlerBolumu k={k} />
    <GorusmeNotlari k={k} />

    {/* v3.16 — portal arama bağlantıları ekranda yer kaplamasın: katlanır, kapalı başlar */}
    {talep && <section className="kart">
      <details><summary><b>Portallarda ara</b></summary>
      <p className="ipucu">Hazır arama bağlantıları — portal sayfası açılır, sonuçlara siz bakarsınız.</p>
      <div className="portal-linkleri">{portalLinkleri({ aileKodu: aileOf(v.mulkTipi as any).kod, islemTipi: v.islemTipi, ilceler: [...new Set(v.lokasyonlar.map((l) => INDEKS.ilceler.find((i) => i.id === l.ilceId)?.ad).filter(Boolean) as string[])], maxFiyat: v.maxFiyat, minFiyat: v.minFiyat }).map((l) => <a key={l.url} className={"portal-link pl-" + l.portal} href={l.url} target="_blank" rel="noreferrer"><b>{l.portal}</b><span>{l.etiket}</span><small>{l.not}</small></a>)}</div>
      </details>
    </section>}

    {talep && <TalepTercihleri k={k} />}

    {gruplar.length > 0 && <section className="kart">
      <h3>Teknik özellikler{talep ? " (müşterinin istediği)" : ""}</h3>
      {gruplar.map(([g, alanlar]) => <div key={g} className="tgrup"><div className="ust-etiket">{g}</div>
        <dl>{alanlar.map((a) => <div key={a}><dt>{(MULK_OZELLIK_META[a] as any).etiket}</dt><dd>{degerYaz(a, o[a], talep)}</dd></div>)}</dl></div>)}
    </section>}
    {v.ozelSartlar?.length ? <section className="kart"><h3>Özel şartlar</h3><div className="cip-satir">{v.ozelSartlar.map((s) => <span key={s} className="cip">{s}</span>)}</div></section> : null}

    <section className="kart kaynak">
      <h3>Kaynak</h3>
      <div className="izgara">
        <div><span>Kanal</span><b>{kanal}</b></div>
        {v.kayitGrubu && <div><span>Grup</span><b>{v.kayitGrubu}</b></div>}
        {v.mesajTarihi && <div><span>Mesaj tarihi</span><b>{tarihYaz(v.mesajTarihi, true)}</b></div>}
        {(v.gondeAdi || v.gondeTelefon) && <div><span>Gönderen</span><b>{[v.gondeAdi, telYaz(v.gondeTelefon)].filter(Boolean).join(" · ")}</b></div>}
        {v.kaynakDosya && <div><span>Dosya</span><b>{v.kaynakDosya}</b></div>}
        {v.portalUrl && !v.portalIlanNo && <div><span>İlan</span><b><a href={v.portalUrl} target="_blank" rel="noreferrer">Bağlantı</a></b></div>}
        <div><span>Sisteme giriş</span><b>{tarihYaz(k.olusturma)}</b></div>
        <IlkKaynakSatirlari v={v as any} />
      </div>
      {v.hamMetin ? <><button className="btn kucuk" onClick={() => setHamAcik(!hamAcik)}>{hamAcik ? "Orijinal mesajı gizle" : "Orijinal mesajı göster"}</button>
        {hamAcik && <div className="wa-balon"><div className="wa-ust">{v.gondeAdi ?? telYaz(v.gondeTelefon) ?? "Gönderen"}{v.mesajTarihi ? ` · ${tarihYaz(v.mesajTarihi, true)}` : ""}{v.kayitGrubu ? ` · ${v.kayitGrubu}` : ""}</div><div className="wa-metin">{v.hamMetin}</div></div>}</> : <p className="ipucu">Orijinal mesaj yok (elle girildi).</p>}
    </section>

    {/* v3.35 — randevular: gösterim / görüşme ve sonucu */}
    <RandevuKarti kayitId={k.id} talep={talep} kisiId={(v.kisiler as any)?.[0]?.kisiId ?? null} karsilar={benim.filter((e) => e.s.uygunluk !== "UYGUN_DEGIL").map((e) => { const o2 = talep ? e.p : e.t; return { id: o2.id, baslik: baslikOf(o2.veri) }; })} />

    <section>
      <div className="bolum-bas"><h3>Eşleşmeler ({benim.filter((e) => e.s.uygunluk !== "UYGUN_DEGIL").length})</h3></div>
      {benim.filter((e) => e.s.uygunluk !== "UYGUN_DEGIL").map((e) => <EslesmeKarti key={eKey(e.t.id, e.p.id)} e={e} />)}
      {!benim.some((e) => e.s.uygunluk !== "UYGUN_DEGIL") && <p className="bos">Uygun eşleşme yok{benim.length ? ` (${benim.length} aday elendi — Eşleşmeler ekranında "Uygun değil" filtresinde nedenleri görünür)` : ""}.</p>}
    </section>

    {v.durum === "ACTIVE" && <EslesmeCekmecesi k={k} />}
  </div>;
}

const KIMIN_ETIKET = { BENIM: "★ Benim", OFISIM: "◆ Ofisim", BENIM_PORTFOY: "Portföyüm", BENIM_TALEP: "Talebim" } as const;
const KIMIN_ALT: Record<string, string | undefined> = { "": undefined, BENIM: "Talebi ya da portföyü benim", OFISIM: "Benim ya da ofisimin", BENIM_PORTFOY: "Portföy benim — alıcı / kiracı arıyorum", BENIM_TALEP: "Talep benim — mülk arıyorum" };
function Eslesmeler() {
  const { d } = useDepo();
  const hepsi = useEslesmeler(true);
  // v3.21.2 — tüm süzgeçler ekran sökülse de korunur (karta girip Geri deyince aynı liste, aynı yerde açılır)
  const [u, setU] = useKalici<"UYGUN" | Uygunluk | "TUMU" | "KOPUK">("eslesmeler.u", "UYGUN");
  const kopukMu = (e: Eslesme) => d.eslesmeNotlari[eKey(e.t.id, e.p.id)]?.durum === "REDDEDILDI";
  const [f, setF] = useKalici<Filtre>("eslesmeler.f", () => bosFiltre());
  const [minSkor, setMinSkor] = useKalici<number>("eslesmeler.seviye", 0); // v3.36 — en az uyum seviyesi (0 = tümü, 2–5)
  const [takip, setTakip] = useKalici<string[]>("eslesmeler.takip", []);
  const [fk, setFk] = useKalici<FirsatKademe | "">("eslesmeler.fk", "");          // v3.19 — fırsat kademesi filtresi
  const [sr, setSr] = useKalici<Siralama>("eslesmeler.sr", { alan: "firsat", yon: "azalan" });
  const [kimin, setKimin] = useKalici<"" | "BENIM" | "OFISIM" | "BENIM_PORTFOY" | "BENIM_TALEP">("eslesmeler.kimin", ""); // v3.22
  // v3.27 — güveni düşük (talepte / portföyde çok az kriter ölçülebilmiş) eşleşmeler varsayılan olarak gizli; tek dokunuşla açılır
  const [azVeriGoster, setAzVeriGoster] = useKalici<boolean>("eslesmeler.azVeri", false);
  const azVeri = (e: Eslesme) => e.s.guven?.seviye === "DUSUK";
  const sahip = useSahiplik();
  const [secimModu, setSecimModu] = useState(false);            // v3.19 — toplu işlem için seçim
  const [secili, setSecili] = useState<Set<string>>(() => new Set());
  const [topluAcik, setTopluAcik] = useState<null | "KOPAR" | "GERI">(null);
  const kisiAd = (id: string) => d.kisiler.find((k) => k.id === id)?.adSoyad ?? "";
  const kisiRol = (id: string) => d.kisiler.find((k) => k.id === id)?.roller ?? [];
  const es = hepsi.filter((e) => {
    const ara = f.ara.toLocaleLowerCase("tr");
    if (ara && !`${baslikOf(e.t.veri)} ${baslikOf(e.p.veri)} ${e.t.veri.gondeAdi ?? ""} ${e.p.veri.gondeAdi ?? ""} ${[...e.t.veri.lokasyonlar, ...e.p.veri.lokasyonlar].map(lokEtiket).join(" ")}`.toLocaleLowerCase("tr").includes(ara)) return false;
    // v3.33 — mülk türü ve işlem PORTFÖYE (önerilen mülke) uygulanır: "Daire / Dükkan" seçiliyken "Depo/Mağaza" talebine önerilen depo
    // görünüyordu (talebin alternatif tipi Dükkan olduğu için talep tarafı süzgeçten geçiyordu). Portföyün kendi tipi esas alınır.
    if (f.aileler.length && !f.aileler.includes(aileOf(e.p.veri.mulkTipi as any).kod)) return false;
    if (f.islemler.length && !f.islemler.some((i) => String(e.p.veri.islemTipi).includes(i))) return false;
    // v3.16: diğer süzgeçler iki tarafa birden uygulanır (talep ya da portföy tutarsa)
    const f2 = { ...f, ara: "", aileler: [], islemler: [] };
    if (!filtreUygula(e.p.veri, f2, kisiAd, kisiRol) && !filtreUygula(e.t.veri, f2, kisiAd, kisiRol)) return false;
    if (minSkor && e.s.seviye < minSkor) return false;
    if (takip.length && !takip.includes(d.eslesmeNotlari[eKey(e.t.id, e.p.id)]?.durum ?? "YENI")) return false;
    return true;
  });
  // v3.22 — Kimin: talep ya da portföy benim / ofisimin olan eşleşmeler
  const st = (e: Eslesme) => sahip(e.t.veri).tur, sp = (e: Eslesme) => sahip(e.p.veri).tur;
  const kiminUyar = (e: Eslesme, k: typeof kimin) => !k || (k === "BENIM" ? st(e) === "BENIM" || sp(e) === "BENIM" : k === "OFISIM" ? !!st(e) || !!sp(e) : k === "BENIM_PORTFOY" ? sp(e) === "BENIM" : st(e) === "BENIM");
  const say = (x: Uygunluk) => es.filter((e) => !kopukMu(e) && e.s.uygunluk === x).length;
  const firsatSay = (k: FirsatKademe) => es.filter((e) => !kopukMu(e) && e.s.uygunluk !== "UYGUN_DEGIL" && e.f.kademe === k).length;
  const kopukSay = es.filter(kopukMu).length;
  const tn = (x?: unknown) => (x ? new Date(x as any).getTime() || null : null);
  const esSecenek: import("../src/lib/siralama").SiralamaSecenegi<Eslesme>[] = [
    // v3.19 — varsayılan: uygunluk → fırsat kademesi (sahibinden ↔ müşteri önde) → skor
    { alan: "firsat", etiket: "Fırsat önceliği", deger: (e) => (e.s.uygunluk === "SUNULABILIR" ? 2 : e.s.uygunluk === "KOSULLU" ? 1 : 0) * 1e7 + e.s.seviye * 1e6 /* v3.36 */ + e.f.sira * 1e3 + e.s.skor, varsayilanYon: "azalan" },
    { alan: "komisyon", etiket: "Tahmini komisyon", deger: (e) => e.f.tahminiKomisyon ?? null, varsayilanYon: "azalan" },
    { alan: "skor", etiket: "Uyum", deger: (e) => e.s.skor, varsayilanYon: "azalan" },
    { alan: "fiyat", etiket: "Portföy fiyatı", deger: (e) => e.p.veri.fiyat ?? null, varsayilanYon: "azalan" },
    { alan: "butce", etiket: "Talep bütçesi", deger: (e) => e.t.veri.maxFiyat ?? null, varsayilanYon: "azalan" },
    { alan: "m2", etiket: "m²", deger: (e) => e.p.veri.m2 ?? null, varsayilanYon: "azalan" },
    { alan: "giris", etiket: "Kayda giriş", deger: (e) => Math.max(tn(e.t.olusturma) ?? 0, tn(e.p.olusturma) ?? 0), varsayilanYon: "azalan" },
    { alan: "sure", etiket: "Talebin kalan süresi", deger: (e) => tn(e.t.veri.validUntil), varsayilanYon: "artan" },
  ];
  const temel = es.filter((e) => (!fk || e.f.kademe === fk) && kiminUyar(e, kimin) && (u === "KOPUK" ? kopukMu(e) : !kopukMu(e) && (u === "TUMU" || (u === "UYGUN" ? e.s.uygunluk !== "UYGUN_DEGIL" : e.s.uygunluk === u))));
  const gizliAzVeri = u === "KOPUK" || azVeriGoster ? 0 : temel.filter(azVeri).length;
  const liste = siralaUygula(gizliAzVeri ? temel.filter((e) => !azVeri(e)) : temel, sr, esSecenek);
  // v3.21.2 — İşlem ve Fırsat seçicileri (eski üç satır + büyük "Fırsat önceliği" kartı yerine tek satır)
  const islemSay = (k: string) => (k ? es.filter((e) => String(e.p.veri.islemTipi).includes(k)).length : es.length);
  const islemDeger = f.islemler.length === 1 ? f.islemler[0] : "";
  const firsatToplam = es.filter((e) => !kopukMu(e) && e.s.uygunluk !== "UYGUN_DEGIL").length;
  const FIRSAT_ALT = { ONCELIKLI: "Mülk sahibi ↔ doğrudan müşteri", NORMAL: "Bir taraf emlakçı — komisyon paylaşılır", DUSUK: "Emlakçı ↔ emlakçı — ikinci plan" } as const;
  const ekCipler = [
    ...(minSkor ? [{ etiket: `Uyum ≥ ${minSkor}/5`, kaldir: () => setMinSkor(0) }] : []),
    ...(fk ? [{ etiket: `Fırsat: ${FIRSAT_KADEME_ETIKET[fk]}`, kaldir: () => setFk("") }] : []),
    ...(kimin ? [{ etiket: KIMIN_ETIKET[kimin], kaldir: () => setKimin("") }] : []),
    ...takip.map((k) => ({ etiket: `Takip: ${PIPELINE.find((p) => p[0] === k)?.[1] ?? k}`, kaldir: () => setTakip(takip.filter((x) => x !== k)) })),
  ];
  return <div className="yigin">
    {/* v3.22 — toplu işlem menüsü (⋯) başlık satırına taşındı; seçici satırında Skor'a yer açıldı */}
    <div className="satir-ara es-baslik"><h2>Eşleşmeler</h2><div className="satir"><span className="ipucu">{liste.length} eşleşme</span>
      {gizliAzVeri > 0 && <button className="btn kucuk" title="Talepte ya da portföyde çok az bilgi olduğu için puanı güvenilir olmayan eşleşmeler" onClick={() => setAzVeriGoster(true)}>+{gizliAzVeri} az verili</button>}
      {azVeriGoster && u !== "KOPUK" && <button className="btn kucuk" onClick={() => setAzVeriGoster(false)}>Az verilileri gizle</button>}
      {!secimModu && <HizliMenu ad="Toplu işlemler" ogeler={[
        { l: "Seç", alt: "Birkaç eşleşmeyi seçip birlikte işlem yap", pasif: !liste.length, tikla: () => setSecimModu(true) },
        ...(u !== "KOPUK" ? [{ l: `Listedekilerin tümünü kopar (${liste.length})`, tehlike: true, pasif: !liste.length, tikla: () => setTopluAcik("KOPAR") }] : [{ l: `Tümünü geri al (${liste.length})`, pasif: !liste.length, tikla: () => setTopluAcik("GERI") }]),
      ]} />}</div></div>
    <FiltrePaneli f={f} set={setF} ogeler={[...new Map(hepsi.flatMap((e) => [[e.p.id, e.p.veri], [e.t.id, e.t.veri]] as [string, typeof e.p.veri][])).values()]} gizle={["durum", "kisi"]} yerTutucu="Ara: talep, portföy, kişi, bölge…" sonucEtiketi={`${liste.length} eşleşmeyi göster`} sirala={<SiralaDugmesi secenekler={esSecenek} s={sr} set={setSr} />}
      ekCipler={ekCipler} ekTemizle={() => { setMinSkor(0); setFk(""); setTakip([]); setKimin(""); }}
      ek={[
        { k: "takip", baslik: "Takip durumu", ozet: takip.map((k) => PIPELINE.find((p) => p[0] === k)?.[1]).join(", ") || "Tümü", aktif: takip.length, icerik: <div className="cip-satir">{PIPELINE.map(([k, l]) => { const on = takip.includes(k); return <button key={k} className={cx("cip secilir", on && "on")} onClick={() => setTakip(on ? takip.filter((x) => x !== k) : [...takip, k])}>{l}</button>; })}</div> },
      ]} />
    {/* v3.21.2 — uygunluk: tek tıkla geçilen, tek satırlık kompakt çipler */}
    <div className="filtre filtre-ince">
      <button className={cx("fb", u === "UYGUN" && "on")} onClick={() => setU("UYGUN")}>Uygun ({say("SUNULABILIR") + say("KOSULLU")})</button>
      <button className={cx("fb", u === "SUNULABILIR" && "on")} onClick={() => setU("SUNULABILIR")}>Sunulabilir ({say("SUNULABILIR")})</button>
      <button className={cx("fb", u === "KOSULLU" && "on")} onClick={() => setU("KOSULLU")}>Koşullu ({say("KOSULLU")})</button>
      <button className={cx("fb", u === "UYGUN_DEGIL" && "on")} onClick={() => setU("UYGUN_DEGIL")}>Uygun değil ({say("UYGUN_DEGIL")})</button>
      {kopukSay > 0 && <button className={cx("fb", u === "KOPUK" && "on")} onClick={() => setU("KOPUK")}>Koparılan ({kopukSay})</button>}
    </div>
    {/* v3.21.2 — İşlem · Fırsat önceliği · ⋯ tek satırda. Fırsat önceliği: mülk sahibi ↔ doğrudan müşteri en kazançlı; emlakçı ↔ emlakçı ikinci planda.
        (Eski kartın "tahmini komisyon ≈ …" toplamı kaldırıldı; komisyon her kartta ve "Tahmini komisyon" sıralamasında duruyor.) */}
    {!secimModu && <div className="hs-satir">
      <HizliSecici ad="İşlem" deger={islemDeger} bos="" gosterim={f.islemler.length > 1 ? `${f.islemler.length} seçili` : undefined}
        secenekler={[{ k: "", l: "Tümü", n: islemSay("") }, { k: "SATILIK", l: "Satılık", n: islemSay("SATILIK") }, { k: "KIRALIK", l: "Kiralık", n: islemSay("KIRALIK") }, { k: "DEVREN", l: "Devren", n: islemSay("DEVREN") }]}
        set={(k) => setF({ ...f, islemler: k ? [k] : [] })} />
      <HizliSecici ad="Fırsat" deger={fk} bos=""
        secenekler={[{ k: "", l: "Tümü", n: firsatToplam }, ...(["ONCELIKLI", "NORMAL", "DUSUK"] as const).map((k) => ({ k: k as FirsatKademe | "", l: FIRSAT_KADEME_ETIKET[k], n: firsatSay(k), alt: FIRSAT_ALT[k], nokta: "f-" + k.toLowerCase() }))]}
        set={setFk} />
      <HizliSecici ad="Kimin" deger={kimin} bos="" hiza="sag"
        secenekler={(["", "BENIM", "OFISIM", "BENIM_PORTFOY", "BENIM_TALEP"] as const).map((k) => ({ k, l: k ? KIMIN_ETIKET[k] : "Tümü", n: es.filter((e) => !kopukMu(e) && kiminUyar(e, k)).length, alt: KIMIN_ALT[k] }))}
        set={setKimin} />
      <SkorSecici deger={minSkor} set={setMinSkor} sayi={liste.length} />
    </div>}
    {/* v3.19 — toplu işlem çubuğu (yalnızca seçim modunda) */}
    {secimModu && <div className="toplu-bar">
      <button className="btn kucuk" onClick={() => setSecili(new Set(liste.map((e) => eKey(e.t.id, e.p.id))))}>Tümünü seç ({liste.length})</button>
      <button className="btn kucuk" onClick={() => setSecili(new Set())} disabled={!secili.size}>Seçimi temizle</button>
      <button className={cx("btn kucuk", u === "KOPUK" ? "birincil" : "tehlike")} onClick={() => setTopluAcik(u === "KOPUK" ? "GERI" : "KOPAR")} disabled={!secili.size}>{u === "KOPUK" ? "Seçilenleri geri al" : "Seçilenleri kopar"} ({secili.size})</button>
      <button className="btn kucuk" onClick={() => { setSecimModu(false); setSecili(new Set()); }}>Bitti</button>
    </div>}
    {liste.map((e) => { const a = eKey(e.t.id, e.p.id); return <EslesmeKarti key={a} e={e} sec={secimModu ? { acik: secili.has(a), degis: () => setSecili((x) => { const y = new Set(x); if (y.has(a)) y.delete(a); else y.add(a); return y; }) } : undefined} />; })}
    {!liste.length && <p className="bos">Bu filtrede eşleşme yok.</p>}
    {topluAcik && <TopluKoparPenceresi geriAl={topluAcik === "GERI"} ciftler={(secimModu ? liste.filter((e) => secili.has(eKey(e.t.id, e.p.id))) : liste).map((e) => ({ tid: e.t.id, pid: e.p.id }))} onKapat={() => setTopluAcik(null)} onBitti={() => { setTopluAcik(null); setSecimModu(false); setSecili(new Set()); }} />}
  </div>;
}
/** v3.24 — eşleşme detayında taraf kartı: kişiler ad · telefon · Ara / WhatsApp düğmeleriyle; talepte orijinal metin kısaca.
 *  (Eskiden kartın tamamı tek düğmeydi; içine bağlantı konamadığı için kişiye ulaşmak için kayda gitmek gerekiyordu.) */
function Taraf({ k, rol, ham = false, karsi }: { k: Kayit; rol: string; ham?: boolean; karsi?: Kayit }) {
  const { git, d } = useDepo(); const v = k.veri;
  const sahip = useSahiplik()(v).tur;
  const [uzun, setUzun] = useState(false);
  const kisiler = (v.kisiler ?? []).map((b) => ({ b, ki: d.kisiler.find((x) => x.id === b.kisiId) })).filter((x) => !!x.ki);
  const mesaj = (ad: string) => selamMetni(ad, karsi ? `${baslikOf(v)} ${v.tip === "TALEP" ? "talebinizle" : "mülkünüzle"} ilgili yazıyorum.` : undefined);
  const metin = String(v.hamMetin ?? "").trim();
  return <div className="kart taraf">
    <button type="button" className="taraf-ana" onClick={() => git({ ad: "detay", id: k.id })}>
      <div className="ust-etiket">{rol}</div><div className="pill-satir"><SahiplikRozeti s={sahip} /><KimPill v={v} adli={false} /></div>
      <div className="taraf-bas"><KapakKucuk k={k} boyut={48} /><div className="kk-baslik">{baslikOf(v)}</div></div>
      <div className="kk-alt">{v.lokasyonlar.map(lokEtiket).join(" · ")} · {fiyatOf(v)} {m2Of(v) && "· " + m2Of(v)}</div>
      <IlanNoCip v={v} />
    </button>
    {kisiler.length ? <div className="taraf-kisiler">{kisiler.map(({ b, ki }) => <div key={b.kisiId + b.rol} className="taraf-kisi">
      <button type="button" className="taraf-kisi-ad" onClick={() => git({ ad: "kisi", id: ki!.id })}><b>{ki!.adSoyad}</b> <small className="ipucu">{KAYIT_ROLLERI.find((r) => r[0] === b.rol)?.[1]}</small>{ki!.telefon ? <><br /><span className="tel">{telYaz(ki!.telefon)}</span></> : null}</button>
      <IletisimDugmeleri tel={ki!.telefon} ad={ki!.adSoyad} mesaj={mesaj(ki!.adSoyad)} kucuk />
    </div>)}</div>
      : v.gondeAdi || v.gondeTelefon ? <div className="taraf-kisiler"><div className="taraf-kisi">
        <span className="taraf-kisi-ad"><b>{v.gondeAdi ?? "Gönderen"}</b>{v.gondeTelefon ? <><br /><span className="tel">{telYaz(v.gondeTelefon)}</span></> : null}</span>
        <IletisimDugmeleri tel={v.gondeTelefon} ad={v.gondeAdi ?? undefined} mesaj={v.gondeAdi ? mesaj(v.gondeAdi) : undefined} kucuk />
      </div></div> : null}
    {ham && metin && <div className="taraf-ham"><div className="ust-etiket">Orijinal metin</div>
      <p className={cx("taraf-ham-metin", !uzun && "kisa")}>{metin}</p>
      {metin.length > 180 && <button type="button" className="link-btn" onClick={() => setUzun(!uzun)}>{uzun ? "Kısalt" : "Tamamını göster"}</button>}</div>}
  </div>;
}
function EslesmeDetay({ tid, pid }: { tid: string; pid: string }) {
  const { d, guncelle, git, bildir } = useDepo();
  const es = useEslesmeler(true);
  const e = es.find((x) => x.t.id === tid && x.p.id === pid);
  const anahtar = eKey(tid, pid);
  const n = d.eslesmeNotlari[anahtar] ?? { durum: "YENI" as PipelineDurum, not: "" };
  const [not, setNot] = useState(n.not);
  // v3.37 — operasyon notu yazılıp kaydedilmeden çıkılırsa sorulur
  const notBirak = useKaydedilmemis(not.trim() !== (n.not ?? "").trim(), "Eşleşme operasyon notu", () => { yazNot(); return true; });
  const yazNot = () => { guncelle((dd) => ({ ...dd, eslesmeNotlari: { ...dd.eslesmeNotlari, [anahtar]: { ...(dd.eslesmeNotlari[anahtar] ?? n), not } } })); notBirak(); bildir("Not kaydedildi"); };
  if (!e) return <div className="yigin"><p className="bos">Bu eşleşme artık yok (kayıtlardan biri pasif ya da değişti).</p></div>;
  const [sor, setSor] = useState(false);
  const yaz = (x: Partial<typeof n>) => guncelle((dd) => ({ ...dd, eslesmeNotlari: { ...dd.eslesmeNotlari, [anahtar]: { ...n, ...x } } }));
  const durumDegis = (k: PipelineDurum, l: string) => { if (n.durum === k) return; guncelle((dd) => eslesmeDurumunuUygula(dd, tid, pid, k)); bildir("Durum: " + l); setSor(k === "GORUSULDU" || k === "REDDEDILDI"); };
  const sorulacak = [...new Set([...e.s.kriterler.filter((k) => k.sonuc === "BILINMIYOR").map((k) => k.etiket + " (portföy sahibine)"), ...e.s.dna.eksik.map((x) => x.etiket + " (müşteriye)")])];
  const u = UYGUNLUK[e.s.uygunluk];
  return <div className="yigin">
    {/* v3.37 — "Eşleşmeyi kopar" (açıklamalı) en üstte; koparılmışsa durumu ve "Geri al" aynı yerde */}
    <div className={cx("detay-ust es-ust", n.durum === "REDDEDILDI" && "kopuk")}>
      <div className="satir sar"><AnahtarDugmesi anahtar={favEslesme(tid, pid)} kucuk={false} etiket />{n.durum === "REDDEDILDI" && <b className="ipucu">Bu eşleşme koparıldı — listelerde gösterilmiyor</b>}</div>
      <KoparDugmesi tid={tid} pid={pid} sonra={() => setSor(true)} />
    </div>
    <section className="kart es-bas"><Skor s={e.s.skor} u={e.s.uygunluk} /><div><Pill ton={u.ton}>{e.s.seviye}/5 · {SEVIYE_ETIKET[e.s.seviye]}</Pill> <FirsatRozeti f={e.f} komisyon /><div className="ipucu">{e.s.lokasyonAciklama}</div>
      {e.s.tipUyumu.oran < 1 && <div className="ipucu">Mülk tipi: {e.s.tipUyumu.aciklama}</div>}
      {e.s.guven && <div className="ipucu">Güven: {({ YUKSEK: "yüksek", ORTA: "orta", DUSUK: "düşük" } as const)[e.s.guven.seviye]} · {e.s.guven.aciklama}</div>}
      {(e.s.uyarilar ?? []).map((x) => <div key={x} className="uyari-satir">Kontrol: {x}</div>)}
      {e.s.kritikEngeller.length > 0 && <div className="hata-satir">Olmazsa olmaz karşılanmıyor: {e.s.kritikEngeller.join(", ")}</div>}
      {/* v3.36 — seviye gerekçesi */}
      <div className="gerekce-kutu"><div className="ust-etiket">Neden {e.s.seviye}/5?</div><Gerekceler s={e.s} /><div className="ipucu">{SEVIYE_ACIKLAMA[e.s.seviye]}</div></div></div></section>
    {sor && <SonrakiIletisimSorusu tid={tid} pid={pid} kapat={() => setSor(false)} />}
    <div className="iki-kolon"><Taraf k={e.t} rol="Talep" ham karsi={e.p} /><Taraf k={e.p} rol="Portföy" karsi={e.t} /></div>
    <section className="kart">
      <h3>Kriter dökümü</h3>
      <div className="tablo-sar"><table><thead><tr><th>Kriter</th><th>İstenen</th><th>Portföyde</th><th>Sonuç</th></tr></thead>
        <tbody>{e.s.kriterler.map((k) => <tr key={k.anahtar} className={"r-" + k.sonuc}><td>{k.etiket}{k.kritik && <span className="kritik-rozet">şart</span>}</td><td>{k.talep === "Var" ? "İstiyor" : enumYaz(k.talep)}</td><td>{enumYaz(k.portfoy)}</td><td className="sonuc">{k.sonuc === "SAGLANDI" ? "✓ Uygun" : k.sonuc === "SAGLANMADI" ? "✗ Uymuyor" : "? Bilinmiyor"}</td></tr>)}</tbody></table></div>
      {!e.s.kriterler.length && <p className="bos">Talepte karşılaştırılacak kriter yok.</p>}
    </section>
    <MatrisDokumu s={e.s} />
    {sorulacak.length > 0 && <section className="kart"><h3>Sunmadan önce sorulacaklar</h3><div className="cip-satir">{sorulacak.filter((s) => !cevaplanabilirler(e).some((k) => s.startsWith(k.etiket + " "))).map((s) => <span key={s} className="cip">{s}</span>)}<HizliCevaplar e={e} /></div></section>}
    <section className="kart">
      <h3>Takip</h3>
      <div className="uc sar">{PIPELINE.map(([k, l]) => <button key={k} className={cx(n.durum === k && "on")} onClick={() => durumDegis(k, l)}>{l}</button>)}</div>
      {sor && <SonrakiIletisimSorusu tid={tid} pid={pid} kapat={() => setSor(false)} />}
      <EslesmeGorevleri tid={tid} pid={pid} />
      <label className="alan-etiket" htmlFor="es-not">Operasyon notu</label>
      <textarea id="es-not" rows={3} value={not} onChange={(ev) => setNot(ev.target.value)} placeholder="Görüşme sonrası notunuz…" />
      <div className="satir"><button className="btn" onClick={yazNot}>Notu kaydet</button></div>
    </section>
  </div>;
}

// ───────────────────────────── Test araçları ─────────────────────────────

// ───────────────────────────── Ayarlar ─────────────────────────────
function Ayarlar() {
  const { d, ornekHatalari, guncelle, bildir, git } = useDepo();
  const [ttl, setTtl] = useState(d.ayarlar.ttl);
  const [onay, setOnay] = useState(false);
  const toplam = d.kayitlar.length;
  // v3.21.2 — Konumlar, Bağlantılar ve Yönetim ana menüden buraya taşındı
  const cakisma = (d.cakismalar ?? []).filter((c) => notionAcik() || c.saglayici !== "NOTION").length;
  const gecisler: { k: string; ad: string; ikon: string; acik: string; rozet?: number; git: () => void }[] = [
    { k: "konumlar", ad: "Konumlar", ikon: "konum", acik: "İlçe, mahalle ve bölge sözlüğü; öğrenilen konumlar", git: () => git({ ad: "konumlar" }) },
    ...(baglantilarGorunurMu(d) ? [{ k: "baglantilar", ad: "Bağlantılar", ikon: "baglanti", acik: cakisma ? `${cakisma} eşitleme çakışması seçiminizi bekliyor` : "Google Kişiler ile çift yönlü eşitleme", rozet: cakisma || undefined, git: () => git({ ad: "baglantilar" }) }] : []),
    ...(yetkiAktif("islem.yonet") ? [{ k: "islemler", ad: "İşlemler", ikon: "anahtar", acik: "Kapanan satış ve kiralamalar, komisyon ve aylık bana kalan", git: () => git({ ad: "islemler" }) }] : []),
    ...(yonetimGorunur() ? [{ k: "yonetim", ad: "Yönetim", ikon: "kisi", acik: "Kullanıcılar, davet bağlantıları, ofisler ve planlar", git: () => git({ ad: "yonetim" }) }] : []),
  ];
  return <div className="yigin">
    <h2>Ayarlar</h2>
    <section className="kart ayar-gecis" aria-label="Yönetim ve bağlantılar">
      <h3>Yönetim ve bağlantılar</h3>
      {gecisler.map((g) => <button key={g.k} type="button" className="ayar-gecis-oge" onClick={g.git}>
        <span className="ayar-gecis-ikon"><Ikon ad={g.ikon} /></span>
        <span className="ayar-gecis-metin"><b>{g.ad}</b><small>{g.acik}</small></span>
        {!!g.rozet && <b className="menu-rozet">{g.rozet}</b>}
        <span className="ayar-gecis-ok" aria-hidden="true">›</span>
      </button>)}
    </section>
    {/* v3.32 — ofis ayarlarını yalnızca ofis yöneticisi değiştirir (asistan ve danışman görür, düzenleyemez); sunucu da reddeder */}
    {!yetkiAktif("ofis.ayarlar") && <section className="kart"><p className="ipucu">🔒 {aktifRolEtiketi()} olarak ayarları görebilirsiniz; değiştirmek ofis yöneticisine aittir.</p></section>}
    <fieldset className="yigin" disabled={!yetkiAktif("ofis.ayarlar")} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
    <SahiplikAyarlari />
    <AiAyarlari />
    <PaylasimAyarlari />
    <CalismaIliAyari />
    <RolYonetimi />
    </fieldset>
    {yetkiAktif("kayit.disaAktar") ? <DisaAktar /> : <section className="kart"><h3>Dışa aktar</h3><p className="ipucu">🔒 Verilerin CRM dışına çıkarılması yöneticinin onayıyla yapılır; dışa aktarma bu rolde kapalı.</p></section>}
    <fieldset className="yigin" disabled={!yetkiAktif("ofis.ayarlar")} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
    <section className="kart">
      <h3>Varsayılan geçerlilik süreleri</h3>
      <p className="ipucu">Yeni kayıtlar bu süre sonunda pasife düşer. Her kaydın süresi kendi ekranından uzatılabilir.</p>
      <div className="alanlar">
        {(Object.keys(TTL_ETIKET) as (keyof TtlAyar)[]).map((k) => <div key={k} className="alan"><label htmlFor={"ttl-" + k}>{TTL_ETIKET[k]} (gün)</label><input id={"ttl-" + k} type="number" min={1} max={730} value={ttl[k]} onChange={(e) => setTtl({ ...ttl, [k]: Math.max(1, Math.min(730, Number(e.target.value) || 1)) })} /></div>)}
      </div>
      <div className="satir"><button className="btn birincil" onClick={() => { guncelle((x) => ({ ...x, ayarlar: { ...x.ayarlar, ttl } })); bildir("Süreler kaydedildi"); }}>Kaydet</button>
        <button className="btn" onClick={() => { const n = d.kayitlar.filter((k) => (kalanGun(k.veri) ?? 1) <= 0).length; guncelle((x) => ({ ...x, kayitlar: x.kayitlar.map((k) => ((kalanGun(k.veri) ?? 1) <= 0 ? { ...k, veri: sureUzat(k.veri, ttlGun(k.veri.tip, k.veri.islemTipi, k.veri.aciliyet, ttl)) } : k)) })); bildir(`${n} süresi dolmuş kayıt uzatıldı`); }}>Süresi dolanları uzat</button></div>
    </section>
    </fieldset>
    {CANLI.acik && <CanliAyarKarti />}
    {!CANLI.acik && <>
    <section className="kart">
      <h3>Örnek veri kontrolü</h3>
      {ornekHatalari.length ? <ul className="hata-liste">{ornekHatalari.map((h) => <li key={h.oid}><b>{h.oid}:</b> {h.hatalar.join("; ")}</li>)}</ul> : <p><Pill ton="iyi">Geçti</Pill> Örnek kayıtların tamamı güncel şemadan ve konum çözücüden geçti ({toplam} kayıt havuzda).</p>}
    </section>
    <section className="kart">
      <h3>Örnek veriyi sıfırla</h3>
      <p className="ipucu">Eklediğiniz, düzenlediğiniz kayıtlar ve kişiler, eşleşme notları, içe aktarmalar ve Google bağlantısı silinir; örnek veri baştan yüklenir. Test işaretleriniz, notlarınız, ayarlar ve öğrettiğiniz konumlar korunur.</p>
      {!onay ? <button className="btn" onClick={() => setOnay(true)}>Sıfırla…</button> : <div className="satir"><span>Emin misiniz?</span><button className="btn tehlike" onClick={() => { const { kayitlar, adaylar } = ornekVeriyiKur(); guncelle((x) => ({ ...x, kayitlar, adaylar, kisiler: ornekVeriyiKur().kisiler, eslesmeNotlari: {}, aktifIceAktarma: null, iceAktarmaGecmisi: [], baglantilar: { google: bosGoogleBaglanti(), notion: bosBaglanti() }, senkronGecmisi: [], cakismalar: [], googleHaric: [], googleGiden: [], googleBekleyen: [] })); setOnay(false); bildir("Örnek veri yeniden yüklendi"); git({ ad: "ana" }); }}>Evet, sıfırla</button><button className="btn" onClick={() => setOnay(false)}>Vazgeç</button></div>}
    </section>
    </>}
  </div>;
}

// ───────────────────────────── Sürüm paneli + uygulama kabuğu ─────────────────────────────
function SurumPaneli({ kapat }: { kapat: () => void }) {
  // v3.9: ana sayfadaki "Bu sürümde test edin" kartı kalktı; test listesi ve not alanı burada duruyor.
  const { d, guncelle } = useDepo();
  const son = SURUM_GECMISI[0];
  const notMetni = [`${MARKA.ad} v${SURUM} (${TARIH}) test notlarım:`, ...(son.testEt ?? []).map((t, i) => `${d.testler[`${SURUM}-${i}`] ? "[✓]" : "[ ]"} ${t}`), "", d.geriBildirim ? "Notlarım:\n" + d.geriBildirim : ""].join("\n").trim();
  return <div className="perde" onClick={kapat}><div className="panel" role="dialog" aria-label="Sürüm notları" onClick={(e) => e.stopPropagation()}>
    <div className="satir-ara"><h2>Sürüm notları</h2><button className="btn kucuk" onClick={kapat}>Kapat</button></div>
    {SURUM_GECMISI.map((s, sira) => <section key={s.surum} className="surum"><div className="ust-etiket">v{s.surum} · {s.tarih}</div><h3>{s.baslik}</h3><ul>{s.degisenler.map((x, i) => <li key={i}>{x}</li>)}</ul>
      {sira === 0 && (s.testEt ?? []).length > 0 && <details className="surum-test">
        <summary>Test listesi ve notlarım</summary>
        <ul className="kontrol">
          {(s.testEt ?? []).map((t, i) => { const k = `${SURUM}-${i}`; return <li key={k}><label><input type="checkbox" id={"test-" + i} checked={!!d.testler[k]} onChange={(e) => guncelle((x) => ({ ...x, testler: { ...x.testler, [k]: e.target.checked } }))} /> <span>{t}</span></label></li>; })}
        </ul>
        <label className="alan-etiket" htmlFor="geri-bildirim">Gördüğünüz hatalar, istedikleriniz</label>
        <textarea id="geri-bildirim" rows={3} placeholder="Örn: Kundu deposunda araç erişimi yanlış görünüyor…" value={d.geriBildirim} onChange={(e) => guncelle((x) => ({ ...x, geriBildirim: e.target.value }))} />
        <div className="satir"><Kopyala metin={notMetni} etiketi="Notlarımı kopyala" /></div>
      </details>}
    </section>)}
  </div></div>;
}


function sekmeOf(e: Ekran, d: DepoDurumu): string {
  if (e.ad === "liste") return e.tip === "TALEP" ? "liste-T" : "liste-P";
  if (e.ad === "form") return e.tip === "TALEP" ? "liste-T" : "liste-P";
  if (e.ad === "detay") return d.kayitlar.find((k) => k.id === e.id)?.veri.tip === "TALEP" ? "liste-T" : "liste-P";
  if (e.ad === "eslesme") return "eslesmeler";
  if (e.ad === "kisi") return "kisiler";
  if (e.ad === "gelen") return "veri"; // v3.24
  if (e.ad === "konumlar" || e.ad === "baglantilar" || e.ad === "yonetim" || e.ad === "islemler") return "ayarlar"; // v3.21.2 — Ayarlar menüsünün altına alındı
  return e.ad;
}

/** v3.21 — Bağlantılar canlıda da var: Google bu kurulumda açıksa herkese, açık değilse yalnızca platform yöneticisine (kurulum adımları için) */
export const baglantilarGorunurMu = (d: DepoDurumu) => !CANLI.acik || !!d.googleCanli?.hazir || CANLI.oturum?.bilgi?.kullanici.rol === "PLATFORM_YONETICISI";

export function Uygulama() {
  const [yuk] = useState(depoYukle);
  const [d, setD] = useState<DepoDurumu>(yuk.durum);
  const [ekran, setEkran] = useState<Ekran>(CANLI.acik && CANLI.googleDonus ? { ad: "baglantilar" } : { ad: "ana" }); // v3.21: Google izin ekranından dönüşte doğrudan Bağlantılar
  const [gecmis, setGecmis] = useState<{ ekran: Ekran; y: number }[]>([]); // v3.16 — ekran geçmişi: her ekranda "← Geri"; v3.21.2: ayrıldığı kaydırma konumu da saklanır
  const bekleyenY = useRef<number | null>(null);                          // v3.21.2 — "Geri" ile dönülen ekranda yeniden gidilecek kaydırma konumu
  // v3.36 — telefonun / tarayıcının geri tuşu: her ekran geçişi tarayıcı geçmişine bir adım ekler; geri tuşu uygulama içinde bir önceki
  // ekrana döner (eskiden uygulamadan çıkıyor ya da yanlış sayfaya gidiyordu). Uygulamadaki "← Geri" de aynı adımı tüketir.
  const itilen = useRef(0), yoksay = useRef(0);
  const geriYapRef = useRef<(o?: { donus?: boolean; yedek?: Ekran }) => void>(() => {});
  const [mesaj, setMesaj] = useState<string | null>(yuk.yenilendi ? `v${SURUM}: örnek veri yenilendi` : null);
  const [surumAcik, setSurumAcik] = useState(false);
  const [sample, setSample] = useState<any>(undefined);
  ogrenilenleriYukle(d.ogrenilen, calismaIli(d)); // öğrenilen konumlar çözücüye (render'dan önce, eşzamanlı)
  rolleriUygula(d.roller);                         // v3.15: özel roller + yeniden adlandırmalar (render'dan önce, eşzamanlı)
  useEffect(() => klavyeIzle(), []);
  useLayoutEffect(() => { // v3.21.2 — "Geri" ile dönülünce kaydırma konumunu yükle (içerik geç uzarsa birkaç kare daha dene)
    const y = bekleyenY.current; if (y == null) return; bekleyenY.current = null;
    const git = () => window.scrollTo({ top: y }); git();
    if (typeof requestAnimationFrame !== "function") return;
    let n = 0; const dene = () => { if (Math.abs(window.scrollY - y) > 2 && n++ < 8) { git(); requestAnimationFrame(dene); } };
    requestAnimationFrame(dene);
  }, [ekran]);
  useEffect(() => { depoKaydet(d); }, [d]);
  // v3.26 — ★ Benim kayıtlar süresiz (sonradan Benim'e dönen ya da içe aktarılan kayıtlar da)
  useEffect(() => { const s = sahiplikCozucu(d); const y = benimSuresiz(d, (v) => s(v).tur === "BENIM"); if (y !== d) setD(y); }, [d.kayitlar, d.kisiler, d.ayarlar.sahiplik]);
  useEffect(() => { let iptal = false; (async () => { try { const s = CANLI.acik ? CANLI.sample : await (window as any).claude?.use("sample"); if (!iptal) setSample(() => s ?? null); /* fonksiyon doğrudan verilirse React onu güncelleyici sanıp çağırıyordu → v3.3 hatası "n.json is not a function" */ } catch { if (!iptal) setSample(null); } })(); return () => { iptal = true; }; }, []);
  useEffect(() => { if (!mesaj) return; const t = setTimeout(() => setMesaj(null), 2600); return () => clearTimeout(t); }, [mesaj]);
  useEffect(() => { CANLI.bildir = setMesaj; return () => { CANLI.bildir = null; }; }, []); // v3.32 — sunucu uyarıları (kilitli ilk kaynak, yetki)
  useEffect(() => { void kutuOzetYukle(); }, []); // v3.23 — gelen kutusu: açılışta yalnızca dosya listesi (tek küçük istek); dosyalar ekran açılınca okunur
  const gelenRozet = useGelenRozet(d);
  useEffect(() => googleOtomatik((f) => setD((x) => f(x))), []); // v3.22.2 canlı: açılışta yalnızca Google bağlantı DURUMU okunur; eşitleme günde bir sunucuda ya da elle (eskiden açılışta + 5 dk'da bir)
  // v3.37 — kaydedilmemiş değişiklik koruması: formda değişiklik varken ekran değişecekse önce sorulur (kirli.ts)
  const [kaydetSor, setKaydetSor] = useState<null | { eylem: () => void }>(null);
  const korumali = (eylem: () => void) => { if (!bekleyenVarMi()) return eylem(); setKaydetSor({ eylem }); };
  useEffect(() => tarayiciUyarisiKur(), []);
  const gitYap = (e: Ekran) => {
    const y = window.scrollY; // ayrılırken konum (kaydırmadan ÖNCE okunur)
    if (e.ad === "liste" && e.filtre) kaliciSil(`liste.${e.tip}.`); // Ana Sayfa'dan hazır filtreyle gelince eski süzgeç karışmasın
    const ayni = ekran.ad === e.ad && JSON.stringify(ekran) === JSON.stringify(e);
    // v3.37 — form geçmişe girmez (kaydedildi ya da bilerek bırakıldı); Geri formdan önceki ekrana döner
    setGecmis((g) => (ayni || ekran.ad === "form" ? g : [...g.slice(-40), { ekran, y }]));
    if (!ayni) { try { history.pushState({ anahtarcrm: true }, ""); itilen.current++; } catch { /* önizleme çerçevesi */ } }
    setEkran(e); window.scrollTo({ top: 0 });
  };
  // v3.21.2 — Geri: önceki ekran süzgeçleriyle (useKalici) ve ayrıldığın kaydırma konumunda açılır
  const geriGit = (o?: { donus?: boolean; yedek?: Ekran }) => {
    if (itilen.current > 0) { itilen.current--; yoksay.current++; try { history.back(); } catch { yoksay.current--; } } // tarayıcı geçmişi de bir adım geri
    geriYapRef.current(o);
  };
  const gitRef = useRef(gitYap), geriRef = useRef(geriGit);
  gitRef.current = gitYap; geriRef.current = geriGit;
  const ctx: Ctx = {
    d, guncelle: (f) => setD((x) => f(x)), bildir: setMesaj, ornekHatalari: yuk.hatalar, sample,
    kayitKaydet: (k) => setD((x) => { const eski = x.kayitlar.find((y) => y.id === k.id); const y = { ...x, kayitlar: eski ? x.kayitlar.map((z) => (z.id === k.id ? k : z)) : [k, ...x.kayitlar] }; return eski ? fiyatDususuIsle(y, eski, k) : y; }),
    git: (e) => korumali(() => gitRef.current(e)),
    geri: (o) => korumali(() => geriRef.current(o)),
    degistir: (e) => { setEkran(e); window.scrollTo({ top: 0 }); },
    geriVar: gecmis.length > 0,
  };
  // v3.36 — geri adımı (uygulama düğmesi ve telefon geri tuşu ortak)
  geriYapRef.current = (o) => {
    const son = gecmis[gecmis.length - 1];
    const hedef: Ekran = son?.ekran ?? o?.yedek ?? { ad: "ana" };
    bekleyenY.current = son?.y ?? 0;
    setGecmis(gecmis.slice(0, -1)); setEkran(o?.donus ? ({ ...hedef, donus: true } as Ekran) : hedef);
  };
  useEffect(() => {
    if (typeof window === "undefined") return;
    const f = () => {
      if (yoksay.current > 0) { yoksay.current--; return; } // uygulamadaki "← Geri"nin tetiklediği adım
      if (itilen.current > 0) itilen.current--;
      setMenuAcik(false);
      // v3.37 — formda kaydedilmemiş değişiklik varsa telefonun geri tuşu da önce sorar (tarayıcı adımı geri konur)
      if (bekleyenVarMi()) { try { history.pushState({ anahtarcrm: true }, ""); itilen.current++; } catch { /* önizleme */ } setKaydetSor({ eylem: () => geriRef.current({ donus: true }) }); return; }
      geriYapRef.current({ donus: true });
    };
    window.addEventListener("popstate", f);
    return () => window.removeEventListener("popstate", f);
  }, []);
  const aktifSekme = sekmeOf(ekran, d);
  const [menuAcik, setMenuAcik] = useState(false);
  const git = (e: Ekran) => { setMenuAcik(false); ctx.git(e); };
  const cakisma = (d.cakismalar ?? []).filter((c) => notionAcik() || c.saglayici !== "NOTION").length;
  const nav: NavOge[] = [
    { k: "ana", etiket: "Ana Sayfa", ikon: "ana", git: () => git({ ad: "ana" }) },
    { k: "liste-T", etiket: "Talepler", ikon: "talep", git: () => git({ ad: "liste", tip: "TALEP" }) },
    { k: "liste-P", etiket: "Portföyler", ikon: "portfoy", git: () => git({ ad: "liste", tip: "PORTFOY" }) },
    { k: "eslesmeler", etiket: "Eşleşmeler", ikon: "eslesme", git: () => git({ ad: "eslesmeler" }) },
    { k: "izleme", etiket: "İzleme", ikon: "anahtar", git: () => git({ ad: "izleme" }), rozet: (d.favoriler ?? []).length || undefined },
    { k: "kisiler", etiket: "Kişiler", ikon: "kisi", git: () => git({ ad: "kisiler" }) },
    // v3.21.2 — Konumlar, Bağlantılar ve Yönetim ana menüden kalktı; Ayarlar'ın içinde ("Yönetim ve bağlantılar")
    // v3.24 — Gelen Kutusu Veri Girişi'nin sekmesi oldu; rozet (onay bekleyen sayısı) Veri Girişi'nde
    { k: "veri", etiket: "Veri Girişi", ikon: "veri", git: () => git({ ad: "veri" }), rozet: gelenRozet.sayi || undefined, alt: true },
    { k: "ayarlar", etiket: "Ayarlar", ikon: "ayar", git: () => git({ ad: "ayarlar" }), rozet: cakisma, alt: true },
    { k: "gorevler", etiket: "Görevler", ikon: "gorev", git: () => git({ ad: "gorevler" }), alt: true }, // v3.26 — menünün en sonunda
  ];
  const surumCip = <button className="surum-cip" onClick={() => setSurumAcik(true)} title="Bu sürümde neler var">v{SURUM} · {TARIH}</button>;
  return <C.Provider value={ctx}>
  <div className="kabuk">
    <SolMenu ogeler={nav} aktif={aktifSekme} durum={<SenkronDurumu />} surum={surumCip} />
    <div className="icerik">
    <header className="ust-bas">
      <Logo alt={false} />
      <div className="satir"><SenkronDurumu /><button className="menu-btn" aria-label="Menü" onClick={() => setMenuAcik(true)}><Ikon ad="menu" boyut={22} />{cakisma + gelenRozet.sayi > 0 && <b className="menu-rozet">{cakisma + gelenRozet.sayi > 999 ? "999+" : cakisma + gelenRozet.sayi}</b>}</button></div>
    </header>
    {yuk.hatalar.length > 0 && <div className="sarici"><div className="hata-kutu">Örnek veride {yuk.hatalar.length} kayıt güncel şemaya uymuyor. Ayrıntı: Ayarlar.</div></div>}
    <main className="sarici">
      {ctx.geriVar && ekran.ad !== "form" && <button className="btn kucuk geri genel-geri" onClick={() => ctx.geri()}>← Geri</button>}
      {ekran.ad === "ana" && <AnaSayfa donus={ekran.donus} />}
      {ekran.ad === "liste" && <Liste key={ekran.tip + (ekran.filtre ? JSON.stringify(ekran.filtre).length : "")} tip={ekran.tip} baslangic={ekran.filtre} />}
      {ekran.ad === "detay" && <Detay id={ekran.id} />}
      {ekran.ad === "form" && <KayitFormu key={(ekran.id ?? ekran.adayId ?? "yeni") + ekran.tip} tip={ekran.tip} id={ekran.id} taslak={ekran.taslak} adayId={ekran.adayId} geri={ekran.geri} />}
      {ekran.ad === "eslesmeler" && <Eslesmeler />}
      {ekran.ad === "izleme" && <Izleme />}
      {ekran.ad === "eslesme" && <EslesmeDetay tid={ekran.tid} pid={ekran.pid} />}
      {ekran.ad === "veri" && <VeriGirisi key={(ekran.alt ?? "") + (ekran.metin?.length ?? "")} alt={ekran.alt} metin={ekran.metin} donus={ekran.donus} />}
      {ekran.ad === "gelen" && <VeriGirisi key="gelen" alt="gelen" />}
      {ekran.ad === "kisiler" && <Kisiler />}
      {ekran.ad === "kisi" && <KisiKarti key={ekran.id} id={ekran.id} />}
      {ekran.ad === "konumlar" && <Konumlar />}
      {ekran.ad === "ayarlar" && <Ayarlar />}
      {ekran.ad === "baglantilar" && <Baglantilar />}
      {ekran.ad === "yonetim" && <Yonetim />}
      {ekran.ad === "islemler" && <IslemlerEkrani />}
      {ekran.ad === "suresi" && <SuresiYaklasanlar />}
      {ekran.ad === "gorevler" && <GorevlerEkrani />}
    </main>
    <footer className="ayak">{MARKA.ad} v{SURUM} · {TARIH}{CANLI.acik ? "" : " — Demo: veriler yalnızca bu tarayıcıda saklanır; kişi adları ve telefonlar kurgusaldır"}</footer>
    </div>
    <AltCubuk ogeler={nav.slice(0, 5)} aktif={aktifSekme} />
  </div>
    {menuAcik && <div className="fs-perde" onClick={() => setMenuAcik(false)}><div className="fs-sayfa menu-sayfa" role="dialog" aria-label="Menü" onClick={(e) => e.stopPropagation()}>
      <div className="fs-bas"><Logo /><button className="btn kucuk" onClick={() => setMenuAcik(false)}>Kapat</button></div>
      <div className="menu-liste">{nav.slice(5).map((o) => <button key={o.k} className={"menu-oge" + (aktifSekme === o.k ? " on" : "")} onClick={o.git}><Ikon ad={o.ikon} /><span>{o.etiket}</span>{!!o.rozet && <b className="menu-rozet">{o.rozet}</b>}</button>)}
        <button className="menu-oge" onClick={() => { setMenuAcik(false); setSurumAcik(true); }}><Ikon ad="veri" /><span>Sürüm notları · v{SURUM}</span></button></div>
    </div></div>}
    {mesaj && <div className="bildirim" role="status">{mesaj}</div>}
    {surumAcik && <SurumPaneli kapat={() => setSurumAcik(false)} />}
    {kaydetSor && <KaydetSorusu eylem={kaydetSor.eylem} kapat={() => setKaydetSor(null)} bildir={setMesaj} />}
  </C.Provider>;
}

/** v3.37 — "Değişiklikler kaydedilmedi" penceresi: Kaydet ve devam et · Kaydetmeden çık · Vazgeç (ekranda kal) */
export function KaydetSorusu({ eylem, kapat, bildir }: { eylem: () => void; kapat: () => void; bildir: (m: string) => void }) {
  const [mesgul, setMesgul] = useState(false);
  const adlar = [...new Set(bekleyenler().map((b) => b.ad))];
  const kaydetVeGec = async () => {
    setMesgul(true);
    const ok = await hepsiniKaydet();
    setMesgul(false); kapat();
    if (ok) eylem(); else bildir("Kaydedilemedi — formdaki uyarıları düzeltin");
  };
  return <div className="perde" onClick={kapat}>
    <div className="panel kaydet-sor" role="alertdialog" aria-modal="true" aria-labelledby="ks-baslik" onClick={(e) => e.stopPropagation()}>
      <h3 id="ks-baslik">Değişiklikler kaydedilmedi</h3>
      <p>{adlar.length ? <><b>{adlar.join(", ")}</b> ekranında yaptığınız değişiklikler kaydedilmedi.</> : "Bu ekranda kaydedilmemiş değişiklikler var."} Ayrılmadan kaydedelim mi?</p>
      <div className="satir sar">
        <button className="btn birincil" autoFocus disabled={mesgul} onClick={kaydetVeGec}>{mesgul ? "Kaydediliyor…" : "Kaydet ve devam et"}</button>
        <button className="btn tehlike-cizgi" disabled={mesgul} onClick={() => { hepsiniBirak(); kapat(); eylem(); }}>Kaydetmeden çık</button>
        <button className="btn" disabled={mesgul} onClick={kapat}>Vazgeç</button>
      </div>
    </div>
  </div>;
}

/** v3.7 — sunucu tarafı çizim testleri (tests/v37-ui.test.ts) için dışa açık ekranlar */
export { Liste, Detay, Eslesmeler, AnaSayfa, EslesmeDetay, VeriGirisi };
/** v3.12 — Telefon klavyesi: bir yazı alanına odaklanınca alt menü ve sabit Kaydet çubuğu kaçar (yazılan yeri örtmesin),
 *  alan klavyenin üstünde görünecek yere kaydırılır; alan bırakılınca eski düzen geri gelir. */
function klavyeIzle() {
  if (typeof document === "undefined") return () => {};
  const yaziAlani = (el: any) => !!el && (el.tagName === "TEXTAREA" || el.tagName === "SELECT" || (el.tagName === "INPUT" && !["checkbox", "radio", "file", "button", "submit", "range", "color"].includes(el.type)));
  let kapat: any = null;
  const kaydir = (el: any) => { try { el.scrollIntoView({ block: "center", behavior: "smooth" }); } catch { /* eski tarayıcı */ } };
  const odak = (e: any) => {
    if (!yaziAlani(e.target)) return;
    clearTimeout(kapat); document.documentElement.classList.add("klavye");
    setTimeout(() => kaydir(e.target), 120); setTimeout(() => kaydir(e.target), 420);
  };
  const cik = () => { clearTimeout(kapat); kapat = setTimeout(() => { if (!yaziAlani(document.activeElement)) document.documentElement.classList.remove("klavye"); }, 200); };
  const vv: any = (window as any).visualViewport;
  const boyut = () => { const a: any = document.activeElement; if (yaziAlani(a)) kaydir(a); };
  document.addEventListener("focusin", odak); document.addEventListener("focusout", cik); vv?.addEventListener("resize", boyut);
  return () => { document.removeEventListener("focusin", odak); document.removeEventListener("focusout", cik); vv?.removeEventListener("resize", boyut); };
}

if (typeof document !== "undefined" && document.getElementById("kok") && !document.getElementById("kok")!.dataset.canli) createRoot(document.getElementById("kok")!).render(<Uygulama />);