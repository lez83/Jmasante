// La relève en fiches, pour les sorties mises en forme.
const fs = require('fs'); const R = '../jmsante/';
let ko = []; const ck = (l,c) => { console.log(`  ${c?'✓':'⚠'} ${l}`); if(!c) ko.push(l); };
const sh = fs.readFileSync(R+'www/js/share.js','utf-8');
const en = fs.readFileSync(R+'www/js/engine.js','utf-8');

console.log('═══ LE TEXTE BRUT NE CHANGE PAS ═══');
// ⚠️ C'est le seul format qui se colle dans un message, se lit sans
// pièce jointe et ne se déforme nulle part.
ck('les cadres du texte sont intacts', /\u250C/.test(en) && /\u2514/.test(en));
ck('et le découpage repose dessus', /split\(\/\\n\(\?=\u250C\)\/\)/.test(sh));

console.log('\n═══ LES FICHES (HTML ET PDF) ═══');
ck('en-tête nom + âge séparés', /MISE EN PAGE « FICHES »/.test(sh)
   && /mAge = nomTxt\.match/.test(sh));
ck('cadre par patient dans le PDF', /roundedRect\(M-2, yFiche/.test(sh));
// ⚠️ Le cadre SÉPARE, il ne signale pas : c'est ce qui permet à un
// patient en narratif de voisiner avec un télégraphique.
ck('le cadre sert à séparer', /C'est\s+lui qui sépare deux patients/.test(sh));

console.log('\n═══ PAS DE CADRE ROUGE ═══');
// ⚠️ Choix de l'utilisateur : la couleur reste sur les VALEURS, là où
// elle informe.
ck('aucune bordure d alerte sur la fiche', !/\.ps\.al\{/.test(sh)
   && !/ps[^}]*border-color:#D8705C/.test(sh));
ck('la règle est écrite deux fois', (sh.match(/PAS DE (BORDURE|CADRE) ROUGE/g) || []).length === 2);
// ⚠️ Mais la couleur sur les valeurs demeure : une alerte doit se voir.
ck('les valeurs hors seuils restent colorées', /\.k\.bad\{border-color:#D8705C/.test(sh));

console.log('\n═══ LE DÉCOUPAGE SUIT LE FORMAT RÉEL ═══');
// ⚠️ « 📊 5 oct. — TA 13/8 · T° 36,7 », avec ⚠ en fin de ligne. On
// découpe sur CE format, pas sur une forme devinée.
ck('pastilles depuis les lignes 📊', /\\uD83D\\uDCCA/.test(sh) && /class="kv"/.test(sh));
ck('l alerte se lit en fin de ligne', /const alerte = \/\\u26A0\/\.test\(l\)/.test(sh));
ck('et le moment est conservé', /class="kq"/.test(sh));

console.log('\nERREURS:', ko.length ? ko.join(' · ') : 'aucune');
process.exit(ko.length ? 1 : 0);
