// Anahtar CRM v3.21.1 · 8 Ekim 2026
// POST /api/davet/kabul { kod } → daveti kabul eder, kullanıcıyı o ofiste açar.
// Bu rota ofis bağlamı GEREKTİRMEZ (kişinin henüz bir ofisi yoktur) ama giriş yapmış olmak şarttır:
// e-posta doğrulanmış oturum anahtarından gelir, istekten değil. Akış src/canli/worker.ts'te.
import { z } from "zod";
import { prisma } from "@/lib/db";
import { ok, hata } from "@/lib/http/yanit";
import { davetiKabulEt } from "@/lib/services/ofis";
import { davetEpostasi } from "@/canli/davet-baglam";

export async function POST(req: Request) {
  try {
    const { kod } = z.object({ kod: z.string().min(8).max(64) }).parse(await req.json());
    const eposta = davetEpostasi();
    if (!eposta) return ok({ hata: "KIMLIK", mesaj: "Daveti kabul etmek için önce giriş yapın" }, 401);
    const s = await davetiKabulEt(prisma, kod, eposta);
    if ("hata" in s) return ok({ hata: "DAVET", mesaj: s.hata }, s.durum);
    return ok({ tamam: true, ofisId: s.kullanici.ofisId, rol: s.kullanici.rol }, 201);
  } catch (e) {
    return hata(e);
  }
}
