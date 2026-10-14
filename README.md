# Ma fiche

Une petite application pour téléphone qui affiche une **fiche de contact** très lisible,
qui peut la **lire à voix haute**, et qui aide à **préparer un appel** à un professionnel de santé.

La fiche s’affiche toujours dans cet ordre (sur l’accueil et en plein écran) :

1. le conjoint : prénom, nom et numéro de téléphone (en très gros) ;
2. le prénom et le nom de la personne, et le texte libre « Ce que je souhaite que l’on sache » ;
3. les informations utiles aux secours : « Mon médecin traitant », « Mes traitements »,
   « Mes allergies », « Autres informations importantes » ;
4. les personnes à prévenir (3 au maximum, en plus du conjoint), chacune avec un bouton « Appeler » ;
5. les numéros d’urgence : deux gros boutons « Urgence : 15 » et « Urgence : 112 », et la phrase
   « Cette fiche ne remplace pas un appel aux secours. »

Toutes les cases sont facultatives. Une case vide n’est ni affichée ni lue.
L’application n’interprète rien : elle montre et lit seulement ce qui a été écrit.
Les boutons d’urgence ouvrent le téléphone avec le numéro déjà tapé : ils n’appellent jamais tout seuls.

Boutons de l’accueil (en haut, pour ne jamais avoir à faire défiler l’écran pour les trouver) :
**Écouter**, **Préparer un appel**, **Appeler mon conjoint**, **Plein écran**, **Réglages**
(taille du texte, vitesse de la voix, modifier la fiche, mes données).
Tout en bas, deux boutons discrets : **Aide** (cinq phrases) et **À propos**.

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
| `app.js` | La fiche, la voix, les réglages, l’aide, le passage d’un écran à l’autre |
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

Après chaque modification d’un fichier, ouvrir `sw.js` et augmenter le numéro de version
(la version actuelle est `v3`) :

```js
const VERSION = 'v4';   // puis v5, v6…
```

C’est le seul endroit où le numéro est écrit : « Réglages » et « À propos » le lisent tout seuls.

Sinon, les téléphones gardent l’ancienne copie. Si un fichier est ajouté, l’ajouter aussi
à la liste `FICHIERS` dans `sw.js`.

Sur le téléphone, pour recevoir la nouvelle version :

1. Avec internet, ouvrir « Ma fiche ». Cette ouverture montre encore l’ancienne version :
   la nouvelle se télécharge en arrière-plan. Attendre une dizaine de secondes.
2. Fermer complètement l’application : bouton des applications récentes (le carré, ou glisser
   depuis le bas de l’écran selon le réglage du téléphone), puis fermer « Ma fiche ».
3. Rouvrir « Ma fiche » : la nouvelle version s’affiche.
4. Vérifier dans **À propos** (ou dans **Réglages**, tout en bas) : « Version installée : v3 »
   (ou le numéro attendu). Si ce n’est pas le cas, recommencer les étapes 1 à 3.

Les données (fiche, réglages, phrases modifiées, appels, appel en cours) sont conservées lors d’une mise à jour.

### Les fiches déjà enregistrées (migration)

La fiche est rangée dans le téléphone sous le nom `soutien-imc.fiche`, comme une liste de cases
(`conjointPrenom`, `prenom`, `message`…). L’étape 3 **ajoute** des cases (`medecin`, `traitements`,
`allergies`, `autresInformations`, `personne1Prenom`, `personne1Lien`, `personne1Telephone`…),
sans changer ni le nom du tiroir, ni le nom des six cases d’avant.

Une fiche enregistrée avant l’étape 3 reste donc valable telle quelle : les nouvelles cases sont
simplement vides. Rien n’est converti ni réécrit dans le téléphone tant qu’on ne touche pas
« Enregistrer ». Au démarrage, la fonction `ficheLue()` (dans `app.js`) remet la fiche au format
actuel : chaque case devient un texte, et une valeur abîmée devient une case vide.
Les anciens fichiers de sauvegarde (format 1) se restaurent aussi.

## Sauvegarder et restaurer (écran « Mes données »)

- **Sauvegarder dans un fichier** : crée `ma-fiche-sauvegarde-AAAA-MM-JJ.json` dans le dossier
  « Téléchargements » du téléphone. Il contient toute la fiche (avec les informations pour les
  secours et les personnes à prévenir), les phrases modifiées et les appels.
  Le copier ensuite dans un endroit sûr (ordinateur, clé USB).
- **Restaurer depuis un fichier** : choisir ce fichier. Une confirmation claire s’affiche
  avant de remplacer les données du téléphone. Les réglages (taille, vitesse) ne sont pas touchés.
  Un fichier créé avant l’étape 3 se restaure aussi : les nouvelles cases restent vides.

## Accessibilité

