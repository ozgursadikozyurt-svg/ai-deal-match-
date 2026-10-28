/**
 * Anahtar CRM v3.43 · 25 Ekim 2026 (v3.14'ten)
 * v3.20: davet bağlantısıyla katılma (?davet=KOD), açılışta /api/oturum (rol, plan, yetkiler), hesabı olmayana anlaşılır mesaj.
 * Canlı giriş noktası (dist/canli/uygulama.html): giriş → ilk kurulum denetimi → sunucudan durum → aynı demo ekranları, veri sunucuda.
 */
import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { Uygulama } from "./app";
import { CANLI } from "./depo";
import { fotoEsle } from "./foto";
import { OturumYoneticisi, type Yapilandirma } from "./canli-oturum";
import { sunucudanDurum } from "./canli-esle";
import { kaydediciKur, type KaydetDurumu } from "./canli-kaydet";
import { kayitlariOnar } from "./onarim";
import { KaydetGostergesi } from "./canli-gosterge";
import { MARKA } from "../src/lib/marka";
import { SURUM, TARIH } from "../src/lib/surum";
import { REHBER, KISI_PARCA_ADEDI } from "./kisi-parca";

// v3.20 — davet kodu adresten alınır ve giriş bağlantısı dönene kadar bu tarayıcıda saklanır
const DAVET_ANAHTAR = "anahtarcrm-davet";
const davetKodu = (): string | null => { try { return localStorage.getItem(DAVET_ANAHTAR); } catch { return null; } };
const davetTemizle = () => { try { localStorage.removeItem(DAVET_ANAHTAR); } catch { /* gizli pencere */ } };
(() => {
  const k = new URLSearchParams(location.search).get("davet");
  if (!k) return;
  try { localStorage.setItem(DAVET_ANAHTAR, k); } catch { /* gizli pencere */ }
  history.replaceState(null, "", location.pathname + location.hash);
})();

// v3.21 — Google izin ekranından dönüş: /?google=ok (ya da iptal / hata / yetki). Sonuç saklanır, adres temizlenir;
// uygulama açılınca Bağlantılar ekranı gelir ve ilk içe aktarma başlar (demo/app.tsx, demo/baglantilar.tsx).
(() => {
  const p = new URLSearchParams(location.search), g = p.get("google");
  if (!g) return;
  CANLI.googleDonus = g;
  p.delete("google");
  history.replaceState(null, "", location.pathname + (p.toString() ? "?" + p : "") + location.hash);
})();

type Faz = { ad: "aciliyor" } | { ad: "giris"; mesaj?: string } | { ad: "kayit"; eposta?: string } | { ad: "kurulum"; ayrinti: string } | { ad: "hata"; mesaj: string; yeniden: boolean } | { ad: "hazir" };

function Cerceve({ children }: { children: React.ReactNode }) {
  return <div className="sarici" style={{ maxWidth: 440, margin: "0 auto", padding: "10vh 16px 24px" }}>
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <img src="/favicon.svg" alt="Anahtar CRM logosu" width={48} height={48} style={{ borderRadius: 12 }} />
      <h1 style={{ margin: 0 }}>{MARKA.ad}</h1>
    </div>
    <p className="ipucu" style={{ margin: "6px 0 0" }}>{MARKA.slogan} · v{SURUM} · {TARIH}</p>
    {children}
    <Tanitim />
  </div>;
}

/** SEO — Giriş ekranındaki tanıtım: arama motorlarının (ve yeni ziyaretçinin) uygulamayı anlayacağı okunabilir metin */
function Tanitim() {
  return <section aria-labelledby="tanitim-baslik" style={{ marginTop: 28 }}>
    <h2 id="tanitim-baslik" style={{ fontSize: "1.05rem", margin: "0 0 8px" }}>Anahtar CRM nedir?</h2>
    <p>Emlak danışmanları ve ofisleri için yapay zekâ destekli talep ve portföy eşleştirme uygulaması. Müşteri taleplerinizi ve portföylerinizi tek yerde tutar, birbirine uyanları otomatik bulur.</p>
    <ul style={{ paddingLeft: 18, margin: "8px 0" }}>
      <li><b>Talep – portföy eşleştirme:</b> her eşleşme 1–5 uyum seviyesiyle ve gerekçesiyle gelir.</li>
      <li><b>WhatsApp ve ilanlardan veri girişi:</b> emlak grubu mesajlarını ve ilan listelerini yapay zekâ okuyup kayda çevirir.</li>
      <li><b>Müşteri takibi:</b> kişiler, notlar, randevular ve Google Kişiler ile eşitleme.</li>
      <li><b>Ofis ve ekip:</b> danışmanlarınızı davet edin, yetkileri belirleyin; telefondan uygulama gibi kullanın.</li>
    </ul>
    <p className="ipucu">{DENEME_GUN_YAZI}, kart bilgisi istenmez. · <a href="/">Ayrıntılı tanıtım</a> · <a href="/gizlilik">Gizlilik</a> · <a href="/kvkk">KVKK</a> · <a href="/kosullar">Koşullar</a></p>
  </section>;
}

