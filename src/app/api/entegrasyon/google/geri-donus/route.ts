// Anahtar CRM v3.22.1 · 9 Ekim 2026 (v3.13'ten)
// GET /api/entegrasyon/google/geri-donus?code&state → Google izin ekranından dönüş. Anahtarı şifreleyip saklar, uygulamaya döner.
//
// Bu uç OTURUMSUZ çağrılır (tarayıcıyı Google yönlendirir, oturum başlığı olmaz). Güvenlik:
//  1) `state` bizim imzamızı taşımalı ve 15 dakikadan eski olmamalı (src/lib/guvenlik/sifre.ts) → hangi ofis, hangi kullanıcı.
//  2) O kullanıcı hâlâ o ofiste, etkin ve bağlantı kurmaya yetkili olmalı (veritabanından yeniden bakılır).
//  3) İş o ofisin bağlamında çalışır; başka ofise yazılamaz.
// İlk içe aktarma burada BAŞLATILMAZ (istek uzun sürer); arayüz dönüşte "?google=ok" görünce eşitlemeyi kendisi sürdürür ve ilerlemeyi gösterir.
import { prisma } from "@/lib/db";
import { kiracilikIcinde, platformOlarak, type Rol } from "@/lib/kiracilik";
import { yetkiVar } from "@/lib/guvenlik/yetki";
import { kodTakasEt, yonlendirmeAdresi, uygulamaAdresi, idTokenEposta, yazmaIzniVar } from "@/lib/google/istemci";
import { sifrele, durumDogrula } from "@/lib/guvenlik/sifre";
import { entegrasyon, ayarlarOf } from "@/lib/services/senkron";

export async function GET(req: Request) {
  const u = new URL(req.url);
  const kok = uygulamaAdresi(req);
  const geri = (q: string) => Response.redirect(`${kok}/?google=${q}`, 302);
  try {
    if (u.searchParams.get("error")) return geri("iptal");
    const st = durumDogrula<{ ofisId: string; kullaniciId: string; eposta: string }>(u.searchParams.get("state") ?? "");
    if (!st.ofisId || !st.kullaniciId) return geri("hata");
    const k = await platformOlarak(() => prisma.kullanici.findFirst({ where: { id: st.kullaniciId, ofisId: st.ofisId }, select: { id: true, rol: true, aktif: true, eposta: true, ofis: { select: { durum: true } } } }));
    if (!k || !k.aktif || k.ofis.durum !== "AKTIF" || !yetkiVar(k.rol as Rol, "ofis.entegrasyon")) return geri("yetki");
    const t = await kodTakasEt(fetch, { code: u.searchParams.get("code") ?? "", clientId: process.env.GOOGLE_CLIENT_ID!, clientSecret: process.env.GOOGLE_CLIENT_SECRET!, redirectUri: yonlendirmeAdresi(kok) });
    if (!t.refresh_token) return geri("yenileme-anahtari-yok");
    await kiracilikIcinde({ ofisId: st.ofisId, kullaniciId: k.id, rol: k.rol as Rol, eposta: k.eposta }, async () => {
      const e = await entegrasyon(prisma, "GOOGLE_KISILER");
      const ayarlar = { ...ayarlarOf(e), baglayanKullaniciId: k.id, baglanti: new Date().toISOString(), yazmaIzni: yazmaIzniVar(t.scope) };
      await prisma.entegrasyon.updateMany({ where: { saglayici: "GOOGLE_KISILER" }, data: { durum: "BAGLI", hesap: idTokenEposta(t.id_token), tokenSifreli: sifrele(t.refresh_token!), syncToken: null, imlec: null as any, sonHata: null, kilitBitis: null, ayarlar: ayarlar as any } });
    });
    return geri("ok");
  } catch (e) { if (!/state/i.test(String((e as Error)?.message))) console.error(e); return geri("hata"); } // geçersiz / süresi dolmuş state beklenen bir durumdur, günlüğe yazılmaz
}
