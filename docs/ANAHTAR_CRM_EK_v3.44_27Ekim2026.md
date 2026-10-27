# Anahtar CRM — Ek v3.44 · 27 Ekim 2026

**Konu:** İşlemler ekranı Polaris'teki "İş planı · işlemler" düzeninde yeniden kuruldu; işlem detayı Polaris'teki kadar ayrıntılı hâle getirildi (paylaşılan kişi, referans, taraflar, tür).

İstek: *"İşlem detayları Polaris'teki gibi ayrıntılı olsun… ilave olarak Satış / kiralama / diğer alanı ekleyelim… Polaris'teki İşlemler 2026 ekranını ve grafikleri birebir yapalım… işlemler ekranı Polaris'teki gibi renkli, düzenli ve kullanıcı dostu olacak şekilde yeniden tasarla."*

---

## 1. İşlem detayı — yeni alanlar

| Alan | Açıklama |
|---|---|
| **Tür** | Satış / Kiralama / Diğer. Başlık yazılırken kendiliğinden tahmin edilir ("…satış…" → Satış, "…kira…" → Kiralama); elle değiştirilince tahmin devreye girmez. |
| **Paylaşım yapılan kişi** | Rehberden seçilir ya da serbest yazılır. Rehberden seçilince telefon kendiliğinden dolar. |
| **Telefonu** | İşlem anındaki telefon kayıtta kalır; rehberdeki numara sonradan değişse bile işlem satırı bozulmaz. |
| **Referans (işi kim getirdi?)** | Rehberden ya da serbest ad. |
| **Taraflar (rehberden)** | Çoklu: Alıcı / kiracı · Satıcı / kiraya veren · Referans · Paylaşılan danışman · Diğer. Yalnızca rehberdeki kişiler bağlanır (rapor için kimlik gerekiyor). |

Tutar alanları ve P&L kuralı **değişmedi**: Fiyat, Bana Kalan, Paylaşımlı, Ofise aynı; "bana kalan" tahsilat ayına yazılır, tahsilat tarihi boşsa "bekleyen".

### Veritabanı
- `islem` tablosuna eklendi: `paylasilanKisiId`, `paylasilanAd`, `paylasilanTelefon`, `referansKisiId`, `referansAd`.
- Yeni tablo `islem_kisi` (islemId, kisiId, rol) — RLS açık, politika yok (v3.14 kuralı). İşlem silinince taraf bağları da silinir; **kişi silinirse işlem durur**, yalnızca bağ boşalır.
- Migration: `prisma/migrations/20261027100000_v344_islem_taraflar/` — yalnızca ekleme yapar, mevcut satırlara ve tutarlara dokunmaz.

---

## 2. İşlemler ekranı — Polaris düzeni

1. **Altı renkli özet kutusu:** Toplam "Bana Kalan" · Aylık ortalama (toplam ÷ geçen ay sayısı) · Yıl hedefine kalan · Satış · n işlem · Kiralama · n işlem · Reklamdan gelen. Tahsil edilmemiş tutar varsa kutuların altında ayrıca yazılır.
2. **Süzgeç çubuğu:** arama (işlem, kişi, not) + Hepsi / Satış / Kiralama / Diğer cipleri + ay seçimi.
3. **Tablo (geniş ekran):** Tarih · Ay · Tür · Liste · Bana Kalan · Fiyat · Paylaşımlı · Paylaşılan kişi (+ telefon) · Ofise · Referans · Taraflar · Açıklama · Reklam. Başlık satırı ve koyu **TOTAL** satırı yapışkan; satıra dokununca düzenleme formu açılır; kişi adları rehber kartına bağlıdır.
4. **Kart listesi (telefon):** aynı veriler tür rengiyle şeritlenmiş kartlar hâlinde; tablo gizlenir, sayfa yana kaymaz.
5. **Renkli etiketler:** açıklama notundan otomatik — Faturalı / Faturasız, Nakit / elden, Ofisle paylaşıldı / paylaşılmadı. Not metnine dokunulmaz; etiketler formda yazarken de görünür.
6. **Aylara göre gelir** çubuk grafiği — çubuğa dokununca o ay seçilir (liste, TOTAL ve halka grafiği birlikte düşer).
7. **Gelirin paylaşımı** halka grafiği — Bana kalan / Paylaşım (diğer danışman) / Ofise, tutar ve yüzdeyle. "Bütün yılı göster" ile yıla dönülür.
8. **Kimden iş geldi?** — referans ve taraflardan kişi bazlı iş sayısı ve bana kalan toplamı. Aynı kişi bir işlemde birkaç rolde geçse bile iş sayısı 1 artar.
9. **CSV indir** — ekranda süzülmüş liste, Excel'in açacağı biçimde (noktalı virgül + BOM).

