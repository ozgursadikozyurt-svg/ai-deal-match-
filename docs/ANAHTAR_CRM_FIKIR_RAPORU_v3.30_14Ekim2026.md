# Anahtar CRM — Geliştirme Fikir Raporu (v3.30 · 14 Ekim 2026)

**Amaç:** v3.0 → v3.30 sürüm geçmişini, piyasadaki emlak CRM'lerini ve Türkiye'deki mevzuat değişikliklerini karşılaştırıp, Anahtar CRM'e **kullanımda gerçekten iş kazandıracak** yenilikleri öncelik sırasıyla belirlemek.

## 1) Bugün elimizde ne var (sürüm geçmişinden)
Güçlü olduğumuz yerler — rakiplerde nadir:
- **WhatsApp grubu / Revy / Excel → yapılandırılmış havuz** (v3.2–v3.24): Türkiye'de emlakçının asıl veri kaynağı WhatsApp grupları; yabancı CRM'ler bunu hiç okumuyor.
- **Eşleştirme motoru** (olmazsa olmaz kriterler, mahalle komşuluğu, eksik veri cezası, fırsat önceliği, Var/Yok hızlı cevap — v3.3–v3.29).
- **Bugün panosu + Görevler** (v3.25–v3.26), **İlgilenenler**, **Benim / Ofisim**, **çok ofisli altyapı ve açık kayıt** (v3.20, v3.26).

Zayıf ya da hiç olmayan yerler:
- **Sahadaki belgeler** (yer gösterme, yetki / EİDS) uygulamanın dışında, kâğıtta.
- **Harita** yok; ticari gayrimenkulde müşteri konuma bakarak karar veriyor.
- **Piyasa verisi** (m² fiyat / kira) havuzda birikiyor ama hiç gösterilmiyor.
- **Mobil hız**: not yazmak telefonda yavaş; sesle giriş yok.
- **Müşteri davranışı** görünmüyor (föyü açtı mı, kaç kez baktı).

## 2) Piyasa ne yapıyor (araştırma özeti)
- Emlak CRM'lerinde 2026'nın öne çıkanları: otomatik takip planları, yapay zekâ ile mesaj taslağı, **davranışa göre uyarı** ("bu müşteri ilanı 3 kez açtı, ara"), müşteriye **otomatik ilan eşleştirme bildirimi**, mobil uygulama ve bildirim. (iHomefinder, The Close, aimadefor karşılaştırması)
- Follow Up Boss "akıllı listeler" ve "şimdi ara" önerileriyle; Lofty yapay zekâ asistanı (mesajla ön eleme, randevu) ve davranışa göre eşleşme gönderimiyle öne çıkıyor; Top Producer'ın "Follow-Up Coach"u her gün kimin aranacağını söylüyor — bizim Bugün panosu bunun karşılığı.
- **Ticari gayrimenkul CRM'leri** (AscendixRE, Rethink, VTS): **mülk merkezli veri**, **harita ile arama**, **emsal (comps) raporu**, **kira bitiş tarihi takibi ve hatırlatma**, kiracı temsilciliği süreçleri, komisyon takibi. (Ascendix — kendi ürününü sattığı için sıralaması taraflı)
- **WhatsApp Business API**: ilan kataloğu, şablon mesaj, gösterim randevusu ve hatırlatma; mesaj başına ücret ve **izin (opt-in) zorunluluğu** var. (GreenTick)

## 3) Türkiye'de mevzuat fırsatı — en güçlü ayrışma noktası
- **EİDS (Elektronik İlan Doğrulama Sistemi):** 15 Şubat 2026'dan beri tüm satılık ilanlar için zorunlu; mal sahibi e-Devlet'ten emlak işletmesine ilan yetkisi vermeden ilan yayımlanamıyor, yetkisiz ~200.000 ilan kapatıldı. (Milliyet)
- **Yer gösterme belgesi:** Taşınmaz Ticareti Yönetmeliği'ne göre imzalatılması gereken belge; doldurulmazsa alıcı emlakçıyı devre dışı bırakıp mal sahibiyle doğrudan anlaşabilir; hizmet bedelinin icra / mahkeme yoluyla tahsili bu belgeye dayanır. (Emlakjet)
- İlanlarda **yetki belgesi numarası** zorunlu; hizmet bedeli satışta en çok %4, kirada en çok bir aylık kira. (Ticaret Bakanlığı)

