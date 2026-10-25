/**
 * Anahtar CRM v3.43 · 25 Ekim 2026
 * İsteği yapanın rolü ve yeni kayıtların sahibi. Platform bağlamı (zamanlayıcı, testler) tam yetkilidir, sahip yazmaz.
 * Asistanın açtığı kayıt ve kişi yardım ettiği danışmana aittir (asistan değişse de veri danışmanda kalır).
 */
import { baglamOku, type Rol } from "../kiracilik";

export function istekSahibi(): { rol: Rol; sahipId: string | null } {
  const b = baglamOku();
  if (!b || b === "platform") return { rol: "PLATFORM_YONETICISI", sahipId: null };
  return { rol: b.rol, sahipId: b.rol === "ASISTAN" && b.yardimEdilenId ? b.yardimEdilenId : b.kullaniciId };
}
