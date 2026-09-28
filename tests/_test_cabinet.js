// La fiche cabinet : annuaire commun, coordonnées multiples, visibilité
// par coordonnée, et lien non contraignant vers les fiches patient.
const fs = require('fs'); const R = '../jmsante/';
let ko = []; const ck = (l,c) => { console.log(`  ${c?'✓':'⚠'} ${l}`); if(!c) ko.push(l); };
const cb = fs.readFileSync(R+'www/js/cabinet.js','utf-8');
const sh = fs.readFileSync(R+'www/js/sheets.js','utf-8');
const fi = fs.readFileSync(R+'www/js/fiche.js','utf-8');
const dl = fs.readFileSync(R+'www/js/dlu.js','utf-8');
const bd = fs.readFileSync(R+'build.js','utf-8');

console.log('═══ LE MODULE ═══');
ck('cabinet.js dans la chaîne de construction', /'cabinet','guide','sync'/.test(bd));
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
   && /avecAnnuaire && S\.cabinet \? \{ cabinet:/.test(sy));
ck('case décochée par défaut', /<input type="checkbox" id="ss-annuaire">/.test(sy));
ck('les étiquettes « pros seuls » voyagent', /contacts: S\.cabinet\.contacts/.test(sy));
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
ck('« Jours » remplacé par « Complément »', /"Praticiens":\s*\["ref","Nom","Métier","Complément","Note"\]/.test(cb)
   && !/\bc\.jours\b/.test(cb));
ck('complément libre, avec suggestions', /CAB_COMPLEMENTS = \["Titulaire"/.test(cb) && /list="cc-comps"/.test(cb));
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
ck('numéro AM dans la fiche cabinet', /id="ce-am"/.test(cb) && /"nom","titre","rpps","am"/.test(cb));
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

console.log('\nERREURS:', ko.length ? ko.join(' · ') : 'aucune');
process.exit(ko.length ? 1 : 0);
