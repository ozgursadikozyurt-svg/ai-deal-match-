/**
 * Anahtar CRM v3.22 · 9 Ekim 2026
 * Bağımlılıksız tablo okuyucu: .xlsx (fflate ile zip açılır, XML düz okunur), .csv / .tsv / .txt (ayraç otomatik).
 * Tarayıcıda (demo) ve sunucuda aynı kod çalışır. Biçimlendirme, formül ve birleşik hücre yok sayılır; değerler okunur.
 */
import { unzipSync, strFromU8 } from "fflate";

export interface Sayfa { ad: string; satirlar: string[][] }

const xmlCoz = (s: string) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n)).replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16))).replace(/&amp;/g, "&");
const sutunNo = (ref: string) => { let n = 0; for (const c of ref.replace(/\d+/g, "")) n = n * 26 + c.charCodeAt(0) - 64; return n - 1; };
/** Excel seri tarihi → gg.aa.yyyy */
export const excelTarih = (n: number) => { const d = new Date(Date.UTC(1899, 11, 30) + Math.round(n) * 86_400_000); return `${String(d.getUTCDate()).padStart(2, "0")}.${String(d.getUTCMonth() + 1).padStart(2, "0")}.${d.getUTCFullYear()}`; };

export function xlsxOku(veri: Uint8Array): Sayfa[] {
  const z = unzipSync(veri);
  const oku = (y: string) => (z[y] ? strFromU8(z[y]) : "");
  const paylasilan = [...oku("xl/sharedStrings.xml").matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => xmlCoz([...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((t) => t[1]).join("")));
  // Tarih biçimli stiller (yerleşik 14-22 ve özel biçimler)
  const stiller = oku("xl/styles.xml");
  const ozelTarih = new Set([...stiller.matchAll(/<numFmt numFmtId="(\d+)" formatCode="([^"]*)"/g)].filter((m) => /[dy]/i.test(m[2]) && !/0\.0/.test(m[2])).map((m) => +m[1]));
  const xf = [...(stiller.match(/<cellXfs[^>]*>([\s\S]*?)<\/cellXfs>/)?.[1] ?? "").matchAll(/<xf [^>]*numFmtId="(\d+)"/g)].map((m) => +m[1]);
  const tarihStil = (s?: string) => { const f = xf[Number(s ?? -1)]; return f != null && ((f >= 14 && f <= 22) || ozelTarih.has(f)); };
  const at = (el: string, ad: string) => el.match(new RegExp(`\\s${ad}="([^"]*)"`))?.[1] ?? "";
  // Öznitelik sırası programa göre değişir (Excel: Id önce, openpyxl: Target önce) → her birini ayrı oku
  const rels = Object.fromEntries([...oku("xl/_rels/workbook.xml.rels").matchAll(/<Relationship\b[^>]*>/g)].map((m) => [at(m[0], "Id"), at(m[0], "Target")]));
  const sayfalar = [...oku("xl/workbook.xml").matchAll(/<sheet\b[^>]*>/g)].map((m) => [m[0], at(m[0], "name"), at(m[0], "r:id")]);
  return sayfalar.map(([, ad, rid]) => {
    const hedef = rels[rid]?.replace(/^\/?(xl\/)?/, "xl/") ?? "";
    const satirlar: string[][] = [];
    for (const r of oku(hedef).matchAll(/<row[^>]*?(?:\/>|>([\s\S]*?)<\/row>)/g)) {
      const satir: string[] = [];
      for (const c of (r[1] ?? "").matchAll(/<c ([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
        const at = c[1], ic = c[2] ?? "";
        const ref = at.match(/r="([A-Z]+)\d+"/)?.[1]; const t = at.match(/t="(\w+)"/)?.[1]; const s = at.match(/s="(\d+)"/)?.[1];
        const v = ic.match(/<v>([\s\S]*?)<\/v>/)?.[1];
        let deger = t === "s" ? paylasilan[Number(v)] ?? "" : t === "inlineStr" ? xmlCoz([...ic.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((x) => x[1]).join("")) : v != null ? xmlCoz(v) : "";
        if ((!t || t === "n") && v && tarihStil(s) && /^\d+(\.\d+)?$/.test(v)) deger = excelTarih(Number(v));
        satir[ref ? sutunNo(ref) : satir.length] = deger.trim();
      }
      satirlar.push(Array.from(satir, (x) => x ?? ""));
    }
    return { ad: xmlCoz(ad), satirlar };
  });
}

/** CSV / TSV / noktalı virgül — ayraç ilk satırlardan seçilir; tırnaklı alan ve satır içi yeni satır desteklenir */
export function csvOku(metin: string, ad = "Sayfa"): Sayfa {
  const t = metin.replace(/^\uFEFF/, "");
  const ornek = t.split(/\r?\n/).slice(0, 5).join("\n");
  const ayrac = [";", "\t", ",", "|"].map((a) => [a, (ornek.match(new RegExp(a === "|" ? "\\|" : a, "g")) ?? []).length] as const).sort((a, b) => b[1] - a[1])[0][0];
  const satirlar: string[][] = []; let satir: string[] = [], alan = "", tirnak = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (tirnak) { if (c === '"' && t[i + 1] === '"') { alan += '"'; i++; } else if (c === '"') tirnak = false; else alan += c; continue; }
    if (c === '"' && !alan) tirnak = true;
    else if (c === ayrac) { satir.push(alan.trim()); alan = ""; }
    else if (c === "\n" || c === "\r") { if (c === "\r" && t[i + 1] === "\n") i++; satir.push(alan.trim()); satirlar.push(satir); satir = []; alan = ""; }
    else alan += c;
  }
  if (alan || satir.length) { satir.push(alan.trim()); satirlar.push(satir); }
  return { ad, satirlar };
}

export function dosyaOku(ad: string, veri: Uint8Array): Sayfa[] {
  if (/\.xlsx$/i.test(ad) || (veri[0] === 0x50 && veri[1] === 0x4b && !/\.zip$/i.test(ad))) return xlsxOku(veri);
  if (/\.xls$/i.test(ad)) throw new Error("Eski .xls biçimi okunamıyor; Excel'de 'Farklı kaydet → .xlsx' ya da CSV yapın");
  return [csvOku(new TextDecoder("utf-8").decode(veri), ad.replace(/\.[^.]+$/, ""))];
}