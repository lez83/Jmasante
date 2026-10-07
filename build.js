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

const ORDER_DEV  = ['globals','uikit','storage','seed','ui','sheets','nav','engine','share','fiche','dlu','feuilles','menage','traitement','tendances','dossier','vocal','recueil','docs','plaies','dictate','features','seq','cabinet','guide','guide26','modeles','dispositifs','calculs','bilans','bilans_fiches','medicaments_base','medicaments','narratif','notes','detente','eggs','essais','sync','pwa','init'];
// seed.js DOIT rester dans l'ordre : chaque module se termine par le mot-clé 'function'
// qui complète le début du module suivant (convention de concaténation).
const ORDER_PROD = ['globals','uikit','storage','seed','ui','sheets','nav','engine','share','fiche','dlu','feuilles','menage','traitement','tendances','dossier','vocal','recueil','docs','plaies','dictate','features','seq','cabinet','guide','guide26','modeles','dispositifs','calculs','bilans','bilans_fiches','medicaments_base','medicaments','narratif','notes','detente','eggs','essais','sync','pwa','init'];
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
  fs.writeFileSync('www/index.html', html);
  console.log(`✓ ressources marquées v${v}`);
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

  // 1. Syntaxe valide ?
  try { new Function(out); }
  catch(e){ errors.push('SYNTAXE INVALIDE : ' + e.message); }

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
