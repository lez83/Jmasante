// Les surprises — et surtout les règles qui les rendent acceptables.
const fs = require('fs'); const R = '../jmsante/';
let ko = []; const ck = (l,c) => { console.log(`  ${c?'✓':'⚠'} ${l}`); if(!c) ko.push(l); };
const e   = fs.readFileSync(R+'www/js/eggs.js','utf-8');
// ⚠️ On contrôle le CODE, pas les commentaires : ils citent justement les
// mots interdits pour expliquer pourquoi ils le sont.
const code = e.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/[^\n]*$/gm, '');
const d   = fs.readFileSync(R+'www/js/detente.js','utf-8');
const ini = fs.readFileSync(R+'www/js/init.js','utf-8');
const css = fs.readFileSync(R+'www/css/app.css','utf-8');
const gl  = fs.readFileSync(R+'www/js/globals.js','utf-8');
const bd  = fs.readFileSync(R+'build.js','utf-8');

console.log('═══ LES RÈGLES ═══');
// ⚠️ Une animation pendant la validation d'un passage est une distraction
// au mauvais moment.
ck('rien sur un écran patient', !/sheetPatient|pcard|valider/.test(code));
ck('rien dans un document', !/imprimer|pdf|feuille|DLU/i.test(code));
// ⚠️ Les balayages se déclenchent tout seuls en tournée.
ck('pas de geste à balayage', !/swipe|touchmove|deltaX/.test(code));
ck('déclencheurs par répétition', /_cigTaps < 7/.test(e) && /_verTaps < 7/.test(e));

console.log('\n═══ LA CIGALE ═══');
ck('sept touchers sur la mascotte', /function cigaleTouchee/.test(e));
// ⚠️ La mascotte ouvre les réglages : le compteur ne doit pas le gêner.
ck('son rôle normal est préservé', /sans toucher à son rôle/.test(ini)
   && !/preventDefault|stopPropagation/.test(e));
ck('cinq chants appellent le chœur', /function cigaleConcertCompter/.test(e) && /_cigSuite < 5/.test(e));
ck('le chœur est synthétisé', /createBuffer|createBiquadFilter/.test(e) && !/\.mp3|\.wav/.test(e));

console.log('\n═══ LE THÈME RÉTRO ═══');
ck('caché tant qu il n est pas trouvé', /secret:true/.test(gl) && /function themesDispo/.test(gl));
// ⚠️ Un easter egg qu'on doit reconquérir devient une corvée.
ck('une fois trouvé, il reste', /POUR TOUJOURS/.test(gl));
ck('style du terminal', /\[data-app-theme="retro"\]/.test(css));
// ⚠️ Une alerte ne doit jamais se fondre dans le décor.
ck('les couleurs de vigilance tiennent', /--amber:#FFAE34/.test(css) && /--danger:#FF5A5A/.test(css));
// ⚠️ Un texte flou en tournée serait un défaut, pas un charme.
ck('pas de halo sur les saisies', /\[data-app-theme="retro"\] \.rec-in[\s\S]{0,120}text-shadow:none/.test(css));
ck('le mouvement se coupe si demandé', /prefers-reduced-motion[\s\S]{0,120}crt-scan|crt-scan[\s\S]{0,200}prefers-reduced-motion/.test(css));

console.log('\n═══ LA FICHE CACHÉE ═══');
ck('31e fiche définie', /CIEL_SECRET/.test(e));
ck('hors rotation hebdomadaire', /n'entre JAMAIS dans la rotation/.test(d));
ck('révélée par la recherche', /eggPoser\("ciel"\)/.test(d));

console.log('\n═══ LE JEU ═══');
// ⚠️ 43 Ko n'ont rien à faire au démarrage.
ck('chargé à la demande', /function ouvrirJeu/.test(e) && /loading="lazy"/.test(e));
ck('pas au démarrage', !/jeu\/tubulure/.test(fs.readFileSync(R+'www/index.html','utf-8')));
// ⚠️ On peut être interrompu par un patient à tout moment.
ck('sortie toujours visible', /id="jeu-sortie"/.test(e) && /#jeu-sortie\{[\s\S]{0,160}position:fixed/.test(css));
ck('la touche Échap sort aussi', /e\.key === "Escape"/.test(e));
// ⚠️ Ses scores ne doivent ni entrer dans la sauvegarde ni grossir un dossier.
ck('scores dans leur propre stockage', /localStorage/.test(fs.readFileSync(R+'www/jeu/tubulure.html','utf-8'))
   && !/S\.scores|S\.jeu/.test(e));
ck('le jeu ne dépend de rien d extérieur',
   !/https?:\/\//.test(fs.readFileSync(R+'www/jeu/tubulure.html','utf-8').replace(/<!--[\s\S]*?-->/g,'')));

console.log('\n═══ L ACCÈS ═══');
ck('module dans la chaîne', /'cabinet','guide','detente','eggs','sync'/.test(bd));
ck('deux gestes distincts sur la version', /versionTouchee/.test(ini) && /ouvrirJeu/.test(ini));


console.log('\n═══ LE CARNET DES SURPRISES ═══');
ck('les cinq y figurent', (e.match(/\{ cle:"/g)||[]).length === 5);
// ⚠️ Caché lui-même : une liste en clair supprimerait le plaisir de
// chercher, mais ne rien écrire condamnerait les surprises à l'oubli.
ck('ouvert par trois touchers sur le slogan', /function sloganTouche/.test(e) && /_sloTaps < 3/.test(e));
{ const sh = fs.readFileSync(R+'www/js/sheets.js','utf-8');
  ck('le slogan est cliquable', /id="gd-slogan"/.test(sh));
  // ⚠️ Un câblage posé avant openSheet ne trouve pas son élément.
  ck('câblé APRÈS l ouverture du guide',
     sh.indexOf('_sl = $("#gd-slogan")') > sh.indexOf('$("#go-guide").onclick')); }
// ⚠️ Ce qui n'est pas trouvé ne se dévoile pas : on lit une énigme.
ck('les non trouvées restent masquées', /vu \? esc\(s\.nom\) : "\?"/.test(e));
ck('une énigme à la place', /enigme:/.test(e) && /class="srp-e"/.test(e));
ck('mais tout révéler reste possible', /id="srp-tout"/.test(e));
ck('révéler ne fausse pas le compteur', /sheetCarnet\(true\)/.test(e) && !/eggPoser[\s\S]{0,60}srp-tout/.test(e));

console.log('\nERREURS:', ko.length ? ko.join(' · ') : 'aucune');
process.exit(ko.length ? 1 : 0);
