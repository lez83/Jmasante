// La suppression d'un dossier doit le retirer de PARTOUT, et la
// restauration doit l'y remettre.
const fs = require('fs'); const R = '../jmsante/';
let ko = []; const ck = (l,c) => { console.log(`  ${c?'✓':'⚠'} ${l}`); if(!c) ko.push(l); };
const sh = fs.readFileSync(R+'www/js/sheets.js','utf-8');
const ini = fs.readFileSync(R+'www/js/init.js','utf-8');

console.log('═══ SUPPRESSION ═══');
// ⚠️ Un patient décédé laissait son identifiant dans l'ordre de passage
// et dans les créneaux : un fantôme, qui occupait une place vide.
ck('retiré de tous les ordres', /function oublierPatientPartout/.test(sh)
   && /oublierPatientPartout\(pid\);/.test(sh));
ck('ordre de passage nettoyé', /S\.patientOrder\[t\] = \(S\.patientOrder\[t\] \|\| \[\]\)\.filter/.test(sh));
ck('créneaux nettoyés', /S\.slotOrder\[t\]/.test(sh) && /S\.slotMembers\[t\]/.test(sh));
ck('le dossier reste en corbeille', /S\.trash\.push\(\{ deletedAt/.test(sh));

console.log('\n═══ RATTRAPAGE ═══');
// ⚠️ Les fantômes créés avant cette version doivent partir aussi.
ck('nettoyage au démarrage', /fantomes\.forEach\(id => oublierPatientPartout\(id\)\)/.test(ini));
ck('et une seule écriture', /if \(fantomes\.size\) save\(true\)/.test(ini));

console.log('\n═══ RESTAURATION ═══');
// ⚠️ Sans remise dans les ordres, un dossier restauré revenait INVISIBLE
// dès que les créneaux sont activés : présent dans les données, absent
// de tous les écrans.
ck('remis dans sa tournée', /if \(!o\.includes\(pp\.id\)\) o\.push\(pp\.id\)/.test(sh));
ck('et dans un créneau', /c\.matin\.push\(pp\.id\)/.test(sh));
ck('sans doublon si déjà dans le soir', /!\(\(c\.soir\|\|\[\]\)\.includes\(pp\.id\)\)/.test(sh));

console.log('\nERREURS:', ko.length ? ko.join(' · ') : 'aucune');
process.exit(ko.length ? 1 : 0);
