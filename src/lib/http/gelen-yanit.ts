// Anahtar CRM v3.23 · 10 Ekim 2026
// Gelen kutusu rotalarının ortak hata yanıtı: tür / boyut / anahtar hataları kendi durum koduyla, depo hataları 502 / 503 ile döner.
import { hata, ok } from "./yanit";
import { DepoHatasi } from "../depolama/supabase";
import { GelenHatasi } from "../services/gelen";

export const gelenHataYaniti = (e: unknown) =>
  e instanceof GelenHatasi ? ok({ hata: e.kod, mesaj: e.message }, e.durum)
  : e instanceof DepoHatasi ? ok({ hata: e.kod === "AYAR_YOK" ? "DEPO_KAPALI" : "DEPO", mesaj: e.kod === "AYAR_YOK" ? "Dosya deposu bu kurulumda kapalı (SUPABASE_SERVICE_ROLE_KEY tanımlı değil)" : e.message }, e.kod === "AYAR_YOK" ? 503 : 502)
  : hata(e);
