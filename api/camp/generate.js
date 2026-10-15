/* =========================================================
   Camp de base. Rédaction assistée par Claude
   POST { code, mode: "article" | "linkedin", title, pillar, draft, notes, article }
   → article  : { ok, article: { title, slug, excerpt, body, question, sources } }
   → linkedin : { ok, post }
   GET → { configured, missing }
   Variables Vercel : ANTHROPIC_API_KEY, PUBLISH_CODE (le même code que pour publier).
   ========================================================= */

const crypto = require("node:crypto");
const Anthropic = require("@anthropic-ai/sdk");

const MODEL = "claude-opus-5-5";

function env(name) {
  if (process.env[name]) return process.env[name];
  const k = Object.keys(process.env).find((x) => x.toUpperCase() === name);
  return k ? process.env[k] : "";
}

function sameCode(a, b) {
  const x = crypto.createHash("sha256").update(String(a)).digest();
  const y = crypto.createHash("sha256").update(String(b)).digest();
  return crypto.timingSafeEqual(x, y);
}

const VOICE = `Tu écris pour « Entre 2 sentiers », le blog de Corentin Griffon (entre2sentiers.com). Il y regarde le marketing, la communication, la photo et l'environnement à travers le sport outdoor au sens large (trail, course à pied, ski, stations, événements, marques, athlètes, territoires).

Le ton : à la première personne, direct, curieux, sans jargon ni formules creuses. Des phrases courtes qui claquent alternent avec des paragraphes d'analyse. Corentin pose une vraie question et y répond avec des exemples concrets, puis donne son avis personnel. Pas d'emojis dans les articles, pas de points d'exclamation en série, pas de tirets cadratins : utilise des virgules, des deux-points ou des parenthèses.

Le brouillon de Corentin est la matière première : garde ses idées, ses exemples, ses opinions et sa façon de dire les choses. N'invente aucun chiffre, aucune citation, aucun nom, aucune date, aucun fait qui n'est pas dans le brouillon ou les notes ; si une affirmation demande d'être vérifiée, formule-la prudemment plutôt que d'ajouter un détail précis.`;

const ARTICLE_RULES = `Rédige un article de blog complet à partir du brouillon.

- Entre 700 et 1100 mots environ, selon la matière disponible.
- Une accroche de 2 ou 3 phrases qui pose la tension, sans intertitre avant.
- 3 à 5 parties avec des intertitres courts (lignes qui commencent par "## ").
- Mise en forme autorisée dans "body" uniquement : "## Intertitre", "**gras**" (avec parcimonie), "*italique*", "> citation", "- liste", "[texte](https://lien)". Une ligne vide entre deux paragraphes. Pas de titre principal (le titre est à part), pas de HTML.
- La dernière partie donne l'avis de Corentin, sans intertitre « Conclusion ».
- "question" : une question ouverte posée aux lecteurs à la fin (une phrase).
- "excerpt" : le chapô, une ou deux phrases qui donnent envie de lire, 160 caractères au maximum.
- "title" : garde le titre de Corentin s'il en a donné un, sinon propose-en un court (moins de 70 caractères).
- "slug" : l'adresse de l'article, en minuscules sans accents, mots séparés par des tirets, 3 à 8 mots.
- "sources" : une par ligne au format "Titre | https://lien", uniquement des liens présents dans le brouillon ou les notes ; chaîne vide sinon.`;

const LINKEDIN_RULES = `Rédige un post LinkedIn à partir de cette matière, dans le style de mon post modèle ci-dessous.

- Entre 700 et 1300 caractères environ.
- Une première ligne courte et affirmative qui bouscule une idée reçue, puis une deuxième ligne qui la retourne.
- Des paragraphes très courts (1 à 3 lignes) séparés par une ligne vide. Texte brut : pas de Markdown, pas de gras, pas de titres, pas de hashtags.
- Un ou deux faits concrets tirés du brouillon ou de l'article, puis une phrase-choc qui résume l'idée en une ligne.
- 2 ou 3 emojis au plus, placés en fin de ligne, jamais au début du post.
- Avant-dernier paragraphe : « J'ai regardé… » ou équivalent, qui présente ce que l'article explore.
- Dernière ligne : « Retrouvez le lien de l'article dans les commentaires 👇 » (le lien n'est pas dans le post, je le mets en commentaire).

Mon post modèle, qui a très bien marché : inspire-toi de sa structure, de son accroche, de son rythme, de sa longueur et de son ton, sans recopier ses phrases ni son sujet.
<post_modele>
Decathlon n’est plus le magasin du pas cher.

C’est devenu celui de la performance accessible à tous.

Le détail qui résume cette transformation : la marque a arrêté de dire “athlète”. Elle dit “expert”.

Quand la marque Kiprun a signé le coureur Paul Chelimo, elle ne l’a pas présenté comme un sprinteur sponsorisé, mais comme un expert du running. 🏃‍♂️‍➡️

Et en avril dernier, elle a signé Mathieu Blanchard, vainqueur de la Diagonale des Fous, qui quitte Salomon après neuf ans. Pas seulement pour qu’il porte les chaussures. Il est aussi ingénieur de formation, et va participer à leur conception.

Un athlète porte un produit. Un expert le pense avec vous.

J’ai regardé comment Decathlon construit cette nouvelle image, entre nouveau logo, signatures retentissantes (Griezmann, @Alex Sarr) et ce choix de vocabulaire qui change tout.  🧠

Retrouvez le lien de l'article dans les commentaires  👇
</post_modele>

Le post va dans le champ "post".`;

