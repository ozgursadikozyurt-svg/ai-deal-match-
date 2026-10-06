# Anahtar CRM (anahtarcrm) — v3.14 · 3 Ekim 2026

> Önceki adlar: Anakey, Anahtar.ai. Canlı proje/Worker/depo adı **anahtarcrm** (v3.14). (Bu dosya v3.5'ten beri güncellenmemişti; v3.9'da güncellendi.)

Prisma 7 · PostgreSQL (Supabase) · Zod · Route Handler dosyaları Cloudflare Worker'da çalışır (Next.js yok) · Arayüz: React (tek HTML; demo ve canlı aynı ekranlar)

## Canlı sürüm: Cloudflare Worker + Supabase
- Yayına alma adımları (sizin yapacaklarınız): **`CANLIYA_ALMA_REHBERI_v3.14_3Ekim2026.md`**. Mimari, güvenlik, riskler: **`ANAHTAR_CRM_EK_v3.14_3Ekim2026.md`** (§52–60).
- Derleme: `npm ci --ignore-scripts && npm run canli:build` → `dist/canli/` (arayüz) + Worker; yayın: `npx wrangler deploy` (Cloudflare Git bağlantısı bunu push'ta kendisi yapar).
- Üretilmiş Prisma istemcisi (`src/generated/`) bilerek pakettedir; şema değişirse `npm run canli:istemci`.
- Gizli değerler depoya girmez: Cloudflare › Variables and Secrets (yerelde `.dev.vars`, örnek: `.dev.vars.ornek`).

### Canlı sürümü yerelde sınama (gerçek PostgreSQL + wrangler dev)
```
createdb crm && (9 migration + `LOKASYON_KAPSAM=07 npx tsx prisma/seed/index.ts`)   # ya da ./scripts/test-db.sh (PGlite)
cp .dev.vars.ornek .dev.vars                  # DATABASE_URL'u kendi Postgres'inize göre düzeltin
node scripts/sahte-depo.mjs &                 # Supabase Storage/JWKS taklidi (:9001)
npx wrangler dev --port 8799 --local --test-scheduled &
npm run canli:test && npm run canli:test:depo && npm run canli:test:giris && npm run canli:test:arayuz
```
(`canli:test` boş veritabanı bekler. `canli:test:arayuz` jsdom kullanır.)

## Emlak jargonu

WhatsApp ve ilan metinlerindeki kısaltmalar `docs/emlak_jargon.md` dosyasında tablolanmış, karşılıkları `src/lib/ai/jargon.ts` içinde kodlanmıştır. Kurallar yapay zekâdan **önce** çalışır; sık tekrar eden bir ifadeyi kayıt notunda görüyorsanız sözlüğe kural olarak ekleyin, o andan sonra yapay zekâ gerekmez.

## Veritabanı değişiklikleri nasıl uygulanır? (şema → migration → Supabase)

Kısa cevap: **şema dosyasını değiştirmek yetmez, Supabase'deki tablolar kendiliğinden değişmez.** Yeni bir alan (örn. `takasaAcik`) ya da yeni bir tablo eklenince şu zincir izlenir:

| Adım | Ne yapılır | Otomatik mi? |
|---|---|---|
| 1. Şema | `prisma/schema.prisma` içine alan / model yazılır | hayır — elle yazılır (kod değişikliğinin parçası) |
| 2. Migration | `prisma/migrations/<tarih>_<ad>/migration.sql` dosyası oluşturulur (`ALTER TABLE …`) | yarı — `npx prisma migrate dev --name <ad>` üretir, gözden geçirilir |
| 3. Prisma istemcisi | `npx prisma generate` → `src/generated/` yenilenir (bu klasör depoda durur) | hayır — elle çalıştırılır, commit edilir |
| 4. Supabase'e uygulama | Worker ilk açılışta `/api/kurulum` ile bekleyen migration'ları uygular; arayüzde "İlk kurulum" ekranı çıkarsa "Kurulumu tamamla" düğmesine basılır | **evet** — yayın sonrası uygulamadan tetiklenir |
| 5. Doğrulama | `npm run test:db` (PGlite üzerinde tüm migration'lar + testler) | hayır — elle çalıştırılır |

Önemli noktalar:

- **Supabase panelinde elle tablo açmak gerekmez.** Veritabanının şekli migration dosyalarından gelir; panelden elle yapılan değişiklikler bir sonraki migration ile çakışabilir.
- **Migration dosyaları geri alınamaz biçimde birikir.** Yayınlanmış bir migration dosyası sonradan düzenlenmez; düzeltme yeni bir migration ile yapılır.
- **Veri kaybı riski olan değişikliklerde** (kolon silme, tip daraltma) migration elle yazılır ve önce `npm run test:db` ile denenir. Örnek: v3.15'te `kisi.roller` enum dizisinden metin dizisine çevrilirken `USING "roller"::TEXT[]` kullanıldı, mevcut roller korundu.
- **Panel değişkenleri yayında silinmez.** `wrangler.jsonc` içinde `"keep_vars": true` vardır: bu olmadan her yayın (GitHub → Cloudflare otomatik derleme dahil) panelden elle girilen değişkenleri temizler. Bu satırı kaldırmayın.
- **Bağlantı ve anahtarlar koda yazılmaz.** `DATABASE_URL`, `SUPABASE_*` ve `AI_API_KEY` Cloudflare › Settings › Variables and Secrets üzerinden verilir; `wrangler.jsonc` içinde `vars` bloğu **bilerek yoktur** — olsaydı her yayında paneldeki değerlerin üzerine yazardı. Yerel deneme için `.dev.vars` kullanılır (`.gitignore` içinde, depoya girmez).
- **Yeni bir alan eklendiğinde dokunulan yerler** (v3.15–v3.16 örneği): `prisma/schema.prisma` → migration → `src/lib/validation/kayit.ts` (doğrulama) → `src/lib/services/durum.ts` (sunucu ↔ arayüz köprüsü) → `demo/` ekranları (form, detay, filtre) → eşleştirme motoru gerekiyorsa `src/lib/eslestirme/` → test.


## Hızlı test — demo uygulama (kurulum gerekmez)
- claude.ai'de: https://claude.ai/artifact/9SDMmSyeTmx1zbWR42TYJN (her sürümde aynı bağlantı güncellenir)
- Yerelde: `dist/anahtar-crm-demo_v3.14_3Ekim2026.html` dosyasını çift tıklayın
- Yeniden derlemek: `npm install && npm run demo`

## Sürümleme
- Sürümün tek kaynağı: `src/lib/surum.ts` → `SURUMLER.md` otomatik üretilir
- Dağıtılan dosyalar `ad_v<sürüm>_<gün><Ay><yıl>` (örn. `schema_v3.5_30Eylul2026.prisma`)
- Kod dosyalarının ilk satırı sürüm satırıdır: `npm run surum:damgala`
- Sohbet sonu kontrol listesi: `ANAHTAR_CRM_ALTYAPI_v3.10_2Ekim2026.md` §18; v3.11 ve v3.12 değişiklikleri `ANAHTAR_CRM_EK_v3.11_2Ekim2026.md` ve `ANAHTAR_CRM_EK_v3.12_2Ekim2026.md` (proje dosyalarında)

Prisma 7 · PostgreSQL (Supabase) · Zod · Next.js Route Handlers

## Kurulum (Claude Code / yerel)
```bash
npm install
cp .env.example .env          # Supabase bağlantılarını gir
npm run db:generate           # Prisma Client → src/generated/prisma (motor indirilemiyorsa: PRISMA_SCHEMA_ENGINE_BINARY=/bin/true)
npm run db:migrate            # asama2 + v33 + v34 + v35_yetkili_portfoy
npm run db:seed               # 81 il / 973 ilçe / 73.305 mahalle-köy + Antalya alt bölgeleri (~1 dk)
```
Geliştirmede hızlı seed: `npm run db:seed:antalya`

## Klasör yapısı
```
prisma/schema.prisma                 şema (enum'lar + MulkOzellik + lokasyon)
prisma/sql/constraints.sql           CHECK kuralları (migration sonuna eklenir)
prisma/migrations/…                  ilk migration (boş DB → v3.0)
prisma/seed/data/*.json              PTT posta kodu listesinden üretilmiş il/ilçe/mahalle
prisma/seed/antalya.ts               alt bölgeler, komşu ilçeler, alias sözlüğü
src/lib/domain/                      enum etiketleri, kategori kuralları, teknik alan meta
src/lib/validation/kayit.ts          Zod API modelleri (create / patch / liste filtresi)
src/lib/lokasyon/                    TR normalizasyon + serbest metin → lokasyon ID çözümleyici
src/lib/ai/gemini-cikti-semasi.ts    Zod'dan otomatik Gemini responseSchema + sistem talimatı
src/lib/notion/eslestirme.ts         Notion CRM seçenekleri → enum eşlemesi
src/lib/services/kayit.ts            create / list (teknik filtreler) / patch + audit
src/app/api/…                        route handler'lar
tests/asama2.test.ts                 15 uçtan uca test (gerçek Notion kayıtlarıyla)
tests/v32-demo.test.ts               5 veritabanısız test (konum çözücü, eşleştirme önizlemesi, örnek veri)
tests/v33.test.ts                    7 veritabanısız test (WhatsApp, tip benzerliği, konut, konum öğrenme)
tests/v33-db.test.ts                 4 veritabanlı test (ayar, konut + kaynak, süre uzatma, referans nokta, v3.4 kişi + işlenmiş mesaj)
tests/v34.test.ts                    5 veritabanısız test (kiralık/satılık süre, tekrar yükleme, portal bağlantıları, kişiler)
tests/v35.test.ts                    7 veritabanısız test (Talep DNA, uyum matrisi, havuz, hızlı ayrıştırıcı, soru → filtre, fırsat)
tests/v36*.test.ts … v38*.test.ts    senkron (Notion, Google), toplu giriş, görüşme notları, tekrar kontrolü, eşleşmeyi kopar, dışa aktarma
tests/v39.test.ts                    10 veritabanısız test (akıllı yorumlayıcı, çekirdek düzeltmeleri, yeni ekranlar)
tests/v39-db.test.ts                 2 veritabanlı test (POST /api/ai/yorumla)
tests/v310.test.ts                   17 veritabanısız test (para simgeleri, güven kuralı, telefon, çoklu tip, Türkiye konum, yapay zekâ istemcisi, föy + PDF, fotoğraf kuralları, depo)
tests/v310-db.test.ts                4 veritabanlı test (Türkiye konum rotaları, ayarlar, fotoğraf rotası — depo taklit)
tests/v311.test.ts                   16 veritabanısız test (mahalle komşuluğu, konum kademeleri, oda, bütçe altı, belirsiz mahalle adı, model deneyi)
tests/v311-db.test.ts                2 veritabanlı test (sunucu konum bağlamı ve çözücüsü veritabanı kimlikleriyle)
src/lib/lokasyon/komsuluk.ts         v3.11 mahalle komşuluğu / mesafesi (antalya-komsuluk.json; üretici: scripts/build_komsuluk.py)
src/lib/eslestirme/onizleme.ts       v3.11 eşleştirme motoru v3 (MODEL: konum kademeleri, oda, bütçe altı)
scripts/deney/model-karsilastir.ts   v3.11 model deneyi (etiketli senaryolar, 11 varyasyon; taban: onizleme_v310.ts)
src/lib/domain/ayarlar.ts            v3.10 yapay zekâ sağlayıcıları, paylaşım imzası, çalışma ili
src/lib/ai/saglayici.ts              v3.10 tek yapay zekâ istemcisi (OpenAI uyumlu; anahtar: AI_API_KEY)
src/lib/lokasyon/turkiye.ts          v3.10 Türkiye geneli konum: başka il / ilçe tanıma, çok illi çözüm
prisma/seed/turkiye-alt-bolgeler.ts  v3.10 büyük şehirler için başlangıç semt listesi
src/lib/domain/foto.ts               v3.10 fotoğraf kuralları (8 adet, 1600 px, 1,5 MB)
src/lib/depolama/supabase.ts         v3.10 fotoğraf deposu (Supabase Storage, özel kova, imzalı bağlantı)
src/lib/paylasim/foy.ts              v3.10 portföy föyü: içerik, WhatsApp metni, PDF yazıcısı
demo/paylas.tsx · fotograflar.tsx · ayarlar-ek.tsx · girdi.tsx   v3.10 ekranları
src/lib/ingest/whatsapp.ts           WhatsApp dışa aktarım ayrıştırıcı + ön filtre + tekrar ayıklama
src/lib/lokasyon/ogrenme.ts          konum öğrenme çekirdeği (aday, birlikte geçiş, öneri)
src/lib/domain/form-alanlari.ts      mülk grubuna göre formda önce gösterilecek alanlar
src/lib/domain/gecerlilik.ts         v3.4 kiralık/satılık geçerlilik süreleri
src/lib/services/kisi.ts             v3.4 kişi arama, telefonla tekil oluşturma, kişi kartı, kayda bağlama
src/lib/services/ingest.ts           v3.4 işlenmiş mesaj / önceki dosya kontrolü
src/lib/eslestirme/talep-dna.ts     v3.5 Talep DNA: öldürücü / esnek kriterler, eksik bilgi + soru mesajı
src/lib/eslestirme/havuz.ts         v3.5 havuz akışı Yetkili → CRM → Partner → Web, portföy edinme fırsatı
src/lib/ai/hizli-ayristirici.ts     v3.5 kural tabanlı ayrıştırıcı + soru → filtre + metinden konum (AI'dan önce, ücretsiz)
src/lib/ai/yorumlayici.ts           v3.9 akıllı metin yorumlayıcı: önce metnin türü (portal sayfası, sohbet dökümü, liste, tek kayıt, bağlantı, kişi, soru), sonra ayrıştırma
src/lib/portal/arama-linkleri.ts     v3.4 talepten Sahibinden/Emlakjet/Hepsiemlak arama bağlantısı
src/lib/surum.ts                     sürüm + değişiklik günlüğü (tek kaynak)
src/lib/eslestirme/onizleme.ts       eşleştirme önizlemesi (AŞAMA 3 motorunun başlangıcı)
demo/                                demo uygulama (app.tsx, örnek veri, sayfa şablonu)
scripts/demo-build.ts                npm run demo → dist/ + SURUMLER.md
scripts/surum-damgala.ts             npm run surum:damgala
```

## API
| Metot | Yol | Açıklama |
|---|---|---|
| GET | /api/kayit | Filtreli liste — `tip, mulkTipi, islemTipi, ilceId, altBolgeId, minElektrikKw, minYukseklik, aracErisimi, rampa, sogukHava, ruhsatDurumu…` |
| POST | /api/kayit | Portföy/talep oluştur (Zod doğrulamalı; v3.4 `kisiler: [{kisiId, rol}]`) |
| GET/POST | /api/kisiler | v3.4 kişi arama / telefonla tekil oluşturma |
| GET/PATCH | /api/kisiler/:id | v3.4 kişi kartı / düzenle |
| POST/DELETE | /api/kayit/:id/kisiler | v3.4 kayda kişi bağla / kaldır |
| POST | /api/ai/ara | v3.5 AI kutusu: soru → filtre + sorgu, metin → hızlı ayrıştırma (yapay zekâ yalnızca gerekirse) |
| POST | /api/ai/yorumla | v3.9 akıllı giriş: metnin türü + parçalar + konum çözümü + açıklama; `istem: true` ile Gemini istemi |
| POST | /api/ingest/islenmis | v3.4 işlenen mesajların parmak izi |
| GET | /api/kayit/:id | Detay + özellikler + lokasyon + eşleşmeler + audit |
| PATCH | /api/kayit/:id | Düzenle — her değişiklik audit_log'a |
| GET | /api/lokasyon/iller | 81 il |
| GET | /api/lokasyon/ilceler?ilId=7 | İlçeler + komşu ilçe ID'leri |
| GET | /api/lokasyon/mahalleler?ilceId=…&q=… | Mahalle/köy autocomplete |
| GET/POST | /api/lokasyon/alt-bolgeler | Piyasa bölgeleri (Lara, Altınova, OSB…) |
| POST | /api/lokasyon/coz | Serbest metin → lokasyon ID'leri |
| GET | /api/meta/enumlar | Tüm enum'lar + Türkçe etiketler (UI dropdown) |

## Test
`npm run test:db` — bellek-içi Postgres (PGlite) açar, migration + seed (2 kez, idempotent) + 132 test.