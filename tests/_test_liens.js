// Documents rattachés (ordonnances / antécédents), lecture d'un PDF,
// et glisser-déposer de l'ordre des passages.
const fs=require('fs');
let ko=[]; const ck=(l,c)=>{ console.log(`  ${c?'✓':'⚠'} ${l}`); if(!c) ko.push(l); };
const rd = f => fs.readFileSync('../jmsante/www/js/'+f, 'utf-8');
const rec = rd('recueil.js'), trt = rd('traitement.js'), sh = rd('sheets.js'), glo = rd('globals.js');

console.log('═══ RECONNAISSANCE DANS UN DOCUMENT ═══');
const ia=glo.indexOf("const ATCD_CAT_DEF"), ib=glo.indexOf("const APP_CAT_DEF");
const ATCD=eval("("+glo.slice(glo.indexOf("[",ia), glo.lastIndexOf("];", ib)+1)+")");
global.catDe = () => ATCD;
eval(glo.slice(glo.indexOf("function catParse"), glo.indexOf("function catCompose")));
eval(rec.slice(rec.indexOf("function _sansAccents"), rec.indexOf("async function texteDuPdf")));
eval(rec.slice(rec.indexOf("function _trouvailles"), rec.indexOf("function sheetLireDoc")));

const cr = `Antécédents : Hypertension artérielle (HTA) depuis 2011. Diabète de type 2 (DNID).
 Fibrillation auriculaire. Prothèse totale de hanche droite (PTH) en 2019.
 Insuffisance rénale chronique. Allergie documentée à la pénicilline. BPCO stade II.`;
const r = _trouvailles(cr).map(x => x.titre);
console.log('   ', r.join(' | '));
ck('sigles reconnus (HTA, DNID, PTH, BPCO)',
   r.some(t=>/HTA/.test(t)) && r.some(t=>/DNID/.test(t)) && r.some(t=>/PTH/.test(t)) && r.some(t=>/BPCO/.test(t)));
ck('l\'option précise la ligne (« Diabète type 2 », pas « Diabète »)', r.some(t => /Diabète type 2/.test(t)));
ck('option « chronique » retenue', r.some(t => /Insuffisance rénale chronique/.test(t)));
// ⚠️ Le piège : une allergie à la pénicilline ne doit JAMAIS faire remonter
// « Allergie au latex » — on inventerait une allergie dans un dossier de soins.
ck('aucune allergie inventée', r.some(t=>/pénicilline/.test(t)) && !r.some(t=>/latex/.test(t)));
ck('allergie dirigée vers les vigilances',
   _trouvailles(cr).some(x => /pénicilline/.test(x.titre) && x.dest === 'vigilance'));
ck('texte sans antécédent → aucune proposition',
   _trouvailles("Le patient va bien. Pansement refait, tension correcte.").length === 0);
ck('phrase à choix sans option trouvée → écartée',
   _trouvailles("Le patient présente un diabète.").every(x => !/^Diabète$/.test(x.titre)));

console.log('\n═══ DOCUMENTS RATTACHÉS ═══');
const _l = new Function(trt.slice(trt.indexOf("const LIENS_MAX"), trt.indexOf("function blocOrdos"))
  + "\n return { LIENS_MAX, liensDe };")();
const p = { docs:[{id:'a'},{id:'b'}], liens:{ traitement:['a','b','disparu'] } };
ck('maximum de 5', _l.LIENS_MAX === 5);
ck('un document supprimé se détache tout seul', _l.liensDe(p,'traitement').join(',') === 'a,b');
ck('rattachement explicite, pas deviné par type', /data-lienpick/.test(trt) && /liensDe\(p, cle\)\.push/.test(trt));
ck('le choix pointe vers les documents DU PATIENT', /\(p\.docs\|\|\[\]\)\.filter\(d => !deja\.includes/.test(trt));
ck('ordonnances proposées en premier', /ordonnance\/i\.test\(d\.type/.test(trt));
ck('antécédents : même mécanisme', /blocOrdos\(p, "atcd"\)/.test(rec) && /lierOrdos\(p, "atcd"/.test(rec));
ck('rien n\'est écrit sans validation', /data-tv=/.test(rec) && /tv-ok/.test(rec));
ck('PDF sans texte : message franc', /Pas de texte dans ce document/.test(rec) && /Adobe Scan/.test(rec));

console.log('\n═══ INFOS ET PRESCRIPTEUR ═══');
// ⚠️ « :last-of-type » visait le dernier champ DE SON TYPE parmi ses frères :
// chaque information étant seule dans son bloc, le curseur retombait sur la 1re.
ck('curseur visé par identifiant, pas par :last-of-type',
   /\[data-itxt\]\[data-iid=/.test(sh) && !/data-itxt\]:last-of-type/.test(sh));
ck('le champ porte son identifiant', /data-iid="\$\{esc\(it\.id/.test(sh));
ck('antécédents : lecture d\'un document depuis la fiche', /f-info-lire/.test(sh));
ck('antécédents : documents rattachés depuis la fiche', /f-atcd-liens/.test(sh));
ck('la fiche est enregistrée avant de changer d\'écran', /enregistrerFiche\(true\)/.test(sh));
const trt2 = rd('traitement.js');
ck('prescripteur par médicament TOUJOURS proposé', !/\$\{specs\.length \? `<div class="rowlab vi"><span>Prescripteur/.test(trt2));
ck('aide quand aucun spécialiste n\'est enregistré', /aucun spécialiste enregistré/.test(trt2));
ck('champ libre renommé « Note sur l\'ordonnance »', /Note sur l'ordonnance/.test(trt2));
const css2 = fs.readFileSync('../jmsante/www/css/app.css','utf-8');
ck('DLU écarté des boutons Annuler / Enregistrer', /\.sep-dlu\{/.test(css2) && /id="f-dlu"[^>]*margin-top:16px/.test(sh));

console.log('\n═══ ORDRE DES PASSAGES ═══');
ck('glisser-déposer au pointeur', /pointerdown/.test(sh) && /ap-drag/.test(sh));
ck('appui long avant la prise', /setTimeout\(\(\) => \{\s*drag = true/.test(sh));
ck('défilement automatique près des bords', /vitesse/.test(sh) && /requestAnimationFrame/.test(sh));
ck('ancien « soulever / placer » retiré', !/lifted/.test(sh));
ck('flèches ↑↓ conservées', /data-up/.test(sh) && /data-dn/.test(sh));
ck('patients masqués par le filtre gardent leur place', /visibles\.has\(id\) \? nouveaux\[n\+\+\]/.test(sh));
const css = fs.readFileSync('../jmsante/www/css/app.css','utf-8');
ck('ligne saisie opaque (sinon deux noms superposés)', /\.rap\.ap-drag\{[^}]*background-color:var\(--bg\)/.test(css));

console.log('\nERREURS:', ko.length ? ko.join(' · ') : 'aucune');
process.exit(ko.length?1:0);
