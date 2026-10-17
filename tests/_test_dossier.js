// Comparer deux photos, et remettre son dossier au patient (droit d'accès).
const fs = require('fs'); const R = '../jmsante/';
let ko = []; const ck = (l,c) => { console.log(`  ${c?'✓':'⚠'} ${l}`); if(!c) ko.push(l); };
const pl = fs.readFileSync(R+'www/js/plaies.js','utf-8');
const fi = fs.readFileSync(R+'www/js/fiche.js','utf-8');
const sh = fs.readFileSync(R+'www/js/sheets.js','utf-8');
const css = fs.readFileSync(R+'www/css/app.css','utf-8');

console.log('═══ COMPARER DEUX PHOTOS ═══');
ck('écran de comparaison', /async function sheetPlaieComparer/.test(pl));
ck('proposé seulement à partir de 2 photos',
   /plaiePhotos\(p, pl\)\.length >= 2/.test(pl) && /photos\.length < 2/.test(pl));
ck('première et dernière par défaut', /let iA = 0, iB = photos\.length - 1/.test(pl));
ck('écart en jours affiché', /jours d'écart/.test(pl));
// ⚠️ La limite à tenir : afficher est permis, interpréter ferait de l'app
// un dispositif médical.
ck('aucun calcul sur les images', !/superpos|aligner|surface|pourcentage|évolution calcul/i.test(pl));
ck('la limite est écrite dans l app', /elle ne compare pas/.test(pl));
ck('style des deux vignettes', /\.cmp-duo\{/.test(css) && /\.cmp-v\{/.test(css));

console.log('\n═══ DOSSIER DU PATIENT (RGPD) ═══');
ck('écran dédié', /async function sheetExportDossier/.test(fi));
ck('accessible depuis la fiche', /id="f-dossier"/.test(sh) && /sheetExportDossier\(p\.id\)/.test(sh));
ck('deux formats : lisible et réutilisable', /data-xf="html"/.test(fi) && /data-xf="json"/.test(fi));
// ⚠️ À la différence de « Exporter la fiche », rien n'est sélectionné :
// le droit d'accès porte sur TOUT ce qui est détenu.
['Identité','Médecins et entourage','Informations du dossier','Traitement',
 'Plaies et pansements','Passages','Bilans','Documents']
  .forEach(s => ck('section ' + s, fi.includes(s)));
ck('les contenus des documents sont joints', /idbGet\("doc_"\+d\.id\)/.test(fi));
ck('le JSON porte tout le patient', /patient: p/.test(fi));
// ⚠️ Un nom de fichier accentué devenait « D_mo-Martin_Ren_e ».
ck('accents transposés dans le nom du fichier', /normalize\("NFD"\)/.test(fi));
ck('le fichier sort en clair, et c est dit', /sort <b>en clair<\/b>/.test(fi));
ck('repli sur le téléchargement si l enregistrement échoue', /URL\.createObjectURL/.test(fi));

console.log('\nERREURS:', ko.length ? ko.join(' · ') : 'aucune');
process.exit(ko.length ? 1 : 0);
