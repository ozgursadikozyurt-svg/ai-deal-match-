// Anahtar CRM — tanıtım sitesi üreticisi.
// site/sayfalar/**/*.html parçalarını ortak <head>, üst menü ve alt bilgiyle sarar; site.css / site.js'i, sitemap.xml'i
// ve IndexNow anahtar dosyasını yazar.
// Kullanım: node scripts/site-uret.mjs <çıktı klasörü>   (npm run canli:arayuz içinde dist/canli'ye otomatik çalışır)
// Sayfa parçasının ilk satırı bir JSON yorumudur:
//   <!--{"baslik":"…","aciklama":"…","yol":"/fiyatlar","menu":"fiyatlar","ld":[…],"basEk":"…","noindex":false,
//        "sitemap":true,"oncelik":0.8,"kirinti":[["Rehber","/rehber"],["Bu sayfa"]],"tur":"makale","yayin":"2026-10-28"}-->
// Parça içinde {{guncelleme}} yazılırsa sayfanın son değişiklik tarihi ("28 Ekim 2026") ile değiştirilir.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";

const kok = path.resolve(import.meta.dirname, "..");
const kaynak = path.join(kok, "site");
const sayfaKok = path.join(kaynak, "sayfalar");
const cikti = path.resolve(process.argv[2] ?? path.join(kok, "dist/canli"));
const ALAN = "https://anahtarcrm.com";
const BUGUN = new Date().toISOString().slice(0, 10);
// IndexNow (Bing, Yandex, Seznam…): anahtar herkese açık olacak şekilde tasarlanmıştır; değiştirilirse eski dosya silinir.
export const INDEXNOW_ANAHTAR = "f283f49734981a253c52309195f86eef";

const css = fs.readFileSync(path.join(kaynak, "site.css"), "utf8");
const js = fs.readFileSync(path.join(kaynak, "site.js"), "utf8");
const ozet = (s) => crypto.createHash("sha1").update(s).digest("hex").slice(0, 8);
const CSS_YOL = `/site.css?v=${ozet(css)}`, JS_YOL = `/site.js?v=${ozet(js)}`;
const AYLAR = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
const trTarih = (iso) => { const [y, a, g] = iso.split("-").map(Number); return `${g} ${AYLAR[a - 1]} ${y}`; };

/** Dosyanın son değişiklik günü: kaydedilmemiş değişiklik varsa bugün, yoksa son commit günü (git yoksa bugün). */
function sonDegisiklik(dosya) {
  try {
    const kirli = execFileSync("git", ["status", "--porcelain", "--", dosya], { cwd: kok, encoding: "utf8" }).trim();
    if (kirli) return BUGUN;
    const t = execFileSync("git", ["log", "-1", "--format=%cs", "--", dosya], { cwd: kok, encoding: "utf8" }).trim();
    return t || BUGUN;
  } catch { return BUGUN; }
}

const MENU = [
  ["ozellikler", "/ozellikler", "Özellikler"],
  ["fiyatlar", "/fiyatlar", "Fiyatlar"],
  ["rehber", "/rehber", "Rehber"],
  ["hakkimizda", "/hakkimizda", "Hakkımızda"],
];
const kacir = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function ust(menu) {
  const linkler = MENU.map(([k, href, ad]) => `<a href="${href}"${k === menu ? ' aria-current="page"' : ""}>${ad}</a>`).join("");
  return `<a class="atla" href="#icerik">İçeriğe geç</a>
<header class="ust"><div class="kap">
<a class="marka" href="/" aria-label="Anahtar CRM ana sayfa"><img src="/favicon.svg" width="34" height="34" alt="">Anahtar CRM</a>
<button class="menu-dugme" type="button" aria-expanded="false" aria-controls="ana-menu">Menü</button>
<nav id="ana-menu" aria-label="Ana menü">${linkler}<a class="giris" href="/uygulama">Giriş yap</a><a class="dugme dugme-pirinc js-basla" href="/uygulama">Ücretsiz deneyin</a></nav>
</div></header>`;
}

