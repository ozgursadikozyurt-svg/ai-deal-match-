/**
 * Anahtar CRM v3.24 · 10 Ekim 2026
 * KAYDIN KAYNAĞI — kullanıcının tek bakışta seçtiği dört seçenek. Veritabanında yeni alan yoktur: seçim, kaydın mevcut üç alanına
 * (havuz, ilanSahibiTipi, veriKanali) yazılır; okurken bu üç alandan geri çıkarılır. Böylece eşleştirmedeki havuz katmanı
 * (src/lib/eslestirme/havuz.ts › havuzKatmani) seçimle her zaman uyumlu kalır:
 *   EMLAK_GRUBU → Partner portföyü · SAHIBINDEN / PORTAL → Web ilanı · KENDI → CRM (yetkiliyse Yetkili) portföyü.
 * Yapay zekâ / kurallar kaynağı tahmin eder; kullanıcı her veri girişinde ve formda değiştirebilir.
 */
export type KaynakSecimi = "EMLAK_GRUBU" | "SAHIBINDEN" | "PORTAL" | "KENDI";
export const KAYNAK_SECIMLERI: KaynakSecimi[] = ["EMLAK_GRUBU", "SAHIBINDEN", "PORTAL", "KENDI"];
export const KAYNAK_SECIM_ETIKET: Record<KaynakSecimi, string> = {
  EMLAK_GRUBU: "Emlak grubu",
  SAHIBINDEN: "Sahibinden",
  PORTAL: "Portal",
  KENDI: "Kendi portföyüm",
};
export const KAYNAK_SECIM_ACIKLAMA: Record<KaynakSecimi, string> = {
  EMLAK_GRUBU: "Emlakçı / iş ortağı paylaştı (WhatsApp grubu) — ortak satış",
  SAHIBINDEN: "Mülk sahibinin kendi ilanı — portföy edinme fırsatı",
  PORTAL: "Portaldaki emlakçı ilanı",
  KENDI: "Sizin müşteriniz / mülk sahibiyle doğrudan",
};

const PORTAL_KANAL = ["SAHIBINDEN", "HEPSIEMLAK", "EMLAKJET"];
const EMLAKCI_TURU = ["EMLAKCI", "PARTNER"];

export interface KaynakAlanlari { tip?: string | null; havuz?: string | null; ilanSahibiTipi?: string | null; veriKanali?: string | null }

/** Kayıttan kaynağı çıkarır (seçim yapılmamış eski kayıtlar dahil) */
export function kaynakOf(v: KaynakAlanlari): KaynakSecimi {
  const portal = v.havuz === "DIS_ILAN" || v.ilanSahibiTipi === "PORTAL" || PORTAL_KANAL.includes(v.veriKanali ?? "");
  if (portal) return v.ilanSahibiTipi === "MALIK" ? "SAHIBINDEN" : "PORTAL";
  if (v.havuz === "PARTNER" || EMLAKCI_TURU.includes(v.ilanSahibiTipi ?? "")) return "EMLAK_GRUBU";
  return "KENDI";
}

/** Seçimi kaydın alanlarına yazar. Seçimle çelişmeyen bilgi korunur (ör. portal adı, firma / müteahhit). */
export function kaynakUygula<T extends KaynakAlanlari>(v: T, k: KaynakSecimi): T {
  const portfoy = v.tip !== "TALEP";
  const kanal = v.veriKanali ?? "MANUEL";
  const portalKanal = PORTAL_KANAL.includes(kanal);
  const sahip = v.ilanSahibiTipi ?? "BILINMIYOR";
  const y: any = { ...v };
  if (k === "EMLAK_GRUBU") {
    if (portfoy) y.havuz = "PARTNER";
    // portföyde havuz PARTNER yeter (firma / müteahhit bilgisi kalır); talepte havuz yoktur, kaynak ilan sahibi türünden okunur
    y.ilanSahibiTipi = (portfoy ? ["EMLAKCI", "PARTNER", "FIRMA", "MUTEAHHIT"] : EMLAKCI_TURU).includes(sahip) ? sahip : "EMLAKCI";
    if (portalKanal || kanal === "MANUEL") y.veriKanali = "WHATSAPP";
  } else if (k === "SAHIBINDEN") {
    if (portfoy) y.havuz = "DIS_ILAN";
    y.ilanSahibiTipi = "MALIK";
    if (!portalKanal) y.veriKanali = "SAHIBINDEN";
  } else if (k === "PORTAL") {
    if (portfoy) y.havuz = "DIS_ILAN";
    const webde = portfoy || portalKanal;
    y.ilanSahibiTipi = webde && ["EMLAKCI", "FIRMA", "MUTEAHHIT", "PARTNER"].includes(sahip) ? sahip : "PORTAL";
  } else {
    if (portfoy) y.havuz = "KENDI_PORTFOY";
    if (["PORTAL", "EMLAKCI", "PARTNER"].includes(sahip)) y.ilanSahibiTipi = portfoy ? "MALIK" : "BILINMIYOR";
    if (portalKanal) y.veriKanali = "MANUEL"; // ilan no / bağlantı kayıtta kalır; kayıt artık sizin portföyünüz
  }
  if (k !== "KENDI" && portfoy) y.yetkili = false;
  return y as T;
}
