/**
 * Anahtar CRM v3.24 · 10 Ekim 2026
 * GELEN KUTUSU — "onay bekleyenler". E-postayla ya da yüklemeyle gelen dosyalardaki (Revy Excel dökümü, WhatsApp sohbet .zip / .txt)
 * her ilan / talep burada tek havuzda bekler; kullanıcı ekler ya da atlar. Hiçbir kayıt onaysız havuza girmez.
 *
 *  - Mükerrer denetimi: havuzda zaten olan, başka portalda / başka grupta kopyası bulunan ve daha önce atlanan kayıtlar gösterilmez
 *    (sayıları özet satırında yazar; "Zaten var" süzgeciyle görülebilir). Havuzdaki bir ilanın fiyatı değiştiyse ayrı bir durumdur.
 *  - Yığılmaya karşı: kaynak / durum / tür / işlem süzgeçleri, arama, toplu "ekle / atla", "Tümünü temizle".
 *    v3.24: tarih gruplaması kaldırıldı (çok satır oluşturuyordu) — tek düz liste, HAZIR olanlar en üstte; ilan tarihi kartta yazar.
 *  - Dosyalar tarayıcıda açılır (demo/gelen-oku.ts); canlıda ham dosya sunucudan indirilir, demoda örnek dosyalar bu tarayıcıdadır.
 */
import React, { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useDepo, cx, Pill, IslemPill, Kopyala, baslikOf, fiyatOf, m2Of, lokEtiket, tarihYaz } from "./ortak";
import { useKalici, kaliciSil } from "./kalici";
import { etiket, tl } from "./etiketler";
import { CANLI, BUGUN, type DepoDurumu, type Veri } from "./depo";
import { gelenDepo, demoGelenSifirla, type GelenAdres } from "./gelen-depo";
import { gelenDosyayiAc, type GelenParca } from "./gelen-oku";
import { hamAdaylar, durumla, adaylariEkle, fiyatlariGuncelle, BEKLEYEN, GELEN_KAYNAK_ETIKET, GELEN_DURUM_ETIKET, ANA_TUR_ETIKET, type HamAday, type GelenAday, type GelenKaynak, type GelenDurum, type AnaTur, type GelenSayim } from "./gelen-aday";
import { gmailKopruBetigi, GELEN_KANAL_ETIKET, type GelenDosyaKunye } from "../src/lib/ingest/gelen";
import { kaynakOf, kaynakUygula, type KaynakSecimi } from "../src/lib/domain/kaynak";
import { KaynakSecici } from "./kaynak-secici";
import { ICE_AKTARMA_DEVIR } from "./devir";

type Dosya = GelenDosyaKunye & { url?: string | null };

// ───────────────────────────── Kutu belleği (ekran sökülse de kalır; Ana Sayfa rozetini de besler) ─────────────────────────────
interface Kutu {
  asama: "bos" | "ozet" | "yukleniyor" | "hazir" | "hata";
  hata: string | null;
  dosyalar: Dosya[];
  /** dosyaId → o dosyadan çıkan ham adaylar (dosya bir kez açılır) */
  ham: Map<string, HamAday[]>;
  uyarilar: Map<string, string[]>;
  /** dosyaId → WhatsApp sohbet parçaları ("yapay zekâyla ayrıntılı oku" için) */
  sohbet: Map<string, { dosya: string; icerik: string; grup: string }[]>;
  atlanan: Set<string>;
  depoAcik: boolean;
  ilerleme: { n: number; toplam: number; ad: string } | null;
  /** Son yüklemede "bekleyeni kalmadığı için" kutudan kaldırılan dosyaların adları (kullanıcıya bir kez söylenir) */
  biten: string[];
  /** v3.24 — kullanıcının kart üzerinde değiştirdiği kaynak (aday anahtarı → seçim) */
  kaynak: Map<string, KaynakSecimi>;
}
const BOS_KUTU = (): Kutu => ({ asama: "bos", hata: null, dosyalar: [], ham: new Map(), uyarilar: new Map(), sohbet: new Map(), atlanan: new Set(), depoAcik: true, ilerleme: null, biten: [], kaynak: new Map() });
let KUTU: Kutu = BOS_KUTU();
const dinleyen = new Set<() => void>();
const yaz = (k: Partial<Kutu>) => { KUTU = { ...KUTU, ...k }; dinleyen.forEach((f) => f()); };
const abone = (f: () => void) => { dinleyen.add(f); return () => { dinleyen.delete(f); }; };
export const useKutu = () => useSyncExternalStore(abone, () => KUTU, () => KUTU);
/** Testler için */
export function kutuSifirla() { KUTU = BOS_KUTU(); dinleyen.forEach((f) => f()); }

/** Uygulama açılışında: yalnızca dosya listesi (tek küçük istek). Dosyalar açılmaz; menüdeki rozet "bekleyen dosya" sayısını gösterir. */
export async function kutuOzetYukle() {
  if (KUTU.asama !== "bos") return;
  try { const l = await gelenDepo().listele(); if (KUTU.asama === "bos") yaz({ asama: "ozet", dosyalar: l.dosyalar, depoAcik: l.depo }); }
  catch { /* özet okunamadı: ekran açılınca yeniden denenir */ }
}

