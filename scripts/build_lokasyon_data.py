"""
Türkiye il / ilçe / mahalle veri setini seed JSON'larına dönüştürür.
Kaynak: PTT posta kodu listesi (turkey-neighbourhoods npm paketi, MIT) — 81 il, 973 ilçe.
Çalıştır: python3 scripts/build_lokasyon_data.py
"""
import json, re, unicodedata, pathlib
SRC = pathlib.Path("node_modules/turkey-neighbourhoods/src/data")
OUT = pathlib.Path("prisma/seed/data")

TR = str.maketrans("çğıöşüÇĞİÖŞÜâîû", "cgiosuCGIOSUaiu")
def slug(s: str) -> str:
    s = s.translate(TR).lower()
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", s).strip("-")

def tr_title(s: str) -> str:
    # "aşağıdere köyü" -> "Aşağıdere Köyü" (Türkçe i/İ duyarlı)
    out = []
    for w in s.split():
        f = w[0]
        f = "İ" if f == "i" else ("I" if f == "ı" else f.upper())
        out.append(f + w[1:])
    return " ".join(out)

def parse(raw: str):
    raw = raw.strip()
    bagli = None
    m = re.match(r"^(.*?)\s*\((.+)\)$", raw)
    if m:
        raw, bagli = m.group(1).strip(), tr_title(m.group(2).strip())
    tip = "MAHALLE"
    for suf, t in ((" Mah", "MAHALLE"), (" Köyü", "KOY"), (" Beldesi", "BELDE")):
        if raw.endswith(suf):
            raw, tip = raw[: -len(suf)].strip(), t
            break
    if bagli and tip == "MAHALLE":
        tip = "KOY_MAHALLESI" if bagli.endswith("Köyü") else ("BELDE_MAHALLESI" if bagli.endswith("Beldesi") else tip)
    return raw, tip, bagli

cities = json.load(open(SRC / "cityList.json"))
rows = json.load(open(SRC / "neighbourhoods.json"))

iller = [{"id": int(c["code"]), "plaka": c["code"], "ad": c["name"], "slug": slug(c["name"])} for c in cities]
ilce_key = {}
ilceler, mahalleler = [], []
for plaka, _il, ilce, mah, posta in rows:
    k = (plaka, ilce)
    if k not in ilce_key:
        ilce_key[k] = len(ilceler) + 1
        ilceler.append({"id": ilce_key[k], "ilId": int(plaka), "ad": ilce, "slug": slug(ilce)})
    ad, tip, bagli = parse(mah)
    mahalleler.append([ilce_key[k], ad, tip, bagli, posta])

# ilçe içi slug çakışmalarını (aynı ad, farklı bağlı köy) ayrıştır
seen = {}
for m in mahalleler:
    base = slug(m[1] + (" " + m[3] if m[3] else ""))
    key = (m[0], base)
    seen[key] = seen.get(key, 0) + 1
    m.append(base if seen[key] == 1 else f"{base}-{seen[key]}")

OUT.mkdir(parents=True, exist_ok=True)
json.dump(iller, open(OUT / "iller.json", "w"), ensure_ascii=False)
json.dump(ilceler, open(OUT / "ilceler.json", "w"), ensure_ascii=False)
# kompakt satır formatı: [ilceId, ad, tip, bagliOlduguYer, postaKodu, slug]
json.dump(mahalleler, open(OUT / "mahalleler.json", "w"), ensure_ascii=False, separators=(",", ":"))
print(f"il={len(iller)} ilce={len(ilceler)} mahalle/köy={len(mahalleler)}")