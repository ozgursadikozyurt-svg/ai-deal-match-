/**
 * Anahtar CRM v3.44.1 · 27 Ekim 2026
 * İŞLEMLER — kapanan satış / kiralama ve komisyon (yalnızca ofis yöneticisi: islem.yonet).
 *
 * v3.44 — ekran Polaris'teki "İş planı · İşlemler" düzeninde yeniden kuruldu:
 *   · altı renkli özet kutusu (toplam, aylık ortalama, yıl hedefine kalan, satış, kiralama, reklamdan gelen)
 *   · arama + tür cipleri (Hepsi / Satış / Kiralama / Diğer) + ay seçimi
 *   · renkli tablo (geniş ekran) ve kart listesi (telefon), altında TOTAL satırı
 *   · aylara göre gelir çubuk grafiği (çubuğa dokun → o ay) ve gelirin paylaşımı halka grafiği
 *   · "Kimden iş geldi?" — referans ve taraflara göre kişi bazlı özet
 *   · CSV indir
 * Form Polaris'teki kadar ayrıntılı: tür (Satış/Kiralama/Diğer), paylaşılan kişi + telefonu,
 * referans (işi kim getirdi) ve rehberden taraflar.
 * P&L kuralı değişmedi: "bana kalan" tahsilat ayına yazılır; tahsilat tarihi boşsa "bekleyen" (src/lib/domain/islem.ts).
 *
 * v3.44.1 — Taraf, paylaşılan kişi ve referans için ad her zaman sunucuya gönderilir. Rehberdeki kişi
 * henüz sunucuya yazılmamışsa (ya da silinmişse) sunucu bağı kurmaz ama adı saklar; işlem kaydedilir
 * ve kullanıcıya hangi kişinin bağlanamadığı söylenir. Eskiden bu durum kaydı tümden engelliyordu.
 */
import React, { useContext, useEffect, useMemo, useState } from "react";
import { useKaydedilmemis, useIlkHal } from "./kirli";
import { C, baslikOf } from "./ortak";
import { CANLI } from "./depo";
import {
  ISLEM_TURLERI, ISLEM_TURU_ETIKET, ISLEM_TURU_TON, TARAF_ROLLERI, TARAF_ROLU_ETIKET,
  aylikBanaKalan, notEtiketleri, yilOzeti, kimdenIsGeldi, turTahmini,
  type IslemTuru, type TarafRolu,
} from "../src/lib/domain/islem";
import { YIL_HEDEFI_VARSAYILAN } from "../src/lib/domain/ayarlar";

export interface IslemTarafi { kisiId: string | null; rol: TarafRolu; ad?: string; telefon?: string | null }
export interface Islem {
  id: string; tarih: string; tahsilatTarihi: string | null; tur: IslemTuru; baslik: string;
  bedel: number | null; paylasilan: number | null; ofisPayi: number | null; banaKalan: number | null;
  aciklama: string | null; reklam: boolean; talepKaynagi?: string | null; talepId?: string | null; portfoyId?: string | null; kisiId?: string | null; disKaynak?: string | null;
  paylasilanKisiId?: string | null; paylasilanAd?: string | null; paylasilanTelefon?: string | null;
  referansKisiId?: string | null; referansAd?: string | null;
  taraflar?: IslemTarafi[];
}
const AYLAR = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];
const AY_TAM = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
const TL = (n: number | null | undefined) => (n == null ? "—" : `${Math.round(n).toLocaleString("tr-TR")} ₺`);
/** Kutularda ve grafikte kısaltma: 1.982.180 → "1,98 M" · 488.000 → "488 B" */
const KISA = (n: number) => { const a = Math.abs(n); return a >= 1_000_000 ? (n / 1_000_000).toLocaleString("tr-TR", { maximumFractionDigits: 2 }) + " M" : a >= 1000 ? Math.round(n / 1000).toLocaleString("tr-TR") + " B" : Math.round(n).toLocaleString("tr-TR"); };
const bugun = () => new Date().toISOString().slice(0, 10);
const gunYaz = (g: string) => new Date(g + "T12:00:00").toLocaleDateString("tr-TR");
const kucuk = (s: string) => s.toLocaleLowerCase("tr-TR");
const sayiOku = (s: string): number | null => { const t = s.trim().replace(/\./g, "").replace(",", "."); if (!t) return null; const n = Number(t); if (!Number.isFinite(n)) throw new Error(`"${s}" sayı değil`); return n; };

const DEMO: Islem[] = [
  { id: "di1", tarih: "2026-09-12", tahsilatTarihi: "2026-09-12", tur: "KIRALAMA", baslik: "Kepez 1.200 m² depo kiralama (örnek)", bedel: 150000, paylasilan: null, ofisPayi: 30000, banaKalan: 120000, aciklama: "Faturalı, ofisle paylaşıldı", reklam: true, talepKaynagi: "META_REKLAM", taraflar: [] },
  { id: "di2", tarih: "2026-10-03", tahsilatTarihi: "2026-10-05", tur: "SATIS", baslik: "Lara dükkan satış (örnek)", bedel: 7500000, paylasilan: 75000, ofisPayi: 37500, banaKalan: 112500, aciklama: "Elden nakit alındı, fatura kesilmedi", reklam: false, paylasilanAd: "Erkan Ateş Emlak", paylasilanTelefon: "+905321112233", referansAd: "Mustafa Bey", taraflar: [] },
  { id: "di3", tarih: "2026-10-15", tahsilatTarihi: null, tur: "KIRALAMA", baslik: "Aksu ofis kiralama — tahsilat bekliyor (örnek)", bedel: 40000, paylasilan: null, ofisPayi: 8000, banaKalan: 32000, aciklama: null, reklam: false, taraflar: [] },
];

