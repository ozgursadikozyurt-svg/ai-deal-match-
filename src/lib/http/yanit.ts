// Anahtar.ai v3.8 · 1 Ekim 2026
import { ZodError } from "zod";

export const ok = (data: unknown, status = 200) => Response.json(data, { status });

export function hata(e: unknown) {
  if (e instanceof ZodError)
    return Response.json({ hata: "DOGRULAMA", alanlar: e.issues.map((i) => ({ alan: i.path.join("."), mesaj: i.message })) }, { status: 422 });
  const kod = (e as { code?: string })?.code;
  if (kod === "P2002") return Response.json({ hata: "DUPLICATE", mesaj: "Bu kayıt zaten var (fingerprint)" }, { status: 409 });
  if (kod === "P2025") return Response.json({ hata: "BULUNAMADI" }, { status: 404 });
  console.error(e);
  // v4.0: canlı uygulama girişle korunduğu için hata metni gösterilir (tek kullanıcı; sorun gidermeyi kolaylaştırır)
  return Response.json({ hata: "SUNUCU", mesaj: String((e as Error)?.message ?? e).slice(0, 400) }, { status: 500 });
}

export const sorgu = (req: Request) => Object.fromEntries(new URL(req.url).searchParams);