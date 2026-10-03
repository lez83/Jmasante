// Une seule porte vers les ordonnances, et les six domaines du texte.
const fs = require('fs'); const R = '../jmsante/';
let ko = []; const ck = (l,c) => { console.log(`  ${c?'✓':'⚠'} ${l}`); if(!c) ko.push(l); };
const d = fs.readFileSync(R+'www/js/dispositifs.js','utf-8');
const sh = fs.readFileSync(R+'www/js/sheets.js','utf-8');
const cb = fs.readFileSync(R+'www/js/cabinet.js','utf-8');
const f = fs.readFileSync(R+'www/js/bilans_fiches.js','utf-8');
const b = fs.readFileSync(R+'www/js/bilans.js','utf-8');

console.log('═══ UNE SEULE PORTE ═══');
// ⚠️ « Pré-imprimée » décrit comment la feuille est fabriquée, pas ce
// qu'on en fait. La vraie différence : imprimé ou manuscrit.
ck('une entrée au lieu de deux', /id="f-presc"/.test(sh)
   && !/id="f-dispo"/.test(sh) && !/id="f-ordo"/.test(sh));
ck('écran de choix', /function sheetPrescrire/.test(d));
ck('les deux voies s expliquent', /Tout est imprimé<\/b>/.test(d)
   && /le corps reste vide<\/b>/.test(d));
// ⚠️ Sans patient, seule la feuille vierge a du sens.
ck('feuille vierge depuis Ma fiche', /id="mo-presc"/.test(cb));
ck('et le catalogue n y apparaît pas', /\$\{p \? `\s*<button class="pr-v" id="pr-cat"/.test(d));
ck('repli si l essai est éteint', /else sheetOrdonnance\(p\.id\)/.test(sh));

console.log('\n═══ LES SIX DOMAINES DU TEXTE ═══');
ck('domaines déclarés', /const PRESC_DOMAINES/.test(d)
   && /k:"vaccins"/.test(d) && /k:"sexuel"/.test(d) && /k:"tabac"/.test(d)
   && /k:"medic"/.test(d) && /k:"bio"/.test(d) && /k:"dm"/.test(d));
ck('socle issu de l arrêté', (d.match(/\{ d:"/g)||[]).length >= 35);
ck('la source est citée', /NOR SFHH2617311A/.test(d) && /AP-HP/.test(d));
// ⚠️ Les conditions sont RAPPELÉES, jamais vérifiées.
ck('conditions rappelées sous les lignes', /class="pr-c"/.test(d));
ck('et c est dit à l écran', /rappelées<\/b>, jamais vérifiées/.test(d));
ck('aucun blocage', /RAPPELÉES, JAMAIS VÉRIFIÉES/.test(d) && !/return false;.*diabet/i.test(d));
// ⚠️ Une ligne réglementaire réécrite finit par ne plus correspondre.
ck('les lignes du texte ne se modifient pas', /fixe:true/.test(d)
   && /NE SE MODIFIENT PAS/.test(d));
ck('mais se retirent', /d\.retires/.test(d));

console.log('\n═══ LES FICHES DE BILAN, TOUTES ═══');
{ /* ⚠️ Les six TUBES vivent dans la même liste mais n'ont pas de fiche :
     ils ont leur propre écran. On ne retient que les analyses. */
  const tubes = new Set([...b.matchAll(/\{ n:"([^"]+)", c:"/g)].map(m => m[1]));
  const noms = [...b.matchAll(/\{ n:"([^"]+)"/g)].map(m => m[1]).filter(n => !tubes.has(n));
  const fiches = new Set([...f.matchAll(/\n  "([^"]+)": \{/g)].map(m => m[1]));
  const manq = noms.filter(n => !fiches.has(n));
  ck('toutes les analyses ont leur fiche', manq.length === 0
     || (console.log('     manquent : ' + manq.join(', ')), false));
  let incomplet = [];
  for (const m of f.matchAll(/\n  "([^"]+)": \{([\s\S]*?)\n  \},?/g))
    for (const k of ["mesure","bas","haut","prel","patient"])
      if (!m[2].includes(k + ':"')) incomplet.push(m[1] + '/' + k);
  ck('et ses cinq rubriques', incomplet.length === 0
     || (console.log('     ' + incomplet.slice(0,4).join(', ')), false));
}

console.log('\nERREURS:', ko.length ? ko.join(' · ') : 'aucune');
process.exit(ko.length ? 1 : 0);
