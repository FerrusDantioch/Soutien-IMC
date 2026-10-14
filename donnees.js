/* =============================================================
   donnees.js — l'écran « Mes données »

   - « Sauvegarder dans un fichier » : crée un fichier qui contient
     toute la fiche (avec les secours et les personnes à prévenir),
     les phrases et questions modifiées, et les appels.
     Le fichier arrive dans le dossier « Téléchargements » du téléphone.
   - « Restaurer depuis un fichier » : relit ce fichier et remplace
     les données du téléphone, après une confirmation claire.

   Rien n'est envoyé sur internet : le fichier est créé et lu
   dans le téléphone. Ce fichier utilise les outils de app.js et appels.js.
   ============================================================= */

'use strict';


/* ---------- 1. Les réglages ---------- */

// Le « format » du fichier. À augmenter si la forme des données change un jour.
//  - format 1 (étape 2) : la fiche n'a que les six premières cases ;
//  - format 2 (étape 3) : la fiche a aussi les secours et les personnes à prévenir.
// Les deux formats peuvent être restaurés : dans un fichier au format 1,
// les nouvelles cases sont simplement vides (voir ficheLue() dans app.js).
const FORMAT_DE_SAUVEGARDE = 2;
const FORMATS_ACCEPTES = [1, 2];

// Un fichier plus gros ne peut pas être une sauvegarde de cette application.
const TAILLE_MAXIMUM_DU_FICHIER = 5 * 1024 * 1024;     // 5 mégaoctets

let sauvegardeARestaurer = null;    // le contenu du fichier choisi, en attente de confirmation


/* ---------- 2. L'écran ---------- */

// À chaque ouverture : on montre les deux boutons, sans confirmation en attente.
function afficherMesDonnees() {
  sauvegardeARestaurer = null;
  element('donnees-choix').hidden = false;
  element('donnees-confirmation').hidden = true;
}


/* ---------- 3. Sauvegarder dans un fichier ---------- */

function creerLaSauvegarde() {
  return {
    application: 'soutien-imc',
    format: FORMAT_DE_SAUVEGARDE,
    date: new Date().toISOString(),
    fiche: fiche,
    textes: textesModifies,
    appels: appels
  };
}

// La date du jour pour le nom du fichier : « 2026-10-14 ».
function dateDuJour() {
  const maintenant = new Date();
  const deuxChiffres = (nombre) => String(nombre).padStart(2, '0');
  return maintenant.getFullYear() + '-' + deuxChiffres(maintenant.getMonth() + 1) + '-' + deuxChiffres(maintenant.getDate());
}

function sauvegarderDansUnFichier() {
  const contenu = JSON.stringify(creerLaSauvegarde(), null, 2);
  const fichier = new Blob([contenu], { type: 'application/json' });
  const adresse = URL.createObjectURL(fichier);
  const nom = 'ma-fiche-sauvegarde-' + dateDuJour() + '.json';

  // Un lien invisible (jamais ajouté à la page) déclenche l'enregistrement du fichier.
  const lien = document.createElement('a');
  lien.href = adresse;
  lien.download = nom;
  lien.click();
  setTimeout(() => URL.revokeObjectURL(adresse), 60000);

  afficherMessage('message-donnees',
    'Le fichier « ' + nom + ' » est créé. Il se trouve dans le dossier « Téléchargements » du téléphone.',
    'succes');
}


/* ---------- 4. Restaurer depuis un fichier ---------- */

// Bouton « Restaurer depuis un fichier » : ouvre le sélecteur de fichier du téléphone.
function choisirUnFichier() {
  effacerMessage('message-donnees');
  const champ = element('champ-fichier');
  champ.value = '';          // permet de choisir deux fois de suite le même fichier
  champ.click();
}

