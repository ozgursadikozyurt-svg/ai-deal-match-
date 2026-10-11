/**
 * Anahtar CRM v3.25 · 11 Ekim 2026
 * "Bugün" panosu — Ana Sayfa'da "★ Benim ve ofisim" kartının içinde. Danışmana her gün ne yapması gerektiğini söyler:
 * geciken + bugünkü görevler (en çok 15; ilk 5'i açık), her görevde üç düğme (Ulaşılamadı · Görüşüldü · İlgilenmiyor),
 * "Bu hafta" kapalı. Kurallar src/lib/domain/gorev.ts, durum işlemleri demo/bugun-eylem.ts.
 */
import React, { useEffect, useMemo, useState } from "react";
import { useDepo, cx, baslikOf, tarihYaz, telYaz, type Eslesme } from "./ortak";
import { simdi as simdiOf, type Kayit, type DepoDurumu } from "./depo";
import { IletisimDugmeleri, KisiSecici } from "./kisiler";
import { KOPMA_NEDENLERI } from "../src/lib/eslestirme/kopar";
import { selamMetni } from "../src/lib/iletisim";
import {
  GOREV_TURU_ETIKET, SONRAKI_SECENEKLER, bugunGorunumu, gunEkle, gunYaz, takvimBaglantisi, vadeYazisi, type Gorev,
} from "../src/lib/domain/gorev";
import { bugunGorevleri, elleGorevEkle, gorevGorusuldu, gorevIlgilenmiyor, gorevUlasilamadi, kayitKisisi, sonrakiIletisimEkle } from "./bugun-eylem";
import type { SahiplikSonucu } from "../src/lib/domain/sahiplik";

const GORUNEN_ILK = 5;
const TUR_IKON: Record<string, string> = { ARA: "☎", SUNUM: "✉", GOSTER: "⌂", BELGE: "▤" };

/** "İlgilenmiyor" nedenleri — görevin kuralına göre */
function nedenSecenekleri(g: Gorev): [string, string][] {
  if (g.eslesme) return KOPMA_NEDENLERI.map(([k, l]) => [k, l]);
  if (g.kural === "TALEP_SURE") return [["ARAMIYOR", "Artık aramıyor"], ["BULDU", "Başka yerden buldu"], ["BUTCE", "Bütçesi / ihtiyacı değişti"], ["DIGER", "Diğer"]];
  if (g.kural === "TEMAS") return [["SATILDI", "Satıldı / kiralandı"], ["VAZGECTI", "Mal sahibi vazgeçti"], ["FIYAT", "Fiyat uymuyor"], ["DIGER", "Diğer"]];
  return [["GEREK_YOK", "Gerek kalmadı"], ["DIGER", "Diğer"]];
}
const SURE_UZATMA = [30, 60, 90];

/** Görevin karşısındaki kişi: görevde kayıtlı kişi → eşleşmedeki talebin gönderen bilgisi → bağlı kaydın gönderen bilgisi */
function iletisimOf(g: Gorev, d: DepoDurumu): { ad: string | null; tel: string | null; kisiId: string | null } {
  const kisi = g.kisiId ? d.kisiler.find((k) => k.id === g.kisiId) : undefined;
  if (kisi) return { ad: kisi.adSoyad, tel: kisi.telefon, kisiId: kisi.id };
  const talep = g.eslesme ? d.kayitlar.find((k) => k.id === g.eslesme!.split("~")[0]) : undefined;
  const kayit = talep ?? (g.kayitId ? d.kayitlar.find((k) => k.id === g.kayitId) : undefined);
  return { ad: kayit?.veri.gondeAdi ?? null, tel: kayit?.veri.gondeTelefon ?? null, kisiId: null };
}

/** Sonraki iletişim seçici: Yarın · 3 gün · 1 hafta · 1 ay · tarih seç. Seçilince `sec(gun | "YYYY-MM-DD")`. */
export function SonrakiSecici({ sec, simdi, bos }: { sec: (g: number | string) => void; simdi: Date; bos?: { etiket: string; yap: () => void } }) {
  const [tarih, setTarih] = useState("");
  return <div className="cip-satir" role="group" aria-label="Sonraki iletişim">
    {SONRAKI_SECENEKLER.map((s) => <button type="button" key={s.gun} className="cip secilir" onClick={() => sec(s.gun)}>{s.etiket}</button>)}
    <input type="date" aria-label="Sonraki iletişim tarihi" className="kisa-girdi" min={gunYaz(simdi)} value={tarih} onChange={(e) => { setTarih(e.target.value); if (e.target.value) sec(e.target.value); }} />
    {bos && <button type="button" className="cip secilir" onClick={bos.yap}>{bos.etiket}</button>}
  </div>;
}

