/* =============================================================
   app.js — le comportement de l'application « Ma fiche »

   Ce fichier :
   - lit et enregistre la fiche dans le téléphone (localStorage) ;
   - affiche la fiche : conjoint, ce que je souhaite que l'on sache,
     informations utiles aux secours, personnes à prévenir, numéros d'urgence ;
   - affiche le bon écran, et tient à jour le chemin parcouru
     (bouton « Retour » de l'application et bouton « retour » d'Android) ;
   - lit la fiche à voix haute (synthèse vocale du navigateur) ;
   - mémorise la taille du texte et la vitesse de la voix ;
   - prépare le fonctionnement hors ligne (service worker).

   Deux autres fichiers complètent l'application et utilisent ses outils :
   - appels.js : le module « Préparer un appel » ;
   - donnees.js : l'écran « Mes données » (sauvegarde et restauration).

   Rien n'est envoyé sur internet : tout reste dans le téléphone.
   ============================================================= */

'use strict';


/* ---------- 1. Les réglages de départ ---------- */

// Noms des « tiroirs » où les données sont rangées dans le téléphone.
const CLE_FICHE = 'soutien-imc.fiche';
const CLE_REGLAGES = 'soutien-imc.reglages';

// Vitesse de la voix : 1 = vitesse normale. 0,7 = plus lent (par défaut).
const VITESSE_PAR_DEFAUT = 0.7;
const VITESSE_MINIMUM = 0.5;
const VITESSE_MAXIMUM = 1.5;
const PAS_DE_VITESSE = 0.1;

// Tailles du texte possibles (1 = taille normale, 2 = deux fois plus grand).
const TAILLES = [0.85, 1, 1.15, 1.3, 1.5, 1.75, 2];
const TAILLE_PAR_DEFAUT = 1;

// Deux appuis à moins d'une demi-seconde d'écart : le second est ignoré.
// Cela évite les doubles appuis involontaires (tremblements, appui trop long).
const DELAI_ANTI_REBOND = 500;

// Les cases de la fiche (mêmes noms que l'attribut « name » des champs du formulaire).
// Les six premières existent depuis l'étape 1 : leurs noms ne doivent jamais changer,
// sinon les fiches déjà enregistrées dans le téléphone seraient perdues.
const CHAMPS = [
  'conjointPrenom', 'conjointNom', 'conjointTelephone', 'prenom', 'nom', 'message',
  // Informations utiles aux secours
  'medecin', 'traitements', 'allergies', 'autresInformations',
  // Personnes à prévenir
  'personne1Prenom', 'personne1Lien', 'personne1Telephone',
  'personne2Prenom', 'personne2Lien', 'personne2Telephone',
  'personne3Prenom', 'personne3Lien', 'personne3Telephone'
];

// Les cases qui contiennent un numéro de téléphone (vérifiées avant d'enregistrer).
const CHAMPS_TELEPHONE = ['conjointTelephone', 'personne1Telephone', 'personne2Telephone', 'personne3Telephone'];

// Les informations utiles aux secours, dans l'ordre d'affichage et de lecture.
// Elles sont affichées et lues telles qu'elles sont écrites : rien n'est interprété.
const INFORMATIONS_SECOURS = [
  { champ: 'medecin', titre: 'Mon médecin traitant' },
  { champ: 'traitements', titre: 'Mes traitements' },
  { champ: 'allergies', titre: 'Mes allergies' },
  { champ: 'autresInformations', titre: 'Autres informations importantes' }
];

// Au plus 3 personnes à prévenir, en plus du conjoint (limite voulue).
const NOMBRE_DE_PERSONNES = 3;

// Les écrans : nom court → identifiant (id) dans index.html.
const ECRANS = {
  accueil: 'ecran-accueil',
  modifier: 'ecran-modifier',
  reglages: 'ecran-reglages',
  plein: 'ecran-plein',
  donnees: 'ecran-donnees',
  raisons: 'ecran-raisons',
  preparation: 'ecran-preparation',
  modele: 'ecran-modele',
  notes: 'ecran-notes',
  recap: 'ecran-recap',
  appels: 'ecran-appels',
  aide: 'ecran-aide',
  apropos: 'ecran-apropos'
};

// Le chemin entre les écrans : chaque écran → l'écran où ramène le bouton « Retour ».
// Exemple : Pendant l'appel → Ma préparation → Préparer un appel → Ma fiche.
const PARENTS = {
  modifier: 'accueil',
  reglages: 'accueil',
  plein: 'accueil',
  donnees: 'reglages',
  raisons: 'accueil',
  preparation: 'raisons',
  modele: 'preparation',
  notes: 'preparation',
  recap: 'notes',
  appels: 'raisons',
  aide: 'accueil',
  apropos: 'accueil'
};


/* ---------- 2. L'état de l'application (ce qui change pendant l'utilisation) ---------- */

let fiche = null;                 // la fiche enregistrée (ou null si elle est vide)
let reglages = { vitesse: VITESSE_PAR_DEFAUT, taille: TAILLE_PAR_DEFAUT };
let ecranActuel = null;           // l'écran visible en ce moment
// Les durées (anti-rebond, curseur, lecture) sont mesurées avec performance.now() :
// ce chronomètre ne recule jamais, même si l'heure du téléphone est corrigée.
// (Avec l'heure du téléphone, une heure reculée bloquerait tous les appuis pendant une heure.)
let dernierAppui = -Infinity;     // moment du dernier appui accepté (anti-rebond)
let appuiEnCours = null;          // l'élément touché pendant l'appui en cours (anti-rebond)
let quandOnArrive = null;         // ce qu'il reste à faire après un recul dans l'historique
let voixFrancaise = null;         // la voix française choisie
let enLecture = false;            // la voix est-elle en train de lire ?
let boutonLecture = null;         // le bouton « Écouter » qui a lancé la lecture
let numeroLecture = 0;            // augmente à chaque lecture (pour ignorer les anciennes)
let phrasesEnCours = [];          // garde les phrases en mémoire pendant la lecture
let surveillanceLecture = null;   // minuterie qui vérifie la fin de la lecture
let verrouEcran = null;           // empêche l'écran de s'éteindre en plein écran
let heureDuChangementDeVisibilite = -Infinity;   // dernier passage en arrière-plan ou au premier plan


/* ---------- 3. Petits outils ---------- */

// Raccourci pour trouver un élément de la page par son identifiant.
function element(id) {
  return document.getElementById(id);
}

// Enlève les espaces inutiles au début et à la fin d'un texte.
function nettoyer(texte) {
  return String(texte == null ? '' : texte).trim();
}

// « Prénom » + « Nom » → « Prénom Nom » (sans espace en trop si une partie manque).
function nomComplet(prenom, nom) {
  return [nettoyer(prenom), nettoyer(nom)].filter(Boolean).join(' ');
}

