/**
 * Anahtar CRM v3.22.1 · 9 Ekim 2026
 * Demo — "Portföy paylaş": portföyü danışmanın kendi ilanı gibi gösteren föy. PDF (her cihazda açılır), görsel (JPG) ve WhatsApp metni.
 * Föyde mülk sahibinin / mesajı gönderenin bilgisi YOKTUR; alttaki imza Ayarlar › Portföy paylaşım imzası'ndan gelir, burada değiştirilebilir.
 * İçerik ve PDF yazıcısı: src/lib/paylasim/foy.ts · çizim: tuval (canvas).
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useDepo, baslikOf, fiyatOf, m2Of, lokEtiket } from "./ortak";
import { paylasimAyari, type Kayit } from "./depo";
import { etiket } from "./etiketler";
import { PaylasimAyarSchema, type PaylasimAyar } from "../src/lib/domain/ayarlar";
import { foyMetni, foyDosyaAdi, iletisimiGizle, pdfOlustur, type FoyIcerik, type PdfSayfasi } from "../src/lib/paylasim/foy";
import { fotoOku, goruntuAc } from "./foto";
import { dosyaIndir, dosyaPaylas, paylasilabilirMi, sonucMesaji } from "./dosya";
import { ilAdiOf, ilceIli, calismaIliOku } from "./lokasyon";
import { TelGirdisi } from "./girdi";
import { telBicimle } from "../src/lib/iletisim";

const EN = 1240, BOY = 1754, K = 84; // A4 oranı (150 dpi), kenar boşluğu
const R = { lacivert: "#14213d", yesil: "#0f6e6a", altin: "#e0ad4b", murekkep: "#1a2233", soluk: "#6b7385", cizgi: "#e2e6ee", zemin: "#f6f7fa" };
const yaziTipi = () => { try { return getComputedStyle(document.body).fontFamily || "system-ui, sans-serif"; } catch { return "system-ui, sans-serif"; } };

function satirlar(x: CanvasRenderingContext2D, metin: string, genislik: number, enCok: number): string[] {
  const out: string[] = [];
  for (const paragraf of metin.split("\n")) {
    let satir = "";
    for (const kelime of paragraf.split(/\s+/).filter(Boolean)) {
      const dene = satir ? satir + " " + kelime : kelime;
      if (x.measureText(dene).width <= genislik || !satir) satir = dene; else { out.push(satir); satir = kelime; }
      if (out.length >= enCok) break;
    }
    if (out.length >= enCok) break;
    out.push(satir);
  }
  const kesildi = out.length > enCok || (out.length === enCok && out.join(" ").replace(/\s+/g, " ").length < metin.replace(/\s+/g, " ").trim().length);
  const son = out.slice(0, enCok);
  if (kesildi && son.length) { let s = son[son.length - 1]; while (s && x.measureText(s + "…").width > genislik) s = s.slice(0, -1); son[son.length - 1] = s.replace(/[\s,.;:]+$/, "") + "…"; }
  return son;
}
function yuvarlak(x: CanvasRenderingContext2D, a: number, b: number, w: number, h: number, r: number) {
  x.beginPath(); x.moveTo(a + r, b); x.arcTo(a + w, b, a + w, b + h, r); x.arcTo(a + w, b + h, a, b + h, r); x.arcTo(a, b + h, a, b, r); x.arcTo(a, b, a + w, b, r); x.closePath();
}
/** Görüntüyü kutuyu dolduracak biçimde (kırparak) çizer */
function kapla(x: CanvasRenderingContext2D, g: { kaynak: CanvasImageSource; en: number; boy: number }, a: number, b: number, w: number, h: number, r = 0) {
  const o = Math.max(w / g.en, h / g.boy), sw = w / o, sh = h / o;
  x.save(); if (r) { yuvarlak(x, a, b, w, h, r); x.clip(); }
  x.drawImage(g.kaynak, (g.en - sw) / 2, (g.boy - sh) / 2, sw, sh, a, b, w, h);
  x.restore();
}
function imzaCiz(x: CanvasRenderingContext2D, imza: PaylasimAyar, ust: number, f: string) {
  x.fillStyle = R.lacivert; x.fillRect(0, ust, EN, BOY - ust);
  x.fillStyle = R.altin; x.fillRect(0, ust, EN, 6);
  const orta = ust + (BOY - ust) / 2;
  x.textBaseline = "alphabetic"; x.textAlign = "left";
  x.fillStyle = "#fff"; x.font = `700 42px ${f}`; x.fillText(imza.adSoyad.toLocaleUpperCase("tr"), K, orta + 2);
  const alt = [imza.unvan, imza.firma].filter(Boolean).join(" · ");
  if (alt) { x.fillStyle = "#c3cbdd"; x.font = `400 25px ${f}`; x.fillText(alt, K, orta + 44); }
  x.textAlign = "right";
  x.fillStyle = "#c3cbdd"; x.font = `600 20px ${f}`; x.fillText("İ L E T İ Ş İ M", EN - K, orta - 30);
  x.fillStyle = R.altin; x.font = `700 46px ${f}`; x.fillText(imza.telefon, EN - K, orta + 26);
  x.textAlign = "left";
}
type Goruntu = Awaited<ReturnType<typeof goruntuAc>>;

