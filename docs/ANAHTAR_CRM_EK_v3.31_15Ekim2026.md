# Anahtar CRM — Ek v3.31 · 15 Ekim 2026

## 1. WhatsApp sohbeti: .html ve .json ile veri girişi

**Ne değişti?** WhatsApp'ın kendi "Sohbeti dışa aktar" dosyalarına (.txt / .md / .zip) ek olarak, tarayıcı eklentilerinin ürettiği **.html** ve **.json** dışa aktarımları da okunuyor.

**Nereden yüklenir?**
- Veri girişi › Dosya yükle › WhatsApp sohbet dosyası › *Dosya seç (.txt / .md / .html / .json / .zip)*
- Gelen kutusu (ekrana bırakma, e-posta eki, .zip içi, Gmail/Drive köprüsü)

**Nasıl okunur?** (`src/lib/ingest/whatsapp.ts`)
- Biçim dosya adından değil **içerikten** tanınır: `<html…` + `<div class="message` → HTML; `{` / `[` ile başlayıp JSON olarak açılıyorsa → JSON; değilse eski satır satır okuma.
- **HTML** (ör. "EMLAKÇILAR GRUBU ANTALYA - Sohbet Dışa Aktarımı"): her `<div class="message received|sent" data-type="…">` bloğundan yazar, gövde, fotoğraf açıklaması (caption), zaman damgası (`gg.aa.yyyy ss:dd:ss`), konum bağlantısı alınır.
  - Grup adı `<title>` / `<h1>`'den ("- Sohbet Dışa Aktarımı" eki atılır).
  - Yazarı yazılmayan art arda mesaj → önceki yazar. `sent` → "Ben".
  - Alıntılanan (yanıtlanan) eski mesaj yanıtın metnine **karışmaz** (asıl mesaj zaten kendi bloğunda okunur).
  - Açıklamasız medya → `<Medya dahil edilmedi>`, silinen → `Bu mesaj silindi` (ön filtre bunları gürültü sayar). `call_log`, `notification_template`, boş `unknown` atlanır. Konumdaki base64 küçük resim alınmaz.
  - Başka biçimli bir HTML gelirse düz metne çevrilip .txt gibi okunur.
- **JSON**: kök dizi ya da `messages | mesajlar | chat.messages | data | items` dizisi. Alan adları esnek:
  gövde `body | text | message | content | metin` + `caption`; gönderen `author | sender | from | senderName | name` (nesne ise `.name`); zaman `timestamp | time | date | datetime | t | tarih` (saniye, milisaniye, ISO ya da `gg.aa.yyyy ss:dd`); `fromMe: true` → "Ben"; `905…@c.us` → `+905…`; Telegram tarzı parçalı metin birleştirilir. Grup adı `title | chatName | chat.name | groupName | subject | name`.
- Sonrası değişmedi: ön filtre (gürültü, eski mesaj, gruplar arası kopya, daha önce işlenmiş) → 10'arlı paketlerle yapay zekâ → onay.

**Gerçek dosyayla deneme (15 Ekim 2026, EMLAKÇILAR GRUBU ANTALYA, 846 mesaj):** 817 mesaj okundu (29 sistem / arama kaydı atlandı) · 420 medya · 20 silinen · 40 çok kısa · 35 emlak dışı · 71 tekrar · **231 aday**. Demo ekranında (gerçek tarayıcı) aynı dosya: kurallarla 246 kayıt çıktı — 64 hazır, 182 kontrol gerekli; yapay zekâ isteğe bağlı.

Gelen kutusunda .html / .json dosyası `tur = "txt"` olarak saklanır (veritabanı değişikliği yok).

## 2. Kişiler: birkaç harfle arama

`src/lib/arama.ts` (yeni) — Kişiler listesi ve kayıt formundaki kişi seçici aynı işlevi kullanır.

| Ne yazılır | Ne bulunur |
|---|---|
| `meh dep` | adı Mehmet olup notunda "depo" geçen kişi (her kelime ayrı aranır, sıra önemsiz) |
| `ozgur`, `kirdar`, `SIRKET` | Özgür, Kırdar, şirket (Türkçe harf / büyük-küçük farkı yok) |
| `0532 41`, `532 41`, `+90 532 41` | telefonunda 53241… geçen kişi (boşluk, tire, +90, baştaki 0 önemsiz; ikincil telefon dahil) |
| `2000` | telefonda yoksa notunda "2000 m²" geçen kişi |
| `sanayi` | "SANAYİ EMLAK" WhatsApp grubundan gelen kişi |
| `belek otel` | talep / portföy görüşme notunda "kiminle" olarak seçildiği ve notta Belek + otel geçen kişi |

Aranan alanlar: ad, şirket, telefonlar, e-posta, referans, kişi notu, WhatsApp grupları, rol adları, görüşme notları.
Eşleşme ad/şirkette değil de notta ise kartta 📝 ile notun ilgili cümlesinden kısa bir alıntı gösterilir.

Performans: kişi başına arama dizini bir kez üretilir (WeakMap), görüşme notları kayıtlar değişince bir kez toplanır; 7.800 kişide yazarken liste arkadan süzülür (useDeferredValue, v3.22.2'deki gibi).

## 3. Test
`tests/v331.test.ts` — HTML (başlık, yazar devri, alıntı, medya, silinen, konum, sent), JSON (esnek alanlar, zaman biçimleri, Telegram), dosya türü, gelen kutusu açma, arama işlevleri ve Kişiler ekranında gerçek çizimle arama.

Veritabanı değişikliği yok · göç yok.
