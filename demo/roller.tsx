/**
 * Anahtar CRM v3.24 · 10 Ekim 2026
 * Ayarlar › Kişi rolleri: koda dokunmadan yeni rol ekle, adını değiştir, kullanılmayan özel rolü kaldır.
 * Sistem rolleri (11) kaldırılamaz ama yeniden adlandırılabilir. Tanımlar DepoDurumu.roller'da durur (canlıda Ayar tablosu, "roller" anahtarı).
 */
import { useState } from "react";
import { useDepo, cx } from "./ortak";
import { KISI_ROLLERI } from "./kisiler";
import { rolKoduUret, sistemRoluMu, ROL_SINIRI, type RolTanim } from "../src/lib/domain/roller";

export function RolYonetimi() {
  const { d, guncelle, bildir } = useDepo();
  const [yeni, setYeni] = useState("");
  const [duzen, setDuzen] = useState<RolTanim | null>(null);
  const kullanan = (kod: string) => d.kisiler.filter((k) => k.roller.includes(kod)).length;
  const yaz = (f: (r: RolTanim[]) => RolTanim[]) => guncelle((x) => ({ ...x, roller: f(x.roller ?? []) }));
  const ayniAd = (ad: string, haric?: string) => KISI_ROLLERI.some(([k, l]) => k !== haric && l.toLocaleLowerCase("tr") === ad.toLocaleLowerCase("tr"));

  const ekle = () => {
    const ad = yeni.trim();
    if (ad.length < 2) return;
    if (ayniAd(ad)) return bildir("Bu adla bir rol zaten var");
    if ((d.roller ?? []).length >= ROL_SINIRI) return bildir(`En fazla ${ROL_SINIRI} özel rol eklenebilir`);
    const kod = rolKoduUret(ad, KISI_ROLLERI.map(([k]) => k));
    yaz((r) => [...r, { kod, etiket: ad }]); setYeni(""); bildir(`Rol eklendi: ${ad}`);
  };
  const adKaydet = () => {
    if (!duzen) return;
    const e = duzen.etiket.trim();
    if (e.length < 2) return bildir("Rol adı en az 2 karakter olmalı");
    if (ayniAd(e, duzen.kod)) return bildir("Bu adla bir rol zaten var");
    yaz((r) => (r.some((x) => x.kod === duzen.kod) ? r.map((x) => (x.kod === duzen.kod ? { ...x, etiket: e } : x)) : [...r, { kod: duzen.kod, etiket: e }]));
    setDuzen(null); bildir("Rol adı güncellendi");
  };
  return <section className="kart yigin kucuk-bosluk" aria-label="Kişi rolleri">
    <details>
    <summary><b>Kişi rolleri</b> <small className="ipucu">{KISI_ROLLERI.length} rol</small></summary>
    <p className="ipucu">Eklediğiniz roller Kişiler ekranındaki filtrelere, kişi formlarına ve rol seçicilere hemen gelir. Sistem rolleri yeniden adlandırılabilir ama kaldırılamaz; özel roller yalnızca hiçbir kişide kullanılmıyorsa kaldırılabilir.</p>
    <div className="rol-liste">
    {KISI_ROLLERI.map(([kod, etiket]) => {
      const n = kullanan(kod), sistem = sistemRoluMu(kod), degismis = (d.roller ?? []).some((r) => r.kod === kod);
      return <div key={kod} className="rol-satir">
        {duzen?.kod === kod
          ? <><input aria-label="Rol adı" value={duzen.etiket} onChange={(e) => setDuzen({ ...duzen, etiket: e.target.value })} onKeyDown={(e) => { if (e.key === "Enter") adKaydet(); }} /><button className="btn kucuk birincil" onClick={adKaydet}>Kaydet</button><button className="btn kucuk" onClick={() => setDuzen(null)}>Vazgeç</button></>
          : <><b>{etiket}</b><small className="ipucu">{sistem ? "sistem rolü" : "özel rol"} · {n} kişi</small>
              <button className="btn kucuk" onClick={() => setDuzen({ kod, etiket })}>Düzenle</button>
              {sistem && degismis && <button className="btn kucuk" onClick={() => yaz((r) => r.filter((x) => x.kod !== kod))}>Varsayılana dön</button>}
              {!sistem && <button className={cx("btn kucuk tehlike")} disabled={n > 0} title={n ? "Kişilerde kullanılıyor; önce kişilerden çıkarın" : "Rolü kaldır"} onClick={() => { yaz((r) => r.filter((x) => x.kod !== kod)); bildir("Rol kaldırıldı"); }}>Kaldır</button>}</>}
      </div>;
    })}
    </div>
    <div className="satir"><input aria-label="Yeni rol adı" placeholder="Yeni rol adı (örn. Banka personeli)" value={yeni} onChange={(e) => setYeni(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") ekle(); }} /><button className="btn birincil" disabled={yeni.trim().length < 2} onClick={ekle}>Yeni rol ekle</button></div>
    </details>
  </section>;
}
