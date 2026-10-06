# Emlak Jargon Sözlüğü — Anahtar CRM

Bu dosya, WhatsApp mesajlarında ve ilan metinlerinde kullanılan kısaltma ve deyimlerin sistemdeki karşılığıdır.
**Kurallar koda da işlenmiştir:** `src/lib/ai/jargon.ts`. Yapay zekâ çağrısından **önce** bu kurallar çalışır; ne kadar çok jargon kuralla çözülürse o kadar az yapay zekâ kullanılır (ve kota harcanır).

Yeni bir kural eklerken: önce bu dosyaya satırı yazın, sonra `src/lib/ai/jargon.ts` içine karşılığını ekleyin, `tests/v317.test.ts`'e bir örnek koyun.

---

## 1. Fiyat okuma

Fiyat, **satılık mı kiralık mı** olduğuna göre yorumlanır. Kiralıkta küçük sayılar bin, satılıkta milyon kabul edilir.

| Yazılan | Okunan | Kural |
|---|---|---|
| `17 MTL`, `17 M TL`, `5.7 M TL` | 17.000.000 / 5.700.000 | M / MTL / MN = milyon |
| `15.5 TL` (satılık) | 15.500.000 | Satılıkta 1.000'in altı → milyon |
| `7.500` (kiralık) | 7.500 TL | Kirada olduğu gibi |
| `7.500` (satılık) | 7.500.000 | Satılıkta 100.000'in altı → bin katı |
| `25 bin` (kira) | 25.000 TL | bin = 1.000 |
| `13500 000` | 13.500.000 | Boşlukla bölünmüş binlik birleştirilir |
| `3.250.000.-TL`, `₺35.000`, `$250.000` | 3.250.000 TL / 35.000 TL / 250.000 USD | Para birimi normalleştirilir |

Telefon numaralarına dokunulmaz: `0532 111 22 33` birleştirilmez.

## 2. Kat jargonu

| Yazılan | Okunan |
|---|---|
| `8/9`, `12/6` | Küçük sayı bulunduğu kat, büyük sayı bina kat sayısı (`8/9` = 9 katlının 8'i) |
| `3. kat` | Bulunduğu kat 3 |
| `5 katlı` | Bina kat sayısı 5 |
| `katta`, `arakat`, `ara kat` | Ara kat (talepte "ARA" seçeneği) |
| `yüksek giriş`, `giriş kat`, `zemin kat`, `bahçe katı` | Zemin / giriş kat (0) |
| `son kat`, `çatı katı` | Son kat (talepte "SON") |
| `bodrum kat` | -1 |

Talepte bu ifadeler **istenen katlar** alanına (çoklu seçim), portföyde **bulunduğu kat** alanına yazılır.

## 3. Bina ve teknik özellikler

| Yazılan | Alan | Değer |
|---|---|---|
| `SIFIR`, `sıfır bina`, `yeni bina` | Bina yaşı | 0 |
| `15 yıllık`, `15 yaşında` | Bina yaşı | 15 |
| `full krediye açık`, `krediye uygun`, `kredi sınırı bulunmayan` | Krediye uygun | evet |
| `takaslı`, `takasa açık`, `takas olur` | Takasa açık | evet |
| `iskanlı`, `iskan var` | İskan | evet |
| `ebeveyn banyolu` | Ebeveyn banyosu | evet |
| `kapalı otopark`, `açık otopark`, `otoparklı` | Otopark | evet |
| `havuzlu` | Havuz | evet |
| `asansörlü` | Asansör | evet |
| `site içinde`, `güvenlikli site` | Site içinde | evet |
| `deniz manzaralı` | Deniz manzarası | evet |
| `dubleks`, `dublex`, `ters dubleks` | Dubleks | evet |
| `0.70 emsal`, `emsal 0,70` | Emsal (KAKS) | 0,70 |
| `tek tapu tek imza`, `müstakil tapu` | Tapu tipi | Müstakil |

## 4. Alan karşılığı olmayan jargon → "Notlar"

Aşağıdakiler teknik bir alana çevrilmez; bilgi kaybolmasın diye kaydın **operasyon notuna** yazılır.
(Zamanla sık kullanılanlar alan haline getirilir.)

| Yazılan | Nota düşen |
|---|---|
| `yabancıya satışa uygun`, `vatandaşlığa uygun`, `ikamet ve yabancı` | Yabancıya satışa / vatandaşlığa uygun |
| `Eminevim`, `Katılımevim`, `Fuzulev` | Faizsiz finansman sistemine uygun |
| `kapalı portföy`, `ilan dışı`, `direk sunum` | Kapalı portföy — ilan sitelerinde yayınlanmıyor |
| `paylaşıma açık`, `birlikte satalım` | Paylaşıma açık (birlikte satalım) |
| `al sata uygun`, `emsallerinin altında`, `kelepir` | Al-sat / emsallerinin altında fırsat |
| `kentsel dönüşüm` | Kentsel dönüşüm |
| `kat karşılığı` | Kat karşılığı |
| `içi yapılı`, `masrafsız`, `tadilatsız` | İçi yapılı / masrafsız |
| `GES'e uygun`, `güneş enerjisi` | GES'e uygun |
| `marjinali alınmış`, `marjinal raporu var` | Marjinal tarım arazisi raporu |
| `amerikan mutfak`, `açık mutfak` | Amerikan (açık) mutfak |
| `ayrı mutfak`, `kapalı mutfak` | Ayrı (kapalı) mutfak |
| `bahçe katı`, `bahçe dubleksi` | Bahçe katı / bahçe dublesi |
| `nakit alım` | Nakit alım |

## 5. İşlem ve havuz terimleri

| Terim | Karşılığı |
|---|---|
| Talep | Müşterinin aradığı mülk |
| Portföy | Satış / kiralama yetkisi olan mülk |
| Kapalı portföy / ilan dışı / direk sunum | İlan sitelerinde yayınlanmayan mülk |
| Paylaşıma açık / birlikte satalım | Komisyon paylaşımına açık portföy (partner havuzu) |
| Devren kiralık / devren satılık | İşletme hakkının eşya, dekorasyon ve ruhsatla devri |
| Sunum | Mülkün alıcıya / kiracıya gösterilmesi |

## 6. Sistem bunu nasıl öğreniyor?

- **Kurallar** (bu dosya + `jargon.ts`): her metinde bedelsiz çalışır.
- **Konum öğrenme** (var olan): tanınmayan mahalle / alt bölge adları "öğrenilen konumlar" listesine düşer; onayladığınızda kalıcı olur (Ayarlar › Konumlar).
- **Yapay zekâ**: yalnızca kurallarla çözülemeyen metinler için çağrılır. Çıkardığı teknik özellikler kayda, çözemediği ifadeler nota yazılır.

**Sık tekrar eden bir ifadeyi nota düşerken görüyorsanız** bu dosyaya ve `jargon.ts`'e kural olarak ekleyin: o andan sonra yapay zekâ gerekmez.
