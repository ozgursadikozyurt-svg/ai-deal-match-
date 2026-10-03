-- Anahtar CRM v3.14 · 3 Ekim 2026 — GÜVENLİK: public şemasındaki tüm tablolarda RLS açık, politika yok.
-- Supabase REST (anon / authenticated) hiçbir satıra erişemez; uygulama Prisma + postgres rolüyle bağlanır, RLS'yi aşar.
DO $$
DECLARE t record;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename NOT LIKE '\_prisma%' ESCAPE '\' LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.tablename);
  END LOOP;
END $$;
