/**
 * Anahtar CRM v3.37 · 21 Ekim 2026
 * İlan numarası (sahibinden, hepsiemlak, emlakjet): formda yazılan / yapıştırılan değerden numara ve bağlantı çıkarır,
 * ekranlarda gösterilecek bağlantıyı üretir.
 *
 * Özgür (21 Eki 2026): "İlan numarası varsa (ör. 1346793126) en üstte fiyat vb. bilgilerin yanında, kişinin telefon numarası gibi
 * görünsün; portföy kartının ön izlemesinde her yerde gözüksün." Alan veritabanında zaten vardı (kayit.portalIlanNo, v3.7);
 * yalnızca içe aktarmada doluyordu, formda ve ekranlarda yoktu.
 */

/** "1346793126", "sahibinden.com/1346793126", tam ilan adresi… → { no, url }. Numara bulunamazsa no: null. */
export function ilanNoAyikla(metin: string | null | undefined): { no: string | null; url: string | null } {
  const ham = String(metin ?? "").trim();
  if (!ham) return { no: null, url: null };
  const urlMi = /^(https?:\/\/)?(www\.)?(sahibinden|hepsiemlak|emlakjet)\.com\//i.test(ham);
  const sayilar = ham.replace(/[?#].*$/, "").match(/\d{6,}(?:-\d+)?/g);
  const no = sayilar ? sayilar[sayilar.length - 1] : /^[A-Za-z0-9-]{3,40}$/.test(ham) ? ham : null;
  const url = urlMi ? (/^https?:\/\//i.test(ham) ? ham : "https://" + ham) : null;
  return { no: no ? no.slice(0, 40) : null, url };
}

/** Portal adı (bağlantıdan ya da kanaldan); bilinmiyorsa sahibinden varsayılır (ilanların çoğu oradan) */
export function ilanPortali(v: { portalUrl?: string | null; veriKanali?: string | null }): "SAHIBINDEN" | "HEPSIEMLAK" | "EMLAKJET" {
  const u = String(v.portalUrl ?? "").toLowerCase();
  if (u.includes("hepsiemlak") || v.veriKanali === "HEPSIEMLAK") return "HEPSIEMLAK";
  if (u.includes("emlakjet") || v.veriKanali === "EMLAKJET") return "EMLAKJET";
  return "SAHIBINDEN";
}

/** Ekranda açılacak bağlantı: kayıtlı adres varsa o; yoksa sahibinden numarasından kısa adres (sahibinden.com/<no>) */
export function ilanBaglantisi(v: { portalIlanNo?: string | null; portalUrl?: string | null; veriKanali?: string | null }): string | null {
  if (v.portalUrl) return v.portalUrl;
  const no = String(v.portalIlanNo ?? "").trim();
  if (/^\d{6,12}$/.test(no) && ilanPortali(v) === "SAHIBINDEN") return `https://sahibinden.com/${no}`;
  return null;
}