let yukleme: Promise<void> | null = null;
/** Dosya listesini ve atlananları okur, daha önce açılmamış dosyaları açar. Açılmış dosya yeniden indirilmez. */
export function kutuYukle(d: DepoDurumu): Promise<void> {
  if (yukleme) return yukleme;
  yukleme = (async () => {
    const depo = gelenDepo();
    yaz({ asama: KUTU.asama === "hazir" ? "hazir" : "yukleniyor", hata: null });
    try {
      const liste = await depo.listele(), atl = await depo.atlananlar(); // art arda: iki küçük istek, sunucuda aynı anda iki veritabanı bağlantısı açılmasın
      const ham = new Map<string, HamAday[]>(), uyarilar = new Map<string, string[]>(), sohbet = new Map<string, { dosya: string; icerik: string; grup: string }[]>();
      const yeni = liste.dosyalar.filter((x) => !KUTU.ham.has(x.id));
      for (const x of liste.dosyalar) if (KUTU.ham.has(x.id)) { ham.set(x.id, KUTU.ham.get(x.id)!); uyarilar.set(x.id, KUTU.uyarilar.get(x.id) ?? []); if (KUTU.sohbet.has(x.id)) sohbet.set(x.id, KUTU.sohbet.get(x.id)!); }
      yaz({ dosyalar: liste.dosyalar, depoAcik: liste.depo, atlanan: new Set(atl), ham, uyarilar, sohbet });
      for (let i = 0; i < yeni.length; i++) {
        const x = yeni[i];
        yaz({ ilerleme: { n: i, toplam: yeni.length, ad: x.ad } });
        await new Promise((r) => setTimeout(r, 0)); // ekran "okunuyor" yazabilsin
        let parcalar: GelenParca[] = [], uy: string[] = [];
        try { const ac = await gelenDosyayiAc(x.ad, x.tur, await depo.icerik(x)); parcalar = ac.parcalar; uy = ac.uyarilar; }
        catch (e: any) { uy = [`Dosya indirilemedi: ${String(e?.message ?? e).slice(0, 140)}`]; }
        let adaylar: HamAday[] = [];
        try { adaylar = hamAdaylar(parcalar, x, d); } catch (e: any) { uy.push(`Dosya okunamadı: ${String(e?.message ?? e).slice(0, 140)}`); }
        if (!adaylar.length && !uy.length) uy.push("Bu dosyada ilan ya da talep bulunamadı");
        const s = parcalar.filter((p): p is Extract<GelenParca, { tur: "SOHBET" }> => p.tur === "SOHBET").map((p) => ({ dosya: p.dosya, icerik: p.icerik, grup: p.grup }));
        const h2 = new Map(KUTU.ham), u2 = new Map(KUTU.uyarilar), s2 = new Map(KUTU.sohbet);
        h2.set(x.id, adaylar); u2.set(x.id, uy); if (s.length) s2.set(x.id, s);
        yaz({ ham: h2, uyarilar: u2, sohbet: s2 });
      }
      // Bekleyeni kalmayan dosya (hepsi eklendi, atlandı ya da zaten havuzda) kutudan kaldırılır: her açılışta yeniden indirilip okunmasın.
      // Açılamayan / uyarılı dosyaya dokunulmaz (kullanıcı görsün). Bu yalnızca yükleme sırasında yapılır; "Geri al" bu yüzden bozulmaz.
      const bek = new Set(durumla(hamSirali(KUTU), d, KUTU.atlanan).adaylar.filter((a) => BEKLEYEN.has(a.durum)).map((a) => a.dosyaId));
      const biten = KUTU.dosyalar.filter((x) => KUTU.ham.has(x.id) && !bek.has(x.id) && (KUTU.ham.get(x.id)!.length > 0) && !(KUTU.uyarilar.get(x.id) ?? []).length);
      if (biten.length) {
        await depo.sil(biten.map((x) => x.id)).then(() => {
          const h = new Map(KUTU.ham), s = new Map(KUTU.sohbet); biten.forEach((x) => { h.delete(x.id); s.delete(x.id); });
          yaz({ dosyalar: KUTU.dosyalar.filter((x) => !biten.includes(x)), ham: h, sohbet: s, biten: biten.map((x) => x.ad) });
        }).catch(() => { /* silinemedi: bir sonraki açılışta yeniden denenir */ });
      }
      yaz({ asama: "hazir", ilerleme: null });
    } catch (e: any) { yaz({ asama: "hata", hata: String(e?.message ?? e), ilerleme: null }); }
  })().finally(() => { yukleme = null; });
  return yukleme;
}

/** Yeni dosya önce: aynı ilan iki dökümde varsa güncel olan (yeni fiyat) kalır */
const hamSirali = (k: Kutu): HamAday[] => k.dosyalar.flatMap((x) => k.ham.get(x.id) ?? []);
/** Menü / Ana Sayfa rozeti: dosyalar açıldıysa bekleyen kayıt sayısı, açılmadıysa bekleyen dosya sayısı */
export function useGelenRozet(d: DepoDurumu): { sayi: number; birim: "kayıt" | "dosya" } {
  const k = useKutu();
  return useMemo(() => (k.asama === "hazir" ? { sayi: durumla(hamSirali(k), d, k.atlanan).sayim.bekleyen, birim: "kayıt" as const } : { sayi: k.dosyalar.length, birim: "dosya" as const }), [k, d.kayitlar, d.kisiler]);
}

// ───────────────────────────── Küçük parçalar ─────────────────────────────
const DURUM_TON: Record<GelenDurum, string> = { HAZIR: "iyi", KONTROL: "uyari", DEGISTI: "mavi", HATALI: "kotu", TEKRAR: "notr" };
const KAYNAK_TON: Record<GelenKaynak, string> = { REVY: "mor", WHATSAPP: "yesil", TABLO: "notr" };
const boyutYaz = (n: number) => (n >= 1048576 ? (n / 1048576).toFixed(1).replace(".", ",") + " MB" : Math.max(1, Math.round(n / 1024)) + " KB");
const islemUyar = (islem: string | undefined, f: string) => !f || (f === "DEVREN" ? String(islem ?? "").startsWith("DEVREN") : islem === f);

