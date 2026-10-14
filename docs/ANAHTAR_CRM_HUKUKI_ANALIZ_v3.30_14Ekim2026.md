# Anahtar CRM — Fikir Raporu 1–4. Maddeler: Hukuki Dayanak ve Uygulanabilirlik Analizi (14 Ekim 2026)

> Bu belge mevzuat ve yayımlanmış kaynaklardan derlenmiş bir **ürün analizidir, hukuki görüş değildir**. Belge şablonları (özellikle yer gösterme belgesi) canlıya alınmadan önce bir avukata onaylatılmalıdır. Mevzuat atıfları 1 Ekim 2026 yürürlüklü konsolide metne göredir.

## Kısa sonuç
| # | Özellik | Hukuki dayanak var mı? | Dijital geçerlilik | Uygulanabilir mi? | Risk |
|---|---|---|---|---|---|
| 1 | Dijital yer gösterme belgesi | **Evet** — Yönetmelik m.19 zorunlu tutuyor; Yargıtay imzalı belgeyi geçerli simsarlık sözleşmesi sayıyor | **Kısmen.** Islak imza ya da güvenli e-imza tam geçerli; ekranda parmakla çizilen imza tartışmalı | **Evet, iki katmanlı:** uygulama belgeyi hazırlar, ıslak imzalı nüshanın fotoğrafı saklanır; sahada ekranda imza "kanıt" katmanı olur | Orta (yalnızca ekran imzasına güvenilirse yüksek) |
| 2 | EİDS / yetki takibi | **Evet** — Yönetmelik m.12, m.14, m.15; EİDS 1 Ocak 2025'ten beri zorunlu | Yetkiyi mal sahibi e-Devlet'te verir; uygulama yalnızca takip eder | **Evet**; doğrudan EİDS bağlantısı **yok** (kamuya açık bir arayüz bulamadık) | Düşük |
| 3 | Sesle not | Engel yok | — | **Evet**, iki sınırla: müşteriyle konuşma kaydedilmez (TCK 133); ses / metin yurt dışı servise gider (KVKK m.9) | Düşük–orta (KVKK aktarım şartı) |
| 4 | Kira bitişi takibi | Engel yok; TBK m.347 tarihleri fırsatın kendisi | — | **Evet** | Düşük |

**Karar (sıra):** v3.31 **EİDS / yetki takibi** (avukat beklemez, risk düşük) → v3.32 **yer gösterme belgesi** (v3.31 sürerken şablon avukata gider) → v3.33 **kira bitişi** → v3.34 **sesle not** (KVKK yurt dışı aktarım işi genel olarak çözüldükten sonra).

---

## 1) Dijital yer gösterme belgesi

### Hukuki dayanak
- **Taşınmaz Ticareti Hakkında Yönetmelik m.19:** Taşınmazın alıcı veya kiracıya "fiziksel olarak veya elektronik ortamda gösterilmesi" hizmeti belge düzenlenerek verilir. Belge, birer nüshası taraflarda kalacak şekilde **en az iki nüsha** düzenlenir. **Her alıcı / kiracı için ayrı belge**, birden fazla taşınmazda **her taşınmaz için ayrı imza** alınır. Gösterim için **bedel istenemez**. (LEXPERA konsolide metin) — Dikkat: buradaki "elektronik ortam" **gösterimin** biçimidir (sanal tur gibi), belgenin elektronik düzenlenmesine açık izin değildir.
- **Asgari içerik (m.19/2):** işletmenin yetki belgesi numarası ve iletişim bilgisi; sorumlu danışmanın adı ve **imzası**; gösterilen kişinin adı soyadı, **kimlik numarası**, iletişim bilgisi ve **imzası**; tapu bilgileri, cinsi, adresi; gösterim amacı ve tarihi; hizmet bedelinin oranı ya da tutarı.
- **Hizmet bedeli tavanı (m.20):** satışta KDV hariç satış bedelinin **%4**'ü, kirada **bir aylık kira**; hak satışta tapu tescili, kirada kira sözleşmesinin kurulmasıyla doğar.
- **Saklama (m.14/2-k):** işletme her yetkilendirme sözleşmesi için **fiziksel ya da elektronik ortamda dosya** oluşturur, sözleşme ve bağlı belgeleri **en az 5 yıl** saklar. → İmzalı belgenin fotoğrafını / PDF'ini uygulamada saklamak mevzuatla uyumlu.
- **TBK m.520/3:** "Taşınmazlar konusundaki simsarlık sözleşmesi, yazılı şekilde yapılmadıkça geçerli olmaz." Sözlü anlaşmaya dayanan komisyon talebi Yargıtay 23. HD'ce reddedildi (Mynet / İHA haberi, 2019).
- **Yargıtay uygulaması:** İmzalı yer gösterme belgesi çoğunlukla geçerli simsarlık (tellallık) sözleşmesi sayılıyor; ör. 13. HD 2016/16603 E., 2019/285 K. (%3 komisyonlu belge geçerli; mal sahibiyle ayrıca sözleşme şart değil); 13. HD 2015/24945 E., 2017/12617 K.; HGK 2014/859 E., 2016/428 K. (imzası inkâr edilmeyen belgeye dayalı ücret talebi incelenmeli; malikin imzası şart değil). (Ezcan Hukuk derlemesi)

