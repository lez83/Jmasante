// Un soin créé en cours de saisie recevait un simple onclick=toggle :
// cochable, mais sans crayon, sans appui long, sans commentaire.
// C'était le cas des soins repris par J-1.
const fs=require('fs');
const ui = fs.readFileSync('../jmsante/www/js/ui.js','utf-8');
const lignes = ui.split('\n');
console.log('═══ TOUTES LES CRÉATIONS DE SOIN ═══');
let n=0, armes=0;
lignes.forEach((l,i)=>{
  if (/className\s*=\s*"chip/.test(l) && /dataset\.s/.test(lignes.slice(i,i+3).join('\n'))){
    const bloc = lignes.slice(i,i+8).join('\n');
    const arme = bloc.includes('armerChipSoin');
    const toggle = /onclick\s*=\s*\(\)\s*=>.*toggle\("on"\)/.test(bloc);
    n++; if (arme) armes++;
    console.log(`  ${arme?'✓':'⚠'} ligne ${String(i+1).padStart(4)} — ${arme?'armé':'NON ARMÉ'}${toggle?' (toggle nu)':''}`);
  }
});
console.log(`\n  ${armes}/${n} armées`);

console.log('\n═══ LA FONCTION EXISTE ET FAIT LE NÉCESSAIRE ═══');
const i = ui.indexOf('function armerChipSoin');
const f = ui.slice(i, i+900);
console.log('  decorateChip (crayon)  :', /decorateChip\(c\)/.test(f) ? '✓' : '⚠');
console.log('  appui long → menuSoin  :', /menuSoin\(c, p, f\)/.test(f) ? '✓' : '⚠');
console.log('  tap sur le crayon      :', /openSoinComment\(c\)/.test(f) ? '✓' : '⚠');
console.log('  brouillon sauvegardé   :', /_saveDraft\(f, p\.id\)/.test(f) ? '✓' : '⚠');

const ok = armes === n && n >= 4 && /menuSoin/.test(f) && /decorateChip/.test(f);
console.log('\nERREURS:', ok ? 'aucune' : 'à revoir');
process.exit(ok ? 0 : 1);
