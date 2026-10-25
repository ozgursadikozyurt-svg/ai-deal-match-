/**
 * Anahtar CRM v3.43 · 25 Ekim 2026
 * MÜKERRER PORTFÖY — aynı ilan farklı kaynaktan (portal + WhatsApp grubu, iki emlakçı) iki kez girildiğinde eşleşme
 * listesinde iki satır olarak çıkıyordu. Ölçüm (13 Eki 2026): 410 aktif portföyde 9 grup / 19 kayıt (ör. Hurma 3+1 140 m² 9,1 milyon).
 * Kayıtlar silinmez ve birleştirilmez; yalnızca bir talebin eşleşme listesinde tek satırda gösterilir ("+1 aynı ilan").
 * Tutucu: tip, işlem, m², fiyat, oda ve konum (mahalle; yoksa ilçe) birebir aynı olmalı; m² ya da fiyatı olmayan kayıt hiç gruplanmaz.
 */
export function portfoyImzasi(v: { mulkTipi?: unknown; islemTipi?: unknown; m2?: unknown; fiyat?: unknown; odaSayisi?: unknown; lokasyonlar?: { mahalleId?: number | null; ilceId?: number | null; birincil?: boolean }[] }): string | null {
  if (v.m2 == null || v.fiyat == null) return null;
  const l = v.lokasyonlar?.find((x) => x.birincil) ?? v.lokasyonlar?.[0];
  const yer = l?.mahalleId ? `m${l.mahalleId}` : l?.ilceId ? `i${l.ilceId}` : null;
  if (!yer) return null;
  return [v.mulkTipi, v.islemTipi, Number(v.m2), Number(v.fiyat), v.odaSayisi ?? "", yer].join("|");
}

/** Sıralı eşleşme listesinde aynı talebe düşen mükerrer portföyleri ilkinin altına toplar (sıra korunur) */
export function mukerrerleriTopla<E extends { t: { id: string }; p: { id: string; veri: any }; kopyalar?: { id: string; veri: any }[] }>(liste: E[]): (E & { kopyalar: E["p"][] })[] {
  type S = E & { kopyalar: E["p"][] };
  const ilk = new Map<string, S>();
  const sonuc: S[] = [];
  for (const e of liste) {
    const imza = portfoyImzasi(e.p.veri);
    const anahtar = imza ? `${e.t.id}~${imza}` : null;
    const onceki = anahtar ? ilk.get(anahtar) : undefined;
    if (onceki) { onceki.kopyalar.push(e.p); continue; }
    const yeni = { ...e, kopyalar: [] as E["p"][] } as S;
    if (anahtar) ilk.set(anahtar, yeni);
    sonuc.push(yeni);
  }
  return sonuc;
}
