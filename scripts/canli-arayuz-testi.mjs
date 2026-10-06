// Anahtar CRM v3.15 · 5 Ekim 2026 — canlı arayüz sınaması (sanal tarayıcı: jsdom). Hazırlık: bkz. README › Canlı sürümü yerelde sınama
import { JSDOM, VirtualConsole } from "jsdom";
import fs from "node:fs";
import { SignJWT } from "jose";
const SIR = new TextEncoder().encode("test-gizli-anahtar-en-az-32-karakter-olmali-123");
const jwt = (e) => new SignJWT({ email: e }).setProtectedHeader({ alg: "HS256" }).setAudience("authenticated").setExpirationTime("1h").sign(SIR);
const html = fs.readFileSync("dist/canli/index.html", "utf8");
const bekle = async (kosul, ms = 8000) => { const t = Date.now(); while (Date.now() - t < ms) { try { if (await kosul()) return true; } catch {} await new Promise((r) => setTimeout(r, 100)); } return false; };
let gecen = 0, kalan = 0; const tamam = (a, ok, d = "") => { ok ? gecen++ : kalan++; console.log(`${ok ? "✔" : "✘"} ${a}${d ? " — " + d : ""}`); };

async function ac({ oturum, hash = "" }) {
  const sanal = new VirtualConsole(); const hatalar = [];
  sanal.on("jsdomError", (e) => hatalar.push(String(e.message).slice(0, 160))); sanal.on("error", (e) => hatalar.push(String(e).slice(0, 160)));
  const dom = new JSDOM(html, { url: "http://localhost:8799/" + hash, runScripts: "dangerously", pretendToBeVisual: true, virtualConsole: sanal,
    beforeParse(w) {
      w.fetch = (u, i) => fetch(new URL(u, "http://localhost:8799"), i); w.matchMedia = w.matchMedia || (() => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }));
      w.scrollTo = () => {}; w.HTMLElement.prototype.scrollIntoView = () => {}; w.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} }; w.IntersectionObserver = class { observe() {} unobserve() {} disconnect() {} };
      if (oturum) w.localStorage.setItem("anahtarcrm-oturum", JSON.stringify(oturum));
    } });
  return { dom, w: dom.window, hatalar, metin: () => dom.window.document.getElementById("kok")?.textContent ?? "" };
}

// A) oturumsuz → giriş ekranı
{ const a = await ac({}); const ok = await bekle(() => a.metin().includes("Giriş bağlantısı gönder"));
  tamam("oturumsuz açılış: giriş ekranı", ok, ok ? "" : a.metin().slice(0, 120));
  tamam("giriş ekranı: sürüm etiketi v3.18", a.metin().includes("v3.18"));
  tamam("giriş ekranı: e-posta alanı var", !!a.w.document.getElementById("gi-eposta")); a.w.close(); }

// B) izinsiz e-posta → 403 mesajı
{ const t = await jwt("baskasi@test.com"); const a = await ac({ oturum: { access: t, refresh: "x", bitis: Date.now() + 3600e3, eposta: "baskasi@test.com" } });
  const ok = await bekle(() => a.metin().includes("erişim izni yok")); tamam("izinsiz e-posta: anlaşılır uyarı + giriş ekranı", ok, ok ? "" : a.metin().slice(0, 150)); a.w.close(); }

// C) izinli oturum → uygulama açılır
{ const t = await jwt("ozgur@test.com"); const a = await ac({ oturum: { access: t, refresh: "x", bitis: Date.now() + 3600e3, eposta: "ozgur@test.com" } });
  const ok = await bekle(() => a.metin().includes("Ana Sayfa"), 15000);
  tamam("izinli oturum: uygulama açıldı; açılışta 'Kaydedildi ✓' göstergesi ekranda kalmıyor (v3.15)", ok && !a.metin().includes("Kaydedildi"), ok ? "" : a.metin().slice(0, 200) + " | " + a.hatalar.slice(0, 2).join(" ; "));
  tamam("canlıda 'Bağlantılar' menüsü gizli", !/Bağlantılar/.test(a.metin()));
  const aday = [...a.w.document.querySelectorAll("#kok button, #kok a")].filter((b) => /Ayarlar/.test(b.textContent ?? "")); console.log("   Ayarlar adayları:", aday.map((b) => b.tagName + ":" + (b.textContent ?? "").trim().slice(0, 20)).join(" | ")); const nav = aday[0];
  tamam("menüde Ayarlar var", !!nav);
  nav?.click(); const ok2 = await bekle(() => a.metin().includes("Hesap ve veri"));
  tamam("Ayarlar: 'Hesap ve veri' kartı (yedek yükleme, çıkış) görünür", ok2);
  tamam("Ayarlar: demo'ya özgü 'Örnek veriyi sıfırla' gizli", !a.metin().includes("Örnek veriyi sıfırla"));
  tamam("Ayarlar: giriş yapılan hesap gösteriliyor", a.metin().includes("ozgur@test.com"));
  const ok3 = await bekle(() => a.metin().includes("tanımlı değil") || a.metin().includes("tanımlı"), 5000); tamam("Ayarlar: yapay zekâ anahtarı durumu sunucudan geliyor", ok3);
  tamam("çalışma sırasında beklenmeyen JS hatası yok", a.hatalar.length === 0, a.hatalar.slice(0, 2).join(" ; ")); a.w.close(); }

