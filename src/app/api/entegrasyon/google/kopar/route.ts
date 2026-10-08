// Anahtar CRM v3.21 · 8 Ekim 2026 (v3.13'ten)
// POST /api/entegrasyon/google/kopar → bağlantıyı kaldırır. Kişiler Anahtar'da ve Google'da OLDUĞU GİBİ kalır; yalnızca eşitleme durur.
// v3.21: Google tarafındaki izin de geri alınır (en iyi çaba), "gönderilecek" işaretleri temizlenir.
import { prisma } from "@/lib/db";
import { hata, ok } from "@/lib/http/yanit";
import { ofisBaglami } from "@/lib/kiracilik";
import { yetkiGerek } from "@/lib/guvenlik/yetki";
import { izniGeriAl } from "@/lib/google/istemci";
import { coz } from "@/lib/guvenlik/sifre";
import { entegrasyon } from "@/lib/services/senkron";

export async function POST() {
  try {
    yetkiGerek(ofisBaglami().rol, "ofis.entegrasyon");
    const e = await entegrasyon(prisma, "GOOGLE_KISILER");
    let izinKalkti = false;
    if (e.tokenSifreli) { try { izinKalkti = await izniGeriAl(fetch, coz(e.tokenSifreli)); } catch { /* anahtar çözülemedi: yine de kaldır */ } }
    await prisma.entegrasyon.updateMany({ where: { saglayici: "GOOGLE_KISILER" }, data: { durum: "BAGLI_DEGIL", tokenSifreli: null, syncToken: null, imlec: null as any, hesap: null, sonHata: null, kilitBitis: null } });
    await prisma.kisi.updateMany({ where: { googleBekliyor: { not: null } }, data: { googleBekliyor: null } });
    return ok({ kopti: true, izinKalkti, not: izinKalkti ? "Google hesabınızdaki izin de kaldırıldı." : "Google hesabınızdaki izni ayrıca kaldırmak için: myaccount.google.com → Güvenlik → Üçüncü taraf erişimi" });
  } catch (e) { return hata(e); }
}
