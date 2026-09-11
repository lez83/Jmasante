// navHeader() dessine le bouton « Annuler », bindNav() le câble.
// Oublier le second donne un bouton visible et inerte — trois modules
// récents (plaies, recueil, docs) étaient dans ce cas.
const fs=require('fs');
console.log('═══ CHAQUE ÉCRAN CÂBLE-T-IL SA NAVIGATION ? ═══');
const mods = ['sheets','plaies','recueil','docs','fiche','traitement','dlu','feuilles','menage','dossier','tendances'];
let ko = [];
mods.forEach(m => {
  let s;
  try { s = fs.readFileSync(`../jmsante/www/js/${m}.js`,'utf-8'); } catch(e){ return; }
  const dessine = (s.match(/navHeader\(/g)||[]).length;
  const cable   = (s.match(/bindNav\(/g)||[]).length;
  if (!dessine) return;
  const ok = cable > 0;
  console.log(`  ${ok?'✓':'⚠ NON CÂBLÉ'} ${m.padEnd(12)} ${dessine} en-tête(s) · ${cable} bindNav`);
  if (!ok) ko.push(m);
});
console.log('\n═══ LE ZOOM DU SCHÉMA ═══');
const css = fs.readFileSync('../jmsante/www/css/app.css','utf-8');
const z = (css.match(/\.plzoom-ov\{[^}]*z-index:(\d+)/)||[])[1];
const veil = (css.match(/\.veil\{[^}]*z-index:(\d+)/)||[])[1];
console.log(`  zoom z-index ${z} · voile ${veil}`,
  (+z > +veil) ? '✓ au-dessus' : '⚠ RECOUVERT');

const ok = ko.length === 0 && +z > +veil;
console.log('\nERREURS:', ok ? 'aucune' : (ko.length ? 'modules sans bindNav : '+ko.join(', ') : 'zoom recouvert'));
process.exit(ok ? 0 : 1);
