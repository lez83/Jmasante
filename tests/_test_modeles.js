// Les modèles de documents : produits pré-remplis, modifiables, réversibles.
const fs = require('fs'); const R = '../jmsante/';
let ko = []; const ck = (l,c) => { console.log(`  ${c?'✓':'⚠'} ${l}`); if(!c) ko.push(l); };
const m = fs.readFileSync(R+'www/js/modeles.js','utf-8');
const e = fs.readFileSync(R+'www/js/essais.js','utf-8');
const sh = fs.readFileSync(R+'www/js/sheets.js','utf-8');
const cb = fs.readFileSync(R+'www/js/cabinet.js','utf-8');
const bd = fs.readFileSync(R+'build.js','utf-8');

console.log('═══ LES DEUX MODÈLES ═══');
ck('questionnaire et attestation', /cle:"prevac"/.test(m) && /cle:"attestvac"/.test(m));
ck('les sept questions d origine', (m.match(/Avez-vous|Êtes-vous/g)||[]).length >= 7);
ck('le consentement y est', /type:"consentement"/.test(m) && /j'autorise mon infirmier\(e\) à me vacciner/.test(m));
// ⚠️ Ne pas confondre avec docs.js, qui nomme les documents SCANNÉS.
ck('module distinct de docs.js', /Ne pas confondre avec docs\.js/.test(m));

console.log('\n═══ MODIFIABLE, MAIS JAMAIS PERDU ═══');
ck('édition des questions et champs', /data-dqadd/.test(m) && /data-dqrm/.test(m));
ck('retour au modèle d origine', /function docRestaurer/.test(m) && /id="dc-raz"/.test(m));
// ⚠️ Ce que l'utilisateur écrit est imprimé tel quel sur un document signé.
ck('il est prévenu de ce que ça engage', /L'application ne relit rien/.test(m)
   && /CE QUE TU ÉCRIS T'ENGAGE/.test(m));
ck('les lignes vides sont jetées', /x\.items = x\.items\.filter\(y => y\.trim\(\)\)/.test(m));

console.log('\n═══ LA RÈGLE DU SOCLE D ESSAI ═══');
// ⚠️ Une fonction en essai n'écrit rien dans les données de tournée.
ck('les modèles vivent dans les données d essai', /essaiData\("documents"\)/.test(m));
ck('aucune écriture dans un dossier', !/p\.docs\.push/.test(m) && !/S\.patients\[/.test(m));
ck('et c est dit à l utilisateur', /ne s'attache pas encore au dossier/.test(m));
ck('essai déclaré', /cle:"documents"/.test(e));

console.log('\n═══ LA PRODUCTION ═══');
// ⚠️ pdfEnTete renvoie un OBJET, pas une ordonnée.
ck('position d en-tête correctement lue', /const tete = pdfEnTete/.test(m) && /tete\.y \+ 2/.test(m));
ck('cases dessinées, pas en émoji', /doc\.rect\(MG \+ L - 28/.test(m) && /sansEmoji/.test(m));
// ⚠️ fmtFR abrège : interdit sur une date de naissance.
ck('date de naissance en clair', /p\.dob\.split\("-"\)\.reverse\(\)\.join\("\/"\)/.test(m) && !/fmtFR\(p\.dob\)/.test(m));
ck('identité et RPPS repris de Ma fiche', /enteteDocument\(sig\)/.test(m) && /E\.rpps \|\| M2\.rpps/.test(m));
ck('deux entrées : fiche patient et Ma fiche', /id="f-modeles"/.test(sh) && /id="mo-docs"/.test(cb));
ck('module dans la chaîne', /'cabinet','guide','guide26','modeles','dispositifs','calculs','bilans','detente'/.test(bd));


console.log('\n═══ LA CONDUITE À TENIR ═══');
ck('les sept situations', (m.match(/\{ q:"/g)||[]).length === 7);
ck('procédure et traçabilité', /procedure:\[/.test(m) && /15 minutes/.test(m));
// ⚠️ LA règle : l'app ne lit pas les réponses et n'en déduit rien.
// Sinon elle entrerait dans l'aide à la décision clinique.
ck('aucune lecture des réponses', /NE LIT PAS LES RÉPONSES ET N'EN DÉDUIT RIEN/.test(m));
ck('et c est dit à l écran', /ne lit pas tes réponses<\/b> et n'en déduit rien/.test(m));
ck('aucun lien entre une case et un conseil', !/if \([^)]*coch|reponse\s*===|answers\[/.test(m));
// ⚠️ Fiche interne : elle ne s'accole jamais au document du patient.
ck('PDF séparé', /async function aideProduire/.test(m)
   && /Conduite_a_tenir_pre-vaccinal_/.test(m));
ck('bandeau « ne pas remettre au patient »', /Ne pas remettre au patient/.test(m));
ck('modifiable et réversible', /essaiData\("documents"\)\.aide/.test(m)
   && /delete essaiData\("documents"\)\.aide/.test(m));
ck('texte attribué à l utilisateur', /CE TEXTE EST CELUI DE L'UTILISATEUR/.test(m));

console.log('\nERREURS:', ko.length ? ko.join(' · ') : 'aucune');
process.exit(ko.length ? 1 : 0);
