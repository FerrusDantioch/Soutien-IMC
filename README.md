# Ma fiche

Une petite application pour téléphone qui affiche une **fiche de contact** très lisible
et qui peut la **lire à voix haute**.

La fiche contient :

- le prénom, le nom et le numéro de téléphone du conjoint (en très gros) ;
- le prénom et le nom de la personne ;
- un texte libre « Ce que je souhaite que l’on sache ».

Boutons principaux : **Écouter**, **Appeler mon conjoint**, **Plein écran**, **Réglages**
(taille du texte, vitesse de la voix, modifier la fiche).

## Confidentialité

- Aucun compte, aucun serveur, aucune publicité.
- **Rien n’est envoyé sur internet.** La fiche reste dans le téléphone (stockage `localStorage` du navigateur).
- Le code publié ne contient aucune donnée personnelle. Les exemples sont fictifs
  (« Prénom », « Nom », « 06 00 00 00 00 »).

## Contenu du dossier

| Fichier | Rôle |
| --- | --- |
| `index.html` | La structure des écrans |
| `style.css` | L’apparence (couleurs, tailles, thème clair et sombre) |
| `app.js` | Le comportement (enregistrer, lire à voix haute, réglages…) |
| `manifest.json` | Les informations pour installer l’application sur le téléphone |
| `sw.js` | Le « service worker » : il permet d’utiliser l’application sans internet |
| `icons/` | Les icônes de l’application |

## Tester sur un ordinateur

1. Ouvrir le dossier du projet.
2. Double-cliquer sur `index.html` : la page s’ouvre dans le navigateur (Chrome ou Edge conseillés).
3. Tout fonctionne, sauf le mode hors ligne et l’installation (ils demandent une vraie adresse web).

Pour tester aussi le mode hors ligne sur l’ordinateur (facultatif, Python doit être installé) :

```
python -m http.server 8000
```

Lancer cette commande dans le dossier du projet, puis ouvrir `http://localhost:8000` dans Chrome.

## Publier avec GitHub Pages

1. Sur GitHub, ouvrir le dépôt, puis **Settings** (Paramètres) → **Pages**.
2. Dans **Build and deployment**, choisir **Source : Deploy from a branch**.
3. Choisir la branche **main** et le dossier **/ (root)**, puis **Save**.
4. Attendre une à deux minutes. L’adresse du site s’affiche en haut de la page :
   `https://<nom-utilisateur>.github.io/<nom-du-depot>/`

Tous les chemins sont relatifs : l’application fonctionne dans ce sous-dossier.

## Installer sur un téléphone Android

1. Ouvrir l’adresse du site dans **Chrome**.
2. Attendre que la page soit complètement affichée (c’est à ce moment qu’elle se copie dans le téléphone).
3. Menu **⋮** (en haut à droite) → **Ajouter à l’écran d’accueil** → **Installer**.
4. L’icône « Ma fiche » apparaît sur l’écran d’accueil.

Vérifier le mode hors ligne : activer le **mode avion**, puis ouvrir « Ma fiche » depuis l’écran d’accueil.
La fiche doit s’afficher normalement.

## Mettre à jour l’application

Après chaque modification d’un fichier, ouvrir `sw.js` et augmenter le numéro de version :

```js
const VERSION = 'v2';   // puis v3, v4…
```

Sinon, les téléphones gardent l’ancienne copie. La nouvelle version apparaît
après avoir fermé puis rouvert l’application (parfois deux fois).

## Accessibilité

- Boutons d’au moins 64 px de haut, bien espacés, toujours avec un texte à côté de l’icône.
- Aucun geste compliqué : un simple appui suffit partout.
- Un appui répété trop vite (moins d’une demi-seconde) est ignoré, pour éviter les doubles appuis involontaires.
- Contrastes de niveau WCAG AAA (au moins 7 pour 1) en thème clair et en thème sombre.
- Le thème suit le réglage du téléphone. Aucune animation, aucun clignotement.
- Taille du texte réglable (A− / A+), mémorisée.
- Voix française, lente par défaut (0,7), réglable et mémorisée.
- Champs de formulaire reliés à leur étiquette (compatibles TalkBack).
- Vrais champs de texte : la dictée du clavier (micro de Gboard) fonctionne.
- Le bouton « retour » d’Android ramène à la fiche.

## Bon à savoir

- **Effacer les données de Chrome efface aussi la fiche.** Gardez une copie papier des informations importantes.
- Si la voix ne parle pas ou parle avec un accent étranger : dans les réglages du téléphone,
  chercher « Synthèse vocale », choisir « Services vocaux Google » et installer la voix française.
- Toutes les applications publiées sur la même adresse `github.io` partagent le même espace de stockage
  dans le navigateur. Cette application utilise des noms qui commencent par `soutien-imc` pour ne rien mélanger.

## Liste de vérifications avec la personne qui utilise la fiche

- [ ] Le texte se lit sans effort, à bout de bras. Sinon : Réglages → A+.
- [ ] Le numéro de téléphone se lit facilement.
- [ ] Les boutons s’appuient facilement, sans toucher le bouton voisin.
- [ ] La voix est assez lente et bien compréhensible (essayer « Plus lent » / « Plus rapide »).
- [ ] « Appeler mon conjoint » ouvre le téléphone avec le bon numéro.
- [ ] « Plein écran » est lisible pour une autre personne, et « Fermer » se trouve facilement.
- [ ] La dictée au micro fonctionne dans chaque case du formulaire.
- [ ] La fiche s’ouvre en mode avion.
