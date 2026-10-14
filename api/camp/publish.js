/* Camp de base : publication d'un article sur le site.
   Écrit, en un seul commit sur la branche principale du dépôt GitHub :
   - articles/<slug>.html (fabriqué par le Camp de base)
   - assets/<slug>-featured.jpg (photo de une, si fournie)
   - actualites.html : le nouvel article devient la « Dernière actualité », l'ancienne descend dans la grille
   - sitemap.xml : ajout (ou mise à jour de lastmod)
   Vercel redéploie ensuite le site automatiquement.

   Variables d'environnement Vercel :
   - PUBLISH_CODE   code de publication choisi par Corentin (protège la publication)
   - GITHUB_TOKEN   jeton GitHub « fine-grained » limité à ce dépôt, droit Contents en lecture/écriture
   - GITHUB_REPO    facultatif, « propriétaire/dépôt » (par défaut corentingriffon-code/entre-2-sentiers)
   - GITHUB_BRANCH  facultatif (par défaut main) */

const crypto = require("node:crypto");

const env = (name) => {
  const k = Object.keys(process.env).find((x) => x.toUpperCase() === name);
  return (k ? process.env[k] : "").trim().replace(/^["']|["']$/g, "");
};

const PILLAR_FROM_LABEL = {
  Territoires: "territoires",
  Marques: "marques",
  "Événements": "evenements",
  Photo: "photo",
  Environnement: "environnement",
  Personnes: "personnes",
};

const escAttr = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

function sameCode(a, b) {
  const x = crypto.createHash("sha256").update(String(a)).digest();
  const y = crypto.createHash("sha256").update(String(b)).digest();
  return crypto.timingSafeEqual(x, y);
}

function github(token, repo) {
  return async (method, path, body) => {
    const r = await fetch(`https://api.github.com/repos/${repo}${path}`, {
      method,
      headers: {
        authorization: `Bearer ${token}`,
        accept: "application/vnd.github+json",
        "x-github-api-version": "2022-11-28",
        "user-agent": "camp-de-base",
        ...(body ? { "content-type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const j = r.status === 204 ? {} : await r.json().catch(() => ({}));
    if (!r.ok) {
      const err = new Error(j.message || `GitHub ${r.status}`);
      err.status = r.status;
      throw err;
    }
    return j;
  };
}

/* Le featured actuel de actualites.html redescend en tête de la grille */
function updateNews(html, a) {
  const featRe = /<a class="featured-article" href="([^"]+)" data-meta="([^"]*)"(?: style="background-image:url\('([^']+)'\);")?>\s*<div class="featured-article-body">\s*<span class="tag ([a-z]+)">([^<]+)<\/span>\s*<h2>([\s\S]*?)<\/h2>\s*<p>([\s\S]*?)<\/p>[\s\S]*?<\/a>/;
  const m = html.match(featRe);
  if (!m) throw new Error("Structure de actualites.html non reconnue (bloc « Dernière actualité » introuvable).");
  const [, oldHref, oldMeta, oldImg, oldTag, oldLabel, oldTitle, oldExcerpt] = m;

  const bg = a.image ? ` style="background-image:url('assets/${a.image}');"` : "";
  const featured = `<a class="featured-article" href="/articles/${a.slug}" data-meta="${a.minutes} min de lecture"${bg}>
    <div class="featured-article-body">
      <span class="tag ${a.tag}">${a.label}</span>
      <h2>${escAttr(a.title)}</h2>
      <p>${escAttr(a.excerpt)}</p>
      <span class="btn btn-primary btn-sm">Lire l'article →</span>
    </div>
  </a>`;

  const pillar = PILLAR_FROM_LABEL[oldLabel.trim()] || "marques";
  const media = oldImg
    ? `<div class="card-media card-media-photo" style="background-image:url('${oldImg}');"><span>${oldLabel}</span></div>`
    : `<div class="card-media tone-${oldTag}"><span>${oldLabel}</span></div>`;
  const card = `
      <a class="article-card" data-pillar="${pillar}" href="${oldHref}">
        ${media}
        <div class="card-body">
          <span class="tag ${oldTag}">${oldLabel}</span>
          <h3>${oldTitle.trim()}</h3>
          <p class="card-excerpt">${oldExcerpt.trim()}</p>
          <p class="card-meta">${oldMeta}</p>
        </div>
      </a>
`;
  let out = html.replace(featRe, featured);
  const gridRe = /(<section class="blog-section">[\s\S]*?<div class="article-grid">\n)/;
  if (!gridRe.test(out)) throw new Error("Structure de actualites.html non reconnue (grille d'articles introuvable).");
  out = out.replace(gridRe, `$1${card}`);
  return out;
}

function updateSitemap(xml, slug, date) {
  const loc = `https://entre2sentiers.com/articles/${slug}`;
  const line = `  <url><loc>${loc}</loc><lastmod>${date}</lastmod></url>`;
  const existing = new RegExp(`  <url><loc>${loc.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}</loc><lastmod>[^<]*</lastmod></url>`);
  if (existing.test(xml)) return xml.replace(existing, line);
  const en = xml.indexOf("  <url><loc>https://entre2sentiers.com/en<");
  if (en >= 0) return xml.slice(0, en) + line + "\n" + xml.slice(en);
  return xml.replace("</urlset>", `${line}\n</urlset>`);
}

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  const CODE = env("PUBLISH_CODE");
  const TOKEN = env("GITHUB_TOKEN");
  const REPO = env("GITHUB_REPO") || "corentingriffon-code/entre-2-sentiers";
  const BRANCH = env("GITHUB_BRANCH") || "main";

  if (req.method === "GET") {
    const missing = [];
    if (!CODE) missing.push("PUBLISH_CODE");
    if (!TOKEN) missing.push("GITHUB_TOKEN");
    return res.status(200).json({ configured: !missing.length, missing });
  }
  if (req.method !== "POST") return res.status(405).json({ error: "Méthode non autorisée" });
  if (!CODE || !TOKEN) return res.status(200).json({ ok: false, error: "Publication non configurée sur Vercel (PUBLISH_CODE et GITHUB_TOKEN)." });

  const b = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
  if (!b.code || !sameCode(b.code, CODE)) return res.status(401).json({ ok: false, error: "Code de publication incorrect.", badCode: true });

  const slug = String(b.slug || "");
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 100) return res.status(400).json({ ok: false, error: "Adresse d'article invalide." });
  if (typeof b.html !== "string" || b.html.length < 200 || b.html.length > 600000) return res.status(400).json({ ok: false, error: "Contenu de l'article invalide." });
  const date = /^\d{4}-\d{2}-\d{2}$/.test(b.date) ? b.date : new Date().toISOString().slice(0, 10);

  const gh = github(TOKEN, REPO);
  try {
    const ref = await gh("GET", `/git/ref/heads/${BRANCH}`);
    const headSha = ref.object.sha;
    const head = await gh("GET", `/git/commits/${headSha}`);

    const read = async (path) => {
      try {
        const f = await gh("GET", `/contents/${path}?ref=${headSha}`);
        return Buffer.from(f.content, "base64").toString("utf8");
      } catch (e) {
        if (e.status === 404) return null;
        throw e;
      }
    };

    const articlePath = `articles/${slug}.html`;
    const existing = await read(articlePath);
    const isNew = existing === null;
    const news = await read("actualites.html");
    if (news === null) throw new Error("actualites.html introuvable dans le dépôt.");
    const listed = news.includes(`href="/articles/${slug}"`);
    // Ne jamais écraser un article publié qui a été écrit avant le Camp de base.
    // Un article écrit mais jamais publié (absent de la page Actualités) peut, lui, être publié depuis le Camp de base.
    if (!isNew && listed && !existing.includes('content="Camp de base"')) {
      return res.status(200).json({ ok: false, error: "Cet article est déjà publié et a été écrit avant le Camp de base : il n'est pas modifiable d'ici." });
    }
    const firstPublication = !listed;
    const files = [{ path: articlePath, content: b.html, encoding: "utf-8" }];

    let image = b.imageFile || "";
    if (b.image) {
      const m = String(b.image).match(/^data:image\/jpeg;base64,(.+)$/);
      if (!m) return res.status(400).json({ ok: false, error: "Photo invalide (JPEG attendu)." });
      image = `${slug}-featured.jpg`;
      files.push({ path: `assets/${image}`, content: m[1], encoding: "base64" });
    }

    if (firstPublication) {
      files.push({
        path: "actualites.html",
        content: updateNews(news, { slug, title: b.title, excerpt: b.excerpt, minutes: b.minutes || 3, tag: b.tag, label: b.label, image }),
        encoding: "utf-8",
      });
    }
    const sitemap = await read("sitemap.xml");
    if (sitemap !== null) files.push({ path: "sitemap.xml", content: updateSitemap(sitemap, slug, date), encoding: "utf-8" });

    const tree = await gh("POST", "/git/trees", {
      base_tree: head.tree.sha,
      tree: await Promise.all(
        files.map(async (f) => {
          const blob = await gh("POST", "/git/blobs", { content: f.content, encoding: f.encoding });
          return { path: f.path, mode: "100644", type: "blob", sha: blob.sha };
        })
      ),
    });
    const commit = await gh("POST", "/git/commits", {
      message: `${firstPublication ? "Publie" : "Met à jour"} « ${b.title} » depuis le Camp de base`,
      tree: tree.sha,
      parents: [headSha],
    });
    await gh("PATCH", `/git/refs/heads/${BRANCH}`, { sha: commit.sha });

    res.status(200).json({ ok: true, isNew: firstPublication, url: `https://entre2sentiers.com/articles/${slug}`, imageFile: image, commit: commit.sha.slice(0, 7) });
  } catch (e) {
    const hint =
      e.status === 401 ? " (jeton GitHub invalide ou expiré)" :
      e.status === 403 || e.status === 404 ? " (le jeton GitHub n'a pas accès en écriture à ce dépôt)" :
      e.status === 422 ? " (le site a changé pendant la publication : réessaie)" : "";
    res.status(200).json({ ok: false, error: `${e.message}${hint}` });
  }
};
