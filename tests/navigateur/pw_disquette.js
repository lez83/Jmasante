// LE 💾 DU HAUT ENREGISTRE, ET ON RESTE (v1.28.0)
//
// ⚠️ CONSTATÉ AU CHEVET : « en haut j'ai la petite disquette, mais si je
//    clique dessus rien ne se passe ». Mesuré avant correction :
//
//      <span> · 21 × 33 px · aucun gestionnaire · infobulle « État de
//      l'enregistrement » · le bouton « ✓ Enregistrer » 1 765 px plus bas
//
// ⚠️ L'ARBITRAGE RETENU EN MAQUETTE : il enregistre SANS FERMER. Celui du
//    bas ferme la fiche — c'est la fin de la tâche. Toucher le 💾 au
//    milieu du remplissage, c'est vouloir sécuriser sa saisie et
//    continuer ; le refermer ferait reperdre les 1 765 px. L'épreuve
//    garde donc les deux comportements, et le fait qu'ils DIFFÈRENT.
//
// ⚠️ LE PIÈGE DE CE CHANTIER : `majBadges()` repose tout le `className`
//    et tout le texte du témoin à chaque écriture de fond — c'est-à-dire
//    sans arrêt. Un bouton dont le libellé est réécrit redevient un
//    témoin muet dans la seconde. Contrôlé après une sauvegarde forcée.
//
// ⚠️ ET LA GARDE DE SORTIE DOIT RESTER ARMÉE. Elle était posée à `null`
//    en enregistrant — sans conséquence tant qu'enregistrer fermait la
//    fiche. Maintenant qu'on reste, une saisie faite après serait repartie
//    sans un mot.
const { chromium } = require('playwright');
const http=require('http'),fs=require('fs'),path=require('path');
const ROOT=path.join(__dirname,'..','..','www');
const MIME={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.svg':'image/svg+xml'};
const srv=http.createServer((q,r)=>{let u=decodeURIComponent(q.url.split('?')[0]);if(u==='/')u='/index.html';
 const f=path.join(ROOT,u); if(!f.startsWith(ROOT)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);r.end('404');return;}
 r.writeHead(200,{'Content-Type':MIME[path.extname(f)]||'application/octet-stream'});r.end(fs.readFileSync(f));});
let ko=[]; const ok=(l,c,x)=>{console.log(`  ${c?'✓':'⚠'} ${l}${x!==undefined&&!c?'  → '+x:''}`); if(!c)ko.push(l);};
const J = v => JSON.stringify(v);

