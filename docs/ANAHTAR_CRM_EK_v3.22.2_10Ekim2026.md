# Anahtar CRM — Ek: v3.22.2 Cloudflare ücretsiz plan CPU 503'leri · Kişiler ekranı donması · Google eşitlemesi günde bir / elle (10 Ekim 2026)

## Amaç (kullanıcı isteği, 10 Ekim)
1. Kişiler menüsüne girince donma ve kasma (7.815 kişi) düzelsin.
2. Google Kişiler eşitlemesi her uygulama açılışında mı çalışıyor? Sunucu hataları (503) bununla ilgiliyse günde 1 kez ya da elle yapılsın; Google "son kayıt tarihine göre" desteği varsa yalnızca yeni / değişen kişiler alınsın, 7.000 kişi tek tek kontrol edilmesin.
3. Cloudflare ücretsiz planda en iyi sonuç.

## Kanıt (neden)
- **503'ün nedeni:** Cloudflare paneli → Errors by invocation status: 270 × "Exceeded CPU Time Limits" (9 Ekim 12:00 → 21:00, yayından sonra yoğunlaşıyor). Supabase tarafı sağlıklıydı (bağlantı havuzu dolmamış, kilit / zaman aşımı / hata yok, Google senkron turları 1–2,5 sn). Yani sorun veritabanı değil, Worker'ın istek başına CPU sınırı (ücretsiz planda 10 ms).
- **Neden CPU:** (a) her `GET /api/durum` 7.815 kişiyi `findMany()` ile **tüm sütunlarıyla** (Google anlık görüntüsü JSON'u dahil, ~3 MB) okuyup JSON'a çeviriyordu; (b) her Google senkron turu (açılışta + 5 dk'da bir arayüzden, 15 dk'da bir sunucudan) değişiklik olsun olmasın 7.815 kişiyi belleğe yüklüyordu; (c) her tur sonunda arayüz 7.815 kişiyi yeniden indiriyordu.
- **Senkron ne zaman çalışıyordu:** `googleOtomatik` (demo/app.tsx): uygulama açılınca (son eşitleme 2 dk'dan eskiyse) ve sonra 5 dakikada bir; ayrıca Cloudflare zamanlayıcısı `*/15 * * * *`. Bağlantıyı koparınca bunların hepsi durdu → hatalar azaldı (kullanıcı gözlemi doğrulandı).
- **Donmanın nedeni (ölçüldü):** Kişiler listesi 7.800 kartın hepsini çiziyordu ve her kart için `kisininKayitlari` tüm kayıtları baştan tarıyordu. Aynı 7.800 kişi + 330 kayıtla sunucuda çizim: **eski 7.800 kart · 11,8 MB HTML · 835–1.025 ms; yeni 60 kart · 92 KB · 32–56 ms** (~20×; telefonda eskisi 5–10× daha yavaş = saniyelerce donma). Ayrıca ada göre sıralama her karşılaştırmada yeni `localeCompare` kuruyordu; kayıt kuyruğu her durum değişikliğinde 7.800 kişiyi JSON'a çeviriyordu.

## Google "son kayıt tarihine göre" destekliyor mu?
Evet — ama tarih filtresi olarak değil, **artımlı eşitleme anahtarı (syncToken)** olarak: People API `requestSyncToken=true` ile alınan anahtar bir sonraki çağrıda "o andan beri eklenen / değişen / silinen" kişileri döner. Kod bunu v3.21'den beri kullanıyordu (`kisiSayfasi`, `syncToken`); sorun eşitlemenin çok sık çalışması ve her turda tüm kişilerin veritabanından okunmasıydı. Anahtar ~7 gün geçerlidir; günlük zamanlayıcı onu hep taze tutar, süresi dolsa bile kod kendiliğinden tam eşitlemeye döner (v3.21.1).

## Değişenler
- **Zamanlayıcı:** `wrangler.jsonc` → `["0 3 * * *", "0 4 * * sun", "0 5 * * *"]`; Google eşitlemesi günde bir, 05:00 UTC (TR 08:00). 15 dakikalık yok.
- **Açılışta eşitleme yok:** `googleOtomatik` artık yalnızca bağlantı durumunu okur (`googleDurumYenile`); 5 dk'lık sayaç kaldırıldı. Elle: Kişiler › "Google ile eşitle" ve Bağlantılar › "Şimdi eşitle" (zaten vardı).
- **Hafif eşitleme (`src/lib/services/senkron.ts › googleSenkronCalistir`):** etiket listesi, ofis sahibi, "silinenler" listesi ve tüm kişiler yalnızca Google'dan değişen kişi geldiyse yüklenir (`baglamYukle`, `grupAdlari` tembel). Değişiklik yok → 2 dış istek (anahtar yenile + artımlı çekim), kişi tablosu okunmaz. Gönderilecek kişi yoksa gönderim sorguları da atlanır. Varsayılan `aralikDk` 1440.
- **Artımlı kişi yenileme:** `GET /api/durum?yalniz=kisiler&sonra=<ISO>` yalnızca `updatedAt ≥ sonra − 2 dk` kişileri döner (`kisileriGetir(prisma, sonra)`; yanıt `{ kisiler, zaman, artimli }`). `durumGetir` ilk yüklemede `kisiZamani` verir. Arayüz: `kisileriYenile` artık değişen kişileri alır (`CANLI.kisiZamani`), `canli-kaydet.ts › kisileriDegisenleriBirlestir` yerel kaydedilmemiş düzenleme / silmeyi korur; yenileme yalnızca özet bir şeyin değiştiğini söylüyorsa yapılır (`degistiMi`). Not: sunucuda başka cihazdan silinen kişi sayfa yenilenene kadar görünür kalır (silmeler artımlı akışta yok).
- **Dar `select`:** `KISI_SEC` — kişi okumaları yalnızca arayüzün kullandığı sütunları çeker (googleSnapshot / googleEtag / notion* taşınmaz).
- **Kişiler ekranı (`demo/kisiler.tsx`):** 60'ar kişilik parçalarla çizim (IntersectionObserver + "Daha fazla göster"; açık parça sayısı `useKalici` ile korunur → Geri'de kaydırma konumu yerine oturur; süzgeç / arama / sıralama değişince başa döner); talep / portföy sayıları tek geçişte `Map`; süzme + sıralama `useMemo`; arama `useDeferredValue`; arama metni kişi başına bir kez (`WeakMap`).
- **Sıralama:** `src/lib/siralama.ts` ortak `Intl.Collator("tr")` (sonuç `localeCompare(…, "tr")` ile birebir aynı).
- **Kayıt kuyruğu:** `demo/canli-esle.ts › imzaAl` imzaları nesne başına `WeakMap` önbelleğinde tutar (durum değişmez güncellendiği için güvenli); dönen tablolar her çağrıda kopyadır.
- **Ayarlar metni:** Google için "Sıklık" listesi kalktı, "Her sabah 08:00'de otomatik eşitle" + açıklama.

## Veritabanı
Değişiklik yok; "Kurulumu tamamla" gerekmez.

## Bilinen sınırlar / Özgür'ün yapacakları
1. **Google'ı yeniden bağla:** bağlantı koparılınca anahtar (syncToken) ve izin silindi. Yeni sürüm yayınlandıktan SONRA Bağlantılar › "Google ile bağlan" → ilk içe aktarma bir kez tam rehberi tarar (7.800 kişi, birkaç dakika–yarım saat; arayüz turları kendisi sürdürür, sekme açık kalsın). Sonrası günlük / elle ve hafif. Veriler (7.815 kişi) Anahtar'da duruyor; yeniden bağlanınca telefona göre mevcut kişilerle eşleşir, mükerrer açılmaz.
2. **Telefonda hemen kaydedilen kişi** artık en geç ertesi sabah 08:00'de ya da "Google ile eşitle"ye basınca gelir (eskiden ≤5 dk).
3. Ücretsiz planda tek bir ağır istek (ör. çok büyük ilk içe aktarma turu) CPU sınırına takılabilir; arayüz hatalı turu otomatik yineler (v3.21.1). Sürekli "Exceeded CPU" görülürse Cloudflare Workers Paid ($5/ay, CPU sınırı 30 sn) tek adımlık kalıcı çözümdür.
4. Gerçek telefondan canlı doğrulama yapılmadı: testler + 7.800 kişilik çizim ölçümü yapıldı; canlıda Kişiler ekranı ve Cloudflare "Errors" grafiği kontrol edilmeli.

## Testler
`tests/v3222.test.ts` (11 test: 1.500 kişide 60 kart + devam, süzgeçte başa dönme, sayaç doğruluğu, Türkçe sıralama + hız, imza önbelleği, artımlı birleştirme, `degistiMi`, açılışta eşitleme yok, `kisileriYenile`) ve `tests/v3222-db.test.ts` (PGlite + sahte Google: değişiklik yokken 2 istek; tek kişi değişince yalnızca o kişi; gönderilecek yokken ek istek yok; `?sonra`; günlük zamanlayıcı). `scripts/test-db.sh` listesine eklendi. Tam paket: 319 test, 318 geçti, 1 atlandı (önceden de atlanan), 0 hata. `npm run canli:build` + `wrangler deploy --dry-run` başarılı.
