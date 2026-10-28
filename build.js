#!/usr/bin/env node
/**
 * build.js — JM@Santé
 * Usage :
 *   node build.js          → dev  : concaténation simple, seed inclus
 *   node build.js --prod   → prod : minification esbuild (seed inclus : requis par la chaîne de concaténation)
 */
const fs   = require('fs');
const path = require('path');
const prod = process.argv.includes('--prod');

const ORDER_DEV  = ['globals','uikit','storage','seed','ui','sheets','nav','engine','share','fiche','dlu','feuilles','menage','traitement','tendances','dossier','vocal','recueil','docs','plaies','dictate','features','seq','cabinet','guide','guide26','modeles','dispositifs','calculs','bilans','bilans_fiches','medicaments_base','medicaments','narratif','notes','alertes','detente','eggs','essais','sync','pwa','init'];
// seed.js DOIT rester dans l'ordre : chaque module se termine par le mot-clé 'function'
// qui complète le début du module suivant (convention de concaténation).
const ORDER_PROD = ['globals','uikit','storage','seed','ui','sheets','nav','engine','share','fiche','dlu','feuilles','menage','traitement','tendances','dossier','vocal','recueil','docs','plaies','dictate','features','seq','cabinet','guide','guide26','modeles','dispositifs','calculs','bilans','bilans_fiches','medicaments_base','medicaments','narratif','notes','alertes','detente','eggs','essais','sync','pwa','init'];
const ORDER = prod ? ORDER_PROD : ORDER_DEV;

const parts = ORDER.map(name => {
  const file = path.join(__dirname, 'www', 'js', name + '.js');
  return (prod ? '' : `/* ===== ${name}.js ===== */\n`) + fs.readFileSync(file, 'utf-8');
});

const concat = parts.join('\n\n');

/* ⚠️ La minification efface les commentaires : l'en-tête de propriété
   doit être réinjecté APRÈS, sinon le fichier livré ne porte plus aucune
   mention d'auteur — c'est justement celui qu'on retrouve copié. */
const ENTETE = `/*! JM@Santé — Copyright (c) 2026 JmCve83. Tous droits réservés.
 * Reproduction, redistribution et décompilation interdites sans
 * autorisation écrite. https://github.com/lez83/Jmasante */
`;

/* ⚠️ PIÈGE RENCONTRÉ TROIS FOIS : un commentaire glissé entre `async` et
   `function` casse le chargement de l'app. `node --check` sur un module
   ne le voit pas — chaque module est volontairement incomplet, il se
   referme sur le suivant. On contrôle donc ICI, sur l'assemblage. */
{
  const orph = [];
  concat.split("\n").forEach((l, n) => {
    if (/\basync\b\s*(\/\*|\/\/)/.test(l)) orph.push(n + 1);
  });
  if (orph.length){
    console.error("✗ `async` orphelin — un commentaire est inséré juste après, lignes : "
      + orph.join(", "));
    process.exit(1);
  }
}

