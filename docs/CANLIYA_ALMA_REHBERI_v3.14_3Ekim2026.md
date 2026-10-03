# Anahtar CRM — Canlıya Alma Rehberi
**Sürüm:** 3.14 · 3 Ekim 2026 · v3.8.2 rehberinin yerini alır (Vercel/R2 anlatımı kalktı; Cloudflare Worker + Supabase Storage)
**Adlandırma:** uygulama **anahtarcrm** (Cloudflare Worker adı, GitHub depo adı, paket adı)

> Bu rehber yalnızca **sizin** yapacağınız adımları anlatır. Veritabanı kurulumu, güvenlik kilidi, konum verisi ve fotoğraf/yedek kovaları **Claude tarafından Supabase'e zaten yapıldı** (bkz. Bölüm 0). Toplam süre ≈ 40–60 dk. Şifre ve anahtarları **sohbete yazmayın**; yalnızca ilgili kutuya yapıştırın.

---

## 0. Hazır olanlar (yapmanız gerekmez)

| Ne | Durum |
|---|---|
| Supabase proje `ANAKEY.AI` (Frankfurt) | Hazır. Adını isterseniz `anahtarcrm` yapın: Project Settings › General › Project name (adres ve anahtarlar değişmez) |
| 25 tablo + 46 enum (9 migration) | Kuruldu |
| Satır düzeyi güvenlik (RLS) | **Tüm tablolarda açık, politika yok**: herkese açık anahtarla veriye erişilemez |
| Konum verisi | 81 il, Antalya'nın 19 ilçesi, 917 mahalle (arayüzle kimlikleri birebir), 8 alt bölge, komşuluk, alias |
| Storage kovaları | `portfoy` (fotoğraflar, 2 MB sınırlı) ve `yedekler` (haftalık yedek): ikisi de **özel** |
| Kod | `anahtarcrm_v3.14_3Ekim2026.zip` |

---

## 1. Supabase'de 3 küçük ayar (≈ 10 dk)

**1.1 Kendi kullanıcınızı oluşturun.** supabase.com › projeniz › **Authentication › Users › Add user › Create new user**. E-posta: kendi adresiniz. Şifre: rastgele bir şey (kullanılmayacak). **Auto Confirm User** işaretli olsun.

**1.2 Yeni kayıtları kapatın.** Authentication › **Sign In / Providers** (ya da *Settings*) › **Allow new users to sign up** = **kapalı**. (Uygulama zaten yalnızca var olan kullanıcıya bağlantı gönderir; bu ikinci kilit.)

**1.3 Gerekli değerleri bir yere not edin** (şifre yöneticinize):

