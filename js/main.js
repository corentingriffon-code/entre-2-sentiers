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

  var latestGrid = document.querySelector("[data-latest-source]");
  if (latestGrid) {
    var source = latestGrid.getAttribute("data-latest-source");

    var extractUrl = function (bgImage) {
      var match = /url\((['"]?)(.*?)\1\)/.exec(bgImage || "");
      return match ? match[2] : "";
    };

    var cardFromFeatured = function (el) {
      var tagEl = el.querySelector(".tag");
      var titleEl = el.querySelector("h2");
      var excerptEl = el.querySelector(".featured-article-body p");
      return {
        href: el.getAttribute("href") || "",
        image: extractUrl(el.getAttribute("style")),
        tagClass: tagEl ? tagEl.className.replace("tag", "").trim() : "",
        tagText: tagEl ? tagEl.textContent : "",
        title: titleEl ? titleEl.textContent : "",
        excerpt: excerptEl ? excerptEl.textContent : "",
        meta: el.getAttribute("data-meta") || ""
      };
    };

    var cardFromCard = function (el) {
      var media = el.querySelector(".card-media");
      var tagEl = el.querySelector(".tag");
      var titleEl = el.querySelector("h3");
      var excerptEl = el.querySelector(".card-excerpt");
      var metaEl = el.querySelector(".card-meta");
      return {
        href: el.getAttribute("href") || "",
        image: media ? extractUrl(media.getAttribute("style")) : "",
        tagClass: tagEl ? tagEl.className.replace("tag", "").trim() : "",
        tagText: tagEl ? tagEl.textContent : "",
        title: titleEl ? titleEl.textContent : "",
        excerpt: excerptEl ? excerptEl.textContent : "",
        meta: metaEl ? metaEl.textContent : ""
      };
    };

    var renderLatest = function (items) {
      if (!items.length) { return; }
      var frag = document.createDocumentFragment();
      items.forEach(function (item) {
        var card = document.createElement("a");
        card.className = "article-card";
        card.href = item.href;

        var media = document.createElement("div");
        media.className = "card-media card-media-photo";
        media.setAttribute("style", "background-image:url('" + item.image + "');");
        var mediaSpan = document.createElement("span");
        mediaSpan.textContent = item.tagText;
        media.appendChild(mediaSpan);

        var body = document.createElement("div");
        body.className = "card-body";

        var tag = document.createElement("span");
        tag.className = "tag " + item.tagClass;
        tag.textContent = item.tagText;

        var title = document.createElement("h3");
        title.textContent = item.title;

        var excerpt = document.createElement("p");
        excerpt.className = "card-excerpt";
        excerpt.textContent = item.excerpt;

        var meta = document.createElement("p");
        meta.className = "card-meta";
        meta.textContent = item.meta;

        body.appendChild(tag);
        body.appendChild(title);
        body.appendChild(excerpt);
        body.appendChild(meta);
        card.appendChild(media);
        card.appendChild(body);
        frag.appendChild(card);
      });
      latestGrid.innerHTML = "";
      latestGrid.appendChild(frag);
    };

    fetch(source)
      .then(function (res) { return res.text(); })
      .then(function (html) {
        var doc = new DOMParser().parseFromString(html, "text/html");
        var items = [];
        var featured = doc.querySelector(".featured-article");
        if (featured) { items.push(cardFromFeatured(featured)); }
        doc.querySelectorAll(".article-grid .article-card").forEach(function (el) {
          if (items.length < 3) { items.push(cardFromCard(el)); }
        });
        renderLatest(items.slice(0, 3));
      })
      .catch(function () {
        /* keep the static fallback already in the page */
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