if (prod){
  // Minification via esbuild (si installé), sinon avertissement
  try {
    const { buildSync } = require('esbuild');
    const result = buildSync({
      stdin: { contents: concat, loader: 'js' },
      bundle: false,
      minify: true,
      write: false,
    });
    const out = ENTETE + result.outputFiles[0].text;
    fs.writeFileSync(path.join(__dirname, 'www', 'js', 'app.js'), out, 'utf-8');
    console.log(`✓ app.js PROD généré (${Math.round(out.length/1024)} Ko, minifié)`);
  } catch(e){
    // esbuild non installé → fallback concaténation simple
    fs.writeFileSync(path.join(__dirname, 'www', 'js', 'app.js'), ENTETE + concat, 'utf-8');

/* ⚠️ Le numéro de version du manuel était écrit EN DUR : il restait figé
   à une version ancienne à chaque montée, et l'app annonçait 1.0.68 alors
   qu'elle était en 1.0.79. La compilation l'écrit désormais elle-même. */
try {
  const manuel = path.join(__dirname, 'www', 'manuel.html');
  if (fs.existsSync(manuel)){
    const v = require('./package.json').version;
    const d = new Date().toLocaleDateString('fr-FR');
    let m = fs.readFileSync(manuel, 'utf-8');
    const avant = m;
    m = m.replace(/class="ver">[^<]*</,
                  'class="ver">Mode d\'emploi complet · version ' + v + ' · ' + d + '<');
    if (m !== avant){ fs.writeFileSync(manuel, m, 'utf-8'); console.log('✓ manuel.html → v' + v); }

    /* ⚠️ LE LIVRABLE ÉTAIT UNE COPIE FIGÉE, ET IL AVAIT DÉRIVÉ : le
       manuel embarqué comptait 38 chapitres quand JMSante_Mode_emploi.html
       en annonçait encore 15, sans la synchro, le cabinet, le coffre ni
       le traitement. Deux documents qui disent des choses différentes
       sont pires qu'un seul. La copie est refaite à chaque compilation :
       une seule source, le manuel de l'app. */
    const livrable = path.join(__dirname, 'JMSante_Mode_emploi.html');
    const avantL = fs.existsSync(livrable) ? fs.readFileSync(livrable, 'utf-8') : '';
    if (avantL !== m){
      fs.writeFileSync(livrable, m, 'utf-8');
      console.log('✓ JMSante_Mode_emploi.html régénéré depuis le manuel');
    }
  }
} catch(e){ console.warn('manuel.html : version non mise à jour', e.message); }

    console.log(`✓ app.js PROD généré sans minification (esbuild absent) — installez-le : npm i -D esbuild`);
  }
} else {
  fs.writeFileSync(path.join(__dirname, 'www', 'js', 'app.js'), ENTETE + concat, 'utf-8');

/* ⚠️ Le numéro de version du manuel était écrit EN DUR : il restait figé
   à une version ancienne à chaque montée, et l'app annonçait 1.0.68 alors
   qu'elle était en 1.0.79. La compilation l'écrit désormais elle-même. */
try {
  const manuel = path.join(__dirname, 'www', 'manuel.html');
  if (fs.existsSync(manuel)){
    const v = require('./package.json').version;
    const d = new Date().toLocaleDateString('fr-FR');
    let m = fs.readFileSync(manuel, 'utf-8');
    const avant = m;
    m = m.replace(/class="ver">[^<]*</,
                  'class="ver">Mode d\'emploi complet · version ' + v + ' · ' + d + '<');
    if (m !== avant){ fs.writeFileSync(manuel, m, 'utf-8'); console.log('✓ manuel.html → v' + v); }

    /* ⚠️ LE LIVRABLE ÉTAIT UNE COPIE FIGÉE, ET IL AVAIT DÉRIVÉ : le
       manuel embarqué comptait 38 chapitres quand JMSante_Mode_emploi.html
       en annonçait encore 15, sans la synchro, le cabinet, le coffre ni
       le traitement. Deux documents qui disent des choses différentes
       sont pires qu'un seul. La copie est refaite à chaque compilation :
       une seule source, le manuel de l'app. */
    const livrable = path.join(__dirname, 'JMSante_Mode_emploi.html');
    const avantL = fs.existsSync(livrable) ? fs.readFileSync(livrable, 'utf-8') : '';
    if (avantL !== m){
      fs.writeFileSync(livrable, m, 'utf-8');
      console.log('✓ JMSante_Mode_emploi.html régénéré depuis le manuel');
    }
  }
} catch(e){ console.warn('manuel.html : version non mise à jour', e.message); }

  // Marqueur de version sur les ressources : sans lui, le WebView Android
// peut servir le CSS d'une ancienne installation avec le nouveau JS —
// l'interface s'affiche mais plus rien ne répond. (cache-bust)
{
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf-8'));
  const v = pkg.version;
  /* Android exige un versionCode qui ne recule JAMAIS : il vit à part
     du numéro affiché (v1.0.01), qui lui est fait pour être lu. */
  const build = pkg.androidVersionCode || 1;
  let html = fs.readFileSync('www/index.html', 'utf-8');
  html = html.replace(/href="css\/app\.css(\?v=[^"]*)?"/, `href="css/app.css?v=${v}"`);
  html = html.replace(/src="js\/app\.js(\?v=[^"]*)?"/,   `src="js/app.js?v=${v}"`);
  /* ⚠️ Le numéro du PIED DE PAGE était écrit en dur lui aussi : il
     annonçait v1.7.3 alors que l'app était en 1.10.0 — sept versions de
     retard, sous les yeux de l'utilisateur à chaque écran d'accueil.
     Troisième numéro recopié à la main trouvé dans ce dépôt ; comme les
     deux autres, il est désormais écrit ici. */
  /* ⚠️ On vérifie que le MOTIF EXISTE, pas que le texte a changé : une
     reconstruction sans montée de version laisse le pied de page
     identique, et mon premier contrôle criait au loup à chaque fois. */
  const motif = /JM@Santé v[\d.]+ —/;
  if (!motif.test(html)) console.warn('⚠ pied de page : numéro de version introuvable dans index.html');
  html = html.replace(motif, `JM@Santé v${v} —`);
  fs.writeFileSync('www/index.html', html);
  console.log(`✓ ressources et pied de page marqués v${v}`);

  /* ⚠️ LE SERVICE WORKER AUSSI, ET C'EST LE PLUS IMPORTANT DES TROIS.
     Son nom de cache était écrit EN DUR — « jmsante-v215 » — et n'avait
     pas bougé depuis des dizaines de versions. Comme le code qui efface
     les vieux caches ne se déclenche que lorsque le NOM change, il ne
     s'est jamais déclenché : l'application servait indéfiniment le code
     de l'installation d'origine. Mesuré en faisant tourner le vrai
     sw.js — quatre rechargements après une mise à jour, toujours
     l'ancien code. L'enveloppe se mettait à jour, le code jamais.
     Quatrième numéro recopié à la main trouvé dans ce dépôt, et de loin
     le plus coûteux : il rendait toutes les livraisons invisibles. */
  let sw = fs.readFileSync('www/sw.js', 'utf-8');
  const mCache = /const CACHE = "jmsante-[^"]*";/;
  if (!mCache.test(sw)) console.warn('⚠ sw.js : nom de cache introuvable — les mises à jour ne partiront pas');
  else {
    sw = sw.replace(mCache, `const CACHE = "jmsante-v${v}";`);
    fs.writeFileSync('www/sw.js', sw);
    console.log(`✓ cache du service worker → jmsante-v${v}`);
  }
}

