// Trois défauts remontés du terrain le 29 septembre.
const fs = require('fs'); const R = '../jmsante/';
let ko = []; const ck = (l,c) => { console.log(`  ${c?'✓':'⚠'} ${l}`); if(!c) ko.push(l); };
const css = fs.readFileSync(R+'www/css/app.css','utf-8');
const html = fs.readFileSync(R+'www/index.html','utf-8');
const cb = fs.readFileSync(R+'www/js/cabinet.js','utf-8');

console.log('═══ LA LISTE QUI NE DÉFILAIT PAS ═══');
// ⚠️ `overflow:hidden` sans hauteur maximale : une liste de 36 métiers
// dépassait l'écran, rien ne défilait, et le doigt faisait glisser le
// FOND. L'app semblait figée — il fallait la tuer.
ck('la carte se limite à la hauteur visible', /max-height:min\(86vh, 86dvh\)/.test(css));
ck('c est le contenu qui défile', /\.dlg-in\{[\s\S]{0,140}overflow-y:auto/.test(css));
ck('le fond ne bouge plus sous le voile', /\.dlg-veil\{[\s\S]{0,260}touch-action:none/.test(css));
// ⚠️ touch-action:none sur le voile bloquerait aussi le contenu.
ck('mais le contenu garde son geste', /touch-action:pan-y/.test(css));

console.log('\n═══ THÈME CLAIR ═══');
// ⚠️ color-mix(var(--bg), #000) assombrit TOUJOURS : cadre gris foncé
// sous un texte sombre en thème clair.
ck('le cadre se mélange au texte, pas au noir', /\.cab-sel\{ background:color-mix\(in srgb, var\(--text\) 6%, var\(--bg\)\)/.test(css));
ck('le libellé tient sur fond clair', /\.cab-sel-t\{ font-size:var\(--fs-xs\); color:var\(--muted\)/.test(css));
ck('le cabinet actif reste lisible', /\.cabchip\.on\{ background:color-mix\(in srgb, var\(--accent\) 18%, var\(--bg\)\)/.test(css));

console.log('\n═══ DÉMARRAGE ALLÉGÉ ═══');
// ⚠️ 1,35 Mo chargés à CHAQUE ouverture pour des bibliothèques qui ne
// servent qu'à un PDF ou à un QR.
['jspdf.min.js','pdfjs.js','jsQR.js','qrcode.js'].forEach(l =>
  ck(l + ' hors du démarrage', !new RegExp('<script src="js/libs/' + l.replace('.','\\.')).test(html)));
ck('chargeur à la demande', /function chargerLib/.test(cb));
ck('les documents attendent la bibliothèque', /await pdfPret\(\)/.test(cb));
{ const sy = fs.readFileSync(R+'www/js/sync.js','utf-8');
  ck('le scan de QR attend la sienne', /await libQrLire\(\)/.test(sy)); }
{ const rc = fs.readFileSync(R+'www/js/recueil.js','utf-8');
  ck('la lecture de PDF attend la sienne', /await libPdfLire\(\)/.test(rc)); }

console.log('\nERREURS:', ko.length ? ko.join(' · ') : 'aucune');
process.exit(ko.length ? 1 : 0);
