/**
 * Anahtar CRM v3.22.1 · 9 Ekim 2026
 * ÖZELLİK ANAHTARLARI — ekranda görünen / gizlenen bölümlerin tek kaynağı.
 *
 * Bir özelliği gizlemek kodu silmek değildir: sunucu kodu, veritabanı tabloları ve testleri yerinde
 * kalır; yalnızca arayüzde görünmez ve zamanlayıcıda çalışmaz. Geri açmak için değeri `true` yapıp
 * yeniden derlemek yeter (npm run demo / npm run canli:build).
 */
export const OZELLIKLER = {
  /**
   * Notion senkronu (v3.6). v3.21'de GİZLENDİ: uygulama başka ofislere açılırken Notion tabloları
   * Özyurtlar Gayrimenkul'e özeldi (sabit alan adları, tek çalışma alanı). Bağlantılar ekranındaki
   * Notion kartı, ana sayfadaki davet, durum göstergesi ve otomatik senkron kapalıdır.
   */
  notion: false,
  /** Google Kişiler — çift yönlü (v3.21) */
  googleKisiler: true,
} as const;

export const notionAcik = (): boolean => OZELLIKLER.notion;
