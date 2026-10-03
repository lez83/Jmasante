// Lot 2 — dispositifs · Lot 3 — calculs. Les deux en essai.
const fs = require('fs'); const R = '../jmsante/';
let ko = []; const ck = (l,c) => { console.log(`  ${c?'✓':'⚠'} ${l}`); if(!c) ko.push(l); };
const d = fs.readFileSync(R+'www/js/dispositifs.js','utf-8');
const c = fs.readFileSync(R+'www/js/calculs.js','utf-8');
const sh = fs.readFileSync(R+'www/js/sheets.js','utf-8');
const bd = fs.readFileSync(R+'build.js','utf-8');

console.log('═══ LOT 2 — LES DISPOSITIFS ═══');
// ⚠️ Consigne de l'utilisateur : aucune donnée financière.
// ⚠️ On contrôle les DONNÉES, pas la phrase qui annonce leur absence.
ck('ni code LPP, ni tarif dans le catalogue',
   !/LPP|€|rembours|tarif/i.test(JSON.stringify(
     (d.match(/const DISPO_SOCLE = \[[\s\S]*?\n\];/)||[''])[0])));
ck('un socle modeste et assumé', /SOCLE MODESTE/.test(d) && (d.match(/\{ n:"/g)||[]).length >= 50);
ck('enrichissable par l utilisateur', /function dispoAjouter/.test(d) && /d\.ajouts\.push/.test(d));
// ⚠️ On ne touche jamais au socle : on masque.
ck('retirer masque, n efface pas le socle', /d\.retires\.push\(nom\)/.test(d));
ck('classeur Excel, comme l annuaire', /function dispoExport/.test(d) && /function dispoImport/.test(d));
// ⚠️ L'import montre avant d'appliquer.
ck('import en piles, rien d écrasé en silence', /nouveaux\.length \+ " nouvelle/.test(d));
ck('composition d ordonnance', /function sheetOrdoDispo/.test(d) && /function ordoDispoProduire/.test(d));
// ⚠️ Jamais de document final en un clic.
ck('brouillon à relire et signer', /rien n'est signé<\/b> tant que tu n'as pas imprimé/.test(d));
ck('aucune suggestion de pansement', /NE SUGGÈRE AUCUN PANSEMENT/.test(d));
ck('rien n entre dans un dossier', !/\.docs\.push/.test(d) && /essaiData\("dispositifs"\)/.test(d));

console.log('\n═══ LOT 3 — LES CALCULS ═══');
// ⚠️ Une division n'est pas un conseil : c'est ce qui les garde hors du
// champ de l'aide à la décision.
ck('aucune recommandation', /AUCUNE RECOMMANDATION/.test(c)
   && /ne recommandent rien<\/b>/.test(c));
ck('le calcul est affiché sous le résultat', /class="ca-rd">\$\{esc\(r\.detail\)\}/.test(c));
// ⚠️ Pas de résultat partiel : une valeur manquante doit se voir.
ck('rien ne s affiche si une valeur manque', /return null/.test(c)
   && /il manque une valeur/.test(c));
ck('division par zéro écartée', /h <= 0/.test(c) && /c <= 0/.test(c) && /vol <= 0/.test(c));
ck('les sources sont citées', /Outils Infirmiers \(Youssef El Koutami\)/.test(c)
   && /Pocket Infusion Calculator/.test(c) && /CHU de\s+Nancy/.test(c));
ck('les quatre onglets', /k:"debit"/.test(c) && /k:"dose"/.test(c)
   && /k:"dilu"/.test(c) && /k:"conv"/.test(c));
// ⚠️ Redessiner l'écran entier ferait perdre le curseur à chaque chiffre.
ck('seuls les résultats se redessinent', /function calcMajResultats/.test(c));
ck('l IMC n est pas un diagnostic', /pas un diagnostic/.test(c));

console.log('\n═══ L ACCÈS ═══');
ck('modules dans la chaîne', /'modeles','dispositifs','calculs','bilans','bilans_fiches','notes','detente'/.test(bd));
ck('entrées fiche patient', /id="f-dispo"/.test(sh) && /id="f-calc"/.test(sh));
ck('tuiles dans les réglages', /data-sec="dispo"/.test(sh) && /data-sec="calc"/.test(sh));
ck('visibles seulement en essai', /essaiActif\("dispositifs"\)/.test(sh) && /essaiActif\("calculs"\)/.test(sh));


console.log('\n═══ L ORDONNANCE DE DISPOSITIFS (retours du 3 oct.) ═══');
{ const cb2 = fs.readFileSync(R+'www/js/cabinet.js','utf-8');
  // ⚠️ Téléphone ET courriel sur la même ligne débordaient sous le titre.
  ck('courriel sur sa propre ligne', /if \(d\.tel\)\{[\s\S]{0,160}if \(d\.mail\)\{/.test(cb2));
  ck('colonne de gauche bornée', /const LG = 100;/.test(cb2));
  // ⚠️ Imprimer toutes les tailles laisse le pharmacien sans savoir
  // quoi délivrer.
  ck('une seule taille par ligne', /sub:"Quelle taille \?"/.test(d));
  ck('taille libre possible', /lbl:"Autre — à préciser"/.test(d));
  ck('deux tailles du même pansement', /_ordoPanier\.some\(x => x\.n === nom && x\.d === taille\)/.test(d));
  // ⚠️ Un PDF ouvert dans une visionneuse extérieure oblige à quitter
  // l'app pour revenir corriger.
  ck('aperçu dessiné dans l app', /function sheetOrdoApercu/.test(d) && /DESSINÉ DANS L'APP/.test(d));
  ck('on peut revenir modifier', /id="ap-mod"/.test(d));
  ck('et il ne remplace pas la relecture', /relis le PDF avant de signer/.test(d));
  ck('enregistrer et partager séparés', /id="ap-save"/.test(d) && /id="ap-share"/.test(d)
     && /pdfLivrer\(doc, base, mode\)/.test(d));
  ck('le partage est tenté avant tout', /if \(mode === "share"\)/.test(cb2));
  // ⚠️ L'aperçu représente du PAPIER : fond blanc quel que soit le thème.
  { const css2 = fs.readFileSync(R+'www/css/app.css','utf-8');
    ck('aperçu sur fond blanc', /\.ap-page\{ background:#fff/.test(css2)); }
}

console.log('\nERREURS:', ko.length ? ko.join(' · ') : 'aucune');
process.exit(ko.length ? 1 : 0);