// D) giriş bağlantısı (adres #access_token=…) → oturum alınır, adres temizlenir
{ const t = await jwt("ozgur@test.com"); const a = await ac({ hash: `#access_token=${t}&refresh_token=r1&expires_in=3600&token_type=bearer&type=magiclink` });
  const ok = await bekle(() => a.metin().includes("Ana Sayfa"), 15000); tamam("giriş bağlantısıyla gelince uygulama açılır", ok, ok ? "" : a.metin().slice(0, 150));
  tamam("adresten anahtar silindi", !a.w.location.hash.includes("access_token"));
  tamam("oturum saklandı", !!a.w.localStorage.getItem("anahtarcrm-oturum")); a.w.close(); }

// E) bağlantıdaki hata (süresi dolmuş) → mesaj
{ const a = await ac({ hash: "#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired" });
  const ok = await bekle(() => a.metin().includes("invalid or has expired")); tamam("süresi dolmuş bağlantı: mesaj gösterilir", ok); a.w.close(); }


// F) sunucudaki kayıtlar listede görünür; demo yedeği dosya seçilerek yüklenir ve kendiliğinden kaydedilir
{ const t = await jwt("ozgur@test.com"); const hdr = { authorization: `Bearer ${t}` };
  const once = (await (await fetch("http://localhost:8799/api/durum", { headers: hdr })).json()).kayitlar.length;
  const a = await ac({ oturum: { access: t, refresh: "x", bitis: Date.now() + 3600e3, eposta: "ozgur@test.com" } });
  await bekle(() => a.metin().includes("Ana Sayfa"), 15000);
  const git = async (ad) => { const b = [...a.w.document.querySelectorAll("#kok button")].find((x) => (x.textContent ?? "").trim() === ad); b?.click(); await new Promise((r) => setTimeout(r, 400)); return !!b; };
  tamam("Portföyler ekranı açılır", await git("Portföyler"));
  tamam(`Portföyler listesi sunucudaki kayıtları gösteriyor (sunucuda ${once} kayıt)`, /Kundu|depo|Depo|dükkan|Dükkan|Mobilya/.test(a.metin()) || once === 0, once === 0 ? "sunucu boş" : "");
  await git("Ayarlar");
  const girdi = a.w.document.querySelector('#ayar-hesap input[type=file]');
  tamam("yedek dosya seçici bulundu", !!girdi);
  if (girdi) {
    const dosya = new a.w.File([fs.readFileSync("/tmp/demo-yedek.json", "utf8")], "anahtar-crm-yedek-2026-10-03.json", { type: "application/json" });
    Object.defineProperty(girdi, "files", { value: [dosya], configurable: true }); girdi.dispatchEvent(new a.w.Event("change", { bubbles: true }));
    const dugme = await bekle(() => [...a.w.document.querySelectorAll("#ayar-hesap button")].some((b) => /dosyasını yükle/.test(b.textContent ?? "")), 5000);
    tamam("dosya seçilince 'yükle' düğmesi çıkar", dugme);
    [...a.w.document.querySelectorAll("#ayar-hesap button")].find((b) => /dosyasını yükle/.test(b.textContent ?? ""))?.click();
    await bekle(() => a.metin().includes("Yedekten"), 5000);
    tamam("yükleme sonucu bildirilir (kaç kayıt, kaç kişi)", /Yedekten \d+ kayıt, \d+ kişi eklendi/.test(a.metin()), (a.metin().match(/Yedekten[^.]{0,80}/) ?? [""])[0]);
    // "Kaydedilecek…" / "Kaydediliyor…" göstergesi önce görünür, sonra "Kaydedildi ✓"e döner: iki aşamalı beklenir
    await bekle(() => /Kaydedilecek|Kaydediliyor/.test(a.metin()), 4000); await bekle(() => a.metin().includes("Kaydedildi"), 30000);
    let sonra = { kayitlar: [], kisiler: [] }; for (let i = 0; i < 5; i++) { const r = await fetch("http://localhost:8799/api/durum", { headers: hdr }); const j = await r.json(); if (j.kayitlar) { sonra = j; break; } await new Promise((r) => setTimeout(r, 1000)); }
    const kaydedildi = sonra.kayitlar.length >= once + 26;
    tamam(`yedek sunucuya kendiliğinden kaydedildi (${once} → ${sonra.kayitlar.length} kayıt, ${sonra.kisiler.length} kişi)`, kaydedildi);
  }
  tamam("'Kaydedildi ✓' göstergesi ~3 sn sonra kendiliğinden kayboldu (v3.15)", await bekle(() => !a.metin().includes("Kaydedildi") && !/Kaydedilecek|Kaydediliyor/.test(a.metin()), 8000));
  tamam("bu akışta beklenmeyen JS hatası yok", a.hatalar.length === 0, a.hatalar.slice(0, 2).join(" ; ")); a.w.close(); }

console.log(`\n${gecen} geçti, ${kalan} kaldı`); process.exit(kalan ? 1 : 0);
