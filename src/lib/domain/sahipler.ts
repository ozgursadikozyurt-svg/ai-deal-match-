/**
 * Anahtar CRM v3.41 · 23 Ekim 2026
 * Mülk sahipleri: Kişiler ekranındaki "Mülk sahipleri" süzgecinin ve kişi kartlarındaki sahip özetinin hesabı.
 *
 * Özgür (21 Eki 2026): "Geçmişe dönük bazen mülk sahiplerini tekrar arıyorum — bir talebe istinaden depo sahibinin kiracısı çıkmış
 * olabilir. Onları görebilmek istiyorum. Bizzat tanıdığım depo / mülk sahiplerini bir yerde gruplayıp eşleştirmek için kişilerde
 * mi tutmalıyım?"
 *
 * Karar: ayrı bir grup / liste açılmaz — sahip zaten Kişiler'dedir. "Depo sahibi" bilgisi elle etiketlenmez, kişiye bağlı
 * portföylerin mülk tipinden TÜRETİLİR (portföy eklenince kendiliğinden güncel kalır). Elinde şu an kayıtlı portföyü olmayan,
 * bizzat tanınan sahip için kişi kartında "Kiraya veren / Satıcı" rolü + "Sahip olduğu mülk tipleri" seçilir.
 *
 * Bir kişi mülk sahibi sayılır, eğer:
 *  - bir portföye "Mülk sahibi" (SAHIP) rolüyle bağlıysa, ya da
 *  - "Kiraya veren" / "Satıcı" rolü varsa (portföyü olmasa da).
 * Pasif / arşiv / süresi dolmuş portföy: "kiracı / alıcı çıkmış olabilir — tekrar ara" listesinin kaynağı.
 */

export const SAHIP_KISI_ROLLERI: ReadonlySet<string> = new Set(["KIRAYA_VEREN", "SATICI"]);
/** Kayıt bağındaki sahip rolü (kişi ↔ portföy) */
export const SAHIP_BAG_ROLU = "SAHIP";
/** Portföyü "kapanmış olabilir" sayan durumlar (pasife alınmış, arşivlenmiş, süresi dolmuş) */
export const KAPANMIS_DURUMLAR: ReadonlySet<string> = new Set(["PASSIVE", "ARSIV", "EXPIRED"]);
/** Sunulmuş sayılan eşleşme aşamaları (müşteriye iletildi ve sonrası) */
export const SUNULMUS_ASAMALAR: ReadonlySet<string> = new Set(["BILDIRILDI", "GORUSULDU", "GOSTERIM", "PAZARLIK", "KAPANDI"]);

export interface SahipPortfoyu { id: string; baslik?: string; aile: string; durum: string; /** v3.38 — durumun değiştiği an (ms) */ durumTarihi?: number | null }
export interface SahipOzeti {
  /** sahibi olduğu portföyler (tümü) */
  portfoyler: SahipPortfoyu[];
  aktif: number;
  /** pasif / arşiv / süresi dolmuş */
  kapanmis: number;
  /** mülk aileleri: bağlı portföylerden + kişi kartında elle seçilenler */
  aileler: string[];
  /** portföylerinin müşteriye sunulmuş (iletildi, görüşüldü, gösterildi, pazarlık, kapandı) eşleşme sayısı */
  sunulan: number;
  /** v3.38 — pasif / arşiv / süresi dolmuş portföylerinden en eskisinin durum tarihi (ms); bilinmiyorsa null */
  enEskiKapanma: number | null;
}

interface KayitGirdisi { id: string; veri: { tip: string; mulkTipi: string; durum: string; baslik?: string | null; durumTarihi?: unknown; kisiler?: { kisiId: string; rol: string }[] | null } }
interface KisiGirdisi { id: string; roller: string[]; uzmanlikAileleri?: string[] | null }

/**
 * Tüm kişiler için sahip özeti (yalnızca sahip sayılanlar haritada yer alır). Kayıt sayısı kadar tek geçiş; 7.000+ kişide de hızlıdır.
 * `aileOf`: mülk tipi → aile kodu (kategori.ts'teki aileOf); `eslesmeDurumu`: "tid~pid" → aşama.
 */
