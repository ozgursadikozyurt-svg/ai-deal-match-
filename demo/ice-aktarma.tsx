/**
 * Anahtar CRM v3.13 · 3 Ekim 2026
 * Demo — Veri Girişi: WhatsApp sohbet dosyalarını toplu içe aktarma + güvene göre ayırma + toplu onay.
 *
 * Akış (uzun sohbetlerde kullanıcının her mesajı tek tek onaylamaması için):
 *  1. Dosyalar (.txt / .zip, birden çok grup) → ayrıştır → ön filtre (gürültü, eski mesaj, aynı ilanın kopyaları)
 *  2. Kalan mesajlar 10'arlı paketlerle yapay zekâya → şemaya bağlı kayıtlar
 *  3. Her kayıt gerçek doğrulamadan + konum çözücüden geçer ve üçe ayrılır:
 *       HAZIR   → eksiği yok, tek tuşla toplu eklenir
 *       KONTROL → tanınmayan konum / fiyat-alan eksik / havuzda benzer kayıt var → gözden geçir
 *       HATALI  → şemaya uymadı (yapay zekâ uydurma alan/değer üretti) → eklenmez
 *  4. Tanınmayan konumlar Konum öğrenme listesine düşer.
 */
import React, { useRef, useState } from "react";
import { unzipSync, strFromU8 } from "fflate";
import { DosyaAktarma } from "./toplu-giris";
import { hafizaBaslat } from "./hafiza";
import { AkilliKutu, satirKur } from "./ai-kutusu";
import { mesajiYorumla } from "../src/lib/ai/yorumlayici";
import { mevcutAnahtarlar } from "./toplu-giris";
import { hizliAyristir } from "../src/lib/ai/hizli-ayristirici";
import { KayitCreateSchema } from "../src/lib/validation/kayit";
import { AiParseCiktiSchema, GEMINI_RESPONSE_SCHEMA, GEMINI_SISTEM_TALIMATI } from "../src/lib/ai/gemini-cikti-semasi";
import { sohbetiAyristir, onFiltre, paketMetni, grupAdiOf, metinParmakIzi, dosyaParmakIzi, type WaMesaj } from "../src/lib/ingest/whatsapp";
import { adaylariGuncelle, type KonumAdayi } from "../src/lib/lokasyon/ogrenme";
import { etiket } from "./etiketler";
import { coz, cozulenToKayitLok, INDEKS } from "./lokasyon";
import { BUGUN, varsayilanValidUntil, yeniId, kayitliMetinIzleri, kisiRolleriOf, yeniKisiId, type Kisi, type IceAktarma, type IceAktarmaAdayi, type Kayit, type Veri, type DepoDurumu } from "./depo";
import { useDepo, Pill, cx, baslikOf, fiyatOf, m2Of, oneCikanlar, tarihYaz, lokEtiket, aiJson, IslemPill } from "./ortak";
import { telNormalize } from "./form";
import { ORNEK_SOHBETLER, hazirAiSonucu } from "./ornek-sohbetler";

const PAKET = 10;
const SON_GUN_SECENEK: [number | null, string][] = [[7, "Son 7 gün"], [30, "Son 30 gün"], [90, "Son 90 gün"], [null, "Tümü"]];

