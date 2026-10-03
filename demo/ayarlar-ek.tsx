/**
 * Anahtar CRM v3.13 · 3 Ekim 2026
 * Demo — Ayarlar ekranının v3.10 bölümleri: Yapay zekâ, Portföy paylaşım imzası, Çalışma ili.
 * Sunucu karşılığı: GET/PUT /api/ayarlar, POST /api/ai/dene. API anahtarı ekrana yazılmaz (sunucuda AI_API_KEY).
 */
import { useState } from "react";
import { useDepo, aiJson, cx } from "./ortak";
import { aiAyari, paylasimAyari, calismaIli } from "./depo";
import { AI_SAGLAYICILAR, AI_SAGLAYICI_KODLARI, aiSaglayiciSec, PaylasimAyarSchema, type AiAyar, type AiSaglayici } from "../src/lib/domain/ayarlar";
import { ILLER } from "./lokasyon";
import { TelGirdisi } from "./girdi";

export function AiAyarlari() {
  const { d, guncelle, bildir, sample } = useDepo() as any;
  const [a, setA] = useState<AiAyar>(aiAyari(d));
  const [deneme, setDeneme] = useState<{ durum: "yok" | "suruyor" | "tamam" | "hata"; metin?: string }>({ durum: "yok" });
  const b = AI_SAGLAYICILAR[a.saglayici];
  const degisti = JSON.stringify(a) !== JSON.stringify(aiAyari(d));
  const dene = async () => {
    setDeneme({ durum: "suruyor" });
    const t = Date.now();
    try {
      const c = await aiJson(sample, 'Yalnızca şu JSON\'u döndür: {"tamam": true}');
      setDeneme(c?.tamam ? { durum: "tamam", metin: `Yanıt geldi (${((Date.now() - t) / 1000).toFixed(1)} sn)` } : { durum: "hata", metin: "Beklenmeyen yanıt" });
    } catch (e: any) { setDeneme({ durum: "hata", metin: e?.message ?? "Yapay zekâya ulaşılamadı" }); }
  };
  return <section className="kart yigin kucuk-bosluk" id="ayar-ai">
    <h3>Yapay zekâ</h3>
    <p className="ipucu">Metinler önce ücretsiz kurallarla okunur; yapay zekâ yalnızca siz isteyince ya da güven eşiğin altında kalınca devreye girer. Sağlayıcıyı buradan değiştirebilirsiniz — kod değişmez.</p>
    <div className="alanlar">
      <div className="alan genis"><label htmlFor="ai-saglayici">Sağlayıcı</label>
        <select id="ai-saglayici" value={a.saglayici} onChange={(e) => setA(aiSaglayiciSec(a, e.target.value as AiSaglayici))}>
          {AI_SAGLAYICI_KODLARI.map((k) => <option key={k} value={k}>{AI_SAGLAYICILAR[k].ad}{k === "GEMINI" ? " — önerilen" : ""}</option>)}
        </select></div>
      <div className="alan"><label htmlFor="ai-model">Model</label><input id="ai-model" value={a.model} onChange={(e) => setA({ ...a, model: e.target.value })} placeholder="model adı" /></div>
      <div className="alan"><label htmlFor="ai-url">Adres (OpenAI uyumlu)</label><input id="ai-url" value={a.tabanUrl} onChange={(e) => setA({ ...a, tabanUrl: e.target.value })} placeholder="https://…/v1" inputMode="url" /></div>
    </div>
    <dl className="ai-bilgi">
      <div><dt>Ücret</dt><dd>{b.ucretsiz}</dd></div>
      <div><dt>Veri</dt><dd>{b.veri}</dd></div>
      <div><dt>Anahtar</dt><dd>{b.anahtar} · sunucuda <code>AI_API_KEY</code> olarak saklanır, bu ekrana yazılmaz</dd></div>
    </dl>
    <div className="alan"><label htmlFor="ai-esik">Güven eşiği: %{a.esik}</label>
      <input id="ai-esik" type="range" min={30} max={95} step={5} value={a.esik} onChange={(e) => setA({ ...a, esik: Number(e.target.value) })} />
      <small className="ipucu">Okuma güveni bunun altındaysa “emin değilim” uyarısı çıkar. Puan: mülk tipi 20 · talep/portföy 10 · satılık/kiralık 15 · fiyat 20 · konum 20 · alan ya da oda 15.</small></div>
    <label className="onay-satir"><input type="checkbox" checked={a.otomatik} onChange={(e) => setA({ ...a, otomatik: e.target.checked })} /> <span>Eşiğin altında kalınca yapay zekâ kendiliğinden yorumlasın</span></label>
    <div className="satir sar">
      <button className="btn birincil" disabled={!degisti} onClick={() => { guncelle((x: any) => ({ ...x, ayarlar: { ...x.ayarlar, ai: a } })); bildir("Yapay zekâ ayarları kaydedildi"); }}>Kaydet</button>
      <button className="btn" disabled={deneme.durum === "suruyor" || !sample} onClick={dene}>{deneme.durum === "suruyor" ? "Deneniyor…" : "Bağlantıyı dene"}</button>
      {deneme.durum === "tamam" && <span className="pill p-iyi">{deneme.metin}</span>}
      {deneme.durum === "hata" && <span className="pill p-kotu">{deneme.metin}</span>}
    </div>
    <p className="ipucu">Bu demoda yapay zekâ çağrıları Claude üzerinden çalışır (sayfayı açan kişinin kullanımından); seçtiğiniz sağlayıcı canlı kurulumda geçerli olur.{!sample ? " Bu görünümde yapay zekâ kapalı." : ""}</p>
  </section>;
}

