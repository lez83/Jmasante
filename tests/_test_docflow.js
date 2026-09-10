// Le parcours d'ajout passe-t-il bien par la qualification ?
// Quatre champs de fichier mènent à handleDocFile — un seul chemin
// modifié aurait laissé les trois autres sans qualification.
const fs=require('fs');
const sh = fs.readFileSync('../jmsante/www/js/sheets.js','utf-8');
const html = fs.readFileSync('../jmsante/www/index.html','utf-8');
console.log('═══ LES QUATRE SOURCES ═══');
const ids = ["docfile","galleryfile","camerafile","wordfile"];
const branchement = sh.match(/\[([^\]]*)\]\.forEach\(id => \{\s*const el = document\.getElementById\(id\);\s*if \(el\) el\.addEventListener\("change", handleDocFile\)/);
ids.forEach(id => {
  const dansHtml = html.includes(`id="${id}"`);
  const branche  = branchement && branchement[1].includes(`"${id}"`);
  console.log(`  ${dansHtml && branche ? '✓' : '⚠'} ${id.padEnd(12)} html:${dansHtml} → handleDocFile:${!!branche}`);
});
console.log('\n═══ LA QUALIFICATION EST-ELLE APPELÉE ? ═══');
const i = sh.indexOf('async function handleDocFile');
const corps = sh.slice(i, i + 4200);
const q = corps.includes('qualifierDoc(');
console.log('  qualifierDoc appelée  :', q ? '✓' : '⚠ ABSENTE');
console.log('  type enregistré       :', /type:\s*q\.type/.test(corps) ? '✓' : '⚠');
console.log('  précision enregistrée :', /precision:\s*q\.precision/.test(corps) ? '✓' : '⚠');
console.log('  nom composé utilisé   :', /name:\s*q\.nom/.test(corps) ? '✓' : '⚠');
console.log('  conversion PDF        :', /imagesVersPdf/.test(corps) ? '✓' : '⚠');
console.log('  annulation respectée  :', /if \(!q\) return/.test(corps) ? '✓' : '⚠');
const ok = q && /type:\s*q\.type/.test(corps) && /precision:\s*q\.precision/.test(corps)
        && /name:\s*q\.nom/.test(corps) && /imagesVersPdf/.test(corps);
console.log('\nERREURS:', ok ? 'aucune' : 'chemin incomplet');
process.exit(ok ? 0 : 1);
