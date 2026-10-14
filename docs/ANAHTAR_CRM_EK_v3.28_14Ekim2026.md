# Anahtar CRM — EK v3.28 · 14 Ekim 2026

**Konu:** Eşleştirme motorunun kullanıcı geri bildirimiyle baştan denetlenmesi ve yeniden ayarlanması; "Kaydedilemedi: Connection terminated unexpectedly" kaydetme hatası.

## 1. Yöntem

Canlı veritabanından 544 kayıt (68 aktif talep, 420 aktif portföy) ve **62 etiketli eşleşme** alındı:

| Grup | Adet | Anlamı |
|---|---|---|
| Sunuldu (Bildirildi / Gösterim / Bekliyor) | 11 | Doğru öneri |
| Koparıldı · Yanlış eşleşme | 30 | Algoritma hatası |
| Koparıldı · Fiyat | 4 | Algoritma hatası (kısmen) |
| Koparıldı · Beğenmedi | 8 | Müşteri öznel |
| Koparıldı · Sahip istemedi / Başkasıyla anlaştı | 9 | Algoritma dışı (ölçüme alınmadı) |

Her değişiklik aynı veriyle önce/sonra ölçüldü (`scratchpad/v328`: `olc.ts`, `rapor.py`, `deney.ts`).

## 2. Bulgular

1. **Konum baskın:** sunulan 11 eşleşmenin 10'u aynı mahallede. "Yanlış"ların çoğu yakın mahalle (500 m–1,4 km) ya da başka ilçe: Güzeloba → Altıntaş (Aksu), Meltem → Kepez Dokuma, "Konyaaltı" → Muratpaşa Yıldız, Fener → Güzeloba / Güzelbağ.
2. **Oda:** 2+1 talebe 1+1 ve 3+1 "yanlış"; ekran görüntüsünde 3+1 talebe 5+1.
3. **Aynı kişi:** bir emlakçının kendi talebi kendi ilanıyla eşleşiyordu (63 çift; biri 92 puanla 1. sırada).
4. **Birim fiyat:** "1000 m² depo · 1.200 TL/ay" (oda başı eşya deposu) 3 depo talebine öneriliyordu.
5. **Kapalı alan çelişkisi:** 900 m² depo "Alan (±%10) uygun" ama "Kapalı alan ≥ 1000 uymuyor" (aynı bilgi iki kez, iki ayrı tolerans).
6. **Puan / etiket tutarsızlığı:** 42 eşleşme 85'in altında "Sunulabilir", 18 eşleşme 85'in üstünde "Koşullu".
7. **Konutta Alan %40:** talep m² vermemişse alan bileşeni kırmızı %40 görünüyordu.
8. **Ayrıştırma:** bütçe aralığının alt sınırı hiç okunmuyordu (8 talep); "15 mil" okunmuyordu; "Antalya OSB" alt bölgesi boştu.

## 3. Değişiklikler

| Konu | Kural |
|---|---|
| Sunulabilir | Yalnızca istenen mahalle / alt bölge / ilçe (`TAM_KONUM`); komşu, yakın, konumu bilinmeyen → Koşullu |
| Konum oranları | komşu 0,75 · başka ilçede komşu 0,6 · ≤ 1,5 km 0,45 · ≤ 3 km 0,30 · ilçe geneli (ilçe + mahalle sayan talep) 0,85 |
| İlçe sınırı | Başka ilçede komşu olmayan mahalle → bölge dışı (esnekse uzak); yalnız ilçe isteyen talebe başka ilçeden yalnızca sınır komşusu (0,5) |
| Konum tavanı | komşu ≤ 80 (ilçe dışı ≤ 72) · yakın ≤ 70 · ilçe verisiz ≤ 75 · orta ≤ 60 · uzak ≤ 50 · esnek bölge dışı ≤ 45 |
| Koşullu tavanı | ≤ 84 (85+ ⇔ Sunulabilir); istenen özellik bilinmiyorsa ≤ 84, bilinen "yok" ≤ 80 |
| Oda | Konutta varsayılan öldürücü: eksik ve 2+ fazla elenir; 1 fazla 0,5 (Koşullu) |
| Aynı kişi | Kişi bağı ya da telefon (son 10 hane) ortaksa `temelUyum` = false, engel "Aynı kişinin kendi talebi ve portföyü" |
| Birim kira | Kirada m² başına < 10 TL → fiyat "bilinmiyor" + "toplam kirayı sorun" |
| Kapalı alan | Talebin alt m²'siyle aynıysa (±%5) ve portföyde ayrı değer yoksa satır yok; alan türü "en az" karşılaştırmaları alan toleransıyla |
| Konut alan | Talep m² vermemiş, oda vermişse Alan "istenmedi" |
| Bütçe aralığı | `butceAltSiniri`: "6.500-7 milyon", "6 ila 7.500.000", "40-45 bin", "8.000.000–9.000.000"; "mil" = milyon |
| Veri | 7 talebin alt bütçesi metinden dolduruldu; Antalya OSB → OSB 1–3. Kısım |

