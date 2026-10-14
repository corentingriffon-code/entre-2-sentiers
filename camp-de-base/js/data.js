/* =========================================================
   Camp de base. Données de départ
   Reprend l'état du site et d'EDITORIAL.md au 14/10/2026 :
   articles publiés (avec leur datePublished), articles prêts, backlog d'idées.
   Aucune statistique n'est inventée : les compteurs partent à zéro.
   ========================================================= */

export const NETWORKS = {
  site: { label: "Site", short: "Site", color: "#5d7a1c" },
  linkedin: { label: "LinkedIn", short: "in", color: "#1f6fb2" },
  instagram: { label: "Instagram", short: "IG", color: "#c23d6e" },
  facebook: { label: "Facebook", short: "fb", color: "#b8761a" },
};
export const NETWORK_ORDER = ["site", "linkedin", "instagram", "facebook"];
export const SOCIALS = ["linkedin", "instagram", "facebook"];

export const PILLARS = {
  territoires: "Territoires",
  marques: "Marques",
  evenements: "Événements",
  environnement: "Environnement",
  photo: "Photo",
  personnes: "Personnes",
};

export const KINDS = {
  article: "Article",
  post: "Post",
  carrousel: "Carrousel",
  video: "Reel / vidéo",
  story: "Story",
};

export const STATUSES = {
  idee: "Idée",
  redaction: "En rédaction",
  pret: "Prêt",
  publie: "Publié",
};

// Limites de caractères indicatives par réseau (texte du post)
export const CHAR_LIMITS = { linkedin: 3000, instagram: 2200, facebook: 63206 };

export const STAT_FIELDS = [
  ["impressions", "Impressions"],
  ["likes", "Réactions"],
  ["comments", "Commentaires"],
  ["shares", "Partages"],
  ["saves", "Enregistr."],
  ["clicks", "Clics"],
];

const published = [
  ["2026-08-03", "chercher-un-emploi-chercher-un-dossard", "Chercher un emploi, c'est comme chercher un dossard", "personnes"],
  ["2026-08-03", "organiser-une-course-cest-faire-du-marketing-avant-de-faire-du-sport", "Organiser une course, c'est déjà faire du marketing", "evenements"],
  ["2026-08-03", "pas-besoin-dun-ultra-pour-aimer-courir", "Pas besoin d'un ultra pour aimer courir", "personnes"],
  ["2026-08-04", "lutmb-doit-il-continuer-a-grandir", "L'UTMB doit-il continuer à grandir ?", "evenements"],
  ["2026-08-06", "les-territoires-touristiques-courent-apres-les-traileurs", "Les territoires courent après les traileurs", "territoires"],
  ["2026-08-23", "qui-sera-le-grand-gagnant-utmb-2026", "Qui sera le grand gagnant de l'UTMB 2026 ?", "marques"],
  ["2026-08-26", "les-marques-ne-devraient-pas-regarder-que-le-podium", "Le pratiquant amateur, angle mort du marketing sportif", "marques"],
  ["2026-09-02", "le-sponsoring-sportif-logo-ou-histoire", "Sponsoring sportif : logo ou histoire ?", "marques"],
  ["2026-09-03", "marques-outdoor-menacees-par-le-changement-climatique", "Climat : les marques outdoor menacées ?", "environnement"],
  ["2026-09-14", "benevoles-ux-evenement-sportif", "Et si les bénévoles étaient l'UX d'un événement sportif ?", "evenements"],
  ["2026-09-18", "ecologie-dans-le-trail-question-binaire", "L'écologie dans le trail est-elle binaire ?", "environnement"],
  ["2026-09-28", "marques-outdoor-partout-sans-publicite", "Pourquoi ces marques outdoor ne font jamais de pub ?", "marques"],
  ["2026-10-02", "marque-sponsor-sans-lien-avec-le-sport", "Une marque doit-elle avoir un lien avec le sport ?", "marques"],
  ["2026-10-08", "ce-que-le-community-management-pourrait-apprendre-du-trail", "Ce que le community management apprend du trail", "personnes"],
  ["2026-10-12", "decathlon-ne-signe-plus-des-athletes-mais-des-experts", "Chez Decathlon, on ne signe plus des athlètes, on signe des experts", "marques"],
];

