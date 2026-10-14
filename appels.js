/* =============================================================
   appels.js — le module « Préparer un appel »

   Le parcours tient en quatre écrans :
     1. Préparer un appel : choisir la raison de l'appel ;
     2. Ma préparation : la phrase pour commencer, les questions, « Appeler » ;
     3. Pendant l'appel : les notes, gardées automatiquement ;
     4. Récapitulatif : avec qui, ce qui a été décidé, « Enregistrer ».
   S'y ajoutent l'écran « Ma phrase et mes questions » (bouton « Modifier »)
   et l'écran « Mes appels » (les 10 derniers appels, en lecture seule).

   Ce fichier utilise les outils de app.js (element, nettoyer, parler,
   ouvrirEcran…). Rien n'est envoyé sur internet : tout reste dans le téléphone.
   ============================================================= */

'use strict';


/* ---------- 1. Les raisons d'appel et les textes proposés ----------
   Pour changer les phrases ou les questions proposées au départ, c'est ici.
   (Dans l'application, le bouton « Modifier » permet aussi de les changer.)
   Le prénom et le nom sont repris de la fiche, au début de la phrase. */

// La fin de chaque phrase pour commencer.
const PHRASE_PRENDRE_LE_TEMPS = 'Je parle lentement, merci de me laisser le temps.';

const RAISONS = [
  {
    id: 'rendez-vous',
    libelle: 'Prendre un rendez-vous',
    motif: 'J’appelle pour prendre un rendez-vous.',
    questions: [
      'Quelle est la prochaine date disponible ?',
      'À quelle heure ?',
      'Dois-je apporter des documents ?'
    ]
  },
  {
    id: 'deplacer',
    libelle: 'Déplacer ou annuler un rendez-vous',
    motif: 'J’appelle pour déplacer ou annuler mon rendez-vous.',
    questions: [
      'Pouvez-vous me donner une autre date ?',
      'À quelle heure ?',
      'Mon ancien rendez-vous est-il bien annulé ?'
    ]
  },
  {
    id: 'ordonnance',
    libelle: 'Renouveler une ordonnance',
    motif: 'J’appelle pour renouveler mon ordonnance.',
    questions: [
      'Dois-je venir en consultation ?',
      'Quand l’ordonnance sera-t-elle prête ?',
      'Comment vais-je la recevoir ?'
    ]
  },
  {
    id: 'traitement',
    libelle: 'Poser une question sur un traitement',
    motif: 'J’appelle pour poser une question sur mon traitement.',
    questions: [
      'Combien de temps dois-je le prendre ?',
      'Que faire si j’oublie une prise ?',
      'Que faire si j’ai un effet gênant ?'
    ]
  },
  {
    id: 'resultat',
    libelle: 'Demander un résultat d’examen',
    motif: 'J’appelle pour avoir le résultat de mon examen.',
    questions: [
      'Le résultat est-il arrivé ?',
      'Comment vais-je le recevoir ?',
      'Dois-je prendre un rendez-vous pour en parler ?'
    ]
  },
  {
    // « Autre raison » : un modèle vide, que la personne remplit elle-même.
    id: 'autre',
    libelle: 'Autre raison',
    motif: '',
    questions: ['', '', '']
  }
];


/* ---------- 2. Les réglages du module ---------- */

// Noms des « tiroirs » où les données sont rangées dans le téléphone.
const CLE_TEXTES = 'soutien-imc.textes';                // phrases et questions modifiées, par raison
const CLE_APPELS = 'soutien-imc.appels';                // les appels enregistrés (le plus récent en premier)
const CLE_APPEL_EN_COURS = 'soutien-imc.appel-en-cours';

// Nombre d'appels montrés dans « Mes appels ». Les plus anciens restent gardés.
const NOMBRE_D_APPELS_AFFICHES = 10;

// Si l'application est rouverte moins de 3 heures après un appel commencé,
// elle revient directement à cet appel (le téléphone l'a peut-être fermée pendant l'appel).
const DELAI_DE_REPRISE = 3 * 60 * 60 * 1000;    // en millisecondes

