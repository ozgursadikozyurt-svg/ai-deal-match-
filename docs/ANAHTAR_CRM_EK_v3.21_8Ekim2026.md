# Anahtar CRM — Ek: v3.21 Çift yönlü Google Kişiler + Notion'un gizlenmesi (8 Ekim 2026)

## Amaç
1. Google Kişiler eşitlemesini **çift yönlü** yapmak ve canlıda gerçekten çalışır hâle getirmek; kullanıcı için tek adım: **"Google ile bağlan"**.
2. Kural: **Anahtar'dan silinen kişi Google'dan silinmez**; Google'a eklenen kişi Anahtar'a düşer.
3. Notion ile ilgili senkron / bağlantı özelliklerini arayüzden **gizlemek**.

Kullanıcıya dönük adımlar: `docs/GOOGLE_BAGLANTI_KURULUMU_v3.21_8Ekim2026.md`.

## v3.20'deki durum (neden canlıda çalışmıyordu)
- Google kodu v3.6'da tek ofis + Vercel varsayımıyla yazılmıştı. Canlıda Bağlantılar menüsü gizliydi.
- `GET /baglan` tarayıcı yönlendirmesiydi → Worker'da her `/api/*` oturum anahtarı ister, tarayıcı yönlendirmesi başlık taşıyamaz.
- `geri-donus` de oturum istiyordu; Google'dan dönen istek oturumsuzdur.
- Zamanlayıcı platform bağlamında çalışır, senkron kodu ofis bağlamı ister → hata verirdi.
- Tüm rehber tek istekte çekilip kişi kişi yazılıyordu → 7.000 kişide zaman aşımı.
- Arayüz durumu belleğinde tutup farkı sunucuya yazar; sunucunun eklediği kişileri görmezdi.

## Eşitleme kuralları (tek kaynak: `src/lib/google/kisiler.ts` başlığı)
| Olay | Sonuç | Nerede |
|---|---|---|
| Google'a kişi eklendi / değişti | Anahtar'a gelir (üç yönlü birleştirme) | `googleSenkronPlani` |
| Google'da silindi | Anahtar'da kalır, bağı kopar, `kaynaktaSilindi` | `plan.bagiKopar` |
| Anahtar'da **elle** eklendi | Google'a eklenir | `kisi.googleBekliyor` → `googleGonderimPlani.olustur` |
| Anahtar'da ad / telefon / e-posta / şirket düzeltildi | Google'da güncellenir | `gonderimAlaniDegisti` → `googleBekliyor` → `guncelle` |
| Anahtar'da alan boşaltıldı | Google'da silinmez | boş değer plana girmez |
| Anahtar'dan silindi | Google'dan silinmez, geri gelmez | `senkron_haric` + `HaricListesi` |
| İki tarafta aynı alan değişti | Çakışma; çözülene kadar Google'a yazılmaz | `senkron_cakisma`, `cakismali` |
| Toplu içe aktarma | Kendiliğinden gitmez | arayüz `googleaGonder` koymaz |
| Notlar | Yalnızca Google → Anahtar | `GONDERIM_ALANLARI` içinde yok |

**Silme güvencesi:** `src/lib/google/istemci.ts` içinde People API silme ucu ve `DELETE` isteği yoktur; `tests/v321.test.ts` bunu statik olarak, `tests/v321-db.test.ts` ve `scripts/canli-google-testi.ts` sahte Google'a silme isteği gitmediğini çalışırken denetler.

## "Gönderilecek" işareti (`kisi.googleBekliyor`)
Anahtar → Google yönü yalnızca işaretli kişilerde çalışır. Bilerek açık (explicit) bir işarettir:
- Senkronun kendi yazdıkları işaret koymaz → Google'dan gelen değişiklik Google'a geri gitmez (yankı yok).
- Bağlanma anındaki eski farklar (Anahtar'da şirketi olan, Google'da olmayan 7.000 kişi…) toplu hâlde Google'a yazılmaz.
- İşareti koyanlar: `degisiklikUygula` (yeni kişi + arayüzden `googleaGonder: true`; bağlı kişide gönderim alanı değişti), `PATCH /api/kisiler/:id`, `cakismaCoz("YEREL")`.
- Yalnızca Google **bağlı ve çift yönlü açıkken** konur (`googleGonderimAcik`). Bağlantı kaldırılınca temizlenir.

