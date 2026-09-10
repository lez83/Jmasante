// Sur téléphone, le sommaire de 20 entrées occupait 76 % de la hauteur
// en restant figé : le texte défilait derrière une barre plus grande que lui.
const fs=require('fs');
const m = fs.readFileSync('../jmsante/www/manuel.html','utf-8');
console.log('═══ SOMMAIRE DU MANUEL ═══');
const media = /@media \(max-height:820px\), \(max-width:600px\)\{[\s\S]{0,600}?nav\{ position:static/.test(m);
const replie = /nav \.wrap\{ display:none;/.test(m);
const bouton = /class="toc-btn"/.test(m);
const bascule = /classList\.toggle\('open'\)/.test(m);
const bureau = /@media \(min-height:821px\) and \(min-width:601px\)\{ nav \.toc-btn\{ display:none; \} \}/.test(m);
console.log('  règle mobile présente  :', media   ? '✓' : '⚠');
console.log('  sommaire replié        :', replie  ? '✓' : '⚠');
console.log('  bouton Sommaire        :', bouton  ? '✓' : '⚠');
console.log('  bascule au clic        :', bascule ? '✓' : '⚠');
console.log('  ordinateur épargné     :', bureau  ? '✓' : '⚠');
// L'ordre compte : la règle mobile doit venir APRÈS la règle générale
const iGen = m.indexOf('nav .wrap{display:flex');
const iMob = m.indexOf('@media (max-height:820px)');
console.log('  ordre CSS correct      :', (iMob > iGen && iGen > 0) ? '✓' : '⚠ la règle mobile est avant');
const ok = media && replie && bouton && bascule && bureau && iMob > iGen;
console.log('\nERREURS:', ok ? 'aucune' : 'sommaire à revoir');
process.exit(ok ? 0 : 1);
