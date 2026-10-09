// Anahtar CRM v3.22.1 · 9 Ekim 2026
// POST /api/ingest/whatsapp  (multipart: files[] = .txt dışa aktarımlar; sonGun=7)
// 1. adım: ayrıştır + ön filtre + tekrar ayıkla (yapay zekâ YOK). Dönen ADAY mesajlar paketler hâlinde
// yapay zekâya gönderilir (AŞAMA 4: /api/ingest/ayristir), sonuçlar güvene göre ayrılıp toplu onaya sunulur.
import { prisma } from "@/lib/db";
import { hata, ok } from "@/lib/http/yanit";
import { onFiltre, sohbetiAyristir, dosyaParmakIzi } from "@/lib/ingest/whatsapp";
import { oncedenIslenmisler, oncekiDosya } from "@/lib/services/ingest";

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const sonGun = Number(form.get("sonGun") ?? 0) || null;
    const dosyalar = form.getAll("files").filter((f): f is File => f instanceof File);
    if (!dosyalar.length) return Response.json({ hata: "DOSYA_YOK" }, { status: 400 });
    const tum = [];
    const izler: string[] = [];
    const oncekiDosyalar = [];
    for (const f of dosyalar) {
      const icerik = await f.text();
      const iz = dosyaParmakIzi(icerik);
      izler.push(iz);
      const o = await oncekiDosya(prisma, iz);
      if (o) oncekiDosyalar.push({ dosya: f.name, oncekiYukleme: o.createdAt });
      tum.push(...sohbetiAyristir(icerik, f.name));
    }
    // v3.4: daha önce yapay zekâya gönderilmiş mesajlar tekrar gönderilmez
    const sonuc = onFiltre(tum, { sonGun, oncedenIslenmis: await oncedenIslenmisler(prisma, tum.map((m) => m.metin)) });
    const log = await prisma.ingestionLog.create({
      data: {
        kanal: "WHATSAPP", dosyaAdi: dosyalar.map((f) => f.name).join(", ").slice(0, 500), grupAdi: sonuc.gruplar.map((g) => g.grup).join(", ").slice(0, 500),
        toplamMesaj: sonuc.mesajlar.length, gurultu: sonuc.mesajlar.filter((m) => m.durum === "GURULTU").length,
        duplicate: sonuc.mesajlar.filter((m) => m.durum === "TEKRAR").length, detay: { gruplar: sonuc.gruplar } as never,
        dosyaParmakIzleri: izler, oncedenIslenmis: sonuc.mesajlar.filter((m) => m.durum === "ONCEKI").length,
      },
    });
    return ok({ ingestionId: log.id, oncekiDosyalar, gruplar: sonuc.gruplar, adaylar: sonuc.mesajlar.filter((m) => m.durum === "ADAY") });
  } catch (e) { return hata(e); }
}