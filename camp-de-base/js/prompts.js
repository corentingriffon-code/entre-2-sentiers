/* =========================================================
   Camp de base. Demandes de rédaction pour Claude (mode gratuit)
   Le texte est copié puis collé dans claude.ai ; la réponse est recollée
   dans la fiche et découpée ici pour remplir l'article ou le post.
   ========================================================= */

const VOICE = `Tu écris pour « Entre 2 sentiers », le blog de Corentin Griffon (entre2sentiers.com). Il y regarde le marketing, la communication, la photo et l'environnement à travers le sport outdoor au sens large (trail, course à pied, ski, stations, événements, marques, athlètes, territoires).

Le ton : à la première personne, direct, curieux, sans jargon ni formules creuses. Des phrases courtes qui claquent alternent avec des paragraphes d'analyse. Corentin pose une vraie question et y répond avec des exemples concrets, puis donne son avis personnel. Pas de tirets cadratins : utilise des virgules, des deux-points ou des parenthèses.

Mon brouillon est la matière première : garde mes idées, mes exemples, mes opinions et ma façon de dire les choses. N'invente aucun chiffre, aucune citation, aucun nom, aucune date, aucun fait qui n'est pas dans le brouillon ou les notes ; si une affirmation demande d'être vérifiée, formule-la prudemment plutôt que d'ajouter un détail précis.`;

const ARTICLE_RULES = `Rédige un article de blog complet à partir de mon brouillon.

- Entre 700 et 1100 mots environ, selon la matière disponible. Pas d'emojis.
- Une accroche de 2 ou 3 phrases qui pose la tension, sans intertitre avant.
- 3 à 5 parties avec des intertitres courts (lignes qui commencent par "## ").
- Mise en forme autorisée : "## Intertitre", "**gras**" (avec parcimonie), "*italique*", "> citation", "- liste", "[texte](https://lien)". Une ligne vide entre deux paragraphes. Pas de titre principal dans le texte.
- La dernière partie donne mon avis, sans intertitre « Conclusion ».

Réponds UNIQUEMENT avec ce modèle, en gardant exactement les lignes === … === (pas de bloc de code, pas de phrase avant ou après) :

=== TITRE ===
(mon titre s'il y en a un, sinon un titre court de moins de 70 caractères)
=== ADRESSE ===
(l'adresse de l'article : minuscules sans accents, mots séparés par des tirets, 3 à 8 mots)
=== CHAPO ===
(une ou deux phrases qui donnent envie de lire, 160 caractères au maximum)
=== TEXTE ===
(l'article)
=== QUESTION ===
(une question ouverte posée aux lecteurs à la fin, une phrase)
=== SOURCES ===
(une par ligne au format "Titre | https://lien", uniquement des liens présents dans mon brouillon ou mes notes ; laisse vide sinon)`;

const LINKEDIN_RULES = `Rédige un post LinkedIn à partir de cette matière.

- Entre 900 et 1800 caractères, 3000 au grand maximum.
- La première ligne doit donner envie de cliquer sur « voir plus » : une affirmation forte ou une question, sans emoji au début.
- Des paragraphes très courts (1 à 3 lignes) séparés par une ligne vide. Texte brut : pas de Markdown, pas de gras, pas de titres.
- Au plus 2 ou 3 emojis sobres dans tout le post, aucun si ce n'est pas utile.
- Termine par une question ouverte pour lancer la discussion.
- Si un lien d'article est fourni, invite à lire l'article complet avec ce lien sur sa propre ligne, juste avant la question finale.
- Ajoute 3 à 5 hashtags pertinents sur la toute dernière ligne.

Réponds UNIQUEMENT avec le texte du post, prêt à copier, sans phrase avant ou après.`;

export function buildPrompt(mode, { title, pillar, draft, notes, article = {} }) {
  const parts = [VOICE, mode === "article" ? ARTICLE_RULES : LINKEDIN_RULES];
  if (title) parts.push(`<titre>${title}</titre>`);
  if (pillar) parts.push(`<thematique>${pillar}</thematique>`);
  if (draft) parts.push(`<brouillon>\n${draft}\n</brouillon>`);
  if (notes) parts.push(`<notes>\n${notes}\n</notes>`);
  if (mode === "linkedin" && article.body) parts.push(`<article>\n${article.excerpt ? `Chapô : ${article.excerpt}\n\n` : ""}${article.body}\n</article>`);
  if (mode === "linkedin" && article.url) parts.push(`<lien_article>${article.url}</lien_article>`);
  return parts.join("\n\n");
}

const KEYS = { TITRE: "title", ADRESSE: "slug", CHAPO: "excerpt", "CHAPÔ": "excerpt", TEXTE: "body", QUESTION: "question", SOURCES: "sources" };

/* Découpe la réponse collée ; si les repères manquent, tout part dans le texte de l'article */
export function parseArticle(raw) {
  const text = String(raw || "").replace(/\r\n/g, "\n").replace(/^```[a-z]*\n|\n```\s*$/g, "");
  const out = { title: "", slug: "", excerpt: "", body: "", question: "", sources: "" };
  const re = /^[#*\s]*={2,}\s*([A-ZÀ-Üa-zà-ü]+)\s*={2,}[*\s]*$/gm;
  const marks = [...text.matchAll(re)].filter((m) => KEYS[m[1].toUpperCase()]);
  if (!marks.length) { out.body = text.trim(); return out; }
  marks.forEach((m, i) => {
    const end = i + 1 < marks.length ? marks[i + 1].index : text.length;
    out[KEYS[m[1].toUpperCase()]] = text.slice(m.index + m[0].length, end).trim();
  });
  out.slug = out.slug.replace(/^.*\/articles\//, "").replace(/[()]/g, "").trim();
  return out;
}

export function cleanPost(raw) {
  return String(raw || "").replace(/\r\n/g, "\n").replace(/^```[a-z]*\n|\n```\s*$/g, "").trim();
}
