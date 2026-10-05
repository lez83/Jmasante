// Trois zones sur le papier, un seul parcours à l'écran.
const fs = require('fs'); const R = '../jmsante/';
let ko = []; const ck = (l,c) => { console.log(`  ${c?'✓':'⚠'} ${l}`); if(!c) ko.push(l); };
const cb = fs.readFileSync(R+'www/js/cabinet.js','utf-8');
const mo = fs.readFileSync(R+'www/js/modeles.js','utf-8');
const di = fs.readFileSync(R+'www/js/dispositifs.js','utf-8');
const css = fs.readFileSync(R+'www/css/app.css','utf-8');

console.log('═══ SÉPARER PRESCRIPTEUR ET PATIENT ═══');
// ⚠️ Les deux identités se suivaient sans rupture : l'œil ne savait pas
// où finissait l'une.
ck('bloc patient commun à tous les documents', /function pdfBlocPatient/.test(cb));
ck('un filet ferme l en-tête', /doc\.line\(M, y, M \+ L \* 0\.55, y\)/.test(cb));
ck('le patient dans un encadré titré', /doc\.text\("PATIENT", M \+ 3\.5/.test(cb)
   && /roundedRect\(M, y, L, h/.test(cb));
ck('et à l écran aussi', /class="ap-enc"/.test(cb) && /\.ap-filet\{/.test(css));
// ⚠️ Chaque écran réécrivait son bloc : ils divergeaient.
ck('plus de bloc réécrit dans les modèles', /if \(typeof pdfBlocPatient === "function"\)\{ y = pdfBlocPatient/.test(mo));
ck('ni dans l ordonnance', /y = pdfBlocPatient\(doc, p, y, \{/.test(di));
// ⚠️ Sans patient, des lignes à remplir — c'est l'intérêt d'une feuille
// vierge emportée dans la sacoche.
ck('sans patient, des pointillés', /Patient\(e\) : " \+ "\."\.repeat\(46\)/.test(cb));

console.log('\n═══ MES MODÈLES : TROIS FAMILLES ═══');
ck('les trois sections', /À REMPLIR À LA MAIN/.test(mo) && /COURRIERS/.test(mo) && /VACCINATION/.test(mo));
ck('ordonnance vierge et feuille à en-tête', /id="md-ordo"/.test(mo) && /id="md-entete"/.test(mo));
ck('courrier à un confrère', /id="md-courrier"/.test(mo));
// ⚠️ La feuille de liaison garde ses réglages propres : RACCOURCI seulement.
ck('liaison domicile en raccourci', /id="md-liaison"/.test(mo)
   && /RACCOURCI seulement/.test(mo) && /sheetFeuilles\(\)/.test(mo));

console.log('\n═══ LE MÊME PARCOURS PARTOUT ═══');
// ⚠️ Un écran d'aperçu par type aurait signifié les voir diverger.
ck('aperçu générique', /function sheetApercu\(doc\)/.test(cb));
ck('il reçoit une description du document', /doc\.corps \|\| \[\]/.test(cb) && /doc\.produire\("save"\)/.test(cb));
ck('modèles branchés dessus', /function sheetModeleApercu/.test(mo));
ck('conduite à tenir aussi', /sansPatient:true/.test(mo));
ck('ordonnance aussi', /function sheetOrdoApercu[\s\S]{0,400}sheetApercu\(\{/.test(di));
ck('enregistrer et partager partout', /docProduire\(cle, pid, mode\)/.test(mo)
   && /aideProduire\(mode\)/.test(mo) && /ordoDispoProduire\(pid, mode\)/.test(di));
// ⚠️ Une fiche interne n'a pas de patient : un encadré vide ferait
// croire qu'il manque une information.
ck('une fiche interne n affiche pas d encadré', /doc\.sansPatient \? "" : `/.test(cb));
ck('l aperçu ne remplace pas la relecture', /relis le PDF avant de signer/.test(cb));

console.log('\nERREURS:', ko.length ? ko.join(' · ') : 'aucune');
process.exit(ko.length ? 1 : 0);
