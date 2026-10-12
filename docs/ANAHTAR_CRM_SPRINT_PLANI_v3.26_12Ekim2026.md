# Anahtar CRM — Geliştirme Yönetimi ve Sprint Planı (v3.26 · 12 Ekim 2026)

Hedef: önce başka danışman ve ofislere **ücretsiz denetmek**, Bugün panosuyla **günlük alışkanlık** kazandırmak, sonra **Pro aboneliğe** çevirmek.
Bu belge kodda bugün ne olduğunu, satışa açılmadan önce neyin eksik olduğunu ve sırayı söyler.

## 1) Bugün kodda olan (çok ofisli altyapı — kontrol edildi)
| Konu | Durum | Nerede |
|---|---|---|
| Ofis (kiracı) ayrımı: her kayıt / kişi / ayar `ofisId` ile, her istek ofis bağlamında | ✅ var | `src/lib/kiracilik.ts`, `src/canli/worker.ts` |
| Giriş: e-postaya tek kullanımlık bağlantı (şifresiz, Supabase Auth) | ✅ var | `demo/canli-oturum.ts`, `src/canli/kimlik.ts` |
| Roller: Platform yöneticisi · Ofis yöneticisi · Danışman | ✅ var | `src/lib/guvenlik/yetki.ts` |
| Davetle katılım (tek kullanımlık bağlantı, e-postaya bağlanabilir) | ✅ var | `src/lib/services/ofis.ts` |
| Planlar: Ücretsiz · Pro · Pro+ ve sınırları (kullanıcı, fotoğraf, günlük yapay zekâ, entegrasyon, paylaşım föyü, ortak havuz) | ✅ var | `PLANLAR` (yetki.ts) |
| Deneme süresi (deneme bitene kadar Pro sayılır) | ✅ var | `Ofis.denemeBitis`, `etkinPlan` |
| Platform panosu: ofis listesi, kullanım sayıları | ✅ var | Ayarlar › Yönetim |
| **Açık kayıt** (davetsiz gelen danışman kendi ofisini açar, 14 gün Pro deneme) | ✅ **v3.26'da eklendi**, Cloudflare'de `ACIK_KAYIT=1` ile açılır | `/api/kayit-ol`, `demo/canli.tsx › KayitOl` |

## 2) Satışa açmadan önce eksikler (öncelik sırasıyla — gerekçeli)
1. **Toplu e-posta gönderimi (özel SMTP) — açık kaydın ön şartı.** Giriş bağlantısı e-postayla gidiyor. Supabase'in yerleşik e-posta servisi denemelik: gönderim sayısı çok düşük ve yalnızca proje ekibindeki adreslere gönderiyor (Supabase belgelerinden teyit edin). Dışarıdan gelen danışmanın bağlantısı gitmezse kayıt olamaz. → Resend / Brevo gibi bir SMTP + `anahtarcrm.com` alan adı doğrulaması.
2. **Hukuki sayfalar (KVKK).** Başkalarının müşteri telefonlarını işleyeceğiz: KVKK aydınlatma metni, kullanım koşulları, (ödemeyle) mesafeli satış sözleşmesi. Kayıt formundaki onay kutusu bu sayfalara bağlanmalı. Avukata kısa bir inceleme yaptırmak gerekir — veri işleyen sıfatı ve yurt dışı aktarım (Supabase sunucusunun bölgesi) konuları.
3. **Ücretli altyapı planları.** Cloudflare ücretsiz planda istek başına 10 ms işlemci sınırı var; büyük ofislerde açılış (`durumGetir`) bu sınırı zorluyor. Supabase ücretsiz projesi kullanılmayınca duraklıyor ve 500 MB ile sınırlı. → İlk dış ofis gelmeden Workers Paid + Supabase Pro.
4. **İlk giriş sihirbazı.** Yeni ofis boş açılır. 3 adım: telefonunu tanıt (★ Benim), bir WhatsApp grubunu / Excel'i yükle, Bugün panosunu göster. Alışkanlık ilk gün kurulur.
5. **Ücretsiz plan sınırı: aktif kayıt sayısı.** Şu an kayıt sayısında sınır yok. Öneri: Ücretsiz 100 aktif kayıt + 1 kullanıcı, fotoğraf yok. Pro'ya geçiş sebebi net olsun.
6. **Kullanım ölçümü (alışkanlık göstergesi).** Ofis başına: haftada kaç gün giriş, Bugün panosunda tamamlanan görev, eklenen kayıt. Denemeden Pro'ya geçecek ofisi bu söyler.
7. **Ödeme / abonelik.** Türkiye için iyzico abonelik (kart saklama + yinelenen ödeme), plan yükseltme ekranı, deneme bitişinde 3 gün önce uyarı, ödeme olmazsa Ücretsiz'e düşme (veri silinmez).
8. **Hesap / ofis silme ve veri dışa aktarma** (KVKK gereği; dışa aktarma zaten var).
9. **Ortak havuz + Dijital El Sıkışma** — Pro+ ayırıcısı; ofisler arası güven kuralları. Pilot ofisler geldikten sonra.

## 3) Sprint planı (2 haftalık)
| Sprint | Tarih | İş | Çıktı |
|---|---|---|---|
| S1 | 13–26 Eki | v3.26 ✅ · özel SMTP + alan adı · KVKK / koşullar sayfaları · ilk giriş sihirbazı · Ücretsiz kayıt sınırı | 3–5 tanıdık danışmana **davetle** beta |
| S2 | 27 Eki – 9 Kas | Kullanım ölçümü (platform panosu) · sabah özeti bildirimi ("2 geciken, 5 bugün") · `durumGetir` hızlandırma · Workers Paid + Supabase Pro | Betadan haftalık alışkanlık verisi |
| S3 | 10–23 Kas | iyzico abonelik · plan yükseltme ekranı · deneme bitiş uyarıları · `ACIK_KAYIT=1` | **Herkese açık deneme** |
| S4 | 24 Kas – 7 Ara | Ortak havuz + Dijital El Sıkışma (Pro+) · davet et / kazan | İlk Pro+ pilot ofis |

Not: COP31 (Kasım, Antalya) yoğunluğu S3 ile çakışıyor; gerekirse S3 bir sprint kayar, S1–S2 kaymaz.

## 4) Çalışma kuralları (değişmedi)
- Her kod değişikliği: sürüm numarası + tarih (dosya adlarında `_v3.xx_GGAyYYYY`), SURUMLER, EK ve DEVIR belgeleri güncellenir.
- Her sürüm arayüzden ve örnek veriyle denenebilir; "Bu sürümde neler var" panelinde test adımları.
- Veritabanı değişikliği olan sürümde canlıda bir kez "Kurulumu tamamla".

## 5) Açık kaydı açmak için (S3'te)
Cloudflare › Workers › anahtarcrm › Settings › Variables: `ACIK_KAYIT` = `1` → Deploy. Kapatmak için silin. Önce madde 1 ve 2 tamamlanmış olmalı.
