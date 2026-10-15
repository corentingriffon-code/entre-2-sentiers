# Brancher le Camp de base (Google Analytics, Instagram, publication, synchro, rédaction par Claude)

Le Camp de base lit tes chiffres à travers deux petites fonctions hébergées sur Vercel (`api/camp/site.js` et `api/camp/instagram.js`). Les clés ne sont jamais dans la page : elles vivent dans les **variables d'environnement** du projet Vercel.

Une fois branché, la synchro se fait toute seule à l'ouverture (au plus toutes les 6 heures), ou avec le bouton **↻ Synchroniser** de l'onglet Stats. LinkedIn et Facebook (profil perso) restent en saisie manuelle : ces plateformes ne donnent pas accès aux statistiques de ce type de compte.

Les intitulés des consoles Google et Meta changent de temps en temps : si un bouton n'a pas exactement ce nom, cherche le plus proche.

---

## 1. Le site (Google Analytics 4) : environ 10 minutes

**A. Créer un « compte de service » (un robot qui a le droit de lire tes stats)**

1. Va sur https://console.cloud.google.com et connecte-toi avec le compte Google de ton Analytics.
2. En haut, crée un projet (par exemple `camp-de-base`).
3. Menu ☰ → **API et services** → **Bibliothèque** → cherche **Google Analytics Data API** → **Activer**.
4. Menu ☰ → **IAM et administration** → **Comptes de service** → **Créer un compte de service** → nom `camp-de-base` → **OK** (pas besoin de rôle).
5. Clique sur le compte créé → onglet **Clés** → **Ajouter une clé** → **Créer une clé** → **JSON**. Un fichier se télécharge : garde-le pour toi, ne l'envoie à personne.

**B. Donner l'accès au robot dans Google Analytics**

1. Va sur https://analytics.google.com → ⚙️ **Administration**.
2. Colonne Propriété → **Gestion des accès à la propriété** → **+** → **Ajouter des utilisateurs**.
3. Colle l'adresse du robot (elle finit par `@...iam.gserviceaccount.com`, tu la trouves dans le fichier JSON à la ligne `client_email`) → rôle **Lecteur** → **Ajouter**.
4. Toujours dans Administration → **Détails de la propriété** : note l'**ID de propriété** (une suite de chiffres).

**C. Donner les clés à Vercel**

Sur https://vercel.com → projet **entre-2-sentiers** → **Settings** → **Environment Variables**, ajoute (en cochant *Production* et *Preview*) :

| Nom | Valeur |
|---|---|
| `GA_PROPERTY_ID` | l'ID de propriété (chiffres) |
| `GA_CLIENT_EMAIL` | la valeur de `client_email` du fichier JSON |
| `GA_PRIVATE_KEY` | la valeur de `private_key` du fichier JSON (tout le bloc, de `-----BEGIN` à `END PRIVATE KEY-----`) |

**Plus simple** : au lieu de `GA_CLIENT_EMAIL` et `GA_PRIVATE_KEY`, tu peux créer une seule variable `GA_SERVICE_ACCOUNT` et y coller **tout le contenu du fichier JSON** (ouvre-le avec le Bloc-notes, Ctrl+A, Ctrl+C). Supprime alors les deux autres pour éviter les mélanges.

Puis **Deployments** → sur le dernier déploiement, **⋯ → Redeploy** pour que les variables soient prises en compte.

**Si la puce affiche « erreur »** :
- *account not found* : l'adresse du robot est fausse (faute de frappe, ton adresse perso à la place de celle du robot, robot supprimé) ou vient d'un autre fichier que la clé. Le plus sûr : utiliser `GA_SERVICE_ACCOUNT` avec tout le fichier.
- *Invalid JWT signature* : la clé privée ne correspond pas au robot. Recrée une clé et recolle-la.
- *User does not have sufficient permissions* : le robot n'a pas été invité en Lecteur dans Google Analytics (étape B), ou l'ID de propriété est faux.

---

## 2. Instagram (compte professionnel) : environ 10 minutes