## Eşitleme turu (`googleSenkronCalistir`)
1. **Çek:** 200'er kişilik sayfalar (`GOOGLE_SAYFA_BOYU`). Her sayfa planlanır → yeni kişiler tek sorguda (`createManyAndReturn`, `skipDuplicates`) → yalnızca değişen kişiler güncellenir → ilerleme (`imlec.sayfa`) saklanır.
2. **Gönder:** çekme bittiyse, çift yönlü açıksa, yazma izni varsa. Tur başına en çok 20 kişi (`GOOGLE_GONDERIM_SINIRI`). Güncellemede önce kişinin Google'daki güncel hâli okunur (etag + diğer telefonlar), yalnızca değişen alan maskeyle yazılır.
3. Süre bütçesi (20 sn) ya da dış istek sınırı (40; Workers ücretsiz planda çağrı başına 50) dolarsa `devamEdecek: true` döner. Arayüz aynı isteği yineler; zamanlayıcı sonraki turda sürdürür. Yarım kalan içe aktarma tek geçmiş satırında toplanır.

## Bağlanma akışı (canlı)
```
[Google ile bağlan]  POST /api/entegrasyon/google/baglan        (oturum + ofis.entegrasyon yetkisi)
        → { url }     state = imzalı { ofisId, kullaniciId, eposta, t }   (HMAC, 15 dk)
tarayıcı → accounts.google.com → "İzin ver"
        → GET /api/entegrasyon/google/geri-donus?code&state    (OTURUMSUZ kapı — worker.ts 1b)
             1) state imzası + yaşı   2) kullanıcı hâlâ o ofiste, etkin, yetkili mi (veritabanı)
             3) kod → yenileme anahtarı (AES-256-GCM ile şifreli saklanır)   4) 302 → /?google=ok
arayüz  → Bağlantılar ekranı açılır, ilk içe aktarmayı turlar hâlinde sürdürür
```
- İzin: tek ekran, `…/auth/contacts`. Google yazma izni vermediyse (`yazmaIzni: false`) çift yönlü kendiliğinden kapalı kalır, çekme çalışır.
- Yönlendirme adresi isteğin alan adından üretilir; `UYGULAMA_URL` zorunlu değil.
- `ENTEGRASYON_SIFRE_ANAHTARI` zorunlu değil; yoksa `SUPABASE_SERVICE_ROLE_KEY` (yoksa `DATABASE_URL`) üzerinden türetilir.
- Bağlantıyı kaldır: Google'daki izin de geri alınır (`oauth2/revoke`).

## Çok ofis
- Bağlantı ofis başınadır (`entegrasyon` satırı `[ofisId, saglayici]` ile tekil — v3.20 kararı). Yetki: `ofis.entegrasyon` (ofis yöneticisi).
- İçe aktarılan kişilerin sahibi: bağlantıyı kuran kullanıcı (`ayarlar.baglayanKullaniciId` → `kisi.sahipKullaniciId`).
- Zamanlayıcı: `tumOfislerdeGoogleSenkron` platform bağlamında bağlı ofisleri listeler, her birini **kendi ofis bağlamında** çalıştırır (`kiracilikIcinde`). Ofisler birbirinin kişisini göremez (`tests/v321-db.test.ts › ÇOK OFİS`).
- Plan: `PLANLAR.entegrasyon` Ücretsiz'de `false` tanımlı ama sınırların zorlanması v3.22'de; v3.21'de her ofis bağlayabilir.

## Arayüz
- `demo/baglantilar.tsx` demo ve canlıda aynı ekran; canlı çağrılar `demo/google-baglanti.ts`.
- Sunucudan gelen kişiler: `GET /api/durum?yalniz=kisiler` → `kaydedici.kisileriBirlestir` (kaydedilmemiş yerel iş korunur; gelenler "zaten kayıtlı" sayılır — yoksa kuyruk onları yeniden yazar ya da eksik görüp **silerdi**).
- Sessiz eşitleme: uygulama açılışında ve 5 dakikada bir (`googleOtomatik`, yalnızca yetkili kullanıcı, sekme görünürken).
- Demo: `demo/senkron-demo.ts` aynı planlayıcılarla çalışır; "Google rehberi (benzetim)" kutusu Google tarafını gösterir.

## Notion — gizlendi (silinmedi)
`src/lib/ozellikler.ts › OZELLIKLER.notion = false`. Etkisi: Bağlantılar'daki Notion kartı, ana sayfa daveti, durum göstergesi, Kişiler kaynak süzgecindeki "Notion", `GET /api/entegrasyon` içindeki Notion satırı, `POST /api/entegrasyon/notion/baglan` (404) ve otomatik Notion eşitlemesi kapalı. `src/lib/notion/*`, tablolar, `notionId` sütunları ve v3.6 testleri yerinde. Geri açmak: değeri `true` yapıp yeniden derlemek.

