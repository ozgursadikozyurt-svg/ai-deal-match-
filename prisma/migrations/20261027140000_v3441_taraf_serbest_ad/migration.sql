-- Anahtar CRM v3.44.1 · 27 Ekim 2026 — Taraf kişisi rehbere bağlanamasa da işlem kaydedilsin
-- Sebep: rehbere yeni eklenmiş ama henüz sunucuya yazılmamış bir kişi tarafa eklenince
-- islem_kisi_kisiId_fkey ihlal ediliyor ve işlem hiç kaydedilmiyordu.
-- Artık kisiId boş kalabilir; taraf yalnızca adıyla saklanır, kişi sonradan bağlanabilir.

ALTER TABLE "islem_kisi" ALTER COLUMN "kisiId" DROP NOT NULL;
ALTER TABLE "islem_kisi" ADD COLUMN "ad" TEXT;

-- Kişi silinince taraf satırı da silinmesin; yalnızca bağ boşalsın (ad kalır)
ALTER TABLE "islem_kisi" DROP CONSTRAINT "islem_kisi_kisiId_fkey";
ALTER TABLE "islem_kisi" ADD CONSTRAINT "islem_kisi_kisiId_fkey"
  FOREIGN KEY ("kisiId") REFERENCES "kisi"("id") ON DELETE SET NULL ON UPDATE CASCADE;
