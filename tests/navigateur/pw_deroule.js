// Le déroulé : naviguer n'est pas valider.
//
// ⚠️ ÉCRITE AVANT LA CORRECTION ET VÉRIFIÉE EN ROUGE sur la v1.15.0 :
//    revenir sur un patient déjà validé puis repartir avec → créait un
//    SECOND PASSAGE. Une épreuve qui ne tombe pas sur le défaut qu'elle
//    garde ne garde rien.
//
// ⚠️ ON COMPTE DES PASSAGES DANS LE DOSSIER, pas des bandeaux à l'écran :
//    c'est ce qui finit dans la relève, et c'est la seule chose qui compte.
const { chromium } = require('playwright');
const http=require('http'),fs=require('fs'),path=require('path');
const ROOT='/home/claude/jmsante/www';
const MIME={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.svg':'image/svg+xml'};
const srv=http.createServer((q,r)=>{let u=decodeURIComponent(q.url.split('?')[0]);if(u==='/')u='/index.html';
 const f=path.join(ROOT,u); if(!f.startsWith(ROOT)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);r.end('404');return;}
 r.writeHead(200,{'Content-Type':MIME[path.extname(f)]||'application/octet-stream'});r.end(fs.readFileSync(f));});
let ko=[]; const ok=(l,c,x)=>{console.log(`  ${c?'✓':'⚠'} ${l}${x!==undefined&&!c?'  → '+x:''}`); if(!c)ko.push(l);};

