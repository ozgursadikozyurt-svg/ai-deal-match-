/**
 * Anahtar CRM v3.24 · 10 Ekim 2026
 * Kullanıcının ekrandan değiştirdiği ayarlar (TTL dışındakiler): yapay zekâ sağlayıcısı, paylaşım imzası, çalışma ili.
 * Sunucu ve demo aynı şemayı kullanır; veritabanında `ayar` tablosunda anahtar başına bir satır ("ai", "paylasim", "calismaIli").
 * API ANAHTARI BURADA SAKLANMAZ — sunucuda ortam değişkenidir (AI_API_KEY).
 */
import { z } from "zod";

// ───────── Yapay zekâ ─────────
export const AI_SAGLAYICI_KODLARI = ["GEMINI", "GROQ", "CEREBRAS", "MISTRAL", "OPENROUTER", "OPENAI", "OZEL"] as const;
export type AiSaglayici = (typeof AI_SAGLAYICI_KODLARI)[number];
export interface AiSaglayiciBilgisi { ad: string; tabanUrl: string; model: string; ucretsiz: string; veri: string; anahtar: string }
/**
 * Hepsi "OpenAI uyumlu" sohbet uç noktası (POST <tabanUrl>/chat/completions) üzerinden çağrılır; sağlayıcı değiştirmek = bu satırlardan
 * birini seçmek + AI_API_KEY'i değiştirmek. Ücretsiz katman bilgileri 2 Ekim 2026 araştırmasıdır (ALTYAPI §39); sınırlar sık değişir.
 */
export const AI_SAGLAYICILAR: Record<AiSaglayici, AiSaglayiciBilgisi> = {
  GEMINI: { ad: "Google Gemini (Flash-Lite)", tabanUrl: "https://generativelanguage.googleapis.com/v1beta/openai", model: "gemini-3.5-flash-lite", ucretsiz: "Ücretsiz katman var, kart istemez; günlük istek sınırı AI Studio'da görünür", veri: "Ücretsiz katmanda gönderilen metinler Google ürünlerini geliştirmek için kullanılabilir (AB dışı)", anahtar: "aistudio.google.com → Get API key" },
  GROQ: { ad: "Groq (Llama 3.3 70B)", tabanUrl: "https://api.groq.com/openai/v1", model: "llama-3.3-70b-versatile", ucretsiz: "Ücretsiz: dakikada ~30, günde ~1.000 istek", veri: "Eğitimde kullanılmıyor", anahtar: "console.groq.com → API Keys" },
  CEREBRAS: { ad: "Cerebras (Llama 3.3 70B)", tabanUrl: "https://api.cerebras.ai/v1", model: "llama-3.3-70b", ucretsiz: "Ücretsiz: dakikada ~30 istek, günde ~1 M belirteç", veri: "Eğitimde kullanılmıyor", anahtar: "cloud.cerebras.ai → API Keys" },
  MISTRAL: { ad: "Mistral (Small)", tabanUrl: "https://api.mistral.ai/v1", model: "mistral-small-latest", ucretsiz: "Deneme katmanı ücretsiz (aylık ~1 milyar belirteç)", veri: "Deneme katmanında eğitimde kullanıma izin gerekir", anahtar: "console.mistral.ai → API Keys" },
  OPENROUTER: { ad: "OpenRouter (ücretsiz modeller)", tabanUrl: "https://openrouter.ai/api/v1", model: "meta-llama/llama-3.3-70b-instruct:free", ucretsiz: "Ücretsiz modellerde günde ~50 istek (10 $ yüklemeyle 1.000)", veri: "Modele göre değişir", anahtar: "openrouter.ai → Keys" },
  OPENAI: { ad: "OpenAI", tabanUrl: "https://api.openai.com/v1", model: "gpt-5.4-nano", ucretsiz: "Ücretsiz katman yok", veri: "API verisi eğitimde kullanılmıyor", anahtar: "platform.openai.com → API keys" },
  OZEL: { ad: "Diğer (OpenAI uyumlu)", tabanUrl: "", model: "", ucretsiz: "—", veri: "—", anahtar: "Sağlayıcının belgesine bakın" },
};

export const AiAyarSchema = z.object({
  saglayici: z.enum(AI_SAGLAYICI_KODLARI).default("GEMINI"),
  model: z.string().trim().max(120).default(AI_SAGLAYICILAR.GEMINI.model),
  tabanUrl: z.string().trim().max(300).default(AI_SAGLAYICILAR.GEMINI.tabanUrl),
  /** Güven yüzdesi bu değerin altındaysa "emin değilim" uyarısı belirginleşir (bkz. yorumlayici.ts → parcaGuveni) */
  esik: z.number().int().min(30).max(95).default(70),
  /** Eşiğin altında kalan tek kayıtlarda yapay zekâ kendiliğinden çağrılsın mı */
  otomatik: z.boolean().default(false),
});
export type AiAyar = z.output<typeof AiAyarSchema>;
export const AI_VARSAYILAN: AiAyar = AiAyarSchema.parse({});
export const aiAyarNormalize = (x: unknown): AiAyar => { const p = AiAyarSchema.safeParse(x ?? {}); return p.success ? p.data : AI_VARSAYILAN; };
/** Sağlayıcı seçilince model ve adres o sağlayıcının varsayılanına döner */
export const aiSaglayiciSec = (a: AiAyar, s: AiSaglayici): AiAyar => ({ ...a, saglayici: s, model: AI_SAGLAYICILAR[s].model, tabanUrl: AI_SAGLAYICILAR[s].tabanUrl });

// ───────── Portföy paylaşım imzası ─────────
export const PaylasimAyarSchema = z.object({
  adSoyad: z.string().trim().min(2).max(80).default("Özgür Özyurt"),
  telefon: z.string().trim().max(30).default("0530 936 54 27"),
  unvan: z.string().trim().max(80).default("Gayrimenkul Danışmanı"),
  firma: z.string().trim().max(80).default(""),
});
export type PaylasimAyar = z.output<typeof PaylasimAyarSchema>;
export const PAYLASIM_VARSAYILAN: PaylasimAyar = PaylasimAyarSchema.parse({});
export const paylasimNormalize = (x: unknown): PaylasimAyar => { const p = PaylasimAyarSchema.safeParse(x ?? {}); return p.success ? p.data : PAYLASIM_VARSAYILAN; };

// ───────── Çalışma ili ─────────
/** Konum yazılırken ve metin çözülürken varsayılan il (plaka kodu). 7 = Antalya. */
export const CALISMA_ILI_VARSAYILAN = 7;
export const calismaIliNormalize = (x: unknown): number => (typeof x === "number" && Number.isInteger(x) && x >= 1 && x <= 81 ? x : CALISMA_ILI_VARSAYILAN);