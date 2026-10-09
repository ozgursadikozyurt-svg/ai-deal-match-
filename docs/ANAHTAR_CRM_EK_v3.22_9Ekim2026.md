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

---

## v3.22.1 — canlı eşleşme denetimi ve düzeltmeler (9 Ekim 2026, öğleden sonra)

### Neden
Kullanıcı ekran görüntüsü: talep ≤ 12.000.000 (3+1, ≥ 140 m², bina ≤ 12 yaş), portföy 11.750.000 (3+1, 170 m², 8 yaş) → Kriter dökümünde **Fiyat "? Bilinmiyor"**, puan ~60. Ayrıca ★ Benim portföylerin eşleşmesi "Normal fırsat", bazı portföylere fotoğraf eklenemiyor.

### Kök nedenler (kanıtla)
1. **Periyot:** `demo/form.tsx` yeni kaydı `fiyatPeriyodu: "AYLIK"` ile açıyordu; işlem "Satılık"a çevrilince periyot değişmiyordu. Motor `periyotFarkli` (Aylık ≠ Toplam) görüp fiyatı "bilinmiyor" sayıyordu → fiyat bileşeni 0,5, uygunluk Koşullu, v3.22'nin bütçesiz çarpanı da devreye giriyordu.
2. **Kayıt sunucuya hiç ulaşmamış:** bu talep canlı veritabanında yok (11–13 M bütçeli tek talep T2WDEL18). Kayıt tablosunda 8 Ekim 19:25 UTC'den sonra hiç yazma yok. v3.22 yayını ile "Kurulumu tamamla" (11:58 UTC) arasında sunucu `isaret` sütununu bulamayıp kayıtları reddetti; kayıt kuyruğu reddedilen kaydı **içeriği değişmedikçe bir daha göndermiyordu** (`demo/canli-kaydet.ts › reddedilen`). Fotoğraf yükleme de kaydın sunucuda olmasını ister → 404 → ekranda yalnızca "dosya açılamadı".
3. **Fırsat:** `firsatDegerlendir` yalnızca kim etiketine bakıyordu; kendi ilanım WhatsApp grubundan "emlakçı" geldiği için tek taraf aracısız sayılıyordu.

### Denetim (Supabase, salt okunur)
Aktif 327 kayıt (46 talep, 281 portföy) çekildi, `eslesmeOnizle` 3.683 temel uyumlu çiftte çalıştırıldı (betik: oturum içi, `/tmp/…/denetle.ts`); 38 talebin özgün mesajı yeniden ayrıştırılıp kayıttakiyle karşılaştırıldı.

| Bulgu | Adet | Sonuç |
|---|---|---|
| Satış talebinde "Aylık" periyot (sunucuda) | 0 | Sorunlu talep sunucuya hiç yazılmamış; motor ve form düzeltildi |
| "( Hurma-Sarısu-Liman hariç)" hariç görülmüyor | 1 talep, 30 uygun çift | Tire / parantez / "ve" ayraç; durak sözcüğü (bölge, taraf) → hariçler doğru |
| "Site içi olmayan" → site istiyor | 1 | Olumsuz ek (olmayan, olmasın, istemiyor, hariç, değil) → istemiyor; site içi portföy Koşullu |
| "Bütçe - 7.5 M", "max 7 m" okunmuyor | 2 | Bütçe / fiyat / max bağlamında M = milyon |
| "2.000-3.000 M2" bütçe sanılıyor | 1 | Alan aralığı para sayılmaz |
| Oda / m² portföyde yok ama Sunulabilir | 10 çift | Çekirdek bilgi bilinmiyorsa Koşullu |
| Portföy fiyatı bütçenin %5'inden az (veri hatası) | PCNFHT99 (130.834 TL satılık daire), PTHBR026 (6.600 TL) | Elenmiş durumda; kayıtlar elle düzeltilmeli |
| Kiralık ama aylık > 2 M | P097201K (29.950.000), P74GC000 (4.875.000) — ikisi de "devirlik" | Devir bedeli kira sanılmış; elle "Devren" yapılmalı |
| Benzer tip (daire talebi ↔ ofis portföyü) Koşullu | 90 çift | Tasarım gereği ("benzer tip" rozetli); değiştirilmedi |

Yeniden ayrıştırmada eski koda göre **gerileme yok** (eski / yeni çıktı farkı yalnızca düzeltilen üç talep).

### Değişiklikler
- `src/lib/eslestirme/onizleme.ts`: `etkinPeriyot` (satışta her zaman TOPLAM), aylık ↔ yıllık çevirme, çekirdek bilinmiyorsa Koşullu, `ISTENMEYEBILIR` (siteIcinde, havuz: talepte "istemiyor" + portföyde var → yumuşak uyumsuzluk).
- `demo/form.tsx`: `periyotOnerisi` — işlem değişince periyot uyar; kaydederken satışta TOPLAM.
- `src/lib/ai/yorumlayici.ts › haricler`, `src/lib/ai/hizli-ayristirici.ts`: tireli hariç, olumsuz özellikler, "7.5 M", alan aralığı.
- `demo/onarim.ts` (yeni): açılışta onarım — satışta periyot, eski hariç talepler (başlık da), site / havuz olumsuzu, mesajda yazılı ama boş bütçe. Demoda `depoYukle`, canlıda `canli.tsx` (onarılan kayıt kuyruğa girer, sunucuya yazılır). Canlı veride onarılacak: TCPZ1V98 (hariç + site), TCPZ1X26 (bütçe 7 M).
- `src/lib/eslestirme/firsat.ts`: `talepSahip` / `portfoySahip` — Benim taraf varsa ÖNCELİKLİ; Ofisim taraf aracısız. `demo/ortak.tsx › useEslesmeler` sahipliği geçirir.
- `demo/canli-kaydet.ts`: reddedilen kayıt 60 sn sonra (en çok 5 kez) ve `hemen()`de yeniden denenir; `sunucudaMi`, `hataOf`; yeni kayıt / kişi yerel yedeği (`yedektenGeriAl`).
- `demo/foto.ts`, `demo/fotograflar.tsx`: yüklemeden önce kayıt gönderilir, 404'te bir kez daha denenir, gerçek neden gösterilir; 1,5 MB'ı aşan fotoğrafta kalite kademeli düşer.

### Ders (bundan sonra)
Migration gerektiren sürümde sunucu, sütun gelmeden yeni alanı yazmaya çalışınca kayıtlar reddediliyor. Yeniden deneme bunu artık kendiliğinden toparlıyor; yine de migration'lı sürümde "Kurulumu tamamla" yayından hemen sonra basılmalı.

### Testler
`tests/v3221.test.ts` (10 test). Tam paket: 302 test, 301 geçti, 1 atlandı, 0 hata.
