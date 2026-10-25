# Anahtar CRM — Ek v3.43 · 25 Ekim 2026
## İzleme ekranına arama + filtre, sade "Sırala", eşleşme kartında kıyas şeridi, tüm ekranlarda mobil sağlamlaştırma

---

### 1) İzleme ekranı: artık diğer listeler gibi

**Eskiden:** İzleme yalnızca dört sekme (Tümü / Talepler / Portföyler / Eşleşmeler) ve düz bir listeydi. İzlemeye alınan kayıt sayısı arttıkça aradığınızı bulmak için elle kaydırmak gerekiyordu.

**Şimdi:** ekranın üstünde Talepler / Portföyler / Eşleşmeler ekranlarındaki aynı panel var:

- Arama kutusu ("İzlemede ara: başlık, bölge, kişi…")
- **Filtrele** paneli: mülk türü, işlem, konum / mahalle, fiyat, alan, oda, durum, kişi rolü, kişi, kaynak, takas + seçilen mülk türüne özel alanlar (yükseklik, elektrik, cephe…)
- **Sırala** düğmesi (aşağıda)
- Aktif filtreler kaldırılabilir çip olarak altta, "Temizle" ile sıfırlanır

Davranış ayrıntıları:

| Konu | Kural |
|---|---|
| Sekme sayıları | Filtre sonrası sayıları gösterir (`Talepler (3)`) |
| Başlık sayacı | Filtresizken `12 izlenen kayıt`, filtreliyken `3 / 12 kayıt` |
| Talep / portföy filtresi | Kaydın kendisine doğrudan uygulanır |
| Eşleşme filtresi | Eşleşmeler ekranındaki kuralla: mülk türü + işlem **portföye** bakar, arama iki tarafı birden tarar, kalan süzgeçlerde taraflardan biri tutarsa geçer |
| Sıralama | Sekme eşleşme ise eşleşme sıralaması, değilse kayıt sıralaması (ayrı ayrı hatırlanır) |
| Kaydı silinmiş eşleşme | "Bu eşleşme artık yok" satırı filtreden bağımsız kalır (izlemeden çıkarabilmek için) |
| Hiç izlenen yoksa | Filtre paneli çizilmez, eski yönlendirme ekranı çıkar |

**Kod:** `demo/favori.tsx` → `Izleme()`. Filtre ve sıralama durumu `useKalici` ile saklanır: `izleme.f`, `izleme.sr`, `izleme.esr`.

---

### 2) "Sırala" düğmesi sadeleşti

**Sorun:** düğme seçili sıralamanın tam adını yazıyordu (`↓ Uyum (en iyi önce)`). Dar ekranda filtre çubuğunu taşırıyor, CSS'teki `max-width:3.9rem` yüzünden zaten `↓ Uyum…` diye kırpılıyordu — yani ne yer kazandırıyordu ne bilgi veriyordu.

**Çözüm:** düğme sabit `↓ Sırala` yazar. Seçili sıralama:

- menünün başlığında yazılı (`Sırala` / küçük satırda `Uyum (en iyi önce) · Büyükten küçüğe`),
- listede `✓` ile işaretli,
- varsayılandan farklıysa düğme vurgulu (`on`).

`Uyum (en iyi önce)` eşleşme sıralamasının **ilk ve varsayılan** seçeneği olarak menüde duruyor.

**Kod:** `demo/filtre.tsx` → `SiralaDugmesi`. Tüm ekranlar (Talepler, Portföyler, Eşleşmeler, İzleme, Kişiler, Toplu giriş, çekmece) aynı düğmeyi kullandığı için hepsinde aynı anda değişti.

**Ortaklaştırma:** eşleşme sıralama seçenekleri `eslesmeSiralama()`, eşleşme filtresi `eslesmeFiltreUygula()` olarak `demo/filtre.tsx`'e taşındı; `demo/app.tsx` (Eşleşmeler) ve `demo/favori.tsx` (İzleme) aynı kodu kullanıyor.

---

### 3) Eşleşme kartı: kıyas şeridi ve eklenen bilgiler

Kartın cevapladığı asıl soru "bu mülk bu talebe ne kadar uyuyor?". Eskiden bütçe ile fiyat, istenen m² ile mülkün m²'si iki ayrı blokta duruyordu; farkı kullanıcı kafadan hesaplıyordu.

**Kıyas şeridi** (Talep ve Portföy bloklarının altında, "istenen → olan + fark"):

| Ölçüt | Örnek | Ton |
|---|---|---|
| Bütçe | `≤ 200 bin ₺ → 185 bin ₺` · *bütçe içinde* | yeşil |
| Bütçe | `≤ 10 mn ₺ → 12 mn ₺` · *%20 üstünde* | ≤%10 sarı, üstü kırmızı |
| Bütçe (talepte yazılı değilse) | `Bütçe yazılmamış → 5 mn ₺` · *karşılaştırılamıyor* | sarı |
| Alan | `800–1.500 m² → 1.200 m²` · *aralıkta* | yeşil |
| Alan | `200–400 m² → 100 m²` · *%50 küçük* | küçükte ≤%15 sarı, büyükte ≤%25 sarı, üstü kırmızı |
| Oda | `3+1 → 3+1` · *istenen oda* | yeşil / sarı |
| Kat | `2–5. kat → 3. kat` · *istenen kat* | yeşil / sarı / kırmızı |

Ölçülemeyen satır hiç çizilmez (boş "—" satırı yok).

**Karta eklenen diğer bilgiler:**

