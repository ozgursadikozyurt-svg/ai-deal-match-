# Anahtar CRM — Ek v3.41 · 23 Ekim 2026
## Rehber parça parça (503 / Cloudflare CPU sınırı)

**Sorun.** v3.40 sonrası da "503" geldi. Veritabanı sağlıklı; neden Cloudflare Worker'ın ücretsiz plandaki istek başına 10 ms işlemci sınırı. Açılışta ~7.800 kişi (8 istek × 1.000 satır) çekiliyordu; bir sayfa bile sınırı aşabiliyordu.

**Çözüm.**
- Açılış: `diger` + tüm kayıtlar (742, 60'lık sayfalar) + yalnızca bir talebe / portföye bağlı kişiler (`parca=kisi&ilgili=1`, 250'lik sayfalar). Eşleşme hesabı kayıtlarla yapıldığı için etkilenmez.
- Rehber ekranı: "Rehberde N / TOPLAM kişi yüklü" çubuğu; **Devam et** = 4 × 250 kişi, **Hepsini yükle** = kalan hepsi, hata olursa **Yeniden dene**.
- Rehberde arama yazılınca, Gelen kutusu / Toplu içe aktarma / talep-portföy formu açılınca kalan rehber arka planda tamamlanır (var olan kişi yeni kişi sanılıp çift kayıt oluşmasın).
- Gelen kişiler `kisileriDegisenleriBirlestir` ile eklenir: kaydedilmemiş yerel iş korunur, gelmeyen kişi silinmiş sayılmaz (kayıt kuyruğu yanlışlıkla silmez).

**Dosyalar.** `demo/kisi-parca.ts` (yeni), `demo/canli.tsx`, `demo/kisiler.tsx`, `demo/gelen-kutusu.tsx`, `demo/ice-aktarma.tsx`, `demo/form.tsx`, `src/lib/services/durum.ts`, `src/app/api/durum/route.ts`.

**Testler.** `tests/v341.test.ts` (Devam et, hata, çift çağrı), `tests/v340-db.test.ts` (ilgili=1, kisiToplam).

**Bilinen sınır.** Sayfa açılışındaki ilk rehber (yalnızca bağlı kişiler) ile Rehber ekranı eksik görünebilir; çubuk bunu açıkça gösterir. 503 sürerse kalıcı çözüm Workers Paid planıdır.
