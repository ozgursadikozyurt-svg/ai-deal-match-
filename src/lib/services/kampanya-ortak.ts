/** Anahtar CRM v3.34 · 19 Ekim 2026 — Kampanya: tarayıcı ve sunucunun ortak, bağımlılıksız parçası */
export const KAMPANYA_KANALLARI = ["META_REKLAM", "GOOGLE_REKLAM", "REKLAM"] as const;
export const KANAL_ETIKETI: Record<(typeof KAMPANYA_KANALLARI)[number], string> = { META_REKLAM: "Meta (Facebook / Instagram)", GOOGLE_REKLAM: "Google", REKLAM: "Diğer reklam" };
/** Kampanya başına kayıt maliyeti = toplam harcama / ilk kaynağı bu kampanya olan kayıt sayısı. Kayıt ya da harcama yoksa null. */
export const kayitBasinaMaliyet = (toplamHarcama: number, kayitSayisi: number): number | null => (kayitSayisi > 0 && toplamHarcama > 0 ? Math.round(toplamHarcama / kayitSayisi) : null);
