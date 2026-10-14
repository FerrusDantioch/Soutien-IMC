# Ma fiche

Une petite application pour téléphone qui affiche une **fiche de contact** très lisible,
qui peut la **lire à voix haute**, et qui aide à **préparer un appel** à un professionnel de santé.

La fiche contient :

- le prénom, le nom et le numéro de téléphone du conjoint (en très gros) ;
- le prénom et le nom de la personne ;
- un texte libre « Ce que je souhaite que l’on sache ».

Boutons principaux : **Écouter**, **Préparer un appel**, **Appeler mon conjoint**, **Plein écran**, **Réglages**
(taille du texte, vitesse de la voix, modifier la fiche, mes données).

## Préparer un appel

Le parcours tient en quatre écrans, avec une seule action principale par écran :

1. **Préparer un appel** : choisir la raison de l’appel parmi cinq (prendre un rendez-vous,
   déplacer ou annuler un rendez-vous, renouveler une ordonnance, poser une question sur un traitement,
   demander un résultat d’examen), ou « Autre raison ».
2. **Ma préparation** : nom et numéro du professionnel (facultatifs), une phrase prête pour commencer
   (avec le prénom et le nom de la fiche), un bouton **Écouter**, trois questions à cocher,
   un bouton **Modifier**, et **Appeler** quand un numéro est rempli.
3. **Pendant l’appel** : la phrase et les questions cochées en aide-mémoire, et une case de notes
   (dictée avec le micro du clavier). Tout est gardé à chaque lettre : si le téléphone ferme
   l’application pendant l’appel, elle revient directement aux notes.
4. **Récapitulatif** : date et heure automatiques, « Avec qui ai-je parlé ? », « Ce qui a été décidé »,
   puis **Enregistrer**.

L’écran **Mes appels** montre les 10 derniers appels, en lecture seule. Les plus anciens restent gardés.

Volontairement, il n’y a **ni rappel, ni notification, ni calendrier, ni minuteur, ni compteur**,
et pas de création de nouvelles catégories.

Pour changer les phrases et les questions proposées au départ, ouvrir `appels.js` :
elles sont tout en haut, dans la liste `RAISONS`.

## Confidentialité

- Aucun compte, aucun serveur, aucune publicité.
- **Rien n’est envoyé sur internet.** Les données restent dans le téléphone (stockage `localStorage` du navigateur).
- Le code publié ne contient aucune donnée personnelle. Les exemples sont fictifs
  (« Prénom », « Nom », « 06 00 00 00 00 »).
- Le fichier de sauvegarde (écran **Mes données**) contient des informations personnelles.
  Il ne doit **jamais** être mis dans ce dépôt. Le fichier `.gitignore` l’exclut par sécurité
  (fichiers `ma-fiche-sauvegarde-*.json`).

## Contenu du dossier

| Fichier | Rôle |
| --- | --- |
| `index.html` | La structure de tous les écrans |
| `style.css` | L’apparence (couleurs, tailles, thème clair et sombre) |
| `app.js` | La fiche, la voix, les réglages, le passage d’un écran à l’autre |
| `appels.js` | Le module « Préparer un appel » (et les phrases proposées) |
| `donnees.js` | L’écran « Mes données » : sauvegarde et restauration |
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

