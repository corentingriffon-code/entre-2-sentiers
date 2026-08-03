document.addEventListener("DOMContentLoaded", function () {
  var toggle = document.querySelector(".nav-toggle");
  var nav = document.querySelector(".main-nav");

  if (toggle && nav) {
    toggle.addEventListener("click", function () {
      nav.classList.toggle("open");
    });

    nav.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", function () {
        nav.classList.remove("open");
      });
    });
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