// Longueurs maximales des textes (les mêmes que « maxlength » dans index.html).
const LONGUEURS = {
  professionnel: 100,
  telephone: 25,
  phrase: 600,
  question: 300,
  notes: 10000,
  avecQui: 100,
  decision: 2000
};


/* ---------- 3. L'état du module (ce qui change pendant l'utilisation) ---------- */

let textesModifies = {};         // ex. : { 'rendez-vous': { phrase: '…', questions: ['…', '', ''] } }
let appels = [];                 // les appels enregistrés
let appelEnCours = null;         // l'appel en préparation ou en cours (ou null)
let problemeDeRangementSignale = false;


/* ---------- 4. Petits outils ---------- */

function raisonParId(id) {
  return RAISONS.find((raison) => raison.id === id) || RAISONS[RAISONS.length - 1];
}

// En français, on met une espace avant « ? », « ! » et « : ». Une espace insécable
// empêche ces signes de partir seuls au début d'une ligne.
function espacesInsecables(texte) {
  return texte.replace(/ ([?!:;»])/g, ' $1').replace(/« /g, '« ');
}

// La phrase pour commencer proposée au départ, avec le prénom et le nom de la fiche.
function phraseParDefaut(raison) {
  const f = fiche || {};
  const moi = nomComplet(f.prenom, f.nom);
  const bonjour = moi ? 'Bonjour, je m’appelle ' + moi + '.' : 'Bonjour.';
  return [bonjour, raison.motif, PHRASE_PRENDRE_LE_TEMPS].filter(Boolean).join(' ');
}

// La phrase et les trois questions d'une raison : le texte modifié s'il existe,
// sinon le texte proposé au départ.
function textesDeLaRaison(idRaison) {
  const raison = raisonParId(idRaison);
  const modifies = textesModifies[raison.id] || {};
  const questionsModifiees = Array.isArray(modifies.questions) ? modifies.questions : [];
  return {
    phrase: nettoyer(modifies.phrase) || phraseParDefaut(raison),
    questions: raison.questions.map((question, rang) => nettoyer(questionsModifiees[rang]) || question)
  };
}

/* ---------- 5. L'appel en cours ----------
   L'appel en cours est rangé dans le téléphone à chaque modification.
   Si le téléphone ferme l'application pendant l'appel, rien n'est perdu. */

function sauverAppelEnCours() {
  if (!appelEnCours) {
    try {
      localStorage.removeItem(CLE_APPEL_EN_COURS);
    } catch (erreur) { /* Rien à faire. */ }
    return true;
  }
  return ecrireStockage(CLE_APPEL_EN_COURS, appelEnCours);
}

// Change une ou plusieurs informations de l'appel en cours, puis les range aussitôt.
// « modifie » garde l'heure de la dernière modification (voir ecranAReprendre()).
function modifierAppelEnCours(changements) {
  if (!appelEnCours) {
    return;
  }
  Object.assign(appelEnCours, changements, { modifie: Date.now() });
  if (!sauverAppelEnCours() && !problemeDeRangementSignale) {
    problemeDeRangementSignale = true;
    afficherMessage(zoneDeMessageActuelle(), 'Attention : ce téléphone ne peut pas garder vos notes.', 'erreur');
  }
}

// Sécurité : quand l'application passe en arrière-plan pendant l'appel
// (écran des notes ou récapitulatif), on range encore une fois ce qui est écrit à l'écran.
function rangerAvantDePartir() {
  if (!appelEnCours) {
    return;
  }
  if (ecranActuel === 'notes') {
    modifierAppelEnCours({ notes: element('champ-notes').value });
  }
  if (ecranActuel === 'recap') {
    modifierAppelEnCours({
      avecQui: element('champ-avec-qui').value,
      decision: element('champ-decision').value
    });
  }
}