1. Va sur https://developers.facebook.com → **Mes apps** → **Créer une app**.
2. Choisis le cas d'usage qui parle d'**Instagram** (gérer les messages et le contenu sur Instagram), type **Entreprise**, puis termine la création.
3. Dans l'app : **Instagram** → **Configuration de l'API avec connexion Instagram**.
4. Section **Générer des tokens d'accès** → **Ajouter un compte** → connecte ton compte Instagram pro → **Générer le token**. Vérifie que les autorisations `instagram_business_basic` et `instagram_business_manage_insights` sont bien incluses.
5. Copie le token (une longue suite de lettres et de chiffres).
6. Sur Vercel → **Settings** → **Environment Variables** → ajoute `IG_ACCESS_TOKEN` avec ce token (*Production* et *Preview*), puis **Redeploy**.

Pas besoin de faire valider l'app par Meta : tant que c'est ton propre compte, le mode développement suffit.

**Tous les 60 jours environ**, le token expire : le Camp de base affiche alors « Instagram · erreur ». Il suffit de refaire l'étape 4 et de remplacer `IG_ACCESS_TOKEN` sur Vercel (puis Redeploy).

---

## Ce qui se remplit tout seul

- **Site** : visiteurs et pages vues par semaine (16 dernières semaines), vues de chaque article sur 12 mois.
- **Instagram** : nombre d'abonnés (un relevé par jour de synchro) et, pour les 40 dernières publications : vues, réactions, commentaires, partages, enregistrements.
  - Une publication Instagram déjà présente dans le Camp de base est reconnue par son lien, ou par sa date si elle était programmée.
  - Une publication faite en dehors du Camp de base est ajoutée automatiquement (marquée « Importé depuis Instagram »).
- Les données importées **ne rapportent pas de D+** : seules tes actions en rapportent (écrire, programmer, publier, relever LinkedIn et Facebook…).

## Confidentialité

Le Camp de base n'est lié nulle part et n'est pas indexé par les moteurs de recherche, mais il n'a pas de mot de passe : quelqu'un qui connaît l'adresse peut l'ouvrir et voir les chiffres renvoyés par `/api/camp/site` et `/api/camp/instagram`. Tes contenus, tâches et notes, eux, restent dans ton navigateur. Les clés Google et Instagram ne sont jamais envoyées à la page.

---

## 3. Publier les articles sur le site depuis le Camp de base : environ 5 minutes

Le bouton **🚀 Publier sur le site** (dans la fiche d'un contenu de format « Article ») dépose l'article sur GitHub ; Vercel le met en ligne tout seul environ une minute plus tard. Il faut deux variables.

**A. Une clé GitHub limitée à ton site**

1. Va sur https://github.com/settings/personal-access-tokens/new (GitHub → ta photo → **Settings** → **Developer settings** → **Personal access tokens** → **Fine-grained tokens** → **Generate new token**).
2. **Token name** : `camp-de-base`. **Expiration** : 1 an (note la date dans ton Mémo pour la renouveler).
3. **Repository access** → **Only select repositories** → choisis **entre-2-sentiers**.
4. **Permissions** → **Repository permissions** → **Contents** → **Read and write**. Ne touche à rien d'autre.
5. **Generate token**, puis copie la clé (elle commence par `github_pat_`). Elle ne s'affiche qu'une fois.

**B. Les deux variables sur Vercel** (*Settings → Environment Variables*, case *Production* cochée)

| Nom | Valeur |
|---|---|
| `GITHUB_TOKEN` | la clé GitHub copiée |
| `PUBLISH_CODE` | un code que tu inventes (par exemple une phrase de passe) : il sera demandé à la première publication, puis ton navigateur s'en souvient |

Puis **Deployments → ⋯ → Redeploy**.

Le code de publication est important : le Camp de base n'a pas de mot de passe, c'est ce code qui empêche quelqu'un d'autre de publier sur ton site.

**Ce que fait la publication**
- crée `articles/<adresse>.html` avec la mise en page des autres articles, et la photo de une dans `assets/` ;
- met l'article en « Dernière actualité » sur la page Actualités (l'ancienne descend en tête de la grille) ;
- l'ajoute au plan du site (`sitemap.xml`) ; l'accueil se met à jour tout seul.
- « Mettre à jour sur le site » republie un article créé depuis le Camp de base. Un article écrit avant le Camp de base n'est jamais écrasé.
- La version anglaise n'est pas créée automatiquement.