// 0.7 → « 70 % » (l'espace insécable empêche le « % » de partir seul à la ligne).
function pourcentage(valeur) {
  return Math.round(valeur * 100) + ' %';
}

// Lit une donnée rangée dans le téléphone. Renvoie null si rien n'est trouvé.
function lireStockage(cle) {
  try {
    const texte = localStorage.getItem(cle);
    return texte ? JSON.parse(texte) : null;
  } catch (erreur) {
    return null;
  }
}

// Range une donnée dans le téléphone. Renvoie true si tout s'est bien passé.
function ecrireStockage(cle, valeur) {
  try {
    localStorage.setItem(cle, JSON.stringify(valeur));
    return true;
  } catch (erreur) {
    return false;
  }
}

// Vérifie que le navigateur accepte de garder des données (refusé en navigation privée stricte).
function stockageDisponible() {
  try {
    localStorage.setItem('soutien-imc.test', '1');
    localStorage.removeItem('soutien-imc.test');
    return true;
  } catch (erreur) {
    return false;
  }
}

// Une fiche est vide si toutes ses cases sont vides.
function ficheEstVide(uneFiche) {
  return !uneFiche || CHAMPS.every((champ) => !nettoyer(uneFiche[champ]));
}

// Remet une fiche lue dans le téléphone (ou dans un fichier de sauvegarde) au format actuel.
// C'est la « migration » : une fiche des étapes 1 et 2 n'a que les six premières cases ;
// les cases nouvelles (secours, personnes à prévenir) sont alors simplement vides.
// Chaque case devient un texte : une valeur abîmée ne peut pas bloquer l'application.
// longueurs (facultatif) : la longueur maximale de chaque case.
// Renvoie null si ce n'est pas une fiche, ou si elle est vide.
function ficheLue(brute, longueurs) {
  if (!brute || typeof brute !== 'object' || Array.isArray(brute)) {
    return null;
  }
  const propre = {};
  CHAMPS.forEach((champ) => {
    const valeur = typeof brute[champ] === 'string' ? brute[champ] : '';
    propre[champ] = longueurs ? valeur.slice(0, longueurs[champ]) : valeur;
  });
  return ficheEstVide(propre) ? null : propre;
}

// Quand on touche une grande case de texte, le curseur se place à la fin :
// la dictée (micro du clavier) ajoute alors le texte à la suite, sans couper ce qui est déjà écrit.
// (Placer le curseur au milieu d'un mot demande un geste trop précis.)
let heureDuFocus = -Infinity;

function curseurALaFin(champ) {
  const fin = champ.value.length;
  champ.setSelectionRange(fin, fin);
}

function quandUneCaseRecoitLeFocus(evenement) {
  heureDuFocus = performance.now();
  curseurALaFin(evenement.target);
}

// Le toucher qui ouvre la case pose le curseur sous le doigt, juste après le focus :
// on le remet à la fin. Un toucher suivant, lui, place le curseur où l'on veut.
function quandOnToucheUneCase(evenement) {
  if (performance.now() - heureDuFocus < 1000) {
    curseurALaFin(evenement.target);
  }
  heureDuFocus = -Infinity;
}

// Change l'adresse de la page (la partie après « # ») sans recharger.
// Protégé par try/catch : certains navigateurs refusent quand la page est ouverte
// directement depuis un fichier de l'ordinateur.
function changerAdresse(methode, etat, adresse) {
  try {
    history[methode](etat, '', adresse);
    return true;
  } catch (erreur) {
    return false;
  }
}

function adresseSansDiese() {
  return location.pathname + location.search;
}

// Date et heure en toutes lettres : « mardi 14 octobre 2026, à 15 h 30 ».
function dateEnToutesLettres(texteDate) {
  const date = new Date(texteDate);
  if (isNaN(date.getTime())) {
    return '';
  }
  const jour = date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const heure = date.getHours() + ' h ' + String(date.getMinutes()).padStart(2, '0');
  return jour + ', à ' + heure;
}

// Met une majuscule au début : « mardi » → « Mardi ».
function majuscule(texte) {
  return texte.charAt(0).toUpperCase() + texte.slice(1);
}


/* ---------- 4. Le numéro de téléphone ---------- */

// Les caractères acceptés dans un numéro : chiffres, espaces, points, tirets,
// parenthèses, et un « + » au début.
const CARACTERES_D_UN_NUMERO = /^\+?[\d\s.\-()]+$/;

// Garde seulement les chiffres (et un « + » au début) : c'est le format du lien d'appel « tel: ».
// Un numéro écrit « +33 (0)6 00 00 00 00 » : le « (0) » ne se compose pas après l'indicatif
// du pays (+33). On l'enlève, sinon l'appel partirait vers un mauvais numéro.
function numeroPourAppel(telephone) {
  let texte = nettoyer(telephone);
  if (texte.startsWith('+')) {
    texte = texte.replace(/\(\s*0\s*\)/g, '');
  }
  const plus = texte.startsWith('+') ? '+' : '';
  return plus + texte.replace(/\D/g, '');
}

// « 0600000000 » devient « 06 00 00 00 00 », plus facile à lire.
// Des espaces insécables ( ) collent les groupes : si le numéro est trop long
// pour une ligne, il se coupe proprement au milieu (« 06 00 00 » puis « 00 00 »).
function numeroPourAffichage(telephone) {
  const chiffres = numeroPourAppel(telephone);
  if (/^0\d{9}$/.test(chiffres)) {
    const paires = chiffres.match(/\d{2}/g);
    return paires.slice(0, 3).join(' ') + ' ' + paires.slice(3).join(' ');
  }
  return nettoyer(telephone);
}

// Pour la voix : des virgules entre les groupes de chiffres,
// pour une lecture lente et claire (« zéro six, zéro zéro… »).
function numeroPourVoix(telephone) {
  return numeroPourAffichage(telephone)
    .split(/[\s.\-]+/)
    .filter(Boolean)
    .join(', ');
}

// Un numéro est accepté s'il ne contient que des chiffres, espaces, points,
// tirets, parenthèses ou un « + » au début. Une case vide est acceptée aussi.
function numeroValide(telephone) {
  const texte = nettoyer(telephone);
  if (!texte) {
    return true;
  }
  return CARACTERES_D_UN_NUMERO.test(texte) && texte.replace(/\D/g, '').length >= 3;
}

// Le message affiché sous une case dont le numéro n'est pas accepté :
// des lettres (ou d'autres signes), ou bien pas assez de chiffres.
function problemeDuNumero(telephone) {
  return CARACTERES_D_UN_NUMERO.test(nettoyer(telephone))
    ? 'Le numéro est trop court.'
    : 'Le numéro ne doit contenir que des chiffres.';
}


