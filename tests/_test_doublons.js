/* ══════════════════════════════════════════════════════════════
   DEUX FONCTIONS, UN SEUL NOM — LA SECONDE GAGNE EN SILENCE
   ─────────────────────────────────────────────────────────────
   Les 42 modules sont collés bout à bout en un seul programme. Deux
   `function nom(){}` du même nom n'est pas une erreur de syntaxe : la
   DERNIÈRE déclarée écrase la précédente, sans un mot. On lit alors un
   code qui ne s'exécute pas — exactement la même famille de défaut
   qu'un bouton qui ne mène nulle part.

   ⚠️ CE DÉTECTEUR EST NÉ DE DEUX DÉFAUTS LIVRÉS :
   • `ficheHtml` existait dans fiche.js (la fiche d'un patient) ET dans
     bilans.js (la fiche de rappel d'un bilan). `bilans` passe après
     `fiche` dans la chaîne : produire la fiche d'un patient en HTML ou
     en PDF sortait le cadre « Pour moi / Pour le patient » d'un bilan,
     SANS AUCUNE DONNÉE DU PATIENT.
   • `sheetBilans` existait dans bilans.js (le guide des tubes) ET dans
     sheets.js (les bilans et RDV d'un patient). Le bouton 🧪 d'une
     carte patient ouvrait le guide, et l'écran du patient était devenu
     inatteignable.
   Plus cinq raccourcis de sheets.js redéclarés plus bas dans le même
   fichier, qui n'avaient jamais tourné.

   ⚠️ IL REGARDE L'ORDRE DE LA CHAÎNE, PAS L'ORDRE ALPHABÉTIQUE : c'est
   ORDER_DEV/ORDER_PROD de build.js qui décide laquelle gagne.
══════════════════════════════════════════════════════════════ */
const fs = require('fs'); const R = '../jmsante/';
let ko = []; const ck = (l,c) => { console.log(`  ${c?'✓':'⚠'} ${l}`); if(!c) ko.push(l); };

const bd = fs.readFileSync(R+'build.js','utf-8');
const ordre = (bd.match(/const ORDER_DEV\s*=\s*\[([^\]]*)\]/)||[])[1] || '';
const modules = ordre.split(',').map(x => x.trim().replace(/^'|'$/g,'')).filter(Boolean);

console.log('═══ LA CHAÎNE ═══');
ck('ORDER_DEV est lisible', modules.length > 20);

const decl = {};           // nom -> [ {mod, ligne} ... ] dans l'ordre de la chaîne
for (const m of modules){
  const f = R + 'www/js/' + m + '.js';
  if (!fs.existsSync(f)) continue;
  fs.readFileSync(f,'utf-8').split('\n').forEach((l,i) => {
    const x = /^(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/.exec(l);
    if (x) (decl[x[1]] = decl[x[1]] || []).push({ mod:m, ligne:i+1 });
  });
}

console.log('\n═══ LES NOMS DÉCLARÉS DEUX FOIS ═══');
const doubles = Object.keys(decl).filter(n => decl[n].length > 1).sort();
doubles.forEach(n => {
  const d = decl[n];
  const gagne = d[d.length-1];
  console.log('    ⚠ ' + n + ' : ' + d.map(x => x.mod+'.js:'+x.ligne).join(' · ')
            + '  → c\'est ' + gagne.mod + '.js qui gagne');
});
ck('aucune fonction déclarée deux fois', doubles.length === 0,
   doubles.length ? doubles.join(', ') : '');

/* Les deux collisions qui ont été livrées : on garde leur souvenir
   nommément, pour qu'un retour en arrière soit dit par son nom. */
console.log('\n═══ LES DEUX QUI ONT ÉTÉ LIVRÉES ═══');
const fi = fs.readFileSync(R+'www/js/fiche.js','utf-8');
const bi = fs.readFileSync(R+'www/js/bilans.js','utf-8');
const sh = fs.readFileSync(R+'www/js/sheets.js','utf-8');
ck('la fiche patient garde ficheHtml(p, inc, docs, nom)',
   /function ficheHtml\(p, inc, docs, nom\)/.test(fi));
ck('la fiche de rappel d un bilan s appelle bilanFicheHtml',
   /function bilanFicheHtml\(/.test(bi) && !/function ficheHtml\(/.test(bi));
ck('le guide des tubes s appelle sheetBilansGuide',
   /function sheetBilansGuide\(/.test(bi) && !/function sheetBilans\(/.test(bi));
ck('les bilans d un patient gardent sheetBilans(pid)',
   /function sheetBilans\(pid\)/.test(sh));
ck('le menu envoie bien la tuile Bilans vers le guide',
   /case "bilans":\s*sheetBilansGuide\(\)/.test(sh));

console.log('\nERREURS: ' + (ko.length ? ko.join(' · ') : 'aucune'));
process.exit(ko.length ? 1 : 0);
