# Anahtar CRM — Devir Notu (v3.22.2 · 10 Ekim 2026)

Yeni konuşmanın başına şunu yapıştır:
"Anahtar CRM'e devam ediyorum. Önce projedeki `ANAHTAR_CRM_DEVIR_v3.22.2_10Ekim2026.md` ve `ANAHTAR_CRM_EK_v3.22.2_10Ekim2026.md` belgelerini oku."
(Önceki ayrıntılar için `ANAHTAR_CRM_DEVIR_v3.22.1_9Ekim2026.md` ve `ANAHTAR_CRM_EK_v3.22_9Ekim2026.md` — mimari, kurallar, v3.22 / v3.22.1 geçmişi hâlâ geçerli.)

## 1) Kısa özet
- Uygulama, depo, canlı adres, Supabase / Cloudflare bilgileri: v3.22.1 devir notundaki gibi (depo `github.com/ozgursadikozyurt-svg/ai-deal-match-`, `main`'e push → Cloudflare otomatik yayın; sağlık `/api/saglik`; Supabase `nhizjkeefbxafvncszow`).
- Güncel sürüm: **3.22.2** · Veritabanı göçü gerekmez (son göç `20261009100000_v322_sahiplik_haric`).
- Cloudflare **ücretsiz plan**: istek başına 10 ms CPU. Bu yüzden her ağır okuma / her sık tetik 503 ("Exceeded CPU Time Limits") üretir. Kural: tüm kişileri / tüm kayıtları gereksiz yere okuma; `select` ile dar çek; artımlı çalış.

## 2) Bu oturumda (v3.22.1 → v3.22.2)
- 503'ün kök nedeni Cloudflare CPU sınırıydı (panelde 270 hata); Supabase sağlıklıydı. Sebep: 7.815 kişinin tüm sütunlarıyla okunması + Google senkronunun açılışta / 5 dk'da bir / 15 dk'da bir çalışması.
- Google eşitlemesi **günde bir (08:00 TR)** + **elle** ("Google ile eşitle" / "Şimdi eşitle"). Açılışta eşitleme yok. Değişiklik yokken tur 2 dış istek, kişi tablosu okunmaz. Google'ın artımlı anahtarı (syncToken) "son eşitlemeden beri" anlamına gelir.
- Kişiler ekranı 60'ar kişilik parçalarla çizilir; ölçüm: 7.800 kart 835–1.025 ms → 60 kart 32–56 ms. Süzme / sıralama / sayılar önbellekli; kayıt kuyruğu imza önbelleği.
- Kişi yenileme artımlı (`?yalniz=kisiler&sonra=`).

## 3) Açık işler / Özgür'ün yapacakları
1. v3.22.2 yayınlanınca (Cloudflare 2–3 dk) → Bağlantılar › **Google ile bağlan** (bağlantı önceki oturumda koparılmıştı; ilk içe aktarma bir kez tam rehberi tarar, sekme açık kalsın; 7.815 kişi zaten kayıtlı, telefonla eşleşir).
2. Cloudflare → anahtarcrm → Metrics → Errors: "Exceeded CPU Time Limits" artık sıfıra yakın olmalı; sürerse sebebi bul (hangi rota?) ya da Workers Paid ($5/ay).
3. Önceki açık işler (v3.22.1 devir §5): kayıp 12 M talep yeniden girilecek; PCNFHT99, PTHBR026, P097201K, P74GC000 elle düzeltilecek; gerçek telefondan fotoğraf yükleme doğrulanacak.

## 4) Sonraki geliştirme fikirleri (öncelik sırasıyla)
- `/api/durum` ilk yükleme: kişiler listesini de önbelleğe al (IndexedDB) ve açılışta yalnızca `sonra=` farkını iste (7.800 kişilik tam indirme her açılışta hâlâ var; tek büyük kalan CPU kalemi). Bunu `durumGetir`'i kayıt + kişi diye ikiye bölerek de yapabiliriz.
- Kayıt ekranında "sunucuya kaydedildi / bekliyor / reddedildi" göstergesi; veri kalitesi uyarısı (v3.22.1 devir §6).
- Başka cihazda silinen kişinin artımlı akışta görünmesi (silinen kişi izi tablosu).

## 5) Önemli dosyalar
`docs/ANAHTAR_CRM_EK_v3.22.2_10Ekim2026.md` · `src/lib/services/senkron.ts` (tembel bağlam, günlük varsayılan) · `src/lib/services/durum.ts` (`KISI_SEC`, `kisileriGetir`) · `demo/google-baglanti.ts` · `demo/canli-kaydet.ts` (`kisileriDegisenleriBirlestir`) · `demo/canli-esle.ts` (imza önbelleği) · `demo/kisiler.tsx` · `wrangler.jsonc` · `tests/v3222*.test.ts`.
