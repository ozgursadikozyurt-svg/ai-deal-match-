/**
 * Anahtar CRM v3.20 · 7 Ekim 2026
 * ROLLER VE YETKİLER — tek kaynak.
 *
 * Üç rol var:
 *   PLATFORM_YONETICISI — Özgür. Tüm ofisleri görür, ofis açar, davet eder, plan verir, askıya alır.
 *   OFIS_YONETICISI     — ofisin sahibi. Kendi ofisinin kullanıcılarını, ayarlarını ve tüm kayıtlarını yönetir.
 *   DANISMAN            — kendi kayıtlarını ve ofisin ortak portföyünü görür.
 *
 * Yetkiler kodda durur; ekrandan düzenlenmez (v3.20 kararı — gereksiz karmaşa).
 * Veri ayrımı (hangi ofis) buradan DEĞİL src/lib/kiracilik.ts'ten zorlanır; burası "ne yapabilir".
 */
import type { Rol } from "../kiracilik";

export type Yetki =
  // --- platform ---
  | "platform.ofisler" // tüm ofisleri görüntüle / yönet
  | "platform.plan" // plan ve deneme süresi ver
  | "platform.kullanim" // kullanım ölçümlerini gör
  // --- ofis yönetimi ---
  | "ofis.kullanicilar" // kullanıcı ekle / çıkar / rol ata
  | "ofis.davet" // davet bağlantısı üret
  | "ofis.ayarlar" // ofis ayarları (TTL, yapay zekâ, imza, roller)
  | "ofis.entegrasyon" // Google / Notion bağlantısı
  | "ofis.disaAktar" // ofisin tüm verisini dışa aktar
  | "ofis.tumKayitlar" // ofisteki herkesin kaydını gör
  // --- günlük iş ---
  | "kayit.oku"
  | "kayit.yaz"
  | "kayit.sil"
  | "kisi.oku"
  | "kisi.yaz"
  | "eslesme.oku"
  | "eslesme.yaz"
  | "ai.kullan"
  | "foto.yukle";

const DANISMAN: Yetki[] = [
  "kayit.oku",
  "kayit.yaz",
  "kayit.sil",
  "kisi.oku",
  "kisi.yaz",
  "eslesme.oku",
  "eslesme.yaz",
  "ai.kullan",
  "foto.yukle",
];

const OFIS_YONETICISI: Yetki[] = [
  ...DANISMAN,
  "ofis.kullanicilar",
  "ofis.davet",
  "ofis.ayarlar",
  "ofis.entegrasyon",
  "ofis.disaAktar",
  "ofis.tumKayitlar",
];

const PLATFORM_YONETICISI: Yetki[] = [...OFIS_YONETICISI, "platform.ofisler", "platform.plan", "platform.kullanim"];

export const YETKILER: Record<Rol, readonly Yetki[]> = {
  DANISMAN,
  OFIS_YONETICISI,
  PLATFORM_YONETICISI,
};

export const ROL_ETIKETLERI: Record<Rol, string> = {
  PLATFORM_YONETICISI: "Platform yöneticisi",
  OFIS_YONETICISI: "Ofis yöneticisi",
  DANISMAN: "Danışman",
};

export const yetkiVar = (rol: Rol, y: Yetki): boolean => YETKILER[rol].includes(y);

export class YetkiHatasi extends Error {
  durum = 403;
  constructor(public yetki: Yetki) {
    super(`Bu işlem için yetkiniz yok (${yetki})`);
    this.name = "YetkiHatasi";
  }
}

/** Rota kodunda tek satırlık kapı: `yetkiGerek(rol, "ofis.davet")` */
export function yetkiGerek(rol: Rol, y: Yetki): void {
  if (!yetkiVar(rol, y)) throw new YetkiHatasi(y);
}

// ---------------------------------------------------------------------------
//  PLANLAR — sınırların tek kaynağı. Rakamlar v3.22'de ekrandan yönetilecek.
// ---------------------------------------------------------------------------

export type Plan = "UCRETSIZ" | "PRO";

export interface PlanSinirlari {
  etiket: string;
  /** Kayıt başına fotoğraf; 0 = fotoğraf yükleme kapalı */
  fotoBasinaKayit: number;
  /** Ofisteki en çok kullanıcı */
  kullanici: number;
  /** Günlük yapay zekâ yorumu */
  gunlukAi: number;
  /** Google / Notion senkronu */
  entegrasyon: boolean;
  /** PDF / JPG portföy föyü */
  paylasimFoyu: boolean;
}

export const PLANLAR: Record<Plan, PlanSinirlari> = {
  UCRETSIZ: { etiket: "Ücretsiz", fotoBasinaKayit: 0, kullanici: 1, gunlukAi: 25, entegrasyon: false, paylasimFoyu: false },
  PRO: { etiket: "Pro", fotoBasinaKayit: 8, kullanici: 25, gunlukAi: 500, entegrasyon: true, paylasimFoyu: true },
};

/** Sınırsız ofis (Özyurtlar Gayrimenkul): plan PRO + sinirsiz işareti → sınır denetimi uygulanmaz. */
export const SINIRSIZ: PlanSinirlari = {
  etiket: "Sınırsız",
  fotoBasinaKayit: 8,
  kullanici: 999,
  gunlukAi: 100_000,
  entegrasyon: true,
  paylasimFoyu: true,
};

export const planSinirlari = (plan: Plan, sinirsiz = false): PlanSinirlari => (sinirsiz ? SINIRSIZ : PLANLAR[plan]);
