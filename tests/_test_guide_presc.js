// Le guide de prescription : une notice pour l'infirmier, jamais une
// donnée de soin — et surtout jamais un conseil.
const fs = require('fs'); const R = '../jmsante/';
let ko = []; const ck = (l,c) => { console.log(`  ${c?'✓':'⚠'} ${l}`); if(!c) ko.push(l); };
const g  = fs.readFileSync(R+'www/js/guide.js','utf-8');
const sh = fs.readFileSync(R+'www/js/sheets.js','utf-8');
const cb = fs.readFileSync(R+'www/js/cabinet.js','utf-8');
const bd = fs.readFileSync(R+'build.js','utf-8');

console.log('═══ LE CONTENU ═══');
ck('module dans la chaîne', /'cabinet','guide','sync'/.test(bd));
ck('les 9 chapitres', (g.match(/\{ n:\d+, titre:/g)||[]).length === 9);
ck('les 14 blocs', (g.match(/badge:/g)||[]).length === 14);
ck('les alertes conservées', (g.match(/alerte:/g)||[]).length >= 6);
// ⚠️ Figé : une fausse manœuvre ne doit pas effacer ce travail.
ck('contenu non modifiable depuis l app', !/GUIDE_PRESC\s*=\s*\[\][\s\S]{0,200}push/.test(g)
   && !/GUIDE_PRESC\[.*\]\s*=/.test(g));

console.log('\n═══ CE QU IL N EST PAS ═══');
// ⚠️ C'est la ligne tenue depuis le début : l'app affiche, elle n'interprète pas.
ck('aucune suggestion de prescription', !/suggér|recommand(e|ons) de prescrire|tu peux prescrire/i.test(g));
ck('il le dit à l écran', /elle ne conseille rien/.test(g));
ck('rien ne part dans un dossier ni une relève', /n'entre dans un dossier/.test(g));
ck('avertissement daté en tête', /Document de travail, daté/.test(g) && /ta prescription t'engage/.test(g));

console.log('\n═══ LES DEUX ENTRÉES ═══');
ck('menu Cigale', /row\("presc","📋"/.test(sh) && /case "presc":\s*sheetGuidePresc/.test(sh));
// ⚠️ La question se pose au moment de rédiger, pas à froid.
ck('depuis l écran de l ordonnance', /id="or-guide"/.test(cb) && /Que puis-je prescrire/.test(cb));

console.log('\n═══ LECTURE ═══');
ck('un chapitre à la fois', /_guideOuvert === m\.n/.test(g));
ck('recherche dans tout le texte', /colle\(m\)\.includes\(q\)/.test(g));
// ⚠️ Filtrer sans déplier ne montrerait rien.
ck('une recherche ouvre ce qu elle trouve', /const ouvert = m => q \? true/.test(g));
// ⚠️ « Conditionné » seul ne disait pas conditionné à QUOI.
ck('la condition remonte sous le badge', /function guideCondition/.test(g));
ck('et n est pas répétée dans la liste', /!\/condition\/i\.test\(k\)/.test(g));
ck('badges Autonome / Conditionné distincts', /gp-badge \$\{b\.type === "cond"/.test(g));

console.log('\nERREURS:', ko.length ? ko.join(' · ') : 'aucune');
process.exit(ko.length ? 1 : 0);
