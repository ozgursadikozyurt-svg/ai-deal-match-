/**
 * Anahtar CRM v3.21.2 · 8 Ekim 2026
 * Konum öğrenme — veritabanı gerektirmeyen çekirdek (demo ve sunucu aynı kodu kullanır).
 *
 * Nasıl öğrenir:
 *  1. Tanınmayan her ifade ("cender otel", "yeni sanayi") bir ADAY olur ve kaç kez görüldüğü sayılır.
 *  2. Aynı mesajda / kayıtta tanınan başka konumlar da geçiyorsa bunlar "birlikte geçiş" olarak sayılır
 *     ("Cender Otel yanı, Gençlik Mh." → cender otel ↔ Gençlik +1).
 *  3. Bir aday yeterince sık aynı konumla birlikte geçerse GÜÇLÜ ÖNERİ olur (≥3 kez ve ≥%60 oranında).
 *  4. Hiçbir öneri kendiliğinden sözlüğe girmez: kullanıcı "Onayla" deyince alias olur ve o andan itibaren
 *     tüm mesajlarda otomatik çözülür. Yanlış öğrenme riskine karşı insan onayı şart.
 *  5. İsteğe bağlı: yapay zekâya "bu yer Antalya'da hangi mahallede?" diye sorulabilir; cevap yine öneri olarak gelir.
 */
import type { CozulenLokasyon } from "./cozumle";
import { lokasyonAnahtari } from "./normalize";

export type AdayDurumu = "BEKLIYOR" | "ONAYLANDI" | "REDDEDILDI";
export interface KonumAdayi {
  ifade: string;              // normalize
  gorunen: string;            // ilk görüldüğü yazım
  ornekMetin?: string;
  gorulme: number;
  birlikteGecis: Record<string, { sayi: number; etiket: string }>; // anahtar: "m:123" | "a:4" | "i:7"
  durum: AdayDurumu;
  sonGorulme: string;
}
export interface AdayOnerisi { anahtar: string; etiket: string; sayi: number; oran: number; guclu: boolean }

export const konumAnahtari = (l: Pick<CozulenLokasyon, "mahalleId" | "altBolgeId" | "ilceId">) =>
  l.mahalleId ? `m:${l.mahalleId}` : l.altBolgeId ? `a:${l.altBolgeId}` : `i:${l.ilceId}`;

const REFERANS = /(otel|hotel|avm|hastane|kavşak|kavsak|köprü|kopru|cadde|caddesi|bulvar|market|okul|üniversite|universite|park|stadyum|terminal|otogar|sanayi sitesi|site|plaza|cami|karakol|metro|tramvay|durak|migros|carrefour|bim|a101|lisesi)/i;
export const aliasTipiTahmin = (ifade: string) => (REFERANS.test(ifade) ? "REFERANS_NOKTA" : "YAZIM") as "REFERANS_NOKTA" | "YAZIM";

/** Tanınmayan ifadeleri ve aynı metinde tanınan konumları adaylara işler (yeni liste döner) */
export function adaylariGuncelle(adaylar: KonumAdayi[], cozulemeyen: string[], cozulen: CozulenLokasyon[], ornekMetin: string | undefined, simdi = new Date()): KonumAdayi[] {
  const liste = adaylar.map((a) => ({ ...a, birlikteGecis: { ...a.birlikteGecis } }));
  for (const ham of cozulemeyen) {
    const ifade = lokasyonAnahtari(ham);
    if (ifade.length < 3) continue;
    let a = liste.find((x) => x.ifade === ifade);
    if (!a) { a = { ifade, gorunen: ham, ornekMetin: ornekMetin?.slice(0, 200), gorulme: 0, birlikteGecis: {}, durum: "BEKLIYOR", sonGorulme: simdi.toISOString() }; liste.push(a); }
    a.gorulme++; a.sonGorulme = simdi.toISOString();
    for (const l of cozulen) {
      const k = konumAnahtari(l);
      a.birlikteGecis[k] = { sayi: (a.birlikteGecis[k]?.sayi ?? 0) + 1, etiket: l.etiket };
    }
  }
  return liste;
}

/** Adayın en olası konumu. Güçlü öneri: en az 3 birlikte geçiş ve görülmelerin %60'ı. */
export function adayOnerisi(a: KonumAdayi): AdayOnerisi | null {
  const e = Object.entries(a.birlikteGecis).sort((x, y) => y[1].sayi - x[1].sayi)[0];
  if (!e) return null;
  const oran = e[1].sayi / Math.max(1, a.gorulme);
  return { anahtar: e[0], etiket: e[1].etiket, sayi: e[1].sayi, oran, guclu: e[1].sayi >= 3 && oran >= 0.6 };
}

/** Onaylanan adaydan sözlük (alias) kaydı üretir */
export function adaydanAlias(a: KonumAdayi, hedef: { ilceId: number | null; mahalleId: number | null; altBolgeId: number | null; etiket: string }, tip = aliasTipiTahmin(a.ifade)) {
  return {
    alias: a.ifade, seviye: hedef.mahalleId ? "MAHALLE" as const : hedef.altBolgeId ? "ALTBOLGE" as const : "ILCE" as const,
    ilceId: hedef.ilceId, mahalleId: hedef.mahalleId, altBolgeId: hedef.altBolgeId,
    tip, aciklama: tip === "REFERANS_NOKTA" ? `${a.gorunen} çevresi` : null, kaynak: "ogrenme",
  };
}