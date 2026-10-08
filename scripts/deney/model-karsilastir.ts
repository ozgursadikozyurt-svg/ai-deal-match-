/**
 * Anahtar CRM v3.21.1 · 8 Ekim 2026
 * MODEL DENEYİ — eşleştirme puanlamasının varyasyonlarını etiketli senaryolarla karşılaştırır.
 * Çalıştır: npx tsx scripts/deney/model-karsilastir.ts        (ayrıntı için: … --ayrinti)
 *
 * Her senaryo: bir talep + bir portföy + beklenen sonuç (S = sunulabilir, K = koşullu, U = uygun değil).
 * Her grupta ayrıca "sıra" beklentileri var: a > b = a'nın skoru b'den yüksek olmalı.
 * Etiketler saha mantığına göre elle konuldu (Özgür'ün v3.10'da bildirdiği Fener/Çağlayan ↔ Doğuyaka örneği dahil);
 * gerçek eşleşmeler biriktikçe buraya eklenip model yeniden ayarlanır.
 * Taban (V0) = v3.10 motorunun dondurulmuş kopyası (onizleme_v310.ts).
 */
import { eslesmeOnizle, MODEL, type ModelAyar, type OnizlemeKayit } from "../../src/lib/eslestirme/onizleme";
import { eslesmeOnizle as eski } from "./onizleme_v310";
import { BAGLAM, coz } from "../../demo/lokasyon";

type Bek = "S" | "K" | "U";
const KISA = { SUNULABILIR: "S", KOSULLU: "K", UYGUN_DEGIL: "U" } as const;
const lok = (ham: string, portfoy: boolean) => coz(ham).lokasyonlar.map((l, i) => ({ ilId: l.ilId, ilceId: l.ilceId, mahalleId: l.mahalleId, altBolgeId: l.altBolgeId, birincil: portfoy && i === 0 }));
const T = (ham: string, v: Partial<OnizlemeKayit>): OnizlemeKayit => ({ tip: "TALEP", mulkTipi: "DAIRE", islemTipi: "SATILIK", lokasyonlar: lok(ham, false), ...v });
const P = (ham: string, v: Partial<OnizlemeKayit>): OnizlemeKayit => ({ tip: "PORTFOY", mulkTipi: "DAIRE", islemTipi: "SATILIK", lokasyonlar: lok(ham, true), ...v });

