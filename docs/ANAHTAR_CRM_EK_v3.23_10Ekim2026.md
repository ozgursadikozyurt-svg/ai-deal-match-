# Anahtar CRM — Ek: v3.23 Gelen Kutusu (onay bekleyenler) · e-posta girişi · Revy dökümü düzeltmeleri (10 Ekim 2026)

## Amaç (kullanıcı isteği, 10 Ekim)
1. Revy'den alınan Excel dökümü (sahibinden / hepsiemlak / emlakjet'teki sahibinden ilanlar) ve emlakçı WhatsApp grubu sohbetleri günde bir, olabildiğince otomatik ve ücretsiz Anahtar CRM'e girsin.
2. Mükerrer kontrolü ve "onay bekleyen" havuzu: yığılacağı için tarihe göre gruplu, kaynak seçimli, toplu işlemli, anlaşılır; "Tümünü temizle" olsun.
3. Mail sistemi kurulsun: WhatsApp dışa aktarımı (zip içinde txt) e-postayla gönderilebilsin.

## Kararlar ve gerekçeleri
- **Portallar kazınmaz; Revy toplayıcıdır.** Kullanıcı ücretli Revy üyesi ve "Excel'e Aktar" sunulan bir özellik. Doğrudan kazıma: sahibinden agresif bot koruması + hesap kısıtlama riski + kullanım koşulları / KVKK. Bedeli: Revy dışa aktarımı elle (≈ 1 dk/gün).
- **WhatsApp: resmi "Sohbeti dışa aktar".** Meta Groups API mevcut gruplara giremez (yalnızca işletmenin kurduğu, ≤ 8 kişilik gruplar); resmi olmayan kütüphaneler (Baileys, whatsapp-web.js) numara kapatma riski taşır — v3.x kararı korunur.
- **Sunucu dosyayı açmaz.** Cloudflare ücretsiz planda istek / e-posta başına 10 ms işlemci (v3.22.2'deki 503'lerin nedeni). Sunucu yalnızca özet alır (SHA-256, yerel), depoya koyar, künye yazar. Zip, Excel, MIME ve mükerrer denetimi **tarayıcıda**. Ölçüm (gerçek Revy dökümü, 1.000 satır, 182 KB xlsx): aç 150 ms + aday çıkar 570 ms (Node); tarayıcıda yükle → listele ≈ 1,5 sn; 660 kaydı atla 0,5 sn; 839 kaydı ekle 1,6 sn.
- **E-posta taşıması iki yollu.** (a) Kalıcı: Cloudflare Email Routing → Worker `email()` — alan adı ister (workers.dev posta alamaz). (b) Bugün: Gmail köprüsü (kullanıcının kendi hesabında Apps Script; `+anahtar` takma adına gelen ekleri `POST /api/gelen/al`'a yollar). İkisi de aynı servise (`gelenAl`) düşer. Uygulamaya Gmail okuma izni (gmail.readonly, kısıtlı kapsam) eklenmedi: tüm postayı okuma yetkisi gereksiz geniş ve çok ofisli satışta Google güvenlik denetimi ister.
- **Aday = türetilmiş veri.** Bekleyen kayıtlar veritabanında satır değildir: ham dosya + "atlanan anahtarlar" saklanır, adaylar her açılışta dosyadan yeniden türetilir ve havuzla karşılaştırılır. Eklenen kayıt havuzdaki ilan no / metin izinden tanınıp kendiliğinden düşer; ayrı "eklendi" durumu tutulmaz, tutarsızlık olmaz. `durumGetir` (uygulama açılışı) ağırlaşmaz.

## Mimari
```
Revy "Excel'e Aktar" ─┐                      ┌─ ekrandan yükleme  POST /api/gelen (oturumlu)
WhatsApp dışa aktar ──┼─ e-posta ─ Gmail köprüsü ─ POST /api/gelen/al (x-anahtar = ofisin gizli kodu)
                      └─ e-posta ─ Cloudflare Email Routing ─ Worker email()  (<kod>@alanadi)
                                         │
                       services/gelen.ts › gelenKaydet: tür + SHA-256 + depo ("gelen" kovası) + gelen_dosya künyesi
                                         │
tarayıcı: GET /api/gelen → imzalı bağlantıdan indir → demo/gelen-oku.ts (eml → ek → zip → txt / xlsx)
        → demo/gelen-aday.ts hamAdaylar (tablo: tablo.ts · sohbet: whatsapp.ts + kurallar) → durumla (havuz + atlanan + kutu içi kopya)
        → demo/gelen-kutusu.tsx (gruplar, süzgeç, toplu işlem) → Ekle = topluEkle → kayıt kuyruğu → /api/durum
```

## Veri modeli (migration `20261010100000_v323_gelen_kutusu`, yalnızca ekleme)
- `gelen_dosya`: id, ofisId, ad, tur (eml·zip·txt·xlsx·csv), boyut, ozet (SHA-256; `(ofisId, ozet)` tekil), kanal (EPOSTA·KOPRU·YUKLEME), gonderen, konu, depoYolu, createdAt.
- `gelen_atlanan`: (ofisId, anahtar) — "atla / temizle" denen kayıtlar. Anahtar: portal ilanı `i:<ilan no>` / `u:<bağlantı özeti>`; tablo satırı `s:<özet>`; WhatsApp `w:<metin özeti>[#sıra]`.
- `ofis.gelenKod`: 20 karakter (≈ 100 bit), küçük harf + rakam; e-posta adresinin yerel kısmı ve köprü anahtarı. İlk istekte üretilir, yenilenebilir.
- İki tablo `OFIS_MODELLERI`'nde (ofis süzgeci zorunlu), RLS açık / politika yok. Depo: ayrı özel kova `gelen` (ilk yüklemede kendiliğinden oluşur; yol `<ofisId>/<yyyy-aa>/<id>.<tür>`).

## API
| Yol | Kim | Ne |
|---|---|---|
| `GET /api/gelen` | oturum | dosyalar + 1 saatlik indirme bağlantıları |
| `POST /api/gelen` (multipart `dosya`) | oturum | yükleme; aynı içerik → `{ yeni: false }` |
| `DELETE /api/gelen?id=a,b` / `?hepsi=1` | oturum | künye + depo |
| `GET /api/gelen/:id/dosya` | oturum | ham gövde (imzalı bağlantıya ulaşılamazsa) |
| `GET / POST / DELETE /api/gelen/atlanan` | oturum | atlanan anahtarlar |
| `GET /api/gelen/adres` · `POST { yenile }` | oturum · yönetici | kod, e-posta adresi (GELEN_ALAN_ADI varsa), köprü adresi |
| `POST /api/gelen/al` | **oturumsuz**, `x-anahtar` | köprü; 201 / 200 / 401 / 413 / 415 |
| Worker `email()` | Email Routing | `.eml` olarak saklar; tanınmayan adres ve > 15 MB geri çevrilir |

Oturumsuz giriş yalnızca onay bekleyenlere dosya bırakır; hiçbir şey okuyamaz, havuza kayıt yazamaz. Kod yanlışsa veritabanına yazılmaz. Sınırlar: 15 MB / dosya, 200 dosya / ofis; zamanlayıcı (03:00 UTC) 45 günden eski dosyaları ve 1 yıldan eski atlananları siler.

## Ekran (demo/gelen-kutusu.tsx)
- Özet: onay bekliyor · hazır · kontrol gerekli · fiyatı değişti (· eksik / hatalı); gösterilmeyenler satırı (zaten var · kutu içi mükerrer · atlandı).
- Gruplama: ilan / mesaj tarihi (varsayılan) · geliş günü · kaynak. Son 14 gün gün gün, eskiler ay ay, tarihsizler ayrı; ilk iki grup açık; grup başına 20 kart + "Daha fazla".
- Süzgeç: kaynak, portal / grup, tür (Ticari · Konut · Arsa), işlem, tip, arama. Çip sayıları diğer süzgeçlere göre hesaplanır.
- İşlem: kart (Ekle · Düzenle → form · Atla · Orijinal · İlanı aç), grup (Hazırları ekle · Seç · Grubu atla), toplu (Tümünü / Hazırları seç, Seçilenleri ekle / atla, Fiyatları güncelle), Tümünü temizle (onaylı), Atla → Geri al, Atlananları geri getir.
- Dosyalar bölümü: dosya başına bekleyen / toplam, uyarılar, Sil; WhatsApp dosyasında "✦ Yapay zekâyla oku" (dosyayı Veri Girişi › WhatsApp ekranına devreder; kuralların emin olamadığı mesajlar için mevcut yapay zekâ akışı).
- Bekleyeni kalmayan dosya, kutu yüklenirken kendiliğinden silinir (açılamayan dosya uyarısıyla kalır).

## Revy dökümü düzeltmeleri (src/lib/ingest/tablo.ts, src/lib/ai/jargon.ts)
Gerçek döküm (10 Ekim, 1.000 satır: 852 sahibinden · 94 Hepsiemlak · 53 Emlakjet; 667 konut · 247 ticari · 77 arsa):

| | Önce | Sonra |
|---|---|---|
| Şemadan dönen (hatalı) | 17 | 0 |
| "Mülk tipi bulunamadı" | 79 | 30 |
| Arsa → daire / villa sayılan | 25 | 0 |
| Başlığı "devren" deyip sütunu "Hayır" olan (düz kiralık / satılık sayılıyordu) | 73 | 0 |

- `jargon.ts`: `otoparkDurumu: true` ve `tapuTipi: "MUSTAKIL"` şemada olmayan değerlerdi → "otoparklı" / "müstakil tapu" geçen her ilan (WhatsApp dahil) reddediliyordu. Artık ACIK / KAPALI ve MUSTAKIL_PARSEL.
- `mulkTuruOku`: portal kategori sözlüğü (`PORTAL_TUR`); arsa kategorisinde tür = imar (`ARSA_IMAR` → `ozellik.imarDurumu`); sütun "Ticari" iken başlıktan konut tipi çıkarılmaz; türsüz ticari ilanda işletme adı (`ISLETME`).
- Devren: sütun **ya da** başlıktaki "devren / devir". "Devren kiralık" + tutar ≥ 150.000 TL ve (m² yok ya da ≥ 1.500 TL/m²) → Devren Satılık, toplam, not; tutar büyük ama m²'ye göre düşük → Devren Kiralık + kontrol.
- Akıl denetimi: kira ≥ 1.000.000 ya da ticari kira ≥ 5.000 TL/m²; kira < 5.000; satış < 100.000; devir < 10.000 → Kontrol gerekli.

## Bilinen sınırlar / doğrulanmayanlar
1. **Canlıda uçtan uca denenmedi.** Testler PGlite + taklit depo + JSDOM ile; arayüz gerçek tarayıcıda (masaüstü + telefon boyutu) demo üzerinde ve gerçek Revy dosyasıyla denendi. Supabase Storage'a gerçek yükleme, imzalı bağlantıdan tarayıcı indirmesi (CORS) ve Cloudflare'de `email()` canlıda doğrulanmalı. İmzalı bağlantı çalışmazsa arayüz kendiliğinden `GET /api/gelen/:id/dosya`'ya düşer.
2. **Gmail köprüsü betiği gerçek Google hesabında çalıştırılmadı** (sahte Apps Script ortamında sınandı: arama sorgusu, tür süzgeci, başlık kodlaması, etiketleme, hata davranışı).
3. Revy dışa aktarımı elle; "yayından kalktı" tespiti yok.
4. WhatsApp adayları kurallarla okunur; emin olunamayanlar "Kontrol gerekli". Yapay zekâ için dosya Veri Girişi'ne devredilir (Gelen Kutusu içinde toplu yapay zekâ yok).
5. `yapi:` mükerrer anahtarı ad + özellik bandına dayanır; baş harfi aynı iki farklı mal sahibinin çok benzer iki ilanı kutu içinde tek sayılabilir ("Mükerrerleri göster"de görünür).
6. Aynı WhatsApp grubunun her gün dışa aktarımı tüm geçmişi içerir: eski mesajlar atlanan / havuz izinden elenir, ama dosya her seferinde baştan okunur (10.000+ mesajlı grupta birkaç saniye).

## Testler
`tests/v323.test.ts` (15: tür, tarih grupları, anahtarlar, köprü betiği sahte ortamda, jargon, portal türleri / arsa imarı, Revy satırı + devren + akıl denetimi, dosya açma, mükerrer + fiyat değişimi, atlananların hatırlanması, WhatsApp, demo deposu, ekran, Ana Sayfa kartı + biten dosya, sürüm / kurallar) ve `tests/v323-db.test.ts` (6: kayıt + depo, ofis ayrımı + kod, rotalar, alan adına e-posta, temizlik). `tests/v317.test.ts` otopark beklentisi düzeltildi.
