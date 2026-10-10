/**
 * Anahtar CRM v3.23 · 10 Ekim 2026
 * Ekran durumu hafızası: kullanıcı bir içe aktarma / veri girişi ekranından bir kaydı formda açıp "Vazgeç" derse,
 * aynı ekrana dönünce yüklenmiş dosya, ayrıştırılmış satırlar ve seçimler yerinde kalsın.
 * Hafıza yalnızca bellekte tutulur (sayfa yenilenince silinir). Ekrana "dönüş" (donus) işaretiyle girilmediyse o ekranın hafızası sıfırlanır,
 * böylece menüden yeniden girince eski bir dosyanın sonuçları görünmez.
 */
import { useEffect, useState } from "react";

const H = new Map<string, unknown>();

/** Ekran açılırken bir kez çağrılır: dönüş değilse bu önek altındaki hafıza silinir. */
export function hafizaBaslat(onek: string, donus?: boolean) {
  useState(() => { if (!donus) for (const k of [...H.keys()]) if (k.startsWith(onek)) H.delete(k); return 0; });
}

/** useState gibi; değer ayrıca hafızaya yazılır ve aynı anahtarla yeniden açılışta geri okunur. */
export function useKalici<T>(anahtar: string, ilk: T | (() => T)): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [v, setV] = useState<T>(() => (H.has(anahtar) ? (H.get(anahtar) as T) : typeof ilk === "function" ? (ilk as () => T)() : ilk));
  useEffect(() => { H.set(anahtar, v); }, [anahtar, v]);
  return [v, setV];
}
