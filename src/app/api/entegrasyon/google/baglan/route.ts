// Anahtar CRM v3.13 · 3 Ekim 2026
// GET /api/entegrasyon/google/baglan[?yaz=1] → Google izin ekranına yönlendirir (okuma izni; yaz=1 ise kişi ekleme izni de)
import { yetkiAdresi, yonlendirmeAdresi } from "@/lib/google/istemci";
import { durumImzala } from "@/lib/guvenlik/sifre";

export async function GET(req: Request) {
  const id = process.env.GOOGLE_CLIENT_ID;
  if (!id) return Response.json({ hata: "AYAR_EKSIK", mesaj: "GOOGLE_CLIENT_ID tanımlı değil (ALTYAPI §26.3)" }, { status: 503 });
  const yazma = new URL(req.url).searchParams.get("yaz") === "1";
  return Response.redirect(yetkiAdresi({ clientId: id, redirectUri: yonlendirmeAdresi(), state: durumImzala({ yazma }), yazma }), 302);
}