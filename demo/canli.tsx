/**
 * Anahtar CRM v3.20 · 8 Ekim 2026 (v3.14'ten)
 * v3.20: davet bağlantısıyla katılma (?davet=KOD), açılışta /api/oturum (rol, plan, yetkiler), hesabı olmayana anlaşılır mesaj.
 * Canlı giriş noktası (dist/canli/index.html): giriş → ilk kurulum denetimi → sunucudan durum → aynı demo ekranları, veri sunucuda.
 */
import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { Uygulama } from "./app";
import { CANLI } from "./depo";
import { fotoEsle } from "./foto";
import { OturumYoneticisi, type Yapilandirma } from "./canli-oturum";
import { sunucudanDurum } from "./canli-esle";
import { kaydediciKur, type KaydetDurumu } from "./canli-kaydet";
import { KaydetGostergesi } from "./canli-gosterge";
import { MARKA } from "../src/lib/marka";
import { SURUM, TARIH } from "../src/lib/surum";

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

type Faz = { ad: "aciliyor" } | { ad: "giris"; mesaj?: string } | { ad: "kurulum"; ayrinti: string } | { ad: "hata"; mesaj: string; yeniden: boolean } | { ad: "hazir" };

function Cerceve({ children }: { children: React.ReactNode }) {
  return <div className="sarici" style={{ maxWidth: 440, margin: "0 auto", padding: "10vh 16px 24px" }}>
    <h1 style={{ margin: "0 0 4px" }}>{MARKA.ad}</h1>
    <p className="ipucu" style={{ marginTop: 0 }}>v{SURUM} · {TARIH}</p>
    {children}
  </div>;
}

function Giris({ o, mesaj, bitti }: { o: OturumYoneticisi; mesaj?: string; bitti: () => void }) {
  const [eposta, setEposta] = useState(""), [kod, setKod] = useState("");
  const [adim, setAdim] = useState<"eposta" | "gonderildi">("eposta");
  const [hata, setHata] = useState<string | undefined>(mesaj), [mesgul, setMesgul] = useState(false);
  const davet = !!davetKodu();
  const calis = async (is: () => Promise<void>) => { setMesgul(true); setHata(undefined); try { await is(); } catch (e: any) { setHata(e?.message ?? "Bir sorun oluştu"); } finally { setMesgul(false); } };
  return <Cerceve>
    <section className="kart yigin">
      <h3>{davet ? "Davetle katılın" : "Giriş"}</h3>
      {adim === "eposta" ? <>
        {davet && <p>Bir ofise davet edildiniz. E-posta adresinizi yazın; gelen bağlantıya dokununca hesabınız açılır.</p>}
        <p className="ipucu">E-posta adresinize tek kullanımlık bir giriş bağlantısı göndereceğiz. Şifre gerekmez.</p>
        <div className="alan"><label htmlFor="gi-eposta">E-posta</label><input id="gi-eposta" type="email" autoComplete="email" inputMode="email" value={eposta} onChange={(e) => setEposta(e.target.value)} placeholder="ornek@eposta.com" /></div>
        <button className="btn birincil" disabled={mesgul || !/.+@.+\..+/.test(eposta)} onClick={() => calis(async () => { await o.baglantiIste(eposta, location.origin + "/", davet); setAdim("gonderildi"); })}>{mesgul ? "Gönderiliyor…" : "Giriş bağlantısı gönder"}</button>
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
      let r = await api("/api/durum");
      if (r.status === 401 || r.status === 403) {
        const j: any = await r.json().catch(() => ({}));
        if (r.status === 403) { o.cikis(); return setFaz({ ad: "giris", mesaj: j?.mesaj ?? "Bu e-posta için hesap yok. Yöneticinizden davet bağlantısı isteyin." }); }
        o.cikis(); return setFaz({ ad: "giris", mesaj: j?.mesaj && j.mesaj !== "Giriş gerekli" ? j.mesaj : undefined });
      }
      if (!r.ok) { const j: any = await r.json().catch(() => ({})); throw new Error(j?.mesaj ?? `Sunucu ${r.status}`); }
      const sunucu = await r.json();
      const durum = sunucudanDurum(sunucu);
      fotoEsle(durum.kayitlar as any);
      const k = kaydediciKur({ api, baslangic: durum, durum: setKaydet });
      kaydedici.current = k;
      CANLI.yuklu = durum; CANLI.kaydet = (d) => k.kuyrugaAl(d); CANLI.hemen = () => k.hemen(); CANLI.api = api;
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
  if (faz.ad === "giris") return <Giris o={o} mesaj={faz.mesaj} bitti={async () => { if (await kurulumDenetle()) await ac(); }} />;
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
