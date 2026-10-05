// Un document sort à l'en-tête du cabinet DU PATIENT.
const fs = require('fs'); const R = '../jmsante/www/js/';
let ko = []; const ck = (l,c) => { console.log(`  ${c?'✓':'⚠'} ${l}`); if(!c) ko.push(l); };
const cb = fs.readFileSync(R+'cabinet.js','utf-8');
const ini = fs.readFileSync(R+'init.js','utf-8');
const mo = fs.readFileSync(R+'modeles.js','utf-8');
const di = fs.readFileSync(R+'dispositifs.js','utf-8');

console.log('═══ LE LIEN TOURNÉE → CABINET ═══');
// ⚠️ Rien ne reliait une tournée à un cabinet : un document pour un
// patient du Cabinet A sortait à l'en-tête du B si on y avait travaillé.
ck('un cabinet déclare ses tournées', /function cabinetDeTournee/.test(cb) && /data-cabt2/.test(cb));
ck('le cabinet du patient se déduit', /function cabinetDuPatient/.test(cb));
ck('la tournée courante prime si le patient en fait partie', /t\.includes\(S\.curTour\)/.test(cb));
// ⚠️ Une tournée n'appartient qu'à UN cabinet, sinon la question n'a pas
// de réponse.
ck('une tournée prise est désactivée, pas volée', /\$\{autre \? "disabled" : ""\}/.test(cb));
ck('repli sur le cabinet ouvert si rien n est déclaré',
   /return cabinetDuPatient\(p\) \|\| cabinet\(\)/.test(cb));

console.log('\n═══ LE RAPPROCHEMENT AUTOMATIQUE ═══');
// ⚠️ « Tournée Oliviers » et « Cabinet des Oliviers » ne se contiennent
// pas : comparer les chaînes entières échouait. On compare les MOTS.
ck('comparaison par mots significatifs', /const VIDES = new Set\(\["cabinet"/.test(ini));
ck('articles et mots courts écartés', /w\.length > 2 && !VIDES\.has\(w\)/.test(ini));
ck('un seul cabinet prend toutes les tournées', /S\.cabinets\[0\]\.tours = \[\.\.\.\(S\.tours \|\| \[\]\)\]/.test(ini));
ck('proposé une seule fois', /S\.cabToursInit = 1/.test(ini));

console.log('\n═══ LES DOCUMENTS ═══');
// ⚠️ Sans le cabinet en argument, enteteDocument relisait le cabinet
// OUVERT et annulait tout le travail.
ck('la composition reçoit le cabinet', /function enteteDocument\(ch, cab\)/.test(cb)
   && /const M = moi\(\), C = cab \|\| cabinet\(\)/.test(cb));
ck('ordonnance : cabinet du patient', /const C = cabinetPourDoc\(p0\)/.test(cb));
ck('modèles alignés', /cabinetPourDoc\(p\)/.test(mo));
ck('dispositifs alignés', /cabinetPourDoc\(p\)/.test(di));
// ⚠️ Le lien fixe le DÉFAUT, il ne verrouille rien.
ck('le choix reste ouvert', /LE CHOIX RESTE OUVERT/.test(cb) && /id="or-sig"/.test(cb));

console.log('\nERREURS:', ko.length ? ko.join(' · ') : 'aucune');
process.exit(ko.length ? 1 : 0);
