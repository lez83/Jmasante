// La base des médicaments : ce qu'elle contient, et surtout ce qu'elle
// ne doit jamais contenir.
const fs = require('fs'); const R = '../jmsante/';
let ko = []; const ck = (l,c) => { console.log(`  ${c?'✓':'⚠'} ${l}`); if(!c) ko.push(l); };
const base = fs.readFileSync(R+'www/js/medicaments_base.js','utf-8');
const ui   = fs.readFileSync(R+'www/js/medicaments.js','utf-8');
const css  = fs.readFileSync(R+'www/css/app.css','utf-8');
const tr   = fs.readFileSync(R+'www/js/traitement.js','utf-8');
const sh   = fs.readFileSync(R+'www/js/sheets.js','utf-8');
const bld  = fs.readFileSync(R+'build.js','utf-8');

const { MED_BASE, MED_VOIES, MED_VERIF, medTotalBase } =
  new Function(base + '; return { MED_BASE, MED_VOIES, MED_VERIF, medTotalBase };')();
const tous = MED_BASE.flatMap(g => g.items.map(m => ({ ...m, g:g.g })));
const champs = m => [m.i, m.s, m.r].join(' ');

console.log('═══ LE JEU DE DONNÉES ═══');
ck('226 molécules en 14 chapitres', medTotalBase() === 226 && MED_BASE.length === 14);
ck('chaque entrée a une molécule, une famille, une indication',
   tous.every(m => m.d && m.f && m.i));
ck('chaque entrée a au moins une voie', tous.every(m => (m.v||[]).length));
ck('aucune voie inventée', tous.every(m => (m.v||[]).every(v => MED_VOIES[v])));
ck('aucune molécule en double',
   new Set(tous.map(m => m.d.toLowerCase())).size === tous.length);
ck('la base dit sa date de vérification', /^\d{2}\/\d{2}\/\d{4}$/.test(MED_VERIF));

console.log('\n═══ LA DOCTRINE — CE QUI NE DOIT JAMAIS Y ENTRER ═══');
// ⚠️ LE POINT CENTRAL. Une liste partielle d'interactions laisse croire
//    qu'on a vérifié : c'est plus dangereux que pas de liste du tout.
ck('aucune entrée ne prétend décrire une interaction',
   tous.every(m => !/interaction/i.test(champs(m))));
// ⚠️ La posologie est sur l'ordonnance du patient, pas ici.
ck('aucune posologie chiffrée',
   tous.every(m => !/\d+\s*(mg|g|µg|ui)\s*(par jour|\/\s*j|x\s*\d|toutes les \d)/i.test(champs(m))));
ck('aucune contre-indication annoncée comme telle',
   tous.every(m => !/contre-indiqu/i.test(m.s||'')));
// ⚠️ Pas de codes de remboursement ni d'information financière, nulle part.
ck('aucun montant ni code de remboursement',
   // ⚠️ « euro » sans frontière de mot attrapait « neuropathique » et
   //    « neurologue » : huit faux positifs, et un contrôle qui criait
   //    au loup là où tout allait bien.
   tous.every(m => !/€|\beuros?\b|rembours|tarif|\bprix\b|\bLPP\b/i.test(champs(m))));
// ⚠️ L'app ne dit jamais quelle mention serait réglementaire.
ck('rien n est présenté comme réglementaire ou obligatoire par la loi',
   tous.every(m => !/obligation légale|réglementairement|la loi impose/i.test(champs(m))));

console.log('\n═══ LES CORRECTIONS DE VÉRIFICATION ═══');
// ⚠️ Six spécialités fausses ou arrêtées, trouvées en confrontant la
//    liste à la base publique le 07/10/2026. Elles ne doivent pas
//    revenir par une réécriture distraite.
const inex = ['Diclogesic','Ordus','Atmex'];
const arret = ['Nisis','Mecir','Josir','Motilium','Xelevia'];
inex.concat(arret).forEach(n => {
  const porteurs = tous.filter(m => new RegExp('(^|[·/,] *)' + n, 'i').test(m.c || ''));
  ck(n + ' ne figure dans aucune colonne de noms commerciaux', porteurs.length === 0);
});
ck('les retraits sont expliqués plutôt que silencieux',
   inex.concat(arret).every(n => new RegExp(n, 'i').test(base)));
ck('Geltim est donné comme un gel, pas comme un collyre',
   /Geltim LP est un GEL/i.test(base) || /Geltim LP est un <b>GEL/i.test(base));
