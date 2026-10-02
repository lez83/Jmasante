// La fiche cabinet : annuaire commun, coordonnées multiples, visibilité
// par coordonnée, et lien non contraignant vers les fiches patient.
const fs = require('fs'); const R = '../jmsante/';
let ko = []; const ck = (l,c) => { console.log(`  ${c?'✓':'⚠'} ${l}`); if(!c) ko.push(l); };
const cb = fs.readFileSync(R+'www/js/cabinet.js','utf-8');
const sh = fs.readFileSync(R+'www/js/sheets.js','utf-8');
const fi = fs.readFileSync(R+'www/js/fiche.js','utf-8');
const dl = fs.readFileSync(R+'www/js/dlu.js','utf-8');
const bd = fs.readFileSync(R+'build.js','utf-8');
const css = fs.readFileSync(R+'www/css/app.css','utf-8');

console.log('═══ LE MODULE ═══');
ck('cabinet.js dans la chaîne de construction', /'cabinet','guide','guide26','modeles','dispositifs','calculs','bilans','notes','detente','eggs','essais','sync'/.test(bd));
ck('tuile dans le menu', /data-sec="cab"/.test(sh) && /case "cab":\s*sheetCabinet/.test(sh));
ck('cinq onglets', /\["cabinet","Le cabinet"\]/.test(cb) && /\["entete","Mon en-tête"\]/.test(cb));

