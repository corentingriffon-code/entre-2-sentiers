# Entre 2 sentiers

Site du projet **Entre 2 sentiers** — marketing, communication et récits outdoor, entre trail, photo et stratégie de marque.

Site statique en HTML / CSS / JS, sans build ni dépendance : chaque page se modifie directement dans son fichier `.html`.

## Structure

```
index.html          Accueil (manifeste court + piliers + derniers articles)
blog.html            Liste des réflexions (filtrable par pilier)
a-propos.html        Manifeste complet, parcours, écosystème LinkedIn/TikTok/Instagram
portfolio.html        Grille photo (emplacements à remplir)
contact.html          Contact + liens réseaux
articles/*.html      Les articles individuels
css/style.css         Design system (couleurs, typos, composants)
js/main.js             Menu mobile + filtre du blog
assets/favicon.svg     Favicon
```

## À personnaliser avant mise en ligne

- **Liens réseaux sociaux** : dans `contact.html` (et les blocs footer de chaque page), remplace les URL placeholder :
  - `https://www.linkedin.com/in/TON-PROFIL-LINKEDIN`
  - `https://www.tiktok.com/@entre2sentiers`
  - `https://www.instagram.com/entre2sentiers`
- **Adresse mail de contact** : `bonjour@entre2sentiers.fr` dans `contact.html`.
- **Photos** : `portfolio.html` contient des emplacements réservés (`photo-slot`). Remplace chaque `<div class="photo-slot ...">` par une balise `<img>` pointant vers tes photos une fois disponibles. Fais de même pour les bandeaux `card-media` des articles si tu veux y ajouter de vraies images.
- **Nom d'auteur** : `a-propos.html` utilise le prénom Corentin — à ajuster si besoin.
- **Domaine** : `robots.txt` et `sitemap.xml` référencent `entre2sentiers.fr` à titre d'exemple, à adapter au nom de domaine réel.

## Identité visuelle

- Couleurs : vert forêt (`#2f3b23`), kaki (`#7c7a4e`), moutarde (`#f0b429`), crème (`#f6f1e4`), terracotta (`#c1594b`) — reprises de ton moodboard.
- Typographies (Google Fonts) : `Caveat` pour la signature/logo manuscrit, `Bebas Neue` pour les titres façon affiche de course, `Work Sans` pour le texte courant.

## Ajouter un nouvel article

1. Duplique un fichier existant dans `articles/`.
2. Change le `<title>`, la meta `description`, le tag de pilier (`comprendre` / `creer` / `partager`) et le contenu.
3. Ajoute une carte correspondante dans `blog.html` (et éventuellement `index.html` si tu veux le mettre en avant).
4. Ajoute son URL dans `sitemap.xml`.

## Déploiement

Le site est 100% statique : il peut être déployé tel quel sur Vercel, Netlify, GitHub Pages ou tout hébergeur statique, sans étape de build.
