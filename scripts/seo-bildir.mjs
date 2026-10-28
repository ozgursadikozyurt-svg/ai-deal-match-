// Anahtar CRM — yayından sonra arama motorlarına "sayfalar güncellendi" bildirimi (IndexNow: Bing, Yandex, Seznam, Naver…).
// Google IndexNow kullanmaz; Google için sitemap.xml ve Search Console yeterli.
// Kullanım: node scripts/seo-bildir.mjs   (npm run canli:yayinla sonunda otomatik). Hata olursa yayını bozmaz, yalnızca uyarır.
import fs from "node:fs";
import path from "node:path";

const kok = path.resolve(import.meta.dirname, "..");
const ALAN = "anahtarcrm.com";
const ANAHTAR = "f283f49734981a253c52309195f86eef"; // scripts/site-uret.mjs › INDEXNOW_ANAHTAR ile aynı

try {
  const harita = fs.readFileSync(path.join(kok, "dist/canli/sitemap.xml"), "utf8");
  const urlList = [...harita.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  if (!urlList.length) throw new Error("sitemap.xml boş");
  const r = await fetch("https://api.indexnow.org/indexnow", {
    method: "POST",
    headers: { "content-type": "application/json; charset=utf-8" },
    body: JSON.stringify({ host: ALAN, key: ANAHTAR, keyLocation: `https://${ALAN}/${ANAHTAR}.txt`, urlList }),
  });
  // 200 / 202: alındı. 403: anahtar dosyası henüz yayında değil (ilk yayında birkaç dakika sonra yeniden çalıştırın).
  console.log(r.ok ? `✔ IndexNow: ${urlList.length} adres bildirildi (HTTP ${r.status})` : `⚠ IndexNow yanıtı HTTP ${r.status} — yayın etkilenmedi; birkaç dakika sonra: node scripts/seo-bildir.mjs`);
} catch (e) {
  console.log(`⚠ IndexNow bildirimi yapılamadı (${e.message}) — yayın etkilenmedi.`);
}