/* ---------- 5. Les messages (« C'est enregistré », erreurs…) ---------- */

// Fabrique une icône à partir des dessins rangés en haut de index.html.
function creerIcone(nom) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'icone');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  const utilisation = document.createElementNS('http://www.w3.org/2000/svg', 'use');
  utilisation.setAttribute('href', '#icone-' + nom);
  svg.appendChild(utilisation);
  return svg;
}

// Affiche un message dans une zone. type : 'succes', 'erreur' ou 'info'.
// La zone a le rôle « status » : TalkBack lit le message tout seul.
function afficherMessage(idZone, texte, type) {
  const zone = element(idZone);
  const phrase = document.createElement('span');
  phrase.textContent = texte;
  zone.className = 'message ' + type;
  zone.replaceChildren(creerIcone(type), phrase);
}

function effacerMessage(idZone) {
  const zone = element(idZone);
  zone.className = 'message';
  zone.replaceChildren();
}

// Chaque écran a sa zone de message : « message-accueil », « message-reglages »…
function effacerTousLesMessages() {
  document.querySelectorAll('.message[role="status"]').forEach((zone) => effacerMessage(zone.id));
}

// Message affiché juste après un changement d'écran.
// On attend un court instant pour que TalkBack ait le temps de « voir » le nouvel écran.
function annoncerApresChangement(idZone, texte, type) {
  setTimeout(() => afficherMessage(idZone, texte, type), 150);
}

// Zone de message de l'écran visible (pour les problèmes de voix, par exemple).
function zoneDeMessageActuelle() {
  const zone = element('message-' + ecranActuel);
  return zone ? zone.id : 'message-accueil';
}


/* ---------- 6. Les écrans ---------- */

// Montre un seul écran et cache tous les autres.
function afficherEcran(nom, options = {}) {
  if (nom === ecranActuel) {
    return;
  }
  if (ecranActuel === 'plein') {
    quitterPleinEcranDuTelephone();
  }
  arreterLecture();
  effacerTousLesMessages();

  Object.keys(ECRANS).forEach((cle) => {
    element(ECRANS[cle]).hidden = (cle !== nom);
  });
  ecranActuel = nom;

  // Un appui « en trop » juste après le changement d'écran sera ignoré.
  dernierAppui = performance.now();
  window.scrollTo(0, 0);

  // TalkBack se place sur le titre du nouvel écran et le lit.
  if (options.focus !== false) {
    const titre = element(ECRANS[nom]).querySelector('h1');
    if (titre) {
      titre.focus({ preventScroll: true });
    }
  }
}

// Prépare le contenu d'un écran, puis l'affiche.
// Les fonctions des écrans d'appel sont dans appels.js, celle de « Mes données » dans donnees.js.
function preparerEtAfficher(nom, options = {}) {
  switch (nom) {
    case 'accueil':
      montrerAccueil(options);
      return;
    case 'modifier':
      remplirFormulaire(false);
      break;
    case 'plein':
      afficherFiche();
      break;
    case 'reglages':
      afficherVersion('version');
      break;
    case 'apropos':
      afficherVersion('apropos-version');
      break;
    case 'donnees':
      afficherMesDonnees();       // donnees.js
      break;
    case 'raisons':
      afficherRaisons();          // appels.js
      break;
    case 'preparation':
      afficherPreparation();      // appels.js
      break;
    case 'modele':
      remplirModele();            // appels.js
      break;
    case 'notes':
      afficherNotes();            // appels.js
      break;
    case 'recap':
      afficherRecap();            // appels.js
      break;
    case 'appels':
      afficherMesAppels();        // appels.js
      break;
  }
  afficherEcran(nom, options);
  if (nom === 'plein') {
    // La fiche en plein écran s'ouvre toujours en haut, sur le conjoint,
    // même si on l'avait fait défiler la fois précédente.
    element('ecran-plein').querySelector('.plein-contenu').scrollTop = 0;
    garderEcranAllume();
  }
}

// L'écran d'accueil : la fiche… ou le formulaire si la fiche est encore vide.
function montrerAccueil(options = {}) {
  if (ficheEstVide(fiche)) {
    remplirFormulaire(true);
    afficherEcran('modifier', options);
  } else {
    afficherFiche();
    afficherEcran('accueil', options);
  }
}

// Le « niveau » d'un écran sur le chemin : 0 pour la fiche, 1 pour les écrans
// ouverts depuis la fiche, 2 pour les écrans ouverts depuis ceux-ci, etc.
function niveau(nom) {
  return PARENTS[nom] ? 1 + niveau(PARENTS[nom]) : 0;
}

// Les écrans à traverser pour aller de « depart » à « arrivee » en avançant sur le chemin.
// Exemple : de « raisons » à « modele » → ['preparation', 'modele'].
// Renvoie null si « arrivee » n'est pas plus loin sur le même chemin.
function cheminDepuis(depart, arrivee) {
  const chemin = [];
  let ecran = arrivee;
  while (ecran && ecran !== depart) {
    chemin.unshift(ecran);
    ecran = PARENTS[ecran];
  }
  return ecran === depart ? chemin : null;
}

// Ce qu'on inscrit dans l'historique pour un écran, et l'adresse de la page.
// « profondeur » : le nombre d'étapes de l'application avant celle-ci dans l'historique.
function etatDe(nom, profondeur) {
  return nom === 'accueil' ? null : { ecran: nom, profondeur: profondeur };
}

function adresseDe(nom) {
  return nom === 'accueil' ? adresseSansDiese() : '#' + nom;
}

// Inscrit un écran à l'étape actuelle de l'historique (sans en ajouter).
function inscrireLEcran(nom) {
  const etat = history.state || {};
  if ((etat.ecran || 'accueil') !== nom) {
    changerAdresse('replaceState', etatDe(nom, Number(etat.profondeur) || 0), adresseDe(nom));
  }
}

// Inscrit tout le chemin depuis la fiche jusqu'à un écran.
// Exemple pour « notes » : Ma fiche → Préparer un appel → Ma préparation → Pendant l'appel.
function inscrireLeChemin(nom) {
  changerAdresse('replaceState', null, adresseSansDiese());
  cheminDepuis('accueil', nom).forEach((ecran, rang) => {
    changerAdresse('pushState', etatDe(ecran, rang + 1), adresseDe(ecran));
  });
}

