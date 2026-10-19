/**
 * Anahtar CRM v3.33 · 19 Ekim 2026
 * İLK KAYNAK — kaydın (talep ya da portföy) işletmeye İLK hangi kanaldan geldiği. Değiştirilemez.
 *
 * Neden ayrı alan? "Kaynak" seçicisi (src/lib/domain/kaynak.ts) kaydın HAVUZUNU anlatır (emlak grubu / sahibinden / portal / kendi)
 * ve kayıt sizin portföyünüze dönüşünce değişir. İlk kaynak ise reklam ve asistan performansını ölçer: Meta reklamıyla gelen kiracı,
 * telefonla kazanılan depo sahibi… Bu bilgi sonradan değiştirilebilseydi reklam başarısı kaynak düzeltilerek şişirilebilirdi.
 *
 * Kurallar (sunucu uygular — src/lib/services/durum.ts ve services/kayit.ts):
 *  1. Kayıt oluşturulurken yazılır: kullanıcı seçtiyse o, seçmediyse mevcut alanlardan tahmin (tahminIlkKaynak).
 *  2. Boş kalmışsa (tahmin edilemediyse) herkes BİR KEZ doldurabilir.
 *  3. Doluysa yalnızca "kaynak.duzelt" yetkisi (ofis yöneticisi) değiştirebilir; her değişiklik audit_log'a eski ve yeni değerle düşer.
 *  4. İlk kaynak zamanı (ilkKaynakTarihi) ve ilk yanıt zamanı (ilkYanit) yalnızca sunucu tarafından yazılır; istemcinin gönderdiği
 *     değer dikkate alınmaz.
 */
export const ILK_KAYNAKLAR = [
  "META_REKLAM",
  "GOOGLE_REKLAM",
  "REKLAM",
  "WEB_SITESI",
  "ORGANIK",
  "FSBO_ARAMA",
  "ESKI_MUSTERI",
  "KURUMSAL",
  "REFERANS",
  "EMLAK_GRUBU",
  "SAHIBINDEN",
  "PORTAL",
  "SAHA",
  "DIGER",
] as const;
export type IlkKaynak = (typeof ILK_KAYNAKLAR)[number];

export const ILK_KAYNAK_ETIKET: Record<IlkKaynak, string> = {
  META_REKLAM: "Meta reklamı (Facebook / Instagram)",
  GOOGLE_REKLAM: "Google reklamı",
  REKLAM: "Reklam (diğer / belirtilmemiş)",
  WEB_SITESI: "Web sitesi",
  ORGANIK: "Organik içerik (sosyal medya, video)",
  FSBO_ARAMA: "Sahibinden ilan sahibini aradık",
  ESKI_MUSTERI: "Eski müşteri / talep havuzu",
  KURUMSAL: "Kurumsal firma araştırması",
  REFERANS: "Kişisel referans",
  EMLAK_GRUBU: "Emlakçı / WhatsApp grubu",
  SAHIBINDEN: "Sahibinden ilanı (içe aktarma)",
  PORTAL: "Portal ilanı",
  SAHA: "Saha / tabela",
  DIGER: "Diğer",
};

/** Rapor grupları: reklam, telefonla edinme, ilişki, organik, dış havuz, saha */
export type KaynakGrubu = "REKLAM" | "TELEFON" | "ILISKI" | "ORGANIK" | "DIS_HAVUZ" | "SAHA" | "DIGER";
export const KAYNAK_GRUBU: Record<IlkKaynak, KaynakGrubu> = {
  META_REKLAM: "REKLAM", GOOGLE_REKLAM: "REKLAM", REKLAM: "REKLAM",
  WEB_SITESI: "ORGANIK", ORGANIK: "ORGANIK",
  FSBO_ARAMA: "TELEFON", ESKI_MUSTERI: "TELEFON", KURUMSAL: "TELEFON",
  REFERANS: "ILISKI",
  EMLAK_GRUBU: "DIS_HAVUZ", SAHIBINDEN: "DIS_HAVUZ", PORTAL: "DIS_HAVUZ",
  SAHA: "SAHA", DIGER: "DIGER",
};
export const KAYNAK_GRUBU_ETIKET: Record<KaynakGrubu, string> = {
  REKLAM: "Reklam", TELEFON: "Telefonla edinme", ILISKI: "Referans", ORGANIK: "Organik", DIS_HAVUZ: "Dış havuz", SAHA: "Saha", DIGER: "Diğer",
};

