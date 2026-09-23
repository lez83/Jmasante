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

console.log('\n═══ LISTES DE MÉDECINS ET D ENTOURAGE ═══');
// Le nom prend toute la place restante ; le téléphone a la largeur
// d'un numéro complet. En flex:1 face au nom, « 06 00 00 00 00 »
// était tronqué — vu à la capture, pas à l'exécution.
const k = appjs.indexOf('function listeContactsHTML');
const b3 = appjs.slice(k, k + 3000);
const nomFlex = /data-lcnom[^>]*flex:1/.test(b3);
const telCls  = /data-lctel[^>]*class="lc-in lc-tel"|class="lc-in lc-tel"[^>]*data-lctel/.test(b3);
const m = css.match(/\.lc-tel\{\s*flex:0 0 ([\d.]+)em/);
const telEm = m ? parseFloat(m[1]) : 0;
console.log('  nom : place restante      :', nomFlex ? '✓' : '⚠');
console.log('  tél : largeur d un numéro :', telCls && telEm >= 10 ? `✓ ${telEm}em` : `⚠ ${telEm||'?'}em`);

console.log('\n═══ PERSONNE À PRÉVENIR ═══');
// Elle existait en DOUBLE (contacts.fam et p.prevenir) : saisie dans le
// recueil, le DLU la disait manquante. Le champ séparé ne doit pas revenir.
const ancien = appjs.includes('id="f-pap-nom"');
console.log('  plus de champ séparé     :', ancien ? '⚠ revenu' : '✓');
console.log('  marque 🚨 sur l entourage:', /data-lcpv/.test(b3) ? '✓' : '⚠');

const ok = uneLigne && nomLarge && !telFixe && nomFlex && telCls && telEm >= 10 && !ancien && /data-lcpv/.test(b3);
console.log('\nERREURS:', ok ? 'aucune' : 'structure à revoir');
process.exit(ok ? 0 : 1);
