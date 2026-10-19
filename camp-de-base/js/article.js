/* =========================================================
   Camp de base. Fabrication d'un article du site
   Reproduit la structure des articles existants (articles/*.html) :
   en-tête, hero coloré selon le pilier, photo de une, corps, question
   de fin, sources, encadré auteur, « À lire aussi », pied de page.
   ========================================================= */

const SITE = "https://entre2sentiers.com";
const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

/* Pilier → classe de tag, libellé et teinte du hero (comme sur le site) */
export const PILLAR_STYLE = {
  territoires: { tag: "comprendre", label: "Territoires", section: "Territoires", hero: "comprendre", text: "#fff" },
  marques: { tag: "comprendre", label: "Marques", section: "Marques & Communication", hero: "comprendre", text: "#fff" },
  evenements: { tag: "creer", label: "Événements", section: "Événements", hero: "creer", text: "#1d261e" },
  photo: { tag: "creer", label: "Photo", section: "Photo", hero: "creer", text: "#1d261e" },
  environnement: { tag: "partager", label: "Environnement", section: "Environnement", hero: "partager", text: "#1d261e" },
  personnes: { tag: "partager", label: "Personnes", section: "Personnes", hero: "partager", text: "#1d261e" },
};

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

export function slugify(s) {
  return String(s || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/['’]/g, "-")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90)
    .replace(/-+$/g, "");
}

export function longDate(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

/* Mise en forme légère :
   ## Intertitre · > citation · - liste · **gras** · *italique* · [texte](https://lien) */
function inline(s) {
  return esc(s)
    .replace(/\[([^\]]+)\]\(((?:https?:\/\/|\/)[^)\s]+)\)/g, (m, t, u) => {
      const ext = /^https?:/.test(u) && !u.startsWith(SITE);
      return `<a href="${u}"${ext ? ' target="_blank" rel="noopener"' : ""}>${t}</a>`;
    })
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, "$1<em>$2</em>");
}

export function bodyToHTML(text) {
  const blocks = String(text || "").replace(/\r/g, "").split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);
  return blocks
    .map((b) => {
      if (b.startsWith("## ")) return `  <h2>${inline(b.slice(3))}</h2>`;
      if (b.startsWith("### ")) return `  <h3>${inline(b.slice(4))}</h3>`;
      const lines = b.split("\n");
      if (lines.every((l) => l.startsWith(">"))) return `  <blockquote>${inline(lines.map((l) => l.replace(/^>\s?/, "")).join(" "))}</blockquote>`;
      if (lines.every((l) => /^[-•]\s/.test(l))) return `  <ul>\n${lines.map((l) => `    <li>${inline(l.replace(/^[-•]\s/, ""))}</li>`).join("\n")}\n  </ul>`;
      return `  <p>${inline(lines.join(" "))}</p>`;
    })
    .join("\n");
}

export function wordCount(text) {
  return String(text || "").replace(/[#>*\-\[\]()]/g, " ").split(/\s+/).filter(Boolean).length;
}
export const readMinutes = (text) => Math.max(1, Math.round(wordCount(text) / 200));

/* Sources : une par ligne, « Titre | https://lien » ou juste le lien */
/* Sources : accepte tous les formats qu'on colle depuis Claude ou ailleurs
   « Titre | lien », « [Titre](lien) », « - Titre : lien », « 1. Titre – lien », « Titre (lien) »,
   titre sur une ligne et lien sur la suivante, ou lien seul (le nom du site sert alors de titre). */
const URL_RE = /https?:\/\/[^\s<>"'\])]+[^\s<>"'\]).,;:!?»]/;

function cleanTitle(t) {
  return t
    .replace(/^\s*(?:[-*•–—·]|\d+[.)])\s+/, "") // puce ou numéro
    .replace(/^\s*sources?\s*:\s*/i, "")
    .replace(/\*\*|__|`/g, "")
    .replace(/[\s|:–—\-(<,;.]+$/, "")
    .replace(/^[\s|:–—\-]+/, "")
    .trim();
}

function siteName(url) {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch (e) { return url; }
}

export function parseSources(text) {
  const lines = String(text || "").replace(/\r\n/g, "\n").split("\n").map((l) => l.trim()).filter(Boolean);
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^#+\s/.test(line) || /^sources?\s*:?$/i.test(line.replace(/[*_#`]/g, "").trim())) continue; // intitulé « Sources »
    const md = line.match(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/);
    if (md) { out.push({ title: cleanTitle(md[1]) || siteName(md[2]), url: md[2] }); continue; }
    const m = line.match(URL_RE);
    if (m) {
      const url = m[0];
      const title = cleanTitle(line.replace(url, " ").replace(/\(\s*\)|<\s*>/g, " "));
      out.push({ title: title || siteName(url), url });
      continue;
    }
    // Titre seul : le lien est peut-être sur la ligne suivante
    const next = lines[i + 1] || "";
    const nm = next.match(URL_RE);
    if (nm && !cleanTitle(next.replace(nm[0], " "))) {
      out.push({ title: cleanTitle(line) || siteName(nm[0]), url: nm[0] });
      i++;
      continue;
    }
    const title = cleanTitle(line);
    if (title) out.push({ title, url: "" });
  }
  return out;
}

