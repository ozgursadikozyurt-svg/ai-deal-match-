# Anahtar CRM — Devir Notu (v3.23 · 10 Ekim 2026)

Yeni konuşmanın başına şunu yapıştır:
"Anahtar CRM'e devam ediyorum. Önce projedeki `ANAHTAR_CRM_DEVIR_v3.23_10Ekim2026.md` ve `ANAHTAR_CRM_EK_v3.23_10Ekim2026.md` belgelerini oku."
(Mimari, kurallar ve önceki geçmiş için `ANAHTAR_CRM_DEVIR_v3.22.2_10Ekim2026.md` ve `ANAHTAR_CRM_DEVIR_v3.22.1_9Ekim2026.md` hâlâ geçerli.)

## 1) Kısa özet
- Depo `github.com/ozgursadikozyurt-svg/ai-deal-match-`; `main`'e push → Cloudflare otomatik yayın; canlı `https://anahtarcrm.ozgursadikozyurt.workers.dev`; Supabase `nhizjkeefbxafvncszow`.
- Güncel sürüm: **3.23**. **Veritabanı göçü VAR:** `20261010100000_v323_gelen_kutusu` (yalnızca ekleme) → yayından sonra "Kurulumu tamamla" bir kez basılır.
- v3.23 dalı: `claude/gelen-kutusu-v3.23`. Bu not yazılırken `main`'e birleştirilmemişti (canlıya alma Özgür'ün onayını bekliyor); birleştirildiyse canlı sürüm 3.23'tür.
- Cloudflare ücretsiz plan kuralı sürüyor: istek başına 10 ms işlemci. Gelen Kutusu bu yüzden dosyayı sunucuda AÇMAZ; ayrıştırma tarayıcıda.

## 2) Bu oturumda (v3.22.2 → v3.23)
- **Gelen Kutusu (onay bekleyenler):** yeni ekran + menü + Ana Sayfa kartı. Revy Excel dökümü ve WhatsApp .zip / .txt tek havuzda; tarihe göre gruplu, kaynak / tür / işlem / durum süzgeçli, toplu ekle / atla, Tümünü temizle, mükerrer denetimi, fiyatı değişen ilan.
- **E-posta girişi:** `POST /api/gelen/al` (Gmail köprüsü, gizli ofis koduyla) ve Worker `email()` (alan adı gelince Cloudflare Email Routing). Ham dosya Supabase Storage "gelen" kovasında.
- **Revy dökümü okuması:** jargon şema hataları (otopark, tapu), arsa = imar, portal tür sözlüğü, başlıktan devren, fiyat akıl denetimi.
- Araştırma kararı: portallar doğrudan kazınmaz (Revy toplayıcı), WhatsApp resmi dışa aktarım (Groups API mevcut gruplara giremez; Baileys riskli).

## 3) Açık işler / Özgür'ün yapacakları
1. Demo dosyasıyla Gelen Kutusu'nu deneyip **canlıya alma onayı** ver (dal → main; sonra "Kurulumu tamamla").
2. **Gmail köprüsünü kur** (≈ 5 dk): `docs/GELEN_KUTUSU_KURULUMU_v3.23_10Ekim2026.md`. İlk gerçek postadan sonra script.google.com › Yürütmeler'e bak.
3. Canlıda doğrula: dosya yükleme (depo), 1.000 satırlık Revy dökümü, e-postayla gelen WhatsApp zip'i.
4. İsteğe bağlı: alan adı al → Email Routing → `GELEN_ALAN_ADI` (köprüye gerek kalmaz; satış için zaten gerekli).
5. Revy destek hattına sor: API, zamanlanmış rapor ya da e-postayla günlük liste var mı? Varsa elle dışa aktarma da kalkar.
6. Önceki açık işler (v3.22.2 devir §3): Google'ı yeniden bağla; Cloudflare "Exceeded CPU" grafiğine bak; elle düzeltilecek 4 kayıt.

## 4) Sonraki geliştirme fikirleri (öncelik sırasıyla)
- Gelen Kutusu içinde toplu yapay zekâ ("Kontrol gerekenleri oku") — şimdilik dosya Veri Girişi › WhatsApp'a devrediliyor.
- Android'de "Paylaş › Anahtar CRM" (PWA share target): e-postasız, tek dokunuş.
- Portal kayıtlı arama bildirim e-postalarını (yeni ilan uyarısı) aynı kutuya almak.
- Aynı WhatsApp grubunda "son dışa aktarımdan sonrası" işareti (her gün tüm geçmiş okunmasın).
- `durumGetir` ilk yüklemesinde kişilerin önbelleğe alınması (v3.22.2 devir §4, hâlâ en büyük CPU kalemi).

## 5) Önemli dosyalar
`docs/ANAHTAR_CRM_EK_v3.23_10Ekim2026.md` · `docs/GELEN_KUTUSU_KURULUMU_v3.23_10Ekim2026.md` · `src/lib/ingest/gelen.ts` (saf yardımcılar, köprü betiği) · `src/lib/services/gelen.ts` · `src/app/api/gelen/**` · `src/canli/worker.ts` (`email`, `/api/gelen/al`) · `demo/gelen-oku.ts` · `demo/gelen-aday.ts` · `demo/gelen-depo.ts` · `demo/gelen-kutusu.tsx` · `demo/ornek-gelen.ts` · `src/lib/ingest/tablo.ts` · `src/lib/ai/jargon.ts` · `tests/v323*.test.ts`.

## 6) Sandbox notu
Prisma istemcisini yeniden üretmek için şema motoru indirilemiyor: `PRISMA_SCHEMA_ENGINE_BINARY=<çalıştırılabilir boş betik> PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING=1 npx prisma generate`. Artımlı göç SQL'i: PGlite'ı başlat, `node scripts/gen-migration-diff.mjs <eski şema> <çıktı>`.
