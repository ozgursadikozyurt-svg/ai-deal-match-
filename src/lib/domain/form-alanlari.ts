/**
 * Anahtar CRM v3.23 · 10 Ekim 2026
 * Kayıt formunda mülk grubuna göre ÖNCE gösterilecek teknik alanlar (hızlı giriş).
 * Geri kalan, o grupta anlamlı alanlar "Tüm alanlar" altında açılır. Anlamsız alanlar hiç gösterilmez.
 * Sıra = ekrandaki sıra. Sayılar ve seçimler üstte, evet/hayır özellikleri tek satır çip olarak altta.
 */
import type { MulkGrubu } from "./kategori";
import type { MulkOzellikAlani } from "./teknik-alanlar";

export const ONEMLI_ALANLAR: Record<MulkGrubu, MulkOzellikAlani[]> = {
  KONUT: ["banyoSayisi", "bulunduguKat", "istenenKatlar", "katSayisi", "binaYasi", "isinmaTipi", "esyaDurumu", "otoparkDurumu", "cepheYonleri", "aidat", "siteIcinde", "asansor", "balkon", "havuz", "iskan"],
  DEVRE_MULK: ["banyoSayisi", "esyaDurumu", "havuz", "denizManzarasi", "siteIcinde"],
  ENDUSTRIYEL: ["kapaliAlanM2", "acikAlanM2", "makasAltiYukseklikM", "netYukseklikM", "kapiYukseklikM", "aracErisimi", "elektrikGucuKw", "ruhsatDurumu", "rampa", "vinc", "trafo", "sanayiElektrigi", "osbIcinde", "gidayaUygun"],
  TICARI: ["girisKatM2", "cepheUzunluguM", "yayaTrafigi", "otoparkDurumu", "ruhsatDurumu", "vitrin", "koseKonum", "anaCaddeUzeri", "baca", "isyeriAcmaRuhsati", "iskan"],
  OFIS: ["bulunduguKat", "istenenKatlar", "binaYasi", "ofisOdaSayisi", "otoparkDurumu", "isinmaTipi", "aidat", "asansor", "iklimlendirme", "guvenlik", "isyeriAcmaRuhsati", "iskan"],
  HIZMET: ["kapaliAlanM2", "girisKatM2", "otoparkDurumu", "ruhsatDurumu", "isyeriAcmaRuhsati", "iskan", "asansor", "yanginSistemi", "engelliErisimi"],
  ARSA: ["arsaAlanM2", "imarDurumu", "emsalKaks", "tapuTipi", "adaNo", "parselNo", "anaYolaMesafeM", "denizeMesafeM", "anaCaddeUzeri"],
  BINA: ["katSayisi", "kapaliAlanM2", "arsaAlanM2", "binaYasi", "otoparkDurumu", "mevcutKiraGeliri", "iskan", "asansor", "kiracili"],
  TURIZM: ["otelOdaSayisi", "yatakKapasitesi", "yildiz", "turizmBelgesi", "kapaliAlanM2", "arsaAlanM2", "denizeMesafeM", "havuz", "denizManzarasi"],
  DIGER: ["kapaliAlanM2", "acikAlanM2", "arsaAlanM2", "elektrikGucuKw"],
};

/** Kayit seviyesindeki alanlardan hangileri bu grupta formun "Temel" bölümünde çıkar */
export const TEMEL_EKSTRA: Partial<Record<MulkGrubu, ("odaSayisi" | "netM2" | "krediyeUygun")[]>> = {
  KONUT: ["odaSayisi", "netM2", "krediyeUygun"],
  DEVRE_MULK: ["odaSayisi"],
  OFIS: ["odaSayisi", "netM2"],
};