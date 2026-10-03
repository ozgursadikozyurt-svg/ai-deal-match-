/**
 * Anahtar CRM v3.13 · 3 Ekim 2026
 * Notion "Gayrimenkul CRM" sayfasındaki üç tablonun kimlikleri ve alan adları.
 * Kaynak: Notion API ile 30.09.2026'da okunan gerçek şema (alan adları birebir; "Talep " sonundaki boşluk dahil).
 * Başka bir çalışma alanı bağlanırsa kimlikler ortam değişkenleriyle değiştirilir:
 *   NOTION_DS_KISI, NOTION_DS_PORTFOY, NOTION_DS_TALEP
 */
export type NotionTablo = "KISI" | "PORTFOY" | "TALEP";

export const NOTION_VERSION = "2025-09-03";

export const NOTION_TABLOLARI = {
  KISI: {
    ad: "Müşteri-Yatırımcılar-Kişiler",
    dataSourceId: "3735ac62-c709-8094-b790-000be4074f47",
    alan: {
      ad: "Name", telefon: "Phone", rol: "ROL", referans: "Referans", aciklama: "Açıklama",
      aradigiTip: "Aradığı Mülk Tipi", hedefBolge: "Hedef Bölge", butce: "Bütçe", butceMin: "Bütçe Min", butceMax: "Bütçe Max",
      minM2: "Min M2", maxM2: "Max M2", talepler: "Talep ", portfoyler: "Mülkler ve Satış Tüneli", ilgilendigi: "İlgilendiği Portföy",
    },
    /** Bilerek okunmayanlar (neden ile) — bağlantı raporunda gösterilir */
    okunmayan: { "Files & media": "Dosya/fotoğraf kapsam dışı", "Coogle Contacts": "Kişi (Notion kullanıcısı) alanı", "Google Drive File": "Ayrı tablo", "Telefon Rehberi": "Ayrı tablo" },
  },
  PORTFOY: {
    ad: "Mülkler ve Satış Tüneli",
    dataSourceId: "3735ac62-c709-80ec-b1fe-000b72089cd4",
    alan: {
      baslik: "Name", mulkTipi: "Mülk Tipi", islem: "Satılık/Kiralık", fiyat: "Fiyat", m2: "M2", oda: "Oda Sayısı", bolge: "Bölge",
      ruhsat: "Ruhsat/İmar", aciklama: "Açıklama", durum: "Durum", sahip: "Mülk Sahibi", ilgili: "Müşteri-Yatırımcılar-Kişiler",
      talepKisileri: "Talep (Telefon Kişi Rehberi)", konum: "Konum",
    },
    okunmayan: { "Files & media": "Dosya/fotoğraf kapsam dışı" },
  },
  TALEP: {
    ad: "💯 CRM Listesi",
    dataSourceId: "3735ac62-c709-8076-b6e8-000bb0823469",
    alan: {
      baslik: "", mulkTipi: "Mülk Tipi", islem: "Kiralık/Satılık", butceMin: "Bütçe Min", butceMax: "Bütçe Max", minM2: "Min M2", maxM2: "Max M2",
      oda: "Oda/Bölüm Sayısı", bolge: "Bölge", aciliyet: "Aciliyet", durum: "Durum", kaynak: "Müşteri nereden geldi?", neAriyor: "Ne Arıyor",
      notlar: "NOTLAR", telefon: "Telefon", kisi: "Kişi Telefon Rehberi", portfoyler: "Mülkler ve Satış Tüneli",
    },
    okunmayan: {},
  },
} as const;

export function dataSourceId(t: NotionTablo, env: Record<string, string | undefined> = typeof process !== "undefined" ? process.env : {}): string {
  return env[`NOTION_DS_${t}`] || NOTION_TABLOLARI[t].dataSourceId;
}

/** Senkron sırası: önce kişiler (ilişkiler kişilere bağlanır), sonra portföyler, en son talepler (talep → portföy ilişkisi) */
export const SENKRON_SIRASI: NotionTablo[] = ["KISI", "PORTFOY", "TALEP"];

/**
 * Anahtar → Notion geri yazım alanları. Notion'daki SİZİN alanlarınıza asla yazılmaz; yalnızca bu beş alan
 * (yoksa ilk bağlantıda otomatik eklenir) güncellenir. Bu yüzden iki yönlü senkron çakışma üretmez.
 */
export const GERI_YAZIM_ALANLARI = {
  skor: { ad: "Eşleşme Skoru", sema: { number: { format: "number" } } },
  sayi: { ad: "Eşleşme Sayısı", sema: { number: { format: "number" } } },
  enIyi: { ad: "En İyi Eşleşme", sema: { rich_text: {} } },
  link: { ad: "Uygulama Linki", sema: { url: {} } },
  senkron: { ad: "Son Senkron", sema: { date: {} } },
} as const;