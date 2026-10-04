// Une seule porte vers les ordonnances, et les six domaines du texte.
const fs = require('fs'); const R = '../jmsante/';
let ko = []; const ck = (l,c) => { console.log(`  ${c?'✓':'⚠'} ${l}`); if(!c) ko.push(l); };
const d = fs.readFileSync(R+'www/js/dispositifs.js','utf-8');
const sh = fs.readFileSync(R+'www/js/sheets.js','utf-8');
const cb = fs.readFileSync(R+'www/js/cabinet.js','utf-8');
const f = fs.readFileSync(R+'www/js/bilans_fiches.js','utf-8');
const cb3 = fs.readFileSync(R+'www/js/cabinet.js','utf-8');
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


console.log('\n═══ LE GUIDE DANS L APP ═══');
{ const g = sh.slice(sh.indexOf('$("#go-guide").onclick'));
  const bloc = g.slice(g.indexOf('openSheet(`'), g.indexOf('`);'));
  // ⚠️ Un guide qui décrit d'anciens chemins envoie l'utilisateur dans le mur.
  ck('plus d « ordonnance pré-imprimée »', !/ordonnance pré-imprimée/i.test(bloc));
  ck('la nouvelle porte est décrite', /Faire une ordonnance/.test(bloc));
  ck('les quatre sections des réglages', /S'y retrouver dans les réglages/.test(bloc));
  ck('le catalogue de prescription', /Mon catalogue de prescription/.test(bloc));
  ck('les fonctions en essai', /Les fonctions en essai/.test(bloc));
  ck('l en-tête suit le cabinet du patient', /cabinet du patient<\/b>/.test(bloc));
  // ⚠️ Le code ne doit figurer dans AUCUN document ni écran diffusable.
  ck('le code n y figure pas', !/cigale83/.test(bloc));
}


console.log('\n═══ L IDENTITÉ DU PATIENT SUR UN DOCUMENT ═══');
{ const mo = fs.readFileSync(R+'www/js/modeles.js','utf-8');
  // ⚠️ Une ordonnance doit identifier sans ambiguïté : le sexe manquait.
  // ⚠️ Depuis la v1.5.7, l'identité est écrite par pdfBlocPatient()
  // dans cabinet.js — un seul endroit pour tous les documents.
  ck('le sexe figure', /p\.genre === "F" \? "Femme" : p\.genre === "M" \? "Homme"/.test(cb3));
  // ⚠️ L'âge évite un calcul de tête au comptoir.
  ck('l âge suit la date de naissance', /\(" \+ age \+ " ans\)/.test(cb3)
     && /ageOf\(p0\.dob\) \+ " ans\)/.test(cb));
  // ⚠️ « N° » seul ne dit pas de quel numéro il s'agit.
  ck('le numéro est nommé en entier', /N° de securite sociale : /.test(cb3)
     && /N° de sécurité sociale : /.test(cb3));
  ck('plus de « N° » isolé', !/doc\.text\("N° " \+ p\.nir/.test(cb3));
  // ⚠️ fmtFR abrège : interdit sur une date de naissance.
  ck('date en clair partout', !/fmtFR\(p\.dob\)/.test(cb3) && !/fmtFR\(p\.dob\)/.test(mo));
}


console.log('\n═══ LES MENTIONS DE L ORDONNANCE ═══');
// ⚠️ Sans modalités, la pharmacie délivre mais le patient ne sait pas
// comment s'en servir.
ck('modalités par ligne', /data-om="\$\{i\}"/.test(d) && /_ordoPanier\[\+e\.dataset\.om\]\.m/.test(d));
ck('elles s impriment sous leur ligne', /if \(x\.m\)\{/.test(d));
// ⚠️ Durée et renouvellement engagent la délivrance : en évidence, pas
// noyés dans les remarques libres.
ck('durée et renouvellement', /id="od-duree"/.test(d) && /id="od-renouv"/.test(d));
ck('sortis en évidence', /Duree : " \+ du/.test(d));
ck('non renouvelable par défaut', /dispoData\(\)\.renouv \|\| "Non renouvelable"/.test(d));
// ⚠️ Taille et poids vivent dans les constantes d'un passage, pas dans
// le dossier : on prend la dernière connue AVEC sa date.
// ⚠️ CHAMPS LIBRES : une mesure ancienne imprimée d'autorité serait
// trompeuse, et le poids du jour n'est pas toujours dans l'app.
ck('taille et poids en champs libres', /id="od-taille"/.test(d) && /id="od-poids"/.test(d));
ck('la dernière valeur connue est seulement suggérée', /function _mesureHint/.test(d)
   && /placeholder="Taille\$\{_mesureHint\(p\)\.taille\}"/.test(d));
// ⚠️ Vides, ils sortent en pointillés : à remplir à la main après
// impression, avec la mesure du jour.
  // ⚠️ Les pointillés sont désormais tracés par pdfBlocPatient().
  ck('vides, ils s impriment en pointillés', /repeat\(18\)/.test(cb3));
ck('rien n est repris d autorité', !/dd\.taille = m\.taille/.test(d)
   && /jamais à la remplir/.test(d));
ck('et jamais cochés d office', /dispoData\(\)\.morpho \? "checked" : ""/.test(d));


console.log('\n═══ PRESCRIPTEUR ET TITRE ═══');
{ const cb2 = fs.readFileSync(R+'www/js/cabinet.js','utf-8');
  // ⚠️ Le numéro d'identification du prescripteur est une mention
  // obligatoire : il manquait sur l'ordonnance de dispositifs, qui n'a
  // pas de bloc d'en-tête propre comme la pré-imprimée.
  ck('numéro du prescripteur dans l en-tête', /N° RPPS \/ ADELI : " \+ d\.rpps/.test(cb2));
  ck('et le numéro AM à côté', /N° AM : " \+ d\.am/.test(cb2));
  // ⚠️ L'en-tête s'est allongé : sans marge, le bloc patient se superpose.
  ck('le bloc patient ne chevauche plus', /Math\.max\(tete\.y \+ 3, 62\)/.test(d));
  // ⚠️ Le catalogue couvre vaccins, examens et médicaments : « ordonnance
  // de dispositifs médicaux » serait inexact dès qu'on prescrit un examen.
  ck('titre neutre', /pdfEnTete\(doc, E, "Ordonnance", ""\)/.test(d));
  // ⚠️ Le titre vient maintenant de la description passée à l'écran générique.
  ck('aperçu et nom de fichier alignés', /titre:"Ordonnance"/.test(d)
     && /const base = "Ordonnance"/.test(d));
}

console.log('\nERREURS:', ko.length ? ko.join(' · ') : 'aucune');
process.exit(ko.length ? 1 : 0);
