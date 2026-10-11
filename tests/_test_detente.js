// La rubrique « Souffler » : respirer, s'étirer, la cigale, le ciel.
const fs = require('fs'); const R = '../jmsante/';
let ko = []; const ck = (l,c) => { console.log(`  ${c?'✓':'⚠'} ${l}`); if(!c) ko.push(l); };
const d  = fs.readFileSync(R+'www/js/detente.js','utf-8');
// ⚠️ On contrôle le CODE, pas les commentaires : ceux-ci citent
// justement les mots qu'on interdit, pour expliquer pourquoi.
const code = d.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/[^\n]*$/gm, '');
const sh = fs.readFileSync(R+'www/js/sheets.js','utf-8');
const bd = fs.readFileSync(R+'build.js','utf-8');
const css = fs.readFileSync(R+'www/css/app.css','utf-8');

console.log('═══ CE QUE CE N EST PAS ═══');
// ⚠️ Même ligne que pour les constantes et les plaies : l'app n'interprète
// rien et ne suit rien. Pas d'historique d'humeur, pas de courbe.
ck('aucun suivi, aucune mesure', !/S\.humeur|historique|moyenne|courbe/i.test(code));
ck('rien ne part dans une relève', /rien ne part dans une relève/.test(d));
// ⚠️ « cohérence cardiaque » est un terme médical : l'app n'est pas un
// dispositif de soin.
ck('pas de vocabulaire médical', !/cohérence cardiaque/i.test(code));
ck('dit ce qu il n est pas', /Ce n'est pas du soin/.test(d));

console.log('\n═══ RESPIRER ═══');
// ⚠️ L'expiration plus longue que l'inspiration : c'est elle qui apaise.
ck('4 temps inspire, 6 expire', /RESP_INSP = 4, RESP_EXP = 6/.test(d));
ck('six cycles, une minute', /RESP_CYCLES = 6/.test(d));
ck('la transition dure le temps de la phase', /transition = `transform \$\{d\}s/.test(d));
ck('interruption possible', /_respStop/.test(d));

console.log('\n═══ LA CIGALE ═══');
// ⚠️ Synthétisé : un fichier son pèserait des centaines de Ko pour 3 s,
// dans une app qu'on vient d'alléger de 1,35 Mo.
ck('son fabriqué, pas embarqué', /createBuffer|createBiquadFilter/.test(d));
ck('aucun fichier audio ajouté', !/\.mp3|\.wav|\.ogg/.test(d));
ck('le mouvement se coupe si demandé', /prefers-reduced-motion/.test(css));

console.log('\n═══ S ÉTIRER ═══');
ck('quatre mouvements', (d.match(/\{ ic:"[^"]+", t:"/g)||[]).length === 4);
ck('les mains en font partie', /t:"Les mains"/.test(d));
ck('minuteur par mouvement', /const lancer = \(\)/.test(d));
ck('avertissement : jamais de douleur', /ne doit faire mal/.test(d));

console.log('\n═══ LE CIEL ═══');
// ⚠️ Il travaille une semaine sur deux : trois fiches par semaine sur
// trente, cela fait dix semaines — soit cinq mois sans répétition.
ck('trente fiches', (d.match(/\{ n:"[^"]+", f:"/g)||[]).length === 30);
ck('rotation hebdomadaire', /function cielSemaine/.test(d));
ck('feuilletage libre', /id="ciel-prev"/.test(d) && /id="ciel-next"/.test(d));
// ⚠️ « slice » agrandissait 3,8 fois : les étoiles devenaient des disques.
ck('carte entière visible', /preserveAspectRatio="xMidYMid meet"/.test(d));
// url(#…) désigne un dégradé interne, pas un fichier distant.
ck('tout est dessiné', !/<img/.test(code) && !/url\(['"]?http/.test(code));

console.log('\n═══ L ACCÈS ═══');
ck('module dans la chaîne', /'cabinet','guide','guide26','modeles','dispositifs','calculs','bilans','bilans_fiches','narratif','notes','detente','eggs','essais','sync'/.test(bd));
ck('tuile dans les réglages', /data-sec="souffler"/.test(sh) && /case "souffler": sheetDetente/.test(sh));

console.log('\nERREURS:', ko.length ? ko.join(' · ') : 'aucune');
process.exit(ko.length ? 1 : 0);
