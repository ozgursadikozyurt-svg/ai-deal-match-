# Anahtar CRM — "Google ile bağlan" kurulumu (v3.21 · 8 Ekim 2026)

Bu belge iki kişiye hitap eder:

- **Bölüm A — Platform yöneticisi (Özgür), yalnızca BİR KEZ, yaklaşık 15 dakika.** Google'a "Anahtar CRM diye bir uygulama var" demek ve iki anahtarı Cloudflare'e girmek.
- **Bölüm B — Her ofis, 30 saniye.** Tek düğme.

Bölüm A yapılana kadar canlıda Bağlantılar ekranı "Google bağlantısı bu kurulumda henüz açılmamış" der. Uygulamanın geri kalanı bundan etkilenmez.

---

## Bölüm A — Platform kurulumu (bir kez)

### 1. Google Cloud projesi
1. https://console.cloud.google.com adresine **uygulamanın sahibi olacak Google hesabıyla** girin.
2. Üstteki proje seçiciden **New project** → ad: `Anahtar CRM` → Create.
3. Sol menü › **APIs & Services › Library** → arama kutusuna `People API` yazın → açın → **Enable**.

### 2. İzin ekranı (kullanıcıların göreceği "İzin ver" sayfası)
1. **APIs & Services › OAuth consent screen** (yeni arayüzde "Google Auth Platform › Branding").
2. Kullanıcı türü: **External**.
3. Uygulama adı: `Anahtar CRM` · destek e-postası: sizin e-postanız · geliştirici e-postası: sizin e-postanız.
4. **Scopes / Data access** → **Add or remove scopes** → listede `.../auth/contacts` ("See, edit, download, and permanently delete your contacts") satırını işaretleyin → Save.
   > Google bu iznin adına "silme" kelimesini de yazar; daha dar bir "yalnızca ekle / düzenle" izni yoktur. **Anahtar CRM'de Google'dan kişi silen hiçbir kod yoktur** ve bu, otomatik testle denetlenir (`tests/v321.test.ts`).
5. **Publishing status → Publish app (In production)**.
   > "Testing"de bırakırsanız Google bağlantıyı **7 günde bir düşürür** ve yalnızca elle eklediğiniz test kullanıcıları bağlanabilir.

### 3. Kimlik bilgisi (iki anahtar)
1. **APIs & Services › Credentials → Create credentials → OAuth client ID**.
2. Application type: **Web application** · ad: `Anahtar CRM Web`.
3. **Authorized redirect URIs → Add URI** ve şunu **aynen** yapıştırın:

   ```
   https://anahtarcrm.ozgursadikozyurt.workers.dev/api/entegrasyon/google/geri-donus
   ```
   (Uygulamayı ileride kendi alan adınıza taşırsanız o adresle ikinci bir satır eklersiniz. Doğru adres canlıda Bağlantılar › "Platform kurulumu" kutusunda da yazar.)
4. **Create** → açılan pencerede **Client ID** ve **Client secret** görünür. İkisini kopyalayın.

### 4. Cloudflare'e girin
1. https://dash.cloudflare.com › Workers & Pages › **anahtarcrm** › **Settings › Variables and Secrets** → **Add**.
2. İki değişken ekleyin (ikisi de tür: **Secret**):

   | Ad | Değer |
   |---|---|
   | `GOOGLE_CLIENT_ID` | Google'dan kopyaladığınız Client ID |
   | `GOOGLE_CLIENT_SECRET` | Google'dan kopyaladığınız Client secret |
3. **Deploy**.

Başka bir değişken gerekmez (şifreleme anahtarı ve uygulama adresi kendiliğinden türetilir; otomatik eşitleme Cloudflare zamanlayıcısıyla gelir).

### 5. Deneyin
Uygulamayı yenileyin → menü › **Bağlantılar** → "Platform kurulumu … tamamlandı ✓" yazmalı ve **Google ile bağlan** düğmesi açılmış olmalı. Bölüm B'ye geçin.

