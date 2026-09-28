// Deux pièges retrouvés en v1.0.77 : l'impression qui fige la WebView,
// et le retour qui remonte à la racine au lieu d'un cran.
const fs = require('fs'); const R = '../jmsante/';
let ko = []; const ck = (l,c) => { console.log(`  ${c?'✓':'⚠'} ${l}`); if(!c) ko.push(l); };
const cb = fs.readFileSync(R+'www/js/cabinet.js','utf-8');
const fi = fs.readFileSync(R+'www/js/fiche.js','utf-8');
const sh = fs.readFileSync(R+'www/js/sheets.js','utf-8');

console.log('═══ IMPRESSION ═══');
// ⚠️ Dans la WebView Android, window.open ouvre une fenêtre sans parent et
// la boîte d'impression ne rend jamais la main : l'app se fige et il faut
// la tuer. Le piège était DÉJÀ documenté dans fiche.js — et reproduit.
ck('aucun window.open dans les documents du cabinet',
   !/window\.open\(/.test(cb.replace(/\/\*[\s\S]*?\*\//g, '')));
ck('ordonnance confiée à imprimerDocument', /imprimerDocument\(html, base\)/.test(cb));
ck('courrier aussi', (cb.match(/imprimerDocument\(html, base\)/g)||[]).length >= 2);
ck('imprimerDocument distingue bien Android', /isNativePlatform/.test(fi) && /n'implémente PAS window\.print/.test(fi));

console.log('\n═══ RETOUR D UN CRAN ═══');
// ⚠️ bindNav() SANS argument revient à l'accueil : chaque écran doit dire
// d'où il vient, sinon on remonte à la liste des patients.
ck('fiche patient : onglet d ouverture', /function sheetPatient\(p, onglet\)/.test(sh));
ck('le PANNEAU suit l onglet', /pn\.classList\.toggle\("on", pn\.dataset\.pane === onglet\)/.test(sh));
ck('dossier RGPD revient sur Actions', /bindNav\(\(\) => sheetPatient\(pid, "act"\)\)/.test(fi));
ck('ordonnance revient sur Actions ou le cabinet', /pid \? sheetPatient\(pid, "act"\) : sheetCabinet\("entete"\)/.test(cb));
ck('courrier revient sur Mon en-tête', /bindNav\(\(\) => sheetCabinet\("entete"\)\)/.test(cb));
ck('fiche contact revient au cabinet', /bindNav\(\(\) => sheetCabinet\(\)\)/.test(cb));

console.log('\n═══ PLUSIEURS CABINETS, VISIBLES ═══');
// ⚠️ Le sélecteur était masqué tant que le premier cabinet n'était pas
// nommé : on ne voyait jamais qu'on pouvait en créer un second.
ck('sélecteur toujours affiché', /\/\* ⚠️ Le sélecteur était masqué[\s\S]{0,300}true \? `/.test(cb));
ck('un cabinet sans nom reste identifiable', /Cabinet sans nom/.test(cb));

console.log('\nERREURS:', ko.length ? ko.join(' · ') : 'aucune');
process.exit(ko.length ? 1 : 0);
