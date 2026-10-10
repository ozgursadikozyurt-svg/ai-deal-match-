/**
 * Anahtar CRM v3.22.2 · 10 Ekim 2026
 * Gemini "structured output" şeması — Zod şemalarından OTOMATİK üretilir.
 * Gemini'ye `generationConfig: { responseMimeType: "application/json", responseSchema }` verilir;
 * model enum dışı değer veya tanımsız alan üretemez. Dönen JSON yine de Zod'dan geçirilir (çift kilit).
 *
 * Lokasyon: AI sadece ham ifadeleri döndürür (lokasyonIfadeleri) → src/lib/lokasyon/cozumle.ts ID'ye çevirir.
 */
import { z } from "zod";
import { MulkOzellikSchema } from "../validation/kayit";
import {
  KayitTipi, Aciliyet, MulkTipi, IslemTipi, ParaBirimi, FiyatPeriyodu, IlanSahibiTipi,
} from "../../generated/prisma/enums";

/** Gemini OpenAPI-alt kümesi */
export type GSchema = {
  type: "OBJECT" | "ARRAY" | "STRING" | "NUMBER" | "INTEGER" | "BOOLEAN";
  description?: string;
  enum?: string[];
  format?: string;
  nullable?: boolean;
  items?: GSchema;
  properties?: Record<string, GSchema>;
  required?: string[];
  propertyOrdering?: string[];
};

function unwrap(t: z.ZodTypeAny): { t: z.ZodTypeAny; nullable: boolean } {
  let nullable = false;
  for (;;) {
    if (t instanceof z.ZodOptional || t instanceof z.ZodNullable) { nullable = true; t = t.unwrap(); continue; }
    if (t instanceof z.ZodDefault) { t = t._def.innerType; continue; }
    if (t instanceof z.ZodEffects) { t = t._def.schema; continue; }
    if (t instanceof z.ZodPipeline) { t = t._def.out; continue; }
    return { t, nullable };
  }
}

export function zodToGemini(schema: z.ZodTypeAny, description?: string): GSchema {
  const { t, nullable } = unwrap(schema);
  const base = (s: GSchema): GSchema => ({ ...s, ...(nullable ? { nullable: true } : {}), ...(description ? { description } : {}) });
  if (t instanceof z.ZodObject) {
    const shape = t.shape as Record<string, z.ZodTypeAny>;
    const properties = Object.fromEntries(Object.entries(shape).map(([k, v]) => [k, zodToGemini(v)]));
    return base({ type: "OBJECT", properties, propertyOrdering: Object.keys(shape) });
  }
  if (t instanceof z.ZodArray) return base({ type: "ARRAY", items: zodToGemini(t.element) });
  if (t instanceof z.ZodNativeEnum) return base({ type: "STRING", enum: Object.values(t.enum as Record<string, string>) });
  if (t instanceof z.ZodEnum) return base({ type: "STRING", enum: t.options as string[] });
  if (t instanceof z.ZodBoolean) return base({ type: "BOOLEAN" });
  if (t instanceof z.ZodNumber) return base({ type: t.isInt ? "INTEGER" : "NUMBER" });
  if (t instanceof z.ZodDate) return base({ type: "STRING", format: "date-time" });
  if (t instanceof z.ZodUnion) return base({ type: "NUMBER" }); // para alanları
  return base({ type: "STRING" });
}

