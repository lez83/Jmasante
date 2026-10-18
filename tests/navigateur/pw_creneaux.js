// Le statut par créneau, et le passage supplémentaire.
//
// ⚠️ CETTE ÉPREUVE A ÉTÉ ÉCRITE AVANT LA CORRECTION, et vérifiée en rouge
//    sur la v1.14.0 : « statut en soir = done » alors qu'aucun passage du
//    soir n'existe. Une épreuve qui ne tombe pas sur le défaut qu'elle
//    garde ne garde rien.
//
// ⚠️ CHAQUE ATTENTE EST POSÉE SUR UNE SITUATION DÉCRITE EN FRANÇAIS, pas
//    sur ce que rend le code. « Un patient du matin et du soir, vu le
//    matin, est à voir le soir » se vérifie au chevet, pas au débogueur.
const { chromium } = require('playwright');
const http=require('http'),fs=require('fs'),path=require('path');
const ROOT='/home/claude/jmsante/www';
const MIME={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.svg':'image/svg+xml'};
const srv=http.createServer((q,r)=>{let u=decodeURIComponent(q.url.split('?')[0]);if(u==='/')u='/index.html';
 const f=path.join(ROOT,u); if(!f.startsWith(ROOT)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);r.end('404');return;}
 r.writeHead(200,{'Content-Type':MIME[path.extname(f)]||'application/octet-stream'});r.end(fs.readFileSync(f));});
let ko=[]; const ok=(l,c,x)=>{console.log(`  ${c?'✓':'⚠'} ${l}${x!==undefined&&!c?'  → '+x:''}`); if(!c)ko.push(l);};

