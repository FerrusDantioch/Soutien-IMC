/* Ma fiche (Soutien-IMC) — © 2026 Ferrus Dantioch
   Licence : Creative Commons BY-NC-ND 4.0 (texte complet dans le fichier LICENSE)
   https://creativecommons.org/licenses/by-nc-nd/4.0/ */

/* ============================================================
   Tests automatiques de Ma fiche.
   Ils ouvrent l'application dans un vrai navigateur (Chromium, piloté
   par Playwright), remplissent la fiche comme une personne, et vérifient
   surtout que chaque bouton « Appeler » compose LE BON numéro.
   Rien n'est envoyé sur internet et aucun appel n'est passé.

   Lancer (Playwright doit être installé) :  node tests/tester.js
   ============================================================ */
'use strict';
const { lancer, section, verifier, nouvellePage, controlesCommuns } = require('./outils.js');

const lien = (p, sel) => p.$eval(sel, (a) => a.getAttribute('href'));
/* Appui sur un bouton qui change d'écran : on laisse le temps au
   changement (transition lente, 400 ms) de se terminer. */
async function aller(p, sel) { await p.click(sel); await p.waitForTimeout(600); }
const visible = (p, sel) => p.$eval(sel, (el) => !el.closest('[hidden]') && el.getClientRects().length > 0);

lancer('Ma fiche', async () => {
  await controlesCommuns({ serviceWorker: 'sw.js' });

  const { ctx, p } = await nouvellePage();
  await p.waitForTimeout(800);

  await section('Première ouverture : remplir la fiche', async () => {
    if (!(await visible(p, '#formulaire'))) { await aller(p, '#bouton-reglages'); await aller(p, '#bouton-modifier'); }
    verifier(await visible(p, '#formulaire'), 'le formulaire de la fiche s’affiche');
    await p.fill('#champ-conjoint-prenom', 'Camille');
    await p.fill('#champ-conjoint-nom', 'Martin');
    await p.fill('#champ-conjoint-telephone', '06 12 34 56 78');
    await p.fill('#champ-prenom', 'Alex');
    await p.fill('#champ-allergies', 'Pénicilline');
    await p.fill('#champ-personne1-prenom', 'Sam');
    await p.fill('#champ-personne1-telephone', '+33 (0)7 11 22 33 44');
    await p.click('#formulaire [type="submit"]');
    await p.waitForTimeout(500);
    verifier(await visible(p, '#ecran-accueil'), 'retour à l’accueil après « Enregistrer »');
  });

  await section('Les numéros composés sont les bons', async () => {
    verifier(await lien(p, '#bouton-appeler') === 'tel:0612345678', 'Appeler mon conjoint → 0612345678', await lien(p, '#bouton-appeler'));
    const personnes = await p.$$eval('#accueil-personnes a[href^="tel:"]', (l) => l.map((a) => a.getAttribute('href')));
    verifier(personnes.includes('tel:+33711223344'), 'le « (0) » après +33 est retiré', personnes);
    const urgences = await p.$$eval('a.urgence', (l) => [...new Set(l.map((a) => a.getAttribute('href')))]);
    verifier(urgences.includes('tel:15') && urgences.includes('tel:112'), 'boutons d’urgence 15 et 112', urgences);
    const texte = await p.textContent('#accueil-conjoint-telephone');
    verifier(texte.replace(/\s/g, ' ') === '06 12 34 56 78', 'numéro affiché par paires', texte);
    verifier((await p.textContent('#accueil-secours')).includes('Pénicilline'), 'les allergies sont affichées');
  });

  await section('Un numéro avec des lettres est refusé', async () => {
    await aller(p, '#bouton-reglages');
    await aller(p, '#bouton-modifier');
    await p.fill('#champ-conjoint-telephone', '06 12 AB');
    await p.click('#formulaire [type="submit"]');
    await p.waitForTimeout(300);
    verifier(await visible(p, '#erreur-telephone'), 'un message d’erreur s’affiche sous la case');
    verifier(await visible(p, '#formulaire'), 'la fiche n’est pas enregistrée');
    await p.fill('#champ-conjoint-telephone', '06 12 34 56 78');
    await p.click('#formulaire [type="submit"]');
    await p.waitForTimeout(300);
  });

  await section('La fiche reste après fermeture', async () => {
    await p.reload();
    await p.waitForTimeout(800);
    verifier((await p.textContent('#accueil-conjoint-nom')).includes('Camille'), 'le conjoint est toujours là');
    verifier(await lien(p, '#bouton-appeler') === 'tel:0612345678', 'et son numéro aussi');
  });

  await section('Plein écran', async () => {
    await aller(p, '#bouton-plein-ecran');
    verifier(await visible(p, '#ecran-plein'), 'la fiche s’affiche en plein écran');
    verifier((await p.textContent('#plein-conjoint-telephone')).includes('06'), 'avec le numéro du conjoint');
    await p.click('#bouton-fermer');
  });

  await ctx.close();
});
