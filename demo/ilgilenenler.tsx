/**
 * Anahtar CRM v3.31 · 15 Ekim 2026
 * İlgilenenler / gösterilenler — bir talep ya da portföy için kimlerin ilgilendiği, kime sunulduğu, kime gösterildiği.
 * Kapalı gelir, başlıkta sayı görünür: "İlgilenenler (3)". Kişi rehberden seçilir; durum değişince Bugün panosu görev üretir.
 * Kişi kartında aynı kayıtlar "Gösterilen portföyler" olarak görünür.
 */
import React, { useState } from "react";
import { useDepo, Bolum, baslikOf, tarihYaz, cx } from "./ortak";
import { IletisimDugmeleri, KisiSecici } from "./kisiler";
import { IL_DURUMLARI, IL_ETIKET, ilgilenenOzet, ilgilenenleriOf, kisininIlgileri, type IlgiDurumu } from "../src/lib/domain/gorev";
import { ilgilenenKaydet, ilgilenenSil } from "./bugun-eylem";
import type { Kayit } from "./depo";

export function IlgilenenlerBolumu({ k }: { k: Kayit }) {
  const { d, guncelle, bildir, git } = useDepo();
  const liste = ilgilenenleriOf(d.ilgilenenler, k.id);
  const [kisiId, setKisiId] = useState("");
  const [durum, setDurum] = useState<IlgiDurumu>("ILGILENDI");
  const [not, setNot] = useState("");
  const talep = k.veri.tip === "TALEP";
  const ekle = () => {
    if (!kisiId) return;
    guncelle((x) => ilgilenenKaydet(x, { kayitId: k.id, kisiId, durum, not: not.trim() || null }));
    bildir("İlgilenen kaydedildi"); setKisiId(""); setNot(""); setDurum("ILGILENDI");
  };
  return <Bolum baslik={`İlgilenenler (${liste.length})`} ozet={liste.length ? ilgilenenOzet(liste) : "Kimler ilgilendi, kime gösterildi"}>
    <p className="ipucu">{talep ? "Bu müşteriye sunduğunuz ya da gösterdiğiniz portföy sahipleri / emlakçılar." : "Bu portföyle ilgilenen, kendisine sunulan ya da yer gösterilen kişiler."} Durum değiştikçe Bugün panosuna takip görevi düşer.</p>
    {liste.length > 0 && <ul className="ilgi-liste">{liste.map((i) => {
      const kisi = d.kisiler.find((x) => x.id === i.kisiId);
      return <li key={i.id} className="ilgi-satir">
        <div className="ilgi-ust">
          <button type="button" className="gorev-ad" onClick={() => git({ ad: "kisi", id: i.kisiId })}><b>{kisi?.adSoyad ?? "Silinmiş kişi"}</b><small className="ipucu">{tarihYaz(i.tarih)}{i.not ? " · " + i.not : ""}</small></button>
          <IletisimDugmeleri tel={kisi?.telefon} ad={kisi?.adSoyad} kucuk />
        </div>
        <div className="cip-satir" role="group" aria-label="İlgi durumu">{IL_DURUMLARI.map((s) => <button key={s} type="button" className={cx("cip secilir", i.durum === s && "on")} aria-pressed={i.durum === s} onClick={() => { if (i.durum !== s) { guncelle((x) => ilgilenenKaydet(x, { kayitId: k.id, kisiId: i.kisiId, durum: s, not: i.not })); bildir(`${kisi?.adSoyad ?? "Kişi"}: ${IL_ETIKET[s]}`); } }}>{IL_ETIKET[s]}</button>)}
          <button type="button" className="link-btn" onClick={() => { guncelle((x) => ilgilenenSil(x, i.id)); bildir("Listeden çıkarıldı"); }}>Çıkar</button></div>
      </li>;
    })}</ul>}
    <div className="ilgi-ekle">
      <div className="alan-etiket">Kişi ekle</div>
      <KisiSecici secili={kisiId ? [{ kisiId, rol: "DIGER" }] : []} degis={(b) => setKisiId(b[b.length - 1]?.kisiId ?? "")} />
      <div className="cip-satir" role="group" aria-label="Durum">{IL_DURUMLARI.map((s) => <button key={s} type="button" className={cx("cip secilir", durum === s && "on")} aria-pressed={durum === s} onClick={() => setDurum(s)}>{IL_ETIKET[s]}</button>)}</div>
      <input aria-label="İlgi notu" placeholder="Not (isteğe bağlı)" value={not} onChange={(e) => setNot(e.target.value)} maxLength={300} />
      <button type="button" className="btn kucuk birincil" disabled={!kisiId} onClick={ekle}>Ekle</button>
    </div>
  </Bolum>;
}

/** Kişi kartı: bu kişiye gösterilen / sunulan / ilgilendiği kayıtlar */
export function GosterilenPortfoyler({ kisiId }: { kisiId: string }) {
  const { d, git } = useDepo();
  const liste = kisininIlgileri(d.ilgilenenler, kisiId).filter((i) => d.kayitlar.some((k) => k.id === i.kayitId));
  if (!liste.length) return null;
  return <Bolum baslik={`Gösterilen portföyler (${liste.length})`} ozet={ilgilenenOzet(liste)}>
    <ul className="ilgi-liste">{liste.map((i) => { const k = d.kayitlar.find((x) => x.id === i.kayitId)!; return <li key={i.id} className="ilgi-satir"><button type="button" className="gorev-ad" onClick={() => git({ ad: "detay", id: k.id })}><b>{baslikOf(k.veri)}</b><small className="ipucu">{IL_ETIKET[i.durum]} · {tarihYaz(i.tarih)}{i.not ? " · " + i.not : ""}</small></button></li>; })}</ul>
  </Bolum>;
}