function GorevSatiri({ g, simdi, kapat }: { g: Gorev; simdi: Date; kapat?: boolean }) {
  const { d, guncelle, bildir, git } = useDepo();
  const [mod, setMod] = useState<null | "gorusuldu" | "ilgi">(null);
  const [not, setNot] = useState("");
  const kisi = iletisimOf(g, d);
  const kayit = g.kayitId ? d.kayitlar.find((k) => k.id === g.kayitId) : undefined;
  const gec = g.vade < gunYaz(simdi);
  const ad = kisi.ad ?? (kayit ? baslikOf(kayit.veri) : "Kişi belirtilmedi");
  const ac = () => (kisi.kisiId ? git({ ad: "kisi", id: kisi.kisiId }) : kayit ? git({ ad: "detay", id: kayit.id }) : undefined);
  const mesaj = kisi.ad ? selamMetni(kisi.ad, g.kural === "SICAK" || g.tur === "SUNUM" ? `${kayit ? baslikOf(kayit.veri) : "portföy"} için size uygun bir seçenek var.` : undefined) : undefined;

  const bitir = (sonraki: number | string | null, uzat?: number) => {
    guncelle((dd) => gorevGorusuldu(dd, g, { not, sonraki, uzat }));
    bildir(sonraki != null && sonraki !== "" ? `Görüşüldü — sonraki iletişim ${tarihYaz(typeof sonraki === "number" ? gunEkle(gunYaz(simdi), sonraki) + "T12:00:00" : sonraki + "T12:00:00")}` : uzat ? `Görüşüldü — süre ${uzat} gün uzatıldı` : "Görüşüldü");
    setMod(null); setNot("");
  };
  const ilgilenmiyor = (kod: string, yazi: string) => { guncelle((dd) => gorevIlgilenmiyor(dd, g, kod, yazi)); bildir(g.eslesme ? "Eşleşme koparıldı, görev kapandı" : "Görev kapandı"); setMod(null); };

  return <li className={cx("gorev", gec && "gec")} data-kural={g.kural}>
    <div className="gorev-ust">
      <span className="gorev-ikon" aria-hidden="true" title={GOREV_TURU_ETIKET[g.tur]}>{TUR_IKON[g.tur]}</span>
      <button type="button" className="gorev-ad" onClick={ac}>
        <b>{ad}</b>
        <span className="gorev-baslik">{g.baslik}</span>
        <small className="gorev-alt">{kayit && kisi.ad ? `${baslikOf(kayit.veri)} · ` : ""}<span className={cx("gorev-vade", gec && "gec")}>{vadeYazisi(g.vade, simdi)}</span>{(g.deneme ?? 0) > 0 ? ` · ${g.deneme}. kez ulaşılamadı` : ""}</small>
      </button>
      <div className="gorev-sag">
        <IletisimDugmeleri tel={kisi.tel} ad={kisi.ad ?? undefined} mesaj={mesaj} kucuk />
        <a className="gorev-takvim" href={takvimBaglantisi({ baslik: `${ad}: ${g.baslik}`, vade: g.vade, aciklama: kayit ? baslikOf(kayit.veri) : undefined })} target="_blank" rel="noopener" aria-label="Google Takvim'e ekle" title="Google Takvim'e ekle">▦</a>
      </div>
    </div>
    {mod === null && <div className="gorev-dugmeler" role="group" aria-label="Görev sonucu">
      <button type="button" className="btn kucuk" onClick={() => { guncelle((dd) => gorevUlasilamadi(dd, g)); bildir("Ulaşılamadı — yarına ertelendi"); }}>Ulaşılamadı</button>
      <button type="button" className="btn kucuk birincil" onClick={() => setMod("gorusuldu")}>Görüşüldü</button>
      <button type="button" className="btn kucuk" onClick={() => setMod("ilgi")}>İlgilenmiyor</button>
    </div>}
    {mod === "gorusuldu" && <div className="gorev-panel">
      <textarea rows={2} aria-label="Görüşme notu" placeholder="Ne konuşuldu? (kayda görüşme notu olarak eklenir)" value={not} onChange={(e) => setNot(e.target.value)} />
      {g.kural === "TALEP_SURE" && <><div className="ipucu">Hâlâ arıyorsa süreyi uzatın:</div><div className="cip-satir">{SURE_UZATMA.map((u) => <button type="button" key={u} className="cip secilir" onClick={() => bitir(null, u)}>+{u} gün</button>)}</div></>}
      <div className="ipucu">Sonraki iletişim ne zaman?</div>
      <SonrakiSecici simdi={simdi} sec={(x) => bitir(x)} bos={{ etiket: "Gerek yok", yap: () => bitir(null) }} />
      <button type="button" className="link-btn" onClick={() => setMod(null)}>Vazgeç</button>
    </div>}
    {mod === "ilgi" && <div className="gorev-panel">
      <div className="ipucu">{g.eslesme ? "Neden? (eşleşme koparılır, bir daha önerilmez)" : g.kural === "TALEP_SURE" ? "Neden? (talep pasife alınır)" : "Neden?"}</div>
      <div className="cip-satir">{nedenSecenekleri(g).map(([k, l]) => <button type="button" key={k} className="cip secilir" onClick={() => ilgilenmiyor(k, l)}>{l}</button>)}</div>
      <button type="button" className="link-btn" onClick={() => setMod(null)}>Vazgeç</button>
    </div>}
  </li>;
}