// Un appel est « commencé » quand la personne a touché « Appeler » ou « Prendre des notes ».
function appelCommence(appel) {
  return Boolean(appel) && (appel.etape === 'notes' || appel.etape === 'recap');
}

// L'appel contient-il quelque chose d'écrit ?
function appelAContenu(appel) {
  return Boolean(nettoyer(appel.notes) || nettoyer(appel.avecQui) || nettoyer(appel.decision));
}

// Un nouvel appel. On garde le nom et le numéro déjà tapés :
// souvent, on rappelle la même personne.
function nouvelAppel(idRaison, precedent) {
  return {
    id: String(Date.now()),
    raison: idRaison,
    professionnel: precedent ? precedent.professionnel : '',
    telephone: precedent ? precedent.telephone : '',
    cochees: [false, false, false],
    notes: '',
    avecQui: '',
    decision: '',
    debut: null,              // date et heure du début de l'appel
    etape: 'preparation',     // 'preparation', puis 'notes', puis 'recap'
    modifie: Date.now()
  };
}

// Ajoute un appel en haut de « Mes appels ».
// termine = false : l'appel n'est pas allé jusqu'au récapitulatif.
// Renvoie false si le téléphone n'a pas pu le garder.
function rangerDansMesAppels(appel, termine) {
  const enregistrement = {
    id: appel.id,
    date: appel.debut || new Date().toISOString(),
    raison: appel.raison,
    professionnel: nettoyer(appel.professionnel),
    avecQui: nettoyer(appel.avecQui),
    decision: nettoyer(appel.decision),
    notes: nettoyer(appel.notes),
    termine: termine
  };
  const nouvelleListe = [enregistrement].concat(appels);
  if (!ecrireStockage(CLE_APPELS, nouvelleListe)) {
    return false;
  }
  appels = nouvelleListe;
  return true;
}


/* ---------- 6. Écran 1 : choisir la raison de l'appel ---------- */

// Crée un grand bouton par raison (une seule fois, au démarrage).
function creerLesBoutonsDesRaisons() {
  const zone = element('liste-raisons');
  RAISONS.forEach((raison) => {
    const bouton = document.createElement('button');
    bouton.type = 'button';
    bouton.className = 'bouton';
    bouton.textContent = raison.libelle;
    bouton.addEventListener('click', () => choisirRaison(raison.id));
    zone.appendChild(bouton);
  });
}

// S'il y a un appel commencé, on propose de le reprendre.
function afficherRaisons() {
  const reprendre = appelCommence(appelEnCours);
  element('bloc-reprendre').hidden = !reprendre;
  if (reprendre) {
    element('reprendre-raison').textContent = raisonParId(appelEnCours.raison).libelle;
  }
}

// Un appui sur une des six raisons.
function choisirRaison(idRaison) {
  let message = '';

  if (appelCommence(appelEnCours)) {
    // Un appel commencé n'est jamais effacé : s'il contient des notes,
    // il est rangé dans « Mes appels » avant de commencer le nouveau.
    if (appelAContenu(appelEnCours)) {
      if (!rangerDansMesAppels(appelEnCours, false)) {
        afficherMessage('message-raisons', 'Problème : le téléphone ne peut pas ranger votre appel précédent.', 'erreur');
        return;
      }
      message = 'Votre appel précédent n’était pas terminé. Ses notes sont rangées dans « Mes appels ».';
    }
    appelEnCours = nouvelAppel(idRaison, appelEnCours);
  } else if (!appelEnCours || appelEnCours.raison !== idRaison) {
    appelEnCours = nouvelAppel(idRaison, appelEnCours);
  }
  sauverAppelEnCours();

  // « Autre raison » : on commence par écrire la phrase et les questions.
  ouvrirEcran(idRaison === 'autre' ? 'modele' : 'preparation');
  if (message) {
    annoncerApresChangement(zoneDeMessageActuelle(), message, 'info');
  }
}

// Bouton « Reprendre mon appel ».
function reprendreLAppel() {
  ouvrirEcran(appelEnCours.etape === 'recap' ? 'recap' : 'notes');
}


