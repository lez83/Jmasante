const { chromium } = require('playwright');
const http=require('http'),fs=require('fs'),path=require('path');
const ROOT='/home/claude/jmsante/www';
const MIME={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.svg':'image/svg+xml'};
const srv=http.createServer((q,r)=>{let u=decodeURIComponent(q.url.split('?')[0]);if(u==='/')u='/index.html';
 const f=path.join(ROOT,u); if(!f.startsWith(ROOT)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);r.end('404');return;}
 r.writeHead(200,{'Content-Type':MIME[path.extname(f)]||'application/octet-stream'});r.end(fs.readFileSync(f));});
let ko=0; const ok=(l,c)=>{console.log(`  ${c?'✓':'⚠'} ${l}`); if(!c)ko++;};
(async()=>{
 await new Promise(r=>srv.listen(8104,r));
 const nav=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
 const pg=await (await nav.newContext({viewport:{width:430,height:900}})).newPage();
 const errs=[]; pg.on('pageerror',e=>errs.push(String(e)));
 await pg.goto('http://localhost:8104/index.html'); await pg.waitForTimeout(2500);

 // Un patient RETIRÉ de la tournée affichée — exactement son cas
 const info = await pg.evaluate(()=>{
   S.confidentialityAck=true; S.firstRun=false;
   const t=S.tours[0]; S.curTour=t;
   const dans=S.patients.find(p=>(p.tours||[]).includes(t));
   const hors=S.patients.find(p=>p.id!==dans.id);
   hors.tours=[];                       // rattaché à rien : plus dans l'ordre des passages
   hors.archived=null; hors.pec=null;
   save(); render();
   return { t, dansNom:dans.nom.replace('Demo-',''), horsNom:hors.nom.replace('Demo-',''), horsId:hors.id };
 });
 await pg.waitForTimeout(500);

 console.log('\n═══ LE CAS QU IL DÉCRIT ═══');
 ok('le patient hors tournée n a pas de carte au Moniteur',
    await pg.evaluate(id=>!document.querySelector(`.pcard[data-id="${id}"]`), info.horsId));

 await pg.evaluate(()=>sheetSearch()); await pg.waitForTimeout(400);
 await pg.fill('#srch-in', info.horsNom.slice(0,4)); await pg.waitForTimeout(500);
 const res = await pg.evaluate(()=>[...document.querySelectorAll('#srch-res .search-hit')]
   .map(e=>e.textContent.replace(/\s+/g,' ').trim()));
 ok('il apparaît bien dans les résultats', res.length>0);
 ok('le résultat annonce ce qui va s ouvrir',
    res.some(x=>x.includes('Hors de la tournée affichée')));

 await pg.click('#srch-res .search-hit'); await pg.waitForTimeout(800);
 // ⚠️ AVANT : rien ne se passait. Maintenant : sa fiche s'ouvre.
 /* ⚠️ Le nom est la VALEUR d'un champ de saisie : `textContent` ne la voit
    pas. Premier jet du contrôle faux pour cette raison. */
 const ouvert = await pg.evaluate(()=>({
   feuille: document.getElementById('veil').classList.contains('on'),
   titre: (document.getElementById('sheet').textContent||'').includes('Fiche patient'),
   nom: [...document.querySelectorAll('#sheet input')].map(e=>e.value).join(' ') }));
 ok('sa fiche s ouvre (avant : rien ne se passait)',
    ouvert.feuille && ouvert.titre && ouvert.nom.toUpperCase().includes(info.horsNom.toUpperCase()));

 console.log('\n═══ LE CAS NORMAL N A PAS CHANGÉ ═══');
 await pg.evaluate(()=>{ closeSheet(); sheetSearch(); }); await pg.waitForTimeout(400);
 await pg.fill('#srch-in', info.dansNom.slice(0,4)); await pg.waitForTimeout(500);
 await pg.click('#srch-res .search-hit'); await pg.waitForTimeout(700);
 ok('un patient DE la tournée ouvre toujours sa carte au Moniteur',
    await pg.evaluate(()=>!document.getElementById('veil').classList.contains('on')
                              && !!document.querySelector('.pcard.open')));

 console.log('\n═══ LES TROIS AUTRES SILENCES ═══');
 // Tournée « 🚫 Aucune »
 await pg.evaluate(()=>{ S.curTour='none'; save(); render(); sheetSearch(); }); await pg.waitForTimeout(400);
 await pg.fill('#srch-in', info.dansNom.slice(0,4)); await pg.waitForTimeout(500);
 await pg.click('#srch-res .search-hit'); await pg.waitForTimeout(700);
 ok('tournée « Aucune » : la fiche s ouvre au lieu de rien',
    await pg.evaluate(()=>document.getElementById('veil').classList.contains('on')));

 // Filtre actif qui masquerait la carte
 await pg.evaluate(t=>{ closeSheet(); S.curTour=t; filter='done'; save(); render(); sheetSearch(); }, info.t);
 await pg.waitForTimeout(400);
 await pg.fill('#srch-in', info.dansNom.slice(0,4)); await pg.waitForTimeout(500);
 await pg.click('#srch-res .search-hit'); await pg.waitForTimeout(700);
 ok('un filtre actif ne mange plus le résultat',
    await pg.evaluate(()=>filter==='all' && !!document.querySelector('.pcard.open')));

 // Un résultat « passage » sur un dossier archivé
 const aid = await pg.evaluate(()=>{
   const p=S.patients[2]; p.archived='2026-09-01'; p.tours=[];
   p.visits=[{id:'v9',date:'2026-09-01',note:'pansement zorglub fait',soins:[]}];
   save(); return p.id;
 });
 await pg.evaluate(()=>{ closeSheet(); sheetSearch(); }); await pg.waitForTimeout(400);
 await pg.fill('#srch-in','zorglub'); await pg.waitForTimeout(500);
 const n2 = await pg.evaluate(()=>document.querySelectorAll('#srch-res .search-hit').length);
 ok('un passage d un dossier archivé est trouvé', n2>0);
 await pg.click('#srch-res .search-hit'); await pg.waitForTimeout(700);
 ok('et il ouvre la fiche (avant : rien, l archivage n était pas testé)',
    await pg.evaluate(()=>document.getElementById('veil').classList.contains('on')));

 console.log('\nerreurs JS :', errs.length?errs.slice(0,3):'aucune');
 console.log(ko?`\n⚠ ${ko} point(s) en échec`:'\n✓ tout est au vert');
 await nav.close(); srv.close(); process.exit(ko||errs.length?1:0);
})();
