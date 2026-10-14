/* =============================================================
   sw.js — le « service worker » de l'application « Ma fiche »

   C'est un petit programme que le navigateur garde en arrière-plan.
   Au premier chargement, il range une copie de tous les fichiers
   de l'application dans le téléphone. Ensuite, l'application
   s'ouvre même sans internet (mode avion, pas de réseau…).

   Ce fichier doit rester à côté de index.html : il ne s'occupe
   que des fichiers de son dossier (et de ses sous-dossiers).
   ============================================================= */

'use strict';

// IMPORTANT : à chaque modification d'un fichier de l'application,
// augmentez ce numéro (v1 → v2 → v3…). Sinon, les téléphones
// continueront d'utiliser l'ancienne copie.
const VERSION = 'v2';

// Le nom de la copie commence par « soutien-imc- » pour ne jamais
// toucher aux copies d'autres sites hébergés à la même adresse.
const PREFIXE = 'soutien-imc-';
const NOM_DE_LA_COPIE = PREFIXE + VERSION;

// La liste des fichiers à garder (chemins relatifs à ce fichier).
const FICHIERS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './appels.js',
  './donnees.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png'
];


// 1. Installation : on range une copie de chaque fichier.
//    { cache: 'reload' } : on demande la version la plus récente au serveur.
self.addEventListener('install', (evenement) => {
  evenement.waitUntil(
    caches.open(NOM_DE_LA_COPIE)
      .then((copie) => copie.addAll(FICHIERS.map((adresse) => new Request(adresse, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});


// 2. Activation : on supprime les anciennes copies de CETTE application seulement.
self.addEventListener('activate', (evenement) => {
  evenement.waitUntil(
    caches.keys()
      .then((noms) => Promise.all(
        noms
          .filter((nom) => nom.startsWith(PREFIXE) && nom !== NOM_DE_LA_COPIE)
          .map((nom) => caches.delete(nom))
      ))
      .then(() => self.clients.claim())
  );
});


// 3. Chaque fois que l'application demande un fichier :
//    on donne d'abord la copie rangée dans le téléphone (rapide, marche sans internet),
//    sinon on va le chercher sur internet.
self.addEventListener('fetch', (evenement) => {
  const requete = evenement.request;

  // On ne s'occupe que des lectures de fichiers de notre propre dossier.
  if (requete.method !== 'GET' || !requete.url.startsWith(self.registration.scope)) {
    return;
  }

  evenement.respondWith(repondre(requete));
});

async function repondre(requete) {
  const copie = await caches.open(NOM_DE_LA_COPIE);
  const options = { ignoreSearch: true, ignoreVary: true };

  const fichierEnCopie = await copie.match(requete, options);
  if (fichierEnCopie) {
    return fichierEnCopie;
  }

  try {
    return await fetch(requete);
  } catch (erreur) {
    // Pas d'internet : pour l'ouverture d'une page, on donne la page d'accueil gardée en copie.
    if (requete.mode === 'navigate') {
      const accueil = await copie.match('./index.html', options);
      if (accueil) {
        return accueil;
      }
    }
    throw erreur;
  }
}
