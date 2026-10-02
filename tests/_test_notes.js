// Le bloc-notes : libre, organisable, et strictement privé.
const fs = require('fs'); const R = '../jmsante/';
let ko = []; const ck = (l,c) => { console.log(`  ${c?'✓':'⚠'} ${l}`); if(!c) ko.push(l); };
const n = fs.readFileSync(R+'www/js/notes.js','utf-8');
const sy = fs.readFileSync(R+'www/js/sync.js','utf-8');
const sh = fs.readFileSync(R+'www/js/sheets.js','utf-8');
const uk = fs.readFileSync(R+'www/js/uikit.js','utf-8');
const bd = fs.readFileSync(R+'build.js','utf-8');

console.log('═══ STRICTEMENT PRIVÉ ═══');
// ⚠️ Demande explicite : ces notes ne partent jamais chez un confrère.
ck('rien dans le fichier de synchro', !/S\.notes|noteEtiq/.test(sy));
ck('la règle est écrite', /STRICTEMENT PRIVÉ/.test(n) && /ne partent JAMAIS dans une synchro/.test(n));
ck('et dite à l écran', /ni synchro, ni relève/.test(n));

console.log('\n═══ ORGANISER SANS CONTRAINDRE ═══');
ck('étiquettes, épingles, cases', /pin:/.test(n) && /fait:/.test(n) && /etiq:/.test(n));
ck('filtres par étiquette', /data-nof/.test(n));
ck('recherche plein texte', /\(\(n\.t \|\| ""\) \+ " " \+ \(n\.m \|\| ""\)\)\.toLowerCase\(\)\.includes\(q\)/.test(n));
// ⚠️ Les étiquettes appartiennent à l'utilisateur.
ck('étiquettes modifiables', /function sheetNoteEtiquettes/.test(n)
   && /data-neren/.test(n) && /data-nerm/.test(n));
// ⚠️ Le commentaire est sur deux lignes : chercher la phrase entière
// échouait sur le retour à la ligne.
ck('six proposées, aucune imposée', /NOTE_ETIQ_DEF/.test(n)
   && (NOTE_ETIQ_DEF_COUNT => NOTE_ETIQ_DEF_COUNT === 6)((n.match(/\{ id:"[^"]+",\s*n:"/g)||[]).length)
   && /aucune\s+n'est imposée/.test(n));
// ⚠️ Supprimer une étiquette ne doit pas laisser un identifiant mort.
ck('suppression propre d une étiquette', /x\.etiq = x\.etiq\.filter\(i => i !== e\.id\)/.test(n));

console.log('\n═══ CITER UN PATIENT ═══');
ck('choix dans la liste, pas de saisie libre', /titre:"Citer un patient"/.test(n));
ck('le nom ouvre la fiche', /data-nopat/.test(n) && /sheetPatient\(p, "id"\)/.test(n));
// ⚠️ Même piège que les fantômes de l'ordre de passage.
ck('un dossier supprimé ne laisse pas de citation morte',
   /function notesOublierPatient/.test(n) && /notesOublierPatient\(pid\)/.test(sh));

console.log('\n═══ CE QUE CE N EST PAS ═══');
// ⚠️ Une observation clinique ici ne partirait pas dans la relève.
ck('pas un dossier de soin', /CE N'EST PAS UN DOSSIER DE SOIN/.test(n)
   && /se note dans le passage du patient/.test(n));
ck('aucune écriture dans un dossier', !/p\.visits|\.plan\.push/.test(n));

console.log('\n═══ L ACCÈS ═══');
ck('module dans la chaîne', /'bilans','notes','detente'/.test(bd));
ck('outil de barre configurable', /"notes":\s*\{ ic:"📝"/.test(uk));
ck('tuile et entrée fiche', /data-sec="notes"/.test(sh) && /id="f-notes"/.test(sh));

console.log('\nERREURS:', ko.length ? ko.join(' · ') : 'aucune');
process.exit(ko.length ? 1 : 0);
