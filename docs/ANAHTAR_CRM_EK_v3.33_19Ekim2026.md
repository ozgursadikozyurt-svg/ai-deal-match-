# Anahtar CRM — Ek v3.33 · 19 Ekim 2026

Kaynak: Özgür'ün 19 Ekim geri bildirimi (depo eşleşmelerinde "Sorulacak: Elektrik" olanların 83–84 alması, ara kat talebine giriş kat 80, Daire/Dükkan süzgecinde depo görünmesi).

## 1. Şartı bilinmeyen kriter (src/lib/eslestirme/onizleme.ts)
**Sorun:** Şart elektrik bilinmediğinde bileşen yarım puan (0,5) alıyor, üstüne yalnızca −4 düşülüyordu; "Koşullu" tavanı (84) farkları da siliyordu. "50 kW şart" talebine elektriği bilinmeyen 1.100 m² depo **83**. Canlıda 105 aktif deponun 22'sinde güç girili; bunlar öne geçemiyordu.
**Yeni kural:** talepte şart (kritik) olan her bilinmeyen satır için `SART_BILINMEYEN_CEZASI = 15`, skor en fazla `SART_BILINMEYEN_SKOR_TAVANI = 74`. Fiyatın kendi çarpanı var (FIYATSIZ_CARPAN), kullanım amacı ve tip hariç. Eleme yok, Koşullu.

| Senaryo (50 kW şart, 1.000 m², ≤ 200 bin) | Eski | Yeni |
|---|---|---|
| Elektrik bilinmiyor | 83 Koşullu | **72** Koşullu |
| Elektrik 60 kW | 93 Sunulabilir | 93 Sunulabilir |
| Elektrik 30 kW | 40 Uygun değil | 40 Uygun değil |
| m² ve elektrik bilinmiyor | 73 | **47** |

**Sıralama merdiveni:** doğrulanmış 85–100 · şartsız bilinmeyen ≤ 84 · şartı bilinmeyen ≤ 74 · karşılanmayan istek ≤ 70 (eskiden 80) · kat tutmuyor ≤ 60 · uygun değil ≤ 40.

## 2. Kat
"Katta" / ara kat talebine giriş, zemin ya da son kat: `KAT_UYMUYOR_SKOR_TAVANI = 60` (eskiden 80). Özgür: "sunulmamalı ama tercih değişebilir → listenin sonunda". Talepte kat açıkça "şart" işaretlenirse eskisi gibi Uygun değil.
Örnek (Kepez 3+1, 5,8 M): giriş 80 → **60**, son kat 80 → **60**, 4/11 ara kat 100.

## 3. Elektrik: kW = kVA = kwa
- `GUC_FAKTORU` 0,8 → 1 (Özgür: "ne yazılırsa yazılsın eşit"). "400 kwa" artık 400 kW.
- Hızlı ayrıştırıcı: "40 kw / kva / kwa / kilovat" → `elektrikGucuKw`; `trafoGucuKva` yalnızca metinde "trafo" geçiyorsa. Yapay zekâ talimatı da aynı.
- Eşleştirmede talep ve portföy gücü tek satırda: `elektrikGucuKw ?? elektrikGucuKva ?? trafoGucuKva`; portföyde hiçbiri yoksa ilan başlığı / metni okunur ("60 KVA" → "60 (ilan metninden)", `metindenGuc`).

## 4. Bina yaşı
`binaYasiOku`: "sıfırdan 7-8 yaşına kadar" → 8 (eskiden "sıfır" görülüp 0). "en fazla 10 yaş", "10 yaş altı" → 10.

## 5. Eşleşmeler süzgeci (demo/app.tsx)
Mülk türü ve İşlem artık **portföyün kendi tipine** uygulanır. Eskiden süzgeç talep YA DA portföy tutarsa geçiyordu: "Depo/Mağaza" talebinin alternatif tipi Dükkan olduğu için, Daire + Dükkan seçiliyken depo portföyleri listede kalıyordu. Diğer süzgeçler (konum, fiyat, kişi…) eskisi gibi iki tarafa.

## 6. Canlı veri düzeltmesi
- "Kepez Dokumada Yeni Binada Komple Tadilatlı Satılık Daire": oda 3+1 → 2+1 (Özgür onayı).
- TNSLII87 (Kepez 3+1 talebi): bina yaşı 0 → 8.

Testler: `tests/v333.test.ts`. Şema değişikliği yok.