### Dijital imzanın geçerliliği
- **TBK m.15:** yazılı şekilde imza el yazısıyla atılır; **güvenli elektronik imza** el yazısıyla atılan imzanın bütün hukuki sonuçlarını doğurur (5070 sayılı Kanun m.5). Güvenli e-imza yalnızca BTK yetkili sağlayıcıların (E-Güven, TürkTrust, Kamu SM, Turkcell) nitelikli sertifikasıyla olur.
- **DocuSign benzeri / onay kutusu / SMS onayı** gibi basit elektronik imzalar güvenli e-imza değildir; mahkemede genellikle **delil başlangıcı** sayılır, tek başına tam ispat sağlamaz (Moral Hukuk; Hukuki Haber).
- **Ekranda parmakla çizilen imza:** Doktrinde "el ile atıldığı için TBK m.15'teki el yazısı imzadır, zaman damgası ve kayıtlarla ıslak imzadan bile güçlü kanıttır" diyen görüş var (Bilgi Üniversitesi BTHAM çalışması). Ancak **yerleşik Yargıtay içtihadı yok**. Komisyon davasında karşı taraf "yazılı şekil yok" diyebilir.
- **e-Devlet'te yer gösterme belgesi hizmeti:** araştırmada bulunamadı (EİDS yalnızca ilan yetkisi içindir).

### Uygulama tasarımı (önerilen)
**Katman A — asıl yol (tam geçerli):** Uygulama belgeyi m.19 içeriğiyle doldurur: ofisin yetki belgesi no (ayarlara bir kez girilir), danışman, portföyün ada / parsel (alanlar zaten var), adres, amaç (satış / kira), tarih, hizmet bedeli oranı (%4 / bir aylık kira tavanı aşılırsa uyarı). Çıktı: **iki nüsha A4 PDF** (yazdır ya da ofis yazıcısına gönder). Islak imzadan sonra **telefonla fotoğrafı çekilip kayda eklenir** → 5 yıllık elektronik dosya (m.14/2-k). Belge İlgilenenler'deki "Gösterildi" satırına bağlanır.

**Katman B — sahada yazıcı yoksa (kanıt katmanı):** Telefonda imza alanı + kayıtlı sunucu saati + (izin verilirse) konum + belgenin PDF'inin anında müşteriye WhatsApp / e-postayla gönderilmesi (ikinci nüsha). Ekranda "Islak imzalı nüsha bekleniyor" uyarısı kalır; ilk görüşmede kâğıda imza alınınca kapanır. Basınç / hız gibi **biyometrik veri toplanmaz** (KVKK'da özel nitelikli veri yükü doğmasın).

**Katman C — ileride:** Güvenli e-imza / mobil imza ile imzalatma. Gösterim anında müşteride nitelikli sertifika nadiren olduğu için pratik değil; **mal sahibiyle ofiste imzalanan yetkilendirme sözleşmesi** için daha uygun.

**KVKK:** Kimlik numarası m.19 gereği zorunlu içerik → işleme dayanağı kanunda öngörülme ve hukuki yükümlülük (KVKK m.5/2-a, ç). Kimlik numarası veritabanında ayrı alan olarak **tutulmaz**, yalnızca PDF'te durur; 5 yıl sonra silinir. Şablon **gösterim için bedel içermemeli** (m.19/4). Cezai şart vb. ek hükümleri avukat belirlemeli.

