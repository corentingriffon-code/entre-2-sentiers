# Brancher le Camp de base sur Google Analytics et Instagram

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