export const ilkKaynakGecerli = (v: unknown): v is IlkKaynak => typeof v === "string" && (ILK_KAYNAKLAR as readonly string[]).includes(v);

/** Bu notlar "müşteriyle temas kuruldu" sayılır (ilk yanıt süresi için) */
export const TEMAS_NOT_TURLERI = ["ARAMA", "WHATSAPP", "GORUSME", "GOSTERIM"] as const;

export interface IlkKaynakTahminAlanlari {
  tip?: string | null;
  musteriKaynagi?: string | null;
  havuz?: string | null;
  ilanSahibiTipi?: string | null;
  veriKanali?: string | null;
}

/**
 * Kayıt oluşturulurken kullanıcı ilk kaynağı seçmediyse mevcut alanlardan tahmin. Emin olunamıyorsa null (boş kalır; bir kez doldurulabilir).
 * Aynı kurallar migration'daki geriye dönük doldurmada da kullanıldı (prisma/migrations/…_v332_asistan_ilk_kaynak).
 */
export function tahminIlkKaynak(v: IlkKaynakTahminAlanlari): IlkKaynak | null {
  switch (v.musteriKaynagi) {
    case "REKLAM": return "REKLAM";
    case "REFERANS": return "REFERANS";
    case "SAHA": return "SAHA";
    case "WHATSAPP_GRUBU": return "EMLAK_GRUBU";
    case "DIGER": return "DIGER";
  }
  const portalKanal = ["SAHIBINDEN", "HEPSIEMLAK", "EMLAKJET"].includes(v.veriKanali ?? "");
  const portal = v.havuz === "DIS_ILAN" || v.ilanSahibiTipi === "PORTAL" || portalKanal || v.musteriKaynagi === "ILAN" || v.musteriKaynagi === "PORTAL";
  if (portal) return v.ilanSahibiTipi === "MALIK" ? "SAHIBINDEN" : "PORTAL";
  if (v.havuz === "PARTNER" || ["EMLAKCI", "PARTNER"].includes(v.ilanSahibiTipi ?? "") || v.veriKanali === "WHATSAPP") return "EMLAK_GRUBU";
  return null;
}

export interface IlkKaynakDegeri {
  ilkKaynak?: string | null;
  ilkKaynakDetay?: string | null;
  ilkKaynakTarihi?: Date | null;
}
export interface IlkKaynakKarari {
  /** Veritabanına yazılacak değerler (her zaman üç alan da dolu döner; değişmeyen alan eski değeriyle) */
  yaz: { ilkKaynak: string | null; ilkKaynakDetay: string | null; ilkKaynakTarihi: Date | null };
  /** audit_log'a düşecek değişiklikler (yalnızca dolu bir değerin değiştirilmesi) */
  degisiklikler: { alan: "ilkKaynak" | "ilkKaynakDetay"; eski: string | null; yeni: string | null }[];
  /** İstek reddedilen alan varsa kullanıcıya gösterilecek açıklama (kaydın geri kalanı yine kaydedilir) */
  uyari?: string;
}

const temiz = (s: unknown): string | null => (typeof s === "string" && s.trim() ? s.trim().slice(0, 200) : null);

