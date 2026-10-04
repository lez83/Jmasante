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

console.log('\nERREURS:', ko.length ? ko.join(' · ') : 'aucune');
process.exit(ko.length ? 1 : 0);
