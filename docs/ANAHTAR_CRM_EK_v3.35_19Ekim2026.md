# Anahtar CRM — Ek v3.35 · 19 Ekim 2026

**Konu:** Yetki belgesi alanları · randevu kaydı · işlem ve komisyon (Polaris'ten taşıma)
**Bağlam:** `docs/ANAHTAR_POLARIS_KARAR_v1.3_19Ekim2026.md` › 3. ve 4. adım (Anahtar tarafı). Özgür'ün 19 Ekim kararları: yetki ayrı tablo değil, portföyün içinde gizlenebilir basit alanlar; randevu ayrı kayıt; işlemler bağlantısı tamamlansın.

## A. Yetki belgesi (portföyün içinde)
- `kayit.yetkiBelgeNo`, `kayit.tasinmazNo` (≤60). Mevcut `yetkili`, `yetkiBitis` ile birlikte formda `<details>` "Yetki belgesi" bölümünde (yalnızca Kendi portföyüm havuzunda). Doluysa açık gelir.
- Detayda "Yetki" satırı: belgeli · bitiş · No · Taşınmaz.
- Ayrı yetki tablosu, geçmiş, münhasırlık **yok** (bilerek). 90 gün kala yenileme görevi hâlâ açık işler listesinde.

## B. Randevu
- Tablo `randevu`: tarih, tur (`GOSTERIM` | `GORUSME`), sonuc (`PLANLANDI` | `GERCEKLESTI` | `IPTAL` | `GELMEDI`), talepId, portfoyId, kisiId, not, sahipKullaniciId (sunucu yazar = açan kişi).
- Kimlikler düz metin (yabancı anahtar yok): kayıt silinse de randevu geçmişi kalır.
- Yetki: `kayit.oku` / `kayit.yaz` (asistan dahil). Silme yok; yanlışsa İptal.
- Uç: `GET /api/randevular?kayitId=` · `POST` · `PATCH ?id=`. Arayüz: kayıt detayında "Randevular" kartı (`demo/randevular.tsx`); karşı taraf seçimi o kaydın eşleşmelerinden.
- Eski GÖSTERİM notları randevuya çevrilmedi (sonuç bilgileri yok).

## C. İşlem ve komisyon
- Tablo `islem`: tarih, tahsilatTarihi (boş = bekleyen), tur (`SATIS` | `KIRALAMA` | `DIGER`, başlıktan tahmin), baslik, bedel, paylasilan, ofisPayi, banaKalan, aciklama, reklam, talepKaynagi, talepId, portfoyId, kisiId, disKaynak / disKimlik (`POLARIS` + Polaris satır kimliği; `(ofisId, disKaynak, disKimlik)` benzersiz).
- **P&L kuralı:** bana kalan **tahsilat ayına** yazılır (`src/lib/domain/islem.ts › aylikBanaKalan`). Tarihler gün ortasına (12:00 UTC) sabitlenir, saat dilimi ayı kaydırmaz.
- Yetki: yeni `islem.yonet` — yalnızca ofis yöneticisi. Asistan ve danışman işlem göremez.
- Uç: `GET/POST /api/islemler`, `PATCH/DELETE ?id=`. Arayüz: Ayarlar › İşlemler (`demo/islemler.tsx`): yıl seçimi, yıl toplamı, bu ay, bekleyen, aylara göre bana kalan, arama, ekle / düzelt / sil.

## D. Polaris'ten taşıma
- Kaynak: Polaris veritabanı `islemler` (2026, 30 satır) ve `arsiv/yillar` (2024: 35, 2025: 47 satır). Toplam 112 işlem.
- Dönüşüm: `polarisDonustur` (Karar belgesindeki alan eşlemesi). tahsilat = işlem tarihi; `reklam = "EVET"` → reklam = true, talepKaynagi = REKLAM. disKimlik: 2026 için Polaris belge kimliği (e02…), arşiv için `2024-1…`, `2025-1…` (satır sırası).
- Yöntem: yayın + "Kurulumu tamamla" sonrası Supabase üzerinden `INSERT … ON CONFLICT (ofisId, disKaynak, disKimlik) DO UPDATE` (tekrar çalıştırılabilir). Kişisel finans verisi depoya (git) konmadı.
- Doğrulama: yıl ve ay bazında bana kalan toplamları Polaris ile karşılaştırılır (beklenen: 2024 = 660.596 · 2025 = 1.504.490 · 2026 = 1.924.680; fark 0).

## E. Polaris (sonraki adım, ayrı yayın)
İşlemler sekmesi ve P&L satır 3, Supabase `execute_sql` ile `islem` tablosundan okuyacak (yalnızca okuma); Polaris'te işlem girişi kapanacak. Polaris'in kendi kopyası yedek kalır. **Taşıma gününden Polaris yayınına kadar Polaris'e yeni işlem girilmemeli** — yeni işlemi Anahtar › İşlemler'e girin.

## Testler
`tests/v335.test.ts` (8, veritabanısız) · `tests/v335-db.test.ts` (6, veritabanlı).
