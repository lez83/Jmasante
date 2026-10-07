// La relève narrative : elle assemble et cite, elle ne conclut jamais.
const fs = require('fs'); const R = '../jmsante/';
let ko = []; const ck = (l,c) => { console.log(`  ${c?'✓':'⚠'} ${l}`); if(!c) ko.push(l); };
const n = fs.readFileSync(R+'www/js/narratif.js','utf-8');
const e = fs.readFileSync(R+'www/js/essais.js','utf-8');
const sh = fs.readFileSync(R+'www/js/sheets.js','utf-8');
const bd = fs.readFileSync(R+'build.js','utf-8');

console.log('═══ CE QU ELLE NE FAIT PAS ═══');
// ⚠️ « Amélioration », « dégradation », « état stable » sont des
// CONCLUSIONS CLINIQUES : elles appartiennent au soignant.
{ const code = n.replace(/\/\*[\s\S]*?\*\//g, "");   // hors commentaires et écran
  const horsEcran = code.slice(0, code.indexOf("function sheetNarratif"));
  ck('aucun mot de conclusion dans le texte produit',
     !/(amélior|dégrad|aggrav|état stable|se porte)/i.test(horsEcran)); }
ck('et la règle est écrite', /L'APP ASSEMBLE, ELLE NE CONCLUT PAS/.test(n));
ck('dite aussi à l écran', /assemble, elle ne conclut pas<\/b>/.test(n));
// ⚠️ Fabriquer de la prose produirait des tournures qui sonnent juste
// et disent faux.
ck('des fragments, pas de la prose', /ON NE GÉNÈRE PAS DES PHRASES/.test(n)
   && /const NARR_SOINS/.test(n));
// ⚠️ L'app ne sait pas lire « un peu confuse ».
ck('les notes ne sont jamais reformulées', /JAMAIS REFORMULÉES/.test(n)
   && /"— " \+ narrJour\(v\.date\) \+ " : " \+ v\.note\.trim\(\)/.test(n));

console.log('\n═══ CE QU ELLE FAIT ═══');
// ⚠️ Deux nombres et une date, aucun mot qui qualifie.
ck('elle cite la valeur précédente', /précédemment/.test(n));
// ⚠️ Un comptage se vérifie ; « suivi irrégulier » serait un jugement.
ck('elle compte, elle n apprécie pas', /LES COMPTAGES SONT DES FAITS/.test(n)
   && /function narrComptages/.test(n));
// ⚠️ Une alerte ne doit pas se lire comme le reste.
ck('l alerte ouvre le bloc', /t \+= "\\u26A0 " \+ al\.join/.test(n));
// ⚠️ Un chiffre à l'anglaise se relit de travers.
ck('décimales françaises', /const fr = x => String\(x\)\.replace\("\.", ","\)/.test(n));

console.log('\n═══ EN ESSAI, ET SANS EFFET DE BORD ═══');
ck('déclaré comme essai', /cle:"narratif"/.test(e));
ck('module dans la chaîne', /'bilans_fiches','narratif','notes'/.test(bd));
ck('entrée visible seulement en essai', /essaiActif\("narratif"\)/.test(sh));
// ⚠️ La relève est produite à la demande : rien n'entre dans un dossier.
ck('rien n est écrit dans un dossier', !/\.visits\.push|\.docs\.push|p\.note\s*=/.test(n)
   && /essaiData\("narratif"\)/.test(n));
ck('la télégraphique reste disponible', /ne la remplace pas/.test(n));


console.log('\n═══ CE QUI NE VARIE PAS NE S ÉCRIT PAS ═══');
// ⚠️ Reprendre tout le plan de soins à chaque passage allonge la relève
// sans rien apprendre : une glycémie faite trois jours de suite sans
// rien de particulier n'a pas à être dite trois fois.
ck('la règle est posée', /CE QUI NE VARIE PAS NE S'ÉCRIT PAS/.test(n));
ck('seuls les soins hors plan sont détaillés', /const horsPlan = \(der\.soins \|\| \[\]\)\.filter/.test(n));
ck('et ceux qui portent un commentaire', /const commentes = Object\.keys\(der\.soinNotes/.test(n));
ck('le plan tenu tient en quatre mots', /"Soins du plan réalisés\."/.test(n));
// ⚠️ Un soin du plan NON fait est une information, pas un silence.
ck('mais un soin non fait se dit', /"Non réalisé : "/.test(n)
   && /NON fait est une information/.test(n));
// ⚠️ Une constante identique à la veille n'apprend rien ; en alerte, le
// contexte compte et on cite tout.
ck('les constantes stables se taisent', /if \(!bouge && !tout && narrData\(\)\.opts\.silence/.test(n));
ck('sauf en cas d alerte', /narrConstantes\(p, der, avant, al\.length > 0\)/.test(n));
ck('et c est réglable', /\["silence","Taire ce qui ne bouge pas"/.test(n));

console.log('\nERREURS:', ko.length ? ko.join(' · ') : 'aucune');
process.exit(ko.length ? 1 : 0);
