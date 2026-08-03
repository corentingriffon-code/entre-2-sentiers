# Entre 2 sentiers

Site du projet **Entre 2 sentiers**, marketing, communication et récits outdoor, entre trail, photo et stratégie de marque.

Site statique en HTML / CSS / JS, sans build ni dépendance : chaque page se modifie directement dans son fichier `.html`.

## Structure

```
index.html            Accueil (manifeste court + piliers + derniers articles)
blog.html              Liste des réflexions (filtrable par pilier)
actualites.html        Fil de posts (embeds LinkedIn officiels)
a-propos.html          Manifeste complet, parcours, écosystème LinkedIn/TikTok/Instagram
portfolio.html          Grille photo (emplacements à remplir)
contact.html            Contact + liens réseaux
articles/*.html        Les articles individuels
css/style.css           Design system (couleurs, typos, composants)
js/main.js               Menu mobile + filtre du blog
assets/favicon.svg       Favicon
assets/fonts/             Polices auto-hébergées (Caveat, Bebas Neue, Work Sans)
assets/hero-bg.jpg        Photo de fond du hero d'accueil (à fournir, voir plus bas)
```

## À personnaliser avant mise en ligne

- **Liens réseaux sociaux** : dans `contact.html` (et les blocs footer de chaque page), remplace les URL placeholder :
  - `https://www.linkedin.com/in/TON-PROFIL-LINKEDIN`
  - `https://www.tiktok.com/@entre2sentiers`
  - `https://www.instagram.com/entre2sentiers`
- **Adresse mail de contact** : `bonjour@entre2sentiers.fr` dans `contact.html`.
- **Photos** : `portfolio.html` contient des emplacements réservés (`photo-slot`). Remplace chaque `<div class="photo-slot ...">` par une balise `<img>` pointant vers tes photos une fois disponibles. Fais de même pour les bandeaux `card-media` des articles si tu veux y ajouter de vraies images.
- **Photo de fond du hero** : dépose un fichier `assets/hero-bg.jpg` (photo large format, format paysage) ; le hero de `index.html` l'utilise automatiquement en fond avec un dégradé sombre par-dessus. Sans fichier, un dégradé vert uni s'affiche à la place, rien n'est cassé.
- **Nom d'auteur** : `a-propos.html` utilise le prénom Corentin, à ajuster si besoin.
- **Domaine** : `robots.txt` et `sitemap.xml` référencent `entre2sentiers.fr` à titre d'exemple, à adapter au nom de domaine réel.

## Identité visuelle

- Couleurs (4, pas plus) : sable `#d7c9ac`, sauge `#bdc3a9`, vert sombre `#1d261e`, vert lime `#9faf6b`. Ce sont des versions désaturées des couleurs fournies par l'utilisateur, pour un rendu moins flashy.
- Typographies (auto-hébergées, voir `assets/fonts/`) : `Caveat` pour la signature/logo manuscrit, `Bebas Neue` pour les titres façon affiche de course, `Work Sans` pour le texte courant.

## Ajouter un nouvel article

1. Duplique un fichier existant dans `articles/`.
2. Change le `<title>`, la meta `description`, le tag de pilier (`comprendre` / `creer` / `partager`) et le contenu.
3. Ajoute une carte correspondante dans `blog.html` (et éventuellement `index.html` si tu veux le mettre en avant).
4. Ajoute son URL dans `sitemap.xml`.

## Ajouter un nouveau post sur la page Actualités

La page `actualites.html` affiche tes publications LinkedIn via le système d'intégration officiel de LinkedIn (pas d'API, pas de scraping, donc rien à maintenir côté technique) :

1. Sur LinkedIn, ouvre ton post publié.
2. Clique sur "···" en haut à droite du post, puis choisis **"Intégrer cette publication"**.
3. Copie le code `<iframe>` fourni par LinkedIn.
4. Dans `actualites.html`, ajoute un nouveau bloc tout en haut de `<div class="news-feed">` :
   ```html
   <div class="post-embed">
     <!-- coller ici le code iframe fourni par LinkedIn -->
   </div>
   ```
5. Le plus récent doit être placé en premier (en haut du fil).

Cette méthode affiche le vrai post LinkedIn (likes, commentaires à jour), mais chaque nouveau post doit être ajouté manuellement, il n'existe pas d'API publique permettant de synchroniser un profil personnel LinkedIn automatiquement.

## Déploiement

Le site est 100% statique : il peut être déployé tel quel sur Vercel, Netlify, GitHub Pages ou tout hébergeur statique, sans étape de build.