function Giris({ o, mesaj, bitti, acikKayit = false }: { o: OturumYoneticisi; mesaj?: string; bitti: () => void; acikKayit?: boolean }) {
  const [eposta, setEposta] = useState(""), [kod, setKod] = useState("");
  const [adim, setAdim] = useState<"eposta" | "gonderildi">("eposta");
  const [hata, setHata] = useState<string | undefined>(mesaj), [mesgul, setMesgul] = useState(false);
  const davet = !!davetKodu();
  const calis = async (is: () => Promise<void>) => { setMesgul(true); setHata(undefined); try { await is(); } catch (e: any) { setHata(e?.message ?? "Bir sorun oluştu"); } finally { setMesgul(false); } };
  return <Cerceve>
    <section className="kart yigin">
      <h3>{davet ? "Davetle katılın" : acikKayit ? "Giriş ya da ücretsiz deneme" : "Giriş"}</h3>
      {acikKayit && !davet && adim === "eposta" && <p>Hesabınız yoksa aynı yoldan başlayın: bağlantıya dokununca ofisinizi açarsınız — <b>{DENEME_GUN_YAZI}</b>, kart bilgisi istenmez.</p>}
      {adim === "eposta" ? <>
        {davet && <p>Bir ofise davet edildiniz. E-posta adresinizi yazın; gelen bağlantıya dokununca hesabınız açılır.</p>}
        <p className="ipucu">E-posta adresinize tek kullanımlık bir giriş bağlantısı göndereceğiz. Şifre gerekmez.</p>
        <div className="alan"><label htmlFor="gi-eposta">E-posta</label><input id="gi-eposta" type="email" autoComplete="email" inputMode="email" value={eposta} onChange={(e) => setEposta(e.target.value)} placeholder="ornek@eposta.com" /></div>
        <button className="btn birincil" disabled={mesgul || !/.+@.+\..+/.test(eposta)} onClick={() => calis(async () => { await o.baglantiIste(eposta, location.origin + "/uygulama", davet || acikKayit); setAdim("gonderildi"); })}>{mesgul ? "Gönderiliyor…" : "Giriş bağlantısı gönder"}</button>
      </> : <>
        <p>Bağlantıyı <b>{eposta}</b> adresine gönderdik. E-postadaki bağlantıya bu cihazda dokunmanız yeterli.</p>
        <p className="ipucu">E-postanızda altı haneli bir kod da varsa buraya yazabilirsiniz:</p>
        <div className="alan"><label htmlFor="gi-kod">Kod (isteğe bağlı)</label><input id="gi-kod" inputMode="numeric" autoComplete="one-time-code" value={kod} onChange={(e) => setKod(e.target.value)} /></div>
        <div className="satir sar">
          <button className="btn birincil" disabled={mesgul || kod.trim().length < 6} onClick={() => calis(async () => { await o.kodDogrula(eposta, kod); bitti(); })}>Kodla giriş yap</button>
          <button className="btn" onClick={() => { setAdim("eposta"); setKod(""); }}>Başka e-posta</button>
        </div>
      </>}
      {hata && <div className="hata-kutu" role="alert">{hata}</div>}
    </section>
  </Cerceve>;
}

