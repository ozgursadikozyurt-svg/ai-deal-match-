# Anahtar CRM — Ek (v3.26 · 12 Ekim 2026)

**Veritabanı değişikliği VAR**: `20261012100000_v326_kayit_aciklama` (kayit.aciklama). Canlıda bir kez "Kurulumu tamamla".

## 1) ★ Benim kayıtlar süresiz
- Veritabanında geçerlilik sütunu zorunlu olduğu için "süresiz" = 31.12.2099 işareti (`SURESIZ_TARIH`, `suresizMi` — `src/lib/domain/gecerlilik.ts`). Göç gerekmez; sunucunun gece pasife alma işi bu tarihe ulaşmaz.
- Uygulama açılışta ve her kayıt değişiminde `benimSuresiz` (demo/depo.ts) çalışır: Benim olup işaretsiz kayda işaret koyar, süresi dolmuşsa ACTIVE yapar. Pasif / arşiv kayıtlara dokunmaz. Sonradan Benim'e dönen (telefon tanıtılınca) ya da içe aktarılan kayıtlar da yakalanır.
- `kalanGun` süresizde null → süre rozeti, süre listeleri ve +30 görünmez; `sureUzat` süresizi değiştirmez. Detay ve formda "Süresiz".

## 2) Süresi yaklaşanlar
- Ana Sayfa: uzun liste yerine `SureOzeti` tek satır (14 gün içi; dolan ve 5 günden az sayıları). İstatistik kutusu "14 gün içinde süresi dolacak" da bu ekrana gider.
- Ekran `{ ad: "suresi" }` (`demo/sure.tsx`): 5 / 14 / 30 gün, talep / portföy süzgeci; en üstte "Tümüne +30 gün" (seçim varsa yalnızca seçilenlere); her kartta +30.
- Kartta +30: `UZAT_ESIK_GUN = 5` gün ve altı (dolmuş dahil). Detay ve formda yalnızca +30 (ve tarih seç); Bugün panosundaki talep süresi görevinde de yalnızca +30.

## 3) Gelen kutusu gün süzgeci
Son 7 · 15 · 30 gün · Tümü. Tarih: ilan / mesaj tarihi, yoksa dosyanın geliş tarihi. Süzgeç tarayıcıda hatırlanır.

## 4) Paylaşım
"Paylaş" → kartların solunda + / ✓ düğmesi (`KayitKart sec` özelliği), seçilenler vurgulu. Seçim boş başlar; "Tümünü seç" kaldı. WhatsApp düğmesi seçim yokken pasif. Metin "Metni gör" altında.

## 5) Açıklama
`Kayit.aciklama` (en çok 2.000 harf). Form: Başlık'ın altında. Kart: iki satır, dokununca açılır (`Aciklama`). Detay: tamamı. Göç uygulanmadan önce açıklama yazılan kayıt kaydedilemez (diğerleri etkilenmez) — bu yüzden "Kurulumu tamamla" önce.

## 6) Kartta kişi tekrarı
Kaynak etiketi (`kimOf`) adı, alt satırdaki kişi adlarından çıkarılır (harf/rakam dışı karakterler yok sayılarak karşılaştırılır; "Ad (Şirket)" biçimi de yakalanır).

## 7) Görevler ekranı
Menünün en sonunda (`{ ad: "gorevler" }`, `demo/gorevler.tsx`). Geciken / Bugün / Bu hafta açık, Sonra ve Tamamlananlar (son 60 gün) kapalı; tür süzgeci; + Görev. Satırlar panodakiyle aynı (`GorevSatiri`).

## 8) Açık kayıt (Pro altyapısı)
- `POST /api/kayit-ol` → `kendiOfisiniAc` (`src/lib/services/ofis.ts`): yeni ofis (plan Ücretsiz, 14 gün deneme → Pro sayılır), kullanıcı ofis yöneticisi. Aynı e-posta ikinci kez açamaz (409). E-posta istekten değil, doğrulanmış oturum anahtarından gelir (davet kabulüyle aynı kapı).
- Worker: `ACIK_KAYIT=1` değilse 403. `/api/yapilandirma` `acikKayit` döner; giriş ekranı buna göre yeni hesap açmaya izin verir (`create_user`), hesabı olmayan e-posta "Ofisinizi açın" formuna düşer.
- Varsayılan KAPALI. Açmadan önce sprint planındaki SMTP ve KVKK maddeleri.

## 9) Testler
`tests/v326.test.ts` (arayüz + kurallar), `tests/v326-db.test.ts` (açıklama sütunu, açık kayıt ve ofis ayrımı).
