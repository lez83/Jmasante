// Effacer plusieurs médicaments d'un coup, et la note qui ne sort pas
// sur la fiche du patient.
const fs = require('fs'); const R = '../jmsante/';
let ko = []; const ck = (l,c) => { console.log(`  ${c?'✓':'⚠'} ${l}`); if(!c) ko.push(l); };
const tr = fs.readFileSync(R+'www/js/traitement.js','utf-8');
const css = fs.readFileSync(R+'www/css/app.css','utf-8');
const gl = fs.readFileSync(R+'www/js/globals.js','utf-8');

console.log('═══ EFFACER PLUSIEURS LIGNES ═══');
ck('un mode sélection, pas des cases permanentes', /let selMode = false/.test(tr)
   && /id="tr-sel"/.test(tr));
// ⚠️ Une sélection qui survivrait d'un dossier à l'autre ferait supprimer
//    les lignes du mauvais patient.
ck('la sélection vit dans l ouverture de la fiche, pas dans le module',
   /const nom = p\.prenom[\s\S]{0,400}let selMode = false/.test(tr));
ck('tout cocher / tout décocher', /id="tr-all"/.test(tr) && /Tout décocher/.test(tr));
ck('Supprimer reste inerte tant que rien n est coché', /id="tr-del" \$\{pris\.size\?"":"disabled"\}/.test(tr));
ck('le bouton ✏️ disparaît pendant la sélection', /\.trgrid\.trsel \.tr-e\{ display:none/.test(css));
ck('la case prend une colonne au lieu de se superposer',
   /\.trgrid\.trsel \.tr-r\{ grid-template-columns:24px/.test(css));

console.log('\n═══ L ANNULATION ═══');
// ⚠️ Une ordonnance entière effacée par erreur, c'est une saisie complète à refaire.
ck('une copie est gardée avant de supprimer', /const avant = L\.map\(l => \(\{ \.\.\.l \}\)\)/.test(tr));
ck('le message propose d annuler', /label:"Annuler", ms:8000/.test(tr));
ck('et remet la liste d avant', /p\.traitement\.lignes = avant/.test(tr));
// ⚠️ TROUVÉ EN ÉPROUVANT : #toast porte pointer-events:none et rien ne le
//    relevait — AUCUN « Annuler » de l'app n'était cliquable.
ck('les messages porteurs d une action acceptent le clic',
   /#toast\.with-act\{[\s\S]*?pointer-events:auto/.test(css));
ck('un message simple reste traversant (il ne doit rien bloquer)',
   /#toast\{[\s\S]*?pointer-events:none/.test(css));

console.log('\n═══ LE RACCOURCI « NOUVELLE ORDONNANCE » ═══');
ck('il entre dans le mode sélection avec tout coché', /id="tr-neuve"/.test(tr)
   && /selMode = true; pris\.clear\(\);[\s\S]{0,120}forEach\(l => pris\.add\(l\.id\)\)/.test(tr));
ck('il laisse le choix entre tout effacer et trier', /Choisir ce que je garde/.test(tr));
ck('aucune seconde mécanique de suppression', (tr.match(/function supprimerLot/g)||[]).length === 1);

console.log('\n═══ LA NOTE SOIGNANTE ═══');
ck('un second champ dans la fiche du médicament', /id="te-soig"/.test(tr));
ck('il est enregistré sur la ligne', /l\.soig = \(\$\("#te-soig"\)\?\.value \|\| ""\)\.trim\(\)/.test(tr));
ck('une pastille signale qu une note existe, sans la montrer', /class="tr-i"/.test(tr));
ck('elle se déplie en cliquant sur le NOM', /data-tsoig=/.test(tr) && /deplie\.has\(id\)/.test(tr));
// ⚠️ Sans stopPropagation, ouvrir une note cocherait la ligne en mode sélection.
ck('ouvrir une note ne coche pas la ligne', /ev\.stopPropagation\(\)/.test(tr));
ck('un interrupteur montre tout d un coup', /id="tr-soigall"/.test(tr));
ck('pendant la sélection, les notes se replient', /\.trgrid\.trsel \.tr-soig\{ display:none/.test(css));

console.log('\n═══ CE QUI NE DOIT JAMAIS SORTIR ═══');
// ⚠️ LE POINT CENTRAL : la note soignante ne figure pas sur la fiche remise
//    au patient. Le défaut d'un paramètre absent doit être la version SÛRE.
ck('traitHtml rend la version patient par défaut',
   /const soignant = !!\(opts && opts\.soignant\)/.test(tr));
ck('la note ne sort QUE sur la version soignant',
   /soignant && \(l\.soig\|\|""\)\.trim\(\)/.test(tr));
ck('la version soignant s annonce', /VERSION SOIGNANT/.test(tr)
   && /à ne pas laisser au domicile/.test(tr));
ck('la version patient est proposée en premier',
   /non:"👤 Version patient", oui:"🩺 Version soignant"/.test(tr));
ck('sans note soignante, la question n est pas posée', /if \(aSoig\)\{/.test(tr));
// ⚠️ Le DLU et la relève passent par traitTexte : il ne lit que nom + posologie.
ck('le DLU ne lit ni les remarques ni les notes',
   !/traitTexte[\s\S]{0,420}l\.soig/.test(tr) && !/traitTexte[\s\S]{0,420}l\.note/.test(tr));
ck('le champ dit où il va et où il ne va pas',
   /N'apparaît pas sur la fiche remise[\s\S]{0,80}au patient/.test(tr));

console.log('\n' + (ko.length ? '⚠ ' + ko.length + ' point(s) : ' + ko.join(' · ')
                              : '✓ tout est en place'));
process.exit(ko.length ? 1 : 0);