| Değer | Nereden |
|---|---|
| `SUPABASE_URL` | `https://nhizjkeefbxafvncszow.supabase.co` |
| `SUPABASE_ANON_KEY` | `sb_publishable_2-Su2bpcinoqgkuCdmEPqQ_7D9P-Z3d` (herkese açık anahtar; gizli değildir) |
| `DATABASE_URL` | Projenizde üstteki **Connect** düğmesi › **Session pooler** › URI. `[YOUR-PASSWORD]` yerine proje oluştururken şifre yöneticisine kaydettiğiniz **veritabanı şifresini** yazın |
| `SUPABASE_SERVICE_ROLE_KEY` | Project Settings › **API Keys** › *secret* / *service_role* anahtarı (**gizli**; yalnızca Cloudflare'e) |

> **Neden “Session pooler”?** Tek kullanıcılı bu kullanım için en uyumlusu: IPv4 ile çalışır, tek bağlantı adresi yeter (`DIRECT_URL` gerekmez), Cloudflare'in her istekte yeni bağlantı açmasıyla uyumlu.

---

## 2. Kodu GitHub'a yükleyin (≈ 10 dk)

1. github.com › **New repository** › ad: `anahtarcrm` › **Private** › oluşturun.
2. **GitHub Desktop** › *File › Clone repository* › `anahtarcrm` depoyu bilgisayarınıza çekin (klasör oluşur).
3. `anahtarcrm_v3.14_3Ekim2026.zip` dosyasını açın; **içindekileri** (klasörün kendisini değil) o depo klasörüne kopyalayın.
4. GitHub Desktop'ta alttaki kutuya `v3.14 canlı sürüm` yazın › **Commit to main** › **Push origin**.

---

## 3. Cloudflare'de yayına alın (≈ 15 dk)

1. dash.cloudflare.com › **Workers & Pages › Create › Import a repository** (Git bağlantısı) › GitHub hesabınızı bağlayıp `anahtarcrm` deposunu seçin.
2. Ayarlar:
   - **Project / Worker name:** `anahtarcrm` *(Worker adı sonradan değişmez; adı tam böyle girin)*
   - **Build command:** `npm ci --ignore-scripts && npm run canli:build`
   - **Deploy command:** `npx wrangler deploy`
   - Node sürümü sorulursa 22.
3. **Save and Deploy.** İlk yayın, değerler girilmediği için “uygulama açılamadı” gösterebilir; normaldir.
4. Worker'ınız › **Settings › Variables and Secrets** (*Build variables değil, çalışma zamanı değişkenleri*) › şunları ekleyin. **Secret** yazanlar “Secret” türünde olsun:

| Ad | Tür | Değer |
|---|---|---|
| `SUPABASE_URL` | Text | Bölüm 1.3 |
| `SUPABASE_ANON_KEY` | Text | Bölüm 1.3 |
| `DATABASE_URL` | **Secret** | Session pooler adresi (Bölüm 1.3) |
| `SUPABASE_SERVICE_ROLE_KEY` | **Secret** | Bölüm 1.3 |
| `IZINLI_EPOSTALAR` | Text | Giriş yapabilecek e-postalar, virgülle: `siz@eposta.com` |
| `AI_API_KEY` | **Secret** | Google AI Studio anahtarınız (yapay zekâ için; sonradan da eklenebilir) |

5. **Deploy** (değişkenler yeni sürümle devreye girer). Adresiniz: `https://anahtarcrm.<hesap-adınız>.workers.dev` (Worker sayfasında yazar).

---

## 4. Giriş adresini Supabase'e tanıtın (≈ 3 dk)

Supabase › Authentication › **URL Configuration**:
- **Site URL:** Cloudflare adresiniz (`https://anahtarcrm.….workers.dev`)
- **Redirect URLs:** aynı adres (sonuna `/**` ekleyin)

> Giriş e-postasındaki bağlantı bu adrese döner. Adres yanlışsa bağlantı açılmaz.

---

## 5. İlk giriş ve test

1. Adresi telefonda veya bilgisayarda açın › e-postanızı yazın › **Giriş bağlantısı gönder**.
2. E-postadaki bağlantıya, **aynı cihazda** dokunun. Uygulama açılır (sağ üstte **Kaydedildi ✓**).
3. **Ayarlar › Hesap ve veri:** hesabınız ve “yapay zekâ anahtarı: tanımlı” görünmeli.
4. **Demo yedeğini taşıyın:** demoda *Ayarlar › Tam yedek (JSON)* indirin › canlıda *Ayarlar › Hesap ve veri › dosyayı seçin › Yükle*. Aynı dosyayı tekrar yüklemek zarar vermez; aynı telefonlu kişiler mevcut kişiyle eşlenir.
5. Yeni bir portföy ekleyin › “Kaydedildi ✓” bekleyin › sayfayı yenileyin: kayıt durmalı. Bir fotoğraf ekleyin, *Portföy paylaş* ile föyü deneyin.
6. *Ayarlar › Yapay zekâ › Bağlantıyı dene.*
7. Telefonda: Paylaş › **Ana ekrana ekle** (Anahtar CRM simgesi).

---

## 6. Sorun giderme

| Ekranda / belirti | Anlamı ve çözüm |
|---|---|
| “email rate limit exceeded” | Supabase'in yerleşik e-postası saatte birkaç ileti gönderir. Bir saat bekleyin; kalıcı çözüm için Supabase › Auth › SMTP'ye ücretsiz bir e-posta servisi bağlanır |
| Bağlantıya dokununca “link is invalid or has expired” | Bağlantı tek kullanımlık ve kısa ömürlü: yeniden isteyin. **Aynı cihazda** açın; Bölüm 4'teki adres doğru mu bakın |
| “Bu e-postanın erişim izni yok” | `IZINLI_EPOSTALAR` listesinde e-posta yok ya da yazım farkı var |
| “Oturum anahtarı eski türde (HS256) … SUPABASE_JWT_SECRET” | Cloudflare'e `SUPABASE_JWT_SECRET` ekleyin (Supabase › Project Settings › JWT Keys › *Legacy JWT secret*) |
| “Uygulama açılamadı: SUPABASE_URL / SUPABASE_ANON_KEY …” | Bölüm 3.4 değişkenleri eksik; ekleyip yeniden Deploy edin |
| Açılışta “Sunucu 500 / Connection / password authentication failed” | `DATABASE_URL` yanlış (şifre, “Session pooler” seçili mi?). **Yeniden dene** düğmesi hatanın metnini gösterir |
| Cloudflare'de **Error 1102 / “exceeded resource limits”** | Ücretsiz planın istek başına işlemci süresi (10 ms) aşıldı. Çözüm: **Workers Paid (5 $/ay)** — başka değişiklik gerekmez. Büyük listelerde ve ilk istekte ilk belirti budur |
| Sağ üstte kırmızı “N kayıt kaydedilemedi” | Dokunun: sunucunun neden kabul etmediği yazar (ör. telefon başka kişide). Düzeltince kendiliğinden yeniden dener |
| Fotoğraf “depo kapalı” | `SUPABASE_SERVICE_ROLE_KEY` eksik ya da yanlış |

---

## 7. Sonraki güncellemeler (kolay yol)

1. Claude yeni dosyaları `…_v3.15_….zip` olarak verir (veritabanı değişikliği varsa **önce Claude onu Supabase'e uygular**).
2. Dosyaları depo klasörünün üstüne kopyalayın › GitHub Desktop › **Commit › Push**.
3. Cloudflare 1–2 dakikada kendi kendine yayınlar. Sorun çıkarsa Worker › *Deployments* › önceki sürümün yanında **Rollback**.

> Claude doğrudan yayına gönderemez (Cloudflare bağlantısı kod yükleyemiyor, GitHub bağlantısı yok); push işlemi sizde kalır.

---

## 8. Yedek, veri sahipliği, KVKK

- **Otomatik:** her pazar tam yedek, Supabase Storage › `yedekler` kovasına (son 12 saklanır). Her gün Supabase'e küçük bir sorgu gider (7 gün işlem yoksa ücretsiz proje durdurulur; bunu önler).
- **Elle:** *Ayarlar › Verilerimi dışa aktar* (CSV'ler + Tam yedek JSON). Ayda bir Google Drive'a kaydetme alışkanlığı önerilir.
- **KVKK:** Supabase (Frankfurt) ve Cloudflare yurt dışıdır. Test döneminde **gerçek müşteri/mülk sahibi verisi girmeyin**; gerçek kullanıma geçmeden bir KVKK danışmanına yurt dışı aktarım koşullarını teyit ettirin (veriyi Türkiye'de tutmak gerekirse standart PostgreSQL olduğu için taşınır).

## 9. Maliyet

| Dönem | Tutar |
|---|---|
| Test dönemi | 0 $ (Cloudflare Free + Supabase Free) |
| Bölüm 6'daki 1102 hatası görülürse | Workers Paid 5 $/ay |
| Fotoğraf yoğunlaşırsa (Free: 1 GB ≈ 350 portföy) | Supabase Pro 25 $/ay — yalnızca gerçekten gerekince |
