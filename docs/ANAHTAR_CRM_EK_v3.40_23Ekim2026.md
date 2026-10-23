# Anahtar CRM — EK v3.40 · 23 Ekim 2026

Özgür'ün 23 Ekim geri bildirimi (Cloudflare CPU uyarısı + Görevler / Eşleşmeler / Talep formu düzeltmeleri).

## 1. Cloudflare "CPU süresi sınırı" (günde 100+)
- **Neden:** Açılışta `GET /api/durum` tüm kayıtları (5 ilişkiyle), ~7.800 kişiyi, eşleşme takibini ve ayarları tek istekte çekiyordu. Ücretsiz planda Worker isteği başına işlemci sınırı 10 ms; Prisma satırları nesneye çevirirken sınır aşılıyor, istek yarıda kesiliyordu.
- **Çözüm (planı değiştirmeden):** Açılış parçalı. `GET /api/durum?parca=diger` (eşleşme takibi + ayarlar + arayüz durumu; oturum denetimi de bunda), `?parca=kayit&atla=N&al=60`, `?parca=kisi&atla=N&al=1000`. Yanıttaki `sonraki` bir sonraki sayfanın `atla` değeridir (null = bitti). Parametresiz GET eskisi gibi çalışır (testler, betikler, eski istemci). İstemci (`demo/canli.tsx`) sayfaları gezer; geçici hatada 3 deneme yapar.
- **Ek kazanç:** Kendiliğinden görevler kalktığı için `gorevler` ayarının JSON'u küçüldü (her görev değişiminde komple yeniden yazılıyordu).
- **Not:** Yazma yolu (`POST /api/durum`) zaten 4'lük parçalarla gidiyordu (v3.36). Hâlâ 503 sürerse kalıcı çözüm Workers Paid ($5/ay, istek başına 30 sn CPU); bu sürüm onu şart koşmaz.

## 2. Sayfa geçişleri yavaşlığı
- **Neden:** `useEslesmeler` her ekranda ayrı `useMemo` idi: Talepler, Portföyler, Eşleşmeler, Ana Sayfa her açıldığında tüm talep × portföy çiftini baştan hesaplıyordu; bir not kaydetmek (kayıt dizisi değişir) hepsini yeniden hesaplatıyordu.
- **Çözüm:** `demo/ortak.tsx › eslesmeleriHesapla` — (1) ortak önbellek (girdi nesneleri aynıysa aynı sonuç), (2) çift önbelleği: kaydın `veri` nesnesi değişmedikçe o çiftin sonucu yeniden hesaplanmaz (WeakMap). Bağlam (öğrenilen konumlar, sahiplik, paylaşım, gün) değişirse tüm çiftler geçersiz olur.

## 3. Görevler
- Otomatik görev kuralları kaldırıldı (`OTOMATIK_KURALLAR`): YANIT, IZLENIM, GERI_DONUS, TEKLIF, EVRAK (aşama görevleri) ve SICAK, TALEP_SURE, TEMAS, YETKI (sanal görevler). Tekrarlayan görevlerin nedeni: aşama görevinin anahtarı gün içerdiği için durum başka günde yeniden basılınca aynı görev yeniden doğuyordu.
- `bugunGorevleri` yalnızca saklı görevleri döndürür. `otomatikGorevleriTemizle` açılışta eski otomatik görevleri atar, yinelenen açık görevleri tekleştirir (`demo/canli-esle.ts › sunucudanDurum`).
- Görev kaynakları: ELLE (+ Görev), SONRAKI ("Bunu göreve alalım mı?"), FIYAT (fiyat düştü).
- "Bunu göreve alalım mı?" (`demo/bugun.tsx › SonrakiIletisimSorusu`): takip durumu Bildirildi / Görüşüldü / Gösterim / Pazarlık / Koparıldı olunca ya da eşleşme notu kaydedilince çıkar; not görev metni olarak önerilir.
- Görevler ekranı sadeleşti (`demo/gorevler.tsx`).

## 4. Eşleşmeler ve talep
- Güveni DÜŞÜK ("az verili") eşleşmeler oluşturulmaz; "+N az verili" düğmesi kalktı.
- Talep detayında eşleşme sırası: uygunluk → seviye → skor → havuz katmanı.
- Kritik bilgi mülk grubuna göre (`src/lib/eslestirme/talep-dna.ts`): `kriterUygunMu`, `GRUP_ONEMLI`. Konut talebinde depo / üretim amaç profili uygulanmaz; konutta yalnızca konut profili. Müşterinin açıkça "şart" dediği kriterler grup ne olursa olsun korunur.
- "Neden" / "Eksik" metinleri düz Türkçe (`onizleme.ts`).
- Yeni talep formunda "İlan sahibi" yok; Ayarlar'da "Yapay zekâ" bölümü yok (anahtar sunucuda `AI_API_KEY`).

## 5. Testler
`tests/v340.test.ts` (mülk grubuna göre kritik bilgi, otomatik görev temizliği), `tests/v340-db.test.ts` (parçalı açılış = tek seferlik durum). Güncellenen: v322, v325, v337 (yeni metin ve görev davranışı).

## 6. Yayından sonra
Veritabanı değişikliği yok; "Kurulumu tamamla" gerekmez. Cloudflare derlemesi bitince sayfayı yenileyin (açılışta eski görevler temizlenir).
