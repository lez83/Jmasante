// L'onglet Infos : les six types tiennent l'écran vide, la règle
// relève/fiche descend sous la liste, et l'accord se fait.
const { chromium } = require('playwright');
const http=require('http'),fs=require('fs'),path=require('path');
const ROOT='/home/claude/jmsante/www';
const MIME={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.svg':'image/svg+xml'};
const srv=http.createServer((q,r)=>{let u=decodeURIComponent(q.url.split('?')[0]);if(u==='/')u='/index.html';
 const f=path.join(ROOT,u); if(!f.startsWith(ROOT)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);r.end('404');return;}
 r.writeHead(200,{'Content-Type':MIME[path.extname(f)]||'application/octet-stream'});r.end(fs.readFileSync(f));});
let ko=[]; const ok=(l,c,x)=>{console.log(`  ${c?'✓':'⚠'} ${l}${x&&!c?'  → '+x:''}`); if(!c)ko.push(l);};
(async()=>{
 await new Promise(r=>srv.listen(8129,r));
 const nav=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
 const pg=await (await nav.newContext({viewport:{width:430,height:950}})).newPage();
 const errs=[]; pg.on('pageerror',e=>errs.push(String(e)));
 await pg.goto('http://localhost:8129/index.html'); await pg.waitForTimeout(2600);

 const pid=await pg.evaluate(()=>{
   S.confidentialityAck=true; S.firstRun=false;
   const t=S.tours[0]; S.curTour=t; const p=S.patients[0];
   if(!(p.tours||[]).includes(t)) (p.tours=p.tours||[]).push(t);
   p.infos=[]; p.docs=[]; p.liens={}; save(); render(); return p.id;
 });
 const ouvrir = async () => {
   await pg.evaluate(id=>sheetPatient(getP(id),'info'), pid);
   await pg.waitForTimeout(800);
 };
 await ouvrir();

 console.log('═══ L ÉCRAN VIDE EST LA GRILLE ═══');
 const g=await pg.evaluate(()=>[...document.querySelectorAll('#sheet [data-iadd]')].map(b=>b.dataset.iadd));
 ok('les six types sont posés sur l écran', g.length===6, JSON.stringify(g));
 ok('et ce sont bien les six du modèle',
    await pg.evaluate(t=>JSON.stringify(t)===JSON.stringify(Object.keys(INFO_TYPES)), g), JSON.stringify(g));
 // ⚠️ Chaque tuile doit porter son exemple : c'est lui qui enseigne.
 ok('chacune porte son exemple',
    await pg.evaluate(()=>[...document.querySelectorAll('#sheet [data-iadd] .it-sub')]
      .every(e=>e.textContent.trim().length>3)));
 ok('plus de bouton générique tant qu il n y a rien',
    await pg.evaluate(()=>!document.querySelector('#sheet #f-info-add')));
 // ⚠️ La règle décrivait des pastilles qui n'existaient pas encore.
 ok('la règle relève/fiche ne s affiche pas sur le vide',
    await pg.evaluate(()=>!/figure sur chaque relève de ce patient/.test(
      document.querySelector('#sheet [data-pane="info"]').textContent)));

 console.log('\n═══ UNE TUILE CRÉE DIRECTEMENT SON TYPE ═══');
 await pg.click('#sheet [data-iadd="vigilance"]'); await pg.waitForTimeout(600);
 // ⚠️ Pas d'écran intermédiaire : la tuile apporte déjà le type.
 ok('aucun sélecteur de type ne s ouvre', await pg.evaluate(()=>!document.getElementById('typepick')));
 const l1=await pg.evaluate(()=>document.querySelectorAll('#sheet #f-infos .info-row').length);
 ok('une ligne est créée', l1===1, String(l1));
 ok('et elle est du bon type',
    await pg.evaluate(()=>/Vigilance/.test(document.querySelector('#sheet .info-typ').textContent)));
 // ⚠️ Vigilance et Accès partent « relève » : ce sont celles qu'un
 //    remplaçant doit voir sans ouvrir le dossier.
 ok('la vigilance part sur « relève »',
    await pg.evaluate(()=>document.querySelector('#sheet .info-row').classList.contains('on')));
 ok('le curseur est dans le champ de la nouvelle ligne',
    await pg.evaluate(()=>document.activeElement && document.activeElement.hasAttribute('data-itxt')));

 console.log('\n═══ LA GRILLE SE REPLIE ═══');
 ok('les six tuiles ont disparu',
    await pg.evaluate(()=>document.querySelectorAll('#sheet [data-iadd]').length===0));
 ok('et le bouton « Ajouter » les remplace', await pg.isVisible('#sheet #f-info-add'));
 // ⚠️ La règle descend SOUS la liste, là où les pastilles se voient.
 const pos=await pg.evaluate(()=>{
   const z=document.getElementById('f-info-actions');
   const liste=document.getElementById('f-infos');
   const regle=[...z.querySelectorAll('p')].find(e=>/figure sur chaque relève/.test(e.textContent));
   return regle ? { ok:true, sous: regle.getBoundingClientRect().top >= liste.getBoundingClientRect().bottom-1 } : { ok:false };
 });
 ok('la règle relève/fiche apparaît', pos.ok);
 ok('et elle est SOUS la liste', pos.sous);

 console.log('\n═══ LE BOUTON GÉNÉRIQUE MARCHE TOUJOURS ═══');
 await pg.click('#sheet #f-info-add'); await pg.waitForTimeout(500);
 ok('il ouvre la grille des six types', await pg.evaluate(()=>!!document.getElementById('typepick')));
 await pg.click('#typepick [data-pt="acces"]'); await pg.waitForTimeout(600);
 ok('et la ligne se crée',
    await pg.evaluate(()=>document.querySelectorAll('#sheet #f-infos .info-row').length===2));

 console.log('\n═══ TOUT RETIRER FAIT REVENIR LA GRILLE ═══');
 // ⚠️ Sans redessin de la zone, l'écran se serait retrouvé vide SANS
 //    aucun moyen d'ajouter quoi que ce soit.
 // ⚠️ UNE SUPPRESSION À LA FOIS, en RELISANT le document entre chaque :
 //    `drawInfos()` reconstruit la liste après le premier retrait, et
 //    les boutons suivants étaient déjà détachés. Mon premier jet les
 //    ramassait tous d'un coup et n'en supprimait qu'un.
 for (let i=0; i<6; i++){
   const reste = await pg.evaluate(()=>{
     const b=document.querySelector('#sheet [data-idel]'); if(!b) return 0;
     b.click(); return document.querySelectorAll('#sheet [data-idel]').length;
   });
   await pg.waitForTimeout(200);
   if (!reste) break;
 }
 await pg.waitForTimeout(400);
 ok('plus aucune ligne',
    await pg.evaluate(()=>document.querySelectorAll('#sheet #f-infos .info-row').length===0));
 ok('les six tuiles sont revenues',
    await pg.evaluate(()=>document.querySelectorAll('#sheet [data-iadd]').length===6));
 ok('et elles répondent encore',
    await pg.evaluate(()=>{ document.querySelector('#sheet [data-iadd="atcd"]').click();
      return document.querySelectorAll('#sheet #f-infos .info-row').length===1; }));

 console.log('\n═══ LES BOUTONS DOCUMENT SONT À PART ═══');
 await ouvrir();
 ok('un intertitre « Depuis un document » les sépare',
    await pg.evaluate(()=>/Depuis un document/.test(
      document.querySelector('#sheet [data-pane="info"]').textContent)));
 ok('et ils viennent APRÈS la zone d ajout',
    await pg.evaluate(()=>{
      const a=document.getElementById('f-info-actions').getBoundingClientRect();
      const d=document.getElementById('f-info-lire').getBoundingClientRect();
      return d.top >= a.bottom-1;
    }));

 console.log('\n═══ L ACCORD ═══');
 /* ⚠️ ON COMPARE LE LIBELLÉ EXACTEMENT, pas avec une expression.
    Mon premier jet écrivait /Document rattaché\b/ : en JavaScript, « é »
    n'est pas un caractère de mot, donc \b ne fait PAS frontière après
    lui — l'expression ratait « rattaché » suivi d'une espace, et
    attrapait « rattachés ». Trois contrôles rouges sur du code juste. */
 const acc=await pg.evaluate(id=>{
   const p=getP(id); const r={};
   const titre=()=>{ const e=document.querySelector('#f-atcd-liens .rowlab span');
     return e ? e.textContent.trim() : null; };
   const pose=()=>{ document.querySelector('#f-atcd-liens').innerHTML=blocOrdos(p,'atcd'); };
   const t=(h)=>{ const d=document.createElement('div'); d.innerHTML=h;
     const e=d.querySelector('.rowlab span'); return e ? e.textContent.trim() : null; };
   p.docs=[]; p.liens={}; pose(); r.zero=titre();
   p.docs=[{id:'d1',name:'x',type:'bio',precision:'INR',date:todayISO()}];
   p.liens={atcd:['d1']}; pose(); r.un=titre();
   p.docs.push({id:'d2',name:'y',type:'bio',precision:'NFS',date:todayISO()});
   p.liens.atcd.push('d2'); pose(); r.deux=titre();
   p.liens.traitement=['d1'];       r.ordo1=t(blocOrdos(p,'traitement'));
   p.liens.traitement=['d1','d2'];  r.ordo2=t(blocOrdos(p,'traitement'));
   return r;
 }, pid);
 // ⚠️ L'ANCIEN DÉFAUT, visible sur sa capture : « Documents rattaché ».
 ok('zéro → « Document rattaché »',  acc.zero==='📄 Document rattaché',   acc.zero);
 ok('un → « Document rattaché »',    acc.un  ==='📄 Document rattaché',   acc.un);
 ok('deux → « Documents rattachés »',acc.deux==='📄 Documents rattachés', acc.deux);
 // ⚠️ Ordonnance est FÉMININ : l'accord n'est pas le même.
 ok('une ordonnance → « Ordonnance rattachée »',  acc.ordo1==='📄 Ordonnance rattachée',   acc.ordo1);
 ok('deux → « Ordonnances rattachées »',          acc.ordo2==='📄 Ordonnances rattachées', acc.ordo2);

 console.log('\n═══ LES DEUX CHAMPS APPAREILLAGE, ASSUMÉS ═══');
 await ouvrir();
 ok('le champ libre est toujours là', await pg.isVisible('#sheet #f-appar'));
 // ⚠️ Il demandait de garder les deux : on le DIT, au lieu de laisser
 //    découvrir qu'il y a deux endroits pour la même chose.
 ok('et l écran dit à quoi sert chacun',
    await pg.evaluate(()=>/Appareillage & matériel/.test(
      document.querySelector('#sheet [data-pane="info"]').textContent)));

 console.log('\n═══ LA CONSOLE ═══');
 ok('aucune erreur de page', errs.length===0, errs.join(' | '));
 console.log('\n'+(ko.length?'⚠ '+ko.length+' point(s) : '+ko.join(' · '):'✓ tout tourne'));
 await nav.close(); srv.close(); process.exit(ko.length?1:0);
})().catch(e=>{console.error(e);process.exit(2);});