function AdayKarti({ a, secili, sec, islem }: { a: GelenAday; secili: boolean; sec: (v: boolean) => void; islem: { ekle: (a: GelenAday) => void; atla: (a: GelenAday) => void; fiyat: (a: GelenAday) => void; kaynak: (a: GelenAday, k: KaynakSecimi) => void } }) {
  const { git } = useDepo();
  const [ham, setHam] = useState(false);
  const t = a.taslak as Partial<Veri>;
  const eklenir = !!a.veri && (a.durum === "HAZIR" || a.durum === "KONTROL");
  const konum = a.veri?.lokasyonlar?.length ? a.veri.lokasyonlar.filter((l: any) => !l.haric).map((l) => lokEtiket(l as any)).join(" · ") : (t.lokasyonHam as string) || "Konum yok";
  return <div className={cx("kart aday gk-kart", secili && "secili", a.durum === "TEKRAR" && "soluk")}>
    <div className="aday-bas">
      {eklenir && <input type="checkbox" aria-label="Seç" checked={secili} onChange={(e) => sec(e.target.checked)} />}
      <div className="aday-govde">
        <div className="pill-satir">
          <Pill ton={DURUM_TON[a.durum]}>{GELEN_DURUM_ETIKET[a.durum]}</Pill>
          <Pill ton={t.tip === "TALEP" ? "mavi" : "yesil"}>{t.tip === "TALEP" ? "Talep" : etiket(t.mulkTipi)}</Pill>{t.tip === "TALEP" && <Pill>{etiket(t.mulkTipi)}</Pill>}
          <IslemPill islem={t.islemTipi} />
          <Pill ton={KAYNAK_TON[a.kaynak]}>{a.altKaynak}</Pill>
          {a.sahip === "SAHIBI" && <Pill>Mülk sahibi</Pill>}{a.sahip === "OFIS" && <Pill>Emlak ofisi</Pill>}
          <span className="gk-tarih">{a.tarih ? tarihYaz(a.tarih) : "tarihsiz"}</span>
        </div>
        <div className="kk-baslik">{baslikOf(t)}</div>
        <div className="kk-alt">{konum} · {fiyatOf(t)}{m2Of(t) ? " · " + m2Of(t) : ""}{t.odaSayisi ? " · " + t.odaSayisi : ""}{t.gondeAdi ? ` · ${t.gondeAdi}` : ""}</div>
        {a.durum !== "TEKRAR" && a.durum !== "DEGISTI" && <KaynakSecici deger={kaynakOf(t)} degis={(k) => islem.kaynak(a, k)} kucuk />}
        {a.durum === "DEGISTI" && a.degisim && <div className="gk-degisim"><b>{tl(a.degisim.eski)}</b> → <b>{tl(a.degisim.yeni)}</b> <span className="ipucu">havuzdaki kayıtta eski fiyat duruyor</span></div>}
        {a.durum === "TEKRAR" && a.tekrarNedeni && <div className="ipucu">{a.tekrarNedeni}</div>}
        {a.durum !== "TEKRAR" && a.nedenler.length > 0 && <div className="cip-satir">{a.nedenler.map((n) => <span key={n} className="cip c-uyari">{n}</span>)}</div>}
        {a.hatalar.length > 0 && <div className="cip-satir">{a.hatalar.map((n) => <span key={n} className="cip c-kotu">{n}</span>)}</div>}
        {a.durum !== "TEKRAR" && (a.bilgi.length > 0 || !!t.operasyonNotu) && <div className="ipucu">{[t.operasyonNotu ? String(t.operasyonNotu).slice(0, 220) : "", ...a.bilgi].filter(Boolean).join(" · ")}</div>}
      </div>
    </div>
    <div className="satir sar">
      {eklenir && <button className="btn kucuk birincil" onClick={() => islem.ekle(a)}>Ekle</button>}
      {a.durum === "DEGISTI" && <button className="btn kucuk birincil" onClick={() => islem.fiyat(a)}>Fiyatı güncelle</button>}
      {a.mevcutId && <button className="btn kucuk" onClick={() => git({ ad: "detay", id: a.mevcutId! })}>Havuzdaki kaydı aç</button>}
      {a.durum !== "TEKRAR" && a.durum !== "DEGISTI" && <button className="btn kucuk" onClick={() => git({ ad: "form", tip: t.tip as any, taslak: { ...t, kisiler: a.veri?.kisiler } as any, geri: { ad: "gelen" } })}>Düzenle</button>}
      {a.durum !== "TEKRAR" && <button className="btn kucuk" onClick={() => islem.atla(a)}>Atla</button>}
      <button className="btn kucuk" onClick={() => setHam(!ham)}>{ham ? "Gizle" : "Orijinal"}</button>
      {t.portalUrl && <a className="btn kucuk" href={t.portalUrl as string} target="_blank" rel="noopener noreferrer">İlanı aç ↗</a>}
    </div>
    {ham && <pre className="ham">{a.ham}</pre>}
  </div>;
}

