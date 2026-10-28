# Anahtar CRM — EK v3.46 · 28 Ekim 2026
## Güvenlik ve işlevsellik denetimi: bulgular, düzeltmeler, kalanlar

Bu sürüm yeni özellik eklemez; uygulamayı satışa açılabilir hâle getirmek için yapılan uçtan uca denetimin sonucudur.
Taranan: tüm API rotaları (56), kiracılık (ofis ayrımı) katmanı, yetki ve plan kuralları, canlı Supabase veritabanı (güvenlik uyarıları, depolar, ofisler), arayüzün tüm ana ekranları (telefon 390 px ve 320 px, gerçek tarayıcıda).

Canlı durum (28 Ekim): 3 ofis — Özyurtlar Gayrimenkul (sınırsız), RedStone Business (Pro+), **Lara Yatırım Antalya (Ücretsiz, 1 yönetici)**. Yani aşağıdaki açıkların ikisi gerçek, dış bir kullanıcıya açıktı.

---

### 1. Kapatılan açıklar (önem sırasıyla)

| # | Önem | Bulgu | Düzeltme | Kanıt |
|---|---|---|---|---|
| 1 | **Kritik** | `/api/ai/dene` gövdeden gelen yapay zekâ adresini kabul ediyordu; sunucu `AI_API_KEY`'i o adrese gönderiyordu. Giriş yapmış herhangi bir kullanıcı (ör. başka ofis) kendi sunucusunu yazıp anahtarı ele geçirebilirdi. Ofis yöneticisi Ayarlar › Yapay zekâ adresini değiştirerek de aynı sonuca ulaşabilirdi. | Anahtar artık yalnızca bilinen sağlayıcı alanlarına gider (Gemini, Groq, Cerebras, Mistral, OpenRouter, OpenAI; yalnızca https). Ek alan: Cloudflare değişkeni `AI_IZINLI_ALANLAR`. Adres denemesi ayrıca ayar yetkisi ister. | `src/lib/ai/saglayici.ts › aiAdresiIzinli` · test: izinsiz adrese hiç istek gitmiyor |
| 2 | **Yüksek** | Ofisler arası yazma: kiracılık katmanı `upsert`'in yalnızca oluşturma kısmına ofis yazıyordu. Kimliği bilinen başka ofisin **kişisi** ve **eşleşme notu**, kaydetme yolundan değiştirilebiliyordu. | `upsert`'in arama kısmına da ofis süzgeci eklendi; başka ofisin satırı değişmez. | `src/lib/kiracilik.ts` · `tests/v346-db.test.ts` — düzeltme geri alınınca test kırmızı |
| 3 | **Yüksek** (maliyet) | Plan sınırları sunucuda uygulanmıyordu: Ücretsiz ofis sınırsız yapay zekâ (sizin anahtarınız), fotoğraf ve Google eşitlemesi kullanabiliyordu. Sınırlar yalnızca Yönetim ekranında yazıyordu. | Yeni `src/lib/services/plan.ts`: günlük yapay zekâ hakkı (Ücretsiz 25 · Pro 500 · Pro+ 2.000; TR gece yarısı yenilenir), plana göre fotoğraf, plana göre Google bağlantısı. Dolunca 402 "PLAN" ve anlaşılır mesaj; kural tabanlı okuma çalışmaya devam eder. Sınırsız ofis etkilenmez. | `tests/v346-db.test.ts` (25. çağrı geçer, 26. durur; ertesi gün sıfırlanır) |
| 4 | Orta | `/api/ayarlar` (PUT) yetki denetimi yoktu: danışman / asistan ofis ayarlarını (süreler, yapay zekâ, imza, yıl hedefi) değiştirebiliyordu. Kaydetme yolunda bu kural vardı, bu uçta yoktu. | `ofis.ayarlar` yetkisi şart. | test: danışman → 403 |
| 5 | Orta | Tüm ofislerin ORTAK konum sözlüğüne (takma ad, alt bölge) herhangi bir kullanıcı yazabiliyordu (`/api/lokasyon/ogrenme`, `/api/lokasyon/alt-bolgeler`). Kötü niyetli bir ofis "Lara" gibi bir adı yanlış ilçeye bağlayıp herkesin eşleşmesini bozabilirdi. Arayüz bu uçları kullanmıyor. | Yalnızca platform yöneticisi. | test: ofis yöneticisi → 403, sözlük değişmez |
| 6 | Düşük | Statik sayfalarda güvenlik başlığı yoktu (başka sitede gizli çerçeveye gömülebilirdi). | `public/_headers`: X-Frame-Options, nosniff, HSTS, Referrer-Policy. Uygulamada iframe kullanılmıyor (kontrol edildi). | — |

**Temiz çıkanlar (değişiklik gerekmedi):**
- Supabase: 38 tablonun hepsinde RLS açık, politika yok → tarayıcıdan doğrudan veritabanına erişim tamamen kapalı (doğru tasarım). "Sızdırılmış şifre koruması" uyarısı geçersiz: giriş şifresiz (e-posta bağlantısı).
- Depolar (`portfoy`, `yedekler`, `gelen`) gizli; fotoğraflar imzalı, süreli bağlantıyla açılıyor.
- Okuma, güncelleme, silme ve toplu işlemlerde ofis ayrımı (49 testlik v3.20 paketi) sağlam. Davet kodları tahmin edilemez, yalnızca özeti saklanıyor.
- Oturum süresi dolunca anahtar kendiliğinden yenileniyor; kaydedilmemiş değişiklik varken sayfa kapatılırsa uyarı çıkıyor.
- Polaris yalnızca platform yöneticisine açık.

