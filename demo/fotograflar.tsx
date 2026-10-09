/**
 * Anahtar CRM v3.22 · 9 Ekim 2026
 * Demo — portföy detayındaki "Fotoğraflar" bölümü: ekle (küçültülerek), kapak seç, sil, tek tek ya da toplu indir, paylaş.
 */
import { useEffect, useRef, useState } from "react";
import { zipSync } from "fflate";
import { useDepo, cx } from "./ortak";
import type { Kayit } from "./depo";
import { FOTO_SINIR, type FotoMeta } from "../src/lib/domain/foto";
import { fotoEkle, fotoOku, fotoSil, fotoKaliciMi } from "./foto";
import { dosyaIndir, dosyaPaylas, paylasilabilirMi, sonucMesaji } from "./dosya";

const dosyaAdi = (k: Kayit, f: FotoMeta, n: number) => `${(k.veri.baslik ?? "portfoy").toLocaleLowerCase("tr").replace(/[^a-z0-9çğıöşü]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "portfoy"}-${n + 1}.jpg`;

/** Küçük görsellerin adreslerini yükler (kayıt değişince yenilenir, çıkarken bırakılır) */
export function useFotoAdresleri(fotolar: FotoMeta[], buyuk = false): Record<string, string> {
  const [adres, setAdres] = useState<Record<string, string>>({});
  const anahtar = fotolar.map((f) => f.id).join(",");
  useEffect(() => {
    let iptal = false; const acilan: string[] = [];
    (async () => {
      const yeni: Record<string, string> = {};
      for (const f of fotolar) { const r = await fotoOku(f.id); if (r) { const u = URL.createObjectURL(buyuk ? r.blob : r.kucuk); acilan.push(u); yeni[f.id] = u; } }
      if (!iptal) setAdres(yeni);
    })();
    return () => { iptal = true; acilan.forEach((u) => URL.revokeObjectURL(u)); };
  }, [anahtar, buyuk]);
  return adres;
}

