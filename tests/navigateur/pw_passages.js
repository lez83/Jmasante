// UN PASSAGE PAR PASSAGE — les constantes du matin ne sont pas celles du soir.
//
// ⚠️ ÉCRITE AVANT LA CORRECTION et vérifiée en rouge : sur la v1.15.5, le
//    formulaire du soir s'ouvrait DÉJÀ REMPLI avec les constantes du matin,
//    et il pointait sur le passage du matin. Signalé au chevet : « le soir,
//    quand j'ouvre un patient, les constantes du matin sont déjà
//    renseignées » — et modifier l'une modifiait l'autre.
//
// ⚠️ L'HORLOGE EST FIGÉE. Le créneau d'un passage est déduit de l'heure
//    (`defaultSlot()` : avant 14 h = matin). Mesurer une journée à 18 h fait
//    enregistrer le passage « du matin » en créneau soir, et l'épreuve passe
//    au vert sur une situation qui n'arrive jamais. 8 h 10 puis 19 h 05.
//
// ⚠️ LA VUE JOURNÉE N'EST PAS UN CAS EXOTIQUE : revenir au Moniteur la pose
//    tout seul (nav.js — `_viewSlot = "jour"`). C'est le chemin de
//    l'utilisateur, pas une manipulation de laboratoire.
const { chromium } = require('playwright');
const http=require('http'),fs=require('fs'),path=require('path');
const ROOT=path.join(__dirname,'..','..','www');
const MIME={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.svg':'image/svg+xml'};
const srv=http.createServer((q,r)=>{let u=decodeURIComponent(q.url.split('?')[0]);if(u==='/')u='/index.html';
 const f=path.join(ROOT,u); if(!f.startsWith(ROOT)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);r.end('404');return;}
 r.writeHead(200,{'Content-Type':MIME[path.extname(f)]||'application/octet-stream'});r.end(fs.readFileSync(f));});
let ko=[]; const ok=(l,c,x)=>{console.log(`  ${c?'✓':'⚠'} ${l}${x!==undefined&&!c?'  → '+x:''}`); if(!c)ko.push(l);};

