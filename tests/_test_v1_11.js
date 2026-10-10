// v1.11.0 — coordonnées actionnables, douze formes, troisième rythme,
// listing par ordre de passage.
//
// ⚠️ Ces contrôles lisent le CODE SOURCE. Ce qui ne se vérifie qu'en
//    marchant — une pastille qui se coupe en bout de ligne, un champ qui
//    s'efface à l'aller-retour — se vérifie au navigateur, pas ici.
const fs = require('fs'); const R = '../jmsante/';
let ko = []; const ck = (l,c) => { console.log(`  ${c?'✓':'⚠'} ${l}`); if(!c) ko.push(l); };
const lire = f => fs.readFileSync(R + f, 'utf-8');
const tr = lire('www/js/traitement.js'), ui = lire('www/js/ui.js');
const cab = lire('www/js/cabinet.js'), sh = lire('www/js/sheets.js');
const gl = lire('www/js/globals.js'), css = lire('www/css/app.css');
const fi = lire('www/js/fiche.js');

console.log('═══ ① UNE COORDONNÉE SE TOUCHE ═══');
ck('un seul endroit fabrique les liens', /function cabLien\(type, val\)/.test(cab));
ck('mail, téléphone et adresse ont le leur',
   /mailto:/.test(cab) && /tel:/.test(cab) && /geo:0,0\?q=/.test(cab));
// ⚠️ Rien à faire = AUCUN bouton, pas un bouton grisé.
ck('un fax ou un « autre » n en reçoit aucun', /return null;\n\}/.test(cab));
ck('les espaces d un numéro recopié sont retirés du lien',
   /replace\(\/\[\\s\.\]\/g, ""\)/.test(cab));
// ⚠️ geo: ne s'ouvre pas depuis un <a> dans la WebView Android.
ck('l itinéraire passe par le système, pas par un <a>',
   /data-ccgeo/.test(cab) && /window\.open\(g\.dataset\.ccgeo, "_system"\)/.test(cab));
// ⚠️ Un bouton dans un bouton n'est pas du HTML valide.
ck('les actions sont hors du bouton de la ligne',
   /class="cab-li"/.test(cab) && /bouton dans un bouton/.test(cab));
