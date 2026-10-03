// Les tubes et les repères : un mémo, jamais une interprétation.
const fs = require('fs'); const R = '../jmsante/';
let ko = []; const ck = (l,c) => { console.log(`  ${c?'✓':'⚠'} ${l}`); if(!c) ko.push(l); };
const b = fs.readFileSync(R+'www/js/bilans.js','utf-8');
const e = fs.readFileSync(R+'www/js/essais.js','utf-8');
const sh = fs.readFileSync(R+'www/js/sheets.js','utf-8');
const bd = fs.readFileSync(R+'build.js','utf-8');

console.log('═══ LE CONTENU ═══');
ck('dix groupes d analyses', (b.match(/\{ g:"/g)||[]).length === 10);
ck('les six tubes', (b.match(/\{ n:"[^"]+", c:"/g)||[]).length === 6);
ck('ordre de prélèvement : hémocultures d abord', /n:"Hémocultures"[\s\S]{0,120}Toujours en premier/.test(b));
// ⚠️ Un tube citraté mal rempli fausse l'INR : c'est l'erreur qui coûte
// le plus cher sous AVK.
ck('le piège du tube citraté est signalé', /Remplissage complet impératif/.test(b));
ck('valeurs distinctes homme / femme là où il faut', /h:"13 – 17 g\/dL", f:"12 – 16 g\/dL"/.test(b));

console.log('\n═══ CE QUE L APP NE FAIT PAS ═══');
// ⚠️ Même ligne que les constantes, les plaies et le guide.
ck('aucune interprétation', /N'INTERPRÈTE RIEN/.test(b) && /n'interprète aucun résultat/.test(b));
ck('aucune valeur de patient saisie ici', !/p\.bilans|getP\(/.test(b));
// ⚠️ Les intervalles dépendent du laboratoire et de la technique.
ck('les valeurs sont dites indicatives', /VALEURS SONT INDICATIVES/.test(b)
   && /du compte rendu qui font foi/.test(b));
ck('les couleurs de bouchon aussi', /NE SONT PAS UNIVERSELLES/.test(b));

console.log('\n═══ AJUSTABLE ET RÉVERSIBLE ═══');
ck('ajustable au laboratoire', /function sheetBilansEdit/.test(b));
ck('rangé dans les données d essai', /essaiData\("bilans"\)/.test(b));
ck('retour aux repères d origine', /delete bilanData\(\)\.groupes/.test(b));
ck('et l app ne vérifie pas ce qui est saisi', /L'application ne vérifie rien/.test(b));

console.log('\n═══ L ACCÈS ═══');
ck('essai déclaré', /cle:"bilans"/.test(e));
ck('module dans la chaîne', /'dispositifs','calculs','bilans','notes','detente'/.test(bd));
ck('tuile et entrée fiche', /data-sec="bilans"/.test(sh) && /id="f-bilans"/.test(sh));

console.log('\nERREURS:', ko.length ? ko.join(' · ') : 'aucune');
process.exit(ko.length ? 1 : 0);