interface Grup { ad: string; talep: OnizlemeKayit; p: Record<string, [OnizlemeKayit, Bek, string]>; sira: [string, string][] }
const daire = { mulkTipi: "DAIRE", islemTipi: "SATILIK" };
const G: Grup[] = [
  {
    ad: "1 · Konut — 2+1, ≤ 10 M TL, Fener / Çağlayan (v3.10'da bildirilen örnek)",
    talep: T("Fener, Çağlayan", { ...daire, odaSayisi: "2+1", maxFiyat: 10_000_000 }),
    p: {
      a: [P("Muratpaşa / Fener", { odaSayisi: "2+1", fiyat: 8_500_000 }), "S", "istenen mahalle, istenen oda"],
      b: [P("Muratpaşa / Çağlayan", { odaSayisi: "2+1", fiyat: 9_000_000 }), "S", "istenen diğer mahalle"],
      c: [P("Muratpaşa / Güzeloluk", { odaSayisi: "2+1", fiyat: 8_500_000 }), "S", "Çağlayan'ın sınır komşusu"],
      d: [P("Muratpaşa / Şirinyalı", { odaSayisi: "2+1", fiyat: 8_000_000 }), "S", "Fener'in sınır komşusu"],
      e: [P("Muratpaşa / Doğuyaka", { odaSayisi: "3+1", fiyat: 5_650_000, m2: 115 }), "U", "3,9 km uzak + oda fazla + bütçenin %57'si (v3.10: 92 puan, Sunulabilir)"],
      f: [P("Muratpaşa / Fener", { odaSayisi: "3+1", fiyat: 9_500_000 }), "S", "bir oda fazla — sunulur ama (a)'nın altında"],
      g: [P("Muratpaşa / Fener", { odaSayisi: "4+1", fiyat: 9_800_000 }), "K", "iki oda fazla"],
      h: [P("Muratpaşa / Meltem", { odaSayisi: "2+1", fiyat: 8_000_000 }), "U", "şehrin öbür ucu"],
      i: [P("Muratpaşa / Fener", { odaSayisi: "2+1", fiyat: 3_500_000 }), "S", "bütçenin %35'i — sunulur ama (a)'nın altında"],
      j: [P("Muratpaşa / Fener", { odaSayisi: "1+1", fiyat: 6_000_000 }), "K", "oda eksik"],
      k: [P("Muratpaşa / Fener", { odaSayisi: "2+1", fiyat: 11_500_000 }), "U", "bütçeyi %15 aşıyor"],
      l: [P("Muratpaşa / Yeşilbahçe", { odaSayisi: "2+1", fiyat: 9_000_000 }), "S", "Fener'e 1,2 km (komşu değil)"],
      m: [P("Muratpaşa / Zerdalilik", { odaSayisi: "2+1", fiyat: 9_000_000 }), "K", "Fener'e 3 km — sormadan sunulmaz"],
      n: [P("Muratpaşa", { odaSayisi: "2+1", fiyat: 9_000_000 }), "K", "portföyün mahallesi girilmemiş"],
    },
    sira: [["a", "c"], ["a", "f"], ["a", "i"], ["c", "l"], ["d", "l"], ["l", "m"], ["m", "e"], ["f", "g"], ["c", "f"], ["a", "n"]],
  },
  {
    ad: "2 · İlçe sınırı — kiralık dükkan, Meltem (Muratpaşa), 100–200 m², ≤ 100 bin TL",
    talep: T("Muratpaşa / Meltem", { mulkTipi: "DUKKAN_MAGAZA", islemTipi: "KIRALIK", minM2: 100, maxM2: 200, maxFiyat: 100_000, fiyatPeriyodu: "AYLIK" }),
    p: {
      a: [P("Muratpaşa / Meltem", { mulkTipi: "DUKKAN_MAGAZA", islemTipi: "KIRALIK", m2: 150, fiyat: 90_000, fiyatPeriyodu: "AYLIK" }), "S", "istenen mahalle"],
      b: [P("Konyaaltı / Arapsuyu", { mulkTipi: "DUKKAN_MAGAZA", islemTipi: "KIRALIK", m2: 150, fiyat: 90_000, fiyatPeriyodu: "AYLIK" }), "S", "başka ilçe ama sınır komşusu"],
      c: [P("Muratpaşa / Bahçelievler", { mulkTipi: "DUKKAN_MAGAZA", islemTipi: "KIRALIK", m2: 150, fiyat: 90_000, fiyatPeriyodu: "AYLIK" }), "S", "sınır komşusu"],
      d: [P("Muratpaşa / Güzeloba", { mulkTipi: "DUKKAN_MAGAZA", islemTipi: "KIRALIK", m2: 150, fiyat: 90_000, fiyatPeriyodu: "AYLIK" }), "U", "aynı ilçe ama 10 km uzak"],
      e: [P("Konyaaltı / Hurma", { mulkTipi: "DUKKAN_MAGAZA", islemTipi: "KIRALIK", m2: 150, fiyat: 90_000, fiyatPeriyodu: "AYLIK" }), "U", "3,9 km uzak"],
    },
    sira: [["a", "b"], ["a", "c"], ["b", "d"], ["b", "e"], ["c", "d"]],
  },
  {
    ad: "3 · Yalnızca ilçe — kiralık ofis, Muratpaşa, ≤ 50 bin TL",
    talep: T("Muratpaşa", { mulkTipi: "BURO_OFIS", islemTipi: "KIRALIK", maxFiyat: 50_000, fiyatPeriyodu: "AYLIK", minM2: 80, maxM2: 150 }),
    p: {
      a: [P("Muratpaşa / Kızıltoprak", { mulkTipi: "BURO_OFIS", islemTipi: "KIRALIK", m2: 100, fiyat: 40_000, fiyatPeriyodu: "AYLIK" }), "S", "istenen ilçenin içinde — tam uyum"],
      b: [P("Konyaaltı / Arapsuyu", { mulkTipi: "BURO_OFIS", islemTipi: "KIRALIK", m2: 100, fiyat: 40_000, fiyatPeriyodu: "AYLIK" }), "S", "ilçe sınırına bitişik"],
      c: [P("Kepez / Varsak Karşıyaka", { mulkTipi: "BURO_OFIS", islemTipi: "KIRALIK", m2: 100, fiyat: 40_000, fiyatPeriyodu: "AYLIK" }), "U", "ilçeden uzak"],
    },
    sira: [["a", "b"], ["b", "c"]],
  },
  {
    ad: "4 · Alt bölge — kiralık 3+1, Lara, ≤ 60 bin TL",
    talep: T("Lara", { mulkTipi: "DAIRE", islemTipi: "KIRALIK", odaSayisi: "3+1", maxFiyat: 60_000, fiyatPeriyodu: "AYLIK" }),
    p: {
      a: [P("Muratpaşa / Güzeloba", { islemTipi: "KIRALIK", odaSayisi: "3+1", fiyat: 55_000, fiyatPeriyodu: "AYLIK" }), "S", "Lara'nın içinde"],
      b: [P("Muratpaşa / Güzeloluk", { islemTipi: "KIRALIK", odaSayisi: "3+1", fiyat: 55_000, fiyatPeriyodu: "AYLIK" }), "S", "Lara mahallelerine sınır komşusu (v3.10: bölge dışı)"],
      c: [P("Muratpaşa / Kızıltoprak", { islemTipi: "KIRALIK", odaSayisi: "3+1", fiyat: 55_000, fiyatPeriyodu: "AYLIK" }), "S", "Lara'ya (Yeşilbahçe sınırına) 1,2 km"],
      d: [P("Muratpaşa / Meltem", { islemTipi: "KIRALIK", odaSayisi: "3+1", fiyat: 55_000, fiyatPeriyodu: "AYLIK" }), "U", "uzak"],
    },
    sira: [["a", "b"], ["b", "c"], ["c", "d"]],
  },
  {
    ad: "5 · Sanayi — kiralık depo, Altınova Sinan (Kepez), 1.000–2.000 m², ≤ 300 bin TL",
    talep: T("Kepez / Altınova Sinan", { mulkTipi: "DEPO_ANTREPO", islemTipi: "KIRALIK", minM2: 1000, maxM2: 2000, maxFiyat: 300_000, fiyatPeriyodu: "AYLIK" }),
    p: {
      a: [P("Kepez / Altınova Sinan", { mulkTipi: "DEPO_ANTREPO", islemTipi: "KIRALIK", m2: 1500, fiyat: 250_000, fiyatPeriyodu: "AYLIK" }), "S", "istenen mahalle"],
      b: [P("Aksu / Cihadiye", { mulkTipi: "DEPO_ANTREPO", islemTipi: "KIRALIK", m2: 1500, fiyat: 250_000, fiyatPeriyodu: "AYLIK" }), "S", "başka ilçe, sınır komşusu"],
      c: [P("Aksu / Hacıaliler", { mulkTipi: "DEPO_ANTREPO", islemTipi: "KIRALIK", m2: 1500, fiyat: 250_000, fiyatPeriyodu: "AYLIK" }), "K", "2 km"],
      d: [P("Kepez / Altınova Sinan", { mulkTipi: "DEPO_ANTREPO", islemTipi: "KIRALIK", m2: 1500, fiyat: 120_000, fiyatPeriyodu: "AYLIK" }), "S", "ucuz (bütçenin %40'ı) — ticaride engel değil"],
      e: [P("Kepez / Varsak Karşıyaka", { mulkTipi: "DEPO_ANTREPO", islemTipi: "KIRALIK", m2: 1500, fiyat: 250_000, fiyatPeriyodu: "AYLIK" }), "U", "aynı ilçe, uzak"],
    },
    sira: [["a", "b"], ["b", "c"], ["c", "e"], ["a", "d"]],
  },
  {
    ad: "6 · “Bölge esnek” — 2+1, Fener, komşu bölgeler de olur",
    talep: T("Muratpaşa / Fener", { ...daire, odaSayisi: "2+1", maxFiyat: 10_000_000, ozellik: { esnekKriterler: ["LOKASYON"] } }),
    p: {
      a: [P("Muratpaşa / Doğuyaka", { odaSayisi: "2+1", fiyat: 9_000_000 }), "K", "3,9 km — esnek olduğu için elenmez, sorulur"],
      b: [P("Muratpaşa / Çağlayan", { odaSayisi: "2+1", fiyat: 9_000_000 }), "S", "komşu"],
      c: [P("Muratpaşa / Meltem", { odaSayisi: "2+1", fiyat: 9_000_000 }), "K", "çok uzak — esnek, elenmez ama en altta"],
    },
    sira: [["b", "a"], ["a", "c"]],
  },
  {
    ad: "7 · Bütçe aralığı — 3+1, Konyaaltı / Liman, 7–10 M TL",
    talep: T("Konyaaltı / Liman", { ...daire, odaSayisi: "3+1", minFiyat: 7_000_000, maxFiyat: 10_000_000 }),
    p: {
      a: [P("Konyaaltı / Liman", { odaSayisi: "3+1", fiyat: 8_500_000 }), "S", "aralığın içinde"],
      b: [P("Konyaaltı / Liman", { odaSayisi: "3+1", fiyat: 6_500_000 }), "S", "alt sınırın %7 altında"],
      c: [P("Konyaaltı / Liman", { odaSayisi: "3+1", fiyat: 4_000_000 }), "K", "alt sınırın çok altında"],
    },
    sira: [["a", "b"], ["b", "c"]],
  },
  {
    ad: "8 · Başka il (sınır verisi yok) — İzmir Bornova",
    talep: T("İzmir Bornova Kazımdirik", { ...daire, odaSayisi: "2+1", maxFiyat: 6_000_000 }),
    p: {
      a: [P("İzmir Bornova Kazımdirik", { odaSayisi: "2+1", fiyat: 5_500_000 }), "S", "aynı mahalle"],
      b: [P("İzmir Bornova Erzene", { odaSayisi: "2+1", fiyat: 5_500_000 }), "S", "aynı ilçe — veri yok, eski kural"],
      c: [P("Muratpaşa / Fener", { odaSayisi: "2+1", fiyat: 5_500_000 }), "U", "başka il"],
    },
    sira: [["a", "b"], ["b", "c"]],
  },
];