## API
| Uç | Yetki | Not |
|---|---|---|
| `GET /api/entegrasyon` | giriş | yalnızca Google; `hazir`, `yetkili`, `bagliKisi`, `bekleyen`, `haric`, `devamEdiyor` |
| `POST /api/entegrasyon/google/baglan` | ofis.entegrasyon | `{ url }` (eskiden GET yönlendirme) |
| `GET /api/entegrasyon/google/geri-donus` | **oturumsuz**, imzalı state | 302 → `/?google=ok\|iptal\|hata\|yetki\|yenileme-anahtari-yok` |
| `POST /api/entegrasyon/google/kopar` | ofis.entegrasyon | izni de geri alır |
| `GET/DELETE /api/entegrasyon/google/haric` | ofis.entegrasyon | silinenler listesi / yeniden getir |
| `PUT /api/entegrasyon/ayarlar` | ofis.entegrasyon | `googleYaz` = çift yönlü |
| `POST /api/senkron/calistir` | ofis.entegrasyon ya da CRON_SECRET | CRON → tüm ofisler |
| `GET /api/durum?yalniz=kisiler` | giriş | yalnızca kişiler |

## Veritabanı
Migration `20261008100000_v321_google_cift_yonlu` — yalnızca ekleme:
- `kisi.googleBekliyor TIMESTAMP` + indeks `(ofisId, googleBekliyor)`
- tablo `senkron_haric (id, ofisId, saglayici, disKimlik, telefonAnahtar, ad, createdAt)` — RLS açık, ofise bağlı (CASCADE), `OFIS_MODELLERI`'nde.

## Cloudflare
- `wrangler.jsonc`: üçüncü zamanlayıcı `*/15 * * * *` (Google). Supabase `pg_cron` kurulumu (`prisma/sql/senkron_cron.sql`) artık gerekmez.
- Yeni değişkenler: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` (Secret). Girilmezse özellik kapalı kalır, hata vermez.

## Testler
- `tests/v321.test.ts` (11, veritabanısız) · `tests/v321-db.test.ts` (12, PGlite + sahte Google) → `npm run test:db` toplam 266 test.
- `npm run canli:test:google` — gerçek Worker (workerd) + sahte Google: bağlan → dönüş → içe aktarma → çift yönlü → silme → zamanlayıcı → kaldır (16 denetim).
- Tarayıcıda: demo (18 adım) ve canlı arayüz gerçek Worker + PostgreSQL karşısında denendi.

## Sınanamayan ve bilinen sınırlar
- **Gerçek Google hesabıyla sınanmadı** (bu ortamda Google istemci kimliği yok). Google tarafı, People API belgelerine göre yazılmış sahte bir sunucuyla sınandı. İlk gerçek bağlantıda özellikle bakılacaklar: `updateContact` gövdesinin kabulü (etag + `metadata.sources`), `createContact` sonrası ad biçimi.
- Bir ofis = bir Google hesabı. Her danışmanın kendi rehberini bağlaması (kişi başı bağlantı) bu sürümde yok.
- Telefon ofis içinde tekildir (v3.20): Google'daki bir numara ofiste başka bir danışmanın özel kişisinde kayıtlıysa yeni kişi açılmaz.
- People API'de anlık bildirim yoktur; "anında" değil, en geç 15 dk (uygulama açıkken 5 dk).
- Google doğrulaması yapılana kadar: "doğrulanmamış uygulama" uyarısı ve 100 hesap sınırı.
- Etiket süzgeci (yalnızca şu etiketler) canlı ekranda gösterilmiyor; açıkken yeni kişi Google'a gönderilmez.

## Canlıya alma kontrol listesi
1. Supabase'de yedek alın.
2. Dal `main`'e alınınca Cloudflare kendiliğinden yayınlar. Uygulamayı açın → "İlk kurulum" ekranında **Kurulumu tamamla** (migration v3.21).
3. `docs/GOOGLE_BAGLANTI_KURULUMU_v3.21_8Ekim2026.md` Bölüm A (Google Cloud + iki Cloudflare değişkeni).
4. Bağlantılar › **Google ile bağlan** → kendi hesabınızla deneyin: (a) telefona bir kişi kaydedin, "Google ile eşitle" → geldi mi; (b) Anahtar'da elle kişi ekleyin, eşitleyin → telefonda göründü mü; (c) Anahtar'dan silin → telefonda duruyor mu.
5. Başka ofislere açmadan önce: Google doğrulama başvurusu + gizlilik politikası.

## Sonraki sürümler (değişmedi + ek)
- v3.22: plan sınırlarının zorlanması (Google eşitlemesi Pro'ya bağlanacaksa burada), kullanım ölçümü.
- Aday: kişi başı Google bağlantısı (her danışman kendi rehberi), Google'a gönderilen kişilere "Anahtar CRM" etiketi.