(async()=>{
 await new Promise(r=>srv.listen(8229,r));
 const nav=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
 const pg=await (await nav.newContext({viewport:{width:430,height:950}})).newPage();
 const errs=[]; pg.on('pageerror',e=>errs.push(String(e)));
 await pg.goto('http://localhost:8229/index.html'); await pg.waitForTimeout(2700);
 const pid = await pg.evaluate(()=>{ S.confidentialityAck=true; S.firstRun=false;
   openId=null; render(); return S.patients[0].id; });

 const badge = () => pg.evaluate(()=>{
   const b=document.querySelector('#sheet .save-badge');
   if(!b) return { present:false };
   const cs=getComputedStyle(b), x=b.getBoundingClientRect();
   return { present:true, tag:b.tagName, txt:b.textContent.trim(), titre:b.title,
            act:b.classList.contains('act'), att:b.classList.contains('att'),
            curseur:cs.cursor, h:Math.round(x.height), w:Math.round(x.width),
            onclick:(typeof b.onclick==='function') };
 });
 const ouvrir = id => pg.evaluate(async x=>{ closeSheet(true); sheetPatient(getP(x));
   await new Promise(r=>setTimeout(r,500)); }, id);

 /* ═══ ① LA FICHE : UN VRAI BOUTON ═══ */
 console.log('═══ DANS LA FICHE PATIENT ═══');
 await ouvrir(pid);
 const b0 = await badge();
 console.log('     au repos : ' + J(b0));
 ok('① le 💾 est un bouton', b0.tag === 'BUTTON', b0.tag);
 ok('① il porte une action', b0.act === true && b0.onclick === true, J(b0));
 /* ⚠️ 21 × 33 px AVANT : on ne vise pas ça au pouce en marchant. */
 ok('① il fait au moins 34 px de haut', b0.h >= 34, b0.h + ' px');
 ok('① et il se présente comme touchable', b0.curseur === 'pointer', b0.curseur);
 ok('① au repos il n\'appelle pas à l\'action', b0.att === false, J(b0));

 /* ═══ ② IL SUIT LA FRAPPE ═══ */
 console.log('═══ IL SUIT LA FRAPPE ═══');
 const taper = (champ, v) => pg.evaluate(async ([c, x])=>{
   const e=document.getElementById(c); e.value=x;
   e.dispatchEvent(new Event('input',{bubbles:true}));
   await new Promise(r=>setTimeout(r,250));
 }, [champ, v]);
 await taper('f-prenom', 'Yvonne-Marie');
 const b1 = await badge();
 console.log('     après frappe : ' + J({txt:b1.txt, att:b1.att, w:b1.w}));
 ok('② une modification le fait passer en appel à l\'action',
    b1.att === true && /Enregistrer/.test(b1.txt), J(b1));
 ok('② et il s\'élargit pour porter son libellé', b1.w > b0.w, b0.w + ' → ' + b1.w + ' px');

 /* ⚠️ LE PIÈGE : une écriture de fond repose tout le libellé du témoin.
    Sans la garde, « 💾 Enregistrer » redevenait « 💾 » aussitôt. */
 await pg.evaluate(async()=>{ if (typeof save === "function") save(true);
   await new Promise(r=>setTimeout(r,700)); });
 const b1b = await badge();
 ok('② une sauvegarde de fond ne lui reprend pas son libellé',
    b1b.att === true && /Enregistrer/.test(b1b.txt), J({txt:b1b.txt, att:b1b.att}));

 /* ═══ ③ IL ENREGISTRE, ET LA FICHE RESTE OUVERTE ═══ */
 console.log('═══ IL ENREGISTRE SANS FERMER ═══');
 const avant = await pg.evaluate(i=>getP(i).prenom, pid);
 await pg.click('#sheet .save-badge'); await pg.waitForTimeout(700);
 const r3 = await pg.evaluate(i=>({ prenom:getP(i).prenom,
   feuille:!!document.querySelector('#veil.on'),
   champ:(document.getElementById('f-prenom')||{}).value }), pid);
 const b2 = await badge();
 console.log('     prénom en base : ' + J(avant) + ' → ' + J(r3.prenom));
 ok('③ le clic enregistre vraiment', r3.prenom === 'Yvonne-Marie', J(r3.prenom));
 /* ⚠️ C'EST L'ARBITRAGE DE LA MAQUETTE, ET IL SE GARDE : la fiche RESTE. */
 ok('③ et la fiche reste ouverte', r3.feuille === true, J(r3));
 ok('③ au même endroit, champs remplis', r3.champ === 'Yvonne-Marie', J(r3.champ));
 ok('③ le bouton redevient un témoin discret',
    b2.att === false && !/Enregistrer/.test(b2.txt), J({txt:b2.txt, att:b2.att}));

 /* ═══ ④ LA GARDE DE SORTIE RESTE ARMÉE ═══ */
 console.log('═══ LA GARDE DE SORTIE APRÈS UN ENREGISTREMENT ═══');
 /* ⚠️ Posée à `null` en enregistrant, elle ne défendait plus rien. Sans
    conséquence quand enregistrer fermait la fiche ; avec, maintenant. */
 await taper('f-prenom', 'Yvonne-Marie-Claire');
 const sortie = await pg.evaluate(async()=>{
   closeSheet();                               // sans `force` : la garde doit parler
   await new Promise(r=>setTimeout(r,450));
   const d=document.querySelector('.dlg-veil, .dlg-card');
   const txt=d?(d.textContent||'').replace(/\s+/g,' ').trim().slice(0,70):null;
   const encore=!!document.querySelector('#veil.on');
   // on referme la question, puis la fiche pour de bon
   const no=document.querySelector('.dlg-veil [data-no], .dlg-cancel');
   if (no) no.click();
   await new Promise(r=>setTimeout(r,350));
   return { question:!!d, txt, ficheEncoreLà:encore };
 });
 console.log('     ' + J(sortie));
 ok('④ quitter après une nouvelle saisie pose encore la question',
    sortie.question === true, J(sortie));
 ok('④ et la fiche n\'est pas partie entre-temps', sortie.ficheEncoreLà === true, J(sortie));

 /* ═══ ⑤ LE BOUTON DU BAS, LUI, FERME TOUJOURS ═══ */
 console.log('═══ LES DEUX NE FONT PAS LA MÊME CHOSE ═══');
 await pg.evaluate(()=>closeSheet(true)); await pg.waitForTimeout(300);
 await ouvrir(pid);
 await taper('f-prenom', 'Yvonne');
 await pg.click('#sheet #f-save'); await pg.waitForTimeout(800);
 const bas = await pg.evaluate(i=>({ prenom:getP(i).prenom,
   feuille:!!document.querySelector('#veil.on') }), pid);
 console.log('     ' + J(bas));
 ok('⑤ le bouton du bas enregistre aussi', bas.prenom === 'Yvonne', J(bas.prenom));
 ok('⑤ mais lui ferme la fiche', bas.feuille === false, J(bas));

 /* ═══ ⑥ AILLEURS, LE 💾 RESTE UN TÉMOIN ═══ */
 console.log('═══ SUR LES ÉCRANS SANS RIEN À VALIDER ═══');
 /* ⚠️ Le 💾 est posé dans la barre de TOUS les panneaux. La plupart
    écrivent au fur et à mesure : leur donner un bouton qui « enregistre »
    promettrait une validation qui n'existe pas. Et surtout, l'action d'un
    écran ne doit pas survivre au suivant. */
 const ailleurs = await pg.evaluate(async()=>{
   closeSheet(true); await new Promise(r=>setTimeout(r,300));
   if (typeof sheetAnnulations === "function") sheetAnnulations();
   else if (typeof sheetDocsVierges === "function") sheetDocsVierges();
   await new Promise(r=>setTimeout(r,500));
   const b=document.querySelector('#sheet .save-badge');
   return b ? { present:true, act:b.classList.contains('act'),
                onclick:(typeof b.onclick==='function'),
                curseur:getComputedStyle(b).cursor,
                txt:b.textContent.trim() } : { present:false };
 });
 console.log('     ' + J(ailleurs));
 ok('⑥ le 💾 y est bien présent', ailleurs.present === true);
 ok('⑥ mais sans action', ailleurs.act === false && ailleurs.onclick === false, J(ailleurs));
 ok('⑥ et il ne promet plus de clic', ailleurs.curseur === 'default', J(ailleurs.curseur));

 /* Et rouvrir la fiche lui rend son action. */
 await ouvrir(pid);
 const retour = await badge();
 ok('⑥ rouvrir la fiche lui rend son action', retour.act === true && retour.onclick === true, J(retour));

 /* ══════════════════════════════════════════════════════════════
    LE 💾 N'APPARAÎT QUE S'IL A UN ÉTAT À MONTRER          (v1.30.0)
    ──────────────────────────────────────────────────────────────
    ⚠️ CONSTATÉ AU CHEVET, ÉCRAN RÉGLAGES : « la disquette en haut à
    droite ne fonctionne pas ». Elle n'était pas en panne — Réglages
    est un MENU : rien n'y est jamais enregistré, elle n'avait aucun
    état à montrer. Mesuré alors : le 💾 posé sur 88 panneaux, actif
    sur UN, et 38 panneaux sans le moindre champ de saisie.

    ⚠️ POURQUOI PAS UNE DÉCORATION À LA PLACE : un ornement prendrait
    la place d'un indicateur, l'œil apprendrait que ce coin ne dit
    rien — et deux écrans plus loin, en pleine saisie, le 💾 est le
    SEUL endroit qui dise « c'est passé ».

    ⚠️ ET IL MENTAIT. Mesuré sur « médicament perso » et « contact du
    cabinet », formulaire rempli mais pas enregistré : « 💾 ✓ —
    Enregistré sur l'appareil ». Il répondait sur l'état du DOSSIER,
    pas sur celui de l'ÉCRAN, et rassurait quand une saisie pouvait
    se perdre.
 ══════════════════════════════════════════════════════════════ */
 console.log('\n── LE 💾 N\'APPARAÎT QUE S\'IL A UN ÉTAT À MONTRER ──');

 const etat = (o) => pg.evaluate(async ([o, P]) => {
   closeSheet(true); await new Promise(r => setTimeout(r, 250));
   try { eval(o); } catch(e){ return { err: String(e).slice(0, 45) }; }
   await new Promise(r => setTimeout(r, 700));
   const b = document.querySelector('#sheet .nav-save');
   return { badge: !!b, visible: !!(b && b.offsetParent !== null),
            champs: document.querySelectorAll('#sheet input, #sheet textarea, #sheet select').length };
 }, [o, pid]);

 for (const [n, o] of [['Réglages','sheetTours()'], ['Détente','sheetDetente()'],
                       ['Mes patients','sheetPatientsPanel()'], ['Mes modèles','sheetModeles(P)'],
                       ['Documents vierges','sheetDocsVierges(P)']]){
   const r = await etat(o);
   ok('⑦ menu « ' + n + ' » : le 💾 ne s\'affiche pas', r.visible === false && r.champs === 0, J(r));
 }
 for (const [n, o] of [['ordonnance','sheetOrdonnance(P)'], ['recueil','sheetRecueil(P)'],
                       ['DLU','sheetDLU(P)'], ['bloc-notes','sheetNoteEdit(null,P)']]){
   const r = await etat(o);
   ok('⑧ saisie « ' + n + ' » : le 💾 reste', r.visible === true && r.champs > 0, J(r));
 }

 /* ── Il dit la vérité, et il agit ── */
 const verite = await pg.evaluate(async (P) => {
   closeSheet(true); await new Promise(r => setTimeout(r, 250));
   sheetMedEdit("", null); await new Promise(r => setTimeout(r, 700));
   const b0 = document.querySelector('#sheet .nav-save');
   const avant = { dit: b0 ? b0.textContent.trim() : '', titre: b0 ? (b0.title || '') : '' };
   const c = document.getElementById('me-d');
   if (!c) return { pasDeChamp: true };
   c.value = "MOLECULE-TEMOIN"; c.dispatchEvent(new Event('input', { bubbles:true }));
   await new Promise(r => setTimeout(r, 450));
   const b1 = document.querySelector('#sheet .nav-save');
   return { avant, apres: { dit: b1 ? b1.textContent.trim() : '', titre: b1 ? (b1.title || '') : '',
            agit: !!(b1 && b1.classList.contains('act')) } };
 }, pid);
 ok('⑨ formulaire modifié : le 💾 ne dit plus « tout est enregistré »',
   !!verite.apres && !/✓/.test(verite.apres.dit) && !/Enregistré sur l/i.test(verite.apres.titre), J(verite));
 ok('⑩ et il appelle à l\'action', !!verite.apres && verite.apres.agit === true && /Enregistrer/.test(verite.apres.dit), J(verite));

 /* ── Le bout en bout : toucher le 💾 enregistre pour de bon ── */
 const bout = await pg.evaluate(async (P) => {
   closeSheet(true); await new Promise(r => setTimeout(r, 250));
   const avant = (S.notes || []).length;
   sheetNoteEdit(null, P); await new Promise(r => setTimeout(r, 700));
   const t = document.getElementById('ne-t');
   if (!t) return { pasDeChamp: true };
   t.value = "NOTE-PAR-LE-BADGE"; t.dispatchEvent(new Event('input', { bubbles:true }));
   await new Promise(r => setTimeout(r, 450));
   const b = document.querySelector('#sheet .nav-save');
   if (!b) return { pasDeBadge: true };
   b.click(); await new Promise(r => setTimeout(r, 800));
   return { avant, apres: (S.notes || []).length,
            trouvee: JSON.stringify(S.notes || []).includes("NOTE-PAR-LE-BADGE") };
 }, pid);
 ok('⑪ toucher le 💾 du haut enregistre pour de bon',
   bout.trouvee === true && bout.apres === bout.avant + 1, J(bout));

 /* ⚠️ ON RECONNAÎT LE BOUTON DU BAS, ON NE LE DEVINE PAS. Sans filtre
    sur le libellé, le 💾 de l'écran d'ordonnance aurait repris
    « Produire le document » — un document produit par surprise. */
 const prudence = await pg.evaluate(async (P) => {
   closeSheet(true); await new Promise(r => setTimeout(r, 250));
   sheetOrdoEntete(P); await new Promise(r => setTimeout(r, 700));
   const b = document.querySelector('#sheet .nav-save');
   const prim = [...document.querySelectorAll('#sheet .btn-primary')].map(x => x.textContent.trim().slice(0, 32));
   return { agit: !!(b && b.classList.contains('act')), primaires: prim };
 }, pid);
 ok('⑫ un bouton qui ne dit pas « Enregistrer » n\'est pas repris',
   prudence.agit === false, J(prudence));

 console.log('\n' + (errs.length ? '⚠ erreurs JS : ' + errs.join(' | ') : '✓ aucune erreur JS'));
 if (errs.length) ko.push("erreurs JS");
 console.log(ko.length ? `\n⚠ ${ko.length} contrôle(s) en échec :\n  - ` + ko.join('\n  - ')
                       : '\n✓ tout passe');
 await nav.close(); srv.close(); process.exit(ko.length ? 1 : 0);
})();