/* ---------- 7. Écran 2 : ma préparation ---------- */

function afficherPreparation() {
  const raison = raisonParId(appelEnCours.raison);
  const textes = textesDeLaRaison(raison.id);

  element('titre-preparation').textContent = raison.libelle;
  element('champ-professionnel').value = appelEnCours.professionnel || '';
  element('champ-numero').value = appelEnCours.telephone || '';
  element('preparation-phrase').textContent = espacesInsecables(textes.phrase);

  // Les questions, en grandes cases à cocher.
  // L'étiquette entoure la case : toucher le texte coche aussi la case.
  const liste = element('liste-questions');
  liste.replaceChildren();
  textes.questions.forEach((question, rang) => {
    if (!question) {
      return;
    }
    const etiquette = document.createElement('label');
    etiquette.className = 'case-a-cocher';
    const caseACocher = document.createElement('input');
    caseACocher.type = 'checkbox';
    caseACocher.checked = Boolean(appelEnCours.cochees[rang]);
    caseACocher.addEventListener('change', () => cocherUneQuestion(rang, caseACocher.checked));
    const texte = document.createElement('span');
    texte.textContent = espacesInsecables(question);
    etiquette.append(caseACocher, texte);
    liste.appendChild(etiquette);
  });
  element('aucune-question').hidden = liste.children.length > 0;

  mettreAJourLeBoutonAppeler();
}

function cocherUneQuestion(rang, cochee) {
  const cochees = appelEnCours.cochees.slice();
  cochees[rang] = cochee;
  modifierAppelEnCours({ cochees: cochees });
}

// Le bouton « Appeler » n'apparaît que si un numéro correct est rempli.
// Sans numéro, l'action principale devient « Prendre des notes ».
function mettreAJourLeBoutonAppeler() {
  const telephone = nettoyer(appelEnCours.telephone);
  const numeroCorrect = Boolean(telephone) && numeroValide(telephone);
  const lien = element('bouton-appeler-pro');
  if (numeroCorrect) {
    lien.href = 'tel:' + numeroPourAppel(telephone);
  } else {
    lien.removeAttribute('href');
  }
  lien.hidden = !numeroCorrect;
  element('bouton-prendre-notes').classList.toggle('principal', !numeroCorrect);

  // Des lettres dans le numéro : on le signale tout de suite, sous la case.
  const champ = element('champ-numero');
  const erreur = element('erreur-numero');
  const caracteresAcceptes = /^\+?[\d\s.\-()]*$/.test(telephone);
  erreur.textContent = caracteresAcceptes ? '' : 'Le numéro ne doit contenir que des chiffres.';
  erreur.hidden = caracteresAcceptes;
  if (caracteresAcceptes) {
    champ.removeAttribute('aria-invalid');
  } else {
    champ.setAttribute('aria-invalid', 'true');
  }
}

function quandLeNumeroChange() {
  modifierAppelEnCours({ telephone: element('champ-numero').value });
  mettreAJourLeBoutonAppeler();
}

// Bouton « Écouter » / « Arrêter la lecture » de la phrase (même voix et même vitesse que la fiche).
function ecouterLaPhrase() {
  if (enLecture) {
    arreterLecture();
    return;
  }
  const phrase = textesDeLaRaison(appelEnCours.raison).phrase;
  parler(decouperEnPhrases(phrase), element('bouton-ecouter-phrase'));
}

// « Appeler » (le lien ouvre aussi l'application Téléphone) ou « Prendre des notes » :
// l'application passe à l'écran des notes. C'est lui qu'on retrouve en revenant de l'appel.
function commencerLAppel() {
  modifierAppelEnCours({
    etape: 'notes',
    debut: appelEnCours.debut || new Date().toISOString()
  });
  ouvrirEcran('notes');
}

// Touche « Entrée » du clavier dans les cases du haut.
function passerAuNumero(evenement) {
  if (evenement.key === 'Enter') {
    evenement.preventDefault();
    element('champ-numero').focus();
  }
}

