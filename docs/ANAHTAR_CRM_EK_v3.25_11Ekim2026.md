# Anahtar CRM — Ek (v3.25 · 11 Ekim 2026)

Bu sürüm: **Bugün panosu**, **İlgilenenler / gösterilenler** alanı ve **kompakt formlar**. Veritabanı değişikliği yok ("Kurulumu tamamla" gerekmez).

## 1) Bugün panosu
Yer: Ana Sayfa › ★ Benim ve ofisim kartının içi (kart artık karşılama satırının hemen altında). Eski "N aktif talep, N portföy ve N sunulabilir eşleşme seni bekliyor" cümlesi kaldırıldı.

**Görünüm:** özet çipleri (geciken · bugün · bu hafta · ✓ tamam), ilerleme çubuğu, ilk 5 görev açık, "Kalan N görevi göster", kapalı "Bu hafta (N)" listesi ("Bugüne al" düğmesi), "+ Görev". Günlük liste en çok **15** görev; fazlası sıraya girer. Hepsi bitince "Bugünü sıfırladın".

**Görev tablosu alanları:** kişi · bağlı talep/portföy/eşleşme · tür (ara · sunum gönder · yer göster · belge) · vade · sonuç (açık/tamam/kapandı).

**Üç düğme**
| Düğme | Sonuç |
|---|---|
| Ulaşılamadı | Yarına atar, deneme sayısı +1 ("2. kez ulaşılamadı") |
| Görüşüldü | Not (kayda görüşme notu) + Yarın · 3 gün · 1 hafta · 1 ay · tarih · "Gerek yok" → yeni "Sonraki iletişim" görevi. Talep süresi görevinde +30/60/90 gün uzatma |
| İlgilenmiyor | Neden sorar, görevi kapatır. Eşleşme görevinde eşleşmeyi koparır (bir daha önerilmez); talep süresi görevinde talebi pasife alır |

**Sistemin ürettiği görevler** (yalnızca ★ Benim / ◆ Ofisim kayıtları için)
- Takip durumundan: Bildirildi → 2 gün sonra "Sunuma yanıt al" · Gösterim → ertesi gün "Gösterim izlenimini sor" + 2 gün sonra "Geri dönüş al" · Pazarlık → ertesi gün teklif takibi · Kapandı → 2 gün sonra "Kapora ve evrakları tamamla" · Koparıldı → eşleşmenin açık görevleri kapanır.
- Süre/temas: talep süresi 7 gün kala "hâlâ arıyor mu?" · portföyde 30 gün temas yoksa "mal sahibini ara, fiyatı teyit et" · yetki belgesi 10 gün içinde bitiyorsa uyarı.
- Yeni sıcak eşleşme (Sunulabilir + Yeni): günlük kota 5; sürekli temas görevleri günlük kota 3 (liste bitirilebilir kalsın).
- Fiyat düştü: portföyün fiyatı kaydedilirken düşmüşse, daha önce ilgilenen herkes için "tekrar ara". (Yalnızca ekrandan kayıt kaydında; toplu içe aktarmada fiyat güncellemesi görev üretmez.)

**Sonraki iletişim sorusu:** eşleşme detayında Görüşüldü ya da Koparıldı seçilince "Bir sonraki iletişim ne zaman?" çıkar; seçilen gün göreve dönüşür. Her satırda **Google Takvim'e ekle** (▦) bağlantısı var (OAuth gerekmez).

## 2) İlgilenenler / gösterilenler
Talep ve portföy detayında varsayılan **kapalı** bölüm: "İlgilenenler (N)" — başlıkta sayı ve özet ("2 gösterildi · 1 ilgilendi"). Satır: rehberden kişi + durum (İlgilendi · Sunuldu · Gösterildi · Teklif verdi · Anlaştı · Vazgeçti) + tarih + not. Kişi kartında aynı kayıtlar "Gösterilen portföyler (N)". Eşleşme Takip düğmeleri de bu listeyi besler (Bildirildi→Sunuldu, Görüşüldü→İlgilendi, Gösterim→Gösterildi, Pazarlık→Teklif, Kapandı→Anlaştı, Koparıldı→Vazgeçti).

## 3) Formlar
- Teknik özelliklerde birimsiz küçük sayılar (banyo sayısı, bulunduğu kat, binanın kat sayısı, bina yaşı…) dar kutu + − / + düğmesi.
- Alan ızgarası 210 px yerine 150 px (telefonda 2 sütun); teknik alanlarda 132 px, ince etiket ve kutu.

## 4) Teknik
- Alan kuralları: `src/lib/domain/gorev.ts` (saf, zod). Durum işlemleri: `demo/bugun-eylem.ts`. Ekranlar: `demo/bugun.tsx`, `demo/ilgilenenler.tsx`.
- Saklama: `Ayar` tablosunda yeni anahtarlar `gorevler` ve `ilgilenenler` (JSON, ofis bazında izole). Göç yok. Ödünleşim: ilişkisel sorgu yok, sınır (görev 500 / ilgilenen 2000 satır; kapanalı 60 günü geçen görevler atılır). Çok büyürse ayrı tabloya taşınır.
- Sanal görevler her çizimde hesaplanır (`v-<otoAnahtar>`); yapılan/ertelenen/kapatılan görev saklanır ve aynı anahtarlı sanalı gizler.
- Sunucu şeması toleranslı (`z.unknown` + normalize): bozuk bir satır tüm isteği reddetmez.
- Demo: sabit "bugün" 30 Eyl 2026; örnek veride 1 geciken + 1 bugünkü görev + 1 ilgilenen kaydı hazır gelir.
- Testler: `tests/v325.test.ts`.
