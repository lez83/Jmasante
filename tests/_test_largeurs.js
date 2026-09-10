// Un champ trop étroit tronque son contenu sans erreur. C'est arrivé à
// l'annuaire d'urgence : 71px pour un nom de médecin, 110px pour un
// numéro — le rapport était inversé. Ce test mesure chaque champ visible.
const fs=require('fs');const {JSDOM}=require('jsdom');require('fake-indexeddb/auto');
const {webcrypto}=require('crypto');
const html=fs.readFileSync('../jmsante/www/index.html','utf-8');
const appjs=fs.readFileSync('../jmsante/www/js/app.js','utf-8');
const css=fs.readFileSync('../jmsante/www/css/app.css','utf-8');
console.log('═══ LARGEURS DE L ANNUAIRE D URGENCE ═══');
// jsdom ne calcule pas les largeurs : on vérifie la STRUCTURE du code,
// qui est ce qui a causé le défaut.
const i = appjs.indexOf('f-contact-name');
const bloc = appjs.slice(Math.max(0,i-700), i+400);
const uneLigne = /flex-direction:column/.test(bloc);
const nomLarge = /f-contact-name[^>]*flex:2/.test(bloc) || /flex:2[.\d]*;min-width:0[^>]*f-contact-name/.test(bloc);
const telFixe  = /f-contact-tel[^>]*width:\d+px/.test(bloc);
console.log('  une ligne par contact  :', uneLigne ? '✓' : '⚠ deux colonnes');
console.log('  nom plus large que tél :', nomLarge ? '✓' : '⚠');
console.log('  téléphone en px fixes  :', telFixe ? '⚠ FIGÉ' : '✓ proportionnel');

console.log('\n═══ PERSONNE À PRÉVENIR ═══');
const j = appjs.indexOf('f-pap-nom');
const b2 = appjs.slice(Math.max(0,j-320), j+200);
console.log('  deux lignes    :', /flex-direction:column/.test(b2) ? '✓' : '⚠ sur une ligne');
const ph = (b2.match(/f-pap-nom" placeholder="([^"]*)"/)||[])[1] || "";
console.log('  exemple court  :', ph.length <= 26 ? `✓ "${ph}"` : `⚠ trop long (${ph.length}) : "${ph}"`);

const ok = uneLigne && nomLarge && !telFixe && /flex-direction:column/.test(b2) && ph.length<=26;
console.log('\nERREURS:', ok ? 'aucune' : 'structure à revoir');
process.exit(ok ? 0 : 1);
