// J-1 doit reprendre le passage du MÊME créneau : le matin, il ressortait
// le soir de la veille (pilulier du soir, coucher).
const fs=require('fs');
const ui = fs.readFileSync('../jmsante/www/js/ui.js','utf-8');
console.log('═══ J-1 PAR CRÉNEAU ═══');
const i = ui.indexOf('data-clone');
const bloc = ui.slice(ui.indexOf('[data-clone]").onclick'), 0);
const b = ui.slice(ui.indexOf('[data-clone]").onclick'), ui.indexOf('[data-clone]").onclick')+1400);
console.log('  filtre sur le créneau :', /memeCreneau|v\.slot\s*\|\|\s*null\)\s*===\s*cr/.test(b) ? '✓' : '⚠');
console.log('  repli dernier connu   :', /return tous\[0\]/.test(b) ? '✓' : '⚠');
console.log('  créneau depuis _curSlot:', /_curSlot \|\| \(typeof activeSlot/.test(b) ? '✓' : '⚠');

console.log('\n═══ ANNULATION DANS LE DÉROULÉ ═══');
const j = ui.indexOf('[data-cancel]").onclick');
const c = ui.slice(j, j+1600);
console.log('  redessine le déroulé  :', /seqActive && typeof renderSeq === "function"\) renderSeq\(\)/.test(c) ? '✓' : '⚠');
console.log('  sinon la liste        :', /else render\(\)/.test(c) ? '✓' : '⚠');

const ok = /memeCreneau/.test(b) && /return tous\[0\]/.test(b)
        && /renderSeq\(\)/.test(c) && /else render\(\)/.test(c);
console.log('\nERREURS:', ok ? 'aucune' : 'à revoir');
process.exit(ok ? 0 : 1);
