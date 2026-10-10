/**
 * Anahtar CRM v3.23 · 10 Ekim 2026
 * YÖNETİM ekranı — kullanıcılar, davetler, ofisler (çok ofisli altyapının arayüzü).
 *
 *  - Ofis yöneticisi: kendi ofisinin kullanıcıları (rol, aç/kapat) ve davet bağlantıları.
 *  - Platform yöneticisi (Özgür): ek olarak tüm ofisler — yeni ofis, plan, 30 gün Pro deneme, askıya alma.
 *  - Danışman: bu ekranı göremez (yetki: ofis.kullanicilar).
 *
 * Canlıda veriler /api/kullanicilar, /api/davet, /api/platform/ofisler uçlarından gelir.
 * Demoda veritabanı yoktur: aynı ekran örnek verilerle çalışır ve üstteki "Rol olarak görüntüle"
 * ile yönetici / danışman, Ücretsiz / Pro görünümleri denenebilir.
 */
import React, { useContext, useEffect, useState } from "react";
import { C, Kopyala } from "./ortak";
import { CANLI } from "./depo";
import { PLANLAR, ROL_ETIKETLERI, YETKILER, type Plan } from "../src/lib/guvenlik/yetki";

type Rol = keyof typeof ROL_ETIKETLERI;
interface Kullanici { id: string; eposta: string; adSoyad?: string | null; rol: Rol; aktif: boolean; sonGiris?: string | null }
interface Davet { id: string; eposta?: string | null; rol: Rol; durum: "BEKLIYOR" | "KULLANILDI" | "IPTAL"; sonKullanma: string; kullananEposta?: string | null }
interface Ofis { id: string; ad: string; durum: "AKTIF" | "ASKIDA"; plan: Plan; sinirsiz: boolean; denemeBitis?: string | null; sehir?: string | null; _count: { kullanicilar: number; kayitlar: number } }

// ───────────── Demo: örnek veri ve "rol olarak görüntüle" ─────────────
const gun = (n: number) => new Date(Date.now() + n * 864e5).toISOString();
export const DEMO_YONETIM = {
  rol: "PLATFORM_YONETICISI" as Rol,
  plan: "PRO" as Plan,
  kullanicilar: [
    { id: "k1", eposta: "ozgur@ozyurtlar.com", adSoyad: "Özgür Özyurt", rol: "PLATFORM_YONETICISI", aktif: true, sonGiris: gun(0) },
    { id: "k2", eposta: "asistan@ozyurtlar.com", adSoyad: "Ofis asistanı", rol: "DANISMAN", aktif: true, sonGiris: gun(-1) },
  ] as Kullanici[],
  davetler: [{ id: "d1", eposta: "yeni.danisman@ornek.com", rol: "DANISMAN", durum: "BEKLIYOR", sonKullanma: gun(12) }] as Davet[],
  ofisler: [
    { id: "o1", ad: "Özyurtlar Gayrimenkul", durum: "AKTIF", plan: "PRO", sinirsiz: true, sehir: "Antalya", _count: { kullanicilar: 2, kayitlar: 18 } },
    { id: "o2", ad: "Lara Emlak (örnek)", durum: "AKTIF", plan: "UCRETSIZ", sinirsiz: false, denemeBitis: gun(21), sehir: "Antalya", _count: { kullanicilar: 1, kayitlar: 7 } },
    { id: "o3", ad: "Konyaaltı Gayrimenkul (örnek)", durum: "AKTIF", plan: "UCRETSIZ", sinirsiz: false, sehir: "Antalya", _count: { kullanicilar: 1, kayitlar: 0 } },
  ] as Ofis[],
};

/** Menüde "Yönetim" görünsün mü? Canlıda oturumdaki yetkiden, demoda seçili rolden. */
export function yonetimGorunur(): boolean {
  if (!CANLI.acik) return true; // demoda rol değiştirip geri dönebilmek için hep görünür
  return (CANLI.oturum?.bilgi?.yetkiler ?? []).includes("ofis.kullanicilar");
}

