/**
 * Anahtar CRM v3.43 · 25 Ekim 2026
 * Hızlı, hoşgörülü arama (Kişiler ekranı ve kişi seçici).
 *  - Birkaç harf yeter: her kelime metnin HERHANGİ bir yerinde geçmesi yeterli ("ahm yıl" → "Ahmet Yılmaz").
 *  - Kelimelerin sırası önemsiz; hepsi bulunmalı (ad + not + şirket karışık yazılabilir: "mehmet depo").
 *  - Türkçe harf duyarsız: "ozgur" = "Özgür", "SIRKET" = "şirket", "i/ı/İ" fark etmez.
 *  - Rakamlar telefonda boşluk / tire / +90 / baştaki 0 farkı gözetmeden aranır: "532 41" → +90 532 412 …
 */

const HARF: Record<string, string> = { ç: "c", ğ: "g", ı: "i", i̇: "i", ö: "o", ş: "s", ü: "u", â: "a", î: "i", û: "u" };

/** Küçük harf + Türkçe karakter sadeleştirme + noktalama → boşluk */
export function aramaNormalize(s: string | null | undefined): string {
  if (!s) return "";
  return s.toLocaleLowerCase("tr").replace(/i̇/g, "i").replace(/[çğıöşüâîû]/g, (h) => HARF[h] ?? h)
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^\p{L}\p{N}@.]+/gu, " ").replace(/\s+/g, " ").trim();
}

/** Telefonu yalnız rakama indirir; +90 / 0 öneki atılmış hâli de eklenir ("05324…" ve "5324…" aynı aranır) */
export function telRakam(...teller: (string | null | undefined)[]): string {
  const out: string[] = [];
  for (const t of teller) {
    const d = (t ?? "").replace(/\D/g, "");
    if (!d) continue;
    out.push(d);
    const yerel = d.replace(/^90(?=5\d{9}$)/, "").replace(/^0(?=5\d{9}$)/, "");
    if (yerel !== d) out.push(yerel, "0" + yerel);
  }
  return out.join(" ");
}

export interface AramaIndeksi { metin: string; rakam: string }
export const aramaIndeksi = (alanlar: (string | null | undefined)[], teller: (string | null | undefined)[]): AramaIndeksi =>
  ({ metin: aramaNormalize(alanlar.filter(Boolean).join(" ")), rakam: telRakam(...teller) });

/** Arama kutusunu parçalara ayırır (bir kez; her kişi için yeniden yapılmaz) */
export interface AramaSorgusu { kelimeler: string[]; rakamlar: string[]; bos: boolean }
export function aramaSorgusu(q: string): AramaSorgusu {
  const ham = q.trim();
  // "0532 412 34" gibi yalnız rakam / boşluk / + / - / ( ) içeren sorgu tek telefon parçası sayılır
  if (/^[\d\s+()\-./]+$/.test(ham) && /\d/.test(ham)) {
    const d = ham.replace(/\D/g, "").replace(/^90(?=5)/, "").replace(/^0(?=5)/, "");
    return { kelimeler: aramaNormalize(ham).split(" ").filter(Boolean), rakamlar: d ? [d] : [], bos: !d };
  }
  const kelimeler = aramaNormalize(ham).split(" ").filter(Boolean);
  return { kelimeler, rakamlar: [], bos: kelimeler.length === 0 };
}

/** Her kelime metinde (ya da rakamsa telefonda) geçmeli */
export function aramaEslesir(ix: AramaIndeksi, s: AramaSorgusu): boolean {
  if (s.bos) return true;
  // Yalnız rakam yazıldıysa önce telefonda aranır; yoksa notta / adreste geçen sayı da sayılır ("2000" → "2000 m2 depo")
  if (s.rakamlar.length) return s.rakamlar.every((r) => ix.rakam.includes(r)) || s.kelimeler.every((k) => ix.metin.includes(k));
  for (const k of s.kelimeler) {
    if (ix.metin.includes(k)) continue;
    if (/^\d{2,}$/.test(k) && ix.rakam.includes(k)) continue;
    return false;
  }
  return true;
}

/** Eşleşen kelimenin çevresinden kısa bir alıntı, kelime sınırlarında kesilir (not içinde bulunduysa kartta gösterilir). Bulamazsa null. */
export function alintiBul(metin: string | null | undefined, s: AramaSorgusu, uzunluk = 70): string | null {
  if (!metin || !s.kelimeler.length) return null;
  const sozcukler = metin.split(/\s+/).filter(Boolean);
  const norm = sozcukler.map((w) => aramaNormalize(w));
  const tum = norm.join(" ");
  const k = s.kelimeler.find((x) => tum.includes(x));
  if (!k) return null;
  // eşleşmenin başladığı sözcük (kelime iki sözcüğe yayılabilir: konum üzerinden bulunur)
  const yer = tum.indexOf(k);
  let i = 0, say = 0;
  while (i < norm.length - 1 && say + norm[i].length < yer) { say += norm[i].length + 1; i++; }
  let bas = i, son = i + 1, uz = sozcukler[i].length;
  while (bas > 0 && uz + sozcukler[bas - 1].length + 1 <= uzunluk / 3 + sozcukler[i].length) uz += sozcukler[--bas].length + 1;
  while (son < sozcukler.length && uz + sozcukler[son].length + 1 <= uzunluk) uz += sozcukler[son++].length + 1;
  return (bas > 0 ? "…" : "") + sozcukler.slice(bas, son).join(" ") + (son < sozcukler.length ? "…" : "");
}