async function api<T>(yol: string, init?: { method?: string; json?: unknown }): Promise<T> {
  const r = await CANLI.api!(yol, init);
  const j: any = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j?.mesaj ?? (j?.alanlar ? j.alanlar.map((a: any) => `${a.alan}: ${a.mesaj}`).join(", ") : `Sunucu ${r.status}`));
  return j as T;
}

// ───────── Grafikler (bağımlılıksız SVG) ─────────
function AyGrafigi({ aylar, secili, sec, ayAdet }: { aylar: number[]; secili: number | null; sec: (i: number | null) => void; ayAdet: (i: number) => number }) {
  // Yılın tamamı gösterilir: boş ay da yerini korur (soluk iz) — sezon boşlukları ancak böyle görünür.
  const enb = Math.max(1, ...aylar);
  const enIyi = aylar.reduce((b, v, i) => (v > aylar[b] ? i : b), 0);
  return <div>
    <div className="gc-sarmal">
      {[1, 0.5].map((o) => <div key={o} className="gc-cizgi" style={{ bottom: `${o * 78 + 15}%` }} aria-hidden />)}
      <div className="gc-izgara" style={{ gridTemplateColumns: `repeat(${aylar.length},1fr)` }}>
        {aylar.map((v, i) => <button key={i} type="button" className={"gc-sutun" + (secili === i ? " on" : "")} aria-pressed={secili === i}
          title={`${AY_TAM[i]} · ${TL(v)} · ${ayAdet(i)} işlem`} onClick={() => sec(secili === i ? null : i)}>
          <span className="gc-deger">{v && (i === secili || (secili == null && i === enIyi)) ? KISA(v) : ""}</span>
          <span className="gc-iz"><span className="gc-dolgu" style={{ height: `${v ? Math.max(3, (v / enb) * 100) : 0}%` }} /></span>
          <span className="gc-ay">{AYLAR[i]}</span>
        </button>)}
      </div>
    </div>
    <p className="ipucu">Çubuğa dokun: o ayı seç. Rakamlar "bana kalan", TL.</p>
  </div>;
}

function HalkaGrafigi({ dilimler }: { dilimler: { ad: string; deger: number; ton: string }[] }) {
  const toplam = dilimler.reduce((a, d) => a + d.deger, 0);
  const R = 52, iç = 34, C2 = 2 * Math.PI * R;
  let geçen = 0;
  return <div className="halka-sar">
    <svg viewBox="0 0 120 120" className="halka" role="img" aria-label="Gelirin paylaşımı">
      <circle cx="60" cy="60" r={R} fill="none" stroke="var(--line)" strokeWidth={R - iç} />
      {toplam > 0 && dilimler.filter((d) => d.deger > 0).map((d) => {
        const uz = (d.deger / toplam) * C2; const el = <circle key={d.ad} cx="60" cy="60" r={R} fill="none" stroke={`var(--${d.ton})`} strokeWidth={R - iç}
          strokeDasharray={`${uz} ${C2 - uz}`} strokeDashoffset={-geçen} transform="rotate(-90 60 60)" />; geçen += uz; return el;
      })}
      <text x="60" y="58" textAnchor="middle" className="halka-orta">{KISA(toplam)}</text>
      <text x="60" y="72" textAnchor="middle" className="halka-alt">toplam</text>
    </svg>
    <ul className="halka-liste">
      {dilimler.map((d) => <li key={d.ad}><i style={{ background: `var(--${d.ton})` }} /><span>{d.ad}</span><b>{TL(d.deger)}</b><small>%{toplam ? Math.round((d.deger / toplam) * 100) : 0}</small></li>)}
    </ul>
  </div>;
}

