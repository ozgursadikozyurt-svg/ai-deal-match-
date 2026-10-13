# Anahtar CRM — EK v3.27 · 13 Ekim 2026

**Konu:** Eşleştirme kalitesi. Canlı veri incelemesi (62 aktif talep × 410 aktif portföy, mahalle komşuluk tablosu dahil) sonucu yapılan düzeltmeler.

## 1. Neden

| Bulgu (v3.26, canlı veri) | Etki |
|---|---|
| Daire ↔ Ofis "benzer aile" olarak kendiliğinden eşleşiyordu | 50–55 m² ofis talebine 151 daire; gerçek ofisler 25. sıraya düştü |
| Bütçenin çok altı yalnızca hafif puan kaybıydı | 35 milyon bütçeye 3,5 milyonluk daire 60 puan; 103 böyle eşleşme |
| Kiralık depolarda yıllık kira "aylık" kaydedilmişti (11 ilan, çoğu tek içe aktarmadan) | 31 iyi eşleşme "bütçe aşımı" ile gizlendi (ör. Yenigöl 1000 m², ayda 83–108 bin) |
| 75+ puanlı 357 eşleşmenin 326'sında ≤ 3 kriter ölçülebilmişti | Yüksek puan, az bilgiye dayanıyordu |
| "—SATILIK ARSA—" yazan talep Büro/Ofis kayıtlı | 157 daireyle eşleşme; uygun arsa hiç çıkmadı |
| Aynı ilan iki kez girilmiş (9 grup / 19 kayıt) | Listede çift satır |

## 2. Değişiklikler

1. **Tip ailesi** (`src/lib/domain/kategori.ts`): `AILE_YAKINLIK` satırlarına `otomatik` alanı. Depo↔Üretim, Dükkan↔Restoran, Ofis↔Hizmet otomatik; Daire↔Ofis, Bina/Müstakil↔Turizm yalnızca talep o tipi alternatif seçtiyse. `tipGecerli()` hem `temelUyum` hem motor içinde ("Mülk tipi uymuyor" engeli).
2. **Bütçe tabanı** (`MODEL.fiyatAlt.taban = 0.3`): satışta fiyat < bütçenin %30'u → elenir ("farklı segment"). Kirada uygulanmaz (büyük bütçeli depo talebine küçük depo meşru aday).
3. **Yıllık kira şüphesi** (`kiraPeriyotSuphesi`, `KIRA_BIRIM_UST.SANAYI = 600 TL/m²/ay`): eşik aşılırsa fiyat 12'ye bölünerek karşılaştırılır, `uyarilar`a "yıllık girilmiş olabilir" düşer, eşleşme en fazla Koşullu. Kayıt detayında da uyarı.
4. **İçe aktarma** (`src/lib/domain/kira-periyot.ts`): "yıllık kira", "kirası yıllık", "TL/yıl", "yıllık 1.2 milyon" → `YILLIK`. "yıllık peşin / yıllık ödenir" ödeme şeklidir, tutar sayılmaz. Portal tablosu (Revy), portal sayfası ve WhatsApp hızlı ayrıştırıcı. Şüpheli birim kiraya kontrol notu.
5. **Güven göstergesi** (`OnizlemeSonucu.guven`): ölçülen kriter / toplam. ≤ 3 ölçülen, çekirdek (m²/fiyat/oda) eksik ya da tip çelişkisi → DÜŞÜK; DÜŞÜK güven "Sunulabilir" olamaz. Kartta "Az veri · 3/5"; Eşleşmeler ekranında az verililer varsayılan gizli ("+N az verili").
6. **Tip çelişkisi** (`src/lib/domain/tip-celiskisi.ts`): metin başka aileyi söylüyor ve kendi ailesinin hiçbir kelimesi geçmiyorsa uyarı. Türkçe harfler için Unicode kelime sınırı.
7. **Mükerrer ilan** (`src/lib/eslestirme/mukerrer.ts`): tip/işlem/m²/fiyat/oda/mahalle birebir aynıysa aynı talebin listesinde tek satır, "+N aynı ilan". Kayıtlar silinmez.

8. **Kira her zaman aylık** (`kirayiAyligaCevir`, `KayitCreateSchema` içinde — form, tablo, WhatsApp ve API aynı yoldan geçer): kirada YILLIK girilen fiyat / bütçe 12'ye bölünür, `kiraOdemeSekli = YILLIK_PESIN`, yıllık tutar `operasyonNotu`na ("Kira yıllık isteniyor: X TL/yıl (aylık ≈ Y TL)"). Kirada TOPLAM → AYLIK. Antalya'da yıllık peşin kira yaygın; karşılaştırma ve ekranda okuma aylık üzerinden.
9. **İstenen ama bilinmeyen özellik**: 99 depo portföyünün 83'ü sahibinden/Revy'den yalnızca başlıkla geliyor (açıklama yok), yani "ofis / rampa / elektrik" bilgisi kaynağında yok. Eleme yapılmaz; her bilinmeyen istek −4 (en çok −12), skor tavanı 85, uygunluk Koşullu ("Sorulacak"). Açıkça karşılanmayan istek −8 (en çok −16). Kullanım amacı sayılmaz. Örnek ("Yenigöl 1000–1500 m², ofisli"): ofisi doğrulanmış 2 depo 90–91 Sunulabilir; ofis bilgisi olmayanlar 85 Koşullu; ofisi olmayan daha aşağıda.
10. **Kapalı alan yedeği**: depo / sanayide `kapaliAlanM2` boşsa ilan m²'si kullanılır.

11. **Var / Yok hızlı cevap** (`HizliCevaplar`, demo/kartlar.tsx): bilinmeyen evet/hayır özellik için "Sorulacak" çipinin içinde iki küçük düğme (ayrı satır açmaz; dokunmatikte biraz büyür). Basınca portföyün özelliğine yazılır, bildirim çıkar, kart açılmaz. Eşleşme detayında da aynı.

## 3. Ölçüm (aynı canlı veri, önce → sonra)

| | v3.26 | v3.27 |
|---|---|---|
| Önerilen eşleşme | 1.693 | 1.474 (mükerrer tek satır) |
| Eşleşmeler ekranında varsayılan görünen | 1.693 | 1.034 (az verili gizli, tek dokunuşla açılır) |
| Ofis talebine daire | 151 | 0 |
| Satışta bütçenin < %30'u | 103 | 0 |
| Geri kazanılan depo eşleşmesi (yıllık kira) | — | 31 |
| "Sunulabilir" | 243 | 128 (bilinmeyen istek artık sorulmadan sunulmuyor) |

## 4. Veritabanı

Şema değişikliği yok. Canlıdaki 11 depo ilanının periyodunun YILLIK'a çevrilmesi ayrı bir veri işlemidir; motor bu sürümde bunları zaten 12'ye bölerek karşılaştırır.

## 5. Testler

`tests/v327.test.ts` (8 test) geçer. Tam takımda kalan 44 hata v3.26'da da aynıdır: test ortamındaki PGlite sunucusunun bağlantıyı kesmesi ("Connection terminated unexpectedly").
