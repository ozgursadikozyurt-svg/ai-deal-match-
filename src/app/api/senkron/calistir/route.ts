// Anahtar CRM v3.13 · 3 Ekim 2026
// POST /api/senkron/calistir { kaynak?: "google"|"notion"|"hepsi", tetik?: "zamanlayici"|"kullanici", tam?: boolean }
// Zamanlayıcı (Supabase pg_cron, prisma/sql/senkron_cron.sql) "Authorization: Bearer <CRON_SECRET>" gönderir.
// NOT: Uygulamada henüz oturum açma yok (backlog #12) — canlıya açmadan önce kullanıcı tetiği de oturuma bağlanmalı.
import { z } from "zod";
import { prisma } from "@/lib/db";
import { hata, ok } from "@/lib/http/yanit";
import { senkronCalistir } from "@/lib/services/senkron";

export const maxDuration = 60;
const Govde = z.object({ kaynak: z.enum(["google", "notion", "hepsi"]).default("hepsi"), tetik: z.enum(["zamanlayici", "kullanici"]).default("kullanici"), tam: z.boolean().default(false) });

export async function POST(req: Request) {
  try {
    const g = Govde.parse(await req.json().catch(() => ({})));
    if (g.tetik === "zamanlayici" && req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) return Response.json({ hata: "YETKISIZ" }, { status: 401 });
    return ok(await senkronCalistir(prisma, { kaynak: g.kaynak, tetik: g.tetik, tam: g.tam }));
  } catch (e) { return hata(e); }
}