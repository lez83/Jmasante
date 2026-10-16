// Le guide relu sur l'arrêté du 26 juin 2026 — version en essai.
const fs = require('fs'); const R = '../jmsante/';
let ko = []; const ck = (l,c) => { console.log(`  ${c?'✓':'⚠'} ${l}`); if(!c) ko.push(l); };
const g26 = fs.readFileSync(R+'www/js/guide26.js','utf-8');
const g = fs.readFileSync(R+'www/js/guide.js','utf-8');
const bd = fs.readFileSync(R+'build.js','utf-8');

console.log('═══ LA SOURCE ═══');
ck('texte cité avec sa référence', /NOR : SFHH2617311A/.test(g26) && /Journal officiel du 27 juin 2026/.test(g26));
ck('date de lecture affichée', /lu: "02\/10\/2026"/.test(g26) && /Texte lu le/.test(g));
// ⚠️ Le vocabulaire de l'arrêté n'est pas interchangeable.
ck('repères repris du texte', /badge:"Prescription"/.test(g26)
   && /badge:"Renouvellement"/.test(g26) && /badge:"Les deux"/.test(g26));

console.log('\n═══ LES QUATRE CORRECTIONS ═══');
ck('antiseptiques : les trois limites', /contenant un antibiotique/.test(g26)
   && /cinq premiers jours/.test(g26) && /pied diabétique/.test(g26));
ck('contention : à l identique', /identique de la force de compression/.test(g26)
   && !/classes 1 à 4/.test(g26));
ck('INR : une fois, sauf déséquilibre', /Renouvellement une fois du dosage de l'INR/.test(g26));
ck('examens : diabétiques connus + 3 mois', /diabétiques connus/.test(g26) && /trois derniers mois/.test(g26));

console.log('\n═══ LES CINQ AJOUTS ═══');
ck('antalgiques palier I', /Palier I selon la classification/.test(g26));
ck('adaptation de posologie', /Adaptation de posologie/.test(g26));
ck('bilan du sevrage', /Cholestérol, triglycérides et glycémie à jeun/.test(g26));
ck('perfusion et nutrition entérale', /Perfusion à domicile/.test(g26) && /naso-gastrique/.test(g26));
ck('déclaration vaccins (annexe I)', /déclare l'activité de prescription de vaccins/.test(g26));
ck('mentions contraceptifs (annexe II)', /Renouvellement infirmier/.test(g26));
ck('traçabilité pharmacien (article 3)', /prescription initiale par tout moyen de traçabilité/.test(g26));

console.log('\n═══ LE MARQUEUR DE DOSSIER ═══');
// ⚠️ Article 2 : sans exception.
ck('posé sur les blocs du texte', (g26.match(/dmp:true/g)||[]).length >= 14);
ck('et pas sur ce qui vient d ailleurs', /dmp:false/.test(g26));
ck('affiché dans le rendu', /class="gp-dmp"/.test(g));
ck('la légende l explique', /inscrire au dossier patient ou au DMP \(article 2\)/.test(g));

console.log('\n═══ L INTERRUPTEUR ═══');
// ⚠️ L'ancienne version n'est jamais écrasée.
ck('la source dépend de l essai', /essaiActif\("guide26"\)/.test(g) && /const SRC = _neuf \? GUIDE_PRESC_26 : GUIDE_PRESC/.test(g));
ck('bandeau d essai en tête', /essaiBandeau\("guide26"\)/.test(g));
ck('ancien guide intact', /const GUIDE_PRESC = \[/.test(g));
ck('module dans la chaîne', /'cabinet','guide','guide26','modeles','dispositifs','calculs','bilans','bilans_fiches','narratif','notes','detente'/.test(bd));

console.log('\n═══ CE QUI N EST PAS DU TEXTE ═══');
ck('le bloc remplaçant est signalé', /Ce bloc ne vient pas du texte du 26 juin 2026/.test(g26));
ck('les bonnes pratiques aussi', /\(hors texte\)/.test(g26));
ck('aucune suggestion de soin', /NE SUGGÈRE RIEN/.test(g26));

console.log('\nERREURS:', ko.length ? ko.join(' · ') : 'aucune');
process.exit(ko.length ? 1 : 0);
