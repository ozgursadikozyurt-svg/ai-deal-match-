/**
 * Anahtar CRM v3.40 · 23 Ekim 2026
 * İlk kaynak — formda seçici (yeni kayıtta ya da boşsa bir kez), kilitliyse yalnızca gösterim; detayda kaynak satırları.
 * Kurallar src/lib/domain/ilk-kaynak.ts'te; sunucu aynı kuralı ayrıca uygular (src/lib/services/durum.ts).
 */
import React from "react";
import { ILK_KAYNAKLAR, ILK_KAYNAK_ETIKET, ilkKaynakGecerli, tahminIlkKaynak, yanitDakika, type IlkKaynak } from "../src/lib/domain/ilk-kaynak";
import { yetkiAktif } from "./yonetim";
import { tarihYaz } from "./ortak";
import { useKampanyaAdlari } from "./kampanyalar";

const sureYaz = (dk: number) => (dk < 60 ? `${dk} dk` : dk < 1440 ? `${Math.floor(dk / 60)} sa ${dk % 60} dk` : `${Math.floor(dk / 1440)} gün`);

/** Formdaki alan. `kilitli`: kayıtta değer var ve kullanıcı düzeltemez. */
export function IlkKaynakAlani({ f, set, kayitliDeger }: { f: any; set: (k: string, v: any) => void; kayitliDeger?: { ilkKaynak?: string | null; ilkKaynakTarihi?: string | Date | null } }) {
  const duzeltebilir = yetkiAktif("kaynak.duzelt");
  const kayitli = ilkKaynakGecerli(kayitliDeger?.ilkKaynak) ? (kayitliDeger!.ilkKaynak as IlkKaynak) : null;
  const tahmin = tahminIlkKaynak(f);
  const kampanyalar = useKampanyaAdlari();
  const reklamMi = ["META_REKLAM", "GOOGLE_REKLAM", "REKLAM"].includes(f.ilkKaynak ?? "");
  if (kayitli && !duzeltebilir) return <div className="alan genis">
    <label>İlk kaynak <span aria-hidden="true">🔒</span></label>
    <div><b>{ILK_KAYNAK_ETIKET[kayitli]}</b>{f.ilkKaynakDetay ? ` · ${f.ilkKaynakDetay}` : ""}{kayitliDeger?.ilkKaynakTarihi ? <span className="ipucu"> · {tarihYaz(kayitliDeger.ilkKaynakTarihi as any, true)}</span> : null}</div>
    <p className="ipucu">Kaydın ilk geldiği kanal açılışta yazılır ve kilitlenir (reklam ve asistan performansı bu bilgiyle ölçülür). Yalnızca ofis yöneticisi düzeltebilir.</p>
  </div>;
  return <>
    <div className="alan">
      <label htmlFor="f-ilk-kaynak">İlk kaynak {kayitli ? <small className="ipucu">· düzeltme kayda geçer</small> : <small className="ipucu">· kayıttan sonra kilitlenir</small>}</label>
      <select id="f-ilk-kaynak" value={ilkKaynakGecerli(f.ilkKaynak) ? f.ilkKaynak : ""} onChange={(e) => set("ilkKaynak", e.target.value || null)}>
        <option value="">{tahmin ? `Otomatik: ${ILK_KAYNAK_ETIKET[tahmin]}` : "Seçin (Meta, Google, telefon, referans…)"}</option>
        {ILK_KAYNAKLAR.map((k) => <option key={k} value={k}>{ILK_KAYNAK_ETIKET[k]}</option>)}
      </select>
    </div>
    <div className="alan">
      <label htmlFor="f-ilk-detay">Kampanya / liste <small className="ipucu">· isteğe bağlı</small></label>
      <input id="f-ilk-detay" list="f-kampanyalar" maxLength={200} value={f.ilkKaynakDetay ?? ""} onChange={(e) => set("ilkKaynakDetay", e.target.value || null)} placeholder={reklamMi ? "Listeden kampanya seçin" : "Ör. FSBO Aksu listesi · Meta – Kiralık depo Ekim"} />
      <datalist id="f-kampanyalar">{kampanyalar.filter((k) => !reklamMi || k.kanal === f.ilkKaynak || f.ilkKaynak === "REKLAM").map((k) => <option key={k.ad} value={k.ad} />)}</datalist>
    </div>
  </>;
}

/** Detaydaki "Kaynak" kartına eklenen satırlar */
export function IlkKaynakSatirlari({ v }: { v: { ilkKaynak?: string | null; ilkKaynakDetay?: string | null; ilkKaynakTarihi?: string | Date | null; ilkYanit?: string | Date | null } }) {
  const k = ilkKaynakGecerli(v.ilkKaynak) ? v.ilkKaynak : null;
  const dk = yanitDakika(v.ilkKaynakTarihi, v.ilkYanit);
  return <>
    <div><span>İlk kaynak</span><b>{k ? <>{ILK_KAYNAK_ETIKET[k]} <span aria-label="kilitli" title="Kilitli: yalnızca ofis yöneticisi düzeltebilir">🔒</span></> : "—"}</b></div>
    {v.ilkKaynakDetay && <div><span>Kampanya / liste</span><b>{v.ilkKaynakDetay}</b></div>}
    <div><span>İlk yanıt</span><b>{dk == null ? (k ? "henüz temas notu yok" : "—") : sureYaz(dk)}</b></div>
  </>;
}
