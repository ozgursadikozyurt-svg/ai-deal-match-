# Anahtar CRM — Ek v3.36 · 19 Ekim 2026

**Konu:** Eşleştirme puanının 1–5 uyum seviyesine geçmesi ve yanlış / yanıltıcı skorların düzeltilmesi · talep okuma hataları · Geri tuşu · dosyanın tamamını yapay zekâyla yorumlama · toplu kaynak değişimi · kaydetme hataları
**Bağlam:** Özgür'ün 19 Ekim isteği: "Neden %100, neden %60'ta kalmış araştır; yanlış / yanıltıcı skor olmasın, çok doğru bir eşleşme %60 altında olmasın. Belki 1–5 ya da 1–10 skorlama daha mantıklı olur."

## A. İnceleme (canlı veri, 19 Ekim 21:00)
- 680 aktif kayıt (103 talep, 577 portföy) · 16.095 talep × portföy çifti motorla yeniden hesaplandı (`eslesmeOnizle`, canlı konum bağlamı). Son 6 günde 45 talep, 142 portföy girildi.
- Kullanıcı geri bildirimi (`match` tablosu): 40 "yanlış", 14 "beğenmedi", 9 "sahibi istemedi", 4 "başka yerle anlaştı", 4 bildirildi / 1 gösterim, 5 bekliyor.
- **Yanlış işaretlenenlerin 10'u 92–100 alıyordu.** Nedenler (çoğu motor değil, talebin yanlış okunması):
  1. "Ara kat olacak. Giriş kat ve en üst kat kesinlikle düşünülmüyor" → `istenenKatlar = ["ARA","0"]`; giriş kattaki daire 100.
  2. "Güney cephe" → **Alanya / Güney Mahallesi** konumu (hem talepte hem "GÜNEY-DOĞU CEPHELİ" yazan portföyde) → ikisi "aynı mahalle", 100.
  3. "Bayındır Fabrikalar mah" yazan daire talebi → mülk tipi **Fabrika**.
  4. "80 mt² ve üstü", "5 yaşa kadar", "4 yaşa kadar", "yaşı en fazla 16-17" okunmuyordu; kiralıkta "boş daire" eşyasız sayılmıyordu; "2+1 katta" → bulunduğu kat 1.
  5. "Arakat" talebi `[1,2,3,ARA,4,5,6]` okunmuş, 5/5 son kat "tuttu" sayılıyordu; "yeni bina" sıfır yaş okunuyordu.
  6. 2+1 talebine 3+1 kiralık (bütçe içinde) 92–98 "Sunulabilir" — üçü de yanlış işaretlendi; bir tanesi aynı anda bütçeyi de aşıyordu (iki ödün).
  7. Dövizli bütçe (3.000 USD, 200.000 €) TL fiyatla birebir karşılaştırılıyordu.
- **İyi eşleşmenin %60'larda kalma nedenleri:** bütçe yazılmamış talepte ×0,75 çarpanı (en iyi bütçesiz eşleşme 63–69); talepte yapay zekânın uydurduğu "5 kW elektrik", "çatı sandviç panel" gibi alanlar istek sayılıp −4 / −8 ve 70–85 tavanlarına takılıyordu.
- **%84, %74, %70, %60, %40** sayıları gerçek uyum değil, kademe tavanlarıydı (koşullu ≤ 84, şart bilinmiyor ≤ 74, istenen yok ≤ 70, kat ≤ 60, uygun değil ≤ 40). Ekranda yüzde gibi görünmeleri yanıltıcıydı.

## B. Karar: 1–5 uyum seviyesi (yüzde ekrandan kalktı)
| Seviye | Ad | Anlamı | İç skor |
|---|---|---|---|
| 5 | Sunulabilir | Temel kriterlerin hepsi doğrulandı | 85–100, yalnızca SUNULABILIR |
| 4 | Güçlü aday | Tek soru / küçük ödün: komşu mahalle, bütçe ya da bir özellik bilinmiyor, fazla oda | 70–84 |
| 3 | Sorulacak | Şart olan bilgi bilinmiyor ya da birkaç ödün | 55–69 |
| 2 | Zayıf | İstenen özellik yok, kat tutmuyor, konum uzak | 41–54 |
| 1 | Uymuyor | Öldürücü kriter tutmuyor | ≤ 40 / UYGUN_DEGIL |