// ───────── Yapay zekâ kaydı → form taslağı + sınıflandırma ─────────
function taslakOlustur(k: any, m: WaMesaj | undefined, ingestionId: string) {
  const r = coz(k.lokasyonIfadeleri ?? []);
  const lok = cozulenToKayitLok(r.lokasyonlar, k.tip === "PORTFOY").map(({ etiket, seviye, ...l }) => l);
  const { lokasyonIfadeleri, kisiAdi, telefon, firma, mesajNo, ozet, ...geri } = k;
  const gonderenTel = m?.telefon ?? null;
  const taslak: any = {
    ...geri, lokasyonlar: lok, lokasyonHam: (lokasyonIfadeleri ?? []).join(", "),
    gondeAdi: kisiAdi ?? (m && !telNormalize(m.gonderen)?.startsWith("+") ? m.gonderen : null), gondeTelefon: telNormalize(telefon) ?? gonderenTel, gondeSirket: firma ?? null,
    hamMetin: m?.metin, veriKanali: "WHATSAPP", kayitGrubu: m?.grup, mesajTarihi: m?.tarih, kaynakDosya: m?.dosya, ingestionId,
    baslik: ozet ? String(ozet).slice(0, 160) : undefined,
  };
  return { taslak, cozulemeyen: r.cozulemeyen, cozulen: r.lokasyonlar };
}
function siniflandir(taslak: any, cozulemeyen: string[], kayitlar: Kayit[], ttl: DepoDurumu["ayarlar"]["ttl"]): Pick<IceAktarmaAdayi, "durum" | "nedenler" | "hatalar" | "benzerKayitId"> & { veri?: Veri } {
  const baslangic = taslak.mesajTarihi ? new Date(taslak.mesajTarihi) : BUGUN;
  const p = KayitCreateSchema.safeParse({ ...taslak, validUntil: varsayilanValidUntil(taslak.tip, taslak.islemTipi, taslak.aciliyet, baslangic, ttl) });
  if (!p.success) return { durum: "HATALI", nedenler: ["Şemaya uymuyor"], hatalar: p.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`) };
  const v = p.data, n: string[] = [];
  if (cozulemeyen.length) n.push(`Tanınmayan konum: ${cozulemeyen.join(", ")}`);
  if (!v.lokasyonlar.length) n.push("Konum yok");
  if (v.tip === "PORTFOY" && v.fiyat == null && v.m2 == null) n.push("Fiyat ve alan yok");
  if (v.tip === "TALEP" && v.maxFiyat == null && v.minM2 == null && v.maxM2 == null && !v.odaSayisi) n.push("Bütçe ve alan yok");
  const pi = v.hamMetin ? metinParmakIzi(v.hamMetin) : null;
  const benzer = kayitlar.find((x) => (pi && x.veri.hamMetin && metinParmakIzi(x.veri.hamMetin) === pi) || (v.gondeTelefon && x.veri.gondeTelefon === v.gondeTelefon && x.veri.tip === v.tip && x.veri.mulkTipi === v.mulkTipi && x.veri.islemTipi === v.islemTipi));
  if (benzer) n.push(`Havuzda benzer kayıt var: ${baslikOf(benzer.veri)}`);
  return { durum: n.length ? "KONTROL" : "HAZIR", nedenler: n, hatalar: [], benzerKayitId: benzer?.id, veri: v };
}

/**
 * v3.12 — Ön filtreden geçen her mesajı ÖNCE kurallarla okur (yapay zekâsız, anında): tip, mülk, işlem, fiyat, alan, oda, konum, güven puanı.
 * Çok ilanlı mesajlar parçalanır. Sonuç "Gözden geçir" listesine hemen düşer; yapay zekâ yalnızca "Kontrol gerekli"leri yeniden okur.
 * (Önceki sürümde liste yalnızca yapay zekâ çağrısından sonra doluyordu; yapay zekâ çalışmayan görünümde ekran boş kalıyordu.)
 */
export function kuralAdaylari(mesajlar: WaMesaj[], d: DepoDurumu, ingestionId: string, cozulenKayit: Kayit[]): IceAktarmaAdayi[] {
  const izler = mevcutAnahtarlar(d as any);
  const kayitliMetinler = kayitliMetinIzleri(cozulenKayit);
  const cikti: IceAktarmaAdayi[] = [];
  for (const m of mesajlar) {
    if (m.durum !== "ADAY") continue;
    const y = mesajiYorumla(m.metin, INDEKS as any);
    const ben = /^siz$|^you$/i.test(m.gonderen);
    const adGibi = !m.telefon && !ben && /\p{L}{2}/u.test(m.gonderen);
    for (const p of y.parcalar) {
      p.tarih = m.tarih; p.grup = m.grup; p.telefon = p.telefon ?? m.telefon ?? null;
      p.kisiAdi = p.kisiAdi ?? (adGibi ? m.gonderen : null);
      if (ben) p.notlar.push("Kendi mesajınız");
      const s = satirKur(p, { tipIpucu: y.tipIpucu } as any, "OTO", d, izler, kayitliMetinler, null, () => []);
      const taslak: any = { ...s.taslak, kaynakDosya: m.dosya, ingestionId };
      const nedenler = [...s.kontrol, ...p.uyarilar.filter((u) => !s.kontrol.includes(u))];
      if (s.durum === "TEKRAR") nedenler.unshift("Havuzda zaten var gibi görünüyor");
      cikti.push({
        id: "A" + Math.random().toString(36).slice(2, 9), mesajId: m.id,
        durum: s.durum === "HATALI" ? "HATALI" : s.durum === "HAZIR" ? "HAZIR" : "KONTROL",
        nedenler, hatalar: s.hatalar, taslak, cozulemeyen: s.cozulemeyen, guven: p.guven, eksikler: p.eksikler, kaynak: "KURAL",
      });
    }
  }
  return cikti;
}

/** v3.12 — yapay zekâ kaydı ile metindeki açık ifadeleri uzlaştırır. Yapay zekâ "satılık" ilanı talep sanabiliyordu
 *  (örn. "…villa SATILIK" → "satılık talebi"); metinde açık "satılık / kiralık" varsa ve arama ifadesi yoksa kural kazanır.
 *  Yapay zekânın boş bıraktığı fiyat / alan kuraldan tamamlanır. Çok ilanlı mesajlarda (adet > 1) yalnızca ortak alanlara dokunulmaz. */
function aiKaydiniDuzelt(k: any, m: WaMesaj | undefined, adet: number): { k: any; notlar: string[] } {
  if (!m || adet > 1) return { k, notlar: [] };
  const h = hizliAyristir(m.metin);
  const notlar: string[] = [];
  const n = { ...k };
  if (h.tip && n.tip && h.tip !== n.tip && h.tur === "ILAN" && h.islemTipi && !h.islemTahmini) {
    notlar.push(`Yapay zekâ “${n.tip === "TALEP" ? "talep" : "portföy"}” okudu; metinde açık “${h.islemTipi === "SATILIK" ? "satılık" : "kiralık"}” ve arama ifadesi olmadığı için “${h.tip === "TALEP" ? "talep" : "portföy"}” yapıldı — kontrol edin`);
    n.tip = h.tip;
  }
  if (n.tip === "PORTFOY") {
    if (n.fiyat == null && n.maxFiyat != null) { n.fiyat = n.maxFiyat; delete n.maxFiyat; }
    if (n.fiyat == null && h.fiyat != null) { n.fiyat = h.fiyat; n.fiyatPeriyodu ??= h.fiyatPeriyodu ?? undefined; }
    if (n.m2 == null && n.minM2 != null) { n.m2 = n.minM2; delete n.minM2; }
    if (n.m2 == null && h.m2 != null) n.m2 = h.m2;
  } else if (n.tip === "TALEP") {
    if (n.maxFiyat == null && n.fiyat != null) { n.maxFiyat = n.fiyat; delete n.fiyat; }
    if (n.maxFiyat == null && h.maxFiyat != null) n.maxFiyat = h.maxFiyat;
  }
  if (h.islemTipi && !h.islemTahmini && n.islemTipi && h.islemTipi !== n.islemTipi && /sat[ıi]l[ıi]k|kiral[ıi]k|devren/i.test(m.metin)) n.islemTipi = h.islemTipi;
  return { k: n, notlar };
}
/** Taslağın doluluğuna göre 0–100 güven (kurallarla aynı ağırlıklar: mülk 20 · tür 10 · işlem 15 · fiyat 20 · konum 20 · alan/oda 15) */
function taslakGuveni(t: any, uyariSayisi: number): number {
  let p = 10 + 15;
  if (t.mulkTipi && t.mulkTipi !== "DIGER") p += 20;
  if ((t.fiyat ?? t.maxFiyat ?? t.minFiyat) != null) p += 20;
  if ((t.lokasyonlar ?? []).length) p += 20;
  if ((t.m2 ?? t.minM2 ?? t.maxM2) != null || t.odaSayisi) p += 15;
  return Math.max(0, Math.min(100, p - Math.min(15, uyariSayisi * 5)));
}

async function dosyalariOku(files: File[]): Promise<{ dosya: string; icerik: string; grup: string }[]> {
  const out: { dosya: string; icerik: string; grup: string }[] = [];
  for (const f of files) {
    if (/\.zip$/i.test(f.name)) {
      const z = unzipSync(new Uint8Array(await f.arrayBuffer()));
      for (const [ad, veri] of Object.entries(z)) if (/\.txt$/i.test(ad)) out.push({ dosya: `${f.name} › ${ad}`, icerik: strFromU8(veri), grup: grupAdiOf(/_chat\.txt$/i.test(ad) ? f.name : ad) });
    } else out.push({ dosya: f.name, icerik: await f.text(), grup: grupAdiOf(f.name) });
  }
  return out;
}

function OnFiltreOzeti({ ia }: { ia: IceAktarma }) {
  const [goster, setGoster] = useState<"" | "ADAY" | "GURULTU" | "TEKRAR" | "ONCEKI">("");
  const say = (d: string) => ia.mesajlar.filter((m) => m.durum === d).length;
  return <section className="kart">
    <h3>1. Ön filtre <span className="ipucu">(yapay zekâsız)</span></h3>
    <div className="tablo-sar"><table><thead><tr><th>Grup</th><th>Mesaj</th><th>İlan/talep adayı</th><th>Gürültü</th><th>Tekrar</th><th>Önceden işlenmiş</th><th>Tarih aralığı</th></tr></thead>
      <tbody>{ia.gruplar.map((g) => <tr key={g.grup + g.dosya}><td>{g.grup}</td><td>{g.toplam}</td><td><b>{g.aday}</b></td><td>{g.gurultu}</td><td>{g.tekrar}</td><td>{g.onceki ?? 0}</td><td>{g.ilk ? `${tarihYaz(g.ilk)} – ${tarihYaz(g.son)}` : "—"}</td></tr>)}</tbody></table></div>
    <div className="filtre">
      <button className={cx("fb", goster === "ADAY" && "on")} onClick={() => setGoster(goster === "ADAY" ? "" : "ADAY")}>Adaylar ({say("ADAY")})</button>
      <button className={cx("fb", goster === "GURULTU" && "on")} onClick={() => setGoster(goster === "GURULTU" ? "" : "GURULTU")}>Elenen gürültü ({say("GURULTU")})</button>
      <button className={cx("fb", goster === "TEKRAR" && "on")} onClick={() => setGoster(goster === "TEKRAR" ? "" : "TEKRAR")}>Başka grupta da paylaşılan ({say("TEKRAR")})</button>
      {say("ONCEKI") > 0 && <button className={cx("fb", goster === "ONCEKI" && "on")} onClick={() => setGoster(goster === "ONCEKI" ? "" : "ONCEKI")}>Daha önce işlenmiş ({say("ONCEKI")})</button>}
    </div>
    {goster && <div className="mesaj-listesi">{ia.mesajlar.filter((m) => m.durum === goster).slice(0, 200).map((m) => <div key={m.id} className="mesaj"><div className="ipucu">{m.grup} · {tarihYaz(m.tarih, true)} · {m.gonderen}{m.neden ? ` · ${m.neden}` : ""}{m.kopyalar.length ? ` · ${m.kopyalar.length} grupta daha paylaşıldı` : ""}</div><div className="mesaj-metin">{m.metin}</div></div>)}</div>}
  </section>;
}

function AdayKarti({ a, secili, sec, mesaj }: { a: IceAktarmaAdayi; secili: boolean; sec: (v: boolean) => void; mesaj?: WaMesaj }) {
  const { git, guncelle } = useDepo();
  const [acik, setAcik] = useState(false);
  const t = a.taslak;
  const yaz = (durum: IceAktarmaAdayi["durum"]) => guncelle((d) => d.aktifIceAktarma ? { ...d, aktifIceAktarma: { ...d.aktifIceAktarma, adaylar: d.aktifIceAktarma.adaylar.map((x) => (x.id === a.id ? { ...x, durum } : x)) } } : d);
  const bitti = a.durum === "EKLENDI" || a.durum === "ATLANDI";
  return <div className={cx("kart aday-karti", bitti && "soluk")}>
    <div className="aday-bas">
      {!bitti && a.durum !== "HATALI" && <input type="checkbox" aria-label="Seç" checked={secili} onChange={(e) => sec(e.target.checked)} />}
      <div className="aday-govde">
        <div className="pill-satir"><Pill ton={t.tip === "TALEP" ? "mavi" : "yesil"}>{etiket(t.tip)}</Pill><Pill>{etiket(t.mulkTipi)}</Pill><IslemPill islem={t.islemTipi} />
          {a.guven != null && <span className={cx("guven", a.guven >= 70 ? "iyi" : "dusuk")} title={a.eksikler?.length ? "Okunamayan: " + a.eksikler.join(", ") : "Güven puanı"}>%{a.guven}</span>}
          {a.kaynak === "AI" && <Pill>Yapay zekâ</Pill>}
          {a.durum === "EKLENDI" && <Pill ton="iyi">Eklendi</Pill>}{a.durum === "ATLANDI" && <Pill>Atlandı</Pill>}</div>
        <div className="kk-baslik">{baslikOf(t)}</div>
        <div className="kk-alt">{(t.lokasyonlar ?? []).map(lokEtiket).join(" · ") || "Konum yok"} · {fiyatOf(t)}{m2Of(t) ? " · " + m2Of(t) : ""}</div>
        <div className="kk-alt">{mesaj?.grup} · {tarihYaz(mesaj?.tarih, true)} · {mesaj?.gonderen}</div>
        {oneCikanlar(t).length > 0 && <div className="cip-satir">{oneCikanlar(t).map((c) => <span key={c} className="cip">{c}</span>)}</div>}
        {a.nedenler.length > 0 && a.durum !== "EKLENDI" && <div className="cip-satir">{a.nedenler.map((n) => <span key={n} className={cx("cip", a.durum === "HATALI" ? "c-kotu" : "c-uyari")}>{n}</span>)}</div>}
        {a.hatalar.length > 0 && <ul className="hata-liste">{a.hatalar.map((h) => <li key={h}>{h}</li>)}</ul>}
      </div>
    </div>
    <div className="satir sar">
      <button className="btn kucuk" onClick={() => setAcik(!acik)}>{acik ? "Mesajı gizle" : "Orijinal mesaj"}</button>
      {!bitti && a.durum !== "HATALI" && <button className="btn kucuk" onClick={() => git({ ad: "form", tip: t.tip, taslak: t as Partial<Veri>, adayId: a.id })}>Düzenle ve ekle</button>}
      {!bitti && <button className="btn kucuk" onClick={() => yaz("ATLANDI")}>Atla</button>}
      {a.durum === "ATLANDI" && <button className="btn kucuk" onClick={() => yaz(a.nedenler.length ? "KONTROL" : "HAZIR")}>Geri al</button>}
    </div>
    {acik && <pre className="ham">{mesaj?.metin}</pre>}
  </div>;
}

/** v3.12 — "Düzenle" ekranından dönünce sekme ve filtre kaybolmasın (bileşen yeniden kurulur) */
let SON_SEKME: "TUMU" | "HAZIR" | "KONTROL" | "HATALI" | "BITEN" = "TUMU";
let SON_TIP: "" | "TALEP" | "PORTFOY" = "";
const SIRA: Record<string, number> = { HAZIR: 0, KONTROL: 1, HATALI: 2, ATLANDI: 3, EKLENDI: 4 };

function Inceleme({ ia }: { ia: IceAktarma }) {
  const { d, guncelle, bildir } = useDepo();
  const [sekme, setSekmeS] = useState<"TUMU" | "HAZIR" | "KONTROL" | "HATALI" | "BITEN">(SON_SEKME);
  const [secim, setSecim] = useState<Set<string>>(new Set());
  const [tipF, setTipFS] = useState<"" | "TALEP" | "PORTFOY">(SON_TIP);
  const [limit, setLimit] = useState(60); // v3.12: binlerce kart telefonu dondurur; 60'ar 60'ar gösterilir
  const setSekme = (v: typeof sekme) => { SON_SEKME = v; setSekmeS(v); setLimit(60); };
  const setTipF = (v: typeof tipF) => { SON_TIP = v; setTipFS(v); };
  const mesaj = new Map(ia.mesajlar.map((m) => [m.id, m]));
  const grupla = (s: string) => ia.adaylar
    .filter((a) => (s === "TUMU" ? true : s === "BITEN" ? a.durum === "EKLENDI" || a.durum === "ATLANDI" : a.durum === s) && (!tipF || a.taslak.tip === tipF))
    // Hazır olanlar önce (güveni yüksek olan üstte), kontrol edilecekler sonra, hatalılar, atlanan / eklenenler en sonda
    .sort((x, y) => (SIRA[x.durum] - SIRA[y.durum]) || ((y.guven ?? 0) - (x.guven ?? 0)));
  const liste = grupla(sekme);
  function ekle(ids: string[]) {
    let n = 0;
    guncelle((dd) => {
      if (!dd.aktifIceAktarma) return dd;
      const yeni: Kayit[] = [];
      let kisiler: Kisi[] = dd.kisiler;
      const adaylar = dd.aktifIceAktarma.adaylar.map((a) => {
        if (!ids.includes(a.id) || a.durum === "EKLENDI" || a.durum === "HATALI") return a;
        const s = siniflandir(a.taslak, [], dd.kayitlar.concat(yeni).filter((k) => !a.benzerKayitId || k.id !== a.benzerKayitId), dd.ayarlar.ttl);
        if (!s.veri) return a;
        // v3.4 — gönderen Kişiler'e bağlanır: telefonu kayıtlıysa mevcut kişi, değilse yeni kişi
        let veri = s.veri;
        if (!(veri.kisiler ?? []).length && (veri.gondeAdi || veri.gondeTelefon)) {
          const r = kisiRolleriOf(veri.tip, veri.ilanSahibiTipi, veri.islemTipi);
          let k = veri.gondeTelefon ? kisiler.find((x) => x.telefon === veri.gondeTelefon) : undefined;
          if (!k) { k = { id: yeniKisiId() + kisiler.length, adSoyad: veri.gondeAdi ?? veri.gondeTelefon!, telefon: veri.gondeTelefon ?? null, sirket: veri.gondeSirket ?? null, roller: [], uzmanlikAileleri: [], referans: null, notlar: null, whatsappGruplari: [], olusturma: BUGUN.toISOString(), sonIletisim: veri.mesajTarihi ? new Date(veri.mesajTarihi).toISOString() : null }; kisiler = [k, ...kisiler]; }
          const kk = k;
          kisiler = kisiler.map((x) => (x.id === kk.id ? { ...x, roller: [...new Set([...x.roller, ...r.roller])], whatsappGruplari: veri.kayitGrubu && !x.whatsappGruplari.includes(veri.kayitGrubu) ? [...x.whatsappGruplari, veri.kayitGrubu] : x.whatsappGruplari } : x));
          veri = { ...veri, kisiler: [{ kisiId: kk.id, rol: r.kayitRol as any }] };
        }
        yeni.push({ id: yeniId(a.taslak.tip), olusturma: BUGUN.toISOString(), veri }); n++;
        return { ...a, durum: "EKLENDI" as const };
      });
      return { ...dd, kisiler, kayitlar: [...yeni, ...dd.kayitlar], aktifIceAktarma: { ...dd.aktifIceAktarma, adaylar } };
    });
    setSecim(new Set()); setTimeout(() => bildir(`${ids.length} kayıt havuza eklendi`), 0);
  }
  const say = (s: string) => grupla(s).length;
  return <section className="yigin">
    <div className="kart"><h3>3. Gözden geçir ve onayla</h3>
      <p className="ipucu">Yapay zekânın çıkardığı her kayıt gerçek doğrulamadan geçti. <b>Hazır</b> olanlar eksiksizdir, tek tuşla eklenebilir; <b>Kontrol gerekli</b> olanlarda konum, fiyat veya benzer kayıt uyarısı var.</p>
      <div className="filtre">
        {([["TUMU", "Hepsi"], ["HAZIR", "Hazır"], ["KONTROL", "Kontrol gerekli"], ["HATALI", "Şemaya uymayan"], ["BITEN", "Eklenen / atlanan"]] as const).map(([k, l]) => <button key={k} className={cx("fb", sekme === k && "on")} onClick={() => { setSekme(k); setSecim(new Set()); }}>{l} ({say(k)})</button>)}
      </div>
      <div className="filtre">{([["", "Hepsi"], ["PORTFOY", "Portföyler"], ["TALEP", "Talepler"]] as const).map(([k, l]) => <button key={k} className={cx("fb", tipF === k && "on")} onClick={() => setTipF(k)}>{l}</button>)}</div>
      <div className="satir sar toplu">
        {(sekme === "HAZIR" || sekme === "TUMU") && ia.adaylar.some((a) => a.durum === "HAZIR") && <button className="btn birincil" onClick={() => ekle(ia.adaylar.filter((a) => a.durum === "HAZIR" && (!tipF || a.taslak.tip === tipF)).map((a) => a.id))}>Hazır olanların tümünü ekle ({ia.adaylar.filter((a) => a.durum === "HAZIR" && (!tipF || a.taslak.tip === tipF)).length})</button>}
        {(sekme === "HAZIR" || sekme === "KONTROL" || sekme === "TUMU") && liste.length > 0 && <>
          <button className="btn" onClick={() => { const secilebilir = liste.filter((a) => a.durum === "HAZIR" || a.durum === "KONTROL"); setSecim(secim.size === secilebilir.length ? new Set() : new Set(secilebilir.map((a) => a.id))); }}>{secim.size && secim.size === liste.filter((a) => a.durum === "HAZIR" || a.durum === "KONTROL").length ? "Seçimi kaldır" : "Tümünü seç"}</button>
          <button className="btn" disabled={!secim.size} onClick={() => ekle([...secim])}>Seçilenleri ekle ({secim.size})</button>
          <button className="btn" disabled={!secim.size} onClick={() => { guncelle((dd) => dd.aktifIceAktarma ? { ...dd, aktifIceAktarma: { ...dd.aktifIceAktarma, adaylar: dd.aktifIceAktarma.adaylar.map((a) => (secim.has(a.id) ? { ...a, durum: "ATLANDI" as const } : a)) } } : dd); setSecim(new Set()); }}>Seçilenleri atla</button>
        </>}
      </div>
    </div>
    {liste.slice(0, limit).map((a) => <AdayKarti key={a.id} a={a} mesaj={mesaj.get(a.mesajId)} secili={secim.has(a.id)} sec={(v) => setSecim((s) => { const n = new Set(s); v ? n.add(a.id) : n.delete(a.id); return n; })} />)}
    {liste.length > limit && <div className="satir sar"><button className="btn" onClick={() => setLimit((x) => x + 60)}>Daha fazla göster ({liste.length - limit} kayıt daha)</button><button className="btn" onClick={() => setLimit(liste.length)}>Hepsini göster</button></div>}
    {!liste.length && <p className="bos">Bu grupta kayıt yok.</p>}
    <div className="satir sar"><button className="btn" onClick={() => {
      guncelle((dd) => ({ ...dd, aktifIceAktarma: null, iceAktarmaGecmisi: [{ id: ia.id, tarih: BUGUN.toISOString(), dosyalar: ia.dosyalar, mesaj: ia.mesajlar.length, aday: ia.adaylar.length, eklenen: ia.adaylar.filter((a) => a.durum === "EKLENDI").length, kontrol: ia.adaylar.filter((a) => a.durum === "KONTROL").length }, ...dd.iceAktarmaGecmisi].slice(0, 20) }));
      bildir("İçe aktarma kapatıldı");
    }}>İçe aktarmayı bitir</button><span className="ipucu">Bekleyenler eklenmeden kapanır; özet geçmişte kalır.</span></div>
  </section>;
}

export function TopluIceAktarma() {
  const { d, guncelle, bildir, sample } = useDepo();
  const [sonGun, setSonGun] = useState<number | null>(null);
  const dosyaGirdi = useRef<HTMLInputElement>(null);
  const [surukle, setSurukle] = useState(false);
  const [hata, setHata] = useState<string | null>(null);
  const [uyari, setUyari] = useState<string | null>(null);
  const [tekMetin, setTekMetin] = useState("");
  const ctl = useRef<AbortController | null>(null);
  const ia = d.aktifIceAktarma;

  function baslat(kaynaklar: { dosya: string; icerik: string; grup: string }[]) {
    const tum = kaynaklar.flatMap((k) => {
      const m = sohbetiAyristir(k.icerik, k.dosya, k.grup);
      // Biçimsiz düz metin (tek mesaj yapıştırma) → tek mesaj say
      return m.length ? m : [{ id: `${k.grup}#1`, grup: k.grup, dosya: k.dosya, tarih: BUGUN.toISOString(), gonderen: "Yapıştırılan metin", telefon: null, metin: k.icerik.trim() }];
    });
    if (!tum.length) { setHata("Dosyada WhatsApp mesajı bulunamadı."); return; }
    // v3.4 — aynı dosya / daha önce işlenmiş mesajlar yapay zekâya tekrar gitmez
    const izler = kaynaklar.map((k) => ({ ad: k.dosya, iz: dosyaParmakIzi(k.icerik) }));
    const eskiler = izler.filter((x) => d.dosyaIzleri[x.iz]).map((x) => `${x.ad} (${tarihYaz(d.dosyaIzleri[x.iz].tarih, true)} tarihinde yüklenmişti)`);
    setUyari(eskiler.length ? `Bu dosya daha önce yüklendi: ${eskiler.join("; ")}. Önceden işlenen mesajlar atlandı, yalnızca yeni mesajlar ayrıştırılır.` : null);
    const r = onFiltre(tum, { sonGun, bugun: BUGUN, oncedenIslenmis: new Set(d.islenmisMesajlar), kayitliMetinler: kayitliMetinIzleri(d.kayitlar) });
    const adayMesaj = r.mesajlar.filter((m) => m.durum === "ADAY");
    const yeni: IceAktarma = { id: "IA" + Date.now().toString(36), baslangic: BUGUN.toISOString(), dosyalar: kaynaklar.map((k) => k.dosya), gruplar: r.gruplar, mesajlar: r.mesajlar.map((m) => (m.durum === "GURULTU" ? { ...m, metin: m.metin.slice(0, 300) } : m)), adaylar: [], asama: "ONFILTRE", islenenPaket: 0, toplamPaket: Math.ceil(adayMesaj.length / PAKET) };
    setHata(null);
    // v3.12 — adaylar yapay zekâ beklemeden kurallarla hemen çıkar ve "Gözden geçir" listesine düşer
    const kuralA = kuralAdaylari(r.mesajlar, d, yeni.id, d.kayitlar);
    yeni.adaylar = kuralA; yeni.asama = "INCELEME";
    let konumA: KonumAdayi[] | null = null;
    for (const a of kuralA) if (a.cozulemeyen.length) { const m = r.mesajlar.find((x) => x.id === a.mesajId); konumA = adaylariGuncelle(konumA ?? [], a.cozulemeyen, [], m?.metin ?? "", m?.tarih ? new Date(m.tarih) : BUGUN); }
    const simdi = new Date().toISOString();
    guncelle((dd) => { let adaylar = dd.adaylar; if (konumA) for (const k of konumA) adaylar = adaylariGuncelleBirlestir(adaylar, k); return { ...dd, adaylar, aktifIceAktarma: yeni, dosyaIzleri: { ...dd.dosyaIzleri, ...Object.fromEntries(izler.filter((x) => !dd.dosyaIzleri[x.iz]).map((x) => [x.iz, { ad: x.ad, tarih: simdi }])) } }; });
  }

  async function ayristir(hazir: boolean) {
    if (!ia) return;
    // v3.12 — kurallarla okunmuş adaylardan yalnızca "Kontrol gerekli" / "Hata" olanların mesajları yapay zekâya gider; kararı verilenlere dokunulmaz
    const belirsiz = new Set(ia.adaylar.filter((a) => a.kaynak === "KURAL" && (a.durum === "KONTROL" || a.durum === "HATALI")).map((a) => a.mesajId));
    const adayMesaj = ia.mesajlar.filter((m) => m.durum === "ADAY" && (!ia.adaylar.some((a) => a.kaynak === "KURAL") || belirsiz.has(m.id)));
    ctl.current = new AbortController();
    guncelle((dd) => dd.aktifIceAktarma ? { ...dd, aktifIceAktarma: { ...dd.aktifIceAktarma, asama: "AYRISTIRILIYOR", islenenPaket: 0, toplamPaket: Math.ceil(adayMesaj.length / PAKET), adaylar: dd.aktifIceAktarma.adaylar.filter((a) => !(a.kaynak === "KURAL" && (a.durum === "KONTROL" || a.durum === "HATALI") && belirsiz.has(a.mesajId))) } } : dd);
    const kayitlarGuncel = d.kayitlar;
    for (let i = 0; i < adayMesaj.length; i += PAKET) {
      if (ctl.current.signal.aborted) break;
      const paket = adayMesaj.slice(i, i + PAKET);
      let ham: any;
      try {
        if (hazir) ham = { sinif: "HER_IKISI", kayitlar: paket.flatMap((m, j) => hazirAiSonucu(m.metin).map((k) => ({ ...k, mesajNo: j + 1 }))) };
        else ham = await aiJson(sample, `${GEMINI_SISTEM_TALIMATI}\n\nÇIKTI: Yalnızca aşağıdaki JSON şemasına uyan TEK bir JSON nesnesi döndür. Açıklama veya kod bloğu yazma. Şemada olmayan alan EKLEME; enum alanlarında yalnızca listelenen değerleri kullan. Her kayda mesajNo yaz.\nŞEMA:\n${JSON.stringify(GEMINI_RESPONSE_SCHEMA)}\n\nNUMARALI MESAJLAR:\n${paketMetni(paket)}`, { signal: ctl.current.signal, modelTier: "default" });
      } catch (e: any) {
        if (e?.code === "cancelled") break;
        setHata(e?.code === "not_granted" ? "Yapay zekâya izin verilmedi." : e?.code === "rate_limited" ? "Çok sık istek gönderildi; biraz bekleyip 'Devam et'e basın." : "Yapay zekâ yanıt veremedi: " + (e?.message ?? e?.code));
        break;
      }
      const p = AiParseCiktiSchema.safeParse(ham);
      const yeniAdaylar: IceAktarmaAdayi[] = [];
      let yeniKonumAdaylari: KonumAdayi[] | null = null;
      if (!p.success) {
        yeniAdaylar.push({ id: "A" + Math.random().toString(36).slice(2, 8), mesajId: paket[0].id, durum: "HATALI", nedenler: [`Paket ${i / PAKET + 1}: yapay zekâ yanıtı şemaya uymadı`], hatalar: p.error.issues.slice(0, 6).map((x) => `${x.path.join(".")}: ${x.message}`), taslak: { tip: "PORTFOY", mulkTipi: "DIGER", islemTipi: "SATILIK" } as any, cozulemeyen: [] });
      } else for (const k of p.data.kayitlar) {
        const m = paket[(k.mesajNo ?? 1) - 1] ?? paket[0];
        const duz = aiKaydiniDuzelt(k, m, p.data.kayitlar.filter((x) => (x.mesajNo ?? 1) === (k.mesajNo ?? 1)).length);
        const { taslak, cozulemeyen, cozulen } = taslakOlustur(duz.k, m, ia.id);
        const s = siniflandir(taslak, cozulemeyen, kayitlarGuncel, d.ayarlar.ttl);
        if (duz.notlar.length) { s.nedenler.push(...duz.notlar); if (s.durum === "HAZIR") s.durum = "KONTROL"; }
        if (cozulemeyen.length) yeniKonumAdaylari = adaylariGuncelle(yeniKonumAdaylari ?? [], cozulemeyen, cozulen, m.metin, m.tarih ? new Date(m.tarih) : BUGUN);
        yeniAdaylar.push({ id: "A" + Math.random().toString(36).slice(2, 8), mesajId: m.id, durum: s.durum, nedenler: s.nedenler, hatalar: s.hatalar, benzerKayitId: s.benzerKayitId, taslak, cozulemeyen, guven: taslakGuveni(taslak, s.nedenler.length), kaynak: "AI" });
      }
      const ka = yeniKonumAdaylari;
      guncelle((dd) => {
        if (!dd.aktifIceAktarma) return dd;
        let adaylar = dd.adaylar;
        if (ka) for (const a of ka) adaylar = adaylariGuncelleBirlestir(adaylar, a);
        const yeniIz = paket.map((m) => metinParmakIzi(m.metin)).filter((x) => !dd.islenmisMesajlar.includes(x));
        return { ...dd, adaylar, islenmisMesajlar: [...dd.islenmisMesajlar, ...yeniIz].slice(-20000), aktifIceAktarma: { ...dd.aktifIceAktarma, adaylar: [...dd.aktifIceAktarma.adaylar, ...yeniAdaylar], islenenPaket: i / PAKET + 1 } };
      });
    }
    guncelle((dd) => dd.aktifIceAktarma ? { ...dd, aktifIceAktarma: { ...dd.aktifIceAktarma, asama: "INCELEME" } } : dd);
  }

  const ornekMi = ia?.dosyalar.every((x) => x.includes("(örnek)")) ?? false;
  if (!ia) return <div className="yigin">
    <p className="ipucu">WhatsApp grubunda <b>⋮ → Diğer → Sohbeti dışa aktar → Medya olmadan</b> ile aldığınız .txt veya .zip dosyalarını buraya bırakın. Birden çok grubu aynı anda seçebilirsiniz.</p>
    <div className={cx("birak", surukle && "on")} onDragOver={(e) => { e.preventDefault(); setSurukle(true); }} onDragLeave={() => setSurukle(false)}
      onDrop={async (e) => { e.preventDefault(); setSurukle(false); const f = [...e.dataTransfer.files]; if (f.length) baslat(await dosyalariOku(f)); }}>
      {/* v3.12: telefonda üstüne basınca dosya seçici açılmıyordu (gizli girdi + etiket). Gerçek düğme + kısıtsız `accept` (bazı telefonlar .txt/.zip'i gri gösterir). */}
      <input ref={dosyaGirdi} type="file" id="wa-dosya" multiple hidden onChange={async (e) => { const f = [...(e.target.files ?? [])].filter((x) => /\.(txt|zip)$/i.test(x.name)); const hepsi = e.target.files?.length ?? 0; e.target.value = ""; if (f.length) baslat(await dosyalariOku(f)); else if (hepsi) setHata("Yalnızca .txt veya .zip sohbet dosyaları okunur."); }} />
      <button type="button" className="btn birincil genis-btn" onClick={() => dosyaGirdi.current?.click()}>Dosya seç (.txt / .zip)</button>
      <span>Birden çok grup dosyasını birlikte seçebilirsiniz · bilgisayarda dosyaları buraya sürükleyip de bırakabilirsiniz</span>
    </div>
    <div className="satir sar"><span className="alan-etiket">Hangi mesajlar?</span>{SON_GUN_SECENEK.map(([g, l]) => <button key={l} className={cx("fb", sonGun === g && "on")} onClick={() => setSonGun(g)}>{l}</button>)}</div>
    <div className="satir sar"><button className="btn" onClick={() => baslat(ORNEK_SOHBETLER.map((s) => ({ ...s, grup: grupAdiOf(s.dosya) })))}>Örnek iki grup dosyasıyla dene</button></div>
    {hata && <div className="hata-kutu">{hata}</div>}
    {d.iceAktarmaGecmisi.length > 0 && <section className="kart"><h3>Önceki içe aktarmalar</h3>
      {d.iceAktarmaGecmisi.map((g) => <div key={g.id} className="lok-sonuc"><b>{tarihYaz(g.tarih)}</b><span>{g.dosyalar.length} dosya · {g.mesaj} mesaj · {g.aday} kayıt çıktı · {g.eklenen} eklendi{g.kontrol ? ` · ${g.kontrol} bekliyordu` : ""}</span></div>)}
    </section>}
  </div>;

  const adaySayi = ia.mesajlar.filter((m) => m.durum === "ADAY").length;
  return <div className="yigin">
    <div className="satir-ara"><span className="ipucu">{ia.dosyalar.length} dosya · {ia.mesajlar.length} mesaj</span><button className="btn kucuk" onClick={() => { ctl.current?.abort(); guncelle((dd) => ({ ...dd, aktifIceAktarma: null })); }}>İptal et</button></div>
    {uyari && <div className="uyari-kutu">{uyari}</div>}
    <OnFiltreOzeti ia={ia} />
    <section className="kart">
      <h3>2. Kurallarla okundu · yapay zekâ isteğe bağlı</h3>
      {ia.asama === "ONFILTRE" && <>
        <p className="ipucu"><b>{adaySayi} mesaj → {ia.toplamPaket} istek.</b>{ia.mesajlar.filter((m) => m.durum === "ONCEKI").length > 0 && <> {ia.mesajlar.filter((m) => m.durum === "ONCEKI").length} mesaj daha önce işlendiği / havuzda kayıtlı olduğu için gönderilmeyecek.</>} Her paket bir istektir; ilk seferde izin sorulur ve sizin Claude kullanım hakkınızdan harcar.</p>
        <div className="satir sar">
          {sample && <button className="btn birincil" disabled={!adaySayi} onClick={() => ayristir(false)}>Ayrıştır ({adaySayi} mesaj)</button>}
          {ornekMi && <button className={cx("btn", !sample && "birincil")} onClick={() => ayristir(true)}>Hazır örnek sonuçlarla devam et</button>}
        </div>
        {!sample && !ornekMi && <div className="uyari-kutu">Yapay zekâ bu görünümde çalışmıyor (ör. paylaşılan bağlantıdan açıldı). Ön filtre sonucu yukarıda; ayrıştırma için sayfayı kendi hesabınızdan açın.</div>}
      </>}
      {ia.asama === "AYRISTIRILIYOR" && <div className="ilerleme"><div className="cubuk"><span style={{ width: `${(ia.islenenPaket / Math.max(1, ia.toplamPaket)) * 100}%` }} /></div><span>Paket {ia.islenenPaket} / {ia.toplamPaket} · {ia.adaylar.length} kayıt çıktı</span><button className="btn kucuk" onClick={() => ctl.current?.abort()}>Durdur</button></div>}
      {ia.asama === "INCELEME" && (() => {
        const belirsizMesaj = new Set(ia.adaylar.filter((a) => a.kaynak === "KURAL" && (a.durum === "KONTROL" || a.durum === "HATALI")).map((a) => a.mesajId)).size;
        return <>
          <p>{ia.adaylar.length} kayıt çıkarıldı: <b>{ia.adaylar.filter((a) => a.durum === "HAZIR").length} hazır</b>, {ia.adaylar.filter((a) => a.durum === "KONTROL").length} kontrol gerekli. Aşağıdaki listede hazır olanlar üsttedir.{ia.adaylar.some((a) => a.kaynak === "AI") && ia.islenenPaket < ia.toplamPaket && <> {ia.toplamPaket - ia.islenenPaket} paket yapay zekâda işlenmedi. <button className="btn kucuk" onClick={() => ayristir(!sample)}>Devam et</button></>}</p>
          {sample && belirsizMesaj > 0 && <div className="satir sar"><button className="btn" onClick={() => ayristir(false)}>Kontrol gerekenleri yapay zekâyla yeniden oku ({belirsizMesaj} mesaj)</button><span className="ipucu">Kural okumasının emin olmadığı mesajlar; hazır olanlara dokunulmaz.</span></div>}
          {ornekMi && <div className="satir sar"><button className="btn" onClick={() => ayristir(true)}>Hazır örnek sonuçlarla değiştir</button></div>}
        </>;
      })()}
      {hata && <div className="hata-kutu">{hata}</div>}
    </section>
    {(ia.asama === "INCELEME" || ia.adaylar.length > 0) && <Inceleme ia={ia} />}
  </div>;
}