// Le fichier est choisi : on le lit et on le vérifie. Rien n'est encore remplacé.
async function lireLeFichierChoisi() {
  const champ = element('champ-fichier');
  const fichier = champ.files && champ.files[0];
  if (!fichier) {
    return;
  }

  let contenu = null;
  if (fichier.size <= TAILLE_MAXIMUM_DU_FICHIER) {
    try {
      contenu = JSON.parse(await fichier.text());
    } catch (erreur) {
      contenu = null;
    }
  }

  const sauvegarde = verifierLaSauvegarde(contenu);
  if (!sauvegarde) {
    afficherMessage('message-donnees', 'Ce fichier n’est pas une sauvegarde de « Ma fiche ». Rien n’a été changé.', 'erreur');
    return;
  }
  sauvegardeARestaurer = sauvegarde;
  montrerLaConfirmation(sauvegarde);
}

// Un texte, raccourci à la longueur permise. Tout ce qui n'est pas du texte devient vide.
function texteSur(valeur, longueur) {
  return typeof valeur === 'string' ? valeur.slice(0, longueur) : '';
}

// Longueurs maximales des cases de la fiche : on les lit dans le formulaire
// (attribut « maxlength » de index.html). Ainsi, elles ne sont écrites qu'à un seul endroit.
// Une case sans « maxlength » (le navigateur répond alors -1) n'est pas raccourcie.
function longueursDeLaFiche() {
  const formulaire = element('formulaire');
  const longueurs = {};
  CHAMPS.forEach((champ) => {
    const maximum = formulaire.elements[champ].maxLength;
    longueurs[champ] = maximum > 0 ? maximum : Infinity;
  });
  return longueurs;
}

// Vérifie le fichier et ne garde que ce que l'application connaît.
// Renvoie null si ce n'est pas une sauvegarde de cette application.
function verifierLaSauvegarde(contenu) {
  if (!contenu || typeof contenu !== 'object' ||
      contenu.application !== 'soutien-imc' || !FORMATS_ACCEPTES.includes(contenu.format)) {
    return null;
  }

  // La fiche (toutes ses cases, y compris les secours et les personnes à prévenir)
  const ficheDuFichier = ficheLue(contenu.fiche, longueursDeLaFiche());

  // Les phrases et questions modifiées, raison par raison
  const textesLus = {};
  const textes = (contenu.textes && typeof contenu.textes === 'object') ? contenu.textes : {};
  RAISONS.forEach((raison) => {
    const texte = textes[raison.id];
    if (!texte || typeof texte !== 'object') {
      return;
    }
    const questions = Array.isArray(texte.questions) ? texte.questions : [];
    const propre = {
      phrase: texteSur(texte.phrase, LONGUEURS.phrase),
      questions: [0, 1, 2].map((rang) => texteSur(questions[rang], LONGUEURS.question))
    };
    if (propre.phrase || propre.questions.some(Boolean)) {
      textesLus[raison.id] = propre;
    }
  });

  // Les appels (seulement ceux qui ont une vraie date écrite en texte :
  // une valeur vide ou un nombre donnerait une fausse date, en 1970)
  const appelsLus = (Array.isArray(contenu.appels) ? contenu.appels : [])
    .filter((appel) => appel && typeof appel === 'object' && typeof appel.date === 'string' &&
                       !isNaN(new Date(appel.date).getTime()))
    .map((appel, rang) => ({
      id: texteSur(appel.id, 40) || String(rang),
      date: new Date(appel.date).toISOString(),
      raison: raisonParId(appel.raison).id,
      professionnel: texteSur(appel.professionnel, LONGUEURS.professionnel),
      avecQui: texteSur(appel.avecQui, LONGUEURS.avecQui),
      decision: texteSur(appel.decision, LONGUEURS.decision),
      notes: texteSur(appel.notes, LONGUEURS.notes),
      termine: appel.termine !== false
    }));

  const date = new Date(contenu.date);
  return {
    date: isNaN(date.getTime()) ? null : date.toISOString(),
    fiche: ficheDuFichier,
    textes: textesLus,
    appels: appelsLus
  };
}

