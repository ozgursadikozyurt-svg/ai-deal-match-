# Anahtar CRM — EK v3.29 · 14 Ekim 2026

**Konu:** v3.28 sonrası geri bildirim. Fazla oda kuralı, "asansör / havuz şart", Barınaklar Bulvarı, Hyperdrive, Vercel hata e-postaları.

## 1. Kararlar (Özgür, 14 Eki 2026)

| Konu | Karar |
|---|---|
| Fazla oda | "3+1 talebe 5+1 gösterebiliriz; aynı bütçedeyse fazla odanın kimseye zararı yok." |
| Asansör şartı | "Asansör şart" gibi şartlar olmazsa olmaz işaretlenebilsin (şema değişikliği yapılsın). |
| Barınaklar Bulvarı | Hem Çağlayan'ı hem Güzeloba'yı kapsıyor. |
| Hyperdrive | Kurulsun. |

## 2. Değişiklikler

| Konu | Kural / iş |
|---|---|
| Oda | Fazla oda `SAGLANDI`: +1 oda 0,9, +2 ve üstü 0,8 puan. Tam oda önde kalır. Fiyat bütçe içinde değilse ya da bilinmiyorsa (talepte bütçe yoksa da) Koşullu ve "N oda fazla — bütçe içinde olduğu doğrulanamadı" notu. Eksik oda konutta hâlâ öldürücü. |
| Asansör / havuz | `TeknikAlan` enum'una `ASANSOR`, `HAVUZ` eklendi (göç `20261014100000_v329_asansor_havuz`, canlıda uygulandı). Meta: `asansor → ASANSOR`, `havuz → HAVUZ`. "Şart" işaretlenip alan boş bırakılmışsa "istiyor" sayılır. Hızlı ayrıştırıcı "asansör şart / olmazsa olmaz / olmalı / zorunlu", "mutlaka / kesinlikle asansörlü" kalıplarını şart sayar; yalnızca "asansörlü" şart değildir. Yapay zekâ talimatı ve formdaki şart düğmeleri güncellendi. |
| Barınaklar Bulvarı | Alt bölge 7 → Çağlayan (837) + Güzeloba (840); doğrulandı. Antalya OSB de doğrulandı. Canlı veri + tohum dosyası. |
| Cadde / bulvar (TICARI_AKS) | Aks bir şerittir. Portföy aksı kendi konumunda ya da ilan metninde anıyorsa `ALT_BOLGE` (tam uyum). Yalnızca geçtiği mahalledeyse `AKS_MAHALLE`: oran 0,75, Koşullu, en fazla 80, "aksa yakınlığını sorun". Semt alt bölgeleri (Lara, Altınova…) değişmedi. |
| Veritabanı yolu | `src/canli/veritabani.ts`: `HYPERDRIVE` bağlıysa o kullanılır, Hyperdrive hatasında 10 dakika `DATABASE_URL`. Ayrı rol `hyperdrive_app`. Ayrıntı: `HYPERDRIVE_KURULUMU_v3.29_14Ekim2026.md`. Worker'ı veritabanının yanına koyan `placement.region: aws:eu-central-1` denendi; Cloudflare derlemesi bu ayarla düştü (ücretsiz planda desteklenmiyor olmalı), kaldırıldı. |
| Vercel | Uygulama v3.14'ten (3 Eki) beri Cloudflare'de. Depoya bağlı 5 eski Vercel projesi her gönderimde derlemeye çalışıp başarısız oluyor ve e-posta atıyordu (en az 5 Eki'den beri her işlemede). `vercel.json` → `git.deploymentEnabled: false`. |

## 3. Ölçüm (etiketli 62 eşleşme, v3.28 → v3.29)

| | v3.28 | v3.29 |
|---|---|---|
| "Yanlış / fiyat"tan Sunulabilir görünen | 6 | 7 |
| "Yanlış / fiyat"tan elenen | 13 | 13 |
| Sunulanların listede ortalama sırası | 1,3 | 1,3 |
| Sunulanlardan elenen | 0 | 0 |
| Önerilen eşleşme (tüm aktif) | 991 | 1.008 |
| Sunulabilir (tüm aktif) | 21 | 29 |

Tek fark yeni oda kuralından geliyor: "Lara, Güzeloba 2+1, 40–45 bin" talebine 40 bin TL'lik 3+1 daha önce "yanlış" işaretlenmişti. Artık 98 puanla Sunulabilir; bu, verilen kararın doğrudan sonucu.

Barınaklar eşlemesi tek başına uygulansaydı "Fener, Barınaklar Bulvarı" talebine "yanlış" işaretlenen üç Güzeloba dairesi 100 puan Sunulabilir olacaktı. Cadde / bulvar kuralıyla Koşullu 80'de kalıyorlar.

## 4. Veri

- `TIVQ9Y70` (Kuşkavağı / Gürsu, "ASANSÖR ŞART") ve `TIVQA289` (Işıklar, "asansör şart"): kritik kriterlere `ASANSOR` eklendi (yayın sonrası).
- `alt_bolge_mahalle`: (7, 837), (7, 840). `alt_bolge.dogrulandi = true` (7, 8).

## 5. Testler

`tests/v329.test.ts` (8 test). Güncellenen testler:
- `v311`: oda.
- `v328`: oda, Koşullu örneği, sürüm.
- Model deneyi: oda etiketleri; yeni o / q senaryoları.

Tam takım: **403 test, 402 geçti, 0 başarısız, 1 atlandı.**
