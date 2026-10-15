/* =========================================================
   Camp de base. Récupération des articles déjà écrits sur le site
   Lit chaque page articles/<slug> et remplit la fiche du contenu :
   chapô, texte (remis en mise en forme simple), question de fin,
   sources, photo de une (celle de la page Actualités) et crédit.
   Ne remplace jamais un texte déjà saisi dans le Camp de base.
   ========================================================= */

const LABEL_TO_PILLAR = {
  territoires: "territoires",
  marques: "marques",
  "événements": "evenements",
  evenements: "evenements",
  photo: "photo",
  environnement: "environnement",
  personnes: "personnes",
};

async function fetchText(paths) {
  for (const p of paths) {
    try {
      const r = await fetch(p, { cache: "no-store" });
      if (r.ok) return await r.text();
    } catch (e) { /* on essaie le chemin suivant */ }
  }
  return null;
}

/* HTML en ligne → mise en forme simple (**gras**, *italique*, [lien](url)) */
function inlineToText(node) {
  let out = "";
  node.childNodes.forEach((n) => {
    if (n.nodeType === 3) out += n.textContent;
    else if (n.nodeType === 1) {
      const t = n.tagName.toLowerCase();
      const inner = inlineToText(n);
      if (t === "strong" || t === "b") out += `**${inner}**`;
      else if (t === "em" || t === "i") out += `*${inner}*`;
      else if (t === "a") out += `[${inner}](${n.getAttribute("href") || ""})`;
      else if (t === "br") out += " ";
      else out += inner;
    }
  });
  return out.replace(/\s+/g, " ");
}

function bodyFromArticle(article) {
  const blocks = [];
  article.childNodes.forEach((n) => {
    if (n.nodeType !== 1) return;
    if (n.matches(".closing-question, .article-sources")) return;
    const t = n.tagName.toLowerCase();
    if (t === "h2") blocks.push(`## ${inlineToText(n).trim()}`);
    else if (t === "h3") blocks.push(`### ${inlineToText(n).trim()}`);
    else if (t === "blockquote") blocks.push(`> ${inlineToText(n).trim()}`);
    else if (t === "ul" || t === "ol") blocks.push([...n.querySelectorAll(":scope > li")].map((li) => `- ${inlineToText(li).trim()}`).join("\n"));
    else if (t === "p") blocks.push(inlineToText(n).trim());
    else if (n.textContent.trim()) blocks.push(inlineToText(n).trim());
  });
  return blocks.filter(Boolean).join("\n\n");
}

/* Photos de une connues de la page Actualités : slug → fichier dans assets/ */
async function featuredImages() {
  const html = await fetchText(["/actualites", "/actualites.html"]);
  const map = {};
  if (!html) return map;
  const doc = new DOMParser().parseFromString(html, "text/html");
  doc.querySelectorAll('a[href^="/articles/"]').forEach((a) => {
    const slug = a.getAttribute("href").replace("/articles/", "").replace(/\.html$/, "");
    const el = a.matches("[style*='background-image']") ? a : a.querySelector("[style*='background-image']");
    const m = el?.getAttribute("style").match(/url\(['"]?(?:\.\.\/)?(?:\/)?assets\/([^'")]+)/);
    if (m && !map[slug]) map[slug] = m[1];
  });
  return map;
}

export async function importArticle(slug, images = {}) {
  const html = await fetchText([`/articles/${slug}`, `/articles/${slug}.html`]);
  if (!html) return null;
  const doc = new DOMParser().parseFromString(html, "text/html");
  const article = doc.querySelector("article.article-body");
  if (!article) return null;

  const excerpt = doc.querySelector('meta[name="description"]')?.content?.trim() || "";
  const question = doc.querySelector(".closing-question")?.textContent.trim() || "";
  const sources = [...doc.querySelectorAll(".article-sources li")]
    .map((li) => {
      const a = li.querySelector("a");
      return a ? `${a.textContent.trim()} | ${a.getAttribute("href")}` : li.textContent.trim();
    })
    .join("\n");
  const label = doc.querySelector(".article-hero .tag")?.textContent.trim().toLowerCase() || "";
  const meta = doc.querySelector(".article-hero .article-meta")?.textContent || "";
  const credit = (meta.match(/(?:Photo|Visuel)\s*:\s*(.+)$/) || [])[1]?.trim() || "";
  let date = "";
  try {
    const ld = JSON.parse(doc.querySelector('script[type="application/ld+json"]')?.textContent || "{}");
    const art = (ld["@graph"] || [ld]).find((x) => x["@type"] === "Article");
    date = art?.datePublished || "";
  } catch (e) { /* pas de date */ }

  return {
    excerpt,
    body: bodyFromArticle(article),
    question,
    sources,
    date,
    pillar: LABEL_TO_PILLAR[label] || "",
    photo: { file: images[slug] || "", alt: "", credit },
  };
}

/* Remplit toutes les fiches « article » qui ont une adresse mais pas encore de texte */
export async function importAllArticles(state) {
  const images = await featuredImages();
  let n = 0;
  for (const c of state.contents) {
    if (!c.slug || c.article?.body) continue;
    const a = await importArticle(c.slug, images);
    if (!a) continue;
    c.kind = "article";
    if (!c.pillar && a.pillar) c.pillar = a.pillar;
    c.article = {
      excerpt: a.excerpt,
      body: a.body,
      question: a.question,
      sources: a.sources,
      slug: c.slug,
      photo: a.photo,
      importedFromSite: true,
    };
    n++;
  }
  return n;
}
