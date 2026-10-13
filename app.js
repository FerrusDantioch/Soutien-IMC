/* =============================================================
   app.js — le comportement de l'application « Ma fiche »

   Ce fichier :
   - lit et enregistre la fiche dans le téléphone (localStorage) ;
   - affiche le bon écran (fiche, formulaire, réglages, plein écran) ;
   - lit la fiche à voix haute (synthèse vocale du navigateur) ;
   - mémorise la taille du texte et la vitesse de la voix ;
   - prépare le fonctionnement hors ligne (service worker).

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
const CHAMPS = ['conjointPrenom', 'conjointNom', 'conjointTelephone', 'prenom', 'nom', 'message'];

// Les écrans : nom court → identifiant (id) dans index.html.
const ECRANS = {
  accueil: 'ecran-accueil',
  modifier: 'ecran-modifier',
  reglages: 'ecran-reglages',
  plein: 'ecran-plein'
};


/* ---------- 2. L'état de l'application (ce qui change pendant l'utilisation) ---------- */

let fiche = null;                 // la fiche enregistrée (ou null si elle est vide)
let reglages = { vitesse: VITESSE_PAR_DEFAUT, taille: TAILLE_PAR_DEFAUT };
let ecranActuel = null;           // l'écran visible en ce moment
let dernierAppui = 0;             // heure du dernier appui accepté (anti-rebond)
let voixFrancaise = null;         // la voix française choisie
let enLecture = false;            // la voix est-elle en train de lire ?
let numeroLecture = 0;            // augmente à chaque lecture (pour ignorer les anciennes)
let phrasesEnCours = [];          // garde les phrases en mémoire pendant la lecture
let surveillanceLecture = null;   // minuterie qui vérifie la fin de la lecture
let verrouEcran = null;           // empêche l'écran de s'éteindre en plein écran


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


/* ---------- 4. Le numéro de téléphone ---------- */