const M = (d: Partial<Omit<ModelAyar, "lok" | "oda">> & { lok?: Partial<ModelAyar["lok"]>; oda?: Partial<ModelAyar["oda"]> }): ModelAyar => ({ ...MODEL, ...d, lok: { ...MODEL.lok, ...(d.lok ?? {}) }, oda: { ...MODEL.oda, ...(d.oda ?? {}) } } as ModelAyar);
type Motor = (t: OnizlemeKayit, p: OnizlemeKayit) => { skor: number; uygunluk: keyof typeof KISA; lokasyonAciklama: string };
const yeni = (a: ModelAyar): Motor => (t, p) => eslesmeOnizle(t, p, BAGLAM, a);
const VARYASYONLAR: [string, string, Motor][] = [
  ["V0", "v3.10 (taban)", (t, p) => eski(t as any, p as any, BAGLAM)],
  ["A", "SEÇİLEN: komşu 0,85 · ≤1,5 km 0,65 · ≤3 km 0,40 (koşullu) · oda+1 0,6 · bütçe altı hafif", yeni(MODEL)],
  ["B", "konum dik: komşu 0,70 · yakın 0,45 · orta 0,20", yeni(M({ lok: { komsu: 0.7, yakin: 0.45, orta: 0.2 } }))],
  ["C", "konum yumuşak: komşu 0,95 · yakın 0,80 · orta 0,60", yeni(M({ lok: { komsu: 0.95, yakin: 0.8, orta: 0.6 } }))],
  ["D", "konum sıkı: 1,5 km'den uzağı bölge dışı", yeni(M({ lok: { ortaM: 1500 } }))],
  ["E", "konum geniş: 5 km'ye kadar koşullu", yeni(M({ lok: { ortaM: 5000 } }))],
  ["F", "oda gevşek: fazla oda tam puan (v3.10 davranışı)", yeni(M({ oda: { fazla1: 1, fazla2: 1 } }))],
  ["G", "oda sıkı: bir oda fazla da koşullu (0,3)", yeni(M({ oda: { fazla1: 0.3 } }))],
  ["H", "bütçe altı cezası yok", yeni(M({ fiyatAlt: null }))],
  ["I", "bütçe altı sert: < %60 → 0,5 (koşullu)", yeni(M({ fiyatAlt: { esik1: 0.6, puan1: 0.5, esik2: 0.4, puan2: 0.2 } }))],
  ["J", "koşullu eşiği 0,5", yeni(M({ kosulluAlti: 0.5 }))],
];

