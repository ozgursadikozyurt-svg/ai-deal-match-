/**
 * Anahtar CRM v3.22.2 · 10 Ekim 2026
 * Antalya dışındaki büyük şehirler için BAŞLANGIÇ alt bölge (semt / ticari aks) listesi.
 * Bunlar resmî mahalle değildir ama ilanlarda ve mesajlarda yer adı olarak geçer ("Levent'te ofis", "Alsancak'ta dükkan").
 *  - Hepsi `dogrulandi: false` ve İLÇE düzeyindedir: mahalle bağları boştur, eşleştirmede ilçe gibi davranır.
 *  - Aynı ilçede aynı adlı resmî mahalle varsa satır atlanır (mahalle zaten tanınır) — bkz. seed ve demo derleyicisi.
 *  - Liste bilerek kısadır; yeni semtler uygulamada "Konumlar › öğret" ile ya da buraya satır eklenerek çoğaltılır.
 */
export type TurkiyeAltBolge = [il: string, ilce: string | null, ad: string, tip: "SEMT" | "TICARI_AKS" | "OSB" | "SANAYI_SITESI" | "TURIZM_BOLGESI"];

export const TURKIYE_ALT_BOLGELER: TurkiyeAltBolge[] = [
  // İstanbul
  ["İstanbul", "Beşiktaş", "Levent", "TICARI_AKS"], ["İstanbul", "Beşiktaş", "Etiler", "SEMT"], ["İstanbul", "Beşiktaş", "Bebek", "SEMT"], ["İstanbul", "Beşiktaş", "Ortaköy", "SEMT"],
  ["İstanbul", "Sarıyer", "Maslak", "TICARI_AKS"], ["İstanbul", "Sarıyer", "Tarabya", "SEMT"], ["İstanbul", "Sarıyer", "İstinye", "SEMT"], ["İstanbul", "Sarıyer", "Zekeriyaköy", "SEMT"],
  ["İstanbul", "Şişli", "Mecidiyeköy", "TICARI_AKS"], ["İstanbul", "Şişli", "Nişantaşı", "SEMT"],
  ["İstanbul", "Beyoğlu", "Taksim", "TICARI_AKS"], ["İstanbul", "Beyoğlu", "Karaköy", "TICARI_AKS"], ["İstanbul", "Beyoğlu", "Galata", "SEMT"],
  ["İstanbul", "Kadıköy", "Bostancı", "SEMT"], ["İstanbul", "Kadıköy", "Göztepe", "SEMT"], ["İstanbul", "Kadıköy", "Moda", "SEMT"], ["İstanbul", "Kadıköy", "Kozyatağı", "TICARI_AKS"],
  ["İstanbul", "Kadıköy", "Erenköy", "SEMT"], ["İstanbul", "Kadıköy", "Suadiye", "SEMT"], ["İstanbul", "Kadıköy", "Fenerbahçe", "SEMT"],
  ["İstanbul", "Üsküdar", "Altunizade", "TICARI_AKS"], ["İstanbul", "Üsküdar", "Çengelköy", "SEMT"], ["İstanbul", "Beykoz", "Kavacık", "TICARI_AKS"],
  ["İstanbul", "Bakırköy", "Yeşilköy", "SEMT"], ["İstanbul", "Bakırköy", "Florya", "SEMT"], ["İstanbul", "Bakırköy", "Ataköy", "SEMT"],
  ["İstanbul", "Pendik", "Kurtköy", "SEMT"], ["İstanbul", "Ümraniye", "Dudullu", "SANAYI_SITESI"], ["İstanbul", null, "İkitelli", "SANAYI_SITESI"],
  ["İstanbul", "Arnavutköy", "Hadımköy", "SANAYI_SITESI"], ["İstanbul", "Başakşehir", "Bahçeşehir", "SEMT"], ["İstanbul", "Eyüpsultan", "Göktürk", "SEMT"], ["İstanbul", "Eyüpsultan", "Kemerburgaz", "SEMT"],
  ["İstanbul", "Bağcılar", "Güneşli", "TICARI_AKS"], ["İstanbul", "Güngören", "Merter", "TICARI_AKS"], ["İstanbul", "Fatih", "Laleli", "TICARI_AKS"], ["İstanbul", "Fatih", "Eminönü", "TICARI_AKS"], ["İstanbul", "Fatih", "Sultanahmet", "TURIZM_BOLGESI"],
  // Ankara
  ["Ankara", "Çankaya", "Kızılay", "TICARI_AKS"], ["Ankara", "Çankaya", "Çayyolu", "SEMT"], ["Ankara", "Çankaya", "Ümitköy", "SEMT"], ["Ankara", "Çankaya", "Dikmen", "SEMT"], ["Ankara", "Çankaya", "Oran", "SEMT"],
  ["Ankara", "Çankaya", "Balgat", "TICARI_AKS"], ["Ankara", "Çankaya", "Söğütözü", "TICARI_AKS"], ["Ankara", "Çankaya", "Tunalı", "TICARI_AKS"],
  ["Ankara", "Yenimahalle", "Batıkent", "SEMT"], ["Ankara", "Yenimahalle", "Ostim", "SANAYI_SITESI"], ["Ankara", "Yenimahalle", "İvedik", "SANAYI_SITESI"],
  ["Ankara", "Etimesgut", "Eryaman", "SEMT"], ["Ankara", "Gölbaşı", "İncek", "SEMT"], ["Ankara", "Altındağ", "Siteler", "SANAYI_SITESI"],
  // İzmir
  ["İzmir", "Konak", "Alsancak", "TICARI_AKS"], ["İzmir", "Konak", "Kemeraltı", "TICARI_AKS"], ["İzmir", "Konak", "Basmane", "SEMT"], ["İzmir", "Konak", "Güzelyalı", "SEMT"],
  ["İzmir", "Karşıyaka", "Bostanlı", "SEMT"], ["İzmir", "Karşıyaka", "Mavişehir", "SEMT"], ["İzmir", "Çeşme", "Alaçatı", "TURIZM_BOLGESI"],
  ["İzmir", "Bornova", "Işıkkent", "SANAYI_SITESI"], ["İzmir", "Bornova", "Çamdibi", "SANAYI_SITESI"], ["İzmir", "Gaziemir", "Sarnıç", "SANAYI_SITESI"], ["İzmir", "Buca", "Şirinyer", "SEMT"],
  // Bursa
  ["Bursa", "Nilüfer", "Görükle", "SEMT"], ["Bursa", "Nilüfer", "Özlüce", "SEMT"], ["Bursa", "Nilüfer", "Beşevler", "SEMT"], ["Bursa", "Osmangazi", "Çekirge", "SEMT"], ["Bursa", "Osmangazi", "Demirtaş", "SANAYI_SITESI"], ["Bursa", "Osmangazi", "Heykel", "TICARI_AKS"],
  // Muğla
  ["Muğla", "Bodrum", "Yalıkavak", "TURIZM_BOLGESI"], ["Muğla", "Bodrum", "Gümbet", "TURIZM_BOLGESI"], ["Muğla", "Bodrum", "Turgutreis", "TURIZM_BOLGESI"], ["Muğla", "Bodrum", "Bitez", "TURIZM_BOLGESI"],
  ["Muğla", "Bodrum", "Gündoğan", "TURIZM_BOLGESI"], ["Muğla", "Bodrum", "Türkbükü", "TURIZM_BOLGESI"], ["Muğla", "Fethiye", "Göcek", "TURIZM_BOLGESI"], ["Muğla", "Fethiye", "Ölüdeniz", "TURIZM_BOLGESI"],
  ["Muğla", "Fethiye", "Çalış", "TURIZM_BOLGESI"], ["Muğla", "Marmaris", "İçmeler", "TURIZM_BOLGESI"], ["Muğla", "Ortaca", "Dalyan", "TURIZM_BOLGESI"], ["Muğla", "Ortaca", "Sarıgerme", "TURIZM_BOLGESI"],
  // Diğer
  ["Kocaeli", "Çayırova", "Şekerpınar", "SANAYI_SITESI"], ["Mersin", "Yenişehir", "Pozcu", "SEMT"], ["Mersin", "Erdemli", "Kızkalesi", "TURIZM_BOLGESI"], ["Aydın", "Didim", "Altınkum", "TURIZM_BOLGESI"],
];