function EpostaKurulumu({ kapat }: { kapat: () => void }) {
  const { bildir } = useDepo();
  const [adres, setAdres] = useState<GelenAdres | null>(null);
  const [hata, setHata] = useState<string | null>(null);
  const [onay, setOnay] = useState(false);
  const yukle = (yenile = false) => gelenDepo().adres(yenile).then((a) => { setAdres(a); setHata(null); }).catch((e) => setHata(String(e?.message ?? e)));
  useEffect(() => { void yukle(); }, []);
  const yonetici = !CANLI.acik || (CANLI.oturum?.bilgi?.yetkiler ?? []).includes("ofis.ayarlar");
  const giris = CANLI.oturum?.eposta ?? "";
  const ornek = /@gmail\.com$/i.test(giris) ? giris.replace("@", "+anahtar@") : "adiniz+anahtar@gmail.com";
  const betik = adres ? gmailKopruBetigi(adres.kopru, adres.kod) : "";
  return <section className="kart yigin kucuk-bosluk gk-kurulum" aria-label="E-posta kurulumu">
    <div className="satir-ara"><h3>E-postayla gönderme</h3><button className="btn kucuk" onClick={kapat}>Kapat</button></div>
    {hata && <div className="hata-kutu">{hata}</div>}
    {!adres && !hata && <p className="ipucu">Adres okunuyor…</p>}
    {adres?.eposta && <>
      <p>Dosyalarınızı (WhatsApp sohbet dökümü, Revy Excel'i) şu adrese e-postayla gönderin; birkaç saniye içinde buraya düşer:</p>
      <div className="satir sar"><code className="gk-adres">{adres.eposta}</code><Kopyala metin={adres.eposta} etiketi="Adresi kopyala" /></div>
      <p className="ipucu">Telefonunuzda bu adresi “Anahtar CRM” adıyla rehbere kaydedin: WhatsApp'ta <b>Sohbeti dışa aktar › Medya olmadan › E-posta</b> deyip alıcıya bu kişiyi seçersiniz. Adres gizlidir; bilen herkes kutunuza dosya bırakabilir.</p>
    </>}
    {adres && !adres.eposta && <>
      <p>Dosyaları <b>kendi Gmail adresinize</b> gönderirsiniz; küçük bir Gmail ayarı ekleri 10 dakikada bir buraya taşır. Ücretsizdir, bir kez kurulur (≈ 5 dakika).</p>
      <ol className="gk-adimlar">
        <li>Bilgisayarda <a href="https://script.google.com/home/projects/create" target="_blank" rel="noopener noreferrer">script.google.com</a> adresini açın (dosyaları göndereceğiniz Gmail hesabıyla) → <b>Yeni proje</b>.</li>
        <li>Açılan kutudaki yazıyı tümüyle silin, aşağıdaki kodu yapıştırın ve kaydedin (disket simgesi). <Kopyala metin={betik} etiketi="Kodu kopyala" /></li>
        <li>Üstteki işlev listesinden <b>kur</b>'u seçip <b>▶ Çalıştır</b>'a basın. Google izin ister: <b>Gelişmiş › … projesine git › İzin ver</b>. (Kod yalnızca sizin hesabınızda çalışır; yalnızca aşağıdaki adrese gelen postaların eklerine bakar.)</li>
        <li>Bitti. Dosyaları şu adrese gönderin: <code className="gk-adres">{ornek}</code> — kendi Gmail adresinizin <b>+anahtar</b> eklenmiş hâli. Telefonda bu adresi “Anahtar CRM” adıyla rehbere kaydedin.</li>
      </ol>
      <p className="ipucu"><b>WhatsApp:</b> grup › ⋮ › Diğer › <b>Sohbeti dışa aktar › Medya olmadan</b> › Gmail › alıcı: Anahtar CRM. <b>Revy:</b> süzgecinizi kaydedin, <b>Excel'e Aktar</b> deyin; inen dosyayı aynı adrese gönderin ya da doğrudan bu ekrana bırakın. İşlenen postalar Gmail'de “AnahtarCRM” etiketiyle işaretlenir.</p>
      <details><summary className="ipucu">Kodu göster</summary><pre className="ham">{betik}</pre></details>
      <p className="ipucu">Alan adınız Cloudflare'e bağlanınca (ör. anahtarcrm.com) bu ayara gerek kalmaz: her ofisin kendi <code>…@alanadiniz</code> adresi olur ve posta anında düşer.</p>
    </>}
    {adres && yonetici && (!onay
      ? <div className="satir"><button className="btn kucuk" onClick={() => setOnay(true)}>Anahtarı yenile…</button><span className="ipucu">Adres ya da kod başkasının eline geçtiyse.</span></div>
      : <div className="uyari-kutu"><span>Eski adres ve Gmail'e yapıştırdığınız kod çalışmaz olur; yeni kodu yeniden yapıştırmanız gerekir.</span><button className="btn kucuk tehlike" onClick={async () => { await yukle(true); setOnay(false); bildir("Gelen kutusu anahtarı yenilendi"); }}>Evet, yenile</button><button className="btn kucuk" onClick={() => setOnay(false)}>Vazgeç</button></div>)}
  </section>;
}

// ───────────────────────────── Ekran ─────────────────────────────
interface Suzgec { kaynak: "" | GelenKaynak; alt: string; durum: "" | GelenDurum; ana: "" | AnaTur; islem: "" | "SATILIK" | "KIRALIK" | "DEVREN"; tip: "" | "PORTFOY" | "TALEP"; ara: string }
const BOS_SUZGEC: Suzgec = { kaynak: "", alt: "", durum: "", ana: "", islem: "", tip: "", ara: "" };
const SAYFA = 60;

export function GelenKutusu({ gomulu = false }: { gomulu?: boolean } = {}) {
  const { d, guncelle, bildir, git } = useDepo();
  const k = useKutu();
  const [f, setF] = useKalici<Suzgec>("gelen.suzgec", BOS_SUZGEC);
  const [secim, setSecim] = useKalici<Set<string>>("gelen.secim", new Set());
  const [limit, setLimit] = useKalici<number>("gelen.limit", SAYFA);
  const [kurulum, setKurulum] = useKalici("gelen.kurulum", false);
  const [dosyalarAcik, setDosyalarAcik] = useKalici("gelen.dosyalar", false);
  const [temizle, setTemizle] = useState(false);
  const [mesgul, setMesgul] = useState<string | null>(null);
  const [hata, setHata] = useState<string | null>(null);
  const [sonAtlanan, setSonAtlanan] = useState<string[]>([]);
  const [surukle, setSurukle] = useState(false);
  const girdi = useRef<HTMLInputElement>(null);
  const depo = gelenDepo();

  useEffect(() => { void kutuYukle(d); }, []);

  const { adaylar, sayim } = useMemo(() => {
    const r = durumla(hamSirali(k), d, k.atlanan);
    if (!k.kaynak.size) return r;
    // v3.24 — kartta değiştirilen kaynak hem görünüme hem eklenecek kayda yansır
    return { ...r, adaylar: r.adaylar.map((a) => { const s = k.kaynak.get(a.key); return s ? { ...a, taslak: kaynakUygula(a.taslak as any, s), veri: a.veri ? kaynakUygula(a.veri as any, s) : a.veri } : a; }) };
  }, [k.ham, k.dosyalar, k.atlanan, k.kaynak, d.kayitlar, d.kisiler]);
  const bekleyen = useMemo(() => adaylar.filter((a) => BEKLEYEN.has(a.durum)), [adaylar]);
  const dosyaBekleyen = useMemo(() => { const m = new Map<string, number>(); for (const a of bekleyen) m.set(a.dosyaId, (m.get(a.dosyaId) ?? 0) + 1); return m; }, [bekleyen]);

  // Süzgeç: `haric` boyutu dışarıda bırakılarak sayılır (çipteki sayı, o çipe basınca kalacak kayıt sayısıdır)
  const ara = f.ara.trim().toLocaleLowerCase("tr");
  const araMetni = useMemo(() => new Map(ara ? adaylar.map((a) => [a, `${baslikOf(a.taslak)} ${a.taslak.lokasyonHam ?? ""} ${a.taslak.gondeAdi ?? ""} ${a.altKaynak} ${a.ham}`.toLocaleLowerCase("tr")] as const) : []), [adaylar, !!ara]);
  const uyar = (a: GelenAday, haric?: keyof Suzgec) =>
    (haric === "durum" ? BEKLEYEN.has(a.durum) || a.durum === "TEKRAR" : f.durum ? a.durum === f.durum : BEKLEYEN.has(a.durum)) &&
    (haric === "kaynak" || !f.kaynak || a.kaynak === f.kaynak) && (haric === "kaynak" || haric === "alt" || !f.alt || a.altKaynak === f.alt) &&
    (haric === "ana" || !f.ana || a.ana === f.ana) && (haric === "islem" || islemUyar(a.taslak.islemTipi as string, f.islem)) && (haric === "tip" || !f.tip || a.taslak.tip === f.tip) &&
    (!ara || (araMetni.get(a) ?? "").includes(ara));
  const gorunen = useMemo(() => adaylar.filter((a) => uyar(a)), [adaylar, f]);
  const say = (boyut: keyof Suzgec, p: (a: GelenAday) => boolean) => adaylar.filter((a) => uyar(a, boyut) && p(a)).length;
  const altlar = useMemo(() => [...new Set(adaylar.filter((a) => uyar(a, "alt")).map((a) => a.altKaynak))].sort((x, y) => x.localeCompare(y, "tr")), [adaylar, f]);
  const suzgecVar = JSON.stringify(f) !== JSON.stringify(BOS_SUZGEC);
  const sf = (p: Partial<Suzgec>) => { setF({ ...f, ...p }); setSecim(new Set()); setLimit(SAYFA); };

  // v3.24 — düz liste: hazır olanlar önce, sonra fiyatı değişen, kontrol gerekli, hatalı; her durumda en yeni ilan üstte
  const SIRA: Record<GelenDurum, number> = { HAZIR: 0, DEGISTI: 1, KONTROL: 2, HATALI: 3, TEKRAR: 4 };
  const sirali = useMemo(() => [...gorunen].sort((x, y) => SIRA[x.durum] - SIRA[y.durum] || (y.tarih ?? "").localeCompare(x.tarih ?? "")), [gorunen]);
  const eklenebilir = (a: GelenAday) => !!a.veri && (a.durum === "HAZIR" || a.durum === "KONTROL");
  const secilenler = gorunen.filter((a) => secim.has(a.key));

  // ───────── işlemler ─────────
  const ekle = (liste: GelenAday[]) => {
    const sec = liste.filter(eklenebilir); if (!sec.length) return;
    let r: ReturnType<typeof adaylariEkle> | null = null;
    guncelle((x) => { r = adaylariEkle(x, sec); return r.d; });
    setSecim(new Set()); setSonAtlanan([]);
    setTimeout(() => bildir(`${sec.length} kayıt havuza eklendi${r?.yeniKisi ? `, ${r.yeniKisi} yeni kişi` : ""} — eşleşmeler hesaplandı`), 0);
  };
  const atla = async (liste: GelenAday[]) => {
    const anahtarlar = [...new Set(liste.filter((a) => a.durum !== "TEKRAR").map((a) => a.key))]; if (!anahtarlar.length) return;
    const onceki = KUTU.atlanan;
    yaz({ atlanan: new Set([...onceki, ...anahtarlar]) }); setSecim(new Set()); setSonAtlanan(anahtarlar); setHata(null);
    try { await depo.atla(anahtarlar); } catch (e: any) { yaz({ atlanan: onceki }); setSonAtlanan([]); setHata(`Atlananlar kaydedilemedi: ${e?.message ?? e}`); }
  };
  const atlananiGeriAl = async () => {
    const anahtarlar = sonAtlanan; setSonAtlanan([]);
    const n = new Set(KUTU.atlanan); anahtarlar.forEach((x) => n.delete(x)); yaz({ atlanan: n });
    try { await depo.atlananUnut(anahtarlar); } catch (e: any) { setHata(`Geri alınamadı: ${e?.message ?? e}`); }
  };
  const fiyat = (liste: GelenAday[]) => {
    const sec = liste.filter((a) => a.durum === "DEGISTI"); if (!sec.length) return;
    guncelle((x) => fiyatlariGuncelle(x, sec).d);
    setTimeout(() => bildir(`${sec.length} kaydın fiyatı güncellendi`), 0);
  };
  const dosyaEkle = async (dosyalar: File[]) => {
    if (!dosyalar.length) return;
    setMesgul("Yükleniyor…"); setHata(null);
    const sorun: string[] = []; let yeni = 0, var_ = 0;
    for (const x of dosyalar) { try { const r = await depo.yukle(x); r.yeni ? yeni++ : var_++; } catch (e: any) { sorun.push(`${x.name}: ${e?.message ?? e}`); } }
    setMesgul(null);
    if (sorun.length) setHata(sorun.join(" · "));
    if (yeni || var_) { bildir(`${yeni ? `${yeni} dosya eklendi` : ""}${yeni && var_ ? ", " : ""}${var_ ? `${var_} dosya zaten kutudaydı` : ""}`); await kutuYukle(d); }
  };
  const dosyaSil = async (ids: string[]) => {
    setHata(null);
    try { await depo.sil(ids); const h = new Map(KUTU.ham); ids.forEach((i) => h.delete(i)); yaz({ dosyalar: KUTU.dosyalar.filter((x) => !ids.includes(x.id)), ham: h }); bildir(ids.length === 1 ? "Dosya kutudan silindi" : `${ids.length} dosya silindi`); }
    catch (e: any) { setHata(`Dosya silinemedi: ${e?.message ?? e}`); }
  };
  const hepsiniTemizle = async () => {
    setTemizle(false); setMesgul("Temizleniyor…"); setHata(null);
    const anahtarlar = [...new Set(bekleyen.map((a) => a.key))];
    try {
      if (anahtarlar.length) await depo.atla(anahtarlar);
      await depo.sil(null);
      yaz({ dosyalar: [], ham: new Map(), uyarilar: new Map(), sohbet: new Map(), atlanan: new Set([...KUTU.atlanan, ...anahtarlar]) });
      setSecim(new Set()); setSonAtlanan([]); bildir(`Gelen kutusu temizlendi (${anahtarlar.length} kayıt atlandı)`);
    } catch (e: any) { setHata(`Temizlenemedi: ${e?.message ?? e}`); }
    setMesgul(null);
  };
  const atlananlariUnut = async () => {
    try { await depo.atlananUnut(); yaz({ atlanan: new Set() }); setSonAtlanan([]); bildir("Atlananlar geri getirildi"); } catch (e: any) { setHata(`Geri getirilemedi: ${e?.message ?? e}`); }
  };
  const aiIleOku = (dosya: Dosya) => { const s = k.sohbet.get(dosya.id); if (!s?.length) return; ICE_AKTARMA_DEVIR.kaynaklar = s; git({ ad: "veri", alt: "wa" }); };
  const kartIslem = { ekle: (a: GelenAday) => ekle([a]), atla: (a: GelenAday) => void atla([a]), fiyat: (a: GelenAday) => fiyat([a]), kaynak: (a: GelenAday, s: KaynakSecimi) => { const m = new Map(KUTU.kaynak); m.set(a.key, s); yaz({ kaynak: m }); } };

  const yukleniyor = k.asama === "yukleniyor" || k.asama === "bos" || k.asama === "ozet";
  const gizlenen = sayim.zatenVar + sayim.kopya + sayim.atlanan;

  return <div className={cx("yigin gelen-kutusu", surukle && "surukle")} onDragOver={(e) => { e.preventDefault(); setSurukle(true); }} onDragLeave={() => setSurukle(false)} onDrop={(e) => { e.preventDefault(); setSurukle(false); void dosyaEkle([...e.dataTransfer.files]); }}>
    <div className="satir-ara">
      {!gomulu && <h2>Gelen kutusu</h2>}
      <div className="satir sar gk-ust">
        <input ref={girdi} type="file" multiple hidden onChange={(e) => { const x = [...(e.target.files ?? [])]; e.target.value = ""; void dosyaEkle(x); }} />
        <button className="btn birincil" disabled={!!mesgul} onClick={() => girdi.current?.click()}>Dosya ekle</button>
        <button className={cx("btn", kurulum && "vurgulu")} onClick={() => setKurulum(!kurulum)}>E-posta kurulumu</button>
        {CANLI.acik && <button className="btn" disabled={!!mesgul || !!k.ilerleme} onClick={() => void kutuYukle(d)}>Yenile</button>}
        {k.dosyalar.length > 0 && !yukleniyor && <button className="btn gk-temizle" disabled={!!mesgul || temizle} onClick={() => setTemizle(true)}>Tümünü temizle…</button>}
      </div>
    </div>
    <p className="ipucu gk-aciklama">Revy'den aldığınız Excel dökümü ve WhatsApp sohbet dosyaları burada <b>onayınızı bekler</b>. Dosyayı e-postayla gönderin ya da bu ekrana bırakın (.xlsx · .zip · .txt · .csv). Onaylamadığınız hiçbir kayıt havuza girmez.</p>
    {kurulum && <EpostaKurulumu kapat={() => setKurulum(false)} />}
    {!k.depoAcik && <div className="uyari-kutu">Dosya deposu bu kurulumda kapalı; e-postayla gelen ve yüklenen dosyalar saklanamaz. (Cloudflare › SUPABASE_SERVICE_ROLE_KEY)</div>}
    {(hata || k.hata) && <div className="hata-kutu" role="alert">{hata ?? k.hata}{k.asama === "hata" && <> <button className="btn kucuk" onClick={() => void kutuYukle(d)}>Yeniden dene</button></>}</div>}
    {(mesgul || k.ilerleme) && <div className="ipucu" role="status">{mesgul ?? `Dosyalar okunuyor (${k.ilerleme!.n + 1} / ${k.ilerleme!.toplam}): ${k.ilerleme!.ad}`}</div>}
    {k.biten.length > 0 && <div className="basari-kutu satir-ara"><span>Bekleyeni kalmayan {k.biten.length === 1 ? "dosya" : `${k.biten.length} dosya`} kutudan kaldırıldı: {k.biten.slice(0, 3).join(", ")}{k.biten.length > 3 ? "…" : ""}</span><button className="btn kucuk" onClick={() => yaz({ biten: [] })}>Tamam</button></div>}
    {sonAtlanan.length > 0 && <div className="basari-kutu satir-ara"><span>{sonAtlanan.length} kayıt atlandı. Aynı kayıt yeniden gelirse sorulmaz.</span><button className="btn kucuk" onClick={() => void atlananiGeriAl()}>Geri al</button></div>}

    {!yukleniyor && <>
      {temizle && <div className="hata-kutu" role="alert"><b>Gelen kutusu boşaltılacak.</b> Onay bekleyen {sayim.bekleyen.toLocaleString("tr-TR")} kayıt atlanır ve {k.dosyalar.length} dosya silinir. Atlanan kayıtlar aynı ilan yeniden gelirse bir daha sorulmaz (özet satırından geri getirilebilir). Havuza eklediklerinize dokunulmaz.
        <div className="satir" style={{ marginTop: 8 }}><button className="btn tehlike" onClick={() => void hepsiniTemizle()}>Evet, tümünü temizle</button><button className="btn" onClick={() => setTemizle(false)}>Vazgeç</button></div></div>}

      <section className="gk-ozet" aria-label="Özet">
        {([[sayim.bekleyen, "onay bekliyor", ""], [sayim.hazir, "hazır", "HAZIR"], [sayim.kontrol, "kontrol gerekli", "KONTROL"], [sayim.degisti, "fiyatı değişti", "DEGISTI"], [sayim.hatali, "eksik / hatalı", "HATALI"]] as const).filter(([n, , dr]) => n > 0 || dr === "" || dr === "HAZIR" || dr === "KONTROL").map(([n, e, dr]) =>
          <button key={e} type="button" className={cx("gk-sayi", f.durum === dr && "on", dr && "d-" + dr.toLowerCase())} aria-pressed={f.durum === dr} onClick={() => sf({ durum: dr as any })}><b>{n.toLocaleString("tr-TR")}</b><span>{e}</span></button>)}
      </section>
      {gizlenen > 0 && <p className="ipucu gk-gizlenen">Gösterilmeyen {gizlenen.toLocaleString("tr-TR")} kayıt: {[sayim.zatenVar && `${sayim.zatenVar} havuzda zaten var`, sayim.kopya && `${sayim.kopya} kutu içinde mükerrer (aynı ilan başka portalda / dökümde)`, sayim.atlanan && `${sayim.atlanan} daha önce atlandı`].filter(Boolean).join(" · ")}.
        {sayim.zatenVar + sayim.kopya > 0 && <> <button className="fc-temizle" onClick={() => sf({ durum: f.durum === "TEKRAR" ? "" : "TEKRAR" })}>{f.durum === "TEKRAR" ? "Bekleyenlere dön" : "Mükerrerleri göster"}</button></>}
        {sayim.atlanan > 0 && <> <button className="fc-temizle" onClick={() => void atlananlariUnut()}>Atlananları geri getir</button></>}</p>}

      <details className="kart gk-dosyalar" open={dosyalarAcik} onToggle={(e) => setDosyalarAcik((e.target as HTMLDetailsElement).open)}>
        <summary><b>Dosyalar ({k.dosyalar.length})</b> <span className="ipucu">{k.dosyalar.length ? "hangi dosyadan kaç kayıt bekliyor" : "kutuda dosya yok"}</span></summary>
        {k.dosyalar.map((x) => <div key={x.id} className="gk-dosya">
          <div className="gk-dosya-ad"><b>{x.ad}</b><span className="ipucu">{GELEN_KANAL_ETIKET[x.kanal]} · {tarihYaz(x.gelis, true)} · {boyutYaz(x.boyut)}{x.gonderen ? ` · ${x.gonderen}` : ""}</span>
            {(k.uyarilar.get(x.id) ?? []).map((u) => <span key={u} className="ipucu uyari-metin">{u}</span>)}</div>
          <span className="gk-dosya-say">{k.ham.has(x.id) ? <><b>{dosyaBekleyen.get(x.id) ?? 0}</b> bekliyor <span className="ipucu">/ {(k.ham.get(x.id) ?? []).length}</span></> : <span className="ipucu">okunuyor…</span>}</span>
          <div className="satir sar">
            {k.sohbet.has(x.id) && <button className="btn kucuk" title="Kuralların emin olamadığı mesajları yapay zekâya okutur (Veri Girişi › WhatsApp)" onClick={() => aiIleOku(x)}>✦ Yapay zekâyla oku</button>}
            <button className="btn kucuk" onClick={() => void dosyaSil([x.id])}>Sil</button>
          </div>
        </div>)}
        {!CANLI.acik && <div className="satir sar"><button className="btn kucuk" onClick={() => { demoGelenSifirla(); kutuSifirla(); void kutuYukle(d); bildir("Örnek dosyalar yeniden yüklendi"); }}>Örnek dosyaları yeniden yükle</button><span className="ipucu">Demo: dosyalar yalnızca bu tarayıcıda durur.</span></div>}
      </details>

      {(bekleyen.length > 0 || f.durum === "TEKRAR" || suzgecVar) && <>
        <div className="gk-suzgec">
          <div className="filtre" role="group" aria-label="Kaynak">
            <button className={cx("fb", !f.kaynak && "on")} onClick={() => sf({ kaynak: "", alt: "" })}>Tüm kaynaklar ({say("kaynak", () => true)})</button>
            {(Object.keys(GELEN_KAYNAK_ETIKET) as GelenKaynak[]).map((kk) => { const n = say("kaynak", (a) => a.kaynak === kk); return n ? <button key={kk} className={cx("fb", f.kaynak === kk && "on")} onClick={() => sf({ kaynak: kk, alt: "" })}>{GELEN_KAYNAK_ETIKET[kk]} ({n})</button> : null; })}
          </div>
          {altlar.length > 1 && <div className="filtre" role="group" aria-label="Portal ya da grup">
            <button className={cx("fb", !f.alt && "on")} onClick={() => sf({ alt: "" })}>Hepsi</button>
            {altlar.map((x) => <button key={x} className={cx("fb", f.alt === x && "on")} onClick={() => sf({ alt: x })}>{x} ({say("alt", (a) => a.altKaynak === x)})</button>)}
          </div>}
          <div className="filtre" role="group" aria-label="Tür ve işlem">
            <button className={cx("fb", !f.ana && "on")} onClick={() => sf({ ana: "" })}>Tüm türler</button>
            {(Object.keys(ANA_TUR_ETIKET) as AnaTur[]).map((x) => { const n = say("ana", (a) => a.ana === x); return n ? <button key={x} className={cx("fb", f.ana === x && "on")} onClick={() => sf({ ana: x })}>{ANA_TUR_ETIKET[x]} ({n})</button> : null; })}
            <span className="gk-ayrac" aria-hidden="true" />
            {([["", "Tüm işlemler"], ["SATILIK", "Satılık"], ["KIRALIK", "Kiralık"], ["DEVREN", "Devren"]] as const).map(([x, e]) => { const n = x ? say("islem", (a) => islemUyar(a.taslak.islemTipi as string, x)) : 1; return n ? <button key={x} className={cx("fb", f.islem === x && "on")} onClick={() => sf({ islem: x })}>{e}{x ? ` (${n})` : ""}</button> : null; })}
            {say("tip", (a) => a.taslak.tip === "TALEP") > 0 && <><span className="gk-ayrac" aria-hidden="true" />
              {([["", "Portföy + talep"], ["PORTFOY", "Portföy"], ["TALEP", "Talep"]] as const).map(([x, e]) => <button key={x} className={cx("fb", f.tip === x && "on")} onClick={() => sf({ tip: x })}>{e}{x ? ` (${say("tip", (a) => a.taslak.tip === x)})` : ""}</button>)}</>}
          </div>
          <div className="fc">
            <div className="fc-ara"><span aria-hidden="true">⌕</span><input type="search" aria-label="Gelen kutusunda ara" placeholder="Başlık, mahalle, kişi ara…" value={f.ara} onChange={(e) => sf({ ara: e.target.value })} /></div>
          </div>
          {suzgecVar && <div className="satir"><span className="ipucu">Süzgeçte {gorunen.length.toLocaleString("tr-TR")} kayıt</span><button className="fc-temizle" onClick={() => sf(BOS_SUZGEC)}>Süzgeci kaldır</button></div>}
        </div>

        {f.durum !== "TEKRAR" && <div className="toplu-cubuk">
          <label className="onay-satir"><input type="checkbox" checked={gorunen.filter(eklenebilir).length > 0 && gorunen.filter(eklenebilir).every((a) => secim.has(a.key))} onChange={(e) => setSecim(e.target.checked ? new Set(gorunen.filter(eklenebilir).map((a) => a.key)) : new Set())} /> {suzgecVar ? "Süzgeçtekilerin tümü" : "Tümünü seç"} ({gorunen.filter(eklenebilir).length})</label>
          {gorunen.some((a) => a.durum === "HAZIR" && a.veri) && <button className="btn kucuk birincil" onClick={() => ekle(gorunen.filter((a) => a.durum === "HAZIR"))}>Hazırların tümünü ekle ({gorunen.filter((a) => a.durum === "HAZIR" && a.veri).length})</button>}
          <button className="btn kucuk birincil" disabled={!secilenler.length} onClick={() => ekle(secilenler)}>Seçilenleri ekle ({secilenler.length})</button>
          <button className="btn kucuk" disabled={!secilenler.length} onClick={() => void atla(secilenler)}>Seçilenleri atla ({secilenler.length})</button>
          {gorunen.some((a) => a.durum === "DEGISTI") && <button className="btn kucuk" onClick={() => fiyat(gorunen)}>Fiyatları güncelle ({gorunen.filter((a) => a.durum === "DEGISTI").length})</button>}
        </div>}
      </>}
      {sirali.length > 0 && <div className="yigin gk-liste">
        {sirali.slice(0, limit).map((a) => <AdayKarti key={a.key + a.dosyaId} a={a} secili={secim.has(a.key)} islem={kartIslem} sec={(v) => setSecim((s) => { const n = new Set(s); v ? n.add(a.key) : n.delete(a.key); return n; })} />)}
        {sirali.length > limit && <div className="satir sar"><button className="btn" onClick={() => setLimit(limit + SAYFA)}>Daha fazla göster ({(sirali.length - limit).toLocaleString("tr-TR")} kayıt daha)</button><button className="btn" onClick={() => setLimit(sirali.length)}>Hepsini göster</button></div>}
      </div>}
      {!sirali.length && (k.dosyalar.length === 0
        ? <div className="kart gk-bos"><b>Gelen kutusu boş.</b><span>Revy'de süzgecinizi seçip <b>Excel'e Aktar</b> deyin, inen dosyayı buraya bırakın; WhatsApp grubunda <b>Sohbeti dışa aktar › Medya olmadan</b> ile aldığınız .zip dosyasını e-postayla gönderin ya da buraya bırakın.</span>
          <div className="satir sar"><button className="btn birincil" onClick={() => girdi.current?.click()}>Dosya ekle</button><button className="btn" onClick={() => setKurulum(true)}>E-posta kurulumu</button></div></div>
        : <p className="bos">{suzgecVar ? "Bu süzgece uyan kayıt yok." : "Onay bekleyen kayıt kalmadı. Biten dosyaları “Dosyalar” bölümünden silebilir ya da “Tümünü temizle” diyebilirsiniz."}</p>)}
    </>}
    {yukleniyor && !k.ilerleme && !k.hata && <p className="ipucu">Gelen kutusu açılıyor…</p>}
  </div>;
}

/** Ana Sayfa kartı: kutuda bir şey varsa görünür */
export function GelenKutusuKarti() {
  const { d, git } = useDepo();
  const r = useGelenRozet(d);
  if (!r.sayi) return null;
  return <button className="kart baglan-davet gk-davet" onClick={() => git({ ad: "gelen" })}>
    <span className="gk-davet-sayi">{r.sayi.toLocaleString("tr-TR")}</span>
    <span><b>Gelen kutusunda {r.sayi.toLocaleString("tr-TR")} {r.birim === "kayıt" ? "kayıt onayınızı bekliyor" : "dosya bekliyor"}</b><br /><small>Revy dökümü ve WhatsApp sohbetlerinden gelen ilan / talepler — ekleyin ya da atlayın.</small></span>
    <span className="ayar-gecis-ok" aria-hidden="true">›</span>
  </button>;
}
