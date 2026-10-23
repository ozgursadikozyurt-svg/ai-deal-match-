/**
 * Anahtar CRM v3.40 · 23 Ekim 2026
 * ROLLER VE YETKİLER — tek kaynak.
 *
 * Dört rol var:
 *   PLATFORM_YONETICISI — Özgür. Tüm ofisleri görür, ofis açar, davet eder, plan verir, askıya alır.
 *   OFIS_YONETICISI     — ofisin sahibi. Kendi ofisinin kullanıcılarını, ayarlarını ve tüm kayıtlarını yönetir.
 *   DANISMAN            — kendi kayıtlarını ve ofisin ortak portföyünü görür.
 *   ASISTAN (v3.32)     — yardım ettiği danışmanın kayıt ve kişileriyle çalışır (kayıt açar, günceller, not ve görev girer,
 *                         eşleştirir). Silemez, dışa aktaramaz, ofis ayarlarını ve ilk kaynağı değiştiremez
 *                         (iş tanımı › yetki matrisi: "kaynak, işlem, komisyon ve prim kayıtlarını değiştirmek yetkisi dışında").
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
  | "islem.yonet" // v3.35 — işlem ve komisyon kayıtlarını gör / gir (asistan ve danışman göremez)
  | "kampanya.yonet" // v3.34 — kampanya ekle, bütçe ve aylık harcama gör / gir (asistan yalnızca kampanya adlarını görür)
  | "kaynak.duzelt" // v3.32 — kilitli ilk kaynağı değiştir (her değişiklik audit_log'a düşer)
  // --- günlük iş ---
  | "kayit.oku"
  | "kayit.yaz"
  | "kayit.sil" // talep / portföy ve kişi silme
  | "kayit.disaAktar" // v3.32 — kendi görebildiği kayıtları CSV / JSON indir
  | "kisi.oku"
  | "kisi.yaz"
  | "eslesme.oku"
  | "eslesme.yaz"
  | "ai.kullan"
  | "foto.yukle";

/** v3.32 — asistanın günlük işi: kayıt / kişi / eşleşme okuma-yazma, yapay zekâ, fotoğraf. Silme ve dışa aktarma yok. */
const ASISTAN: Yetki[] = ["kayit.oku", "kayit.yaz", "kisi.oku", "kisi.yaz", "eslesme.oku", "eslesme.yaz", "ai.kullan", "foto.yukle"];

const DANISMAN: Yetki[] = [...ASISTAN, "kayit.sil", "kayit.disaAktar"];

const OFIS_YONETICISI: Yetki[] = [
  ...DANISMAN,
  "kaynak.duzelt",
  "kampanya.yonet",
  "islem.yonet",
  "ofis.kullanicilar",
  "ofis.davet",
  "ofis.ayarlar",
  "ofis.entegrasyon",
  "ofis.disaAktar",
  "ofis.tumKayitlar",
];

const PLATFORM_YONETICISI: Yetki[] = [...OFIS_YONETICISI, "platform.ofisler", "platform.plan", "platform.kullanim"];

export const YETKILER: Record<Rol, readonly Yetki[]> = {
  ASISTAN,
  DANISMAN,
  OFIS_YONETICISI,
  PLATFORM_YONETICISI,
};

export const ROL_ETIKETLERI: Record<Rol, string> = {
  PLATFORM_YONETICISI: "Platform yöneticisi",
  OFIS_YONETICISI: "Ofis yöneticisi",
  DANISMAN: "Danışman",
  ASISTAN: "Asistan",
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

export type Plan = "UCRETSIZ" | "PRO" | "PRO_PLUS";

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
  /**
   * v3.20 — Ofisler arası ORTAK HAVUZ (Pro+): ofis, seçtiği portföy / talepleri ortak havuza koyar ve
   * başka ofislerin havuza koyduklarıyla eşleşir. Hak burada tanımlı; özelliğin kendisi sonraki sürümde
   * (kapsam henüz netleşmedi — bkz. docs/ANAHTAR_CRM_EK_v3.20_8Ekim2026.md › Pro+ yol haritası).
   */
  ortakHavuz: boolean;
}

export const PLANLAR: Record<Plan, PlanSinirlari> = {
  UCRETSIZ: { etiket: "Ücretsiz", fotoBasinaKayit: 0, kullanici: 1, gunlukAi: 25, entegrasyon: false, paylasimFoyu: false, ortakHavuz: false },
  PRO: { etiket: "Pro", fotoBasinaKayit: 8, kullanici: 25, gunlukAi: 500, entegrasyon: true, paylasimFoyu: true, ortakHavuz: false },
  PRO_PLUS: { etiket: "Pro+", fotoBasinaKayit: 15, kullanici: 100, gunlukAi: 2000, entegrasyon: true, paylasimFoyu: true, ortakHavuz: true },
};

/** Sınırsız ofis (Özyurtlar Gayrimenkul): plan PRO + sinirsiz işareti → sınır denetimi uygulanmaz. */
export const SINIRSIZ: PlanSinirlari = {
  etiket: "Sınırsız",
  fotoBasinaKayit: 8,
  kullanici: 999,
  gunlukAi: 100_000,
  entegrasyon: true,
  paylasimFoyu: true,
  ortakHavuz: true,
};

export const planSinirlari = (plan: Plan, sinirsiz = false): PlanSinirlari => (sinirsiz ? SINIRSIZ : PLANLAR[plan]);