console.log('\n═══ COORDONNÉES MULTIPLES ═══');
// ⚠️ tel1/tel2/tel3 plafonne toujours trop tôt : un contact porte une LISTE.
ck('un contact porte une liste', /coord:\[\]/.test(cb) && /coordToutes/.test(cb));
ck('on peut en ajouter sans limite', /c\.coord = c\.coord\|\|\[\]\)\.push/.test(cb));
ck('six types de coordonnée', /CAB_TYPES = \{ tel:/.test(cb));

console.log('\n═══ VISIBILITÉ PAR COORDONNÉE ═══');
// ⚠️ Un praticien donne parfois un numéro réservé aux pros : il reste dans
// l'annuaire, mais ne sort sur AUCUN document remis au patient.
ck('chaque coordonnée porte sa visibilité', /vis:"patient"/.test(cb) && /x\.vis !== "pro"/.test(cb));
ck('la copie privilégie une coordonnée visible', /const vis = coordPrincipale\(c, true\)/.test(cb));
ck('faute de mieux, elle est MARQUÉE', /m\.visPro = true/.test(cb));
ck('filtre des documents patient', /function contactsSansNumeroPro/.test(cb));
ck('appliqué à la fiche imprimée', /contactsSansNumeroPro\(medecinsDe\(p\)\)/.test(fi));
ck('appliqué au DLU', /contactsSansNumeroPro\(medecinsDe\(p\)\)/.test(dl));
ck('appliqué au dossier RGPD', /contactsSansNumeroPro\(p\.medecins\|\|\[\]\)/.test(fi));

console.log('\n═══ LE LIEN NE COMMANDE PAS ═══');
// ⚠️ L'annuaire met à jour, il ne commande pas : supprimer un contact ne
// doit jamais vider douze dossiers.
ck('la fiche garde une COPIE', /une COPIE de/i.test(cb) || /Une COPIE, pas/i.test(cb));
ck('supprimer détache au lieu de vider', /if \(m\.cabRef === c\.id\) delete m\.cabRef/.test(cb));
ck('la suppression annonce les fiches liées', /fiche\(s\) patient y sont liées/.test(cb));
ck('propager demande, jamais en silence', /function cabPropager/.test(cb) && /Que faire des dossiers/.test(cb));
ck('vue inverse : les patients d un contact', /function cabPatientsLies/.test(cb));
ck('bouton « Depuis le cabinet » dans la fiche patient', /data-lccab/.test(sh));


console.log('\n═══ L ALLER-RETOUR EXCEL ═══');
// ⚠️ 860 Ko : la bibliothèque ne doit jamais peser sur le démarrage.
ck('bibliothèque chargée à la demande', /function xlsCharger/.test(cb) && !/exceljs/.test(fs.readFileSync(R+'www/index.html','utf-8')));
ck('six onglets', /addWorksheet\("Lisez-moi"\)/.test(cb) && /addWorksheet\("Coordonnées"\)/.test(cb));
// ⚠️ Une ligne par coordonnée : des colonnes tel1/tel2/tel3 plafonnent.
ck('les coordonnées en lignes, pas en colonnes', /"Coordonnées":\s*\["ref","Contact","Type","Valeur","Visibilité"\]/.test(cb));
ck('colonne ref masquée', /getColumn\(1\)\.hidden = true/.test(cb));
ck('en-tête figé', /state:"frozen", ySplit:1/.test(cb));
ck('listes déroulantes', /dataValidation = \{/.test(cb) && /listeDer\(ws5, "E"/.test(cb));
// ⚠️ Sans format texte, Excel mange le zéro de « 06 12 34 56 78 ».
ck('numéros en format texte', /numFmt = "@"/.test(cb));
ck('une page Lisez-moi', /Ne renomme pas les onglets/.test(cb));

// ⚠️ Une protection Excel se retire en trois clics : le vrai filet est ici.
ck('structure vérifiée AVANT lecture', /function cabVerifierClasseur/.test(cb)
   && cb.indexOf('cabVerifierClasseur(wb)') < cb.indexOf('const lus = []'));
ck('refus franc et explicite', /n'a pas la bonne structure/.test(cb));
ck('coordonnée orpheline ignorée, jamais inventée', /coordonnée orpheline/.test(cb));
ck('rapprochement par identifiant PUIS par nom', /\(ref && x\.id === ref\) \|\| \(nom &&/.test(cb));
ck('trois piles', /const nouveaux = \[\], differents = \[\], identiques = \[\]/.test(cb));
// ⚠️ Les clés des cases doivent être celles des boutons, sinon le premier
// clic inverse l'effet attendu.
ck('tout coché d emblée, avec les bonnes clés', /nouveaux\.map\(\(_, i\) => "n" \+ i\)/.test(cb));
ck('rien n est fusionné en bloc', /data-cmpc/.test(cb) && /Reprendre ce qui est coché/.test(cb));


console.log('\n═══ SYNCHRO DE L ANNUAIRE ═══');
const sy = fs.readFileSync(R+'www/js/sync.js','utf-8');
// ⚠️ L'annuaire est un carnet d'adresses, pas une donnée de tournée :
// il ne part que si l'utilisateur le demande, et n'entre jamais d'office.
ck('il ne part que sur demande', /buildSyncFile\(tour, docIds, avecOrdre, avecAnnuaire\)/.test(sy)
   && /avecAnnuaire && typeof cabinet === "function"/.test(sy));
ck('case décochée par défaut', /<input type="checkbox" id="ss-annuaire">/.test(sy));
ck('les étiquettes « pros seuls » voyagent', /contacts: cabinet\(\)\.contacts \|\| \[\]/.test(sy));
ck('à la réception, on demande avant tout', /Un annuaire de cabinet accompagne/.test(sy));
ck('ignorer reste possible', /Ignorer l'annuaire/.test(sy));
ck('comparaison, jamais fusion d office', /await cabComparer\(pkg\.cabinet\.contacts/.test(sy));
// ⚠️ Sans attente, l'écran suivant de la réception recouvrirait la
// comparaison, qui disparaîtrait sans avoir servi.
ck('la réception ATTEND la décision', /const attendre = new Promise/.test(cb) && /return attendre;/.test(cb));
ck('repartir sans rien prendre est une réponse', /\["#nav-back", "#nav-home"\]/.test(cb));


console.log('\n═══ PLUSIEURS CABINETS ═══');
// ⚠️ Un remplaçant tourne dans deux ou trois structures.
ck('le modèle est une liste', /function cabinets\(\)/.test(cb) && /S\.cabinets/.test(cb));
ck('l ancienne fiche unique est reprise', /if \(S\.cabinet && \(S\.cabinet\.nom/.test(cb));
ck('sélecteur en tête d écran', /data-cabsel/.test(cb));
ck('créer un cabinet', /id="cab-new"/.test(cb));
ck('retirer un cabinet ne vide pas les fiches', /cessent seulement de suivre cet annuaire/.test(cb));
ck('le fichier porte le nom du cabinet', /"Annuaire_" \+ \(sansAccent\(C\.nom/.test(cb));

console.log('\n═══ COMPLÉMENT, SUGGESTIONS, E-MAILS ═══');
// ⚠️ Le statut distingue les praticiens, pas leur planning.
ck('« Jours » remplacé par « Complément »', /"Praticiens":\s*\["ref","Nom","Métier","Complément","N° RPPS","Note"\]/.test(cb)
   && !/\bc\.jours\b/.test(cb));
ck('complément libre, avec suggestions', /CAB_COMPLEMENTS = \["Titulaire"/.test(cb) && /id="cc-comp-pick"/.test(cb));
ck('suggestions pour les numéros utiles', /CAB_UTILES = \["Hôpital"/.test(cb));
// ⚠️ Une liste qui refuse tout le reste enferme : elle propose, sans imposer.
ck('les listes proposent sans imposer', /showErrorMessage: !libre/.test(cb));
ck('e-mail avec sa visibilité, comme un numéro', /mail:"E-mail"/.test(cb));
ck('l aide montre les coordonnées multiples', /Dr Martin \| Mobile/.test(cb));


console.log('\n═══ SPÉCIALITÉS PARTAGÉES ET FILTRAGE ═══');
const gl = fs.readFileSync(R+'www/js/globals.js','utf-8');
// ⚠️ Un annuaire avec son propre vocabulaire rendait le filtre impossible :
// on cherchait « Pneumologue » dans des contacts marqués « Médecin spécialiste ».
ck('l annuaire reprend SPECS', /const CAB_METIERS = \[\.\.\.\(typeof SPECS/.test(cb));
ck('généraliste en tête de liste', /const SPECS = \["Médecin généraliste"/.test(gl));
ck('proposé par défaut à la première saisie', /const parDefaut = med \? "Médecin généraliste"/.test(sh));
ck('« traitant » reste un statut du patient', /un généraliste n'est traitant que pour certains/.test(gl));
ck('le choix part de la spécialité de la ligne', /cabChoisir\("partenaire", spec\)/.test(sh));
ck('filtrage par correspondance', /function cabCorrespond/.test(cb));
// ⚠️ Les contacts saisis avant doivent rester visibles du filtre.
ck('anciens libellés rattrapés', /const CAB_EQUIV = \{/.test(cb) && /function cabSpecNorm/.test(cb));
ck('les libellés vagues restent proposés', /spécialiste\|médecin\$/.test(cb));
// ⚠️ Un filtre sans résultat ne doit pas afficher une liste vide.
ck('repli explicite si rien ne correspond', /Aucun contact en «/.test(cb) && /Voir tout l'annuaire/.test(cb));
ck('le titre dit ce qui est filtré', /" du cabinet" : "Choisir dans l'annuaire"/.test(cb));
ck('la saisie libre reste possible', /<option value="__autre"/.test(sh));


console.log('\n═══ COURRIER À EN-TÊTE ═══');
ck('éditeur de courrier', /function sheetCourrier/.test(cb) && /function produireCourrier/.test(cb));
ck('trois entrées dans « Mon en-tête »', /id="ce-courrier"/.test(cb) && /id="ce-vierge"/.test(cb) && /id="ce-ordo"/.test(cb));
ck('entrée depuis la fiche patient', /id="f-courrier"/.test(sh) && /sheetCourrier\(\{ dest:/.test(sh));
// ⚠️ On écrit parfois depuis une autre adresse sans vouloir changer sa fiche.
ck('en-tête pré-rempli ET modifiable', /nom: E\.nom \|\| ""/.test(cb) && /id="co-nom"/.test(cb));
ck('une correction ne touche pas la fiche', /ne touche pas ta fiche cabinet/.test(cb));
ck('mais peut être reportée explicitement', /id="co-report"/.test(cb) && /Reporter dans la fiche cabinet/.test(cb));
ck('le corps peut rester vide', /ou vide, pour écrire à la main/.test(cb));
ck('feuille vierge à en-tête', /sheetCourrier\(\{ vierge:true \}\)/.test(cb));
ck('destinataire depuis l annuaire', /id="co-annu"/.test(cb));
ck('espace de signature optionnel', /id="co-sig"/.test(cb));
// ⚠️ Mentions obligatoires et responsabilité engagée : rien n'est produit.
ck('ordonnance : gabarit livré, cadré par l utilisateur', /Ordonnance pré-imprimée/.test(cb));
ck('aucune promesse non tenue dans l écran', !/document libre, prêt à l'emploi/.test(cb));


console.log('\n═══ ORDONNANCE PRÉ-IMPRIMÉE ═══');
ck('écran et production', /function sheetOrdonnance/.test(cb) && /function produireOrdonnance/.test(cb));
ck('deux entrées : cabinet et fiche patient', /id="ce-ordo"/.test(cb) && /id="f-ordo"/.test(sh));
// ⚠️ Déménagé : l'identité vit dans Ma fiche depuis la v1.1.0.
ck('numéro AM dans Ma fiche', /id="mo-am"/.test(cb) && /function moi\(\)/.test(cb));
// ⚠️ LA règle : une donnée absente ne laisse AUCUNE trace imprimée.
ck('rien n est écrit sans valeur', /const si = \(v, html\) => v \? html : ""/.test(cb));
ck('pastilles RPPS et AM conditionnelles', /si\(d\.rpps \|\| d\.am/.test(cb) && /si\(d\.am,/.test(cb));
ck('ligne téléphone/courriel conditionnelle', /si\(d\.tel \|\| d\.mail/.test(cb));
ck('aucune balise dans le document produit', !/\{\{[A-Z_]+\}\}/.test(cb.slice(cb.indexOf('function produireOrdonnance'))));
// ⚠️ Décidé avec lui : écrits à la main.
ck('date toujours vide', /<td class="lb">Date :<\/td><td class="vl"><\/td>/.test(cb));
ck('taille et poids toujours vides', /Taille \/ Poids :<\/td><td class="vl"><\/td>/.test(cb));
// ⚠️ Coché d'après le dossier, mais corrigeable : un genre mal saisi ne
// doit pas partir imprimé sans recours.
ck('sexe coché d après le dossier', /d\.sexe === "F" \? "\[✕\] F/.test(cb));
ck('sexe corrigeable avant impression', /data-orsexe/.test(cb) && /Ne pas cocher/.test(cb));
ck('en-tête modifiable avant impression', /id="or-rpps"/.test(cb) && /id="or-adresse"/.test(cb));
ck('date de naissance complète', /p0\.dob\.split\("-"\)\.reverse\(\)\.join\("\/"\)/.test(cb));
ck('accents transposés dans le nom de fichier', /sansAccent\(d\.patient\)/.test(cb));


console.log('\n═══ SÉPARATION DU SÉLECTEUR ═══');
// ⚠️ Deux rangées de pastilles identiques : la première change de DOSSIER,
// la seconde de PAGE. « On a l'impression de cliquer sur les mêmes boutons. »
ck('le sélecteur a son propre cadre', /class="cab-sel"/.test(cb) && /\.cab-sel\{/.test(css));
ck('libellé 🏥 CABINET, logo une seule fois', /🏥 CABINET/.test(cb)
   && !/cabchip[^>]*>🏥/.test(cb));
ck('cabinets rectangulaires, rubriques rondes',
   /\.cabchip\{[^}]*border-radius:8px/.test(css.replace(/\s/g,'')) || /border-radius:8px/.test(css));
ck('l actif en fond plein', /\.cabchip\.on\{[\s\S]{0,120}background:color-mix/.test(css));
ck('le ＋ ne pèse pas autant qu un cabinet', /\.cabchip\.plus\{[\s\S]{0,80}border-style:dashed/.test(css));
ck('trait estompé vers les côtés', /\.cab-trait\{[\s\S]{0,160}radial-gradient\(ellipse at center/.test(css));


console.log('\n═══ RETOURS DE TERRAIN (v1.0.80) ═══');
// ⚠️ « traitant » ne veut pas dire « pas de filtre » : on cherche un
// MÉDECIN. La pharmacie et le VSL étaient proposés au moment d'ajouter
// le médecin traitant.
ck('« traitant » filtre sur les médecins', /function cabEstMedecin/.test(cb)
   && /if \(spec === "traitant"\) return cabEstMedecin\(c\)/.test(cb));
// ⚠️ La datalist s'ouvrait PUIS disparaissait sous le clavier.
ck('plus de liste déroulante du navigateur', !/datalist id="cc-metiers"/.test(cb));
ck('choix du métier en plein écran', /id="cc-met-pick"/.test(cb));
ck('un métier saisi est mémorisé', /S\.cabMetiers = \[\.\.\.new Set/.test(cb));
// ⚠️ L'entrée n'existait que dans le menu en mode liste.
ck('guide prescription dans l écran Application', /id="go-presc"/.test(sh));
// ⚠️ Le laboratoire manquait, et la pharmacie se retapait pour chaque patient.
ck('laboratoire dans la fiche patient', /\["labo","🔬 Laboratoire","Laboratoire"\]/.test(sh));
ck('reprise depuis l annuaire', /data-ckcab/.test(sh));
// ⚠️ Un contact absent de cette liste n'est JAMAIS enregistré.
ck('le laboratoire est bien enregistré', /\["pharma","labo","cabinet"\]\.forEach/.test(sh));
ck('le lien vers l annuaire survit à l enregistrement', /av\.cabRef \? \{ cabRef:av\.cabRef \}/.test(sh));
// ⚠️ Le numéro de version du manuel était écrit en dur (resté à 1.0.68).
{ const b = fs.readFileSync(R+'build.js','utf-8');
  ck('la compilation écrit la version du manuel', /manuel\.html/.test(b) && /class="ver">/.test(b)); }


console.log('\n═══ PARTENAIRES GROUPÉS ═══');
ck('familles de métier', /const CAB_FAMILLES = \[/.test(cb) && /function cabFamille/.test(cb));
ck('sous-groupes par spécialité chez les médecins', /function cabSousGroupes/.test(cb));
ck('les généralistes en tête', /if \(\/généraliste\/i\.test\(a\.lbl\)\) return -1/.test(cb));
// ⚠️ Une spécialité à un seul médecin ne mérite pas son titre quand le
// groupe est fourni : sinon on lit une page d'intertitres.
ck('les spécialités isolées se regroupent', /l\.length === 1 && liste\.length > 6/.test(cb));
ck('un seul groupe ouvert à la fois', /_cabFamOuv === f\.id/.test(cb));
// ⚠️ Deux niveaux de repliement = deux touchers pour un nom. On mémorise
// donc ce qui est FERMÉ : tout est visible dès qu'un groupe s'ouvre.
ck('les spécialités sont ouvertes par défaut', /_cabSpecFerme = new Set/.test(cb)
   && /!_cabSpecFerme\.has\(f\.id \+ "\|" \+ g\.cle\)/.test(cb));
ck('mais repliables une à une', /data-cabsg/.test(cb));
ck('recherche sur nom, métier et numéros', /id="cab-q"/.test(cb) && /coordToutes\(c\)\.map\(x => x\.val\)\.join/.test(cb));
ck('une recherche ouvre ce qu elle trouve', /const ouv = q \? true : _cabFamOuv === f\.id/.test(cb));

console.log('\n═══ DOCUMENTS EN PDF ═══');
// ⚠️ Un .html confié à Android n'ouvre qu'une visionneuse : ni impression
// ni enregistrement. Un PDF est accepté par le pilote d'impression.
ck('ordonnance en PDF', /async function ordonnancePdf/.test(cb) && /if \(pdfDispo\(\)\)\{ ordonnancePdf\(d\); return; \}/.test(cb));
ck('courrier en PDF', /async function courrierPdf/.test(cb) && /if \(pdfDispo\(\)\)\{ courrierPdf\(d\); return; \}/.test(cb));
ck('repli HTML si jsPDF absent', /function pdfDispo/.test(cb));
// ⚠️ La police du PDF ne porte pas les émojis.
ck('aucun émoji écrit dans le PDF', /const sansEmoji = /.test(cb));
ck('la croix est DESSINÉE, pas écrite', /La croix, dessinée — jamais un caractère/.test(cb));
ck('le document est confié au système', /async function pdfLivrer/.test(cb) && /application\/pdf/.test(cb));


console.log('\n═══ SAISIE D UN CONTACT (retours du 2 oct.) ═══');
// ⚠️ Les suggestions du navigateur s'ouvrent puis se referment aussitôt
// sous le clavier : il fallait s'y reprendre cinq à dix fois.
ck('plus aucune liste du navigateur', !/<datalist/.test(cb));
ck('le complément passe par un choix plein écran', /id="cc-comp-pick"/.test(cb));
ck('un complément saisi est mémorisé', /S\.cabComplements = \[\.\.\.new Set/.test(cb));
// ⚠️ Le style EN LIGNE restait sur le menu caché : le bouton prenait toute
// la largeur et le champ voisin devenait minuscule.
{ const uk2 = fs.readFileSync(R+'www/js/uikit.js','utf-8');
  ck('le menu habillé reprend sa largeur', /const st = sel\.getAttribute\("style"\)/.test(uk2)); }
// ⚠️ Type et numéro côte à côte ne tiennent pas sur un téléphone.
ck('le numéro a toute la largeur', /<input class="rec-in" data-ccv=[\s\S]{0,400}?style="width:100%/.test(cb));
ck('le clavier s adapte au type', /inputmode="\$\{x\.type === "mail" \? "email"/.test(cb));
ck('l invite aussi', /placeholder="\$\{x\.type === "mail" \? "adresse@exemple\.fr"/.test(cb));


console.log('\n═══ LE CLAVIER SUIT LE TYPE ═══');
// ⚠️ Le clavier et l'invite sont posés AU DESSIN : changer le type
// ensuite ne les mettait pas à jour — on choisissait « E-mail » et le
// pavé numérique s'ouvrait quand même.
ck('le changement de type est écouté', /\$\$\("#sheet \[data-cct\]"\)\.forEach\(sel => sel\.addEventListener\("change"/.test(cb));
ck('le clavier est remis à jour', /v\.inputMode = t === "mail" \? "email"/.test(cb));
ck('l invite aussi', /v\.placeholder = t === "mail" \? "adresse@exemple\.fr"/.test(cb));
// ⚠️ Le clavier ne change qu'au prochain focus : il faut le forcer si le
// champ est déjà actif.
ck('et forcé si le champ est actif', /if \(document\.activeElement === v\)\{ v\.blur\(\); v\.focus\(\); \}/.test(cb));
// ⚠️ Rien ne doit effacer ce qui est déjà tapé.
ck('la valeur n est pas touchée', !/v\.value = ""/.test(cb.slice(cb.indexOf('data-cct"\]"'))));


console.log('\n═══ PARTAGE DE L ANNUAIRE — LE DÉFAUT CORRIGÉ ═══');
{ const sy2 = fs.readFileSync(R+'www/js/sync.js','utf-8');
  const code = sy2.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/[^\n]*$/gm, '');
  // ⚠️ `S.cabinet` est l'ancien modèle à cabinet unique (abandonné en
  // v1.0.72) : la synchro n'y trouvait plus rien et n'envoyait RIEN,
  // silencieusement, alors que la case était cochée.
  ck('la synchro lit le cabinet ouvert', /cabinet\(\)\.contacts/.test(code));
  ck('plus aucune lecture de l ancien modèle', !/S\.cabinet\b(?!s)/.test(code));
  ck('la case dit ce qui partira', /aucun contact à envoyer/.test(code));
  ck('et nomme le cabinet concerné', /" de " \+ esc\(cabinet\(\)\.nom\)/.test(code));
  // ⚠️ Le choix se fait à la RÉCEPTION, avec les différences affichées.
  ck('la réception demande avant', /Un annuaire de cabinet accompagne/.test(code));
  ck('ignorer reste possible', /Ignorer l'annuaire/.test(code));
  ck('comparaison contact par contact', /await cabComparer\(pkg\.cabinet\.contacts/.test(code));
}

console.log('\nERREURS:', ko.length ? ko.join(' · ') : 'aucune');
process.exit(ko.length ? 1 : 0);
