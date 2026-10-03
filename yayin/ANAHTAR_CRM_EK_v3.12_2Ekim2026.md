# Anahtar CRM — v3.12 Eki (telefon kullanımı, içe aktarma, metin ayrıştırma)
**Versiyon:** 3.12 | **Tarih:** 2 Ekim 2026 | **Önceki:** 3.11 (2 Ekim 2026)

> `ANAHTAR_CRM_EK_v3.11_2Ekim2026.md` ile birlikte, ana belgelerin (ALTYAPI v3.10, PRD v3.10) üzerine okunur. **Veritabanı değişikliği yok, migration yok.** Test 132 → 142 (142/142).

## Ana belgelerde / v3.11 ekinde geçersiz kalan satırlar

| Yer | Eski | v3.12 |
|---|---|---|
| ALTYAPI §(WhatsApp içe aktarma) | "Kalan mesajlar 10'arlı paketlerle yapay zekâya → şemaya bağlı kayıtlar" | Önce **kurallarla anında** okunur (§49.2); yapay zekâ yalnızca "Kontrol gerekli" mesajlarını isteğe bağlı yeniden okur |
| ice-aktarma akışı "Gözden geçir" | Sekme sırası Hazır → Kontrol → … ; liste yalnızca yapay zekâ çalışınca dolardı | Varsayılan sekme **Hepsi**: Hazır önce (güven yüksek üstte), Kontrol gerekli sonra, hatalı, atlanan/eklenen en sonda |
| `TALEP_IPUCU` (hizli-ayristirici) | "lazım", "ihtiyaç", "kadar", "olsun" tek başına talep işaretiydi | §49.3 |

## 49. v3.12 — Kullanıcı testinden gelen düzeltmeler

