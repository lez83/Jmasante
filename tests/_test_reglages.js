// L'écran Réglages : deux modes, un seul découpage.
const fs = require('fs'); const R = '../jmsante/';
let ko = []; const ck = (l,c) => { console.log(`  ${c?'✓':'⚠'} ${l}`); if(!c) ko.push(l); };
const s = fs.readFileSync(R+'www/js/sheets.js','utf-8');
const tiles = s.slice(s.indexOf('const tiles = `'), s.indexOf('const row = '));
const list  = s.slice(s.indexOf('const list = `'), s.indexOf('const list = `') + 3000);
const sec = b => [...b.matchAll(/<div class="mgroup-t">([^<]*)<\/div>/g)].map(m => m[1]);

console.log('═══ LE MÊME DÉCOUPAGE ═══');
// ⚠️ Si les deux modes diffèrent, changer d'affichage revient à changer
// d'application.
ck('quatre sections dans les tuiles', sec(tiles).length === 4);
ck('quatre sections dans la liste', sec(list).length === 4);
ck('et ce sont les mêmes', JSON.stringify(sec(tiles)) === JSON.stringify(sec(list)));
ck('dans l ordre d usage', sec(list)[0] === 'Mon travail' && sec(list)[3] === "L'application");

console.log('\n═══ PLUS RIEN D OUBLIÉ ═══');
// ⚠️ Le mode liste ignorait sept entrées : Mon cabinet, Ma fiche,
// Mes notes, Souffler et les trois outils en essai.
['moi','notes','cab','souffler','bilans','calc','dispo'].forEach(k =>
  ck('« ' + k +' » présent dans la liste', new RegExp('row\\("' + k + '"').test(list)));
ck('les outils en essai restent conditionnels',
   (list.match(/typeof essaiActif === "function" && essaiActif/g)||[]).length >= 4);

console.log('\n═══ L INTERRUPTEUR ═══');
ck('les deux modes coexistent', /data-mm/.test(s));
// ⚠️ La liste est le défaut, mais un choix déjà fait est respecté.
ck('la liste est le défaut', /const mode = S\.menuMode \|\| "list"/.test(s));
ck('un choix existant est conservé', /on ne change pas\s+l'écran de quelqu'un sans le prévenir/.test(s));

console.log('\nERREURS:', ko.length ? ko.join(' · ') : 'aucune');
process.exit(ko.length ? 1 : 0);
