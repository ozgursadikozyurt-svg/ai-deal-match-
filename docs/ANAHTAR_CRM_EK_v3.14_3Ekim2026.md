# Anahtar CRM — v3.14 Eki (Altyapı + PRD/SRS/FSD) · AŞAMA 7: Canlı sürüm
**Versiyon:** 3.14 | **Tarih:** 3 Ekim 2026 | **Önceki:** 3.13 (3 Ekim 2026)

> `ANAHTAR_CRM_ALTYAPI_v3.10`, `ANAHTAR_CRM_PRD_SRS_FSD_v3.10` ve v3.11/v3.12 eklerinin üzerine okunur. Ana belgelerin metni değişmedi. Bir sonraki sürümde ana belgelere işlenip bu ek kaldırılır.
> **Veritabanı:** tek yeni migration `20261003100000_v314_rls_tum_tablolar` (yalnızca satır düzeyi güvenlik). Şema/tablo değişikliği yok.
> **Test:** 142/142 (Türkiye geneli veriyle) + canlı hatta özgü 4 sınama dizisi (aşağıda §58).

## Ana belgelerde geçersiz kalan satırlar

| Belge · bölüm | Eski | v3.14 |
|---|---|---|
| ALTYAPI §35 | “Hosting: Vercel Pro” | **Cloudflare Workers + statik dosyalar, tek proje** (ad: `anahtarcrm`). Next.js yok |
| ALTYAPI §35, rehber v3.8.2 | Yedek: Cloudflare R2 | **Supabase Storage** özel `yedekler` kovası (son 12) |
| ALTYAPI §35 | `DATABASE_URL` = Transaction pooler (6543) + `DIRECT_URL` | **Session pooler (5432) tek adres**; `DIRECT_URL` isteğe bağlı |
| ALTYAPI §24, §41 | AI anahtarı/çağrısı (tarayıcıda “sample”) | Tüm AI çağrıları sunucuda `/api/ai/json`; anahtar yalnız sunucuda (`AI_API_KEY`) |
| ALTYAPI §28 / PRD §FR-5 | Notion/Google bağlantıları arayüzde | **Canlıda gizli** (yalnız demoda benzetim); gerçek senkron sonraki aşama |
| `anahtar-ai` (paket), `anakey` (Worker/tablo) | eski adlar | `anahtarcrm`; migration kayıt tablosu `_anahtarcrm_migrasyon` |

---

# ALTYAPI ekleri

## 52. Canlı mimari (v3.14)

```
Tarayıcı ──(HTTPS)──► Cloudflare Worker "anahtarcrm"
                       ├─ statik dosyalar (ASSETS): index.html (arayüz), manifest, ikonlar
                       ├─ /api/yapilandirma, /api/saglik        → açık
                       ├─ /api/*  (39 rota)                     → Supabase JWT + e-posta izin listesi
                       └─ zamanlayıcı: günlük 03:00 uyanık tut · pazar 04:00 haftalık yedek
                          │
                          ├─ Supabase Postgres (Frankfurt): Prisma + pg, istek başına bağlantı
                          └─ Supabase Storage: `portfoy` (fotoğraf), `yedekler` (özel kovalar)
```
- **Rota tablosu:** `src/app/api/**/route.ts` dosyalarından `scripts/canli-rotalar.ts` Worker yönlendirmesini üretir (`[id]` klasörleri parametre olur). Aynı rota dosyaları Next.js'siz çalışır.
- **Veritabanı bağlantısı:** `src/lib/db.ts` → `istekIcinde()` her istekte kendi Prisma istemcisini açar/kapatır (Workers bir isteğin soketini başka istekte kullandırmaz). Prisma için ayrı `workerd` istemcisi (`#prisma-istemci`).
- **Üretilmiş Prisma istemcisi pakette durur** (`src/generated/`, 8,9 MB): Cloudflare derlemesi ağdan motor indirmeye bağımlı olmasın. Şema değişirse `npm run canli:istemci`.
- **Derleme:** `npm ci --ignore-scripts && npm run canli:build` (rotalar → gömülü migration/konum → arayüz paketi `dist/canli/`). Dağıtım: `npx wrangler deploy`.
- **Boyut:** Worker betiği ≈ 1,8 MB (gzip 0,46 MB) + wasm 3,4 MB; toplam yükleme 1,6 MB (gzip). Ücretsiz sınır 3 MB.