**İş yükü:** ~1 sprint. Göç gerekmez (ofis yetki belgesi no ayar JSON'unda, PDF fotoğraf deposunda). Fotoğraf deposu Ücretsiz planda kapalı → belgeler için plan kuralı ayrıca açılmalı.

---

## 2) EİDS ve yetki takibi

### Hukuki dayanak
- **Yönetmelik m.12/2-ç:** İlan sitesi, taşınmazın ilan verene ait olduğunu ya da **yetkilendirildiğini ilandan önce doğrular** (31.08.2023 ve 30.05.2025 değişiklikleri).
- **Ticaret Bakanlığı EİDS duyurusu:** yetki doğrulama 15 Eylül 2024'te başladı, **1 Ocak 2025'ten beri ilanlar yetki doğrulaması olmadan verilemiyor**. Mal sahibi e-Devlet'te "EİDS Taşınmaz İlanı Yetkilendirme İşlemleri"nden taşınmazı seçer, işletmenin **yetki belgesi numarasını** girer, **en az 3 ay** olan bitiş tarihini kaydeder. Yetki yalnızca ilan içindir; yetkilendirme sözleşmesinin, yer gösterme belgesinin ve aracılık sözleşmesinin yerine geçmez. Satılık konutta zorunluluğun 15 Şubat 2026'da tamamlandığını ve yetkisiz yaklaşık 200.000 ilanın kapatıldığını Milliyet aktarıyor.
- **m.15 yetkilendirme sözleşmesi:** yazılı, en az iki nüsha, asgari içerik (yetki belgesi no, danışman ve iş sahibi imzası, hizmet bedeli, süre, cayma / ceza koşulu, tapu, imar, takyidat bilgileri).
- **m.14/2-h:** taşınmaz satılınca / kiralanınca ya da sözleşme bitince **izleyen 3 gün içinde ilan kaldırılır**. **m.14/2-i:** ilanda yetki belgesi no ve il / ilçe / mahalle / ada / parsel okunaklı yer alır.

### Dijital geçerlilik ve entegrasyon
EİDS yetkisini yalnızca **mal sahibi e-Devlet'te** verir; doğrulamayı **ilan siteleri** yapar (Bakanlığın entegre firma listesi yalnızca ilan platformlarını kapsıyor). Bir CRM'in EİDS'e bağlanabileceği kamuya açık bir arayüz **bulunamadı**. Uygulamanın yapabileceği: durumu tutmak, hatırlatmak, mal sahibini yönlendirmek.

### Uygulama tasarımı
- Portföyde: **taşınmaz numarası**, **EİDS yetkisi** (verildi / bekliyor / yok) ve **bitiş tarihi** (3 aydan kısa girilirse uyarı); **yetkilendirme sözleşmesi** başlangıç / bitiş (mevcut `yetkili` ve `yetkiBitis` genişler) ve imzalı PDF'i.
- "Bekliyor" için mal sahibine **hazır WhatsApp mesajı**: e-Devlet adımları + ofisin yetki belgesi numarası.
- Bugün panosu görevleri: EİDS bitişine 15 gün kala "uzatma iste"; portföy **Kapandı / satıldı / kiralandı** olunca "**3 gün içinde ilanları kaldır**" (m.14/2-h — uyum görevi, ceza riskini azaltır).
- İlan / paylaşım metni üretilirken m.14/2-i zorunlu alanları (yetki belgesi no, ada / parsel) kendiliğinden eklenir.
- Kartta "EİDS ✓ / bekliyor" rozeti; Ana Sayfa Dikkat şeridine "yetkisi biten portföy" çipi.
- **İş yükü:** ~1 sprint; birkaç yeni sütun için göç ("Kurulumu tamamla").

**Ek bilgi (ileride):** Yönetmeliğe 29.04.2026'da eklenen Ek Madde 1 ile satışlarda ödemenin, mülkiyet ve bedelin eş zamanlı el değiştirdiği bir ödeme sistemi üzerinden yapılması öngörülüyor; zorunluluk 1.12.2026'ya kadar ertelenmiş (Bakanlık 3 aya kadar uzatabilir). Satış sürecinde hatırlatma olarak eklenebilir.

---

## 3) Sesle not

### Hukuki çerçeve
- **Danışmanın kendi sesli notu** (görüşmeden sonra "Ahmet Bey 9 milyona çıkabilir, eşi Kepez istemiyor") için engel yok; içerik zaten yazılı notla aynı kişisel veriyi taşıyor.
- **Müşteriyle görüşmenin kaydedilmesi ayrı konu:** kişiler arasındaki aleni olmayan konuşmayı rıza olmadan kaydetmek **TCK m.133** kapsamında suç riski taşır (ilgili doktrin yazıları). → Uygulama **arama / görüşme kaydı yapmayacak**; mikrofon yalnızca danışmanın kendi notu için açılacak, ekranda bu yazacak.
- **KVKK m.9 (7499 sayılı Kanunla, 1 Haziran 2024'ten beri):** Yurt dışındaki bir servise (tarayıcının ses tanıma servisi, yapay zekâ sağlayıcısı, yurt dışı veritabanı) düzenli veri aktarımı için yeterlilik kararı ya da **standart sözleşme** gerekir; standart sözleşme imzadan itibaren **5 iş günü içinde Kurum'a bildirilir**. Bu, sesle not için yeni değil: **uygulamanın tamamı** (Supabase, yapay zekâ özellikleri) için zaten çözülmesi gereken iş (sprint planındaki KVKK maddesi).

### Uygulama tasarımı
- Notlar / Görüşüldü panelinde 🎤 düğmesi → tarayıcının ses tanıması → metin → (isteğe bağlı) yapay zekâ metinden talep alanlarını ve "sonraki iletişim"i önerir; **kaydetmeden önce danışman onaylar**. Ses dosyası saklanmaz.
- Tarayıcı desteği (Android Chrome, iPhone Safari) sahada denenmeli; desteklemeyen cihazda düğme gizlenir.
- **İş yükü:** ~3–5 gün. Göç yok.

---

## 4) Kira bitişi takibi (ticari kiracılar)

### Hukuki çerçeve — takvimin kendisi fırsat
- **TBK m.347 (konut ve çatılı işyeri):** Belirli süreli sözleşmede kiracı süre bitiminden **en az 15 gün önce** bildirmezse sözleşme aynı koşullarla **1 yıl uzar**; kiraya veren yalnızca süre bitimine dayanarak sözleşmeyi sona erdiremez. **10 yıllık uzama süresi** sonunda kiraya veren, her uzama yılının bitiminden **en az 3 ay önce** bildirimle sebep göstermeden feshedebilir (Hukuki Haber).
- **TBK m.344:** yenilenen dönemlerde kira artışı önceki kira yılının TÜFE 12 aylık ortalamasını aşamaz; 5 yıldan uzun süren sözleşmelerde (ve 5 yıldan sonra yenilenenlerde) yeni kira hâkimce hakkaniyete göre belirlenebilir. (Bu madde metnini araştırmada ayrıca açmadık; şablon öncesi kontrol edilmeli.)
- **KVKK:** Kiracı adı ve sözleşme tarihleri mal sahibinden gelen üçüncü kişi verisi → meşru menfaat (m.5/2-f) ve sözleşmenin ifası; aydınlatma metninde belirtilir. Özel nitelikli veri yok.

### Uygulama tasarımı
- Kiracılı portföyde (`kiracili` alanı zaten var): **kiracı** (rehberden kişi), **kira başlangıcı**, **süre / bitiş**, **aylık kira**, **artış ayı**.
- Otomatik görevler:
  - Bitişe **6 ay** kala: "Kiracıyı ara — devam mı, taşınma mı?" Taşınacaksa tek dokunuşla **yeni talep** (kiracı için yer arama) + portföyde "boşalacak" işareti.
  - Bitişe **30 gün** kala: "Kiracının 15 günlük bildirim süresi yaklaşıyor."
  - Başlangıç + **10 yıl − 3 ay**: mal sahibine "sebep göstermeden fesih hakkı doğuyor" (yeni kiracı / satış fırsatı).
  - Her yıl artış ayında: "kira artışı" hatırlatması; **5. yılda** "kira tespiti" notu.
- **İş yükü:** ~1 sprint; birkaç sütun için göç.

---

## Kaynaklar
- [Taşınmaz Ticareti Hakkında Yönetmelik — LEXPERA konsolide metin (yürürlük 01.10.2026)](https://www.lexpera.com.tr/mevzuat/yonetmelikler/tasinmaz-ticareti-hakkinda-yonetmelik)
- [Taşınmaz Ticareti Hakkında Yönetmelik — orijinal metin (RG 05.06.2018/30442)](https://www.lexpera.com.tr/resmi-gazete/metin/tasinmaz-ticareti-hakkinda-yonetmelik-30442)
- [T.C. Ticaret Bakanlığı — EİDS yetki doğrulama uygulaması hayata geçirildi](https://ticaret.gov.tr/kurumsal-haberler/elektronik-ilan-dogrulama-sistemi-eids-yetki-dogrulama-uygulamasi-hayata-gecirildi)
- [G.O.S. Partners — e-Devlet'ten emlak danışmanına yetki ve EİDS](https://gospartners.com/1269-2/)
- [Milliyet — Emlakta güvenlik kalkanı: yetkisiz dönem sona erdi](https://www.milliyet.com.tr/7541540)
- [Ezcan Hukuk — Yer gösterme belgeleri emlak sözleşmesi niteliğinde midir?](https://muratezcan.av.tr/yer-gosterme-belgeleri-emlak-sozlesmesi-niteliginde-midir)
- [TBK m.520 — simsarlık sözleşmesi ve şekli (içtihat derlemesi)](https://av-saimincekas.com/kanun/turk-borclar-kanunu/madde-520-tbk/)
- [Mynet — Yargıtay'dan emlakçılarla ilgili emsal karar](https://finans.mynet.com/haber/detay/ekonomi/yargitay-dan-emlakci-ve-gayrimenkul-danismanlariyla-ilgili-emsal-olacak-karar/286358)
- [Emlakjet — Yer gösterme belgesi nedir?](https://www.emlakjet.com/blog/yer-gosterme-belgesi-nedir)
- [Devredin — Yer gösterme belgesi](https://devredin.com/sozluk/yer-gosterme-belgesi)
- [İstanbul Bilgi Üniversitesi BTHAM — Biyometrik imza](https://itlaw.bilgi.edu.tr/media/document/2019/08/biyometrik-imza.pdf)
- [Hukuki Haber — Elektronik imza ve DocuSign'ın niteliği](https://www.hukukihaber.net/elektronik-imza-ve-belgeleme-girisimi-docusignin-niteligi-begum-gurel)
- [Moral Hukuk — Elektronik imza uygulamalarının hukuki geçerliliği](https://moral.av.tr/tr/hukuki-haberler/elektronik-imza-uygulamalarinin-hukuki-acidan-gecerliligi-ve-niteligi-766)
- [EmlakCRMx — Emlak sözleşmesinde e-imza (sağlayıcılar)](https://emlakcrmx.com/blog/emlak-sozlesmesinde-e-imza-2026-kurulum)
- [Mıhcı Hukuk — Kişisel verilerin yurt dışına aktarılması (KVKK m.9)](https://mihci.av.tr/kisisel-verilerin-yurt-disina-aktarilmasi/)
- [KVKK — Standart Sözleşme Bildirim Modülü duyurusu](https://www.kvkk.gov.tr/Icerik/8043/Standart-Sozlesme-Bildirim-Modulu-Hakkinda-Kamuoyu-Duyurusu)
- [Hukuki Haber — Konut ve çatılı işyeri kira sözleşmelerinin fesih bildirimi yoluyla sona ermesi (TBK 347)](https://www.hukukihaber.net/konut-ve-catili-is-yeri-kira-sozlesmelerinin-fesih-bildirimi-yoluyla-sona-ermesi)
- [Hukuki Haber — Telefon görüşmesini kayda almak ve TCK 133](https://www.hukukihaber.net/kisinin-karsi-tarafla-yapmis-oldugu-telefon-gorusmesini-kayda-almasinin-haberlesmenin-gizliligini-ihlal-tck-1323-sucu-kapsaminda-kisa-bir-incelemesi)
