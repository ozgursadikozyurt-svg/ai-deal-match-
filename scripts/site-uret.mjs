// Anahtar CRM — tanıtım sitesi üreticisi.
// site/sayfalar/*.html parçalarını ortak <head>, üst menü ve alt bilgiyle sarar; site.css / site.js'i ve sitemap.xml'i yazar.
// Kullanım: node scripts/site-uret.mjs <çıktı klasörü>   (npm run canli:arayuz içinde dist/canli'ye otomatik çalışır)
// Sayfa parçasının ilk satırı bir JSON yorumudur:
//   <!--{"baslik":"…","aciklama":"…","yol":"/fiyatlar","menu":"fiyatlar","ld":[…],"basEk":"…","noindex":false,"sitemap":true,"oncelik":0.8}-->
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const kok = path.resolve(import.meta.dirname, "..");
const kaynak = path.join(kok, "site");
const cikti = path.resolve(process.argv[2] ?? path.join(kok, "dist/canli"));
const ALAN = "https://anahtarcrm.com";
const BUGUN = new Date().toISOString().slice(0, 10);

const css = fs.readFileSync(path.join(kaynak, "site.css"), "utf8");
const js = fs.readFileSync(path.join(kaynak, "site.js"), "utf8");
const ozet = (s) => crypto.createHash("sha1").update(s).digest("hex").slice(0, 8);
const CSS_YOL = `/site.css?v=${ozet(css)}`, JS_YOL = `/site.js?v=${ozet(js)}`;

const MENU = [
  ["ozellikler", "/ozellikler", "Özellikler"],
  ["fiyatlar", "/fiyatlar", "Fiyatlar"],
  ["sss", "/#sss", "Sık sorulanlar"],
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
<nav aria-labelledby="alt-sirket"><h2 id="alt-sirket">Şirket</h2><ul><li><a href="/hakkimizda">Hakkımızda</a></li><li><a href="/iletisim">İletişim</a></li><li><a href="/iletisim#erken-erisim">Erken erişim</a></li></ul></nav>
<nav aria-labelledby="alt-yasal"><h2 id="alt-yasal">Yasal</h2><ul><li><a href="/gizlilik">Gizlilik politikası</a></li><li><a href="/kvkk">KVKK aydınlatma metni</a></li><li><a href="/cerezler">Çerez politikası</a></li><li><a href="/kosullar">Kullanım koşulları</a></li></ul></nav>
</div>
<div class="alt-son"><span>© ${new Date().getFullYear()} Özyurtlar Gayrimenkul, Antalya. Tüm hakları saklıdır.</span><a href="mailto:ozgursadikozyurt@gmail.com">ozgursadikozyurt@gmail.com</a></div>
</div></footer>`;

function sayfa(meta, govde) {
  const url = ALAN + (meta.yol === "/" ? "/" : meta.yol);
  const gorsel = `${ALAN}/og-gorsel.png`;
  const ld = meta.ld ? `<script type="application/ld+json">${JSON.stringify({ "@context": "https://schema.org", "@graph": meta.ld })}</script>` : "";
  return `<!doctype html>
<html lang="tr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
${meta.basEk ?? ""}<title>${kacir(meta.baslik)}</title>
<meta name="description" content="${kacir(meta.aciklama)}">
${meta.noindex ? '<meta name="robots" content="noindex">' : `<link rel="canonical" href="${url}">\n<meta name="robots" content="index,follow,max-image-preview:large">`}
<meta name="theme-color" content="#14213D">
<meta property="og:type" content="website"><meta property="og:site_name" content="Anahtar CRM"><meta property="og:locale" content="tr_TR">
<meta property="og:title" content="${kacir(meta.ogBaslik ?? meta.baslik)}"><meta property="og:description" content="${kacir(meta.aciklama)}">
<meta property="og:url" content="${url}"><meta property="og:image" content="${gorsel}"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta property="og:image:alt" content="Anahtar CRM logosu: altın anahtar">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:image" content="${gorsel}">
<link rel="icon" href="/favicon.ico" sizes="any"><link rel="icon" href="/favicon.svg" type="image/svg+xml"><link rel="icon" href="/favicon-48.png" type="image/png" sizes="48x48"><link rel="apple-touch-icon" href="/ikon-180.png"><link rel="manifest" href="/manifest.webmanifest">
<link rel="preload" href="/fonts/bricolage-grotesque-latin-700-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/fonts/figtree-latin-400-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="${CSS_YOL}">
${ld}
</head>
<body>
${ust(meta.menu)}
<main id="icerik">
${govde.trim()}
</main>
${ALT}
<script src="${JS_YOL}" defer></script>
</body>
</html>
`;
}

fs.mkdirSync(cikti, { recursive: true });
fs.writeFileSync(path.join(cikti, "site.css"), css);
fs.writeFileSync(path.join(cikti, "site.js"), js);
const haritaya = [];
for (const ad of fs.readdirSync(path.join(kaynak, "sayfalar")).filter((f) => f.endsWith(".html")).sort()) {
  const ham = fs.readFileSync(path.join(kaynak, "sayfalar", ad), "utf8");
  const m = ham.match(/^<!--(\{[\s\S]*?\})-->\n/);
  if (!m) throw new Error(`${ad}: ilk satırda <!--{...}--> bilgi yorumu yok`);
  const meta = JSON.parse(m[1]);
  fs.writeFileSync(path.join(cikti, ad), sayfa(meta, ham.slice(m[0].length)));
  if (!meta.noindex && meta.sitemap !== false) haritaya.push({ yol: meta.yol, oncelik: meta.oncelik ?? 0.5 });
}
haritaya.sort((a, b) => b.oncelik - a.oncelik);
fs.writeFileSync(path.join(cikti, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${haritaya.map((s) => `  <url><loc>${ALAN}${s.yol}</loc><lastmod>${BUGUN}</lastmod><priority>${s.oncelik.toFixed(1)}</priority></url>`).join("\n")}
</urlset>
`);
console.log(`✔ tanıtım sitesi: ${haritaya.length} sayfa + 404 → ${path.relative(kok, cikti)} (sitemap.xml)`);
