# Entre 2 sentiers

Site du projet **Entre 2 sentiers**, marketing, communication et récits outdoor, entre trail, photo et stratégie de marque.

Site statique en HTML / CSS / JS, sans build ni dépendance : chaque page se modifie directement dans son fichier `.html`.

## Structure

```
index.html            Accueil (manifeste court + piliers + derniers articles)
blog.html              Liste des réflexions (filtrable par pilier)
a-propos.html          Manifeste complet, parcours, écosystème LinkedIn/TikTok/Instagram
portfolio.html          Grille photo (emplacements à remplir)
contact.html            Contact + liens réseaux
articles/*.html        Les articles individuels
css/style.css           Design system (couleurs, typos, composants)
js/main.js               Menu mobile + filtre du blog
assets/favicon.svg       Favicon
assets/fonts/             Polices auto-hébergées (Caveat, Bebas Neue, Work Sans)
assets/hero-bg.jpg        Photo de fond du hero d'accueil
```

## À personnaliser avant mise en ligne

- **Adresse mail de contact** : `bonjour@entre2sentiers.fr` dans `contact.html` est un placeholder, à remplacer par une vraie adresse.
- **Photos** : `portfolio.html` contient des emplacements réservés (`photo-slot`). Remplace chaque `<div class="photo-slot ...">` par une balise `<img>` pointant vers tes photos une fois disponibles. Fais de même pour les bandeaux `card-media` des articles si tu veux y ajouter de vraies images.
- **Photo de fond du hero** : dépose un fichier `assets/hero-bg.jpg` (photo large format, format paysage) ; le hero de `index.html` l'utilise automatiquement en fond avec un dégradé sombre par-dessus. Sans fichier, un dégradé vert uni s'affiche à la place, rien n'est cassé.
- **Nom d'auteur** : `a-propos.html` utilise le prénom Corentin, à ajuster si besoin.
- **Domaine** : `robots.txt` et `sitemap.xml` référencent `entre2sentiers.fr` à titre d'exemple, à adapter au nom de domaine réel.

## Identité visuelle

- Couleurs (4, pas plus) : sable `#d7c9ac`, sauge `#bdc3a9`, vert sombre `#1d261e`, vert lime `#9faf6b`. Ce sont des versions désaturées des couleurs fournies par l'utilisateur, pour un rendu moins flashy.
- Typographies (auto-hébergées, voir `assets/fonts/`) : `Caveat` pour la signature/logo manuscrit, `Bebas Neue` pour les titres façon affiche de course, `Work Sans` pour le texte courant.

## Ajouter un nouvel article

1. Duplique un fichier existant dans `articles/`.
2. Change le `<title>`, la meta `description`, le pilier (tag + tone parmi les 6 : territoires, marques, evenements, environnement, photo, personnes) et le contenu.
3. Sur `actualites.html` (et `en/news.html` pour l'anglais) : le nouvel article devient la nouvelle "Dernière actualité" (bloc `.featured-article`, en haut de page, avec un attribut `data-meta="X min de lecture"` sur ce lien), et l'ancien featured redescend en première position de la grille `.article-grid` juste en dessous. Le reste de la grille reste trié du plus récent au plus ancien.
4. Ajoute son URL dans `sitemap.xml`.
5. Rien à faire sur `index.html` / `en/index.html` : le bloc "Sur le fil" de l'accueil se resynchronise tout seul en JS au chargement de la page (`js/main.js`, via `[data-latest-source]`), en relisant `actualites.html` / `en/news.html` pour afficher automatiquement les 3 articles les plus récents (featured + les 2 premiers de la grille). Le contenu statique déjà présent dans `index.html` sert uniquement de repli si JS est indisponible : il vaut mieux le garder à jour, mais ce n'est plus obligatoire pour que le site affiche les bons articles.

## Déploiement

Le site est 100% statique : il peut être déployé tel quel sur Vercel, Netlify, GitHub Pages ou tout hébergeur statique, sans étape de build.

## Camp de base (outil éditorial gamifié)

`camp-de-base/` est un outil privé pour piloter la publication, pas une page du site : il n'est lié nulle part, il est exclu de l'indexation (`robots.txt`, meta `noindex`, en-tête `X-Robots-Tag`) et il s'ouvre sur `/camp-de-base`.

- **Sentier (3D)** : une montagne low-poly ; chaque contenu est une balise le long du sentier, dans l'ordre chronologique (drapeau vert = publié, drapeau blanc = programmé, cairn = prêt / en rédaction, bille = idée). Les petites pierres colorées au pied d'un drapeau indiquent les réseaux. Le coureur se tient sur la dernière publication ; le drapeau du sommet est l'objectif. Clic sur une balise = ouvrir le contenu.
- **Planning** : calendrier mensuel. Glisser un contenu prêt sur un jour pour le programmer, glisser une publication pour la déplacer, cliquer sur un numéro de jour pour programmer ce jour-là.
- **Contenus** : tableau Idée → En rédaction → Prêt → Publié, avec texte du post (compteur de caractères par réseau) et notes.
- **Stats** : une vue d'ensemble, puis une page par canal.
  - *Site* : relevé hebdomadaire des visiteurs et pages vues (chiffres lus dans Google Analytics), courbe par semaine, articles les plus lus (vues saisies dans la fiche de chaque article).
  - *LinkedIn / Instagram / Facebook* : relevés d'abonnés et leur évolution, impressions, taux d'engagement, meilleure publication, tableau des publications du réseau.
- **Mémo** : tâches (échéance, contenu lié, affichées aussi dans le planning) et notes de couleur modifiables directement.
- **Trophées** : altitude (« mètres de D+ ») gagnée à chaque étape, paliers du parking au sommet, défis hebdomadaires (objectif d'articles réglable dans le menu ⋯), série de semaines, trophées.

Les données sont dans le `localStorage` du navigateur (clé `e2s-camp-de-base-v1`) : elles ne sont ni envoyées ni partagées, et ne suivent pas d'un appareil à l'autre. Utiliser **⋯ → Exporter** pour garder une sauvegarde `.json` (et **Importer** pour la recharger ailleurs). Les données de départ (`camp-de-base/js/data.js`) reprennent les articles publiés, les articles prêts et le backlog d'`EDITORIAL.md` au 14/10/2026.

La 3D utilise three.js 0.186.1, copié minifié dans `camp-de-base/vendor/` (la CSP du site n'autorise que les scripts servis par le site lui-même).
