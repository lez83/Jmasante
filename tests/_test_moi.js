// L'identité suit la personne, le cabinet est le lieu.
const fs = require('fs'); const R = '../jmsante/';
let ko = []; const ck = (l,c) => { console.log(`  ${c?'✓':'⚠'} ${l}`); if(!c) ko.push(l); };
const cb = fs.readFileSync(R+'www/js/cabinet.js','utf-8');
const sh = fs.readFileSync(R+'www/js/sheets.js','utf-8');

console.log('═══ MA FICHE ═══');
// ⚠️ Le RPPS était rangé DANS CHAQUE CABINET : saisi trois fois, il
// pouvait diverger d'un lieu à l'autre.
ck('une identité unique', /function moi\(\)/.test(cb) && /S\.moi = \{ nom:""/.test(cb));
ck('reprise de ce qui était saisi dans un cabinet', /\(S\.cabinets \|\| \[\]\)\.map\(c => c\.entete \|\| \{\}\)\.find/.test(cb));
ck('écran dédié', /function sheetMoi/.test(cb) && /data-sec="moi"/.test(sh));
ck('les champs d identité ont quitté le cabinet', !/id="ce-rpps"/.test(cb) && !/id="ce-nom"/.test(cb));
// ⚠️ Seul le numéro professionnel peut figurer sur un document patient.
ck('le portable personnel est distinct', /id="mo-telperso"/.test(cb));
ck('et il ne sort sur aucun document', /ne sort sur aucun document/.test(cb)
   && !/telPerso/.test(cb.slice(cb.indexOf('function enteteDocument'), cb.indexOf('async function choisirSignature'))));

console.log('\n═══ QUI SIGNE ═══');
ck('trois formes proposées', /lbl:"Moi"/.test(cb) && /lbl:"Moi, remplaçant de…"/.test(cb) && /lbl:"Le cabinet"/.test(cb));
ck('composition identité + lieu', /function enteteDocument/.test(cb));
// ⚠️ La mention ne s'ajoute JAMAIS d'elle-même.
ck('mention seulement si choisie', /if \(ch && ch\.mode === "remplacant" && ch\.titulaire\)/.test(cb));
ck('elle porte le RPPS du titulaire', /" — RPPS " \+ t\.rpps/.test(cb));
// ⚠️ L'app ne dit pas ce qui est réglementaire : c'est au soignant.
ck('aucune règle imposée', /le cadre qui s'applique relève de toi/.test(cb));
ck('le choix est retenu par cabinet', /function signatureChoix\(cabId\)/.test(cb));
ck('titulaires et associés en tête', /function titulairesDuCabinet/.test(cb) && /titulaire\/i\.test/.test(cb));

console.log('\n═══ LES DOCUMENTS ═══');
ck('ordonnance : bouton de signature', /id="or-sig"/.test(cb));
ck('courrier : bouton de signature', /id="co-sig"/.test(cb));
ck('la mention s imprime', /if \(d\.mention\)\{/.test(cb));
ck('le RPPS des praticiens est saisissable', /id="cc-rpps"/.test(cb));
ck('et exporté dans le classeur', /"Praticiens":\s*\["ref","Nom","Métier","Complément","N° RPPS","Note"\]/.test(cb));

console.log('\nERREURS:', ko.length ? ko.join(' · ') : 'aucune');
process.exit(ko.length ? 1 : 0);