/**
 * İlk kaynak kilidi — saf karar. `eski` null ise kayıt yeni oluşturuluyordur.
 * @param duzeltebilir "kaynak.duzelt" yetkisi var mı (ofis yöneticisi)
 * @param olusturma yeni kayıtta kaydın oluşturulma anı (içe aktarmada mesaj tarihi olabilir); yoksa `simdi`
 */
export function ilkKaynakKarari(
  eski: IlkKaynakDegeri | null,
  gelen: IlkKaynakDegeri & IlkKaynakTahminAlanlari,
  duzeltebilir: boolean,
  simdi: Date,
  olusturma?: Date | null,
): IlkKaynakKarari {
  const gelenKaynak = ilkKaynakGecerli(gelen.ilkKaynak) ? gelen.ilkKaynak : null;
  const gelenDetay = temiz(gelen.ilkKaynakDetay);
  if (!eski) {
    const t = olusturma && olusturma.getTime() <= simdi.getTime() ? olusturma : simdi;
    return { yaz: { ilkKaynak: gelenKaynak ?? tahminIlkKaynak(gelen), ilkKaynakDetay: gelenDetay, ilkKaynakTarihi: t }, degisiklikler: [] };
  }
  const yaz = { ilkKaynak: eski.ilkKaynak ?? null, ilkKaynakDetay: eski.ilkKaynakDetay ?? null, ilkKaynakTarihi: eski.ilkKaynakTarihi ?? null };
  const degisiklikler: IlkKaynakKarari["degisiklikler"] = [];
  let reddedildi = false;
  const uygula = (alan: "ilkKaynak" | "ilkKaynakDetay", istenen: string | null, gonderildi: boolean) => {
    if (!gonderildi) return; // istemci alanı hiç göndermedi → dokunma
    const mevcut = yaz[alan];
    if (istenen === mevcut) return;
    if (mevcut == null) { yaz[alan] = istenen; return; } // boşsa bir kez doldurulabilir
    if (!duzeltebilir) { reddedildi = true; return; }
    degisiklikler.push({ alan, eski: mevcut, yeni: istenen });
    yaz[alan] = istenen;
  };
  // Geçersiz kod gönderildiyse "gönderilmedi" sayılır (bozuk istemci kilitli değeri silemesin)
  uygula("ilkKaynak", gelenKaynak, gelenKaynak != null || gelen.ilkKaynak === null);
  uygula("ilkKaynakDetay", gelenDetay, gelen.ilkKaynakDetay !== undefined);
  if (!yaz.ilkKaynakTarihi && yaz.ilkKaynak) yaz.ilkKaynakTarihi = simdi;
  return { yaz, degisiklikler, ...(reddedildi ? { uyari: "İlk kaynak kilitli: yalnızca ofis yöneticisi değiştirebilir. Kaydın diğer alanları kaydedildi." } : {}) };
}

/**
 * İlk yanıt: kayda ilk temas notu (arama, WhatsApp, görüşme, gösterim) sunucuya düştüğünde o anın damgası. Bir kez yazılır.
 * Not tarihini istemci seçebildiği için (geriye tarihli not girilebilir) not tarihi değil, kaydedildiği an esas alınır.
 */
export function ilkYanitKarari(eskiIlkYanit: Date | null | undefined, notTurleri: readonly string[], simdi: Date): Date | null {
  if (eskiIlkYanit) return eskiIlkYanit;
  return notTurleri.some((t) => (TEMAS_NOT_TURLERI as readonly string[]).includes(t)) ? simdi : null;
}

/** İlk yanıt süresi (dakika). Mesai dışı düzeltmesi raporda yapılır; burada ham süre. */
export function yanitDakika(ilkKaynakTarihi?: Date | string | null, ilkYanit?: Date | string | null): number | null {
  if (!ilkKaynakTarihi || !ilkYanit) return null;
  const a = new Date(ilkKaynakTarihi).getTime(), b = new Date(ilkYanit).getTime();
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return Math.max(0, Math.round((b - a) / 60_000));
}
