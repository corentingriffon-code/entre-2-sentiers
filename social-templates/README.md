# Templates visuels sociaux — Entre 2 sentiers

4 formats réutilisables pour promouvoir un article sur Instagram, LinkedIn et Facebook. Même palette et mêmes polices que le site (`css/style.css`), traitement "carnet de terrain" (grain, papier découpé, badges, photo en duotone, annotations pointillées), canevas de référence 1080×1080 (post carré), compatible tel quel sur IG/FB et recadrable en 1200×627 pour LinkedIn.

## Les 4 formats

| Fichier | Usage | Quand l'utiliser |
|---|---|---|
| `titre.html` | Gros titre sur fond sable, pas de photo | Par défaut, pour annoncer n'importe quel article |
| `photo-bandeau.html` | Photo de l'article + dégradé sombre + titre, comme le bloc featured du site | Quand l'article a une bonne photo de couverture |
| `citation.html` | Une phrase forte en écriture (Caveat), sur fond uni | Quand l'article contient une citation ou une idée qui se suffit à elle-même |
| `chiffre-cle.html` | Un chiffre en très gros avec sa légende | Quand l'article a une statistique marquante |

Chacun est livré rempli avec un exemple réel (un article déjà publié) — dupliquez le fichier et changez le texte/l'image/le tag pour le prochain article.

## Comment adapter un template à un nouvel article

1. Dupliquer le fichier concerné (ex. `cp titre.html mon-nouvel-article.html`).
2. Changer le texte du `<span class="tag ...">` — reprendre la même classe (`comprendre`, `creer` ou `partager`) et le même libellé que sur `actualites.html` pour cet article.
3. Changer le titre / la citation / le chiffre.
4. Pour `photo-bandeau.html` : remplacer `background-image: url('../assets/XXX-featured.jpg')` par la photo featured de l'article.
5. Exporter en PNG à 1080×1080 (voir ci-dessous).

## Exporter en PNG

Servir le dossier du site en local puis capturer avec Playwright (même méthode que pour les contrôles QA du site) :

```bash
python3 -m http.server 8099   # depuis la racine du repo
```

```js
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1080, height: 1080 } });
  await page.goto('http://localhost:8099/social-templates/titre.html', { waitUntil: 'networkidle' });
  await page.screenshot({ path: 'titre.png' });
  await browser.close();
})();
```

Pour un recadrage LinkedIn (1200×627), changer la largeur/hauteur du viewport et du `.canvas` dans le fichier avant la capture — le contenu est centré par flexbox donc il se recadre proprement.

## Contenu des exemples fournis

- `titre.html` — « L'écologie dans le trail est-elle vraiment une question binaire ? »
- `photo-bandeau.html` — « Une marque doit-elle avoir un lien avec le sport qu'elle sponsorise ? » (photo onlyfans-snowboard-featured.jpg)
- `citation.html` — citation extraite de « Et si les bénévoles étaient l'UX d'un événement sportif ? »
- `chiffre-cle.html` — 18 600 tonnes de CO₂e, bilan carbone 2024 du HOKA UTMB® Mont-Blanc, extrait de « L'écologie dans le trail est-elle vraiment une question binaire ? »