ck('le bouton suit la frappe sans redessiner l écran',
   /const majLien = i =>/.test(cab) && /addEventListener\("input", \(\) => majLien/.test(cab));
// ⚠️ Un bouton recréé perd ses écouteurs.
ck('et son écouteur est reposé après chaque recréation',
   /son écouteur est à reposer/.test(cab));
ck('les coordonnées propres du cabinet sont actionnables aussi',
   /cabLienHtml\("tel", C\.tel\)/.test(cab) && /cabLienHtml\("adresse", C\.adresse\)/.test(cab));
ck('l habillage n introduit aucune couleur hors jetons',
   !/\.cc-go[^{]*\{[^}]*#[0-9a-fA-F]{3,6}/.test(css));

console.log('\n═══ ① LE MAIL DU PATIENT ═══');
ck('un champ mail dans la fiche de renseignements', /id="f-mail"/.test(sh));
// ⚠️ Sur Android, inputmode seul n'ouvre pas le clavier avec @.
ck('type ET inputmode e-mail', /id="f-mail" type="email" inputmode="email"/.test(sh));
ck('il est enregistré au dossier', /mail: \(\$\("#f-mail"\)\?\.value\|\|""\)\.trim\(\)/.test(sh));
// ⚠️ SA DEMANDE LITTÉRALE : rien ne doit apparaître si le champ est vide.
ck('le bouton ✉️ n existe QUE si le mail est renseigné',
   /\.\.\.\(p\.mail \? \[\{ lbl:"[^"]*E-mail"/.test(sh)
   && /apparaisse en permanence/.test(sh));
ck('et il ouvre la messagerie', /href="mailto:\$\{esc\(x\.mail\)\}"/.test(sh));
// ⚠️ Un accent grave dans un commentaire HTML referme le gabarit.
ck('le piège de l accent grave dans un gabarit est écrit',
   /PAS DE RETOUR ARRIÈRE DANS CE COMMENTAIRE/.test(sh));

console.log('\n═══ ② L ADRESSE ET LE GPS ═══');
// ⚠️ LE DÉFAUT : deux boutons pour le même geste, un seul juste.
ck('le bouton GPS de la fiche assemble les trois morceaux',
   /window\.open\(`geo:0,0\?q=\$\{encodeURIComponent\(adresseComplete\(p\) \|\| p\.address \|\| ""\)\}`/.test(ui));
ck('plus aucune lecture de la seule ligne de rue',
   !/encodeURIComponent\(p\.address\|\|""\)/.test(ui));
ck('et la raison est écrite', /c'était le défaut/.test(ui));
ck('la saisie dit que le GPS assemble tout seul',
   /inutile de les recopier au-dessus/.test(sh));
// ⚠️ LE PIÈGE QU'UN ESSAI A TROUVÉ : « 3 rue de Toulon » → « 3 rue de ».
ck('on ne coupe que sur le code postal, ou sur une ville ponctuée',
   /ON NE COUPE QUE SUR LE CODE POSTAL/.test(gl)
   && /if \(ponct && !\/\[,;·\\-–—\]\\s\*\$\/\.test\(brut\)\) continue;/.test(gl));
ck('et le piège est raconté, pas seulement corrigé',
   /3 rue de Toulon » en « 3 rue de »/.test(gl));
// ⚠️ Le tiret cadratin n'est pas le trait d'union.
ck('le tiret cadratin est dans la classe de ponctuation', /\[\\s,;·\\-–—\]\+\$/.test(gl));
ck('la fiche propose la correction quand le cas se présente', /id="f-addr-fix"/.test(sh));
// ⚠️ Rien n'entre au dossier avant l'enregistrement de la fiche.
ck('elle porte sur le champ à l écran, pas sur le dossier',
   /rien n'entre au dossier tant que la fiche n'est pas enregistrée/.test(sh));
ck('un écran reprend tous les dossiers d un coup', /function sheetAdresses\(\)/.test(sh));
ck('tout y est coché au départ, et rien n est écrit avant le bouton',
   /TOUT EST COCHÉ AU DÉPART ET RIEN N'EST ÉCRIT AVANT LE BOUTON/.test(sh));
// ⚠️ La liste affichée peut dater : seule la valeur recalculée fait foi.
ck('la répétition est relue au moment d écrire',
   /On n'applique jamais un `apres` calculé à l'affichage/.test(sh));
ck('l entrée disparaît des réglages quand il n y a plus rien à ranger',
   /N'APPARAÎT QUE S'IL Y A QUELQUE CHOSE À RANGER/.test(sh));

console.log('\n═══ ③ LE PRESCRIPTEUR « BLOQUÉ » ═══');
// ⚠️ LA CAUSE : un médecin repris du cabinet n'avait pas d'identifiant,
//    donc data-tpr="" — la même valeur que « Médecin traitant ».
ck('tout contact reçoit un identifiant à la lecture',
   /function _idsContacts\(arr\)/.test(gl)
   && /return _idsContacts\(p\.medecins\);/.test(gl)
   && /return _idsContacts\(p\.entourage\);/.test(gl));
ck('et la cause exacte est écrite', /Les deux boutons étaient le même/.test(gl));
ck('la source est corrigée aussi, pas seulement les dossiers',
   /\{ id:uid\(\), \.\.\.c \}/.test(sh) && /EST LA CORRECTION DU « PRESCRIPTEUR BLOQUÉ »/.test(sh));
// ⚠️ cabRef dit d'où il vient, id dit qui il est : deux choses.
ck('le lien vers l annuaire reste distinct de l identifiant',
   /l'un dit QUI c'est au dossier, l'autre d'OÙ il vient/.test(sh));
ck('la ligne de traitement affiche le nom, pas seulement la spécialité',
   /LE NOM, pas seulement la spécialité/.test(tr));

console.log('\n═══ ⑤ LES DOUZE FORMES ═══');
const FORMES = new Function(tr.slice(tr.indexOf('const FORMES'),
  tr.indexOf('function formeIc')) + '; return FORMES;')();
ck('douze formes', FORMES.length === 12);
ck('aucun code en double', new Set(FORMES.map(f => f[0])).size === 12);
ck('chacune a un code, une icône, un libellé',
   FORMES.every(f => f.length === 3 && f.every(x => String(x).trim())));
// ⚠️ LES CINQ CODES D'ORIGINE SONT ÉCRITS DANS LES DOSSIERS DÉJÀ SAISIS.
ck('les cinq codes d origine sont intacts',
   ['cp','inj','got','patch','aut'].every(k => FORMES.some(f => f[0] === k)));
ck('et la raison est écrite', /[Oo]n ajoute,\s*\n?\s*on ne renomme pas/.test(tr));
// ⚠️ Le piège d'ordre : « transdermique » contient « dermique ».
{ const t = tr.slice(tr.indexOf('const TRAIT_FORMES_ALIAS'), tr.indexOf('function traitFormeDepuis'));
  ck('la table de lecture va du précis au large',
     t.indexOf('["col"') < t.indexOf('["got"')
     && t.indexOf('["gel"') < t.indexOf('["cp"')
     && t.indexOf('["patch"') < t.indexOf('["pom"'));
  ck('et le piège « transdermique / dermique » est commenté',
     /« dispositif TRANSDERMIQUE » contient/.test(tr)); }
// ⚠️ Une liste recopiée à la main finit par mentir.
ck('la liste du classeur est construite depuis FORMES, pas recopiée',
   /FORMES\.map\(f => f\[2\]\)/.test(tr));

console.log('\n═══ ④ LE TROISIÈME RYTHME ═══');
ck('trois rythmes, un seul endroit qui tranche', /function traitRythme\(l\)/.test(tr));
// ⚠️ La posologie était rédigée en cinq points : ajouter un rythme aurait
//    voulu dire cinq corrections, dont une oubliée.
ck('et un seul endroit qui la met en mots', /function traitPoso\(l\)/.test(tr));
ck('les cinq anciennes rédactions ont disparu',
   (tr.match(/\? "si besoin"\s*\n?\s*:/g) || []).length === 0);
ck('la fiche imprimée l emploie aussi', /traitRythme\(l\) !== "fixe"/.test(tr));
ck('et l export de dossier également', /traitRythme\(x\) !== "fixe"/.test(fi));
// ⚠️ « si besoin » passe d'abord : un ancien dossier n'a pas de freq.
ck('les deux marqueurs sont exclusifs, et « si besoin » passe d abord',
   /if \(l\.sibesoin\) return "sib";/.test(tr)
   && /l\.sibesoin = \(mode === "sib"\);/.test(tr)
   && /if \(mode === "freq"\) l\.freq = freq; else delete l\.freq;/.test(tr));
// ⚠️ SA DEMANDE LITTÉRALE : les quatre cases doivent DISPARAÎTRE.
ck('« autre rythme » masque les quatre moments',
   /mode === "freq" \? `<div class="rowlab bl"><span>Rythme<\/span>/.test(tr)
   && /ne s'appliquent pas à ce rythme : ils sont masqués/.test(tr));
ck('quatre raccourcis et un champ libre',
   /const TRAIT_RYTHMES = \[/.test(tr) && /id="te-freq"/.test(tr));
// ⚠️ LIMITE POSÉE VOLONTAIREMENT : aucune date calculée.
ck('aucune date de prochaine prise n est calculée',
   /n'en déduit aucune date/.test(tr) && /ne calcule pas la date de la prochaine prise/.test(tr));
// ⚠️ Tout bouton qui redessine doit d'abord ramasser l'écran.
ck('chaque bouton qui redessine ramasse l écran d abord',
   (tr.match(/grab\(\);/g) || []).length >= 5 && /Tout bouton qui redessine/.test(tr));
ck('un rythme laissé vide est refusé plutôt qu enregistré muet',
   /if \(mode === "freq" && !freq\)\{ toast/.test(tr));
ck('un rythme non quotidien importé du classeur a sa case',
   /l\.freq = lire\("freq"\)\.trim\(\)/.test(tr));
// ⚠️ Le classeur remplace la ligne, il ne la complète pas.
ck('et un import ne laisse pas traîner l ancien rythme',
   /if \(o\.l\.freq\) g\.freq = o\.l\.freq; else delete g\.freq;/.test(tr));
ck('les lignes à rythme ont leur propre groupe à l écran', /Autre rythme<\/span>/.test(tr));
ck('le rythme remplace les colonnes de prise, il ne s y ajoute pas',
   /il les REMPLACE, il ne s'ajoute pas/.test(tr) && /\.trgrid \.tr-sb\.tr-fq\{/.test(css));

console.log('\n═══ ⑥ LE LISTING ═══');
// ⚠️ LE DÉFAUT CHANGE : alphabétique en v1.10.0, ordre de passage ici.
ck('le tri a son helper, et le défaut est l ordre de passage',
   /function listeTri\(\)/.test(gl) && /S\.listeTri === "alpha" \? "alpha" : "ordre"/.test(gl));
ck('et le piège du défaut inversé est écrit', /aurait suffi à inverser le défaut/.test(gl));
ck('l ordre de passage ne retrie rien : il reprend celui des cartes',
   /arrive DÉJÀ dans l'ordre de passage/.test(ui));
// ⚠️ SA REMARQUE : les lettres allongeaient le défilé.
ck('les séparateurs de lettres ne sortent qu en alphabétique',
   /\(alpha && L !== lettre\)/.test(ui) && /ils rallongeaient le\s*\n?\s*défilé/.test(ui));
ck('un rang numéroté, seulement en ordre de passage', /alpha \? "" : `<span class="pl-rg">/.test(ui));
// ⚠️ `.board` est une grille à deux colonnes.
ck('le listing sort de la grille à deux colonnes',
   /classList\.add\("listing"\)/.test(ui) && /\.board\.listing\{ display:block; \}/.test(css));
ck('et il en sort dans les deux autres branches',
   (ui.match(/classList\.remove\("listing"\)/g) || []).length === 2);
// ⚠️ SA DEMANDE LITTÉRALE : « les infos à droite sur une seule ligne max »
ck('les informations de droite tiennent sur une seule ligne',
   /flex-wrap:nowrap/.test(css) && /UNE SEULE LIGNE À DROITE/.test(ui));
ck('leur nombre est borné, et le reste compté', /const INF_MAX = 3;/.test(ui)
   && /\+\$\{reste\}/.test(ui));
ck('et la raison est écrite', /DERNIÈRE PASTILLE SE COUPAIT EN DEUX/.test(ui));
ck('c est le nom qui se coupe, pas la vigilance',
   /[Ll]e NOM se coupe, jamais les informations de droite/.test(css));
ck('l âge cède sa place avant le nom', /inf\.length < 3 \? ` <em>/.test(ui));
// ⚠️ LA RÈGLE DÉFENDUE : un réglage d'affichage ne cache jamais une alerte.
ck('la vigilance reste écrite en toutes lettres',
   /st === "alert"\s*\)\s*inf\.push\(`<span class="pl-m d">vigilance/.test(ui));
ck('et le statut est doublé par un liseré', /\.pl-i\.st-alert\{  border-left-color:var\(--danger\); \}/.test(css));
// ⚠️ Un seul réglage pour deux écrans qui montrent la même chose.
ck('le listing suit le réglage des cartes, il n en a pas un à lui',
   /vitalsHtml\(cst, al, p\.thresholds, p\)/.test(ui)
   && /carteMontre\("badges", p\)/.test(ui) && /un réglage de trop/.test(ui));
ck('les actions 📞 📍 sont hors du bouton de la rangée',
   /HORS du bouton principal/.test(ui) && /class="pl-act"/.test(ui));
ck('toucher une ligne ramène aux cartes sur ce patient',
   /openId = b\.dataset\.pli; S\.boardListe = false/.test(ui));

console.log('\n' + (ko.length ? '⚠ ' + ko.length + ' point(s) : ' + ko.join(' · ')
                              : '✓ tout est en place'));
process.exit(ko.length ? 1 : 0);