(async()=>{
 await new Promise(r=>srv.listen(8184,r));
 const nav=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
 const pg=await (await nav.newContext({viewport:{width:430,height:950}})).newPage();
 const errs=[]; pg.on('pageerror',e=>errs.push(String(e)));
 await pg.goto('http://localhost:8184/index.html'); await pg.waitForTimeout(2600);

 /* ⚠️ `S.firstRun=false` AVANT tout, sinon render() s'arrête sur l'écran
    de bienvenue et le déroulé n'a rien à dérouler. */
 const ctx = await pg.evaluate(() => {
   S.confidentialityAck = true; S.firstRun = false;
   const t = (S.tours && S.tours[0]) || "A"; S.curTour = t;
   /* Pas de créneaux ici : on isole le défaut de navigation. Trois
      patients suffisent à faire un aller-retour. */
   S.slotsTours = {}; S.extraPass = {}; S.drafts = {}; S.noVisit = {};
   const pats = S.patients.slice(0, 3);
   pats.forEach(p => { p.visits = []; if (!(p.tours||[]).includes(t)) p.tours = [...(p.tours||[]), t];
     if (!(p.plan||[]).length) p.plan = ["Toilette"]; });
   S.patientOrder = S.patientOrder || {};
   S.patientOrder[t] = pats.map(p => p.id);
   S.patients.slice(3).forEach(p => { p.tours = (p.tours||[]).filter(x => x !== t); });
   save(); render();
   return { ids: pats.map(p => p.id), noms: pats.map(p => p.nom) };
 });

 const passages = id => pg.evaluate(i => (getP(i).visits||[]).length, id);
 const horsLigne = () => pg.evaluate(() => ({ idx:seqIdx, actif:seqActive }));

 console.log('═══ VALIDER AVEC LE BOUTON DU BAS ═══');
 await pg.evaluate(() => { enterSeqMode(); });
 await pg.waitForTimeout(600);
 ok('le déroulé est ouvert sur le 1er patient', (await horsLigne()).idx === 0);

 /* On coche un soin et on valide — le geste de tous les jours. */
 await pg.evaluate(() => {
   const f = document.querySelector('#seq-mode [data-form]');
   const c = f.querySelector('.chip[data-s]'); if (c) c.click();
 });
 await pg.waitForTimeout(300);
 await pg.evaluate(() => document.querySelector('#seq-mode [data-save]').click());
 await pg.waitForTimeout(900);
 ok('le bouton du bas enregistre bien UN passage', await passages(ctx.ids[0]) === 1,
    await passages(ctx.ids[0]));

 console.log('\n═══ NAVIGUER N EST PAS VALIDER ═══');
 /* → vers le patient 2, puis ← pour revenir relire le patient 1. */
 await pg.evaluate(() => document.getElementById('sq-next').click());
 await pg.waitForTimeout(800);
 ok('→ avance au patient suivant', (await horsLigne()).idx === 1);
 ok('… sans toucher au passage du 1er', await passages(ctx.ids[0]) === 1, await passages(ctx.ids[0]));

 await pg.evaluate(() => document.getElementById('sq-prev').click());
 await pg.waitForTimeout(800);
 ok('← revient au patient précédent', (await horsLigne()).idx === 0);

 /* ⚠️ LE DÉFAUT, EXACTEMENT. On n'a RIEN touché : on est juste revenu
    relire. En repartant vers l'avant, l'app créait un second passage,
    parce que le formulaire réaffiché n'était pas « vide » à ses yeux. */
 await pg.evaluate(() => document.getElementById('sq-next').click());
 await pg.waitForTimeout(900);
 ok('repartir après avoir relu ne crée PAS de second passage',
    await passages(ctx.ids[0]) === 1, await passages(ctx.ids[0]));

 /* Et l'aller-retour peut se répéter sans rien accumuler. */
 await pg.evaluate(() => document.getElementById('sq-prev').click());
 await pg.waitForTimeout(700);
 await pg.evaluate(() => document.getElementById('sq-next').click());
 await pg.waitForTimeout(700);
 await pg.evaluate(() => document.getElementById('sq-prev').click());
 await pg.waitForTimeout(700);
 await pg.evaluate(() => document.getElementById('sq-next').click());
 await pg.waitForTimeout(900);
 ok('trois allers-retours : toujours un seul passage',
    await passages(ctx.ids[0]) === 1, await passages(ctx.ids[0]));

 console.log('\n═══ UNE SAISIE EN COURS N EST JAMAIS PERDUE ═══');
 /* Sur le patient 2, on coche sans valider, puis on s'en va. Le passage
    ne doit pas être créé — mais la saisie ne doit pas disparaître non
    plus : perdre une saisie est pire qu'un doublon. */
 const p2 = ctx.ids[1];
 await pg.evaluate(() => { while (seqIdx !== 1) { seqIdx = 1; renderSeq(); } });
 await pg.waitForTimeout(600);
 await pg.evaluate(() => {
   const f = document.querySelector('#seq-mode [data-form]');
   const c = f.querySelector('.chip[data-s]'); if (c) c.click();
 });
 await pg.waitForTimeout(300);
 await pg.evaluate(() => document.getElementById('sq-next').click());
 await pg.waitForTimeout(900);
 ok('partir sans valider ne crée pas de passage', await passages(p2) === 0, await passages(p2));
 ok('mais la saisie est gardée',
    await pg.evaluate(i => !!(S.drafts||{})[i], p2), JSON.stringify(await pg.evaluate(()=>Object.keys(S.drafts||{}))));

 /* ⚠️ ET LA SAISIE GARDÉE DOIT SE REPRENDRE. C'est le chemin que ma
    correction fait emprunter pour la première fois : on revient sur le
    patient, le formulaire se recharge depuis la saisie gardée, et le
    bouton du bas crée alors UN passage — pas zéro, pas deux. */
 await pg.evaluate(() => { seqIdx = 1; renderSeq(); });
 await pg.waitForTimeout(700);
 const rep = await pg.evaluate(() => {
   const f = document.querySelector('#seq-mode [data-form]');
   return { coches: f.querySelectorAll('.chip.on[data-s]').length };
 });
 ok('la saisie gardée est bien reprise à l écran', rep.coches >= 1, JSON.stringify(rep));
 await pg.evaluate(() => document.querySelector('#seq-mode [data-save]').click());
 await pg.waitForTimeout(900);
 ok('valider la reprise crée UN passage', await passages(p2) === 1, await passages(p2));
 ok('et la saisie gardée est consommée',
    await pg.evaluate(i => !((S.drafts||{})[i]), p2));
 await pg.evaluate(() => document.getElementById('sq-next').click());
 await pg.waitForTimeout(800);
 ok('repartir ensuite ne duplique rien', await passages(p2) === 1, await passages(p2));

 console.log('\n═══ QUITTER NE VALIDE PAS NON PLUS ═══');
 const p3 = ctx.ids[2];
 await pg.evaluate(() => { seqIdx = 2; renderSeq(); });
 await pg.waitForTimeout(600);
 await pg.evaluate(() => document.getElementById('sq-quit').click());
 await pg.waitForTimeout(900);
 ok('quitter le déroulé ne crée pas de passage', await passages(p3) === 0, await passages(p3));
 ok('et le déroulé est bien refermé', (await horsLigne()).actif === false);

 console.log('\n═══ LE BOUTON DU HAUT ═══');
 /* ⚠️ Deux boutons qui valident la même chose doivent raconter la même
    histoire. Un bouton du haut qui resterait « à valider » après une
    validation ferait appuyer « au cas où » — et on recréerait des
    doublons par l'autre porte. */
 await pg.evaluate(() => { S.patients.forEach(p => p.visits = []); S.drafts = {};
   enterSeqMode(); });
 await pg.waitForTimeout(800);
 const h0 = await pg.evaluate(() => {
   const h = document.getElementById('sq-valid');
   return h ? { existe:true, eteint:h.classList.contains('off'),
                texte:h.textContent.trim(), large:h.getBoundingClientRect().width } : { existe:false };
 });
 ok('le bouton existe dans la barre', h0.existe === true);
 ok('éteint tant qu il n y a rien à valider', h0.eteint === true, JSON.stringify(h0));
 /* ⚠️ PLEINE LARGEUR : posé en carré à côté de « Suiv. », il aurait été
    un bouton vert de 44 px contre un autre, pour deux actions sans
    rapport. La largeur est ce qui les rend impossibles à confondre. */
 ok('il occupe toute la largeur de la barre', h0.large > 300, h0.large);

 await pg.evaluate(() => {
   const f = document.querySelector('#seq-mode [data-form]');
   const c = f.querySelector('.chip[data-s]'); if (c) c.click();
 });
 await pg.waitForTimeout(400);
 const h1 = await pg.evaluate(() => {
   const h = document.getElementById('sq-valid');
   const b = document.querySelector('#seq-mode [data-save]');
   return { haut:h.classList.contains('off'), bas:b.classList.contains('off') };
 });
 ok('il s allume en même temps que celui du bas', !h1.haut && !h1.bas, JSON.stringify(h1));

 const idA = await pg.evaluate(() => seqPool[seqIdx].id);
 await pg.evaluate(() => document.getElementById('sq-valid').click());
 await pg.waitForTimeout(900);
 ok('il crée UN passage', await passages(idA) === 1, await passages(idA));
 const h2 = await pg.evaluate(() => {
   const h = document.getElementById('sq-valid');
   return { texte:h.textContent.trim(), fait:h.classList.contains('fait') };
 });
 ok('et il dit que c est fait', h2.fait && /enregistr/i.test(h2.texte), JSON.stringify(h2));

 /* ⚠️ Il ne doit pas devenir une deuxième façon de créer un doublon :
    reposer le doigt dessus ne double pas le passage. */
 await pg.evaluate(() => document.getElementById('sq-valid').click());
 await pg.waitForTimeout(900);
 ok('le toucher à nouveau ne double pas le passage', await passages(idA) === 1, await passages(idA));

 /* Et il rétrécit avec la barre, sans perdre son libellé. */
 const h3 = await pg.evaluate(() => {
   const h = document.getElementById('sq-valid');
   const nav = document.querySelector('#seq-mode .seq-nav');
   const grand = h.getBoundingClientRect().height;
   nav.classList.add('compact');
   const petit = h.getBoundingClientRect().height;
   const texte = h.textContent.trim();
   nav.classList.remove('compact');
   return { grand, petit, texte };
 });
 ok('réduit, il prend deux fois moins de haut', h3.petit < h3.grand * 0.65,
    JSON.stringify({grand:h3.grand, petit:h3.petit}));
 /* ⚠️ « Lisible mais petit », à sa demande : le libellé reste ENTIER. */
 ok('et il garde son libellé entier', /passage/i.test(h3.texte), h3.texte);

 await pg.evaluate(() => { if (seqActive) exitSeqMode(); });
 await pg.waitForTimeout(400);

 console.log('\n═══ LA CONSOLE ═══');
 ok('aucune erreur de page', errs.length === 0, errs.join(' · '));

 console.log('\n'+(ko.length?'⚠ '+ko.length+' point(s) : '+ko.join(' · '):'✓ tout tourne'));
 await nav.close(); srv.close(); process.exit(ko.length?1:0);
})().catch(e=>{console.error(e);process.exit(2);});
