# Anahtar CRM — Ek v3.42 · 23 Ekim 2026
## Ücretsiz plan mimarisi: sunucu kodu Supabase Edge Function'da, Cloudflare yalnızca aracı

### Neden (ölçüm)
Cloudflare Workers ücretsiz planı istek başına **10 ms işlemci** verir; aşılırsa istek 503 (Hata 1102) ile kesilir.
Yerel ölçüm (aynı kod, Node, 742 kayıt / 2.000 kişi):

| İstek | Prisma ile işlemci | Ham pg ile |
|---|---|---|
| Boş sorgu (SELECT 1) | 12–28 ms | ~1 ms |
| Açılış "diğer" parçası | 22–46 ms | – |
| 60 kayıt sayfası | 23–36 ms | ~2 ms |
| 250 kişi sayfası | 37–103 ms | ~3 ms |
| 1 kayıt yazma | 34–50 ms | – |

Yani sorun veri miktarı değil, **her istekte Prisma istemcisinin kurulması ve sorgu derlemesi**. v3.40 (parçalı açılış) ve v3.41 (rehber sayfalama) bu yüzden yetmedi.

### Seçenekler ve karar
1. Cloudflare Workers Paid (5 $/ay) — en kolay, ama ücretli.
2. Prisma'yı tümüyle ham SQL'e çevirmek — yüzlerce sorgu, haftalarca iş, yüksek risk.
3. **Seçilen:** sunucu kodunu değiştirmeden **Supabase Edge Function**'a taşımak. Supabase'te sınır istek başına **2 saniye** (ücretsiz planda da; 200 kat). Kod aynı, yalnızca çalıştığı yer değişti.

### Yapı
```
tarayıcı ──► anahtarcrm.com (Cloudflare: statik dosyalar + /api aracısı, ~1 ms)
                 └─/api/* ──► <SUPABASE_URL>/functions/v1/api/* (Supabase Edge Function "api": Prisma + iş kuralları)
                                    └──► Supabase Postgres
```
- **Adresler değişmez:** tarayıcı, Google dönüş adresi, gelen kutusu köprüsü yine anahtarcrm.com. Asıl adres `x-anahtar-asil-url` başlığında taşınır.
- **Gizli değerler Cloudflare'de kalır** (AI, Google, CRON…). Aracı bunları `x-anahtar-ortam` başlığında iletir; fonksiyon yalnızca `x-anahtar-kapi` = bu projenin service_role anahtarı ise güvenir. Kapısız istekler de çalışır (oturum anahtarı her zamanki gibi doğrulanır) ama yalnızca Supabase'in kendi değerleriyle.
- **Zamanlayıcı ve e-posta:** Cloudflare tetikler, fonksiyonun iç yollarına (`/_ic/zamanlayici`, `/_ic/eposta`) iletir; bunlar kapı ister.
- **Güvenlik ağı:** fonksiyon yayında değilse / açılamazsa (Supabase `NOT_FOUND`, `BOOT_ERROR`, 546…) Cloudflare isteği eskisi gibi kendisi işler. `API_UZAK=0` (Cloudflare değişkeni) aracıyı tamamen kapatır.

### Yayın
- `npm run fonksiyon:paketle` → `supabase/functions/api/index.js` (tek dosya, ~6 MB; Prisma'nın Deno istemcisi `src/generated/prisma-deno`).
- GitHub Actions `.github/workflows/supabase-fonksiyon.yml`: main'e her gönderimde paketler, `supabase functions deploy api --no-verify-jwt` ile yükler, oturumsuz istekle 401 aldığını denetler.
- **Bir kez gerekli:** Supabase › Account › Access Tokens'tan bir anahtar üretip GitHub › Settings › Secrets and variables › Actions'a `SUPABASE_ACCESS_TOKEN` adıyla eklemek.

### Ücretsiz plan sınırları (bu yapıyla)
- Cloudflare Workers Free: günde 100.000 istek; aracı istek başına ~1 ms.
- Supabase Free: Edge Function ayda 500.000 çağrı, istek başına 2 sn işlemci; veritabanı 500 MB. Proje 7 gün hiç kullanılmazsa durdurulur — gece zamanlayıcısı bunu önler.

### Dosyalar
`src/canli/uzak.ts` (yeni), `src/canli/fonksiyon.ts` (yeni), `src/canli/worker.ts` (aracı + `zamanlanmisIs`, `epostaIsle`), `scripts/fonksiyon-paketle.ts`, `supabase/config.toml`, `.github/workflows/supabase-fonksiyon.yml`, `prisma/schema.prisma` (client_deno), `package.json` (`#prisma-istemci` → deno).

### Testler
`tests/v342.test.ts` — aracı başlıkları, Türkçe gizli değer taşıma, geçit hatası ayrımı, iletme, fonksiyon yoksa yerelde işleme, kapı doğrulaması, iç yolların korunması. Ayrıca paket Deno 2.9'da yerel veritabanına karşı uçtan uca denendi (okuma, yazma, zamanlayıcı, oturumsuz 401).

### İlk yayında çıkanlar ve çözümler (23 Ekim 2026)
| Belirti | Neden | Çözüm |
|---|---|---|
| `413 request entity too large` | API ile yüklemede paket sınırı | `--use-docker`: paket sıkıştırılıp (eszip) yüklenir |
| `Buffer is not defined` | Supabase çalışma ortamında Node genelleri yok | `scripts/fonksiyon-on.js` Buffer / global / setImmediate tanımlar |
| `process.pid.toString` hatası | `process.pid` yok | process vekili eksik alanlara varsayılan verir |
| `NotSupported … setEnv` | Ortam değişkenine yazılamaz | process.env yazılabilir bir kopya |

Yerel deneme: `scripts/fonksiyon-on.js` kısıtları taklit edilerek (salt okunur env, pid yok, Buffer yok) Deno'da uçtan uca denendi.
Canlı denetim (CI): `https://anahtarcrm.com/api/saglik` → HTTP 200 · `x-anahtar-sunucu: supabase` · `x-anahtar-kapi-durum: gecerli` · `{"ok":true,"vt":true}`.