export function sahipOzetleri(
  kayitlar: readonly KayitGirdisi[],
  kisiler: readonly KisiGirdisi[],
  aileOf: (mulkTipi: string) => string,
  eslesmeDurumu: Readonly<Record<string, { durum?: string } | undefined>> = {},
): Map<string, SahipOzeti> {
  const rolu = new Map(kisiler.map((k) => [k.id, k] as const));
  // portföy başına sunulmuş eşleşme sayısı (anahtar "tid~pid")
  const sunulanPortfoy = new Map<string, number>();
  for (const [anahtar, n] of Object.entries(eslesmeDurumu)) {
    if (!n?.durum || !SUNULMUS_ASAMALAR.has(n.durum)) continue;
    const pid = anahtar.split("~")[1];
    if (pid) sunulanPortfoy.set(pid, (sunulanPortfoy.get(pid) ?? 0) + 1);
  }
  const m = new Map<string, SahipOzeti>();
  const al = (id: string) => { let x = m.get(id); if (!x) { x = { portfoyler: [], aktif: 0, kapanmis: 0, aileler: [], sunulan: 0, enEskiKapanma: null }; m.set(id, x); } return x; };
  for (const k of kayitlar) {
    if (k.veri.tip !== "PORTFOY") continue;
    const gorulen = new Set<string>();
    for (const b of k.veri.kisiler ?? []) {
      if (gorulen.has(b.kisiId)) continue;
      const kisi = rolu.get(b.kisiId);
      const sahip = b.rol === SAHIP_BAG_ROLU || (!!kisi && kisi.roller.some((r) => SAHIP_KISI_ROLLERI.has(r)) && b.rol !== "EMLAKCI" && b.rol !== "ARACI");
      if (!sahip) continue;
      gorulen.add(b.kisiId);
      const x = al(b.kisiId);
      const aile = aileOf(k.veri.mulkTipi);
      const dt = k.veri.durumTarihi ? new Date(k.veri.durumTarihi as any).getTime() || null : null;
      x.portfoyler.push({ id: k.id, baslik: k.veri.baslik ?? undefined, aile, durum: k.veri.durum, durumTarihi: dt });
      if (KAPANMIS_DURUMLAR.has(k.veri.durum)) { x.kapanmis++; if (dt != null && (x.enEskiKapanma == null || dt < x.enEskiKapanma)) x.enEskiKapanma = dt; }
      else if (k.veri.durum === "ACTIVE") x.aktif++;
      if (!x.aileler.includes(aile)) x.aileler.push(aile);
      x.sunulan += sunulanPortfoy.get(k.id) ?? 0;
    }
  }
  for (const k of kisiler) {
    const rolSahip = k.roller.some((r) => SAHIP_KISI_ROLLERI.has(r));
    if (!rolSahip && !m.has(k.id)) continue;
    const x = al(k.id);
    for (const a of k.uzmanlikAileleri ?? []) if (!x.aileler.includes(a)) x.aileler.push(a);
  }
  return m;
}

export type SahipSuzgeci = "" | "HEPSI" | "AKTIF" | "KAPANMIS" | "PORTFOYSUZ";
export const SAHIP_SUZGEC_ETIKET: Record<Exclude<SahipSuzgeci, "">, string> = {
  HEPSI: "Tüm mülk sahipleri",
  AKTIF: "Aktif portföyü olanlar",
  KAPANMIS: "Pasif / arşiv portföyü olanlar (tekrar ara)",
  PORTFOYSUZ: "Portföyü kayıtlı olmayan sahipler",
};

/** Süzgeç: sahip türü + (varsa) mülk aileleri. Sahip olmayan kişi süzgeç seçiliyken düşer. */
export function sahipSuzgeciUyar(o: SahipOzeti | undefined, tur: SahipSuzgeci, aileler: readonly string[]): boolean {
  if (!tur && !aileler.length) return true;
  if (!o) return false;
  if (aileler.length && !o.aileler.some((a) => aileler.includes(a))) return false;
  if (tur === "AKTIF") return o.aktif > 0;
  if (tur === "KAPANMIS") return o.kapanmis > 0;
  if (tur === "PORTFOYSUZ") return o.portfoyler.length === 0;
  return true;
}

/** Kartta tek satırlık özet: "Depo / Lojistik · 2 portföy (1 pasif) · 3 sunum" */
/** v3.38 — "3 aydır", "12 gündür", "bugün" */
export function sureYaz(ms: number, simdi = Date.now()): string {
  const gun = Math.max(0, Math.floor((simdi - ms) / 86_400_000));
  return gun === 0 ? "bugünden beri" : gun < 31 ? `${gun} gündür` : gun < 365 ? `${Math.floor(gun / 30)} aydır` : `${Math.floor(gun / 365)} yıldır`;
}
export function sahipOzetMetni(o: SahipOzeti, aileEtiket: (kod: string) => string, simdi = Date.now()): string {
  const parca = [o.aileler.map(aileEtiket).join(", ") || "Mülk sahibi"];
  if (o.portfoyler.length) parca.push(`${o.portfoyler.length} portföy${o.kapanmis ? ` (${o.kapanmis} pasif/arşiv${o.enEskiKapanma != null ? `, ${sureYaz(o.enEskiKapanma, simdi)}` : ""})` : ""}`);
  else parca.push("kayıtlı portföy yok");
  if (o.sunulan) parca.push(`${o.sunulan} sunum`);
  return parca.join(" · ");
}