ck('Klipal est au nom actuel, pas « Klipal Codéine »',
   /Klipal Codéine » s'appelle désormais Klipal/.test(base));
ck('la fluindione porte la restriction de l ANSM',
   /ne doit plus être instaurée/.test(base));
ck('Lasilix Spécial 500 mg est signalé comme un piège de confusion',
   /Lasilix Spécial, c'est 500 mg/.test(base));
ck('Stagid n est pas donné pour l équivalent de Glucophage',
   /280 mg de metformine base/.test(base));

console.log('\n═══ LES MANQUES COMBLÉS ═══');
const a = rx => tous.some(m => rx.test(m.d) || rx.test(m.c||''));
ck('les insulines sont là', a(/Lantus|glargine/i) && a(/Humalog|lispro/i) && a(/Novomix/i));
ck('les HBPM sont là', a(/Lovenox/i) && a(/Innohep/i) && a(/Arixtra/i));
ck('les AVK sont là', a(/Previscan/i) && a(/Coumadine/i));
ck('les opioïdes forts au-delà de la morphine', a(/Durogesic/i) && a(/Oxycontin/i));
ck('la douleur neuropathique', a(/Lyrica/i) && a(/Neurontin/i) && a(/Laroxyl/i));
ck('la neuro-gériatrie', a(/Aricept/i) && a(/Ebixa/i) && a(/Modopar|Sinemet/i));
ck('les neuroleptiques', a(/Risperdal/i) && a(/Haldol/i) && a(/Tercian/i));
ck('les soins palliatifs', a(/Hypnovel/i) && a(/Scoburen|Scopoderm/i) && a(/Sandostatine/i));
ck('le méthotrexate, avec son piège hebdomadaire',
   tous.some(m => /thotrexate/i.test(m.d) && /UNE SEULE PRISE PAR SEMAINE/.test(m.s||'')));

console.log('\n═══ LA RECHERCHE ═══');
// ⚠️ Sans recherche par nom commercial, la base ne sert à rien : on lit
//    « TAHOR » sur une ordonnance, pas « atorvastatine ».
ck('la recherche porte sur la DCI, les marques, la famille et l indication',
   /function medIndex[\s\S]{0,160}m\.d, m\.c, m\.f, m\.i/.test(ui));
// ⚠️ La pliure doit garder la longueur, sinon le surlignage se décale.
ck('la table de pliure ne fait que des remplacements d UN caractère',
   Object.values(new Function(ui.match(/const _MED_PLI = \{[\s\S]*?\};/)[0]
     + '; return _MED_PLI;')()).every(v => v.length === 1));
ck('le surlignage échappe le HTML', /<mark>" \+ esc\(/.test(ui));
ck('la loupe ne fait que remplir une recherche, elle ne devine rien',
   /on ne devine pas la molécule/i.test(ui));

console.log('\n═══ LE BRANCHEMENT ═══');
ck('les deux modules sont dans l ordre de compilation, données d abord',
   /'medicaments_base','medicaments'/.test(bld) &&
   (bld.match(/'medicaments_base','medicaments'/g)||[]).length === 2);
ck('l écran est dans Mes outils, sans passer par une fonction en essai',
   /data-sec="meds"/.test(sh) && !/essaiActif\("medicaments"\)/.test(sh));
ck('un seul routage pour les deux chemins', /case "meds":\s+sheetMedicaments/.test(sh));
ck('la loupe est sur chaque ligne de traitement', /data-mdlp=/.test(tr));
// ⚠️ Rien d'un dossier ne part dans un attribut HTML.
ck('la loupe passe l identifiant de ligne, pas le libellé',
   /data-mdlp="\$\{esc\(l\.id\)\}"/.test(tr));
ck('elle disparaît en mode sélection', /selMode \? "" : `<button class="tr-lp"/.test(tr));
ck('le retour ramène à la fiche de traitement, pas aux réglages',
   /medDepuisTraitement\(li\.nom, \(\) => sheetTraitement\(pid\)\)/.test(tr));
ck('le dossier est relu par son identifiant au retour', /const pid = p\.id;/.test(tr));

console.log('\n═══ CORRIGER ET AJOUTER ═══');
ck('la liste d origine reste en dur et revient sur demande',
   /M\.modifs = \{\}; M\.ajouts = \[\]/.test(ui));
ck('la DCI d origine n est jamais réécrite', /Non modifiable/.test(ui));
ck('une correction identique à l original ne compte plus comme correction',
   /if \(pareil\) delete M\.modifs\[dci\]/.test(ui));
ck('une molécule déjà présente est refusée', /déjà dans la base/.test(ui));
// ⚠️ Un classeur rempli à moitié ne doit pas vider la moitié de la base.
ck('à l import, une cellule vide n efface pas ce que l original disait',
   /ne doit pas effacer[\s\S]{0,200}on ne retient que ce qui est/.test(ui));
ck('l import annonce son bilan chiffré avant d écrire', /askChoice\(\{ ic:"📥"/.test(ui));
ck('l import laisse le choix entre compléter et remplacer',
   /val:"merge"/.test(ui) && /val:"replace"/.test(ui));
ck('le modèle vierge ne contient aucun exemple', /AUCUN exemple dans cet onglet/.test(ui));
ck('le classeur rappelle les interdits', /CE QUI N'ENTRE PAS DANS CETTE BASE/.test(ui));

console.log('\n═══ CE QUE L ÉCRAN DIT DE LUI-MÊME ═══');
ck('les interactions renvoient dehors, en disant pourquoi',
   /function medInteractions/.test(ui) && /plus dangereuse qu'une absence de liste/.test(ui));
ck('aucune URL d interaction embarquée dans les données',
   !/https?:\/\//.test(base));
ck('le cadre est rappelé sur chaque fiche, pas une fois à l accueil',
   /pas une aide à la prescription/.test(ui) && /md-cadre/.test(ui));
// ⚠️ Dans la WebView Android, une fenêtre sans parent ne rend pas la main.
ck('le lien externe passe par "_system", pas "_blank"',
   /window\.open\(url, "_system"\)/.test(ui));
ck('l habillage n introduit aucune couleur hors jetons',
   !/\.md-[a-z]+\{[^}]*#[0-9a-fA-F]{3,6}/.test(css));
ck('l écran suit les deux thèmes sans règle en plus',
   /LA BASE DES MÉDICAMENTS[\s\S]{0,400}jetons existants suffisent/.test(css));

console.log('\n' + (ko.length ? '⚠ ' + ko.length + ' point(s) : ' + ko.join(' · ')
                              : '✓ tout est en place'));
process.exit(ko.length ? 1 : 0);
