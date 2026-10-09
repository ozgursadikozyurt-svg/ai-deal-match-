# Anahtar CRM — Ek: v3.22 Benim / Ofisim · "HARİÇ" bölge · bütçesiz talep puanı · kartta fotoğraf · yatay skor şeridi (9 Ekim 2026)

## Amaç (kullanıcı isteği, 9 Ekim)
1. Eşleşmeler'deki skor menüsü telefonda çok yer kaplıyor ve süzgeçlerin üstüne biniyordu → dar, yatay açılan bir yapı.
2. Kendi talep ve portföylerimi işaretleyip süzgeçte görmek ve hızlı ulaşmak; telefon numarası ya da isimden kendiliğinden bağlansın. Ofise ait kayıtlar da danışmanlar için belirgin ve ulaşılabilir olsun.
3. Eşleştirmede "Hurma, Sarısu HARİÇ" gibi ifadede bu mahalleler dışlanıp ilçenin geri kalanı aranmalı.
4. Portföy kartında yüklü fotoğraf varsa tek küçük fotoğraf görünsün.
5. Talepte bütçe yokken ~%80 eşleşme çıkıyor; incele.

## 1) Skor süzgeci: yatay şerit
- **Neden:** v3.21.2'deki sağ kenar çekmecesi (`position: fixed`, 24 px tutamak + 72 px gövde) telefonda kartların sağ kenarını ve uygunluk çiplerini örtüyordu (ekran görüntüsü, 9 Ekim).
- **Yeni (`demo/hizli-filtre.tsx › SkorSecici`):** seçici satırı artık dört eşit düğme: **İşlem · Fırsat · Kimin · Skor**. "Skor" düğmesine dokununca aynı satırın içinde (`.hs-satir` `position: relative`, şerit `position: absolute; inset: 0`) sağdan sola büyüyerek yatay şerit açılır: değer · yerel kaydırıcı (`input type=range`, 0–100, 5'er) · hazır eşikler 50/60/70/80/90 (≥ 520 px) · kalan eşleşme sayısı · ✕. Satır yüksekliği değişmez, liste örtülmez. Kapatma: ✕, Esc ya da dışına dokunma.
- Toplu işlemler (⋯) başlık satırına ("Eşleşmeler · N eşleşme · ⋯") taşındı; "Fırsat önceliği" seçicisinin adı "Fırsat" oldu (dört düğme 360 px'e sığsın). 480 px altında düğmelerdeki adet gizlenir, menüde görünür.

## 2) Benim / Ofisim
- **Kural (`src/lib/domain/sahiplik.ts`, saf fonksiyon):**
  1. Kayda elle konan işaret (`Kayit.isaret`: `BENIM` · `OFIS` · `DIS`) her zaman geçerli.
  2. Yoksa **telefon**: gönderen telefonu ya da kayda bağlı kişilerin (`KayitKisi`) telefonu / ikinci telefonu "benim" ya da "ofis" listesinde mi (son 10 hane karşılaştırılır: `0530 936 54 27` = `+905309365427`).
  3. Yoksa **ad**: gönderen / bağlı kişi adı "benim" adlarından birini tam kelime olarak içeriyor mu ("Özgür Özyurt" ✓, "Özgür Bey" ✗).
  4. Yoksa **firma**: gönderen şirketi, kişinin şirketi ya da adı ofis adlarından birini içeriyor mu ("Özyurtlar Gayrimenkul").
  - Portföy paylaşım imzasındaki ad, telefon ve firma kendiliğinden listeye girer; canlıda oturumdaki ofisin adı da ofis adı sayılır.
- **Ayar:** `ayar` tablosunda yeni anahtar `sahiplik` = `{ benimTelefonlar[], benimAdlar[], ofisTelefonlar[], ofisAdlar[] }` (`SahiplikAyarSchema`). Okuma / yazma `src/lib/services/durum.ts` (AYAR_ANAHTARLARI, DegisiklikSchema), arayüzde `demo/canli-esle.ts › ayarYuku` farkı gönderir. Demoda varsayılan ofis adı "Özyurtlar Gayrimenkul" (`DEMO_SAHIPLIK`); canlıda boş başlar.
- **Arayüz (`demo/sahiplik.tsx`):**
  - Ayarlar › en üstte **"Benim ve ofisim"**: telefon yazılırsa telefon, ad yazılırsa ad eklenir; ad yazarken Kişiler'den öneri çıkar, seçilince kişinin adı + telefonları birlikte eklenir. "N kayıt sizin · M kayıt ofisinizin" sayacı.
  - Kartlarda **★ Benim** (vurgulu) / **◆ Ofisim** (mavi) rozeti; liste kartının sol kenarı da renklenir.
  - Kayıt detayında **"Kimin?"**: Otomatik (bulunan sonuç) · ★ Benim · ◆ Ofisim · Başkası; altında nasıl tanındığı ("telefondan tanındı").
  - Talepler / Portföyler: tek satır çip **Tümü · ★ Benim · ◆ Ofisim · Diğer** (sayılı). `Filtre.sahiplik` alanı; `filtreUygula(…, sahip)` beşinci parametre; aktif süzgeç çipi ve Temizle ile uyumlu, `useKalici` ile korunur.
  - Eşleşmeler: **Kimin** seçicisi — Benim (talep ya da portföy) · Ofisim · Portföyüm (alıcı / kiracı arıyorum) · Talebim (mülk arıyorum).
  - Ana Sayfa: **"★ Benim ve ofisim"** kutusu — Talebim · Portföyüm · Ofisin talepleri · Ofisin portföyleri; dokununca liste hazır süzgeçle açılır.
- **Sınır (bilerek):** liste ofis düzeyinde tutulur. Çok danışmanlı ofiste her danışmanın kendi "Benim"i için kişi başı ayar gerekir; şimdilik ofis arkadaşlarının telefonları "Ofisim"e yazılır. Gerekirse sonraki adım: `benim*` listelerini kullanıcı kimliğine göre ayırmak.

## 3) "HARİÇ" bölge
- **Eski hata (kanıt):** "Hurma, Sarısu HARİÇ 2+1 … daire" mesajında yorumlayıcı hariçleri doğru buluyordu (`haricKonumlar`), ama aranan konum kalmayınca form taslağı (`taslakYap`) metindeki tüm yer adlarını yeniden okuyup **Hurma ve Sarısu'yu ARANAN bölge** yapıyordu → Hurma portföyü 92 puanla "Sunulabilir" (ekran görüntüsü). Hariç olmasa bile konumsuz talep "il geneli"ne düşüyordu.
- **Yeni kural (`src/lib/lokasyon/haric.ts › haricBirlestir`):**
  1. Hariç denilen mahalle / alt bölge / ilçe kayda `haric: true` satırı olarak yazılır.
  2. Hariç mahallenin ilçesi talepte başka konumla geçmiyorsa o ilçe aranan bölge olur: "Hurma, Sarısu hariç" → **Konyaaltı** + Hurma (hariç) + Sarısu (hariç). "Lara hariç Muratpaşa" → Muratpaşa zaten var, eklenmez.
  3. Aranan konumlardan hariçle aynı olan çıkarılır ("Kepez hariç" → Kepez aranmaz).
- **Eşleştirme (`src/lib/eslestirme/onizleme.ts › lokasyonPuani`):** portföyün konumu hariç satırına düşüyorsa (aynı mahalle, alt bölgenin mahallesi ya da hariç ilçe) → bölge dışı, **kesin engel** "Hariç tutulan bölge" (talepte "bölge esnek" denmiş olsa da). Diğer hesaplar yalnızca aranan konumlarla yapılır.
- **Gösterim:** `lokEtiket` hariç satırına " hariç" ekler; `konumOzeti` başlıkta "Konyaaltı (Hurma, Sarısu hariç)" yazar; form çipi üstü çizili, talepte her konumda "hariç tut / dahil et" düğmesi; "bölge listesini yapıştır" alanı "X hariç Y" kalıbını anlar.
- **Diğer yerler:** liste konum süzgeci (`konumTutar`) ve API konum araması (`listeWhere` → `some: { haric: false, … }`) hariçleri aranan bölge saymaz; mükerrer anahtarı hariçleri ayrı tutar; talep DNA'sındaki bölge sayısı hariçleri saymaz.
- **Veri:** `kayit_lokasyon.haric BOOLEAN NOT NULL DEFAULT false`. Şemada `haric: z.literal(true).optional()` — hariç olmayan satırda alan hiç oluşmaz (canlıda eski kayıtların imzası değişmez, hepsi yeniden gönderilmez).
- **Kapsam dışı:** Excel / tablo içe aktarmada (`src/lib/ingest/tablo.ts`) "konum" sütunundaki "hariç" henüz ayrıştırılmıyor.

## 4) Portföy kartında küçük fotoğraf
- `demo/fotograflar.tsx › KapakKucuk`: kapak (ilk sıradaki) fotoğraf, 56 px (eşleşme kartında 52, ayrıntıda 48), birden çoksa köşede adet. Eski "▣ N foto" rozetinin yerini aldı.
- Kart ekrana yaklaşınca (`IntersectionObserver`, 200 px önden) yüklenir; uzun listede yüzlerce fotoğraf birden indirilmez. Canlıda imzalı bağlantıdan bir kez indirilir, oturum boyunca önbellekte durur.
- Yerler: Talepler / Portföyler liste kartı (`.kk-govde.fotolu` ızgara), eşleşme kartının portföy tarafı (`.es2-bas.fotolu`), eşleşme ayrıntısındaki taraf kartı.

## 5) Bütçesiz talebin puanı
- **Ölçüm (v3.21.2 motoru, aynı konut talebi, Konyaaltı 2+1 ≥ 90 m², portföy 7,2 M · 105 m²):**

| Durum | Eski skor | Yeni skor |
|---|---|---|
| Tam bilgi (bütçe 7,5 M) | 100 Sunulabilir | 100 Sunulabilir |
| Talepte bütçe yok | **84** Koşullu | **63** Koşullu |
| Bütçe yok + m² yok | 76 | 57 |
| Portföyde fiyat yok | 87 | 65 |
| Depo, bütçe yok | 85 | 64 |

- **Neden yüksekti:** v3.19'dan beri ölçülemeyen fiyat bileşeni 0,4 puan alıyor ama ağırlığı yalnızca %15–25; diğer her şey tutunca toplam 84–87'de kalıyordu. Fiyatı hiç bilinmeyen bir eşleşme, bütçesi doğrulanmış çoğu eşleşmenin önüne geçiyordu.
- **Yeni kural:** fiyat karşılaştırılamıyorsa (talepte bütçe ya da portföyde fiyat yok, ya da periyot farklı) skor **× 0,75** (`FIYATSIZ_CARPAN`). En iyi bütçesiz eşleşme 63–69'da kalır: "Skor ≥ 70" süzgecinin ve portföy edinme eşiğinin (80) altında. Düz tavan yerine çarpan seçildi çünkü bütçesizler arasındaki sırayı korur (m²'si de eksik olan daha aşağıda). Uygunluk zaten Koşullu, kartta "Eksik: talepte bütçe yok" yazar.
- Etiketli senaryo deneyi (`scripts/deney/model-karsilastir.ts`) değişmedi: seçili model 40/40 · 30/30 · %100.

## Veritabanı
- Migration `20261009100000_v322_sahiplik_haric` — yalnızca ekleme: `kayit.isaret TEXT` (boş = otomatik), `kayit_lokasyon.haric BOOLEAN NOT NULL DEFAULT false`. Mevcut veriye dokunmaz. Yayından sonra **"Kurulumu tamamla"** düğmesi çıkar, bir kez basılır (komut satırı gerekmez).
- `degisiklikUygula` artık `isaret`i açıkça yazar: "Otomatik"e dönülünce (alan yok) eski elle işaret veritabanından da silinir.

## Örnek veri (demo, sürüm 3.22-1)
- **T14** "Hurma, Sarısu HARİÇ" Konyaaltı 3+1 talebi → P11 (Hurma) elenir, P14 (Liman) gelir.
- **T15** bütçesiz Konyaaltı 3+1 talebi → eşleşmeleri 70'in altında.
- **P14** benim portföyüm (imzadaki telefon) · **P15** ofis arkadaşının portföyü (firma: Özyurtlar Gayrimenkul).

## Testler
- Yeni: `tests/v322.test.ts` (15 test: hariç ayrıştırma / birleştirme / eşleştirme / şema / form, bütçesiz skor ve örnek verinin tamamında < 70, sahiplik kuralı, Portföyler çipleri, Ana Sayfa kısayolları, Eşleşmeler "Kimin", detay seçicisi, Ayarlar kartı, kapak fotoğrafı) ve `tests/v322-db.test.ts` (PGlite: sütunlar, hariç + işaret + ayar gidiş-dönüş, API aramasında hariç, Otomatik'e dönüşte işaretin silinmesi). `scripts/test-db.sh` listesine eklendi.
- Güncellenen: `v3212` (yan çekmece testleri → yatay şerit), `v316`, `v319` (⋯ başlıkta, "Fırsat" kısa adı).
- Sonuç: 292 test, 291 geçti, 1 atlandı (önceden de atlanan), 0 hata. Ek olarak demo 360 px telefon genişliğinde Chromium'da açılıp ekran görüntüleriyle bakıldı (Eşleşmeler satırı, açık skor şeridi, Benim süzgeci, HARİÇ talep, fotoğraflı kartlar).
