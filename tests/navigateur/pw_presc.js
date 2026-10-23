// ③ « Le bouton du prescripteur reste bloqué » — reproduction exacte de
// la vidéo du 10/10 : un médecin repris DEPUIS L'ANNUAIRE DU CABINET.
const { chromium } = require('playwright');
const http=require('http'),fs=require('fs'),path=require('path');
const ROOT='/home/claude/jmsante/www';
const MIME={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.svg':'image/svg+xml'};
const srv=http.createServer((q,r)=>{let u=decodeURIComponent(q.url.split('?')[0]);if(u==='/')u='/index.html';
 const f=path.join(ROOT,u); if(!f.startsWith(ROOT)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);r.end('404');return;}
 r.writeHead(200,{'Content-Type':MIME[path.extname(f)]||'application/octet-stream'});r.end(fs.readFileSync(f));});
let ko=[]; const ok=(l,c,x)=>{console.log(`  ${c?'✓':'⚠'} ${l}${x&&!c?'  → '+x:''}`); if(!c)ko.push(l);};
(async()=>{
 await new Promise(r=>srv.listen(8124,r));
 const nav=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
 const pg=await (await nav.newContext({viewport:{width:412,height:900}})).newPage();
 const errs=[]; pg.on('pageerror',e=>errs.push(String(e)));
 await pg.goto('http://localhost:8124/index.html'); await pg.waitForTimeout(2600);

 const pid=await pg.evaluate(()=>{
   S.confidentialityAck=true; S.firstRun=false;
   const t=S.tours[0]; S.curTour=t;
   const p=S.patients[0];
   if(!(p.tours||[]).includes(t)) (p.tours=p.tours||[]).push(t);
   /* ⚠️ LA DONNÉE EXACTE DE LA VIDÉO : un médecin venu de l'annuaire du
      cabinet. cabChoisir rend { nom, tel, spec, cabRef } — SANS id. */
   p.medecins=[{ nom:"Le Gall Jean-Luc", tel:"0494000000",
                 spec:"Médecin généraliste", cabRef:"cab-7" }];
   p.traitement={lignes:[]};
   save(); render(); return p.id;
 });
 await pg.waitForTimeout(500);

 console.log('═══ LA REPRODUCTION ═══');
 await pg.evaluate(id=>sheetTraitement(id), pid); await pg.waitForTimeout(700);
 await pg.click('#tr-add'); await pg.waitForTimeout(600);
 await pg.fill('#te-nom','Test traitement');

 const chips=await pg.evaluate(()=>[...document.querySelectorAll('#sheet [data-tpr]')]
   .map(b=>({ val:b.dataset.tpr, on:b.classList.contains('on'), txt:b.textContent.trim().slice(0,40) })));
 console.log('  pastilles :', JSON.stringify(chips));
 ok('les deux pastilles sont bien là', chips.length===2);
 // ⚠️ LE DÉFAUT : sans id, data-tpr vaut "" — exactement comme la
 //    pastille « Médecin traitant ». Les deux boutons sont le MÊME bouton.
 ok('le spécialiste a une valeur à lui, pas la même que le traitant',
    chips.length===2 && chips[1].val && chips[1].val!==chips[0].val,
    chips.map(c=>JSON.stringify(c.val)).join(' vs '));

 await pg.click('#sheet [data-tpr]:nth-of-type(2)').catch(()=>{});
 const btns=await pg.$$('#sheet [data-tpr]');
 if (btns[1]) await btns[1].click();
 await pg.waitForTimeout(600);
 const apres=await pg.evaluate(()=>[...document.querySelectorAll('#sheet [data-tpr]')]
   .map(b=>({ on:b.classList.contains('on'), txt:b.textContent.trim().slice(0,30) })));
 ok('toucher le spécialiste l allume', apres[1] && apres[1].on===true, JSON.stringify(apres));
 ok('et éteint « Médecin traitant »', apres[0] && apres[0].on===false);

 const b2=await pg.$$('#sheet [data-tpr]');
 if (b2[1]) await b2[1].click();
 await pg.waitForTimeout(400);
 await pg.click('#te-ok'); await pg.waitForTimeout(800);
 const enr=await pg.evaluate(id=>{
   const l=(getP(id).traitement.lignes||[])[0];
   return l?{presc:l.presc, resolu:(prescDe(getP(id),l)||{}).nom||null}:null;
 }, pid);
 ok('le prescripteur est enregistré', enr && !!enr.presc, JSON.stringify(enr));
 // ⚠️ Enregistrer un identifiant ne suffit pas : il doit se RETROUVER.
 ok('et il se retrouve au dossier', enr && enr.resolu==='Le Gall Jean-Luc', JSON.stringify(enr));
 ok('la fiche l affiche sur la ligne',
    await pg.evaluate(()=>/Le Gall/.test((document.querySelector('#sheet .tr-presc')||{}).textContent||'')));

 console.log('\n═══ LA RÉPARATION DES DOSSIERS DÉJÀ SAISIS ═══');
 ok('le médecin a reçu un identifiant au dossier',
    await pg.evaluate(id=>!!(getP(id).medecins[0]||{}).id, pid));
 ok('et son lien vers l annuaire est intact',
    await pg.evaluate(id=>(getP(id).medecins[0]||{}).cabRef==='cab-7', pid));
 // ⚠️ L'identifiant doit être STABLE : regénéré à chaque lecture, il
 //    casserait le lien avec la ligne de traitement au rechargement.
 const stable=await pg.evaluate(id=>{
   const a=medecinsDe(getP(id))[0].id; const b=medecinsDe(getP(id))[0].id;
   return a===b && a===medecinsDe(getP(id))[0].id;
 }, pid);
 ok('et stable d une lecture à l autre', stable);

 console.log('\n═══ LA CONSOLE ═══');
 ok('aucune erreur de page', errs.length===0, errs.join(' | '));
 console.log('\n'+(ko.length?'⚠ '+ko.length+' point(s) : '+ko.join(' · '):'✓ tout tourne'));
 await nav.close(); srv.close(); process.exit(ko.length?1:0);
})().catch(e=>{console.error(e);process.exit(2);});
