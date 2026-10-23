// REPRENDRE, AVERTIR, ANNULER — ET NE PLUS PERDRE UNE FICHE EN LA QUITTANT.
//
// ⚠️ ÉCRITE AVANT LES CORRECTIONS, et vérifiée en rouge. Les quatre défauts
//    qu'elle garde, tous mesurés sur le code d'avant :
//
//    ① LE DÉROULÉ NE REPRENAIT PAS SA PLACE. Arrêté sur le 4ᵉ patient, on
//       revenait sur le 1ᵉʳ ; les trois premiers validés, arrêté sur le 5ᵉ,
//       on revenait sur le 4ᵉ. Le code l'assumait — « calculé, pas
//       mémorisé ». C'est ce qui a fait noter « pas de passage » chez un
//       patient déjà vu : on se croit sur le suivant.
//
//    ② « PAS DE PASSAGE » NE DISAIT RIEN sur un patient déjà passé, et son
//       message était FAUX : « non inclus dans la relève » alors que le
//       passage existant, lui, y figure.
//
//    ③ RIEN N'ÉTAIT ANNULABLE au-delà de six secondes, et seulement un
//       passage neuf. Ni une correction, ni un « pas de passage ».
//
//    ④ QUITTER UNE FICHE PATIENT PAR LA FLÈCHE EFFAÇAIT TOUT, sans un mot.
//       C'est ce qui faisait croire que l'inscription d'un médecin au
//       cabinet ne marchait pas : elle n'avait jamais eu lieu.
//
// ⚠️ ET UN CINQUIÈME, TROUVÉ EN MESURANT : avec deux cabinets, le médecin
//    partait dans le cabinet OUVERT, pas dans celui du patient.
const { chromium } = require('playwright');
const http=require('http'),fs=require('fs'),path=require('path');
const ROOT=path.join(__dirname,'..','..','www');
const MIME={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.svg':'image/svg+xml'};
const srv=http.createServer((q,r)=>{let u=decodeURIComponent(q.url.split('?')[0]);if(u==='/')u='/index.html';
 const f=path.join(ROOT,u); if(!f.startsWith(ROOT)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);r.end('404');return;}
 r.writeHead(200,{'Content-Type':MIME[path.extname(f)]||'application/octet-stream'});r.end(fs.readFileSync(f));});
let ko=[]; const ok=(l,c,x)=>{console.log(`  ${c?'✓':'⚠'} ${l}${x!==undefined&&!c?'  → '+x:''}`); if(!c)ko.push(l);};

