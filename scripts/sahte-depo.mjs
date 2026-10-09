// Anahtar CRM v3.22.1 · 9 Ekim 2026 — Supabase Storage uçlarını taklit eden küçük sunucu (yalnızca yerel deneme için)
import http from "node:http";
const dosyalar = new Map(); // "kova/yol" → Buffer
const gunluk = [];
const sunucu = http.createServer(async (req, res) => {
  const u = new URL(req.url, "http://x"); const parcalar = []; for await (const c of req) parcalar.push(c); const govde = Buffer.concat(parcalar);
  gunluk.push(`${req.method} ${u.pathname}`);
  const yetkili = req.headers.authorization === "Bearer svc-test";
  const json = (kod, v) => { res.writeHead(kod, { "content-type": "application/json" }); res.end(JSON.stringify(v)); };
  if (u.pathname === "/__gunluk") return json(200, { gunluk, dosyalar: [...dosyalar.keys()].map((k) => [k, dosyalar.get(k).length]) });
  if (u.pathname === "/__jwks" && req.method === "POST") { globalThis.JWKS = JSON.parse(govde.toString()); return json(200, {}); }
  if (u.pathname === "/auth/v1/.well-known/jwks.json") return json(200, globalThis.JWKS ?? { keys: [] });
  if (u.pathname === "/__ekle") { dosyalar.set(u.searchParams.get("a"), Buffer.from("eski")); return json(200, {}); }
  if (!u.pathname.startsWith("/storage/v1/")) return json(404, {});
  if (!yetkili && !u.searchParams.get("token")) return json(401, { message: "yetkisiz" });
  const yol = u.pathname.slice("/storage/v1/".length);
  if (req.method === "POST" && yol === "bucket") return json(200, { name: "tamam" });
  if (req.method === "POST" && yol.startsWith("object/sign/")) { const kova = yol.slice(12); const g = JSON.parse(govde.toString()); return json(200, g.paths.map((p) => dosyalar.has(`${kova}/${p}`) ? { path: p, signedURL: `/object/sign/${kova}/${p}?token=abc`, error: null } : { path: p, signedURL: null, error: "yok" })); }
  if (req.method === "POST" && yol.startsWith("object/list/")) { const kova = yol.slice(12); return json(200, [...dosyalar.keys()].filter((k) => k.startsWith(kova + "/")).map((k) => ({ name: k.slice(kova.length + 1) }))); }
  if (req.method === "POST" && yol.startsWith("object/")) { dosyalar.set(yol.slice(7), govde); return json(200, { Key: yol.slice(7) }); }
  if (req.method === "GET" && yol.startsWith("object/sign/")) { const d = dosyalar.get(yol.slice(12)); if (!d) return json(404, {}); res.writeHead(200, { "content-type": "image/jpeg" }); return res.end(d); }
  if (req.method === "DELETE" && yol.startsWith("object/")) { const kova = yol.slice(7); for (const p of JSON.parse(govde.toString()).prefixes) dosyalar.delete(`${kova}/${p}`); return json(200, []); }
  return json(404, { yol });
});
sunucu.listen(9001, "127.0.0.1", () => console.log("sahte depo hazır :9001"));