const DENEME_GUN_YAZI = "14 gün Pro deneme";
/** v3.26 — Açık kayıt: giriş yapmış ama hesabı olmayan danışman kendi ofisini açar */
function KayitOl({ o, eposta, bitti }: { o: OturumYoneticisi; eposta?: string; bitti: () => void }) {
  const [f, setF] = useState({ ofisAd: "", adSoyad: "", telefon: "", sehir: "Antalya", onay: false });
  const [hata, setHata] = useState<string>(), [mesgul, setMesgul] = useState(false);
  const set = (k: keyof typeof f, v: any) => setF({ ...f, [k]: v });
  const gonder = async () => {
    setMesgul(true); setHata(undefined);
    try {
      const r = await o.api("/api/kayit-ol", { method: "POST", json: f });
      const j: any = await r.json().catch(() => ({}));
      if (!r.ok && r.status !== 409) throw new Error(j?.mesaj ?? `Sunucu ${r.status}`);
      bitti();
    } catch (e: any) { setHata(e?.message ?? "Kayıt yapılamadı"); } finally { setMesgul(false); }
  };
  return <Cerceve><section className="kart yigin">
    <h3>Ofisinizi açın</h3>
    <p><b>{eposta ?? "Bu e-posta"}</b> için henüz hesap yok. Ofisinizi açın; {DENEME_GUN_YAZI} başlar, sonra Ücretsiz plana geçer (verileriniz silinmez).</p>
    <div className="alan"><label htmlFor="ko-ofis">Ofis / marka adı</label><input id="ko-ofis" value={f.ofisAd} onChange={(e) => set("ofisAd", e.target.value)} placeholder="Örn: Lara Gayrimenkul" maxLength={80} /></div>
    <div className="alan"><label htmlFor="ko-ad">Adınız soyadınız</label><input id="ko-ad" autoComplete="name" value={f.adSoyad} onChange={(e) => set("adSoyad", e.target.value)} maxLength={80} /></div>
    <div className="alan"><label htmlFor="ko-tel">Cep telefonu</label><input id="ko-tel" type="tel" autoComplete="tel" value={f.telefon} onChange={(e) => set("telefon", e.target.value)} placeholder="05XX XXX XX XX" maxLength={20} /></div>
    <div className="alan"><label htmlFor="ko-sehir">Şehir</label><input id="ko-sehir" value={f.sehir} onChange={(e) => set("sehir", e.target.value)} maxLength={40} /></div>
    <label className="onay-satir"><input type="checkbox" checked={f.onay} onChange={(e) => set("onay", e.target.checked)} /> <span><a href="/kosullar" target="_blank" rel="noopener">Kullanım koşullarını</a> ve <a href="/kvkk" target="_blank" rel="noopener">KVKK aydınlatma metnini</a> okudum, kabul ediyorum.</span></label>
    <div className="satir sar"><button className="btn birincil" disabled={mesgul || f.ofisAd.trim().length < 2 || f.adSoyad.trim().length < 2 || !f.onay} onClick={gonder}>{mesgul ? "Açılıyor…" : "Ofisimi aç"}</button>
      <button className="btn" onClick={() => { o.cikis(); location.reload(); }}>Başka e-postayla gir</button></div>
    {hata && <div className="hata-kutu" role="alert">{hata}</div>}
  </section></Cerceve>;
}