/** AI'ın tek bir mesajdan çıkardığı kayıt (henüz DB formatında değil) */
export const AiKayitSchema = z.object({
  /** Toplu işlemde bu kaydın çıkarıldığı mesajın numarası ([#3] → 3). Tek mesajda boş. */
  mesajNo: z.number().int().min(1).nullish(),
  tip: z.nativeEnum(KayitTipi),
  mulkTipi: z.nativeEnum(MulkTipi),
  alternatifMulkTipleri: z.array(z.nativeEnum(MulkTipi)).max(5).default([]),
  islemTipi: z.nativeEnum(IslemTipi),
  aciliyet: z.nativeEnum(Aciliyet).default("NORMAL"),
  fiyat: z.number().nullish(),
  minFiyat: z.number().nullish(),
  maxFiyat: z.number().nullish(),
  paraBirimi: z.nativeEnum(ParaBirimi).default("TRY"),
  fiyatPeriyodu: z.nativeEnum(FiyatPeriyodu).default("TOPLAM"),
  m2: z.number().nullish(),
  minM2: z.number().nullish(),
  maxM2: z.number().nullish(),
  netM2: z.number().nullish(),
  odaSayisi: z.string().max(20).nullish(),
  krediyeUygun: z.boolean().nullish(),
  /** Mesajda geçen ham lokasyon ifadeleri — ID üretme! */
  lokasyonIfadeleri: z.array(z.string().max(60)).max(15).default([]),
  ilanSahibiTipi: z.nativeEnum(IlanSahibiTipi).default("BILINMIYOR"),
  kisiAdi: z.string().max(120).nullish(),
  telefon: z.string().max(30).nullish(),
  firma: z.string().max(120).nullish(),
  portalUrl: z.string().max(500).nullish(),
  /** Tek cümlelik yapılandırılmış özet (paragraf değil) */
  ozet: z.string().max(280).nullish(),
  ozelSartlar: z.array(z.string().max(60)).max(10).default([]),
  ozellik: MulkOzellikSchema,
});

export const AiParseCiktiSchema = z.object({
  sinif: z.enum(["PORTFOY", "TALEP", "HER_IKISI", "GURULTU"]),
  kayitlar: z.array(AiKayitSchema).max(30), // v3.3: toplu işlemde 10 mesajlık paket birden çok kayıt üretebilir
});
export type AiParseCikti = z.infer<typeof AiParseCiktiSchema>;

export const GEMINI_RESPONSE_SCHEMA: GSchema = (() => {
  const s = zodToGemini(AiParseCiktiSchema);
  // Gemini'de required listesi: her kayıtta asgari alanlar
  const kayit = s.properties!.kayitlar.items!;
  kayit.required = ["tip", "mulkTipi", "islemTipi", "lokasyonIfadeleri", "ozellik"];
  s.required = ["sinif", "kayitlar"];
  return s;
})();

