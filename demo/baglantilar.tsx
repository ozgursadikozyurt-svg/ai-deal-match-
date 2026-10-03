/**
 * Anahtar CRM v3.13 · 3 Ekim 2026
 * Demo — Bağlantılar: Google Kişiler ve Notion. Bağla → ilk içe aktarma → rapor (yeni, bağlanan, kontrol gerekli,
 * yeni eşleşmeler, Notion'a geri yazılanlar) → çakışmalar → senkron geçmişi. Gerçek hesaba bağlanmaz; örnek dış veriyle
 * sunucudaki planlayıcıların aynısı çalışır.
 */
import { Bilgi } from "./kartlar";
import React, { useState } from "react";
import { useDepo, cx, Pill, tarihYaz, telYaz } from "./ortak";
import { Ikon } from "./kabuk";
import { demoGoogleSenkron, demoNotionSenkron, demoCakismaCoz, demoCakismalariCoz, demoGoogleKisiKaydet, ALAN_ETIKET } from "./senkron-demo";
import { bosBaglanti, type DemoCalisma, type DemoBaglanti } from "./depo";
import { NOTION_TABLOLARI, GERI_YAZIM_ALANLARI } from "../src/lib/notion/yapilandirma";
import { alanRaporu } from "../src/lib/notion/geri-yazim";
import { ATLAMA_ETIKET } from "../src/lib/google/kisiler";
import { OZET_ETIKET } from "../src/lib/notion/plan";
import { GOOGLE_GRUPLAR, NOTION_TUR1 } from "./ornek-entegrasyon";
import { etiket } from "./etiketler";

