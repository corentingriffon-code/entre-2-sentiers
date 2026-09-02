document.addEventListener("DOMContentLoaded", function () {
  var toggle = document.querySelector(".nav-toggle");
  var nav = document.querySelector(".main-nav");

  if (toggle && nav) {
    var isEnglish = document.documentElement.lang === "en";
    var closeLabel = isEnglish ? "Close menu" : "Fermer le menu";
    var openLabel = isEnglish ? "Open menu" : "Ouvrir le menu";

    var setOpen = function (isOpen) {
      nav.classList.toggle("open", isOpen);
      toggle.setAttribute("aria-expanded", String(isOpen));
      toggle.setAttribute("aria-label", isOpen ? closeLabel : openLabel);
    };

    toggle.addEventListener("click", function () {
      setOpen(!nav.classList.contains("open"));
    });

    nav.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", function () {
        setOpen(false);
      });
    });
  }

  var lazyEmbeds = document.querySelectorAll("iframe[data-src]");
  if (lazyEmbeds.length) {
    if ("IntersectionObserver" in window) {
      var embedObserver = new IntersectionObserver(function (entries, observer) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            var frame = entry.target;
            frame.src = frame.getAttribute("data-src");
            frame.removeAttribute("data-src");
            observer.unobserve(frame);
          }
        });
      }, { rootMargin: "300px 0px" });

      lazyEmbeds.forEach(function (frame) {
        embedObserver.observe(frame);
      });
    } else {
      lazyEmbeds.forEach(function (frame) {
        frame.src = frame.getAttribute("data-src");
        frame.removeAttribute("data-src");
      });
    }
  }

  var filterBar = document.querySelector(".filter-bar");
  if (filterBar) {
    var buttons = filterBar.querySelectorAll(".filter-btn");
    var cards = document.querySelectorAll("[data-pillar]");

    buttons.forEach(function (btn) {
      btn.addEventListener("click", function () {
        buttons.forEach(function (b) { b.classList.remove("active"); });
        btn.classList.add("active");
        var target = btn.getAttribute("data-filter");

        cards.forEach(function (card) {
          if (target === "tous" || card.getAttribute("data-pillar") === target) {
            card.style.display = "";
          } else {
            card.style.display = "none";
          }
        });
      });
    });
  }
});
