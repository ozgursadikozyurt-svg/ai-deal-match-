// Anahtar CRM v3.22.2 · 10 Ekim 2026 (v3.13'ten)
// POST /api/entegrasyon/google/baglan → { url }: arayüz bu adrese gider, kullanıcı Google'da "İzin ver" der.
//
// v3.21 — "Google ile bağlan" tek düğme:
//  - İstek oturumla (JWT) gelir; ofis ve kullanıcı imzalı `state` içine yazılır. Google'dan dönüşte (geri-donus) oturum
//    başlığı olmaz — hangi ofisin bağlandığını bu imzalı state söyler (15 dk geçerli, kurcalanırsa reddedilir).
//  - Tek izin ekranı: kişileri görme + düzenleme (çift yönlü). Ayrıca "ek izin" adımı yoktur.
//  - Yönlendirme adresi isteğin geldiği alan adından üretilir; UYGULAMA_URL girmek zorunlu değildir.
import { hata, ok } from "@/lib/http/yanit";
import { ofisBaglami } from "@/lib/kiracilik";
import { yetkiGerek } from "@/lib/guvenlik/yetki";
import { yetkiAdresi, yonlendirmeAdresi, uygulamaAdresi } from "@/lib/google/istemci";
import { durumImzala } from "@/lib/guvenlik/sifre";

export async function POST(req: Request) {
  try {
    const b = ofisBaglami();
    yetkiGerek(b.rol, "ofis.entegrasyon");
    const id = process.env.GOOGLE_CLIENT_ID;
    if (!id || !process.env.GOOGLE_CLIENT_SECRET) return Response.json({ hata: "AYAR_EKSIK", mesaj: "Google bağlantısı bu kurulumda henüz açılmamış (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET)" }, { status: 503 });
    const state = durumImzala({ ofisId: b.ofisId, kullaniciId: b.kullaniciId, eposta: b.eposta });
    return ok({ url: yetkiAdresi({ clientId: id, redirectUri: yonlendirmeAdresi(uygulamaAdresi(req)), state }) });
  } catch (e) { return hata(e); }
}
