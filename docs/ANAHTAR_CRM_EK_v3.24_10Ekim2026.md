# Anahtar CRM — Ek: v3.24 Gelen Kutusu Veri Girişi altında · Yapıştır incelemesine süzgeçler · Kaynak seçimi · Tek satır başlık · Eşleşmede iletişim · Fotoğraf 503 (10 Ekim 2026)

## İstenenler (Özgür, 10 Ekim)
1. Gelen Kutusu'nda tarih bazında gruplama kalksın (her gün için ayrı satır + "Hazırları ekle / Seç / Grubu atla" çok satır oluşturuyordu).
2. Gelen Kutusu ekranı Veri Girişi'nin altına taşınsın.
3. Veri Girişi'nde yapıştırıp Gönder ya da "Yapay zekâ yorumlasın" sonrası çıkan listede, WhatsApp sohbet dosyasındaki "3. Gözden geçir ve onayla" süzgeçleri olsun (Hepsi · Hazır · Kontrol gerekli · Şemaya uymayan · Eklenen / atlanan; Hepsi · Portföyler · Talepler; Satılık + kiralık · Satılık · Kiralık; Hazır olanların tümünü ekle · Tümünü seç · Seçilenleri ekle · Seçilenleri atla). Bu süzgeçlerde sıralama hazır olanlardan başlasın.
4. Tüm veri girişlerinde, yapay zekâ ayırsa da kaynak (Emlak grubu mu, sahibinden mi, portal mı, kendi portföyüm mü) görünsün ve elle seçilebilsin.
5. Üstteki düğmeler ve başlıklar tek satırda toplansın (← Geri ← Vazgeç başlık; ← Geri Talepler + Yeni talep; ← Geri Eşleşmeler 751 eşleşme ⋯).
6. Eşleşme kartına girince kişilerin adı, telefonu ve WhatsApp'a doğrudan erişim simgeleri; talep kartının altında orijinal metin kısaca.
7. Portföye resim yüklerken çoğu zaman 503 sunucu hatası.

## Yapılanlar
- **Gelen Kutusu → Veri Girişi sekmesi** (Yapıştır · Dosya yükle · Gelen kutusu · Elle gir). Menü öğesi kalktı; bekleyen sayısı Veri Girişi rozetinde ve sekmede. `{ ad: "gelen" }` ekranı (Ana Sayfa kartı, Düzenle'den dönüş) Veri Girişi › Gelen kutusu'nu açar. Döngüsel içe aktarma olmasın diye `ICE_AKTARMA_DEVIR` `demo/devir.ts`'e taşındı.
- **Düz liste:** tarih grupları ve "İlan tarihi / Geliş günü / Kaynak" gruplama seçimi kaldırıldı. Sıra: Hazır → Fiyatı değişti → Kontrol gerekli → Eksik; aynı durumda en yeni ilan üstte. 60'ar gösterim; toplu çubukta "Hazırların tümünü ekle (n)".
- **Yapıştır incelemesi** (`demo/ai-kutusu.tsx`, Ana Sayfa'daki kutu da aynı bileşen): yukarıdaki üç süzgeç satırı ve dört toplu düğme; hazırlar önce (sonra güven puanına göre). Satır başına "Atla / Geri al". Eklenen kayıtlar listeden silinmez, havuza girdiği için "Eklenen / atlanan"a geçer; kalanlarla devam edilir (eskiden "Seçilenleri kaydet" tüm listeyi kapatıyordu). Çoklu sonuçta seçim artık boş gelir (WhatsApp incelemesiyle aynı).
- **Kaynak** (`src/lib/domain/kaynak.ts`): veritabanında yeni alan YOK. Seçim üç mevcut alana yazılır ve onlardan okunur:

  | Seçim | havuz (portföy) | ilanSahibiTipi | veriKanali | Havuz katmanı |
  |---|---|---|---|---|
  | Emlak grubu | PARTNER | EMLAKCI (firma / müteahhit portföyde korunur) | portal ya da Manuel ise WHATSAPP | Partner |
  | Sahibinden | DIS_ILAN | MALIK | portal değilse SAHIBINDEN | Web ilanı |
  | Portal | DIS_ILAN | PORTAL (portalda emlakçı / firma korunur) | değişmez | Web ilanı |
  | Kendi portföyüm | KENDI_PORTFOY | portal / emlakçı ise MALIK (talepte BILINMIYOR) | portal ise MANUEL (ilan no / bağlantı kalır) | CRM / Yetkili |

  Seçici: tek kayıt kartında ve formda dört düğme; çoklu listede, WhatsApp içe aktarma ve Gelen Kutusu kartlarında açılır menü; çoklu listede "Hepsi: …".
- **Üst satır:** genel "← Geri" düğmesi akışta kalır ama kendi yüksekliği kadar negatif boşlukla ekranın ilk satırına biner; o satır soldan düğme genişliği kadar içeri alınır (CSS, `--geri-g` / `--geri-y`). Her ekranda çalışır, ekran kodu değişmedi. Formda genel Geri gösterilmez; "← Vazgeç" + başlık tek satır (`.bas-satir`).
- **Eşleşme detayı** (`Taraf`): kart artık tek `<button>` değil (içine bağlantı konamıyordu). Üst kısım kayda gider; altında kişiler (ad · rol · telefon) + Ara / WhatsApp (mesaj kayda göre hazır); talep kartında orijinal metin 3 satır, "Tamamını göster".
- **Fotoğraf 503:** neden — 1,5 MB'lık multipart gövde Worker'da çözülüp Supabase'e aktarılıyor, aynı istekte JWT + 4 veritabanı işlemi + imzalı bağlantı; ücretsiz planın 10 ms işlemci sınırı aşılınca Cloudflare 503 döndürür (v3.22.2'de /api/durum için görülen "Exceeded CPU Time Limits" ile aynı sınıf). Çözüm — **doğrudan yükleme:** istemci önce JSON künye gönderir (`POST /api/kayit/:id/fotolar`, content-type JSON); sunucu tek `INSERT` + Supabase `object/upload/sign` ile tek kullanımlık bağlantı döner; tarayıcı dosyayı `PUT` ile Supabase'e kendisi yollar. Olmazsa yarım künye silinir ve eski yol (multipart) kullanılır; 502/503 bir kez yinelenir.
- Gmail köprüsü yamaları (v3.23 sonrası, aynı gün canlıya alındı): arşivleme, Drive klasörü, posta başına izleme.

## Doğrulama
- `tests/v324.test.ts` (8): kaynak 2 tür × 5 başlangıç × 4 seçim gidiş-dönüş + şema + havuz katmanı; yapıştır incelemesi (süzgeçler, hazırlar önce, Kiralık süzgeci, "Hepsi: Kendi portföyüm", hazırları ekle → kalanlar listede); Veri Girişi dört sekme; eşleşme detayı (tel: / WhatsApp bağlantıları, orijinal metin kısalt / aç); üst satır CSS; fotoğraf doğrudan yükleme; köprü; sürüm.
- `tests/v323.test.ts` ekran testi düz listeye göre güncellendi; `tests/v310-db.test.ts` + yeni doğrudan yükleme DB testi.
- Ekran görüntüleriyle telefon (390 px) ve masaüstü kontrolü.

## Doğrulanamayan
- Supabase'in `object/upload/sign` + tarayıcıdan `PUT` akışı gerçek projede denenmedi (CORS / anahtar). Olmazsa arayüz sessizce eski yola düşer; canlıda 3–4 fotoğrafla denenmeli.
