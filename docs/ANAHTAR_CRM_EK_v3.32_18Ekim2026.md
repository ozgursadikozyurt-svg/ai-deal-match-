# Anahtar CRM — Ek v3.32 · 18 Ekim 2026

**Konu:** Asistan rolü · değiştirilemez ilk kaynak · ilk yanıt süresi
**Bağlam:** `docs/ANAHTAR_POLARIS_KARAR_v1.1_18Ekim2026.md` › Anahtar'da uygulama sırası › 1. adım. İşlem / komisyon zinciri Anahtar'a taşınacak; bu sürüm o zincirin başını (kaynak) kilitler ve asistanın çalışacağı rolü açar.

## 1. Asistan rolü

| | Asistan | Danışman | Ofis yöneticisi |
|---|---|---|---|
| Kayıt / kişi / eşleşme oku-yaz, not, görev, yapay zekâ, fotoğraf | ✓ | ✓ | ✓ |
| Kayıt ve kişi silme (`kayit.sil`) | — | ✓ | ✓ |
| CSV / JSON dışa aktarma (`kayit.disaAktar`, yeni) | — | ✓ | ✓ |
| Ofis ayarları (`ofis.ayarlar`) | — | — | ✓ |
| İlk kaynağı düzeltme (`kaynak.duzelt`, yeni) | — | — | ✓ |

- **Görünürlük** (`src/lib/kiracilik.ts › gorunurlukSuzgeci`): asistan = ofis ortak kayıtları + kendi + **yardım ettiği kullanıcının** özel kayıt ve kişileri. `kullanici.yardimEdilenId` boşsa danışman gibi görür.
- **Sahiplik** (`src/lib/services/istek.ts › istekSahibi`): `POST /api/durum` ve `kayitOlustur` yeni kayıt ve kişiye `sahipKullaniciId` yazar. Asistanın açtığı kayıt yardım ettiğine aittir (asistan değişse de veri danışmanda kalır). v3.32'ye kadar arayüzden açılan kişilerin sahibi boş kalıyordu; migration bunları ofisin ilk aktif yöneticisine bağladı.
- **Davet:** rol Asistan seçilirse kabulde `yardimEdilenId = davet.olusturanId`. Yönetim › Kullanıcılar'da "Yardım ettiği" seçimiyle değişir; rol asistan dışına çekilince bağ silinir. Yardım edilen aynı ofisten, asistan olmayan biri olmalı.
- **Sunucu kapıları** (`src/lib/services/durum.ts › degisiklikUygula`):
  - `kayitSil` / `kisiSil`: yetki yoksa her kimlik için `hatalar`a "Silme yetkiniz yok"; hiçbir şey silinmez.
  - `ayarlar.{ttl, ai, paylasim, calismaIli, roller, sahiplik}`: `ofis.ayarlar` yoksa yazılmaz, `uyarilar`a düşer. `gorevler` ve `ilgilenenler` herkesin.
  - `GET /api/disa-aktar`: `kayit.disaAktar` ister (403).
- **Arayüz** (`demo/yonetim.tsx › yetkiAktif`): canlıda oturum yetkileri, demoda "rol olarak görüntüle" seçimi. Kişiler › Toplu sil gizli; Ayarlar kilitli (`fieldset disabled`) ve Dışa aktar kapalı.

## 2. İlk kaynak (değiştirilemez)

Kurallar tek yerde: `src/lib/domain/ilk-kaynak.ts › ilkKaynakKarari` (sunucu ve form aynı işlevi kullanır).

- **Alanlar** (`kayit`): `ilkKaynak` (kod), `ilkKaynakDetay` (kampanya / liste adı, ≤200), `ilkKaynakTarihi`, `ilkYanit`. İndeks: `(ofisId, ilkKaynak)`.
- **Kodlar:** `META_REKLAM`, `GOOGLE_REKLAM`, `REKLAM`, `WEB_SITESI`, `ORGANIK`, `FSBO_ARAMA`, `ESKI_MUSTERI`, `KURUMSAL`, `REFERANS`, `EMLAK_GRUBU`, `SAHIBINDEN`, `PORTAL`, `SAHA`, `DIGER`. Rapor grupları: Reklam · Telefonla edinme · Referans · Organik · Dış havuz · Saha · Diğer (`KAYNAK_GRUBU`).
- **"Kaynak" seçicisinden farkı:** `src/lib/domain/kaynak.ts` kaydın havuzunu anlatır ve kayıt portföyünüze dönüşünce değişir. İlk kaynak değişmez; reklam ve asistan performansı bununla ölçülür.
- **Kural:**
  1. Oluştururken: seçildiyse o, değilse `tahminIlkKaynak` (müşteri kaynağı → kanal → havuz); emin değilse boş. Zaman = sunucu anı (içe aktarmada geçmişteki `olusturma`; gelecek tarih kabul edilmez).
  2. Boşsa herkes bir kez doldurur.
  3. Doluysa yalnızca `kaynak.duzelt`; değişiklik `audit_log`'a (`alan = ilkKaynak | ilkKaynakDetay`, eski / yeni) yazılır. Yetkisiz değişiklik kaydı reddetmez: alan eski değerinde kalır, yanıtta `uyarilar` döner, arayüz kısa bildirim gösterir.
  4. `ilkKaynakTarihi` ve `ilkYanit` istemciden alınmaz.
- **İlk yanıt:** kayda ilk `ARAMA` / `WHATSAPP` / `GORUSME` / `GOSTERIM` notu sunucuya düştüğü an (not tarihi değil: not geriye tarihlenebiliyor). Bir kez yazılır. Süre: `yanitDakika(ilkKaynakTarihi, ilkYanit)`. Mesai dışı düzeltmesi raporda (6. adım) yapılacak.
- **Migration** `20261018100000_v332_asistan_ilk_kaynak`: yalnızca ekleme ve doldurma. Eski kayıtların ilk kaynağı `tahminIlkKaynak` ile aynı CASE kuralıyla, tarihi `LEAST(mesajTarihi, createdAt)`, ilk yanıtı en erken temas notu.

## 3. Yanıt biçimi

`POST /api/durum` → `{ tamam, hatalar: [{id, mesaj}], uyarilar: [{id, mesaj}] }`. `uyarilar` kaydı reddetmez; `demo/canli-kaydet.ts` her farklı mesajı bir kez `CANLI.bildir` ile gösterir.

## 4. Testler

`tests/v332.test.ts` (9, veritabanısız) · `tests/v332-db.test.ts` (6, veritabanlı). Tam paket: 434 test, 433 geçti, 1 atlandı.

## 5. Yayın

1. `main`e girince Cloudflare kendisi derler ve yayınlar.
2. **Yayından hemen sonra uygulamada "Kurulumu tamamla"** (migration var). Basılmazsa yeni alanlar yazılamaz, kayıtlar 1 dk sonra kendiliğinden yeniden denenir.
3. Asistan için: Yönetim › Davet bağlantısı › Rol: Asistan.

## 6. Sonraki adım (2)

Kampanya tablosu: `kampanya` (kanal, ad, bütçe, başlangıç / bitiş, aylık harcama — elle). `kayit.ilkKaynakDetay` serbest metni yerine `kampanyaId` bağı; WhatsApp reklam bağlantısı için kampanya başına hazır mesaj.
