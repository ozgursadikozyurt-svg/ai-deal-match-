/**
 * Anahtar CRM v3.22.1 · 9 Ekim 2026
 * Yapay zekâ sağlayıcı istemcisi — tek bir "OpenAI uyumlu" sohbet çağrısı. Gemini, Groq, Cerebras, Mistral, OpenRouter ve OpenAI
 * aynı biçimi kabul ettiği için sağlayıcı değiştirmek kod değişikliği gerektirmez (Ayarlar › Yapay zekâ + AI_API_KEY).
 * Yanıt her zaman JSON nesnesi olarak istenir; doğrulamayı çağıran yapar (AiParseCiktiSchema).
 */
import type { AiAyar } from "../domain/ayarlar";

export class AiHatasi extends Error {
  constructor(public kod: "ANAHTAR_YOK" | "AYAR_EKSIK" | "SINIR" | "YETKI" | "SAGLAYICI" | "ZAMAN_ASIMI" | "JSON", mesaj: string, public durum?: number) { super(mesaj); }
}
type Getir = (url: string, init: { method: string; headers: Record<string, string>; body: string; signal?: AbortSignal }) => Promise<{ ok: boolean; status: number; text(): Promise<string> }>;

/** Model yanıtındaki JSON'u çıkarır (```json çitleri ve baştaki/sondaki açıklamalar atılır). */
export function jsonCikar(metin: string): unknown {
  const t = metin.replace(/```(?:json)?/gi, "").trim();
  const a = t.search(/[\[{]/), b = Math.max(t.lastIndexOf("}"), t.lastIndexOf("]"));
  if (a < 0 || b < a) throw new AiHatasi("JSON", "Yanıtta JSON bulunamadı");
  try { return JSON.parse(t.slice(a, b + 1)); } catch { throw new AiHatasi("JSON", "Yanıttaki JSON okunamadı"); }
}

export async function aiJsonIste(ayar: AiAyar, anahtar: string | undefined, istem: string, s: { sistem?: string; getir?: Getir; zamanAsimiMs?: number } = {}): Promise<unknown> {
  if (!anahtar) throw new AiHatasi("ANAHTAR_YOK", "AI_API_KEY tanımlı değil");
  if (!ayar.tabanUrl || !ayar.model) throw new AiHatasi("AYAR_EKSIK", "Yapay zekâ adresi ya da model adı boş");
  const getir = s.getir ?? (fetch as unknown as Getir);
  const kontrol = new AbortController();
  const zaman = setTimeout(() => kontrol.abort(), s.zamanAsimiMs ?? 30_000);
  try {
    const r = await getir(ayar.tabanUrl.replace(/\/+$/, "") + "/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${anahtar}` },
      body: JSON.stringify({ model: ayar.model, temperature: 0, response_format: { type: "json_object" }, messages: [...(s.sistem ? [{ role: "system", content: s.sistem }] : []), { role: "user", content: istem }] }),
      signal: kontrol.signal,
    });
    const govde = await r.text();
    if (!r.ok) throw new AiHatasi(r.status === 429 ? "SINIR" : r.status === 401 || r.status === 403 ? "YETKI" : "SAGLAYICI", `Sağlayıcı ${r.status} döndürdü: ${govde.slice(0, 200)}`, r.status);
    let icerik: unknown;
    try { icerik = JSON.parse(govde)?.choices?.[0]?.message?.content; } catch { throw new AiHatasi("JSON", "Sağlayıcı yanıtı okunamadı"); }
    if (typeof icerik !== "string" || !icerik.trim()) throw new AiHatasi("JSON", "Sağlayıcı boş yanıt döndürdü");
    return jsonCikar(icerik);
  } catch (e) {
    if (e instanceof AiHatasi) throw e;
    if ((e as { name?: string })?.name === "AbortError") throw new AiHatasi("ZAMAN_ASIMI", "Yapay zekâ zamanında yanıt vermedi");
    throw new AiHatasi("SAGLAYICI", String((e as Error)?.message ?? e));
  } finally { clearTimeout(zaman); }
}