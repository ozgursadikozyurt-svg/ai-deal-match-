#!/usr/bin/env python3
# Anahtar CRM v3.14 · 3 Ekim 2026
"""Kaynak paketini tek Markdown dosyası olarak üretir (claude.ai projesine konan `anahtar-crm_kaynak_v<sürüm>_<tarih>.md`).
Çalıştır: python3 scripts/kaynak-paketi.py [çıktı klasörü]   — sürüm ve tarih src/lib/surum.ts'ten okunur."""
import os, re, subprocess, sys
kok = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
surum_ts = open(os.path.join(kok, "src/lib/surum.ts"), encoding="utf-8").read()
SURUM = re.search(r'export const SURUM = "([^"]+)"', surum_ts).group(1)
TARIH = re.search(r'export const TARIH = "([^"]+)"', surum_ts).group(1)
EKI = re.search(r'export const DOSYA_EKI = "([^"]+)"', surum_ts).group(1)
ATLA_KLASOR = {"node_modules", "dist", ".git", "generated", "fixtures"}
ATLA_DOSYA = {"package-lock.json", "SURUMLER.md", "antalya-veri.json", "turkiye-veri.json", ".env", ".dev.vars", "rotalar.generated.ts", "gomulu.generated.ts"}
UZANTI = (".ts", ".tsx", ".mjs", ".js", ".json", ".jsonc", ".prisma", ".sql", ".sh", ".py", ".html", ".toml", ".md", ".example", ".ornek", ".webmanifest", ".gitignore")
dosyalar = []
for d, klasorler, adlar in os.walk(kok):
    klasorler[:] = sorted(k for k in klasorler if k not in ATLA_KLASOR and not (k == "data" and d.endswith("seed")))
    for a in sorted(adlar):
        yol = os.path.relpath(os.path.join(d, a), kok).replace(os.sep, "/")
        if a in ATLA_DOSYA or not (a.endswith(UZANTI) or a in (".gitignore", ".env.example")): continue
        dosyalar.append(yol)
dosyalar.sort(key=lambda y: (y.count("/") > 0, y))
DIL = {".ts": "ts", ".tsx": "tsx", ".mjs": "js", ".js": "js", ".json": "json", ".prisma": "prisma", ".sql": "sql", ".sh": "bash", ".py": "python", ".html": "html", ".toml": "toml", ".md": "markdown"}
bas = f'''# Anahtar CRM — Kaynak paketi v{SURUM} · {TARIH}

Bu dosya uygulamanın kaynak kodunun tamamını içerir (node_modules, üretilmiş Prisma istemcisi ve büyük veri dosyaları hariç). Yeni bir sohbette kodu geri kurmak için:

1. Bu dosyayı `anahtar-crm_kaynak.md` olarak kaydedin ve aşağıdaki Python betiğini aynı klasörde çalıştırın; `anahtar/` klasörü oluşur.
2. `cd anahtar && npm install && npm run lokasyon:build` (il/ilçe/mahalle verisini `turkey-neighbourhoods` paketinden yeniden üretir) `&& PRISMA_SCHEMA_ENGINE_BINARY=/bin/true DIRECT_URL=postgresql://x npx prisma generate && npm run demo`. Testler: `chmod +x scripts/*.sh && python3 scripts/fikstur_v37.py && npm run test:db` (142 test).
3. Belgeler (ALTYAPI, PRD; v3.11 ve v3.12 değişiklikleri `ANAHTAR_CRM_EK_v3.11_2Ekim2026.md`, `…_v3.12_…` (v3.13 notu sonunda) ve `ANAHTAR_CRM_EK_v3.14_3Ekim2026.md` (canlı sürüm, §52–60) eklerinde) ve SURUMLER.md proje dosyalarında ayrı durur. Demo sabit bağlantısı: https://claude.ai/artifact/9SDMmSyeTmx1zbWR42TYJN (Artifact aracına `url` olarak verilerek güncellenir; yayınlanan dosya `dist/artifact.html`, yetenekler: `downloads`, `sample`).
4. Mahalle komşuluk tablosu (`src/lib/lokasyon/antalya-komsuluk.json`) pakettedir; yeniden üretmek gerekmez (gerekirse: `scripts/build_komsuluk.py`). Model deneyi: `npx tsx scripts/deney/model-karsilastir.ts --ayrinti`.
5. Canlı sürüm: yayına alma `CANLIYA_ALMA_REHBERI_v3.14_3Ekim2026.md`; GitHub/Cloudflare için kaynak md değil, depo zip'i (`anahtarcrm_v3.14_3Ekim2026.zip`, üretilmiş Prisma istemcisi ve konum verisi dahil) kullanılır.\n6. Sohbet sonu kontrol listesi: ALTYAPI §18. Bu paketi yeniden üretmek için: `python3 scripts/kaynak-paketi.py`.

```python
import re,os
s=open("anahtar-crm_kaynak.md",encoding="utf-8").read()
for yol,cit,icerik in re.findall(r"^### `([^`]+)`\\n\\n(`{{3,4}})[a-z]*\\n(.*?)\\n\\2$",s,flags=re.S|re.M):
    p=os.path.join("anahtar",yol); os.makedirs(os.path.dirname(p),exist_ok=True); open(p,"w",encoding="utf-8").write(icerik+"\\n")
```

Dosya sayısı: {len(dosyalar)}

> Test fikstürü `tests/fixtures/v37_ornek.xlsx` ikili dosya olduğu için pakette yok; `python3 scripts/fikstur_v37.py` ile yeniden üretilir.

'''
parcalar = [bas]
for y in dosyalar:
    icerik = open(os.path.join(kok, y), encoding="utf-8").read().rstrip("\n")
    cit = "````" if "```" in icerik else "```"
    dil = DIL.get(os.path.splitext(y)[1], "")
    parcalar.append(f"### `{y}`\n\n{cit}{dil}\n{icerik}\n{cit}\n\n")
hedef_klasor = sys.argv[1] if len(sys.argv) > 1 else os.path.join(kok, "dist")
os.makedirs(hedef_klasor, exist_ok=True)
hedef = os.path.join(hedef_klasor, f"anahtar-crm_kaynak_{EKI}.md")
open(hedef, "w", encoding="utf-8").write("".join(parcalar))
print(f"✔ {hedef} · {len(dosyalar)} dosya · {os.path.getsize(hedef) // 1024} KB")