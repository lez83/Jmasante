// Deux bords en relief ne doivent pas se télescoper.
const fs = require('fs');
const css = fs.readFileSync('../jmsante/www/css/app.css','utf-8');
let ko = []; const ck = (l,c) => { console.log(`  ${c?'✓':'⚠'} ${l}`); if(!c) ko.push(l); };

// ⚠️ Les CONTENEURS recevaient le même relief que les BOUTONS qu'ils
// contiennent : le bord du bouton se superposait à celui du cadre.
ck('la hiérarchie est posée', /DEUX BORDS EN RELIEF SE TÉLESCOPENT/.test(css));
ck('les conteneurs se creusent', /\[data-fini="relief"\] \.slotsec-h,[\s\S]{0,400}inset 0 1px 3px/.test(css));
{ const bloc = css.slice(css.indexOf('LES BOUTONS OUBLIÉS'), css.indexOf('DEUX BORDS EN RELIEF'));
  ck('ils ne sont plus dans la liste des soulevés',
     !/\[data-fini="relief"\] \.(rowbox|slotsec-h|grp-head)\b/.test(bloc)); }
// ⚠️ Le trait de gauche de .rowbox n'est pas un cadre.
ck('rowbox reste plat', /\[data-fini\] \.rowbox\{ background-image:none !important/.test(css));
// ⚠️ Un bouton collé au bord superpose forcément les deux traits.
ck('de la place pour l ombre', /De la place pour l'ombre/.test(css)
   && /\[data-fini="relief"\] \.chips,/.test(css));

console.log('\nERREURS:', ko.length ? ko.join(' · ') : 'aucune');
process.exit(ko.length ? 1 : 0);
