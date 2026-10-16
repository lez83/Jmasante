// Tout document doit pouvoir être VU, puis ENREGISTRÉ ou PARTAGÉ.
const fs = require('fs'); const path = require('path');
const R = '../jmsante/www/js/';
let ko = []; const ck = (l,c) => { console.log(`  ${c?'✓':'⚠'} ${l}`); if(!c) ko.push(l); };

console.log('═══ BALAYAGE DE TOUS LES DOCUMENTS ═══');
// ⚠️ Une liste écrite à la main oublie toujours quelqu'un : on BALAIE.
// C'est ainsi qu'on a trouvé l'ordonnance vierge et le courrier, qui
// n'offraient que « Enregistrer ».
const manques = [];
fs.readdirSync(R).filter(f => f.endsWith('.js') && f !== 'app.js').forEach(f => {
  const t = fs.readFileSync(path.join(R, f), 'utf-8');
  const re = /(?:async\s+)?function\s+(\w+)\s*\(([^)]*)\)\s*\{/g;
  let m;
  while ((m = re.exec(t))){
    const nom = m[1];
    if (nom === 'pdfLivrer') continue;
    let fin = t.indexOf('\nfunction ', m.index + 10);
    const fin2 = t.indexOf('\nasync function ', m.index + 10);
    if (fin2 > 0 && (fin < 0 || fin2 < fin)) fin = fin2;
    const corps = t.slice(m.index, fin > 0 ? fin : m.index + 8000);
    if (!corps.includes('pdfLivrer(')) continue;
    // Le mode doit être reçu ET transmis
    const recoit = /\bmode\b/.test(m[2]);
    const livre = /pdfLivrer\((?:[^()]|\((?:[^()]|\([^()]*\))*\))*,\s*mode\s*\)/.test(corps);
    if (!recoit || !livre) manques.push(`${f}:${nom}`);
  }
});
ck('tous les producteurs reçoivent et transmettent le mode',
   manques.length === 0 || (console.log('     ' + manques.join('\n     ')), false));

console.log('\n═══ CHAQUE DOCUMENT PASSE PAR L APERÇU ═══');
const cb = fs.readFileSync(R+'cabinet.js','utf-8');
const mo = fs.readFileSync(R+'modeles.js','utf-8');
const di = fs.readFileSync(R+'dispositifs.js','utf-8');
ck('ordonnance vierge', /produire: \(mode\) => produireOrdonnance\(d, mode\)/.test(cb));
ck('courrier et feuille à en-tête', /produire: \(mode\) => produireCourrier\(d, mode\)/.test(cb));
ck('modèles de documents', /produire: \(mode\) => docProduire\(cle, pid, mode\)/.test(mo));
ck('conduite à tenir', /produire: \(mode\) => aideProduire\(mode\)/.test(mo));
ck('ordonnance de dispositifs', /produire: \(mode\) => ordoDispoProduire\(pid, mode\)/.test(di));
// ⚠️ Un courrier n'a pas de patient : l'encadré vide ferait croire qu'il
// manque une information.
ck('le courrier n affiche pas d encadré patient', /patient:null, sansPatient:true/.test(cb));
// ⚠️ La livraison ne partage QUE si le mode le demande : plus de
// chaînage automatique après l'enregistrement.
ck('« Enregistrer » n enchaîne pas sur le partage',
   /if \(mode === "share"\)\{[\s\S]{0,420}toast\("Enregistré/.test(cb)
   && !/if \(mode === "save"\) return;/.test(cb));


console.log('\n═══ LE PARTAGE EXISTE VRAIMENT ═══');
// ⚠️ `partagerFichier()` était APPELÉE SANS AVOIR JAMAIS ÉTÉ ÉCRITE : le
// test `typeof … === "function"` échouait en silence et « partage
// indisponible » s'affichait systématiquement.
{ const tous = fs.readdirSync(R).filter(f => f.endsWith('.js') && f !== 'app.js')
    .map(f => fs.readFileSync(path.join(R, f), 'utf-8')).join('\n');
  ck('plus aucun appel à la fonction fantôme',
     !/typeof partagerFichier === "function"/.test(tous));
  ck('la fonction de partage est définie', /async function fichierPartager\(/.test(cb)
     && /async function pdfPartager\(/.test(cb));
  // ⚠️ Les autres exports de l'app partagent depuis le CACHE : on reprend
  // cette voie, qui fonctionne.
  ck('partage depuis le cache sur téléphone', /directory:"CACHE"/.test(cb)
     && /Share\.share\(\{ title:nom, url:r\.uri \}\)/.test(cb));
  ck('repli navigateur', /navigator\.canShare/.test(cb) && /navigator\.share\(\{ files:\[f\]/.test(cb));
  // ⚠️ Fermer le menu de partage n'est pas une erreur : le document est
  // déjà enregistré.
  ck('une annulation n est pas une erreur', /if \(!\/cancel\/i\.test/.test(cb)
     && /\/abort\/i\.test/.test(cb));
  // ⚠️ Un message « indisponible » sans suite laisse l'utilisateur démuni.
  ck('et on dit où le document se trouve',
     /Partage impossible sur cet appareil — enregistré dans/.test(cb));
}

console.log('\nERREURS:', ko.length ? ko.join(' · ') : 'aucune');
process.exit(ko.length ? 1 : 0);
