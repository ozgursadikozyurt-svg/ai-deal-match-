# Anahtar CRM — Devir Notu (v3.26 · 12 Ekim 2026)

Yeni konuşmanın başına şunu yapıştır:
"Anahtar CRM'e devam ediyorum. Önce projedeki `ANAHTAR_CRM_DEVIR_v3.26_12Ekim2026.md`, `ANAHTAR_CRM_EK_v3.26_12Ekim2026.md` ve `ANAHTAR_CRM_SPRINT_PLANI_v3.26_12Ekim2026.md` belgelerini oku."
(Bugün panosu / İlgilenenler: `ANAHTAR_CRM_EK_v3.25_11Ekim2026.md`; Gelen Kutusu: `ANAHTAR_CRM_EK_v3.23_10Ekim2026.md`; mimari ve önceki geçmiş: `ANAHTAR_CRM_DEVIR_v3.24_10Ekim2026.md` ve eskileri.)

## 1) Kısa özet
- Depo `github.com/ozgursadikozyurt-svg/ai-deal-match-`; `main`'e push → Cloudflare otomatik yayın; canlı `https://anahtarcrm.ozgursadikozyurt.workers.dev`; Supabase `nhizjkeefbxafvncszow`.
- Güncel sürüm: **3.26**. Veritabanı göçü VAR: `20261012100000_v326_kayit_aciklama` → canlıda "Kurulumu tamamla".
- Cloudflare ücretsiz plan: istek başına 10 ms işlemci (sprint planında ücretli plana geçiş önerisi).

## 2) Bu oturumda (v3.25 → v3.26)
Benim süresiz · Süresi yaklaşanlar ekranı + Toplu +30 · kartta +30 (≤5 gün) · +60/+90 kalktı · Gelen kutusu 7/15/30 gün · kart yanında paylaşım seçimi · Açıklama alanı · kartta kişi tekrarı kalktı · Görevler ekranı (menü sonu) · açık kayıt (`ACIK_KAYIT=1` ile) · sprint planı belgesi.

## 3) Açık işler / Özgür'ün yapacakları
1. Canlıda "Kurulumu tamamla" (açıklama sütunu).
2. Sürüm notlarındaki test adımları.
3. Sprint planı S1: SMTP sağlayıcısı (Resend/Brevo) için hesap + alan adı DNS kaydı; KVKK metinleri için avukat; beta için 3–5 danışman adı.
4. `ACIK_KAYIT` şimdilik AÇILMAYACAK (S3).

## 4) Sonraki geliştirme
Sprint planı §2–§3 (SMTP, KVKK sayfaları, ilk giriş sihirbazı, Ücretsiz kayıt sınırı, kullanım ölçümü, sabah özeti, iyzico, ortak havuz / Dijital El Sıkışma).

## 5) Önemli dosyalar
v3.26: `demo/sure.tsx` · `demo/gorevler.tsx` · `demo/app.tsx` (`KayitKart`, `ListePaylas`, nav) · `demo/depo.ts` (`benimSuresiz`) · `src/lib/domain/gecerlilik.ts` · `demo/gelen-kutusu.tsx` (gün süzgeci) · `src/lib/services/ofis.ts` (`kendiOfisiniAc`) · `src/app/api/kayit-ol/route.ts` · `src/canli/worker.ts` · `demo/canli.tsx` (`KayitOl`) · `prisma/migrations/20261012100000_v326_kayit_aciklama`.