- Neden 1–10 değil: motor bu kademeleri ayırt edebiliyor; 10 basamak, ölçülemeyen bir hassasiyet gösterirdi. 5 seviye danışmanın kararıyla birebir: sun · sor ve sun · sor · zayıf · yok.
- İç skor (0–100) sıralama için kalır (Notion geri yazımı da skoru kullanmaya devam eder). Ekranda: kartta `4/5` + seviye adı + "Neden 4/5: …" satırı; eşleşme detayında "Neden 4/5?" gerekçe listesi; süzgeç "Uyum ≥ 4/5" (`eslesmeler.seviye`).
- `OnizlemeSonucu.seviye` ve `gerekceler` (`src/lib/eslestirme/onizleme.ts › seviyeOf, SEVIYE_ESIK, SEVIYE_ETIKET`).

## C. Motor değişiklikleri (`onizleme.ts`, `teknik-alanlar.ts`)
- Döviz: `DOVIZ_TL` (USD 49,4 · EUR 55,4 · GBP 64 — 14 Eki 2026 piyasası); farklı para birimi TL'ye çevrilir, uyarıya yazılır ama tek başına Koşullu yapmaz.
- Talepte anlamsız istek yok sayılır: "en az" alanlarında ≤ 0, şart denmemiş elektrik < 10 kW.
- Tercih alanları (çatı, duvar, cephe yönü): şart denmedikçe bilinmemesi cezasız, uymaması −3 (tavan yok). Isınma tercih değildir (doğalgaz konutta istek).
- Kat: "ara kat" + (SON değilse) son kat tutmaz; kat numarası listesi bunu ezemez. Açıkça seçilen giriş geçerlidir.
- Fazla oda en fazla Koşullu (4/5), iki+ oda fazla ≤ 74. Üst üste ödün (fazla oda, bütçe üstü, m² sınırda, bina yaşı sınırda, komşu konum) — ilkinden sonraki her biri −6, en fazla 79.
- Bina yaşı üst sınırını en az 2 yıl / %15 aşan küçük ödün sayılır ("yaşı en fazla 17" talebine 18 yaş).
- Bütçe / fiyat bilinmiyorsa ×0,75 yerine −8 ve en fazla 79 (4/5).
- Tavanlar: şart bilinmiyor 74 → 69 · istenen yok 70 → 64 · kat 60 → 54 · bilinmeyen istek 85 → 84 · konum yakın / bilinmiyor 70 → 69, komşu ilçe 65 → 64.
- Model deneyi (`scripts/deney/model-karsilastir.ts`): fazla oda etiketleri K'ye çekildi; A 42/42 · 32/32.

## D. Talep okuma (`hizli-ayristirici.ts`, `jargon.ts`, `yorumlayici.ts`, yapay zekâ istemi)
- Olumsuz cümledeki kat istenmez (`OLUMSUZ_KAT`); "en üst kat" = SON; "2+1 katta" kat değil; talebe "bulunduğu kat" yazılmaz.
- Bina yaşı: "N yaşa kadar", "yaşı en fazla 16-17", "yeni bina" ≤ 5.
- m²: "mt²", "ve üstü / ve altı". Kiralık konutta "boş" = eşyasız; "BOŞ / Eşyalı", "eşyalı-eşyasız" = ikisi de olur (alan yazılmaz).
- "X mah / mahallesi" mülk tipi sayılmaz; "Güney / Kuzey / Doğu / Batı cephe" konum değildir; tek başına "merkez" konum değildir.
- Yapay zekâ istemine aynı kurallar eklendi (uydurma 0 / tahmin yazma, olumsuz cümle, cephe ≠ yer, döviz).