/** Bu hafta kapalı listesindeki kısa satır: "Bugüne al" */
function HaftaSatiri({ g, simdi }: { g: Gorev; simdi: Date }) {
  const { d, guncelle, git } = useDepo();
  const k = iletisimOf(g, d), kayit = g.kayitId ? d.kayitlar.find((x) => x.id === g.kayitId) : undefined;
  const bugune = () => guncelle((dd) => ({ ...dd, gorevler: (dd.gorevler ?? []).some((x) => x.id === g.id) ? (dd.gorevler ?? []).map((x) => (x.id === g.id ? { ...x, vade: gunYaz(simdi) } : x)) : dd.gorevler }));
  return <li className="gorev-hafta">
    <button type="button" className="gorev-ad" onClick={() => (k.kisiId ? git({ ad: "kisi", id: k.kisiId }) : kayit ? git({ ad: "detay", id: kayit.id }) : undefined)}><b>{k.ad ?? (kayit ? baslikOf(kayit.veri) : "—")}</b><span className="gorev-baslik">{g.baslik}</span></button>
    <span className="ipucu">{vadeYazisi(g.vade, simdi)}</span>
    <button type="button" className="btn kucuk" onClick={bugune}>Bugüne al</button>
  </li>;
}

function GorevEkleFormu({ kapat, simdi }: { kapat: () => void; simdi: Date }) {
  const { guncelle, bildir } = useDepo();
  const [baslik, setBaslik] = useState("");
  const [kisiId, setKisiId] = useState("");
  const ekle = (gun: number | string) => {
    const vade = typeof gun === "number" ? gunEkle(gunYaz(simdi), gun) : gun;
    guncelle((dd) => elleGorevEkle(dd, { baslik: baslik.trim(), vade, kisiId: kisiId || null }));
    bildir(`Görev eklendi — ${tarihYaz(vade + "T12:00:00")}`); kapat();
  };
  return <div className="kart ic gorev-ekle">
    <input aria-label="Görev" placeholder="Ne yapılacak? Örn: Ahmet Bey'e Lara teklifini ilet" value={baslik} onChange={(e) => setBaslik(e.target.value)} maxLength={200} />
    <div className="rolsuz"><KisiSecici secili={kisiId ? [{ kisiId, rol: "DIGER" }] : []} degis={(b) => setKisiId(b[b.length - 1]?.kisiId ?? "")} /></div>
    <div className="ipucu">Ne zaman? {baslik.trim().length < 3 && <small>(önce görevi yazın)</small>}</div>
    {baslik.trim().length >= 3 ? <SonrakiSecici simdi={simdi} sec={ekle} bos={{ etiket: "Bugün", yap: () => ekle(0) }} /> : <div className="ipucu">Yarın · 3 gün · 1 hafta · 1 ay seçenekleri görev yazılınca açılır.</div>}
    <button type="button" className="link-btn" onClick={kapat}>Vazgeç</button>
  </div>;
}