const ready = [
  ["la-photo-de-course-outil-marketing-sous-estime", "La photo de course, outil marketing sous-estimé", "photo", ""],
  ["le-brief-marketing-cache-derriere-chaque-dossard", "Le brief marketing caché derrière chaque dossard", "evenements", ""],
  ["pourquoi-lutmb-est-devenu-une-machine-marketing", "Pourquoi l'UTMB est une machine marketing mondiale", "evenements", ""],
  ["sponsoring-sportif-marques-improbables", "Dacia, McDonald's, Martini : le sponsoring sportif n'importe quoi ?", "marques", "En attente du feu vert."],
];

const ideas = [
  ["Une chaussure peut-elle vraiment être pensée pour être recyclée ?", "environnement", ""],
  ["Acheter éthique, c'est réservé aux riches ?", "environnement", "Exemple : le vrai coût (matière, main-d'œuvre) d'un gilet polaire à 15 €, comparé à une pièce équivalente chez une marque engagée."],
  ["Les marques sont-elles vraiment responsables ?", "marques", "Discours écologique vs conditions de production. Semelles biosourcées : vraie avancée ou argument ? Vérifier où en est la Green Claims Directive."],
  ["Pourquoi un dossard qui se vend en 3 minutes est un coup de marketing", "evenements", "La rareté organisée (inscriptions limitées, tirage au sort) comme mécanique volontaire."],
  ["Le marketing outdoor a besoin que vous ayez peur de rater quelque chose", "marques", "Le FOMO comme structure : derniers dossards, compte à rebours, éditions historiques."],
  ["Pourquoi personne ne sponsorise les bénévoles", "personnes", "Suite logique de l'article sur les bénévoles."],
  ["Et si le vrai sponsor d'un coureur amateur, c'était son entourage ?", "personnes", "Temps, logistique, garde des enfants : qui finance vraiment la pratique ?"],
  ["Le sponsoring sportif a un angle mort : tout ce qui se passe avant le dossard", "marques", "Sommeil (Emma, Dodow), nutrition, gestion du stress : les catégories invisibles de la performance."],
  ["Le dossard comme abonnement : et si les courses fonctionnaient comme Netflix ?", "evenements", "Indice UTMB, points de qualification, séries d'épreuves."],
  ["Les marques vendent la déconnexion, mais vivent de votre connexion", "marques", "Le paradoxe du « déconnectez-vous » poussé via Instagram et les notifications."],
  ["Et si la quête du record n'était plus une question de performance, mais de marketing ?", "personnes", "Culture FKT et controverses sécurité, âge minimum pour l'Everest. Vérifier les sources avant usage."],
  ["Le vrai réseau social du coureur n'est pas une application, c'est son t-shirt", "personnes", "Prolonge l'article community management côté objet."],
];

const SITE_URL = "https://entre2sentiers.com/articles/";

export function seedState() {
  const contents = [];
  const pubs = [];
  let n = 0;
  const id = (p) => `${p}${(++n).toString(36)}`;

  published.forEach(([date, slug, title, pillar]) => {
    const cid = id("c");
    contents.push({ id: cid, title, kind: "article", pillar, status: "publie", slug, notes: "", text: "", createdAt: date });
    pubs.push({ id: id("p"), contentId: cid, network: "site", date, time: "", status: "publie", url: SITE_URL + slug, stats: {}, statsAt: null });
  });
  ready.forEach(([slug, title, pillar, notes]) => {
    contents.push({ id: id("c"), title, kind: "article", pillar, status: "pret", slug, notes, text: "", createdAt: "2026-08-27" });
  });
  ideas.forEach(([title, pillar, notes]) => {
    contents.push({ id: id("c"), title, kind: "article", pillar, status: "idee", slug: "", notes, text: "", createdAt: "2026-10-05" });
  });

  return { version: 1, contents, pubs, settings: { weeklyGoal: 2 }, seenBadges: null, seenLevel: null };
}