/* Remet les sources au format du champ : une par ligne, « Titre | lien » */
export function formatSources(text) {
  return parseSources(text).map((s) => (s.url ? `${s.title} | ${s.url}` : s.title)).join("\n");
}

/* Construit le HTML complet de l'article.
   a = { slug, title, excerpt, pillar, body, question, sources, date, photo:{src, alt, credit}, related:[{slug,title,pillar,photo}] } */
export function buildArticleHTML(a, { preview = false } = {}) {
  const st = PILLAR_STYLE[a.pillar] || PILLAR_STYLE.marques;
  const url = `${SITE}/articles/${a.slug}`;
  const fullTitle = `${a.title}. Entre 2 sentiers`;
  const image = a.photo?.file ? `${SITE}/assets/${a.photo.file}` : `${SITE}/assets/og-image.jpg`;
  const minutes = readMinutes(a.body);
  const sources = parseSources(a.sources);
  const meta = [`<time datetime="${a.date}">${longDate(a.date)}</time>`, `${minutes} min de lecture`];
  if (a.photo?.credit) meta.push(`Photo : ${esc(a.photo.credit)}`);

  const gtmHead = preview
    ? ""
    : `<link rel="preconnect" href="https://www.googletagmanager.com">
<!-- Google Tag Manager -->
<script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','GTM-KFX92ZW4');</script>
<!-- End Google Tag Manager -->
`;
  const gtmBody = preview
    ? ""
    : `<!-- Google Tag Manager (noscript) -->
<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=GTM-KFX92ZW4"
height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>
<!-- End Google Tag Manager (noscript) -->
`;

  const ld = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Article",
        "@id": `${url}#article`,
        headline: a.title,
        description: a.excerpt,
        url,
        datePublished: a.date,
        dateModified: a.modified || a.date,
        image,
        author: { "@type": "Person", "@id": `${SITE}/a-propos#corentin-griffon`, name: "Corentin Griffon", url: `${SITE}/a-propos` },
        publisher: { "@type": "Organization", name: "Entre 2 sentiers", url: `${SITE}/`, logo: { "@type": "ImageObject", url: `${SITE}/assets/logo.png`, width: 176, height: 120 } },
        mainEntityOfPage: { "@type": "WebPage", "@id": url },
        wordCount: wordCount(a.body),
        articleSection: st.section,
        inLanguage: "fr-FR",
        isAccessibleForFree: true,
        speakable: { "@type": "SpeakableSpecification", cssSelector: ["blockquote", ".closing-question"] },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Accueil", item: `${SITE}/` },
          { "@type": "ListItem", position: 2, name: "Actualités", item: `${SITE}/actualites` },
          { "@type": "ListItem", position: 3, name: a.title, item: url },
        ],
      },
    ],
  };

  const photo = a.photo?.src
    ? `
<figure class="article-figure">
  <img src="${a.photo.src}" alt="${esc(a.photo.alt || a.title)}" loading="eager">${a.photo.credit ? `
  <figcaption>Photo : ${esc(a.photo.credit)}</figcaption>` : ""}
</figure>
`
    : "";

  const related = (a.related || []).slice(0, 3);
  const relatedHTML = related.length
    ? `
<section class="related">
  <div class="wrap">
    <span class="eyebrow">À lire aussi</span>
    <div class="article-grid">
${related
  .map((r) => {
    const rs = PILLAR_STYLE[r.pillar] || st;
    const media = r.photo
      ? `<div class="card-media card-media-photo" style="background-image:url('../assets/${r.photo}');"><span>${rs.label}</span></div>`
      : `<div class="card-media tone-${rs.tag}"><span>${rs.label}</span></div>`;
    return `      <a class="article-card" href="/articles/${r.slug}">
        ${media}
        <div class="card-body">
          <span class="tag ${rs.tag}">${rs.label}</span>
          <h3>${esc(r.title)}</h3>
        </div>
      </a>`;
  })
  .join("\n")}
    </div>
  </div>
</section>
`
    : "";

  return `<!doctype html>
<html lang="fr">
<head>
${preview ? '<base href="/articles/">\n' : ""}${gtmHead}<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="generator" content="Camp de base">
<title>${esc(fullTitle)}</title>
<meta name="description" content="${esc(a.excerpt)}">
<meta property="og:type" content="article">
<meta property="og:url" content="${url}">
<meta property="og:title" content="${esc(fullTitle)}">
<meta property="og:description" content="${esc(a.excerpt)}">
<meta property="og:image" content="${image}">
<meta property="og:locale" content="fr_FR">
<link rel="canonical" href="${url}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(fullTitle)}">
<meta name="twitter:description" content="${esc(a.excerpt)}">
<meta name="twitter:image" content="${image}">
<link rel="icon" type="image/png" sizes="48x48" href="../assets/favicon-48.png">
<link rel="icon" type="image/png" sizes="96x96" href="../assets/favicon-96.png">
<link rel="icon" type="image/png" sizes="32x32" href="../assets/favicon-32.png">
<link rel="icon" type="image/png" sizes="16x16" href="../assets/favicon-16.png">
<link rel="apple-touch-icon" sizes="180x180" href="../assets/apple-touch-icon.png">
<link rel="preload" as="font" type="font/woff2" href="../assets/fonts/bebas-neue-400.woff2" crossorigin>
<link rel="preload" as="font" type="font/woff2" href="../assets/fonts/work-sans-400.woff2" crossorigin>
<link rel="stylesheet" href="../css/style.css">
<script type="application/ld+json">
${JSON.stringify(ld, null, 2)}
</script>
</head>
<body>
${gtmBody}
<header class="site-header">
  <div class="wrap">
    <a href="/" class="logo"><img src="../assets/logo-white.png" alt="Entre 2 sentiers" width="210" height="144"></a>
    <nav class="main-nav" id="main-nav">
      <a href="/">Accueil</a>
      <a href="/actualites" class="active">Actualités</a>
      <a href="/podcast">Podcast</a>
      <a href="/portfolio">Portfolio</a>
      <a href="/a-propos">À propos</a>
      <a href="/contact">Contact</a>
      <a href="/en/news" class="lang-switch">EN</a>
    </nav>
    <button class="nav-toggle" aria-label="Ouvrir le menu" aria-expanded="false" aria-controls="main-nav"><span></span><span></span><span></span></button>
  </div>
</header>

<main>

<section class="article-hero tone-${st.hero}" style="color:${st.text};">
  <div class="wrap" style="max-width:760px;">
    <span class="tag ${st.tag}" style="background:rgba(255,255,255,0.16); border-color:${st.text};">${st.label}</span>
    <h1 style="color:${st.text};">${esc(a.title)}</h1>
    <p class="article-meta" style="color:${st.text === "#fff" ? "rgba(255,255,255,0.75)" : "rgba(29,38,30,0.75)"};">${meta.join(" · ")}</p>
  </div>
</section>
${photo}
<article class="article-body">
${bodyToHTML(a.body)}
${a.question ? `
  <div class="closing-question">
    <p><strong>${esc(a.question)}</strong></p>
  </div>