// Ouvre un écran, et tient l'historique du navigateur à jour :
// le bouton « retour » d'Android suit alors le même chemin que le bouton « Retour ».
//  - écran plus loin sur le chemin (ex. : fiche → réglages) : on ajoute une étape ;
//  - écran en arrière ou à côté (ex. : réglages → fiche) : on recule dans l'historique,
//    puis on inscrit le bon écran à l'étape d'arrivée.
function ouvrirEcran(nom, options = {}) {
  const depart = ecranActuel;
  const profondeur = (history.state && Number(history.state.profondeur)) || 0;

  preparerEtAfficher(nom, options);

  const etapes = cheminDepuis(depart, nom);
  if (etapes) {
    etapes.forEach((ecran, rang) => {
      changerAdresse('pushState', etatDe(ecran, profondeur + rang + 1), adresseDe(ecran));
    });
    return;
  }

  // On ne recule jamais plus loin que les étapes de l'application
  // (sinon, on sortirait de l'application).
  const recul = Math.min(niveau(depart) - niveau(nom), profondeur);
  if (recul > 0) {
    quandOnArrive = () => inscrireLEcran(nom);     // voir quandOnReculeDansLHistorique()
    history.go(-recul);
  } else {
    inscrireLEcran(nom);
  }
}

// Revient à la fiche (boutons « Retour à ma fiche », « Annuler », « Fermer »).
function revenirALaFiche() {
  ouvrirEcran('accueil');
}

// Bouton « Retour » en haut des écrans : ramène à l'écran précédent sur le chemin.
function retourEnArriere() {
  const quitte = ecranActuel;
  const arrivee = PARENTS[quitte] || 'accueil';
  ouvrirEcran(arrivee);
  annoncerSiAnnule(quitte, arrivee);
}

// Quitter un formulaire sans enregistrer : on rassure, rien n'a changé.
function annoncerSiAnnule(quitte, arrivee) {
  if (quitte === 'modifier' && arrivee === 'accueil' && !ficheEstVide(fiche)) {
    annoncerApresChangement('message-accueil', 'Annulé. Votre fiche n’a pas changé.', 'info');
  }
  if (quitte === 'modele' && arrivee === 'preparation') {
    annoncerApresChangement('message-preparation', 'Annulé. Votre phrase et vos questions n’ont pas changé.', 'info');
  }
}

// L'historique du navigateur a changé : bouton « retour » du téléphone,
// ou recul demandé par ouvrirEcran().
function quandOnReculeDansLHistorique() {
  const etat = history.state || {};
  const profondeur = Number(etat.profondeur) || 0;

  // 1. Recul demandé par l'application : le bon écran est déjà affiché,
  //    il reste seulement à mettre l'historique à jour.
  if (quandOnArrive) {
    const aFaire = quandOnArrive;
    quandOnArrive = null;
    aFaire();
    return;
  }

  // 2. Bouton « retour » du téléphone : on affiche l'écran inscrit dans l'historique.
  let nom = ECRANS[etat.ecran] ? etat.ecran : 'accueil';
  if (ficheEstVide(fiche)) {
    nom = 'accueil';            // fiche vide : on reste sur le formulaire « Bienvenue »
  }
  nom = ecranPossible(nom);     // ex. : plus d'appel en cours → « Préparer un appel » (appels.js)
  if (nom !== (etat.ecran || 'accueil')) {
    changerAdresse('replaceState', etatDe(nom, profondeur), adresseDe(nom));
  }
  const quitte = ecranActuel;
  preparerEtAfficher(nom);
  annoncerSiAnnule(quitte, nom);
}


/* ---------- 7. L'écran « Ma fiche » ---------- */

// Écrit un texte dans un élément, et cache l'élément si le texte est vide.
function remplir(id, texte) {
  const cible = element(id);
  cible.textContent = texte;
  cible.hidden = !texte;
}

// Crée un paragraphe avec une classe et un texte.
function paragraphe(classe, texte) {
  const p = document.createElement('p');
  p.className = classe;
  p.textContent = texte;
  return p;
}

// Les personnes à prévenir qui ont au moins une case remplie.
function personnesDeLaFiche(f) {
  const personnes = [];
  for (let numero = 1; numero <= NOMBRE_DE_PERSONNES; numero += 1) {
    const personne = {
      prenom: nettoyer(f['personne' + numero + 'Prenom']),
      lien: nettoyer(f['personne' + numero + 'Lien']),
      telephone: nettoyer(f['personne' + numero + 'Telephone'])
    };
    if (personne.prenom || personne.lien || personne.telephone) {
      personnes.push(personne);
    }
  }
  return personnes;
}

// « Prénom (sœur) », ou seulement le prénom, ou seulement le lien.
function nomDeLaPersonne(personne) {
  if (personne.prenom && personne.lien) {
    return personne.prenom + ' (' + personne.lien + ')';
  }
  return personne.prenom || majuscule(personne.lien);
}

// Les informations utiles aux secours : une étiquette, puis le texte écrit (seulement les cases remplies).
function remplirSecours(ecran, f) {
  const zone = element(ecran + '-secours');
  zone.replaceChildren();
  INFORMATIONS_SECOURS.forEach((information) => {
    const texte = nettoyer(f[information.champ]);
    if (texte) {
      zone.append(paragraphe('etiquette', information.titre), paragraphe('message-libre', texte));
    }
  });
  element(ecran + '-bloc-secours').hidden = zone.children.length === 0;
}

// Les personnes à prévenir : une carte par personne, avec son bouton « Appeler ».
function remplirPersonnes(ecran, f) {
  const zone = element(ecran + '-personnes');
  zone.replaceChildren();
  personnesDeLaFiche(f).forEach((personne) => {
    const carte = document.createElement('div');
    carte.className = 'carte-fiche';
    const nom = nomDeLaPersonne(personne);
    if (nom) {
      carte.appendChild(paragraphe('personne-nom', nom));
    }
    if (personne.telephone) {
      carte.appendChild(paragraphe('personne-telephone', numeroPourAffichage(personne.telephone)));
    }
    // Le bouton « Appeler » n'apparaît que si le numéro est correct.
    if (personne.telephone && numeroValide(personne.telephone)) {
      const lien = document.createElement('a');
      lien.className = 'bouton';
      lien.href = 'tel:' + numeroPourAppel(personne.telephone);
      const texte = document.createElement('span');
      texte.textContent = 'Appeler ' + (personne.prenom || personne.lien || 'ce numéro');
      lien.append(creerIcone('telephone'), texte);
      carte.appendChild(lien);
    }
    zone.appendChild(carte);
  });
  element(ecran + '-bloc-personnes').hidden = zone.children.length === 0;
}