Model deneyi (`scripts/deney/model-karsilastir.ts`) etiketleri gerçek kararlarla güncellendi: seçilen model 40/40 sınıf, 31/31 sıra.

## 4. Ölçüm (etiketli 62 eşleşme)

| | v3.27 | v3.28 |
|---|---|---|
| "Yanlış/fiyat"tan Sunulabilir görünen | 18 | 6 |
| "Yanlış/fiyat"tan elenen | 5 | 13 |
| "Yanlış/fiyat" ortalama puan | 75 | 64 |
| Sunulanların listede ortalama sırası | 2,1 | 1,3 |
| Sunulanlardan elenen | 0 | 0 |
| Aynı talepte sunulan > yanlış/beğenilmeyen | 10/15 | 12,5/15 |
| Önerilen eşleşme (tüm aktif) | 1.544 | 991 |
| 85+ ⇔ Sunulabilir tutarsızlığı | 60 | 0 |

Kalan 6 "yanlış ama Sunulabilir": 4'ü "TAPUDA 4 MİLYON GÖSTERİLECEK" talebi (metindeki özel şart), 1'i aynı ilanın ikinci kaydı (arayüzde "+1 aynı ilan" ile katlanır), 1'i örnek veri.

## 5. Kaydetme hatası

Supabase günlüğü: 14 Eki 09:00 UTC'den itibaren "Client socket closed while state was busy" — bağlantıyı Cloudflare tarafı (Worker) kesiyor; 07–08 UTC'de 87 bağlantıda 0, 09–10 UTC'de 28 bağlantıda 7 kopma. Aynı anda ~10 kayıtlık içe aktarma: kayıt başına ~0,4 sn, tek istekte 100 kayda kadar (30–40 sn); 2 kayıt Antalya dışı ilçeyle yabancı anahtar hatası verdi.

- Arayüz: kayıtlar 10'arlı, kişiler 100'erli parça (`KAYIT_PARCA`, `KISI_PARCA`); bağlantı hatasında "Bağlantı koptu — yeniden deneniyor", 3 sn.
- Sunucu: `geciciyseTekrarla` — kayıt işlemi geçici bağlantı hatasında bir kez yeniden denenir; `konumKimlikleri` — veritabanında olmayan ilçe / mahalle / alt bölge anlaşılır mesajla reddedilir.
- Test ortamı: PGlite `maxConnections: 20` (varsayılan 1 idi; 44 veritabanı testi aynı mesajla düşüyordu).

**Öneri (yapılmadı):** Cloudflare **Hyperdrive** — Worker ↔ Supabase bağlantı havuzu; kayıt başına gecikmeyi ve kopma riskini belirgin düşürür. Panelden yapılandırma + `wrangler.jsonc` bağlaması gerekir.

## 6. Açık konular

- **Barınaklar Bulvarı** alt bölgesinin mahalleleri boş ("kullanıcı tamamlayacak"); Fener / Çağlayan / Barınaklar talepleri bu yüzden "konum belirsiz" kalıyor.
- **"Asansör şart"** gibi şartlar kritik işaretlenemiyor: `TeknikAlan` enum'unda ASANSOR / HAVUZ yok (şema değişikliği gerekir).
- Talep metnindeki özel şartlar (tapu değeri, "denize yürüme mesafesi", "katta") yapılandırılmış alana düşmüyor.

## 7. Testler

`tests/v328.test.ts` (12 test). Güncellenen: `v311` (konum kademeleri, oda, İzmir, model deneyi), `v327` (sürüm, kapalı alan). Tam takım: **395 test, 394 geçti, 0 başarısız, 1 atlandı.**