## E. Veri düzeltmesi (migration `20261019210000_v336_veri_duzeltmesi`)
"Kurulumu tamamla" ile çalışır. 25 kayıtta (22 talep, 3 portföy) 31 alan: ara kat (5), talepte bulunduğu kat (7), anlamsız elektrik (4), bina yaşı (5), eşyasız (3), m² (1), Fabrika → Daire (1), Güney cephe konumu (3 silindi, 2 Fevzi Çakmak / Çağlayan'a düzeltildi). Her satır yalnızca değer hâlâ yanlışsa değişir; hepsi `audit_log`a yazılır (kaynak: "v3.36 veri düzeltmesi").
**Etki (aynı veriyle yeniden hesap):** "yanlış" işaretlenen 40 eşleşmeden 5/5'te kalan 10 → 2; sunulan / gösterilen / başka yerle anlaşılan / bekleyen eşleşmelerin hepsi 4–5. Kalan iki yanlışın nedeni veride yok ("önü açık" kriteri ve aynı portföyün iki talepte reddi).

## F. Geri tuşu
- Telefonun / tarayıcının geri tuşu: her ekran geçişi `history.pushState`; `popstate` → uygulama içi Geri. Uygulamadaki "← Geri" de aynı adımı tüketir (çift adım olmaz).
- Formun düğmesi "← Geri" (eski "← Vazgeç"): formun **açıldığı** ekrana döner (eskiden yeni ekran açıyor, Geri tekrar forma götürüyordu). Kaydet: düzenleme / içe aktarma formu açıldığı yere döner; yeni kayıt detayına geçer, oradan Geri formun açıldığı yere gider (`Ctx.geri({donus, yedek})`, `Ctx.degistir`).

## G. Veri girişi
- Dosya (Excel): "✦ Yapay zekâ ile yorumla" tüm satırları (eklenen / atlanan / zaten var hariç) 8'erli paketlerle tek istekte yorumlar; satırlar `satirNo` ile eşlenir; bir tıkta en çok 80 satır. Satır altındaki "Yapay zekâya yorumlat" düğmeleri kaldırıldı. Yorumlanmış satır tekrar sorulmaz.
- Kaynak: WhatsApp sohbetinden / gelen kutusundan gelen portföy "sahibinden" yazsa da Partner (Emlak grubu); Kendi portföyüm yalnızca elle girişte ve kendi mesajınızda. Neden: hızlı ayrıştırıcı "SAHİBİNDEN SATILIK" yazan meslektaş mesajını MALIK okuyordu ve MALIK → Kendi portföyüm kuralı vardı. Canlıda WhatsApp kanallı 10 portföy hâlâ Kendi portföyüm (otomatik değiştirilmedi; Portföyler › Toplu düzelt ile düzeltilebilir).
- Toplu kaynak değişimi: WhatsApp içe aktarma, gelen kutusu ve Portföyler › "Toplu düzelt" (`TopluKaynakSecici`).

## H. Kaydetme hataları
- Veritabanı (Supabase) günlüklerinde hata yok; Worker tarafında görülen hata, Cloudflare ücretsiz planın istek başına 10 ms işlemci sınırı (503 / 1102) ile uyumlu. Kayıt başına ~10 sorgu; 10 kayıtlık parça bu sınıra takılıyordu.
- Kayıtlar 4'erli gider; 502/503/504 ve "exceeded" geçici sayılır ("Sunucu yoğun — yeniden deneniyor, değişiklikleriniz bekliyor"), 8 kez artan aralıkla yeniden denenir. İşlem (transaction) yarıda kesilirse geri alınır; yarım kayıt oluşmaz.
- Hatalar artık sunucuda `ayar.kayitGunlugu`na yazılır (arayüzün yaşadığı 5xx / bağlantı hataları bir sonraki başarılı istekle, sunucunun reddettiği kayıtlar anında; son 60). Kalıcı çözüm: Cloudflare Workers Paid ($5/ay).

## Testler
`tests/v336.test.ts` (17) + güncellenen v311, v316, v3212, v322, v324, v328, v329, v335. Toplam (veritabanlı): 485 test, 0 hata.
