/**
 * Anahtar CRM v3.28 · 14 Ekim 2026
 * "Bugün" panosu — durum üzerindeki işlemler (React yok; testlenebilir). Ekranlar bunları `guncelle((d) => …)` içinde çağırır.
 * Kurallar src/lib/domain/gorev.ts'de; burada yalnızca DepoDurumu ile birleştirme var.
 */
import { simdi as simdiOf, type DepoDurumu, type EslesmeNotu, type Kayit, type KayitNotu, type PipelineDurum, type Veri } from "./depo";
import {
  eslesmeDurumuDegisti, fiyatDustu, gorevEkle, gorevErtele, gorevKapat, gunEkle, gunYaz, ilgilenenUygula, asamaDegisti, sanalGorevler, gorevleriBirlestir,
  type Gorev, type GorevGirdisi, type Ilgilenen, type IlgiDurumu, type SanalEslesme, type SanalKayit,
} from "../src/lib/domain/gorev";
import { sureUzat } from "./depo";
import type { Eslesme } from "./ortak";

/** Kayıtta aranacak kişi: talepte müşteri, portföyde mülk sahibi; yoksa ilk bağlı kişi */
export function kayitKisisi(k?: Pick<Kayit, "veri"> | null): string | null {
  const b = k?.veri.kisiler ?? [];
  if (!b.length) return null;
  const tercih = k!.veri.tip === "TALEP" ? ["MUSTERI", "EMLAKCI"] : ["SAHIP", "EMLAKCI"];
  for (const r of tercih) { const x = b.find((y) => y.rol === r); if (x) return x.kisiId; }
  return b[0].kisiId;
}

/**
 * Eşleşmenin takip durumunu değiştirir (Bildirildi · Görüşüldü · Gösterim · Pazarlık · Kapandı · Koparıldı · Yeni) ve
 * görevleri + ilgilenen satırını birlikte günceller. `ek`: neden / tarih / not gibi ek alanlar (koparma). Durum aynıysa görev üretilmez.
 */
export function eslesmeDurumunuUygula(d: DepoDurumu, tid: string, pid: string, yeni: PipelineDurum, ek: Partial<EslesmeNotu> = {}, simdi: Date = simdiOf()): DepoDurumu {
  const anahtar = `${tid}~${pid}`;
  const onceki: EslesmeNotu = d.eslesmeNotlari[anahtar] ?? { durum: "YENI", not: "" };
  const not: EslesmeNotu = { ...onceki, durum: yeni, ...ek };
  const d1: DepoDurumu = { ...d, eslesmeNotlari: { ...d.eslesmeNotlari, [anahtar]: not } };
  if (onceki.durum === yeni) return d1;
  const talepKisiId = kayitKisisi(d.kayitlar.find((k) => k.id === tid));
  const s = eslesmeDurumuDegisti({ tid, pid, yeni, talepKisiId, simdi, gorevler: d.gorevler ?? [], ilgilenenler: d.ilgilenenler ?? [] });
  return { ...d1, gorevler: s.gorevler, ilgilenenler: s.ilgilenenler };
}

/** Bir eşleşmenin tüm görevlerini kapatmadan yeni "sonraki iletişim" ekler (Görüşüldü / Koparıldı sonrası: "Bir sonraki iletişim ne zaman?") */
export function sonrakiIletisimEkle(d: DepoDurumu, g: Pick<GorevGirdisi, "baslik" | "kisiId" | "kayitId" | "eslesme">, gun: number | string, simdi: Date = simdiOf()): DepoDurumu {
  const vade = typeof gun === "number" ? gunEkle(gunYaz(simdi), gun) : gun;
  return { ...d, gorevler: gorevEkle(d.gorevler ?? [], { kural: "SONRAKI", tur: "ARA", vade, ...g }, simdi) };
}

/** Elle görev (Bugün panosu "+ Görev") */
export function elleGorevEkle(d: DepoDurumu, g: { baslik: string; vade: string; kisiId?: string | null; kayitId?: string | null }, simdi: Date = simdiOf()): DepoDurumu {
  return { ...d, gorevler: gorevEkle(d.gorevler ?? [], { kural: "ELLE", tur: "ARA", ...g }, simdi) };
}