→ Danışman bu belgeleri her gün kâğıtta, WhatsApp'ta ya da hiç tutmuyor. **"Belgesi tam, komisyonu güvende"** Anahtar CRM'in Pro'ya geçiş gerekçesi olabilir; yabancı rakiplerin hiçbiri bunu yapamaz.

## 4) Öneriler — öncelik sırasıyla (gerekçeli)
Sıralama ölçütü: (a) komisyonu koruyor ya da iş getiriyor mu, (b) elimizdeki veriyi mi kullanıyor (yeni veri girişi istemiyor mu), (c) ücretsiz altyapıda çalışır mı, (d) günlük alışkanlığı güçlendiriyor mu.

### Öncelik 1 — sıradaki iki sprint
1. **Dijital yer gösterme belgesi.** İlgilenenler'de "Gösterildi" seçilince belge hazır gelir: portföy adresi ve özellikleri, müşteri adı / telefonu, tarih, hizmet bedeli oranı (%4 / bir aylık kira tavanını aşınca uyarır). Müşteri telefonda parmağıyla imzalar → PDF fotoğraf deposuna, kaydın altına; müşteriye WhatsApp'tan kopyası gider. *Gerekçe:* komisyon kaybını doğrudan önler; veri zaten İlgilenenler'de var; ek maliyet yok. *Not:* T.C. kimlik numarası yalnızca PDF'te durmalı, veritabanında alan olarak tutulmamalı (KVKK); metni avukata onaylatın.
2. **EİDS / yetki takibi.** Portföyde "e-Devlet ilan yetkisi: verildi / bekliyor / yok" ve bitiş tarihi; "bekliyor" olan için mal sahibine hazır WhatsApp mesajı (e-Devlet adımlarıyla), bitişe 10 gün kala Bugün panosuna görev (yetki belgesi kuralı v3.25'te zaten var, genişletilir). Kartta küçük "EİDS ✓" rozeti. *Gerekçe:* Şubat 2026'dan beri yetkisiz satış ilanı yayımlanamıyor — portföy yönetiminin ilk adımı oldu.
3. **Sesle not ve sesle kayıt.** Görüşme sonrası mikrofon düğmesi: tarayıcının ses tanıması (ücretsiz) metne çevirir; yapay zekâ metinden talep / portföy alanlarını ve "sonraki iletişim"i çıkarır, Görüşüldü düğmesine bağlanır. *Gerekçe:* telefonda en yavaş iş not yazmak; Bugün panosundaki "Görüşüldü" akışını 10 saniyeye indirir.
4. **Kira bitişi takibi (ticari kiracılar).** Kiracılı portföyde kiracı adı + kira bitiş tarihi; 6 ay kala "kiracıyı ara: yer değiştirecek mi?" görevi → olumluysa tek dokunuşla yeni talep. Mal sahibi tarafında da "kira yenileme / boşalma" fırsatı. *Gerekçe:* ticari CRM'lerin temel özelliği; uzmanlığınız olan depo / dükkân / fabrika segmentinde talep üretir.

### Öncelik 2 — betadan sonra
5. **Piyasa nabzı (emsal).** Havuzdaki aktif ve geçmiş kayıtlardan ilçe / mahalle × mülk tipi için m² satış ve kira medyanı, son 90 gün eğilimi; portföy detayında "fiyat bölge medyanının %18 üstünde" uyarısı; mal sahibine gösterilecek tek sayfalık emsal föyü. *Gerekçe:* veri zaten birikiyor (Gelen kutusu fiyat değişimlerini de yakalıyor); mal sahibine fiyat düşürtmenin en güçlü aracı; Antalya ticari gayrimenkulünde böyle bir yerel endeks yok — otorite hedefinize de hizmet eder.
6. **Harita görünümü.** Portföy ve talepler mahalle merkezine göre haritada (OpenStreetMap, ücretsiz); talebin aradığı bölge çizili, içine düşen portföyler. *Ön koşul:* mahallelere enlem / boylam eklemek (veri setinde yok, bir kez yüklenir).
7. **Föy açılma bildirimi.** Paylaşılan portföy föyü bağlantıyla açılınca "Ahmet Bey föyü 3 kez açtı" → Bugün panosunda sıcak görev. *Gerekçe:* rakiplerin en çok övülen özelliği (davranışa göre uyarı); bizde paylaşım föyü zaten var.
8. **Talep yayını (tersine arama).** Talepten anonim, emlakçı gruplarına uygun metin: "Kepez'de 500 m² TIR girişli depo arıyorum, bütçe 120 bin TL/ay — portföyü olan yazsın". Tek dokunuşla WhatsApp. *Gerekçe:* emlakçı gruplarında zaten yapılan iş; havuzda karşılığı olmayan talepler için portföy toplar.
9. **Komisyon ve gelir panosu.** Kapandı / Anlaştı eşleşmelerinden beklenen hizmet bedeli (yasal tavanla hesaplı), aylık gerçekleşen, iş ortağı paylaşımı. *Gerekçe:* ofis yöneticisinin Pro'yu satın alma sebebi (ekip performansı).
10. **Sabah özeti bildirimi** (sprint planında): telefonu açmadan "2 geciken, 5 bugün, 3 kaydın süresi doldu". Alışkanlık için en etkili tetik.

### Öncelik 3 — Pro+ / sonra
11. **Ortak havuz + Dijital El Sıkışma** (ofisler arası paylaşım ve komisyon paylaşımı kuralı) — açık kayıtla gelen ofis sayısı arttıkça değeri katlanır.
12. **Yabancı alıcıya çok dilli föy** (EN / RU / DE yapay zekâ çevirisi, döviz gösterimi) — Antalya konut ve yatırım segmenti için.
13. **WhatsApp Business API ile otomatik ön eleme / eşleşme bildirimi** — mesaj başına ücret ve izin (opt-in) zorunluluğu var; ancak ödeme alan ofisler varken mantıklı.

## 5) Kullanılabilirlik turu — bu sürümde yapılanlar ve sıradakiler
Yapıldı (v3.30): Dikkat şeridi en üstte (süresi dolan / 5 gün / 14 gün + Dolanlara +30 + Geri al), çakışma uyarısı şeride taşındı, Benim ve ofisim telefonda tek satır, Acil talepler ilk 3.

Sıradaki küçük ama etkili işler:
- **Hızlı ekle düğmesi** (sağ altta "+"): talep / portföy / görev / sesli not — her ekrandan.
- **Arama her yerde**: üst çubukta tek kutu; kişi, kayıt, telefon numarası.
- **Kart yoğunluğu**: listede "kısa görünüm" (tek satır) seçeneği — 300 portföyde kaydırmayı yarıya indirir.
- **Boş durum yönlendirmeleri**: yeni ofis için "ilk WhatsApp dosyanı yükle" adımları (sprint planındaki ilk giriş sihirbazı).
- **Bugün panosunda eşleşme görevlerinde portföy fotoğrafı** küçük — kimin aranacağını hatırlamayı hızlandırır.

## 6) Önerilen sıralama (karar)
v3.31: Dijital yer gösterme belgesi → v3.32: EİDS / yetki takibi → v3.33: Sesle not → v3.34: Kira bitişi. Ardından beta geri bildirimine göre Piyasa nabzı ve Harita.
Gerekçe: ilk ikisi yasal zorunluluğa dayanıyor (danışman "olmasa olmaz" der, Pro'ya ödeme gerekçesi), mevcut veriyle çalışıyor ve rakiplerde yok; üçüncüsü günlük kullanım hızını, dördüncüsü uzmanlık segmentinizde yeni iş getiriyor.

## Kaynaklar
- [Real Estate CRM Features 2026 — iHomefinder](https://www.ihomefinder.com/blog/agent-and-broker-resources/real-estate-crm-features-2026/)
- [The 8 Best CRM Software for Real Estate in 2026 — The Close](https://theclose.com/best-real-estate-crm/)
- [Lofty vs Follow Up Boss vs KVCore — aimadefor](https://www.aimadefor.com/blog/lofty-vs-followupboss-vs-kvcore-realtors/)
- [Top 11 Commercial Real Estate CRMs in 2026 — Ascendix](https://ascendix.com/blog/top-commercial-real-estate-crm/)
- [WhatsApp Business API for Real Estate 2026 — GreenTick](https://greentick.ai/blogs/whatsapp-api-for-real-estate/)
- [Emlakta güvenlik kalkanı: Yetkisiz dönem sona erdi (EİDS) — Milliyet](https://www.milliyet.com.tr/7541540)
- [Yer Gösterme Belgesi Nedir? — Emlakjet](https://www.emlakjet.com/blog/yer-gosterme-belgesi-nedir)
- [Emlakçılık faaliyetlerinde yeni düzen — T.C. Ticaret Bakanlığı](https://ticaret.gov.tr/haberler/emlakcilik-faaliyetlerinde-yeni-duzen)
