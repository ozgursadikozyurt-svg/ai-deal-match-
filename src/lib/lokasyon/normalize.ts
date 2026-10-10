/**
 * Anahtar CRM v3.24 · 10 Ekim 2026
 * Türkçe lokasyon metni normalizasyonu.
 * "Murtpaşa", "MURATPAŞA", "Düden Mh.", "Altınova Sinan Mahallesi" → karşılaştırılabilir anahtar.
 */
const TR: Record<string, string> = { ç: "c", ğ: "g", ı: "i", i̇: "i", ö: "o", ş: "s", ü: "u", â: "a", î: "i", û: "u" };

/** Mahalle/köy eklerini ve noktalamayı atar */
const EKLER = /\b(mahallesi|mahalle|mah|mh|koyu|koy|beldesi|belde|mevkii|mevki|semti|bolgesi|ilcesi|sb)\b\.?/g;

export function trKucuk(s: string): string {
  return s.replace(/I/g, "ı").replace(/İ/g, "i").toLowerCase();
}

export function lokasyonAnahtari(s: string): string {
  let k = trKucuk(s.normalize("NFC"));
  k = k.replace(/[çğıöşüâîû]/g, (c) => TR[c] ?? c);
  k = k.normalize("NFKD").replace(/[̀-ͯ]/g, "");
  k = k.replace(/[^a-z0-9\s]/g, " ").replace(EKLER, " ");
  return k.replace(/\s+/g, " ").trim();
}

export function slug(s: string): string {
  return lokasyonAnahtari(s).replace(/\s+/g, "-");
}

/** İki anahtar arasındaki Levenshtein mesafesi (yazım hatası toleransı: "murtpasa" ~ "muratpasa") */
export function mesafe(a: string, b: string): number {
  if (a === b) return 0;
  const dp = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = dp[j];
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return dp[b.length];
}

/** Serbest metni aday parçalara böler: "Aksu, Yenigöl / Altınova olur" → ["aksu","yenigol","altinova olur"] */
export function parcala(metin: string): string[] {
  return metin
    .split(/[,/;|\n]| ve | veya | ya da /i)
    .map((p) => lokasyonAnahtari(p))
    .filter((p) => p.length >= 3);
}