(async()=>{
 await new Promise(r=>srv.listen(8223,r));
 const nav=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
 const pg=await (await nav.newContext({viewport:{width:430,height:950}})).newPage();
 const errs=[]; pg.on('pageerror',e=>errs.push(String(e)));
 await pg.goto('http://localhost:8223/index.html'); await pg.waitForTimeout(2700);

 /* Une tournée de cinq, personne de vu. */
 const prep = () => pg.evaluate(() => {
   S.confidentialityAck=true; S.firstRun=false;
   const t = S.tours[0]; S.curTour = t; S.slotsTours = {};
   while (S.patients.length < 5){
     const n = S.patients.length + 1;
     S.patients.push({ id:"px"+n, nom:"Demo-Patient"+n, prenom:"P"+n, dob:"1950-01-01",
       genre:"F", contacts:{}, tours:[t], plan:["Toilette"], archived:null,
       bilans:[], docs:[], tags:[], infos:[], visits:[] });
   }
   S.patients.forEach(p => { if(!(p.tours||[]).includes(t)) p.tours=[t]; p.visits=[]; });
   S.annul = []; S.noVisit = {}; delete S.seqPos;
   openId=null; render();
 });
 await prep();
 const ou = () => pg.evaluate(() => ({ idx:seqIdx, nom:(seqPool[seqIdx]||{}).nom || "?" }));

 /* ═══ ① LE DÉROULÉ REPREND SA PLACE ═══ */
 console.log('═══ LE DÉROULÉ REPREND OÙ ON L\'A LAISSÉ ═══');
 await pg.evaluate(() => enterSeqMode()); await pg.waitForTimeout(400);
 await pg.evaluate(() => { seqIdx = 3; renderSeq(); }); await pg.waitForTimeout(300);
 const a1 = await ou();
 await pg.evaluate(() => exitSeqMode()); await pg.waitForTimeout(250);
 await pg.evaluate(() => enterSeqMode()); await pg.waitForTimeout(400);
 const a2 = await ou();
 console.log(`     arrêté sur ${a1.nom} · au retour ${a2.nom}`);
 ok('on revient sur le patient où l\'on s\'était arrêté', a2.idx === a1.idx, a2.idx + " au lieu de " + a1.idx);
 ok('le ruban de reprise s\'affiche',
    await pg.evaluate(() => !!document.getElementById('sq-reprise')));
 ok('… et il dit combien de patients non vus restent derrière',
    await pg.evaluate(() => { const e=document.getElementById('sq-reprise');
      return !!e && /non vus? avant lui/.test(e.textContent); }),
    await pg.evaluate(() => (document.getElementById('sq-reprise')||{}).textContent || "(pas de ruban)"));
 await pg.evaluate(() => { const b = document.getElementById('sq-r-go'); if (b) b.click(); });
 await pg.waitForTimeout(300);
 ok('« VOIR » emmène au premier patient non vu', (await ou()).idx === 0, (await ou()).idx);
 ok('… et le ruban disparaît une fois servi',
    await pg.evaluate(() => !document.getElementById('sq-reprise')));

 /* La position ne traverse ni les jours ni les créneaux. */
 await pg.evaluate(() => { seqIdx = 2; renderSeq(); exitSeqMode();
   if (S.seqPos) S.seqPos.date = "2020-01-01"; });
 await pg.evaluate(() => enterSeqMode()); await pg.waitForTimeout(400);
 ok('une position de la veille ne reprend pas', (await ou()).idx === 0, (await ou()).idx);
 await pg.evaluate(() => exitSeqMode());

 /* ═══ ② LA GARDE AVANT « PAS DE PASSAGE » ═══ */
 console.log('═══ LE « PAS DE PASSAGE » QUI SE CONTREDIT ═══');
 await prep();
 await pg.evaluate(() => { const p = S.patients[0];
   p.visits = [{ uid:"v-matin", date:workDate(), at:"08:42", soins:["Toilette"],
                 consts:{ ta:"14/8", puls:"72" }, note:"RAS" }];
   /* Une saisie gardée COMPLÈTE : `_restoreDraft` lit `consts` sans
      filet, et un brouillon tronqué ferait tomber l'épreuve sur un
      défaut qui n'est pas le sien. */
   S.drafts = S.drafts || {}; S.drafts[p.id] = { pid:p.id, note:"saisie en cours",
     soins:[], consts:{}, soinNotes:{}, soinNotesRel:{}, soinNotesPlaie:{}, taS:"", taD:"" };
   enterSeqMode(); seqIdx = 0; renderSeq(); });
 await pg.waitForTimeout(400);
 /* On touche « pas de passage » : une question doit se poser. */
 await pg.evaluate(() => { const b = document.getElementById('sq-skip'); if (b) b.click(); });
 await pg.waitForTimeout(500);
 const dlg = await pg.evaluate(() => {
   const d = document.querySelector('.dlg-veil, .dlg');
   return d ? d.textContent.replace(/\s+/g," ").trim() : "";
 });
 ok('une question est posée avant d\'écrire', /déjà passé/i.test(dlg), dlg.slice(0,80) || "(aucune)");
 ok('… et elle rappelle l\'heure du passage existant', /08:42/.test(dlg), dlg.slice(0,120));
 ok('… et elle propose de corriger ce passage', /Corriger le passage/i.test(dlg), dlg.slice(0,140));
 /* On annule la question : rien ne doit être écrit. */
 await pg.evaluate(() => {
   const b = [...document.querySelectorAll('.dlg-veil button, .dlg button')]
     .find(x => /annuler|retour|fermer|✕/i.test(x.textContent));
   if (b) b.click(); else { const v = document.querySelector('.dlg-veil'); if (v) v.click(); }
 });
 await pg.waitForTimeout(400);
 ok('« Annuler » n\'écrit rien',
    await pg.evaluate(() => !(S.noVisit||{})[S.patients[0].id]),
    await pg.evaluate(() => JSON.stringify(S.noVisit)));

 /* ═══ ③ ANNULER — TROIS ACTIONS, LA JOURNÉE ═══ */
 console.log('═══ LES DERNIÈRES ACTIONS ═══');
 await pg.evaluate(() => {
   const p = S.patients[0];
   /* On note le « pas de passage » sans passer par la question. */
   const d0 = (S.drafts||{})[p.id];
   const avant = { noVisit:null, draft: d0 ? JSON.parse(JSON.stringify(d0)) : null };
   S.noVisit[p.id] = workDate();
   delete S.drafts[p.id];
   if (typeof annulNoter === "function") annulNoter({ type:"novisit", pid:p.id, avant, resume:"alors qu'un passage de 08:42 existe" });
   save(true); render();
 });
 await pg.waitForTimeout(300);
 ok('l\'action est inscrite au journal du jour',
    await pg.evaluate(() => typeof annulListe === "function" && annulListe().length === 1));
 ok('le ruban apparaît sur le moniteur',
    await pg.evaluate(() => !!document.querySelector('#annulbar .annul-rub')));
 ok('… et nomme ce qui a été fait',
    await pg.evaluate(() => { const e=document.querySelector('#annulbar');
      return !!e && /Pas de passage/i.test(e.textContent); }),
    await pg.evaluate(() => (document.querySelector('#annulbar')||{}).textContent || "(pas de barre)"));
 /* L'annulation remet TOUT en place : le drapeau et la saisie gardée. */
 const res = await pg.evaluate(() => {
   if (typeof annulListe !== "function" || !annulListe().length) return { ok:false, absent:true };
   const id = annulListe()[0].id;
   const r = annulDefaire(id);
   const p = S.patients[0];
   return { ok:r.ok, drapeau:(S.noVisit||{})[p.id] || null,
            draft:!!(S.drafts||{})[p.id], reste:annulListe().length,
            passage:(p.visits||[]).length };
 });
 ok('annuler retire la marque « pas de passage »', res.ok && res.drapeau === null, JSON.stringify(res));
 ok('… rend la saisie gardée que le geste avait effacée', res.draft === true);
 ok('… ne touche pas au passage de 08:42', res.passage === 1, res.passage);
 ok('… et sort de la liste', res.reste === 0, res.reste);

 /* Les trois types d'écriture entrent au journal. */
 await prep();
 const trois = await pg.evaluate(() => {
   if (typeof annulNoter !== "function") return { n:-1, types:[] };
   const p = S.patients[0];
   const v = { uid:"v1", date:workDate(), at:"08:00", soins:["Toilette"], consts:{ta:"13/8"}, note:"" };
   p.visits = [v];
   annulNoter({ type:"ajout",  pid:p.id, uid:"v1", resume:_resumePassage(v) });
   annulNoter({ type:"modif",  pid:p.id, uid:"v1", avant:JSON.parse(JSON.stringify(v)), resume:_resumePassage(v) });
   annulNoter({ type:"novisit",pid:p.id, avant:{ noVisit:null, draft:null }, resume:"" });
   annulNoter({ type:"ajout",  pid:p.id, uid:"v2", resume:"" });   // la 4ᵉ chasse la 1ʳᵉ
   return { n:annulListe().length, types:annulListe().map(a=>a.type) };
 });
 ok('le journal garde au plus trois actions', trois.n === 3, trois.n);
 ok('… la plus récente en tête', trois.types[0] === "ajout" && trois.types[2] === "modif",
    trois.types.join(","));
 /* Les actions d'hier s'effacent d'elles-mêmes. */
 ok('une action d\'hier disparaît de la liste',
    await pg.evaluate(() => { if (typeof annulListe !== "function") return false;
      (S.annul||[]).forEach(a => a.date = "2020-01-01"); return annulListe().length === 0; }));

 /* L'écran existe et mène à l'annulation. */
 await pg.evaluate(() => { const p=S.patients[0];
   p.visits=[{uid:"v9",date:workDate(),at:"09:10",soins:["Pilulier"],consts:{},note:""}];
   S.annul=[]; if (typeof annulNoter === "function") annulNoter({type:"ajout",pid:p.id,uid:"v9",resume:"09:10 — Pilulier"});
   if (typeof sheetAnnulations === "function") sheetAnnulations(); });
 await pg.waitForTimeout(400);
 ok('l\'écran « Dernières actions » s\'ouvre',
    await pg.evaluate(() => !!document.querySelector('#sheet [data-anun]')));
 ok('… et affiche ce que l\'action a écrit',
    await pg.evaluate(() => /09:10/.test(document.querySelector('#sheet').textContent)));
 ok('il est atteignable depuis les réglages',
    await pg.evaluate(() => { S.menuMode="list"; sheetTours();
      return document.querySelectorAll('#sheet [data-sec="annul"]').length === 1; }));

 /* ═══ ④ LA FICHE NE SE REFERME PLUS SUR UNE SAISIE PERDUE ═══ */
 console.log('═══ QUITTER UNE FICHE SANS ENREGISTRER ═══');
 await prep();
 await pg.evaluate(() => sheetPatient(getP(S.patients[0].id), "id"));
 await pg.waitForTimeout(500);
 await pg.evaluate(() => { for (const b of document.querySelectorAll('#sheet [data-tab]')){
   b.click(); if (document.querySelector('[data-lc="med"]')?.offsetParent) break; } });
 await pg.waitForTimeout(350);
 await pg.evaluate(() => document.querySelector('[data-lc="med"] [data-lcadd]').click());
 await pg.waitForTimeout(250);
 await pg.evaluate(() => { const l=[...document.querySelectorAll('[data-lc="med"] [data-lcnom]')].pop();
   l.value="Dr ESSAI"; l.dispatchEvent(new Event('input',{bubbles:true}));
   l.dispatchEvent(new Event('change',{bubbles:true})); });
 await pg.waitForTimeout(250);
 await pg.evaluate(() => { const b=document.getElementById('nav-back'); if (b) b.click(); });
 await pg.waitForTimeout(500);
 const q = await pg.evaluate(() => {
   const d = document.querySelector('.dlg-veil, .dlg');
   return { pose: d ? d.textContent.replace(/\s+/g," ").trim() : "",
            feuilleOuverte: !!document.querySelector('#veil.on') };
 });
 ok('la fiche ne se referme pas en silence', /non enregistr/i.test(q.pose), q.pose.slice(0,80) || "(rien)");
 ok('… et elle propose d\'enregistrer', /Enregistrer et quitter/i.test(q.pose), q.pose.slice(0,110));
 ok('… et de jeter en le disant', /sans enregistrer/i.test(q.pose), q.pose.slice(0,110));
 ok('la feuille reste ouverte tant qu\'on n\'a pas répondu', q.feuilleOuverte === true);

 /* ═══ ⑤ LE MÉDECIN VA DANS LE CABINET DU PATIENT ═══ */
 /* ⚠️ MESURÉ DE BOUT EN BOUT, pas en relisant le code : deux cabinets, la
    tournée du patient rattachée au PREMIER, le SECOND ouvert à l'écran.
    Sur le code d'avant, le médecin partait dans le second. */
 console.log('═══ LE CABINET QUI REÇOIT LE MÉDECIN ═══');
 await prep();
 const pid = await pg.evaluate(() => {
   cabinets();                                   // force la création de la liste
   const t = S.curTour;
   S.cabinets = [{ id:"cabA", nom:"Cabinet A", contacts:[], tours:[t] },
                 { id:"cabB", nom:"Cabinet B", contacts:[], tours:[] }];
   S.cabinetActif = "cabB";                      // c'est B qui est ouvert
   return S.patients[0].id;
 });
 ok('le patient appartient bien au cabinet A',
    await pg.evaluate(id => (cabinetDuPatient(getP(id))||{}).nom === "Cabinet A", pid));
 ok('… et c\'est pourtant B qui est ouvert',
    await pg.evaluate(() => cabinet().nom === "Cabinet B"));
 await pg.evaluate(id => sheetPatient(getP(id), "id"), pid);
 await pg.waitForTimeout(500);
 await pg.evaluate(() => { for (const b of document.querySelectorAll('#sheet [data-tab]')){
   b.click(); if (document.querySelector('[data-lc="med"]')?.offsetParent) break; } });
 await pg.waitForTimeout(350);
 await pg.evaluate(() => document.querySelector('[data-lc="med"] [data-lcadd]').click());
 await pg.waitForTimeout(250);
 await pg.evaluate(() => { const l=[...document.querySelectorAll('[data-lc="med"] [data-lcnom]')].pop();
   l.value="Dr CABINET Juste"; l.dispatchEvent(new Event('input',{bubbles:true}));
   l.dispatchEvent(new Event('change',{bubbles:true})); });
 await pg.waitForTimeout(250);
 await pg.evaluate(() => { const b=[...document.querySelectorAll('[data-lc="med"] [data-lcvers]')].pop(); if (b) b.click(); });
 await pg.waitForTimeout(300);
 await pg.evaluate(() => { const b=document.getElementById('f-save'); if (b) b.click(); });
 await pg.waitForTimeout(900);
 const ou2 = await pg.evaluate(() => (S.cabinets||[]).map(c => ({
   nom:c.nom, n:(c.contacts||[]).filter(x => /CABINET Juste/.test(x.nom||"")).length })));
 console.log('     ' + ou2.map(c => `${c.nom} : ${c.n}`).join(' · '));
 ok('le médecin atterrit dans le cabinet DU PATIENT',
    (ou2.find(c=>c.nom==="Cabinet A")||{}).n === 1, JSON.stringify(ou2));
 ok('… et pas dans celui qui était ouvert',
    (ou2.find(c=>c.nom==="Cabinet B")||{}).n === 0, JSON.stringify(ou2));
 ok('la fiche garde le lien vers l\'annuaire',
    await pg.evaluate(id => (getP(id).medecins||[]).some(m => m.cabRef), pid));

 console.log('\n' + (errs.length ? '⚠ erreurs JS : ' + errs.join(' | ') : '✓ aucune erreur JS'));
 if (errs.length) ko.push("erreurs JS");
 console.log(ko.length ? `\n⚠ ${ko.length} contrôle(s) en échec :\n  - ` + ko.join('\n  - ')
                       : '\n✓ tout passe');
 await nav.close(); srv.close(); process.exit(ko.length ? 1 : 0);
})();