function fermerLeClavier(evenement) {
  if (evenement.key === 'Enter') {
    evenement.preventDefault();
    evenement.target.blur();
  }
}


/* ---------- 8. Modifier la phrase et les questions ---------- */

function remplirModele() {
  const raison = raisonParId(appelEnCours.raison);
  const textes = textesDeLaRaison(raison.id);
  const autre = (raison.id === 'autre');

  element('titre-modele').textContent = autre ? 'Autre raison' : 'Ma phrase et mes questions';
  element('modele-raison').textContent = autre ? '' : 'Raison de l’appel : ' + raison.libelle;
  element('modele-raison').hidden = autre;
  element('explication-autre').hidden = !autre;

  const formulaire = element('formulaire-modele');
  formulaire.elements.phrase.value = textes.phrase;
  formulaire.elements.question1.value = textes.questions[0];
  formulaire.elements.question2.value = textes.questions[1];
  formulaire.elements.question3.value = textes.questions[2];
}

// Bouton « Enregistrer ». Seul ce qui diffère du texte de départ est gardé :
// une case vide (ou identique au départ) reprend le texte proposé au départ.
function enregistrerModele(evenement) {
  evenement.preventDefault();
  const raison = raisonParId(appelEnCours.raison);
  const formulaire = element('formulaire-modele');

  const phrase = nettoyer(formulaire.elements.phrase.value);
  const phraseModifiee = (phrase && phrase !== phraseParDefaut(raison)) ? phrase : '';
  const questionsModifiees = ['question1', 'question2', 'question3'].map((nom, rang) => {
    const question = nettoyer(formulaire.elements[nom].value);
    return question === raison.questions[rang] ? '' : question;
  });

  const nouveauxTextes = Object.assign({}, textesModifies);
  if (phraseModifiee || questionsModifiees.some(Boolean)) {
    nouveauxTextes[raison.id] = { phrase: phraseModifiee, questions: questionsModifiees };
  } else {
    delete nouveauxTextes[raison.id];
  }

  if (!ecrireStockage(CLE_TEXTES, nouveauxTextes)) {
    afficherMessage('message-modele', 'Problème : le texte n’a pas pu être enregistré dans ce téléphone.', 'erreur');
    return;
  }
  textesModifies = nouveauxTextes;
  ouvrirEcran('preparation');
  annoncerApresChangement('message-preparation', 'C’est enregistré. Votre phrase et vos questions sont à jour.', 'succes');
}

// Boutons « Effacer » : vident une case, puis placent le curseur dedans
// (le clavier s'ouvre, prêt pour la dictée).
function effacerUneCase(idChamp) {
  const champ = element(idChamp);
  champ.value = '';
  champ.focus();
}


/* ---------- 9. Écran 3 : pendant l'appel (notes) ---------- */

function afficherNotes() {
  const textes = textesDeLaRaison(appelEnCours.raison);
  element('notes-phrase').textContent = espacesInsecables(textes.phrase);

  // Aide-mémoire : seulement les questions cochées pendant la préparation.
  const liste = element('notes-questions');
  liste.replaceChildren();
  textes.questions.forEach((question, rang) => {
    if (question && appelEnCours.cochees[rang]) {
      const ligne = document.createElement('li');
      ligne.textContent = espacesInsecables(question);
      liste.appendChild(ligne);
    }
  });
  element('notes-bloc-questions').hidden = liste.children.length === 0;

  element('champ-notes').value = appelEnCours.notes || '';
}

// À chaque lettre tapée ou dictée : on range les notes.
function quandLesNotesChangent() {
  modifierAppelEnCours({ notes: element('champ-notes').value });
}

// Bouton « Terminer ».
function terminerLAppel() {
  const changements = { etape: 'recap', notes: element('champ-notes').value };
  // « Avec qui ai-je parlé ? » : on propose le nom du professionnel, s'il a été rempli.
  if (!nettoyer(appelEnCours.avecQui) && nettoyer(appelEnCours.professionnel)) {
    changements.avecQui = nettoyer(appelEnCours.professionnel);
  }
  modifierAppelEnCours(changements);
  ouvrirEcran('recap');
}