- Boutons et cases à cocher d’au moins 64 px de haut, bien espacés, toujours avec un texte.
- Aucun geste compliqué : un simple appui suffit partout.
- Un appui répété trop vite (moins d’une demi-seconde) est ignoré, pour éviter les doubles appuis
  involontaires (y compris sur les cases à cocher).
- Bouton **Retour** toujours en haut à gauche, au même endroit, même quand la page défile
  (sur tous les écrans sauf l’accueil, et le plein écran qui a son gros bouton « Fermer » en bas).
  Le bouton « retour » d’Android suit le même chemin.
- Contrastes de niveau WCAG AAA (au moins 7 pour 1) en thème clair et en thème sombre.
- Audit automatique : Lighthouse donne 100 sur 100 en accessibilité sur les 16 écrans,
  en thème clair et en thème sombre (et axe-core ne signale aucun problème, niveau AAA compris).
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
- Quand le téléphone est verrouillé, personne ne peut voir la fiche. Android a son propre réglage
  « Informations d’urgence » (dans les paramètres du téléphone), visible depuis l’écran verrouillé.

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

La fiche complète (étape 3) :

- [ ] « Écouter » lit toute la fiche, dans l’ordre de l’écran, sans les cases vides,
      et la voix reste assez lente.
- [ ] L’ordre des informations lui convient : conjoint, ce que je souhaite que l’on sache,
      secours, personnes à prévenir, numéros d’urgence.
- [ ] Les boutons « Urgence : 15 » et « Urgence : 112 » se trouvent facilement. Les toucher
      ouvre le téléphone avec le numéro, **sans appeler** (raccrocher sans lancer l’appel).
- [ ] Les boutons « Appeler » des personnes à prévenir ouvrent le bon numéro.
- [ ] Les boutons en haut de l’accueil (Écouter, Préparer un appel…) s’appuient facilement,
      et elle les trouve tout de suite.
- [ ] Le formulaire se remplit sans fatigue (une case par ligne, dictée au micro possible).
- [ ] L’écran « Aide » se comprend sans explication.
- [ ] En **mode avion**, la fiche complète, l’Aide et À propos s’ouvrent normalement.

## Tests avec TalkBack et le Contrôle par commutateur

Ce sont les deux outils d’accessibilité d’Android. Pas besoin d’être expert : il suffit
de suivre les étapes. Faites ces tests vous-même d’abord, puis avec votre femme si elle le souhaite.

**TalkBack** (le lecteur d’écran : le téléphone lit à voix haute ce qui est touché).

Pour l’allumer : Paramètres → Accessibilité → TalkBack → Activer.
Attention, les gestes changent quand TalkBack est allumé :

- un doigt qui touche : lit l’élément, sans l’activer ;
- toucher deux fois rapidement n’importe où : active l’élément lu ;
- glisser un doigt vers la droite : passe à l’élément suivant ;
- deux doigts qui glissent : font défiler la page.

Pour l’éteindre : appuyer en même temps sur les deux boutons de volume pendant 3 secondes
(si ce raccourci est activé), sinon Paramètres → Accessibilité → TalkBack.

- [ ] À l’ouverture, en glissant vers la droite, TalkBack lit « Ma fiche », puis « Écouter, bouton ».
- [ ] Chaque bouton est lu avec son nom (« Préparer un appel, bouton », « Urgence : 15, lien »…).
- [ ] Dans « Modifier ma fiche », chaque case est lue avec son nom : par exemple
      « Prénom, personne 1 », puis « Lien avec moi, personne 1 ».
- [ ] Avec un numéro faux, TalkBack lit le message d’erreur après « Enregistrer ».
- [ ] Après « Enregistrer », TalkBack lit « C’est enregistré. Votre fiche est à jour. ».
- [ ] À chaque nouvel écran, TalkBack lit son titre (« Aide », « À propos »…).

**Contrôle par commutateur** (on utilise l’écran avec un ou deux « boutons » au lieu de toucher l’écran).
Sur le téléphone, il peut s’appeler « Accès via un contacteur » ou « Switch Access ».

Pour l’essayer sans matériel, on peut souvent utiliser les touches de volume comme commutateurs :
Paramètres → Accessibilité → Accès via un contacteur → Activer, puis suivre l’assistant :
choisir « Volume + » pour « Suivant » et « Volume − » pour « Sélectionner ».
Un cadre de couleur passe d’un élément à l’autre.

- [ ] Le cadre passe sur chaque bouton, dans l’ordre de l’écran, de haut en bas.
- [ ] « Sélectionner » sur « Écouter » lance la lecture ; sur « Retour », revient en arrière.
- [ ] Les cases du formulaire et les grandes cases à cocher des questions sont atteignables.
- [ ] Aucun élément ne demande un geste (glisser, appui long) pour être utilisé.

Pour arrêter : Paramètres → Accessibilité → Accès via un contacteur → Désactiver
(avec le commutateur « Sélectionner » si l’écran ne répond plus normalement au toucher).
