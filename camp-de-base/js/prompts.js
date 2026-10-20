/* =========================================================
   Camp de base. Demandes de rédaction pour Claude (mode gratuit)
   Le texte est copié puis collé dans claude.ai ; la réponse est recollée
   dans la fiche et découpée ici pour remplir l'article ou le post.
   ========================================================= */

import { REF_ARTICLE, REF_POST } from "./reference.js";

const VOICE = `Tu écris pour « Entre 2 sentiers », le blog de Corentin Griffon (entre2sentiers.com). Il y regarde le marketing, la communication, la photo et l'environnement à travers le sport outdoor au sens large (trail, course à pied, ski, stations, événements, marques, athlètes, territoires).

Le ton : à la première personne, direct, curieux, sans jargon ni formules creuses. Des phrases courtes qui claquent alternent avec des paragraphes d'analyse. Corentin pose une vraie question et y répond avec des exemples concrets, puis donne son avis personnel. Pas de tirets cadratins : utilise des virgules, des deux-points ou des parenthèses.

Ma matière première, c'est mon brouillon pour un article, et mon article pour un post : garde mes idées, mes exemples, mes opinions et ma façon de dire les choses. N'invente aucun chiffre, aucune citation, aucun nom, aucune date, aucun fait qui n'est pas dans cette matière ou dans mes notes ; si une affirmation demande d'être vérifiée, formule-la prudemment plutôt que d'ajouter un détail précis.`;

const ARTICLE_RULES = `Rédige un article de blog complet à partir de mon brouillon.

- Entre 700 et 1100 mots environ, selon la matière disponible. Pas d'emojis.
- Une accroche de 2 ou 3 phrases qui pose la tension, sans intertitre avant.
- 3 à 5 parties avec des intertitres courts (lignes qui commencent par "## ").
- Mise en forme autorisée : "## Intertitre", "**gras**" (avec parcimonie), "*italique*", "> citation", "- liste", "[texte](https://lien)". Une ligne vide entre deux paragraphes. Pas de titre principal dans le texte.
- La dernière partie donne mon avis, sans intertitre « Conclusion ».
- Mon article de référence est donné plus bas : reprends sa construction (accroche par un détail concret qui surprend, intertitres courts, faits précis, phrases-choc d'une ligne, dernière partie avec mon avis et une vraie interrogation), sa longueur et son ton, sans reprendre son sujet ni ses phrases.

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
(une par ligne au format "Titre | https://lien", uniquement des liens présents dans mon brouillon ou mes notes ; laisse vide sinon)
=== POST LINKEDIN ===
(le post LinkedIn qui accompagne CET article, écrit à partir de l'article que tu viens de rédiger, selon les règles « Post LinkedIn » ci-dessous)`;

/* Règles du post, réutilisées quand l'article et le post sont rédigés ensemble */
const POST_RULES = `Règles « Post LinkedIn » :
- Le post reprend l'idée centrale de l'article, son angle et un ou deux de ses faits les plus forts, et donne envie de le lire. Rien qui ne soit pas dans l'article.
- Entre 700 et 1300 caractères environ.
- Une première ligne courte et affirmative qui bouscule une idée reçue, puis une deuxième ligne qui la retourne.
- Des paragraphes très courts (1 à 3 lignes) séparés par une ligne vide. Texte brut : pas de Markdown, pas de gras, pas de titres, pas de hashtags.
- Une phrase-choc qui résume l'idée en une ligne.
- 2 ou 3 emojis au plus, placés en fin de ligne, jamais au début du post.
- Avant-dernier paragraphe : « J'ai regardé… » ou équivalent, qui présente ce que l'article explore.
- Dernière ligne : « Retrouvez le lien de l'article dans les commentaires 👇 ».
- Ma référence : mon article sur Decathlon et le post que j'en ai tiré (donnés plus bas). Fais la même transformation article → post, sans reprendre leurs phrases ni leur sujet.`;

