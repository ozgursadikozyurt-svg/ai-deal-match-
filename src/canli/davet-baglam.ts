/**
 * Anahtar CRM v3.20 · 7 Ekim 2026
 * Davet kabul akışı için küçük bir bağlam: doğrulanmış e-postayı rotaya taşır.
 *
 * Neden ayrı: /api/davet/kabul henüz bir ofise ait olmayan kişi tarafından çağrılır, bu yüzden
 * ofis bağlamı (kiracilicIcinde) kurulamaz. Ama e-posta MUTLAKA doğrulanmış oturum anahtarından
 * gelmelidir — istek gövdesindeki e-postaya güvenilirse başkasının davetini kullanmak mümkün olur.
 */
import { AsyncLocalStorage } from "node:async_hooks";

const depo = new AsyncLocalStorage<string>();

export const davetBaglamiIcinde = <T>(eposta: string, is: () => Promise<T>): Promise<T> => depo.run(eposta, is);

/** Doğrulanmış oturum anahtarından gelen e-posta; yoksa undefined (giriş yapılmamış) */
export const davetEpostasi = (): string | undefined => depo.getStore();
