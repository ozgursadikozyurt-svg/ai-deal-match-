/**
 * Anahtar CRM v3.23 · 10 Ekim 2026
 * Canlı — kaydetme kuyruğu. Arayüzdeki her değişiklikte `kuyrugaAl(durum)` çağrılır; kısa bir bekleyişten sonra (arka arkaya değişiklikler birleşir)
 * yalnızca değişenler POST /api/durum ile sunucuya yazılır. Sunucunun reddettiği kayıtlar (doğrulama hatası) "değişmemiş" sayılmaz, hata listesinde görünür.
 * Ağ koparsa değişiklikler bellekte durur, aralıklarla yeniden denenir; sekme kapatılırken bekleyen iş varsa tarayıcı uyarır.
 * v3.22.1 — (1) Reddedilen kayıt, içeriği değişmese de 60 sn sonra (ya da "hemen" istenince) yeniden denenir: sunucu geçici bir
 *   nedenle (ör. yayın ile "Kurulumu tamamla" arasındaki dakikalar) reddettiyse kayıt artık sonsuza dek bekleyip kaybolmaz.
 *   (2) Sunucuya hiç ulaşmamış YENİ kayıt ve kişiler tarayıcıda yedeklenir; sayfa yenilense de bir sonraki açılışta geri gelir
 *   ve yeniden gönderilir. Var olan kayıttaki düzenlemeler yedeklenmez (başka cihazdaki yeni hâlin üstüne yazılmasın).
 */
import { imzaAl, planla, kisiImzasi, type Imza } from "./canli-esle";
import type { DepoDurumu, Kisi } from "./depo";

export type KaydetAdi = "kayitli" | "bekliyor" | "kaydediliyor" | "hata";
export interface KaydetDurumu { ad: KaydetAdi; hatalar: { id: string; mesaj: string }[]; mesaj?: string }
type Api = (yol: string, init?: { method?: string; json?: unknown }) => Promise<Response>;