// ───────── Form ─────────
type Form = {
  tarih: string; tahsil: boolean; tahsilatTarihi: string; tur: IslemTuru; turElle: boolean; baslik: string;
  bedel: string; paylasilan: string; ofisPayi: string; banaKalan: string; aciklama: string; reklam: boolean;
  talep: string; portfoy: string;
  paylasilanAd: string; paylasilanTelefon: string; referansAd: string; taraflar: IslemTarafi[];
  tarafAd: string; tarafRol: TarafRolu;
};
const bosForm = (): Form => ({ tarih: bugun(), tahsil: true, tahsilatTarihi: bugun(), tur: "DIGER", turElle: false, baslik: "", bedel: "", paylasilan: "", ofisPayi: "", banaKalan: "", aciklama: "", reklam: false, talep: "", portfoy: "", paylasilanAd: "", paylasilanTelefon: "", referansAd: "", taraflar: [], tarafAd: "", tarafRol: "ALICI_KIRACI" });
const formdan = (x: Islem, ad: (id?: string | null) => string): Form => ({
  tarih: x.tarih, tahsil: !!x.tahsilatTarihi, tahsilatTarihi: x.tahsilatTarihi ?? bugun(), tur: x.tur, turElle: true, baslik: x.baslik,
  bedel: x.bedel?.toString() ?? "", paylasilan: x.paylasilan?.toString() ?? "", ofisPayi: x.ofisPayi?.toString() ?? "", banaKalan: x.banaKalan?.toString() ?? "",
  aciklama: x.aciklama ?? "", reklam: x.reklam, talep: ad(x.talepId), portfoy: ad(x.portfoyId),
  paylasilanAd: x.paylasilanAd ?? "", paylasilanTelefon: x.paylasilanTelefon ?? "", referansAd: x.referansAd ?? "",
  taraflar: (x.taraflar ?? []).map((t) => ({ ...t })), tarafAd: "", tarafRol: "ALICI_KIRACI",
});