// Garde seulement les chiffres (et un « + » au début) : c'est le format du lien d'appel « tel: ».
function numeroPourAppel(telephone) {
  const texte = nettoyer(telephone);
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
  return /^\+?[\d\s.\-()]+$/.test(texte) && texte.replace(/\D/g, '').length >= 3;
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

function effacerTousLesMessages() {
  ['message-accueil', 'message-modifier', 'message-reglages'].forEach(effacerMessage);
}

// Message affiché juste après un changement d'écran.
// On attend un court instant pour que TalkBack ait le temps de « voir » le nouvel écran.
function annoncerApresChangement(idZone, texte, type) {
  setTimeout(() => afficherMessage(idZone, texte, type), 150);
}

// Zone de message de l'écran visible (pour les problèmes de voix).
function zoneDeMessageActuelle() {
  return ecranActuel === 'reglages' ? 'message-reglages' : 'message-accueil';
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
  dernierAppui = Date.now();
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
function preparerEtAfficher(nom) {
  if (nom === 'modifier') {
    remplirFormulaire(false);
  }
  if (nom === 'plein') {
    afficherFiche();
  }
  afficherEcran(nom);
  if (nom === 'plein') {
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

// Ouvre un écran secondaire (réglages, formulaire, plein écran).
// On l'inscrit dans l'historique : le bouton « retour » d'Android ramène alors à la fiche.
function ouvrirEcran(nom) {
  const methode = (ecranActuel === 'accueil') ? 'pushState' : 'replaceState';
  changerAdresse(methode, { ecran: nom }, '#' + nom);
  preparerEtAfficher(nom);
}

// Revient à la fiche (boutons « Retour », « Annuler », « Fermer »).
function revenirALaFiche() {
  const ecranDansLHistorique = Boolean(history.state && history.state.ecran);
  montrerAccueil();
  if (ecranDansLHistorique) {
    history.back();      // retire l'écran secondaire de l'historique
  } else if (location.hash) {
    changerAdresse('replaceState', null, adresseSansDiese());
  }
}

// Bouton « retour » du téléphone (ou du navigateur).
function quandOnReculeDansLHistorique() {
  const nom = history.state && history.state.ecran;
  if (nom && ECRANS[nom] && !ficheEstVide(fiche)) {
    preparerEtAfficher(nom);
    return;
  }
  const quittaitLeFormulaire = (ecranActuel === 'modifier') && !ficheEstVide(fiche);
  montrerAccueil();
  if (quittaitLeFormulaire) {
    annoncerApresChangement('message-accueil', 'Annulé. Votre fiche n’a pas changé.', 'info');
  }
}


/* ---------- 7. L'écran « Ma fiche » ---------- */

// Écrit un texte dans un élément, et cache l'élément si le texte est vide.
function remplir(id, texte) {
  const cible = element(id);
  cible.textContent = texte;
  cible.hidden = !texte;
}

// Remplit la fiche sur l'écran d'accueil et sur l'écran « Plein écran ».
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
  });

  // Le bouton « Appeler » n'apparaît que s'il y a un numéro.
  const lienAppel = element('bouton-appeler');
  if (telephone) {
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
  effacerErreurTelephone();
  element('titre-modifier').textContent = premiereFois ? 'Bienvenue' : 'Modifier ma fiche';
  element('explication-premiere-fois').hidden = !premiereFois;
  element('bouton-annuler').hidden = premiereFois;
}

function montrerErreurTelephone(texte) {
  const champ = element('champ-conjoint-telephone');
  const erreur = element('erreur-telephone');
  erreur.textContent = texte;
  erreur.hidden = false;
  champ.setAttribute('aria-invalid', 'true');
}

function effacerErreurTelephone() {
  const erreur = element('erreur-telephone');
  erreur.textContent = '';
  erreur.hidden = true;
  element('champ-conjoint-telephone').removeAttribute('aria-invalid');
}

// Bouton « Enregistrer ».
function enregistrerFiche(evenement) {
  evenement.preventDefault();   // la page ne doit pas se recharger
  const formulaire = element('formulaire');

  const nouvelleFiche = {};
  CHAMPS.forEach((champ) => {
    nouvelleFiche[champ] = nettoyer(formulaire.elements[champ].value);
  });

  effacerErreurTelephone();
  effacerMessage('message-modifier');

  if (!numeroValide(nouvelleFiche.conjointTelephone)) {
    montrerErreurTelephone('Le numéro ne doit contenir que des chiffres.');
    afficherMessage('message-modifier', 'La fiche n’est pas enregistrée. Corrigez le numéro de téléphone.', 'erreur');
    element('champ-conjoint-telephone').focus();
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
// (au lieu d'enregistrer la fiche trop tôt).
function passerALaCaseSuivante(evenement) {
  if (evenement.key !== 'Enter' || evenement.target.tagName !== 'INPUT') {
    return;
  }
  evenement.preventDefault();
  const formulaire = element('formulaire');
  const position = CHAMPS.indexOf(evenement.target.name);
  const suivant = formulaire.elements[CHAMPS[position + 1]];
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

// Découpe un texte en phrases (la voix lit mieux des phrases courtes).
function decouperEnPhrases(texte) {
  return nettoyer(texte)
    .split(/\n+/)
    .flatMap((ligne) => ligne.match(/[^.!?…]+[.!?…]*/g) || [])
    .map((phrase) => phrase.trim())
    .filter(Boolean);
}

// Prépare le texte lu par le bouton « Écouter ».
function phrasesDeLaFiche(f) {
  const phrases = [];
  const moi = nomComplet(f.prenom, f.nom);
  const conjoint = nomComplet(f.conjointPrenom, f.conjointNom);
  const telephone = nettoyer(f.conjointTelephone);

  phrases.push(moi ? 'Bonjour. Je m’appelle ' + moi + '.' : 'Bonjour.');
  decouperEnPhrases(f.message).forEach((phrase) => phrases.push(phrase));

  if (conjoint) {
    phrases.push('En cas de besoin, vous pouvez appeler mon conjoint, ' + conjoint + '.');
  } else if (telephone) {
    phrases.push('En cas de besoin, vous pouvez appeler mon conjoint.');
  }
  if (telephone) {
    phrases.push('Son numéro de téléphone est le ' + numeroPourVoix(telephone) + '.');
  }
  return phrases;
}

// Change le bouton « Écouter » en « Arrêter la lecture », et inversement.
function marquerLecture(enCours) {
  enLecture = enCours;
  element('bouton-ecouter-texte').textContent = enCours ? 'Arrêter la lecture' : 'Écouter';
  element('bouton-ecouter-icone').setAttribute('href', enCours ? '#icone-arreter' : '#icone-ecouter');
}

function finDeLecture() {
  clearInterval(surveillanceLecture);
  surveillanceLecture = null;
  phrasesEnCours = [];
  marquerLecture(false);
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
function parler(phrases) {
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
  const debut = Date.now();
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
      if (Date.now() - debut > 2000 && !synthese.speaking && !synthese.pending) {
        finDeLecture();
      }
    }, 1000);
  }, 150);
}

// Bouton « Écouter » / « Arrêter la lecture ».
function basculerLecture() {
  if (enLecture) {
    arreterLecture();
  } else {
    parler(phrasesDeLaFiche(fiche || {}));
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
function quandLePleinEcranChange() {
  if (!document.fullscreenElement && ecranActuel === 'plein') {
    revenirALaFiche();
  }
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

// Le téléphone retire ce verrou quand l'application passe en arrière-plan : on le reprend au retour.
function quandLaPageRedevientVisible() {
  if (document.visibilityState === 'visible' && ecranActuel === 'plein') {
    garderEcranAllume();
  }
}


/* ---------- 13. Les boutons ---------- */

// Anti-rebond : un appui trop proche du précédent est ignoré.
// « true » à la fin : cette vérification passe avant toutes les autres.
function filtrerLesAppuisTropRapides(evenement) {
  if (!evenement.target.closest('button, a')) {
    return;
  }
  const maintenant = Date.now();
  if (maintenant - dernierAppui < DELAI_ANTI_REBOND) {
    evenement.preventDefault();
    evenement.stopImmediatePropagation();
    return;
  }
  dernierAppui = maintenant;
}

function brancherLesBoutons() {
  document.addEventListener('click', filtrerLesAppuisTropRapides, true);

  element('bouton-ecouter').addEventListener('click', basculerLecture);
  element('bouton-plein-ecran').addEventListener('click', ouvrirPleinEcran);
  element('bouton-reglages').addEventListener('click', () => ouvrirEcran('reglages'));

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
  document.addEventListener('visibilitychange', quandLaPageRedevientVisible);
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

  // 2. La fiche enregistrée
  const ficheMemorisee = lireStockage(CLE_FICHE);
  fiche = (ficheMemorisee && typeof ficheMemorisee === 'object') ? ficheMemorisee : null;

  // 3. Les boutons
  brancherLesBoutons();

  // 4. La voix (la liste des voix arrive parfois un peu après l'ouverture)
  if (syntheseDisponible()) {
    choisirVoix();
    window.speechSynthesis.addEventListener('voiceschanged', choisirVoix);
  }

  // 5. Le premier écran : la fiche, ou le formulaire si la fiche est vide
  if (location.hash) {
    changerAdresse('replaceState', null, adresseSansDiese());
  }
  montrerAccueil({ focus: false });

  // 6. Avertissement si le navigateur refuse de garder les données
  if (!stockageDisponible()) {
    afficherMessage(ecranActuel === 'modifier' ? 'message-modifier' : 'message-accueil',
      'Attention : ce navigateur ne peut pas garder la fiche. Ouvrez l’application dans Chrome, sans navigation privée.',
      'erreur');
  }

  // 7. Hors ligne et protection des données
  preparerHorsLigne();
  protegerLesDonnees();
}

demarrer();
