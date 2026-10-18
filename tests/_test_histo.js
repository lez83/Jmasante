// Historique : regroupement par mois, filtres, et surtout la suppression
// qui ne doit PAS emporter les constantes sans prévenir.
const fs=require('fs');
let ko=[]; const ck=(l,c)=>{ console.log(`  ${c?'✓':'⚠'} ${l}`); if(!c) ko.push(l); };
const sh = fs.readFileSync('../jmsante/www/js/sheets.js','utf-8');
const css = fs.readFileSync('../jmsante/www/css/app.css','utf-8');

console.log('═══ SUPPRESSION : LE POINT SENSIBLE ═══');
// ⚠️ Avant : « Supprimer ce passage ? » effaçait tout, constantes comprises,
// et le point correspondant disparaissait des courbes. Sans un mot d'avertissement.
ck('on demande CE QU ON efface', /titre:"Que veux-tu effacer \?"/.test(sh));
ck('« la transmission seulement » proposé en premier',
   sh.indexOf('La transmission seulement') < sh.indexOf('Tout le passage'));
// Depuis la v1.0.51 les mesures ne sont plus perdues : le dialogue les NOMME
// et annonce qu'elles restent sur les courbes.
ck('les mesures concernées sont NOMMÉES', /"Les mesures <b>" \+ esc\(cp\.join\(" · "\)\)/.test(sh));
ck('le sort des courbes est annoncé', /resteront sur les <b>courbes<\/b>/.test(sh));
ck('effacer la transmission garde le passage',
   /delete v\.note; delete v\.soinNotes/.test(sh) && !/quoi === "note"[\s\S]{0,200}visits\.filter/.test(sh));
ck('sans constantes, pas de question inutile', /if \(!aNote \|\| !cp\.length\)/.test(sh));

console.log('\n═══ LES MESURES SURVIVENT AU PASSAGE ═══');
const fe = fs.readFileSync('../jmsante/www/js/features.js','utf-8');
const me = fs.readFileSync('../jmsante/www/js/menage.js','utf-8');
const fl = fs.readFileSync('../jmsante/www/js/feuilles.js','utf-8');
// ⚠️ Une courbe trouée efface une évolution qu'on ne peut plus reconstituer.
ck('les constantes sont archivées avant suppression', /archiverMesures\(p, v\)/.test(sh));
ck('les courbes lisent passages + archives', /function mesuresDe\(p\)/.test(fe) && /mesuresDe\(p\);   \/\/ passages \+ mesures/.test(fe));
ck('l export des constantes aussi', /mesuresDe\(p\)\.filter/.test(fl));
ck('pas de doublon si déjà archivé', /p\.mesures\.some\(m => m\.date/.test(fe));
ck('le dialogue annonce que les courbes gardent', /resteront sur les <b>courbes<\/b>/.test(sh));
ck('et dit par où les effacer', /Ménage → constantes d'une période/.test(sh));
ck('le ménage efface AUSSI les archives', /p\.mesures = \(p\.mesures\|\|\[\]\)\.filter\(m => !\(m\.date >= a/.test(me));
ck('supprimer des passages sur une période archive aussi', /forEach\(v => \{ if \(v\.date >= a && v\.date <= b\) archiverMesures/.test(me));
// ⚠️ Une archive ne doit pas contourner la durée de conservation choisie.
ck('la durée de conservation purge les archives', /p\.mesures = p\.mesures\.filter\(m => m\.date >= before\)/.test(sh));

console.log('\n═══ REGROUPEMENT PAR MOIS ═══');
ck('un groupe par mois', /const cle = String\(v\.date\)\.slice\(0,7\)/.test(sh));
ck('mois en cours ouvert par défaut', /_histMois === null\) _histMois = moisCourant/.test(sh));
ck('un seul mois à la fois', /_histMois = \(_histMois === h\.dataset\.hmois\) \? "" : h\.dataset\.hmois/.test(sh));
ck('le mois annonce ses passages et ses alertes', /g\.items\.length\} passage/.test(sh) && /g\.alertes \? /.test(sh));
ck('style du repli', /\.hm\.ouv\{/.test(css) && /\.hm-a\{/.test(css));

console.log('\n═══ FILTRES ═══');
ck('raccourcis de période', /\["tout","Tout"\],\["30","30 jours"\],\["90","3 mois"\],\["dates","Dates…"\]/.test(sh));
ck('dates précises', /id="hf-du"/.test(sh) && /id="hf-au"/.test(sh));
ck('recherche par mot dans soins ET transmissions',
   /const colle = v =>/.test(sh) && /v\.soinNotes/.test(sh) && /colle\(v\)\.includes\(mot\)/.test(sh));
// ⚠️ Sans ça, on filtre et on ne voit rien : il faudrait encore déplier.
ck('un filtre actif ouvre tous les mois retenus', /const filtreActif = F\.mode !== "tout" \|\| !!mot/.test(sh)
   && /const ouvert = filtreActif \|\| g\.cle === _histMois/.test(sh));
ck('compteur « retenus sur total »', /retenu\(s\) sur " \+ p\.visits\.length/.test(sh));

console.log('\nERREURS:', ko.length ? ko.join(' · ') : 'aucune');
process.exit(ko.length?1:0);
