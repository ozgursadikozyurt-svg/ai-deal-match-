/**
 * Anahtar CRM v3.22 · 9 Ekim 2026 (v3.13'ten)
 * Bağlantılar — Google Kişiler (v3.21: çift yönlü, "Google ile bağlan" tek düğme). Demo ve canlı AYNI ekran:
 *   demo  → gerçek hesaba bağlanmaz; örnek rehberle sunucudaki planlayıcıların aynısı çalışır (demo/senkron-demo.ts)
 *   canlı → sunucuya bağlanır (demo/google-baglanti.ts): bağlan → Google izin ekranı → dönüş → ilk içe aktarma (ilerlemeli)
 * Notion kartı v3.21'de GİZLİ (src/lib/ozellikler.ts › notion); kod yerinde, anahtar açılırsa geri gelir.
 */
import { Bilgi } from "./kartlar";
import React, { useEffect, useState } from "react";
import { useDepo, cx, Pill, tarihYaz, telYaz } from "./ortak";
import { Ikon } from "./kabuk";
import { demoGoogleSenkron, demoNotionSenkron, demoCakismaCoz, demoCakismalariCoz, demoGoogleKisiKaydet, demoGoogleHaricTemizle, ALAN_ETIKET } from "./senkron-demo";
import { bosBaglanti, bosGoogleBaglanti, CANLI, type DemoCalisma, type DemoBaglanti } from "./depo";
import { NOTION_TABLOLARI, GERI_YAZIM_ALANLARI } from "../src/lib/notion/yapilandirma";
import { alanRaporu } from "../src/lib/notion/geri-yazim";
import { ATLAMA_ETIKET } from "../src/lib/google/kisiler";
import { OZET_ETIKET } from "../src/lib/notion/plan";
import { GOOGLE_GRUPLAR, NOTION_TUR1 } from "./ornek-entegrasyon";
import { etiket } from "./etiketler";
import { notionAcik } from "../src/lib/ozellikler";
import { googleApi, googleBaglan, googleDurumYenile, googleEsitle, kisileriYenile, ozetCumlesi, type GoogleOzet } from "./google-baglanti";