/* ---------- 10. Écran 4 : récapitulatif ---------- */

function afficherRecap() {
  const debut = appelEnCours.debut || new Date().toISOString();
  element('recap-date').textContent = majuscule(dateEnToutesLettres(debut));
  element('recap-raison').textContent = raisonParId(appelEnCours.raison).libelle;
  const notes = nettoyer(appelEnCours.notes);
  element('recap-notes').textContent = notes;
  element('recap-bloc-notes').hidden = !notes;
  element('champ-avec-qui').value = appelEnCours.avecQui || '';
  element('champ-decision').value = appelEnCours.decision || '';
}

function quandLeRecapChange() {
  modifierAppelEnCours({
    avecQui: element('champ-avec-qui').value,
    decision: element('champ-decision').value
  });
}

// Touche « Entrée » dans « Avec qui ai-je parlé ? » : on passe à la case suivante
// (au lieu d'enregistrer trop tôt).
function passerALaDecision(evenement) {
  if (evenement.key === 'Enter') {
    evenement.preventDefault();
    element('champ-decision').focus();
  }
}

// Bouton « Enregistrer » : l'appel rejoint « Mes appels ».
function enregistrerLAppel(evenement) {
  evenement.preventDefault();
  quandLeRecapChange();
  if (!rangerDansMesAppels(appelEnCours, true)) {
    afficherMessage('message-recap', 'Problème : l’appel n’a pas pu être enregistré dans ce téléphone.', 'erreur');
    return;
  }
  appelEnCours = null;
  sauverAppelEnCours();          // l'appel en cours est effacé : il est dans « Mes appels »
  ouvrirEcran('appels');
  annoncerApresChangement('message-appels', 'C’est enregistré. Votre appel est en haut de la liste.', 'succes');
}


/* ---------- 11. Mes appels (lecture seule) ---------- */

function afficherMesAppels() {
  const liste = element('liste-appels');
  liste.replaceChildren();
  // Du plus récent au plus ancien (les dates sont écrites « 2026-10-14T… » : l'ordre alphabétique suffit).
  const duPlusRecent = appels.slice().sort((a, b) => String(b.date).localeCompare(String(a.date)));
  duPlusRecent.slice(0, NOMBRE_D_APPELS_AFFICHES).forEach((appel) => {
    liste.appendChild(creerCarteAppel(appel));
  });
  const aucun = (appels.length === 0);
  element('aucun-appel').hidden = !aucun;
  element('explication-appels').hidden = aucun;
  liste.hidden = aucun;
}

function creerCarteAppel(appel) {
  const carte = document.createElement('li');
  carte.className = 'carte-appel';

  const titre = document.createElement('h2');
  titre.textContent = majuscule(dateEnToutesLettres(appel.date));
  carte.appendChild(titre);

  ajouterUneLigne(carte, 'Raison de l’appel', raisonParId(appel.raison).libelle);
  ajouterUneLigne(carte, 'J’ai parlé avec', appel.avecQui || appel.professionnel);
  ajouterUneLigne(carte, 'Ce qui a été décidé', appel.decision);
  ajouterUneLigne(carte, 'Mes notes', appel.notes);
  if (appel.termine === false) {
    ajouterUneLigne(carte, 'Remarque', 'Cet appel n’a pas été terminé.');
  }
  return carte;
}

// Une étiquette en gras, puis le texte. Rien n'est ajouté si le texte est vide.
function ajouterUneLigne(carte, etiquette, texte) {
  if (!nettoyer(texte)) {
    return;
  }
  const titre = document.createElement('p');
  titre.className = 'etiquette';
  titre.textContent = etiquette;
  const contenu = document.createElement('p');
  contenu.className = 'texte-appel';
  contenu.textContent = texte;
  carte.append(titre, contenu);
}