// Remplit la fiche sur l'écran d'accueil et sur l'écran « Plein écran », dans le même ordre :
// conjoint, ce que je souhaite que l'on sache, secours, personnes à prévenir, urgences.
// (Les numéros d'urgence sont écrits directement dans index.html : ils sont toujours là.)
function afficherFiche() {
  const f = fiche || {};
  const conjoint = nomComplet(f.conjointPrenom, f.conjointNom);
  const telephone = nettoyer(f.conjointTelephone);
  const moi = nomComplet(f.prenom, f.nom);
  const message = nettoyer(f.message);

  ['accueil', 'plein'].forEach((ecran) => {
    remplir(ecran + '-conjoint-nom', conjoint);
    remplir(ecran + '-conjoint-telephone', telephone ? numeroPourAffichage(telephone) : '');
    element(ecran + '-bloc-conjoint').hidden = !conjoint && !telephone;
    remplir(ecran + '-moi-nom', moi);
    element(ecran + '-bloc-nom').hidden = !moi;
    remplir(ecran + '-message', message);
    element(ecran + '-bloc-message').hidden = !message;
    remplirSecours(ecran, f);
    remplirPersonnes(ecran, f);
  });

  // Le bouton « Appeler » n'apparaît que s'il y a un numéro correct
  // (comme pour les personnes à prévenir).
  const lienAppel = element('bouton-appeler');
  if (telephone && numeroValide(telephone)) {
    lienAppel.href = 'tel:' + numeroPourAppel(telephone);
    lienAppel.hidden = false;
  } else {
    lienAppel.removeAttribute('href');
    lienAppel.hidden = true;
  }
}


/* ---------- 8. Le formulaire « Modifier ma fiche » ---------- */

// Remplit le formulaire avec la fiche enregistrée.
// premiereFois = true : fiche vide, on affiche une phrase d'explication et pas de bouton « Annuler ».
function remplirFormulaire(premiereFois) {
  const formulaire = element('formulaire');
  const f = fiche || {};
  CHAMPS.forEach((champ) => {
    formulaire.elements[champ].value = f[champ] || '';
  });
  effacerLesErreurs();
  element('titre-modifier').textContent = premiereFois ? 'Bienvenue' : 'Modifier ma fiche';
  element('explication-premiere-fois').hidden = !premiereFois;
  // La première fois, il n'y a pas encore de fiche où revenir : ni « Retour », ni « Annuler ».
  element('barre-modifier').hidden = premiereFois;
  element('bouton-annuler').hidden = premiereFois;
}

// Le message d'erreur d'une case est le paragraphe « erreur-champ » juste en dessous.
function montrerErreur(champ, texte) {
  const erreur = champ.parentElement.querySelector('.erreur-champ');
  erreur.textContent = texte;
  erreur.hidden = false;
  champ.setAttribute('aria-invalid', 'true');
}

function effacerLesErreurs() {
  const formulaire = element('formulaire');
  formulaire.querySelectorAll('.erreur-champ').forEach((erreur) => {
    erreur.textContent = '';
    erreur.hidden = true;
  });
  formulaire.querySelectorAll('[aria-invalid]').forEach((champ) => champ.removeAttribute('aria-invalid'));
}

// Bouton « Enregistrer ».
function enregistrerFiche(evenement) {
  evenement.preventDefault();   // la page ne doit pas se recharger
  const formulaire = element('formulaire');

  const nouvelleFiche = {};
  CHAMPS.forEach((champ) => {
    nouvelleFiche[champ] = nettoyer(formulaire.elements[champ].value);
  });

  effacerLesErreurs();
  effacerMessage('message-modifier');

  // Chaque numéro faux est signalé sous sa case. Le curseur va dans la première case à corriger.
  const numerosFaux = CHAMPS_TELEPHONE.filter((champ) => !numeroValide(nouvelleFiche[champ]));
  if (numerosFaux.length > 0) {
    numerosFaux.forEach((champ) => {
      montrerErreur(formulaire.elements[champ], problemeDuNumero(nouvelleFiche[champ]));
    });
    afficherMessage('message-modifier',
      numerosFaux.length === 1
        ? 'La fiche n’est pas enregistrée. Corrigez le numéro de téléphone.'
        : 'La fiche n’est pas enregistrée. Corrigez les numéros de téléphone.',
      'erreur');
    formulaire.elements[numerosFaux[0]].focus();
    return;
  }

  if (ficheEstVide(nouvelleFiche)) {
    afficherMessage('message-modifier', 'La fiche est vide. Remplissez au moins une case.', 'erreur');
    element('champ-conjoint-prenom').focus();
    return;
  }

  if (!ecrireStockage(CLE_FICHE, nouvelleFiche)) {
    afficherMessage('message-modifier', 'Problème : la fiche n’a pas pu être enregistrée dans ce téléphone.', 'erreur');
    return;
  }

  fiche = nouvelleFiche;
  revenirALaFiche();
  annoncerApresChangement('message-accueil', 'C’est enregistré. Votre fiche est à jour.', 'succes');
}

// Bouton « Annuler » : rien n'est modifié, on revient à la fiche enregistrée.
function annulerModification() {
  revenirALaFiche();
  annoncerApresChangement('message-accueil', 'Annulé. Votre fiche n’a pas changé.', 'info');
}

// Touche « Entrée » dans une case : on passe à la case suivante
// (au lieu d'enregistrer la fiche trop tôt). L'ordre est celui des cases à l'écran.
function passerALaCaseSuivante(evenement) {
  if (evenement.key !== 'Enter' || evenement.target.tagName !== 'INPUT') {
    return;
  }
  evenement.preventDefault();
  const cases = [...element('formulaire').querySelectorAll('input, textarea')];
  const suivant = cases[cases.indexOf(evenement.target) + 1];
  if (suivant) {
    suivant.focus();
  }
}


/* ---------- 9. Les réglages : taille du texte ---------- */

function sauverReglages() {
  ecrireStockage(CLE_REGLAGES, reglages);
}

function appliquerTaille(remarque) {
  document.documentElement.style.setProperty('--echelle', String(reglages.taille));
  element('valeur-taille').textContent =
    'Taille actuelle : ' + pourcentage(reglages.taille) + '.' + (remarque ? ' ' + remarque : '');
}

// sens = +1 (A+) ou -1 (A−)
function changerTaille(sens) {
  let position = TAILLES.indexOf(reglages.taille);
  if (position === -1) {
    position = TAILLES.indexOf(TAILLE_PAR_DEFAUT);
  }
  const nouvellePosition = position + sens;

  if (nouvellePosition < 0) {
    appliquerTaille('C’est la plus petite taille.');
    return;
  }
  if (nouvellePosition >= TAILLES.length) {
    appliquerTaille('C’est la plus grande taille.');
    return;
  }

  reglages.taille = TAILLES[nouvellePosition];
  sauverReglages();
  appliquerTaille();
}


/* ---------- 10. Les réglages : vitesse de la voix ---------- */

function libelleVitesse(vitesse) {
  if (vitesse < 0.65) return 'très lente';
  if (vitesse < 0.85) return 'lente';
  if (vitesse < 1.05) return 'normale';
  if (vitesse < 1.25) return 'rapide';
  return 'très rapide';
}

