/**
 * Anahtar CRM v3.37 · 21 Ekim 2026
 * Demo — kaydedilmemiş değişiklik koruması.
 *
 * Özgür (21 Eki 2026): "Talep, portföy, işlem ya da kişi kaydederken yanlışlıkla başka bir menüye tıklayınca yaptıklarım kayboluyor;
 * ekrandan ayrılmadan 'Değişiklikleri kaydedelim mi?' diye sorulmalı."
 *
 * Değişiklik yapılmış her form kendini buraya yazar (useKaydedilmemis). Uygulama kabuğu ekran değiştirmeden önce (menü, "← Geri",
 * telefonun geri tuşu, bağlantılar) `bekleyenVarMi()`e bakar; varsa "Kaydet · Kaydetmeden çık · Vazgeç" penceresini açar.
 * Sekme / tarayıcı kapatılırken de tarayıcının kendi uyarısı çıkar (beforeunload).
 */
import { useEffect, useRef } from "react";

export interface Kaydedilmemis {
  /** Pencerede görünen ad: "Portföy formu", "Kişi bilgileri", "İşlem"… */
  ad: string;
  /** Kaydeder; başarılıysa true. false (doğrulama hatası) → ekranda kalınır, hatalar formda görünür. */
  kaydet: () => boolean | Promise<boolean>;
}

const kayitlar = new Map<number, Kaydedilmemis>();
let sayac = 0;

/** Şu an kaydedilmemiş değişikliği olan formlar (en son yazılan önce) */
export const bekleyenler = (): Kaydedilmemis[] => [...kayitlar.values()].reverse();
export const bekleyenVarMi = (): boolean => kayitlar.size > 0;
/** Kaydetmeden çıkılınca ya da ekran değişince hepsi bırakılır */
export const hepsiniBirak = () => kayitlar.clear();

/** Bekleyen formların hepsini sırayla kaydeder; biri kaydedilemezse durur ve false döner. */
export async function hepsiniKaydet(): Promise<boolean> {
  for (const [id, k] of [...kayitlar]) {
    let ok = false;
    try { ok = await k.kaydet(); } catch { ok = false; }
    if (!ok) return false;
    kayitlar.delete(id);
  }
  return true;
}

/**
 * Formda değişiklik varken (`degisti`) kaydı açık tutar; değişiklik kalmayınca, kaydedilince ya da form kapanınca bırakır.
 * `kaydet` her çizimde yenisiyle değişebilir — her zaman en güncel hâli çağrılır.
 */
export function useKaydedilmemis(degisti: boolean, ad: string, kaydet: () => boolean | Promise<boolean>): () => void {
  const id = useRef(0);
  const son = useRef(kaydet);
  son.current = kaydet;
  if (!id.current) id.current = ++sayac;
  useEffect(() => {
    const k = id.current;
    if (degisti) kayitlar.set(k, { ad, kaydet: () => son.current() });
    else kayitlar.delete(k);
    return () => { kayitlar.delete(k); };
  }, [degisti, ad]);
  /** Kaydettikten hemen sonra (ekran değiştirmeden önce) çağrılır: form kendi Kaydet'iyle ayrılırken soru çıkmasın */
  return () => { kayitlar.delete(id.current); };
}

/**
 * Formun ilk hâli: kullanıcı forma ilk dokunduğunda (odak, tıklama, tuş) o anki durum alınır. Böylece açılışta kendiliğinden yapılan
 * düzeltmeler (işlem tipine göre periyot vb.) "değişiklik" sayılmaz; yalnızca sonra gerçekten farklılaşan form sorulur.
 */
export function useIlkHal<T>(deger: T): { dokun: () => void; degisti: boolean; sifirla: () => void } {
  const ilk = useRef<{ v: T } | null>(null);
  const son = useRef(deger);
  son.current = deger;
  return {
    dokun: () => { if (!ilk.current) ilk.current = { v: son.current }; },
    degisti: !!ilk.current && farkliMi(deger, ilk.current.v),
    sifirla: () => { ilk.current = null; },
  };
}

/** Sekme kapanırken / sayfa yenilenirken tarayıcı uyarısı (yalnızca bekleyen değişiklik varsa) */
export function tarayiciUyarisiKur(): () => void {
  if (typeof window === "undefined") return () => {};
  const f = (e: BeforeUnloadEvent) => { if (!bekleyenVarMi()) return; e.preventDefault(); e.returnValue = ""; return ""; };
  window.addEventListener("beforeunload", f);
  return () => window.removeEventListener("beforeunload", f);
}

/** İki form durumunu karşılaştırır (Date ve boş değerler normalize edilir: "" ≡ null ≡ undefined) */
export function farkliMi(a: unknown, b: unknown): boolean {
  const norm = (x: unknown): unknown => {
    if (x instanceof Date) return x.toISOString();
    if (x === "" || x === undefined) return null;
    if (Array.isArray(x)) return x.map(norm);
    if (x && typeof x === "object") {
      const o: Record<string, unknown> = {};
      for (const k of Object.keys(x as object).sort()) { const v = norm((x as any)[k]); if (v !== null && !(Array.isArray(v) && !v.length)) o[k] = v; }
      return o;
    }
    return x;
  };
  return JSON.stringify(norm(a)) !== JSON.stringify(norm(b));
}