/** Sistem talimatı — ALTYAPI.md §2 promptunun v3 hâli (alan bazlı kurallar) */
export const GEMINI_SISTEM_TALIMATI = `
Sen Antalya gayrimenkul piyasasında (konut, ticari, endüstriyel, arsa, turizm) uzman bir veri çıkarma motorusun.
Görevin: WhatsApp / portal metnini VERİLEN JSON ŞEMASINA göre alanlara ayırmak. Serbest yorum yazma.

KURALLAR
1. Gürültü (silinen mesaj, medya, katılım bildirimi, araç/malzeme satışı) → {"sinif":"GURULTU","kayitlar":[]}.
2. Bilmediğin alanı null bırak. Tahmin etme. "Değerinde", "sorunuz" gibi fiyatlar → null.
3. Elektrik: "60 kwa", "60 KVA" → elektrikGucuKva=60; "50 kw" → elektrikGucuKw=50. Ham ifadeyi elektrikGucuHam'a yaz.
   "Özel trafolu" → trafo=true. "Sanayi tipi elektrik / 3 faz sanayi" → sanayiElektrigi=true.
4. Alan: "4000 m2 kapalı 2000 m2 açık" → kapaliAlanM2=4000, acikAlanM2=2000, m2=4000.
   "5-7 dönüm" → minM2=5000, maxM2=7000. "1000 üzeri" → minM2=1000.
5. Yükseklik: "6 metre makas altı" → makasAltiYukseklikM=6. "7 metre yükseklik" → netYukseklikM=7.
6. Kapı: "8 MT kapı" → kapiGenislikM=8 (aksi belirtilmedikçe genişlik). "2 adet yükleme kapısı" → kapiSayisi=2.
7. Araç erişimi: "TIR rampası/TIR girer" → aracErisimi=TIR; "kamyon girer" → KAMYON; "van tipi" → PANELVAN.
8. Ruhsat: "yapı kayıtlı" → ruhsatDurumu=YAPI_KAYITLI; "ruhsatlı" → RUHSATLI; "iskanlı" → iskan=true.
   Talepte "yapı kayıt veya ruhsat şart" → ruhsatDurumu=YAPI_KAYITLI ve kritikKriterler'e RUHSAT ekle.
9. Çatı/duvar: "sandviç panel çatı" → catiTipi=SANDVIC_PANEL; "trapez sac" → TRAPEZ_SAC; "yalıtımlı trapez" → YALITIMLI_TRAPEZ.
   "Duvar beton, tavan panel" → duvarTipi=BETON, catiTipi=SANDVIC_PANEL.
10. Fiyat periyodu: "aylık" → AYLIK; "yıllık peşin 4 milyon" → fiyat=4000000, fiyatPeriyodu=YILLIK, kiraOdemeSekli=YILLIK_PESIN.
    Kiralıkta periyot yazmıyorsa AYLIK, satılıkta TOPLAM.
11. İşlem: "devren", "devirlik" → DEVREN_SATILIK; "kat karşılığı" → KAT_KARSILIGI.
12. İlan sahibi: "sahibinden", "malik", "mal sahibi" → MALIK; emlak ofisi/danışman → EMLAKCI;
    "müteahhit" → MUTEAHHIT; kurumsal şirket kendi adına → FIRMA; bilinmiyorsa BILINMIYOR.
13. TALEP ise: müşterinin "şart/olmazsa olmaz/minimum/en az" dediği kriterleri kritikKriterler'e,
    "olursa iyi olur/tercih" dediklerini esnekKriterler'e yaz. Sayısal eşikler ilgili alanlara MİNİMUM olarak yazılır.
    Kullanım amacı (üretim, gıda, lojistik, eğitim…) → kullanimAmaclari.
    Mülk tipi ve kullanım amacına göre bilinmesi gereken ama mesajda OLMAYAN kritik bilgileri eksikBilgiler'e yaz
    (örn. üretim deposu talebinde elektrik yoksa ELEKTRIK; gıda için GIDAYA_UYGUNLUK; kira bütçesi yoksa FIYAT).
14. Lokasyon: mesajda geçen yer adlarını AYNEN lokasyonIfadeleri dizisine yaz ("Aksu", "Yenigöl", "Kepez/Altıntaş").
    ID veya ilçe tahmini üretme.
15. KONUT: "3+1", "2+1 dubleks", "stüdyo" → odaSayisi ("3+1", "1+0"); "120 m2 brüt 100 net" → m2=120, netM2=100.
    "kombili/doğalgazlı" → isinmaTipi=DOGALGAZ_KOMBI; "yerden ısıtma" → YERDEN_ISITMA; "merkezi" → MERKEZI.
    "eşyalı" → esyaDurumu=ESYALI; "eşyasız/boş" → ESYASIZ. "site içi/sitede" → siteIcinde=true; "havuzlu" → havuz=true.
    "güney cephe" → cepheYonleri=["GUNEY"]; "güney-batı" → ["GUNEY","BATI"]. "3. kat" → bulunduguKat=3; "bahçe katı" → bulunduguKat=0, bahce=true.
    "krediye uygun" → krediyeUygun=true. "deniz manzaralı" → denizManzarasi=true. "5 yaşında bina" → binaYasi=5; "sıfır" → binaYasi=0.
    Talepte "asansörlü olsun", "en az 2 banyo" gibi şartlar kritikKriterler'e (BANYO, SITE_GUVENLIK, KAT, ISINMA…) yazılır.
16. TOPLU İŞLEM: Metin [#1], [#2] … diye numaralı mesajlardan oluşuyorsa her kayda çıktığı mesajın numarasını mesajNo olarak yaz.
    Bir mesajda birden fazla ilan/talep olabilir; ilan/talep içermeyen mesajları atla (kayıt üretme).
17. ozet: en fazla 1 cümle. ozelSartlar: standart alana sığmayan kısa ifadeler (en fazla 60 karakter).
`.trim();