` : ""}${sources.length ? `
  <div class="article-sources">
    <span class="eyebrow">Sources</span>
    <ul>
${sources.map((s) => `      <li>${s.url ? `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.title)}</a>` : esc(s.title)}</li>`).join("\n")}
    </ul>
  </div>
` : ""}</article>

<div class="author-box wrap">
  <div class="author-avatar"><img src="../assets/corentin-avatar.jpg" alt="Corentin Griffon" width="58" height="58" loading="lazy"></div>
  <div>
    <p><a href="/a-propos"><strong>Corentin Griffon</strong></a> &middot; Entre 2 sentiers</p>
    <p>Communicant, photographe et coureur de trail. J'explore l'outdoor comme grille de lecture du marketing et de la communication.</p>
  </div>
</div>
${relatedHTML}
</main>

<footer class="site-footer">
  <div class="wrap">
    <div class="footer-top">
      <a href="/" class="logo"><img src="../assets/logo.png" alt="Entre 2 sentiers" width="176" height="120"></a>
      <nav class="footer-nav">
        <a href="/actualites">Actualités</a>
        <a href="/podcast">Podcast</a>
        <a href="/portfolio">Portfolio</a>
        <a href="/a-propos">À propos</a>
        <a href="/contact">Contact</a>
      </nav>
      <div class="footer-social">
        <a href="https://www.linkedin.com/in/corentin-griffon/" target="_blank" rel="noopener">LinkedIn</a>
        <a href="https://www.tiktok.com/@corentingrff" target="_blank" rel="noopener">TikTok</a>
        <a href="https://www.instagram.com/_zoom_studio/" target="_blank" rel="noopener">Instagram</a>
      </div>
    </div>
    <div class="footer-bottom">
      <span>© ${a.date.slice(0, 4)} Entre 2 sentiers.</span>
      <span>Les histoires derrière l'outdoor.</span>
      <a href="/cgu" class="footer-legal-link">CGU</a>
    </div>
  </div>
</footer>

<script src="../js/main.js" defer></script>
</body>
</html>
`;
}

