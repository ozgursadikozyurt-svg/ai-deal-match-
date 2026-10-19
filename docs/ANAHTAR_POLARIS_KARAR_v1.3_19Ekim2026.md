# Anahtar CRM ↔ Polaris — Görev Paylaşımı Kararı (v1.3 · 19 Ekim 2026)

> v1.1: KPI / rapor kuralları ve proje sonu hatırlatma listesi eklendi.
> v1.2: 2. adım (kampanya tablosu) v3.34 ile yapıldı — bilerek basit: ad ile bağ, elle aylık harcama. Hazır WhatsApp mesajı Özgür'ün kararıyla kapsam dışı.
> v1.3: 3. adım sadeleşti (Özgür, 19 Ekim): yetki ayrı tablo değil, portföyün içinde gizlenebilir alanlar (belge no, taşınmaz ID, bitiş). Randevu ayrı kayıt. 4. adımın Anahtar tarafı v3.35 ile yapıldı: işlem tablosu + ekranı, Polaris'in 112 işlemi (2024–2026) taşındı. Sıradaki: Polaris'in Anahtar'dan okuması.

## Karar
- **İşlem ve komisyon zinciri Anahtar CRM'e taşınır.** Kaynak/kampanya → lead → mülk + yetki → eşleşme → randevu → işlem → komisyon (tahakkuk, fatura, tahsilat, ofis payı, bana kalan) → hizmet sözleşmeleri.
- **P&L, günlük rehber, haftalık değerlendirme, yol haritası Polaris'te kalır** (yalnız Özgür). Asistan Polaris'i görmez.
- **Geçmiş işlemler taşınır:** Polaris İşlemler 2026 + Arşiv (önceki yıllar) Anahtar'a aktarılır. (Onay: 18 Ekim 2026)
- **İşlem girişi bundan sonra yalnızca Anahtar'dan.** Polaris İşlemler sekmesi salt okunur olur, verisini Anahtar'dan okur (Kişiler eşitlemesiyle aynı yöntem: Supabase execute_sql, yalnızca okuma). (Onay: 18 Ekim 2026)

## Gerekçe
1. Polaris işlem satırı serbest metin; talep, portföy, yetki, kampanya bağı yok. Talep kaynağı ile portföy kaynağını ayrı ölçmek ancak işlem eşleşmenin olduğu yerde açılırsa mümkün.
2. Polaris tek kişilik artifact; PIN kilidi yalnızca tarayıcıda. Asistanın yetki matrisi (kaynak/komisyon/prim kayıtlarını değiştirememe) Anahtar'ın ofis/kullanıcı/rol altyapısında uygulanabilir.
3. İşlem/komisyon takibi Pro sürüm için satılabilir özellik; tablolar ofis bazlı kurulur.
4. P&L'de maaş, prim, Redstone payı, kira, vergi var: asistanın göreceği sistemde olmamalı.

## P&L bağlantısı
- Bugün: P&L satır 3 "HİZMET SATIŞLARI" = Polaris işlemlerinin **Bana Kalan** tutarlarının **işlem ayına** göre toplamı.
- Sonra: aynı satır Anahtar'daki komisyon kayıtlarından beslenir (bana kalan, ay bazında). Yeni kayıtlarda ay = **tahsilat tarihi**; tahakkuk eden ama tahsil edilmemiş tutar ayrıca "bekleyen" olarak gösterilir. Taşınan geçmiş kayıtlarda tahsilat tarihi = işlem tarihi alınır → geçmiş P&L rakamları değişmez.

## Alan eşlemesi (Polaris → Anahtar)
| Polaris | Anahtar |
|---|---|
| Tarih, Ay | işlem tarihi, tahsilat tarihi (geçmişte aynı) |
| Liste | işlem başlığı (+ varsa talep/portföy bağı, sonradan elle) |
| Fiyat | işlem bedeli |
| Paylaşımlı | paylaşılan tutar / paylaşım tarafı |
| Ofise | ofis payı |
| Bana Kalan | net komisyon (bana kalan) |
| Açıklama | not (olduğu gibi) |
| Reklamdan gelen işlem | talep kaynağı = REKLAM (kampanya bilinmiyorsa boş) |
| ref / taraf / pkisi | kişi bağları (Anahtar kişi kaydı) |

## Yayın sırası (iki uygulama aynı anda değişmez)
1. **Anahtar:** yeni tablolar + taşıma, canlıya (main → Cloudflare, ardından "Kurulumu tamamla"). Polaris bu sırada değişmeden çalışır.
2. **Doğrulama:** Anahtar'daki aylık "bana kalan" toplamları Polaris'teki satır 3 ile ay ay karşılaştırılır; fark sıfır olmalı.
3. **Polaris:** İşlemler sekmesi ve P&L satır 3 Anahtar'dan okur; düzenleme kapanır. Polaris'in kendi işlem kopyası silinmez, yedek olarak kalır.
- Taşıma gününden Polaris yayınına kadar Polaris'e yeni işlem girilmez.

