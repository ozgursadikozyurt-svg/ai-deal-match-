/**
 * Anahtar CRM v3.22 · 9 Ekim 2026
 * Demo — ekran durumunu (filtre, sıralama, sekme) ekran sökülse de koruyan kancalar.
 *
 * Sorun: uygulama ekranları `ekran.ad`'a göre koşullu çizer; bir karta girince Liste / Eşleşmeler / Kişiler
 * bileşeni sökülür ve `useState` ile tutulan filtreler sıfırlanırdı ("Geri" deyince en başa dönülürdü).
 * Çözüm: bu durumlar sökülmeyen modül belleğinde tutulur. Yeniden çizilen ekran kaldığı yerden devam eder.
 *
 * - Bellek yalnızca uygulama açık olduğu sürece yaşar (sayfa yenilenince sıfırlanır; eski bir filtre
 *   günler sonra liste "boş" göstermesin diye bilerek diske yazılmaz).
 * - Kaydırma konumu burada değil, uygulama kabuğunda (app.tsx › geri) tutulur.
 */
import { useCallback, useState } from "react";

const BELLEK = new Map<string, unknown>();

/** useState gibi; ama değer `anahtar` altında saklanır ve bileşen yeniden çizilince geri gelir. */
export function useKalici<T>(anahtar: string, ilk: T | (() => T)): [T, (y: T | ((o: T) => T)) => void] {
  const [deger, setDeger] = useState<T>(() => {
    if (BELLEK.has(anahtar)) return BELLEK.get(anahtar) as T;
    const v = typeof ilk === "function" ? (ilk as () => T)() : ilk;
    BELLEK.set(anahtar, v); // ilk değer de saklanır: dışarıdan (ör. Ana Sayfa'dan gelen filtre) verilen başlangıç korunur
    return v;
  });
  const yaz = useCallback((y: T | ((o: T) => T)) => {
    setDeger((o) => {
      const yeni = typeof y === "function" ? (y as (o: T) => T)(o) : y;
      BELLEK.set(anahtar, yeni);
      return yeni;
    });
  }, [anahtar]);
  return [deger, yaz];
}

/** Bir ekranın saklanan durumunu siler (ör. Ana Sayfa'dan hazır filtreyle açılırken eski filtre karışmasın). */
export function kaliciSil(onEk: string) {
  for (const k of [...BELLEK.keys()]) if (k.startsWith(onEk)) BELLEK.delete(k);
}
/** Testler için: tüm saklanan durumu temizler. */
export function kaliciHepsiniSil() { BELLEK.clear(); }
/** Testler için: bir anahtarın saklanan değeri. */
export function kaliciOku<T>(anahtar: string): T | undefined { return BELLEK.get(anahtar) as T | undefined; }