const ayrinti = process.argv.includes("--ayrinti");
const satirlar: string[] = [];
const sonuc = VARYASYONLAR.map(([kod, ad, motor]) => {
  let sinifDogru = 0, sinifToplam = 0, siraDogru = 0, siraToplam = 0;
  const hatalar: string[] = [];
  for (const g of G) {
    const r: Record<string, { skor: number; u: Bek; ac: string }> = {};
    for (const [k, [p, bek, neden]] of Object.entries(g.p)) {
      const s = motor(g.talep, p);
      r[k] = { skor: s.skor, u: KISA[s.uygunluk], ac: s.lokasyonAciklama };
      sinifToplam++;
      if (r[k].u === bek) sinifDogru++; else hatalar.push(`  ${g.ad.split(" · ")[0]}${k}: beklenen ${bek}, çıkan ${r[k].u} (${s.skor}) — ${neden}`);
    }
    for (const [x, y] of g.sira) { siraToplam++; if (r[x].skor > r[y].skor) siraDogru++; else hatalar.push(`  ${g.ad.split(" · ")[0]}${x} > ${y} olmalıydı: ${r[x].skor} / ${r[y].skor}`); }
    if (ayrinti && (kod === "V0" || kod === "A")) satirlar.push(`\n[${kod}] ${g.ad}\n` + Object.entries(r).map(([k, v]) => `   ${k}  ${String(v.skor).padStart(3)} ${v.u}  (beklenen ${g.p[k][1]})  ${v.ac} — ${g.p[k][2]}`).join("\n"));
  }
  return { kod, ad, sinifDogru, sinifToplam, siraDogru, siraToplam, hatalar };
});
console.log(`Senaryo: ${sonuc[0].sinifToplam} talep↔portföy çifti, ${sonuc[0].siraToplam} sıralama beklentisi\n`);
console.log("Kod  Sınıf doğru   Sıra doğru   Toplam   Model");
for (const s of sonuc) console.log(`${s.kod.padEnd(4)} ${`${s.sinifDogru}/${s.sinifToplam}`.padEnd(13)} ${`${s.siraDogru}/${s.siraToplam}`.padEnd(12)} ${String(Math.round((100 * (s.sinifDogru + s.siraDogru)) / (s.sinifToplam + s.siraToplam))).padStart(3)}%    ${s.ad}`);
if (ayrinti) { console.log(satirlar.join("\n")); for (const s of sonuc) if (s.hatalar.length) console.log(`\n${s.kod} — tutmayanlar:\n${s.hatalar.join("\n")}`); }
export const DENEY_SONUCU = sonuc;