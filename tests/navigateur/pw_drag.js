const { chromium } = require('playwright');
const http = require('http'); const fs = require('fs'); const path = require('path');
const ROOT='/home/claude/jmsante/www';
const MIME={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.svg':'image/svg+xml'};
const srv=http.createServer((q,r)=>{let u=decodeURIComponent(q.url.split('?')[0]);if(u==='/')u='/index.html';
  const f=path.join(ROOT,u); if(!f.startsWith(ROOT)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);r.end('404');return;}
  r.writeHead(200,{'Content-Type':MIME[path.extname(f)]||'application/octet-stream'});r.end(fs.readFileSync(f));});
let ko=0; const ok=(l,c)=>{console.log(`  ${c?'✓':'⚠'} ${l}`); if(!c)ko++;};
(async()=>{
 await new Promise(r=>srv.listen(8103,r));
 const nav=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
 const pg=await (await nav.newContext({viewport:{width:430,height:900}})).newPage();
 const errs=[]; pg.on('pageerror',e=>errs.push(String(e)));
 await pg.goto('http://localhost:8103/index.html'); await pg.waitForTimeout(2500);

 // 15 patients dans une tournée, pour que le coût se voie
 const tour = await pg.evaluate(()=>{
   S.confidentialityAck=true;
   const t = S.tours[0];
   // La démo n'a que 6 dossiers : on en fabrique assez pour que le coût se voie.
   while (S.patients.length < 18){
     const src = S.patients[0];
     S.patients.push({ ...src, id: uid(), nom: "Test-" + S.patients.length,
                       prenom: "Essai", tours: [t], visits: [], plan: [] });
   }
   S.patients.forEach(p=>{ if(!(p.tours||[]).includes(t)) (p.tours=p.tours||[]).push(t); });
   S.curTour = t; save();
   return t;
 });
 await pg.evaluate(t=>sheetAssignPatients(t), tour); await pg.waitForTimeout(900);

 console.log('\n═══ L ÉCRAN ═══');
 const n = await pg.evaluate(()=>document.querySelectorAll('#assign-list [data-ap]').length);
 ok(`${n} lignes affichées`, n>=15);
 ok('une poignée par ligne', await pg.evaluate(()=>document.querySelectorAll('#assign-list [data-drag]').length)===n);

 // ⚠️ LA MESURE : compter les recalculs de mise en page forcés pendant un glissement.
 console.log('\n═══ COÛT D UN GLISSEMENT (recalculs de mise en page) ═══');
 await pg.evaluate(()=>{
   window.__reflows = 0;
   const vrai = Element.prototype.getBoundingClientRect;
   Element.prototype.getBoundingClientRect = function(){ window.__reflows++; return vrai.apply(this, arguments); };
   const vraiOT = Object.getOwnPropertyDescriptor(HTMLElement.prototype,'offsetHeight');
   window.__offsets = 0;
   Object.defineProperty(HTMLElement.prototype,'offsetHeight',{
     get(){ window.__offsets++; return vraiOT.get.call(this); }, configurable:true });
 });

 const avant = await pg.evaluate(()=>[...document.querySelectorAll('#assign-list [data-ap]')].map(e=>e.dataset.ap));
 const h0 = await pg.locator('#assign-list [data-ap]').first().locator('[data-drag]').boundingBox();
 await pg.mouse.move(h0.x+h0.width/2, h0.y+h0.height/2);
 await pg.mouse.down();
 await pg.waitForTimeout(400);                 // la prise se fait à 260 ms
 const prise = await pg.evaluate(()=>!!document.querySelector('.ap-drag'));
 ok('la ligne est saisie après un court appui', prise);

 await pg.evaluate(()=>{ window.__reflows=0; window.__offsets=0; });
 // 40 petits mouvements : c'est le geste réel, pas un saut
 for (let i=1;i<=40;i++){ await pg.mouse.move(h0.x+h0.width/2, h0.y+h0.height/2 + i*6); await pg.waitForTimeout(16); }
 const cout = await pg.evaluate(()=>({ r:window.__reflows, o:window.__offsets }));
 console.log(`     ${cout.r} lectures de rect · ${cout.o} lectures de hauteur, pour 40 mouvements sur ${n} lignes`);
 // ⚠️ L'ancienne version lisait ~2 rects PAR LIGNE et PAR mouvement : 40 × 15 × 2 ≈ 1200.
 ok('AUCUNE lecture de mise en page pendant le geste (l ancienne : ~' + (40*18*2) + ')', cout.r + cout.o === 0);

 await pg.mouse.up(); await pg.waitForTimeout(600);
 const apres = await pg.evaluate(()=>[...document.querySelectorAll('#assign-list [data-ap]')].map(e=>e.dataset.ap));
 ok('la première ligne a bien changé de place', avant[0] !== apres[0] && apres.includes(avant[0]));
 ok('aucun patient perdu ni dupliqué',
    apres.length===avant.length && new Set(apres).size===apres.length
    && avant.every(id=>apres.includes(id)));
 const pos = apres.indexOf(avant[0]);
 console.log(`     la ligne saisie est passée de la place 1 à la place ${pos+1}`);
 ok('elle est descendue de plusieurs places', pos >= 2);

 console.log('\n═══ CE QUI NE DOIT PAS BOUGER ═══');
 ok('plus aucune ligne ne garde de transformation', await pg.evaluate(()=>
    [...document.querySelectorAll('#assign-list [data-ap]')].every(e=>!e.style.transform)));
 ok('la classe de glissement est retirée', await pg.evaluate(()=>
    !document.querySelector('.ap-drag') && !document.querySelector('.ap-dragging')));
 // ⚠️ Un simple appui sans bouger ne doit RIEN réordonner.
 const ref = await pg.evaluate(()=>[...document.querySelectorAll('#assign-list [data-ap]')].map(e=>e.dataset.ap));
 const h1 = await pg.locator('#assign-list [data-ap]').nth(3).locator('[data-drag]').boundingBox();
 await pg.mouse.move(h1.x+h1.width/2, h1.y+h1.height/2);
 await pg.mouse.down(); await pg.waitForTimeout(450); await pg.mouse.up(); await pg.waitForTimeout(500);
 ok('appuyer sans bouger ne réordonne rien', await pg.evaluate(r=>
    JSON.stringify([...document.querySelectorAll('#assign-list [data-ap]')].map(e=>e.dataset.ap))===JSON.stringify(r), ref));

 console.log('\nerreurs JS :', errs.length?errs.slice(0,3):'aucune');
 console.log(ko?`\n⚠ ${ko} point(s) en échec`:'\n✓ tout est au vert');
 await nav.close(); srv.close(); process.exit(ko||errs.length?1:0);
})();
