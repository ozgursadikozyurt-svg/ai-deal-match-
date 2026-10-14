# Anahtar CRM — Hyperdrive kurulumu · v3.29 · 14 Ekim 2026

**Amaç:** Worker ile Supabase arasındaki bağlantıyı Cloudflare Hyperdrive'ın bağlantı havuzundan geçirmek. Böylece her istekte yeniden TLS + kimlik doğrulama yapılmaz. Ayrıca Worker, veritabanının yanında (Frankfurt, AWS eu-central-1) çalışır. Hedef, kayıt süresini ve "Connection terminated unexpectedly" kopmalarını azaltmak.

## Yapılanlar

| Parça | Durum |
|---|---|
| Veritabanı rolü `hyperdrive_app` | Açıldı. Yalnızca `public` şemasında okuma ve yazma yetkisi var. RLS'yi `postgres` gibi atlar. En fazla 30 bağlantı. Şifre SCRAM özetiyle verildi; açık metin veritabanı günlüğüne düşmez. Sonradan açılan tablolar da varsayılan yetkilerle bu role açılır. |
| Kod: `src/canli/veritabani.ts` | `HYPERDRIVE` bağlaması varsa onun bağlantı dizesini, yoksa `DATABASE_URL`'i kullanır. Hyperdrive hata verirse o Worker örneği 10 dakika doğrudan bağlantıya döner. Bu hatalar SQLSTATE 58000, "Failed to acquire a connection" ya da günlük sorgu sınırı olabilir. |
| `wrangler.jsonc` › `placement.region: aws:eu-central-1` | Worker veritabanının yanında çalışır. Sorgu başına gidiş-dönüş ~30–50 ms'den ~1–3 ms'ye iner. Statik arayüz yine kullanıcıya en yakın merkezden gelir. |
| Hyperdrive yapılandırması `anahtarcrm-db` | Cloudflare panelinde oluşturulur (aşağıda). Önbellek **kapalı** olmalı. |
| `wrangler.jsonc` › `hyperdrive` bağlaması | Yapılandırma kimliği belli olunca eklenir. Bağlama yokken uygulama eskisi gibi çalışır. |

## Paneldeki adım

1. Cloudflare → **Workers & Pages → Hyperdrive → Create configuration**.
2. Name: `anahtarcrm-db`.
3. Connection string: `postgresql://hyperdrive_app:<şifre>@db.nhizjkeefbxafvncszow.supabase.co:5432/postgres`. Şifre kullanıcıya ayrıca iletildi; bu belgede yoktur.
4. **Caching: kapalı.** Hyperdrive yazmadan sonra önbelleği boşaltmaz. Açık kalırsa kaydedilen değişiklik ekranda 60 saniyeye kadar eski görünebilir.
5. Bağlantı kurulamazsa Supabase → Connect → **Session pooler** adresi kullanılır: kullanıcı `hyperdrive_app.nhizjkeefbxafvncszow`, port 5432. **Transaction pooler (6543) kullanılmaz.**

## Sınırlar (ücretsiz plan)

- **Günlük 100.000 sorgu.** Sınır 00:00 UTC'de sıfırlanır. Ölçüm (1–14 Eki): uygulamanın `postgres` rolüyle yaptığı sorgu günde ~2.400, yani sınırın ~%2'si. Sınır aşılırsa kod doğrudan bağlantıya döner, uygulama durmaz.
- Kökene en fazla ~20 bağlantı (rolün sınırı 30).
- Sorgu başına en fazla 60 sn.

## Doğrulama

- Supabase'de Hyperdrive'ın açtığı bağlantılar şu sorguda görünür: `select usename, application_name, count(*) from pg_stat_activity where usename = 'hyperdrive_app' group by 1, 2;` (uygulama adı `Cloudflare Hyperdrive`).
- Supavisor günlüğünde "ECLIENTSOCKETCLOSED … busy" sayısı düşmeli.

## Geri alma

1. `wrangler.jsonc`'den `hyperdrive` bloğunu silip yayınlayın. Uygulama `DATABASE_URL`'e döner.
2. Rolü kapatmak için:

   ```sql
   alter role hyperdrive_app nologin;
   ```

   Tamamen silmek için:

   ```sql
   reassign owned by hyperdrive_app to postgres;
   drop owned by hyperdrive_app;
   drop role hyperdrive_app;
   ```
