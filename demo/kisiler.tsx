/**
 * Anahtar CRM v3.22.2 · 10 Ekim 2026 (v3.13'ten; v3.7: ara / WhatsApp düğmeleri, sıralama, görüşme notları)
 * v3.21 — çift yönlü Google: elle eklenen kişi ve bağlı kişideki düzeltme "Google'a gönderilecek" olur; silinen kişi Google'dan silinmez.
 * Demo — Kişiler: kişi seçici (yazdıkça arama, çoklu seçim, rol, + ile anında ekleme), kişi listesi ve kişi kartı.
 * Alanlar Notion "Müşteri-Yatırımcılar-Kişiler" tablosuna göre (ROL, Phone, Açıklama, Referans, ilişkili talep/portföy).
 */
import { TelGirdisi } from "./girdi";
import { telUyarisi } from "../src/lib/iletisim";
import React, { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { useKalici } from "./kalici";
import { MULK_AILELERI } from "../src/lib/domain/kategori";
import { etiket } from "./etiketler";
import { rolListesi, type RolTanim } from "../src/lib/domain/roller";
import { yeniKisiId, BUGUN, NOT_TURU, CANLI, type Kisi, type Kayit, type DepoDurumu } from "./depo";
import { useDepo, cx, Pill, IslemPill, TTL, baslikOf, fiyatOf, m2Of, lokEtiket, telYaz, tarihYaz, Kopyala, useEslesmeler, eKey, Skor, type Ctx } from "./ortak";
import { telNormalize } from "./form";
import { aramaLinki, whatsappLinki, selamMetni } from "../src/lib/iletisim";
import { demoGoogleSenkron, demoGoogleSilinenler } from "./senkron-demo";
import { gonderimAlaniDegisti } from "../src/lib/google/kisiler";
import { notionAcik } from "../src/lib/ozellikler";
import { googleEsitle, ozetCumlesi } from "./google-baglanti";
import { SiralaDugmesi, kisiSiralama, siralaUygula, type Siralama } from "./filtre";

/** v3.7 — Ara + WhatsApp (WhatsApp Business kuruluysa onunla açılır) */
export function IletisimDugmeleri({ tel, ad, mesaj, kucuk = false }: { tel?: string | null; ad?: string; mesaj?: string; kucuk?: boolean }) {
  const ara = aramaLinki(tel), wa = whatsappLinki(tel, mesaj ?? (ad ? selamMetni(ad) : undefined));
  if (!ara && !wa) return null;
  return <div className={cx("iletisim", kucuk && "kucuk")} onClick={(e) => e.stopPropagation()}>
    {ara && <a className="ilt ara" href={ara} aria-label={`${ad ?? ""} ara`}><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25 11.4 11.4 0 0 0 3.6.57 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.57 3.57a1 1 0 0 1-.25 1z"/></svg>{!kucuk && <span>Ara</span>}</a>}
    {wa && <a className="ilt wa" href={wa} target="_blank" rel="noopener" aria-label={`${ad ?? ""} WhatsApp'tan yaz`}><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.15l-.3-.18-3 .78.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.25-.12-1.47-.72-1.7-.8s-.39-.12-.56.12-.64.8-.79.97-.29.18-.54.06a6.7 6.7 0 0 1-3.3-2.9c-.25-.43.25-.4.71-1.33a.45.45 0 0 0-.02-.42c-.06-.12-.56-1.34-.76-1.84s-.4-.42-.56-.43h-.48a.92.92 0 0 0-.66.31 2.8 2.8 0 0 0-.87 2.07 4.8 4.8 0 0 0 1 2.56 11 11 0 0 0 4.2 3.7c1.56.67 2.17.73 2.95.62a2.5 2.5 0 0 0 1.65-1.16 2 2 0 0 0 .14-1.16c-.06-.1-.23-.16-.48-.28z"/></svg>{!kucuk && <span>WhatsApp</span>}</a>}
  </div>;
}

/** v3.15 — Kişi rolleri: 11 sistem rolü + Ayarlar › "Kişi rolleri"nden eklenen özel roller. Dizi yerinde güncellenir (rolleriUygula), böylece rol listesini kullanan tüm ekranlar aynı kaynaktan okur. */
export const KISI_ROLLERI: [string, string][] = rolListesi();
export function rolleriUygula(ozel?: readonly RolTanim[] | null) { KISI_ROLLERI.splice(0, KISI_ROLLERI.length, ...rolListesi(ozel)); }
export const KAYIT_ROLLERI: [string, string][] = [["SAHIP", "Mülk sahibi"], ["MUSTERI", "Müşteri"], ["EMLAKCI", "Emlakçı"], ["ARACI", "Aracı"], ["IRTIBAT", "İrtibat"], ["DIGER", "Diğer"]];
const rolAd = (r: string, l = KISI_ROLLERI) => l.find((x) => x[0] === r)?.[1] ?? r;
export type Bag = { kisiId: string; rol: string };
/** v3.6 — kişinin geldiği yer: Google / Notion / WhatsApp / elle */
export const kaynakOf = (k: Kisi): "GOOGLE" | "NOTION" | "WHATSAPP" | "MANUEL" => k.googleResourceName ? "GOOGLE" : k.notionId ? "NOTION" : k.kaynak === "GOOGLE" || k.kaynak === "NOTION" ? "MANUEL" : k.whatsappGruplari.length ? "WHATSAPP" : (k.kaynak ?? "MANUEL");
const KAYNAK_ETIKET: Record<string, string> = { GOOGLE: "Google", NOTION: "Notion", WHATSAPP: "WhatsApp", MANUEL: "Elle" };
/** v3.21 — Google bağlı ve çift yönlü açık mı? (demo: tarayıcı durumu · canlı: sunucudan okunan bağlantı özeti) */
export const googleCiftYonlu = (d: DepoDurumu): boolean => d.baglantilar?.google.durum === "BAGLI" && !!d.baglantilar.google.ayar.googleYaz;
const gAlan = (k: Kisi) => ({ adSoyad: k.adSoyad, telefon: k.telefon, ikincilTelefon: k.ikincilTelefon ?? null, email: k.email ?? null, sirket: k.sirket });
/** Bu kişi bir sonraki eşitlemede Google'a yazılacak mı? */
export const googleBekliyorMu = (k: Kisi): boolean => !k.kaynaktaSilindi && (!!k.googleBekliyor || (!!k.googleaGonder && !k.googleResourceName && !!k.telefon));
/** Google'a bağlı kişide ad / telefon / e-posta / şirket düzeltildiyse "gönderilecek" diye işaretler (canlıda asıl işareti sunucu koyar; buradaki rozet içindir) */
export const duzeltmeIsareti = (d: DepoDurumu, eski: Kisi, yeni: Kisi): Kisi => (googleCiftYonlu(d) && eski.googleResourceName && gonderimAlaniDegisti(gAlan(eski), gAlan(yeni)) ? { ...yeni, googleBekliyor: new Date().toISOString() } : yeni);
/**
 * Kişileri siler; bağlı oldukları kayıtlardan kişi bağını kaldırır (kayıtlar silinmez).
 * v3.21 — Google bağlıysa silinen kişi Google'dan SİLİNMEZ; "geri gelmesin" listesine yazılır (demo: burada · canlı: sunucuda).
 */
export function kisileriSil(x: DepoDurumu, ids: Set<string>): DepoDurumu {
  const silinen = x.kisiler.filter((k) => ids.has(k.id));
  return {
    ...x,
    kisiler: x.kisiler.filter((k) => !ids.has(k.id)),
    kayitlar: x.kayitlar.map((k) => ((k.veri.kisiler ?? []).some((b) => ids.has(b.kisiId)) ? { ...k, veri: { ...k.veri, kisiler: (k.veri.kisiler ?? []).filter((b) => !ids.has(b.kisiId)) } } : k)),
    ...(CANLI.acik ? {} : { googleHaric: demoGoogleSilinenler(x, silinen) }),
  };
}
export function KaynakRozeti({ k }: { k: Kisi }) {
  const { d } = useDepo();
  const kk = kaynakOf(k);
  return <>{(k.googleResourceName || kk === "GOOGLE") && <span className="kaynak-rozet google">Google</span>}{k.notionId && <span className="kaynak-rozet notion">Notion</span>}{kk === "WHATSAPP" && !k.googleResourceName && !k.notionId && <span className="kaynak-rozet wa">WhatsApp</span>}{k.kaynaktaSilindi && <span className="kaynak-rozet silindi">Google'dan silindi</span>}{googleCiftYonlu(d) && googleBekliyorMu(k) && <span className="kaynak-rozet bekliyor" title="Bir sonraki eşitlemede Google rehberinize yazılacak">Google'a gönderilecek</span>}</>;
}
export function kisiEkle(guncelle: Ctx["guncelle"], d: Ctx["d"], girdi: { adSoyad: string; telefon?: string | null; sirket?: string | null; roller?: string[]; grup?: string | null; /** v3.21 — kullanıcı kişiyi ELLE ekledi: Google bağlıysa rehbere de gider. Otomatik / toplu eklemelerde verilmez. */ elle?: boolean }): string {
  const tel = telNormalize(girdi.telefon) || null;
  const var_ = tel ? d.kisiler.find((k) => k.telefon === tel) : undefined;
  if (var_) {
    guncelle((x) => ({ ...x, kisiler: x.kisiler.map((k) => (k.id === var_.id ? { ...k, roller: [...new Set([...k.roller, ...(girdi.roller ?? [])])], whatsappGruplari: girdi.grup && !k.whatsappGruplari.includes(girdi.grup) ? [...k.whatsappGruplari, girdi.grup] : k.whatsappGruplari } : k)) }));
    return var_.id;
  }
  const yeni: Kisi = { id: yeniKisiId(), adSoyad: girdi.adSoyad.trim(), telefon: tel, sirket: girdi.sirket ?? null, roller: girdi.roller ?? [], uzmanlikAileleri: [], referans: null, notlar: null, whatsappGruplari: girdi.grup ? [girdi.grup] : [], olusturma: BUGUN.toISOString(), sonIletisim: null, ...(girdi.elle && tel ? { googleaGonder: true } : {}) };
  guncelle((x) => ({ ...x, kisiler: [yeni, ...x.kisiler] }));
  return yeni.id;
}

/** Yazdıkça arar, birden fazla kişi seçilir, her birine rol verilir; yoksa + ile eklenir */
export function KisiSecici({ secili, degis, varsayilanRol = "DIGER", oneri }: { secili: Bag[]; degis: (b: Bag[]) => void; varsayilanRol?: string; oneri?: { ad?: string | null; telefon?: string | null; sirket?: string | null } }) {
  const { d, guncelle } = useDepo();
  const [q, setQ] = useState("");
  const [acik, setAcik] = useState(false);
  const [yeni, setYeni] = useState<{ adSoyad: string; telefon: string; rol: string } | null>(null);
  const kutu = useRef<HTMLInputElement>(null);
  const ql = q.toLocaleLowerCase("tr"), qt = q.replace(/\D/g, "");
  const liste = useMemo(() => q.trim().length < 1 ? d.kisiler.slice(0, 6) : d.kisiler.filter((k) => k.adSoyad.toLocaleLowerCase("tr").includes(ql) || (k.sirket ?? "").toLocaleLowerCase("tr").includes(ql) || (qt.length >= 3 && (k.telefon ?? "").includes(qt))).slice(0, 8), [q, d.kisiler]);
  const ekle = (kisiId: string, rol = varsayilanRol) => { if (!secili.some((b) => b.kisiId === kisiId)) degis([...secili, { kisiId, rol }]); setQ(""); setAcik(false); };
  const oneriKisi = oneri?.telefon ? d.kisiler.find((k) => k.telefon === telNormalize(oneri.telefon)) : undefined;
  return <div className="kisi-secici">
    <div className="cip-satir">
      {secili.map((b, i) => { const k = d.kisiler.find((x) => x.id === b.kisiId); return <span key={b.kisiId + b.rol} className="cip buyuk kisi-cip">
        <b>{k?.adSoyad ?? "?"}</b>{k?.telefon && <small>{telYaz(k.telefon)}</small>}
        <select aria-label="Rol" value={b.rol} onChange={(e) => degis(secili.map((x, j) => (j === i ? { ...x, rol: e.target.value } : x)))}>{KAYIT_ROLLERI.map(([r, l]) => <option key={r} value={r}>{l}</option>)}</select>
        <button type="button" className="sil" aria-label="Kaldır" onClick={() => degis(secili.filter((_, j) => j !== i))}>×</button></span>; })}
      {!secili.length && <span className="ipucu">Kişi seçilmedi</span>}
    </div>
    {oneri && (oneri.ad || oneri.telefon) && !secili.length && <div className="bilgi-kutu satir sar">Mesajı gönderen: <b>{oneri.ad ?? telYaz(oneri.telefon)}</b>{oneriKisi ? <button type="button" className="btn kucuk" onClick={() => ekle(oneriKisi.id)}>Kişilerdeki {oneriKisi.adSoyad} ile bağla</button> : <button type="button" className="btn kucuk" onClick={() => ekle(kisiEkle(guncelle, d, { adSoyad: oneri.ad ?? oneri.telefon!, telefon: oneri.telefon, sirket: oneri.sirket }))}>+ Kişilere ekle ve bağla</button>}</div>}
    <div className="konum-secici">
      <input ref={kutu} placeholder="Kişi ara: ad, şirket veya telefon…" value={q} onChange={(e) => { setQ(e.target.value); setAcik(true); }} onFocus={() => setAcik(true)} onBlur={() => setTimeout(() => setAcik(false), 150)} autoComplete="off" />
      {acik && <ul className="oneri-liste" role="listbox">
        {liste.filter((k) => !secili.some((b) => b.kisiId === k.id)).map((k) => <li key={k.id} onMouseDown={(e) => { e.preventDefault(); ekle(k.id); }}><b>{k.adSoyad}</b><span>{[telYaz(k.telefon), k.sirket, k.roller.map((r) => rolAd(r)).join(", ")].filter(Boolean).join(" · ")}</span><small className="tur">Kişi</small></li>)}
        <li className="yeni-kisi" onMouseDown={(e) => { e.preventDefault(); setYeni({ adSoyad: /\d{5,}/.test(q) ? "" : q, telefon: /\d{5,}/.test(q) ? q : "", rol: varsayilanRol }); setAcik(false); }}><b>+ {q.trim() ? `“${q.trim()}” adıyla yeni kişi` : "Yeni kişi ekle"}</b><span>Kişiler listesine eklenir</span></li>
      </ul>}
    </div>
    {yeni && <div className="kart ic yeni-kisi-form">
      <div className="alanlar">
        <div className="alan"><label htmlFor="yk-ad">Ad soyad / firma</label><input id="yk-ad" autoFocus value={yeni.adSoyad} onChange={(e) => setYeni({ ...yeni, adSoyad: e.target.value })} /></div>
        <div className="alan"><label htmlFor="yk-tel">Telefon</label><TelGirdisi id="yk-tel" deger={yeni.telefon} onChange={(v) => setYeni({ ...yeni, telefon: v })} /></div>
        <div className="alan"><label htmlFor="yk-rol">Bu kayıttaki rolü</label><select id="yk-rol" value={yeni.rol} onChange={(e) => setYeni({ ...yeni, rol: e.target.value })}>{KAYIT_ROLLERI.map(([r, l]) => <option key={r} value={r}>{l}</option>)}</select></div>
      </div>
      <div className="satir"><button type="button" className="btn birincil" disabled={yeni.adSoyad.trim().length < 2 || !!telUyarisi(yeni.telefon)} onClick={() => { const id = kisiEkle(guncelle, d, { elle: true, adSoyad: yeni.adSoyad, telefon: yeni.telefon }); ekle(id, yeni.rol); setYeni(null); }}>Ekle</button><button type="button" className="btn" onClick={() => setYeni(null)}>Vazgeç</button>
        {telNormalize(yeni.telefon) && d.kisiler.some((k) => k.telefon === telNormalize(yeni.telefon)) && <span className="ipucu">Bu telefon kayıtlı; mevcut kişi bağlanacak.</span>}</div>
    </div>}
  </div>;
}

/** Bir kişinin bağlı olduğu kayıtlar */
export const kisininKayitlari = (kayitlar: Kayit[], kisiId: string) => kayitlar.filter((k) => (k.veri.kisiler ?? []).some((b) => b.kisiId === kisiId));

export function Kisiler() {
  const { d, git, guncelle, bildir } = useDepo();
  // v3.21.2 — arama, süzgeçler ve sıralama kişi kartından Geri dönünce korunur (useKalici)
  const [q, setQ] = useKalici("kisiler.q", "");
  const [roller, setRoller] = useKalici<string[]>("kisiler.roller", []);
  const [kaynaklar, setKaynaklar] = useKalici<string[]>("kisiler.kaynaklar", []);
  const [bag, setBag] = useKalici<"" | "TALEP" | "PORTFOY" | "YOK">("kisiler.bag", "");   // v3.15: bağlı kayıt türü
  const [tel, setTel] = useKalici<"" | "VAR" | "YOK">("kisiler.tel", "");                  // v3.15: telefonu var / yok
  const [yeniAcik, setYeniAcik] = useState(false);
  const [yeni, setYeni] = useState({ adSoyad: "", telefon: "", rol: "" });
  const [secili, setSecili] = useState<Set<string>>(new Set());            // v3.15: toplu işlem seçimi
  const [silOnay, setSilOnay] = useState(false);
  const [secimModu, setSecimModu] = useState(false);                         // v3.19: onay kutuları yalnızca "Seç" modunda görünür (kartlarda yer açar)
  const [duzenId, setDuzenId] = useState<string | null>(null);
  const [filtreAcik, setFiltreAcik] = useState(false);              // v3.15: listede hızlı düzenleme
  // v3.22.2 — 7.800 kişide ekran donuyordu: (1) her kart için TÜM kayıtlar baştan taranıyordu (kişi × kayıt ≈ 2,5 milyon karşılaştırma, her çizimde
  // iki kez), (2) ada göre sıralama her karşılaştırmada yeni bir karşılaştırıcı kuruyordu, (3) 7.800 kartın hepsi birden çiziliyordu.
  // Artık: kayıt sayıları tek geçişte bir tabloya alınır; süzme + sıralama yalnızca girdi değişince çalışır; liste 60'ar kişilik parçalarla çizilir.
  const [sr, setSr] = useKalici<Siralama>("kisiler.sr", { alan: "ad", yon: "artan" });
  const [limit, setLimit] = useKalici<number>("kisiler.limit", KISI_SAYFA);
  const qGec = useDeferredValue(q);                 // yazarken kutu anında, 7.800 kişilik süzme arkadan gelir
  const ql = qGec.toLocaleLowerCase("tr");
  const sayilar = useMemo(() => {
    const m = new Map<string, { n: number; t: number; p: number }>();
    for (const ky of d.kayitlar) {
      const gorulen = new Set<string>();
      for (const b of ky.veri.kisiler ?? []) {
        if (gorulen.has(b.kisiId)) continue; gorulen.add(b.kisiId);
        let x = m.get(b.kisiId); if (!x) { x = { n: 0, t: 0, p: 0 }; m.set(b.kisiId, x); }
        x.n++; if (ky.veri.tip === "TALEP") x.t++; else if (ky.veri.tip === "PORTFOY") x.p++;
      }
    }
    return m;
  }, [d.kayitlar]);
  const kayitSay = (id: string, tip?: string) => { const x = sayilar.get(id); return !x ? 0 : tip === "TALEP" ? x.t : tip === "PORTFOY" ? x.p : tip ? 0 : x.n; };
  const kSay = (id: string) => kayitSay(id);
  const kaynakTutar = (k: Kisi, x: string) => (x === "GOOGLE" ? !!k.googleResourceName : x === "NOTION" ? !!k.notionId : kaynakOf(k) === x);
  const liste = useMemo(() => d.kisiler.filter((k) => {
    if (qGec) {
      // v3.15: arama ad, şirket, telefonlar, e-posta, referans, not ve rol adlarında (v3.22.2: kişi başına metin bir kez üretilir)
      const ham = k.roller.length ? `${hamOf(k)} ${k.roller.map((r) => rolAd(r)).join(" ").toLocaleLowerCase("tr")}` : hamOf(k);
      const rakam = qGec.replace(/\D/g, "");
      if (!ham.includes(ql) && !(rakam.length >= 3 && `${k.telefon ?? ""}${k.ikincilTelefon ?? ""}`.includes(rakam))) return false;
    }
    if (roller.length) { const rolsuz = roller.includes(ROLSUZ) && !k.roller.length; if (!rolsuz && !k.roller.some((r) => roller.includes(r))) return false; }
    if (kaynaklar.length && !kaynaklar.some((x) => kaynakTutar(k, x))) return false;
    if (bag === "YOK" ? kayitSay(k.id) > 0 : bag ? kayitSay(k.id, bag) === 0 : false) return false;
    if ((tel === "VAR" && !k.telefon) || (tel === "YOK" && k.telefon)) return false;
    return true;
  }), [d.kisiler, qGec, roller, kaynaklar, bag, tel, sayilar]); // eslint-disable-line react-hooks/exhaustive-deps
  const siralamaSecenekleri = useMemo(() => kisiSiralama((id) => sayilar.get(id)?.n ?? 0), [sayilar]);
  const sirali = useMemo(() => siralaUygula(liste, sr, siralamaSecenekleri), [liste, sr, siralamaSecenekleri]);
  const gorunen = sirali.length > limit ? sirali.slice(0, limit) : sirali;
  // Süzgeç / arama / sıralama gerçekten değişince liste başa (ilk parçaya) döner; kişi kartından Geri dönüşte açık parça korunur
  const suzImzasi = JSON.stringify([qGec, roller, kaynaklar, bag, tel, sr]);
  const oncekiSuz = useRef(suzImzasi);
  useEffect(() => { if (oncekiSuz.current !== suzImzasi) { oncekiSuz.current = suzImzasi; setLimit(KISI_SAYFA); } }, [suzImzasi, setLimit]);
  const sonRef = useRef<HTMLDivElement>(null);
  useEffect(() => { // listenin sonuna yaklaşılınca sıradaki parça kendiliğinden açılır (IntersectionObserver yoksa "Daha fazla göster" düğmesi yeter)
    const el = sonRef.current; if (!el || typeof IntersectionObserver === "undefined") return;
    const o = new IntersectionObserver((e) => { if (e[0]?.isIntersecting) setLimit((l) => l + KISI_SAYFA); }, { rootMargin: "800px" });
    o.observe(el); return () => o.disconnect();
  }, [gorunen.length, sirali.length, setLimit]);
  const gorunenSecili = sirali.filter((k) => secili.has(k.id)); // yalnızca ekranda görünen ve seçili olanlar işlenir (filtre değişince gizli seçimler silinmez)
  const filtreSayisi = roller.length + kaynaklar.length + (bag ? 1 : 0) + (tel ? 1 : 0);
  const filtreVar = !!(q || filtreSayisi);
  const temizle = () => { setQ(""); setRoller([]); setKaynaklar([]); setBag(""); setTel(""); };
  // v3.21 — Google
  const gBagli = d.baglantilar?.google.durum === "BAGLI";
  const gGorunur = !CANLI.acik || !!d.googleCanli?.hazir;                       // canlıda Google bu kurulumda açılmadıysa düğme yok
  const gYetkili = !CANLI.acik || !!d.googleCanli?.yetkili;
  const [gMesgul, setGMesgul] = useState(false);
  const topluSil = () => {
    const ids = new Set(gorunenSecili.map((k) => k.id));
    guncelle((x) => kisileriSil(x, ids));
    bildir(`${ids.size} kişi silindi${gBagli ? " — Google rehberinizde duruyor" : ""}`); setSecili(new Set()); setSilOnay(false); setDuzenId(null);
  };
  const googleEsitleTikla = () => {
    if (!gBagli) return git({ ad: "baglantilar" });
    if (CANLI.acik) { setGMesgul(true); googleEsitle(guncelle).then((o) => bildir(ozetCumlesi(o))).catch((e) => bildir("Eşitlenemedi: " + String(e?.message ?? e))).finally(() => setGMesgul(false)); return; }
    let o: any; guncelle((x) => { const r = demoGoogleSenkron(x, "kullanici"); o = r.calisma.ozet; return r.d; }); bildir(ozetCumlesi(o));
  };
  const gonderilebilir = gorunenSecili.filter((k) => !k.googleResourceName && k.telefon && !k.kaynaktaSilindi && !googleBekliyorMu(k));
  const googleaGonder = () => {
    const ids = new Set(gonderilebilir.map((k) => k.id));
    guncelle((x) => ({ ...x, kisiler: x.kisiler.map((k) => (ids.has(k.id) ? { ...k, googleaGonder: true } : k)) }));
    bildir(`${ids.size} kişi bir sonraki eşitlemede Google rehberinize eklenecek`); setSecili(new Set());
  };
  const toplamBag = gorunenSecili.reduce((a, k) => a + kayitSay(k.id), 0);
  const harici = gorunenSecili.filter((k) => k.googleResourceName).length;
  const degisSec = (id: string) => setSecili((x) => { const y = new Set(x); if (y.has(id)) y.delete(id); else y.add(id); return y; });
  const hepsiSecili = sirali.length > 0 && sirali.every((k) => secili.has(k.id));
  return <div className="yigin">
    <div className="satir-ara"><h2>Kişiler</h2><div className="satir">{gGorunur && (gBagli || gYetkili) && <button className="btn" disabled={gMesgul || (gBagli && !gYetkili)} onClick={googleEsitleTikla}>{gMesgul ? "Eşitleniyor…" : gBagli ? `Google ile eşitle${(d.googleBekleyen ?? []).length ? ` (${d.googleBekleyen!.length} yeni)` : ""}` : "Google ile bağlan"}</button>}<button className="btn birincil" onClick={() => setYeniAcik(!yeniAcik)}>+ Yeni kişi</button></div></div>
    {yeniAcik && <div className="kart"><div className="alanlar">
      <div className="alan"><label htmlFor="nk-ad">Ad soyad / firma</label><input id="nk-ad" value={yeni.adSoyad} onChange={(e) => setYeni({ ...yeni, adSoyad: e.target.value })} /></div>
      <div className="alan"><label htmlFor="nk-tel">Telefon</label><TelGirdisi id="nk-tel" deger={yeni.telefon} onChange={(v) => setYeni({ ...yeni, telefon: v })} /></div>
      <div className="alan"><label htmlFor="nk-rol">Rol</label><select id="nk-rol" value={yeni.rol} onChange={(e) => setYeni({ ...yeni, rol: e.target.value })}><option value="">—</option>{KISI_ROLLERI.map(([r, l]) => <option key={r} value={r}>{l}</option>)}</select></div>
    </div><div className="satir"><button className="btn birincil" disabled={yeni.adSoyad.trim().length < 2 || !!telUyarisi(yeni.telefon)} onClick={() => { const id = kisiEkle(guncelle, d, { elle: true, adSoyad: yeni.adSoyad, telefon: yeni.telefon, roller: yeni.rol ? [yeni.rol] : [] }); setYeni({ adSoyad: "", telefon: "", rol: "" }); setYeniAcik(false); git({ ad: "kisi", id }); }}>Ekle ve kartı aç</button></div></div>}
    <div className="fc"><div className="fc-ara"><span aria-hidden="true">⌕</span><input type="search" aria-label="Kişi ara" placeholder="Ara: ad, şirket, telefon, e-posta, rol, not…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      <button type="button" className={cx("fc-btn", filtreSayisi > 0 && "on")} onClick={() => setFiltreAcik(!filtreAcik)} aria-expanded={filtreAcik}>Filtrele{filtreSayisi > 0 && <b className="fc-rozet">{filtreSayisi}</b>}</button>
      <SiralaDugmesi secenekler={kisiSiralama(kSay)} s={sr} set={setSr} /></div>
    {/* v3.16 — dağınık çip satırları tek "Filtrele" menüsünde toplandı (rol · kaynak · kayıt · telefon) */}
    {filtreSayisi > 0 && <div className="aktif-filtreler">{[
      ...roller.map((r) => ({ e: r === ROLSUZ ? "Rolü yok" : rolAd(r), k: () => setRoller(roller.filter((x) => x !== r)) })),
      ...kaynaklar.map((x) => ({ e: KAYNAK_ETIKET[x], k: () => setKaynaklar(kaynaklar.filter((y) => y !== x)) })),
      ...(bag ? [{ e: bag === "YOK" ? "Kaydı olmayanlar" : bag === "TALEP" ? "Talebi olanlar" : "Portföyü olanlar", k: () => setBag("") }] : []),
      ...(tel ? [{ e: tel === "VAR" ? "Telefonu olanlar" : "Telefonu olmayanlar", k: () => setTel("") }] : []),
    ].map((c, i) => <button key={i} className="cip" onClick={c.k}>{c.e} <span aria-hidden="true">×</span></button>)}
      <button className="fc-temizle" onClick={temizle}>Temizle</button></div>}
    {filtreAcik && <div className="kart yigin kucuk-bosluk fp-kisi">
      <details open><summary>Rol <small className="ipucu">{roller.length ? `${roller.length} seçili` : "Tümü"}</small></summary>
        <div className="cip-satir">{[...KISI_ROLLERI, [ROLSUZ, "Rolü yok"] as [string, string]].map(([r, l]) => { const n = r === ROLSUZ ? d.kisiler.filter((k) => !k.roller.length).length : d.kisiler.filter((k) => k.roller.includes(r)).length; const on = roller.includes(r); if (!n && !on && r === ROLSUZ) return null; return <button key={r} className={cx("cip secilir", on && "on")} style={!n && !on ? { opacity: 0.55 } : undefined} onClick={() => setRoller(on ? roller.filter((x) => x !== r) : [...roller, r])}>{l} <small>{n}</small></button>; })}</div>
      </details>
      <details><summary>Kaynak <small className="ipucu">{kaynaklar.length ? `${kaynaklar.length} seçili` : "Tümü"}</small></summary>
        <div className="cip-satir">{["GOOGLE", ...(notionAcik() ? ["NOTION"] : []), "WHATSAPP", "MANUEL"].map((x) => { const n = d.kisiler.filter((k) => kaynakTutar(k, x)).length; if (!n) return null; const on = kaynaklar.includes(x); return <button key={x} className={cx("cip secilir", on && "on")} onClick={() => setKaynaklar(on ? kaynaklar.filter((y) => y !== x) : [...kaynaklar, x])}>{KAYNAK_ETIKET[x]} <small>{n}</small></button>; })}</div>
      </details>
      <details><summary>Kayıt ve telefon <small className="ipucu">{[bag ? "kayıt" : "", tel ? "telefon" : ""].filter(Boolean).join(", ") || "Tümü"}</small></summary>
        <div className="satir sar">
          <select aria-label="Bağlı kayıt" value={bag} onChange={(e) => setBag(e.target.value as typeof bag)}><option value="">Kayıt: hepsi</option><option value="TALEP">Talebi olanlar</option><option value="PORTFOY">Portföyü olanlar</option><option value="YOK">Kaydı olmayanlar</option></select>
          <select aria-label="Telefon" value={tel} onChange={(e) => setTel(e.target.value as typeof tel)}><option value="">Telefon: hepsi</option><option value="VAR">Telefonu olanlar</option><option value="YOK">Telefonu olmayanlar</option></select>
        </div>
      </details>
    </div>}
    {/* v3.19 — tek ince satır: sayı + "Seç". Onay kutuları ve toplu işlem düğmeleri yalnızca seçim modunda çıkar. */}
    <div className="kisi-arac">
      <span className="ipucu">{liste.length} kişi{gorunenSecili.length > 0 && ` · ${gorunenSecili.length} seçili`}</span>
      {!secimModu ? <button className="btn kucuk" onClick={() => setSecimModu(true)} disabled={!sirali.length}>Seç</button> : <div className="kisi-arac-sec">
        <label className="kisi-hepsi"><input type="checkbox" aria-label="Listedeki tüm kişileri seç" checked={hepsiSecili} onChange={(e) => setSecili(e.target.checked ? new Set([...secili, ...sirali.map((k) => k.id)]) : new Set([...secili].filter((id) => !sirali.some((k) => k.id === id))))} /> {filtreVar ? "Süzülenlerin" : "Tümünün"} seçimi ({sirali.length})</label>
        {gorunenSecili.length > 0 && !silOnay && <><button className="btn kucuk" onClick={() => setSecili(new Set())}>Seçimi kaldır</button>{googleCiftYonlu(d) && gonderilebilir.length > 0 && <button className="btn kucuk" onClick={googleaGonder}>Google'a gönder ({gonderilebilir.length})</button>}<button className="btn kucuk tehlike" onClick={() => setSilOnay(true)}>Toplu sil ({gorunenSecili.length})</button></>}
        <button className="btn kucuk" onClick={() => { setSecimModu(false); setSecili(new Set()); setSilOnay(false); }}>Bitti</button>
      </div>}
    </div>
    {silOnay && <div className="hata-kutu" role="alert"><b>{gorunenSecili.length} kişi silinecek.</b> Bağlı oldukları {toplamBag} kayıttan kişi bağı kalkar (kayıtların kendisi silinmez).{gBagli ? <> <b>Google rehberinizden silinmez</b>{harici > 0 ? ` (${harici} kişi Google'a bağlı)` : ""}; silinen kişiler bir sonraki eşitlemede Anahtar'a geri de gelmez. İsterseniz Bağlantılar › "Silinenleri yeniden getir" ile geri alırsınız.</> : null}
      <div className="satir"><button className="btn tehlike" onClick={topluSil}>Evet, sil</button><button className="btn" onClick={() => setSilOnay(false)}>Vazgeç</button></div></div>}
    {gorunen.map((k) => { const sy = sayilar.get(k.id); return <React.Fragment key={k.id}>
      <div className={cx("kart kisi-kart", secili.has(k.id) && "secili")} role="button" tabIndex={0} onClick={() => (secimModu ? degisSec(k.id) : git({ ad: "kisi", id: k.id }))} onKeyDown={(e) => { if (e.key === "Enter") (secimModu ? degisSec(k.id) : git({ ad: "kisi", id: k.id })); }}>
        {secimModu && <input type="checkbox" aria-label={`${k.adSoyad} seç`} checked={secili.has(k.id)} onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()} onChange={() => degisSec(k.id)} />}
        <div className="avatar">{k.adSoyad[0]?.toLocaleUpperCase("tr")}</div>
        <div className="kisi-bilgi"><b>{k.adSoyad}</b>{k.sirket && <div className="kk-alt">{k.sirket}</div>}<div className="kk-alt">{telYaz(k.telefon)}</div>
          <div className="pill-satir"><KaynakRozeti k={k} />{k.roller.map((r) => <Pill key={r}>{rolAd(r)}</Pill>)}{!!sy?.t && <Pill ton="mavi">{sy.t} talep</Pill>}{!!sy?.p && <Pill ton="yesil">{sy.p} portföy</Pill>}</div></div>
        <button className="btn kucuk" aria-label={`${k.adSoyad} hızlı düzenle`} onKeyDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); setDuzenId(duzenId === k.id ? null : k.id); }}><span aria-hidden="true">✎</span><span className="kisi-duzen-yazi"> Düzenle</span></button>
        <IletisimDugmeleri tel={k.telefon} ad={k.adSoyad} kucuk />
      </div>
      {duzenId === k.id && <HizliDuzen k={k} kapat={() => setDuzenId(null)} />}
    </React.Fragment>; })}
    {sirali.length > gorunen.length && <div ref={sonRef} className="satir" style={{ justifyContent: "center", padding: "12px 0" }}>
      <button className="btn" onClick={() => setLimit((l) => l + KISI_SAYFA)}>Daha fazla göster ({sirali.length - gorunen.length} kişi daha)</button></div>}
    {!liste.length && <p className="bos">Eşleşen kişi yok.</p>}
  </div>;
}

const ROLSUZ = "__ROLSUZ";
/** v3.22.2 — Kişiler listesi bu kadarlık parçalarla çizilir (7.800 kartın hepsi birden DOM'a girince telefon donuyordu) */
const KISI_SAYFA = 60;
/** Arama metni kişi başına bir kez üretilir (kişi nesnesi değişmedikçe); rol adları ayrıca eklenir (özel roller yeniden adlandırılabilir) */
const HAM_METIN = new WeakMap<Kisi, string>();
const hamOf = (k: Kisi): string => { let h = HAM_METIN.get(k); if (h === undefined) { h = `${k.adSoyad} ${k.telefon ?? ""} ${k.ikincilTelefon ?? ""} ${k.sirket ?? ""} ${k.email ?? ""} ${k.referans ?? ""} ${k.notlar ?? ""}`.toLocaleLowerCase("tr"); HAM_METIN.set(k, h); } return h; };

/** v3.15 — listeden çıkmadan hızlı düzenleme: ad, telefon, şirket, e-posta, roller */
function HizliDuzen({ k, kapat }: { k: Kisi; kapat: () => void }) {
  const { guncelle, bildir } = useDepo();
  const [f, setF] = useState<Kisi>(k);
  const kaydet = () => {
    if (f.adSoyad.trim().length < 2) return bildir("Ad en az 2 karakter olmalı");
    const u = telUyarisi(f.telefon); if (u) return bildir(u);
    guncelle((x) => ({ ...x, kisiler: x.kisiler.map((y) => (y.id === k.id ? duzeltmeIsareti(x, y, { ...f, adSoyad: f.adSoyad.trim(), telefon: telNormalize(f.telefon) || null }) : y)) }));
    bildir("Kişi güncellendi"); kapat();
  };
  return <section className="kart form" onClick={(e) => e.stopPropagation()}>
    <div className="alanlar">
      <div className="alan"><label htmlFor={`hd-ad-${k.id}`}>Ad soyad / firma</label><input id={`hd-ad-${k.id}`} value={f.adSoyad} onChange={(e) => setF({ ...f, adSoyad: e.target.value })} /></div>
      <div className="alan"><label htmlFor={`hd-tel-${k.id}`}>Telefon</label><TelGirdisi id={`hd-tel-${k.id}`} deger={f.telefon ?? ""} onChange={(v) => setF({ ...f, telefon: v })} /></div>
      <div className="alan"><label htmlFor={`hd-sirket-${k.id}`}>Şirket</label><input id={`hd-sirket-${k.id}`} value={f.sirket ?? ""} onChange={(e) => setF({ ...f, sirket: e.target.value || null })} /></div>
      <div className="alan"><label htmlFor={`hd-eposta-${k.id}`}>E-posta</label><input id={`hd-eposta-${k.id}`} type="email" value={f.email ?? ""} onChange={(e) => setF({ ...f, email: e.target.value || null })} /></div>
    </div>
    {/* v3.17 — not listeden de yazılabilir */}
    <div className="alan genis"><label htmlFor={`hd-not-${k.id}`}>Açıklama / notlar</label><textarea id={`hd-not-${k.id}`} rows={2} value={f.notlar ?? ""} onChange={(e) => setF({ ...f, notlar: e.target.value || null })} /></div>
    <div className="alan-etiket">Roller</div>
    <div className="cip-satir">{KISI_ROLLERI.map(([r, l]) => { const on = f.roller.includes(r); return <button key={r} type="button" className={cx("cip secilir", on && "on")} onClick={() => setF({ ...f, roller: on ? f.roller.filter((x) => x !== r) : [...f.roller, r] })}>{l}</button>; })}</div>
    <div className="satir"><button className="btn birincil" onClick={kaydet}>Kaydet</button><button className="btn" onClick={kapat}>Vazgeç</button></div>
  </section>;
}

export function KisiKarti({ id }: { id: string }) {
  const { d, guncelle, git, bildir } = useDepo();
  const k = d.kisiler.find((x) => x.id === id);
  const es = useEslesmeler();
  const [duzen, setDuzen] = useState(false);
  const [f, setF] = useState<Kisi | null>(k ?? null);
  if (!k || !f) return <div className="yigin"><p className="bos">Kişi bulunamadı.</p></div>;
  const ky = kisininKayitlari(d.kayitlar, id);
  const idler = new Set(ky.map((x) => x.id));
  const kisiEs = es.filter((e) => (idler.has(e.t.id) || idler.has(e.p.id)) && e.s.uygunluk !== "UYGUN_DEGIL");
  const kaydet = () => { if (telUyarisi(f.telefon)) { bildir(telUyarisi(f.telefon)!); return; } guncelle((x) => ({ ...x, kisiler: x.kisiler.map((y) => (y.id === id ? duzeltmeIsareti(x, y, { ...f, telefon: telNormalize(f.telefon) || null }) : y)) })); setDuzen(false); bildir("Kişi güncellendi"); };
  const rolBagi = (kayit: Kayit) => (kayit.veri.kisiler ?? []).filter((b) => b.kisiId === id).map((b) => rolAd(b.rol, KAYIT_ROLLERI)).join(", ");
  return <div className="yigin">
    <section className="kart kisi-bas">
      <div className="avatar buyuk">{k.adSoyad[0]?.toLocaleUpperCase("tr")}</div>
      <div className="yigin kucuk-bosluk" style={{ flex: 1 }}>
        <h2>{k.adSoyad}</h2>
        {k.sirket && <div className="kk-alt">{k.sirket}</div>}
        {k.telefon && <div className="satir"><span className="tel">{telYaz(k.telefon)}</span><Kopyala metin={k.telefon} etiketi="Numarayı kopyala" /></div>}
        <IletisimDugmeleri tel={k.telefon} ad={k.adSoyad} />
        <div className="pill-satir"><KaynakRozeti k={k} />{k.roller.map((r) => <Pill key={r}>{rolAd(r)}</Pill>)}{k.uzmanlikAileleri.map((a) => <Pill key={a} ton="mavi">{MULK_AILELERI.find((x) => x.kod === a)?.etiket ?? a}</Pill>)}</div>
      </div>
      <div className="yigin kucuk-bosluk" style={{ alignItems: "flex-end" }}>
        <button className="btn kucuk" onClick={() => { setF(k); setDuzen(!duzen); }}>{duzen ? "Vazgeç" : "Düzenle"}</button>
        {/* v3.21 — toplu içe aktarılmış / WhatsApp'tan gelmiş kişiyi tek tek Google rehberine gönder */}
        {googleCiftYonlu(d) && !k.googleResourceName && k.telefon && !k.kaynaktaSilindi && !googleBekliyorMu(k) && <button className="btn kucuk" onClick={() => { guncelle((x) => ({ ...x, kisiler: x.kisiler.map((y) => (y.id === id ? { ...y, googleaGonder: true } : y)) })); bildir("Bir sonraki eşitlemede Google rehberinize eklenecek"); }}>Google'a gönder</button>}
      </div>
    </section>
    {duzen && <section className="kart form">
      <div className="alanlar">
        <div className="alan"><label htmlFor="kk-ad">Ad soyad / firma</label><input id="kk-ad" value={f.adSoyad} onChange={(e) => setF({ ...f, adSoyad: e.target.value })} /></div>
        <div className="alan"><label htmlFor="kk-tel">Telefon</label><TelGirdisi id="kk-tel" deger={f.telefon ?? ""} onChange={(v) => setF({ ...f, telefon: v })} /></div>
        <div className="alan"><label htmlFor="kk-sirket">Şirket</label><input id="kk-sirket" value={f.sirket ?? ""} onChange={(e) => setF({ ...f, sirket: e.target.value || null })} /></div>
        <div className="alan"><label htmlFor="kk-ref">Referans</label><input id="kk-ref" value={f.referans ?? ""} onChange={(e) => setF({ ...f, referans: e.target.value || null })} placeholder="Kim tanıştırdı?" /></div>
      </div>
      <div className="alan-etiket">Rolleri</div>
      <div className="cip-satir">{KISI_ROLLERI.map(([r, l]) => { const on = f.roller.includes(r); return <button key={r} type="button" className={cx("cip secilir", on && "on")} onClick={() => setF({ ...f, roller: on ? f.roller.filter((x) => x !== r) : [...f.roller, r] })}>{l}</button>; })}</div>
      {f.roller.includes("EMLAKCI") && <><div className="alan-etiket">Uzmanlığı (emlakçı)</div><div className="cip-satir">{MULK_AILELERI.map((a) => { const on = f.uzmanlikAileleri.includes(a.kod); return <button key={a.kod} type="button" className={cx("cip secilir", on && "on")} onClick={() => setF({ ...f, uzmanlikAileleri: on ? f.uzmanlikAileleri.filter((x) => x !== a.kod) : [...f.uzmanlikAileleri, a.kod] })}>{a.etiket}</button>; })}</div></>}
      <label className="alan-etiket" htmlFor="kk-not">Açıklama / notlar</label>
      <textarea id="kk-not" rows={3} value={f.notlar ?? ""} onChange={(e) => setF({ ...f, notlar: e.target.value || null })} />
      <div className="satir"><button className="btn birincil" onClick={kaydet}>Kaydet</button></div>
    </section>}
    {!duzen && (k.notlar || k.referans || k.whatsappGruplari.length > 0) && <section className="kart">
      {k.notlar && <p style={{ whiteSpace: "pre-wrap", margin: 0 }}>{k.notlar}</p>}
      <div className="izgara" style={{ marginTop: k.notlar ? 10 : 0 }}>
        {k.referans && <div><span>Referans</span><b>{k.referans}</b></div>}
        {k.whatsappGruplari.length > 0 && <div><span>WhatsApp grupları</span><b>{k.whatsappGruplari.join(", ")}</b></div>}
        <div><span>Kişilere eklenme</span><b>{tarihYaz(k.olusturma)}</b></div>
      </div>
    </section>}
    <div className="istat">
      <div className="istat-kutu"><b>{ky.filter((x) => x.veri.tip === "PORTFOY").length}</b><span>Portföy</span></div>
      <div className="istat-kutu"><b>{ky.filter((x) => x.veri.tip === "TALEP").length}</b><span>Talep</span></div>
      <div className="istat-kutu"><b>{kisiEs.length}</b><span>Uygun eşleşme</span></div>
      <div className="istat-kutu"><b>{ky.filter((x) => x.veri.durum === "ACTIVE").length}</b><span>Aktif kayıt</span></div>
    </div>
    <section>
      <div className="bolum-bas"><h3>Kayıtları</h3><div className="satir"><button className="btn kucuk" onClick={() => git({ ad: "form", tip: "TALEP", taslak: { kisiler: [{ kisiId: id, rol: k.roller.includes("EMLAKCI") ? "EMLAKCI" : "MUSTERI" }] } as any })}>+ Talep</button><button className="btn kucuk" onClick={() => git({ ad: "form", tip: "PORTFOY", taslak: { kisiler: [{ kisiId: id, rol: k.roller.includes("EMLAKCI") ? "EMLAKCI" : "SAHIP" }] } as any })}>+ Portföy</button></div></div>
      {ky.map((x) => <button key={x.id} className="kart kayit-kart" onClick={() => git({ ad: "detay", id: x.id })}>
        <div className="pill-satir"><Pill ton={x.veri.tip === "TALEP" ? "mavi" : "yesil"}>{etiket(x.veri.tip)}</Pill><Pill>{etiket(x.veri.mulkTipi)}</Pill><IslemPill islem={x.veri.islemTipi} /><Pill>{rolBagi(x)}</Pill><TTL v={x.veri} /></div>
        <div className="kk-baslik">{baslikOf(x.veri)}</div><div className="kk-alt">{x.veri.lokasyonlar.map(lokEtiket).join(" · ")} · {fiyatOf(x.veri)}{m2Of(x.veri) ? " · " + m2Of(x.veri) : ""}</div>
      </button>)}
      {!ky.length && <p className="bos">Bu kişiye bağlı kayıt yok.</p>}
    </section>
    {ky.some((x) => (x.notlar ?? []).length) && <section>
      <div className="bolum-bas"><h3>Görüşmeler ve notlar</h3></div>
      <div className="kart"><ul className="not-akisi">{ky.flatMap((x) => (x.notlar ?? []).map((n) => ({ n, x }))).sort((a, b) => b.n.tarih.localeCompare(a.n.tarih)).slice(0, 15).map(({ n, x }) => <li key={n.id}><span className={"not-tur t-" + n.tur.toLowerCase()}>{NOT_TURU[n.tur]}</span><div><div className="ipucu">{tarihYaz(n.tarih)} · <button className="baglanti" onClick={() => git({ ad: "detay", id: x.id })}>{baslikOf(x.veri)}</button></div><div style={{ whiteSpace: "pre-wrap" }}>{n.metin}</div></div></li>)}</ul></div>
    </section>}
    {kisiEs.length > 0 && <section>
      <div className="bolum-bas"><h3>Eşleşmeleri</h3></div>
      {kisiEs.slice(0, 10).map((e) => <button key={eKey(e.t.id, e.p.id)} className="kart es-kart" onClick={() => git({ ad: "eslesme", tid: e.t.id, pid: e.p.id })}><Skor s={e.s.skor} u={e.s.uygunluk} /><div className="es-orta"><div className="es-satir"><span className="es-tip">Talep</span>{baslikOf(e.t.veri)}</div><div className="es-satir"><span className="es-tip">Portföy</span>{baslikOf(e.p.veri)}</div></div></button>)}
    </section>}
  </div>;
}