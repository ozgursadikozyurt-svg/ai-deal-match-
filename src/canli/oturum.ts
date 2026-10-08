/**
 * Anahtar CRM v3.21.2 · 8 Ekim 2026
 * OTURUM ÇÖZÜMÜ — "bu e-posta kim, hangi ofiste, neler yapabilir?"
 *
 * Giriş akışı:
 *   1. Kullanıcı e-postasına gelen tek kullanımlık bağlantıya tıklar (Supabase Auth, şifre yok).
 *   2. src/canli/kimlik.ts oturum anahtarını (JWT) doğrular → e-posta.
 *   3. Burada e-posta `kullanici` tablosunda aranır → ofis + rol bulunur.
 *   4. Bulunamazsa giriş reddedilir; kişi bekleme ekranını görür (davetsiz kayıt yok).
 *
 * İzin listesi (IZINLI_EPOSTALAR) artık veritabanındaki `kullanici` tablosudur. Ortam değişkeni
 * yalnızca ACİL DURUM anahtarı olarak kalır: listedeki e-posta veritabanında yoksa platform
 * yöneticisi olarak varsayılan ofise açılır (kilitli kalma riskine karşı).
 */
import type { PrismaClient } from "../generated/prisma/client";
import { platformOlarak, VARSAYILAN_OFIS_ID, type Baglam, type Rol } from "../lib/kiracilik";
import { YETKILER, planSinirlari, ROL_ETIKETLERI } from "../lib/guvenlik/yetki";

export interface OturumEnv {
  IZINLI_EPOSTALAR?: string;
}

export type OturumSonucu = { baglam: Baglam } | { hata: string; durum: number; kod: string };

const acilListe = (liste?: string) =>
  (liste ?? "")
    .split(",")
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean);

/**
 * Doğrulanmış e-postadan ofis bağlamı üretir. Platform bağlamında çalışır (kullanıcıyı bulmak için
 * henüz bir ofisimiz yok), sonucu ise dar bir ofis bağlamıdır.
 */
export async function oturumCoz(prisma: PrismaClient, eposta: string, env: OturumEnv): Promise<OturumSonucu> {
  const e = eposta.trim().toLowerCase();
  if (!e) return { hata: "Oturumda e-posta yok", durum: 401, kod: "EPOSTA_YOK" };

  return platformOlarak(async () => {
    const k = await prisma.kullanici.findFirst({
      where: { eposta: e },
      select: { id: true, ofisId: true, rol: true, aktif: true, ofis: { select: { durum: true } } },
    });

    if (!k) {
      // Acil durum anahtarı: ortam listesindeki e-posta ilk girişte platform yöneticisi olarak açılır.
      if (acilListe(env.IZINLI_EPOSTALAR).includes(e)) {
        const yeni = await prisma.kullanici.create({
          data: { ofisId: VARSAYILAN_OFIS_ID, eposta: e, rol: "PLATFORM_YONETICISI", sonGiris: new Date() },
          select: { id: true, ofisId: true, rol: true },
        });
        return { baglam: { ofisId: yeni.ofisId, kullaniciId: yeni.id, rol: yeni.rol as Rol, eposta: e } };
      }
      return {
        hata: "Bu e-posta için hesap yok. Davet bağlantısıyla katılabilir ya da yöneticinizden davet isteyebilirsiniz.",
        durum: 403,
        kod: "HESAP_YOK",
      };
    }

    if (!k.aktif) return { hata: "Hesabınız yöneticiniz tarafından kapatılmış", durum: 403, kod: "HESAP_KAPALI" };
    if (k.ofis.durum === "ASKIDA") return { hata: "Ofisinizin erişimi askıya alınmış", durum: 403, kod: "OFIS_ASKIDA" };

    // Son giriş damgası isteği bekletmesin
    prisma.kullanici.update({ where: { id: k.id }, data: { sonGiris: new Date() } }).catch(() => {});

    return { baglam: { ofisId: k.ofisId, kullaniciId: k.id, rol: k.rol as Rol, eposta: e } };
  });
}

/** /api/oturum yanıtı: arayüzün "kim giriş yaptı, neyi gösterelim" sorusunun tek cevabı. */
export async function oturumOzeti(prisma: PrismaClient, b: Baglam) {
  const ofis = await prisma.ofis.findFirst({
    where: { id: b.ofisId },
    select: { id: true, ad: true, plan: true, sinirsiz: true, denemeBitis: true, durum: true },
  });
  const denemeAktif = !!ofis?.denemeBitis && ofis.denemeBitis > new Date();
  const etkinPlan = denemeAktif && (ofis?.plan ?? "UCRETSIZ") === "UCRETSIZ" ? "PRO" : (ofis?.plan ?? "UCRETSIZ");
  return {
    kullanici: { id: b.kullaniciId, eposta: b.eposta, rol: b.rol, rolEtiketi: ROL_ETIKETLERI[b.rol] },
    ofis: ofis ? { id: ofis.id, ad: ofis.ad, durum: ofis.durum } : null,
    plan: { kod: etkinPlan, denemeBitis: ofis?.denemeBitis ?? null, denemeAktif },
    sinirlar: planSinirlari(etkinPlan as "UCRETSIZ" | "PRO" | "PRO_PLUS", ofis?.sinirsiz ?? false),
    yetkiler: YETKILER[b.rol],
  };
}
