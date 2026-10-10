/**
 * Anahtar CRM v3.23 · 10 Ekim 2026
 * Canlı — Ayarlar ekranının "Hesap ve veri" kartı: giriş yapan e-posta, çıkış, yapay zekâ anahtarı durumu ve demodan alınan yedeği (JSON) canlıya yükleme.
 */
import { useEffect, useRef, useState } from "react";
import { CANLI, type Kayit, type Kisi } from "./depo";
import { useDepo, Pill } from "./ortak";
import { KayitCreateSchema } from "../src/lib/validation/kayit";

export interface YedekOzeti { kayit: number; kisi: number; atlanan: number; notlar: number; eslenen: number }

/**
 * Yedek dosyasındaki (demo ya da canlı "Tam yedek") kayıt ve kişileri mevcut verinin üstüne ekler. Kurallar:
 *  - kimliği zaten var olan kayıt / kişiye dokunulmaz (aynı dosyayı tekrar yüklemek zarar vermez);
 *  - kişi telefonla tekildir (uygulamanın kuralı): yedekteki kişinin telefonu mevcut bir kişide varsa yeni kişi açılmaz,
 *    yedekteki kayıtların kişi bağı o mevcut kişiye çevrilir (sunucu aynı telefonlu ikinci kişiyi reddeder, kayıtlar kaybolurdu);
 *  - şemaya uymayan kayıt atlanır ve sayılır.
 */
export function yedegiBirlestir(x: { kayitlar: Kayit[]; kisiler: Kisi[]; eslesmeNotlari: Record<string, any> }, y: any) {
  const kayitIds = new Set(x.kayitlar.map((k) => k.id)), kisiIds = new Set(x.kisiler.map((k) => k.id));
  const telefonlar = new Map<string, string>(); // telefon → kişi kimliği (mevcut + bu yüklemede eklenenler)
  for (const k of x.kisiler) { if (k.telefon) telefonlar.set(k.telefon, k.id); }
  const yonlendir = new Map<string, string>();  // yedekteki kişi kimliği → kullanılacak kişi kimliği
  const kisiler: Kisi[] = []; let eslenen = 0;
  for (const k of (y.kisiler ?? []) as Kisi[]) {
    if (!k?.id || !k.adSoyad) continue;
    if (kisiIds.has(k.id)) { yonlendir.set(k.id, k.id); continue; }
    const var_ = k.telefon ? telefonlar.get(k.telefon) : undefined;
    if (var_) { yonlendir.set(k.id, var_); eslenen++; continue; }
    kisiler.push({ ...k, kaynak: (k.kaynak === "GOOGLE" || k.kaynak === "NOTION") ? "MANUEL" : k.kaynak } as Kisi);
    yonlendir.set(k.id, k.id); kisiIds.add(k.id); if (k.telefon) telefonlar.set(k.telefon, k.id);
  }
  const kayitlar: Kayit[] = []; let atlanan = 0;
  for (const k of (y.kayitlar ?? []) as Kayit[]) {
    if (!k?.id || !k.veri || kayitIds.has(k.id)) continue;
    const baglar = (((k.veri as any).kisiler ?? []) as { kisiId: string; rol: string }[]).map((b) => ({ ...b, kisiId: yonlendir.get(b.kisiId) ?? b.kisiId })).filter((b) => kisiIds.has(b.kisiId));
    const p = KayitCreateSchema.safeParse({ ...k.veri, kisiler: baglar });
    if (!p.success) { atlanan++; continue; }
    kayitlar.push({ id: k.id, olusturma: k.olusturma ?? new Date().toISOString(), veri: p.data, notlar: k.notlar ?? [] });
  }
  const notlar = Object.entries((y.eslesmeNotlari ?? {}) as Record<string, any>).filter(([a]) => !(a in x.eslesmeNotlari));
  return { kayitlar, kisiler, eslesmeNotlari: Object.fromEntries(notlar), ozet: { kayit: kayitlar.length, kisi: kisiler.length, atlanan, notlar: notlar.length, eslenen } as YedekOzeti };
}

export function CanliAyarKarti() {
  const { d, guncelle, bildir } = useDepo();
  const dosya = useRef<HTMLInputElement>(null);
  const [aiVar, setAiVar] = useState<boolean | null>(null);
  const [hazir, setHazir] = useState<{ ad: string; veri: any } | null>(null);
  useEffect(() => { CANLI.api?.("/api/ayarlar").then((r) => r.json()).then((j) => setAiVar(!!j?.aiAnahtarVar)).catch(() => setAiVar(null)); }, []);
  const sec = async (f?: File) => {
    if (!f) return;
    try { const v = JSON.parse(await f.text()); if (!Array.isArray(v?.kayitlar) && !Array.isArray(v?.kisiler)) throw new Error(); setHazir({ ad: f.name, veri: v }); }
    catch { bildir("Bu dosya bir Anahtar CRM yedeği (JSON) gibi görünmüyor"); }
  };
  const yukle = () => {
    if (!hazir) return;
    const b = yedegiBirlestir(d as any, hazir.veri);
    guncelle((x) => ({ ...x, kayitlar: [...b.kayitlar, ...x.kayitlar], kisiler: [...b.kisiler, ...x.kisiler], eslesmeNotlari: { ...b.eslesmeNotlari, ...x.eslesmeNotlari } }));
    bildir(`Yedekten ${b.ozet.kayit} kayıt, ${b.ozet.kisi} kişi eklendi${b.ozet.eslenen ? ` (${b.ozet.eslenen} kişi zaten kayıtlı olduğu için mevcut kişiyle eşlendi)` : ""}${b.ozet.atlanan ? ` (${b.ozet.atlanan} kayıt şemaya uymadığı için atlandı)` : ""}`);
    setHazir(null); if (dosya.current) dosya.current.value = "";
  };
  return <section className="kart yigin kucuk-bosluk" id="ayar-hesap">
    <h3>Hesap ve veri</h3>
    <div className="satir sar"><span>Giriş yapılan hesap: <b>{CANLI.oturum?.eposta ?? "—"}</b></span><button className="btn kucuk" onClick={() => CANLI.oturum?.cikis()}>Çıkış yap</button></div>
    <div className="satir sar"><span>Yapay zekâ anahtarı (sunucuda):</span>{aiVar === null ? <Pill ton="notr">kontrol edilemedi</Pill> : aiVar ? <Pill ton="iyi">tanımlı</Pill> : <Pill ton="kotu">tanımlı değil — Cloudflare › AI_API_KEY</Pill>}</div>
    <hr />
    <h4>Demodan yedek yükle</h4>
    <p className="ipucu">Demoda Ayarlar › “Tam yedek (JSON)” ile indirdiğiniz dosyayı seçin. Kayıtlar, kişiler ve eşleşme notları buraya eklenir; kimliği zaten bulunanlara dokunulmaz, bu yüzden aynı dosyayı tekrar yüklemek zarar vermez. (Demoda cihazınızda tutulan fotoğraflar yedeğe girmez; canlıda yeniden eklenir.)</p>
    <div className="satir sar">
      <input ref={dosya} type="file" accept=".json,application/json" onChange={(e) => sec(e.target.files?.[0])} />
      {hazir && <button className="btn birincil" onClick={yukle}>“{hazir.ad}” dosyasını yükle</button>}
    </div>
  </section>;
}
