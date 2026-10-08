/**
 * Anahtar CRM v3.21.2 · 8 Ekim 2026
 * Türkiye geneli konum: çalışma ili dışındaki il / ilçe / mahalle ifadelerini tanır ve çözer.
 *
 * Mantık (kural tabanlı, yapay zekâ gerekmez):
 *  - Çalışma ili (varsayılan Antalya) eskisi gibi tam sözlükle çözülür: ilçe, mahalle, alt bölge, referans nokta, yazım hatası.
 *  - Metinde BAŞKA bir il adı geçerse ("İzmir Bornova'da dükkan") o ilin indeksi açılır; il adından sonra gelen ilçe / mahalle o ilde aranır.
 *  - İl adı yazılmadan yalnızca ilçe geçerse ("Bodrum'da villa") ve o ad Türkiye'de tek bir ilçeyse o ile bağlanır.
 *  - Kişi adı ya da sıradan kelime olabilen adlar (Aydın, Ordu, Selçuk, Çeşme, Konak…) ancak "-da/-de" ekiyle ya da ilçesiyle birlikte kabul edilir.
 *  - "İstanbul'dan gelen müşteri", "Ankaralı", "Burdur yolu" konum sayılmaz.
 */
import { lokasyonAnahtari } from "./normalize";
import { lokasyonCozumle, type CozulenLokasyon, type CozumSonucu, type LokasyonIndeks } from "./cozumle";
import { metindenKonumlar } from "../ai/hizli-ayristirici";
import { TURKIYE_ALT_BOLGELER } from "../../../prisma/seed/turkiye-alt-bolgeler";

/** Herkesin bildiği semt adları (Levent, Kızılay, Alsancak…): resmî mahalle olsalar da ilçesi yazılmadan kabul edilir */
const BILINEN_SEMT = new Set(TURKIYE_ALT_BOLGELER.map(([il, , ad]) => `${lokasyonAnahtari(il)}|${lokasyonAnahtari(ad)}`));

export interface TurkiyeOzeti { iller: { id: number; ad: string }[]; ilceler: { id: number; ilId: number; ad: string }[] }
/** `indeksAl` o ilin tam indeksini verir (demo: gömülü veriden; sunucu: önceden yüklenmiş). null → yalnızca ilçe düzeyinde çözülür. */
export interface CokIlOrtami { ozet: TurkiyeOzeti; indeksAl: (ilId: number) => LokasyonIndeks | null }

/** Halk arasındaki kısa il adları */
const IL_TAKMA: Record<string, number> = { maras: 46, "k maras": 46, kmaras: 46, urfa: 63, antep: 27, afyon: 3, icel: 33, izmit: 41, adapazari: 54, antakya: 31 };
/** Kişi adı / sıradan kelime olabilen il adları: ek ("Aydın'da") ya da kendi ilçesi yanında olmadıkça konum sayılmaz */
const SUPHELI_IL = new Set(["aydin", "ordu", "van", "batman", "mus", "agri", "kars", "bolu", "sinop", "usak", "tokat", "siirt", "rize", "duzce"]);
/** Sıradan kelime / kişi adı / her şehirde bulunan semt adı olabilen ilçe adları: il adı ya da "-da/-de" eki olmadan kabul edilmez */
const SUPHELI_ILCE = new Set(("akdeniz toroslar demirci ciftlik baglar bahce bahcelievler guney konak kiraz cinar maden dicle gediz selcuk menderes selim yildirim fatih kartal kavak keskin korkut kumru kozlu marmara orta pazarlar persembe carsamba ceyhan seyhan kaman karasu karatas hacilar hocalar hamur havza hendek incesu inonu korfez kumlu kursunlu tuzla termal terme ulas uzumlu yenimahalle yesilova yesilli cardak celebi celtik cukurova cesme cubuk erenler esenler evciler evren bucak altintas altinova akpinar akyaka aralik ayranci aziziye bulanik catak canakci derbent dereli derecik dikmen doganyol doganyurt dortyol duzkoy gurpinar gunyuzu haskoy kayapinar kavaklidere karakoyunlu karapinar mahmudiye muradiye sarikaya sogutlu tepebasi tasova taskent toprakkale yedisu yesilhisar cayirli ciftlikkoy cobanlar omerli ihsaniye ikizce golcuk yenicaga saraykent guzelyurt golyaka golova kocakoy hisarcik bayindir kizilirmak boztepe sultanhisar sincan defne efeler meram talas karesi").split(" "));
/** İl adından sonra bunlar geliyorsa konum değildir ("Burdur yolu", "Aydın Bey") */
const KONUM_DEGIL_SONRA = /^(yolu|yol|asfalti|caddesi|cadde|cad|bulvari|bulvar|sokak|sokagi|otogari|plakali|plaka|bey|hanim|hn|abi|abla|hoca|usta|kardesim|bank|bankasi|ekspres|pazari|firini|tantuni|kebap|kebabi|doner|lokantasi|kofte|koftecisi)$/;
const BULUNMA_EKI = /^(d[ae]|t[ae]|d[ae]ki|t[ae]ki|y?[ae]|n[iıuü]n|[iıuü]n|y?[iıuü])$/;
const AYRILMA_EKI = /^(d[ae]n|t[ae]n|l[iıuü]|l[iıuü]y[iıuü]m|l[iıuü]lar|l[iıuü]ler)$/;