/** Föyün ilk sayfası */
function foyCiz(ic: FoyIcerik, fotolar: Goruntu[]): HTMLCanvasElement {
  const c = document.createElement("canvas"); c.width = EN; c.height = BOY;
  const x = c.getContext("2d")!, f = yaziTipi();
  x.fillStyle = "#fff"; x.fillRect(0, 0, EN, BOY);
  const imzaUst = BOY - 200;
  // Üst: kapak fotoğrafı ya da lacivert bant
  let y: number;
  if (fotolar[0]) {
    const h = fotolar.length > 1 ? 600 : 700; kapla(x, fotolar[0], 0, 0, EN, h);
    const g = x.createLinearGradient(0, h - 260, 0, h); g.addColorStop(0, "rgba(10,14,26,0)"); g.addColorStop(1, "rgba(10,14,26,.72)");
    x.fillStyle = g; x.fillRect(0, h - 260, EN, 260);
    y = h;
  } else {
    const h = 300; x.fillStyle = R.lacivert; x.fillRect(0, 0, EN, h);
    x.strokeStyle = "rgba(255,255,255,.07)"; x.lineWidth = 2;
    for (let i = -h; i < EN; i += 46) { x.beginPath(); x.moveTo(i, h); x.lineTo(i + h, 0); x.stroke(); }
    y = h;
  }
  // Rozetler (işlem · tip) üst bölümün altına oturur
  x.textBaseline = "middle"; x.font = `700 26px ${f}`;
  let rx = K; const ry = y - 74;
  for (const [metin, dolu] of [[ic.islem.toLocaleUpperCase("tr"), true], [ic.tip.toLocaleUpperCase("tr"), false]] as const) {
    if (!metin) continue;
    const w = x.measureText(metin).width + 44;
    yuvarlak(x, rx, ry, w, 50, 25); x.fillStyle = dolu ? R.altin : "rgba(255,255,255,.92)"; x.fill();
    x.fillStyle = R.lacivert; x.fillText(metin, rx + 22, ry + 26); rx += w + 14;
  }
  x.textBaseline = "alphabetic";
  y += 86;
  // Başlık
  x.fillStyle = R.murekkep; x.font = `700 54px ${f}`;
  for (const s of satirlar(x, ic.baslik, EN - 2 * K, 2)) { x.fillText(s, K, y); y += 66; }
  // Konum
  if (ic.konum) {
    y += 2; x.fillStyle = R.yesil; x.beginPath(); x.arc(K + 9, y - 10, 9, 0, Math.PI * 2); x.fill();
    x.fillStyle = "#fff"; x.beginPath(); x.arc(K + 9, y - 10, 3.5, 0, Math.PI * 2); x.fill();
    x.fillStyle = R.soluk; x.font = `400 30px ${f}`; x.fillText(satirlar(x, ic.konum, EN - 2 * K - 34, 1)[0] ?? "", K + 32, y); y += 30;
  }
  // Fiyat
  if (ic.fiyat) { y += 62; x.fillStyle = R.yesil; x.font = `700 70px ${f}`; x.fillText(ic.fiyat, K, y); y += 10; }
  y += 34; x.fillStyle = R.cizgi; x.fillRect(K, y, EN - 2 * K, 2); y += 2;
  // Özellikler: 3 sütun
  const oz = ic.ozellikler.slice(0, 9);
  if (oz.length) {
    const sutun = 3, w = (EN - 2 * K) / sutun; y += 50;
    oz.forEach(([e, d], i) => {
      const cx0 = K + (i % sutun) * w, cy = y + Math.floor(i / sutun) * 100;
      x.fillStyle = R.soluk; x.font = `600 20px ${f}`; x.fillText(e.toLocaleUpperCase("tr"), cx0, cy);
      x.fillStyle = R.murekkep; x.font = `600 31px ${f}`; x.fillText(satirlar(x, d, w - 24, 1)[0] ?? "", cx0, cy + 40);
    });
    y += Math.ceil(oz.length / sutun) * 100 - 30;
    x.fillStyle = R.cizgi; x.fillRect(K, y, EN - 2 * K, 2); y += 2;
  }
  // Açıklama önceliklidir; yer kalırsa küçük fotoğraflar (hepsi zaten sonraki sayfalarda büyük görünür)
  const ekFoto = fotolar.slice(1, 4), fotoH = 214;
  x.font = `400 27px ${f}`;
  const bos = imzaUst - 44 - y;
  if (ic.aciklama && bos > 70) {
    const tum = satirlar(x, ic.aciklama, EN - 2 * K, 99).length;
    const fotoluSigar = ekFoto.length > 0 && bos - (fotoH + 40) - 30 >= Math.min(tum, 3) * 40;
    const enCok = Math.max(1, Math.floor(((fotoluSigar ? bos - fotoH - 40 : bos) - 30) / 40));
    y += 52; x.fillStyle = R.murekkep;
    for (const s of satirlar(x, ic.aciklama, EN - 2 * K, enCok)) { x.fillText(s, K, y); y += 40; }
    y -= 14;
  }
  if (ekFoto.length && imzaUst - 40 - y >= fotoH + 30) {
    const bosluk = 18, w = (EN - 2 * K - bosluk * (ekFoto.length - 1)) / ekFoto.length, fy = imzaUst - 40 - fotoH;
    ekFoto.forEach((g, i) => kapla(x, g, K + i * (w + bosluk), fy, w, fotoH, 14));
  }
  imzaCiz(x, ic.imza, imzaUst, f);
  return c;
}
/** Ek fotoğraf sayfası: 1 ya da 2 büyük fotoğraf + imza */
function fotoSayfasiCiz(ic: FoyIcerik, fotolar: Goruntu[]): HTMLCanvasElement {
  const c = document.createElement("canvas"); c.width = EN; c.height = BOY;
  const x = c.getContext("2d")!, f = yaziTipi();
  x.fillStyle = "#fff"; x.fillRect(0, 0, EN, BOY);
  const imzaUst = BOY - 150, ust = 110;
  x.fillStyle = R.murekkep; x.font = `700 32px ${f}`; x.fillText(satirlar(x, ic.baslik, EN - 2 * K, 1)[0] ?? "", K, 74);
  const bosluk = 28, h = (imzaUst - ust - 40 - bosluk * (fotolar.length - 1)) / fotolar.length;
  fotolar.forEach((g, i) => kapla(x, g, K, ust + i * (h + bosluk), EN - 2 * K, h, 16));
  imzaCiz(x, ic.imza, imzaUst, f);
  return c;
}
const jpegAl = (c: HTMLCanvasElement, kalite = 0.88) => new Promise<Blob>((coz, ret) => c.toBlob((b) => (b ? coz(b) : ret(new Error("Görsel oluşturulamadı"))), "image/jpeg", kalite));

