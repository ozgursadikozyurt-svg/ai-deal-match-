/* Anahtar CRM — tanıtım sitesi: mobil menü, kaydırınca üst çizgi, kayıt açık değilse "Ücretsiz deneyin" → "Erken erişim isteyin". */
(function () {
  var dugme = document.querySelector(".menu-dugme"), menu = document.getElementById("ana-menu");
  if (dugme && menu) {
    dugme.addEventListener("click", function () {
      var acik = menu.classList.toggle("acik");
      dugme.setAttribute("aria-expanded", acik ? "true" : "false");
    });
    menu.addEventListener("click", function (e) { if (e.target.closest("a")) { menu.classList.remove("acik"); dugme.setAttribute("aria-expanded", "false"); } });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && menu.classList.contains("acik")) { menu.classList.remove("acik"); dugme.setAttribute("aria-expanded", "false"); dugme.focus(); } });
  }
  var ust = document.querySelector(".ust");
  if (ust) { var f = function () { ust.classList.toggle("kaydi", window.scrollY > 8); }; f(); window.addEventListener("scroll", f, { passive: true }); }

  // Açık kayıt kapalıyken yeni ziyaretçi giriş ekranında "hesap yok" görmesin: düğme erken erişim talebine döner.
  var basla = document.querySelectorAll(".js-basla");
  if (!basla.length || !window.fetch) return;
  fetch("/api/yapilandirma", { headers: { accept: "application/json" } })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (j) {
      if (!j || j.acikKayit) return;
      basla.forEach(function (a) { a.textContent = "Erken erişim isteyin"; a.setAttribute("href", "/iletisim#erken-erisim"); });
      document.querySelectorAll(".js-basla-not").forEach(function (n) { n.textContent = "Şu an davetle açıyoruz. Yazın, ofisinizi açıp size giriş bağlantısı gönderelim."; });
    })
    .catch(function () {});
})();