## Anahtar'da uygulama sırası
1. ✅ v3.32 — Asistan rolü + değiştirilemez ilk kaynak (ilk kaynak, ayrıntı, tarih; değişiklik logu) + ilk yanıt süresi
2. ✅ v3.34 — Kampanya tablosu (kanal, bütçe, aylık harcama elle; kayıt kampanyaya ilk kaynak detayındaki ad ile bağlı, ad değişmez). Hazır WhatsApp mesajı: kapsam dışı
3. ✅ v3.35 — Yetki belgesi portföyün içinde (yetkili, belge no, taşınmaz ID, bitiş; açılıp kapanan bölüm) + ayrı randevu kaydı (tarih, tür, talep, portföy, kişi, yapan, sonuç). "Nitelikli" işareti henüz yok
4. ✅ v3.35 (Anahtar tarafı) — İşlem tablosu ve ekranı (bana kalan tahsilat ayına), Polaris işlemleri taşındı, aylık toplamlar karşılaştırıldı. ⏳ Polaris'in Anahtar'dan okuması (ayrı yayın). Fatura ve tahakkuk ayrımı yok: "tahsil edildi" işareti ve tarihi var
5. Hizmet sözleşmeleri (retainer, kira yönetimi) — retainer satıldığında
6. Raporlar: sabah KPI ekranı, 90 günlük ve 6–12 aylık kaynak raporları (aşağıdaki kurallarla)

## Raporlar ve KPI kuralları
- **Tahsil edilmiş net komisyon** = tahsil edilen komisyon − ofis payı − işleme ait giderler. Tahakkuk eden ama tahsil edilmeyen ayrı satır ("bekleyen").
- **Kaynak bazında kâr** = kaynakla ilişkilendirilen net komisyon − o kaynağın maliyetleri (kampanya harcaması; telefon/FSBO için asistan saat payı sonradan).
- **Çift sayım yasağı:** bir işlemde talep kaynağı ve portföy kaynağı ayrı ölçülür (performans), ama gelir toplamında komisyon tek kez sayılır (muhasebe). Kaynak raporu ile P&L ayrı ekranlardır.
- **Olgunlaşma (kohort) kuralı:** dönüşüm oranı, kaydın geldiği aya göre (kohort) hesaplanır. İşlem için tanınan süresi henüz dolmamış talep/portföy "başarısız" sayılmaz, "olgunlaşıyor" diye ayrı gösterilir. Varsayılan olgunlaşma süresi: kiralık 90 gün, satılık 180 gün (Ayarlar'dan değişir).
- **90 günlük rapor:** yeni kaynağın ilk kalitesi — geçerli lead, 15 dk içinde dönüş oranı, nitelikli lead, nitelikli randevu, lead / randevu başına maliyet, yetkili portföy edinme maliyeti.
- **6–12 aylık rapor:** portföylerin ve kaynakların gerçekten para üretip üretmediği — kohorttan kapanan işlem, tahsil edilmiş net komisyon, kaynak bazında kâr.
- **Sabah ekranı KPI'ları:** reklam talep maliyeti, yetkili portföy edinme maliyeti, nitelikli randevu maliyeti, talep → işlem, portföy → işlem, tahsil edilmiş net komisyon, kaynak bazında kâr.

## Proje sonunda hatırlatılacaklar (açık işler listesi)
Her sürümde güncellenir; kapananın yanına sürüm yazılır.
- [ ] Polaris: taşıma gününden Polaris yayınına kadar Polaris'e işlem girilmeyecek (Özgür'e o gün hatırlatılacak)
- [ ] Polaris: aylık "bana kalan" toplamları Anahtar ile ay ay karşılaştırılacak (fark 0)
- [ ] Polaris: İşlemler sekmesi + P&L satır 3 Anahtar'dan okuyacak, düzenleme kapanacak
- [ ] Polaris: "Sonuç gir" sayıları (sahip görüşmesi, portföy, gösterim) Anahtar etkinliklerinden otomatik gelecek
- [ ] Polaris notu: kişiler Anahtar'dan aktarılırken emlakçılara satıcı/kiraya veren rolü atanmayacak
- [ ] Arama ölçüleri ayrılacak: arama girişimi / gerçek görüşme / benzersiz kişi (fizibilitedeki 80–100, günlük 15–20 ve aylık 300 farklı ölçüler)
- [x] ~~WhatsApp hazır mesajı~~ — Özgür gerek görmedi (19 Ekim). [ ] Her reklam formuna kampanya adı/kodu konulması: v3.34 ekranı hatırlatıyor; Meta/Google form tarafında Özgür'ün yapması gerekiyor
- [ ] Kampanya harcaması ilk aşamada aylık elle girilecek (Meta / Google)
- [ ] Pas sistemi: ofis danışmanına yönlendirilen işin takibi (kime, ne zaman, ilk temas süresi, sonuç, paylaşım) — iş tanımı 2.13; tablolara eklenecek
- [ ] Asistan primi için kayıtlar (nitelikli randevu, tamamlanmış yetki, tahsilat katkısı) raporlanacak; asistan bu kayıtları değiştiremeyecek
- [ ] Asistanın günlük raporu Anahtar'dan otomatik üretilecek (iş tanımı §6)
- [ ] Kira yönetiminde KPI "ücret alınan aktif mülk-ay" olacak (5. adım)
- [ ] Geçmiş ticari kiralamalar için bitişten 90 gün önce yenileme görevi (yetki bitişi artık portföyde; görev üretimi yapılmadı)
- [ ] Randevu: "nitelikli randevu" işareti (asistan primi ve 90 günlük rapor için) — v3.35'te yok
- [ ] İşlem: kişi bağı (ref / taraf / pkisi) taşınmadı; Polaris'teki "tf" bilgisi yalnızca 1 satırda vardı, elle bağlanabilir
- [ ] KVKK: asistanın erişim kapsamı ve iletişim istemeyenler listesi ("aranmayacak")
- [ ] İş dışı (kod dışı) — asistan işe alınmadan: Seviye 4 mesleki yeterlilik ve görev kapsamı Antalya Ticaret İl Müdürlüğü ve mali müşavirle teyit