function appliquerVitesse(remarque) {
  element('valeur-vitesse').textContent =
    'Vitesse actuelle : ' + libelleVitesse(reglages.vitesse) +
    ' (' + pourcentage(reglages.vitesse) + ').' + (remarque ? ' ' + remarque : '');
}

// sens = +1 (plus rapide) ou -1 (plus lent)
function changerVitesse(sens) {
  // Arrondi à 0,1 près (les ordinateurs calculent mal 0,7 − 0,1 sans arrondi).
  const nouvelleVitesse = Math.round((reglages.vitesse + sens * PAS_DE_VITESSE) * 10) / 10;

  if (nouvelleVitesse < VITESSE_MINIMUM) {
    appliquerVitesse('C’est le minimum.');
    parler(['C’est déjà la vitesse la plus lente.']);
    return;
  }
  if (nouvelleVitesse > VITESSE_MAXIMUM) {
    appliquerVitesse('C’est le maximum.');
    parler(['C’est déjà la vitesse la plus rapide.']);
    return;
  }

  reglages.vitesse = nouvelleVitesse;
  sauverReglages();
  appliquerVitesse();
  parler(['Voici la nouvelle vitesse de lecture.']);   // phrase d'essai
}


/* ---------- 11. La lecture à voix haute ---------- */

function syntheseDisponible() {
  return 'speechSynthesis' in window && typeof window.SpeechSynthesisUtterance === 'function';
}

// Cherche une voix française, de préférence installée dans le téléphone
// (elle fonctionne alors même sans internet).
function choisirVoix() {
  if (!syntheseDisponible()) {
    return;
  }
  const normaliser = (langue) => String(langue || '').toLowerCase().replace('_', '-');
  const francaises = window.speechSynthesis.getVoices()
    .filter((voix) => normaliser(voix.lang).startsWith('fr'));
  voixFrancaise =
    francaises.find((voix) => normaliser(voix.lang) === 'fr-fr' && voix.localService) ||
    francaises.find((voix) => normaliser(voix.lang) === 'fr-fr') ||
    francaises.find((voix) => voix.localService) ||
    francaises[0] ||
    null;
}