export function PaylasimAyarlari() {
  const { d, guncelle, bildir } = useDepo();
  const [p, setP] = useState(paylasimAyari(d));
  const gecerli = PaylasimAyarSchema.safeParse(p).success;
  return <section className="kart yigin kucuk-bosluk" id="ayar-paylasim">
    <h3>Portföy paylaşım imzası</h3>
    <p className="ipucu">“Portföy paylaş” ile hazırlanan föyün altında bu bilgiler görünür. Paylaşırken o föy için değiştirebilirsiniz.</p>
    <div className="alanlar">
      <div className="alan"><label htmlFor="py-ad">Ad soyad</label><input id="py-ad" value={p.adSoyad} onChange={(e) => setP({ ...p, adSoyad: e.target.value })} /></div>
      <div className="alan"><label htmlFor="py-tel">Telefon</label><TelGirdisi id="py-tel" deger={p.telefon} onChange={(v) => setP({ ...p, telefon: v })} /></div>
      <div className="alan"><label htmlFor="py-unvan">Unvan</label><input id="py-unvan" value={p.unvan} onChange={(e) => setP({ ...p, unvan: e.target.value })} /></div>
      <div className="alan"><label htmlFor="py-firma">Firma (isteğe bağlı)</label><input id="py-firma" value={p.firma} onChange={(e) => setP({ ...p, firma: e.target.value })} /></div>
    </div>
    <div className="satir"><button className="btn birincil" disabled={!gecerli} onClick={() => { guncelle((x) => ({ ...x, ayarlar: { ...x.ayarlar, paylasim: PaylasimAyarSchema.parse(p) } })); bildir("İmza kaydedildi"); }}>Kaydet</button></div>
  </section>;
}

export function CalismaIliAyari() {
  const { d, guncelle, bildir } = useDepo();
  const il = calismaIli(d);
  return <section className="kart yigin kucuk-bosluk" id="ayar-il">
    <h3>Çalışma ili</h3>
    <p className="ipucu">İl yazılmadan girilen konumlar bu ilde aranır. Diğer 80 il de tanınır: “İzmir Bornova”, “Bodrum’da villa” gibi yazmanız yeterli.</p>
    <div className="alan"><label htmlFor="ayar-il-sec">İl</label>
      <select id="ayar-il-sec" className={cx()} value={il} onChange={(e) => { const v = Number(e.target.value); guncelle((x) => ({ ...x, ayarlar: { ...x.ayarlar, calismaIli: v } })); bildir("Çalışma ili değişti"); }}>
        {ILLER.map((i) => <option key={i.id} value={i.id}>{i.ad}</option>)}
      </select></div>
    {il !== 7 && <p className="ipucu">Alt bölge (semt) sözlüğü şimdilik Antalya için ayrıntılı; diğer illerde ilçe, mahalle ve büyük şehirlerin bilinen semtleri tanınır. Yeni semtleri “Konumlar”dan öğretebilirsiniz.</p>}
  </section>;
}