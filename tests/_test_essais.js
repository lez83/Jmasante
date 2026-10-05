// Le socle des fonctions en essai : activable, et surtout réversible.
const fs = require('fs'); const R = '../jmsante/';
let ko = []; const ck = (l,c) => { console.log(`  ${c?'✓':'⚠'} ${l}`); if(!c) ko.push(l); };
const e = fs.readFileSync(R+'www/js/essais.js','utf-8');
const sh = fs.readFileSync(R+'www/js/sheets.js','utf-8');
const bd = fs.readFileSync(R+'build.js','utf-8');
const css = fs.readFileSync(R+'www/css/app.css','utf-8');

console.log('═══ LE CODE ═══');
ck('code unique', /const ESSAI_CODE = "cigale83"/.test(e));
ck('comparé sans tenir compte de la casse', /\.trim\(\)\.toLowerCase\(\) !== ESSAI_CODE/.test(e));
// ⚠️ Ce code n'est pas une sécurité : il évite une découverte par hasard.
ck('il est présenté pour ce qu il est', /n'est pas un secret de sécurité/.test(e));
ck('entrée discrète dans l écran Application', /id="go-essais"/.test(sh));

console.log('\n═══ LES INTERRUPTEURS ═══');
ck('un par fonction', /data-ess="\$\{esc\(e\.cle\)\}"/.test(e));
ck('cinq lots déclarés', (e.match(/\{ cle:"/g)||[]).length === 5);
ck('bandeau sur les écrans en essai', /function essaiBandeau/.test(e) && /\.ess-band\{/.test(css));
ck('et il permet d éteindre sur place', /data-essoff/.test(e));

console.log('\n═══ LE RETOUR EN ARRIÈRE ═══');
// ⚠️ C'est le point qui rend tout le reste acceptable : une fonction en
// essai ne doit RIEN écrire dans les données de tournée.
ck('les données d essai vivent à part', /function essaiData/.test(e) && /S\.essaisData/.test(e));
ck('règle écrite noir sur blanc', /N'ÉCRIT JAMAIS dans les/.test(e));
ck('tout éteindre d un geste', /id="ess-off"/.test(e) && /S\.essais = \{\}/.test(e));
ck('effacer sans toucher aux dossiers', /delete S\.essaisData/.test(e)
   && /tes patients, tournées et passages ne sont pas touchés/i.test(e));
// ⚠️ Le guide remplace du contenu : l'ancien doit rester intact.
ck('le cas du guide est traité à part', /CAS PARTICULIER DU GUIDE/.test(e)
   && /L'ancien reste intact et revient si tu éteins/.test(e));
ck('avertissement aux testeurs', /Ne t'appuie pas dessus pour un soin/.test(e));

console.log('\n═══ L ACCÈS ═══');
ck('module dans la chaîne', /'cabinet','guide','guide26','modeles','dispositifs','calculs','bilans','bilans_fiches','notes','detente','eggs','essais','sync'/.test(bd));

console.log('\nERREURS:', ko.length ? ko.join(' · ') : 'aucune');
process.exit(ko.length ? 1 : 0);