### Bilmeniz gereken iki Google kuralı
- **"Google bu uygulamayı doğrulamadı" uyarısı.** Google, kişilere erişen uygulamaları "hassas" sayar. Doğrulama başvurusu onaylanana kadar izin ekranında bu uyarı çıkar; **Gelişmiş → Anahtar CRM'e git** ile geçilir. Kendi kullanımınız için sorun değildir.
- **100 hesap sınırı.** Doğrulanmamış uygulamaya en fazla 100 Google hesabı bağlanabilir. **Başka ofislere açmadan önce** OAuth consent screen › "Prepare for verification" ile başvurun. Google şunları ister: uygulamanın ana sayfası, **gizlilik politikası** sayfası (kişi verisini nasıl kullandığınız), izni neden istediğinizi anlatan kısa bir açıklama / video. Onay genellikle birkaç gün–birkaç hafta sürer. (KVKK metinleri zaten v3.20 kontrol listesindeydi; aynı sayfa burada da kullanılır.)

---

## Bölüm B — Ofisin yapacağı (30 saniye)

1. Menü › **Bağlantılar** (ya da Kişiler ekranındaki **Google ile bağlan**).
2. **Google ile bağlan** → Google'ın kendi sayfası açılır → hesabınızı seçin → **İzin ver**.
3. Uygulamaya geri dönersiniz; rehberiniz kendiliğinden içe aktarılır (büyük rehberde ilerleme ekranda akar; ekranı kapatsanız da arka planda sürer).

Bağlantıyı **ofis yöneticisi** kurar. Bir ofis bir Google hesabı bağlar.

### Bağlandıktan sonra ne olur?

| Siz ne yaptınız | Ne olur |
|---|---|
| Google'a (telefonunuza) kişi kaydettiniz | Anahtar CRM'e düşer (en geç 15 dk; uygulama açıksa 5 dk; "Google ile eşitle" ile hemen) |
| Anahtar CRM'de **elle** kişi eklediniz | Google rehberinize eklenir |
| Bir tarafta ad, telefon, e-posta ya da şirketi düzelttiniz | Diğer tarafta da düzelir |
| Aynı alanı iki tarafta farklı değiştirdiniz | "Çakışma" olarak size sorulur; siz seçene kadar hiçbiri ezilmez |
| **Anahtar CRM'den kişi sildiniz** | **Google'dan SİLİNMEZ.** Anahtar'a da geri gelmez. (Geri almak: Bağlantılar › "Silinenleri yeniden getir") |
| Google'dan kişi sildiniz | Anahtar CRM'de kalır (talep / portföy bağı kopmasın); kartına not düşülür |
| Excel / CSV / WhatsApp ile **toplu** kişi aktardınız | Kendiliğinden Google'a **gitmez** (rehberiniz dolmasın). İstediklerinizi Kişiler › Seç › "Google'a gönder" ile gönderirsiniz |

Ayrıca: Anahtar'daki **notlar** Google'a yazılmaz · Anahtar'da **boşalttığınız** bir alan Google'da silinmez · bağlandığınız anda zaten farklı olan bilgiler toplu hâlde Google'a yazılmaz (yalnızca bağlandıktan sonraki düzeltmeleriniz gider) · telefonu olmayan Google kişileri alınmaz.

### Bağlantıyı kaldırmak
Bağlantılar › **Bağlantıyı kaldır**. Eşitleme durur, Google hesabınızdaki izin de geri alınır; kişileriniz hem Anahtar'da hem Google'da olduğu gibi kalır.

### Sorun olursa
| Belirti | Çözüm |
|---|---|
| "Google'ı yeniden bağlayın" | Google izni düşmüş (şifre değişimi, izni Google'dan kaldırma, uygulama "Testing"de). Düğmeye yeniden basın; veri kaybı olmaz. |
| "Google kalıcı izin vermedi" | myaccount.google.com › Güvenlik › Üçüncü taraf erişimi › Anahtar CRM'i kaldırın, yeniden bağlanın. |
| "redirect_uri_mismatch" (Google sayfasında) | Bölüm A-3'teki adres Google'a birebir aynı girilmemiş (sonunda `/` olmamalı, `https` olmalı). |
| Çift yönlü kutusu soluk | İzin ekranında "kişileri düzenleme" kutusu işaretsiz bırakılmış. Bağlantıyı kaldırıp yeniden bağlanın. |
