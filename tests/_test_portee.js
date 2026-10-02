// « decorateChip is not defined » : ces fonctions sont LOCALES à
// _bindUnForm. Les appeler depuis _restoreDraft ou menuSoin lève une
// ReferenceError qui interrompt TOUT le câblage de la carte — d'où des
// boutons muets sur les patients ayant un passage du jour.
const fs = require('fs');
const s = fs.readFileSync('../jmsante/www/js/ui.js', 'utf-8');
const iFn  = s.indexOf('function _bindUnForm');
const iFin = s.indexOf('\nfunction ', iFn + 20);

console.log('═══ FONCTIONS LOCALES APPELÉES HORS PORTÉE ═══');
const ko = [];
['decorateChip', 'openSoinComment'].forEach(nom => {
  let i = 0;
  while ((i = s.indexOf(nom + '(', i)) !== -1) {
    const pos = i; i += nom.length;
    if (iFn <= pos && pos < iFin) continue;
    const avant = s.slice(Math.max(0, pos - 110), pos);
    if (avant.includes('LOCALES') || avant.includes('levait')) continue;
    const ligne = s.slice(0, pos).split('\n').length;
    console.log('  ⚠ ' + nom + ' appelée ligne ' + ligne + ' — hors de _bindUnForm');
    ko.push(nom + ':' + ligne);
  }
});
if (!ko.length) console.log('  ✓ aucun appel hors portée');

console.log('\n═══ LES VERSIONS GLOBALES EXISTENT ═══');
['function decorerSoin', 'function ouvrirNoteSoin'].forEach(f => {
  const ok = s.includes(f);
  console.log('  ' + (ok ? '✓' : '⚠') + ' ' + f);
  if (!ok) ko.push(f);
});

console.log('\nERREURS:', ko.length ? ko.join(', ') : 'aucune');
process.exit(ko.length ? 1 : 0);