function Canli({ cfg }: { cfg: Yapilandirma }) {
  const o = useRef(new OturumYoneticisi(cfg)).current;
  const [faz, setFaz] = useState<Faz>({ ad: "aciliyor" });
  const [kaydet, setKaydet] = useState<KaydetDurumu>({ ad: "kayitli", hatalar: [] });
  const kaydedici = useRef<ReturnType<typeof kaydediciKur> | null>(null);

  const ac = async () => {
    setFaz({ ad: "aciliyor" });
    try {
      const api = (yol: string, init?: any) => o.api(yol, init);
      // v3.20 — davet bağlantısıyla geldiyse önce daveti kabul et (hesap o ofiste açılır)
      const kod = davetKodu();
      if (kod) {
        const dr = await api("/api/davet/kabul", { method: "POST", json: { kod } });
        const dj: any = await dr.json().catch(() => ({}));
        davetTemizle();
        if (!dr.ok && dr.status !== 409) { o.cikis(); return setFaz({ ad: "giris", mesaj: dj?.mesaj ?? "Davet kabul edilemedi" }); }
      }
      // v3.40 — parçalı açılış: önce küçük "diğer" parça (eşleşme takibi + ayarlar; aynı zamanda oturum denetimi), sonra kayıtlar ve kişiler sayfa sayfa.
      // Tek büyük istek Cloudflare ücretsiz planın işlemci sınırını aşıyordu (günde 100+ kez 503).
      let r = await api("/api/durum?parca=diger");
      if (r.status === 401 || r.status === 403) {
        const j: any = await r.json().catch(() => ({}));
        if (r.status === 403 && cfg.acikKayit && j?.hata === "HESAP_YOK") return setFaz({ ad: "kayit", eposta: o.eposta ?? undefined }); // v3.26
        if (r.status === 403) { o.cikis(); return setFaz({ ad: "giris", mesaj: j?.mesaj ?? "Bu e-posta için hesap yok. Yöneticinizden davet bağlantısı isteyin." }); }
        o.cikis(); return setFaz({ ad: "giris", mesaj: j?.mesaj && j.mesaj !== "Giriş gerekli" ? j.mesaj : undefined });
      }
      if (!r.ok) { const j: any = await r.json().catch(() => ({})); throw new Error(j?.mesaj ?? `Sunucu ${r.status}`); }
      const diger = await r.json();
      const sayfalar = async (parca: "kayit" | "kisi", anahtar: "kayitlar" | "kisiler", ek = ""): Promise<any[]> => {
        const hepsi: any[] = [];
        for (let atla: number | null = 0; atla != null;) {
          let j: any = null, son = "";
          for (let deneme = 0; deneme < 3 && !j; deneme++) {
            if (deneme) await new Promise((x) => setTimeout(x, 400 * deneme));
            const rr = await api(`/api/durum?parca=${parca}&atla=${atla}${ek}`);
            if (rr.ok) j = await rr.json(); else son = (await rr.json().catch(() => ({})))?.mesaj ?? `Sunucu ${rr.status}`;
          }
          if (!j) throw new Error(son || "Veriler alınamadı");
          hepsi.push(...(j[anahtar] ?? [])); atla = typeof j.sonraki === "number" ? j.sonraki : null;
        }
        return hepsi;
      };
      // eski sunucu (parçasız) her şeyi tek seferde döndürür: o zaman ek istek atılmaz
      // v3.41 — kişilerin yalnızca talep / portföye bağlı olanları açılışta gelir (ilgili=1); rehberin geri kalanı "Devam et" ile (demo/kisi-parca.ts)
      const tamSunucu = Array.isArray(diger.kayitlar) && Array.isArray(diger.kisiler);
      const sunucu = tamSunucu ? diger : { ...diger, ...Object.fromEntries(await Promise.all([sayfalar("kayit", "kayitlar").then((x) => ["kayitlar", x]), sayfalar("kisi", "kisiler", `&ilgili=1&al=${KISI_PARCA_ADEDI}`).then((x) => ["kisiler", x])])) };
      REHBER.toplam = tamSunucu ? null : (typeof diger.kisiToplam === "number" ? diger.kisiToplam : null);
      REHBER.sonraki = tamSunucu || (REHBER.toplam != null && (sunucu as any).kisiler.length >= REHBER.toplam) ? null : 0;
      REHBER.yukluyor = null; REHBER.hata = null;
      const durum = sunucudanDurum(sunucu);
      fotoEsle(durum.kayitlar as any);
      const k = kaydediciKur({ api, baslangic: durum, durum: setKaydet, yedekAnahtari: `anahtar.canli.bekleyen.${o.eposta ?? "?"}`, uyari: (m) => CANLI.bildir?.(m) });
      kaydedici.current = k;
      // v3.22.1 — açılışta onarım (demo/onarim.ts) + önceki oturumda sunucuya ulaşamamış yeni kayıtlar (yerel yedek):
      // ikisi de sunucudaki hâlden farklı olduğu için kayıt kuyruğu onları kendiliğinden sunucuya yazar
      const geri = k.yedektenGeriAl(durum);
      const onar = kayitlariOnar(geri.kayitlar);
      const ilk = onar.sayi || geri !== durum ? { ...geri, kayitlar: onar.kayitlar } : durum;
      CANLI.yuklu = ilk; CANLI.kaydet = (d) => k.kuyrugaAl(d); CANLI.hemen = () => k.hemen(); CANLI.api = api;
      CANLI.sunucudaMi = (id) => k.sunucudaMi(id); CANLI.kayitHatasi = (id) => k.hataOf(id);
      if (ilk !== durum) k.kuyrugaAl(ilk);
      CANLI.kisileriBirlestir = (d, sunucu) => k.kisileriBirlestir(d, sunucu); // v3.21
      CANLI.kisileriDegisenleriBirlestir = (d, degisen) => k.kisileriDegisenleriBirlestir(d, degisen); // v3.22.2 — artımlı
      CANLI.kisiZamani = typeof sunucu.kisiZamani === "string" ? sunucu.kisiZamani : null;
      const or = await api("/api/oturum");
      const bilgi = or.ok ? await or.json().catch(() => undefined) : undefined;
      CANLI.oturum = { eposta: o.eposta, cikis: () => { o.cikis(); location.reload(); }, bilgi };
      CANLI.sample = {
        json: async (istem, secenek) => {
          await k.hemen(); // kaydedilmemiş yapay zekâ ayarı varsa sunucu önce onu görsün
          const rr = await api("/api/ai/json", { method: "POST", json: { istem, sistem: typeof secenek?.system === "string" ? secenek.system : undefined } });
          const j: any = await rr.json().catch(() => ({}));
          if (!rr.ok) throw { code: j?.hata ?? "SUNUCU", message: j?.mesaj ?? `Yapay zekâ hatası (${rr.status})` };
          return j.sonuc;
        },
      };
      setFaz({ ad: "hazir" });
    } catch (e: any) { setFaz({ ad: "hata", mesaj: e?.message ?? String(e), yeniden: true }); }
  };

  const kurulumDenetle = async (): Promise<boolean> => {
    const api = (yol: string, init?: any) => o.api(yol, init);
    const r = await api("/api/kurulum");
    if (r.status === 401 || r.status === 403) return true; // ac() uygun mesajı gösterir
    if (!r.ok) return true; // denetlenemedi: açmayı dene, durum hatası kendini gösterir
    const j: any = await r.json();
    if (j.hazir) return true;
    setFaz({ ad: "kurulum", ayrinti: `Bekleyen migration: ${j.migrasyon?.bekleyen?.length ?? "?"} · Antalya mahalle: ${j.mahalle ?? 0} · kimlik uyumu: ${j.konumKimlikUyumu ? "evet" : "hayır"}` });
    return false;
  };

  useEffect(() => {
    (async () => {
      if (location.hash.includes("access_token") || location.hash.includes("error")) {
        const h = o.hashtanAl(location.hash); history.replaceState(null, "", location.pathname + location.search);
        if (h.hata) return setFaz({ ad: "giris", mesaj: h.hata });
      }
      if (!o.var()) return setFaz({ ad: "giris" });
      if (await kurulumDenetle()) await ac();
    })();
    const uyar = (e: BeforeUnloadEvent) => { if (kaydedici.current?.bekliyorMu()) { e.preventDefault(); e.returnValue = ""; } };
    addEventListener("beforeunload", uyar); return () => removeEventListener("beforeunload", uyar);
  }, []);

  if (faz.ad === "aciliyor") return <Cerceve><p>Açılıyor…</p></Cerceve>;
  if (faz.ad === "giris") return <Giris o={o} mesaj={faz.mesaj} acikKayit={!!cfg.acikKayit} bitti={async () => { if (await kurulumDenetle()) await ac(); }} />;
  if (faz.ad === "kayit") return <KayitOl o={o} eposta={faz.eposta} bitti={() => { setFaz({ ad: "aciliyor" }); void ac(); }} />;
  if (faz.ad === "kurulum") return <Cerceve><section className="kart yigin">
    <h3>İlk kurulum</h3><p>Veritabanı henüz hazır değil.</p><p className="ipucu">{faz.ayrinti}</p>
    <button className="btn birincil" onClick={async () => { setFaz({ ad: "aciliyor" }); const r = await o.api("/api/kurulum", { method: "POST" }); const j: any = await r.json().catch(() => ({})); if (!r.ok || !j.hazir) return setFaz({ ad: "hata", mesaj: j?.mesaj ?? "Kurulum tamamlanamadı", yeniden: false }); await ac(); }}>Kurulumu tamamla</button>
  </section></Cerceve>;
  if (faz.ad === "hata") return <Cerceve><div className="hata-kutu" role="alert">{faz.mesaj}</div>
    <div className="satir sar" style={{ marginTop: 12 }}>{faz.yeniden && <button className="btn birincil" onClick={ac}>Yeniden dene</button>}<button className="btn" onClick={() => { o.cikis(); location.reload(); }}>Çıkış yap</button></div></Cerceve>;
  return <><KaydetGostergesi s={kaydet} /><Uygulama /></>;
}

async function baslat() {
  const kok = document.getElementById("kok")!;
  const root = createRoot(kok);
  try {
    const r = await fetch("/api/yapilandirma");
    if (!r.ok) throw new Error(`Sunucu ${r.status}`);
    const cfg = (await r.json()) as Yapilandirma;
    if (!cfg.supabaseUrl || !cfg.supabaseAnonKey) throw new Error("SUPABASE_URL / SUPABASE_ANON_KEY Cloudflare'de tanımlı değil");
    root.render(<Canli cfg={cfg} />);
  } catch (e: any) { root.render(<Cerceve><div className="hata-kutu" role="alert">Uygulama açılamadı: {e?.message ?? e}</div></Cerceve>); }
}
void baslat();
