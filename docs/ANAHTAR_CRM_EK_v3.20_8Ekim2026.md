# Anahtar CRM — Ek: v3.20 Çok ofisli altyapı (8 Ekim 2026)

## Amaç
Uygulamayı başka emlak danışmanlarına ve ofislere açabilmek: her ofisin verisi ayrı, roller ve yetkiler belli, katılım davetle.

## Yapı
- **Ofis** (`ofis`): plan (UCRETSIZ / PRO), deneme bitişi, durum (AKTIF / ASKIDA), `sinirsiz` (Özyurtlar Gayrimenkul).
- **Kullanıcı** (`kullanici`): e-posta (Supabase girişi), ofis, rol, aktif.
- **Davet** (`davet`): yalnızca kodun SHA-256 özeti saklanır; 14 gün, tek kullanım, isteğe bağlı e-postaya kilit.
- Ofise ait tüm tablolarda `ofisId`. Benzersizlikler ofis içinde (telefon, parmak izi, ilan bağlantısı, Notion/Google kimlikleri, entegrasyon sağlayıcı). `ayar` ve `islenmis_mesaj` birincil anahtarı `(ofisId, …)`.
- Lokasyon başvuru tabloları (il, ilçe, mahalle, alt bölge, komşuluk, alias) tüm ofislerde ortaktır.

## Veri ayrımı nasıl zorlanır
- `src/lib/kiracilik.ts`: Prisma istemcisi sarılır; ofise ait modellerde her sorguya `ofisId` süzgeci, her oluşturmaya `ofisId` değeri eklenir. Bağlam yoksa sorgu **hata verir** (sessiz sızıntı yok).
- Görünürlük: danışman `gorunurluk = OFIS` olanları ve kendi kayıtlarını görür; ofis yöneticisi hepsini.
- Ham SQL bu süzgeçten geçmez; ofise ait tabloda ham SQL kullanılmaz (`tests/v320-db.test.ts`).
- Supabase RLS açık kalır (herkese açık anahtarla erişim yok).

## Giriş akışı (canlı)
1. Supabase e-posta bağlantısı / kodu → JWT (`src/canli/kimlik.ts`).
2. E-posta `kullanici` tablosunda aranır → ofis + rol (`src/canli/oturum.ts`). Yoksa 403 "davet isteyin".
3. İstek o ofisin bağlamında çalışır (`src/canli/worker.ts`).
- `IZINLI_EPOSTALAR` yalnızca acil durum anahtarı: listede olup tabloda olmayan e-posta, varsayılan ofiste platform yöneticisi açılır.
- Davet: `/?davet=KOD` → giriş ekranı "Davetle katılın" → `create_user: true` ile bağlantı → girişten sonra `POST /api/davet/kabul`.

## Roller ve yetkiler
Tek kaynak: `src/lib/guvenlik/yetki.ts`. Platform yöneticisi ⊃ Ofis yöneticisi ⊃ Danışman.

## API
| Uç | Yetki |
|---|---|
| `GET /api/oturum` | giriş |
| `GET/POST/DELETE /api/davet` | ofis.davet (başka ofis için platform.ofisler) |
| `POST /api/davet/kabul` | giriş (ofis gerekmez) |
| `GET/PATCH /api/kullanicilar` | ofis.kullanicilar |
| `GET/POST/PATCH /api/platform/ofisler` | platform.ofisler / platform.plan |

## Plan sınırları
`PLANLAR` (yetki.ts). v3.20'de tanımlı ve ekranda gösterilir; **zorlanması v3.22'de** (fotoğraf kilidi, günlük yapay zekâ kotası, kullanıcı sayısı — kullanıcı sayısı davet kabulünde şimdiden denetlenir).

## Canlıya alma kontrol listesi
1. Supabase'de yedek alın.
2. Migration `20261007100000_v320_cok_ofis` uygulanır (README › Veritabanı değişiklikleri).
3. Supabase › Authentication › Sign In / Providers: **Allow new users to sign up = açık** (davetli yeni kişiler için; asıl kapı `kullanici` tablosu).
4. `npm run canli:yayinla`, ardından kendi e-postanızla giriş → Yönetim ekranı görünmeli.
5. Başka ofis davet etmeden önce: yapay zekâ için ücretli API katmanı ve KVKK metinleri (kullanım şartları, aydınlatma).

## Sonraki sürümler
- v3.21: davetli ilk girişte ad-soyad / telefon, kayıtlarda "ofise aç / bana özel" düğmesi, bekleme listesi formu.
- v3.22: plan sınırlarının zorlanması, kullanım ölçümü ve platform panosu.
