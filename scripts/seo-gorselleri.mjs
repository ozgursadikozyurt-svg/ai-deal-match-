// Anahtar CRM v3.42 · 23 Ekim 2026
// Anahtar CRM — arama motoru / sosyal paylaşım görselleri: public/favicon.svg'den favicon.ico, favicon-48.png, ikon-512 (değişmez) ve og-gorsel.png (1200x630) üretir.
// Çalıştır: node scripts/seo-gorselleri.mjs   (logo değişirse yeniden çalıştırın)
import fs from "node:fs"; import path from "node:path"; import sharp from "sharp";
const kok = path.resolve(import.meta.dirname, ".."), pub = (f) => path.join(kok, "public", f);
const svg = fs.readFileSync(pub("favicon.svg"));
const png = (n) => sharp(svg, { density: 72 * (n / 40) * 2 }).resize(n, n).png().toBuffer();
fs.writeFileSync(pub("favicon-48.png"), await png(48));
// .ico: 16, 32, 48 px PNG içeren tek dosya
const boyutlar = [16, 32, 48], resimler = await Promise.all(boyutlar.map(png));
const baslik = Buffer.alloc(6); baslik.writeUInt16LE(1, 2); baslik.writeUInt16LE(boyutlar.length, 4);
let ofset = 6 + 16 * boyutlar.length; const girisler = resimler.map((r, i) => { const g = Buffer.alloc(16); g[0] = boyutlar[i]; g[1] = boyutlar[i]; g.writeUInt16LE(1, 4); g.writeUInt16LE(32, 6); g.writeUInt32LE(r.length, 8); g.writeUInt32LE(ofset, 12); ofset += r.length; return g; });
fs.writeFileSync(pub("favicon.ico"), Buffer.concat([baslik, ...girisler, ...resimler]));
// Paylaşım görseli 1200x630
const logo = (await sharp(svg, { density: 576 }).resize(240, 240).png().toBuffer()).toString("base64");
const og = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#14213D"/><stop offset="1" stop-color="#0d3b45"/></linearGradient></defs>
<rect width="1200" height="630" fill="url(#g)"/><image href="data:image/png;base64,${logo}" x="90" y="195" width="240" height="240"/>
<text x="380" y="270" font-family="Inter, DejaVu Sans, sans-serif" font-weight="700" font-size="84" fill="#ffffff">Anahtar CRM</text>
<text x="380" y="340" font-family="Inter, DejaVu Sans, sans-serif" font-size="36" fill="#D9A441">Emlak danışmanları için</text>
<text x="380" y="388" font-family="Inter, DejaVu Sans, sans-serif" font-size="36" fill="#D9A441">talep ve portföy eşleştirme</text>
<text x="380" y="470" font-family="Inter, DejaVu Sans, sans-serif" font-size="28" fill="#58C9C1">anahtarcrm.com</text></svg>`;
await sharp(Buffer.from(og)).png({ compressionLevel: 9 }).toFile(pub("og-gorsel.png"));
console.log("✔ favicon.ico, favicon-48.png, og-gorsel.png üretildi");