(async()=>{
 await new Promise(r=>srv.listen(8199,r));
 const nav=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
 const ctx=await nav.newContext({viewport:{width:430,height:950}});
 const pg=await ctx.newPage();
 const errs=[]; pg.on('pageerror',e=>errs.push(String(e)));

 await pg.clock.install({ time: new Date('2026-10-16T08:10:00') });
 await pg.goto('http://localhost:8199/index.html');
 await pg.clock.runFor(3000);

 /* ⚠️ `S.firstRun=false` AVANT tout, sinon render() s'arrête sur l'écran de
    bienvenue et les contrôles passent au vert sur un board vide. */
 const reset = (creneaux) => pg.evaluate(cr => {
   S.confidentialityAck=true; S.firstRun=false;
   const t=(S.tours&&S.tours[0])||"A"; S.curTour=t;
   const p=S.patients.find(x=>(x.tours||[]).includes(t))||S.patients[0];
   if(!(p.tours||[]).includes(t)) p.tours=[t];
   S.slotsTours={[t]:cr};
   S.slotMembers={[t]:{matin:[p.id],soir:[p.id]}};
   S.extraPass={}; S.drafts={}; p.visits=[]; _formDraft=null; openId=null;
   return p.id;
 }, creneaux);

 /* Ouvrir la carte d'un patient dans une vue donnée, relever ce que
    l'utilisateur VOIT, puis saisir une température et valider. */
 const passage = (vue, temp) => pg.evaluate(async ([v,tp]) => {
   const p = S.patients.find(x=>(x.tours||[]).includes(S.curTour))||S.patients[0];
   _viewSlot = v; _curSlot = null; _formDraft = null;
   openId = p.id; render(); await new Promise(r=>setTimeout(r,300));
   const f = document.querySelector('[data-form="'+p.id+'"]');
   if (!f) return { err:'pas de formulaire' };
   const i = f.querySelector('[data-c="temp"]');
   const vu = { champ:i.value, bouton:(f.querySelector('[data-save]')||{}).textContent.trim() };
   i.value = tp; i.dispatchEvent(new Event('input',{bubbles:true}));
   await new Promise(r=>setTimeout(r,120));
   f.querySelector('[data-save]').click();
   await new Promise(r=>setTimeout(r,700));
   /* ⚠️ SANS CRÉNEAUX, VALIDER OUVRE UNE BOÎTE : « Compléter ce passage /
      Garder les deux séparés ». Une épreuve qui ne lui répond pas laisse
      le passage en attente et compte une perte de donnée là où il n'y a
      qu'une question posée. On répond ce que l'utilisateur répondrait
      pour un vrai second passage : garder les deux. */
   const opts = [...document.querySelectorAll('.dlg-opt')];
   const sep = opts.find(b => /séparé/i.test(b.textContent||''));
   vu.boite = opts.length ? opts.map(b=>b.textContent.trim().slice(0,28)).join(' | ') : null;
   if (sep){ sep.click(); await new Promise(r=>setTimeout(r,600)); }
   return vu;
 }, [vue, temp]);

 const passages = () => pg.evaluate(() => {
   const p = S.patients.find(x=>(x.tours||[]).includes(S.curTour))||S.patients[0];
   return (p.visits||[]).filter(v=>v.date===workDate())
     .map(v => ({ at:v.at, slot:v.slot||null, temp:(v.consts||{}).temp }));
 });

 const matin = () => pg.clock.setFixedTime(new Date('2026-10-16T08:10:00'));
 const soir  = () => pg.clock.setFixedTime(new Date('2026-10-16T19:05:00'));

 /* ── 1. Le chemin de l'utilisateur : créneaux activés, écran en vue Journée ── */
 console.log('═══ VU LE MATIN, REVU LE SOIR DEPUIS LA VUE JOURNÉE ═══');
 await reset(true);
 await matin(); await passage('matin','36.5');
 await soir();
 const vuSoir = await passage('jour','38.9');
 ok('le formulaire du soir s\'ouvre VIERGE', vuSoir.champ === '', `champ = « ${vuSoir.champ} »`);
 ok('le bouton propose de valider, pas de modifier',
    /Valider/.test(vuSoir.bouton||''), vuSoir.bouton);
 const j = await passages();
 ok('deux passages, pas un', j.length === 2, JSON.stringify(j));
 ok('la constante du matin est intacte',
    j.some(v => v.temp === '36.5'), JSON.stringify(j));
 ok('la constante du soir est enregistrée',
    j.some(v => v.temp === '38.9'), JSON.stringify(j));

 /* ── 2. Créneaux activés, chaque créneau dans sa vue : déjà correct avant
        la correction — ce contrôle garde ce qui marchait. ── */
 console.log('\n═══ CHAQUE CRÉNEAU DANS SA VUE ═══');
 await reset(true);
 await matin(); await passage('matin','36.5');
 await soir();  const vs2 = await passage('soir','38.9');
 ok('formulaire du soir vierge', vs2.champ === '', `champ = « ${vs2.champ} »`);
 const j2 = await passages();
 ok('deux passages', j2.length === 2, JSON.stringify(j2));
 ok('un en matin, un en soir',
    j2.some(v=>v.slot==='matin') && j2.some(v=>v.slot==='soir'), JSON.stringify(j2));

 /* ── 3. Sans créneaux : deux passages le même jour, la saisie du soir ne
        doit pas disparaître. Mesuré avant correction : UN seul passage,
        et la valeur du soir perdue. ── */
 console.log('\n═══ SANS CRÉNEAUX, DEUX PASSAGES DANS LA JOURNÉE ═══');
 await reset(false);
 await matin(); await passage(null,'36.5');
 await soir();  const vs3 = await passage(null,'38.9');
 ok('formulaire du second passage vierge', vs3.champ === '', `champ = « ${vs3.champ} »`);
 const j3 = await passages();
 ok('deux passages', j3.length === 2, JSON.stringify(j3));
 ok('la saisie du soir n\'est pas perdue',
    j3.some(v => v.temp === '38.9'), JSON.stringify(j3));
 ok('celle du matin non plus',
    j3.some(v => v.temp === '36.5'), JSON.stringify(j3));

 /* ── 4. La contrepartie : corriger un passage validé, exprès ──
    ⚠️ Sans ce chemin, la correction du rechargement automatique coûterait
    une capacité : un passage du matin deviendrait définitif dès qu'un
    autre le suit. Ce que l'app décidait toute seule au mauvais moment,
    l'utilisateur le demande maintenant au bon. ── */
 console.log('\n═══ CORRIGER UN PASSAGE DÉJÀ VALIDÉ ═══');
 await reset(true);
 await matin(); await passage('matin','36.5');
 await soir();  await passage('soir','38.9');
 const corr = await pg.evaluate(async () => {
   const p = S.patients.find(x=>(x.tours||[]).includes(S.curTour))||S.patients[0];
   const vMatin = (p.visits||[]).find(v => v.at === '08:10');
   if (!vMatin) return { err:'pas de passage du matin' };
   sheetHist(p.id); await new Promise(r=>setTimeout(r,420));
   const bouton = document.querySelector('#sheet [data-editv="'+vMatin.uid+'"]');
   const res = { boutonPresent: !!bouton, uidVise: vMatin.uid };
   if (!bouton) return res;
   bouton.click(); await new Promise(r=>setTimeout(r,500));
   const f = document.querySelector('[data-form="'+p.id+'"]');
   res.formulaireOuvert = !!f;
   if (f){
     res.champ  = f.querySelector('[data-c="temp"]').value;
     res.bouton = (f.querySelector('[data-save]')||{}).textContent.trim();
     const i = f.querySelector('[data-c="temp"]');
     i.value = '37.2'; i.dispatchEvent(new Event('input',{bubbles:true}));
     await new Promise(r=>setTimeout(r,120));
     f.querySelector('[data-save]').click();
     await new Promise(r=>setTimeout(r,700));
   }
   res.apres = (p.visits||[]).map(v => ({ at:v.at, slot:v.slot||null, temp:(v.consts||{}).temp }));
   return res;
 });
 ok('un bouton ✏️ sur chaque passage de l\'historique', corr.boutonPresent === true);
 ok('il ouvre le formulaire du patient', corr.formulaireOuvert === true);
 ok('chargé avec la valeur de CE passage', corr.champ === '36.5', `champ = « ${corr.champ} »`);
 ok('le bouton annonce une modification, pas une validation',
    /modification/i.test(corr.bouton||''), corr.bouton);
 ok('corriger ne crée PAS un troisième passage',
    (corr.apres||[]).length === 2, JSON.stringify(corr.apres));
 ok('c\'est bien le passage du matin qui a changé',
    (corr.apres||[]).some(v => v.at === '08:10' && v.temp === '37.2'), JSON.stringify(corr.apres));
 ok('celui du soir n\'a pas bougé',
    (corr.apres||[]).some(v => v.temp === '38.9'), JSON.stringify(corr.apres));
 /* ⚠️ Le créneau doit survivre : corriger le soir un passage du matin ne
    doit pas le reclasser en soir — sinon la vue du matin le perd. */
 ok('le passage corrigé reste dans son créneau',
    (corr.apres||[]).some(v => v.at === '08:10' && v.slot === 'matin'), JSON.stringify(corr.apres));

 console.log('\n═══ LA CONSOLE ═══');
 ok('aucune erreur de page', errs.length === 0, errs[0]);

 console.log(ko.length ? `\n⚠ ${ko.length} point(s)` : '\n✓ tout tourne');
 await nav.close(); srv.close(); process.exit(ko.length?1:0);
})();