// Les abréviations après lesquelles une phrase ne s'arrête pas :
// une initiale (« M. Nom ») ou un titre (« Dr. Nom », « Mme. Nom »).
const ABREVIATION_A_LA_FIN = /(?:^|[\s('’])(?:\p{Lu}|Dr|Dre|Pr|Mme|Mlle)$/u;

// Découpe un texte en phrases (la voix lit mieux des phrases courtes).
// On coupe seulement après un point (ou « ! », « ? », « … ») suivi d'une espace, ou en fin de ligne :
// une dose comme « 0.5 g » ou un numéro comme « 01.00.00.00.00 » reste entier,
// et la voix le lit d'un seul tenant (sinon : « zéro », une pause, puis « 5 g »).
// On ne coupe pas non plus après une abréviation : « Dr. Nom » est lu d'un seul tenant.
function decouperEnPhrases(texte) {
  return nettoyer(texte)
    .split(/\n+/)
    .flatMap((ligne) => ligne
      // Chaque fin de phrase est marquée par un retour à la ligne, puis on coupe à ces endroits.
      .replace(/([.!?…])\s+/g, (tout, signe, position) =>
        (ABREVIATION_A_LA_FIN.test(ligne.slice(0, position)) ? tout : signe + '\n'))
      .split('\n'))
    .map((phrase) => phrase.trim())
    .filter(Boolean);
}

// Prépare le texte lu par le bouton « Écouter » : toute la fiche, dans l'ordre de l'écran,
// en sautant les cases vides. On commence par se présenter (« Bonjour. Je m'appelle… »).
function phrasesDeLaFiche(f) {
  const phrases = [];
  const moi = nomComplet(f.prenom, f.nom);
  const conjoint = nomComplet(f.conjointPrenom, f.conjointNom);
  const telephone = nettoyer(f.conjointTelephone);

  phrases.push(moi ? 'Bonjour. Je m’appelle ' + moi + '.' : 'Bonjour.');

  // 1. Le conjoint
  if (conjoint) {
    phrases.push('En cas de besoin, vous pouvez appeler mon conjoint, ' + conjoint + '.');
  } else if (telephone) {
    phrases.push('En cas de besoin, vous pouvez appeler mon conjoint.');
  }
  if (telephone) {
    phrases.push('Son numéro de téléphone est le ' + numeroPourVoix(telephone) + '.');
  }

  // 2. Ce que je souhaite que l'on sache
  decouperEnPhrases(f.message).forEach((phrase) => phrases.push(phrase));

  // 3. Les informations utiles aux secours : le titre de la case, puis ce qui est écrit.
  const informations = INFORMATIONS_SECOURS.filter((information) => nettoyer(f[information.champ]));
  if (informations.length > 0) {
    phrases.push('Informations utiles aux secours.');
    informations.forEach((information) => {
      phrases.push(information.titre + ' :');
      decouperEnPhrases(f[information.champ]).forEach((phrase) => phrases.push(phrase));
    });
  }

  // 4. Les personnes à prévenir
  const personnes = personnesDeLaFiche(f);
  if (personnes.length > 0) {
    phrases.push(personnes.length === 1 ? 'Personne à prévenir.' : 'Personnes à prévenir.');
    personnes.forEach((personne) => {
      const nom = [personne.prenom, personne.lien].filter(Boolean).join(', ');
      if (nom) {
        phrases.push(nom + '.');
      }
      if (personne.telephone) {
        phrases.push((nom ? 'Son numéro de téléphone est le ' : 'Numéro de téléphone : le ') +
          numeroPourVoix(personne.telephone) + '.');
      }
    });
  }

  // 5. Les numéros d'urgence (toujours lus)
  phrases.push('Numéros d’urgence : le 15, et le 112.');
  phrases.push('Cette fiche ne remplace pas un appel aux secours.');
  return phrases;
}

// Change le bouton « Écouter » en « Arrêter la lecture », et inversement.
// (Le bouton concerné est celui qui a lancé la lecture : fiche, ou phrase d'un appel.)
function marquerLecture(enCours) {
  enLecture = enCours;
  if (boutonLecture) {
    boutonLecture.querySelector('span').textContent = enCours ? 'Arrêter la lecture' : 'Écouter';
    boutonLecture.querySelector('use').setAttribute('href', enCours ? '#icone-arreter' : '#icone-ecouter');
  }
}

function finDeLecture() {
  clearInterval(surveillanceLecture);
  surveillanceLecture = null;
  phrasesEnCours = [];
  marquerLecture(false);
  boutonLecture = null;
}

function arreterLecture() {
  numeroLecture += 1;            // les messages de l'ancienne lecture seront ignorés
  if (syntheseDisponible()) {
    window.speechSynthesis.cancel();
  }
  finDeLecture();
}

function signalerProblemeVoix(texte, type) {
  afficherMessage(zoneDeMessageActuelle(), texte, type || 'erreur');
}

// Lit une liste de phrases à voix haute, à la vitesse choisie.
// bouton (facultatif) : le bouton « Écouter » qui devient « Arrêter la lecture » pendant la lecture.
function parler(phrases, bouton) {
  if (!syntheseDisponible()) {
    signalerProblemeVoix('La lecture à voix haute n’est pas possible sur cet appareil.');
    return;
  }
  arreterLecture();
  if (!voixFrancaise) {
    choisirVoix();
  }
  if (!voixFrancaise && window.speechSynthesis.getVoices().length > 0) {
    signalerProblemeVoix('Aucune voix française n’est installée. La lecture peut être mal prononcée.', 'info');
  }

  const numero = numeroLecture;
  const debut = performance.now();
  boutonLecture = bouton || null;
  marquerLecture(true);

  // Petite pause : certains navigateurs ignorent une lecture lancée juste après un arrêt.
  setTimeout(() => {
    if (numero !== numeroLecture) {
      return;   // la lecture a été arrêtée entre-temps
    }
    phrasesEnCours = phrases.map((texte, index) => {
      const enonce = new SpeechSynthesisUtterance(texte);
      enonce.lang = 'fr-FR';
      if (voixFrancaise) {
        enonce.voice = voixFrancaise;
      }
      enonce.rate = reglages.vitesse;
      enonce.onerror = (evenement) => {
        // « interrupted » et « canceled » : c'est nous qui avons arrêté la lecture.
        if (numero !== numeroLecture || evenement.error === 'interrupted' || evenement.error === 'canceled') {
          return;
        }
        arreterLecture();
        signalerProblemeVoix('La voix ne fonctionne pas. Vérifiez la synthèse vocale dans les réglages du téléphone.');
      };
      if (index === phrases.length - 1) {
        enonce.onend = () => {
          if (numero === numeroLecture) {
            finDeLecture();
          }
        };
      }
      return enonce;
    });
    phrasesEnCours.forEach((enonce) => window.speechSynthesis.speak(enonce));

    // Sécurité : si le navigateur oublie de signaler la fin, on la détecte nous-mêmes.
    surveillanceLecture = setInterval(() => {
      const synthese = window.speechSynthesis;
      if (numero !== numeroLecture) {
        clearInterval(surveillanceLecture);
        return;
      }
      if (performance.now() - debut > 2000 && !synthese.speaking && !synthese.pending) {
        finDeLecture();
      }
    }, 1000);
  }, 150);
}

// Bouton « Écouter » / « Arrêter la lecture » de la fiche.
function basculerLecture() {
  if (enLecture) {
    arreterLecture();
  } else {
    parler(phrasesDeLaFiche(fiche || {}), element('bouton-ecouter'));
  }
}


/* ---------- 12. Le plein écran ---------- */

function ouvrirPleinEcran() {
  ouvrirEcran('plein');
  // Demande au téléphone de cacher ses barres, si c'est possible.
  const racine = document.documentElement;
  if (racine.requestFullscreen && !document.fullscreenElement) {
    racine.requestFullscreen({ navigationUI: 'hide' }).catch(() => {});
  }
}

function quitterPleinEcranDuTelephone() {
  if (document.fullscreenElement && document.exitFullscreen) {
    document.exitFullscreen().catch(() => {});
  }
  libererEcran();
}

// Si on quitte le plein écran avec le bouton « retour » du téléphone, on revient à la fiche.
// Mais le téléphone quitte aussi le plein écran quand l'application passe en arrière-plan
// (appel reçu, écran verrouillé, appui sur « Urgence : 15 »…). Dans ce cas, on reste
// sur l'écran « Plein écran ». On attend donc un court instant, puis on vérifie
// que l'application n'est pas passée en arrière-plan (ni revenue) à ce moment-là.
function quandLePleinEcranChange() {
  if (document.fullscreenElement || ecranActuel !== 'plein') {
    return;
  }
  const sortie = performance.now();
  setTimeout(() => {
    const arrierePlan = document.visibilityState !== 'visible' ||
      Math.abs(heureDuChangementDeVisibilite - sortie) < 1000;
    if (!arrierePlan && !document.fullscreenElement && ecranActuel === 'plein') {
      revenirALaFiche();
    }
  }, 500);
}

// Empêche l'écran de s'éteindre pendant qu'on montre la fiche (si le téléphone le permet).
async function garderEcranAllume() {
  if (!('wakeLock' in navigator)) {
    return;
  }
  try {
    const verrou = await navigator.wakeLock.request('screen');
    if (ecranActuel === 'plein') {
      verrouEcran = verrou;
    } else {
      verrou.release().catch(() => {});
    }
  } catch (erreur) {
    verrouEcran = null;
  }
}

function libererEcran() {
  if (verrouEcran) {
    verrouEcran.release().catch(() => {});
    verrouEcran = null;
  }
}

// L'application passe en arrière-plan, ou revient au premier plan.
// Le téléphone retire le verrou de l'écran en arrière-plan : on le reprend au retour.
function quandLaVisibiliteChange() {
  heureDuChangementDeVisibilite = performance.now();   // voir quandLePleinEcranChange()
  if (document.visibilityState === 'visible' && ecranActuel === 'plein') {
    garderEcranAllume();
  }
}


/* ---------- 13. Les boutons ---------- */

// Anti-rebond : un appui trop proche du précédent est ignoré.
// Cela vaut pour les boutons, les liens et les grandes cases à cocher
// (un double appui involontaire cocherait puis décocherait la case).
// « true » à la fin : cette vérification passe avant toutes les autres.
function filtrerLesAppuisTropRapides(evenement) {
  const cible = evenement.target.closest('button, a, .case-a-cocher');
  if (!cible) {
    return;
  }
  // Toucher le texte d'une case à cocher produit deux « clics » à la suite
  // (le texte, puis la case) : c'est le même appui, on laisse passer le second.
  if (cible === appuiEnCours) {
    return;
  }
  const maintenant = performance.now();
  if (maintenant - dernierAppui < DELAI_ANTI_REBOND) {
    evenement.preventDefault();
    evenement.stopImmediatePropagation();
    return;
  }
  dernierAppui = maintenant;
  appuiEnCours = cible;
  setTimeout(() => { appuiEnCours = null; }, 0);
}

function brancherLesBoutons() {
  document.addEventListener('click', filtrerLesAppuisTropRapides, true);

  // Les boutons « Retour » en haut des écrans
  document.querySelectorAll('.retour-haut').forEach((bouton) => {
    bouton.addEventListener('click', retourEnArriere);
  });

  element('bouton-ecouter').addEventListener('click', basculerLecture);
  element('bouton-plein-ecran').addEventListener('click', ouvrirPleinEcran);
  element('bouton-reglages').addEventListener('click', () => ouvrirEcran('reglages'));
  element('bouton-aide').addEventListener('click', () => ouvrirEcran('aide'));
  element('bouton-apropos').addEventListener('click', () => ouvrirEcran('apropos'));

  // Dans toutes les grandes cases de texte, le curseur se place à la fin (pour la dictée).
  document.querySelectorAll('textarea').forEach((champ) => {
    champ.addEventListener('focus', quandUneCaseRecoitLeFocus);
    champ.addEventListener('click', quandOnToucheUneCase);
  });

  element('formulaire').addEventListener('submit', enregistrerFiche);
  element('formulaire').addEventListener('keydown', passerALaCaseSuivante);
  element('bouton-annuler').addEventListener('click', annulerModification);

  element('bouton-texte-moins').addEventListener('click', () => changerTaille(-1));
  element('bouton-texte-plus').addEventListener('click', () => changerTaille(+1));
  element('bouton-plus-lent').addEventListener('click', () => changerVitesse(-1));
  element('bouton-plus-rapide').addEventListener('click', () => changerVitesse(+1));
  element('bouton-modifier').addEventListener('click', () => ouvrirEcran('modifier'));
  element('bouton-retour').addEventListener('click', revenirALaFiche);

  element('bouton-fermer').addEventListener('click', revenirALaFiche);

  window.addEventListener('popstate', quandOnReculeDansLHistorique);
  document.addEventListener('fullscreenchange', quandLePleinEcranChange);
  document.addEventListener('visibilitychange', quandLaVisibiliteChange);
}


/* ---------- 14. Le fonctionnement hors ligne ---------- */

// Le « service worker » (fichier sw.js) garde une copie de l'application dans le téléphone.
// Il ne fonctionne qu'en https (GitHub Pages) ou sur l'ordinateur via « localhost ».
function preparerHorsLigne() {
  if (!('serviceWorker' in navigator)) {
    return;
  }
  const adresseLocale = (location.hostname === 'localhost' || location.hostname === '127.0.0.1');
  if (location.protocol !== 'https:' && !adresseLocale) {
    return;
  }
  navigator.serviceWorker.register('./sw.js').catch(() => {
    // Pas grave : l'application marche quand même, mais pas hors ligne.
  });
}

// Demande au navigateur de ne pas effacer les données de l'application
// quand le téléphone manque de place.
function protegerLesDonnees() {
  if (navigator.storage && navigator.storage.persist) {
    navigator.storage.persist().catch(() => {});
  }
}

// Affiche la version installée, en bas des réglages et dans « À propos »
// (pour vérifier une mise à jour). Elle est lue dans le nom de la copie hors ligne :
// « soutien-imc-v3 » → « v3 ». Ainsi, le numéro n'est écrit qu'à un seul endroit : sw.js.
// Sans copie hors ligne (page ouverte depuis un fichier de l'ordinateur), la ligne reste cachée.
function afficherVersion(idZone) {
  const zone = element(idZone);
  try {
    caches.keys().then((noms) => {
      const numeros = noms
        .filter((nom) => nom.startsWith('soutien-imc-v'))
        .map((nom) => parseInt(nom.slice('soutien-imc-v'.length), 10))
        .filter((numero) => numero > 0);
      if (numeros.length > 0) {
        zone.textContent = 'Version installée : v' + Math.max(...numeros) + '.';
        zone.hidden = false;
      }
    }).catch(() => {});
  } catch (erreur) {
    // Pas de copie hors ligne (page ouverte depuis un fichier) : rien à afficher.
  }
}


/* ---------- 15. Le démarrage ---------- */

function demarrer() {
  // 1. Les réglages mémorisés (taille du texte, vitesse de la voix)
  const memorises = lireStockage(CLE_REGLAGES) || {};
  if (TAILLES.includes(memorises.taille)) {
    reglages.taille = memorises.taille;
  }
  if (typeof memorises.vitesse === 'number' &&
      memorises.vitesse >= VITESSE_MINIMUM && memorises.vitesse <= VITESSE_MAXIMUM) {
    reglages.vitesse = memorises.vitesse;
  }
  appliquerTaille();
  appliquerVitesse();

  // 2. La fiche enregistrée, remise au format actuel (voir ficheLue()).
  fiche = ficheLue(lireStockage(CLE_FICHE));

  // 3. Les appels : textes modifiés, appels enregistrés, appel en cours (appels.js)
  chargerLesAppels();

  // 4. Les boutons
  brancherLesBoutons();
  brancherLesBoutonsDesAppels();     // appels.js
  brancherLesBoutonsDesDonnees();    // donnees.js

  // 5. La voix (la liste des voix arrive parfois un peu après l'ouverture)
  if (syntheseDisponible()) {
    choisirVoix();
    window.speechSynthesis.addEventListener('voiceschanged', choisirVoix);
  }

  // 6. Le premier écran : la fiche, ou le formulaire si la fiche est vide.
  //    Exception : si le téléphone a fermé l'application pendant un appel,
  //    on revient directement à cet appel (rien n'est perdu).
  const reprise = ficheEstVide(fiche) ? null : ecranAReprendre();   // appels.js
  const premierEcran = reprise || 'accueil';
  preparerEtAfficher(premierEcran, { focus: false });
  if (reprise) {
    annoncerApresChangement('message-' + reprise, 'Vous revenez à votre appel. Rien n’est perdu.', 'info');
  }

  //    On inscrit le chemin depuis la fiche : le bouton « retour » d'Android
  //    remontera ce chemin étape par étape. Après un rechargement de la page,
  //    l'historique peut garder des étapes plus anciennes : on revient d'abord à la première.
  const etapesAvant = (history.state && Number(history.state.profondeur)) || 0;
  if (etapesAvant > 0) {
    quandOnArrive = () => inscrireLeChemin(premierEcran);
    history.go(-etapesAvant);
  } else {
    inscrireLeChemin(premierEcran);
  }

  // 7. Avertissement si le navigateur refuse de garder les données
  if (!stockageDisponible()) {
    afficherMessage(zoneDeMessageActuelle(),
      'Attention : ce navigateur ne peut pas garder la fiche. Ouvrez l’application dans Chrome, sans navigation privée.',
      'erreur');
  }

  // 8. Hors ligne et protection des données
  preparerHorsLigne();
  protegerLesDonnees();
}

// On démarre quand les trois fichiers (app.js, appels.js, donnees.js) sont lus.
document.addEventListener('DOMContentLoaded', demarrer);