/** Aynı ifade farklı paketlerden gelirse sayıları topla */
function adaylariGuncelleBirlestir(liste: KonumAdayi[], yeni: KonumAdayi): KonumAdayi[] {
  const var_ = liste.find((a) => a.ifade === yeni.ifade);
  if (!var_) return [...liste, yeni];
  if (var_.durum !== "BEKLIYOR") return liste;
  const bg = { ...var_.birlikteGecis };
  for (const [k, v] of Object.entries(yeni.birlikteGecis)) bg[k] = { sayi: (bg[k]?.sayi ?? 0) + v.sayi, etiket: v.etiket };
  return liste.map((a) => (a === var_ ? { ...a, gorulme: a.gorulme + yeni.gorulme, birlikteGecis: bg, sonGorulme: yeni.sonGorulme } : a));
}

/** v3.9 — Veri Girişi: Yapıştır (akıllı kutu) · Dosya yükle (Excel/CSV/vCard + WhatsApp .txt/.zip) · Elle giriş */
export function VeriGirisi({ alt, metin, donus }: { alt?: string; metin?: string; donus?: boolean } = {}) {
  const { git, d } = useDepo();
  hafizaBaslat("vg.", donus); // v3.15: forma gidip "Vazgeç" ile dönülünce yüklü dosya / seçimler yerinde kalır; menüden girişte sıfırlanır
  const surenIs = !alt && !donus && !!d.aktifIceAktarma; // v3.12: yarım kalan içe aktarma varsa menüden girince oraya düşer (veriler kaybolmuş gibi görünmesin)
  const ilk = alt === "dosya" || alt === "wa" || surenIs ? "dosya" : alt === "el" ? "el" : "metin";
  const [sekme, setSekme] = useState(ilk);
  const [dosyaTuru, setDosyaTuru] = useState(alt === "wa" || surenIs ? "wa" : "tablo");
  return (
    <div className="yigin">
      <h2>Veri girişi</h2>
      <div className="sekme3" role="tablist">
        {([["metin", "Yapıştır"], ["dosya", "Dosya yükle"], ["el", "Elle gir"]] as const).map(([k, e]) => <button key={k} role="tab" aria-selected={sekme === k} className={sekme === k ? "on" : ""} onClick={() => setSekme(k)}>{e}</button>)}
      </div>
      {sekme === "metin" && <AkilliKutu gomulu donus={donus} baslangic={metin ?? ""} />}
      {sekme === "dosya" && (
        <div className="yigin">
          <div className="uc tam" role="group" aria-label="Dosya türü">
            <button className={dosyaTuru === "tablo" ? "on" : ""} onClick={() => setDosyaTuru("tablo")}>Excel · CSV · vCard</button>
            <button className={dosyaTuru === "wa" ? "on" : ""} onClick={() => setDosyaTuru("wa")}>WhatsApp sohbet dosyası</button>
          </div>
          {dosyaTuru === "tablo" ? <DosyaAktarma /> : <TopluIceAktarma />}
        </div>
      )}
      {sekme === "el" && (
        <div className="iki-kolon">
          <button className="kart secim" onClick={() => git({ ad: "form", tip: "TALEP" })}><b>Yeni talep</b><span>Müşterinin aradığı mülk</span></button>
          <button className="kart secim" onClick={() => git({ ad: "form", tip: "PORTFOY" })}><b>Yeni portföy</b><span>Elinizdeki mülk</span></button>
        </div>
      )}
    </div>
  );
}