const saat = (iso: string | null) => (iso ? new Date(iso).toLocaleString("tr-TR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—");
const degerYaz = (alan: string, v: unknown) => v == null || v === "" ? "boş" : typeof v === "number" ? v.toLocaleString("tr-TR") : alan === "telefon" ? telYaz(String(v)) : Array.isArray(v) ? etiket(v as any) : /^[A-Z_]+$/.test(String(v)) ? etiket(v as any) : String(v);

/** Kenar menüsü / başlık için küçük durum göstergesi */
export function SenkronDurumu() {
  const { d, git } = useDepo();
  const b = d.baglantilar ?? { google: bosBaglanti(), notion: bosBaglanti() };
  const bagli = [b.notion.durum === "BAGLI" && "Notion", b.google.durum === "BAGLI" && "Google"].filter(Boolean) as string[];
  const cakisma = (d.cakismalar ?? []).length;
  return <button className={cx("senkron-durum", cakisma > 0 && "uyari", !bagli.length && "kapali")} onClick={() => git({ ad: "baglantilar" } as any)} title="Bağlantılar">
    <span className="nokta" aria-hidden="true" />
    <span>{cakisma ? `${cakisma} çakışma bekliyor` : bagli.length ? `${bagli.join(" + ")} eşitlendi` : "Notion, Google bağlı değil"}</span>
  </button>;
}

function Rapor({ c }: { c: DemoCalisma }) {
  const { git } = useDepo();
  const notion = c.saglayici === "NOTION";
  const sira = notion ? ["yeni", "baglanan", "guncellenen", "degismeyen", "kontrol", "cakisma", "arsivlenen", "hatali"] : ["yeni", "baglanan", "guncellenen", "degismeyen", "cakisma", "birlesen", "silinen", "atlanan"];
  return <div className="rapor">
    <div className="rapor-sayilar">{sira.filter((k) => c.ozet[k]).map((k) => <span key={k} className={cx("rs", (k === "cakisma" || k === "kontrol" || k === "hatali") && "dikkat")}><b>{c.ozet[k]}</b> {OZET_ETIKET[k]?.toLocaleLowerCase("tr")}</span>)}
      {notion && !!c.ozet.kisiYeni && <span className="rs"><b>{c.ozet.kisiYeni}</b> yeni kişi</span>}
      {!sira.some((k) => c.ozet[k]) && !c.ozet.kisiYeni && <span className="ipucu">Değişiklik yok — her şey zaten eşit.</span>}</div>
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

function Ayarlar({ b, set, google }: { b: DemoBaglanti; set: (a: Partial<DemoBaglanti["ayar"]>) => void; google: boolean }) {
  return <details className="ic-ayar"><summary>Ayarlar</summary>
    <label className="onay-satir"><input type="checkbox" checked={b.ayar.otomatik} onChange={(e) => set({ otomatik: e.target.checked })} /> Otomatik senkron</label>
    <label className="satir sar ipucu">Sıklık
      <select value={b.ayar.aralikDk} style={{ width: "auto" }} onChange={(e) => set({ aralikDk: Number(e.target.value) })}>{[5, 15, 30, 60, 180, 1440].map((m) => <option key={m} value={m}>{m < 60 ? `${m} dakikada bir` : m === 1440 ? "Günde bir" : `${m / 60} saatte bir`}</option>)}</select></label>
    {google ? <>
      <div className="ipucu">Yalnızca şu etiketlerdeki kişileri al (hiçbiri seçili değilse telefonu olan herkes):</div>
      <div className="cip-satir">{GOOGLE_GRUPLAR.map((g) => { const on = b.ayar.sadeceEtiketler.includes(g.formattedName!); return <button key={g.resourceName} className={cx("cip secilir", on && "on")} onClick={() => set({ sadeceEtiketler: on ? b.ayar.sadeceEtiketler.filter((x) => x !== g.formattedName) : [...b.ayar.sadeceEtiketler, g.formattedName!] })}>{g.formattedName}</button>; })}</div>
      <label className="onay-satir"><input type="checkbox" checked={b.ayar.googleYaz} onChange={(e) => set({ googleYaz: e.target.checked })} /> Anahtar'da eklenen kişileri Google'a da ekle <small className="ipucu">(ek izin ister)</small></label>
    </> : <label className="onay-satir"><input type="checkbox" checked={b.ayar.geriYaz} onChange={(e) => set({ geriYaz: e.target.checked })} /> Eşleşme skorlarını Notion'a geri yaz</label>}
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

export function Baglantilar() {
  const { d, guncelle, bildir, git } = useDepo();
  const b = d.baglantilar ?? { google: bosBaglanti(), notion: bosBaglanti() };
  const [izin, setIzin] = useState<null | "google" | "notion">(null);
  const [yerelOrnek, setYerelOrnek] = useState(true);
  const [eslemeAcik, setEslemeAcik] = useState(false);
  const [cSecim, setCSecim] = useState<Set<string>>(new Set());
  const cAd = (sg: string) => (sg === "NOTION" ? "Notion" : "Google");
  const topluCoz = (secim: "YEREL" | "UZAK") => { const ids = [...cSecim].filter((id) => d.cakismalar.some((c) => c.id === id)); guncelle((x) => demoCakismalariCoz(x, ids, secim)); setCSecim(new Set()); bildir(`${ids.length} çakışma çözüldü — ${secim === "YEREL" ? "uygulamadaki değerler korundu" : "dış kaynaktaki değerler alındı"}`); };
  const son = (s: "GOOGLE_KISILER" | "NOTION") => (d.senkronGecmisi ?? []).find((c) => c.saglayici === s);
  const ayarYaz = (k: "google" | "notion") => (a: Partial<DemoBaglanti["ayar"]>) => guncelle((x) => ({ ...x, baglantilar: { ...x.baglantilar, [k]: { ...x.baglantilar[k], ayar: { ...x.baglantilar[k].ayar, ...a } } } }));
  const calistir = (k: "google" | "notion", tetik: string) => {
    guncelle((x) => {
      const y = { ...x, baglantilar: { ...x.baglantilar, [k]: { ...x.baglantilar[k], durum: "BAGLI" as const, hesap: k === "google" ? "ozgur@ornek.com" : "Gayrimenkul CRM" } } };
      const r = k === "google" ? demoGoogleSenkron(y, tetik) : demoNotionSenkron(y, tetik, yerelOrnek);
      return r.d;
    });
    bildir(k === "google" ? "Google Kişiler eşitlendi" : "Notion eşitlendi");
  };
  const kopar = (k: "google" | "notion") => { guncelle((x) => ({ ...x, baglantilar: { ...x.baglantilar, [k]: { ...bosBaglanti(), ayar: x.baglantilar[k].ayar } } })); bildir("Bağlantı kaldırıldı — kişiler ve kayıtlar Anahtar'da kalır"); };
  const notionSema = (t: keyof typeof NOTION_TUR1) => Object.fromEntries(Object.entries(NOTION_TUR1[t][0].properties).map(([a, v]) => [a, { type: v.type }]));
  const gSon = son("GOOGLE_KISILER"), nSon = son("NOTION");
  const googleKisi = d.kisiler.filter((k) => k.googleResourceName).length;
  const notionKayit = d.kayitlar.filter((k) => k.notionId).length;

  return <div className="yigin">
    <div><h2>Bağlantılar</h2><p className="ipucu sayfa-aciklama">Notion tablolarınız ve Google Kişiler'iniz uygulamayla eşitlenir.</p></div>
    <Bilgi id="demo-baglanti">Demo: gerçek hesaplarınıza bağlanmaz. Gerçek Notion tablolarınızla aynı alan adlarını taşıyan örnek sayfalar ve örnek Google kişileriyle, canlı uygulamadaki senkron kodunun aynısı çalışır.</Bilgi>

    {/* ───── Notion ───── */}
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

    {/* ───── Google ───── */}
    <section className="kart baglanti-kart">
      <div className="bk-bas"><span className="bk-logo google" aria-hidden="true">G</span><div className="bk-ad"><h3>Google Kişiler</h3><span className="ipucu">{b.google.hesap ?? "Telefon rehberiniz"}</span></div>
        {b.google.durum === "BAGLI" ? <Pill ton="iyi">Bağlı</Pill> : <Pill>Bağlı değil</Pill>}</div>
      {b.google.durum !== "BAGLI" ? <>
        <p className="bk-metin">Telefonu olan kişileriniz Kişiler'e gelir; WhatsApp'tan yazan numara anında adıyla tanınır. Etiketleriniz (Emlakçılar, Yatırımcılar, Müteahhitler…) role dönüşür. Aynı numara zaten kayıtlıysa yeni kişi açılmaz, mevcut kişiyle birleşir.</p>
        <button className="btn birincil" onClick={() => setIzin("google")}>Google hesabını bağla</button>
      </> : <>
        <div className="bk-sayilar"><div><b>{googleKisi}</b><span>Google'a bağlı kişi</span></div><div><b>{d.kisiler.length}</b><span>toplam kişi</span></div><div><b>{saat(b.google.sonSenkron)}</b><span>son senkron</span></div></div>
        <div className="satir sar"><button className="btn birincil" onClick={() => calistir("google", "kullanici")}><Ikon ad="baglanti" boyut={16} /> Değişiklikleri çek{(d.googleBekleyen ?? []).length ? ` (${d.googleBekleyen!.length} yeni)` : ""}</button><button className="btn" onClick={() => { let ad = ""; guncelle((x) => { const r = demoGoogleKisiKaydet(x); ad = r.ad; return r.d; }); bildir(`Telefonda Google'a kaydedildi: ${ad || "yeni kişi"} — canlıda en geç 5 dakikada Kişiler'e gelir`); }}>📱 Telefonda Google'a kişi kaydet (benzetim)</button><button className="btn" onClick={() => git({ ad: "kisiler" })}>Kişileri gör</button><button className="btn" onClick={() => kopar("google")}>Bağlantıyı kaldır</button></div>
        {b.google.tur === 1 && <p className="ipucu">Sıradaki çekişte örnek olarak Google'da şunlar değişmiş olacak: Kemal Usta'nın şirketi güncellendi, "Annem" silindi, yeni bir emlakçı eklendi. Silinen kişi Anahtar'da silinmez; yalnızca Google bağı kopar.</p>}
        <Ayarlar b={b.google} set={ayarYaz("google")} google />
      </>}
      {gSon && <Rapor c={gSon} />}
    </section>

    {/* ───── Çakışmalar ───── */}
    {(d.cakismalar ?? []).length > 0 && <section className="kart cakisma-kart">
      <h3>Çakışmalar ({d.cakismalar.length})</h3>
      <p className="ipucu">Aynı alan hem burada hem dış kaynakta farklı değiştirilmiş. Siz seçene kadar uygulamadaki değer korunur.</p>
      <div className="toplu-cubuk">
        <label className="onay-satir"><input type="checkbox" checked={cSecim.size > 0 && cSecim.size === d.cakismalar.length} ref={(el) => { if (el) el.indeterminate = cSecim.size > 0 && cSecim.size < d.cakismalar.length; }} onChange={(e) => setCSecim(e.target.checked ? new Set(d.cakismalar.map((c) => c.id)) : new Set())} /> Tümünü seç ({d.cakismalar.length})</label>
        <button className="btn kucuk" disabled={!cSecim.size} onClick={() => topluCoz("YEREL")}>Seçilenlerde uygulamadaki kalsın ({cSecim.size})</button>
        <button className="btn kucuk" disabled={!cSecim.size} onClick={() => topluCoz("UZAK")}>Seçilenlerde {[...new Set(d.cakismalar.filter((c) => cSecim.has(c.id)).map((c) => cAd(c.saglayici)))].join("/") || "kaynaktakini"} al ({cSecim.size})</button>
      </div>
      {d.cakismalar.map((c) => <div key={c.id} className={cx("cakisma", cSecim.has(c.id) && "secili")}>
        <div className="satir-ara"><label className="onay-satir"><input type="checkbox" aria-label="Seç" checked={cSecim.has(c.id)} onChange={(e) => setCSecim((x) => { const n = new Set(x); e.target.checked ? n.add(c.id) : n.delete(c.id); return n; })} /><b>{c.baslik}</b></label><span className="ipucu">{ALAN_ETIKET[c.alan] ?? c.alan} · {c.saglayici === "NOTION" ? "Notion" : "Google"}</span></div>
        <div className="iki-deger">
          <button className="deger yerel" onClick={() => { guncelle((x) => demoCakismaCoz(x, c.id, "YEREL")); bildir("Uygulamadaki değer korundu"); }}><small>Uygulamadaki</small><b>{degerYaz(c.alan, c.yerel)}</b><span>Bu kalsın</span></button>
          <button className="deger uzak" onClick={() => { guncelle((x) => demoCakismaCoz(x, c.id, "UZAK")); bildir(`${c.saglayici === "NOTION" ? "Notion" : "Google"}'daki değer alındı`); }}><small>{c.saglayici === "NOTION" ? "Notion'daki" : "Google'daki"}</small><b>{degerYaz(c.alan, c.uzak)}</b><span>Bunu al</span></button>
        </div>
        {c.onceki != null && <div className="ipucu">Son eşitlemedeki değer: {degerYaz(c.alan, c.onceki)}</div>}
      </div>)}
    </section>}

    {(d.senkronGecmisi ?? []).length > 0 && <section className="kart"><h3>Senkron geçmişi</h3>
      <ul className="gecmis">{d.senkronGecmisi.map((c) => <li key={c.id}><span className={cx("g-ikon", c.saglayici === "NOTION" ? "notion" : "google")}>{c.saglayici === "NOTION" ? "N" : "G"}</span><span>{saat(c.tarih)}</span><span className="ipucu">{c.tetik === "ilk" ? "İlk içe aktarma" : c.tetik === "kullanici" ? "Elle" : "Otomatik"}</span><span>{["yeni", "guncellenen", "baglanan", "cakisma"].filter((k) => c.ozet[k]).map((k) => `${c.ozet[k]} ${OZET_ETIKET[k].toLocaleLowerCase("tr")}`).join(", ") || "değişiklik yok"}</span></li>)}</ul></section>}

    <details className="kart kurulum"><summary>Canlıya geçince — kurulum (yaklaşık 25 dk)</summary>
      <ol>
        <li><b>Notion:</b> notion.so/profile/integrations → Yeni dahili entegrasyon → gizli anahtarı kopyalayın. "Gayrimenkul CRM" sayfasında ••• → Bağlantılar → bu entegrasyonu ekleyin (üç tablo birlikte paylaşılır).</li>
        <li><b>Google:</b> console.cloud.google.com → yeni proje → People API'yi açın → OAuth izin ekranı (Harici, sonra "Yayınla / In production") → Kimlik bilgileri → OAuth istemcisi (Web) → yönlendirme adresi: <code>https://ADRESINIZ/api/entegrasyon/google/geri-donus</code></li>
        <li><b>Vercel → Settings → Environment Variables:</b> NOTION_TOKEN, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, UYGULAMA_URL, ENTEGRASYON_SIFRE_ANAHTARI, CRON_SECRET (son ikisini Claude Code üretir).</li>
        <li><b>Supabase → SQL Editor:</b> <code>prisma/sql/senkron_cron.sql</code> dosyasını adres ve CRON_SECRET'ı yazarak bir kez çalıştırın (her 15 dakikada otomatik senkron).</li>
        <li>Uygulamada Bağlantılar → "Notion'u bağla" ve "Google hesabını bağla". İlk içe aktarma raporunu kontrol edin.</li>
      </ol>
      <p className="ipucu">Uyarı: Google izin ekranını "Testing"de bırakırsanız Google bağlantıyı 7 günde bir düşürür. "In production"a alın; doğrulama gerekmez, ilk girişte "doğrulanmamış uygulama" uyarısını "Gelişmiş → devam et" ile geçersiniz.</p>
    </details>

    {izin && <IzinPenceresi baslik={izin === "google" ? "Google Kişiler erişimi" : "Notion erişimi"}
      maddeler={izin === "google" ? ["Kişilerinizi ve etiketlerinizi görme (salt okunur)", "E-posta adresinizi görme (hangi hesabın bağlı olduğunu göstermek için)", "Google'daki kişilerinizi değiştirmez, silmez"] : ["Paylaştığınız 3 tabloyu okuma", "Talep ve portföy sayfalarına 5 uygulama alanı ekleyip yalnızca onları güncelleme (Eşleşme Skoru, Eşleşme Sayısı, En İyi Eşleşme, Uygulama Linki, Son Senkron)", "Sizin alanlarınızı değiştirmez, sayfa silmez"]}
      kapat={() => setIzin(null)} onay={() => { const k = izin; setIzin(null); calistir(k, "ilk"); }} />}
  </div>;
}