export const RED_YENIDEN_MS = 60_000;
export function kaydediciKur(a: { api: Api; baslangic: DepoDurumu; durum: (s: KaydetDurumu) => void; bekleMs?: number; yenidenMs?: number; yedekAnahtari?: string; simdi?: () => number }) {
  const simdi = a.simdi ?? (() => Date.now());
  const sunucuda = { kayit: new Set(a.baslangic.kayitlar.map((k) => k.id)), kisi: new Set(a.baslangic.kisiler.map((k) => k.id)) };
  const redZamani = new Map<string, number>();
  const redDeneme = new Map<string, number>();
  const ls = (): Storage | null => { try { return typeof localStorage !== "undefined" ? localStorage : null; } catch { return null; } };
  /** Sunucuya henüz ulaşmamış yeni kayıt / kişileri tarayıcıya yazar (boşsa siler) */
  const yedekYaz = () => {
    if (!a.yedekAnahtari) return;
    try {
      const kayitlar = son.kayitlar.filter((k) => !sunucuda.kayit.has(k.id));
      const kisiler = son.kisiler.filter((k) => !sunucuda.kisi.has(k.id));
      if (!kayitlar.length && !kisiler.length) ls()?.removeItem(a.yedekAnahtari);
      else ls()?.setItem(a.yedekAnahtari, JSON.stringify({ zaman: simdi(), kayitlar, kisiler }));
    } catch { /* kota / gizli pencere: bellekte sürer */ }
  };
  let imza: Imza = imzaAl(a.baslangic);
  let son: DepoDurumu = a.baslangic;
  let zaman: ReturnType<typeof setTimeout> | undefined;
  let calisiyor: Promise<void> | null = null;
  let hatalar: KaydetDurumu["hatalar"] = [];
  let deneme = 0;
  const reddedilen = new Map<string, string>(); // kimlik → reddedildiği andaki imza: içeriği değişmedikçe yeniden gönderilmez
  const bildir = (ad: KaydetAdi, mesaj?: string) => a.durum({ ad, hatalar, mesaj });

  async function bir() {
    for (let tur = 0; tur < 5; tur++) { // kaydederken yeni değişiklik gelirse birkaç tur daha
      const guncel = imzaAl(son);
      for (const [id, s] of reddedilen) { // reddedilen kayıt/kişi düzeltilmediyse "değişmemiş" görünsün; düzeltildiyse yeniden denensin
        const g = guncel.kayit.get(id) ?? guncel.kisi.get(id);
        if (tur === 0 && simdi() - (redZamani.get(id) ?? 0) >= RED_YENIDEN_MS) { reddedilen.delete(id); redZamani.delete(id); if (!sunucuda.kayit.has(id)) imza.kayit.delete(id); if (!sunucuda.kisi.has(id)) imza.kisi.delete(id); continue; } // v3.22.1 — süre doldu: yeniden dene
        if (g === s) { if (imza.kayit.has(id) || guncel.kayit.has(id)) imza.kayit.set(id, s); else imza.kisi.set(id, s); } else reddedilen.delete(id);
      }
      hatalar = hatalar.filter((h) => reddedilen.has(h.id));
      const p = planla(imza, son);
      if (p.bos) { bildir(hatalar.length ? "hata" : "kayitli", hatalar.length ? `${hatalar.length} kayıt kaydedilemedi` : undefined); return; }
      bildir("kaydediliyor");
      const yeniHatalar: KaydetDurumu["hatalar"] = [];
      for (const parca of p.parcalar) {
        const r = await a.api("/api/durum", { method: "POST", json: parca });
        const j: any = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j?.mesaj ?? (j?.alanlar ? "Doğrulama hatası" : `Sunucu ${r.status}`));
        for (const h of (j?.hatalar ?? []) as { id: string; mesaj: string }[]) yeniHatalar.push(h);
      }
      // başarıyla yazılanlar kaydedilmiş sayılır; reddedilenler eski imzada kalır (bir sonraki değişiklikte yeniden denenir)
      const kabul = new Map(p.imza.kayit), kisiK = new Map(p.imza.kisi);
      for (const h of yeniHatalar) {
        if (imza.kayit.has(h.id)) kabul.set(h.id, imza.kayit.get(h.id)!); else kabul.delete(h.id);
        if (imza.kisi.has(h.id)) kisiK.set(h.id, imza.kisi.get(h.id)!); else kisiK.delete(h.id);
      }
      imza = { ...p.imza, kayit: kabul, kisi: kisiK };
      const redSet = new Set(yeniHatalar.map((h) => h.id));
      for (const id of p.imza.kayit.keys()) if (!redSet.has(id)) sunucuda.kayit.add(id);
      for (const id of p.imza.kisi.keys()) if (!redSet.has(id)) sunucuda.kisi.add(id);
      for (const h of yeniHatalar) { reddedilen.set(h.id, p.imza.kayit.get(h.id) ?? p.imza.kisi.get(h.id) ?? ""); redZamani.set(h.id, simdi()); }
      yedekYaz();
      hatalar = [...hatalar.filter((h) => reddedilen.has(h.id) && !yeniHatalar.some((y) => y.id === h.id)), ...yeniHatalar]; deneme = 0;
    }
    bildir(hatalar.length ? "hata" : "kayitli", hatalar.length ? `${hatalar.length} kayıt kaydedilemedi` : undefined);
  }
  function calistir(): Promise<void> {
    if (calisiyor) return calisiyor;
    calisiyor = (async () => {
      try {
        await bir();
        // v3.22.1 — reddedilen varsa bir dakika sonra kendiliğinden yeniden dene (kayıt başına en çok 5 kez; sonra yalnızca değişince / "hemen"de)
        const tekrar = [...reddedilen.keys()].filter((id) => (redDeneme.get(id) ?? 0) < 5);
        if (tekrar.length && !zaman) { for (const id of tekrar) redDeneme.set(id, (redDeneme.get(id) ?? 0) + 1); zaman = setTimeout(() => { zaman = undefined; void calistir(); }, RED_YENIDEN_MS + 500); (zaman as any)?.unref?.(); }
      }
      catch (e: any) {
        deneme++; bildir("hata", `Kaydedilemedi: ${e?.message ?? e}${deneme <= 4 ? " — yeniden denenecek" : ""}`);
        if (deneme <= 4) { zaman = setTimeout(() => { zaman = undefined; void calistir(); }, a.yenidenMs ?? 8000); (zaman as any)?.unref?.(); }
      } finally { calisiyor = null; }
    })();
    return calisiyor;
  }
  return {
    kuyrugaAl(d: DepoDurumu) {
      son = d;
      yedekYaz();
      if (planla(imza, d).bos && !reddedilen.size) return;
      bildir("bekliyor");
      if (zaman) clearTimeout(zaman);
      zaman = setTimeout(() => { zaman = undefined; void calistir(); }, a.bekleMs ?? 900);
    },
    // v3.22.1 — "hemen" (fotoğraf yüklemeden, yapay zekâdan önce): reddedilenler de bekletilmeden yeniden denenir
    async hemen() { if (zaman) { clearTimeout(zaman); zaman = undefined; } await (calisiyor ?? Promise.resolve()); for (const id of redZamani.keys()) redZamani.set(id, 0); await calistir(); },
    /** v3.22.1 — sunucu yazmış mı? (fotoğraf yükleme gibi kaydın sunucuda olmasını gerektiren işler için) */
    sunucudaMi: (id: string) => sunucuda.kayit.has(id),
    /** v3.22.1 — bu kaydın son reddedilme nedeni (yoksa undefined) */
    hataOf: (id: string) => hatalar.find((h) => h.id === id)?.mesaj,
    /**
     * v3.22.1 — önceki oturumda sunucuya ulaşamamış yeni kayıt / kişileri geri koyar. Sunucuda o kimlik zaten varsa yedek atılır.
     * Dönen durum farklıysa çağıran kuyrugaAl ile gönderir.
     */
    yedektenGeriAl(d: DepoDurumu): DepoDurumu {
      if (!a.yedekAnahtari) return d;
      try {
        const ham = ls()?.getItem(a.yedekAnahtari); if (!ham) return d;
        const y = JSON.parse(ham) as { kayitlar?: DepoDurumu["kayitlar"]; kisiler?: DepoDurumu["kisiler"] };
        const kIds = new Set(d.kayitlar.map((k) => k.id)), pIds = new Set(d.kisiler.map((k) => k.id));
        const kayitlar = (y.kayitlar ?? []).filter((k) => k?.id && !kIds.has(k.id)), kisiler = (y.kisiler ?? []).filter((k) => k?.id && !pIds.has(k.id));
        if (!kayitlar.length && !kisiler.length) { ls()?.removeItem(a.yedekAnahtari); return d; }
        return { ...d, kayitlar: [...kayitlar, ...d.kayitlar], kisiler: [...d.kisiler, ...kisiler] };
      } catch { return d; }
    },
    bekliyorMu: () => !!zaman || !!calisiyor || hatalar.length > 0 || !planla(imza, son).bos,
    /**
     * v3.21 — Google eşitlemesi kişileri SUNUCUDA değiştirir (yeni gelenler, güncellenenler, Google'a bağlananlar). Arayüz
     * sunucudaki listeyi alınca bu işlev iki şeyi birlikte yapar: (1) yeni durumu üretir, (2) gelen kişileri "zaten kayıtlı"
     * sayar — yoksa kuyruk onları yeniden sunucuya yazmaya (ya da eksik görüp SİLMEYE) kalkardı.
     * Kaydedilmemiş yerel iş korunur: düzenlenmiş ama henüz yazılmamış kişi yerel hâliyle kalır, yeni eklenmiş kişi listede
     * durur, silinmiş ama silmesi henüz gitmemiş kişi geri gelmez. Üçü de bir sonraki kayıtta sunucuya gider.
     */
    kisileriBirlestir(d: DepoDurumu, sunucu: Kisi[]): DepoDurumu {
      const yerel = new Map(d.kisiler.map((k) => [k.id, k]));
      const yerelImza = imzaAl(d).kisi;
      const kirli = (id: string) => yerelImza.has(id) && imza.kisi.get(id) !== yerelImza.get(id); // yerelde var, kaydedilmemiş değişikliği var
      const silinecek = (id: string) => imza.kisi.has(id) && !yerelImza.has(id);                    // yerelde silindi, silme henüz gitmedi
      const sunucuIds = new Set(sunucu.map((k) => k.id));
      for (const id of sunucuIds) sunucuda.kisi.add(id);
      const kisiler: Kisi[] = [];
      const yeniImza = new Map<string, string>();
      for (const k of sunucu) {
        if (silinecek(k.id)) { yeniImza.set(k.id, imza.kisi.get(k.id)!); continue; }
        if (kirli(k.id)) { kisiler.push(yerel.get(k.id)!); if (imza.kisi.has(k.id)) yeniImza.set(k.id, imza.kisi.get(k.id)!); continue; }
        kisiler.push(k); yeniImza.set(k.id, kisiImzasi(k));
      }
      for (const k of d.kisiler) if (!sunucuIds.has(k.id) && !imza.kisi.has(k.id)) kisiler.push(k); // yeni eklenmiş, henüz yazılmamış
      const y = { ...d, kisiler };
      imza = { ...imza, kisi: yeniImza }; son = y;
      return y;
    },
    /**
     * v3.22.2 — ARTIMLI birleştirme: sunucudan yalnızca son yenilemeden sonra eklenen / değişen kişiler gelir (GET /api/durum?yalniz=kisiler&sonra=…).
     * `kisileriBirlestir` gibi kaydedilmemiş yerel işi korur (düzenlenmiş kişi yerel hâliyle kalır, silinmiş ama silmesi gitmemiş kişi geri gelmez),
     * ama listenin GERİ KALANINA dokunmaz: gelmeyen kişi "sunucuda silinmiş" sayılmaz. 7.800 kişiyi her eşitlemeden sonra yeniden indirmeyi bitirir.
     */
    kisileriDegisenleriBirlestir(d: DepoDurumu, degisen: Kisi[]): DepoDurumu {
      if (!degisen.length) return d;
      const yerelImza = imzaAl(d).kisi;
      const kirli = (id: string) => yerelImza.has(id) && imza.kisi.get(id) !== yerelImza.get(id);
      const silinecek = (id: string) => imza.kisi.has(id) && !yerelImza.has(id);
      const sira = new Map(d.kisiler.map((k, i) => [k.id, i]));
      const kisiler = d.kisiler.slice();
      const yeniImza = new Map(imza.kisi);
      for (const k of degisen) {
        sunucuda.kisi.add(k.id);
        if (silinecek(k.id) || kirli(k.id)) continue; // yerel iş korunur; imza değişmez → bir sonraki kayıtta sunucuya gider
        const i = sira.get(k.id);
        if (i === undefined) { sira.set(k.id, kisiler.length); kisiler.push(k); } else kisiler[i] = k;
        yeniImza.set(k.id, kisiImzasi(k));
      }
      const y = { ...d, kisiler };
      imza = { ...imza, kisi: yeniImza }; son = y;
      return y;
    },
  };
}
