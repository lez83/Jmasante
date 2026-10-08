// Trois thèmes de plus, et un fini applicable à tous.
const fs = require('fs'); const R = '../jmsante/';
let ko = []; const ck = (l,c) => { console.log(`  ${c?'✓':'⚠'} ${l}`); if(!c) ko.push(l); };
const g = fs.readFileSync(R+'www/js/globals.js','utf-8');
const u = fs.readFileSync(R+'www/js/uikit.js','utf-8');
const css = fs.readFileSync(R+'www/css/app.css','utf-8');

console.log('═══ LES TROIS THÈMES ═══');
ck('déclarés', /hd:\{lbl:"✨ Haute définition"/.test(g)
   && /relief:\{lbl:"🧊 Relief"/.test(g) && /grave:\{lbl:"🪨 Gravé"/.test(g));
ck('visibles, pas secrets', !/hd:\{[^}]*secret:true/.test(g));
ck('leurs couleurs existent', /\[data-app-theme="hd"\]\{/.test(css)
   && /\[data-app-theme="relief"\]\{/.test(css) && /\[data-app-theme="grave"\]\{/.test(css));

console.log('\n═══ LE FINI, SÉPARÉ DES COULEURS ═══');
// ⚠️ Sans cette séparation, il aurait fallu dupliquer CHAQUE thème en
// version plate, relief et gravée.
ck('un réglage à part', /S\.fini \|\| "auto"/.test(g) && /dataset\.fini = f/.test(g));
ck('« auto » suit le thème', /\(APP_THEMES\[t\] \|\| \{\}\)\.fini \|\| "plat"/.test(g));
ck('chaque thème porte son fini', /fini:"hd"/.test(g) && /fini:"relief"/.test(g) && /fini:"grave"/.test(g));
ck('cinq choix à l écran', /data-fini="\$\{k\}"/.test(u)
   && (u.match(/\["auto"|\["plat"|\["hd"|\["relief"|\["grave"/g)||[]).length >= 5);
ck('il voyage avec les réglages partagés', /\["theme", "fini"/.test(u));

console.log('\n═══ CE QUI FAIT LE VOLUME ═══');
// ⚠️ Ce n'est pas l'ombre mais le BISEAU : ligne claire en haut, ligne
// noire en bas.
ck('biseau en relief', /border-top-color:rgba\(255,255,255,\.26\)/.test(css)
   && /inset 0 -1px 0 rgba\(0,0,0,\.65\)/.test(css));
ck('gravé = le sens inversé', /\[data-fini="grave"\][\s\S]{0,400}inset 0 2px 5px rgba\(0,0,0,\.70\)/.test(css));
ck('la haute définition ne fait pas de volume',
   !/\[data-fini="hd"\][\s\S]{0,300}0 22px 38px/.test(css));
// ⚠️ La carte en alerte monte d'un cran — EN PLUS de la couleur.
ck('l alerte monte d un cran', /\[data-fini="relief"\] \.pcard\.alerte/.test(css));

console.log('\n═══ LES GARDE-FOUS ═══');
// ⚠️ Un thème clair : une ombre noire profonde y ferait une tache.
ck('ombres atténuées sur thème clair', /\[data-app-theme="papier"\]\[data-fini="relief"\]/.test(css)
   && /--om:\.22/.test(css));
// ⚠️ Le relief est un confort, jamais une information.
ck('tout redevient plat si le téléphone le demande',
   /prefers-reduced-motion: reduce\)\{[\s\S]{0,300}box-shadow:none !important/.test(css));
// ⚠️ On vérifie règle par règle, pas par une expression globale qui
// attrapait « border-top-color » et criait au loup.
{ const bloc = css.slice(css.indexOf('LES TROIS THÈMES DE FINI'));
  const fautives = (bloc.match(/\[data-fini[^{]*\{[^}]*\}/g) || [])
    .filter(r => /\.(bad|alerte|v-bad)\b/.test(r) && /(^|[;{\s])color:/.test(r));
  ck('les couleurs de vigilance ne sont pas touchées', fautives.length === 0); }
ck('et c est dit à l écran', /le relief s'ajoute à l'alerte, il ne la remplace pas/.test(u));


console.log('\n═══ LE RELIEF, PARTOUT ═══');
// ⚠️ L'effet s'arrêtait aux cartes patient : tout le reste restait plat
// et l'œil le voyait.
['tbtn','mtile','e-doc','pr-v','pz-opt'].forEach(c =>
  ck('relief sur .' + c, new RegExp('\\[data-fini="relief"\\][^{]*\\.' + c).test(css)));
ck('et sur les boutons', /\[data-fini="relief"\] \.btn\{|\[data-fini="relief"\] \.btn,/.test(css));
// ⚠️ Le seul endroit où le relief porte une INFORMATION, en plus de la
// couleur : l'onglet actif ressort, les inactifs s'enfoncent.
ck('onglet actif en relief', /\[data-fini="relief"\] \.ftab\.on\{/.test(css));
ck('onglets inactifs enfoncés', /\[data-fini="relief"\] \.ftab\{[\s\S]{0,200}inset 0 3px 6px/.test(css));
ck('le bouton principal est une touche', /\[data-fini="relief"\] \.btn-primary\{/.test(css)
   && /\.btn-primary:active\{[\s\S]{0,120}translateY\(1px\)/.test(css));
// ⚠️ Une tuile de 60 px avec l'ombre d'une carte de 300 flotte sans raison.
ck('ombres calibrées par taille', /0 7px 13px rgba\(0,0,0,calc\(\.42/.test(css)
   && /0 22px 38px rgba\(0,0,0,calc\(\.42/.test(css));
ck('le gravé suit la même liste', /\[data-fini="grave"\] \.tbtn/.test(css)
   && /\[data-fini="grave"\] \.ftab\.on\{/.test(css));
ck('la haute définition reste sans volume',
   !/\[data-fini="hd"\][^{]*\.tbtn[^{]*\{[^}]*0 7px 13px/.test(css));
ck('tout redevient plat si demandé', /\[data-fini\] \.ftab, \[data-fini\] \.ftab\.on\{/.test(css));

console.log('\n═══ LE PANNEAU RESTE OPAQUE ═══');
// ⚠️ PIÈGE VU TROIS FOIS : --surface sert AUSSI de fond aux panneaux.
// Une valeur translucide laisse voir l'écran du dessous.
ck('surfaces opaques en haute définition', !/\[data-app-theme="hd"\]\{[\s\S]{0,200}--surface:rgba/.test(css));
ck('et une règle générale ferme le sujet',
   /\.sheet, #sheet, \.dlg-card\{ background-color:var\(--bg\)/.test(css));


console.log('\n═══ LES BOUTONS OUBLIÉS (retour du 4 oct.) ═══');
// ⚠️ Ils avaient leurs propres classes, absentes de ma liste écrite à
// la main. Tout élément hors liste restait plat sans que rien ne le
// signale — c'est la faiblesse d'une liste manuelle.
['fchip','tool','spill','slotsec-h','selb','mic'].forEach(c =>
  ck('relief sur .' + c, new RegExp('\\[data-fini="relief"\\][^{]*\\.' + c + '[,{\\s]').test(css)));
// ⚠️ Un bouton sur lequel on a appuyé reste ENFONCÉ. Le faire ressortir
// se lirait comme « pas encore choisi ».
// La règle groupe .fchip.on et .chip.on : on cherche le creux, pas le sélecteur exact.
ck('le filtre actif est enfoncé', /\.fchip\.on,[\s\S]{0,420}inset 0 3px 7px rgba\(0,0,0,\.62\)/.test(css));
ck('en gravé, l actif est le seul en relief',
   /\[data-fini="grave"\] \.fchip\.on[\s\S]{0,200}0 2px 5px rgba/.test(css));
// ⚠️ Ces éléments sont petits, nombreux et serrés : ombre COURTE.
ck('ombre courte sur les petits éléments',
   /OMBRE COURTE[\s\S]{0,400}0 2px 4px rgba\(0,0,0,calc\(\.36/.test(css));
ck('le gravé suit la même liste', /\[data-fini="grave"\] \.fchip,/.test(css));
ck('et tout redevient plat si demandé', /\[data-fini\] \.slotsec-h, \[data-fini\] \.selb/.test(css));

console.log('\nERREURS:', ko.length ? ko.join(' · ') : 'aucune');
process.exit(ko.length ? 1 : 0);