## 53. Ortam değişkenleri (Cloudflare › Settings › Variables and Secrets)

| Ad | Zorunlu | Not |
|---|---|---|
| `SUPABASE_URL`, `SUPABASE_ANON_KEY` | evet | Anahtar herkese açık (publishable); giriş ekranına `/api/yapilandirma` ile verilir |
| `DATABASE_URL` | evet | **Secret.** Session pooler URI |
| `SUPABASE_SERVICE_ROLE_KEY` | fotoğraf + yedek için | **Secret.** Yalnız sunucuda; yoksa fotoğraf “depo kapalı”, yedek atlanır |
| `IZINLI_EPOSTALAR` | evet | Virgüllü liste; **boşsa kimse giremez** (güvenli varsayılan) |
| `AI_API_KEY` | AI için | **Secret.** Sağlayıcı/model/adres veritabanındaki Ayarlar › Yapay zekâ'dan |
| `SUPABASE_JWT_SECRET` | yalnız eski (HS256) oturum anahtarında | Yoksa Worker ne yapılacağını söyler |
| `DIRECT_URL`, `CRON_SECRET`, `FOTO_KOVA` | hayır | `FOTO_KOVA` varsayılan `portfoy` (wrangler.jsonc'ta) |

## 54. Güvenlik modeli

1. **RLS:** Prisma tabloları `public` şemasında olduğundan Supabase bunları herkese açık anahtarla REST'ten sunar. Migration `…_v314_rls_tum_tablolar` ve kurulum kodu **tüm tablolarda RLS'yi politikasız açar**; Prisma `postgres` rolüyle bağlandığı için etkilenmez, anon/authenticated roller hiçbir satırı göremez. Supabase güvenlik denetimi: yalnızca “RLS açık, politika yok” (bilgi) notu. `_anahtarcrm_migrasyon` tablosu da RLS'lidir.
2. **Giriş kapısı (`src/canli/kimlik.ts`):** her `/api/*` isteğinde Supabase oturum JWT'si doğrulanır — asimetrik (ES256/JWKS, yayıncı + hedef kitle denetimli) ya da eski HS256 (`SUPABASE_JWT_SECRET`); ardından e-posta `IZINLI_EPOSTALAR`'da olmalıdır. Sonuçlar: oturumsuz/bozuk/süresi dolmuş/yanlış yayıncı → 401; izinsiz e-posta → 403.
3. **Giriş:** şifresiz, e-postayla tek kullanımlık bağlantı (isteğe bağlı 6 haneli kod). `create_user:false` + panelde “yeni kayıt kapalı”: yalnız önceden oluşturulmuş kullanıcıya bağlantı gider.
4. **Anahtarlar:** `service_role` ve AI anahtarı yalnızca Worker'da; tarayıcıya yalnız herkese açık anahtar iner. Fotoğraflar özel kovada, 1 saat geçerli imzalı bağlantıyla.
5. **Bilinen sınır:** hata metinleri (tek kullanıcı, girişle korunan uygulama) sorun gidermeyi kolaylaştırmak için 400 karaktere kadar gösterilir.

## 55. Veri köprüsü ve kaydetme katmanı

- **Okuma:** `GET /api/durum` kayıtları (konum, özellik, kişi bağları, görüşme notları, fotoğraf künyeleri), kişileri, eşleşme takibini ve ayarları (`ttl`, `ai`, `paylasim`, `calismaIli`, arayüz durumu) tek seferde verir. `src/lib/services/durum.ts`.
- **Yazma:** `POST /api/durum` yalnızca **değişenleri** alır (kayıt/kişi/silme/eşleşme notu/ayar). Kayıt alt tabloları (konum, özellik, kişi bağları, notlar) tek işlemde yeniden yazılır; `kisiId` kayıtta `kisiler[0]`'dan türetilir (arayüze verilmez).
- **Arayüz (`demo/canli-*.ts[x]`):** `canli-esle.ts` (sunucu↔arayüz eşleme ve fark hesabı, saf işlev), `canli-kaydet.ts` (kuyruk: 0,9 sn birleştirme, parça parça gönderim, yeniden deneme), `canli-oturum.ts` (Supabase REST: bağlantı iste / kod doğrula / yenile), `canli.tsx` (giriş → ilk kurulum denetimi → durum → uygulama), `canli-ayar.tsx` (hesap, AI anahtarı durumu, yedek yükleme).
- **Kaydetme davranışı:** sağ üstte *Kaydedilecek… / Kaydediliyor… / Kaydedildi ✓ / hata*. Sunucunun reddettiği kayıt içeriği değişmedikçe yeniden gönderilmez, nedeni listelenir; ağ koparsa değişiklikler bellekte durur ve 8 sn aralıkla (4 kez) yeniden denenir; bekleyen iş varken sekme kapatılırsa tarayıcı uyarır.
- **Yedekten yükleme (Ayarlar › Hesap ve veri):** kimliği var olan kayıt/kişiye dokunmaz; **kişi telefonla tekildir** — yedekteki kişinin telefonu mevcut bir kişide varsa o kişiyle eşlenir ve kayıtların kişi bağı çevrilir; şemaya uymayan kayıt atlanıp sayılır.
- **“Bugün”:** canlıda gerçek tarih (`BUGUN = new Date()`); demoda sabit 30 Eylül 2026.

## 56. Fotoğraf, yapay zekâ, zamanlayıcı

- **Fotoğraf:** tarayıcıda küçültme (demo ile aynı) → `POST /api/kayit/:id/fotolar` → Storage `portfoy`; liste/görüntüleme imzalı bağlantıyla; portföy başına 8, 1,5 MB üstü ve JPG/PNG/WebP dışı reddedilir; yükleme başarısızsa künye silinir.
- **Yapay zekâ:** arayüzdeki `aiJson(sample, …)` çağrıları canlıda `/api/ai/json`'a gider (sağlayıcı ayarı veritabanından). Anahtar yoksa 503 `ANAHTAR_YOK`. Kural tabanlı ayrıştırma sunucuda değil **tarayıcıda** çalışmaya devam eder (ücretsiz).
- **Zamanlayıcı:** `0 3 * * *` → `SELECT 1` + Supabase REST isteği + süresi dolan aktif kayıtları `EXPIRED` yapar; `0 4 * * 0` → tam yedek JSON → `yedekler/anahtarcrm-yedek-<tarih>.json`, son 12 saklanır.

## 57. Konum verisi ve kimlik uyumu (canlı veritabanı)

- Yüklü: 81 il · Antalya'nın 19 ilçesi · 917 mahalle (**kimlik = Antalya mahalle listesindeki sıra, 1…917** — arayüzdeki dizinle aynı) · 8 alt bölge · 18 alt bölge–mahalle · 20 ilçe komşuluk satırı · 15 alias.
- **Doğrulama:** 917 mahallenin (kimlik : ilçe : slug) parmak izi arayüzde ve canlı Supabase'de **aynı** (`75d55e52…`). Komşuluk tablosundaki 914 mahalle hepsi eşleşti (3 kırsal mahallede sınır verisi yok → eski kural).
- **Mahalle algoritması (v3.11):** v3.13 kodunda korunmuştur; 16/16 sınama (komşuluk, mesafe kademeleri, oda, bütçe, aynı adlı mahalle) hem demoda hem sunucu-veritabanı kimlikleriyle geçer.
- **Bilinen sınır:** Antalya dışındaki 954 ilçe ve diğer illerin mahalleleri **canlıda yüklü değil** (arayüz bu konumlara 100000+ ve 1000+ geçici kimlik verir; veritabanında karşılığı yok). Antalya dışı konumlu kayıtlar il/ilçe düzeyinde saklanabilir, mahalle düzeyi veritabanına yazılamaz. Çözüm (sonraki adım): bu illerin kimlikleriyle yükleme ya da bu kimlikleri kaydederken boşaltma.
- Konum verisi `prisma/seed/data/*.json` içindedir (PTT listesi, `turkey-neighbourhoods` paketi; `npm run lokasyon:build` ile yeniden üretilir; sayılar 81/973/73.305).

## 58. Sınama özeti (v3.14)

| Dizi | Komut | Sonuç |
|---|---|---|
| Birim + veritabanı (PGlite, Türkiye verisiyle) | `npm run test:db` | **142/142** |
| Canlı hat: giriş kapısı, ilk kurulum, 26 kayıt + 26 kişi yaz-oku turu (alan alan karşılaştırma), değişiklik/silme, hata yolları, ağ kopması, yedek birleştirme, AI ucu | `npm run canli:test` | 28/28 |
| Fotoğraf (sınırlar, imzalı bağlantı, silme), günlük + haftalık iş, 12'li saklama | `npm run canli:test:depo` | 13/13 |
| Giriş: ES256/JWKS ve HS256 (yayıncı, hedef kitle, süre, kid, sır) | `npm run canli:test:giris` | 10/10 |
| Arayüz (sanal tarayıcı): giriş ekranı, izinsiz e-posta, oturumla açılış, Ayarlar, giriş bağlantısı, süresi dolmuş bağlantı, liste, yedek dosyası yükleme → sunucuda 25→51 kayıt | `npm run canli:test:arayuz` | 24/24 |

Canlı hat sınamaları **gerçek PostgreSQL 16** ve Cloudflare'in yerel çalışma ortamı (`wrangler dev`, workerd) karşısında yapıldı. Boş veritabanında Worker'ın **ilk kurulumu** (9 migration + konum) 1,2 sn'de tamamlandı, tekrar çalıştırılabilir, 25 tablonun hepsinde RLS açık.

**Gerçek hizmetlerle henüz sınanmamış olanlar (ilk canlı denemede görülecek):** Supabase Auth e-postası ve bağlantı dönüşü, Supabase'e TLS bağlantısı (Session pooler), Supabase Storage (sahte sunucuyla sınandı), Gemini çağrısı, Cloudflare ücretsiz planın CPU sınırı (§59), gerçek tarayıcıda fotoğraf küçültme (demo kodu, değişmedi) ve telefonda ana ekrana ekleme.

## 59. Riskler ve bilinen sınırlar

1. **Cloudflare Free: istek başına 10 ms işlemci süresi.** Yerel çalıştırma bunu uygulamaz; Prisma sorgu derleyicisi (wasm) ve büyük durum JSON'u bu sınırı aşabilir. Belirti: Error 1102. Çözüm: Workers Paid (5 $/ay), kod değişikliği gerekmez.
2. **Supabase yerleşik e-posta:** saatte birkaç ileti. Giriş sık kullanılırsa özel SMTP bağlanmalı.
3. **Tek kullanıcı varsayımı:** aynı kaydı iki cihazdan eşzamanlı düzenlemek “son yazan kazanır”dır; kayıt başına sürüm denetimi yok (backlog).
4. **Fotoğraf kotası:** Supabase Free 1 GB ≈ 350 portföy (8 fotoğraflı).
5. **Notion/Google senkronu canlıda kapalı** (gizli); sunucu servisleri (`senkron.ts`, `/api/entegrasyon/*`) kodda duruyor, OAuth anahtarları ve arayüz bağlantısı sonraki aşama.
6. **Türkiye geneli konum** canlıda yalnız il/ilçe düzeyinde (§57).
7. **KVKK:** yurt dışı barındırma; test döneminde gerçek kişi verisi girilmemeli (rehber §8).

---

# PRD / SRS / FSD — v3.14 eki

- **FR-14.1** Kullanıcı, kendi e-postasına gelen tek kullanımlık bağlantıyla giriş yapar; izin listesindeki dışında kimse veriye ulaşamaz.
- **FR-14.2** Uygulamadaki her değişiklik kullanıcı bir şey yapmadan sunucuya kaydedilir; kaydetme durumu her an görünür; kaydedilemeyen kayıt ve nedeni gösterilir.
- **FR-14.3** Sayfa yenilense veya başka cihazdan açılsa aynı veri gelir; demoda hazırlanan yedek tek adımda canlıya aktarılır, tekrar yüklemek veri çoğaltmaz.
- **FR-14.4** Portföy fotoğrafları kalıcı ve özel saklanır; paylaşım föyünde görünür.
- **FR-14.5** Yapay zekâ özellikleri anahtarı tarayıcıya vermeden çalışır; anahtar yoksa kullanıcıya anlaşılır uyarı verilir.
- **FR-14.6** Sistem her hafta tam yedek alır (son 12 saklanır) ve ücretsiz veritabanının durdurulmasını önler.
- **NFR-14.1** Veritabanına herkese açık anahtarla erişilemez (tüm tablolarda RLS).
- **NFR-14.2** Güncelleme, kod dosyalarını depoya göndermekle yayına alınır; önceki sürüme tek tıkla dönülebilir.
- **NFR-14.3** Aylık sabit maliyet test döneminde 0 $; Workers Paid gerekirse 5 $.
- **Kabul ölçütleri:** §58'deki 5 sınama dizisi + rehber §5'teki canlı kontrol listesi.
- **Kapsam dışı / açık:** gerçek Notion/Google senkronu canlıda; Türkiye geneli mahalle düzeyi konum kaydı; çok kullanıcılı çalışma; kayıt sürüm denetimi; özel alan adı (rehberde yok, Cloudflare › Custom domains ile eklenebilir).
- **Sonraki aşama:** canlı kullanımda çıkan sorunlar → v3.15; ardından gerçek eşleşme kararlarıyla mahalle eşiklerinin ayarı, Notion/Google bağlantıları.

## 60. v3.14 Dosya özeti

| Dosya | Durum |
|---|---|
| `wrangler.jsonc`, `src/canli/worker.ts`, `src/canli/kimlik.ts` | yeni — Worker, giriş kapısı |
| `src/lib/db.ts` | istek başına bağlantı + `#prisma-istemci` |
| `src/lib/services/durum.ts`, `yedek.ts`; `src/lib/kurulum/migrate.ts`, `seed.ts` | yeni — veri köprüsü, yedek, kurulum |
| `src/app/api/{durum,kurulum,saglik,ai/json}/route.ts` | yeni |
| `prisma/migrations/20261003100000_v314_rls_tum_tablolar` | yeni — RLS |
| `prisma/schema.prisma` | `client_worker` üretici eklendi; `prisma.config.ts` yer tutucu URL |
| `scripts/canli-{rotalar,gomulu,arayuz}.ts` | yeni — derleme |
| `scripts/canli-{uctan-uca,depo-testi,jwks-testi}.ts`, `canli-arayuz-testi.mjs`, `canli-yedek-uret.ts`, `sahte-depo.mjs` | yeni — sınamalar |
| `demo/canli*.ts[x]` | yeni — canlı giriş noktası ve katmanları |
| `demo/{depo,app,foto,disa-aktar}.ts[x]` | `CANLI` kancaları (demo davranışı aynı) |
| `public/` | manifest + simgeler |
| `src/lib/validation/kayit.ts` | `KayitTemel`, `MulkOzellikObje` dışa açıldı |
