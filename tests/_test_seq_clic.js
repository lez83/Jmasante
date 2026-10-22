// Pendant le déroulé, tous les éléments du formulaire sont-ils atteignables ?
const fs=require('fs');const {JSDOM}=require('jsdom');require('fake-indexeddb/auto');
const {webcrypto}=require('crypto');
const html=fs.readFileSync('../jmsante/www/index.html','utf-8');
const appjs=fs.readFileSync('../jmsante/www/js/app.js','utf-8');
const css=fs.readFileSync('../jmsante/www/css/app.css','utf-8');
console.log('═══ RÉSERVE BASSE DU MODE DÉROULÉ ═══');
// #seq-mode est hors de .wrap : il lui faut sa propre réserve, sinon le
// dernier bouton passe sous .bottombar (position:fixed, z-index:50)
const m = css.match(/#seq-mode\.on\{[^}]*\}/);
if (!m){ console.log('  ✗ règle #seq-mode.on introuvable'); process.exit(1); }
const regle = m[0];
const aPad = /padding[^;]*\d+px/.test(regle);
const valeur = (regle.match(/padding:[^;]*/)||[''])[0];
console.log('  règle trouvée   :', regle.replace(/\s+/g,' ').slice(0,90));
console.log('  réserve basse   :', aPad ? '✓ ' + valeur.slice(0,60) : '✗ ABSENTE');
// La barre du bas mesure ~100px : il faut au moins ça
const px = parseInt((valeur.match(/(\d+)px\s*\+\s*env/)||valeur.match(/(\d+)px\)?\s*$/)||[0,0])[1]);
console.log('  hauteur réservée:', px, 'px', px >= 100 ? '✓ suffisant' : '✗ TROP FAIBLE');
console.log('\nERREURS: aucune');
process.exit(aPad && px >= 100 ? 0 : 1);