// Confirmation claire avant de remplacer les données.
function montrerLaConfirmation(sauvegarde) {
  const quand = sauvegarde.date ? ' du ' + dateEnToutesLettres(sauvegarde.date) : '';
  element('texte-confirmation').textContent =
    'Votre fiche, vos phrases et vos appels vont être remplacés par ceux du fichier' + quand + '. ' +
    'Les données actuelles de ce téléphone seront effacées.' +
    (sauvegarde.fiche ? '' : ' Ce fichier ne contient pas de fiche : vous devrez la remplir à nouveau.');
  element('donnees-choix').hidden = true;
  element('donnees-confirmation').hidden = false;
  dernierAppui = performance.now(); // un appui en trop, juste après, sera ignoré
  element('titre-confirmation').focus();
}

// Range les trois parties dans le téléphone. En cas de problème (téléphone plein…),
// on remet les anciennes données : rien n'est perdu.
function remplacerLesDonnees(sauvegarde) {
  const cles = [CLE_FICHE, CLE_TEXTES, CLE_APPELS];
  const nouvelles = [sauvegarde.fiche, sauvegarde.textes, sauvegarde.appels];
  const anciennes = cles.map((cle) => {
    try {
      return localStorage.getItem(cle);
    } catch (erreur) {
      return null;
    }
  });

  try {
    cles.forEach((cle, rang) => {
      if (nouvelles[rang] === null) {
        localStorage.removeItem(cle);
      } else {
        localStorage.setItem(cle, JSON.stringify(nouvelles[rang]));
      }
    });
    return true;
  } catch (erreur) {
    cles.forEach((cle, rang) => {
      try {
        if (anciennes[rang] === null) {
          localStorage.removeItem(cle);
        } else {
          localStorage.setItem(cle, anciennes[rang]);
        }
      } catch (autreErreur) { /* Rien d'autre à faire. */ }
    });
    return false;
  }
}

// Bouton « Oui, remplacer mes données ».
function confirmerLaRestauration() {
  const sauvegarde = sauvegardeARestaurer;
  afficherMesDonnees();
  element('titre-donnees').focus();
  if (!sauvegarde) {
    return;
  }
  if (!remplacerLesDonnees(sauvegarde)) {
    afficherMessage('message-donnees', 'Problème : les données n’ont pas pu être remplacées. Rien n’a été changé.', 'erreur');
    return;
  }
  fiche = sauvegarde.fiche;
  textesModifies = sauvegarde.textes;
  appels = sauvegarde.appels;
  if (!fiche) {
    // Le fichier n'avait pas de fiche : on va tout de suite au formulaire « Bienvenue »
    // (et l'historique repart de zéro, pour que le bouton « retour » d'Android reste logique).
    revenirALaFiche();
    annoncerApresChangement('message-modifier',
      'C’est fait. Vos données sont restaurées. Le fichier ne contenait pas de fiche : remplissez-la ici.', 'info');
    return;
  }
  afficherMessage('message-donnees', 'C’est fait. Vos données sont restaurées depuis le fichier.', 'succes');
}

// Bouton « Non, garder mes données ».
function annulerLaRestauration() {
  afficherMesDonnees();
  element('titre-donnees').focus();
  afficherMessage('message-donnees', 'Annulé. Vos données n’ont pas changé.', 'info');
}


/* ---------- 5. Les boutons ---------- */

function brancherLesBoutonsDesDonnees() {
  element('bouton-donnees').addEventListener('click', () => ouvrirEcran('donnees'));
  element('bouton-sauvegarder').addEventListener('click', sauvegarderDansUnFichier);
  element('bouton-restaurer').addEventListener('click', choisirUnFichier);
  element('champ-fichier').addEventListener('change', lireLeFichierChoisi);
  element('bouton-confirmer-restauration').addEventListener('click', confirmerLaRestauration);
  element('bouton-annuler-restauration').addEventListener('click', annulerLaRestauration);
}