const LINKEDIN_RULES = `Rédige le post LinkedIn qui accompagne mon article (donné plus bas dans <mon_article>).

- L'article est la matière principale : le post reprend son idée centrale, son angle et un ou deux de ses faits les plus forts, et donne envie de le lire. N'invente rien qui ne soit pas dans l'article.
- Entre 700 et 1300 caractères environ.
- Une première ligne courte et affirmative qui bouscule une idée reçue, puis une deuxième ligne qui la retourne.
- Des paragraphes très courts (1 à 3 lignes) séparés par une ligne vide. Texte brut : pas de Markdown, pas de gras, pas de titres, pas de hashtags.
- Une phrase-choc qui résume l'idée en une ligne.
- 2 ou 3 emojis au plus, placés en fin de ligne, jamais au début du post.
- Avant-dernier paragraphe : « J'ai regardé… » ou équivalent, qui présente ce que l'article explore.
- Dernière ligne : « Retrouvez le lien de l'article dans les commentaires 👇 » (le lien n'est pas dans le post, je le mets en commentaire).

Ma référence, c'est mon article sur Decathlon et le post LinkedIn que j'en ai tiré (il a très bien marché) : ils sont donnés plus bas. Fais avec mon nouvel article exactement la même transformation article → post (accroche, choix des faits, rythme, longueur, emojis, fin), sans reprendre leurs phrases ni leur sujet.

Réponds UNIQUEMENT avec le texte du post, prêt à copier, sans phrase avant ou après.`;

const refArticle = () => `<article_reference titre="${REF_ARTICLE.title}">\nChapô : ${REF_ARTICLE.excerpt}\n\n${REF_ARTICLE.body}\n\nQuestion de fin : ${REF_ARTICLE.question}\n</article_reference>`;

export function buildPrompt(mode, { title, pillar, draft, notes, article = {} }) {
  if (mode === "article") {
    const parts = [VOICE, ARTICLE_RULES, POST_RULES, refArticle(), `<post_reference>\n${REF_POST}\n</post_reference>`];
    if (title) parts.push(`<titre_du_contenu>${title}</titre_du_contenu>`);
    if (pillar) parts.push(`<thematique>${pillar}</thematique>`);
    if (draft) parts.push(`<brouillon>\n${draft}\n</brouillon>`);
    if (notes) parts.push(`<notes>\n${notes}\n</notes>`);
    return parts.join("\n\n");
  }
  // Post LinkedIn : la référence (article → post Decathlon), puis MON article
  const parts = [VOICE, LINKEDIN_RULES, refArticle(), `<post_reference>\n${REF_POST}\n</post_reference>`];
  if (article.body) {
    parts.push(`<mon_article titre="${title || ""}">\n${article.excerpt ? `Chapô : ${article.excerpt}\n\n` : ""}${article.body}${article.question ? `\n\nQuestion de fin : ${article.question}` : ""}\n</mon_article>`);
    if (draft) parts.push(`<brouillon_initial_pour_contexte>\n${draft}\n</brouillon_initial_pour_contexte>`);
  } else {
    // pas encore d'article : le brouillon en tient lieu
    if (title) parts.push(`<titre>${title}</titre>`);
    parts.push(`<mon_article>\n(pas encore rédigé : pars de mon brouillon)\n${draft || ""}\n</mon_article>`);
  }
  if (notes) parts.push(`<notes>\n${notes}\n</notes>`);
  return parts.join("\n\n");
}
const KEYS = { TITRE: "title", ADRESSE: "slug", CHAPO: "excerpt", "CHAPÔ": "excerpt", TEXTE: "body", QUESTION: "question", SOURCES: "sources", "POST LINKEDIN": "post", POST: "post" };

/* Découpe la réponse collée ; si les repères manquent, tout part dans le texte de l'article */
export function parseArticle(raw) {
  const text = String(raw || "").replace(/\r\n/g, "\n").replace(/^```[a-z]*\n|\n```\s*$/g, "");
  const out = { title: "", slug: "", excerpt: "", body: "", question: "", sources: "", post: "" };
  const re = /^[#*\s]*={2,}\s*([A-ZÀ-Üa-zà-ü][A-ZÀ-Üa-zà-ü ]*?)\s*={2,}[*\s]*$/gm;
  const key = (m) => KEYS[m[1].toUpperCase().replace(/\s+/g, " ")];
  const marks = [...text.matchAll(re)].filter(key);
  if (!marks.length) { out.body = text.trim(); return out; }
  marks.forEach((m, i) => {
    const end = i + 1 < marks.length ? marks[i + 1].index : text.length;
    out[key(m)] = text.slice(m.index + m[0].length, end).trim();
  });
  out.slug = out.slug.replace(/^.*\/articles\//, "").replace(/[()]/g, "").trim();
  return out;
}

export function cleanPost(raw) {
  return String(raw || "").replace(/\r\n/g, "\n").replace(/^```[a-z]*\n|\n```\s*$/g, "").trim();
}
