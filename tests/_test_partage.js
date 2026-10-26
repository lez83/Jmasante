// Partager une sauvegarde, c'est partager TOUT : on le dit avant.
const fs = require('fs'); const R = '../jmsante/';
let ko = []; const ck = (l,c) => { console.log(`  ${c?'✓':'⚠'} ${l}`); if(!c) ko.push(l); };
const sh = fs.readFileSync(R+'www/js/sheets.js','utf-8');
const fe = fs.readFileSync(R+'www/js/features.js','utf-8');
const css = fs.readFileSync(R+'www/css/app.css','utf-8');

console.log('═══ LA QUESTION AU PARTAGE ═══');
// ⚠️ Une sauvegarde envoyée à une collègue livre les patients qu'elle n'a
// pas à connaître, et laisse chez elle une tournée qui ne la concerne pas.
ck('le partage demande avant', /titre:"Partager quoi \?"/.test(sh));
ck('il dit ce que contient une sauvegarde', /Une sauvegarde contient <b>tout<\/b>/.test(sh));
ck('et le chiffre : dossiers et tournées', /nPat \+ " dossier\(s\)"/.test(sh) && /nTours > 1/.test(sh));
ck('la voie cloisonnée est proposée en premier', sh.indexOf('Donner des dossiers') < sh.indexOf('Sauvegarde complète'));
ck('elle mène à l envoi par synchro', /ensureIdentity\(\(\) => sheetSendSync\(\)\)/.test(sh));
/* ⚠️ CETTE LIGNE GARDAIT LE DÉFAUT. Elle exigeait
   `exportBackup("share"); setTimeout(sheetTours, 900)` — or la
   temporisation faisait quitter l'écran pendant que la question de
   partage était ENCORE POSÉE : mesuré, à 1200 ms la boîte était là et
   l'écran avait changé. Une temporisation n'est pas un fait. Depuis
   v1.32.0 la navigation suit le résultat, et une annulation ne fait
   plus quitter l'écran. */
ck('la sauvegarde complète reste possible', /exportBackup\("share"\)/.test(sh));
ck('et la navigation suit le fait, pas une temporisation',
   /exportBackup\("share"\)\s*\n\s*\.then\(ok => \{ if \(ok !== false\) sheetTours\(\); \}\)/.test(sh)
   && !/setTimeout\(sheetTours, 900\)/.test(sh));
// ⚠️ Deux libellés sans conséquence visible ne font pas un choix éclairé.
ck('chaque option porte son explication', /x\.sub \? `<span class="dlg-opt-s">/.test(fe));
ck('et son style', /\.dlg-opt\.dbl\{/.test(css));

console.log('\nERREURS:', ko.length ? ko.join(' · ') : 'aucune');
process.exit(ko.length ? 1 : 0);
