/**
 * Anahtar CRM v3.22 · 9 Ekim 2026
 * Test yardımcısı — bir ekranı JSDOM içinde gerçekten çizer; düğmelere basıp sonucu inceleyebilirsiniz
 * (renderToStaticMarkup'ta açılır menüler, "Geri" ile dönüş gibi etkileşimler görünmez).
 */
import React from "react";
import { JSDOM } from "jsdom";
import { C, type Ctx } from "../demo/ortak";

export async function ac(el: React.ReactElement, c?: Ctx) {
  const dom = new JSDOM("<div id=k></div>", { pretendToBeVisual: true, url: "http://localhost/" });
  const g = globalThis as any;
  g.window = dom.window; g.document = dom.window.document; g.IS_REACT_ACT_ENVIRONMENT = true;
  const kaydirmalar: number[] = [];
  (dom.window as any).scrollTo = (o: any) => { kaydirmalar.push(typeof o === "number" ? o : o?.top ?? 0); };
  const { createRoot } = await import("react-dom/client");
  const { act } = await import("react");
  const doc = dom.window.document;
  const kok = createRoot(doc.getElementById("k")!);
  await act(async () => kok.render(c ? React.createElement(C.Provider, { value: c }, el) : el));
  const yardimci = {
    dom, doc, act, kok, kaydirmalar,
    metin: () => doc.getElementById("k")!.textContent ?? "",
    q: (s: string) => doc.querySelector(s) as HTMLElement | null,
    qa: (s: string) => [...doc.querySelectorAll(s)] as HTMLElement[],
    tikla: (e: Element | null | undefined) => act(async () => { if (!e) throw new Error("tıklanacak öğe yok"); (e as HTMLElement).click(); }),
    /** metni verilen kalıpla başlayan (ya da eşleşen) ilk düğme */
    dugme: (m: string | RegExp) => [...doc.querySelectorAll("button")].find((b) => { const t = (b.textContent ?? "").trim(); return typeof m === "string" ? t.startsWith(m) : m.test(t); }) as HTMLElement | undefined,
    tus: (e: Element | null, key: string) => act(async () => { e!.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key, bubbles: true })); }),
    /** React'in denetlediği bir yazı alanına değer yazar. (JSDOM React'ten SONRA kurulduğu için `input` olayı React'e ulaşmaz;
     *  bu yüzden DOM değeri yazılıp alanın React `onChange` işleyicisi doğrudan çağrılır.) */
    yaz: (e: Element | null, deger: string) => act(async () => {
      const set = Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, "value")!.set!;
      set.call(e, deger);
      const k = Object.keys(e as object).find((x) => x.startsWith("__reactProps$"));
      (e as any)[k!]?.onChange?.({ target: e, currentTarget: e, type: "change" });
    }),
    kaydirmaDegeri: (y: number) => Object.defineProperty(dom.window, "scrollY", { value: y, configurable: true }),
    kapat: () => act(async () => kok.unmount()),
  };
  return yardimci;
}
