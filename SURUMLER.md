# Anahtar CRM — Sürüm günlüğü

> v3.9 itibarıyla uygulamanın adı Anahtar CRM (önceki adlar: Anakey, Anahtar.ai).

> Bu dosya `src/lib/surum.ts`'ten otomatik üretilir (`npm run demo`). Elle düzenlemeyin.
> Dağıtılan dosyaların adı `ad_v<sürüm>_<gün><Ay><yıl>` biçimindedir (örn. `schema_v3.2_30Eylul2026.prisma`).

## v3.22 · 9 Ekim 2026 — Benim / Ofisim işareti ve süzgeci; "HARİÇ" bölge eşleştirmede; bütçesiz talebin puanı düzeltildi; portföy kartında küçük fotoğraf; skor süzgeci yatay şerit

- Benim / Ofisim: kendi talep ve portföyleriniz ★ Benim, ofis arkadaşlarınızınki ◆ Ofisim rozetiyle görünür. Tanıma kendiliğinden: gönderen telefonu ya da kayda bağlı kişinin telefonu sizin telefonunuzsa (portföy paylaşım imzasındaki telefon zaten sayılır), adınız ya da ofis / firma adı geçiyorsa. Ayarlar › en üstte "Benim ve ofisim": başka telefonlarınızı, ofis arkadaşlarınızın telefonlarını ve firma adını ekleyin — telefon yazın ya da kişi adını yazıp Kişiler'den seçin (ad + telefon birlikte gelir). Her kaydın sayfasında "Kimin?" seçicisiyle elle de işaretlenir (Benim · Ofisim · Başkası · Otomatik).
- Hızlı ulaşım: Ana Sayfa'da "★ Benim ve ofisim" kutusu (Talebim · Portföyüm · Ofisin talepleri · Ofisin portföyleri, sayılarıyla; dokununca liste o süzgeçle açılır). Talepler ve Portföyler'de tek satır çip: Tümü · ★ Benim · ◆ Ofisim · Diğer. Eşleşmeler'de "Kimin" seçicisi: Benim · Ofisim · Portföyüm (alıcı / kiracı arıyorum) · Talebim (mülk arıyorum).
- "HARİÇ" artık doğru anlaşılıyor: "Hurma, Sarısu HARİÇ" yazan talep Konyaaltı'nın geri kalanını arar, Hurma ve Sarısu'daki portföyler kesin elenir ("bölge esnek" denmiş olsa da). Eskiden hariç yerler konumdan çıkınca talep "il geneli"ne düşüyor, hatta metindeki yer adları yeniden okunup Hurma ARANAN bölge yapılıyordu (ekran görüntüsündeki 92 puanlı Hurma eşleşmesi). Talep başlığı "Konyaaltı (Hurma, Sarısu hariç) …" olur; hariç konum çipi üstü çizili görünür. "Kepez hariç", "… dışında", "… olmasın" da aynı kural. Formda her talep konumunda "hariç tut / dahil et" düğmesi var; "bölge listesini yapıştır" alanına "Hurma, Sarısu hariç" yazmak da çalışır.
- Bütçesiz talebin puanı: talepte bütçe (ya da portföyde fiyat) yokken bölge, oda ve m² tutunca puan 84–87'ye çıkıyordu — aynı talep bütçeyle 100 alıyordu, yani fiyatı hiç bilinmeyen eşleşme, bütçesi doğrulanmış çoğu eşleşmenin önüne geçiyordu. Artık fiyat karşılaştırılamayan eşleşmenin puanı 0,75 ile çarpılır: en iyisi 63–69'da kalır ("Skor ≥ 70" süzgecinin ve portföy edinme eşiği 80'in altında), Koşullu görünür, kartta "Eksik: talepte bütçe yok" yazar. Çarpan sırayı korur: m²'si de eksik olan daha aşağıda.
- Portföy kartında küçük fotoğraf: yüklü fotoğraf varsa kartın solunda tek küçük kapak görseli (birden çoksa köşesinde adet). Talepler / Portföyler listesinde, eşleşme kartının portföy tarafında ve eşleşme ayrıntısında. Kart ekrana girince yüklenir (uzun listede yüzlerce fotoğraf birden inmez).
- Skor süzgeci yeniden tasarlandı: sağ kenardaki dikey çekmece telefonda kartların ve süzgeç çiplerinin üstüne biniyordu. Artık seçici satırında dar bir "Skor" düğmesi var (İşlem · Fırsat · Kimin · Skor); dokununca aynı satırın üstünde sağa doğru yatay bir şerit açılır: kaydırıcı, geniş ekranda 50 · 60 · 70 · 80 · 90 hazır eşikleri, kalan eşleşme sayısı ve ✕. Listeyi örtmez, satır yüksekliği değişmez. Toplu işlemler (⋯) başlık satırına taşındı.
- Veritabanı: migration 20261009100000_v322_sahiplik_haric — yalnızca ekleme (kayit.isaret, kayit_lokasyon.haric); mevcut veriye dokunmaz. Yayından sonra "Kurulumu tamamla" düğmesi çıkar, bir kez basılır. Örnek veri yenilendi (yeni: T14 HARİÇ talebi, T15 bütçesiz talep, P14 benim portföyüm, P15 ofis portföyü).

**Demo'da test edilecekler**

- [ ] Ayarlar › "Benim ve ofisim": kaç kaydın sizin / ofisinizin olduğu yazar. Bir kişi adı yazıp önerilerden seçin; o kişinin kayıtları ◆ Ofisim olsun.
- [ ] Portföyler: üstteki "★ Benim" çipine basın — yalnızca sizinkiler (örnekte P14 Liman 3+1). "◆ Ofisim" sizinkiler + ofisinkiler (P15 Fener dükkan). Bir karta girip "Kimin?"den "Başkası" seçin, rozet kalksın; "Otomatik"e dönün.
- [ ] Ana Sayfa: "★ Benim ve ofisim" kutusundan Portföyüm'e dokunun, liste Benim süzgeciyle açılsın.
- [ ] Veri Girişi: "Hurma, Sarısu HARİÇ 3+1 satılık daire arıyorum 8 milyon" yapıştırın: başlık "Konyaaltı (Hurma, Sarısu hariç)", konumlarda Hurma ve Sarısu üstü çizili. Kaydedin; Hurma'daki portföy (P11) Uygun değil'e düşsün, Liman'daki (P14) gelsin. Örnek T14 talebinde de görebilirsiniz.
- [ ] Bütçesiz örnek T15 talebinin eşleşmeleri 70'in altında ve Koşullu olmalı; kartta "Eksik: talepte bütçe yok".
- [ ] Bir portföye fotoğraf ekleyin: Portföyler listesinde ve eşleşme kartında solda küçük kapak görünsün.
- [ ] Eşleşmeler (telefonda): "Skor" düğmesine dokunun, şerit satırın üstünde yatay açılsın, kartları örtmesin; kaydırın, sayı değişsin; ✕ ile kapatın. "Kimin" › Portföyüm deneyin.

## v3.21.2 · 8 Ekim 2026 — Eşleşmeler: kompakt süzgeçler ve yandan açılan skor çubuğu; filtre ve kaydırma konumu karta girip dönünce korunur; Konumlar, Bağlantılar, Yönetim Ayarlar içinde

- Eşleşmeler ekranında "tahmini komisyon ≈ …" toplam rakamı kaldırıldı (toplam tuhaf duruyordu). Komisyon her kartta rozetin yanında ve "Tahmini komisyon" sıralamasında duruyor.
- Filtre ve konum artık kaybolmuyor: bir eşleşme kartına (ya da talep / portföy / kişi kartına) girip "← Geri" deyince liste aynı süzgeçlerle, aynı sıralamayla ve ayrıldığınız kaydırma konumunda açılır — uzun listelerde kaldığınız yerden devam edersiniz. Eşleşmeler, Talepler, Portföyler, Kişiler ve İzleme ekranlarında geçerli. Süzgeçler "Temizle"ye ya da uygulamayı yenilemeye kadar durur; Talepler ve Portföyler birbirinin süzgecini görmez.
- Eşleşmeler ekranında süzgeçler çok daha az yer kaplıyor: İşlem (Tümü / Satılık / Kiralık / Devren) ve Fırsat önceliği (Öncelikli / Normal / Düşük) iki küçük açılır seçici olarak tek satırda; büyük "Fırsat önceliği" kartı ve ayrı işlem çip satırı kalktı. "Seç" ve "Listedekilerin tümünü kopar" ⋯ menüsüne alındı. Uygunluk çipleri (Uygun / Sunulabilir / Koşullu…) tek tıkla geçilsin diye tek satırlık ince çipler olarak yerinde duruyor.
- Skor süzgeci doğrudan ekranda: sağ kenarda ince bir "Skor" tutamağı durur; dokunun ya da sola kaydırın, dikey skor çubuğu açılır (parmakla yukarı-aşağı, 5'er puan; Sıfırla düğmesi; altında kaç eşleşme kaldığı). Dışına dokunarak ya da sağa kaydırarak gizlenir. Süzgeç açıkken tutamak renkli olur ve "Skor ≥ 70" yazar. Seçili skor, fırsat ve takip süzgeçleri aktif çip satırında da görünür; "Temizle" hepsini sıfırlar.
- Konumlar, Bağlantılar ve Yönetim ana menüden kalktı; Ayarlar'ın en üstündeki "Yönetim ve bağlantılar" bölümünde. Ayarlar menüde vurgulu kalır; eşitleme çakışması rozeti Ayarlar'da görünür. Google izin ekranından dönüş, Ana Sayfa daveti gibi mevcut yönlendirmeler aynen çalışır.
- Veritabanı ve sunucu değişikliği yok; yalnızca arayüz. "Kurulumu tamamla" gerekmez.

**Demo'da test edilecekler**

- [ ] Eşleşmeler: üstte "tahmini komisyon ≈ …" toplamı olmamalı; kartlardaki komisyon rozeti durmalı.
- [ ] Eşleşmeler: Filtrele'den Satılık seçin, "Sunulabilir"e basın, skor çubuğuyla ≥ 70 yapın, listede aşağı inip bir kartı açın, "← Geri": aynı süzgeçler ve aynı satırda olmalısınız.
- [ ] Eşleşmeler: sağ kenardaki "Skor" tutamağına dokunun (ya da sola kaydırın): çubuk açılır; parmağınızı yukarı-aşağı sürükleyin, kart sayısı değişsin; dışına dokunun, kapansın.
- [ ] Eşleşmeler: "İşlem" ve "Fırsat önceliği" seçicilerini deneyin; ⋯ menüsünden "Seç" ve toplu kopar çalışsın.
- [ ] Talepler / Portföyler / Kişiler / İzleme: süzgeç ya da arama yapıp bir karta girin, "← Geri": süzgeç ve konum korunmalı.
- [ ] Menü: Konumlar, Bağlantılar, Yönetim ana menüde yok; Ayarlar › en üstte "Yönetim ve bağlantılar" bölümünden açılıyor ve "← Geri" Ayarlar'a döndürüyor.

## v3.21.1 · 8 Ekim 2026 — Büyük Google rehberleri (binlerce kişi) için ilk içe aktarma düzeltmesi; Google yayını için gizlilik ve koşullar sayfaları

- Binlerce kişilik rehberde ilk eşitleme "Sunucu 503 / Connection terminated unexpectedly" ile duruyordu: tek istekte çok iş yapılıyordu. Artık rehber 100'erli sayfalarla, her istekte en çok 2 sayfa olmak üzere kısa turlarda alınır; ilerleme her sayfadan sonra saklanır.
- Bir tur geçici olarak hata verirse (503, kopan bağlantı) eşitleme durmaz; birkaç saniye sonra kaldığı yerden 3 kez yeniden dener.
- Herkese açık /gizlilik.html ve /kosullar.html sayfaları eklendi (Google'da uygulamayı yayınlamak ve doğrulama başvurusu için gerekli).

## v3.21 · 8 Ekim 2026 — Google ile bağlan: çift yönlü Google Kişiler eşitlemesi (canlıda çalışır), Notion bağlantısı gizlendi

- "Google ile bağlan" tek düğme: Bağlantılar ya da Kişiler ekranında düğmeye basın, Google'ın kendi izin ekranında hesabınızı seçip "İzin ver" deyin. Uygulamaya dönünce rehberiniz kendiliğinden içe aktarılır (ilerleme ekranda görünür). Anahtar kopyalama, ayar girme yok. Bu özellik canlıda ilk kez çalışıyor (önceki sürümlerde yalnızca demoda benzetimdi).
- Çift yönlü eşitleme — kurallar: Google'a (telefonunuza) kaydettiğiniz kişi Anahtar CRM'e düşer · Anahtar CRM'de elle eklediğiniz kişi Google rehberinize eklenir · bir tarafta ad, telefon, e-posta ya da şirketi düzeltirseniz diğer tarafta da düzelir · iki tarafta aynı alan farklı değiştiyse "çakışma" olarak size sorulur.
- Anahtar CRM'den silinen kişi Google'dan SİLİNMEZ. Kişi Google rehberinizde durur; bir sonraki eşitlemede Anahtar'a geri de gelmez. Fikir değiştirirseniz Bağlantılar › "Silinenleri yeniden getir". Uygulamada Google'dan kişi silen hiçbir kod yoktur (otomatik testle denetleniyor).
- Google'dan silinen kişi de Anahtar CRM'de kalır (talep / portföy bağı kopmasın); yalnızca Google bağı kopar, kartına not düşülür.
- Rehberiniz kirlenmez: Excel / CSV / WhatsApp ile TOPLU içe aktardığınız kişiler kendiliğinden Google'a gitmez. İstediklerinizi Kişiler › Seç › "Google'a gönder" ile ya da kişi kartındaki "Google'a gönder" düğmesiyle gönderirsiniz. Anahtar'daki notlar Google'a yazılmaz; Anahtar'da boşalttığınız bir alan Google'da silinmez; Google'daki kişinin diğer telefonları ve unvanı korunur.
- Bağlandığınız anda iki tarafta zaten farklı olan bilgiler toplu hâlde Google'a yazılmaz; yalnızca bağlandıktan SONRA Anahtar'da yaptığınız düzeltmeler gider. Gönderilmeyi bekleyen kişilerde "Google'a gönderilecek" rozeti görünür.
- Otomatik eşitleme: sunucu 15 dakikada bir, uygulama açıkken 5 dakikada bir eşitler; Kişiler ekranındaki "Google ile eşitle" beklemeden çalıştırır. Büyük rehberler 200'er kişilik sayfalarla, kaldığı yerden sürerek içe aktarılır (7.000 kişilik rehberde de zaman aşımı olmaz).
- Çok ofisli: her ofis kendi Google hesabını bağlar, ofisler birbirinin rehberini görmez. Bağlantıyı ofis yöneticisi kurar; içe aktarılan kişilerin sahibi bağlantıyı kuran kullanıcıdır.
- Güvenlik: Google şifreniz uygulamaya verilmez; kalıcı erişim anahtarı veritabanında şifreli durur; izin ekranından dönüş ofise imzalıdır (başka ofis adına bağlanılamaz). "Bağlantıyı kaldır" Google hesabınızdaki izni de geri alır; kişileriniz iki tarafta da kalır.
- Notion bağlantısı gizlendi: Bağlantılar ekranındaki Notion kartı, ana sayfadaki Notion daveti, durum göstergesindeki Notion ve otomatik Notion eşitlemesi kapalı. Kod ve veriler yerinde; tek satırla geri açılır (src/lib/ozellikler.ts).
- Platform kurulumu (yalnızca siz, bir kez): Google Cloud'da OAuth istemcisi açıp Cloudflare'e GOOGLE_CLIENT_ID ve GOOGLE_CLIENT_SECRET girilir — adım adım: docs/GOOGLE_BAGLANTI_KURULUMU_v3.21_8Ekim2026.md. Bu yapılana kadar canlıda düğme "henüz açılmamış" der; uygulamanın geri kalanı etkilenmez.
- Veritabanı: migration 20261008100000_v321_google_cift_yonlu — yalnızca ekleme (kisi.googleBekliyor sütunu, senkron_haric tablosu); mevcut veriye dokunmaz. Yayından sonra "Kurulumu tamamla" düğmesi çıkar, bir kez basılır.

**Demo'da test edilecekler**

- [ ] Menü › Bağlantılar: Notion kartı ve ana sayfada Notion daveti görünmemeli. "Google ile bağlan" → "İzin ver ve içe aktar": örnek rehber Kişiler'e geldi mi?
- [ ] Kişiler › + Yeni kişi (telefonlu) ekleyin: kartında "Google'a gönderilecek" rozeti çıkmalı. Bağlantılar › "Şimdi eşitle": alttaki "Google rehberi (benzetim)" kutusunda "Google'a eklendi" satırı görünmeli.
- [ ] Google'dan gelen bir kişinin adını ya da telefonunu düzeltin → "Şimdi eşitle": "Google'da güncellendi" satırı çıkmalı.
- [ ] Kişiler › Seç › Google rozetli bir kişiyi silin: uyarıda "Google rehberinizden silinmez" yazmalı. Bağlantılar'da "1 kişi Anahtar'dan silindi: Google rehberinizde duruyor" görünmeli; "Şimdi eşitle" deyince kişi geri GELMEMELİ. Sonra "Silinenleri yeniden getir" ile geri alın.
- [ ] "📱 Telefonda Google'a kişi kaydet (benzetim)" → "Şimdi eşitle": yeni kişi Kişiler'de göründü mü?
- [ ] "Çift yönlü" kutusunun işaretini kaldırın, yeni bir kişi ekleyip eşitleyin: Google'a hiçbir şey gitmemeli.

## v3.20 · 8 Ekim 2026 — Çok ofisli altyapı: ofisler, kullanıcılar, roller, davetle katılma ve Yönetim ekranı

- Uygulama artık birden çok emlak ofisini barındırabilir. Her talep, portföy, kişi, eşleşme, ayar ve fotoğraf bir ofise aittir; bir ofis başka ofisin verisini hiçbir ekrandan göremez, değiştiremez, silemez (sunucuda zorunlu, otomatik testlerle kanıtlı).
- Mevcut veriniz kaybolmaz: göçte "Özyurtlar Gayrimenkul" ofisi açılır, bugüne kadarki tüm kayıtlar ona bağlanır; siz platform yöneticisi olursunuz ve ofisiniz sınırsızdır.
- Üç rol: Platform yöneticisi (tüm ofisler, plan, deneme, askıya alma) · Ofis yöneticisi (kendi ofisinin kullanıcıları, ayarları, tüm kayıtları) · Danışman (kendi kayıtları + ofisin ortak portföyü). Yetkiler tek dosyada: src/lib/guvenlik/yetki.ts.
- Görünürlük: portföyler varsayılan olarak ofis ortak havuzunda; talepler ve kişiler kaydı girene özel, ofis yöneticisi hepsini görür.
- Giriş izni artık veritabanında: IZINLI_EPOSTALAR yalnızca acil durum anahtarı olarak kalır. Hesabı olmayan e-posta "Davet isteyin" mesajı görür.
- Davetle katılma: Yönetim ekranında üretilen bağlantı (14 gün geçerli, tek kullanımlık, isteğe bağlı e-postaya kilitli) açılınca kişi e-postasını doğrular ve doğrudan o ofise girer.
- Yönetim ekranı (menü › Yönetim): kullanıcılar (rol değiştir, kapat/aç), davet bağlantısı üret / iptal et, WhatsApp'ta gönder; platform yöneticisi için Ofisler: yeni ofis, 30 gün Pro deneme, Pro / Ücretsiz, askıya al.
- Üç plan tanımlandı — Ücretsiz: fotoğraf kapalı, 1 kullanıcı, günde 25 yapay zekâ yorumu, senkron ve föy kapalı · Pro: portföy başına 8 fotoğraf, 25 kullanıcı, günde 500 yorum, senkron ve föy · Pro+: Pro'nun hepsi + ofisler arası ortak havuz hakkı (portföy / talebi ortak havuza koyup başka ofislerinkilerle eşleşme; özelliğin kendisi sonraki sürümde). Platform yöneticisi her ofisin planını Yönetim ekranından seçer. Sınırların uygulamada zorlanması v3.22'de.
- Kurulum düzeltmesi: yeni sürüm yayınlandığında veritabanı henüz güncellenmemişken de "Kurulumu tamamla" çalışır (yalnızca IZINLI_EPOSTALAR listesindeki yönetici için).
- Ayarlar (geçerlilik süreleri, yapay zekâ, imza, roller) ofis başına ayrı; aynı telefon ya da ilan iki ayrı ofiste tutulabilir.
- Veritabanı: migration 20261007100000_v320_cok_ofis (ofis, kullanici, davet tabloları; ofisId sütunları; ofis içi benzersizlik). Canlıya almadan önce Supabase'de "Allow new users to sign up" açık olmalı (davetli yeni kişiler için); asıl kapı uygulamanın kullanıcı tablosudur.

**Demo'da test edilecekler**

- [ ] Menü › Yönetim: "Rol olarak görüntüle" ile Platform yöneticisi, Ofis yöneticisi ve Danışman görünümlerini karşılaştırın; danışman yönetim bölümlerini görmemeli.
- [ ] Ofisler › yeni ofis açın (ör. "Lara Emlak"), "30 gün Pro deneme" verin, sonra "Askıya al" deyin.
- [ ] Davet bağlantısı üretin: bağlantı ve "WhatsApp'ta gönder" düğmesi çıkmalı; Davetler listesinde görünmeli, İptal ile kapanmalı.
- [ ] Kullanıcılar listesinde asistanın rolünü Ofis yöneticisi yapın, sonra hesabını Kapat deyin.

## v3.19 · 7 Ekim 2026 — Eşleşme puanı eksik veriyi cezalandırıyor, fırsat önceliği (sahibinden ↔ müşteri), anahtar / İzleme, toplu kopar, çoklu oda, Veri Girişi'nde yapay zekâ

- Puanlama düzeltildi: m², oda sayısı ya da fiyat/bütçe karşılaştırılamıyorsa o bileşen artık "yok sayılıp" ağırlığı diğerlerine dağıtılmıyor; kararsız (0,4) puan alıyor. Eskiden yalnızca konum + tip eşleşince 86–91 puan "Sunulabilir" çıkıyordu. Fiyat karşılaştırılamıyorsa ya da iki çekirdek bilgi eksikse en fazla "Koşullu". Kartta "Eksik: …" olarak görünür; oda uyarısı yalnızca konutta çıkar.
- Fırsat önceliği: mülk sahibi / sahibinden portföy ↔ doğrudan müşteri talebi "Öncelikli"; bir taraf emlakçı "Normal"; emlakçı ↔ emlakçı "Düşük" (ikinci plan). Her kartta rozet + tahmini komisyon, Eşleşmeler ekranında fırsat kartı, kademe filtresi ve varsayılan sıralama (uygunluk → fırsat → skor). Komisyon varsayımı: satılıkta her taraftan %2, kiralıkta 1 aylık kira; emlakçı payı yarıya sayılır.
- Eşleşme kartı sadeleşti: Satılık/Kiralık ve mülk tipi bir kez, "4· Web ilanı" gibi numaralı katman etiketi kaldırıldı (kimin ilanı olduğu zaten rolde yazıyor).
- Anahtar (favori) ve İzleme ekranı: talep, portföy ve eşleşme kartlarında anahtar simgesi; işaretlenenler yeni İzleme ekranında toplanır. Veritabanı değişikliği gerekmez (arayüz ayarında saklanır).
- Toplu kopar: Eşleşmeler ekranında "Listedekilerin tümünü kopar", "Seç" modu ile seçilenleri kopar, Koparılan görünümünde "Tümünü geri al". Tek nedenle, tek kayıtta yazılır.
- Ara kat: portföy "ara kat" yazmasa da bulunduğu kat ve bina kat sayısından hesaplanır (1 ≤ kat < kat sayısı); karşılıyorsa kartta "4/9 · ara kat" görünür, karşılamıyorsa puan düşer.
- Taleplerde oda sayısı çoklu seçim ("2+1, 3+1"): form, filtre, puanlama (en iyi seçenek) ve metinden okuma ("2+1 veya 3+1"). Şema değişmedi.
- Mükerrer kontrolü sağlamlaştı: fiyat ±%3, m² ±%5 bandında aynı sayılır (eskiden bin TL yuvarlaması), aynı telefon farklı yazılmış adla da yakalanır, "Zaten var" nedeni okunur (tekrarNedeni).
- Veri Girişi: dosya yüklenince en üstte tek "✦ Yapay zekâ ile yorumla" düğmesi. Tablolarda eksik satırları hücrelerinden tamamlayıp listeyi günceller, kişi listesi / vCard'da rol önerir. Satır düğmesindeki "yorumlanacak metin yok" hatası giderildi (satırın hücreleri başlıklarıyla okunuyor). Yapay zekâ kapalıysa bedava kurallar çalışır.
- Kişiler: onay kutuları yalnızca "Seç" modunda; üstte tek ince araç satırı; ad ve telefona tam genişlik.

**Demo'da test edilecekler**

- [ ] Eşleşmeler → Fırsat önceliği kartından "Öncelikli"yi seçin; sahibinden portföy + müşteri talebi eşleşmeleri öne gelir.
- [ ] Bir kartta anahtar simgesine basın → İzleme ekranında görünür.
- [ ] Eşleşmeler → Seç → birkaç kart → Seçilenleri kopar; Koparılan görünümünden geri alın.
- [ ] Veri Girişi → Dosya yükle → örnek dosya → en üstteki "Yapay zekâ ile yorumla".

## v3.18 · 6 Ekim 2026 — Jargon sözlüğü genişledi, portal bağlantısından okuma, .md sohbet dosyası, dosya ekranında satır işlemleri

- Jargon sözlüğüne 20 yeni kural: eşyalı / eşyasız, güvenlikli site, jeneratör, balkon, teras, doğalgaz-kombi / yerden ısıtma / merkezi, bahçeli, imarlı, tarla vasıflı, cephe yönü (güney / kuzey / doğu / batı) ve nota düşenler (sorunsuz, hisseli, yatırımlık-getiri, teslim-inşaat aşaması, toplu taşımaya yakın, okula yakın, manzaralı).
- Portal bağlantısından okuma: grupta çoğu ilan yalnızca bağlantı olarak paylaşılıyor. Sahibinden / Emlakjet / Hepsiemlak adresindeki mülk tipi, satılık-kiralık ve oda sayısı artık okunuyor.
- WhatsApp gürültü temizliği: "güvenlik kodu değişti", [Görsel], [Video], [Sesli mesaj], silinen mesaj ve alıntı satırları ayrıştırmadan önce metinden çıkarılıyor.
- Ölçüm (gerçek grup dökümü, 1.376 emlak mesajı): yapay zekâsız tam çözülen mesaj oranı %51'den %60'a çıktı.
- WhatsApp sohbet dosyası artık .md biçiminde de yüklenebilir (tarih başlıklı Markdown dışa aktarımı); .txt, .md ve .zip birlikte kabul ediliyor.
- Dosya içe aktarma: satır başına Düzenle · Ekle · Atla düğmeleri ve "Yapay zekâya yorumlat" (tablo sütunlarından çıkmayan bilgiyi serbest metinden tamamlar; sonuç doğrudan kaydedilmez, forma taşınır).
- Dosya içe aktarmada Satılık + kiralık / Satılık / Kiralık / Devren hızlı filtresi; atlanan satırlar listeden düşer, tek tuşla geri getirilir.
- Cloudflare: wrangler.jsonc içine keep_vars eklendi — panelden elle girilen değişkenler artık her yayında silinmiyor.

**Demo'da test edilecekler**

- [ ] Yalnızca bir sahibinden bağlantısı yapıştırın: mülk tipi, satılık / kiralık ve oda sayısı kendiliğinden dolmalı.
- [ ] WhatsApp'tan .md olarak aldığınız bir dışa aktarımı Veri girişi › Dosya yükle ile açın: mesajlar ve tarihler doğru okunmalı.
- [ ] Excel / CSV ilan listesi yükleyin: üstte Satılık / Kiralık filtresini, satırlarda Düzenle · Ekle · Atla ve ✦ Yapay zekâya yorumlat düğmelerini deneyin.
- [ ] "Eşyalı, güvenlikli site, doğalgaz kombi, güney cepheli" içeren bir ilan yapıştırın: bu alanların işaretlendiğini görün.

## v3.17 · 6 Ekim 2026 — Emlak jargon sözlüğü, eksik veri cezası, Google Contacts CSV içe aktarma (paketli)

- Emlak jargon sözlüğü (docs/emlak_jargon.md + src/lib/ai/jargon.ts): kurallar yapay zekâdan önce çalışır, böylece yapay zekâ çağrısı ve kota harcaması azalır.
- Fiyat okuma: '17 MTL' = 17.000.000 · satılıkta '15.5 TL' = 15.500.000 · '13500 000' = 13.500.000 · kirada '25 bin' = 25.000. Telefon numaraları fiyat sanılmaz.
- Kat jargonu: '8/9' (9 katlının 8'i), '12/6', '3. kat', '5 katlı', 'katta' / 'arakat' (ara kat), 'yüksek giriş' / 'zemin' (giriş katı), 'son kat', 'bodrum'. Talepte çoklu kat alanına, portföyde bulunduğu kat alanına yazılır.
- Teknik jargon: SIFIR = bina yaşı 0, '15 yıllık' = 15, '0.70 emsal', krediye uygun, takaslı, iskanlı, ebeveyn banyolu, kapalı otopark, havuzlu, asansörlü, site içinde, deniz manzaralı, dubleks, tek tapu tek imza.
- Alan karşılığı olmayan jargon (yabancıya satışa uygun, Eminevim, kapalı portföy, paylaşıma açık, kentsel dönüşüm, GES'e uygun, marjinal rapor, amerikan mutfak…) kaydın notuna yazılır — bilgi kaybolmaz.
- Eşleştirme: eksik veri cezası. Yalnızca ilçe ve fiyata bakılarak yüksek skor çıkmaz; kartta 'Genel özellikler eksik, tamamlayın' uyarısı ve hangi alanların eksik olduğu görünür.
- Google Contacts / Outlook CSV'si artık kişi listesi olarak tanınır: ad, telefon, ikinci telefon, e-posta, şirket, unvan, not ve etiketten rol ayrıştırılır (önceden yalnızca ad ve telefon alınıyordu).
- Büyük kişi dosyaları 500'erli paketler halinde yazılır (7.000 kişilik dosyada sunucu zaman aşımına düşüyordu); ilerleme ekranda görünür. Eksik ya da hatalı numaralar satır numarasıyla uyarı listesinde toplanır, kişi yine de eklenir.
- Aynı numaradaki kişi ikinci kez açılmaz: var olan kişinin boş alanları (e-posta, şirket, not) doldurulur, rolleri birleştirilir.
- Kişiler listesinde hızlı düzenlemeye 'Açıklama / notlar' alanı eklendi.

**Demo'da test edilecekler**

- [ ] Yapıştır kutusuna 'Lara 8/9 katta 2+1 SIFIR bina full krediye uygun takaslı 15.5 TL' yazın: kat 8/9, bina yaşı 0, krediye uygun ve takas işaretli, fiyat 15.500.000 çıkmalı.
- [ ] 'Vatandaşlığa uygun kapalı portföy' içeren bir ilan yapıştırın: bu ifadeler kaydın notuna düşmeli.
- [ ] Google Contacts'tan dışa aktardığınız CSV'yi Veri girişi › Dosya yükle ile açın: e-posta, şirket, not ve etiketlerin göründüğünü, büyük dosyada paket ilerlemesinin aktığını kontrol edin.
- [ ] Yalnızca ilçe ve fiyatı olan bir talep–portföy çiftine bakın: eşleşme kartında 'Genel özellikler eksik, tamamlayın' uyarısı çıkmalı ve skor %90'a ulaşmamalı.

## v3.16 · 6 Ekim 2026 — Her ekranda Geri, kişi rolüne göre filtre, derli toplu Kişiler filtresi, kaynak ve geri sayım düzeltmeleri

- Her ekranda '← Geri': bir önceki ekrana döner (hangi yoldan geldiyseniz oraya). Ekranlara özel geri düğmeleri kaldırıldı.
- Kişiler: dağınık filtre çipleri tek bir 'Filtrele' menüsünde toplandı (Rol · Kaynak · Kayıt ve telefon); seçilenler arama satırının altında çip olarak görünür, tek tuşla temizlenir.
- Kişi rolüne göre filtre artık Talepler, Portföyler ve Eşleşmeler ekranlarında da var (kayda bağlı kişinin rolü: Alıcı, Yatırımcı, Emlakçı…).
- Eşleşmeler: ana ekranda Tümü / Satılık / Kiralık / Devren hızlı filtresi. 'Filtre neye uygulansın' seçimi kaldırıldı — filtre artık talep ve portföy tarafına birlikte uygulanır. Detaylı filtredeki 'Kişi' bölümü kaldırıldı (rol filtresi yeterli).
- Ayarlar › Kişi rolleri kompaktlaştı: kapalı açılır bölüm, kaydırılabilir rol listesi.
- Kaynak otomasyonu: WhatsApp ve benzeri kaynaklardan gelen portföylerde artık 'Kendi portföyüm' otomatik seçilmez. Emlakçı grubundan gelen kayıt 'İlan sahibi: Emlakçı' + 'Partner portföyü' olur, kişi de 'Emlakçı' rolüyle açılır; sahibinden olduğu yazılıysa dokunulmaz. 'Kendi portföyüm' yalnızca elle girişte ya da malik olduğu belliyse seçilir.
- Geri sayım (TTL): içe aktarılan portföylerde süre ilanın yayın tarihinden değil, kaydın sisteme girdiği günden başlar. Eski ilan uyarısı durur.
- İçe aktarma gözden geçirme: Hazır adaylar zaten üstte; yanına Satılık / Kiralık hızlı filtresi eklendi (talep/portföy ve durum filtreleriyle birlikte).
- Talepler ve Portföyler ekranında 'Listeyi paylaş': seçtiğiniz (ya da tüm) kayıtlar hazır metne dönüşür, kopyalanır veya WhatsApp'a verilir. Kişi adı ve telefonu isteğe bağlı, varsayılan olarak çıkmaz.
- Formda 'Teknik özellikler' bölümü Lokasyon'un hemen altına alındı. Kayıt detayında 'Portallarda ara' bölümü katlanır ve kapalı başlar.
- Cloudflare: wrangler.jsonc içine keep_vars eklendi — panelden elle girilen değişkenler (DATABASE_URL, SUPABASE_*, IZINLI_EPOSTALAR, AI_API_KEY) artık her yayında silinmiyor.
- Belgeler: README'ye 'Veritabanı değişiklikleri nasıl uygulanır?' bölümü eklendi (şema → migration → Supabase akışı, otomatik olan ve olmayan adımlar).

**Demo'da test edilecekler**

- [ ] Herhangi bir kayda girip '← Geri' deyin: geldiğiniz listeye dönmeli. Kişi → kayıt → eşleşme gibi uzun bir yolda da adım adım geri gitmeli.
- [ ] Kişiler › Filtrele: rol, kaynak, kayıt ve telefon filtrelerinin tek menüde olduğunu görün; seçince üstte çip çıkmalı.
- [ ] Eşleşmeler: Satılık / Kiralık düğmeleriyle süzün; Filtrele › Kişi rolü ile 'Yatırımcı' seçip sonucu görün.
- [ ] WhatsApp sohbet dosyası aktarın: gelen portföyde 'İlan sahibi: Emlakçı' ve 'Partner portföyü' görünmeli, 'Kendi portföyüm' olmamalı.
- [ ] Excel/CSV ile eski tarihli bir ilan aktarın: geri sayım bugünden başlamalı (ilan tarihinden değil).
- [ ] Talepler › 'Listeyi paylaş': metni kopyalayın; kişi bilgisi kutusunu işaretleyince ad ve telefon eklenmeli.

## v3.15 · 5 Ekim 2026 — Çoklu kat, takasa açık, dinamik kişi rolleri, Kişiler'de toplu işlemler; 3 arayüz hatası düzeltildi

- Düzeltme: sağ üstteki 'Kaydedildi ✓' göstergesi artık ekranda takılı kalmaz; kayıttan sonra 3 saniye görünüp kaybolur (açılışta hiç görünmez). 'Kaydediliyor…' ve hata mesajları çözülene kadar kalır.
- Düzeltme: Veri girişi / içe aktarma ekranından bir kaydı (Excel-CSV satırı ya da yapay zekâ kutusu sonucu) forma açıp 'Vazgeç' ya da 'Kaydet' deyince genel listeye değil, geldiğiniz ekrana dönülür; yüklü dosya, ayrıştırılmış satırlar ve seçimler yerinde kalır (menüden girişte sıfırlanır).
- Düzeltme: Eşleşme kartlarında mülk tipinin yanında işlem tipi rozeti (Satılık / Kiralık / Devren) gösterilir.
- Çoklu kat: talepte istenen kat tek seçim yerine çoklu seçim (Bodrum, Giriş/Zemin, 1–10. kat, Ara kat, Son kat). Eşleştirme: seçeneklerden biri portföyün katına uyuyorsa karşılanır; ara/son kat binanın kat sayısına göre hesaplanır. Eski tek değerli talep katı da okunur. Liste filtresinde de çoklu kat var.
- Takasa açık: portföy ve talep formlarında Evet / Hayır; detayda gösterilir; liste filtresinde 'Takas'; eşleştirmede iki taraf da takasa açıksa puana +3 bonus (uygunluk kararını değiştirmez).
- Kişi rolleri: 11 rolün tamamı (Alıcı … İş ortağı) tüm filtre ve seçicilerde. Ayarlar › Kişi rolleri: koda dokunmadan yeni rol ekle, yeniden adlandır, kullanılmayan özel rolü kaldır.
- Kişiler: her kişinin yanında onay kutusu + onaylı 'Toplu sil'; listeden hızlı düzenleme (ad, telefon, şirket, e-posta, roller); arama e-posta, referans ve rol adını da tarar; yeni filtreler: rolü yok, talebi / portföyü / kaydı olmayanlar, telefonu olan / olmayan.
- Veritabanı: migration 20261005090000_v315_kat_takas_roller — mulk_ozellik.istenenKatlar (metin dizisi; eski talep katları taşınır), kayit.takasaAcik, kisi.roller enum dizisinden metin dizisine (mevcut roller aynen korunur). Özel rol tanımları Ayar tablosunda 'roller' anahtarıyla durur.

**Demo'da test edilecekler**

- [ ] Canlıda bir portföy kaydedin: sağ üstte 'Kaydedildi ✓' çıkıp ~3 saniye sonra kaybolmalı; sayfayı yenileyince açılışta görünmemeli.
- [ ] Veri girişi › Dosya yükle: bir Excel/CSV yükleyin, 'Formda düzelt ve kaydet' › 'Vazgeç': aynı ekranda yüklü satırlar durmalı. Aynısını Yapıştır sekmesinde 'Düzenle' ile deneyin.
- [ ] Bir talepte Giriş + 3. kat + Ara kat seçip kaydedin; 3. katta bir portföyle eşleşmede 'Kat' satırı ✓ olmalı.
- [ ] Aynı talebi ve bir portföyü 'Takasa açık: Evet' yapın: eşleşme detayında 'Takasa açık' satırı ve +3 puan görünmeli. Listede Filtre › Takas çalışmalı.
- [ ] Ayarlar › Kişi rolleri: 'Banka personeli' ekleyin; Kişiler filtresinde ve kişi formunda görünmeli.
- [ ] Kişiler: iki kişiyi onaylayıp 'Toplu sil': sayıları gösteren onay çıkmalı; ✎ Düzenle ile ad / rol değiştirin.

## v3.14 · 3 Ekim 2026 — CANLI SÜRÜM: Cloudflare + Supabase üzerinde çalışır; giriş, sunucuda kayıt, fotoğraf ve yapay zekâ canlı; uygulama adı anahtarcrm

- Canlı uygulama: aynı ekranlar, veri artık Supabase'de (Frankfurt). Açılışta e-posta ile giriş (şifresiz, tek kullanımlık bağlantı); yalnızca izin listesindeki e-postalar girebilir.
- Her değişiklik kısa bir bekleyişten sonra kendiliğinden sunucuya yazılır; sağ üstte 'Kaydedildi ✓' göstergesi. Bağlantı koparsa değişiklikler bellekte durur, yeniden denenir; sekme kapatılırken kaydedilmemiş iş varsa uyarılır.
- Fotoğraflar Supabase Storage'daki özel kovada (1 saat geçerli imzalı bağlantı); yapay zekâ çağrıları sunucu üzerinden (anahtar tarayıcıya inmez), sağlayıcı Ayarlar › Yapay zekâ'dan seçilir.
- Ayarlar › Hesap ve veri: çıkış, yapay zekâ anahtarı durumu, demodan alınan 'Tam yedek (JSON)' dosyasını canlıya yükleme (tekrar yüklemek zarar vermez).
- Canlıda demo parçaları gizli: örnek veri / sıfırla / Notion-Google benzetimi. 'Bugün' artık gerçek tarih (demoda sabit 30 Eylül 2026'ydı).
- Güvenlik: tüm tablolarda satır düzeyi güvenlik (RLS) açık; veritabanına herkese açık anahtarla erişilemez. Haftalık otomatik yedek Supabase Storage'daki özel 'yedekler' kovasına gider (son 12).
- Veritabanı: yeni migration 20261003100000_v314_rls_tum_tablolar (yalnızca RLS). Uygulama adı: anahtarcrm (Cloudflare Worker, paket, migration kayıt tablosu).

**Demo'da test edilecekler**

- [ ] Canlı adresi açın: giriş ekranı gelmeli; e-postanıza gelen bağlantıya dokununca uygulama açılmalı.
- [ ] Yeni portföy ekleyin, sağ üstte 'Kaydedildi ✓' görünmesini bekleyin, sayfayı yenileyin: kayıt durmalı.
- [ ] Ayarlar › Hesap ve veri: demodan indirdiğiniz yedeği yükleyin; talep ve portföy sayıları gelmeli.
- [ ] Bir portföye fotoğraf ekleyin, sayfayı yenileyin: fotoğraf durmalı; 'Portföy paylaş' föyünde görünmeli.
- [ ] Ayarlar › Yapay zekâ › 'Bağlantıyı dene': 'Yanıt geldi' çıkmalı (Cloudflare'de AI_API_KEY tanımlıysa).

## v3.13 · 3 Ekim 2026 — Portföy paylaş düğmesi en üstte; konum bölümü yukarıda; telefonda arama kutusu tam genişlik

- Portföy sayfası: 'Portföy paylaş' ve 'Düzenle' düğmeleri en üst satıra, '← Portföyler'in sağına alındı (üst sağ boştu). Paylaş penceresi aynı: PDF, görsel (JPG) ve kopyalanabilir metin; altında imzanız (varsayılan Özgür Özyurt · 0530 936 54 27, Ayarlar › Paylaşım imzası'ndan değişir).
- Fotoğraf ekleme (portföy başına 8) ve portföy paylaşımı v3.10'daki gibi yerinde; bu sürümde yeniden denenip doğrulandı.
- Portföy ve talep sayfasında Lokasyon bölümü özet kartının hemen altına alındı (önceden kişiler ve notlardan sonraydı).
- Telefonda liste üstü: arama kutusu kendi satırında tam genişlikte; Acil, Filtrele ve sıralama düğmeleri altındaki satırda.

**Demo'da test edilecekler**

- [ ] Bir portföyü açın: en üst sağda 'Portföy paylaş' düğmesine basın, PDF ve Görsel (JPG) indirin.
- [ ] Aynı sayfada 'Fotoğraflar' bölümünden 3–4 fotoğraf ekleyin, sonra yeniden paylaşın: föyde fotoğraflar görünmeli.
- [ ] Telefonda Portföyler listesinde arama kutusuna yazın: kutu tam genişlikte olmalı.

## v3.12 · 2 Ekim 2026 — Telefonda klavye ve dosya seçme düzeltmeleri; WhatsApp içe aktarma artık kurallarla anında okuyor, 'Hazır' önde sıralıyor; metin ayrıştırma hataları düzeltildi

- Telefonda klavye: bir yazı alanına dokununca alt menü çubuğu ve sabit 'Kaydet' düğmesi kaçar, alan klavyenin üstünde görünecek yere kaydırılır. Önceden bu iki çubuk yazdığınız yeri ve konum önerilerini örtüyordu.
- Veri girişi › Dosya yükle › WhatsApp: sürükle-bırak alanına ek olarak 'Dosya seç (.txt / .zip)' düğmesi eklendi (telefonda alana basınca dosya seçici açılmıyordu). Excel / CSV tarafındaki düğmede de dosya türü kısıtı kaldırıldı (bazı telefonlarda dosyalar gri görünüyordu).
- İçe aktarma: dosya yüklenince adaylar artık yapay zekâ beklemeden kurallarla hemen okunur ve 'Gözden geçir' listesine düşer (önceden yalnızca ön filtre tablosu görünüyordu). Liste 'Hepsi' sekmesiyle açılır: önce Hazır olanlar (güveni yüksek olan üstte), sonra Kontrol gerekli, sonra hatalılar. Yapay zekâ isteğe bağlıdır ve yalnızca 'Kontrol gerekli' mesajlarını yeniden okur.
- İçe aktarma: bir kaydı 'Düzenle ve ekle' ile açıp 'Vazgeç' ya da 'Kaydet' deyince listeye dönülür (önceden Veri girişi'nin ilk sekmesine düşüp tüm liste kayboluyormuş gibi görünüyordu); sekme ve filtre korunur. Veri girişi menüsüne yarım kalan bir içe aktarma varken girince de oraya düşer.
- Ayrıştırma düzeltmeleri (bildirdiğiniz örnekler): 'Satılık' yazan ilan talep sanılmıyor ('tadilata ihtiyacı var', 'tapu yapmamız LAZIM', '10 kata kadar', 'kutlu olsun' artık talep işareti sayılmaz). '5.450.000. ₺' fiyatı okunuyor. 'Yeniköy Mahallesinde Atatürk Caddesi' → Döşemealtı / Yeniköy (cadde adı mahalle sanılmıyordu). 'mahallesinde / mahallesinden' gibi ekler tanınıyor. Numaralı ilan listesinde başlık satırı ile ayrıntı satırı iki kayıt sayılıyordu; artık tek ilan. 80.000 dolar artık 'kiralık' tahmin edilmiyor.
- Yapay zekâ yorumu metindeki açık 'satılık / kiralık' ifadesiyle çelişirse kural kazanır ve kayıt 'Kontrol gerekli' olur; yapay zekânın boş bıraktığı fiyat ve alan kuraldan tamamlanır.

**Demo'da test edilecekler**

- [ ] Telefonda Veri girişi › Dosya yükle › WhatsApp › 'Dosya seç' düğmesine basın; .txt ya da .zip dosyasını seçin.
- [ ] Yüklenince aşağıda kayıtların hemen listelendiğini ve Hazır olanların üstte olduğunu görün.
- [ ] Bir kayıtta 'Düzenle ve ekle' › 'Vazgeç' deyin: liste yerinde durmalı.
- [ ] Yeni talep formunda Teknik özelliklere girip bir sayı yazın: alt menü kaybolmalı, alan klavyenin üstünde görünmeli.

## v3.11 · 2 Ekim 2026 — Mahalle komşuluğu ve yeni eşleştirme modeli: komşu ve yakın mahalleler eşleşir, uzak mahalle elenir; oda ve bütçe puanı düzeltildi

- Mahalle haritası: Antalya'nın 19 ilçesindeki 914 mahallenin sınırları uygulamaya işlendi. Her mahallenin sınır komşuları ve 5 km içindeki diğer mahallelere uzaklığı (sınırdan sınıra) hazır tabloda durur; veritabanı eklentisi ya da harita servisi gerekmez.
- Konum puanı artık mahalle yakınlığına bakıyor: istenen mahalle / alt bölge / ilçe tam puan · sınır komşusu mahalle %85 · sınıra 1,5 km'ye kadar %65 · 3 km'ye kadar %40 ve 'Koşullu' (sormadan sunulmaz) · daha uzak 'bölge dışı' (elenir). Önceden aynı ilçedeki her mahalle aynı puanı alıyordu.
- Düzeltilen hata (bildirdiğiniz örnek): Fener / Çağlayan'da 2+1 arayan talep, 3,9 km uzaktaki Doğuyaka 3+1 ile 92 puan 'Sunulabilir' çıkıyordu. Artık 'Uygun değil · Bölge dışı · Fener sınırına 3,9 km'.
- İlçe sınırı engel değil: Meltem (Muratpaşa) ile Arapsuyu (Konyaaltı) komşudur ve eşleşir. Önceden komşu ilçe, aynı ilçenin en uzak mahallesinden daha düşük puan alıyordu.
- Yalnızca ilçe yazan talep ('Muratpaşa'): ilçenin içindeki portföy artık tam puan alır (önceden %75). 'Lara' gibi alt bölge isteyen talebe Lara'ya sınır mahalleler de sunulur (önceden 'bölge dışı' sayılıp eleniyordu).
- 'Bölge esnek' talep: 5 km'ye kadar uzak mahalleler elenmez, 'Koşullu' olarak en altta gösterilir.
- Portföyün mahallesi girilmemişse (yalnızca ilçe) ve müşteri mahalle istiyorsa eşleşme 'Koşullu' olur: önce mahalleyi öğrenin.
- Oda sayısı: '2+1' isteyen müşteriye 3+1 artık tam puan almaz. İstenen oda tam puan · bir oda fazla kısmi puan (sunulur, altta) · iki ve daha fazla oda fazla ya da oda eksik 'Koşullu'. Müşteri oda sayısına 'şart' dediyse fazlası da elenir.
- Bütçenin çok altındaki ilan: fiyat bütçenin %60'ının altındaysa puan biraz, %40'ının altındaysa daha çok düşer (elenmez). Talepte alt sınır varsa (7–10 milyon) o kullanılır; alt sınırın çok altındaki ilan 'Koşullu' olur.
- Aynı adlı mahalleler: 'Fener, Çağlayan' yazınca Çağlayan artık Manavgat'taki değil Muratpaşa'daki mahalle olarak okunur (yanındaki mahallenin ilçesine bakılır). İpucu yoksa merkez ilçeler (Muratpaşa, Konyaaltı, Kepez, Aksu, Döşemealtı) varsayılır. Daha önce bu şekilde yanlış kaydedilmiş talepleriniz açılışta kendiliğinden düzeltilir.
- Eşleşme kartlarında ve ayrıntıda konum nedeni açık yazılır: 'Komşu mahalle · Fener ile sınır', 'Yakın mahalle · Fener sınırına 1,2 km', 'Bölge dışı · Fener sınırına 3,9 km'.
- Model seçimi deneyle yapıldı: 40 talep–portföy senaryosu ve 30 sıralama beklentisi üzerinde 11 varyasyon denendi. v3.10 modeli %49, seçilen model %100 tuttu (senaryolar ve etiketler scripts/deney/model-karsilastir.ts dosyasında; gerçek eşleşmelerinizle genişletilecek).
- Veritabanı değişikliği yok, migration yok. Yeni dosyalar: src/lib/lokasyon/komsuluk.ts, antalya-komsuluk.json, scripts/build_komsuluk.py, scripts/deney/.

**Demo'da test edilecekler**

- [ ] Yeni talep: Daire · Satılık · 2+1 · bütçe 10.000.000 · konum 'Fener, Çağlayan'. Yeni portföyler: aynı tipte 2+1 daireler — Fener, Güzeloluk, Yeşilbahçe, Zerdalilik, Doğuyaka (9.000.000). Eşleşmeler'de sıra Fener > Güzeloluk (komşu) > Yeşilbahçe (yakın) > Zerdalilik (koşullu) mi, Doğuyaka 'Uygun değil' mi?
- [ ] Aynı talebe Fener'de 3+1 ve 4+1 portföy ekleyin: 3+1 sunulabilir ama 2+1'in altında, 4+1 koşullu mu?
- [ ] Talep: kiralık dükkan, Meltem. Portföy: Konyaaltı / Arapsuyu'nda kiralık dükkan. 'Komşu mahalle · Meltem ile sınır' yazıp eşleşiyor mu?
- [ ] Talep konumu yalnızca 'Lara': Güzeloba (Lara içi) ve Güzeloluk (Lara'ya sınır) portföylerinin ikisi de çıkıyor mu?
- [ ] Bir talepte 'Eşleştirme tercihleri'nden bölgeyi esnek yapın: uzak mahalledeki portföyler 'Koşullu' olarak listenin altında beliriyor mu?
- [ ] Anahtar AI kutusuna 'Fener, Çağlayan 2+1 satılık daire arıyorum 10 milyon' yazın: Çağlayan 'Muratpaşa / Çağlayan' olarak mı geldi?
- [ ] Kendi bildiğiniz mahallelerle deneyin; 'komşu' ya da 'yakın' çıkmaması gereken (ya da çıkması gereken) bir çift görürseniz not edin, tabloyu düzeltirim.

## v3.10 · 2 Ekim 2026 — Türkiye geneli konum, portföy fotoğrafları ve “Portföy paylaş” föyü, yapay zekâ ayarları, güven yüzdesi, telefon ve fiyat girişleri

- Portföy paylaş: portföy sayfasındaki düğme, portföyü sizin ilanınız gibi gösteren şık bir föy hazırlar — PDF (her telefonda ve bilgisayarda açılır), görsel (JPG) ve WhatsApp metni. Altında imzanız yer alır (varsayılan: Özgür Özyurt · 0530 936 54 27; Ayarlar'dan ya da paylaşırken değiştirilir). Mülk sahibinin adı ve telefonu föye girmez.
- Portföy fotoğrafları: her portföye en fazla 8 fotoğraf. Telefonda otomatik küçültülür (uzun kenar 1600 px, ≈ 300 KB), kapak seçilir, tek tek ya da toplu (zip) indirilir, telefonun paylaş menüsünden gönderilir; föye de girer. Canlı kurulumda dosyalar Supabase Storage'da (özel kova) durur, veritabanında yalnızca yolu tutulur.
- Türkiye'nin tamamı: 81 il, 973 ilçe ve ≈ 73 bin mahalle/köy tanınır. İl yazmadan girilen konum çalışma ilinde (Antalya) aranır; “İzmir Bornova'da dükkan”, “Bodrum'da villa, Yalıkavak olabilir” gibi ifadeler o ilde çözülür. İstanbul, Ankara, İzmir, Bursa, Muğla gibi şehirler için başlangıç semt listesi (Maslak, Alsancak, Kızılay, Alaçatı…) eklendi. Çalışma ili Ayarlar'dan değiştirilir.
- Eşleştirme il sınırını bilir: başka ilde arayan talep, Antalya portföyleriyle eşleşmez.
- Yapay zekâ ayarları (Ayarlar › Yapay zekâ): sağlayıcı ve model ekrandan seçilir — Google Gemini (önerilen, ücretsiz katman), Groq, Cerebras, Mistral, OpenRouter, OpenAI ya da herhangi bir OpenAI uyumlu servis. Kod değişmeden geçiş yapılır; API anahtarı ekrana yazılmaz, sunucuda saklanır.
- Güven yüzdesi: her okumaya puan verilir (mülk tipi 20 · talep/portföy 10 · satılık/kiralık 15 · fiyat 20 · konum 20 · alan ya da oda 15). Eşiğin (varsayılan %70) altında kalınca kırmızı “Bu okumadan emin değilim” kutusu neyin okunamadığını söyler ve “Yapay zekâ yorumlasın” düğmesini öne çıkarır. Eşik ve otomatik yorumlama Ayarlar'da.
- Para simgeleri: ₺, $, €, £ ile yazılan ve “3.250.000.-TL”, “8.5M TL” biçimindeki fiyatlar artık kurallarla okunuyor.
- Telefon standardı: numara nasıl yazılırsa yazılsın +90 5XX XXX XX XX biçimine girer; eksikse alanın altında kaç hane kaldığı yazar. Talep / portföy formunda telefon alanı artık görünür ve düzeltilebilir (önceden hata verip düzeltilemiyordu).
- Fiyat, bütçe ve m² alanlarında yazarken üç hanede bir nokta konur (8.500.000).
- Talepte birden çok mülk tipi: “Daire” ve “Dükkan” birlikte seçilebilir; biri ana tip olur, eşleştirme hepsine bakar.
- Anahtar AI kutusu mobilde: metin kutusu tam genişlikte ve kaydırılabilir, büyüt/küçült ve temizle düğmeleri, daha küçük “Gönder”. “Yapay zekâya okut” yerine “Yapay zekâ yorumlasın”.
- Liste ekranlarının üstündeki arama, Acil, Filtrele, sıralama ve “+ Yeni” düğmeleri mobilde küçültüldü.
- Veritabanı: yeni tablo kayit_foto (migration v3.10). Yeni ortam değişkenleri: AI_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, FOTO_KOVA.

**Demo'da test edilecekler**

- [ ] Portföyler → bir portföy → “+ Fotoğraf ekle”: telefondan 3–4 fotoğraf seçin; küçük görseller geliyor mu, kapak değişiyor mu, “Tümünü indir” ve “Paylaş” çalışıyor mu?
- [ ] Aynı portföyde “Portföy paylaş”: önizlemede imzanız (Özgür Özyurt · 0530 936 54 27) var mı, mülk sahibinin bilgisi yok mu? “PDF indir” dosyası telefonda açılıyor mu, WhatsApp'tan gönderilebiliyor mu?
- [ ] Ana sayfa → Anahtar AI: “İzmir Bornova'da kiralık dükkan arıyorum 150 m2 bütçe ₺60.000” yazın — konum “Bornova · İzmir”, bütçe 60.000 TL geliyor mu?
- [ ] “Bodrum'da satılık villa, Yalıkavak olabilir” ve “Müşterim İstanbul'dan geliyor, Lara'da 3+1 arıyor” — ilki Muğla'ya, ikincisi yalnızca Lara'ya mı gidiyor?
- [ ] Anahtar AI'ya “iyi bir yer lazım” yazın: kırmızı “Bu okumadan emin değilim” kutusu ve okunamayanlar listesi çıkıyor mu? “Yapay zekâ yorumlasın” ile tamamlanıyor mu?
- [ ] Telefonda Anahtar AI kutusuna uzun bir mesaj yapıştırın: metni kaydırıp okuyabiliyor, ▾ ile büyütebiliyor musunuz?
- [ ] Yeni talep → mülk tipinde hem Daire hem Dükkan seçin, bütçeye 8500000 yazın (8.500.000 oluyor mu?), telefonu eksik yazıp kaydedin: uyarı alanın altında çıkıyor ve düzeltilebiliyor mu?
- [ ] Konum alanına “born”, “izmir kazım”, “maslak” yazın: diğer illerin ilçe, mahalle ve semtleri öneriliyor mu?
- [ ] Ayarlar → Yapay zekâ: sağlayıcıyı değiştirin (model ve adres kendiliğinden doluyor mu?), güven eşiğini %85 yapıp kaydedin; aynı metinde uyarı daha kolay çıkıyor mu?
- [ ] Ayarlar → Portföy paylaşım imzası: unvan / firma ekleyin; yeni föyde görünüyor mu?
- [ ] Talepler / Portföyler listesinde üstteki arama ve düğmeler telefonda rahat mı?

## v3.9 · 2 Ekim 2026 — Anahtar CRM adı ve logosu, metni önce anlayan akıllı giriş, yeni eşleşme kartları, sade tercih kartı

- Uygulamanın adı Anahtar CRM. Yeni logo: anahtarın halkasında yapay zekâ kıvılcımı.
- Akıllı giriş (Anahtar AI kutusu ve Veri girişi › Yapıştır aynı beyin): yapıştırılan metnin önce ne olduğu anlaşılır — portal ilan sayfası, WhatsApp sohbet dökümü, toplu liste, tek talep / ilan, yalnızca bağlantı, telefon / kişi ya da soru — sonra ona göre ayrıştırılır. Portal sayfasındaki 'Kategori / Türü / m²' satırları artık ayrı kayıt olmaz; çok satırlı WhatsApp mesajı tek kayıttır.
- Yorum açıklaması: her sonuçta 'bunu şöyle anladım' cümlesi; çelişkiler uyarı olur (ilanda 176 m², açıklamada 135 m²), ödeme şekli / depozito / takas gibi ayrıntılar nota yazılır, 'Kepez Varsak hariç' denilen yerler konumlara eklenmez, '2 ayrı talep' her bölge için ayrı kayıt olur, yalnızca ilan bağlantısı gelirse tür / oda / bölge bağlantı adresinden okunur.
- Yapay zekâ isteğe bağlı: önce ücretsiz kural tabanlı okuma çalışır; sonuçtan emin değilse ya da siz isterseniz 'Yapay zekâya okut' ile metin yapay zekâya yorumlatılır (1 istek).
- Veri girişi sadeleşti: Yapıştır · Dosya yükle · Elle gir. 'Toplu mesaj / toplantı notu', 'Tek mesaj yapıştır' ve yapıştırılan WhatsApp metni tek kutuda birleşti; WhatsApp .txt/.zip dosyaları 'Dosya yükle' altında.
- Eşleşme kartları yeniden tasarlandı: üstte puan ve durum, ortada Talep ↔ Portföy iki satır (başlık, tutar, kimden, bölge), altta neden şeridi. Mobilde düğmeler ve filtreler parmağa göre büyütüldü.
- 'Talep DNA' kartı 'Eşleştirme tercihleri' oldu: formüller ve 'varsayılan' etiketleri yok; olmazsa olmazlar, üç açık/kapalı esneklik seçeneği ve müşteriye sorulacak eksik bilgiler var. Uyum dökümünde ağırlık sayıları gizlendi.
- Sadeleştirme: ana sayfadaki test kartı Sürüm notları penceresine taşındı (test listesi ve not alanı orada); Eşleşmeler ve Konumlar'daki açıklama kutuları, dışa aktarma açıklaması ve Ayarlar'daki 'Gemini yanıt şeması' kaldırıldı (şema kodda duruyor); süre açıklaması kısaldı. Kalan bilgi kutuları × ile kapatılabiliyor.
- Kaynak birliği: v3.9 değişiklikleri tam kaynak paketine işlendi (yeni: src/lib/ai/yorumlayici.ts, POST /api/ai/yorumla, demo/kartlar.tsx); veritabanı değişikliği yok, migration yok.
- Hata düzeltmeleri: 'Barınaklar' kafe/bar sanılıyordu; '<görsel dahil edilmedi>' mesajları gürültü sayılmıyordu; virgülle yazılan mahalleler (Fener, Şirinyalı) tek ifade diye birleşiyordu; iki ilçede de bulunan mahalle adları (Çağlayan, Bahçelievler) yer listesinde atlanıyordu.

**Demo'da test edilecekler**

- [ ] Ana sayfa → Anahtar AI → 'Portal ilan sayfası' örneği: tek portföy mü, 176 / 135 m² uyarısı ve notlar geliyor mu?
- [ ] 'WhatsApp sohbeti' örneği: mesajlar doğru sayıda kayda dönüşüyor mu, '2 ayrı talep' iki kayıt mı, 'Kepez Varsak hariç' konumlardan çıktı mı?
- [ ] Kendi grubunuzdan kopyaladığınız sohbeti ve bir portal ilanını yapıştırın; 'Yapay zekâya okut' ile sonucu karşılaştırın.
- [ ] Bir telefon numarası yazın: kişi olarak ekleniyor mu?
- [ ] Eşleşmeler ekranını telefonda açın: kartlar tek bakışta okunuyor mu?
- [ ] Bir talebe girin → 'Eşleştirme tercihleri': esneklik anahtarlarını açıp kapatın, eşleşme sayısı değişiyor mu?

## v3.8 · 1 Ekim 2026 — Taleplerde 'zaten var', eşleşmeyi kopar, kartlarda 'kim' etiketi, verileri dışa aktarma, canlıya alma rehberi

- Toplu girişte 'Zaten var' artık talepler için de çalışıyor: aynı kişi + mülk tipi + işlem + oda + bütçe + m² + konum daha önce kayıtlıysa (dosyadan, toplantı notundan ya da elle) satır eklenmez. Portföyde ilan no / bağlantı yoksa aynı kural uygulanır. Kişi, telefon ya da metin yoksa 'zaten var' denmez (yanlışlıkla atlamaktansa kaçırmak tercih).
- Eşleşmeyi kopar: eşleşme kartında ✕, eşleşme detayında ve talep içi çekmecede 'Eşleşmeyi kopar'. Neden seçilir (yanlış eşleşme, sunuldu-beğenmedi, sahip istemedi, başka mülkle anlaşıldı, fiyat tutmadı, diğer) + not. Koparılan eşleşme ana ekranda, Eşleşmeler listesinde, kişi kartında ve çekmecede bir daha çıkmaz; Eşleşmeler → 'Koparılanlar'dan ya da çekmecede 'Koparılanları göster'den geri alınır.
- Kartlarda 'kim' etiketi: talep, portföy ve eşleşme kartlarında kimden geldiği — Emlakçı (adı ve ofisi), Doğrudan müşteri, Mülk sahibi, Web ilanı · sahibinden / emlak ofisi, Yetkili portföy, Müteahhit, Firma; bilinmiyorsa 'Kimden? belirsiz' (uyarı rengi).
- Verilerimi dışa aktar (Ayarlar): talepler, portföyler, kişiler, eşleşme takibi, görüşme notları CSV olarak (Excel'de doğrudan açılır) ve tam yedek JSON. Canlıda aynısı /api/disa-aktar'dan; ayrıca Supabase'den tam veritabanı yedeği alınabilir (rehber).
- Canlıya alma rehberi (CANLIYA_ALMA_REHBERI_v3.8): hangi hesaplar, hangi sırayla, ne kadar ücret, verilerin nerede durduğu, yedek ve başka CRM'e taşıma.
- Veritabanı: migration v3.8 (match.kopmaNedeni, match.koparilma). Yeni API'ler: POST/DELETE /api/eslesme/kopar, GET /api/disa-aktar.

**Demo'da test edilecekler**

- [ ] Veri girişi → Dosya → 'ofis_talepler_2026.xlsx'i ekleyin, sonra aynı dosyayı tekrar yükleyin: talepler 'Zaten var' geliyor mu?
- [ ] Veri girişi → Toplu mesaj: aynı toplantı notunu ikinci kez yapıştırın — eklenenler 'Zaten var' mı?
- [ ] Eşleşmeler'de bir kartın sağ üstündeki ✕ ile eşleşmeyi koparın (neden seçin): ana ekrandan ve listeden kalktı mı? 'Koparılanlar' sekmesinden geri alın.
- [ ] Bir talebin içinde 'Uygun portföyleri incele' çekmecesinde bir satırı koparın; 'Koparılanları göster' ile görünüyor mu?
- [ ] Talep, portföy ve eşleşme kartlarında 'Emlakçı · ad (ofis)', 'Doğrudan müşteri', 'Mülk sahibi', 'Web ilanı' etiketleri doğru mu? 'Kimden? belirsiz' çıkanları kişi bağlayarak düzeltin.
- [ ] Ayarlar → Verilerimi dışa aktar: Talepler (CSV) dosyasını indirip Excel'de açın; sütunlar okunaklı mı?
- [ ] CANLIYA_ALMA_REHBERI'nin 1. bölümündeki hesapları açmaya başlayabilirsiniz (GitHub, Supabase, Vercel).

## v3.7 · 1 Ekim 2026 — Toplu veri girişi (Excel/CSV/vCard, toplantı notu), görüşme notları, ara/WhatsApp, sıralama, Anakey adı ve logosu

- Toplu dosya girişi (Veri girişi → Dosya): Excel (.xlsx), CSV, TXT ve vCard (.vcf). Başlık satırı nerede olursa olsun bulunur (tablo E sütunundan başlasa da), sütunlar eş anlamlılarla eşlenir ve ekranda değiştirilebilir; her sekme ayrı okunur.
- Dosya türü seçilir: portal ilan listesi (→ Web ilanı havuzu), meslektaşın portföyü (→ Partner), kendi portföyüm (→ CRM), talep listesi (→ Talepler). İlanlar 'Sahibinden / Emlak ofisi / Banka-firma' diye ayrı süzülür; ofis ilanında danışman kişi kartı olur, bireysel sahibin adı kişi kartı yapılmaz (KVKK).
- Dosyadan gelen ilanlara geçerlilik: ilan tarihinden itibaren 90 gün (Ayarlar → 'Dosyadan gelen ilan'). Süresi geçmiş ilan pasif gelir; aynı ilan no / bağlantı ikinci kez eklenmez ('Zaten var'). İlk fiyat > fiyat ise 'Fiyat düştü' notu düşer.
- Yapay zekâ kullanılmaz (0 kredi): sütunlar yapılandırılmış veri; serbest metin (Nitelik, Açıklama) kural tabanlı ayrıştırıcıdan geçer. Gerçek portal dosyasında 1000 ilanın 956'sı doğrudan 'Hazır', 44'ü 'Kontrol gerekli'. Bozuk bütçe ('20.000.0000 TL') şüpheli işaretlenir; 'Antalya geneli' il düzeyi, 'Lara geneli' Lara, '2000 m2 ye kadar' en fazla 2000 m².
- Toplu mesaj / toplantı notu: tek mesajdaki birden çok talep ayrı kayıtlara bölünür. 'Ad Soyad –' ile başlayan satırdan kişi; yalnız ad yazan satır altındakilerin kişisi; fiyat yazan devam satırı önceki maddeye eklenir; '2+1 3,5 milyon / 1+1 3 milyon' iki talep olur, konum ilkinden gelir. AI kutusuna çok maddeli metin yapıştırınca 'Toplu girişte ayrı ayrı aç' önerisi çıkar.
- Her önizlemede 'Tümünü seç', 'Hazır olanları seç', 'Seçilenleri ekle'; kontrol gereken satır 'Formda düzelt ve kaydet' ile tamamlanır. Kişiler tek seferde eklenir: aynı müşterinin satırları tek kişiye bağlanır.
- Görüşmeler ve notlar: her talep ve portföyde görüşme / arama / WhatsApp / gösterim / not akışı; kiminle görüşüldüğü seçilirse kişinin 'son iletişim' tarihi güncellenir. Kişi kartında kişinin tüm kayıtlarındaki notlar bir arada.
- Kişi kartında Ara ve WhatsApp düğmeleri (kart, kişi listesi, talep/portföy içindeki kişiler). WhatsApp mesajı 'Merhaba Ad, [kayıt] ilgili yazıyorum' diye hazır açılır; telefonda WhatsApp Business kuruluysa onunla açılır.
- Sıralama düğmesi: Talepler, Portföyler, Eşleşmeler, eşleşme çekmecesi, Kişiler ve toplu giriş önizlemesi. Fiyat/bütçe, m², kayda giriş, kalan süre, ilan tarihi, aciliyet, skor, ad; büyükten küçüğe ya da tersi. Boş değerler hep sonda.
- Google Kişiler: telefonda Google'a kaydedilen kişi en geç 5 dakikada Kişiler'e gelir (Google varsayılan aralığı 5 dk, zamanlayıcı her 5 dk). Kişiler ekranında 'Google'dan çek' beklemeden çeker. Demo: Bağlantılar → 'Telefonda Google'a kişi kaydet (benzetim)'.
- Çakışmalarda 'Tümünü seç' ve seçilenler için toplu 'uygulamadaki kalsın / kaynaktakini al'.
- Ad: Anakey (Ana(htar) + key, 'ana anahtar'). Yeni logo: lacivert anahtarın halkasında pirinç yapay zekâ kıvılcımı, dişlerin ucunda devre düğümleri. Uygulama ikonu ve sekme simgesi de yenilendi.
- Veritabanı: migration v3.7 (kayit_not tablosu, NotTuru, kayit.portalIlanNo indeksi). Yeni API'ler: /api/ingest/tablo (önizleme), /api/ingest/toplu-ekle, /api/ingest/toplu-mesaj, /api/kayit/:id/notlar; /api/senkron/cakismalar toplu seçim alır.

**Demo'da test edilecekler**

- [ ] Veri girişi → Dosya → kendi 'ilan_portalından_scraping…xlsx' dosyanızı seçin: 'Sahibinden / Emlak ofisi' sayıları doğru mu? 'Kontrol gerekli' nedenleri mantıklı mı? Birkaç ilanı ekleyip Eşleşmeler'e bakın.
- [ ] Aynı dosyayı ikinci kez yükleyin: eklediğiniz ilanlar 'Zaten var' olarak geliyor mu?
- [ ] Veri girişi → Dosya → 'ofis_talepler_2026.xlsx': 4 haftanın talepleri ve kişileri doğru mu? Aynı müşteri tek kişi olarak mı açıldı?
- [ ] Veri girişi → Toplu mesaj → 'Örnek toplantı notu' (ya da kendi notunuz): her madde ayrı kayıt, kişiler doğru mu?
- [ ] Bir talebe girin → 'Görüşmeler ve notlar'a bir görüşme yazın, kişiyi seçin; sonra kişi kartında görünüyor mu?
- [ ] Kişi kartında Ara ve WhatsApp düğmelerini telefonda deneyin: WhatsApp Business açılıyor mu?
- [ ] Talepler / Portföyler / Eşleşmeler / Kişiler: 'Sırala' ile fiyata, kalan süreye göre büyükten küçüğe ve tersine dizin.
- [ ] Bağlantılar → Google bağlıyken 'Telefonda Google'a kişi kaydet (benzetim)' → Kişiler → 'Google'dan çek': yeni kişi geldi mi? Çakışmalarda 'Tümünü seç' çalışıyor mu?
- [ ] Yeni Anakey logosu ve adı nasıl?

## v3.6 · 1 Ekim 2026 — Ekosistem senkronu (Notion + Google Kişiler), yeni ad ve logo önerisi (Keylot), yeni arayüz

- Notion senkronu: 💯 CRM Listesi (talepler), Mülkler ve Satış Tüneli (portföyler) ve Müşteri-Yatırımcılar-Kişiler tabloları gerçek alan adlarıyla eşlendi. Gelen her kayıt aynı doğrulamadan ve konum çözücüden geçip eşleştirmeye girer; kişi kartında 'aradığı mülk' yazan ama talebi olmayan kişiden talep türetilir; Notion'da talebe bağlanmış portföyler eşleşme takibine 'Bildirildi' olarak düşer.
- İki yönlü ama çakışmasız: Notion'dan Anahtar'a tüm alanlar; Anahtar'dan Notion'a yalnızca uygulamanın kendi 5 alanı (Eşleşme Skoru, Eşleşme Sayısı, En İyi Eşleşme, Uygulama Linki, Son Senkron) — sizin Notion alanlarınıza hiç yazılmaz. Değer değişmediyse istek atılmaz (Notion 3 istek/sn sınırı).
- Google Kişiler senkronu (OAuth, salt okunur): telefonu olan kişiler gelir, WhatsApp'tan yazan numara adıyla tanınır; etiketler role döner (Emlakçılar → Emlakçı…); aynı numara varsa yeni kişi açılmaz, birleşir; artımlı senkron (yalnızca değişenler); Google'da silinen kişi Anahtar'da silinmez, bağı kopar.
- Üç yönlü birleştirme: son senkrondaki değer saklanır; yalnızca dışarıda değişen alınır, Anahtar'da yaptığınız düzeltme ezilmez, iki tarafta farklı değişen alan 'çakışma' olarak Bağlantılar'da size sorulur.
- İlk bağlamada mükerrer önleme: elle girdiğiniz kayıt Notion'da da varsa (aynı tip, mülk, işlem, alan/fiyat %3 içinde, ortak ilçe) ikinci kopya açılmaz, ikisi bağlanır.
- Zamanlayıcı: Supabase pg_cron her 15 dakikada /api/senkron/calistir'ı çağırır (prisma/sql/senkron_cron.sql). İş kaldığı yeri saklar, süre dolarsa sonraki turda devam eder; kilit ile iki iş aynı anda çalışmaz.
- Yeni ekran: Bağlantılar — bağla, ilk içe aktarma raporu (yeni / bağlanan / kontrol gerekli / yeni eşleşmeler / Notion'a geri yazılanlar), alan eşleme raporu, çakışma seçimi, senkron geçmişi, kurulum adımları. Kişilerde Google / Notion / WhatsApp kaynak rozeti.
- Ad ve logo önerisi: Keylot (key = anahtar, lot = mülk/parsel). Logo: iki yarım halkadan (talep + portföy) oluşan anahtar, ortada konum noktası, dişler yükselen skor. Ad tek yerden değişir (src/lib/marka.ts); kod ve veritabanı adları 'anahtar' kalır.
- Arayüz: masaüstünde koyu sol menü, telefonda 5 sekmeli alt çubuk + menü; yeni renk ve yazı sistemi (mürekkep, pirinç, deniz; Bricolage Grotesque + Figtree), karşılama satırı, ana sayfada bağlantı daveti ve çakışma uyarısı, her ekranda senkron durumu göstergesi.
- Veritabanı: migration v3.6 (entegrasyon, senkron_calisma, senkron_cakisma tabloları; kişi ve kayıtta senkron fotoğrafları). Yeni API'ler: /api/entegrasyon, /api/entegrasyon/google/baglan · geri-donus · kopar, /api/entegrasyon/notion/baglan, /api/entegrasyon/ayarlar, /api/senkron/calistir · gecmis · cakismalar.

**Demo'da test edilecekler**

- [ ] Ana sayfa: telefonda alt çubuk, bilgisayarda sol menü çıkıyor mu? Yeni ad/logo (Keylot) ve renkler nasıl? Beğenmediğiniz yeri not edin.
- [ ] Bağlantılar → 'Alan eşlemesini gör': Notion tablolarınızın alanları doğru eşlenmiş mi (✓ / –)?
- [ ] Bağlantılar → 'Notion'u bağla' → izin ver: raporda kaç yeni kayıt, kaç 'mevcut kayda bağlanan', kaç yeni eşleşme var? 'Kontrol gerekli' listesindeki nedenler mantıklı mı?
- [ ] Aynı ekranda 'Şimdi senkronize et' (çakışma örneği işaretli): Hacıaliler fiyatı için çakışma kartı çıkıyor mu? Bir kez 'Bu kalsın', bir kez 'Bunu al' deneyin (Ayarlar → sıfırla ile baştan alabilirsiniz).
- [ ] Notion raporunda 'Notion'a geri yazılan' tablosu: skor ve en iyi eşleşme sizin için anlamlı mı?
- [ ] Google hesabını bağla → Kişiler: Google rozetli kişiler geldi mi, aynı numaralı kişi tekrar açılmadı mı, 'Emlakçılar' etiketi Emlakçı rolüne döndü mü? Sonra 'Değişiklikleri çek': 'Annem' silindi ama kişi duruyor mu?
- [ ] Bağlantılar en alttaki 'Canlıya geçince — kurulum' adımları anlaşılır mı?

## v3.5 · 30 Eylül 2026 — AI arama kutusu, eşleştirme motoru v2 (öldürücü kriterler), sade filtreler

- Ana sayfanın en üstünde AI Arama ve Sohbet Kutusu: soru sorun ('Kepez'de 1000 m² üstü kiralık depo var mı?') ya da portal ilanı / WhatsApp metni yapıştırın. Soru havuzda aranır; metin Konum, Fiyat, Alan, Oda, Kaynak, Şirket ve Özet olarak ayrıştırılır, yanında 'Kaydedince X kayıtla eşleşecek' önizlemesi ve Kaydet düğmesi.
- Kredi tasarrufu: önce kural tabanlı hızlı ayrıştırıcı çalışır (fiyat, m², oda, telefon, portal, ilan no, şirket, kW, yükseklik, TIR, rampa… ve metindeki konumlar). Yeterliyse yapay zekâ hiç çağrılmaz; sorular da yapay zekâsız filtreye çevrilir. Aynı metin ikinci kez gelirse yeniden çağrılmaz.
- Portföy edinme fırsatı: yapıştırılan web ilanı 2 veya daha fazla aktif talebe %80+ uyuyorsa 🔥 uyarısı (AI kutusunda ve web ilanı portföy detayında).
- Eşleştirme motoru v2 — Talep DNA'sı: aciliyet, esnek kriterler (alan ±%20, bütçe +%20), öldürücü kriterler (müşterinin 'şart' dedikleri + kullanım amacının gerektirdikleri: üretim → elektrik ve ruhsat, soğuk zincir → soğuk hava, lojistik → TIR…). Öldürücü kriter karşılanmazsa 'Uygun değil'.
- Eksik bilgi tespiti: 'Doğru eşleştirme için 2 kritik bilgi eksik: Minimum elektrik (kW), Ruhsat' uyarısı talep detayında, talep formunda ve AI kutusunda; müşteriye gönderilecek hazır soru mesajı (kopyala / WhatsApp'ta sor). Eksik öldürücü bilgi varken eşleşme en fazla 'Koşullu' olur.
- Skor artık Anahtar Uyum Matrisi: mülk grubuna göre ağırlıklar (sanayi: bölge 15, alan 15, fiyat 15, tip 10, elektrik 10, kullanım 10, yapı 5, ruhsat 5, açık alan 5, araç 5, diğer 5; ticari, konut ve arsa için ayrı tablolar). Eşleşme ayrıntısında bileşen çubukları.
- Havuz akışı: 1 Yetkili portföy → 2 CRM portföyü → 3 Partner (emlakçı) → 4 Web ilanı → 5 hiçbiri yoksa portallarda ara + gruplara talep mesajı. Talep içi çekmece bu sırayla gruplanır. Portföy formuna 'Yetkili portföy' ve yetki bitiş tarihi eklendi.
- Filtreler sadeleşti: ekranda tek satır (arama · Acil · Filtrele rozeti) ve tek satır kayan aktif çipler; ayrıntılar alttan açılan sayfada bölüm bölüm, altta 'N sonucu göster'. Eşleşmeler ekranındaki skor ve takip filtreleri de bu sayfaya taşındı.
- Veritabanı: migration v3.5 (kayit.yetkili, kayit.yetkiBitis).

**Demo'da test edilecekler**

- [ ] Ana sayfa → AI kutusunda 'Örnek Sahibinden ilanı' çipine basın: ayrıştırılan bilgiler, 'Kaydedince X kayıtla eşleşecek' kartı ve 🔥 portföy edinme fırsatı çıkıyor mu? Rozet 'Kural tabanlı · 0 AI isteği' mi?
- [ ] AI kutusuna 'Kepez'de 1000 m² üstü kiralık depo var mı?' yazıp Enter'a basın; 'Listede filtre olarak aç' ile Portföyler'e geçin.
- [ ] 'Örnek WhatsApp talebi' çipi: 'kritik bilgi eksik' uyarısı ve soru mesajı geliyor mu? 'Talebi kaydet' deyin.
- [ ] Kendi gerçek bir ilanınızı / mesajınızı yapıştırın; eksik kalan alanlarda yapay zekâ devreye giriyor mu?
- [ ] Talepler → Kazan üretim tesisi (T1) → Talep DNA kartı ve alttaki çekmecede havuz grupları (Yetkili → CRM → Partner → Web).
- [ ] Eşleşmeler → bir eşleşmeye girin → Anahtar Uyum Matrisi çubukları.
- [ ] Portföyler / Talepler → 'Filtrele': sayfa alttan açılıyor mu, ekranda artık tek satır mı kalıyor?

## v3.4 · 30 Eylül 2026 — Kişiler, çoklu filtre, talep içi portföy çekmecesi, tekrar yükleme koruması

- Hata düzeltmesi: WhatsApp ayrıştırmada 'Yapay zekâ yanıt veremedi: n.json is not a function'. Sebep: yapay zekâ bağlantısı ekran durumuna yanlış kaydediliyordu; düzeltildi ve yedek yol eklendi.
- Hata düzeltmesi: portföy formunda oda sayısı bir kez seçilince değişmiyordu; artık tıklanabilir seçenekler (1+0 … 6+1) ve 'diğer' kutusu var.
- Tekrar yükleme koruması: aynı dosya ikinci kez yüklenince uyarı; daha önce yapay zekâya gönderilmiş ya da havuzda zaten kayıtlı mesajlar tekrar gönderilmez (kredi boşa harcanmaz). Göndermeden önce 'N mesaj → K istek' tahmini.
- Çoklu seçimli filtre paneli (Talepler, Portföyler, Eşleşmeler, çekmece): mülk türü, işlem, konum (ilçe / mahalle / bölge), fiyat, alan, oda, durum, kişi, kaynak; mülk türü seçilince o türe özel filtreler (yükseklik, araç erişimi, ısınma, cephe…). Aktif filtreler çip olarak görünür, tek dokunuşla kaldırılır.
- Talep içinden çıkmadan uygun portföyleri inceleme: detayın altındaki 'Uygun portföyleri incele' çekmecesi; filtre talepten hazır gelir, her satırda eşleşme puanı, kriter dökümü ve 'Eşleştir' kutucuğu. Portföyde aynısı talepler için.
- Satılık / kiralık / devren etiketleri ayrı renkte (turuncu / mavi-yeşil / mor).
- Kişiler: Notion kişi tablosuna göre kişi kartı (roller, uzmanlık, referans, notlar, WhatsApp grupları, bağlı talep/portföy/eşleşmeler). Talep ve portföyde birden fazla kişi, her biri bir rolle; yazdıkça arama, yoksa '+' ile anında ekleme. İçe aktarılan mesajın göndereni telefonla eşleşir ya da kişi olarak eklenir.
- Geçerlilik süresi satılık ve kiralık için ayrı: portföy satılık 90 / kiralık 45, talep satılık 60 / kiralık 30 gün; acil talep üst sınırı 30.
- Portallarda ara: talepten Sahibinden, Emlakjet ve Hepsiemlak için hazır arama bağlantıları (otomatik veri çekme yok).
- Veritabanı: migration v3.4 (kayıt ↔ kişi bağları, kişi alanları, işlenmiş mesaj kaydı, TTL yeni biçim). Yeni API'ler: /api/kisiler, /api/kisiler/:id, /api/kayit/:id/kisiler, /api/ingest/islenmis.

**Demo'da test edilecekler**

- [ ] Veri Girişi → örnek dosyaları yükleyin, ayrıştırın, ekleyin; sonra AYNI dosyaları tekrar yükleyin: uyarı çıkıyor ve mesajlar 'Daha önce işlenmiş' sayılıyor mu?
- [ ] Kendi grubunuzdan gerçek bir dosya ile 'Ayrıştır' deneyin (önceki 'n.json' hatası düzeldi mi?).
- [ ] Talepler → bir talebe girin → alttaki 'Uygun portföyleri incele' çekmecesini açın; filtreyi değiştirin, bir portföyü 'Eşleştir' ile işaretleyin.
- [ ] Portföyler → Filtreler: birden fazla mülk türü ve ilçe seçin; 'Depo / Lojistik' seçince çıkan özel filtreleri deneyin.
- [ ] Yeni portföy → Kişiler bölümünde bir isim yazın, listede yoksa '+ yeni kişi' ile ekleyin; Kişiler sekmesinde kişi kartını açın.
- [ ] Portföy formunda oda sayısını seçip başka bir değerle değiştirin.
- [ ] Ayarlar → satılık / kiralık geçerlilik sürelerini kontrol edin.
- [ ] Bir talepte 'Portallarda ara' bağlantılarını açın; doğru sayfaya gidiyor mu?

## v3.3 · 30 Eylül 2026 — Tüm mülk tipleri, WhatsApp toplu içe aktarma, konum öğrenme

- Konut desteği: banyo, ısınma, eşya, site, güvenlik, balkon/teras/bahçe, dubleks, cephe yönü, deniz manzarası, krediye uygunluk; oda sayısı (3+1) eşleştirmede karşılaştırılır. Yapay zekâ talimatına konut kuralları eklendi.
- Teknik alanlar mülk tipine göre: her alanın hangi gruplarda anlamlı olduğu tek tek tanımlandı (Yalı formunda trafo, sanayi elektriği artık çıkmaz). Formda önce en çok kullanılan alanlar, gerisi 'Tüm alanlar' altında.
- Evet/hayır özellikleri tek satır çiplere dönüştü (dokun: ✓ var → ✕ yok → boş). Elektrik tek alan, kW/kVA seçmeli.
- Mülk tipi seçimi sadeleşti: önce 14 aileden biri (Daire, Villa, Depo/Lojistik, Fabrika/İmalathane…), ayrıntı isteğe bağlı. Talepte birden fazla tip seçilebilir.
- Benzer tip eşleştirmesi: Depo ↔ Fabrika/İmalathane, Dükkan ↔ Restoran, Ofis ↔ Hizmet gibi aileler 'benzer tip' olarak (koşullu) önerilir; tablo kodda, yapay zekânın yorumunda değil.
- Form bölümleri açılır-kapanır: Temel ve Lokasyon açık, diğerleri kapalı ve özet satırı gösterir.
- Konum yazarken öneri listesi: ilçe, mahalle, alt bölge ve referans noktalar harf harf önerilir, tıklayınca eklenir.
- Konum öğrenme: tanınmayan ifadeler birikir, birlikte geçtiği konum sayılır, güçlü öneri çıkar; onaylayınca sözlüğe girer. Yapay zekâya sorma seçeneği. Örnek: 'Cender Otel' → Gençlik (Işıklar).
- WhatsApp toplu içe aktarma: birden çok .txt / .zip sohbet dosyası, ön filtre (gürültü, eski mesaj, gruplar arası kopya), 10'arlı paketlerle yapay zekâ, sonra Hazır / Kontrol gerekli / Şemaya uymayan ayrımı ve toplu onay.
- Kaynak bilgisi: WhatsApp grubu, mesaj tarihi-saati, gönderen, dosya adı kayda yazılır ve detayda gösterilir.
- Geçerlilik süresi düzenlenebilir: kayıtta +30/+60/+90 gün veya tarih seçme; varsayılan süreler Ayarlar'dan değiştirilebilir.
- Eşleşmeler ekranına arama ve filtreler: portföy tipi, ilçe, en az skor, takip durumu, sadece acil.
- Veritabanı: yeni migration (konut kolonları, mesaj tarihi / dosya, konum öğrenme adayları, ayarlar tablosu). Yeni API'ler: /api/ayarlar, /api/kayit/:id/sure, /api/lokasyon/ogrenme, /api/ingest/whatsapp.

**Demo'da test edilecekler**

- [ ] Veri Girişi → 'Örnek iki grup dosyasıyla dene' → ön filtre tablosunu inceleyin → 'Hazır örnek sonuçlarla devam et' (ya da gerçek yapay zekâ) → 'Hazır olanların tümünü ekle'.
- [ ] Kendi WhatsApp grubunuzdan dışa aktardığınız bir .txt veya .zip dosyasını yükleyin; gürültü ve tekrar ayıklaması doğru mu?
- [ ] Konumlar → 'Yeni Sanayi' önerisini onaylayın; ardından bir formda 'Yeni Sanayi' yazınca tanınıyor mu?
- [ ] Yeni portföy → 'Daire / Rezidans' seçin: alanlar konuta uygun mu, 'Tüm alanlar' altında gereksiz alan var mı?
- [ ] Yeni talep → 'Fabrika / İmalathane' seçin, 'Bunlar da olur'dan Depo ekleyin; eşleşmelerde benzer tipler çıkıyor mu?
- [ ] Lokasyon kutusuna 'hur', 'ışık', 'cend' yazın; öneriler doğru mu?
- [ ] Bir kaydın geçerliliğini +30 gün uzatın; Ayarlar'dan varsayılan süreleri değiştirin.
- [ ] Eşleşmeler → arama kutusu ve filtreler beklediğiniz gibi daraltıyor mu?

## v3.2 · 30 Eylül 2026 — Birleşik demo uygulaması + sürümleme düzeni

- Tek tıkla açılan demo uygulama: Ana Sayfa, Talepler, Portföyler, Eşleşmeler, Veri Girişi, Kişiler, Test Araçları.
- Demo, gerçek uygulamanın kodunu çalıştırır: konum çözücü, kayıt doğrulama (Zod), teknik alan listesi, Gemini çıktı şeması.
- Örnek veri: Notion CRM'deki ticari kayıtlardan türetilmiş 10 portföy ve 8 talep. Değişiklikler tarayıcıda saklanır, 'Örnek veriyi sıfırla' ile baştan başlanır.
- Kayıt formu şemadan otomatik üretilir: mülk tipine göre ilgili teknik alanlar (endüstriyel: yükseklik, rampa, trafo; ticari: cephe, vitrin, trafik).
- Eşleştirme önizlemesi: kriter dökümü (✓ / ✗ / ?), kritik engeller, Sunulabilir / Koşullu / Uygun değil etiketi, lokasyon puanı (+20 / +10 / 0 / −15). AŞAMA 3'te kesinleşecek.
- WhatsApp mesajı yapıştır → yapay zekâ ile ayrıştır → şema denetimi → konum çözümü → havuza ekle.
- Sürüm düzeni: dağıtılan dosyalar 'ad_v3.2_30Eylul2026' biçiminde; kod dosyalarının başında sürüm satırı; değişiklik günlüğü SURUMLER.md.

**Demo'da test edilecekler**

- [ ] Talepler → 'Kazan üretim tesisi' talebini açın; eksik bilgiler ve kritik kriterler doğru mu?
- [ ] Eşleşmeler → Kundu 8000 m² depo ile TIR'lı lojistik talebinin kriter dökümüne bakın; puan mantıklı mı?
- [ ] Veri Girişi → Manuel Portföy: 'Depo / Antrepo' seçin, teknik alanlar ekranda doğru gruplanıyor mu?
- [ ] Veri Girişi → WhatsApp: gruptan gerçek bir mesaj yapıştırıp ayrıştırın; alanlar doğru dolduruluyor mu?
- [ ] Test Araçları → Konum çözücüye kendi yazdığınız bölge ifadelerini girin; yanlış çözülen var mı?
- [ ] Bir kaydı düzenleyip kaydedin, sayfayı yenileyin; değişiklik duruyor mu?

## v3.1 · 30 Eylül 2026 — AŞAMA 2 — Genişletilmiş veri modeli ve Türkiye lokasyon altyapısı

- 6 ana kategori, 61 mülk tipi; 8 işlem tipi (Devren Satılık/Kiralık, Kat Karşılığı, Günlük/Sezonluk dahil).
- MulkOzellik tablosu: 100'ü aşkın standart teknik sütun (alan, yükseklik, kapı, araç erişimi, rampa, vinç, trafo, sanayi elektriği, yangın, iskan, ruhsat, soğuk hava, otopark, trafik, cephe/vitrin).
- İlan sahibi: Malik, Emlakçı, Müteahhit, Firma, Partner, Portal. Veri kanalı ayrı alan.
- Türkiye geneli 81 il, 973 ilçe, 73.305 mahalle/köy; Antalya alt bölgeleri, komşu ilçeler, yazım farkları sözlüğü.
- Gemini çıktısı enum kısıtlı şemaya bağlandı; lokasyon ID'si yapay zekâ tarafından üretilmez.
