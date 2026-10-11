// Le « à jeun » visible, et les numéros de caisse et mutuelle.
const fs = require('fs'); const R = '../jmsante/';
let ko = []; const ck = (l,c) => { console.log(`  ${c?'✓':'⚠'} ${l}`); if(!c) ko.push(l); };
const b  = fs.readFileSync(R+'www/js/bilans.js','utf-8');
const sh = fs.readFileSync(R+'www/js/sheets.js','utf-8');
const sy = fs.readFileSync(R+'www/js/sync.js','utf-8');

console.log('═══ À JEUN ═══');
// ⚠️ L'information existait, ENFOUIE dans la rubrique « au prélèvement »
// de cinq fiches. Pour préparer une tournée du matin, il faut la voir
// dans la LISTE.
{ /* ⚠️ Les 6 TUBES vivent dans la même liste et n'ont pas de marqueur :
     ils ne sont pas des analyses. On ne retient que celles qui en sont. */
  const tubes = new Set([...b.matchAll(/\{ n:"([^"]+)", c:"/g)].map(m => m[1]));
  const noms = [...b.matchAll(/\{ n:"([^"]+)"/g)].map(m => m[1]).filter(n => !tubes.has(n));
  const avec = [...b.matchAll(/\{ n:"([^"]+)", j:\d/g)].map(m => m[1]);
  const sans = noms.filter(n => !avec.includes(n));
  ck('les 45 analyses sont tranchées', noms.length === 45 && sans.length === 0
     || (console.log('     sans marqueur : ' + sans.join(', ')), false)); }
// ⚠️ TROIS états, pas deux : « rien » était ambigu — pas nécessaire, ou
// information absente ?
ck('trois états', /x\.j === 1/.test(b) && /x\.j === 2/.test(b)
   && /TROIS ÉTATS, PAS DEUX/.test(b));
ck('le marqueur est dans la liste', /\$\{jeunPuce\(x\)\}/.test(b));
ck('avec sa légende', /requis · <b class="bi-j2">labo<\/b>/.test(b));
// ⚠️ Au moment de composer, ce qui compte n'est pas chaque ligne mais
// « faut-il qu'il soit à jeun ? ».
ck('un résumé groupé existe', /function jeunResume/.test(b)
   && /BILAN_GROUPES\.flatMap/.test(b));
// Les évidences cliniques
ck('glycémie à jeun = requis', /\{ n:"Glycémie à jeun", j:1/.test(b));
ck('triglycérides et LDL aussi', /\{ n:"Triglycérides", j:1/.test(b) && /\{ n:"LDL", j:1/.test(b));
ck('HbA1c = pas nécessaire', /\{ n:"HbA1c", j:0/.test(b));
ck('NFS = pas nécessaire', /\{ n:"Hémoglobine", j:0/.test(b) && /\{ n:"Plaquettes", j:0/.test(b));

console.log('\n═══ CAISSE ET MUTUELLE ═══');
ck('les quatre champs existent', /id="f-caisse"/.test(sh) && /id="f-mut"/.test(sh)
   && /id="f-mutnum"/.test(sh) && /id="f-mutam"/.test(sh));
ck('à côté du numéro de sécurité sociale', /vivent À CÔTÉ du numéro de sécurité/.test(sh));
ck('et ils s enregistrent', /mutuelleAmc: \(\$\("#f-mutam"\)/.test(sh));
// ⚠️ Une ordonnance n'a pas l'usage d'un numéro de mutuelle.
ck('ils ne sortent sur aucun document', /ne sortent sur AUCUN document/.test(sh)
   && /ils ne figurent sur aucun document produit/.test(sh));

console.log('\nERREURS:', ko.length ? ko.join(' · ') : 'aucune');
process.exit(ko.length ? 1 : 0);
