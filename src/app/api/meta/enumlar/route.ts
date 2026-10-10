// Anahtar CRM v3.23 · 10 Ekim 2026
// GET /api/meta/enumlar → UI dropdown/filtre bileşenleri için tüm enum + Türkçe etiket + teknik alan meta
import * as E from "@/generated/prisma/enums";
import {
  ANA_KATEGORI_ETIKET, MULK_TIPI_META, ISLEM_TIPI_ETIKET, ILAN_SAHIBI_ETIKET, VERI_KANALI_ETIKET,
  HAVUZ_ETIKET, MUSTERI_KAYNAGI_ETIKET, PORTFOY_ALINABILIRLIK_ETIKET,
} from "@/lib/domain/kategori";
import { MULK_OZELLIK_META } from "@/lib/domain/teknik-alanlar";
import { ok } from "@/lib/http/yanit";

export const revalidate = 3600;

export function GET() {
  return ok({
    anaKategori: ANA_KATEGORI_ETIKET,
    mulkTipi: MULK_TIPI_META,
    islemTipi: ISLEM_TIPI_ETIKET,
    ilanSahibiTipi: ILAN_SAHIBI_ETIKET,
    veriKanali: VERI_KANALI_ETIKET,
    havuz: HAVUZ_ETIKET,
    musteriKaynagi: MUSTERI_KAYNAGI_ETIKET,
    portfoyAlinabilirlik: PORTFOY_ALINABILIRLIK_ETIKET,
    teknikAlanlar: MULK_OZELLIK_META,
    degerler: {
      aracErisimi: Object.values(E.AracErisimi), ruhsatDurumu: Object.values(E.RuhsatDurumu),
      tapuTipi: Object.values(E.TapuTipi), imarDurumu: Object.values(E.ImarDurumu),
      catiTipi: Object.values(E.CatiTipi), duvarTipi: Object.values(E.DuvarTipi), zeminTipi: Object.values(E.ZeminTipi),
      yapiSistemi: Object.values(E.YapiSistemi), otoparkDurumu: Object.values(E.OtoparkDurumu),
      trafikSeviyesi: Object.values(E.TrafikSeviyesi), kiraOdemeSekli: Object.values(E.KiraOdemeSekli),
      turizmBelgesi: Object.values(E.TurizmBelgesi), kullanimAmaci: Object.values(E.KullanimAmaci),
      teknikAlan: Object.values(E.TeknikAlan), paraBirimi: Object.values(E.ParaBirimi), fiyatPeriyodu: Object.values(E.FiyatPeriyodu),
    },
  });
}