const ALT = `<footer class="alt"><div class="kap">
<div class="alt-izgara">
<div><a class="marka" href="/"><img src="/favicon.svg" width="30" height="30" alt="">Anahtar CRM</a><p class="tanim">Emlak danışmanları ve ofisleri için talep ve portföy eşleştirme uygulaması. Antalya'da, sahada çalışan bir ofis için geliştirildi.</p></div>
<nav aria-labelledby="alt-urun"><h2 id="alt-urun">Ürün</h2><ul><li><a href="/ozellikler">Özellikler</a></li><li><a href="/fiyatlar">Fiyatlar</a></li><li><a href="/#sss">Sık sorulanlar</a></li><li><a href="/uygulama">Giriş yap</a></li></ul></nav>
<nav aria-labelledby="alt-cozum"><h2 id="alt-cozum">Çözümler</h2><ul><li><a href="/emlak-programi">Emlak programı</a></li><li><a href="/musteri-takip-programi">Müşteri takip programı</a></li><li><a href="/portfoy-takip-programi">Portföy takip programı</a></li><li><a href="/whatsapp-emlak-gruplari">WhatsApp emlak grupları</a></li><li><a href="/ticari-gayrimenkul-crm">Ticari gayrimenkul CRM</a></li></ul></nav>
<nav aria-labelledby="alt-sirket"><h2 id="alt-sirket">Kaynaklar</h2><ul><li><a href="/rehber">Rehber</a></li><li><a href="/hakkimizda">Hakkımızda</a></li><li><a href="/iletisim">İletişim</a></li><li><a href="/iletisim#erken-erisim">Erken erişim</a></li></ul></nav>
<nav aria-labelledby="alt-yasal"><h2 id="alt-yasal">Yasal</h2><ul><li><a href="/gizlilik">Gizlilik politikası</a></li><li><a href="/kvkk">KVKK aydınlatma metni</a></li><li><a href="/cerezler">Çerez politikası</a></li><li><a href="/kosullar">Kullanım koşulları</a></li></ul></nav>
</div>
<div class="alt-son"><span>© ${new Date().getFullYear()} Özyurtlar Gayrimenkul, Antalya. Tüm hakları saklıdır.</span><a href="mailto:ozgursadikozyurt@gmail.com">ozgursadikozyurt@gmail.com</a></div>
</div></footer>`;

