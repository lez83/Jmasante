// Le bouton retour doit mener là où il l'annonce.
const fs = require('fs'); const path = require('path');
const R = '../jmsante/www/js/';
let ko = []; const ck = (l,c) => { console.log(`  ${c?'✓':'⚠'} ${l}`); if(!c) ko.push(l); };

console.log('═══ AUCUN RETOUR NE MENT ═══');
// ⚠️ bindNav() SANS ARGUMENT revient à l'ACCUEIL. Un écran dont l'en-tête
// annonce « Réglages » et qui appelle bindNav() nu ramène donc l'utilisateur
// à la case départ — défaut signalé sur « Ma fiche », trouvé sur six écrans.
const menteurs = [];
fs.readdirSync(R).filter(f => f.endsWith('.js') && f !== 'app.js').forEach(f => {
  const t = fs.readFileSync(path.join(R, f), 'utf-8');
  const re = /function (sheet\w+|\w*Panel)\s*\(/g;
  let m;
  while ((m = re.exec(t))){
    const deb = m.index;
    const suite = t.indexOf('\nfunction ', deb + 10);
    const corps = t.slice(deb, suite > 0 ? suite : deb + 9000);
    const nh = corps.match(/navHeader\(\s*"([^"]*)"/);
    const bn = corps.match(/bindNav\(([^)]*)\)/);
    if (!nh || !bn) continue;
    const lbl = nh[1], arg = bn[1].trim();
    if (!arg && !["Accueil","Retour","Moniteur"].includes(lbl))
      menteurs.push(`${f}:${m[1]} dit « ${lbl} »`);
  }
});
ck('aucun écran ne promet un retour qu il ne fait pas',
   menteurs.length === 0 || (console.log('     ' + menteurs.join('\n     ')), false));

console.log('\n═══ LES SIX CORRIGÉS ═══');
const a = n => fs.readFileSync(R + n, 'utf-8');
ck('Ma fiche → Réglages', /function sheetMoi[\s\S]*?bindNav\(\(\) => sheetTours\(\)\)/.test(a('cabinet.js')));
ck('Bilans → Réglages', /bindNav\(\(\) => sheetTours\(\)\)/.test(a('bilans.js')));
ck('Souffler → Réglages', /bindNav\(\(\) => sheetTours\(\)\)/.test(a('detente.js')));
ck('Fonctions en essai → Application', /bindNav\(\(\) => sheetAppPanel\(\)\)/.test(a('essais.js')));
ck('Carnet des surprises → Guide', /bindNav\(\(\) => sheetGuide\(\)\)/.test(a('eggs.js')));
ck('Historique → la fiche du patient', /bindNav\(\(\) => sheetPatient\(p, "hist"\)\)/.test(a('sheets.js')));

console.log('\nERREURS:', ko.length ? ko.join(' · ') : 'aucune');
process.exit(ko.length ? 1 : 0);