Grafikler bağımlılıksız SVG; karanlık temada da doğru görünür, ek paket yüklenmez (ücretsiz plan kuralı).

---

## 3. Polaris'ten ayrılan tek nokta — bilerek

Polaris'te açıklamada **"fatura kesilmedi"** yazan satır yanlışlıkla **Faturalı** etiketi alıyordu (`fatura kesil` kalıbı olumsuz eki görmüyor). Anahtar'da düzeltildi: olumsuz ekler önce bakılır, bu satır **Faturasız** çıkar. Gerçek bir kayıtta (26.10.2026 · Depo 1350 m² Yenigöl) görünen etiket bu yüzden iki uygulamada farklı olacaktır; doğru olan Anahtar'daki.

---

## 4. Yıllık hedef artık ayar

`/api/ayarlar` → `yilHedefi` (varsayılan **2.500.000 TL**). "Yıl hedefine kalan" kutusu bunu kullanır. Polaris'teki `yilHedef` ile aynı işi görür.

---

## 5. Polaris'in okuduğu uç

`GET /api/polaris/anahtar/islemler?yil=2026` artık ek olarak gönderiyor:
- `pk` → paylaşılan kişi `{ a: ad, t: telefon }`
- `ref` → referans adı
- `tf` → taraflar `[{ i: kisiId, a: ad, rol }]`

Eski alan adları (id, dk, di, tarih, th, tur, baslik, bedel, pay, ofis, bk, aciklama, reklam) aynen duruyor — Polaris'in mevcut sütunları bozulmaz; "Paylaşılan kişi / Referans / Taraflar" sütunları ve "Kimden iş geldi?" tablosu artık Anahtar'daki veriyle dolar.

---

## 6. Dosyalar

| Dosya | Değişiklik |
|---|---|
| `prisma/schema.prisma` | `Islem` yeni alanlar, `IslemKisi` modeli, `Kisi` ters bağlar |
| `prisma/migrations/20261027100000_v344_islem_taraflar/migration.sql` | yeni |
| `src/lib/domain/islem.ts` | taraf rolleri, `notEtiketleri`, `yilOzeti`, `kimdenIsGeldi`, tür renkleri |
| `src/lib/domain/ayarlar.ts` | `yilHedefiNormalize`, `YIL_HEDEFI_VARSAYILAN` |
| `src/lib/services/islem.ts` | yeni alanlar + taraflar (tam kayıt güncelleme), kişi adlarını çözen çıktı |
| `src/lib/kiracilik.ts` | `islemKisi` ebeveyn modeli listesine eklendi |
| `src/app/api/ayarlar/route.ts` | `yilHedefi` oku / yaz |
| `src/app/api/polaris/anahtar/islemler/route.ts` | `pk`, `ref`, `tf` alanları |
| `demo/islemler.tsx` | ekran baştan yazıldı |
| `demo/sayfa.html` | İşlemler ekranı stilleri (özet kutuları, tablo, kartlar, grafikler) |
| `tests/v344.test.ts`, `tests/v344-db.test.ts` | yeni (11 + 4 sınama) |

**Durum:** 558 sınamanın tamamı geçiyor (`npm run test:db`), tip denetimi temiz.

---

## 7. Sınarken bakılacaklar

1. Ayarlar › İşlemler › **+ Yeni işlem**: Tür, Paylaşım yapılan kişi + Telefonu, Referans, Taraflar alanları görünmeli. Bir taraf ekleyip rolünü seçin, kaydedin.
2. Açıklamaya *"Elden nakit alındı, fatura kesilmedi"* yazın → **Faturasız** ve **Nakit / elden** etiketleri çıkmalı.
3. Altı özet kutusunun rakamlarını kontrol edin.
4. "Aylara göre gelir" grafiğinde bir çubuğa dokunun → liste, TOTAL satırı ve halka grafiği o aya düşmeli; "Bütün yılı göster" ile geri dönmeli.
5. Telefonda açın → tablo yerine renk şeritli kartlar, sayfa yana kaymamalı.
6. "Kimden iş geldi?" tablosunda eklediğiniz kişi görünmeli; adına dokununca rehber kartı açılmalı.

## 8. Yayına alırken

Migration çalıştırılmadan yeni alanlar yazılamaz:

```
npm run db:migrate      # 20261027100000_v344_islem_taraflar
npm run canli:istemci   # prisma generate (şema değişti)
npm run canli:yayinla
```