(async()=>{
 await new Promise(r=>srv.listen(8182,r));
 const nav=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
 const pg=await (await nav.newContext({viewport:{width:430,height:950}})).newPage();
 const errs=[]; pg.on('pageerror',e=>errs.push(String(e)));
 await pg.goto('http://localhost:8182/index.html'); await pg.waitForTimeout(2600);

 /* ⚠️ `S.firstRun=false` AVANT tout : sinon render() s'arrête sur l'écran
    de bienvenue et les contrôles passent au vert sur un board vide. */
 const prep = () => pg.evaluate(() => {
   S.confidentialityAck = true; S.firstRun = false;
   const t = (S.tours && S.tours[0]) || "A"; S.curTour = t;
   const p = S.patients.find(x => (x.tours||[]).includes(t)) || S.patients[0];
   if (!(p.tours||[]).includes(t)) p.tours = [t];
   S.slotsTours = S.slotsTours || {}; S.slotsTours[t] = true;
   S.slotMembers = S.slotMembers || {}; S.slotMembers[t] = S.slotMembers[t] || {};
   S.slotMembers[t].matin = [p.id];
   S.slotMembers[t].soir  = [p.id];
   S.extraPass = {};                       // on part sans passage supplémentaire
   p.visits = [];
   return { tour:t, pid:p.id, nom:p.nom };
 });
 const ctx = await prep();

 console.log('═══ LE STATUT SUIT LE CRÉNEAU ═══');
 /* Situation : un seul passage, ce matin. Le soir n'a pas eu lieu. */
 const s1 = await pg.evaluate(id => {
   const p = getP(id);
   p.visits = [{ uid:"e1", date:workDate(), at:"08:10", slot:"matin", soins:["Toilette"], consts:{}, note:"" }];
   _viewSlot = "matin"; const m = statusOf(p, "matin");
   _viewSlot = "soir";  const s = statusOf(p, "soir");
   return { matin:m, soir:s };
 }, ctx.pid);
 ok('vu le matin → « vu » en matin',  s1.matin === "done", s1.matin);
 ok('vu le matin → « à voir » en soir', s1.soir === "todo", s1.soir);

 /* Et l'écran du soir doit le compter à voir, pas vu. */
 const c1 = await pg.evaluate(() => { _viewSlot = "soir"; render();
   const n = {}; document.querySelectorAll('#synth .spill').forEach(b =>
     n[b.querySelector('.l').textContent.trim()] = b.querySelector('.n').textContent.trim());
   return n; });
 ok('compteur du soir : 1 à voir', c1["À voir"] === "1", JSON.stringify(c1));
 ok('compteur du soir : 0 vu',     c1["Vus"]    === "0", JSON.stringify(c1));

 /* Le soir fait à son tour : les deux créneaux sont vus. */
 const s2 = await pg.evaluate(id => {
   const p = getP(id);
   p.visits.push({ uid:"e2", date:workDate(), at:"18:40", slot:"soir", soins:["Pilulier"], consts:{}, note:"" });
   return { matin:statusOf(p,"matin"), soir:statusOf(p,"soir") };
 }, ctx.pid);
 ok('les deux passages faits → vu des deux côtés', s2.matin === "done" && s2.soir === "done",
    JSON.stringify(s2));

 /* ⚠️ SANS CRÉNEAUX, RIEN NE CHANGE. La réparation ne doit pas modifier
    le comportement des tournées qui n'en ont pas — c'est le gros des
    dossiers existants. */
 console.log('\n═══ SANS CRÉNEAUX, RIEN NE BOUGE ═══');
 const s3 = await pg.evaluate(id => {
   const t = S.curTour; S.slotsTours[t] = false;
   const p = getP(id);
   p.visits = [{ uid:"e3", date:workDate(), at:"08:10", slot:null, soins:["Toilette"], consts:{}, note:"" }];
   const avant = statusOf(p);
   p.visits = [];
   const apres = statusOf(p);
   S.slotsTours[t] = true;
   return { avecPassage:avant, sansPassage:apres };
 }, ctx.pid);
 ok('un passage → vu',        s3.avecPassage === "done", s3.avecPassage);
 ok('aucun passage → à voir', s3.sansPassage === "todo", s3.sansPassage);

 console.log('\n═══ LE PASSAGE SUPPLÉMENTAIRE ═══');
 const e1 = await pg.evaluate(id => {
   const t = S.curTour, p = getP(id);
   p.visits = [];
   extraSet(p, t, "matin");                  // déclaré sur le dossier
   return { declare:extraSlot(p, t), occ:occurrencesDe(p, t, "matin").length };
 }, ctx.pid);
 ok('déclaré le matin',               e1.declare === "matin", e1.declare);
 ok('le matin compte deux occurrences', e1.occ === 2, e1.occ);

 /* Aucun passage : les DEUX rangs sont à voir. */
 const e2 = await pg.evaluate(id => {
   const p = getP(id);
   return { r1:statusOf(p,"matin",1), r2:statusOf(p,"matin",2) };
 }, ctx.pid);
 ok('rang 1 à voir', e2.r1 === "todo", e2.r1);
 ok('rang 2 à voir', e2.r2 === "todo", e2.r2);

 /* Un passage : le premier rang est fait, le second reste. C'est TOUT
    l'objet de la demande — « conforme au terrain ». */
 const e3 = await pg.evaluate(id => {
   const p = getP(id);
   p.visits = [{ uid:"x1", date:workDate(), at:"07:20", slot:"matin", soins:["Toilette"], consts:{}, note:"" }];
   return { r1:statusOf(p,"matin",1), r2:statusOf(p,"matin",2) };
 }, ctx.pid);
 ok('rang 1 vu',       e3.r1 === "done", e3.r1);
 ok('rang 2 À VOIR',   e3.r2 === "todo", e3.r2);

 const e4 = await pg.evaluate(id => {
   const p = getP(id);
   p.visits.push({ uid:"x2", date:workDate(), at:"11:05", slot:"matin", soins:["Pilulier"], consts:{}, note:"" });
   return { r1:statusOf(p,"matin",1), r2:statusOf(p,"matin",2) };
 }, ctx.pid);
 ok('les deux rangs faits → les deux vus', e4.r1 === "done" && e4.r2 === "done", JSON.stringify(e4));

 /* Le soir n'a pas de 2ᵉ passage : une seule occurrence. */
 const e5 = await pg.evaluate(id =>
   occurrencesDe(getP(id), S.curTour, "soir").length, ctx.pid);
 ok('le soir reste à une occurrence', e5 === 1, e5);

 console.log('\n═══ LE DÉROULÉ COMPTE DES PASSAGES, PAS DES PATIENTS ═══');
 const d1 = await pg.evaluate(id => {
   const p = getP(id);
   p.visits = [];                        // rien de fait
   _viewSlot = "matin"; S.boardListe = true; render();
   const n = {}; document.querySelectorAll('#synth .spill').forEach(b =>
     n[b.querySelector('.l').textContent.trim()] = b.querySelector('.n').textContent.trim());
   const lignes = [...document.querySelectorAll('#board .pl-i')].length;
   const marques = [...document.querySelectorAll('#board .px')].map(x => x.textContent.trim());
   return { n, lignes, marques };
 }, ctx.pid);
 ok('deux lignes pour un patient à deux passages', d1.lignes === 2, d1.lignes);
 ok('« à voir » compte 2',  d1.n["À voir"] === "2", JSON.stringify(d1.n));
 ok('le 2ᵉ rang porte sa marque',
    d1.marques.some(m => /2/.test(m)), JSON.stringify(d1.marques));

 /* Retiré du dossier : tout revient à l'état d'avant, sans rien perdre. */
 const d2 = await pg.evaluate(id => {
   const p = getP(id); extraSet(p, S.curTour, null); render();
   return { occ:occurrencesDe(p, S.curTour, "matin").length,
            lignes:[...document.querySelectorAll('#board .pl-i')].length };
 }, ctx.pid);
 ok('retiré → une seule occurrence', d2.occ === 1, d2.occ);
 ok('retiré → une seule ligne',      d2.lignes === 1, d2.lignes);

 console.log('\n═══ LA RANGÉE « VUE » ═══');
 const v1 = await pg.evaluate(() => {
   S.boardListe = false; S.compactBoard = false; _viewSlot = "matin"; render();
   const lab = [...document.querySelectorAll('#filters .rowlab span')].map(x => x.textContent.trim());
   const vues = [...document.querySelectorAll('#filters [data-vue]')].map(x => x.textContent.trim());
   const fil  = [...document.querySelectorAll('#filters [data-f]')].map(x => x.textContent.trim());
   return { lab, vues, fil };
 });
 ok('deux titres : Afficher et Vue', v1.lab.length === 2 && /Vue/i.test(v1.lab[1]), JSON.stringify(v1.lab));
 ok('trois vues nommées', v1.vues.length === 3, JSON.stringify(v1.vues));
 ok('chaque vue porte un mot, pas seulement une icône',
    v1.vues.every(t => /[A-Za-zÀ-ÿ]{3}/.test(t)), JSON.stringify(v1.vues));
 ok('les filtres ne contiennent plus de bouton de vue',
    v1.fil.length === 3, JSON.stringify(v1.fil));

 const v2 = await pg.evaluate(() => {
   document.querySelector('#filters [data-vue="liste"]').click();
   const apres = { liste:!!S.boardListe, compact:!!S.compactBoard,
                   on:document.querySelector('#filters [data-vue].on').dataset.vue };
   document.querySelector('#filters [data-vue="compact"]').click();
   const apres2 = { liste:!!S.boardListe, compact:!!S.compactBoard,
                    on:document.querySelector('#filters [data-vue].on').dataset.vue };
   return { apres, apres2 };
 });
 ok('choisir Liste allume la liste',       v2.apres.liste && v2.apres.on === "liste", JSON.stringify(v2.apres));
 /* ⚠️ Les trois états sont EXCLUSIFS : choisir Compact doit éteindre la
    liste. Sans ça on retombe sur les deux interrupteurs indépendants,
    dont l'un ne faisait rien. */
 ok('choisir Compact éteint la liste',
    !v2.apres2.liste && v2.apres2.compact && v2.apres2.on === "compact", JSON.stringify(v2.apres2));

 console.log('\n═══ LA VUE JOURNÉE GARDE SES SECTIONS (J1) ═══');
 const j1 = await pg.evaluate(() => {
   S.boardListe = true; S.compactBoard = false; _viewSlot = "jour"; render();
   return {
     sections:[...document.querySelectorAll('#board .slotsec')].length,
     entetes:[...document.querySelectorAll('#board .slotsec-h .ss-l')].map(x=>x.textContent.trim()),
     lignes:[...document.querySelectorAll('#board .pl-i')].length,
     cartes:[...document.querySelectorAll('#board .pcard')].length
   };
 });
 ok('les sections restent',        j1.sections >= 1, JSON.stringify(j1.entetes));
 ok('elles sont remplies de lignes', j1.lignes >= 1, j1.lignes);
 /* ⚠️ LE DÉFAUT D'ORIGINE : avant correction, la vue Journée affichait
    des CARTES malgré « Listing » annoncé au bandeau. */
 ok('plus aucune carte en vue Liste', j1.cartes === 0, j1.cartes);

 const j2 = await pg.evaluate(() => {
   S.boardListe = false; render();
   return { cartes:[...document.querySelectorAll('#board .pcard')].length,
            lignes:[...document.querySelectorAll('#board .pl-i')].length };
 });
 ok('revenir aux cartes redonne des cartes', j2.cartes >= 1 && j2.lignes === 0, JSON.stringify(j2));


 /* ⚠️ TROUVÉ À LA CAPTURE, PAS À L'ÉPREUVE : la ligne du 2ᵉ passage
    affichait « vu aujourd'hui à 07:20 » — l'heure du PREMIER, lue par
    `lastVisit`. Un passage qui reste à faire se présentait comme fait. */
 const d3 = await pg.evaluate(id => {
   const p = getP(id);
   extraSet(p, S.curTour, "matin");
   p.visits = [{ uid:"y1", date:workDate(), at:"07:20", slot:"matin", soins:["Toilette"], consts:{}, note:"" }];
   _viewSlot = "matin"; S.boardListe = true; render();
   return [...document.querySelectorAll('#board .pl-i')]
     .filter(l => occPatientId(l.querySelector('[data-pli]').dataset.pli) === id)
     .map(l => (l.querySelector('.pl-sb')||{}).textContent || "");
 }, ctx.pid);
 ok('le rang 1 porte son heure',          /07:20/.test(d3[0]||""), JSON.stringify(d3));
 ok('le rang 2 ne porte AUCUNE heure',    !/\d\d:\d\d/.test(d3[1]||""), JSON.stringify(d3));
 ok('le rang 2 dit qu il reste à faire',  /à faire/.test(d3[1]||""), JSON.stringify(d3));

 /* ⚠️ LE TRI A→Z, VÉRIFIÉ AU COMPORTEMENT. `_test_v1_10` le gardait par
    une recherche de texte dans la source (`localeCompare(b.nom`) ; le
    refactor en occurrences a changé cette ligne en `b.p.nom` et le
    contrôle est tombé sans qu'aucune fonction ne soit cassée. Une
    recherche de texte garde l'écriture, pas le service rendu. */
 const a1 = await pg.evaluate(id => {
   const p = getP(id); extraSet(p, S.curTour, null);
   S.listeTri = "alpha"; S.boardListe = true; _viewSlot = "matin"; render();
   const noms = [...document.querySelectorAll('#board .pl-nm b')].map(x => x.textContent.trim());
   const sep  = [...document.querySelectorAll('#board .pl-sep')].map(x => x.textContent.trim());
   S.listeTri = "ordre"; render();
   const sepOrdre = [...document.querySelectorAll('#board .pl-sep')].length;
   return { noms, sep, sepOrdre };
 }, ctx.pid);
 ok('A→Z : les noms sont triés',
    a1.noms.join("|") === a1.noms.slice().sort((x,y)=>x.localeCompare(y,"fr",{sensitivity:"base"})).join("|"),
    JSON.stringify(a1.noms));
 ok('A→Z : les lettres servent de repère', a1.sep.length >= 1, JSON.stringify(a1.sep));
 /* ⚠️ En ordre de passage les lettres ne veulent rien dire et allongent
    le défilé : c'est ce qu'il reprochait à la toute première version. */
 ok('en ordre de passage, aucune lettre', a1.sepOrdre === 0, a1.sepOrdre);

 console.log('\n═══ LES DEUX ÉCRANS DE RÉGLAGE ═══');
 /* La fiche : les trois boutons existent, et la date ne s'ouvre qu'avec eux. */
 const f1 = await pg.evaluate(id => {
   const p = getP(id);
   extraSet(p, S.curTour, null);
   sheetPatient(p);
   const b = [...document.querySelectorAll('#f-sup [data-sup]')].map(x => x.dataset.sup);
   const cache = (document.getElementById('f-sup-jusqu')||{}).hidden;
   return { boutons:b, dateCachee:!!cache };
 }, ctx.pid);
 ok('trois choix sur la fiche', f1.boutons.length === 3, JSON.stringify(f1.boutons));
 ok('« Aucun » en premier',     f1.boutons[0] === "", JSON.stringify(f1.boutons));
 ok('la date reste repliée tant qu aucun créneau n est choisi', f1.dateCachee, f1.dateCachee);

 const f2 = await pg.evaluate(() => {
   document.querySelector('#f-sup [data-sup="matin"]').click();
   return { ouverte: !document.getElementById('f-sup-jusqu').hidden,
            actif: document.querySelector('#f-sup .chip.on').dataset.sup };
 });
 ok('choisir « le matin » ouvre la date', f2.ouverte && f2.actif === "matin", JSON.stringify(f2));

 /* L'ordre de passage : deux lignes, dont une sans case à cocher. */
 const o1 = await pg.evaluate(id => {
   closeSheet();
   const p = getP(id); extraSet(p, S.curTour, "matin");
   sheetAssignPatients(S.curTour, "matin");
   const lignes = [...document.querySelectorAll('#assign-list .rap')];
   const sup = lignes.filter(l => l.classList.contains('ap-sup'));
   return {
     dumem: lignes.filter(l => occPatientId(l.dataset.ap) === id).length,
     sup: sup.length,
     supSansCase: sup.every(l => !l.querySelector('[data-chk]')),
     supEnFin: lignes.indexOf(sup[0]) === lignes.length - 1
   };
 }, ctx.pid);
 ok('le dossier apparaît deux fois', o1.dumem === 2, o1.dumem);
 ok('une ligne marquée 2ᵉ passage',  o1.sup === 1, o1.sup);
 /* ⚠️ Décocher un 2ᵉ passage ne voudrait rien dire : on le retire sur le
    dossier, pas ici. La case ne doit donc pas exister. */
 ok('le 2ᵉ passage n a pas de case à cocher', o1.supSansCase, o1.supSansCase);
 /* ⚠️ Un rang jamais placé tombe en FIN de créneau, pas au hasard. */
 ok('un rang neuf arrive en fin de liste', o1.supEnFin, o1.supEnFin);

 /* Le ménage du démarrage ne doit pas prendre « p1#2 » pour un fantôme. */
 const g1 = await pg.evaluate(id => {
   const t = S.curTour;
   S.slotOrder = S.slotOrder || {}; S.slotOrder[t] = S.slotOrder[t] || {};
   S.slotOrder[t].matin = [id, cleOcc(id, 2)];
   const vivants = new Set(S.patients.map(p => p.id));
   const fantomes = new Set();
   Object.values(S.slotOrder).forEach(c => ["matin","soir"].forEach(k =>
     ((c||{})[k]||[]).forEach(x => { if (!vivants.has(occPatientId(x))) fantomes.add(occPatientId(x)); })));
   return fantomes.size;
 }, ctx.pid);
 ok('« p1#2 » n est pas pris pour un fantôme', g1 === 0, g1);

 /* Supprimer le dossier emporte sa clé d'occurrence et son réglage. */
 const g2 = await pg.evaluate(id => {
   oublierPatientPartout(id);
   return { ordre:(((S.slotOrder||{})[S.curTour]||{}).matin||[]).length,
            reglage:!!((S.extraPass||{})[S.curTour]||{})[id] };
 }, ctx.pid);
 ok('plus aucune clé dans l ordre', g2.ordre === 0, g2.ordre);
 ok('plus de réglage de passage',   g2.reglage === false, g2.reglage);

 console.log('\n═══ LA CONSOLE ═══');
 ok('aucune erreur de page', errs.length === 0, errs.join(' · '));

 console.log('\n'+(ko.length?'⚠ '+ko.length+' point(s) : '+ko.join(' · '):'✓ tout tourne'));
 await nav.close(); srv.close(); process.exit(ko.length?1:0);
})().catch(e=>{console.error(e);process.exit(2);});
