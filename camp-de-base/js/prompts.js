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

Réponds UNIQUEMENT avec le texte du post, prêt à copier, sans phrase avant ou après.`;

export function buildPrompt(mode, { title, pillar, draft, notes, article = {} }) {
  const parts = [VOICE, mode === "article" ? ARTICLE_RULES : LINKEDIN_RULES];
  if (title) parts.push(`<titre>${title}</titre>`);
  if (pillar) parts.push(`<thematique>${pillar}</thematique>`);
  if (draft) parts.push(`<brouillon>\n${draft}\n</brouillon>`);
  if (notes) parts.push(`<notes>\n${notes}\n</notes>`);
  if (mode === "linkedin" && article.body) parts.push(`<article>\n${article.excerpt ? `Chapô : ${article.excerpt}\n\n` : ""}${article.body}\n</article>`);
  if (mode === "linkedin" && article.url) parts.push(`<lien_article_pour_info>${article.url}</lien_article_pour_info>`);
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