/** "Ulaşılamadı": yarına ertele, deneme sayısı artar */
export function gorevUlasilamadi(d: DepoDurumu, g: Gorev, simdi: Date = simdiOf()): DepoDurumu {
  return { ...d, gorevler: gorevErtele(d.gorevler ?? [], g, gunEkle(gunYaz(simdi), 1), simdi, { ulasilamadi: true }) };
}

export interface GorusulduSecenegi {
  /** ne konuşuldu (görüşme notu olur) */
  not?: string;
  /** "Yarın / 3 gün / 1 hafta / 1 ay" ya da seçilen gün (YYYY-MM-DD); verilmezse yeni görev açılmaz */
  sonraki?: number | string | null;
  /** talep süresi görevi için: kaç gün uzatılsın */
  uzat?: number;
}
/**
 * "Görüşüldü": görev kapanır, not kayda görüşme olarak yazılır (kişinin son iletişimi güncellenir), istenirse sonraki iletişim açılır.
 * Kurala özel yan etkiler: sıcak eşleşmede takip durumu "Bildirildi" olur; talep süresi görevinde süre uzar.
 */
export function gorevGorusuldu(d: DepoDurumu, g: Gorev, o: GorusulduSecenegi = {}, simdi: Date = simdiOf()): DepoDurumu {
  const iso = simdi.toISOString();
  let x: DepoDurumu = { ...d, gorevler: gorevKapat(d.gorevler ?? [], g, "TAMAM", o.not ?? null, simdi) };
  const kayit = g.kayitId ? x.kayitlar.find((k) => k.id === g.kayitId) : undefined;
  if (o.not?.trim() && kayit) {
    const n: KayitNotu = { id: "n" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), tarih: iso, tur: "GORUSME", metin: o.not.trim(), kisiId: g.kisiId ?? null };
    x = { ...x, kayitlar: x.kayitlar.map((k) => (k.id === kayit.id ? { ...k, notlar: [n, ...(k.notlar ?? [])] } : k)) };
  }
  if (g.kisiId) x = { ...x, kisiler: x.kisiler.map((k) => (k.id === g.kisiId ? { ...k, sonIletisim: iso } : k)) };
  if (g.kural === "SICAK" && g.eslesme) { const [tid, pid] = g.eslesme.split("~"); if ((x.eslesmeNotlari[g.eslesme]?.durum ?? "YENI") === "YENI") x = eslesmeDurumunuUygula(x, tid, pid, "BILDIRILDI", {}, simdi); }
  if (g.kural === "TALEP_SURE" && o.uzat && kayit) x = { ...x, kayitlar: x.kayitlar.map((k) => (k.id === kayit.id ? { ...k, veri: sureUzat(k.veri, o.uzat!) as Veri } : k)) };
  if (o.sonraki != null && o.sonraki !== "") x = sonrakiIletisimEkle(x, { baslik: `Sonraki iletişim: ${g.baslik.replace(/ — .*/, "")}`, kisiId: g.kisiId, kayitId: g.kayitId, eslesme: g.eslesme }, o.sonraki, simdi);
  return x;
}

/**
 * "İlgilenmiyor": görev kapanır, neden kaydedilir. Eşleşmeye bağlıysa eşleşme koparılır (neden = seçilen); talep süresi görevinde talep pasife alınır.
 * `neden`: kopma nedeni kodu (eşleşme görevleri) ya da serbest metin.
 */
export function gorevIlgilenmiyor(d: DepoDurumu, g: Gorev, neden: string, nedenYazisi: string, simdi: Date = simdiOf()): DepoDurumu {
  let x: DepoDurumu = { ...d, gorevler: gorevKapat(d.gorevler ?? [], g, "KAPALI", nedenYazisi, simdi) };
  if (g.eslesme) { const [tid, pid] = g.eslesme.split("~"); x = eslesmeDurumunuUygula(x, tid, pid, "REDDEDILDI", { neden, tarih: simdi.toISOString() }, simdi); }
  else if (g.kural === "TALEP_SURE" && g.kayitId) x = { ...x, kayitlar: x.kayitlar.map((k) => (k.id === g.kayitId ? { ...k, veri: { ...k.veri, durum: "PASSIVE" } as Veri } : k)) };
  return x;
}