/* Réduit une photo (fichier) en JPEG de 1600 px de large max, renvoie une data URL */
/* Réduit la photo (JPEG 1600 px) sans passer par une adresse blob:, que la politique
   de sécurité du site bloque : décodage direct, sinon lecture en data URL */
export async function resizePhoto(file, max = 1600, quality = 0.82) {
  let src = null;
  if (typeof createImageBitmap === "function") {
    try { src = await createImageBitmap(file, { imageOrientation: "from-image" }); } catch (e) { src = null; }
  }
  if (!src) src = await imageFromDataUrl(file);
  const k = Math.min(1, max / Math.max(src.width, src.height));
  const c = document.createElement("canvas");
  c.width = Math.round(src.width * k);
  c.height = Math.round(src.height * k);
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#fff"; // fond blanc pour les PNG transparents
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(src, 0, 0, c.width, c.height);
  src.close?.();
  return c.toDataURL("image/jpeg", quality);
}

function imageFromDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Image illisible"));
    reader.onload = () => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Image illisible"));
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

/* Recadrage : découpe la photo au format 16:9 en gardant la hauteur choisie
   (posY : 0 = haut de la photo, 100 = bas). src : data URL ou image du site (/assets/…). */
export const PHOTO_RATIO = 16 / 9;
export function cropPhoto(src, posY = 50, maxW = 1600, quality = 0.85) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onerror = () => reject(new Error("Image illisible"));
    img.onload = () => {
      let sw = img.naturalWidth;
      let sh = sw / PHOTO_RATIO;
      if (sh > img.naturalHeight) { sh = img.naturalHeight; sw = sh * PHOTO_RATIO; }
      const sx = (img.naturalWidth - sw) / 2;
      const sy = (img.naturalHeight - sh) * Math.min(100, Math.max(0, posY)) / 100;
      const w = Math.min(maxW, Math.round(sw));
      const c = document.createElement("canvas");
      c.width = w;
      c.height = Math.round(w / PHOTO_RATIO);
      c.getContext("2d").drawImage(img, sx, sy, sw, sh, 0, 0, c.width, c.height);
      resolve(c.toDataURL("image/jpeg", quality));
    };
    img.src = src;
  });
}
