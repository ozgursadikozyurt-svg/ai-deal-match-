/**
 * Anahtar CRM v3.22 · 9 Ekim 2026
 * Üç yönlü alan birleştirme — Google Kişiler ve Notion senkronunun ortak çekirdeği.
 *
 * Her senkronda dış kaynaktan (Google / Notion) gelen alanların bir "fotoğrafı" (snapshot) kayda yazılır.
 * Sonraki senkronda her alan için üç değer karşılaştırılır:
 *   önceki  = son senkronda dış kaynaktan aldığımız değer (snapshot)
 *   yerel   = Anahtar'daki şu anki değer
 *   uzak    = dış kaynaktaki şu anki değer
 * Kural:
 *   uzak == önceki            → dışarıda değişmemiş, yereli koru (Anahtar'da yaptığınız düzeltme ezilmez)
 *   yerel == önceki           → yalnızca dışarıda değişmiş, uzağı al
 *   yerel == uzak             → ikisi aynı yere varmış, sorun yok
 *   üçü de farklı             → ÇAKIŞMA: yerel korunur, çakışma listesine düşer (kullanıcı seçer)
 * İlk senkronda (önceki yok) boş yerel alanlar doldurulur, dolu yerel alan korunur ve farklıysa çakışma sayılır.
 */

export type Deger = unknown;
export interface AlanCakismasi { alan: string; onceki: Deger; yerel: Deger; uzak: Deger }
export interface BirlesimSonucu<T extends Record<string, Deger>> {
  /** Yerel kayda uygulanacak değişiklikler (yalnızca değişen alanlar) */
  degisiklik: Partial<T>;
  cakismalar: AlanCakismasi[];
  /** Bir sonraki senkron için saklanacak yeni fotoğraf (= uzak) */
  yeniSnapshot: Partial<T>;
}

/** Karşılaştırma için normalize: boş dizi/boş metin/undefined → null, diziler sıralı, sayılar 2 hane */
export function norm(v: Deger): string {
  if (v === undefined || v === null || v === "" || (Array.isArray(v) && !v.length)) return "null";
  if (Array.isArray(v)) return JSON.stringify(v.map(norm).sort());
  if (typeof v === "number") return String(Math.round(v * 100) / 100);
  if (typeof v === "string") return JSON.stringify(v.trim().replace(/\s+/g, " "));
  if (v instanceof Date) return JSON.stringify(v.toISOString());
  if (typeof v === "object") return JSON.stringify(Object.keys(v as object).sort().map((k) => [k, norm((v as any)[k])]));
  return JSON.stringify(v);
}
export const esit = (a: Deger, b: Deger) => norm(a) === norm(b);
const bos = (v: Deger) => norm(v) === "null";

export function ucYonluBirlestir<T extends Record<string, Deger>>(
  yerel: Partial<T>,
  uzak: Partial<T>,
  onceki: Partial<T> | null | undefined,
  alanlar: (keyof T & string)[],
): BirlesimSonucu<T> {
  const degisiklik: Partial<T> = {};
  const cakismalar: AlanCakismasi[] = [];
  for (const a of alanlar) {
    const y = yerel[a], u = uzak[a];
    if (esit(y, u)) continue;
    if (!onceki) {
      // İlk bağlama: boş yeri doldur, dolu yeri koru
      if (bos(y)) (degisiklik as any)[a] = u;
      else if (!bos(u)) cakismalar.push({ alan: a, onceki: null, yerel: y, uzak: u });
      continue;
    }
    const o = onceki[a];
    if (esit(u, o)) continue; // dış kaynakta değişmemiş → yerel düzeltme korunur
    if (esit(y, o)) { (degisiklik as any)[a] = u; continue; } // yalnızca dışarıda değişmiş
    cakismalar.push({ alan: a, onceki: o, yerel: y, uzak: u });
  }
  const yeniSnapshot = Object.fromEntries(alanlar.map((a) => [a, uzak[a] ?? null])) as Partial<T>;
  return { degisiklik, cakismalar, yeniSnapshot };
}

/** Telefonu karşılaştırma anahtarına çevirir: son 10 hane (0532…, +90532…, 90532… aynı) */
export function telAnahtari(t?: string | null): string | null {
  const d = (t ?? "").replace(/\D/g, "");
  return d.length >= 10 ? d.slice(-10) : null;
}
/** Türkiye numaralarını +90 biçimine çevirir (cep + sabit hat); yurt dışı numara '+' ile korunur */
export function telE164(t?: string | null): string | null {
  if (!t) return null;
  const ham = t.trim();
  const d = ham.replace(/\D/g, "");
  if (d.length === 10 && /^[2-5]/.test(d)) return "+90" + d;
  if (d.length === 11 && /^0[2-5]/.test(d)) return "+9" + d;
  if (d.length === 12 && /^90[2-5]/.test(d)) return "+" + d;
  if (ham.startsWith("+") && d.length >= 8 && d.length <= 15) return "+" + d;
  if (ham.startsWith("00") && d.length >= 10) return "+" + d.slice(2);
  return null;
}
/** Kayıt gönderen alanı (gondeTelefon) yalnızca +905… cep numarası kabul eder */
export const cepMi = (e164?: string | null) => !!e164 && /^\+905\d{9}$/.test(e164);