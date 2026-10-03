// Prisma 7 yapılandırması — bağlantı URL'leri şemadan buraya taşındı.
import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed/index.ts",
  },
  datasource: {
    // Migrate için Supabase "direct" (5432) bağlantısı; uygulama çalışma zamanında pooler kullanır
    // v3.14: Cloudflare derlemesinde (yalnızca `prisma generate`) bağlantı gerekmez; yer tutucu kullanılır.
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? "postgresql://yer-tutucu@localhost:5432/yer-tutucu",
  },
});