export function IslemlerEkrani() {
  const { d, bildir, git } = useContext(C);
  const canli = CANLI.acik;
  const [liste, setListe] = useState<Islem[]>(canli ? [] : DEMO);
  const [yukleniyor, setYukleniyor] = useState(canli);
  const [hata, setHata] = useState<string>();
  const [yil, setYil] = useState(new Date().getFullYear());
  const [hedef, setHedef] = useState(YIL_HEDEFI_VARSAYILAN);
  const [ara, setAra] = useState("");
  const [tur, setTur] = useState<"" | IslemTuru>("");
  const [ay, setAy] = useState<number | null>(null);
  const [duzen, setDuzen] = useState<{ id?: string; f: Form } | null>(null);
  const [silOnay, setSilOnay] = useState(false);

  const kayitlar = d.kayitlar ?? [];
  const kisiler = d.kisiler ?? [];
  const adIle = useMemo(() => new Map(kayitlar.map((k: any) => [baslikOf(k.veri), k.id])), [kayitlar]);
  const ad = (id?: string | null) => { const k = kayitlar.find((x: any) => x.id === id); return k ? baslikOf(k.veri) : ""; };
  const kisiAdIle = useMemo(() => new Map(kisiler.map((k) => [kucuk(k.adSoyad), k])), [kisiler]);
  const kisiBul = (metin: string) => kisiAdIle.get(kucuk(metin.trim()));

  const yukle = async () => {
    if (!canli) return;
    try { setListe(await api<Islem[]>("/api/islemler")); setHata(undefined); } catch (e: any) { setHata(e.message); } finally { setYukleniyor(false); }
    try { const a = await api<{ yilHedefi?: number }>("/api/ayarlar"); if (a?.yilHedefi) setHedef(a.yilHedefi); } catch { /* hedef okunamazsa varsayılan kalır */ }
  };
  useEffect(() => { void yukle(); }, []);

  const yillar = useMemo(() => [...new Set([new Date().getFullYear(), ...liste.map((x) => Number(x.tarih.slice(0, 4)))])].sort((a, b) => b - a), [liste]);
  /** Yılın işlemleri — P&L ile aynı kural: tahsilat ayı esas, tahsil edilmeyen o yıl yapılmışsa görünür. */
  const yilinkiler = useMemo(() => liste.filter((x) => (x.tahsilatTarihi ?? x.tarih).startsWith(String(yil))), [liste, yil]);
  const ozet = yilOzeti(yilinkiler, yil, hedef);
  const aylik = aylikBanaKalan(yilinkiler, yil);
  const satislar = yilinkiler.filter((x) => x.tur === "SATIS");
  const kiralar = yilinkiler.filter((x) => x.tur === "KIRALAMA");
  const topla = (l: Islem[]) => l.reduce((a, x) => a + (x.banaKalan ?? 0), 0);

  const q = kucuk(ara.trim());
  const suz = (l: Islem[]) => l
    .filter((x) => !tur || x.tur === tur)
    .filter((x) => !q || kucuk(`${x.baslik} ${x.aciklama ?? ""} ${x.paylasilanAd ?? ""} ${x.referansAd ?? ""} ${(x.taraflar ?? []).map((t) => t.ad).join(" ")}`).includes(q));
  const gorunen = suz(yilinkiler)
    .filter((x) => ay == null || Number((x.tahsilatTarihi ?? x.tarih).slice(5, 7)) === ay + 1)
    .sort((a, b) => ((a.tahsilatTarihi ?? a.tarih) < (b.tahsilatTarihi ?? b.tarih) ? 1 : -1));
  /** Grafik, ay seçiminden etkilenmez (ay seçimi grafikten yapılır); arama ve tür süzgeci uygulanır. */
  const grafikListesi = suz(yilinkiler);
  const grafikAylar = aylikBanaKalan(grafikListesi, yil).aylar;
  const ayAdet = (i: number) => grafikListesi.filter((x) => Number((x.tahsilatTarihi ?? x.tarih).slice(5, 7)) === i + 1).length;
  const kaynaklar = kimdenIsGeldi(yilinkiler as any);
  const topl = (k: keyof Islem) => gorunen.reduce((a, x) => a + (Number(x[k]) || 0), 0);

  // v3.37 — açık formda değişiklik varken başka ekrana geçilirse "kaydedelim mi?"
  const ilkHal = useIlkHal(duzen?.f ?? null);
  const birak = useKaydedilmemis(!!duzen && ilkHal.degisti, "İşlem", () => kaydet());
  const kapatForm = () => { birak(); ilkHal.sifirla(); setDuzen(null); };
  const ac = (x?: Islem) => { ilkHal.sifirla(); setDuzen(x ? { id: x.id, f: formdan(x, ad) } : { f: bosForm() }); setSilOnay(false); window.scrollTo({ top: 0, behavior: "smooth" }); };

  const kaydet = async (): Promise<boolean> => {
    if (!duzen) return true;
    setHata(undefined);
    try {
      const f = duzen.f;
      if (f.baslik.trim().length < 2) throw new Error("Başlık yazın");
      const pk = f.paylasilanAd.trim() ? kisiBul(f.paylasilanAd) : undefined;
      const rk = f.referansAd.trim() ? kisiBul(f.referansAd) : undefined;
      const govde = {
        tarih: f.tarih, tahsilatTarihi: f.tahsil ? f.tahsilatTarihi || f.tarih : null, tur: f.tur, baslik: f.baslik.trim(),
        bedel: sayiOku(f.bedel), paylasilan: sayiOku(f.paylasilan), ofisPayi: sayiOku(f.ofisPayi), banaKalan: sayiOku(f.banaKalan),
        aciklama: f.aciklama.trim() || null, reklam: f.reklam, talepKaynagi: f.reklam ? "REKLAM" : null,
        talepId: f.talep ? adIle.get(f.talep) ?? null : null, portfoyId: f.portfoy ? adIle.get(f.portfoy) ?? null : null,
        // ad her zaman gönderilir: bağ kurulamazsa sunucu adı saklar (v3.44.1)
        paylasilanKisiId: pk?.id ?? null, paylasilanAd: f.paylasilanAd.trim() || null, paylasilanTelefon: f.paylasilanTelefon.trim() || pk?.telefon || null,
        referansKisiId: rk?.id ?? null, referansAd: f.referansAd.trim() || null,
        taraflar: f.taraflar.map((t) => ({ kisiId: t.kisiId, ad: t.ad ?? null, rol: t.rol })),
      };
      let bagsiz: string[] = [];
      if (canli) {
        const y = await api<{ bagsiz?: string[] }>(duzen.id ? `/api/islemler?id=${duzen.id}` : "/api/islemler", { method: duzen.id ? "PATCH" : "POST", json: govde });
        bagsiz = y?.bagsiz ?? [];
        await yukle();
      }
      else {
        const yerel = { ...govde, paylasilanAd: pk?.adSoyad ?? govde.paylasilanAd, referansAd: rk?.adSoyad ?? govde.referansAd, taraflar: f.taraflar } as unknown as Islem;
        setListe((l) => (duzen.id ? l.map((x) => (x.id === duzen.id ? { ...x, ...yerel } : x)) : [{ ...yerel, id: "di" + Date.now() }, ...l]));
      }
      bildir(duzen.id ? "İşlem güncellendi" : "İşlem eklendi");
      // Rehberdeki kişi henüz sunucuya yazılmadıysa bağ kurulamaz; işlem yine kaydedilir, ad durur.
      if (bagsiz.length) setHata(`İşlem kaydedildi. ${[...new Set(bagsiz)].join(", ")} rehberde henüz sunucuya yazılmamış, bu yüzden adıyla kaydedildi — kişi eşitlendikten sonra işlemi açıp yeniden seçerseniz bağ kurulur.`);
      kapatForm();
      return true;
    } catch (e: any) { setHata(e?.message ?? "Kaydedilemedi"); return false; }
  };
  const sil = async () => {
    if (!duzen?.id) return;
    try {
      if (canli) { await api(`/api/islemler?id=${duzen.id}`, { method: "DELETE" }); await yukle(); } else setListe((l) => l.filter((x) => x.id !== duzen.id));
      bildir("İşlem silindi"); kapatForm(); setSilOnay(false);
    } catch (e: any) { setHata(e.message); }
  };
  const setF = (k: keyof Form, v: any) => setDuzen((x) => x && { ...x, f: { ...x.f, [k]: v, ...(k === "baslik" && !x.f.turElle ? { tur: turTahmini(v) } : {}), ...(k === "tarih" && !x.id ? { tahsilatTarihi: v } : {}) } });
  const tarafEkle = () => setDuzen((x) => {
    if (!x) return x;
    const yazilan = x.f.tarafAd.trim();
    if (!yazilan) return x;
    const k = kisiBul(yazilan);
    const ad = k?.adSoyad ?? yazilan;
    if (x.f.taraflar.some((t) => (k ? t.kisiId === k.id : t.ad === ad) && t.rol === x.f.tarafRol)) return { ...x, f: { ...x.f, tarafAd: "" } };
    setHata(undefined);
    return { ...x, f: { ...x.f, taraflar: [...x.f.taraflar, { kisiId: k?.id ?? null, rol: x.f.tarafRol, ad, telefon: k?.telefon ?? null }], tarafAd: "" } };
  });
  const tarafSil = (i: number) => setDuzen((x) => x && { ...x, f: { ...x.f, taraflar: x.f.taraflar.filter((_, j) => j !== i) } });

  const csvIndir = () => {
    const bas = ["Tarih", "Ay", "Tür", "Liste (işlem)", "Bana Kalan", "Fiyat", "Paylaşımlı", "Ofise", "Paylaşılan kişi", "Telefonu", "Referans", "Taraflar", "Açıklama", "Reklamdan gelen"];
    const alan = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const satir = (x: Islem) => [gunYaz(x.tarih), Number((x.tahsilatTarihi ?? x.tarih).slice(5, 7)), ISLEM_TURU_ETIKET[x.tur], x.baslik, x.banaKalan ?? "", x.bedel ?? "", x.paylasilan ?? "", x.ofisPayi ?? "",
      x.paylasilanAd ?? "", x.paylasilanTelefon ?? "", x.referansAd ?? "", (x.taraflar ?? []).map((t) => `${t.ad} (${TARAF_ROLU_ETIKET[t.rol]})`).join("; "), x.aciklama ?? "", x.reklam ? "EVET" : ""].map(alan).join(";");
    const csv = "﻿" + [bas.map(alan).join(";"), ...gorunen.map(satir)].join("\r\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    a.download = `islemler-${yil}.csv`; a.click(); URL.revokeObjectURL(a.href);
  };

  const kisiGit = (id?: string | null) => id && kisiler.some((k) => k.id === id) ? () => git({ ad: "kisi", id }) : undefined;
  const KisiBag = ({ id, ad: adi }: { id?: string | null; ad?: string | null }) => {
    if (!adi) return null;
    const f = kisiGit(id);
    return f ? <button type="button" className="ic-bag" onClick={f}>{adi}</button> : <>{adi}</>;
  };

  return <div className="yigin">
    <div className="satir-ara sar">
      <div><div className="ust-etiket">İş planı {yil} · işlemler</div><h2>İşlemler {yil}</h2></div>
      <div className="satir sar">
        <button className="btn birincil" onClick={() => ac()}>+ Yeni işlem</button>
        <button className="btn" onClick={csvIndir} disabled={!gorunen.length}>CSV indir</button>
      </div>
    </div>
    <p className="ipucu">Kapanan satış ve kiralamalar ile komisyonu. "Bana kalan" tahsilat ayına yazılır; tahsilatı girilmeyen işlem "bekleyen"de durur. Polaris'in İşlemler ve P&amp;L sekmeleri bu kayıtları okur. Bu ekranı yalnızca ofis yöneticisi görür.</p>
    {hata && <p role="alert" className="hata">{hata}</p>}

    {duzen && <section className="kart yigin" aria-label="İşlem formu" onPointerDownCapture={ilkHal.dokun} onKeyDownCapture={ilkHal.dokun} onFocusCapture={ilkHal.dokun}>
      <h3>{duzen.id ? "İşlemi düzenle" : "Yeni işlem"}</h3>
      <div className="alanlar">
        <div className="alan genis"><label htmlFor="i-baslik">Liste (işlem başlığı)</label><input id="i-baslik" maxLength={300} value={duzen.f.baslik} onChange={(e) => setF("baslik", e.target.value)} placeholder="Ör. Kiralama Depo 1.350 m² Yenigöl — Samet Aksu / Erkan Ateş Emlak" /></div>
        <div className="alan"><label htmlFor="i-tarih">İşlem tarihi</label><input id="i-tarih" type="date" value={duzen.f.tarih} onChange={(e) => setF("tarih", e.target.value)} /></div>
        <div className="alan"><label htmlFor="i-tur">Tür</label><select id="i-tur" value={duzen.f.tur} onChange={(e) => setDuzen((x) => x && { ...x, f: { ...x.f, tur: e.target.value as IslemTuru, turElle: true } })}>{ISLEM_TURLERI.map((t) => <option key={t} value={t}>{ISLEM_TURU_ETIKET[t]}</option>)}</select></div>
        <div className="alan"><label htmlFor="i-bedel">Fiyat (satış / kira bedeli) ₺</label><input id="i-bedel" inputMode="decimal" value={duzen.f.bedel} onChange={(e) => setF("bedel", e.target.value)} /></div>
        <div className="alan"><label htmlFor="i-bana">Bana kalan (net komisyon) ₺</label><input id="i-bana" inputMode="decimal" value={duzen.f.banaKalan} onChange={(e) => setF("banaKalan", e.target.value)} /></div>
        <div className="alan"><label htmlFor="i-pay">Paylaşımlı ₺</label><input id="i-pay" inputMode="decimal" value={duzen.f.paylasilan} onChange={(e) => setF("paylasilan", e.target.value)} /></div>
        <div className="alan"><label htmlFor="i-ofis">Ofise ₺</label><input id="i-ofis" inputMode="decimal" value={duzen.f.ofisPayi} onChange={(e) => setF("ofisPayi", e.target.value)} /></div>
        <div className="alan"><label htmlFor="i-pkisi">Paylaşım yapılan kişi</label><input id="i-pkisi" list="i-kisiler" value={duzen.f.paylasilanAd} onChange={(e) => { const k = kisiBul(e.target.value); setDuzen((x) => x && { ...x, f: { ...x.f, paylasilanAd: e.target.value, paylasilanTelefon: k?.telefon ?? x.f.paylasilanTelefon } }); }} placeholder="Rehberden seçin ya da yazın" /></div>
        <div className="alan"><label htmlFor="i-ptel">Telefonu</label><input id="i-ptel" inputMode="tel" maxLength={40} value={duzen.f.paylasilanTelefon} onChange={(e) => setF("paylasilanTelefon", e.target.value)} /></div>
        <div className="alan genis"><label htmlFor="i-ref">Referans <small className="ipucu">· işi kim getirdi?</small></label><input id="i-ref" list="i-kisiler" value={duzen.f.referansAd} onChange={(e) => setF("referansAd", e.target.value)} placeholder="Rehberden seçin ya da yazın" /></div>

        <div className="alan genis">
          <label>Taraflar <small className="ipucu">· rehberden</small></label>
          <div className="cip-satir">
            {duzen.f.taraflar.length ? duzen.f.taraflar.map((t, i) => <span key={(t.kisiId ?? t.ad) + t.rol} className="cip">{t.ad || "Kişi"} <small>{TARAF_ROLU_ETIKET[t.rol]}</small><button type="button" className="sil" aria-label={`${t.ad} tarafını kaldır`} onClick={() => tarafSil(i)}>×</button></span>)
              : <span className="ipucu">Henüz taraf eklenmedi.</span>}
          </div>
          <div className="satir sar" style={{ marginTop: 6 }}>
            <input aria-label="Taraf kişisi" list="i-kisiler" value={duzen.f.tarafAd} onChange={(e) => setF("tarafAd", e.target.value)} placeholder="Rehberden seçin ya da yazın" style={{ flex: "1 1 180px", minWidth: 0 }} />
            <select aria-label="Taraf rolü" value={duzen.f.tarafRol} onChange={(e) => setF("tarafRol", e.target.value as TarafRolu)}>{TARAF_ROLLERI.map((r) => <option key={r} value={r}>{TARAF_ROLU_ETIKET[r]}</option>)}</select>
            <button type="button" className="btn" onClick={tarafEkle}>Ekle</button>
          </div>
        </div>

        <div className="alan genis"><label className="satir" style={{ gap: 6 }}><input type="checkbox" checked={duzen.f.tahsil} onChange={(e) => setF("tahsil", e.target.checked)} /> Komisyon tahsil edildi</label>
          {duzen.f.tahsil ? <input type="date" aria-label="Tahsilat tarihi" value={duzen.f.tahsilatTarihi} onChange={(e) => setF("tahsilatTarihi", e.target.value)} /> : <span className="ipucu">Bekleyen olarak görünür; P&amp;L'e tahsil edildiği ay girer.</span>}</div>
        <div className="alan genis"><label className="satir" style={{ gap: 6 }}><input type="checkbox" checked={duzen.f.reklam} onChange={(e) => setF("reklam", e.target.checked)} /> Reklamdan gelen işlem</label></div>
        <div className="alan"><label htmlFor="i-talep">Talep <small className="ipucu">· isteğe bağlı</small></label><input id="i-talep" list="i-talepler" value={duzen.f.talep} onChange={(e) => setF("talep", e.target.value)} placeholder="Talep başlığından seçin" /></div>
        <div className="alan"><label htmlFor="i-portfoy">Portföy <small className="ipucu">· isteğe bağlı</small></label><input id="i-portfoy" list="i-portfoyler" value={duzen.f.portfoy} onChange={(e) => setF("portfoy", e.target.value)} placeholder="Portföy başlığından seçin" /></div>
        <datalist id="i-kisiler">{kisiler.slice(0, 2000).map((k) => <option key={k.id} value={k.adSoyad} />)}</datalist>
        <datalist id="i-talepler">{kayitlar.filter((k: any) => k.veri.tip === "TALEP").slice(0, 400).map((k: any) => <option key={k.id} value={baslikOf(k.veri)} />)}</datalist>
        <datalist id="i-portfoyler">{kayitlar.filter((k: any) => k.veri.tip === "PORTFOY").slice(0, 400).map((k: any) => <option key={k.id} value={baslikOf(k.veri)} />)}</datalist>
        <div className="alan genis"><label htmlFor="i-acik">Açıklama</label><textarea id="i-acik" rows={2} maxLength={2000} value={duzen.f.aciklama} onChange={(e) => setF("aciklama", e.target.value)} placeholder="Ör. Elden nakit alındı, fatura kesilmedi. Ofisle paylaşılmadı." />
          <div className="not-etiket">{notEtiketleri(duzen.f.aciklama).map((e) => <span key={e.etiket} className={"pill p-" + e.ton}>{e.etiket}</span>)}</div>
          <small className="ipucu">Notun kendisi olduğu gibi kalır; renkli etiketler nottan otomatik çıkarılır.</small></div>
      </div>
      <div className="satir sar">
        <button className="btn birincil" onClick={() => void kaydet()}>Kaydet</button>
        <button className="btn" onClick={kapatForm}>Vazgeç</button>
        {duzen.id && (!silOnay ? <button className="btn" onClick={() => setSilOnay(true)}>Sil…</button> : <><span>Emin misiniz?</span><button className="btn tehlike" onClick={sil}>Evet, sil</button></>)}
      </div>
    </section>}

    {yillar.length > 1 && <div className="satir sar">{yillar.map((y) => <button key={y} className={"btn kucuk" + (y === yil ? " birincil" : "")} aria-pressed={y === yil} onClick={() => { setYil(y); setAy(null); }}>{y}</button>)}</div>}

    <div className="rakam-serit">
      <div className="rakam kahraman"><span>{yil} · bana kalan (tahsil edilen)</span><b>{TL(ozet.toplam)}</b>
        {ozet.bekleyen > 0 && <small>+{TL(ozet.bekleyen)} tahsil edilmedi</small>}</div>
      <div className="rakam"><span>Aylık ortalama</span><b>{TL(ozet.aylikOrtalama)}</b><small>{ozet.ayNo} ay</small></div>
      <div className={"rakam" + (ozet.kalan > 0 ? " acik" : "")}><span>Yıl hedefine kalan</span><b>{TL(ozet.kalan)}</b>
        <small>{ozet.kalan > 0 ? `ayda ${TL(ozet.gerekenAylik)} · ${ozet.kalanAy} ay` : "hedef tamam"}</small></div>
      <div className="rakam"><span>Satış</span><b>{TL(topla(satislar))}</b><small>{satislar.length} işlem</small></div>
      <div className="rakam"><span>Kiralama</span><b>{TL(topla(kiralar))}</b><small>{kiralar.length} işlem</small></div>
      <div className="rakam"><span>Reklamdan gelen</span><b>{yilinkiler.filter((x) => x.reklam).length}</b><small>işlem</small></div>
    </div>

    <div className="suzgec-cubugu">
      <input type="search" aria-label="İşlem ara" value={ara} onChange={(e) => setAra(e.target.value)} placeholder="İşlem, kişi ya da not ara" />
      <div className="filtre">
        {([["", "Hepsi"], ...ISLEM_TURLERI.map((t) => [t, ISLEM_TURU_ETIKET[t]] as const)] as const).map(([k, l]) =>
          <button key={k} type="button" className={"fb" + (tur === k ? " on" : "")} aria-pressed={tur === k} onClick={() => setTur(k as any)}>{l}</button>)}
      </div>
      <select aria-label="Ay" value={ay == null ? "" : String(ay)} onChange={(e) => setAy(e.target.value === "" ? null : Number(e.target.value))}>
        <option value="">Bütün aylar</option>
        {AY_TAM.map((m, i) => <option key={m} value={i}>{m}</option>)}
      </select>
    </div>

    {yukleniyor && <p className="ipucu">Yükleniyor…</p>}
    {!yukleniyor && !gorunen.length && <p className="bos">{ara || tur || ay != null ? "Bu süzgeçle işlem yok." : `${yil} için işlem yok.`}</p>}

    {!!gorunen.length && <>
      <div className="tablo-sar islem-tablo-sar">
        <table className="islem-tablo">
          <thead><tr>
            <th>Tarih</th><th>Ay</th><th>Tür</th><th>Liste</th><th className="n">Bana Kalan</th><th className="n">Fiyat</th><th className="n">Paylaşımlı</th>
            <th>Paylaşılan kişi</th><th className="n">Ofise</th><th>Referans</th><th>Taraflar</th><th>Açıklama</th><th>Reklam</th>
          </tr></thead>
          <tbody>
            {gorunen.map((x) => <tr key={x.id} onClick={() => ac(x)} tabIndex={0} role="button" aria-label={`${x.baslik} işlemini düzenle`}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); ac(x); } }}>
              <td className="ts">{gunYaz(x.tarih)}</td>
              <td className="n">{Number((x.tahsilatTarihi ?? x.tarih).slice(5, 7))}</td>
              <td><span className={"pill p-" + ISLEM_TURU_TON[x.tur]}>{ISLEM_TURU_ETIKET[x.tur]}</span></td>
              <td className="liste">{x.baslik}{x.disKaynak === "POLARIS" && <small className="ipucu"> · Polaris</small>}{!x.tahsilatTarihi && <small className="ipucu"> · tahsilat bekliyor</small>}</td>
              <td className="n bk">{TL(x.banaKalan)}</td>
              <td className="n">{TL(x.bedel)}</td>
              <td className="n">{TL(x.paylasilan)}</td>
              <td className="kucuk-hucre"><KisiBag id={x.paylasilanKisiId} ad={x.paylasilanAd} />{x.paylasilanTelefon && <div className="ipucu">{x.paylasilanTelefon}</div>}</td>
              <td className="n">{TL(x.ofisPayi)}</td>
              <td className="kucuk-hucre"><KisiBag id={x.referansKisiId} ad={x.referansAd} /></td>
              <td className="kucuk-hucre">{(x.taraflar ?? []).map((t) => <div key={(t.kisiId ?? t.ad) + t.rol}><KisiBag id={t.kisiId} ad={t.ad} /> <small className="ipucu">{TARAF_ROLU_ETIKET[t.rol]}</small></div>)}</td>
              <td className="ac">{notEtiketleri(x.aciklama).map((e) => <span key={e.etiket} className={"pill p-" + e.ton}>{e.etiket}</span>)}{x.aciklama && <div>{x.aciklama}</div>}</td>
              <td>{x.reklam && <span className="pill p-uyari">Reklam</span>}</td>
            </tr>)}
          </tbody>
          <tfoot><tr>
            <td>TOTAL · {gorunen.length} kayıt</td><td /><td /><td />
            <td className="n">{TL(topl("banaKalan"))}</td><td className="n">{TL(topl("bedel"))}</td><td className="n">{TL(topl("paylasilan"))}</td>
            <td /><td className="n">{TL(topl("ofisPayi"))}</td><td /><td /><td /><td />
          </tr></tfoot>
        </table>
      </div>

      <div className="islem-kartlar">
        {gorunen.map((x) => <button key={x.id} type="button" className="islem-kart" style={{ ["--c" as any]: `var(--${ISLEM_TURU_TON[x.tur] === "notr" ? "mut" : ISLEM_TURU_TON[x.tur]})` }} onClick={() => ac(x)}>
          <div className="satir-ara"><span className="ipucu">{gunYaz(x.tarih)} · {ISLEM_TURU_ETIKET[x.tur]}{x.reklam ? " · Reklam" : ""}{!x.tahsilatTarihi ? " · tahsilat bekliyor" : ""}</span><b>{TL(x.banaKalan)}</b></div>
          <b className="liste">{x.baslik}</b>
          <span className="ipucu">Fiyat {TL(x.bedel)} · Paylaşımlı {TL(x.paylasilan)} · Ofise {TL(x.ofisPayi)}</span>
          {(x.paylasilanAd || x.referansAd) && <span className="ipucu">{[x.paylasilanAd && `Paylaşılan: ${x.paylasilanAd}`, x.referansAd && `Referans: ${x.referansAd}`].filter(Boolean).join(" · ")}</span>}
          {!!(x.taraflar ?? []).length && <span className="ipucu">{(x.taraflar ?? []).map((t) => `${t.ad} (${TARAF_ROLU_ETIKET[t.rol]})`).join(" · ")}</span>}
          {x.aciklama && <span className="not-etiket">{notEtiketleri(x.aciklama).map((e) => <span key={e.etiket} className={"pill p-" + e.ton}>{e.etiket}</span>)}</span>}
          {x.aciklama && <span className="ipucu">{x.aciklama}</span>}
        </button>)}
        <div className="islem-kart-toplam"><span>Toplam · {gorunen.length} kayıt</span><b>{TL(topl("banaKalan"))}</b></div>
      </div>
      <p className="ipucu">Açıklama notları olduğu gibi duruyor; renkli etiketler nottan otomatik çıkarılır. Satıra dokunarak düzeltebilirsin.</p>
    </>}

    <div className="grafik-ikili">
      <section className="kart">
        <h3>Aylara göre gelir <small className="ipucu">· {yil}</small></h3>
        <AyGrafigi aylar={grafikAylar} secili={ay} sec={setAy} ayAdet={ayAdet} />
      </section>
      <section className="kart">
        <h3>Gelirin paylaşımı <small className="ipucu">· {ay == null ? `${yil} tümü` : `${AY_TAM[ay]} ${yil}`}</small></h3>
        <HalkaGrafigi dilimler={[
          { ad: "Bana kalan", deger: topl("banaKalan"), ton: "acc" },
          { ad: "Paylaşım (diğer danışman)", deger: Math.abs(topl("paylasilan")), ton: "pirinc" },
          { ad: "Ofise", deger: Math.abs(topl("ofisPayi")), ton: "mut" },
        ]} />
        {ay != null && <button className="btn kucuk" onClick={() => setAy(null)}>Bütün yılı göster</button>}
      </section>
    </div>

    <section className="kart">
      <h3>Kimden iş geldi?</h3>
      <p className="ipucu">İşlemlere eklediğin referans ve taraflara göre. Bir işleme referans eklemek için satıra dokun.</p>
      {kaynaklar.length ? <div className="tablo-sar"><table>
        <thead><tr><th>Kişi</th><th>Rolü</th><th className="n">İş</th><th className="n">Bana Kalan</th></tr></thead>
        <tbody>{kaynaklar.slice(0, 20).map((o) => <tr key={(o.kisiId ?? "") + o.ad}>
          <td><KisiBag id={o.kisiId} ad={o.ad} /></td><td className="kucuk-hucre">{o.roller.join(", ")}</td><td className="n">{o.adet}</td><td className="n">{TL(o.banaKalan)}</td>
        </tr>)}</tbody>
      </table></div> : <p className="bos">Henüz hiçbir işleme referans ya da taraf eklenmedi.</p>}
    </section>
  </div>;
}