function sayfa(meta, govde, guncelleme) {
  const url = ALAN + meta.yol;
  const gorsel = `${ALAN}/og-gorsel.png`;
  const makale = meta.tur === "makale";
  const graf = [...(meta.ld ?? [])];
  if (meta.kirinti) {
    const ogeler = [["Anahtar CRM", "/"], ...meta.kirinti];
    graf.push({ "@type": "BreadcrumbList", itemListElement: ogeler.map(([ad, yol], i) => ({ "@type": "ListItem", position: i + 1, name: ad, ...(yol || i === ogeler.length - 1 ? { item: ALAN + (yol ?? meta.yol) } : {}) })) });
  }
  // Sayfada <div class="sss"> içinde <details><summary>Soru</summary><div class="cevap">Cevap</div></details> varsa FAQPage kendiliğinden üretilir
  if (!graf.some((g) => g["@type"] === "FAQPage")) {
    const duz = (h) => h.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    const sorular = [...govde.matchAll(/<details[^>]*>\s*<summary>([\s\S]*?)<\/summary>\s*<div class="cevap">([\s\S]*?)<\/div>\s*<\/details>/g)]
      .map(([, s, c]) => ({ "@type": "Question", name: duz(s), acceptedAnswer: { "@type": "Answer", text: duz(c) } }));
    if (sorular.length) graf.push({ "@type": "FAQPage", "@id": `${url}#sss`, mainEntity: sorular });
  }
  if (makale) {
    graf.push({ "@type": "Article", "@id": `${url}#makale`, headline: meta.h1 ?? meta.baslik, description: meta.aciklama, inLanguage: "tr-TR", image: gorsel,
      datePublished: meta.yayin ?? guncelleme, dateModified: guncelleme, mainEntityOfPage: url,
      author: { "@type": "Organization", name: "Anahtar CRM", url: ALAN + "/" }, publisher: { "@type": "Organization", name: "Anahtar CRM", logo: { "@type": "ImageObject", url: `${ALAN}/ikon-512.png` } } });
  }
  const ld = graf.length ? `<script type="application/ld+json">${JSON.stringify({ "@context": "https://schema.org", "@graph": graf })}</script>` : "";
  return `<!doctype html>
<html lang="tr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
${meta.basEk ?? ""}<title>${kacir(meta.baslik)}</title>
<meta name="description" content="${kacir(meta.aciklama)}">
${meta.noindex ? '<meta name="robots" content="noindex">' : `<link rel="canonical" href="${url}">\n<meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1">`}
<meta name="theme-color" content="#14213D">
<meta property="og:type" content="${makale ? "article" : "website"}"><meta property="og:site_name" content="Anahtar CRM"><meta property="og:locale" content="tr_TR">
<meta property="og:title" content="${kacir(meta.ogBaslik ?? meta.baslik)}"><meta property="og:description" content="${kacir(meta.aciklama)}">
<meta property="og:url" content="${url}"><meta property="og:image" content="${gorsel}"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta property="og:image:alt" content="Anahtar CRM logosu: altın anahtar">
${makale ? `<meta property="article:published_time" content="${meta.yayin ?? guncelleme}"><meta property="article:modified_time" content="${guncelleme}">\n` : ""}<meta name="twitter:card" content="summary_large_image"><meta name="twitter:image" content="${gorsel}">
<link rel="icon" href="/favicon.ico" sizes="any"><link rel="icon" href="/favicon.svg" type="image/svg+xml"><link rel="icon" href="/favicon-48.png" type="image/png" sizes="48x48"><link rel="apple-touch-icon" href="/ikon-180.png"><link rel="manifest" href="/manifest.webmanifest">
<link rel="preload" href="/fonts/bricolage-grotesque-latin-700-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/fonts/figtree-latin-400-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="${CSS_YOL}">
${ld}
</head>
<body>
${ust(meta.menu)}
<main id="icerik">
${govde.replaceAll("{{guncelleme}}", trTarih(guncelleme)).trim()}
</main>
${ALT}
<script src="${JS_YOL}" defer></script>
</body>
</html>
`;
}

function* dosyalar(d, on = "") {
  for (const g of fs.readdirSync(d, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    if (g.isDirectory()) yield* dosyalar(path.join(d, g.name), path.join(on, g.name));
    else if (g.name.endsWith(".html")) yield path.join(on, g.name);
  }
}

fs.mkdirSync(cikti, { recursive: true });
fs.writeFileSync(path.join(cikti, "site.css"), css);
fs.writeFileSync(path.join(cikti, "site.js"), js);
fs.writeFileSync(path.join(cikti, `${INDEXNOW_ANAHTAR}.txt`), INDEXNOW_ANAHTAR);
const haritaya = [];
for (const goreli of dosyalar(sayfaKok)) {
  const kaynakDosya = path.join(sayfaKok, goreli);
  const ham = fs.readFileSync(kaynakDosya, "utf8");
  const m = ham.match(/^<!--(\{[\s\S]*?\})-->\n/);
  if (!m) throw new Error(`${goreli}: ilk satırda <!--{...}--> bilgi yorumu yok`);
  const meta = JSON.parse(m[1]);
  const guncelleme = sonDegisiklik(kaynakDosya);
  const hedef = path.join(cikti, goreli);
  fs.mkdirSync(path.dirname(hedef), { recursive: true });
  fs.writeFileSync(hedef, sayfa(meta, ham.slice(m[0].length), guncelleme));
  if (!meta.noindex && meta.sitemap !== false) haritaya.push({ yol: meta.yol, oncelik: meta.oncelik ?? 0.5, guncelleme });
}
haritaya.sort((a, b) => b.oncelik - a.oncelik || a.yol.localeCompare(b.yol));
fs.writeFileSync(path.join(cikti, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${haritaya.map((s) => `  <url><loc>${ALAN}${s.yol}</loc><lastmod>${s.guncelleme}</lastmod><priority>${s.oncelik.toFixed(1)}</priority></url>`).join("\n")}
</urlset>
`);
console.log(`✔ tanıtım sitesi: ${haritaya.length} sayfa + 404 → ${path.relative(kok, cikti)} (sitemap.xml, IndexNow anahtarı)`);
