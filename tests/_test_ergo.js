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


console.log('\n═══ MENUS DÉROULANTS HABILLÉS ═══');
const uik = fs.readFileSync(R+'www/js/uikit.js','utf-8');
// ⚠️ Un <select> est dessiné par ANDROID : fond gris, pastilles rondes,
// typographie du système — rupture visible au milieu d'un thème.
ck('habillage générique', /function habillerSelect\(/.test(uik) && /function habillerSelects\(/.test(uik));
// ⚠️ Le select reste dans le document : tout le code lit sa .value et
// écoute « change ». Le supprimer casserait tout en silence.
ck('le select est caché, pas retiré', /sel\.classList\.add\("sel-cache"\)/.test(uik)
   && /On n'enlève PAS le select/.test(uik));
ck('le choix passe par la liste maison', /await askChoice\(\{/.test(uik));
ck('l événement change est bien émis', /new Event\("change", \{ bubbles:true \}\)/.test(uik));
ck('le bouton suit si le code change la valeur', /sel\.addEventListener\("change", maj\)/.test(uik));
// ⚠️ Les écrans se redessinent sans arrêt : un appel par rendu serait
// oublié quelque part.
ck('surveillance des écrans redessinés', /new MutationObserver/.test(uik) && /subtree:true/.test(uik));
ck('style du faux menu', /\.selfake\{/.test(css) && /\.sel-cache\{/.test(css));
ck('cible tactile de 44 px', /\.selfake\{[\s\S]{0,200}min-height:44px/.test(css));


console.log('\n═══ PAS DE CODE DANS LES ÉCRANS ═══');
const sh = fs.readFileSync(R+'www/js/sheets.js','utf-8');
// ⚠️ Une insertion à l'intérieur d'un gabarit HTML — ici le corps de
// `$("#go-guide").onclick = () => { openSheet(`…`) }` — coupe une balise
// en deux et le CODE S'AFFICHE À L'ÉCRAN. Vu sur le guide d'utilisation.
// ⚠️ On compare du CODE, pas des commentaires : le commentaire
// d'avertissement contient lui aussi le motif recherché.
{ const sansCom = sh.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/[^\n]*$/gm, '');
  ck('le câblage du guide prescription est hors gabarit',
     /\{ const _e = \$\("#go-presc"\);/.test(sansCom)
     && sansCom.indexOf('$("#go-presc")') < sansCom.indexOf('$("#go-guide").onclick')); }
ck('aucun appel de fonction dans une balise de style',
   !/style="[^"]*\$\("#|style="[^"]*closeSheet\(/.test(sh));
ck('aucun accolade orpheline dans un attribut',
   !/style="[^"]*;\s*\{ const /.test(sh));
['sheets.js','cabinet.js','guide.js','ui.js','uikit.js'].forEach(f => {
  const t = fs.readFileSync(R+'www/js/'+f,'utf-8');
  ck(f + ' : pas de code coupant un attribut', !/<[a-z]+ [^>]*="[^"]*\n\s*\{ const/.test(t));
});

console.log('\nERREURS:', ko.length ? ko.join(' · ') : 'aucune');
process.exit(ko.length ? 1 : 0);