interface Sozluk { il: Map<string, number>; ilce: Map<string, { id: number; ilId: number; ad: string }[]>; ilAd: Map<number, string>; ilceAd: Map<number, string> }
const SOZLUK = new WeakMap<TurkiyeOzeti, Sozluk>();
function sozluk(o: TurkiyeOzeti): Sozluk {
  const c = SOZLUK.get(o);
  if (c) return c;
  const il = new Map<string, number>(), ilce = new Map<string, { id: number; ilId: number; ad: string }[]>();
  for (const i of o.iller) il.set(lokasyonAnahtari(i.ad), i.id);
  for (const [k, id] of Object.entries(IL_TAKMA)) if (!il.has(k)) il.set(k, id);
  for (const i of o.ilceler) { const k = lokasyonAnahtari(i.ad); ilce.set(k, [...(ilce.get(k) ?? []), i]); }
  const s = { il, ilce, ilAd: new Map(o.iller.map((i) => [i.id, i.ad])), ilceAd: new Map(o.ilceler.map((i) => [i.id, i.ad])) };
  SOZLUK.set(o, s);
  return s;
}
export const ilAdi = (o: TurkiyeOzeti, ilId: number): string => sozluk(o).ilAd.get(ilId) ?? `İl ${ilId}`;

interface Jeton { ham: string; k: string; ek: string; bas: number; son: number }
/** Metni kelimelere böler; "İzmir'de" → k="izmir", ek="de". Ek kesme işaretsiz yazıldıysa ("izmirde") `ekAyir` dener. */
function jetonla(satir: string): Jeton[] {
  const out: Jeton[] = [];
  for (const m of satir.matchAll(/[\p{L}\d]+(?:[’'`´][\p{L}]+)?/gu)) {
    const [govde, ek = ""] = m[0].split(/[’'`´]/);
    out.push({ ham: m[0], k: lokasyonAnahtari(govde), ek: lokasyonAnahtari(ek), bas: m.index!, son: m.index! + m[0].length });
  }
  return out;
}
/** Kesme işaretsiz ek: "izmirde" → ["izmir","de"] (yalnızca gövde bilinen bir adsa) */
function ekAyir(k: string, bilinen: (g: string) => boolean): [string, string] | null {
  for (const ek of ["deki", "daki", "teki", "taki", "den", "dan", "ten", "tan", "de", "da", "te", "ta"]) {
    if (k.length > ek.length + 2 && k.endsWith(ek) && bilinen(k.slice(0, -ek.length))) return [k.slice(0, -ek.length), ek];
  }
  return null;
}

export interface DigerIlBulgusu { ilId: number; ifade: string }
/**
 * Bir satırdaki çalışma ili DIŞI konumları bulur.
 * Dönen `kalan`: bulunan adların silindiği satır — çalışma ili sözlüğü bu metinde aranır (aynı ad iki kez sayılmasın diye).
 */
export function digerIlTara(satir: string, ix: LokasyonIndeks): { ifadeler: string[]; iller: number[]; kalan: string } {
  const o = ix.turkiye;
  if (!o) return { ifadeler: [], iller: [], kalan: satir };
  const s = sozluk(o.ozet);
  const j = jetonla(satir);
  // 1) İl adları
  type IlBulgu = { i: number; ilId: number; kesin: boolean };
  const ilB: IlBulgu[] = [];
  j.forEach((t, i) => {
    let k = t.k, ek = t.ek;
    if (!s.il.has(k)) { const a = ekAyir(k, (g) => s.il.has(g)); if (!a) return; [k, ek] = a; }
    const ilId = s.il.get(k)!;
    if (AYRILMA_EKI.test(ek)) return; // "İstanbul'dan", "Ankaralı"
    if (KONUM_DEGIL_SONRA.test(j[i + 1]?.k ?? "")) return;
    ilB.push({ i, ilId, kesin: !SUPHELI_IL.has(k) || BULUNMA_EKI.test(ek) || /^(ili|ilinde|merkez|merkezde)$/.test(j[i + 1]?.k ?? "") });
  });
  const sil: [number, number][] = [];
  const ifadeler: string[] = [], iller: number[] = [];
  const kullanilan = new Set<number>();
  const ilceKomsu = (i: number, ilId: number): { ad: string; n: number; yon: 1 | -1 } | null => {
    for (const yon of [1, -1] as const) for (const n of [2, 1]) {
      const dilim = yon === 1 ? j.slice(i + 1, i + 1 + n) : j.slice(Math.max(0, i - n), i);
      if (dilim.length !== n) continue;
      let k = dilim.map((x) => x.k).join(" ");
      let v = s.ilce.get(k)?.find((x) => x.ilId === ilId);
      if (!v && n === 1) { const a = ekAyir(k, (g) => !!s.ilce.get(g)?.some((x) => x.ilId === ilId)); if (a) v = s.ilce.get(a[0])!.find((x) => x.ilId === ilId); }
      if (v) return { ad: v.ad, n, yon };
    }
    return null;
  };
  /** Bir ilin kapsamındaki (il / ilçe adından sonraki) yer adları. Mahalle yalnızca ilçesi de yazılmışsa ya da "mah." ekiyle alınır. */
  const kapsamdaBul = (ilIx: LokasyonIndeks, kapsam: Jeton[], ilceler: Set<number>, yalnizBuIlceler: boolean): string[] => {
    if (!kapsam.length) return [];
    const out: string[] = [];
    const kapsamMetni = satir.slice(kapsam[0].bas, kapsam[kapsam.length - 1].son);
    for (const f of metindenKonumlar(kapsamMetni, ilIx)) {
      const r = lokasyonCozumle([f], ilIx);
      const l = r.lokasyonlar[0];
      if (!l || r.cozulemeyen.length || l.guven < 1) continue;
      const ilcesiYazili = !!l.ilceId && ilceler.has(l.ilceId);
      const bilinen = BILINEN_SEMT.has(`${lokasyonAnahtari(s.ilAd.get(ilIx.ilId) ?? "")}|${lokasyonAnahtari(f)}`);
      if (l.seviye === "MAHALLE" && !ilcesiYazili && !bilinen && !new RegExp(f.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\s+(mah|mh)", "iu").test(kapsamMetni)) continue;
      if (yalnizBuIlceler && !(l.seviye === "ALTBOLGE" ? !l.ilceId || ilcesiYazili : ilcesiYazili)) continue;
      out.push(f);
      const at = satir.toLocaleLowerCase("tr").indexOf(f.toLocaleLowerCase("tr"), kapsam[0].bas);
      if (at >= 0) sil.push([at, at + f.length]);
    }
    return out;
  };
  for (const [n, b] of ilB.entries()) {
    if (b.ilId === ix.ilId) continue;
    const komsu = ilceKomsu(b.i, b.ilId);
    if (!b.kesin && !komsu) continue;
    const ilAd = s.ilAd.get(b.ilId)!;
    // Kapsam: bu il adından bir sonraki il adına (ya da satır sonuna) kadar
    const sonraki = ilB[n + 1]?.i ?? j.length;
    const onceIlce = komsu?.yon === -1 ? j.slice(b.i - komsu.n, b.i) : [];
    const kapsam = j.slice(b.i + 1, sonraki);
    const ilIx = o.indeksAl(b.ilId);
    const bulunan: string[] = [];
    if (komsu?.yon === -1) { bulunan.push(komsu.ad); onceIlce.forEach((x) => { sil.push([x.bas, x.son]); kullanilan.add(j.indexOf(x)); }); }
    if (kapsam.length) {
      if (ilIx) {
        const kapsamIlceleri = new Set(kapsam.flatMap((x) => s.ilce.get(x.k)?.filter((y) => y.ilId === b.ilId).map((y) => y.id) ?? []));
        if (komsu?.yon === -1) s.ilce.get(lokasyonAnahtari(komsu.ad))?.forEach((y) => y.ilId === b.ilId && kapsamIlceleri.add(y.id));
        bulunan.push(...kapsamdaBul(ilIx, kapsam, kapsamIlceleri, false));
      } else if (komsu?.yon === 1) { bulunan.push(komsu.ad); kapsam.slice(0, komsu.n).forEach((x) => sil.push([x.bas, x.son])); }
    }
    sil.push([j[b.i].bas, j[b.i].son]); kullanilan.add(b.i);
    iller.push(b.ilId);
    if (bulunan.length) for (const f of bulunan) ifadeler.push(`${ilAd} ${f}`); else ifadeler.push(ilAd);
  }
  // 2) İl adı yazılmamış, Türkiye'de tek olan ilçe ("Bodrum'da villa, Yalıkavak olabilir")
  const silinmis = (t: Jeton) => sil.some(([a, b]) => t.bas >= a && t.son <= b);
  const satirIlceleri = new Set(j.flatMap((t) => ix.ilceler.filter((i) => lokasyonAnahtari(i.ad) === t.k).map((i) => i.id)));
  /** Çalışma ilinde ilçe / alt bölge / sözlük kaydıysa ya da ilçesi de yazılmış bir mahalleyse yerel sayılır */
  const yerelde = (k: string) => lokasyonCozumle([k], ix).lokasyonlar.some((l) => l.guven >= 1 && (l.seviye !== "MAHALLE" || (!!l.ilceId && satirIlceleri.has(l.ilceId))));
  const ilSinirlari = ilB.map((b) => b.i);
  j.forEach((t, i) => {
    if (kullanilan.has(i) || silinmis(t)) return;
    let k = t.k, ek = t.ek;
    if (!s.ilce.has(k)) { const a = ekAyir(k, (g) => s.ilce.has(g)); if (!a) return; [k, ek] = a; }
    const v = s.ilce.get(k)!;
    if (v.length !== 1 || v[0].ilId === ix.ilId || k.length < 5 || AYRILMA_EKI.test(ek)) return;
    if (SUPHELI_ILCE.has(k) && !BULUNMA_EKI.test(ek)) return;
    if (KONUM_DEGIL_SONRA.test(j[i + 1]?.k ?? "") || yerelde(k)) return;
    const ilAd = s.ilAd.get(v[0].ilId)!;
    sil.push([t.bas, t.son]); iller.push(v[0].ilId);
    const ilIx = o.indeksAl(v[0].ilId);
    const son = ilSinirlari.find((x) => x > i) ?? j.length;
    const alt = ilIx ? kapsamdaBul(ilIx, j.slice(i + 1, son).filter((x) => !silinmis(x)), new Set([v[0].id]), true) : [];
    if (alt.length) for (const f of alt) ifadeler.push(`${ilAd} ${v[0].ad} ${f}`); else ifadeler.push(`${ilAd} ${v[0].ad}`);
  });
  let kalan = satir;
  for (const [a, b] of sil.sort((x, y) => y[0] - x[0])) kalan = kalan.slice(0, a) + " ".repeat(b - a) + kalan.slice(b);
  return { ifadeler: [...new Set(ifadeler)], iller: [...new Set(iller)], kalan };
}

/** Sunucu için ön tarama: metinde hangi illerin indeksine ihtiyaç olabilir (fazla bulması zararsız) */
export function metindekiIller(metin: string, ozet: TurkiyeOzeti, calismaIli: number): number[] {
  const s = sozluk(ozet);
  const out = new Set<number>();
  for (const t of jetonla(metin)) {
    for (const k of [t.k, ekAyir(t.k, (g) => s.il.has(g) || s.ilce.has(g))?.[0]]) {
      if (!k) continue;
      const il = s.il.get(k); if (il) out.add(il);
      const ic = s.ilce.get(k); if (ic?.length === 1) out.add(ic[0].ilId);
    }
  }
  out.delete(calismaIli);
  return [...out];
}

/**
 * Konum ifadelerini çözer; "İzmir Bornova", "Bornova / İzmir", "Muğla" gibi başka il içeren parçalar o ilde,
 * kalanlar çalışma ilinde çözülür. Türkiye ortamı yoksa (ix.turkiye) davranış eski tek-il çözücüyle aynıdır.
 */
export function cokIlliCozumle(metin: string | string[], ix: LokasyonIndeks): CozumSonucu {
  const o = ix.turkiye;
  if (!o) return lokasyonCozumle(metin, ix);
  const s = sozluk(o.ozet);
  const yerel: string[] = [];
  const diger: CozulenLokasyon[] = [], cozulemeyen: string[] = [];
  let ilkDiger = false, sira = 0;
  for (const girdi of Array.isArray(metin) ? metin : [metin]) {
    for (const p of girdi.split(/[,;|\n]|\s+ve\s+|\s+veya\s+|\s+ya\s+da\s+/i).map((x) => x.trim()).filter(Boolean)) {
      sira++;
      const kel = lokasyonAnahtari(p.replace(/\//g, " ")).split(" ").filter(Boolean);
      // il adı başta ya da sonda
      let ilId: number | undefined, kalan = kel;
      for (const [n, bas] of [[2, true], [1, true], [1, false]] as const) {
        const parca = bas ? kel.slice(0, n) : kel.slice(-n);
        const id = parca.length === n ? s.il.get(parca.join(" ")) : undefined;
        if (id) { ilId = id; kalan = bas ? kel.slice(n) : kel.slice(0, -n); break; }
      }
      if (!ilId || (ilId === ix.ilId && !kalan.length)) { yerel.push(p); continue; }
      if (ilId === ix.ilId) { yerel.push(kalan.join(" ")); continue; }
      // İl adı aynı zamanda çalışma ilinde bir yer adıysa (tam ve kesin çözülüyorsa) yerel say
      const y = lokasyonCozumle([p], ix);
      if (y.lokasyonlar.length && !y.cozulemeyen.length && y.lokasyonlar.every((l) => l.guven >= 1)) { yerel.push(p); continue; }
      if (sira === 1) ilkDiger = true;
      const ilAd = s.ilAd.get(ilId)!;
      if (!kalan.length) { diger.push({ ilId, ilceId: null, mahalleId: null, altBolgeId: null, seviye: "IL", etiket: `${ilAd} (il geneli)`, kaynakIfade: p, guven: 1 }); continue; }
      const ilIx = o.indeksAl(ilId);
      if (ilIx) {
        const r = lokasyonCozumle([kalan.join(" ")], ilIx);
        for (const l of r.lokasyonlar) diger.push({ ...l, ilId, etiket: `${l.etiket} · ${ilAd}`, belirsiz: l.belirsiz?.map((b) => ({ ...b, etiket: `${b.etiket} · ${ilAd}` })) });
        if (!r.lokasyonlar.length) diger.push({ ilId, ilceId: null, mahalleId: null, altBolgeId: null, seviye: "IL", etiket: `${ilAd} (il geneli)`, kaynakIfade: ilAd, guven: 1 });
        cozulemeyen.push(...r.cozulemeyen.map((c) => `${ilAd} ${c}`));
      } else {
        const ic = s.ilce.get(kalan.join(" "))?.find((x) => x.ilId === ilId);
        if (ic) diger.push({ ilId, ilceId: ic.id, mahalleId: null, altBolgeId: null, seviye: "ILCE", etiket: `${ic.ad} · ${ilAd}`, kaynakIfade: p, guven: 1 });
        else { diger.push({ ilId, ilceId: null, mahalleId: null, altBolgeId: null, seviye: "IL", etiket: `${ilAd} (il geneli)`, kaynakIfade: ilAd, guven: 1 }); cozulemeyen.push(p); }
      }
    }
  }
  const r0 = yerel.length ? lokasyonCozumle(yerel, ix) : { lokasyonlar: [], cozulemeyen: [] };
  // Çalışma ilinde bulunamayan tek kelime, başka bir ilin (Türkiye'de tek) ilçesi olabilir
  for (const c of r0.cozulemeyen) {
    const v = s.ilce.get(lokasyonAnahtari(c));
    if (v?.length === 1 && v[0].ilId !== ix.ilId) diger.push({ ilId: v[0].ilId, ilceId: v[0].id, mahalleId: null, altBolgeId: null, seviye: "ILCE", etiket: `${v[0].ad} · ${s.ilAd.get(v[0].ilId)}`, kaynakIfade: c, guven: 1 });
    else cozulemeyen.push(c);
  }
  const tekil = diger.filter((x, i, a) => a.findIndex((y) => y.ilId === x.ilId && y.ilceId === x.ilceId && y.mahalleId === x.mahalleId && y.altBolgeId === x.altBolgeId) === i);
  // Aynı ilin hem "il geneli" hem ilçesi varsa il geneli düşer
  const sade = tekil.filter((x) => x.seviye !== "IL" || !tekil.some((y) => y.ilId === x.ilId && y.seviye !== "IL"));
  return { lokasyonlar: ilkDiger ? [...sade, ...r0.lokasyonlar] : [...r0.lokasyonlar, ...sade], cozulemeyen };
}

/** Sunucu: Türkiye özeti (81 il + 973 ilçe) bir kez yüklenir */
let ozetOnbellek: TurkiyeOzeti | null = null;
export async function turkiyeOzetiYukle(prisma: import("../../generated/prisma/client").PrismaClient): Promise<TurkiyeOzeti> {
  if (ozetOnbellek) return ozetOnbellek;
  const iller = await prisma.il.findMany({ select: { id: true, ad: true } });
  const ilceler = await prisma.ilce.findMany({ select: { id: true, ilId: true, ad: true } });
  return (ozetOnbellek = { iller, ilceler });
}
/**
 * Sunucu: çalışma ili indeksi + metinde adı geçen diğer illerin indeksleri (önceden yüklenir; çözücü eşzamanlı çalışır).
 * Dönen indeks `cokIlliCozumle`, `yorumla`, `konumBul` ile kullanılır.
 */
const SARMAL = new WeakMap<LokasyonIndeks, { ix: LokasyonIndeks; diger: Map<number, LokasyonIndeks> }>();
export async function cokIlliIndeks(prisma: import("../../generated/prisma/client").PrismaClient, metin: string, calismaIli = 7): Promise<LokasyonIndeks> {
  const { lokasyonIndeksiYukle } = await import("./cozumle");
  const ozet = await turkiyeOzetiYukle(prisma);
  const temel = await lokasyonIndeksiYukle(prisma, calismaIli);
  // Sarmal nesne temel indeks yaşadıkça aynı kalır (çözücü sözlükleri nesneye bağlı önbelleklenir)
  let s = SARMAL.get(temel);
  if (!s) { const diger = new Map<number, LokasyonIndeks>(); s = { diger, ix: { ...temel, turkiye: { ozet, indeksAl: (id) => diger.get(id) ?? null } } }; SARMAL.set(temel, s); }
  for (const id of metindekiIller(metin, ozet, calismaIli).slice(0, 6)) s.diger.set(id, await lokasyonIndeksiYukle(prisma, id));
  return s.ix;
}