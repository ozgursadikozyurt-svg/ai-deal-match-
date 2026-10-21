# Anahtar CRM — Ek v3.37 · 21 Ekim 2026

**Konu:** Bütçesiz talebin puanı · kaydedilmemiş değişiklik uyarısı · Mülk sahipleri süzgeci · Pasife al / Arşivle / Eşleşmeyi kopar üstte · ilan numarası
**Bağlam:** Özgür'ün 21 Ekim istekleri (beş madde). Veritabanı değişikliği yok; yayından sonra "Kurulumu tamamla" gerekmez.

## A. Talepte bütçe yoksa puan ekstra düşmez
**İstek:** "Eksik talepte 'bütçe yok' demesi — portföyde fiyat yoksa evet bu bir sorun, ancak talepteki bütçe m²'ye göre değişebilir. Bu yüzden skoru ekstra düşürme."

| Durum | v3.36 | v3.37 |
|---|---|---|
| Talepte bütçe yok, portföyde fiyat var | Fiyat bileşeni 0,4 sayılır + −8 + en fazla 79 (4/5) + Koşullu; kartta "Eksik: talepte bütçe yok"; az kriterli talepte güven DÜŞÜK | Fiyat bileşeni **nötr** (ağırlığı diğerlerine dağılır), ceza / tavan / "Eksik" yok, güven hesabında bütçe sayılmış gibi; gerekçede bilgi notu "Talepte bütçe yok — puanı düşürmez" |
| Portföyde fiyat yok (talep bütçeli ya da bütçesiz) | −8, en fazla 79 | **Aynen**: −8, en fazla 79, Koşullu, "Portföyde fiyat yok — fiyatı sorun" |
| Fiyat periyot / birim yüzünden karşılaştırılamıyor | −8, en fazla 79 | Aynen |

- Örnek: "Kepez 2.000–4.000 m² depo" (bütçesiz) → 3.000 m² / 250 bin TL depo: v3.36'da 4/5 (≤ 79), v3.37'de 5/5 — bütçeli hâliyle aynı.
- Sıra: bütçesiz eşleşme artık bütçesi doğrulanmış eşleşmeyle aynı seviyeye çıkabilir. Bilerek: bütçe m²'ye göre konuşulur; tek fark gerekçe notudur.
- Talep DNA'sındaki "Bütçe üst sınırı nedir?" sorusu müşteriye soru mesajında kalır (puanı etkilemez).
- Kod: `onizleme.ts` — `butcesizTalep`, eksik çekirdekte FIYAT hariç, `fiyatBilinmiyor` yalnızca portföy fiyatı yoksa, `butceNotr` (güven). `eksikVeriUyarilari` artık "talepte bütçe yok" yazmaz.
- Testler: `v322`, `v336` güncellendi (eski kural kasıtlı değişti); `v337` yeni depo örneği.

## B. Kaydedilmemiş değişiklik uyarısı
**İstek:** "Talep, portföy, işlem ya da kişi kaydederken yanlışlıkla başka bir menüye tıklayınca yaptıklarım kayboluyor; 'Değişiklikleri kaydedelim mi?' diye sorulmalı."

- `demo/kirli.ts`: değişikliği olan her form kendini bir kayda yazar (`useKaydedilmemis(degisti, ad, kaydet)`); kabuk ekran değiştirmeden önce bakar.
- Sorulan geçişler: sol menü / alt çubuk / menü sayfası, ekranlardaki tüm bağlantılar (`git`), "← Geri" (`geri`), telefonun / tarayıcının geri tuşu (popstate: tarayıcı adımı geri konur, sonra sorulur). Sekme kapanırken tarayıcı uyarısı (`beforeunload`).
- Pencere: **Kaydet ve devam et** (formun kendi doğrulamasıyla kaydeder; hata varsa ekranda kalınır, hatalar formda) · **Kaydetmeden çık** · **Vazgeç** (ekranda kal).
- Kapsam: talep / portföy formu, kişi kartı düzenleme, Kişiler'deki hızlı düzenleme ve yeni kişi, İşlemler formu, randevu formu, görüşme notu, eşleşme operasyon notu.
- "Değişiklik" ölçüsü: forma ilk dokunulduğu andaki hâl (`useIlkHal`) ile karşılaştırma — açılışta kendiliğinden yapılan düzeltmeler (işlem tipine göre periyot) sorulmaz; değiştirip geri alınan form da sorulmaz. Kendi Kaydet düğmesiyle ayrılan form sorulmaz.
- Form ekranı artık geçmişe girmez: formdan bir menüye geçip Geri denince formdan önceki ekrana dönülür (kaydedilmiş ya da bilerek bırakılmış formu yeniden açmaz).

## C. Mülk sahipleri süzgeci (Kişiler)
**İstek:** "Geçmişe dönük bazen mülk sahiplerini tekrar arıyorum; bir talebe istinaden depo sahibinin kiracısı çıkmış olabilir. Onları görebilmek istiyorum. Bizzat tanıdığım depo / mülk sahiplerini bir yerde gruplayıp eşleştirmek için kişilerde mi tutmalıyım?"

