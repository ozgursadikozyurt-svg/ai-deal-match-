// Anahtar CRM v3.44.1 · 27 Ekim 2026
// Polaris v7 · 21 Ekim 2026
// GET /api/polaris/anahtar/islemler?yil=2026 → o yıl tahsil edilen (ya da tahsil edilmemiş ama o yıl yapılan) işlemler.
// Polaris'in İşlemler sekmesi ve P&L satır 3 bunu okur ("Anahtar'dan güncelle" + günde bir otomatik). Salt okunur.
// Alan adları eski sorguyla aynı: id dk di tarih th tur baslik bedel pay ofis bk aciklama reklam.
// v3.44 — ek olarak pk (paylaşılan kişi: ad + telefon), ref (referans adı) ve tf (taraflar: ad + rol) gönderilir;
// Polaris'in "Paylaşılan kişi / Referans / Taraflar" sütunları ile "Kimden iş geldi?" tablosu bunları kullanır.
import { prisma } from "@/lib/db";
import { hata, ok } from "@/lib/http/yanit";
import { polarisKapi } from "@/lib/polaris";

export async function GET(req: Request) {
  try {
    polarisKapi();
    const yil = Number(new URL(req.url).searchParams.get("yil") ?? "2026");
    if (!Number.isInteger(yil) || yil < 2000 || yil > 2100) return ok({ hata: "ISTEK", mesaj: "Geçersiz yıl" }, 400);
    const bas = new Date(Date.UTC(yil, 0, 1)), bit = new Date(Date.UTC(yil + 1, 0, 1));
    const r = await prisma.islem.findMany({
      where: { OR: [{ tahsilatTarihi: { gte: bas, lt: bit } }, { tahsilatTarihi: null, tarih: { gte: bas } }] },
      orderBy: [{ tarih: "asc" }, { id: "asc" }],
      select: { id: true, disKaynak: true, disKimlik: true, tarih: true, tahsilatTarihi: true, tur: true, baslik: true, bedel: true, paylasilan: true, ofisPayi: true, banaKalan: true, aciklama: true, reklam: true,
        paylasilanAd: true, paylasilanTelefon: true, referansAd: true,
        paylasilanKisi: { select: { adSoyad: true, telefon: true } }, referansKisi: { select: { adSoyad: true } },
        taraflar: { select: { rol: true, ad: true, kisi: { select: { id: true, adSoyad: true } } } } },
    });
    const gun = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);
    const sayi = (v: unknown) => (v == null ? null : Number(v));
    return ok(r.map((x) => ({
      id: x.id, dk: x.disKaynak, di: x.disKimlik, tarih: gun(x.tarih), th: gun(x.tahsilatTarihi), tur: x.tur, baslik: x.baslik,
      bedel: sayi(x.bedel), pay: sayi(x.paylasilan), ofis: sayi(x.ofisPayi), bk: sayi(x.banaKalan), aciklama: x.aciklama, reklam: x.reklam,
      pk: x.paylasilanKisi || x.paylasilanAd ? { a: x.paylasilanKisi?.adSoyad ?? x.paylasilanAd, t: x.paylasilanTelefon ?? x.paylasilanKisi?.telefon ?? null } : null,
      ref: x.referansKisi?.adSoyad ?? x.referansAd ?? null,
      tf: x.taraflar.length ? x.taraflar.map((t) => ({ i: t.kisi?.id ?? null, a: t.kisi?.adSoyad ?? t.ad, rol: t.rol })) : null,
    })));
  } catch (e) { return hata(e); }
}
