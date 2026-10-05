// Régler l'affichage d'une carte depuis la fiche du patient.
const fs = require('fs'); const R = '../jmsante/';
let ko = []; const ck = (l,c) => { console.log(`  ${c?'✓':'⚠'} ${l}`); if(!c) ko.push(l); };
const uk = fs.readFileSync(R+'www/js/uikit.js','utf-8');
const ui = fs.readFileSync(R+'www/js/ui.js','utf-8');
const sh = fs.readFileSync(R+'www/js/sheets.js','utf-8');

console.log('═══ LE RÉGLAGE PAR PATIENT ═══');
ck('lecture qui accepte un patient', /function carteMontre\(k, p\)/.test(uk));
ck('les cartes passent le patient', !/carteMontre\("(\w+)"\)/.test(ui)
   && /carteMontre\("age", p\)/.test(ui));
ck('écran depuis la fiche', /function sheetCartePatient/.test(uk) && /id="f-carte"/.test(sh));
// ⚠️ UN SEUL interrupteur décide. Sans ce choix explicite, une
// modification générale resterait sans effet sur certaines cartes.
ck('interrupteur « suivre le réglage général »', /id="cp-gen"/.test(uk));
ck('cocher efface le réglage propre', /if \(g\.checked\) delete p\.carteMasque/.test(uk));
// ⚠️ On part du réglage général : l'exception commence là où il s'arrête.
ck('décocher hérite du général', /else p\.carteMasque = \[\.\.\.\(S\.carteMasque \|\| \[\]\)\]/.test(uk));
ck('options inertes tant qu on suit le général', /\.cp-off\{/.test(fs.readFileSync(R+'www/css/app.css','utf-8')));

console.log('\n═══ LES GARDE-FOUS ═══');
// ⚠️ Un réglage d'affichage ne doit JAMAIS masquer une alerte.
ck('les signaux de vigilance restent affichés', /signaux de vigilance/.test(uk)
   && /valeur hors seuil, jours sans selle/.test(uk));
// ⚠️ Sans décompte, on ne saurait plus au bout de quelques mois quels
// dossiers échappent au réglage commun.
ck('décompte des exceptions', /function cartesAPart/.test(uk));
ck('visible dans Personnaliser', /ne suivent|ne suit\b/.test(uk) && /id="pz-cartes-raz"/.test(uk));
ck('remise en commun possible', /\(S\.patients\|\|\[\]\)\.forEach\(x => \{ delete x\.carteMasque; \}\)/.test(uk));
ck('la fiche dit lequel des deux s applique', /réglage propre à ce dossier/.test(sh));


console.log('\n═══ L ANNONCE DEPUIS L ÉCRAN GÉNÉRAL ═══');
// ⚠️ Le réglage par patient existait sans que rien ne l'annonce : on ne
// pouvait le découvrir qu'en fouillant une fiche.
ck('note dans l écran général', /class="pz-note"/.test(uk));
ck('elle dit la portée du réglage', /vaut pour <b>tous les dossiers<\/b>/.test(uk));
// ⚠️ Le chemin doit être écrit en entier : « quelque part dans la fiche »
// n'aide personne.
ck('le chemin est donné en entier', /fiche du patient → <b>⚡ Actions<\/b> → <b>🪪 Ce qu'affiche sa carte<\/b>/.test(uk));
ck('posée juste après les options', uk.indexOf('class="pz-note"') < uk.indexOf('Les signaux de vigilance restent toujours visibles'));
ck('style de la note', /\.pz-note\{/.test(fs.readFileSync(R+'www/css/app.css','utf-8')));


console.log('\n═══ LES CONSTANTES SUR LA CARTE ═══');
const ui2 = fs.readFileSync(R+'www/js/ui.js','utf-8');
// ⚠️ Le réglage existait, mais dans la rubrique « Constantes » sous un
// autre nom : l'utilisateur le cherchait avec les autres options de carte.
ck('option dans Cartes patient', /\["consts","Constantes du dernier passage"\]/.test(uk));
ck('une seule vérité, pas un doublon', /function ligneActive\(p\)\{ return carteMontre\("consts", p\); \}/.test(uk));
ck('l ancien réglage est repris', /function migrerLigneConstantes/.test(uk));
ck('la migration tourne au démarrage', /migrerLigneConstantes\(\)/.test(fs.readFileSync(R+'www/js/init.js','utf-8')));
ck('les deux écrans écrivent au même endroit', /e\.checked \? set\.delete\("consts"\) : set\.add\("consts"\)/.test(uk));
ck('réglable dossier par dossier', /ligneActive\(p\)/.test(ui2));
// ⚠️ Une valeur hors seuil est un signal de vigilance : elle ne se masque pas.
ck('les valeurs hors seuil restent', /_altOn/.test(ui2) && /signal de vigilance/.test(ui2));


console.log('\nERREURS:', ko.length ? ko.join(' · ') : 'aucune');
process.exit(ko.length ? 1 : 0);
