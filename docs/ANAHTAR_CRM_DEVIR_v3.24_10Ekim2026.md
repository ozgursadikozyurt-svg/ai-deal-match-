# Anahtar CRM — Devir Notu (v3.24 · 10 Ekim 2026)

Yeni konuşmanın başına şunu yapıştır:
"Anahtar CRM'e devam ediyorum. Önce projedeki `ANAHTAR_CRM_DEVIR_v3.24_10Ekim2026.md` ve `ANAHTAR_CRM_EK_v3.24_10Ekim2026.md` belgelerini oku."
(Gelen Kutusu ayrıntısı `ANAHTAR_CRM_EK_v3.23_10Ekim2026.md`; mimari, kurallar ve önceki geçmiş için `ANAHTAR_CRM_DEVIR_v3.22.2_10Ekim2026.md` ve `ANAHTAR_CRM_DEVIR_v3.22.1_9Ekim2026.md` hâlâ geçerli.)

## 1) Kısa özet
- Depo `github.com/ozgursadikozyurt-svg/ai-deal-match-`; `main`'e push → Cloudflare otomatik yayın; canlı `https://anahtarcrm.ozgursadikozyurt.workers.dev`; Supabase `nhizjkeefbxafvncszow`.
- Güncel sürüm: **3.24** (canlıda). Veritabanı göçü YOK. v3.23'ün göçü (`20261010100000_v323_gelen_kutusu`) canlıya alındı; "Kurulumu tamamla" basıldı.
- Cloudflare ücretsiz plan kuralı sürüyor: istek başına 10 ms işlemci. Dosya baytları Worker'dan geçirilmez (Gelen Kutusu ayrıştırması tarayıcıda; v3.24'ten beri fotoğraflar da doğrudan Supabase'e).

## 2) Bu oturumda (v3.23 → v3.24)
- v3.23 canlıya alındı; Gmail köprüsü Özgür'ün hesabında çalışıyor. Köprü yamaları: arşivleme (gelen kutusunda görünmez, AnahtarCRM etiketinde), Drive "AnahtarCRM Gelen" klasöründen alma, posta kimliğiyle izleme (aynı konulu yeni posta eski etiketli konuşmaya düşünce atlanıyordu).
- v3.24: Gelen Kutusu Veri Girişi sekmesi + düz liste; Yapıştır incelemesine süzgeçler, hazırlar önce, eklenenler listede kalır; Kaynak seçimi (Emlak grubu · Sahibinden · Portal · Kendi portföyüm, `src/lib/domain/kaynak.ts`, yeni alan yok); tek satır başlık (CSS); eşleşme detayında kişi iletişimi + orijinal metin; fotoğraf doğrudan yükleme (503 düzeltmesi). Ayrıntı: EK v3.24.

## 3) Açık işler / Özgür'ün yapacakları
1. Canlıda bir portföye 3–4 fotoğraf ekle: 503 çıkmamalı. Çıkarsa ekran görüntüsü + saat (Cloudflare › Workers › anahtarcrm › Logs).
2. Veri Girişi › Gelen kutusu ve Yapıştır incelemesini dene (testEt adımları sürüm notlarında).
3. Gmail köprüsü kodu v3.23 son hâli (posta başına izleme); E-posta kurulumu'ndan kopyalanan kod günceldir.
4. İsteğe bağlı: alan adı → Email Routing → `GELEN_ALAN_ADI`; Revy'ye API / zamanlanmış rapor sorusu.
5. Önceki açık işler (v3.22.2 devir §3): Google'ı yeniden bağla; elle düzeltilecek 4 kayıt.

## 4) Sonraki geliştirme fikirleri (öncelik sırasıyla)
- Gelen Kutusu içinde toplu yapay zekâ ("Kontrol gerekenleri oku") — şimdilik dosya Veri Girişi › WhatsApp'a devrediliyor.
- Android'de "Paylaş › Anahtar CRM" (PWA share target): e-postasız, tek dokunuş.
- Portal kayıtlı arama bildirim e-postalarını (yeni ilan uyarısı) aynı kutuya almak.
- Aynı WhatsApp grubunda "son dışa aktarımdan sonrası" işareti (her gün tüm geçmiş okunmasın).
- `durumGetir` ilk yüklemesinde kişilerin önbelleğe alınması (v3.22.2 devir §4, hâlâ en büyük CPU kalemi).

## 5) Önemli dosyalar
v3.24: `src/lib/domain/kaynak.ts` · `demo/kaynak-secici.tsx` · `demo/ai-kutusu.tsx` (inceleme) · `demo/app.tsx` (`Taraf`, menü) · `demo/ice-aktarma.tsx` (`VeriGirisi` sekmeleri) · `demo/foto.ts` + `src/app/api/kayit/[id]/fotolar/route.ts` + `src/lib/depolama/supabase.ts › yuklemeBaglantisi` · `demo/sayfa.html` (v3.24 CSS bloğu) · `tests/v324.test.ts`.
v3.23: `docs/ANAHTAR_CRM_EK_v3.23_10Ekim2026.md` · `docs/GELEN_KUTUSU_KURULUMU_v3.24_10Ekim2026.md` · `src/lib/ingest/gelen.ts` (saf yardımcılar, köprü betiği) · `src/lib/services/gelen.ts` · `src/app/api/gelen/**` · `src/canli/worker.ts` (`email`, `/api/gelen/al`) · `demo/gelen-oku.ts` · `demo/gelen-aday.ts` · `demo/gelen-depo.ts` · `demo/gelen-kutusu.tsx` · `demo/ornek-gelen.ts` · `src/lib/ingest/tablo.ts` · `src/lib/ai/jargon.ts` · `tests/v323*.test.ts`.

## 6) Sandbox notu
Prisma istemcisini yeniden üretmek için şema motoru indirilemiyor: `PRISMA_SCHEMA_ENGINE_BINARY=<çalıştırılabilir boş betik> PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING=1 npx prisma generate`. Artımlı göç SQL'i: PGlite'ı başlat, `node scripts/gen-migration-diff.mjs <eski şema> <çıktı>`.