console.log(`✓ app.js DEV généré (${Math.round(concat.length/1024)} Ko, ${concat.split('\n').length} lignes)`);
}

/* ============================================================
   GARDE-FOU — vérifie que le fichier produit est utilisable.
   La concaténation est fragile (chaque module complète le suivant) :
   retirer un module de ORDER casse silencieusement l'app.
   Ce contrôle transforme ce bug invisible en erreur explicite.
============================================================ */
(function verifyBuild(){
  const out = fs.readFileSync(path.join(__dirname, 'www', 'js', 'app.js'), 'utf-8');
  const errors = [];

  /* ⚠️ LE SERVICE WORKER AUSSI. Un sw.js qui ne se parse pas ne lève
     RIEN de visible : le navigateur refuse l'enregistrement, la page
     tourne sans lui, et on perd le hors ligne — en tournée, sans
     réseau, l'application ne s'ouvre plus. Ça vient d'arriver : un
     `const` posé à l'intérieur de `respondWith(…)`, et la compilation
     a dit « Vérification OK ». Elle ne regardait que app.js. */
  try {
    const sw = fs.readFileSync(path.join(__dirname, 'www', 'sw.js'), 'utf-8');
    try { new Function(sw); }
    catch(e){ errors.push('sw.js : syntaxe invalide — ' + e.message + ' (plus de hors ligne)'); }
    if (!/const CACHE = "jmsante-v[\d.]+";/.test(sw))
      errors.push('sw.js : le nom du cache ne porte pas la version — les mises à jour ne partiront pas');
  } catch(e){ errors.push('sw.js illisible : ' + e.message); }

  // 1. Syntaxe valide ?
  try { new Function(out); }
  catch(e){
    errors.push('SYNTAXE INVALIDE : ' + e.message);
    /* ⚠️ LE PIÈGE DE L'ACCENT GRAVE, rencontré DEUX FOIS.
       Un commentaire HTML écrit à l'intérieur d'un gabarit JS :

           <!-- `type="email"` et ... -->

       L'accent grave referme la chaîne et casse tout le fichier. Le
       contrôle ci-dessus le voyait, mais annonçait « missing ) after
       argument list » quelque part au milieu d'un autre module : on
       cherchait au mauvais endroit. On nomme donc le coupable. */
    /* ⚠️ On découpe D'ABORD les commentaires, PUIS on cherche l'accent
       grave dans chacun. Mon premier jet cherchait l'accent grave
       « quelque part entre un <!-- et un --> » : l'expression traversait
       plusieurs commentaires et accusait cinq modules sains. Un
       garde-fou qui crie au loup ne sert à rien. */
    const vus = [];
    ORDER.forEach(nom => {
      let src = '';
      try { src = fs.readFileSync(path.join(__dirname, 'www', 'js', nom + '.js'), 'utf-8'); }
      catch(_){ return; }
      let m;
      const RX = /<!--((?:(?!-->)[^])*)-->/g;
      while ((m = RX.exec(src))){
        if (!m[1].includes('`')) continue;
        const ligne = src.slice(0, m.index).split('\n').length;
        vus.push('  • ' + nom + '.js, ligne ' + ligne + ' : '
                 + m[0].replace(/\s+/g, ' ').slice(0, 80) + '…');
      }
    });
    if (vus.length)
      errors.push('ACCENT GRAVE DANS UN COMMENTAIRE HTML — il referme le gabarit :\n'
                  + vus.join('\n'));
  }

  // 2. Fonctions vitales présentes ? (une par module — détecte un module manquant)
  const REQUIRED = {
    'uikit.js':    'function uiRow',
    'globals.js':  'function getCatalog',
    'storage.js':  'function openDB',
    'seed.js':     'function seedDemo',
    'ui.js':       'function lastVisit',
    'sheets.js':   'function openSheet',
    'nav.js':      'function navHeader',
    'engine.js':   'function buildReleve',
    'share.js':    'function showReport',
    'fiche.js':    'function sheetExportFiche',
    'dlu.js':      'function sheetDLU',
    'feuilles.js': 'function sheetFeuilles',
    'menage.js':   'function sheetMenage',
    'traitement.js':'function sheetTraitement',
    'tendances.js':'function trendPoints',
    'dossier.js':  'function dossierPossible',
    'vocal.js':    'function voicePossible',
    'recueil.js':  'function sheetRecueil',
    'docs.js':     'function docType',
    'plaies.js':   'function plaieNom',
    'dictate.js':  'function dictate',
    'features.js': 'function sheetWelcome',
    'seq.js':      'function renderSeq',
    'medicaments_base.js':'function medTotalBase',
    'medicaments.js':'function sheetMedicaments',
    'alertes.js':  'function alerteProgrammer',
    'sync.js':     'function sheetSendSync',
    'pwa.js':      'function initPWA'
  };
  for (const [mod, needle] of Object.entries(REQUIRED)){
    if (!out.includes(needle))
      errors.push(`module « ${mod} » absent ou cassé (« ${needle} » introuvable)`);
  }

  // 3. Collage raté : deux "function" qui se suivent
  if (/function\s+function/.test(out))
    errors.push('collage de modules raté : « function function » détecté');

  if (errors.length){
    console.error('\n✗ BUILD INVALIDE — l\'app ne fonctionnerait pas :');
    errors.forEach(e => console.error('   • ' + e));
    console.error('\n  Cause probable : un module a été retiré de ORDER_DEV/ORDER_PROD,');
    console.error('  ou son début/fin a été modifié. Chaque module se termine par le');
    console.error('  mot-clé « function » qui complète la 1re ligne du module suivant.\n');
    process.exit(1);
  }
console.log('✓ Vérification OK — ' + Object.keys(REQUIRED).length + ' modules présents, syntaxe valide');
})();