**Karar (gerekçeli):** Ayrı grup / etiket / liste açılmadı. Sahipler zaten Kişiler'de; "depo sahibi" bilgisi elle tutulursa portföy eklenip çıktıkça eskir. Bu yüzden sahiplik ve mülk tipi **portföy bağlarından türetilir**; elle girilen tek şey, portföyü sistemde olmayan tanıdık sahip için rol + "Sahip olduğu mülk tipleri".

- Sahip sayılan kişi: bir portföye **Mülk sahibi** (SAHIP) bağıyla bağlı, ya da rolü **Kiraya veren / Satıcı** (portföyü olmasa da). Emlakçı / aracı bağları sayılmaz.
- Kişiler › Filtrele › **Mülk sahipleri**: Tüm mülk sahipleri · Aktif portföyü olanlar · **Pasif / arşiv portföyü olanlar (tekrar ara)** (pasif, arşiv, süresi dolmuş) · Portföyü kayıtlı olmayan sahipler; + **Mülk tipi** (Depo / Lojistik, Fabrika / Atölye…, sayılarıyla).
- Tek dokunuş: Kişiler › **Tekrar aranacak sahipler** = pasif / arşiv portföyü olanlar, Son iletişim artan (hiç aranmamış ya da en eski önce).
- Kişi kartı (listede): "Depo / Lojistik · 2 portföy (1 pasif/arşiv) · 3 sunum". Sunum = o sahibin portföylerinin müşteriye iletilmiş / görüşülmüş / gösterilmiş / pazarlıkta / kapanmış eşleşmeleri.
- Kişi kartı (detay): "Kayıtları" listesinde pasif / arşiv durumu görünür; Kiraya veren / Satıcı rolünde "Sahip olduğu mülk tipleri" çipleri (eski "Uzmanlığı" alanı; veritabanında `kisi.uzmanlikAileleri`).
- Kod: `src/lib/domain/sahipler.ts` (`sahipOzetleri`, `sahipSuzgeciUyar`, `sahipOzetMetni`); tek geçiş, 7.000+ kişide de hızlı.
- Kullanım önerisi: eşleşme "Kapandı" ya da sahibi "kiraya verdi" ise portföyü Pasife al / Arşivle → sahip bu listede kalır; birkaç ay sonra "Tekrar aranacak sahipler" ile aranır.

## D. Üst düğmeler
- Kayıt detayı: **Pasife al · Arşivle** (pasifte **Tekrar aktifleştir**) üst satırda, Düzenle ve Portföy paylaş'ın yanında. Sayfa sonundaki tekrar kaldırıldı.
- Eşleşme detayı: **Eşleşmeyi kopar** ekranın ilk satırında (koparılmışsa durum ve "Geri al" aynı yerde). Pencerede ayrı **Açıklama** alanı; yazılan, eşleşme notuna eklenir.

## E. İlan numarası
- Alan zaten vardı (`kayit.portalIlanNo`, v3.7 — yalnızca içe aktarmada doluyordu). Şema değişmedi.
- Portföy formu: **İlan no** — numara ya da ilan bağlantısı yapıştırılır; alandan çıkınca numara ayrılır, bağlantı `portalUrl`'e yazılır (`src/lib/domain/ilan-no.ts › ilanNoAyikla`). Talepte yalnızca doluysa görünür.
- Detay: Fiyat'ın hemen yanında **İlan no** — dokununca ilan açılır (kayıtlı adres; yoksa `https://sahibinden.com/<no>`), yanında numarayı kopyala.
- Kartlar: portföy listesi kartında fiyat / m² altında, eşleşme kartında ve eşleşme detayındaki taraf kartlarında "İlan 1346793126" çipi.
- Talep / portföy aramasında ilan numarası da aranır.
- Örnek veri: P1 (Hacıaliler 4000 m² depo) ilan no 1346793126 (`ORNEK_VERI_SURUMU` 3.37-1 → demo örnek verisi yenilenir).

## F. Değişen dosyalar
`src/lib/eslestirme/onizleme.ts` · `src/lib/domain/sahipler.ts` (yeni) · `src/lib/domain/ilan-no.ts` (yeni) · `demo/kirli.ts` (yeni) · `demo/app.tsx` · `demo/form.tsx` · `demo/kisiler.tsx` · `demo/islemler.tsx` · `demo/randevular.tsx` · `demo/notlar.tsx` · `demo/kopar.tsx` · `demo/kartlar.tsx` · `demo/ortak.tsx` · `demo/filtre.tsx` · `demo/ornek-veri.ts` · `demo/sayfa.html` · `tests/v322.test.ts` · `tests/v336.test.ts` · `tests/v337.test.ts` (yeni) · `scripts/test-db.sh` · `src/lib/surum.ts`

## G. Açık kalanlar
- Pasife alma tarihi tutulmuyor (kayıtta `durum` değişim zamanı yok; audit geçmişinde var). "Ne zamandır pasif" sıralaması istenirse ayrı alan gerekir.
- Kaydedilmemiş değişiklik koruması Veri girişi › Anahtar AI kutusundaki yapıştırılmış metni kapsamaz (istenirse eklenir).