### 2. Düzeltilen işlevsel eksikler

1. **Boş liste çıkmazı:** Talepler / Portföyler süzgeçle açılıp hiç kayıt göstermeyince yalnızca "Bu filtrede kayıt yok" yazıyordu. Şimdi: "15 talep süzgeç yüzünden gizli" + **Süzgeci temizle** düğmesi. Hiç kayıt yoksa **+ Yeni talep** ve **Veri Girişi'nden toplu ekle**. Eşleşmelerde **Süzgeçleri temizle**.
2. **Boş kayıt:** Formda hiçbir alan doldurulmadan Kaydet'e basınca "Depo / Antrepo · Kiralık, Konum yok, Bütçe yok" bir talep oluşuyordu; böyle kayıt her şeyle eşleşir. Artık en az bir konum, fiyat / bütçe, m², kişi ya da açıklama istenir. İçe aktarma ve sunucu kuralları değişmedi.
3. **Etiket:** Kayıt detayında "Ana kategori: Isyeri" → "İş Yeri (Ticari / Endüstriyel)".
4. **Pro+ fotoğraf:** Ekran "15 fotoğraf" vaat ediyordu, sistem sınırı 8'di. Ekran artık 8 yazıyor.

### 3. Kalanlar — satışa açmadan önce (öncelik sırası ve gerekçe)

Bunlar kod düzeltmesi değil, karar ya da dış hizmet gerektiriyor; bu yüzden bu sürüme alınmadı.

| Sıra | İş | Neden bu sırada | Kim |
|---|---|---|---|
| 1 | **Özel e-posta gönderimi (SMTP: Resend ya da Brevo) + anahtarcrm.com doğrulaması** | Giriş e-postayla geliyor; Supabase'in yerleşik servisi çok az e-posta gönderir. Bağlantı gitmezse yeni ofis giremez. | Siz: hesap açma · Claude: ayar rehberi |
| 2 | **KVKK aydınlatma metni** | Kayıt formundaki onay kutusu "KVKK aydınlatma metnini okudum" diyor ama böyle bir sayfa yok; gizlilik sayfası kısa. Başka ofislerin müşteri telefonlarını işliyorsunuz (veri işleyen sıfatı, yurt dışı aktarım). | Avukat incelemesi · Claude: taslak |
| 3 | **Ücretsiz planda aktif kayıt sınırı** (öneri: 100) | Şu an Ücretsiz'de kayıt sınırı yok; Pro'ya geçiş nedeni zayıf. Sayı ticari karar. | Siz: sayıya karar · Claude: uygulama (küçük iş) |
| 4 | **Ofisin kendi hesabını / verisini silmesi** | KVKK gereği; dışa aktarma zaten var, silme yalnızca platform yöneticisinde. | Claude |
| 5 | **Ödeme (iyzico) ve plan yükseltme ekranı** | Deneme bitince Pro'ya geçiş yolu yok. | Siz: iyzico üyeliği · Claude |
| 6 | İlk giriş sihirbazı (3 adım) | Yeni ofis boş açılıyor; alışkanlık ilk gün kurulur. | Claude |

Düşük öncelikli, bilinen ve kabul edilen:
- Danışman, meslektaşının ÖZEL kaydını kimliğini bilirse silebilir / güncelleyebilir (aynı ofis içinde; kimlikler ona gösterilmiyor). Ekip büyüyünce kapatılmalı.
- Sunucu hatası (500) iç hata metnini gösteriyor — şu an sorun gidermeyi kolaylaştırıyor; dış ofis sayısı artınca genel mesaja çevrilmeli.
- Pro+ fotoğrafı 15'e çıkarmak depolama planına bağlı (Supabase ücretsiz 1 GB ≈ 350 portföy × 8 foto).

### 4. Değişen dosyalar
`src/lib/kiracilik.ts` · `src/lib/ai/saglayici.ts` · **yeni** `src/lib/services/plan.ts` · `src/lib/guvenlik/yetki.ts` · rotalar: `ai/dene`, `ai/json`, `ai/yorumla`, `ayarlar`, `entegrasyon/google/baglan`, `kayit/[id]/fotolar`, `lokasyon/ogrenme`, `lokasyon/alt-bolgeler` · arayüz: `demo/app.tsx`, `demo/form.tsx`, `demo/etiketler.ts` · **yeni** `public/_headers` · testler: **yeni** `tests/v346-db.test.ts` (10 test), `tests/v320.test.ts`, `tests/v321-db.test.ts`.

Veritabanı değişikliği **yok** (migration yok, "Kurulumu tamamla" gerekmez). Günlük yapay zekâ sayacı mevcut `ayar` tablosunda (`aiKullanim`).

### 5. Test
- `npm run test:db`: **586 test, 585 geçti, 0 hata**, 1 atlanmış (önceden de atlanıyordu).
- Tip denetimi temiz; canlı paket, Supabase fonksiyon paketi ve demo derleniyor.
- Arayüz gerçek tarayıcıda (Chromium, 390 px) denendi: boş liste düğmesi, boş form uyarısı, kategori etiketi.

### 6. Yayından sonra canlıda denenecekler
- [ ] Ayarlar › Yapay zekâ › Bağlantıyı dene → Gemini "tamam" dönmeli.
- [ ] Veri Girişi'ne bir ilan yapıştırıp yapay zekâ ile okutun → çalışmalı (sınırsız ofis).
- [ ] Ana Sayfa › "Ofisin talepleri (0)" → "Süzgeci temizle, tümünü göster".
- [ ] + Yeni talep › boş Kaydet → "Kayıt boş görünüyor".
