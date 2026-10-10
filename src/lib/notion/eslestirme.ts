/**
 * Anahtar CRM v3.23 · 10 Ekim 2026
 * Notion CRM → Anahtar.ai enum eşlemesi (tek yönlü import için).
 * Kaynak tablolar: "💯 CRM Listesi / Talepler Tablosu", "Mülkler ve Satış Tüneli",
 * "Müşteri-Yatırımcılar-Kişiler". Seçenek adları 30.09.2026 itibarıyla birebir alındı.
 */
import type {
  MulkTipi, IslemTipi, Aciliyet, MusteriKaynagi, KisiRolu, RuhsatDurumu, Durum,
} from "../../generated/prisma/enums";

export const NOTION_MULK_TIPI: Record<string, MulkTipi> = {
  "Depo": "DEPO_ANTREPO",
  "Dükkan": "DUKKAN_MAGAZA",
  "Arsa": "ARSA",
  "Daire": "DAIRE",
  "Konut": "DAIRE",
  "Ofis": "BURO_OFIS",
  "Ofis - Apt": "OFIS_APARTMAN_DAIRESI",
  "Ofis-Apt.D": "OFIS_APARTMAN_DAIRESI",
  "Ofis-Apartman Daire": "OFIS_APARTMAN_DAIRESI",
  "Plaza Katı": "PLAZA_KATI_OFIS",
  "Villa": "VILLA",
  "Fabrika": "FABRIKA_URETIM_TESISI",
  "Restoran": "RESTORAN_LOKANTA",
};

export const NOTION_ISLEM_TIPI: Record<string, IslemTipi> = {
  "Satılık": "SATILIK",
  "Kiralık": "KIRALIK",
  "Proje": "KAT_KARSILIGI",
};

export const NOTION_ACILIYET: Record<string, Aciliyet> = {
  "Düşük": "DUSUK",
  "ORta": "NORMAL",
  "Orta": "NORMAL",
  "Yüksek": "YUKSEK",
};

export const NOTION_MUSTERI_KAYNAGI: Record<string, MusteriKaynagi> = {
  "Saha": "SAHA",
  "Referans": "REFERANS",
  "Reklam": "REKLAM",
  "İlan": "ILAN",
};

export const NOTION_RUHSAT: Record<string, RuhsatDurumu> = {
  "Ruhsatlı": "RUHSATLI",
  "Yapı Kayıtlı": "YAPI_KAYITLI",
  "Kayıtsız": "KAYITSIZ",
};

/** Kişi ROL → roller + ilan sahibi tipi */
export const NOTION_ROL: Record<string, { roller: KisiRolu[]; ilanSahibi?: "EMLAKCI" | "MUTEAHHIT" | "MALIK" | "PARTNER" }> = {
  "ALICI": { roller: ["ALICI"] },
  "AL-SAT": { roller: ["ALICI", "SATICI"] },
  "EMLAKÇI": { roller: ["EMLAKCI"], ilanSahibi: "EMLAKCI" },
  "EMLAKÇI DEPO": { roller: ["EMLAKCI"], ilanSahibi: "EMLAKCI" },
  "EMLAKÇI TİCARİ": { roller: ["EMLAKCI"], ilanSahibi: "EMLAKCI" },
  "İş ortağı": { roller: ["IS_ORTAGI"], ilanSahibi: "PARTNER" },
  "Müteahit": { roller: ["MUTEAHHIT"], ilanSahibi: "MUTEAHHIT" },
  "SATICI": { roller: ["SATICI"], ilanSahibi: "MALIK" },
  "YATIRIMCI": { roller: ["YATIRIMCI"] },
  "YATIRIMCI++": { roller: ["YATIRIMCI"] },
};

/** Talep Durum → sistem durumu (pipeline aşamaları Match tarafında tutulur) */
export const NOTION_TALEP_DURUM: Record<string, Durum> = {
  "Yeni Talep": "ACTIVE",
  "İlgileniliyor": "ACTIVE",
  "Görüşüldü": "ACTIVE",
  "Analiz": "ACTIVE",
  "Sunuldu": "ACTIVE",
  "Pasif": "PASSIVE",
  "Çöp": "ARSIV",
};

export const NOTION_PORTFOY_DURUM: Record<string, Durum> = {
  "Yeni Portföy": "ACTIVE",
  "Açık Portföy": "ACTIVE",
  "Portföye Alındı": "ACTIVE",
  "Teklif Verildi": "ACTIVE",
  "Eşleştirme Yapıldı": "ACTIVE",
  "Satıldı/Kiralandı": "ARSIV",
  "Çöp": "ARSIV",
};