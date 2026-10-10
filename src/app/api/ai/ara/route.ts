// Anahtar CRM v3.23 · 10 Ekim 2026
// POST /api/ai/ara { metin }  — Ana sayfa AI arama ve sohbet kutusunun sunucu tarafı (1. adım: yapay zekâsız).
//   SORU  → kural tabanlı soru → filtre + konum çözümü; sonuçları KOD sorgular (veritabanı modele gitmez)
//   ILAN  → kural tabanlı hızlı ayrıştırma + konum; { aiGerekli } true ise istemci / sonraki adım Gemini'yi
//           yalnızca eksik alanlar için çağırır (Flash-Lite, açık önbellek; bkz. ALTYAPI §24)
import { z } from "zod";
import { prisma } from "@/lib/db";
import { hata, ok } from "@/lib/http/yanit";
import { hizliAyristir, metinTuru, soruFiltresi } from "@/lib/ai/hizli-ayristirici";
import { cokIlliCozumle, cokIlliIndeks } from "@/lib/lokasyon/turkiye";
import { konumBul } from "@/lib/ai/yorumlayici";
import { calismaIliNormalize } from "@/lib/domain/ayarlar";
import { kayitListele } from "@/lib/services/kayit";
import { KayitListeQuery } from "@/lib/validation/kayit";
import { metinParmakIzi } from "@/lib/ingest/whatsapp";

const Girdi = z.object({ metin: z.string().trim().min(3).max(8000) });

export async function POST(req: Request) {
  try {
    const { metin } = Girdi.parse(await req.json());
    const ix = await cokIlliIndeks(prisma, metin, calismaIliNormalize((await prisma.ayar.findFirst({ where: { anahtar: "calismaIli" } }))?.deger));
    const konum = cokIlliCozumle(konumBul(metin, ix), ix);
    if (metinTuru(metin) === "SORU") {
      const f = soruFiltresi(metin);
      const l = konum.lokasyonlar[0];
      const sonuc = await kayitListele(prisma, KayitListeQuery.parse({
        tip: f.hedef, durum: "ACTIVE", islemTipi: f.islemler[0], minM2: f.m2Min ?? undefined, maxM2: f.m2Max ?? undefined, maxFiyat: f.fiyatMax ?? undefined,
        ilceId: l?.ilceId ?? undefined, mahalleId: l?.mahalleId ?? undefined, altBolgeId: l?.altBolgeId ?? undefined,
      }));
      return ok({ tur: "SORU", filtre: f, konumlar: konum.lokasyonlar, sonuc, aiGerekli: !f.anlasilan.length && !konum.lokasyonlar.length });
    }
    const h = hizliAyristir(metin);
    const kayitli = await prisma.kayit.findFirst({ where: { hamMetin: metin }, select: { id: true, baslik: true } });
    return ok({ tur: "ILAN", parmakIzi: metinParmakIzi(metin), hizli: h, konumlar: konum.lokasyonlar, cozulemeyen: konum.cozulemeyen, zatenKayitli: kayitli, aiGerekli: !kayitli && !(h.yeterli && konum.lokasyonlar.length) });
  } catch (e) { return hata(e); }
}