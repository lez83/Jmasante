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

const ORDER_DEV  = ['globals','uikit','storage','seed','ui','sheets','nav','engine','share','fiche','dlu','feuilles','menage','traitement','tendances','dossier','vocal','recueil','docs','dictate','features','seq','sync','pwa','init'];
// seed.js DOIT rester dans l'ordre : chaque module se termine par le mot-clé 'function'
// qui complète le début du module suivant (convention de concaténation).
const ORDER_PROD = ['globals','uikit','storage','seed','ui','sheets','nav','engine','share','fiche','dlu','feuilles','menage','traitement','tendances','dossier','vocal','recueil','docs','dictate','features','seq','sync','pwa','init'];
const ORDER = prod ? ORDER_PROD : ORDER_DEV;

const parts = ORDER.map(name => {
  const file = path.join(__dirname, 'www', 'js', name + '.js');
  return (prod ? '' : `/* ===== ${name}.js ===== */\n`) + fs.readFileSync(file, 'utf-8');
});

const concat = parts.join('\n\n');

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
    const out = result.outputFiles[0].text;
    fs.writeFileSync(path.join(__dirname, 'www', 'js', 'app.js'), out, 'utf-8');
    console.log(`✓ app.js PROD généré (${Math.round(out.length/1024)} Ko, minifié)`);
  } catch(e){
    // esbuild non installé → fallback concaténation simple
    fs.writeFileSync(path.join(__dirname, 'www', 'js', 'app.js'), concat, 'utf-8');
    console.log(`✓ app.js PROD généré sans minification (esbuild absent) — installez-le : npm i -D esbuild`);
  }
} else {
  fs.writeFileSync(path.join(__dirname, 'www', 'js', 'app.js'), concat, 'utf-8');
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
    'dictate.js':  'function dictate',
    'features.js': 'function sheetWelcome',
    'seq.js':      'function renderSeq',
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
