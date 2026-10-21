# Anahtar CRM — Ek v3.39 · 21 Ekim 2026

**Konu:** Telefonda ekran düzeni — alt menü sığmıyordu, sayfa yakınlaşıp yana kayıyordu, uyum süzgeci tam açılmıyordu.
**Bağlam:** Özgür'ün 21 Ekim 16:17 ekran görüntüleri (v3.38, Eşleşmeler, Kimin: ★ Benim): sayfa sağa kaymış, alt menüde "Ana Sayfa" kesik; Uyum şeridinde yalnızca "Tümü 437 ✕".

## A. Neden
1. **Taşan başlık satırı.** Eşleşmeler başlığı (`.es-baslik`) `flex-wrap:nowrap` idi; v3.38'deki "Talep başına en iyi 10" / "+N" düğmeleri eklenince satır ekrandan genişledi. Tek bir taşan satır tüm belgeyi genişletir; tarayıcı sayfayı küçültür ve yana kaydırılabilir yapar → alt menü (ekran genişliğinde, sabit) kenardan taşmış görünür.
2. **Yakınlaştırma açıktı.** viewport `width=device-width,initial-scale=1` — iki parmak / çift dokunma serbest.
3. **Uyum şeridi.** `@media (max-width:520px){.skor-hazir{display:none}}` — v3.36'da kaydırıcı kaldırılıp düğmeye geçilirken telefondaki gizleme kuralı kalmıştı; telefonda seçilecek hiçbir şey görünmüyordu.

## B. Çözüm
- Başlık alt satıra iner (`.es-baslik{flex-wrap:wrap}`), düğmeler kırılmaz.
- Güvence: `html,body{overflow-x:clip;max-width:100%}` — hiçbir öğe sayfayı yana genişletemez (`clip`, `hidden`'ın aksine yapışkan başlık / alt çubuğu bozmaz). Yatay kayan çip satırları kendi içinde kaymaya devam eder.
- Sabit ekran: viewport `maximum-scale=1,user-scalable=no`; telefonda `touch-action:pan-x pan-y` (iki parmakla yakınlaştırma ve çift dokunma büyütmesi kapalı — iPhone viewport kuralını yok saydığı için CSS ile de). Yazı alanları zaten 16 px (iPhone odakta büyütmez).
- Uyum süzgeci: `input type=range` 1–5 (1 = Tümü, 2–5 = en az n/5), altında Tümü · 2 · 3 · 4 · 5 işaretleri; geniş ekranda yanında hazır düğmeler.
- Denetim: 360 px telefon görünümünde 9 ana ekranın (Ana Sayfa, Talepler, Portföyler, Eşleşmeler, İzleme, Kişiler, Veri Girişi, Ayarlar, Görevler) belge genişliği 360 px.

## C. Not
Yakınlaştırmanın kapanması küçük yazıları büyütmeyi de engeller; telefonun yazı boyutu ayarı (erişilebilirlik) çalışmaya devam eder.

## D. Değişen dosyalar
`demo/sayfa.html` · `demo/hizli-filtre.tsx` · `scripts/demo-build.ts` · `scripts/canli-arayuz.ts` · `src/lib/surum.ts` · `tests/v3212.test.ts` · `tests/v338.test.ts` · `tests/v339.test.ts` (yeni).
