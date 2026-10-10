/**
 * Anahtar CRM v3.24 · 10 Ekim 2026
 * Demo — Gelen kutusu örnek dosyaları. Sütunlar Revy'nin "Excel'e Aktar" dökümüyle birebir aynıdır; ilan sahibi adları,
 * bağlantılar ve telefonlar KURGUSALDIR. Tarihler demo "bugün"üne göre üretilir (gruplama Bugün / Dün / tarih / ay görünsün).
 * İçinde bilerek şunlar var: aynı ilanın iki portaldaki kopyası, başlığında "devren" geçen iş yeri (devir bedeli),
 * eksik sıfırlı kira, havuzdaki bir ilanın fiyatı değişmiş hâli, konut ve arsa satırları (ticari süzgecini denemek için).
 */
import { BUGUN } from "./depo";
import { ORNEK_SOHBETLER } from "./ornek-sohbetler";

const gun = (n: number) => { const d = new Date(BUGUN.getTime() - n * 86_400_000); return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`; };
const BASLIK = "İlan tarihi;Mülk tipi;Mülk türü;İşlem tipi;M2;Fiyat;İlk Fiyat;m2/Birim Fiyatı;İlan Başlığı;İl;İlçe;Semt;Mahalle;Oda sayısı;Bulunduğu kat;Toplam kat sayısı;Bina Yaşı;Site içerisinde;Site Adı;Kullanım Durumu;Devren mi;Eşyalı;İlan sahibi türü;İlan sahibi;Ofis;İlan Yayın Süresi;İlan Durumu;İlan Kaynağı;İlan Url";
type S = [gunOnce: number, ana: string, tur: string, islem: string, m2: number, fiyat: number, baslik: string, ilce: string, semt: string, mah: string, oda: string, kat: string, sahip: string, kaynak: string, url: string, ilkFiyat?: number];
const SATIRLAR: S[] = [
  [0, "Ticari", "Dükkan & Mağaza", "Kiralık", 85, 65000, "Sahibinden Işıklar Caddesinde köşe dükkan", "Muratpaşa", "Çarşı", "Haşimişcan Mah", "", "Giriş Katı", "Cem A. (örnek)", "Sahibinden.com", "https://sahibinden.com/9900000001"],
  [0, "Ticari", "", "Kiralık", 60, 950000, "DEVREN KİRALIK FAAL KUAFÖR SALONU", "Muratpaşa", "Meltem", "Güvenlik Mah", "", "", "Derya K. (örnek)", "Sahibinden.com", "https://sahibinden.com/9900000002"],
  [0, "Ticari", "Depo & Antrepo", "Kiralık", 1200, 210000, "Kepez Organize yakını 1200 m2 kiralık depo TIR girer", "Kepez", "", "Altınova Sinan Mah", "", "", "Halil T. (örnek)", "Hepsi Emlak", "https://www.hepsiemlak.com/antalya-kepez-kiralik/depo/0-99000003"],
  [0, "Konut", "Daire", "Satılık", 135, 7450000, "Sahibinden Fener'de 3+1 site içi daire", "Muratpaşa", "Fener", "Fener Mah", "3+1", "4. Kat", "Melis D. (örnek)", "Sahibinden.com", "https://sahibinden.com/9900000004"],
  [1, "Ticari", "Büro & Ofis", "Satılık", 110, 6800000, "Sahibinden satılık ofis Eski Sanayi", "Muratpaşa", "Eskisanayi", "Etiler Mah", "", "2. Kat", "Orhan B. (örnek)", "Sahibinden.com", "https://sahibinden.com/9900000005"],
  [1, "Ticari", "Büro & Ofis", "Satılık", 110, 6800000, "Eski Sanayi'de sahibinden 110 m2 ofis", "Muratpaşa", "Eskisanayi", "Etiler Mah", "", "2. Kat", "Orhan B. (örnek)", "Emlakjet", "https://www.emlakjet.com/ilan/ornek-ofis-99000006"],
  [1, "Ticari", "Restoran & Lokanta", "Kiralık", 240, 180000, "Konyaaltı sahil bandında kiralık restoran", "Konyaaltı", "Liman", "Liman Mah", "", "Giriş Katı", "Sinan Ç. (örnek)", "Sahibinden.com", "https://sahibinden.com/9900000007"],
  [1, "Arsa", "Ticari", "Satılık", 1450, 38500000, "Lara'da ticari imarlı köşe parsel", "Muratpaşa", "Lara", "Güzeloba Mah", "", "", "Nermin S. (örnek)", "Sahibinden.com", "https://sahibinden.com/9900000008"],
  [2, "Ticari", "Dükkan & Mağaza", "Kiralık", 40, 2500, "Bahçelievler'de kiralık dükkan", "Muratpaşa", "Bahçelievler", "Bahçelievler Mah", "", "Giriş Katı", "Tarık U. (örnek)", "Sahibinden.com", "https://sahibinden.com/9900000009"],
  [2, "Ticari", "Atölye", "Kiralık", 400, 95000, "Sanayide 400 m2 kiralık atölye, sanayi elektriği var", "Kepez", "", "Yeni Emek Mah", "", "", "Fikret Y. (örnek)", "Hepsi Emlak", "https://www.hepsiemlak.com/antalya-kepez-kiralik/atolye/0-99000010"],
  [2, "Konut", "Daire", "Kiralık", 90, 32000, "Sahibinden kiralık 2+1 eşyasız", "Konyaaltı", "Liman", "Hurma Mah", "2+1", "3. Kat", "Ece N. (örnek)", "Sahibinden.com", "https://sahibinden.com/9900000011"],
  [3, "Ticari", "", "Satılık", 180, 21500000, "Cadde üzeri satılık iş yeri, kiracılı", "Muratpaşa", "Kızıltoprak", "Yenigün Mah", "", "Giriş Katı", "Bülent O. (örnek)", "Sahibinden.com", "https://sahibinden.com/9900000012"],
  [3, "Ticari", "Komple Bina", "Satılık", 620, 54000000, "Sahibinden 4 katlı komple bina, otele uygun", "Muratpaşa", "Çarşı", "Tahılpazarı Mah", "", "", "Aysel R. (örnek)", "Sahibinden.com", "https://sahibinden.com/9900000013"],
  [5, "Arsa", "Tarla", "Satılık", 12000, 31500000, "Pınarlı 12 dönüm sanayi imarlı arsa", "Aksu", "", "Pınarlı Mah", "", "", "Veli S. (örnek)", "Sahibinden.com", "https://www.sahibinden.com/ilan/ornek-12-donum", 36000000],
  [6, "Ticari", "Plaza Katı & Ofisi", "Kiralık", 210, 140000, "Plaza katı kiralık ofis, otoparklı", "Muratpaşa", "Lara", "Çağlayan Mah", "", "5. Kat", "Gökhan M. (örnek)", "Emlakjet", "https://www.emlakjet.com/ilan/ornek-plaza-99000015"],
  [9, "Ticari", "Dükkan & Mağaza", "Satılık", 55, 4900000, "Sahibinden satılık dükkan Zerdalilik", "Muratpaşa", "Gençlik", "Zerdalilik Mah", "", "Giriş Katı", "İlker Z. (örnek)", "Sahibinden.com", "https://sahibinden.com/9900000016"],
  [20, "Ticari", "Depo & Antrepo", "Satılık", 2400, 46000000, "Organize yanında 2400 m2 satılık depo", "Döşemealtı", "", "Yeniköy Mah", "", "", "Rıza P. (örnek)", "Sahibinden.com", "https://sahibinden.com/9900000017"],
  [34, "Ticari", "Dükkan & Mağaza", "Kiralık", 120, 75000, "Uncalı'da cadde üzeri kiralık mağaza", "Konyaaltı", "Arapsuyu", "Uncalı Mah", "", "Giriş Katı", "Pelin G. (örnek)", "Sahibinden.com", "https://sahibinden.com/9900000018"],
  [70, "Konut", "Villa", "Satılık", 320, 28500000, "Sahibinden müstakil havuzlu villa", "Konyaaltı", "Arapsuyu", "Uncalı Mah", "4+1", "Müstakil", "Kerem V. (örnek)", "Sahibinden.com", "https://sahibinden.com/9900000019"],
];
/** Revy "Excel'e Aktar" biçiminde örnek döküm (CSV) */
export const ornekRevyCsv = () => [BASLIK, ...SATIRLAR.map(([g, ana, tur, islem, m2, fiyat, baslik, ilce, semt, mah, oda, kat, sahip, kaynak, url, ilk]) =>
  [gun(g), ana, tur, islem, m2, fiyat, ilk ?? "", Math.round(fiyat / m2), baslik, "Antalya", ilce, semt, mah, oda, kat, "", "", "Hayır", "", "", "Hayır", "Hayır", "Mülk Sahibi", sahip, "", g, "Aktif", kaynak, url].join(";"))].join("\n");

export interface OrnekGelenDosya { id: string; ad: string; kanal: "KOPRU" | "YUKLEME"; gonderen: string | null; konu: string | null; gunOnce: number; icerik: string }
export const ornekGelenDosyalar = (): OrnekGelenDosya[] => [
  { id: "ornek-revy", ad: "ads-ornek (Revy dökümü).csv", kanal: "YUKLEME", gonderen: null, konu: null, gunOnce: 0, icerik: ornekRevyCsv() },
  ...ORNEK_SOHBETLER.map((s, i) => ({ id: "ornek-wa" + (i + 1), ad: s.dosya, kanal: "KOPRU" as const, gonderen: "ornek@gmail.com", konu: s.dosya.replace(/\.txt$/, "") + " ile sohbet", gunOnce: i, icerik: s.icerik })),
];