const saat = (iso: string | null) => (iso ? new Date(iso).toLocaleString("tr-TR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—");
const degerYaz = (alan: string, v: unknown) => v == null || v === "" ? "boş" : typeof v === "number" ? v.toLocaleString("tr-TR") : alan === "telefon" ? telYaz(String(v)) : Array.isArray(v) ? etiket(v as any) : /^[A-Z_]+$/.test(String(v)) ? etiket(v as any) : String(v);
/** v3.21 — eşitleme özetindeki sayıların adları (Google çift yönlü alanları dahil) */
const OZET_AD: Record<string, string> = { ...OZET_ETIKET, baglanan: "Mevcut kişiye bağlanan", silinen: "Google'da silinen (Anahtar'da kaldı)", gonderilenYeni: "Google'a eklenen", gonderilenGuncel: "Google'da güncellenen", haric: "Anahtar'dan silindiği için alınmayan", gonderimHata: "Google'a yazılamayan", gonderimKalan: "Sırada bekleyen" };

/** Sayının yanına yazılan ad küçük harfle başlar; özel adla (Google, Anahtar) başlayan olduğu gibi kalır */
const kucuk = (ad: string) => (/^(Google|Anahtar)/.test(ad) ? ad : ad.toLocaleLowerCase("tr"));

/** v3.21 — çift yönlü eşitlemenin kuralları: ekranda, izin penceresinde ve belgelerde aynı metin */
export const GOOGLE_KURALLARI: [string, string][] = [
  ["Google'a (telefonunuza) kişi kaydettiniz", "Anahtar CRM'e düşer"],
  ["Anahtar CRM'de elle kişi eklediniz", "Google rehberinize eklenir"],
  ["Bir tarafta ad, telefon, e-posta ya da şirketi düzelttiniz", "diğer tarafta da düzelir"],
  ["Anahtar CRM'den kişi sildiniz", "Google'dan SİLİNMEZ; Anahtar'a da geri gelmez"],
  ["Google'dan kişi sildiniz", "Anahtar CRM'de kalır (talep / portföy bağı kopmasın)"],
];

/** Kenar menüsü / başlık için küçük durum göstergesi */
export function SenkronDurumu() {
  const { d, git } = useDepo();
  const b = d.baglantilar ?? { google: bosGoogleBaglanti(), notion: bosBaglanti() };
  // Canlıda Google bu kurulumda açılmamışsa (platform ayarı yok) gösterge de yoktur
  if (CANLI.acik && !d.googleCanli?.hazir) return null;
  const bagli = [notionAcik() && b.notion.durum === "BAGLI" && "Notion", b.google.durum === "BAGLI" && "Google"].filter(Boolean) as string[];
  const cakisma = (d.cakismalar ?? []).length;
  const yenile = d.googleCanli?.durum === "YENIDEN_YETKI";
  return <button className={cx("senkron-durum", (cakisma > 0 || yenile) && "uyari", !bagli.length && "kapali")} onClick={() => git({ ad: "baglantilar" } as any)} title="Bağlantılar">
    <span className="nokta" aria-hidden="true" />
    <span>{yenile ? "Google'ı yeniden bağlayın" : cakisma ? `${cakisma} çakışma bekliyor` : bagli.length ? `${bagli.join(" + ")} eşitlendi` : notionAcik() ? "Notion, Google bağlı değil" : "Google'ı bağlayın"}</span>
  </button>;
}

function Rapor({ c }: { c: DemoCalisma }) {
  const { git } = useDepo();
  const notion = c.saglayici === "NOTION";
  const sira = notion ? ["yeni", "baglanan", "guncellenen", "degismeyen", "kontrol", "cakisma", "arsivlenen", "hatali"] : ["yeni", "baglanan", "guncellenen", "gonderilenYeni", "gonderilenGuncel", "cakisma", "birlesen", "silinen", "haric", "atlanan", "gonderimHata", "gonderimKalan"];
  return <div className="rapor">
    <div className="rapor-sayilar">{sira.filter((k) => c.ozet[k]).map((k) => <span key={k} className={cx("rs", (k === "cakisma" || k === "kontrol" || k === "hatali" || k === "gonderimHata") && "dikkat")}><b>{c.ozet[k]}</b> {kucuk(OZET_AD[k] ?? k)}</span>)}
      {notion && !!c.ozet.kisiYeni && <span className="rs"><b>{c.ozet.kisiYeni}</b> yeni kişi</span>}
      {c.ozet.hata ? <span className="rs dikkat">eşitleme tamamlanamadı</span> : !sira.some((k) => c.ozet[k]) && !c.ozet.kisiYeni && <span className="ipucu">Değişiklik yok — her şey zaten eşit.</span>}</div>
    {c.yeniEslesme > 0 && <button className="rapor-eslesme" onClick={() => git({ ad: "eslesmeler" })}><b>+{c.yeniEslesme}</b><span>Bu senkron {c.yeniEslesme} yeni uygun eşleşme getirdi</span><Ikon ad="eslesme" /></button>}
    {c.kontrol.length > 0 && <details className="rapor-liste" open><summary>Kontrol gerekli ({c.kontrol.length}) — eklendi, bir göz atın</summary>
      <ul>{c.kontrol.map((k, i) => <li key={i}>{k.id ? <button className="baglanti-btn" onClick={() => git({ ad: "detay", id: k.id! })}>{k.baslik}</button> : <b>{k.baslik}</b>}<span>{k.nedenler.join(" · ")}</span></li>)}</ul></details>}
    {c.atlanan.length > 0 && <details className="rapor-liste"><summary>Alınmayanlar ({c.atlanan.length})</summary><ul>{c.atlanan.map((a, i) => <li key={i}><b>{a.ad}</b><span>{ATLAMA_ETIKET[a.neden] ?? a.neden}</span></li>)}</ul></details>}
    {c.geriYazim.length > 0 && <details className="rapor-liste"><summary>Notion'a geri yazılan ({c.geriYazim.length} sayfa)</summary>
      <div className="tablo-sar"><table><thead><tr><th>Sayfa</th><th>{GERI_YAZIM_ALANLARI.skor.ad}</th><th>{GERI_YAZIM_ALANLARI.sayi.ad}</th><th>{GERI_YAZIM_ALANLARI.enIyi.ad}</th></tr></thead>
        <tbody>{c.geriYazim.map((g) => <tr key={g.id}><td>{g.baslik}</td><td>{(g.deger.skor as number) ?? "—"}</td><td>{g.deger.sayi as number}</td><td>{(g.deger.enIyi as string) ?? "—"}</td></tr>)}</tbody></table></div>
      <p className="ipucu">Notion'da yalnızca bu beş alan güncellenir (yoksa ilk bağlantıda eklenir): {Object.values(GERI_YAZIM_ALANLARI).map((a) => a.ad).join(", ")}. Sizin alanlarınıza yazılmaz.</p></details>}
  </div>;
}

function Ayarlar({ b, set, google, etiketSecimi = true }: { b: DemoBaglanti; set: (a: Partial<DemoBaglanti["ayar"]>) => void; google: boolean; etiketSecimi?: boolean }) {
  return <details className="ic-ayar"><summary>Ayarlar</summary>
    <label className="onay-satir"><input type="checkbox" checked={b.ayar.otomatik} onChange={(e) => set({ otomatik: e.target.checked })} /> Otomatik eşitle</label>
    <label className="satir sar ipucu">Sıklık
      <select value={b.ayar.aralikDk} style={{ width: "auto" }} onChange={(e) => set({ aralikDk: Number(e.target.value) })}>{[5, 15, 30, 60, 180, 1440].map((m) => <option key={m} value={m}>{m < 60 ? `${m} dakikada bir` : m === 1440 ? "Günde bir" : `${m / 60} saatte bir`}</option>)}</select></label>
    {google ? (etiketSecimi && <>
      <div className="ipucu">Yalnızca şu etiketlerdeki kişileri al (hiçbiri seçili değilse telefonu olan herkes):</div>
      <div className="cip-satir">{GOOGLE_GRUPLAR.map((g) => { const on = b.ayar.sadeceEtiketler.includes(g.formattedName!); return <button key={g.resourceName} className={cx("cip secilir", on && "on")} onClick={() => set({ sadeceEtiketler: on ? b.ayar.sadeceEtiketler.filter((x) => x !== g.formattedName) : [...b.ayar.sadeceEtiketler, g.formattedName!] })}>{g.formattedName}</button>; })}</div>
      {b.ayar.sadeceEtiketler.length > 0 && <p className="ipucu">Etiket süzgeci açıkken Anahtar'da eklenen yeni kişiler Google'a gönderilmez (Google'da aynı kişinin ikinci kopyası açılmasın diye); düzeltmeler gitmeye devam eder.</p>}
    </>) : <label className="onay-satir"><input type="checkbox" checked={b.ayar.geriYaz} onChange={(e) => set({ geriYaz: e.target.checked })} /> Eşleşme skorlarını Notion'a geri yaz</label>}
  </details>;
}

function IzinPenceresi({ baslik, maddeler, kapat, onay }: { baslik: string; maddeler: string[]; kapat: () => void; onay: () => void }) {
  return <div className="perde" onClick={kapat}><div className="panel izin" role="dialog" aria-label={baslik} onClick={(e) => e.stopPropagation()}>
    <div className="ipucu">Demo — gerçek hesabınıza bağlanmaz</div>
    <h2>{baslik}</h2>
    <ul>{maddeler.map((m) => <li key={m}>{m}</li>)}</ul>
    <div className="satir"><button className="btn birincil" onClick={onay}>İzin ver ve içe aktar</button><button className="btn" onClick={kapat}>Vazgeç</button></div>
  </div></div>;
}

/** v3.21 — "Nasıl çalışır?" kural tablosu */
function Kurallar({ acik = false }: { acik?: boolean }) {
  return <details className="rapor-liste google-kurallar" open={acik}><summary>Çift yönlü eşitleme nasıl çalışır?</summary>
    <ul>{GOOGLE_KURALLARI.map(([ne, sonuc]) => <li key={ne}><b>{ne}</b><span>→ {sonuc}</span></li>)}</ul>
    <p className="ipucu">Toplu içe aktardığınız (Excel / WhatsApp) kişiler kendiliğinden Google'a gitmez; isterseniz Kişiler › Seç › "Google'a gönder" ile gönderirsiniz. Anahtar'daki notlar Google'a yazılmaz. Anahtar'da boşalttığınız bir alan Google'da silinmez.</p>
  </details>;
}

export function Baglantilar() {
  const { d, guncelle, bildir, git } = useDepo();
  const canli = CANLI.acik;
  const b = d.baglantilar ?? { google: bosGoogleBaglanti(), notion: bosBaglanti() };
  const gc = d.googleCanli ?? null;
  const [izin, setIzin] = useState<null | "google" | "notion">(null);
  const [yerelOrnek, setYerelOrnek] = useState(true);
  const [eslemeAcik, setEslemeAcik] = useState(false);
  const [cSecim, setCSecim] = useState<Set<string>>(new Set());
  const [mesgul, setMesgul] = useState<string | null>(null);   // canlı: süren işin metni ("İçe aktarılıyor…")
  const [koparOnay, setKoparOnay] = useState(false);
  const [uyari, setUyari] = useState<string | null>(null);     // izin ekranından dönüş sonucu
  const cAd = (sg: string) => (sg === "NOTION" ? "Notion" : "Google");
  const cakismalar = (d.cakismalar ?? []).filter((c) => notionAcik() || c.saglayici !== "NOTION");
  const gecmis = (d.senkronGecmisi ?? []).filter((c) => notionAcik() || c.saglayici !== "NOTION");
  const son = (s: "GOOGLE_KISILER" | "NOTION") => (d.senkronGecmisi ?? []).find((c) => c.saglayici === s);
  const gSon = son("GOOGLE_KISILER"), nSon = son("NOTION");
  const hata = (e: unknown) => bildir(String((e as Error)?.message ?? e));

  // ───── canlı: sunucuyla konuşan işler ─────
  const ilerlemeMetni = (o: GoogleOzet) => `İçe aktarılıyor… ${(o.yeni ?? 0) + (o.baglanan ?? 0) + (o.guncellenen ?? 0) + (o.degismeyen ?? 0)} kişi işlendi`;
  const canliEsitle = async (tam = false, ilk = false) => {
    setMesgul(ilk ? "Rehberiniz içe aktarılıyor…" : "Eşitleniyor…");
    try { const o = await googleEsitle(guncelle, { tam, ilerleme: (oz) => setMesgul(ilerlemeMetni(oz)) }); bildir(ozetCumlesi(o)); }
    catch (e) { bildir("Eşitlenemedi: " + String((e as Error)?.message ?? e)); await googleDurumYenile(guncelle).catch(() => {}); }
    finally { setMesgul(null); }
  };
  useEffect(() => {
    if (!canli) return;
    const donus = CANLI.googleDonus; CANLI.googleDonus = null;
    (async () => {
      try { await googleDurumYenile(guncelle); } catch (e) { hata(e); }
      if (donus === "ok") { bildir("Google hesabınız bağlandı"); await canliEsitle(false, true); }
      else if (donus) setUyari(donus === "iptal" ? "Google izin ekranında vazgeçtiniz; bağlantı kurulmadı." : donus === "yetki" ? "Bağlantıyı yalnızca ofis yöneticisi kurabilir." : donus === "yenileme-anahtari-yok" ? "Google kalıcı izin vermedi. myaccount.google.com › Güvenlik › Üçüncü taraf erişimi bölümünden Anahtar CRM'i kaldırıp yeniden bağlanın." : "Google bağlantısı tamamlanamadı. Lütfen yeniden deneyin.");
    })();
  }, []);

  // ───── ortak işler: demo → tarayıcıdaki benzetim · canlı → sunucu ─────
  const ayarYaz = (k: "google" | "notion") => (a: Partial<DemoBaglanti["ayar"]>) => {
    guncelle((x) => ({ ...x, baglantilar: { ...x.baglantilar, [k]: { ...x.baglantilar[k], ayar: { ...x.baglantilar[k].ayar, ...a } } } }));
    if (canli && k === "google") googleApi("/api/entegrasyon/ayarlar", { method: "PUT", json: { saglayici: "GOOGLE_KISILER", ayarlar: a } }).then(() => googleDurumYenile(guncelle)).catch(hata);
  };
  const calistir = (k: "google" | "notion", tetik: string) => {
    let ozet: GoogleOzet | null = null;
    guncelle((x) => {
      const y = { ...x, baglantilar: { ...x.baglantilar, [k]: { ...x.baglantilar[k], durum: "BAGLI" as const, hesap: k === "google" ? "ozgur@ornek.com" : "Gayrimenkul CRM" } } };
      const r = k === "google" ? demoGoogleSenkron(y, tetik) : demoNotionSenkron(y, tetik, yerelOrnek);
      ozet = r.calisma.ozet;
      return r.d;
    });
    bildir(k === "google" ? ozetCumlesi(ozet) : "Notion eşitlendi");
  };
  const googleEsitleTikla = () => (canli ? void canliEsitle() : calistir("google", "kullanici"));
  const googleBaglanTikla = () => { if (!canli) return setIzin("google"); setMesgul("Google'a yönlendiriliyorsunuz…"); googleBaglan().catch((e) => { setMesgul(null); hata(e); }); };
  const kopar = (k: "google" | "notion") => {
    setKoparOnay(false);
    if (canli && k === "google") { googleApi("/api/entegrasyon/google/kopar", { method: "POST", json: {} }).then(async (j) => { await googleDurumYenile(guncelle); await kisileriYenile(guncelle); bildir("Bağlantı kaldırıldı — kişileriniz hem burada hem Google'da duruyor. " + (j?.not ?? "")); }).catch(hata); return; }
    guncelle((x) => ({ ...x, baglantilar: { ...x.baglantilar, [k]: { ...(k === "google" ? bosGoogleBaglanti() : bosBaglanti()), ayar: x.baglantilar[k].ayar } }, ...(k === "google" ? { kisiler: x.kisiler.map((p) => (p.googleBekliyor || p.googleaGonder ? { ...p, googleBekliyor: null, googleaGonder: false } : p)) } : {}) }));
    bildir("Bağlantı kaldırıldı — kişiler ve kayıtlar Anahtar'da kalır");
  };
  const cakismaCoz = (ids: string[], secim: "YEREL" | "UZAK") => {
    if (canli) { googleApi("/api/senkron/cakismalar", { method: "POST", json: { ids, secim } }).then(async () => { await kisileriYenile(guncelle); await googleDurumYenile(guncelle); if (secim === "YEREL") void googleEsitle(guncelle).catch(() => {}); }).catch(hata); }
    else guncelle((x) => demoCakismalariCoz(x, ids, secim));
  };
  const topluCoz = (secim: "YEREL" | "UZAK") => { const ids = [...cSecim].filter((id) => cakismalar.some((c) => c.id === id)); cakismaCoz(ids, secim); setCSecim(new Set()); bildir(`${ids.length} çakışma çözüldü — ${secim === "YEREL" ? "Anahtar'daki değerler korundu, Google'a da yazılacak" : "Google'daki değerler alındı"}`); };
  const haricGetir = () => {
    if (canli) { setMesgul("Silinenler yeniden getiriliyor…"); googleApi("/api/entegrasyon/google/haric", { method: "DELETE" }).then(() => canliEsitle()).catch((e) => { setMesgul(null); hata(e); }); return; }
    guncelle((x) => demoGoogleSenkron(demoGoogleHaricTemizle(x), "kullanici").d); bildir("Silinen kişiler Google'dan yeniden getirildi");
  };
  const notionSema = (t: keyof typeof NOTION_TUR1) => Object.fromEntries(Object.entries(NOTION_TUR1[t][0].properties).map(([a, v]) => [a, { type: v.type }]));

  // ───── Google kartı için sayılar (demo: tarayıcı durumu · canlı: sunucu) ─────
  const gBagli = canli ? gc?.durum === "BAGLI" : b.google.durum === "BAGLI";
  const googleKisi = canli ? (gc?.bagliKisi ?? 0) : d.kisiler.filter((k) => k.googleResourceName).length;
  const bekleyen = canli ? (gc?.bekleyen ?? 0) : d.kisiler.filter((k) => !k.googleResourceName && (k.googleaGonder || k.googleBekliyor) && k.telefon).length + d.kisiler.filter((k) => k.googleResourceName && k.googleBekliyor).length;
  const haricSayi = canli ? (gc?.haric ?? 0) : (d.googleHaric ?? []).length;
  const yetkili = canli ? !!gc?.yetkili : true;
  const yazmaYok = canli && gc?.ayarlar?.yazmaIzni === false;
  const notionKayit = d.kayitlar.filter((k) => k.notionId).length;

  return <div className="yigin">
    <div><h2>Bağlantılar</h2><p className="ipucu sayfa-aciklama">{notionAcik() ? "Notion tablolarınız ve Google Kişiler'iniz uygulamayla eşitlenir." : "Telefon rehberiniz (Google Kişiler) Anahtar CRM ile çift yönlü eşitlenir."}</p></div>
    {!canli && <Bilgi id="demo-baglanti">Demo: gerçek hesabınıza bağlanmaz. Örnek bir Google rehberiyle, canlı uygulamadaki eşitleme kodunun aynısı çalışır; aşağıdaki "Google rehberi (benzetim)" kutusunda Google tarafında ne olduğunu görürsünüz.</Bilgi>}
    {uyari && <div className="uyari-kutu" role="alert">{uyari} <button className="btn kucuk" onClick={() => setUyari(null)}>Tamam</button></div>}

    {notionAcik() && <>
    <section className="kart baglanti-kart">
      <div className="bk-bas"><span className="bk-logo notion" aria-hidden="true">N</span><div className="bk-ad"><h3>Notion</h3><span className="ipucu">Gayrimenkul CRM · 3 tablo</span></div>
        {b.notion.durum === "BAGLI" ? <Pill ton="iyi">Bağlı</Pill> : <Pill>Bağlı değil</Pill>}</div>
      {b.notion.durum !== "BAGLI" ? <>
        <p className="bk-metin">💯 CRM Listesi (talepler), Mülkler ve Satış Tüneli (portföyler) ve Müşteri-Yatırımcılar-Kişiler içe alınır. Kişi kartında "aradığı mülk" yazan ama talebi olmayan kişilerden talep oluşturulur. Zaten elle girdiğiniz bir kayıt Notion'da da varsa ikinci kopya açılmaz, ikisi bağlanır.</p>
        <div className="satir sar"><button className="btn birincil" onClick={() => setIzin("notion")}>Notion'u bağla</button><button className="btn" onClick={() => setEslemeAcik(!eslemeAcik)}>{eslemeAcik ? "Alan eşlemesini gizle" : "Alan eşlemesini gör"}</button></div>
      </> : <>
        <div className="bk-sayilar"><div><b>{notionKayit}</b><span>Notion'a bağlı kayıt</span></div><div><b>{d.kisiler.filter((k) => k.notionId).length}</b><span>kişi</span></div><div><b>{saat(b.notion.sonSenkron)}</b><span>son senkron</span></div></div>
        {b.notion.tur === 1 && <label className="onay-satir ipucu"><input type="checkbox" checked={yerelOrnek} onChange={(e) => setYerelOrnek(e.target.checked)} /> Çakışma örneği: önce Anahtar'da Hacıaliler deposunun fiyatını 290.000 yap (Notion'da aynı anda 320.000 yapılmış olacak)</label>}
        <div className="satir sar"><button className="btn birincil" onClick={() => calistir("notion", "kullanici")}><Ikon ad="baglanti" boyut={16} /> Şimdi senkronize et</button><button className="btn" onClick={() => setEslemeAcik(!eslemeAcik)}>Alan eşlemesi</button><button className="btn" onClick={() => kopar("notion")}>Bağlantıyı kaldır</button></div>
        {b.notion.tur === 1 && <p className="ipucu">Sıradaki senkronda örnek olarak Notion'da şunlar değişmiş olacak: Lara talebinin bütçesi 150.000, Kepez deposu 200.000, Hacıaliler 320.000, Topallı dükkanı çöpe atıldı.</p>}
        <Ayarlar b={b.notion} set={ayarYaz("notion")} google={false} />
      </>}
      {eslemeAcik && <div className="esleme">{(["TALEP", "PORTFOY", "KISI"] as const).map((t) => { const r = alanRaporu(NOTION_TABLOLARI[t].alan as any, notionSema(t), NOTION_TABLOLARI[t].okunmayan as any); return <div key={t}>
        <div className="ust-etiket">{NOTION_TABLOLARI[t].ad}</div>
        <div className="cip-satir">{r.eslesen.map((a) => <span key={a.anahtar} className={cx("cip", !a.var && "c-kotu")}>{a.var ? "✓" : "✗"} {a.ad || "Başlık"}</span>)}{r.okunmayan.map((a) => <span key={a.ad} className="cip c-eksik" title={a.neden}>– {a.ad}</span>)}</div></div>; })}
        <p className="ipucu">✓ okunan alan · – bilerek okunmayan (dosya/fotoğraf, ayrı tablo). Bölge seçeneklerinin tamamı konum sözlüğüyle çözülür ("Murtpaşa" yazımı dahil).</p></div>}
      {nSon && <Rapor c={nSon} />}
    </section>

    </>}

    {/* ───── Google Kişiler ───── */}
    <section className="kart baglanti-kart" id="google-kart">
      <div className="bk-bas"><span className="bk-logo google" aria-hidden="true">G</span><div className="bk-ad"><h3>Google Kişiler</h3><span className="ipucu">{(canli ? gc?.hesap : b.google.hesap) ?? "Telefon rehberiniz"}</span></div>
        {gBagli ? <Pill ton="iyi">Bağlı</Pill> : canli && gc?.durum === "YENIDEN_YETKI" ? <Pill ton="kotu">Yeniden bağlanın</Pill> : <Pill>Bağlı değil</Pill>}</div>

      {canli && !gc ? <p className="ipucu">Bağlantı durumu okunuyor…</p>
      : canli && !gc!.hazir ? <>
        <p className="bk-metin">Google bağlantısı bu kurulumda henüz açılmamış. {CANLI.oturum?.bilgi?.kullanici.rol === "PLATFORM_YONETICISI" ? "Aşağıdaki tek seferlik kurulumu yapınca tüm ofisler \"Google ile bağlan\" düğmesini kullanabilir." : "Platform yöneticinize haber verin."}</p>
      </>
      : !gBagli ? <>
        {canli && gc?.durum === "YENIDEN_YETKI" && <div className="uyari-kutu">Google erişimi sona ermiş ya da Google hesabınızdan kaldırılmış. Eşitleme durdu; kişileriniz yerinde. Aşağıdaki düğmeyle yeniden bağlanın.</div>}
        <p className="bk-metin">Telefon rehberiniz ile Anahtar CRM aynı kalsın: telefonunuza kaydettiğiniz kişi buraya düşer, burada eklediğiniz kişi telefonunuza gider. WhatsApp'tan yazan numara anında adıyla tanınır; aynı numara zaten kayıtlıysa ikinci kişi açılmaz.</p>
        <ul className="google-ozet">{GOOGLE_KURALLARI.map(([ne, sonuc]) => <li key={ne}><span>{ne}</span><b>{sonuc}</b></li>)}</ul>
        <div className="satir sar">
          <button className="btn birincil google-btn" disabled={!yetkili || !!mesgul} onClick={googleBaglanTikla}><span className="g-harf" aria-hidden="true">G</span> {mesgul ?? "Google ile bağlan"}</button>
          {!yetkili && <span className="ipucu">Bağlantıyı ofis yöneticiniz kurar.</span>}
        </div>
        <p className="ipucu">Düğmeye basınca Google'ın kendi izin ekranı açılır; hesabınızı seçip "İzin ver" demeniz yeterli. Şifreniz Anahtar CRM'e verilmez; izni dilediğiniz an buradan ya da Google hesabınızdan kaldırabilirsiniz.</p>
      </> : <>
        <div className="bk-sayilar"><div><b>{googleKisi}</b><span>Google'a bağlı kişi</span></div><div><b>{bekleyen}</b><span>Google'a gönderilecek</span></div><div><b>{saat(canli ? gc?.sonSenkron ?? null : b.google.sonSenkron)}</b><span>son eşitleme</span></div></div>
        {mesgul && <div className="bilgi-kutu" role="status" aria-live="polite">{mesgul} <span className="ipucu">Bu ekranı kapatabilirsiniz; içe aktarma arka planda sürer.</span></div>}
        {canli && gc?.sonHata && !mesgul && <div className="uyari-kutu">Son eşitlemede sorun: {gc.sonHata}</div>}
        <div className="satir sar">
          <button className="btn birincil" disabled={!!mesgul || !yetkili} onClick={googleEsitleTikla}><Ikon ad="baglanti" boyut={16} /> Şimdi eşitle{!canli && (d.googleBekleyen ?? []).length ? ` (${d.googleBekleyen!.length} yeni)` : ""}</button>
          {!canli && <button className="btn" onClick={() => { let ad = ""; guncelle((x) => { const r = demoGoogleKisiKaydet(x); ad = r.ad; return r.d; }); bildir(`Telefonda Google'a kaydedildi: ${ad || "yeni kişi"} — "Şimdi eşitle" deyin (canlıda en geç 15 dakikada kendiliğinden gelir)`); }}>📱 Telefonda Google'a kişi kaydet (benzetim)</button>}
          <button className="btn" onClick={() => git({ ad: "kisiler" })}>Kişileri gör</button>
          {yetkili && (!koparOnay ? <button className="btn" disabled={!!mesgul} onClick={() => setKoparOnay(true)}>Bağlantıyı kaldır</button>
            : <span className="satir sar"><span className="ipucu">Eşitleme durur; kişiler iki tarafta da kalır.</span><button className="btn tehlike" onClick={() => kopar("google")}>Evet, kaldır</button><button className="btn" onClick={() => setKoparOnay(false)}>Vazgeç</button></span>)}
        </div>
        {!canli && b.google.tur === 1 && <p className="ipucu">Sıradaki eşitlemede örnek olarak Google'da şunlar değişmiş olacak: Kemal Usta'nın şirketi güncellendi, "Annem" silindi, yeni bir emlakçı eklendi. Silinen kişi Anahtar'da silinmez; yalnızca Google bağı kopar.</p>}
        <label className="onay-satir cift-yon"><input type="checkbox" checked={b.google.ayar.googleYaz} disabled={!yetkili || yazmaYok} onChange={(e) => ayarYaz("google")({ googleYaz: e.target.checked })} /> <span><b>Çift yönlü</b> — Anahtar'da elle eklediğim ve düzelttiğim kişiler Google rehberime de yazılsın</span></label>
        {yazmaYok && <p className="ipucu">Google, kişileri düzenleme iznini vermedi; şu an yalnızca Google → Anahtar çalışıyor. Çift yönlü için "Bağlantıyı kaldır" deyip yeniden bağlanın ve izin ekranında tüm kutuları işaretli bırakın.</p>}
        {haricSayi > 0 && <div className="haric-satir"><span><b>{haricSayi} kişi</b> Anahtar'dan silindi: Google rehberinizde duruyor, buraya geri gelmeyecek.</span>{yetkili && <button className="btn kucuk" disabled={!!mesgul} onClick={haricGetir}>Silinenleri yeniden getir</button>}</div>}
        <Kurallar />
        {yetkili && <Ayarlar b={b.google} set={ayarYaz("google")} google etiketSecimi={!canli} />}
      </>}
      {gSon && (gBagli || !canli) && <Rapor c={gSon} />}
    </section>

    {/* ───── Demo: Google tarafında ne oldu? ───── */}
    {!canli && b.google.durum === "BAGLI" && <section className="kart google-rehber">
      <h3>Google rehberi (benzetim)</h3>
      <p className="ipucu">Canlıda burası telefonunuzdaki Google Kişiler'in kendisidir. Demoda, Anahtar'dan Google'a yazılanları ve Google'da duran kişileri buradan izlersiniz.</p>
      {(d.googleGiden ?? []).length === 0 && (d.googleHaric ?? []).length === 0 && <p className="bos">Henüz Anahtar'dan Google'a bir şey yazılmadı. Kişiler'de "+ Yeni kişi" ile birini ekleyin ya da Google'dan gelen bir kişinin adını düzeltin, sonra "Şimdi eşitle" deyin.</p>}
      {(d.googleGiden ?? []).length > 0 && <ul className="gecmis">{d.googleGiden!.map((g, i) => <li key={i}><span className="g-ikon google">G</span><span>{saat(g.tarih)}</span><span className="ipucu">{g.islem === "EKLENDI" ? "Google'a eklendi" : "Google'da güncellendi"}</span><span><b>{g.ad}</b>{g.telefon ? ` · ${telYaz(g.telefon)}` : ""}{g.alanlar?.length ? ` · ${g.alanlar.map((a) => ALAN_ETIKET[a] ?? a).join(", ")}` : ""}</span></li>)}</ul>}
      {(d.googleHaric ?? []).length > 0 && <details className="rapor-liste" open><summary>Anahtar'dan silindi — Google'da DURUYOR ({d.googleHaric!.length})</summary><ul>{d.googleHaric!.map((h, i) => <li key={i}><b>{h.ad}</b><span>Google rehberinde duruyor · Anahtar'a geri gelmeyecek</span></li>)}</ul></details>}
    </section>}

    {/* ───── Çakışmalar ───── */}
    {cakismalar.length > 0 && <section className="kart cakisma-kart">
      <h3>Çakışmalar ({cakismalar.length})</h3>
      <p className="ipucu">Aynı alan hem burada hem Google'da farklı değiştirilmiş. Siz seçene kadar Anahtar'daki değer korunur ve Google'a yazılmaz.</p>
      <div className="toplu-cubuk">
        <label className="onay-satir"><input type="checkbox" checked={cSecim.size > 0 && cSecim.size === cakismalar.length} ref={(el) => { if (el) el.indeterminate = cSecim.size > 0 && cSecim.size < cakismalar.length; }} onChange={(e) => setCSecim(e.target.checked ? new Set(cakismalar.map((c) => c.id)) : new Set())} /> Tümünü seç ({cakismalar.length})</label>
        <button className="btn kucuk" disabled={!cSecim.size} onClick={() => topluCoz("YEREL")}>Seçilenlerde Anahtar'daki kalsın ({cSecim.size})</button>
        <button className="btn kucuk" disabled={!cSecim.size} onClick={() => topluCoz("UZAK")}>Seçilenlerde {[...new Set(cakismalar.filter((c) => cSecim.has(c.id)).map((c) => cAd(c.saglayici)))].join("/") || (notionAcik() ? "kaynak" : "Google")}'dakini al ({cSecim.size})</button>
      </div>
      {cakismalar.map((c) => <div key={c.id} className={cx("cakisma", cSecim.has(c.id) && "secili")}>
        <div className="satir-ara"><label className="onay-satir"><input type="checkbox" aria-label="Seç" checked={cSecim.has(c.id)} onChange={(e) => setCSecim((x) => { const n = new Set(x); e.target.checked ? n.add(c.id) : n.delete(c.id); return n; })} /><b>{c.baslik}</b></label><span className="ipucu">{ALAN_ETIKET[c.alan] ?? c.alan} · {cAd(c.saglayici)}</span></div>
        <div className="iki-deger">
          <button className="deger yerel" onClick={() => { if (canli) cakismaCoz([c.id], "YEREL"); else guncelle((x) => demoCakismaCoz(x, c.id, "YEREL")); bildir(c.saglayici === "NOTION" ? "Uygulamadaki değer korundu" : "Anahtar'daki değer korundu — Google'a da yazılacak"); }}><small>Anahtar'daki</small><b>{degerYaz(c.alan, c.yerel)}</b><span>Bu kalsın</span></button>
          <button className="deger uzak" onClick={() => { if (canli) cakismaCoz([c.id], "UZAK"); else guncelle((x) => demoCakismaCoz(x, c.id, "UZAK")); bildir(`${cAd(c.saglayici)}'daki değer alındı`); }}><small>{cAd(c.saglayici)}'daki</small><b>{degerYaz(c.alan, c.uzak)}</b><span>Bunu al</span></button>
        </div>
        {c.onceki != null && <div className="ipucu">Son eşitlemedeki değer: {degerYaz(c.alan, c.onceki)}</div>}
      </div>)}
    </section>}

    {gecmis.length > 0 && <section className="kart"><h3>Eşitleme geçmişi</h3>
      <ul className="gecmis">{gecmis.map((c) => <li key={c.id}><span className={cx("g-ikon", c.saglayici === "NOTION" ? "notion" : "google")}>{c.saglayici === "NOTION" ? "N" : "G"}</span><span>{saat(c.tarih)}</span><span className="ipucu">{c.tetik === "ilk" ? "İlk içe aktarma" : c.tetik === "kullanici" ? "Elle" : "Otomatik"}</span><span>{c.ozet.hata ? "tamamlanamadı" : ["yeni", "guncellenen", "baglanan", "gonderilenYeni", "gonderilenGuncel", "cakisma"].filter((k) => c.ozet[k]).map((k) => `${c.ozet[k]} ${kucuk(OZET_AD[k] ?? k)}`).join(", ") || "değişiklik yok"}</span></li>)}</ul></section>}

    {/* ───── Kurulum: yalnızca platform yöneticisi (canlı) ya da demo ───── */}
    {(!canli || CANLI.oturum?.bilgi?.kullanici.rol === "PLATFORM_YONETICISI") && <details className="kart kurulum" open={canli && !!gc && !gc.hazir}><summary>Platform kurulumu — bir kez yapılır (yaklaşık 15 dk){canli && gc?.hazir ? " · tamamlandı ✓" : ""}</summary>
      <p className="ipucu">Bu adımları yalnızca platform yöneticisi, bir kez yapar. Sonrasında her ofis yalnızca "Google ile bağlan" düğmesine basar.</p>
      <ol>
        <li><b>Google Cloud:</b> console.cloud.google.com → yeni proje ("Anahtar CRM") → "People API"yi etkinleştirin.</li>
        <li><b>İzin ekranı:</b> "OAuth consent screen" → Harici (External) → uygulama adı ve e-postanız → kapsam olarak <code>…/auth/contacts</code> ekleyin → "Publish app / In production".</li>
        <li><b>Kimlik bilgisi:</b> Credentials → "OAuth client ID" → Web application → "Authorized redirect URIs" alanına şunu yapıştırın: <code style={{ wordBreak: "break-all" }}>{(typeof location !== "undefined" && canli ? location.origin : "https://ADRESINIZ")}/api/entegrasyon/google/geri-donus</code></li>
        <li><b>Cloudflare:</b> anahtarcrm › Settings › Variables and Secrets → <code>GOOGLE_CLIENT_ID</code> ve <code>GOOGLE_CLIENT_SECRET</code> (Secret) olarak ekleyin, yayınlayın.</li>
        <li>Bu ekranı yenileyin: "Google ile bağlan" düğmesi açılır. Otomatik eşitleme (15 dakikada bir) ek ayar istemez.</li>
      </ol>
      <p className="ipucu">Not: Google, kişilere erişen uygulamaları "hassas" sayar. Doğrulama başvurusu yapılana kadar izin ekranında "Google bu uygulamayı doğrulamadı" uyarısı çıkar ("Gelişmiş → devam et" ile geçilir) ve en fazla 100 Google hesabı bağlanabilir. Başka ofislere açmadan önce Google doğrulamasına başvurun (gizlilik politikası sayfası ister). İzin ekranı "Testing"de kalırsa Google bağlantıyı 7 günde bir düşürür.</p>
    </details>}

    {izin && <IzinPenceresi baslik={izin === "google" ? "Google Kişiler erişimi" : "Notion erişimi"}
      maddeler={izin === "google" ? ["Kişilerinizi ve etiketlerinizi görme", "Kişi ekleme ve düzenleme (Anahtar'da elle eklediğiniz / düzelttiğiniz kişiler için)", "E-posta adresinizi görme (hangi hesabın bağlı olduğunu göstermek için)", "Google'daki kişilerinizi SİLMEZ"] : ["Paylaştığınız 3 tabloyu okuma", "Talep ve portföy sayfalarına 5 uygulama alanı ekleyip yalnızca onları güncelleme (Eşleşme Skoru, Eşleşme Sayısı, En İyi Eşleşme, Uygulama Linki, Son Senkron)", "Sizin alanlarınızı değiştirmez, sayfa silmez"]}
      kapat={() => setIzin(null)} onay={() => { const k = izin; setIzin(null); calistir(k, "ilk"); }} />}
  </div>;
}