### 49.1 Telefon (mobil) kullanımı
- **Klavye örtmesi:** Bir yazı alanına odaklanınca (`input` / `textarea` / `select`, onay kutusu ve dosya girdisi hariç) `<html>`'e `klavye` sınıfı eklenir. Bu sınıf varken: alt menü çubuğu (`.alt-cubuk`) gizlenir, sabit "Kaydet" çubuğu (`.yapiskan`, `.cekmece-tutamak`) normal akışa döner, sayfa altına 55vh boşluk eklenir (< 960 px). Alan 120 ms ve 420 ms sonra `scrollIntoView({block:"center"})` ile klavyenin üstüne kaydırılır; `visualViewport` boyut değişince yeniden kaydırılır. Alan bırakılınca (200 ms gecikmeyle, başka alana geçilmediyse) sınıf kalkar. **Kod:** `demo/app.tsx → klavyeIzle`, CSS `demo/sayfa.html` (`html.klavye …`).
- **Dosya seç düğmesi:** Veri girişi › WhatsApp: gizli `input` + etiket yerine gerçek "Dosya seç (.txt / .zip)" düğmesi (`ref.click()`); `accept` kaldırıldı (bazı Android seçicileri .txt/.zip'i gri gösterir) — uzantı kod içinde süzülür. Excel / CSV düğmesinde de `accept` kaldırıldı.

### 49.2 İçe aktarma: kural geçişi, sıralama, geri dönüş
- `kuralAdaylari(mesajlar, depo, ingestionId, kayitlar)` (`demo/ice-aktarma.tsx`): ön filtreden geçen her mesaj `mesajiYorumla` (yeni, `src/lib/ai/yorumlayici.ts`) ile **anında** okunur — çok ilanlı mesajlar parçalanır, güven puanı (`parcaGuveni`) ve eksikler her adaya yazılır, `satirKur` (AI kutusuyla aynı kod) taslağı ve durumu (Hazır / Kontrol / Hatalı) üretir. Aday alanları: `guven`, `eksikler`, `kaynak: "KURAL" | "AI"` (`IceAktarmaAdayi`, `demo/depo.ts`).
- Süre: 3.533 aday mesaj (7.699 mesajlık gerçek sohbet) ≈ 10 sn node'da; telefonda büyük dosyada birkaç saniye. Liste 60'ar kart gösterir ("Daha fazla göster").
- **Yapay zekâ (isteğe bağlı):** "Kontrol gerekenleri yapay zekâyla yeniden oku (N mesaj)" yalnızca kural okumasında `KONTROL` / `HATALI` olan mesajları gönderir; o mesajların eski kural adayları silinir, kararı verilmiş (eklenen / atlanan) olanlara dokunulmaz. `aiKaydiniDuzelt`: yapay zekâ türü metindeki açık "satılık / kiralık" ve arama ifadesizliğiyle çelişirse kural kazanır (kayıt Kontrol gerekli olur, nedeni yazılır); yapay zekânın boş bıraktığı fiyat / alan kuraldan tamamlanır. Tek mesajda birden çok kayıt varsa düzeltme yapılmaz.
- **Geri dönüş:** `Düzenle ve ekle` › `Vazgeç` / `Kaydet` artık `git({ad:"veri", alt:"wa"})` (önceden `alt` yoktu → "Yapıştır" sekmesi açılıp liste kayboluyormuş gibi görünüyordu; veri `d.aktifIceAktarma` içinde duruyordu). `VeriGirisi`, yarım kalan içe aktarma varken `alt` verilmese de WhatsApp sekmesini açar. Sekme ve tür filtresi modül düzeyinde (`SON_SEKME`, `SON_TIP`) hatırlanır.

### 49.3 Metin ayrıştırma düzeltmeleri
| Hata (kullanıcı örneği) | Neden | Düzeltme |
|---|---|---|
| "…3+1 DAIRE 5.450.000. ₺" fiyat yok | Sondaki nokta binlik ayraç sanıldı | `paraNormalize`: `5.450.000.` + `₺/TL` → `5.450.000 TL` |
| "Döşemealtı Yeniköy Mahallesinde **Atatürk Caddesi** üzerinde" → Kepez / Atatürk | Cadde adı mahalle sanıldı; "mahallesinde" eki tanınmadığı için Yeniköy atlandı | `caddeAdiniAyikla` (cadde / sokak / bulvar adı konum taramasından çıkar, mahalle sözcüğüne kadarki kısım korunur); `mahEki` artık `mahalle\p{L}*` |
| "…arsa hissesi **satılıktır**" ve "…villa **SATILIK**" talep okundu | (Yapay zekâ yolunda) yapay zekâ türü yanlış okudu; kural yolu doğruydu | Kural geçişi ilk okuma; yapay zekâ çelişirse kural kazanır |
| "tadilata ihtiyacı var", "tapu yapmamız LAZIM", "10 kata kadar müsaadeli", "kutlu olsun" → talep | Zayıf sözcükler tek başına talep işaretiydi | `TALEP_IPUCU` yeniden yazıldı: "mülk sözcüğü + lazım", "ihtiyacı var / olan" (tadilat, bakım, onarım, yenileme, boya sonrası hariç), "sayı / para + kadar", "talep(i/ler)" (talep eden hariç), "arıyor / arayış / bütçe…" |
| Numaralı ilan listesinde her ilan iki kayıt (başlık + ayrıntı) | Başlık satırında da "satılık" geçtiği için ayrı kayıt başladı | `mesajiBol`: önceki satır işlem sözcüğü taşıyıp mülk bilgisi taşımıyorsa (başlık) ve yeni satırda işlem sözcüğü yoksa aynı ilandır |
| "Yeni Yılınız kutlu olsun…" talep kaydı oldu | Selam satırı kayıt sayıldı | İpucu taşımayan ilk satır atlanır |
| 80.000 dolar → kiralık tahmin | Eşik yalnız TL için (≤ 1,5 milyon) | Döviz için eşik 6.000 |
| "Yenigün Kızıltoprak" tek tanınmayan yer | Yan yana iki mahalle adı tek ifadeye birleşiyordu | Yan yana eşleşmeler yalnız önceki ilçe / alt bölge / il ise birleşir ("Muratpaşa Fener", "Lara Güzeloba"); iki mahalle ayrı yerdir |

**Gerçek sohbet üzerinde ölçüm** (kullanıcının 7.699 mesajlık dosyası, yalnızca kurallar): 3.533 aday mesaj → 3.750 kayıt; "Hazır" 1.116 (%30), "Kontrol gerekli" 2.630. Kontrol nedenlerinin başında yalnızca bağlantı olan mesajlar ("Bağlantıda fiyat yok", ~%30) ve konumu yazılmamış mesajlar gelir; ikisi de bilgi eksikliğidir, yanlış okuma değil. Kural çıktılarının doğruluğu **elle etiketlenmedi** — "Hazır" demek eksiksiz alan, doğru alan demek değildir; kullanıcının "sunuldu / sunulmadı" örnekleriyle sınanacak.

**Bilinen sınırlar / yapılacaklar:**
- Çok ilanlı mesajda ilan başlığı + fiyat dağınık yazılmışsa (başlık satırı yoksa) fiyat eşleşmesi yanlış ilana düşebilir.
- Yapay zekâ ile kural çelişkisinde şimdilik yalnızca tür ve işlem düzeltilir; konum ve mülk tipi çelişkisi için yeni kural yazılmadı.
- Gerçek bir 945 mesajlık dosya (kullanıcının ilk yüklediği) tekrar sınanmadı; sınanan dosya aynı gruptan 7.699 mesajlıktır.
- Telefonda klavye düzeltmesi tarayıcıda (390 × 780 görünüm, dokunmatik) odak / sınıf / konum olarak doğrulandı; gerçek Android klavyesi bu ortamda yok — son sınama kullanıcı telefonunda.
- `Yeniköy`, `Atatürk` gibi birçok ilçede aynı ad: ilçe yazılmamışsa merkez ilçe önceliği (v3.11 §47) geçerli.

## 50. v3.12 Dosya ve Test Özeti

| Dosya | Durum |
|---|---|
| `src/lib/ai/hizli-ayristirici.ts` | `paraNormalize` (sondaki nokta), `TALEP_IPUCU` (dışa açıldı), döviz işlem tahmini, `mahEki`, bitişik konum birleştirme |
| `src/lib/ai/yorumlayici.ts` | `mesajiYorumla` (yeni), `caddeAdiniAyikla` (yeni), `konumBul` cadde ayıklama |
| `src/lib/ingest/toplu-mesaj.ts` | başlık + ayrıntı satırı birleştirme, selam satırı atlama |
| `demo/ice-aktarma.tsx` | `kuralAdaylari`, `aiKaydiniDuzelt`, `taslakGuveni`, Hepsi sekmesi + sıralama, sayfalama, dosya seç düğmesi, geri dönüş |
| `demo/ai-kutusu.tsx` | `satirKur` dışa açıldı |
| `demo/depo.ts` | `IceAktarmaAdayi`: `guven`, `eksikler`, `kaynak` |
| `demo/form.tsx` | Vazgeç / Kaydet → `veri › wa` |
| `demo/app.tsx`, `demo/sayfa.html` | `klavyeIzle`, `html.klavye` CSS |
| `demo/toplu-giris.tsx` | dosya girdisinde `accept` kaldırıldı |
| `tests/v312.test.ts` (10) | yeni; `tests/v311.test.ts` sürüm testi esnetildi |

`npm run test:db` → **142/142**. Demo ≈ 1,83 MB.

---

# PRD / SRS / FSD — v3.12 eki

**Kullanıcı sorunu:** Telefonda klavye açılınca yazılan yer görünmüyor; WhatsApp dosyası seçilemiyor; içe aktarmada çıkarılan adaylar aşağıda listelenmiyor, Düzenle'den dönünce kayboluyor; "satılık" ilan talep, fiyat ve konum yanlış okunuyor.

- **FR-12.1** Telefonda bir yazı alanına odaklanıldığında alan klavyenin üstünde görünür; alt menü ve sabit Kaydet çubuğu alanı örtmez.
- **FR-12.2** Veri girişinde WhatsApp dosyası, sürükle-bırak dışında "Dosya seç" düğmesiyle de seçilebilir (.txt ve .zip, birden çok dosya).
- **FR-12.3** Dosya yüklendiğinde ön filtre sonucu ile birlikte adaylar yapay zekâ beklenmeden kurallarla okunur ve "Gözden geçir" listesinde gösterilir.
- **FR-12.4** Liste varsayılan olarak "Hazır" kayıtlarla başlar (güveni yüksek olan üstte); "Kontrol gerekli" kayıtlar sonra gelir.
- **FR-12.5** Bir adayı düzenlemekten vazgeçmek ya da kaydetmek içe aktarma listesine döner; yüklenen veri, sekme ve filtre korunur.
- **FR-12.6** Yapay zekâ isteğe bağlıdır; yalnızca kural okumasının emin olmadığı mesajları yeniden okur. Yapay zekâ metindeki açık "satılık / kiralık" ifadesiyle çelişirse kural kazanır ve kayıt "Kontrol gerekli" olur.
- **FR-12.7** "Satılık / kiralık" yazan ilan metni talep sayılmaz; "tadilata ihtiyacı var", "kadar", "lazım", "olsun" gibi sözcükler tek başına talep işareti değildir.
- **FR-12.8** Cadde / sokak / bulvar adları mahalle sayılmaz; "mahallesinde" gibi ekler tanınır; yan yana yazılan iki mahalle iki ayrı yer olarak okunur.
- **NFR-12.1** Kural okuması ağ çağrısı gerektirmez; binlerce mesaj telefonda birkaç saniyede okunur; liste 60'ar kart gösterir.
- **NFR-12.2** Veritabanı şeması değişmez.
- **Kabul ölçütleri:** `tests/v312.test.ts` (10); toplam 142/142.
- **Kapsam dışı / açık:** gerçek telefon klavyesiyle saha sınaması; kural okumasının elle etiketlenmiş ölçümü; çok ilanlı mesajda dağınık fiyat eşleşmesi.
- **Sonraki aşama:** AŞAMA 7 Canlı sürüm (Altyapı §35) — değişmedi.

---

## 51. v3.13 (3 Ekim 2026) — düzen değişiklikleri
Veritabanı ve test sayısı değişmedi (142/142).

- **Portföy / talep sayfası üst satırı** (`demo/app.tsx`, `.detay-ust`): solda "← Portföyler / Talepler", sağda "Düzenle" ve (portföyde) "Portföy paylaş" (`#portfoy-paylas`). Başlığın altındaki eski düğme satırı (`.d-eylem`) kaldırıldı.
- **Lokasyon bölümü** özet kartının hemen altına taşındı (Fotoğraflar, Kişiler ve notlardan önce).
- **Telefonda liste üstü** (`demo/sayfa.html`, ≤ 560 px): `.fc` iki satır — arama kutusu tam genişlik; Acil / Filtrele / sıralama altında.
- **Fotoğraf ve paylaşım doğrulaması:** v3.10'da gelen fotoğraf ekleme (`demo/fotograflar.tsx`, `demo/foto.ts`) ve portföy paylaşımı (`demo/paylas.tsx`, `src/lib/paylasim/foy.ts`) v3.11 ve v3.12 kaynak paketlerinde değişmeden duruyordu; v3.13 derlemesinde telefon boyutunda 3 fotoğraf eklenip PDF ve JPG indirilerek sınandı. Canlı kurulumda fotoğraf deposu Supabase Storage (ALTYAPI §41) — gerçek hesapla henüz denenmedi.