- Talep tarafında **aciliyet** rozeti ve **kalan süre** (`16 gün kaldı`; 3 günden azsa kırmızı). Sıralamayı pratikte belirleyen şey çoğu zaman bu.
- Taraf etiketlerinde anlam: `TALEP · müşteri istiyor`, `PORTFÖY · önerilen mülk` (≤420 px'te gizlenir).
- `Not var` rozeti yerine **notun kendisi** (90 karaktere kadar) ve son hareketin tazeliği (`Bugün` / `Dün` / `3 gün önce` / `2 ay önce`). Nerede kalındığını görmek için kartı açmak gerekmiyor.

**Kod:** `demo/kartlar.tsx` → `kiyaslar()`, `KiyasSeridi`, `gunOnce()`; stiller `demo/sayfa.html` `.es2-kiyas` / `.ek-satir`.

---

### 4) Mobil sağlamlaştırma (tüm ekranlar)

`demo/sayfa.html` sonuna eklenen blok (≤959 px ve ≤360 px):

- **Sayfa yatay kaymaz:** `html,body{overflow-x:clip}` + `.icerik, main.sarici{overflow-x:clip}`. `clip` seçildi çünkü `hidden`'ın aksine **kaydırma kutusu yaratmaz** — içerideki `position:sticky` toplu işlem çubukları çalışmaya devam eder. Bilerek yana kaydırılan kutular (`.filtre`, `.tablo-sar`, `.aktif-filtreler`) etkilenmez.
- **Esnek satırlar:** `.satir` mobilde sarar; `.satir > *`, `.satir-ara > *`, `.kk-govde > *`, `.es2-bas > *` için `min-width:0` — uzun bir çocuk artık kutuyu itmiyor, kırpılıyor ya da alta sarıyor.
- **Bölünmeyen uzun diziler** (bağlantı, e-posta, ilan no, mahalle listesi, dosya adı): `overflow-wrap:anywhere`.
- **Açılır listeler:** `select{max-width:100%}`.
- **Eşleşme kartı üst satırı:** `.es2-durum` sağ boşluğu 36 px'ten 84 px'e çıktı — sağdaki anahtar + kopar düğmeleri mutlak konumlu olduğu için uygunluk/fırsat rozetleri altlarına giriyordu.
- **Dokunma hedefleri:** `.x-btn` 36×36, `.anahtar-btn` en az 36×36, çip silme 28×28.
- **Sıralama menüsü:** `max-width:calc(100vw - 28px)`.
- **≤360 px:** daha dar kenar boşluğu, küçültülmüş alt çubuk yazıları, sıkışık sekme ve filtre düğmeleri.

---

### Testler

`tests/v343.test.ts` — 12 test: İzleme'de filtre panelinin varlığı, arama ile listenin ve sayaçların daralması, boş durumda panelin çizilmemesi, "Sırala" düğmesinin uzun etiket yazmaması ve menüde seçeneklerin bulunması, varsayılan eşleşme sıralaması, eşleşme filtresinin iki tarafı taraması, kıyas şeridinin bütçe / alan / oda hesapları (aşım, aralık, bütçesiz talep), `gunOnce`, ve mobil CSS kurallarının varlığı.

`tests/v333.test.ts` ve `tests/v342.test.ts` güncellendi (kural `demo/filtre.tsx`'e taşındığı ve sürüm ilerlediği için).

**Durum:** 434 test geçiyor. Kalan 12 başarısız test veritabanı gerektiriyor (`npm run test:db` ile PGlite ayağa kalkınca çalışır) ve bu sürümden önce de aynı şekilde başarısızdı.

---

### Demo'da test edilecekler

- [ ] **İzleme:** üstte arama kutusu ve "Filtrele" görünmeli. Bir kelime yazın; listedeki kayıtlar ve sekme sayıları azalmalı, başlıkta `n / toplam kayıt` çıkmalı. "Temizle" ile geri dönmeli.
- [ ] **İzleme › Filtrele:** mülk türü seçince ona özel filtreler (yükseklik, elektrik…) açılmalı; "N sonucu göster" doğru sayıyı vermeli.
- [ ] **Sırala:** filtre çubuğundaki düğme `↓ Sırala` yazmalı (uzun ad yok). Basınca menünün başında seçili sıralama, listede `✓` olmalı; Eşleşmeler'de en üstteki seçenek "Uyum (en iyi önce)" olmalı.
- [ ] **Eşleşme kartı:** Talep ve Portföy bloklarının altında Bütçe / Alan satırları çıkmalı. Bütçeyi aşan bir portföyde `%… üstünde` kırmızı, bütçe içindekinde `bütçe içinde` yeşil olmalı.
- [ ] **Eşleşme kartı:** süresi yaklaşan bir talepte `… gün kaldı` görünmeli; takip durumu değiştirip not yazdığınız bir eşleşmede notun kendisi ve `… gün önce` çıkmalı.
- [ ] **Telefon:** Ana Sayfa, Talepler, Portföyler, Eşleşmeler, İzleme, Kişiler, Veri Girişi, Görevler ve Ayarlar'ı tek tek açıp sağa sola kaydırmayı deneyin — hiçbirinde sayfa yana kaymamalı, hiçbir yazı kutudan taşmamalı.
- [ ] **Telefon › Eşleşmeler:** kartın sağ üstündeki anahtar ve ✕ düğmeleri "Sunulabilir / Öncelikli fırsat" yazılarının üstüne binmemeli.