export function Fotograflar({ k }: { k: Kayit }) {
  const { kayitKaydet, bildir } = useDepo();
  const fotolar = k.fotolar ?? [];
  const adres = useFotoAdresleri(fotolar);
  const girdi = useRef<HTMLInputElement>(null);
  const [mesgul, setMesgul] = useState<string | null>(null);
  const [acik, setAcik] = useState<number | null>(null);
  const [buyuk, setBuyuk] = useState<string | null>(null);
  const [kalici, setKalici] = useState(true);
  useEffect(() => { fotoKaliciMi().then(setKalici); }, []);
  useEffect(() => {
    if (acik == null || !fotolar[acik]) { setBuyuk(null); return; }
    let u: string | null = null, iptal = false;
    fotoOku(fotolar[acik].id).then((r) => { if (r && !iptal) { u = URL.createObjectURL(r.blob); setBuyuk(u); } });
    return () => { iptal = true; if (u) URL.revokeObjectURL(u); };
  }, [acik, fotolar.map((f) => f.id).join(",")]);
  const yaz = (yeni: FotoMeta[]) => kayitKaydet({ ...k, fotolar: yeni });

  const ekle = async (dosyalar: FileList | null) => {
    if (!dosyalar?.length) return;
    const bos = FOTO_SINIR - fotolar.length;
    const secilen = [...dosyalar].filter((f) => f.type.startsWith("image/") || /\.(jpe?g|png|webp|heic)$/i.test(f.name)).slice(0, bos);
    if (!secilen.length) { bildir(bos <= 0 ? `En fazla ${FOTO_SINIR} fotoğraf eklenebilir` : "Fotoğraf dosyası seçin"); return; }
    const yeni = [...fotolar]; let hata = 0;
    for (const [n, f] of secilen.entries()) {
      setMesgul(`Küçültülüyor ${n + 1}/${secilen.length}…`);
      try { yeni.push(await fotoEkle(k.id, f)); } catch { hata++; }
    }
    setMesgul(null); yaz(yeni);
    bildir(`${secilen.length - hata} fotoğraf eklendi${hata ? `, ${hata} dosya açılamadı` : ""}${dosyalar.length > secilen.length ? ` (sınır ${FOTO_SINIR})` : ""}`);
    if (girdi.current) girdi.current.value = "";
  };
  const sil = async (i: number) => { const f = fotolar[i]; yaz(fotolar.filter((_, j) => j !== i)); setAcik(null); await fotoSil(f.id); bildir("Fotoğraf silindi"); };
  const kapakYap = (i: number) => { yaz([fotolar[i], ...fotolar.filter((_, j) => j !== i)]); setAcik(0); bildir("Kapak fotoğrafı değişti"); };
  const dosyalariAl = async (secim: number[]) => {
    const out: File[] = [];
    for (const i of secim) { const r = await fotoOku(fotolar[i].id); if (r) out.push(new File([r.blob], dosyaAdi(k, fotolar[i], i), { type: "image/jpeg" })); }
    return out;
  };
  const indir = async (i: number) => { const [f] = await dosyalariAl([i]); if (!f) return bildir("Fotoğraf bu cihazda bulunamadı"); const m = sonucMesaji(await dosyaIndir(f.name, f), "Fotoğraf indirildi"); if (m) bildir(m); };
  const hepsiniIndir = async () => {
    setMesgul("Hazırlanıyor…");
    const ds = await dosyalariAl(fotolar.map((_, i) => i));
    if (!ds.length) { setMesgul(null); return bildir("Fotoğraflar bu cihazda bulunamadı"); }
    const zip: Record<string, Uint8Array> = {};
    for (const f of ds) zip[f.name] = new Uint8Array(await f.arrayBuffer());
    const paket = new Blob([zipSync(zip, { level: 0 }) as BlobPart], { type: "application/zip" });
    setMesgul(null);
    const m = sonucMesaji(await dosyaIndir(ds[0].name.replace(/-1\.jpg$/, "") + "-fotograflar.zip", paket), `${ds.length} fotoğraf tek dosyada indirildi`); if (m) bildir(m);
  };
  const paylas = async (secim: number[]) => {
    const ds = await dosyalariAl(secim);
    const s = await dosyaPaylas(ds, k.veri.baslik ?? "Portföy fotoğrafları");
    if (s === "olmadi") bildir("Bu cihazda doğrudan paylaşım yok — indirip gönderebilirsiniz");
  };
  const paylasVar = typeof navigator !== "undefined" && typeof navigator.share === "function";

  return <section className="kart yigin kucuk-bosluk" id="fotograflar">
    <div className="satir-ara"><h3>Fotoğraflar{fotolar.length ? ` (${fotolar.length}/${FOTO_SINIR})` : ""}</h3>
      <div className="satir sar">
        {fotolar.length > 1 && <button className="btn kucuk" disabled={!!mesgul} onClick={hepsiniIndir}>Tümünü indir</button>}
        {fotolar.length > 0 && paylasVar && <button className="btn kucuk" disabled={!!mesgul} onClick={() => paylas(fotolar.map((_, i) => i))}>Paylaş</button>}
        <button className="btn kucuk birincil" disabled={!!mesgul || fotolar.length >= FOTO_SINIR} onClick={() => girdi.current?.click()}>{mesgul ?? "+ Fotoğraf ekle"}</button>
      </div>
    </div>
    <input ref={girdi} id="foto-girdi" type="file" accept="image/*" multiple hidden onChange={(e) => ekle(e.target.files)} />
    {fotolar.length ? <div className="foto-izgara">
      {fotolar.map((f, i) => <button key={f.id} type="button" className={cx("foto-kutu", i === 0 && "kapak")} onClick={() => setAcik(i)} aria-label={`Fotoğraf ${i + 1}${i === 0 ? " (kapak)" : ""}`}>
        {adres[f.id] ? <img src={adres[f.id]} alt="" loading="lazy" /> : <span className="foto-yok">Bu cihazda yok</span>}
        {i === 0 && <small>Kapak</small>}
      </button>)}
    </div> : <p className="ipucu">Henüz fotoğraf yok. Telefondan çekip ya da galeriden seçip en fazla {FOTO_SINIR} fotoğraf ekleyebilirsiniz; otomatik küçültülür.</p>}
    {!kalici && <p className="ipucu">Bu görünümde fotoğraflar yalnızca sayfa açıkken saklanır.</p>}
    {acik != null && fotolar[acik] && <div className="perde foto-perde" onClick={() => setAcik(null)}>
      <div className="foto-buyuk" role="dialog" aria-label="Fotoğraf" onClick={(e) => e.stopPropagation()}>
        <div className="foto-sahne">
          {buyuk ? <img src={buyuk} alt="" /> : <span className="foto-yok">Yükleniyor…</span>}
          {fotolar.length > 1 && <><button className="foto-ok sol" aria-label="Önceki" onClick={() => setAcik((acik + fotolar.length - 1) % fotolar.length)}>‹</button>
            <button className="foto-ok sag" aria-label="Sonraki" onClick={() => setAcik((acik + 1) % fotolar.length)}>›</button></>}
        </div>
        <div className="satir-ara">
          <span className="ipucu">{acik + 1} / {fotolar.length} · {(fotolar[acik].boyut / 1024).toFixed(0)} KB</span>
          <button className="btn kucuk" onClick={() => setAcik(null)}>Kapat</button>
        </div>
        <div className="satir sar">
          <button className="btn kucuk birincil" onClick={() => indir(acik)}>İndir</button>
          {paylasVar && <button className="btn kucuk" onClick={() => paylas([acik])}>Paylaş</button>}
          {acik !== 0 && <button className="btn kucuk" onClick={() => kapakYap(acik)}>Kapak yap</button>}
          <button className="btn kucuk tehlike" onClick={() => sil(acik)}>Sil</button>
        </div>
      </div>
    </div>}
  </section>;
}
/**
 * v3.22 — portföy kartındaki tek küçük fotoğraf (kapak = ilk sıradaki).
 * Kart ekrana girince yüklenir (uzun listede yüzlerce fotoğraf birden indirilmesin); fotoğraf yoksa hiçbir şey çizmez.
 */
export function KapakKucuk({ k, boyut = 56 }: { k: Kayit; boyut?: number }) {
  const fotolar = k.fotolar ?? [];
  const kapak = fotolar[0];
  const kutu = useRef<HTMLSpanElement>(null);
  const [gorundu, setGorundu] = useState(false);
  useEffect(() => {
    if (!kapak || gorundu) return;
    const el = kutu.current;
    if (!el || typeof IntersectionObserver === "undefined") { setGorundu(true); return; }
    const io = new IntersectionObserver((xs) => { if (xs.some((x) => x.isIntersecting)) { setGorundu(true); io.disconnect(); } }, { rootMargin: "200px" });
    io.observe(el);
    return () => io.disconnect();
  }, [kapak?.id, gorundu]);
  const adres = useFotoAdresleri(gorundu && kapak ? [kapak] : []);
  if (!kapak) return null;
  const u = adres[kapak.id];
  return <span ref={kutu} className="kapak-kucuk" style={{ width: boyut, height: boyut }} aria-label={`${fotolar.length} fotoğraf`}>
    {u ? <img src={u} alt="" loading="lazy" decoding="async" /> : <span className="kapak-bos" aria-hidden="true">▣</span>}
    {fotolar.length > 1 && <small className="kapak-say">{fotolar.length}</small>}
  </span>;
}
