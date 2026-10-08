-- v3.21 NOTU: Bu dosya ARTIK GEREKMEZ. Otomatik Google eşitlemesi Cloudflare zamanlayıcısıyla çalışır (wrangler.jsonc › "*/15 * * * *").
-- Yalnızca Cloudflare dışında bir kurulumda dış zamanlayıcı gerekirse kullanın; /api/senkron/calistir CRON_SECRET ile tüm ofisleri eşitler.
-- Anahtar CRM v3.13 · 3 Ekim 2026
-- Otomatik senkron zamanlayıcısı — Supabase SQL Editor'de BİR KEZ çalıştırın (migration'a dahil değildir;
-- adres ve gizli anahtar size özeldir). pg_cron + pg_net Supabase'de ücretsiz plana dahildir.
-- Vercel Hobby'de cron günde 1 kez çalışabildiği için zamanlayıcı Supabase'de durur (TTL işiyle aynı yer).
--
-- 1) Database → Extensions: pg_cron ve pg_net'i açın.
-- 2) Aşağıdaki iki değeri değiştirin: UYGULAMA_URL ve CRON_SECRET (Vercel ortam değişkeniyle aynı).

select cron.unschedule('anahtar-senkron') where exists (select 1 from cron.job where jobname = 'anahtar-senkron');

select cron.schedule(
  'anahtar-senkron',
  '*/5 * * * *',             -- v3.7: her 5 dakikada. Google Kişiler 5 dk'da bir, Notion kendi aralığında (varsayılan 15 dk) çekilir; zamanı gelmeyen atlanır
  $$
  select net.http_post(
    url     := 'https://UYGULAMA_URL/api/senkron/calistir',
    headers := jsonb_build_object('content-type', 'application/json', 'authorization', 'Bearer CRON_SECRET'),
    body    := '{"kaynak":"hepsi","tetik":"zamanlayici"}'::jsonb,
    timeout_milliseconds := 60000
  );
  $$
);

-- Kontrol: select * from cron.job_run_details order by start_time desc limit 10;