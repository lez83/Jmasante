// LE PASSAGE SUPPLÉMENTAIRE DANS LE DÉROULÉ (v1.27.0)
//
// ⚠️ CONSTATÉ AU CHEVET : « quand j'ai un deuxième passage pour un patient,
//    ce dernier ne s'affiche pas dans le déroulé, mais uniquement sur la
//    carte des patients ». Mesuré avant correction, sur une tournée de
//    trois patients dont un à passage supplémentaire :
//
//      plateau de cartes │ 4 passages — p1, p1#2, p2, p3 │ « 4 à voir »
//      déroulé           │ 3 patients — p1, p2, p3       │ « Patient 2 / 3 »
//
// ⚠️ LA MACHINERIE EXISTAIT DÉJÀ EN ENTIER — `occurrencesTriees`,
//    `visiteDuRang`, `statusOf(p, slot, rang)`, les pastilles « 1ᵉʳ / 2ᵉ
//    passage ». Le déroulé n'y était simplement pas branché. L'épreuve
//    garde donc d'abord UNE ÉGALITÉ : le déroulé et le plateau listent la
//    même chose, dans le même ordre. C'est elle qui empêchera les deux
//    listes de redivergеr.
//
// ⚠️ LE PIÈGE DE CE CHANTIER : tout ce qui lisait « ce patient a-t-il été
//    vu aujourd'hui ? » devait devenir « CE RANG-LÀ a-t-il été fait ? ».
//    Le bouton de validation, les pastilles, la garde de « pas de
//    passage », le drapeau lui-même. Chacun a son contrôle, parce que
//    chacun, laissé au dossier, annonce fait ce qui reste à faire.
//
// ⚠️ ET LE GROS DES DOSSIERS N'A PAS DE PASSAGE SUPPLÉMENTAIRE : un
//    contrôle final vérifie que sans lui, le déroulé est exactement celui
//    d'avant.
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
 await new Promise(r=>srv.listen(8227,r));
 const nav=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
 const pg=await (await nav.newContext({viewport:{width:430,height:950}})).newPage();
 const errs=[]; pg.on('pageerror',e=>errs.push(String(e)));
 await pg.goto('http://localhost:8227/index.html'); await pg.waitForTimeout(2700);

 /* ── Le terrain : une vraie tournée, un dossier à passage supplémentaire.
    ⚠️ `extraSet` REFUSE « all » : le passage supplémentaire est rangé PAR
    TOURNÉE. Une première sonde écrite sur la tournée « all » n'a rien posé
    du tout et laissait croire que la fonction ne marchait pas. */
 const ctx = await pg.evaluate(()=>{
   S.confidentialityAck=true; S.firstRun=false;
   S.noVisit={}; S.drafts={}; S.annul=[]; delete S.seqPos; delete S.seqRappelPlie;
   const TOUR="Cabinet A";
   S.tours = S.tours || []; if (!S.tours.includes(TOUR)) S.tours.push(TOUR);
   activeP().forEach(p => { p.tours=[TOUR]; p.visits=[]; });
   S.curTour=TOUR;
   const p = activeP()[0];
   const slot = (typeof activeSlot==="function") ? activeSlot() : null;
   if (typeof extraSet==="function")
     extraSet(p, TOUR, slotsOn() ? (slot||defaultSlot()) : (typeof defaultSlot==="function"?defaultSlot():"matin"));
   openId=null; render();
   return { pid:p.id, prenom:p.prenom, slot,
            creneaux:(typeof slotsOn==="function")?slotsOn():null,
            occurrences:(typeof occurrencesDe==="function")
              ? occurrencesDe(p, TOUR, slotsOn()?(slot||defaultSlot()):null) : null };
 });
 console.log('     terrain : ' + ctx.prenom + ' a les rangs ' + J(ctx.occurrences)
   + ', créneaux ' + (ctx.creneaux ? 'activés' : 'désactivés'));
 ok('① le passage supplémentaire est bien déclaré',
    Array.isArray(ctx.occurrences) && ctx.occurrences.length === 2, J(ctx.occurrences));

 /* ═══ ② LE DÉROULÉ LISTE LA MÊME CHOSE QUE LE PLATEAU ═══ */
 console.log('═══ LE DÉROULÉ ET LE PLATEAU DISENT LA MÊME CHOSE ═══');
 const listes = await pg.evaluate(()=>{
   const slot = (typeof activeSlot==="function") ? activeSlot() : null;
   const pool = S.curTour==="all" ? activeP() : activeP().filter(x=>inTourSlot(x,S.curTour,slot));
   const plateau = (typeof occurrencesTriees==="function")
     ? occurrencesTriees(sortBySlot(pool, S.curTour, slot), S.curTour, slot).map(i=>i.cle) : null;
   enterSeqMode();
   const deroule = (typeof seqPool!=="undefined" && seqPool.length && seqPool[0] && seqPool[0].p)
     ? seqPool.map(o=>o.cle) : (typeof seqPool!=="undefined" ? seqPool.map(p=>p && p.id) : null);
   return { plateau, deroule };
 });
 await pg.waitForTimeout(700);
 console.log('     plateau : ' + J(listes.plateau));
 console.log('     déroulé : ' + J(listes.deroule));
 /* ⚠️ L'ÉGALITÉ, PAS DEUX COMPTAGES SÉPARÉS : deux listes qui font quatre
    chacune peuvent contenir des choses différentes, ou dans un autre ordre
    — et l'ordre est celui des passages de la tournée. */
 ok('② même liste, même ordre, des deux côtés',
    J(listes.deroule) === J(listes.plateau), J(listes.deroule) + ' ≠ ' + J(listes.plateau));
 ok('② le 2ᵉ passage y figure', (listes.deroule||[]).some(c => String(c).includes('#2')));

 const barre = () => pg.evaluate(()=>{
   const n=document.querySelector('#seq-mode .seq-nav');
   if(!n) return null;
   return { compteur:((n.querySelector('.sq-pos')||{}).innerText||'').replace(/\s+/g,' ').trim(),
            nom:((n.querySelector('.sq-nom')||{}).innerText||'').replace(/\s+/g,' ').trim(),
            badge:((n.querySelector('.sq-nom .px')||{}).textContent||'').trim(),
            valider:((document.getElementById('sq-valid')||{}).textContent||'').trim(),
            pastilles:[...n.querySelectorAll('.sq-prog i')].map(i=>i.className),
            skip:((document.getElementById('sq-skip')||{}).textContent||'').replace(/\s+/g,' ').trim(),
            rappel:(()=>{ const r=document.getElementById('sq-rappel');
              return r ? { titre:(r.querySelector('.sqr-t')||{}).innerText||'',
                           corps:((r.querySelector('.sqr-c')||{}).innerText||'').replace(/\s+/g,' ').trim(),
                           plie:r.classList.contains('plie') } : null; })(),
            idx:(typeof seqIdx!=="undefined")?seqIdx:-1 };
 });
 /* ⚠️ L'ÉPREUVE DOIT TOMBER, PAS PLANTER. Sur le code d'avant, le 2ᵉ rang
    n'existe pas dans le déroulé : `i2` vaut −1, et `seqIdx = -1` faisait
    jeter `renderSeq` au premier contrôle — les trente suivants ne disaient
    alors plus rien. On refuse l'index hors liste, et les contrôles qui en
    dépendaient échouent proprement, un par un. */
 const aller = async i => {
   if (!(i >= 0)) return false;
   await pg.evaluate(async n=>{ if (!seqPool[n]) return; seqIdx=n; renderSeq();
     await new Promise(r=>setTimeout(r,250)); }, i);
   return true;
 };

 /* ═══ ③ LA BARRE DIT OÙ L'ON EST ═══ */
 console.log('═══ CE QUE LA BARRE ANNONCE ═══');
 await aller(0);
 const b0 = await barre();
 console.log('     rang 1 : ' + J(b0.compteur) + ' · ' + J(b0.nom));
 ok('③ le compteur parle en passages, pas en patients',
    /^Passage 1 \/ 4$/.test(b0.compteur), J(b0.compteur));
 ok('③ le 1ᵉʳ passage est marqué comme tel', b0.badge === '1ᵉʳ passage', J(b0.badge));
 const i2 = (listes.deroule||[]).findIndex(c=>String(c).includes('#2'));
 if (i2 < 0) console.log('     ⚠ aucun 2ᵉ rang dans le déroulé : les contrôles qui en dépendent tombent');
 await aller(i2);
 const b2 = (i2 >= 0) ? await barre() : { compteur:'', nom:'', badge:'', valider:'',
   pastilles:[], skip:'', rappel:null, idx:-1 };
 console.log('     rang 2 : ' + J(b2.compteur) + ' · ' + J(b2.nom));
 ok('③ le 2ᵉ passage porte sa pastille', b2.badge === '2ᵉ passage', J(b2.badge));
 ok('③ et c\'est bien le même patient', b2.nom.indexOf(b0.nom.split(' ')[0]) === 0, J(b2.nom));
 ok('③ quatre pastilles de progression', b0.pastilles.length === 4, b0.pastilles.length);
 ok('③ les deux pastilles du même dossier sont jumelées',
    b0.pastilles.filter(c=>/\bduo\b/.test(c)).length === 2, J(b0.pastilles));
 ok('③ « pas de passage » nomme le rang concerné',
    /2ᵉ passage/.test(b2.skip), J(b2.skip));

 /* ═══ ④ VALIDER LE 1ᵉʳ NE REMPLIT PAS LE 2ᵉ ═══ */
 console.log('═══ VALIDER LE PREMIER PASSAGE ═══');
 const valider = async () => {
   await pg.evaluate(async()=>{
     const f=document.querySelector('#seq-form [data-form]');
     const t=f.querySelector('[data-note]'); t.value="passage du matin";
     t.dispatchEvent(new Event('input',{bubbles:true}));
     await new Promise(r=>setTimeout(r,120));
     f.querySelector('[data-save]').click();
     await new Promise(r=>setTimeout(r,450));
   });
   await pg.waitForTimeout(350);
 };
 await aller(0); await valider();
 const apres1 = await pg.evaluate(id=>({
   nbVisites:(getP(id).visits||[]).filter(v=>v.date===workDate()).length }), ctx.pid);
 ok('④ un passage a bien été créé', apres1.nbVisites === 1, apres1.nbVisites);
 await aller(0);
 const b0b = await barre();
 ok('④ le 1ᵉʳ rang s\'annonce enregistré', /enregistré/i.test(b0b.valider), J(b0b.valider));
 await aller(i2);
 const b2b = await barre();
 /* ⚠️ LE CONTRÔLE QUI COMPTE LE PLUS DE CETTE SECTION. Lu sur le dossier,
    le bouton du 2ᵉ rang disait « Passage enregistré — modifier » dès le
    1ᵉʳ validé : il invitait à modifier le passage du matin en croyant
    saisir celui du soir. */
 ok('④ le 2ᵉ rang reste à valider', /Valider le passage/.test(b2b.valider), J(b2b.valider));
 ok('④ et sa pastille n\'est pas « vu »',
    !/\bvu\b/.test(b2b.pastilles[i2]), J(b2b.pastilles));
 ok('④ celle du 1ᵉʳ l\'est', /\bvu\b/.test(b2b.pastilles[0]), J(b2b.pastilles));

 /* ═══ ⑤ LE RAPPEL DU PASSAGE PRÉCÉDENT ═══ */
 console.log('═══ LE RAPPEL DU PASSAGE PRÉCÉDENT ═══');
 console.log('     ' + J(b2b.rappel));
 ok('⑤ le rappel s\'affiche sur le 2ᵉ passage', !!b2b.rappel);
 ok('⑤ déplié par défaut', !!b2b.rappel && b2b.rappel.plie === false);
 ok('⑤ il porte l\'heure du passage précédent',
    !!b2b.rappel && /\d{1,2}[:h]\d{2}/.test(b2b.rappel.titre), J(b2b.rappel && b2b.rappel.titre));
 ok('⑤ et ce qui y a été noté',
    !!b2b.rappel && /passage du matin/.test(b2b.rappel.corps), J(b2b.rappel && b2b.rappel.corps));
 await aller(0);
 const b0c = await barre();
 ok('⑤ aucun rappel sur le 1ᵉʳ passage', b0c.rappel === null, J(b0c.rappel));
 /* Il se replie, et le pli est retenu d'un passage à l'autre. */
 await aller(i2);
 /* ⚠️ `pg.click` ATTEND TRENTE SECONDES UN ÉLÉMENT ABSENT, puis jette :
    sur le code d'avant le rappel n'existe pas, et l'épreuve mourait là.
    On regarde s'il est là, et sinon on fait tomber les deux contrôles. */
 const rappelLà = await pg.evaluate(()=>!!document.getElementById('sq-rappel-t'));
 if (rappelLà){
   await pg.click('#sq-rappel-t'); await pg.waitForTimeout(300);
   const plie = await barre();
   ok('⑤ il se replie', !!plie.rappel && plie.rappel.plie === true);
   await aller(0); await aller(i2);
   const replie = await barre();
   ok('⑤ et le pli est retenu', !!replie.rappel && replie.rappel.plie === true);
   await pg.click('#sq-rappel-t'); await pg.waitForTimeout(300);
 } else {
   ok('⑤ il se replie', false, 'aucun rappel à replier');
   ok('⑤ et le pli est retenu', false, 'aucun rappel à replier');
 }

 /* ═══ ⑥ VALIDER LE 2ᵉ CRÉE UN SECOND PASSAGE ═══ */
 console.log('═══ VALIDER LE SECOND PASSAGE ═══');
 await aller(i2);
 /* ⚠️ PREMIÈRE ÉCRITURE DE CETTE SECTION : ELLE PASSAIT SUR LE CODE
    D'AVANT, donc elle ne gardait rien. Avec `i2` à −1, la navigation était
    sans effet, le second passage se saisissait depuis l'entrée du 1ᵉʳ — et
    il se créait quand même, parce que le CÔTÉ DONNÉES acceptait déjà deux
    passages. Ce qui manquait n'était pas la création, c'était LE CHEMIN :
    pouvoir le faire depuis le déroulé. On vérifie donc d'abord qu'on est
    bien sur le rang 2 avant de valider. */
 const surRang2 = await pg.evaluate(()=>{
   const o=(typeof seqPool!=="undefined")?seqPool[seqIdx]:null;
   return !!(o && o.p && (o.rang||1) === 2); });
 ok('⑥ on peut se placer sur le 2ᵉ passage dans le déroulé', surRang2 === true,
    'le déroulé n\'a pas de 2ᵉ rang');
 if (surRang2) await pg.evaluate(async()=>{
   const f=document.querySelector('#seq-form [data-form]');
   const t=f.querySelector('[data-note]'); t.value="passage du soir";
   t.dispatchEvent(new Event('input',{bubbles:true}));
   await new Promise(r=>setTimeout(r,120));
   f.querySelector('[data-save]').click();
   await new Promise(r=>setTimeout(r,600));
 });
 await pg.waitForTimeout(500);
 const apres2 = await pg.evaluate(id=>{
   const v=(getP(id).visits||[]).filter(x=>x.date===workDate())
     .sort((a,b)=>String(a.at||"").localeCompare(String(b.at||"")));
   return { n:v.length, notes:v.map(x=>x.note) }; }, ctx.pid);
 console.log('     passages du jour : ' + J(apres2.notes));
 /* ⚠️ DEUX PASSAGES, PAS UN MODIFIÉ. C'est tout l'objet de la demande :
    pouvoir saisir le second depuis le déroulé au lieu de passer par la
    carte. Un seul passage ici voudrait dire que le soir a écrasé le matin. */
 ok('⑥ deux passages distincts existent', apres2.n === 2, apres2.n);
 ok('⑥ celui du matin est intact', apres2.notes[0] === "passage du matin", J(apres2.notes));
 ok('⑥ celui du soir a été ajouté', apres2.notes[1] === "passage du soir", J(apres2.notes));
 await aller(i2);
 const b2c = await barre();
 ok('⑥ le 2ᵉ rang s\'annonce enregistré à son tour',
    /enregistré/i.test(b2c.valider), J(b2c.valider));

 /* ═══ ⑦ « PAS DE PASSAGE » PORTE SUR LE RANG ═══ */
 console.log('═══ « PAS DE PASSAGE » NE VAUT QUE POUR SON RANG ═══');
 const flag = await pg.evaluate(async id=>{
   const p=getP(id); p.visits=[]; S.noVisit={}; S.annul=[];
   const slot=(typeof activeSlot==="function")?activeSlot():null;
   exitSeqMode(); enterSeqMode();
   await new Promise(r=>setTimeout(r,400));
   const i=seqPool.findIndex(o=>(o.rang||1)>1);
   if (i < 0) return { cles:[], st1:"(pas de 2ᵉ rang)", st2:"(pas de 2ᵉ rang)" };
   seqIdx=i; renderSeq();
   await new Promise(r=>setTimeout(r,250));
   document.getElementById('sq-skip').click();
   await new Promise(r=>setTimeout(r,500));
   return { cles:Object.keys(S.noVisit||{}),
            st1:statusOf(p, slot, 1), st2:statusOf(p, slot, 2) };
 }, ctx.pid);
 console.log('     drapeaux posés : ' + J(flag.cles)
   + ' · statuts : rang 1 = ' + flag.st1 + ', rang 2 = ' + flag.st2);
 ok('⑦ le drapeau est rangé sous le rang, pas sous le dossier',
    flag.cles.length === 1 && String(flag.cles[0]).includes('#2'), J(flag.cles));
 ok('⑦ le 2ᵉ rang passe en « pas de passage »', flag.st2 === "novisit", flag.st2);
 ok('⑦ le 1ᵉʳ reste à voir', flag.st1 === "todo" || flag.st1 === "alert", flag.st1);
 /* Et il s'annule sans emporter l'autre. */
 const annul = await pg.evaluate(async id=>{
   const l=(typeof annulListe==="function")?annulListe():[];
   if (!l.length) return { ok:false, why:"aucune action à défaire" };
   const r=(typeof annulDefaire==="function")?annulDefaire(l[0].id):{ok:false};
   const slot=(typeof activeSlot==="function")?activeSlot():null;
   await new Promise(r=>setTimeout(r,200));
   return { ok:!!(r&&r.ok), cles:Object.keys(S.noVisit||{}),
            st2:statusOf(getP(id), slot, 2) };
 }, ctx.pid);
 ok('⑦ et il s\'annule', annul.ok === true && annul.cles.length === 0, J(annul));
 ok('⑦ le rang redevient à voir', annul.st2 === "todo" || annul.st2 === "alert", annul.st2);

 /* ═══ ⑧ ON REVIENT SUR LE BON RANG ═══ */
 console.log('═══ LA REPRISE REVIENT SUR LE BON RANG ═══');
 const reprise = await pg.evaluate(async()=>{
   const i=seqPool.findIndex(o=>(o.rang||1)>1);
   if (i < 0) return { memo:null, revenuSur:"(pas de 2ᵉ rang)", attendu:"#2" };
   seqIdx=i; renderSeq(); await new Promise(r=>setTimeout(r,200));
   const memo = S.seqPos ? { cle:S.seqPos.cle, rang:S.seqPos.rang } : null;
   exitSeqMode(); await new Promise(r=>setTimeout(r,250));
   enterSeqMode(); await new Promise(r=>setTimeout(r,500));
   return { memo, revenuSur:seqPool[seqIdx] ? seqPool[seqIdx].cle : null, attendu:seqPool[i].cle };
 });
 console.log('     mémorisé : ' + J(reprise.memo) + ' → revenu sur ' + J(reprise.revenuSur));
 ok('⑧ la position est mémorisée par occurrence',
    !!reprise.memo && String(reprise.memo.cle).includes('#2'), J(reprise.memo));
 ok('⑧ et on revient sur ce rang-là, pas sur le 1ᵉʳ',
    reprise.revenuSur === reprise.attendu, J(reprise.revenuSur) + ' au lieu de ' + J(reprise.attendu));

 /* ═══ ⑨ SANS PASSAGE SUPPLÉMENTAIRE, RIEN NE CHANGE ═══ */
 console.log('═══ LE GROS DES DOSSIERS N\'A PAS DE RANG 2 ═══');
 const sans = await pg.evaluate(async id=>{
   if (typeof extraSet==="function") extraSet(getP(id), S.curTour, null);
   activeP().forEach(p=>{p.visits=[];}); S.noVisit={}; delete S.seqPos;
   exitSeqMode(); await new Promise(r=>setTimeout(r,200));
   enterSeqMode(); await new Promise(r=>setTimeout(r,500));
   const n=document.querySelector('#seq-mode .seq-nav');
   return { taille:seqPool.length,
            /* Sur le code d'avant, `seqPool` contient des patients : pas de
               `rang`, donc on lit 1 partout — ce qui est l'ancien sens. */
            rangs:seqPool.map(o=>(o && o.rang) || 1),
            badges:n?n.querySelectorAll('.sq-nom .px').length:-1,
            pastilles:n?n.querySelectorAll('.sq-prog i').length:-1,
            compteur:((n.querySelector('.sq-pos')||{}).innerText||'').replace(/\s+/g,' ').trim(),
            rappel:!!document.getElementById('sq-rappel'),
            skip:((document.getElementById('sq-skip')||{}).textContent||'').replace(/\s+/g,' ').trim() };
 }, ctx.pid);
 console.log('     ' + J(sans));
 ok('⑨ un passage par patient', sans.taille === 3 && sans.rangs.every(r=>r===1), J(sans.rangs));
 ok('⑨ aucune pastille de rang', sans.badges === 0, sans.badges);
 ok('⑨ aucun rappel', sans.rappel === false);
 ok('⑨ le libellé reste celui d\'avant',
    /Pas de passage prévu aujourd'hui — patient suivant/.test(sans.skip), J(sans.skip));
 ok('⑨ et le compteur est juste', /^Passage 1 \/ 3$/.test(sans.compteur), J(sans.compteur));

 console.log('\n' + (errs.length ? '⚠ erreurs JS : ' + errs.join(' | ') : '✓ aucune erreur JS'));
 if (errs.length) ko.push("erreurs JS");
 console.log(ko.length ? `\n⚠ ${ko.length} contrôle(s) en échec :\n  - ` + ko.join('\n  - ')
                       : '\n✓ tout passe');
 await nav.close(); srv.close(); process.exit(ko.length ? 1 : 0);
})();
