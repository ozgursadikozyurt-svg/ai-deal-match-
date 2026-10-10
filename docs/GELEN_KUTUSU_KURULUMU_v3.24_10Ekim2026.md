# Anahtar CRM — Gelen Kutusu kurulumu ve günlük kullanım (v3.24 · 10 Ekim 2026)

Gelen Kutusu (**Veri Girişi › Gelen kutusu** sekmesi), Revy'den aldığınız Excel dökümünü ve WhatsApp sohbet dosyalarını **onayınızı bekleyen** tek bir listede toplar. Dosyayı ekrana bırakabilir ya da e-postayla gönderebilirsiniz. Onaylamadığınız hiçbir kayıt havuza girmez.

## Günlük kullanım (≈ 2 dakika)

1. **Revy:** İlan listesinde süzgecinizi bir kez kaydedin (FSBO, ilçe, işlem tipi) → her gün **Kayıtlılar** → süzgeç → **Excel'e Aktar**. İnen dosyayı Gelen Kutusu'na bırakın ya da e-postayla gönderin.
2. **WhatsApp:** grup › ⋮ › Diğer › **Sohbeti dışa aktar › Medya olmadan** › Gmail › alıcı: Anahtar CRM adresiniz. (Dosya 15 MB'ı geçerse alınmaz; "Medya olmadan" seçin.)
3. **Anahtar CRM › Veri Girişi › Gelen kutusu:** kayıtlar tek listede, hazır olanlar en üstte bekler. Her kartta **Kaynak** (Emlak grubu · Sahibinden · Portal · Kendi portföyüm) tahmin edilmiştir; gerekirse değiştirin. "Hazırları ekle", süzgeçle "tümünü seç → atla" ya da tek tek "Ekle / Düzenle / Atla".

Aynı ilan ertesi günün dökümünde yeniden gelirse sorulmaz: havuzdaysa "zaten var", atladıysanız "daha önce atlandı" sayılır. Havuzdaki ilanın fiyatı değiştiyse "Fiyatı değişti" olarak ayrıca görünür.

## E-postayla gönderme — Gmail köprüsü (bugün, ücretsiz, alan adı gerekmez)

Bir kez kurulur, yaklaşık 5 dakika. Dosyaları **kendi Gmail adresinizin "+anahtar" eklenmiş hâline** gönderirsiniz (ör. `adiniz+anahtar@gmail.com`); Gmail bunları normal kutunuza teslim eder, küçük bir Gmail ayarı ekleri 10 dakikada bir Anahtar CRM'e taşır.

1. Anahtar CRM › Veri Girişi › Gelen kutusu › **E-posta kurulumu** → **Kodu kopyala**. (Kodun içinde ofisinizin gizli anahtarı hazırdır.)
2. Bilgisayarda https://script.google.com adresini açın (dosyaları göndereceğiniz Gmail hesabıyla) → **Yeni proje**.
3. Açılan kutudaki yazıyı tümüyle silin, kodu yapıştırın, kaydedin (disket simgesi).
4. Üstteki işlev listesinden **kur**'u seçin → **▶ Çalıştır**. Google izin ister: **Gelişmiş › … projesine git › İzin ver**. Bu uyarı, kodu Google değil siz yazdığınız için çıkar; kod yalnızca sizin hesabınızda çalışır.
5. Telefonda `adiniz+anahtar@gmail.com` adresini "Anahtar CRM" adıyla rehbere kaydedin.

Kod ne yapar: (1) `+anahtar` adresine gelen, eki olan, son 14 günün postalarının `.zip .txt .xlsx .csv` eklerini Anahtar CRM'e gönderir; postayı **AnahtarCRM** etiketiyle işaretler ve **gelen kutusundan kaldırır** (posta silinmez, Gmail sol menüsündeki AnahtarCRM etiketinin altında durur). (2) Eki Drive'daki **AnahtarCRM Gelen › İşlendi** klasörüne yedekler. (3) Drive'daki **AnahtarCRM Gelen** klasörüne bıraktığınız dosyaları da (Revy Excel'i, WhatsApp zip'i; telefondan Drive'a yükleyerek de olur) 10 dakikada bir alır ve **İşlendi**'ye taşır. Posta göndermez, silmez, başka postaları okumaz. Durdurmak için: script.google.com › proje › Tetikleyiciler › silin.

**Etiket sol menüde görünmüyorsa:** Gmail › Ayarlar (dişli) › Tüm ayarlar › **Etiketler** › AnahtarCRM › "Etiket listesinde" **göster**. Etiketi yanlışlıkla sildiyseniz betik bir sonraki çalışmada yeniden oluşturur (aynı dosya ikinci kez havuza girmez). Eski betiği kullanıyorsanız Gelen Kutusu › E-posta kurulumu'ndan yeni kodu kopyalayıp projedeki eski kodun yerine yapıştırın, **kur**'u yeniden çalıştırın (Drive izni bir kez daha sorulur).

**Posta düştü ama CRM'e gelmedi:** işlev listesinden **anahtarCrmGonder**'i seçip ▶ Çalıştırın; alttaki günlükte "Bulunan konuşma: N" ve "Gönderildi: dosya adı" satırları görünür. N = 0 ise posta `+anahtar` adresine gitmemiştir (alıcı adresini kontrol edin); hata satırı varsa bize iletin. Betik her postayı tek tek izler, aynı konulu yeni posta eski konuşmaya eklense de işlenir.

Sorun olursa: script.google.com › proje › **Yürütmeler** sekmesinde her çalışmanın sonucu yazar. "401" görürseniz anahtar yenilenmiştir: E-posta kurulumu'ndan kodu yeniden kopyalayıp yapıştırın.

## E-postayla gönderme — kendi alan adınızla (kalıcı çözüm)

`workers.dev` adresi e-posta alamaz; doğrudan `…@alanadiniz` adresi için Cloudflare'de bir alan adı gerekir (yıllık ≈ 10 USD; Cloudflare Registrar'dan alınabilir). Alan adı geldiğinde:

1. Cloudflare › alan adı › **Email › Email Routing** → **Onboard / Enable** (MX kayıtlarını Cloudflare kendisi ekler).
2. **Routing Rules › Catch-all address** → Action: **Send to a Worker** → Worker: **anahtarcrm** → Save.
3. Cloudflare › Workers › anahtarcrm › Settings › Variables → `GELEN_ALAN_ADI` = alan adınız (ör. `anahtarcrm.com`) → Deploy.

Bundan sonra E-posta kurulumu ekranı her ofise kendi adresini (`<gizli-kod>@alanadiniz`) gösterir, posta saniyeler içinde düşer ve Gmail köprüsü kapatılabilir. Başka ofislere satışta her ofisin adresi kendiliğinden ayrıdır.

## Güvenlik ve sınırlar

- Adres / anahtar gizlidir; bilen biri kutunuza dosya **bırakabilir** ama hiçbir şeyi okuyamaz ve onayınız olmadan havuza kayıt giremez. Sızdıysa E-posta kurulumu › **Anahtarı yenile**.
- Dosya başına 15 MB; kutuda aynı anda en çok 200 dosya. 45 günden eski dosyalar kendiliğinden silinir.
- Revy'nin dışa aktarımı elledir (Revy'de API ya da zamanlanmış rapor varsa bu adım da kalkar — destek hattına sorulmalı). Portallara doğrudan bağlanılmaz.
- "Yayından kalkan ilan" tespiti yoktur: Revy dökümü süzgece bağlı olduğu için eksik satır "kalktı" anlamına gelmez; ilanlar geçerlilik süresi dolunca pasife düşer.
