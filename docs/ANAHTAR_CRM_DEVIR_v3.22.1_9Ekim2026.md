# Anahtar CRM — Devir Notu (v3.22.1 · 9 Ekim 2026)

Bu belge, geliştirmeye yeni bir konuşmada devam etmek içindir. Yeni konuşmanın başına şunu yapıştır:
"Anahtar CRM'e devam ediyorum. Önce projedeki `ANAHTAR_CRM_DEVIR_v3.22.1_9Ekim2026.md` ve `ANAHTAR_CRM_EK_v3.22_9Ekim2026.md` belgelerini oku."

## 1) Kısa özet
- Uygulama: WhatsApp gruplarından gelen arz (portföy) ve talepleri AI ile ayrıştırıp eşleştiren emlak CRM'i (Antalya, ticari gayrimenkul). Sahibi: Özgür (teknik değil; veritabanı kurulumunu kendisi yapamaz).
- Depo: `github.com/ozgursadikozyurt-svg/ai-deal-match-` · `main`'e push → Cloudflare otomatik yayınlar (2-3 dk sürer; bu sürede 503 görülebilir).
- Canlı adres: `https://anahtarcrm.ozgursadikozyurt.workers.dev` · sağlık: `/api/saglik` → `{"ok":true,"vt":true}`
- Veritabanı: Supabase `nhizjkeefbxafvncszow` (eu-central-1). Worker: Cloudflare `anahtarcrm`.
- Güncel sürüm: **3.22.1** (commit c501338). Veritabanı göçü gerekmez; son göç `20261009100000_v322_sahiplik_haric`.

## 2) Mimari (özet)
- React 18 SPA: `demo/*.tsx` (demo ve canlı aynı arayüz). Canlı: `demo/canli.tsx`, kayıt kuyruğu `demo/canli-kaydet.ts`.
- Eşleştirme motoru (saf fonksiyon): `src/lib/eslestirme/onizleme.ts` (Anahtar Uyum Matrisi), fırsat kademesi `firsat.ts`.
- Worker/API: `src/canli/worker.ts`, rotalar `src/app/api/**`; Prisma 7 + Postgres; göçler gömülü, "Kurulumu tamamla" ile uygulanır.
- Sürüm tek kaynağı `src/lib/surum.ts`; `npm run surum:damgala`; `npm run demo` dist HTML'i üretir ve `SURUMLER.md`'yi yeniden yazar (elle düzenlenmez).
- Testler: `npm run test:db` (PGlite; 302 test, 301 geçer, 1 atlanır). Prisma generate için sandbox'ta: `PRISMA_SCHEMA_ENGINE_BINARY=/tmp/claude-0/sp/se PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING=1`.

## 3) Çalışma kuralları (Özgür'ün tercihleri)
- Öncelik kararlarını Claude kanıtla verir; seçenek listesi sunmaz.
- Dosya adlarında sürüm + tarih (`..._v3.22.1_9Ekim2026`); her kod değişikliğinde ilgili belgeler güncellenir.
- Uygulama arayüzden ve örnek veriyle denenebilir olmalı; her şey tek uygulama yapısında birleşir.
- Raporlar Türkçe, kısa ve sade.

## 4) Bu oturumda yapılanlar (v3.21.2 → v3.22.1)
- **v3.21.2:** komisyon toplamı kaldırıldı; geri dönüşte filtre/kaydırma korunur; kompakt filtreler; Konumlar/Bağlantılar/Yönetim Ayarlar altına.
- **v3.22:** yatay skor şeridi; ★ Benim / ◆ Ofisim işareti, süzgeci ve Ana Sayfa kısayolu (telefon/ad/firma ile otomatik bağlanır); "Hurma, Sarısu HARİÇ" mantığı; portföy kartında tek küçük fotoğraf; bütçesiz talepte puan çarpanı 0,75.
- **v3.22.1:** satışta fiyat periyodu hatası ("Aylık" artığı → "Bilinmiyor", ~%60) düzeltildi; tireli HARİÇ, "site içi olmayan", "7.5 M" bütçe okumaları; Benim = Öncelikli fırsat; fotoğraf yükleme/kayıt kuyruğu güvenliği (60 sn'de yeniden deneme, yerel yedek, gerçek hata metni); açılışta eski kayıtların kendiliğinden onarımı (`demo/onarim.ts`). Canlı veritabanı denetimi (327 kayıt / 3.683 çift) ayrıntıları EK belgede.

## 5) Açık işler / Özgür'ün yapacakları
1. **Kayıp talep:** ≤12.000.000 TL, ≥140 m², 3+1 talebi sunucuda yoktu (v3.22 yayını ile "Kurulumu tamamla" arasındaki pencerede reddedilmiş). Yeniden girilmeli.
2. **Elle düzeltilecek 4 kayıt:** PCNFHT99 (130.834 TL satılık), PTHBR026 (6.600), P097201K ve P74GC000 (devir bedeli "aylık kira" girilmiş → işlem "Devren").
3. **Canlı onarım:** TCPZ1V98 (hariç + site) ve TCPZ1X26 (bütçe 7 M) sonraki canlı açılışta kendiliğinden güncellenir.
4. **Doğrulanmadı:** gerçek telefondan fotoğraf yükleme; canlı sitede tıklayarak tam gezinti yapılmadı (testler + demo HTML duman testi yapıldı).
5. **503 olayı (9 Ekim ~15:50):** Cloudflare yayını (12:44 UTC) sırasındaki geçici kesinti; ardından `/api/saglik` ve veritabanı sağlıklı doğrulandı. Tekrarlarsa önce 3 dakika bekle, sonra `/api/saglik` adresine bak: `vt:false` ise Supabase, hiç yanıt yoksa Cloudflare tarafıdır.

## 6) Sonraki geliştirme için fikirler (öncelik sırasıyla)
- Kayıt ekranında "sunucuya kaydedildi / bekliyor / reddedildi" göstergesi (kuyruk durumu görünür olsun).
- Veri kalitesi uyarısı: satılıkta 1 milyon TL altı veya kirada 5 milyon TL üstü fiyat için kayıt anında uyarı.
- Fırsat ekranında ★/◆ kayıtlar için ayrı sayaç.

## 7) Önemli dosyalar
`docs/ANAHTAR_CRM_EK_v3.22_9Ekim2026.md` (tüm v3.22 ayrıntıları + denetim tablosu) · `SURUMLER.md` · `src/lib/surum.ts` · `demo/onarim.ts` · `demo/canli-kaydet.ts` · `src/lib/eslestirme/onizleme.ts` · `src/lib/eslestirme/firsat.ts` · `src/lib/domain/sahiplik.ts` · `src/lib/lokasyon/haric.ts`.