export function PortfoyPaylas({ k, teknik, kapat }: { k: Kayit; teknik: [string, string][]; kapat: () => void }) {
  const { d, bildir } = useDepo();
  const v = k.veri;
  const [imza, setImza] = useState<PaylasimAyar>(paylasimAyari(d));
  const [aciklama, setAciklama] = useState(() => iletisimiGizle(v.ozet ?? ""));
  const [fiyatGoster, setFiyatGoster] = useState(true);
  const [fotoEkle, setFotoEkle] = useState(true);
  const [onizleme, setOnizleme] = useState<string | null>(null);
  const [mesgul, setMesgul] = useState<string | null>(null);
  const [goruntuler, setGoruntuler] = useState<Goruntu[] | null>(null);
  const acik = useRef<Goruntu[]>([]);
  const fotolar = k.fotolar ?? [];

  const icerik = useMemo<FoyIcerik>(() => {
    const l = v.lokasyonlar.find((x) => x.birincil) ?? v.lokasyonlar[0];
    const il = l ? ilAdiOf(ilceIli(l.ilceId) ?? l.ilId ?? calismaIliOku()) : "";
    const yer = l ? lokEtiket(l).replace(/ · .*$/, "").replace(/\s*\(il geneli\)/, "") : "";
    const ozellikler: [string, string][] = [
      ...(m2Of(v) ? [["Alan", m2Of(v)] as [string, string]] : []),
      ...(v.netM2 != null ? [["Net alan", `${v.netM2.toLocaleString("tr-TR")} m²`] as [string, string]] : []),
      ...(v.odaSayisi ? [["Oda", String(v.odaSayisi)] as [string, string]] : []),
      ...(v.krediyeUygun ? [["Kredi", "Krediye uygun"] as [string, string]] : []),
      ...teknik,
    ];
    return {
      baslik: iletisimiGizle(baslikOf(v)), islem: etiket(v.islemTipi), tip: etiket(v.mulkTipi),
      konum: [yer, yer === il ? "" : il].filter(Boolean).join(", "),
      fiyat: fiyatGoster && (v.fiyat != null) ? fiyatOf(v) : "",
      ozellikler, aciklama: aciklama.trim(), imza: { ...imza, telefon: telBicimle(imza.telefon).replace(/^\+90 /, "0") || imza.telefon },
    };
  }, [v, teknik, aciklama, fiyatGoster, imza]);

  // Fotoğrafları bir kez aç
  useEffect(() => {
    let iptal = false;
    (async () => {
      const out: Goruntu[] = [];
      for (const f of fotolar) { const r = await fotoOku(f.id); if (r) { try { out.push(await goruntuAc(r.blob)); } catch { /* açılamayan atlanır */ } } }
      if (iptal) { out.forEach((g) => g.kapat()); return; }
      acik.current = out; setGoruntuler(out);
    })();
    return () => { iptal = true; acik.current.forEach((g) => g.kapat()); acik.current = []; };
  }, [fotolar.map((f) => f.id).join(",")]);

  const kullanilan = fotoEkle ? goruntuler ?? [] : [];
  // Önizleme (yazarken gecikmeli)
  useEffect(() => {
    if (!goruntuler) return;
    const t = setTimeout(async () => { try { await (document as any).fonts?.ready; } catch { /* yoksay */ } setOnizleme(foyCiz(icerik, kullanilan).toDataURL("image/jpeg", 0.7)); }, 250);
    return () => clearTimeout(t);
  }, [icerik, goruntuler, fotoEkle]);

  const imzaGecerli = PaylasimAyarSchema.safeParse(imza).success && imza.telefon.trim().length >= 7;
  const pdfUret = async (): Promise<Blob> => {
    const sayfalar: PdfSayfasi[] = [];
    const ekle = async (c: HTMLCanvasElement) => sayfalar.push({ jpeg: new Uint8Array(await (await jpegAl(c)).arrayBuffer()), en: c.width, boy: c.height });
    await ekle(foyCiz(icerik, kullanilan));
    for (let i = 1; i < kullanilan.length; i += 2) await ekle(fotoSayfasiCiz(icerik, kullanilan.slice(i, i + 2)));
    return new Blob([pdfOlustur(sayfalar, icerik.baslik) as BlobPart], { type: "application/pdf" });
  };
  const calistir = async (ad: string, is: () => Promise<string | null>) => { setMesgul(ad); try { const m = await is(); if (m) bildir(m); } catch (e: any) { bildir(e?.message ?? "Hazırlanamadı"); } finally { setMesgul(null); } };
  const pdfIndir = () => calistir("PDF hazırlanıyor…", async () => sonucMesaji(await dosyaIndir(foyDosyaAdi(icerik, "pdf"), await pdfUret()), "PDF indirildi"));
  const gorselIndir = () => calistir("Görsel hazırlanıyor…", async () => sonucMesaji(await dosyaIndir(foyDosyaAdi(icerik, "jpg"), await jpegAl(foyCiz(icerik, kullanilan), 0.9)), "Görsel indirildi"));
  const paylas = () => calistir("Hazırlanıyor…", async () => {
    const dosya = new File([await pdfUret()], foyDosyaAdi(icerik, "pdf"), { type: "application/pdf" });
    if (!paylasilabilirMi([dosya])) return "Bu cihazda doğrudan paylaşım yok — PDF'i indirip gönderebilirsiniz";
    const s = await dosyaPaylas([dosya], icerik.baslik);
    return s === "olmadi" ? "Paylaşım açılamadı — PDF'i indirip gönderebilirsiniz" : null;
  });
  const metniKopyala = async () => { try { await navigator.clipboard.writeText(foyMetni(icerik)); bildir("Metin kopyalandı — WhatsApp'a yapıştırabilirsiniz"); } catch { bildir("Kopyalanamadı"); } };
  const paylasVar = typeof navigator !== "undefined" && typeof navigator.share === "function";

  return <div className="perde" onClick={kapat}><div className="panel foy-panel" role="dialog" aria-label="Portföy paylaş" onClick={(e) => e.stopPropagation()}>
    <div className="satir-ara"><h2>Portföy paylaş</h2><button className="btn kucuk" onClick={kapat}>Kapat</button></div>
    <div className="foy-govde">
      <div className="foy-onizleme">{onizleme ? <img src={onizleme} alt="Föy önizlemesi" /> : <span className="ipucu">Önizleme hazırlanıyor…</span>}</div>
      <div className="yigin kucuk-bosluk">
        <div className="satir sar">
          <button className="btn birincil" disabled={!!mesgul || !imzaGecerli} onClick={pdfIndir}>{mesgul ?? "PDF indir"}</button>
          {paylasVar && <button className="btn" disabled={!!mesgul || !imzaGecerli} onClick={paylas}>Paylaş</button>}
          <button className="btn" disabled={!!mesgul || !imzaGecerli} onClick={gorselIndir}>Görsel (JPG)</button>
          <button className="btn" onClick={metniKopyala}>Metni kopyala</button>
        </div>
        <p className="ipucu">Föyde mülk sahibinin adı ve telefonu yer almaz; yalnızca aşağıdaki imza görünür.{fotolar.length > 1 && fotoEkle ? ` PDF ${1 + Math.ceil((fotolar.length - 1) / 2)} sayfa: föy + fotoğraflar.` : ""}</p>
        <div className="alan"><label htmlFor="foy-aciklama">Açıklama</label>
          <textarea id="foy-aciklama" rows={4} value={aciklama} onChange={(e) => setAciklama(e.target.value)} placeholder="Müşterinin göreceği kısa tanıtım (isteğe bağlı)" />
          {v.hamMetin && <button type="button" className="btn kucuk" onClick={() => setAciklama(iletisimiGizle(v.hamMetin!).slice(0, 700))}>İlan metnini getir (telefonlar silinir)</button>}
        </div>
        <label className="onay-satir"><input type="checkbox" checked={fiyatGoster} onChange={(e) => setFiyatGoster(e.target.checked)} /> <span>Fiyatı göster</span></label>
        {fotolar.length > 0 && <label className="onay-satir"><input type="checkbox" checked={fotoEkle} onChange={(e) => setFotoEkle(e.target.checked)} /> <span>Fotoğrafları ekle ({fotolar.length})</span></label>}
        <div className="alan-etiket">İmza</div>
        <div className="alanlar">
          <div className="alan"><label htmlFor="foy-ad">Ad soyad</label><input id="foy-ad" value={imza.adSoyad} onChange={(e) => setImza({ ...imza, adSoyad: e.target.value })} /></div>
          <div className="alan"><label htmlFor="foy-tel">Telefon</label><TelGirdisi id="foy-tel" deger={imza.telefon} onChange={(t) => setImza({ ...imza, telefon: t })} /></div>
          <div className="alan"><label htmlFor="foy-unvan">Unvan</label><input id="foy-unvan" value={imza.unvan} onChange={(e) => setImza({ ...imza, unvan: e.target.value })} /></div>
          <div className="alan"><label htmlFor="foy-firma">Firma</label><input id="foy-firma" value={imza.firma} onChange={(e) => setImza({ ...imza, firma: e.target.value })} /></div>
        </div>
      </div>
    </div>
  </div></div>;
}