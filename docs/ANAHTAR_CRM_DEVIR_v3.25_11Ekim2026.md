# Anahtar CRM — Devir Notu (v3.25 · 11 Ekim 2026)

Yeni konuşmanın başına şunu yapıştır:
"Anahtar CRM'e devam ediyorum. Önce projedeki `ANAHTAR_CRM_DEVIR_v3.25_11Ekim2026.md` ve `ANAHTAR_CRM_EK_v3.25_11Ekim2026.md` belgelerini oku."
(Gelen Kutusu: `ANAHTAR_CRM_EK_v3.23_10Ekim2026.md`, `GELEN_KUTUSU_KURULUMU_v3.24_10Ekim2026.md`; mimari ve kurallar için `ANAHTAR_CRM_DEVIR_v3.24_10Ekim2026.md` ve eskileri hâlâ geçerli.)

## 1) Kısa özet
- Depo `github.com/ozgursadikozyurt-svg/ai-deal-match-`; `main`'e push → Cloudflare otomatik yayın; canlı `https://anahtarcrm.ozgursadikozyurt.workers.dev`; Supabase `nhizjkeefbxafvncszow`.
- Güncel sürüm: **3.25**. Veritabanı göçü YOK (görevler/ilgilenenler `Ayar` JSON'u).
- Cloudflare ücretsiz plan: istek başına 10 ms işlemci. Yeni veri `/api/durum` ayar parçası olarak yalnızca değişince gider.

## 2) Bu oturumda (v3.24 → v3.25)
- Bugün panosu (Ana Sayfa › Benim ve ofisim): sistem görevleri + 3 düğme + sonraki iletişim sorusu + Takvim bağlantısı; üst cümle kaldırıldı.
- İlgilenenler (N) bölümü ve kişi kartında Gösterilen portföyler.
- Formlarda kompakt sayı alanları (− / +) ve daha sıkı ızgara.

## 3) Açık işler / Özgür'ün yapacakları
1. Canlıda Ana Sayfa'yı aç: Bugün panosu görünmeli; ★ Benim kayıtların yoksa Ayarlar › "Benim ve ofisim"de telefonunu tanıt (görevler yalnızca bu kayıtlar için üretilir).
2. sürüm notlarındaki testEt adımlarını dene; panonun günlük 15 sınırı ve görev metinleri senin tarzına uyuyor mu geri bildir.
3. Önceki açık işler (v3.24 devir §3).

## 4) Sonraki fikirler
- Dijital El Sıkışma (ortak havuzda güven protokolü) — tartışıldı, henüz yapılmadı.
- Görevler büyürse `Ayar` JSON'dan ayrı tabloya geçiş (göç gerekir).
- Fiyat düştü kuralı toplu içe aktarma/Gelen Kutusu fiyat güncellemelerine de bağlanabilir (şu an yalnızca ekrandan kayıtta).
- Bildirim: sabah özet e-postası/push ("2 geciken, 5 bugün").
- `durumGetir` kişi önbelleği (CPU en büyük kalem).

## 5) Önemli dosyalar
v3.25: `src/lib/domain/gorev.ts` · `demo/bugun-eylem.ts` · `demo/bugun.tsx` · `demo/ilgilenenler.tsx` · `demo/girdi.tsx` (`SayiAdim`) · `demo/form.tsx` · `src/lib/services/durum.ts` · `demo/canli-esle.ts` · `tests/v325.test.ts`