/* ---------- 12. Le démarrage du module ---------- */

// Lit les données rangées dans le téléphone (appelée par demarrer(), dans app.js).
function chargerLesAppels() {
  const textes = lireStockage(CLE_TEXTES);
  textesModifies = (textes && typeof textes === 'object' && !Array.isArray(textes)) ? textes : {};

  // Seuls les vrais appels sont gardés : une ligne abîmée ne doit pas bloquer « Mes appels ».
  const liste = lireStockage(CLE_APPELS);
  appels = Array.isArray(liste) ? liste.filter((appel) => appel && typeof appel === 'object') : [];

  const enCours = lireStockage(CLE_APPEL_EN_COURS);
  const valide = enCours && typeof enCours === 'object' && RAISONS.some((raison) => raison.id === enCours.raison);
  appelEnCours = valide ? enCours : null;
  if (appelEnCours && !Array.isArray(appelEnCours.cochees)) {
    appelEnCours.cochees = [false, false, false];
  }

  creerLesBoutonsDesRaisons();
}

// Au démarrage : un appel commencé récemment ? On y revient directement.
// Renvoie 'notes', 'recap', ou null.
function ecranAReprendre() {
  if (!appelCommence(appelEnCours)) {
    return null;
  }
  if (Date.now() - (Number(appelEnCours.modifie) || 0) > DELAI_DE_REPRISE) {
    return null;
  }
  return appelEnCours.etape;
}

// Les écrans 2, 3 et 4 ont besoin d'un appel en cours. Sans appel en cours
// (par exemple après « Enregistrer »), on revient à « Préparer un appel ».
function ecranPossible(nom) {
  const ecransDUnAppel = ['preparation', 'modele', 'notes', 'recap'];
  if (ecransDUnAppel.includes(nom) && !appelEnCours) {
    return 'raisons';
  }
  return nom;
}

function brancherLesBoutonsDesAppels() {
  element('bouton-preparer-appel').addEventListener('click', () => ouvrirEcran('raisons'));

  // Écran 1
  element('bouton-reprendre').addEventListener('click', reprendreLAppel);
  element('bouton-mes-appels').addEventListener('click', () => ouvrirEcran('appels'));

  // Écran 2 : tout est rangé à chaque modification
  element('champ-professionnel').addEventListener('input', () => {
    modifierAppelEnCours({ professionnel: element('champ-professionnel').value });
  });
  element('champ-professionnel').addEventListener('keydown', passerAuNumero);
  element('champ-numero').addEventListener('input', quandLeNumeroChange);
  element('champ-numero').addEventListener('keydown', fermerLeClavier);
  element('bouton-ecouter-phrase').addEventListener('click', ecouterLaPhrase);
  element('bouton-modifier-textes').addEventListener('click', () => ouvrirEcran('modele'));
  element('bouton-appeler-pro').addEventListener('click', commencerLAppel);
  element('bouton-prendre-notes').addEventListener('click', commencerLAppel);

  // Modifier la phrase et les questions
  element('formulaire-modele').addEventListener('submit', enregistrerModele);
  element('bouton-annuler-modele').addEventListener('click', retourEnArriere);
  document.querySelectorAll('[data-effacer]').forEach((bouton) => {
    bouton.addEventListener('click', () => effacerUneCase(bouton.dataset.effacer));
  });

  // Écran 3
  element('champ-notes').addEventListener('input', quandLesNotesChangent);
  element('bouton-terminer').addEventListener('click', terminerLAppel);

  // Écran 4
  element('champ-avec-qui').addEventListener('input', quandLeRecapChange);
  element('champ-avec-qui').addEventListener('keydown', passerALaDecision);
  element('champ-decision').addEventListener('input', quandLeRecapChange);
  element('formulaire-recap').addEventListener('submit', enregistrerLAppel);

  // Quand l'application passe en arrière-plan (appel en cours…), on range tout
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      rangerAvantDePartir();
    }
  });
  window.addEventListener('pagehide', rangerAvantDePartir);
}