Astuce : dans Chrome, la touche F12 puis l’icône « téléphone » (en haut à gauche du panneau)
affiche la page à la taille d’un téléphone.

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
const VERSION = 'v3';   // puis v4, v5…
```

Sinon, les téléphones gardent l’ancienne copie. Si un fichier est ajouté, l’ajouter aussi
à la liste `FICHIERS` dans `sw.js`.

Sur le téléphone, pour recevoir la nouvelle version :

1. Avec internet, ouvrir « Ma fiche ». Cette ouverture montre encore l’ancienne version :
   la nouvelle se télécharge en arrière-plan. Attendre une dizaine de secondes.
2. Fermer complètement l’application : bouton des applications récentes (le carré, ou glisser
   depuis le bas de l’écran selon le réglage du téléphone), puis fermer « Ma fiche ».
3. Rouvrir « Ma fiche » : la nouvelle version s’affiche.
4. Vérifier dans **Réglages**, tout en bas : « Version installée : v2 » (ou le numéro attendu).
   Si ce n’est pas le cas, recommencer les étapes 1 à 3.

Les données (fiche, réglages, appels) sont conservées lors d’une mise à jour.

## Sauvegarder et restaurer (écran « Mes données »)

- **Sauvegarder dans un fichier** : crée `ma-fiche-sauvegarde-AAAA-MM-JJ.json` dans le dossier
  « Téléchargements » du téléphone. Il contient la fiche, les phrases modifiées et les appels.
  Le copier ensuite dans un endroit sûr (ordinateur, clé USB).
- **Restaurer depuis un fichier** : choisir ce fichier. Une confirmation claire s’affiche
  avant de remplacer les données du téléphone. Les réglages (taille, vitesse) ne sont pas touchés.

## Accessibilité

- Boutons et cases à cocher d’au moins 64 px de haut, bien espacés, toujours avec un texte.
- Aucun geste compliqué : un simple appui suffit partout.
- Un appui répété trop vite (moins d’une demi-seconde) est ignoré, pour éviter les doubles appuis
  involontaires (y compris sur les cases à cocher).
- Bouton **Retour** toujours en haut, au même endroit, même quand la page défile.
  Le bouton « retour » d’Android suit le même chemin.
- Contrastes de niveau WCAG AAA (au moins 7 pour 1) en thème clair et en thème sombre.
- Le thème suit le réglage du téléphone. Aucune animation, aucun clignotement.
- Taille du texte réglable (A− / A+), mémorisée. Rien ne dépasse de l’écran, même à 200 %.
- Voix française, lente par défaut (0,7), réglable et mémorisée.
- Champs de formulaire reliés à leur étiquette (compatibles TalkBack).
- Vrais champs de texte : la dictée du clavier (micro de Gboard) fonctionne.
  Quand on touche une grande case de texte, le curseur se place à la fin : la dictée s’ajoute à la suite.
  Les cases grandissent avec le texte (pas besoin de les faire défiler du doigt).
- Boutons « Effacer » sous les cases de la phrase et des questions, pour tout réécrire sans geste précis.
- Une confirmation claire seulement avant de remplacer des données (restauration).

## Bon à savoir

- **Effacer les données de Chrome efface aussi la fiche et les appels.** Faire une sauvegarde
  de temps en temps (Réglages → Mes données).
- Si la voix ne parle pas ou parle avec un accent étranger : dans les réglages du téléphone,
  chercher « Synthèse vocale », choisir « Services vocaux Google » et installer la voix française.
- Toutes les applications publiées sur la même adresse `github.io` partagent le même espace de stockage
  dans le navigateur. Cette application utilise des noms qui commencent par `soutien-imc` pour ne rien mélanger.

## Liste de vérifications avec la personne qui utilise l’application

La fiche :

- [ ] Le texte se lit sans effort, à bout de bras. Sinon : Réglages → A+.
- [ ] Le numéro de téléphone se lit facilement.
- [ ] « Appeler mon conjoint » ouvre le téléphone avec le bon numéro.
- [ ] « Plein écran » est lisible pour une autre personne, et « Fermer » se trouve facilement.
- [ ] La fiche s’ouvre en mode avion.

Préparer un appel :

- [ ] Les boutons et les cases à cocher s’appuient facilement, sans toucher le voisin.
- [ ] Un double appui involontaire ne décoche pas une question.
- [ ] Les phrases et les questions se lisent facilement et se comprennent tout de suite.
- [ ] La voix lit la phrase assez lentement (sinon : Réglages → Plus lent).
- [ ] Le parcours est clair : raison → préparation → appel → notes → récapitulatif.
- [ ] Le bouton « Retour » se trouve toujours facilement, en haut.
- [ ] La dictée au micro fonctionne dans les notes et dans les phrases.
- [ ] **Pendant un vrai appel**, en revenant dans l’application, les notes sont toujours là.
- [ ] Même chose après avoir fermé l’application pendant l’appel.
- [ ] Après « Enregistrer », l’appel apparaît en haut de « Mes appels ».
