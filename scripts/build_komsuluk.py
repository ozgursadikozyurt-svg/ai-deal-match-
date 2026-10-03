#!/usr/bin/env python3
# Anahtar CRM v3.11 · 2 Ekim 2026
"""
Antalya mahalle komşuluk / mesafe tablosunu üretir → src/lib/lokasyon/antalya-komsuluk.json

Kaynak: github.com/ttezer/turkiye-harita-verisi → dist/geojson/mahalle-geometrileri-by-district-v2/TR-D-07-*.geojson
(Antalya'nın 19 ilçesi, 917 mahalle sınırı; kaynak etiketi "kullanıcı tarafından sağlanan KML" — resmî değildir,
eşleştirme için yeterli, tapu/kadastro işi için kullanılmaz.)

Çalıştır (yalnızca sınır verisi değişince; üretilen JSON kaynak paketinde durur):
  pip install shapely pyproj
  python3 scripts/build_komsuluk.py <geojson klasörü> <districts.csv>

Hesap (UTM 36N, metre):
  - mesafe  = iki mahallenin SINIRLARI arasındaki en kısa mesafe (merkez noktası değil: mahalle alanları
              0,04 km² ile 800+ km² arasında değişir, merkez mesafesi büyük mahallelerde yanıltır)
  - komşu   = sınırlar 30 m içinde VE en az 100 m boyunca yan yana (köşeden değen mahalleler komşu sayılmaz)
  - 5 km'den uzak çiftler yazılmaz (eşleştirmede "uzak" sayılır)
Çıktı: { m: [[ilçe adı, mahalle slug, enlem, boylam, km²]…], c: [[i, j, mesafe_m, komşu 0/1]…] }
Mahalleler uygulamadaki kimliklere ilçe adı + slug ile bağlanır (kimlikten bağımsız).
"""
import csv, difflib, glob, json, os, re, sys, unicodedata
from shapely.geometry import shape
from shapely.ops import transform
from shapely.strtree import STRtree
import pyproj

GEO, CSV = sys.argv[1], sys.argv[2]
KOK = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TR = str.maketrans("çğıöşüÇĞİÖŞÜâîû", "cgiosuCGIOSUaiu")
def slug(s):
    s = unicodedata.normalize("NFKD", s.translate(TR).lower()).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", s).strip("-")
def yalin(s):  # "molla-yusuf" = "mollayusuf", "tekke" = "tekkekoy", "a-hisar" = "asagihisar"
    s = re.sub(r"^a-", "asagi-", re.sub(r"^y-", "yukari-", s))
    return re.sub(r"(koy|mahallesi)$", "", s.replace("-", ""))

ilceAd = {r["id"]: r["name"] for r in csv.DictReader(open(CSV, encoding="utf-8-sig"))}
ilceler = [i for i in json.load(open(os.path.join(KOK, "prisma/seed/data/ilceler.json"))) if i["ilId"] == 7]
ilceId = {i["ad"]: i["id"] for i in ilceler}
uyg = {}
for m in json.load(open(os.path.join(KOK, "prisma/seed/data/mahalleler.json"))):
    uyg.setdefault(m[0], []).append(m[5])

utm = pyproj.Transformer.from_crs(4326, 32636, always_xy=True).transform
M, G, eslesmeyen = [], [], []
for yol in sorted(glob.glob(os.path.join(GEO, "TR-D-07-*.geojson"))):
    ilce = ilceAd[os.path.basename(yol)[:-8]]
    sluglar = uyg[ilceId[ilce]]
    kalan = set(sluglar)
    ozellikler = json.load(open(yol))["features"]
    # 1. tur: birebir slug; 2. tur: yalın biçim; 3. tur: en yakın yazım (aynı ilçe içinde)
    atama = {}
    for f in ozellikler:
        s = slug(f["properties"]["name"])
        if s in kalan: atama[id(f)] = s; kalan.discard(s)
    for f in ozellikler:
        if id(f) in atama: continue
        y = yalin(slug(f["properties"]["name"]))
        aday = [k for k in kalan if yalin(k) == y]
        if len(aday) == 1: atama[id(f)] = aday[0]; kalan.discard(aday[0])
    for f in ozellikler:
        if id(f) in atama: continue
        y = yalin(slug(f["properties"]["name"]))
        yakin = difflib.get_close_matches(y, [yalin(k) for k in kalan], n=1, cutoff=0.75)
        aday = [k for k in kalan if yakin and yalin(k) == yakin[0]]
        if len(aday) == 1: atama[id(f)] = aday[0]; kalan.discard(aday[0])
        else: eslesmeyen.append(f"{ilce}/{f['properties']['name']}")
    for f in ozellikler:
        if id(f) not in atama: continue
        g4326 = shape(f["geometry"]).buffer(0)
        g = transform(utm, g4326)
        c = g4326.representative_point()
        M.append([ilce, atama[id(f)], round(c.y, 5), round(c.x, 5), round(g.area / 1e6, 2)])
        G.append(g)

agac = STRtree(G)
C = []
for i, g in enumerate(G):
    for j in agac.query(g.buffer(5000)):
        j = int(j)
        if j <= i: continue
        d = g.distance(G[j])
        if d > 5000: continue
        komsu = d < 30 and g.buffer(30).intersection(G[j].boundary).length > 100
        C.append([i, j, 0 if komsu else max(1, round(d)), 1 if komsu else 0])

hedef = os.path.join(KOK, "src/lib/lokasyon/antalya-komsuluk.json")
with open(hedef, "w", encoding="utf-8") as f:
    json.dump({"kaynak": "ttezer/turkiye-harita-verisi (mahalle-geometrileri-by-district-v2)", "m": M, "c": C}, f, ensure_ascii=False, separators=(",", ":"))
    f.write("\n")
print(f"✔ {hedef} · {len(M)} mahalle · {len(C)} çift (≤5 km) · {sum(x[3] for x in C)} komşu çift · {os.path.getsize(hedef)//1024} KB")
if eslesmeyen: print("! uygulamada karşılığı bulunamayan:", ", ".join(eslesmeyen))