const SCHEMAS = {
  article: {
    type: "object",
    properties: {
      title: { type: "string" },
      slug: { type: "string" },
      excerpt: { type: "string" },
      body: { type: "string" },
      question: { type: "string" },
      sources: { type: "string" },
    },
    required: ["title", "slug", "excerpt", "body", "question", "sources"],
    additionalProperties: false,
  },
  linkedin: {
    type: "object",
    properties: { post: { type: "string" } },
    required: ["post"],
    additionalProperties: false,
  },
};

function material(b) {
  const parts = [];
  if (b.title) parts.push(`<titre>${b.title}</titre>`);
  if (b.pillar) parts.push(`<thematique>${b.pillar}</thematique>`);
  if (b.draft) parts.push(`<brouillon>\n${b.draft}\n</brouillon>`);
  if (b.notes) parts.push(`<notes>\n${b.notes}\n</notes>`);
  const a = b.article || {};
  if (b.mode === "linkedin" && a.body) {
    parts.push(`<article_publie_ou_prevu>\n${a.excerpt ? `Chapô : ${a.excerpt}\n\n` : ""}${a.body}\n</article_publie_ou_prevu>`);
  }
  if (b.mode === "linkedin" && a.url) parts.push(`<lien_article>${a.url}</lien_article>`);
  return parts.join("\n\n");
}

module.exports = async (req, res) => {
  const missing = ["ANTHROPIC_API_KEY", "PUBLISH_CODE"].filter((n) => !env(n));
  if (req.method === "GET") return res.status(200).json({ configured: !missing.length, missing });
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Méthode non autorisée." });
  if (missing.length) return res.status(200).json({ ok: false, configured: false, missing, error: `À ajouter sur Vercel : ${missing.join(", ")}.` });

  let b = req.body || {};
  if (typeof b === "string") {
    try { b = JSON.parse(b); } catch (e) { b = {}; }
  }
  if (!b.code || !sameCode(b.code, env("PUBLISH_CODE"))) return res.status(200).json({ ok: false, badCode: true, error: "Code de publication incorrect." });

  const mode = b.mode === "linkedin" ? "linkedin" : "article";
  const clip = (s, n) => String(s || "").slice(0, n);
  const input = {
    mode,
    title: clip(b.title, 300),
    pillar: clip(b.pillar, 60),
    draft: clip(b.draft, 60000),
    notes: clip(b.notes, 20000),
    article: { excerpt: clip(b.article?.excerpt, 600), body: clip(b.article?.body, 60000), url: clip(b.article?.url, 300) },
  };
  if (!input.draft.trim() && !input.article.body.trim()) {
    return res.status(200).json({ ok: false, error: "Le brouillon est vide : écris d'abord tes idées." });
  }

  const client = new Anthropic({ apiKey: env("ANTHROPIC_API_KEY") });
  try {
    const stream = client.beta.messages.stream({
      model: MODEL,
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      thinking: { type: "adaptive" },
      output_config: { effort: "medium", format: { type: "json_schema", schema: SCHEMAS[mode] } },
      system: VOICE,
      messages: [{ role: "user", content: `${mode === "article" ? ARTICLE_RULES : LINKEDIN_RULES}\n\n${material(input)}` }],
    });
    const msg = await stream.finalMessage();

    if (msg.stop_reason === "refusal") {
      return res.status(200).json({ ok: false, error: "Claude n'a pas pu rédiger ce texte à partir de ce brouillon. Reformule le brouillon et réessaie." });
    }
    if (msg.stop_reason === "max_tokens") {
      return res.status(200).json({ ok: false, error: "Le texte généré était trop long et a été coupé. Réessaie avec un brouillon plus resserré." });
    }
    const text = msg.content.filter((c) => c.type === "text").map((c) => c.text).join("");
    let out;
    try { out = JSON.parse(text); } catch (e) {
      return res.status(200).json({ ok: false, error: "Réponse inattendue de Claude, réessaie." });
    }
    if (mode === "linkedin") return res.status(200).json({ ok: true, post: String(out.post || "").trim() });
    return res.status(200).json({ ok: true, article: out });
  } catch (err) {
    let error = "Génération impossible pour le moment, réessaie dans un instant.";
    if (err instanceof Anthropic.AuthenticationError) error = "La clé ANTHROPIC_API_KEY est refusée : vérifie-la sur Vercel.";
    else if (err instanceof Anthropic.PermissionDeniedError) error = "La clé Anthropic n'a pas accès à ce modèle.";
    else if (err instanceof Anthropic.RateLimitError) error = "Trop de demandes d'un coup : attends une minute et réessaie.";
    else if (err instanceof Anthropic.BadRequestError && /credit|billing|balance/i.test(err.message)) error = "Plus de crédit sur le compte Anthropic : recharge-le sur console.anthropic.com (Billing).";
    else if (err instanceof Anthropic.APIError) error = `Erreur Anthropic (${err.status ?? "réseau"}) : ${err.message}`;
    console.error("generate:", err);
    return res.status(200).json({ ok: false, error });
  }
};