export function BugunPanosu({ es, sahip }: { es: Eslesme[]; sahip: (v: Kayit["veri"]) => SahiplikSonucu }) {
  const { d } = useDepo();
  const [, tik] = useState(0);
  useEffect(() => { const t: any = setInterval(() => tik((x) => x + 1), 5 * 60_000); t.unref?.(); return () => clearInterval(t); }, []);
  const [tumu, setTumu] = useState(false), [hafta, setHafta] = useState(false), [ekle, setEkle] = useState(false);
  const simdi = simdiOf();
  const gun = gunYaz(simdi);
  const liste = useMemo(() => bugunGorevleri(d, es, (k) => !!sahip(k.veri).tur, simdi), [d.gorevler, d.ilgilenenler, d.kayitlar, d.kisiler, d.eslesmeNotlari, es, sahip, gun]);
  const g = bugunGorunumu(liste, simdi, 15);
  const gorunen = tumu ? g.gorunen : g.gorunen.slice(0, GORUNEN_ILK);
  const kalan = g.gorunen.length - gorunen.length;
  const acikBugun = g.geciken.length + g.bugun.length;
  const yuzde = g.tamamBugun + acikBugun ? Math.round((g.tamamBugun / (g.tamamBugun + acikBugun)) * 100) : 0;
  return <div className="bugun" aria-label="Bugün">
    <div className="bugun-bas">
      <h3>Bugün</h3>
      <div className="bugun-cipler">
        {g.geciken.length > 0 && <span className="bugun-cip kotu">{g.geciken.length} geciken</span>}
        <span className={cx("bugun-cip", g.bugun.length ? "uyari" : "iyi")}>{g.bugun.length} bugün</span>
        {g.buHafta.length > 0 && <span className="bugun-cip">{g.buHafta.length} bu hafta</span>}
        {g.tamamBugun > 0 && <span className="bugun-cip iyi">✓ {g.tamamBugun} tamam</span>}
      </div>
    </div>
    {g.tamamBugun > 0 && acikBugun > 0 && <div className="bugun-ilerleme" role="progressbar" aria-valuenow={yuzde} aria-valuemin={0} aria-valuemax={100} aria-label="Bugünün ilerlemesi"><i style={{ width: yuzde + "%" }} /></div>}
    {gorunen.length > 0
      ? <ul className="gorev-liste">{gorunen.map((x) => <GorevSatiri key={x.id} g={x} simdi={simdi} />)}</ul>
      : <p className="bugun-bos">{g.tamamBugun > 0 ? `Bugünü sıfırladın — ${g.tamamBugun} görev tamam.` : "Bugün için görev yok."}{g.buHafta.length ? ` Sırada bu hafta ${g.buHafta.length} görev var.` : ""}</p>}
    {kalan > 0 && <button type="button" className="btn kucuk bugun-daha" onClick={() => setTumu(true)}>Kalan {kalan} görevi göster</button>}
    {tumu && g.gorunen.length > GORUNEN_ILK && <button type="button" className="link-btn" onClick={() => setTumu(false)}>Daralt</button>}
    {g.gizlenen > 0 && tumu && <p className="ipucu">+{g.gizlenen} görev daha var — önce bunları bitirin, gerisi sıraya girer.</p>}
    <div className="bugun-alt">
      {g.buHafta.length > 0 && <button type="button" className="btn kucuk" aria-expanded={hafta} onClick={() => setHafta(!hafta)}>Bu hafta ({g.buHafta.length}) {hafta ? "▴" : "▾"}</button>}
      <button type="button" className="btn kucuk" onClick={() => setEkle(!ekle)}>+ Görev</button>
    </div>
    {hafta && <ul className="gorev-liste hafta">{g.buHafta.map((x) => <HaftaSatiri key={x.id} g={x} simdi={simdi} />)}</ul>}
    {ekle && <GorevEkleFormu simdi={simdi} kapat={() => setEkle(false)} />}
  </div>;
}

/** Eşleşme detayı: takip durumu Görüşüldü / Koparıldı olunca "Bir sonraki iletişim ne zaman?" */
export function SonrakiIletisimSorusu({ tid, pid, kapat }: { tid: string; pid: string; kapat: () => void }) {
  const { d, guncelle, bildir } = useDepo();
  const simdi = simdiOf();
  const anahtar = `${tid}~${pid}`;
  const talepKisi = kayitKisisi(d.kayitlar.find((k) => k.id === tid));
  const sec = (gun: number | string) => {
    guncelle((dd) => sonrakiIletisimEkle(dd, { baslik: "Sonraki iletişim", kisiId: talepKisi, kayitId: pid, eslesme: anahtar }, gun));
    const vade = typeof gun === "number" ? gunEkle(gunYaz(simdi), gun) : gun;
    bildir(`Sonraki iletişim ${tarihYaz(vade + "T12:00:00")} için Bugün panosuna eklendi`); kapat();
  };
  return <section className="kart sonraki-soru" aria-label="Sonraki iletişim">
    <b>Bir sonraki iletişim ne zaman?</b>
    <div className="ipucu">Seçtiğiniz gün Ana Sayfa › Bugün panosuna görev olarak düşer.</div>
    <SonrakiSecici simdi={simdi} sec={sec} bos={{ etiket: "Gerek yok", yap: kapat }} />
  </section>;
}

/** Eşleşme detayında: bu eşleşme için planlanmış açık görevler */
export function EslesmeGorevleri({ tid, pid }: { tid: string; pid: string }) {
  const { d } = useDepo();
  const simdi = simdiOf();
  const anahtar = `${tid}~${pid}`;
  const acik = (d.gorevler ?? []).filter((g) => g.durum === "ACIK" && g.eslesme === anahtar).sort((a, b) => a.vade.localeCompare(b.vade));
  if (!acik.length) return null;
  return <div className="es-gorevler"><div className="ust-etiket">Planlanan görevler</div>
    <ul>{acik.map((g) => <li key={g.id}><span>{g.baslik}</span> <small className="ipucu">{vadeYazisi(g.vade, simdi)}</small></li>)}</ul></div>;
}
export { telYaz };