/** İlgilenen satırı ekle / durumunu değiştir. Durum değişince o satıra ait takip görevleri üretilir ("il:" öneki). */
export function ilgilenenKaydet(d: DepoDurumu, g: { kayitId: string; kisiId: string; durum: IlgiDurumu; not?: string | null }, simdi: Date = simdiOf()): DepoDurumu {
  const onceki = (d.ilgilenenler ?? []).find((i) => i.kayitId === g.kayitId && i.kisiId === g.kisiId);
  const ilgilenenler = ilgilenenUygula(d.ilgilenenler ?? [], g, simdi);
  const sonra = ilgilenenler.find((i) => i.kayitId === g.kayitId && i.kisiId === g.kisiId)!;
  if (onceki?.durum === g.durum) return { ...d, ilgilenenler };
  const gorevler = asamaDegisti({ onek: "il:" + sonra.id, yeni: g.durum, kisiId: g.kisiId, kayitId: g.kayitId, simdi, gorevler: d.gorevler ?? [] });
  return { ...d, ilgilenenler, gorevler };
}
export function ilgilenenSil(d: DepoDurumu, id: string, simdi: Date = simdiOf()): DepoDurumu {
  const gorevler = asamaDegisti({ onek: "il:" + id, yeni: null, simdi, gorevler: d.gorevler ?? [] });
  return { ...d, ilgilenenler: (d.ilgilenenler ?? []).filter((i) => i.id !== id), gorevler };
}

/** Portföyün fiyatı düştüyse önceden ilgilenenler için "tekrar ara" görevleri. kayitKaydet içinde çağrılır. */
export function fiyatDususuIsle(d: DepoDurumu, eski: Kayit | undefined, yeni: Kayit, simdi: Date = simdiOf()): DepoDurumu {
  if (!eski || yeni.veri.tip !== "PORTFOY") return d;
  const e = eski.veri.fiyat, y = yeni.veri.fiyat;
  if (typeof e !== "number" || typeof y !== "number" || y >= e || eski.veri.paraBirimi !== yeni.veri.paraBirimi) return d;
  const gorevler = fiyatDustu({ kayitId: yeni.id, baslik: yeni.veri.baslik ?? "", eski: e, yeni: y, ilgilenenler: d.ilgilenenler ?? [], gorevler: d.gorevler ?? [], simdi });
  return gorevler === d.gorevler ? d : { ...d, gorevler };
}

/** Ekrana giren birleşik liste: saklı görevler + o an hesaplanan sanal görevler. `benimOfis`: kayıt kimliği → benim / ofisim mi (yalnızca bunlar için sanal görev üretilir) */
export function bugunGorevleri(d: DepoDurumu, es: Eslesme[], benimOfis: (k: Kayit) => boolean, simdi: Date = simdiOf()): Gorev[] {
  const kayitlar = new Map(d.kayitlar.map((k) => [k.id, k]));
  // sahibi silinmiş / bulunamayan kayıtlara bağlı görevler gizlenir
  const saklanan = (d.gorevler ?? []).filter((g) => !g.kayitId || kayitlar.has(g.kayitId));
  const kisiler: SanalKayit[] = d.kayitlar.filter((k) => k.veri.durum === "ACTIVE" && benimOfis(k)).map((k) => ({
    id: k.id, tip: k.veri.tip, olusturma: k.olusturma, baslik: k.veri.baslik ?? "", validUntil: k.veri.validUntil ? new Date(k.veri.validUntil).toISOString() : null,
    yetkili: !!k.veri.yetkili, yetkiBitis: k.veri.yetkiBitis ? new Date(k.veri.yetkiBitis as any).toISOString() : null,
    sonNot: (k.notlar ?? []).map((n) => n.tarih).sort().at(-1) ?? null, kisiId: kayitKisisi(k),
  }));
  const sicak: SanalEslesme[] = es.filter((e) => e.s.uygunluk === "SUNULABILIR" && (d.eslesmeNotlari[`${e.t.id}~${e.p.id}`]?.durum ?? "YENI") === "YENI" && (benimOfis(e.t) || benimOfis(e.p)))
    .map((e) => ({ tid: e.t.id, pid: e.p.id, skor: e.s.skor, baslik: e.p.veri.baslik ?? "", talepKisiId: kayitKisisi(e.t) }));
  const sanal = sanalGorevler({ simdi, kayitlar: kisiler, eslesmeler: sicak, gorevler: saklanan, ilgilenenler: d.ilgilenenler ?? [] });
  return gorevleriBirlestir(saklanan, sanal.filter((g) => !g.kayitId || kayitlar.has(g.kayitId)));
}
export type { Ilgilenen };