async function istek<T>(yol: string, init?: { method?: string; json?: unknown }): Promise<T> {
  const r = await CANLI.api!(yol, init);
  const j: any = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j?.mesaj ?? `Sunucu ${r.status}`);
  return j as T;
}

const tarih = (s?: string | null) => (s ? new Date(s).toLocaleDateString("tr-TR", { day: "numeric", month: "short", year: "numeric" }) : "—");
const davetBaglantisi = (kod: string) => `${location.origin}/?davet=${encodeURIComponent(kod)}`;

export function Yonetim() {
  const { bildir } = useContext(C);
  const canli = CANLI.acik;
  const [demoRol, setDemoRol] = useState<Rol>(DEMO_YONETIM.rol);
  const [demoPlan, setDemoPlan] = useState<Plan>(DEMO_YONETIM.plan);
  const rol: Rol = canli ? ((CANLI.oturum?.bilgi?.kullanici.rol as Rol) ?? "DANISMAN") : demoRol;
  const yetkiler: readonly string[] = canli ? (CANLI.oturum?.bilgi?.yetkiler ?? []) : YETKILER[demoRol];
  const plan: Plan = canli ? ((CANLI.oturum?.bilgi?.plan.kod as Plan) ?? "UCRETSIZ") : demoPlan;
  const ofisAdi = canli ? CANLI.oturum?.bilgi?.ofis?.ad : "Özyurtlar Gayrimenkul";

  const [kullanicilar, setKullanicilar] = useState<Kullanici[]>(canli ? [] : DEMO_YONETIM.kullanicilar);
  const [davetler, setDavetler] = useState<Davet[]>(canli ? [] : DEMO_YONETIM.davetler);
  const [ofisler, setOfisler] = useState<Ofis[]>(canli ? [] : DEMO_YONETIM.ofisler);
  const [hata, setHata] = useState<string>();
  const [yeniKod, setYeniKod] = useState<{ kod: string; ofis?: string }>();
  const [dEposta, setDEposta] = useState(""), [dRol, setDRol] = useState<Rol>("DANISMAN"), [dOfis, setDOfis] = useState<string>("");
  const [yOfis, setYOfis] = useState("");

  const platform = yetkiler.includes("platform.ofisler");
  const yukle = async () => {
    if (!canli) return;
    setHata(undefined);
    try {
      const [k, d] = await Promise.all([istek<Kullanici[]>("/api/kullanicilar"), istek<Davet[]>("/api/davet")]);
      setKullanicilar(k); setDavetler(d);
      if (platform) setOfisler(await istek<Ofis[]>("/api/platform/ofisler"));
    } catch (e: any) { setHata(e.message); }
  };
  useEffect(() => { if (yetkiler.includes("ofis.kullanicilar")) void yukle(); }, [rol]);

  const calis = async (is: () => Promise<void>, ok?: string) => { setHata(undefined); try { await is(); if (ok) bildir(ok); } catch (e: any) { setHata(e?.message ?? "Bir sorun oluştu"); } };

  const kullaniciDegis = (k: Kullanici, veri: Partial<Kullanici>) => calis(async () => {
    if (canli) await istek(`/api/kullanicilar?id=${k.id}`, { method: "PATCH", json: veri });
    setKullanicilar((l) => l.map((x) => (x.id === k.id ? { ...x, ...veri } : x)));
  }, "Kullanıcı güncellendi");

  const davetUret = () => calis(async () => {
    let kod: string;
    if (canli) kod = (await istek<{ kod: string }>("/api/davet", { method: "POST", json: { eposta: dEposta || undefined, rol: dRol, ofisId: dOfis || undefined } })).kod;
    else kod = "DEMO-" + Math.random().toString(36).slice(2, 10).toUpperCase();
    setYeniKod({ kod, ofis: dOfis ? ofisler.find((o) => o.id === dOfis)?.ad : undefined });
    if (canli) await yukle();
    else setDavetler((l) => [{ id: kod, eposta: dEposta || null, rol: dRol, durum: "BEKLIYOR", sonKullanma: gun(14) }, ...l]);
    setDEposta("");
  });

  const davetIptal = (d: Davet) => calis(async () => {
    if (canli) await istek(`/api/davet?id=${d.id}`, { method: "DELETE" });
    setDavetler((l) => l.map((x) => (x.id === d.id ? { ...x, durum: "IPTAL" } : x)));
  }, "Davet iptal edildi");

  const ofisDegis = (o: Ofis, veri: { plan?: Plan; denemeGun?: number; durum?: "AKTIF" | "ASKIDA" }, mesaj: string) => calis(async () => {
    if (canli) { await istek(`/api/platform/ofisler?id=${o.id}`, { method: "PATCH", json: veri }); setOfisler(await istek<Ofis[]>("/api/platform/ofisler")); }
    else setOfisler((l) => l.map((x) => (x.id === o.id ? { ...x, ...(veri.plan ? { plan: veri.plan } : {}), ...(veri.durum ? { durum: veri.durum } : {}), ...(veri.denemeGun != null ? { denemeBitis: veri.denemeGun ? gun(veri.denemeGun) : null } : {}) } : x)));
  }, mesaj);

  const ofisAc = () => calis(async () => {
    const ad = yOfis.trim(); if (ad.length < 2) throw new Error("Ofis adı en az 2 harf olmalı");
    let id: string;
    if (canli) { id = (await istek<{ id: string }>("/api/platform/ofisler", { method: "POST", json: { ad, sehir: "Antalya" } })).id; setOfisler(await istek<Ofis[]>("/api/platform/ofisler")); }
    else { id = "o" + Date.now(); setOfisler((l) => [{ id, ad, durum: "AKTIF", plan: "UCRETSIZ", sinirsiz: false, sehir: "Antalya", _count: { kullanicilar: 0, kayitlar: 0 } }, ...l]); }
    setYOfis(""); setDOfis(id); setDRol("OFIS_YONETICISI");
    bildir(`${ad} açıldı — aşağıdan ofis yöneticisi için davet bağlantısı üretin`);
  });

  const rolSecenekleri: Rol[] = platform ? ["DANISMAN", "OFIS_YONETICISI", "PLATFORM_YONETICISI"] : ["DANISMAN", "OFIS_YONETICISI"];
  const sinir = PLANLAR[plan];

  return <div className="yigin">
    <h2>Yönetim</h2>
    {!canli && <section className="kart yigin" aria-label="Demo görünümü">
      <b>Demo: rol olarak görüntüle</b>
      <p className="ipucu">Canlıda bu seçim yoktur; girişteki e-postanın rolü kullanılır. Burada her rolün ne gördüğünü deneyin.</p>
      <div className="satir sar">{(["PLATFORM_YONETICISI", "OFIS_YONETICISI", "DANISMAN"] as Rol[]).map((r) =>
        <button key={r} className={"btn kucuk" + (demoRol === r ? " birincil" : "")} onClick={() => { DEMO_YONETIM.rol = r; setDemoRol(r); }}>{ROL_ETIKETLERI[r]}</button>)}</div>
      <div className="satir sar">{(["UCRETSIZ", "PRO", "PRO_PLUS"] as Plan[]).map((p) =>
        <button key={p} className={"btn kucuk" + (demoPlan === p ? " birincil" : "")} onClick={() => { DEMO_YONETIM.plan = p; setDemoPlan(p); }}>Plan: {PLANLAR[p].etiket}</button>)}</div>
    </section>}

    <section className="kart yigin">
      <div className="satir-ara"><b>{ofisAdi ?? "Ofisiniz"}</b><span className="ipucu">{ROL_ETIKETLERI[rol]} · {sinir.etiket} plan</span></div>
      <ul className="ipucu" style={{ margin: 0, paddingLeft: 18 }}>
        <li>Fotoğraf: {sinir.fotoBasinaKayit ? `portföy başına ${sinir.fotoBasinaKayit}` : "kapalı (Pro'da açılır)"}</li>
        <li>Kullanıcı: en çok {sinir.kullanici}</li>
        <li>Günlük yapay zekâ yorumu: {sinir.gunlukAi}</li>
        <li>Google Kişiler eşitlemesi: {sinir.entegrasyon ? "açık" : "kapalı"} · Portföy föyü (PDF/JPG): {sinir.paylasimFoyu ? "açık" : "kapalı"}</li>
        <li>Ofisler arası ortak havuz: {sinir.ortakHavuz ? "hak tanımlı (özellik yakında)" : "Pro+ ile"}</li>
      </ul>
    </section>

    {hata && <div className="hata-kutu" role="alert">{hata}</div>}

    {!yetkiler.includes("ofis.kullanicilar") ? <section className="kart"><p>Bu ekran yalnızca ofis yöneticileri içindir. Danışman olarak kendi talep, portföy ve kişilerinizi ve ofisin ortak portföyünü görürsünüz.</p></section> : <>
      {platform && <section className="kart yigin">
        <h3>Ofisler</h3>
        <p className="ipucu">Tüm ofisler. Yeni ofis açın, Pro deneme verin ya da erişimi askıya alın. Ofisler birbirinin verisini göremez.</p>
        <div className="satir sar"><input aria-label="Yeni ofis adı" placeholder="Yeni ofis adı (ör. Lara Emlak)" value={yOfis} onChange={(e) => setYOfis(e.target.value)} style={{ flex: 1, minWidth: 180 }} /><button className="btn birincil" onClick={ofisAc}>+ Ofis aç</button></div>
        {ofisler.map((o) => {
          const deneme = !!o.denemeBitis && new Date(o.denemeBitis) > new Date();
          return <div key={o.id} className="kart yigin" style={{ padding: 12 }}>
            <div className="satir-ara"><b>{o.ad}</b><span className="ipucu">{o.sinirsiz ? "Sınırsız" : deneme ? `Pro deneme · ${tarih(o.denemeBitis)}'e kadar` : PLANLAR[o.plan].etiket}{o.durum === "ASKIDA" ? " · ASKIDA" : ""}</span></div>
            <span className="ipucu">{o._count.kullanicilar} kullanıcı · {o._count.kayitlar} kayıt{o.sehir ? ` · ${o.sehir}` : ""}</span>
            {!o.sinirsiz && <div className="satir sar">
              <button className="btn kucuk" onClick={() => ofisDegis(o, { denemeGun: 30 }, `${o.ad}: 30 gün Pro deneme verildi`)}>30 gün Pro deneme</button>
              <select aria-label={`${o.ad} planı`} value={o.plan} onChange={(e) => ofisDegis(o, { plan: e.target.value as Plan, denemeGun: 0 }, `${o.ad}: plan ${PLANLAR[e.target.value as Plan].etiket}`)}>
                {(["UCRETSIZ", "PRO", "PRO_PLUS"] as Plan[]).map((p) => <option key={p} value={p}>{PLANLAR[p].etiket}</option>)}
              </select>
              <button className="btn kucuk" onClick={() => ofisDegis(o, { durum: o.durum === "AKTIF" ? "ASKIDA" : "AKTIF" }, o.durum === "AKTIF" ? `${o.ad} askıya alındı` : `${o.ad} yeniden açıldı`)}>{o.durum === "AKTIF" ? "Askıya al" : "Yeniden aç"}</button>
              <button className="btn kucuk" onClick={() => { setDOfis(o.id); setDRol("OFIS_YONETICISI"); document.getElementById("yon-davet")?.scrollIntoView({ behavior: "smooth" }); }}>Bu ofise davet</button>
            </div>}
          </div>;
        })}
      </section>}

      <section className="kart yigin">
        <h3>Kullanıcılar</h3>
        {kullanicilar.length === 0 && <p className="ipucu">Yükleniyor…</p>}
        {kullanicilar.map((k) => <div key={k.id} className="satir-ara sar" style={{ borderBottom: "1px solid var(--cizgi, #e5e5e5)", padding: "8px 0", opacity: k.aktif ? 1 : 0.55 }}>
          <div className="yigin" style={{ gap: 2 }}><b>{k.adSoyad || k.eposta}</b><span className="ipucu">{k.eposta} · son giriş {tarih(k.sonGiris)}</span></div>
          <div className="satir sar">
            <select aria-label={`${k.eposta} rolü`} value={k.rol} onChange={(e) => kullaniciDegis(k, { rol: e.target.value as Rol })} disabled={k.rol === "PLATFORM_YONETICISI" && !platform}>
              {(rolSecenekleri.includes(k.rol) ? rolSecenekleri : [...rolSecenekleri, k.rol]).map((r) => <option key={r} value={r}>{ROL_ETIKETLERI[r]}</option>)}
            </select>
            <button className="btn kucuk" onClick={() => kullaniciDegis(k, { aktif: !k.aktif })}>{k.aktif ? "Kapat" : "Aç"}</button>
          </div>
        </div>)}
      </section>

      <section className="kart yigin" id="yon-davet">
        <h3>Davet bağlantısı</h3>
        <p className="ipucu">Uygulamaya yalnızca davetle katılınır. Bağlantı 14 gün geçerlidir ve bir kez kullanılır. E-posta yazarsanız yalnızca o adres kullanabilir.</p>
        {platform && <div className="alan"><label htmlFor="yon-d-ofis">Hangi ofise</label>
          <select id="yon-d-ofis" value={dOfis} onChange={(e) => setDOfis(e.target.value)}><option value="">Kendi ofisim</option>{ofisler.filter((o) => !o.sinirsiz).map((o) => <option key={o.id} value={o.id}>{o.ad}</option>)}</select></div>}
        <div className="alan"><label htmlFor="yon-d-eposta">E-posta (isteğe bağlı)</label><input id="yon-d-eposta" type="email" value={dEposta} onChange={(e) => setDEposta(e.target.value)} placeholder="danisman@ornek.com" /></div>
        <div className="alan"><label htmlFor="yon-d-rol">Rol</label><select id="yon-d-rol" value={dRol} onChange={(e) => setDRol(e.target.value as Rol)}>{rolSecenekleri.filter((r) => r !== "PLATFORM_YONETICISI").map((r) => <option key={r} value={r}>{ROL_ETIKETLERI[r]}</option>)}</select></div>
        <button className="btn birincil" onClick={davetUret}>Davet bağlantısı üret</button>
        {yeniKod && <div className="kart yigin" style={{ padding: 12 }} role="status">
          <b>Bağlantı hazır{yeniKod.ofis ? ` · ${yeniKod.ofis}` : ""}</b>
          <p className="ipucu">Bu bağlantı bir daha gösterilemez; şimdi kopyalayın ya da WhatsApp'tan gönderin.</p>
          <code style={{ wordBreak: "break-all" }}>{davetBaglantisi(yeniKod.kod)}</code>
          <div className="satir sar"><Kopyala metin={davetBaglantisi(yeniKod.kod)} /><a className="btn" target="_blank" rel="noreferrer" href={`https://wa.me/?text=${encodeURIComponent(`Anahtar CRM'e davetlisiniz. Katılmak için: ${davetBaglantisi(yeniKod.kod)}`)}`}>WhatsApp'ta gönder</a></div>
        </div>}
        {davetler.length > 0 && <div className="yigin">
          <b>Davetler</b>
          {davetler.map((d) => <div key={d.id} className="satir-ara sar"><span>{d.eposta || "Herhangi bir e-posta"} · {ROL_ETIKETLERI[d.rol]}</span>
            <span className="satir">{d.durum === "BEKLIYOR" ? <><span className="ipucu">{tarih(d.sonKullanma)}'e kadar</span><button className="btn kucuk" onClick={() => davetIptal(d)}>İptal</button></> : <span className="ipucu">{d.durum === "KULLANILDI" ? `Kullanıldı${d.kullananEposta ? ` · ${d.kullananEposta}` : ""}` : "İptal"}</span>}</span></div>)}
        </div>}
      </section>
    </>}
  </div>;
}
