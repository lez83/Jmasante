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


console.log('\n═══ LES TAILLES SAISIES À LA MAIN ═══');
// ⚠️ Le code ne connaissait que le « · » du socle : une référence ajoutée
// par l'utilisateur avec « 10×10 / 15×15 » ne proposait aucun choix.
ck('plusieurs séparateurs acceptés', /const franc = t\.split\(/.test(d)
   && /franc\.length > 1/.test(d));
// ⚠️ Le TIRET n'est séparateur qu'entouré d'espaces : « 10x10 - 14x14 »
// se découpe, « Mepilex Border-Flex » non.
ck('le tiret entouré d espaces sépare', /\\s\+-\\s\+/.test(d)
   && /n'est séparateur qu'ENTOURÉ D'ESPACES/.test(d));
// ⚠️ Des tailles non numériques (petit/moyen/grand, classe 2/3) doivent
// se découper aussi : la reconnaissance de motifs ne suffit pas.
ck('les tailles non numériques se découpent aussi', /franc\.length > 1\) return franc/.test(d)
   && /split\(\/\[/.test(d));
ck('motifs « nombre × nombre » reconnus', /\\d\+\(\?:\[\.,\]\\d\+\)\?\\s\*\[x×\*\]/.test(d));
ck('calibres CH et cm reconnus', /\(\?:CH\|FR\|G\)/.test(d));
// ⚠️ En français la virgule est une DÉCIMALE : « 12,5×12,5 ». La
// découper casserait la taille en deux.
ck('la virgule n est PAS un séparateur', /LA VIRGULE N'EST PAS UN SÉPARATEUR/.test(d)
   && !/split\(\/\[[^\]]*,[^\]]*\]/.test(d));
// ⚠️ Une taille mal découpée ne se verrait qu'au moment de prescrire.
ck('ce que l app a compris est montré', /tailles reconnues/.test(d)
   && /Une seule taille reconnue/.test(d));
ck('et on peut corriger', /return dispoAjouter\(pid\)/.test(d));
ck('le choix s appuie sur la même lecture', /tailleListe\(ref && \(ref\.dim \|\| ref\.d\)\)/.test(d));


console.log('\n═══ CLASSEMENT ET EN-TÊTE (retours du 5 oct.) ═══');
// ⚠️ Une référence ajoutée atterrissait en fin de famille, loin de sa
// gamme : « Mepilex Border Flex » après d'autres marques.
ck('les familles de matériel sont triées', /function trierRefs/.test(d)
   && /localeCompare\([^)]*numeric:true/.test(d));
// ⚠️ Les domaines du texte gardent l'ordre de l'arrêté : il y a une
// logique de lecture qu'un tri alphabétique casserait.
ck('mais pas les domaines du texte',
   /dom\.k === "plaies" \? trierRefs/.test(d));
// ⚠️ L'en-tête était figé ici alors que la feuille vierge le laissait
// modifier.
ck('en-tête modifiable pour ce document', /function sheetOrdoEntete/.test(d)
   && /id="od-entete"/.test(d));
ck('l aperçu et le PDF le reprennent', (d.match(/ordoEntete\(p\)/g)||[]).length >= 3);
// ⚠️ Une correction ponctuelle ne doit pas devenir définitive.
ck('rien n est écrit dans la fiche', /NE VAUT QUE POUR CE DOCUMENT/.test(d)
   && !/_ordoEnteteMod[\s\S]{0,120}(S\.moi|C\.nom =)/.test(d));
ck('et le retour à sa fiche est possible', /id="oe-raz"/.test(d)
   && /_ordoEnteteMod = null/.test(d));


console.log('\n═══ REMPLACEMENT ET NUMÉROTATION ═══');
// ⚠️ « Qui signe » proposait déjà le remplacement d'un PRATICIEN nommé ;
// on y ajoute celui d'un CABINET, et on rassemble les trois au même
// endroit.
ck('trois formes de signature', /data-of="moi"|\["moi","Moi"/.test(d)
   && /Je remplace ce cabinet/.test(d) && /Je remplace un praticien/.test(d));
ck('mention composée', /function ordoMention/.test(d)
   && /"Remplaçant du " \+ \(E\.cabinet/.test(d));
// ⚠️ Le titulaire vient de l'ANNUAIRE : son RPPS ne se saisit pas de
// mémoire.
ck('le titulaire est pris dans l annuaire', /titre:"Qui remplaces-tu \?"/.test(d)
   && /cabContact\(_ordoTitulaire\)/.test(d));
ck('l app ne dit pas quelle forme est réglementaire',
   /ne dit pas laquelle est\s+réglementaire/.test(d));
// ⚠️ La mention est écrite par pdfEnTete() : la répéter la faisait
// apparaître DEUX FOIS sur la feuille.
ck('la mention n est pas imprimée deux fois',
   /déjà écrite par pdfEnTete\(\)/.test(d));

// ⚠️ Collé au texte, « 1 Mepilex » se lisait comme une QUANTITÉ.
ck('le numéro est en marge droite', /LE NUMÉRO VA EN MARGE DROITE/.test(d)
   && /doc\.text\(String\(i \+ 1\), XN, y0, \{ align:"right" \}\)/.test(d));
ck('séparé par un filet', /doc\.line\(XF, y0 - 3\.4, XF, y - 1\)/.test(d));
// ⚠️ Le total ferme la liste avant la signature : une ligne ajoutée
// après coup ne correspondrait plus au compte.
ck('le total ferme la liste', /Ordonnance comportant/.test(d)
   && /LE TOTAL FERME LA LISTE/.test(d));
ck('affiché même pour une seule', /\? " prescriptions" : " prescription"/.test(d));
ck('et repris dans l aperçu', /class="ap-tot"/.test(cb3) && /class="ap-li-n"/.test(cb3));


// ⚠️ Quand la mention nomme DÉJÀ le cabinet (« Remplaçant du Cabinet
// X »), la ligne du dessous le répétait mot pour mot.
ck('pas de répétition du cabinet', /const dejaDit = d\.cabinet && d\.mention/.test(cb3)
   && /dejaDit \? "" : d\.cabinet/.test(cb3));
ck('la comparaison ignore accents et casse', /_norm = t =>[\s\S]{0,160}u0300-\\u036f/.test(cb3));
ck('et l aperçu applique la même règle', /Même règle qu'au PDF/.test(cb3));


console.log('\n═══ LE SECOND FILET ═══');
// ⚠️ Le bloc patient est pris entre DEUX traits : celui qui ferme
// l'en-tête et celui qui ouvre la prescription.
ck('deux filets', /function pdfFilet/.test(cb3)
   && /pdfFilet\(doc, y, 1\)/.test(cb3) && /pdfFilet\(doc, yb, filetSens\(\)\)/.test(cb3));
ck('le sens est au choix', /function filetSens/.test(cb3)
   && /S\.ordoFilet === "parallele"/.test(cb3));
ck('interrupteur à l écran', /data-ofil="miroir"/.test(d) && /data-ofil="parallele"/.test(d));
// ⚠️ Ce réglage-ci est DURABLE, contrairement au reste de cet écran.
ck('et il est dit durable', /retenu pour tous tes documents/.test(d));
ck('l aperçu suit le même sens', /class="ap-filet \$\{S\.ordoFilet === "parallele" \? "" : "mir"\}"/.test(cb3));

console.log('\nERREURS:', ko.length ? ko.join(' · ') : 'aucune');
process.exit(ko.length ? 1 : 0);
