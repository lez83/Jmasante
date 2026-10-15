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
ck('module dans la chaîne', /'dispositifs','calculs','bilans','bilans_fiches','narratif','notes','detente'/.test(bd));
ck('tuile et entrée fiche', /data-sec="bilans"/.test(sh) && /id="f-bilans"/.test(sh));


console.log('\n═══ LES FICHES DE RAPPEL ═══');
{ const fi = fs.readFileSync(R+'www/js/bilans_fiches.js','utf-8');
  ck('fiches écrites pour les analyses courantes', (fi.match(/mesure:"/g)||[]).length >= 35);
  ck('deux voix', /patient:"/.test(fi) && /data-bivoix="pro"/.test(b) && /data-bivoix="patient"/.test(b));
  // ⚠️ Ce qu'une valeur PEUT TRADUIRE, jamais ce qu'il faut faire.
  ck('ce que la valeur peut traduire', /UNE VALEUR BASSE PEUT TRADUIRE/.test(b)
     && /UNE VALEUR ÉLEVÉE PEUT TRADUIRE/.test(b));
  ck('aucune conduite à tenir', /AUCUNE CONDUITE À TENIR/.test(fi)
     && !/il faut (donner|administrer|prescrire)/i.test(fi));
  // ⚠️ Le cadre est rappelé À CHAQUE fiche, pas une fois dans un écran
  // d'accueil qu'on ne relit jamais.
  ck('cadre rappelé dans chaque fiche', /pas une aide au diagnostic<\/b>/.test(b)
     && /une par une<\/b>/.test(b) && /ne pose pas de diagnostic médical/.test(b));
  // ⚠️ Remettre une feuille qui explique des analyses reviendrait à se
  // substituer au médecin qui les a prescrites.
  ck('la voix patient ne s imprime pas', /NE S'IMPRIME PAS/.test(fi)
     && /Ne s'imprime pas<\/b> et ne se remet pas/.test(b));
  // ⚠️ L'app ne lit aucun résultat de patient.
  ck('aucun lien avec les bilans d un patient', /AUCUN LIEN AVEC LES BILANS/.test(fi)
     && !/p\.bilans|getP\(/.test(fi));
  // ⚠️ C'est là que le geste infirmier change le résultat.
  ck('rubrique « au prélèvement »', /AU PRÉLÈVEMENT/.test(b) && /prel:"/.test(fi));
  ck('le piège du garrot est dit', /Garrot trop serré ou trop long[\s\S]{0,80}MONTER/.test(fi));
}

console.log('\n═══ LES DEUX UNITÉS ═══');
ck('seconde unité sur les analyses concernées', (b.match(/u2:"/g)||[]).length >= 15);
ck('affichée sous la première', /soit \$\{esc\(x\.u2\)\}/.test(b));
ck('conversions courantes présentes', /u2:"150 000 – 400 000 \/mm³"/.test(b)
   && /u2:"0,70 – 1,00 g\/L"/.test(b));

console.log('\nERREURS:', ko.length ? ko.join(' · ') : 'aucune');
process.exit(ko.length ? 1 : 0);