---

## 4. Retrouver les mêmes données sur tous tes appareils : environ 3 minutes

Sans cette étape, chaque ordinateur garde ses propres données (contenus, tâches, notes, stats saisies). Avec elle, tout est enregistré en ligne quelques secondes après chaque modification, et chaque appareil récupère la dernière version à l'ouverture.

**A. Ajouter la base de données (gratuite)**

1. Sur https://vercel.com → projet **entre-2-sentiers** → onglet **Storage**.
2. **Create Database** (ou **Browse Marketplace**) → choisis **Upstash** → **Redis** → offre **Free**.
3. Donne-lui un nom (`camp-de-base`), région Europe, puis **Create**.
4. À l'étape **Connect Project**, choisis **entre-2-sentiers** et coche **Production** → **Connect**. Vercel ajoute tout seul les variables `KV_REST_API_URL` et `KV_REST_API_TOKEN`.
5. **Deployments → ⋯ → Redeploy**.

Le code de publication (`PUBLISH_CODE`, déjà créé) protège l'accès à tes données : c'est lui que le Camp de base te demande.

**B. Activer la synchro (une seule fois)**

1. Ouvre le Camp de base **sur l'ordinateur qui a tes données les plus à jour**.
2. En haut, clique sur le bouton vert **☁ Activer la synchro** et confirme.
3. Sur tes autres appareils, ouvre simplement le Camp de base : ils récupèrent les données (et leurs propres ajouts sont fusionnés).

Ensuite, le petit nuage en haut indique l'état : **Synchronisé**, **Enregistrement…**, **Hors ligne** (les modifications partiront au retour du réseau). Les photos d'articles pas encore publiés restent sur l'appareil où tu les as ajoutées.

---

## 5. Faire rédiger l'article et le post LinkedIn par Claude : gratuit, rien à configurer

Dans la fiche d'un contenu, sous le **Brouillon**, il y a deux boutons : **✨ Générer un article** et **✨ Générer un post LinkedIn**.

**Fonctionnement gratuit (par défaut)**, avec un compte claude.ai gratuit et toujours la même conversation, « Rédaction pour Entre 2 sentiers » (son adresse est inscrite dans `camp-de-base/js/app.js`, constante `REDAC_URL`) :
1. Clique sur un des boutons : la demande (ton brouillon, tes notes et les consignes de style) est copiée, et ta conversation Claude s'ouvre.
2. Dans Claude, fais Ctrl+V (⌘+V) puis Entrée.
3. Quand Claude a fini, clique sur **Copier** sous sa réponse. Colle-la dans **Texte de l'article** : le titre, l'adresse, le chapô, la question et les sources se rangent tout seuls. Pour un post, colle-la dans **Texte du post LinkedIn**.

Ensuite :
- l'article se range dans « Rédaction de l'article » (texte, chapô, adresse, question de fin). La ligne **Site** s'ouvre pour choisir la date et l'heure ;
- le post se range dans la ligne **LinkedIn** (zone « Texte du post », compteur sur 3 000 caractères, bouton « Copier le texte »), avec sa date et son heure. Si l'article existe déjà, le post s'appuie dessus et met son lien.

Claude ne publie rien tout seul : tu relis, tu ajustes, puis tu publies comme d'habitude. Il a pour consigne de ne rien inventer (chiffres, citations, noms) qui ne soit pas dans ton brouillon ou tes notes. Relis quand même les faits.

**Option payante (facultative)** : pour que tout se fasse en un clic, sans copier-coller, ajoute sur Vercel une variable `ANTHROPIC_API_KEY`. La clé se crée sur https://console.anthropic.com, avec du crédit prépayé : environ 10 à 20 centimes par article. Ensuite, fais un Redeploy. Sans cette variable, le mode gratuit reste actif.
